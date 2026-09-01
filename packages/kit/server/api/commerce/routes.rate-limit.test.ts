// The OUTER rate limiter (source-IP buckets, before any operation runs) must
// carry the same machine-readable retry hint as the per-operation admission:
// Retry-After on REST, extensions.retryAfterSec inside the forced-200 GraphQL
// error. Isolated in its own file because the limiter capacity is tuned via
// env at module load and the buckets are process-global.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  mutation: vi.fn(),
  query: vi.fn(),
  handleConvexError: vi.fn(),
}));

vi.mock("@/convex", () => ({
  api: {
    purchases: {
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

// Two source tokens, near-zero refill: the third unauthenticated request in
// this process trips the limiter deterministically. The env keys are read once
// at rate-limit.ts module load, so set them, import, then restore so a later
// test file sharing this worker sees the real defaults.
const TUNED = {
  RATE_LIMIT_IP_CAPACITY: "2",
  RATE_LIMIT_IP_REFILL_PER_SEC: "0.001",
} as const;
const saved = Object.fromEntries(
  Object.keys(TUNED).map((key) => [key, process.env[key]]),
);
Object.assign(process.env, TUNED);
let commerceRoutes: Hono;
try {
  ({ commerceRoutes } = (await import("./routes")) as unknown as {
    commerceRoutes: Hono;
  });
} finally {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function buildApp(): Hono {
  const app = new Hono();
  app.route("/commerce/v1", commerceRoutes);
  return app;
}

describe("outer rate limit retry hint", () => {
  it("carries Retry-After on REST and retryAfterSec in the GraphQL error body", async () => {
    const app = buildApp();
    // Drain the two source tokens with cheap unauthenticated reads.
    for (let i = 0; i < 2; i += 1) {
      const warm = await app.request("/commerce/v1/capabilities");
      expect(warm.status).toBe(200);
    }

    const rest = await app.request("/commerce/v1/capabilities");
    expect(rest.status).toBe(429);
    const restBody = await rest.json();
    expect(restBody.error.code).toBe("RATE_LIMITED");
    const header = rest.headers.get("Retry-After");
    expect(header).toBeTruthy();
    expect(Number(header)).toBeGreaterThan(0);

    const graphql = await app.request("/commerce/v1/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "query { providerCapabilities { specVersion } }",
      }),
    });
    // SPEC.md 7 single-status policy: the GraphQL surface answers 200, and the
    // retry hint must survive into the error extensions, not only the header.
    expect(graphql.status).toBe(200);
    const body = await graphql.json();
    expect(body.errors[0].extensions.code).toBe("RATE_LIMITED");
    expect(typeof body.errors[0].extensions.retryAfterSec).toBe("number");
    expect(body.errors[0].extensions.retryAfterSec).toBeGreaterThan(0);
  });
});
