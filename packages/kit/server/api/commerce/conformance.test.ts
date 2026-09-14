// IAPKit's dual-binding conformance proof: the spec package's portable runner
// drives the real commerce routes — REST and GraphQL, through the real
// adapters, shared handlers, auth, and validation — against an in-memory
// Convex substitute seeded from the runner's own fixtures. Store credentials
// are not involved; SPEC.md 11.3 scopes what this certifies.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import Ajv from "ajv/dist/2020";
import {
  createGraphqlAdapter,
  createRestAdapter,
  operationVectors,
  runConformance,
} from "@hyodotdev/openiap-commerce-protocol/conformance";

import {
  SIGNATURE_TOLERANCE_SECONDS,
  classifyDeliveryResponse,
  composeDeliveryHeaders,
  signPayload,
} from "../../../convex/commerce/signing";
import {
  commerceEventTypesToEmit,
  type CommerceEventType,
} from "../../../convex/commerce/contract";
import { isEntitledAt } from "../../../convex/subscriptions/query";

// IAPKit's descriptor declares the events profile, so dual-binding conformance
// drives the EventsAdapter surface (SPEC.md §11.2/§11.3 scope its coverage;
// §9.2/§9.3/§9.4.4/§9.4.5 are certified by IAPKit's own convex tests, not
// here). Every method but one delegates to SHIPPED code: signing (signPayload),
// the delivery envelope (composeDeliveryHeaders, which the worker in
// convex/commerce/delivery.ts sends), response classification
// (classifyDeliveryResponse, which the worker records), the emission rules
// (commerceEventTypesToEmit), and the entitlement gate (isEntitledAt). Only
// `verify` has no production counterpart — IAPKit emits webhooks, consumers
// verify them — so it is written here from the shipped tolerance.
const iapkitEventsAdapter = {
  sign: ({
    secret,
    timestamp,
    body,
  }: {
    secret: string;
    timestamp: number;
    body: string;
  }) => signPayload(secret, timestamp, body),
  verify: async ({
    body,
    timestamp,
    signature,
    secrets,
    now,
  }: {
    body: string;
    timestamp: number;
    signature: string;
    secrets: string[];
    now: number;
  }) => {
    if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;
    const held = await Promise.all(
      secrets.map((secret) => signPayload(secret, timestamp, body)),
    );
    return signature
      .split(",")
      .map((part) => part.trim())
      .some((presented) => held.includes(presented));
  },
  delivery: async ({
    event,
    body,
    timestamp,
    secrets,
    deliveryId,
  }: {
    event: { eventId: string };
    body: string;
    timestamp: number;
    secrets: string[];
    deliveryId: string;
  }) => {
    const headers = await composeDeliveryHeaders({
      secrets: { current: secrets[0], previous: secrets[1] },
      timestampSeconds: timestamp,
      body,
      eventId: event.eventId,
      deliveryId,
    });
    // POST is how delivery.ts sends (buildPinnedRequestOptions); there is no
    // method constant to import.
    return { method: "POST", contentType: headers["content-type"], headers };
  },
  // The worker passes `undefined` when no status arrived (its catch path).
  classifyResponse: (status: number | "connection-error" | "timeout") =>
    classifyDeliveryResponse(typeof status === "number" ? status : undefined),
  entitled: ({
    state,
    expiresAt,
    processedAt,
  }: {
    state: string;
    expiresAt?: number;
    processedAt: number;
  }) => isEntitledAt(state, expiresAt, processedAt),
  emission: ({
    lifecycleEvent,
    entitledBefore,
    entitledAfter,
  }: {
    lifecycleEvent: string | null;
    entitledBefore: boolean;
    entitledAfter: boolean;
  }) =>
    commerceEventTypesToEmit({
      lifecycleType: (lifecycleEvent ?? null) as CommerceEventType | null,
      active: entitledAfter,
      previouslyActive: entitledBefore,
      hasBoundUser: true,
    }),
  coalesceAtBinding: ({ entitledAtBinding }: { entitledAtBinding: boolean }) =>
    commerceEventTypesToEmit({
      lifecycleType: null,
      active: entitledAtBinding,
      previouslyActive: false,
      hasBoundUser: true,
    }),
};

const FIXTURES = operationVectors.fixtures as {
  userId: string;
  erasureUserId: string;
  appleJws: string;
  googlePurchaseToken: string;
};

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  mutation: vi.fn(),
  query: vi.fn(),
  handleConvexError: vi.fn(),
}));

vi.mock("@/convex", () => ({
  api: {
    purchases: {
      action: {
        readBoundPurchaseEntitlements: "readBoundPurchaseEntitlements",
      },
      mutation: {
        bindVerifiedPurchaseAsServer: "bindVerifiedPurchaseAsServer",
      },
      ios: { verifyAppStoreReceiptInternalV1: "verifyApple" },
      android: { verifyGooglePlayReceiptInternalV1: "verifyGoogle" },
      horizon: { verifyMetaHorizonReceiptInternalV1: "verifyHorizon" },
      amazon: { verifyAmazonReceiptInternalV1: "verifyAmazon" },
    },
    subscriptions: {
      query: {
        subscriptionStatusV2: "subscriptionStatusV2",
        entitlementsV2: "entitlementsV2",
        assertServerAccess: "assertServerAccess",
      },
      mutation: {
        bindUserAsServer: "bindUserAsServer",
        requestUserErasure: "requestUserErasure",
      },
    },
  },
}));

vi.mock("../../convex", () => ({
  client: {
    action: mocks.action,
    mutation: mocks.mutation,
    query: mocks.query,
  },
  handleConvexError: mocks.handleConvexError,
}));

const { commerceRoutes } = await import("./routes");

const CREDENTIALS = {
  verification: "openiap-kit_pk_conformance",
  server: "openiap-kit_sk_conformance",
};
const BASE_URL = "https://kit.conformance.example";

function buildApp(): Hono {
  const app = new Hono();
  app.route("/commerce/v1", commerceRoutes);
  return app;
}

// A ConvexError the real key check would throw, so an unknown key becomes
// UNAUTHORIZED and a publishable key on a server op becomes FORBIDDEN — the
// authoritative classification the edge prefix check cannot make.
class FakeConvexError extends Error {
  constructor(readonly data: { code: string; message: string }) {
    super(data.message);
  }
}

function assertKnownKey(apiKey: unknown): void {
  if (apiKey !== CREDENTIALS.verification && apiKey !== CREDENTIALS.server) {
    throw new FakeConvexError({
      code: "INVALID_API_KEY",
      message: "API key is invalid or inactive",
    });
  }
}

function assertServerKey(apiKey: unknown): void {
  assertKnownKey(apiKey);
  if (apiKey !== CREDENTIALS.server) {
    throw new FakeConvexError({
      code: "INSUFFICIENT_SCOPE",
      message: "This operation requires a secret admin key",
    });
  }
}

function seedConvexFixtures() {
  const now = Date.now();
  // Shaped like the real subscriptionV2Shape, id included, so the test proves
  // the handler strips the provider-internal id from tokenless responses.
  const row = {
    id: "subscriptions:mock-row-1",
    productId: "premium.monthly",
    platform: "Android" as const,
    state: "Active",
    expiresAt: now + 30 * 86_400_000,
    willRenew: true,
    startedAt: now - 86_400_000,
    updatedAt: now - 1_000,
  };

  mocks.handleConvexError.mockImplementation((error: unknown) =>
    error instanceof FakeConvexError ? error.data : null,
  );

  mocks.action.mockImplementation(async (name: unknown, args: unknown) => {
    assertKnownKey((args as { apiKey: string }).apiKey);
    if (name === "readBoundPurchaseEntitlements") {
      assertServerKey((args as { apiKey: string }).apiKey);
      return { productIds: [] };
    }
    return {
      isValid: true,
      state: "ENTITLED",
      productId: "premium.monthly",
      environment: name === "verifyGoogle" ? "Production" : "Sandbox",
    };
  });

  mocks.query.mockImplementation(async (name: unknown, args: unknown) => {
    const { apiKey, userId } = args as { apiKey: string; userId: string };
    assertServerKey(apiKey);
    if (name === "assertServerAccess") {
      return { ok: true };
    }
    const owned = userId === FIXTURES.userId;
    if (name === "subscriptionStatusV2") {
      return { active: owned, subscription: owned ? row : null };
    }
    if (name === "entitlementsV2") {
      return {
        userId,
        productIds: owned ? [row.productId] : [],
        subscriptions: owned ? [row] : [],
      };
    }
    throw new Error(`unexpected query ${String(name)}`);
  });

  const erasureJobs = new Map<string, { jobId: string; status: string }>();
  mocks.mutation.mockImplementation(async (name: unknown, args: unknown) => {
    const { apiKey } = args as { apiKey: string };
    assertServerKey(apiKey);
    if (name === "bindVerifiedPurchaseAsServer") return { bound: false };
    if (name === "bindUserAsServer") {
      const { purchaseToken, userId } = args as {
        purchaseToken: string;
        userId: string;
      };
      return {
        ok: true,
        bound:
          purchaseToken === FIXTURES.googlePurchaseToken &&
          userId === FIXTURES.userId,
      };
    }
    if (name === "requestUserErasure") {
      const { userId } = args as { userId: string };
      const job = erasureJobs.get(userId) ?? {
        jobId: `job-${erasureJobs.size + 1}`,
        status: "queued",
      };
      erasureJobs.set(userId, job);
      return { ok: true, ...job };
    }
    throw new Error(`unexpected mutation ${String(name)}`);
  });
}

describe("IAPKit dual-binding conformance", () => {
  beforeEach(() => {
    mocks.action.mockReset();
    mocks.mutation.mockReset();
    mocks.query.mockReset();
    mocks.handleConvexError.mockReset();
    mocks.handleConvexError.mockReturnValue(null);
    seedConvexFixtures();
  });

  it("passes every operation vector on both bindings with cross-binding parity", async () => {
    const app = buildApp();
    const fetchApp = async (url: string, options?: RequestInit) =>
      app.request(url, options);

    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: fetchApp,
          credentials: CREDENTIALS,
        }),
        createGraphqlAdapter({
          url: `${BASE_URL}/commerce/v1/graphql`,
          fetch: fetchApp,
          credentials: CREDENTIALS,
        }),
      ],
      Ajv,
      eventsAdapter: iapkitEventsAdapter,
      credentials: CREDENTIALS,
    });

    expect(report.results.filter((result) => !result.ok)).toEqual([]);
    // The declared events profile was actually verified, not silently skipped.
    expect(
      report.results.some((r) => r.id === "events.profile-verification"),
    ).toBe(true);
    expect(report.parityFailures).toEqual([]);
    expect(report.ok).toBe(true);
    const bindings = new Set(report.results.map((result) => result.binding));
    expect([...bindings].sort()).toEqual(["graphql", "rest"]);
  });

  it("keeps the served capability descriptor equal to the published one, minus the comment", async () => {
    const app = buildApp();
    const response = await app.request("/commerce/v1/capabilities");
    expect(response.status).toBe(200);
    const served = await response.json();
    const { $comment, ...published } = (
      await import("@hyodotdev/openiap-commerce-protocol/examples/provider-capabilities.json")
    ).default as Record<string, unknown>;
    expect($comment).toBeTruthy();
    expect(served).toEqual(published);
  });
});
