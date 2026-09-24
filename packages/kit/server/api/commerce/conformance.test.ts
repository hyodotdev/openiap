// IAPKit's dual-binding conformance proof: the spec package's portable runner
// drives the real commerce routes — REST and GraphQL, through the real
// adapters, shared handlers, auth, and validation — against an in-memory
// Convex substitute seeded from the runner's own fixtures. Amazon and Horizon
// purchases run through IAPKit's own purchase functions, answered by fixture
// store responses; no request reaches a store. SPEC.md 11.3 scopes what this
// certifies.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import Ajv from "ajv/dist/2020";
import { getFunctionName } from "convex/server";
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
import { getProjectByApiKey as getProjectByApiKeyQuery } from "../../../convex/projects/internal";
import { readBoundPurchaseEntitlements as readBoundPurchaseEntitlementsAction } from "../../../convex/purchases/action";
import { verifyAmazonReceiptInternalV1 } from "../../../convex/purchases/amazon";
import { verifyMetaHorizonReceiptInternalV1 } from "../../../convex/purchases/horizon";
import {
  buildAmazonRemoteId,
  buildHorizonRemoteId,
} from "../../../convex/purchases/identity";
import { boundPurchasesForUser as boundPurchasesForUserQuery } from "../../../convex/purchases/internal";
import { bindVerifiedPurchaseAsServer as bindVerifiedPurchaseAsServerMutation } from "../../../convex/purchases/mutation";
import { HarmonizedPurchaseState } from "../../../convex/purchases/purchaseState";
import { consume as consumeAdmissionMutation } from "../../../convex/purchases/verificationAdmission";
import { testableFunction } from "../../../convex/test.setup";

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
  amazonUserId: string;
  amazonReceiptId: string;
  horizonUserId: string;
  horizonSku: string;
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

const getProjectByApiKey = testableFunction(getProjectByApiKeyQuery)._handler;
const boundPurchasesForUser = testableFunction(
  boundPurchasesForUserQuery,
)._handler;
const consumeAdmission = testableFunction(consumeAdmissionMutation)._handler;
const readBoundPurchaseEntitlements = testableFunction(
  readBoundPurchaseEntitlementsAction,
)._handler;
const bindVerifiedPurchaseAsServer = testableFunction(
  bindVerifiedPurchaseAsServerMutation,
)._handler;
const verifyAmazonReceipt = testableFunction(
  verifyAmazonReceiptInternalV1,
)._handler;
const verifyHorizonReceipt = testableFunction(
  verifyMetaHorizonReceiptInternalV1,
)._handler;

type Row = Record<string, unknown> & { _id: string };
type ConvexReference = Parameters<typeof getFunctionName>[0];
type EqualityRange = { eq(field: string, value: unknown): EqualityRange };
type FieldFilter = {
  field(name: string): string;
  eq(field: string, value: unknown): (row: Row) => boolean;
};

const PROJECT_ID = "projects:conformance";
const ORGANIZATION_ID = "organizations:conformance";
const AMAZON_PRODUCT = "conformance.amazon.premium";

// The slice of ctx.db the purchase functions use: equality index lookups, a
// field filter, get, and patch.
function memoryDatabase(tables: Record<string, Row[]>) {
  const byId = (id: unknown): Row | null =>
    Object.values(tables)
      .flat()
      .find((row) => row._id === id) ?? null;
  return {
    query(table: string) {
      const matches: Array<(row: Row) => boolean> = [];
      const rows = () =>
        (tables[table] ?? []).filter((row) =>
          matches.every((match) => match(row)),
        );
      const query = {
        withIndex(_index: string, range: (q: EqualityRange) => unknown) {
          const equality: EqualityRange = {
            eq(field, value) {
              matches.push((row) => row[field] === value);
              return equality;
            },
          };
          range(equality);
          return query;
        },
        filter(predicate: (q: FieldFilter) => (row: Row) => boolean) {
          matches.push(
            predicate({
              field: (name) => name,
              eq: (field, value) => (row) => row[field] === value,
            }),
          );
          return query;
        },
        first: async () => rows()[0] ?? null,
        unique: async () => {
          const found = rows();
          if (found.length > 1) throw new Error(`Ambiguous ${table} rows`);
          return found[0] ?? null;
        },
        take: async (count: number) => rows().slice(0, count),
      };
      return query;
    },
    get: async (id: unknown) => byId(id),
    patch: async (id: unknown, value: Record<string, unknown>) => {
      const row = byId(id);
      if (!row) throw new Error(`Missing row ${String(id)}`);
      Object.assign(row, value);
    },
  };
}

// One project whose Amazon and Horizon purchases are already bound to the
// fixture user, so both bindings read the same state in any case order.
function purchaseTables(): Record<string, Row[]> {
  const bound = (
    store: string,
    remoteId: string,
    productId: string,
    requestData: Record<string, unknown>,
  ): Row => ({
    _id: `purchases:${store}`,
    projectId: PROJECT_ID,
    store,
    remoteId,
    requestData: { store, ...requestData },
    productId,
    state: HarmonizedPurchaseState.ENTITLED,
    isValid: true,
    appUserId: FIXTURES.userId,
  });
  const amazon = {
    userId: FIXTURES.amazonUserId,
    receiptId: FIXTURES.amazonReceiptId,
    sandbox: true,
  };
  return {
    organizations: [{ _id: ORGANIZATION_ID }],
    projects: [
      {
        _id: PROJECT_ID,
        organizationId: ORGANIZATION_ID,
        amazonSandboxEnabled: true,
        horizonEnabled: true,
        horizonAppId: "conformance-horizon-app",
        horizonAppSecret: "conformance-horizon-secret",
      },
    ],
    apiKeys: [
      {
        _id: "apiKeys:server",
        projectId: PROJECT_ID,
        organizationId: ORGANIZATION_ID,
        key: CREDENTIALS.server,
        keyType: "secret",
      },
      {
        _id: "apiKeys:verification",
        projectId: PROJECT_ID,
        organizationId: ORGANIZATION_ID,
        key: CREDENTIALS.verification,
        keyType: "publishable",
      },
    ],
    purchases: [
      bound("amazon", buildAmazonRemoteId(amazon), AMAZON_PRODUCT, amazon),
      bound(
        "horizon",
        buildHorizonRemoteId(FIXTURES.horizonUserId, FIXTURES.horizonSku),
        FIXTURES.horizonSku,
        { userId: FIXTURES.horizonUserId, sku: FIXTURES.horizonSku },
      ),
    ],
    subscriptionUserErasureJobs: [],
  };
}

// Runs IAPKit's purchase functions over the tables. Persisting a store verdict
// only updates the row; everything else is the real handler. Arguments are
// typed `never` because each call forwards what the calling Convex code sent.
function purchaseFunctions() {
  const tables = purchaseTables();
  const ctx = {
    db: memoryDatabase(tables),
    runQuery: (reference: ConvexReference, args: never) =>
      runInternal(reference, args),
    runMutation: (reference: ConvexReference, args: never) =>
      runInternal(reference, args),
  };
  function recordVerdict(verdict: {
    store: string;
    remoteId?: string;
    state: string;
    isValid: boolean;
  }): null {
    const row = tables.purchases.find(
      (purchase) =>
        purchase.store === verdict.store &&
        purchase.remoteId === verdict.remoteId,
    );
    if (row)
      Object.assign(row, { state: verdict.state, isValid: verdict.isValid });
    return null;
  }
  async function runInternal(
    reference: ConvexReference,
    args: never,
  ): Promise<unknown> {
    switch (getFunctionName(reference)) {
      case "projects/internal:getProjectByApiKey":
        return getProjectByApiKey(ctx, args);
      case "purchases/internal:boundPurchasesForUser":
        return boundPurchasesForUser(ctx, args);
      case "purchases/verificationAdmission:consume":
        return consumeAdmission(ctx, args);
      case "purchases/internal:saveReceiptInternal":
        return recordVerdict(args);
      default:
        throw new Error(
          `Unexpected Convex function ${getFunctionName(reference)}`,
        );
    }
  }
  return ctx;
}

// Fixture store answers for the fixture evidence. Any other host throws, so
// the run never reaches a real store.
const storeRequests: string[] = [];
async function storeFetch(input: string | URL | Request): Promise<Response> {
  const { hostname } = new URL(input instanceof Request ? input.url : input);
  storeRequests.push(hostname);
  if (hostname === "appstore-sdk.amazon.com") {
    return Response.json({
      receiptId: FIXTURES.amazonReceiptId,
      productId: AMAZON_PRODUCT,
      productType: "ENTITLED",
      cancelDate: null,
    });
  }
  if (hostname === "graph.oculus.com") {
    return Response.json({ success: true, grant_time: 1_758_000_000 });
  }
  throw new Error(`Unexpected store request to ${hostname}`);
}

// Apple and Google verdicts need signed store payloads, so they stay canned.
function cannedVerdict(name: unknown, args: { apiKey: string }) {
  assertKnownKey(args.apiKey);
  return {
    isValid: true,
    state: "ENTITLED",
    productId: "premium.monthly",
    environment: name === "verifyGoogle" ? "Production" : "Sandbox",
  };
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
  const purchases = purchaseFunctions();

  mocks.handleConvexError.mockImplementation((error: unknown) =>
    error instanceof FakeConvexError ? error.data : null,
  );

  mocks.action.mockImplementation(async (name: unknown, args: never) => {
    switch (name) {
      case "readBoundPurchaseEntitlements":
        return readBoundPurchaseEntitlements(purchases, args);
      case "verifyAmazon":
        return verifyAmazonReceipt(purchases, args);
      case "verifyHorizon":
        return verifyHorizonReceipt(purchases, args);
      default:
        return cannedVerdict(name, args);
    }
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
  const subscriptionMutation = (name: unknown, args: unknown) => {
    const { apiKey } = args as { apiKey: string };
    assertServerKey(apiKey);
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
  };
  mocks.mutation.mockImplementation(async (name: unknown, args: never) =>
    name === "bindVerifiedPurchaseAsServer"
      ? bindVerifiedPurchaseAsServer(purchases, args)
      : subscriptionMutation(name, args),
  );
}

describe("IAPKit dual-binding conformance", () => {
  beforeEach(() => {
    mocks.action.mockReset();
    mocks.mutation.mockReset();
    mocks.query.mockReset();
    mocks.handleConvexError.mockReset();
    mocks.handleConvexError.mockReturnValue(null);
    seedConvexFixtures();
    storeRequests.length = 0;
    vi.stubGlobal("fetch", storeFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    // The Amazon and Horizon paths reached the fixture store answers.
    expect(new Set(storeRequests)).toEqual(
      new Set(["appstore-sdk.amazon.com", "graph.oculus.com"]),
    );
  });

  it("lists store-confirmed Amazon and Horizon products without subscription records", async () => {
    const response = await buildApp().request(
      `/commerce/v1/entitlements?userId=${FIXTURES.userId}`,
      { headers: { Authorization: `Bearer ${CREDENTIALS.server}` } },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.productIds.sort()).toEqual(
      ["premium.monthly", AMAZON_PRODUCT, FIXTURES.horizonSku].sort(),
    );
    expect(
      body.subscriptions.map(
        (record: { productId: string }) => record.productId,
      ),
    ).toEqual(["premium.monthly"]);
  });

  // The runner also accepts VERIFICATION_FAILED for these vectors, so pin the
  // verdict itself.
  it.each(["amazon", "horizon"])(
    "verifies the %s fixture purchase against the fixture store answer",
    async (store) => {
      const vector = operationVectors.cases.find(
        (candidate) =>
          candidate.id === `verifyPurchase.success.contract.${store}`,
      );
      const response = await buildApp().request(
        "/commerce/v1/purchases/verify",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CREDENTIALS.verification}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(vector?.input),
        },
      );
      expect(response.status).toBe(200);
      expect((await response.json()).isValid).toBe(true);
    },
  );

  it("fails the entitlements read with VERIFICATION_FAILED when the store cannot answer", async () => {
    // RVS 496 is a store-side fault, not a verdict about the receipt.
    vi.stubGlobal("fetch", async () => new Response("", { status: 496 }));
    const response = await buildApp().request(
      `/commerce/v1/entitlements?userId=${FIXTURES.userId}`,
      { headers: { Authorization: `Bearer ${CREDENTIALS.server}` } },
    );
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("VERIFICATION_FAILED");
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
