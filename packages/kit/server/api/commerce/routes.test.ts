// Edge behavior the conformance vectors do not pin: Convex error mapping,
// oversized bodies, GraphQL bounds, introspection agreement, and the
// evidence-normalization paths of bindPurchase.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { buildSchema, getIntrospectionQuery, printSchema } from "graphql";
import operationsSdl from "openiap-commerce-protocol/generated/bindings/operations-sdl.json";

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

const { commerceRoutes } = await import("./routes");
const { commerceGraphqlSchema } = await import("./graphql");

const SERVER_KEY = "openiap-kit_sk_unit";
const CLIENT_KEY = "openiap-kit_pk_unit";
const GOOGLE_TOKEN = "unit-google-purchase-token-0000000001";

function buildApp(): Hono {
  const app = new Hono();
  app.route("/commerce/v1", commerceRoutes);
  return app;
}

function post(
  app: Hono,
  path: string,
  body: unknown,
  key: string | null = SERVER_KEY,
) {
  return app.request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("commerce REST adapter", () => {
  beforeEach(() => {
    mocks.action.mockReset();
    mocks.mutation.mockReset();
    mocks.query.mockReset();
    mocks.handleConvexError.mockReset();
    mocks.handleConvexError.mockReturnValue(null);
  });

  it("maps a Convex INVALID_API_KEY onto UNAUTHORIZED with status 401", async () => {
    mocks.query.mockRejectedValue(new Error("boom"));
    mocks.handleConvexError.mockReturnValue({
      code: "INVALID_API_KEY",
      message: "API key is invalid or inactive",
    });
    const response = await buildApp().request(
      "/commerce/v1/subscriptions/status?userId=user-1",
      { headers: { Authorization: `Bearer ${SERVER_KEY}` } },
    );
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("maps a Convex INSUFFICIENT_SCOPE onto FORBIDDEN with status 403", async () => {
    mocks.query.mockRejectedValue(new Error("boom"));
    mocks.handleConvexError.mockReturnValue({
      code: "INSUFFICIENT_SCOPE",
      message: "This operation requires a secret admin key",
    });
    const response = await buildApp().request(
      "/commerce/v1/entitlements?userId=user-1",
      { headers: { Authorization: `Bearer openiap-kit_legacy` } },
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });

  it("reports VERIFICATION_FAILED as 502 when the store verdict is unreachable", async () => {
    mocks.action.mockRejectedValue(new Error("upstream down"));
    const response = await post(
      buildApp(),
      "/commerce/v1/purchases/verify",
      { store: "google", google: { purchaseToken: GOOGLE_TOKEN } },
      CLIENT_KEY,
    );
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe("VERIFICATION_FAILED");
    expect(body.error.message).not.toContain("upstream");
  });

  it("preserves the Convex admission retry hint", async () => {
    mocks.action.mockRejectedValue(new Error("limited"));
    mocks.handleConvexError.mockReturnValue({
      code: "RATE_LIMITED",
      message: "Too many verification requests",
      retryAfterSec: 2,
    });

    const response = await post(
      buildApp(),
      "/commerce/v1/purchases/verify",
      { store: "google", google: { purchaseToken: GOOGLE_TOKEN } },
      CLIENT_KEY,
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("2");
    expect((await response.json()).error.code).toBe("RATE_LIMITED");
  });

  it.each([
    "PLAY_STORE_VERIFICATION_ERROR",
    "META_HORIZON_VERIFICATION_ERROR",
    "AMAZON_RECEIPT_VERIFICATION_ERROR",
    "APP_STORE_TRANSACTION_VERIFICATION_FAILED",
  ])(
    "maps the structured store error %s to VERIFICATION_FAILED 502",
    async (code) => {
      mocks.action.mockRejectedValue(new Error("convex error"));
      mocks.handleConvexError.mockReturnValue({
        code,
        message: `store said no for token ghi789 at /verify/${code}`,
      });
      const response = await post(
        buildApp(),
        "/commerce/v1/purchases/verify",
        { store: "google", google: { purchaseToken: GOOGLE_TOKEN } },
        CLIENT_KEY,
      );
      expect(response.status).toBe(502);
      expect((await response.json()).error.code).toBe("VERIFICATION_FAILED");
    },
  );

  it("logs no raw provider detail — only codes and error class", async () => {
    const logged: string[] = [];
    const spy = vi
      .spyOn(console, "error")
      .mockImplementation((...args: unknown[]) => {
        logged.push(args.map(String).join(" "));
      });
    try {
      mocks.query.mockRejectedValue(
        new Error(
          "ConvexError at /srv/convex/subscriptions/query.ts:512 token=ghi789",
        ),
      );
      mocks.handleConvexError.mockReturnValue({
        code: "INTERNAL_ERROR",
        message:
          "row subscriptions:abc for userId=alice token=ghi789 upstream=https://buy.itunes.apple.com failed",
      });
      const response = await buildApp().request(
        "/commerce/v1/subscriptions/status?userId=user-1",
        { headers: { Authorization: `Bearer ${SERVER_KEY}` } },
      );
      expect(response.status).toBe(500);
      const combined = logged.join("\n");
      for (const secret of [
        "ghi789",
        "subscriptions:abc",
        "userId=alice",
        "buy.itunes.apple.com",
        "query.ts:512",
      ]) {
        expect(combined).not.toContain(secret);
      }
    } finally {
      spy.mockRestore();
    }
  });

  it("rejects an oversized body before any Convex call", async () => {
    const response = await post(buildApp(), "/commerce/v1/purchases/verify", {
      store: "google",
      google: { purchaseToken: "x".repeat(40_000) },
    });
    expect(response.status).toBe(400);
    expect(mocks.action).not.toHaveBeenCalled();
  });

  it("binds an Apple purchase by the transaction id inside the JWS", async () => {
    mocks.mutation.mockResolvedValue({ ok: true, bound: true });
    const payload = Buffer.from(
      JSON.stringify({ originalTransactionId: "2000000123456789" }),
    ).toString("base64url");
    const jws = `eyJhbGciOiJFUzI1NiJ9.${payload}.c2lnbmF0dXJl`;
    const response = await post(buildApp(), "/commerce/v1/purchases/bind", {
      userId: "user-1",
      store: "apple",
      apple: { jws },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ bound: true });
    expect(mocks.mutation).toHaveBeenCalledWith("bindUserAsServer", {
      apiKey: SERVER_KEY,
      purchaseToken: "2000000123456789",
      userId: "user-1",
    });
  });

  it("rejects an Apple JWS that carries no transaction identity", async () => {
    const payload = Buffer.from(JSON.stringify({ nothing: true })).toString(
      "base64url",
    );
    const response = await post(buildApp(), "/commerce/v1/purchases/bind", {
      userId: "user-1",
      store: "apple",
      apple: { jws: `eyJhbGciOiJFUzI1NiJ9.${payload}.c2ln` },
    });
    expect(response.status).toBe(400);
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("reports a Horizon purchase as not bound without exposing why", async () => {
    const response = await post(buildApp(), "/commerce/v1/purchases/bind", {
      userId: "user-1",
      store: "horizon",
      horizon: { userId: "1234567890", sku: "premium" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ bound: false });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("authenticates before revealing a non-binding store verdict", async () => {
    // The unknown key clears the edge (it is not a publishable prefix) but fails
    // the authoritative check. It must get UNAUTHORIZED, not `bound: false`.
    mocks.query.mockRejectedValue(new Error("boom"));
    mocks.handleConvexError.mockReturnValue({
      code: "INVALID_API_KEY",
      message: "API key is invalid or inactive",
    });
    const response = await post(
      buildApp(),
      "/commerce/v1/purchases/bind",
      {
        userId: "user-1",
        store: "horizon",
        horizon: { userId: "1", sku: "x" },
      },
      "openiap-kit_sk_unknown",
    );
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    // Auth ran first, and no binding happened for an unauthenticated caller.
    expect(mocks.query).toHaveBeenCalledWith("assertServerAccess", {
      apiKey: "openiap-kit_sk_unknown",
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("authenticates before evidence parsing: an unknown key with malformed evidence gets 401, not INVALID_REQUEST", async () => {
    mocks.query.mockRejectedValue(new Error("boom"));
    mocks.handleConvexError.mockReturnValue({
      code: "INVALID_API_KEY",
      message: "API key is invalid or inactive",
    });
    const response = await post(
      buildApp(),
      "/commerce/v1/purchases/bind",
      { userId: "user-1", store: "apple", apple: { jws: "not-a-valid-jws" } },
      "openiap-kit_sk_unknown",
    );
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("maps an under-scoped key on bind to FORBIDDEN before store validation", async () => {
    mocks.query.mockRejectedValue(new Error("boom"));
    mocks.handleConvexError.mockReturnValue({
      code: "INSUFFICIENT_SCOPE",
      message: "This operation requires a secret admin key",
    });
    const response = await post(
      buildApp(),
      "/commerce/v1/purchases/bind",
      {
        userId: "user-1",
        store: "horizon",
        horizon: { userId: "1", sku: "x" },
      },
      "openiap-kit_legacy",
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("authenticates a server read before input schema validation (REST)", async () => {
    // SPEC.md 5: the transport must not answer INVALID_REQUEST about a
    // privileged read's input to a caller whose credential is unknown.
    mocks.query.mockRejectedValue(new Error("boom"));
    mocks.handleConvexError.mockReturnValue({
      code: "INVALID_API_KEY",
      message: "API key is invalid or inactive",
    });
    const overlong = "x".repeat(600);
    const response = await buildApp().request(
      `/commerce/v1/subscriptions/status?userId=${overlong}`,
      { headers: { Authorization: "Bearer openiap-kit_sk_unknown" } },
    );
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    // Exactly the authoritative gate ran — the read itself was never consulted.
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query).toHaveBeenCalledWith("assertServerAccess", {
      apiKey: "openiap-kit_sk_unknown",
    });
  });

  it("authenticates a server read before body parsing: unparseable bind body gets 401", async () => {
    mocks.query.mockRejectedValue(new Error("boom"));
    mocks.handleConvexError.mockReturnValue({
      code: "INVALID_API_KEY",
      message: "API key is invalid or inactive",
    });
    const response = await buildApp().request("/commerce/v1/purchases/bind", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer openiap-kit_sk_unknown",
      },
      body: "this is not json",
    });
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("never echoes submitted store evidence in GraphQL request errors", async () => {
    // graphql-js coercion messages embed the submitted variable value — an
    // unknown member on VerifyPurchaseInput would echo the whole JWS back to
    // an unauthenticated caller. SPEC.md 8: no evidence in messages, ever.
    const jws = "eyJhbGciOiJFUzI1NiJ9.SECRET_EVIDENCE_PAYLOAD.c2ln";
    const response = await post(
      buildApp(),
      "/commerce/v1/graphql",
      {
        query:
          "mutation VerifyPurchase($input: VerifyPurchaseInput!) { verifyPurchase(input: $input) { isValid } }",
        operationName: "VerifyPurchase",
        variables: { input: { store: "apple", apple: { jws }, junk: 1 } },
      },
      null,
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("SECRET_EVIDENCE_PAYLOAD");
    expect(text).not.toContain(jws);
    const body = JSON.parse(text);
    expect(body.errors[0].extensions.code).toBe("INVALID_REQUEST");
  });

  it("never echoes evidence pasted as a document literal (validation path)", async () => {
    const response = await post(
      buildApp(),
      "/commerce/v1/graphql",
      {
        query:
          'mutation { verifyPurchase(input: {store: "amazon", amazon: {receiptId: "r", userId: "u", sandbox: "LITERAL_EVIDENCE.SIG"}}) { isValid } }',
      },
      null,
    );
    const text = await response.text();
    expect(text).not.toContain("LITERAL_EVIDENCE");
    expect(JSON.parse(text).errors[0].extensions.code).toBe("INVALID_REQUEST");
  });

  it("authorizes before variable coercion: structurally invalid server input gets 401, not a field-by-field verdict", async () => {
    // graphql-js coercion runs before any resolver, so the pre-execute auth in
    // executeCommerceGraphql is what keeps SPEC.md 5 ordering on GraphQL. An
    // uncredentialed caller probing which members EntitlementsInput requires
    // must learn nothing.
    const response = await post(
      buildApp(),
      "/commerce/v1/graphql",
      {
        query:
          "query Entitlements($input: EntitlementsInput!) { entitlements(input: $input) { userId } }",
        operationName: "Entitlements",
        variables: { input: {} },
      },
      null,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED");
    expect(body.errors[0].message).not.toContain("userId");
  });

  it("authorizes before variable coercion with an unknown server key too", async () => {
    mocks.query.mockRejectedValue(new Error("boom"));
    mocks.handleConvexError.mockReturnValue({
      code: "INVALID_API_KEY",
      message: "API key is invalid or inactive",
    });
    const response = await post(
      buildApp(),
      "/commerce/v1/graphql",
      {
        query:
          "query Entitlements($input: EntitlementsInput!) { entitlements(input: $input) { userId } }",
        operationName: "Entitlements",
        variables: { input: {} },
      },
      "openiap-kit_sk_unknown",
    );
    const body = await response.json();
    expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED");
    expect(mocks.query).toHaveBeenCalledWith("assertServerAccess", {
      apiKey: "openiap-kit_sk_unknown",
    });
  });

  it("authenticates a server read before input schema validation (GraphQL)", async () => {
    mocks.query.mockRejectedValue(new Error("boom"));
    mocks.handleConvexError.mockReturnValue({
      code: "INVALID_API_KEY",
      message: "API key is invalid or inactive",
    });
    const response = await post(
      buildApp(),
      "/commerce/v1/graphql",
      {
        query:
          "query SubscriptionStatus($input: SubscriptionStatusInput!) { subscriptionStatus(input: $input) { active } }",
        operationName: "SubscriptionStatus",
        variables: { input: { userId: "x".repeat(600) } },
      },
      "openiap-kit_sk_unknown",
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED");
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query).toHaveBeenCalledWith("assertServerAccess", {
      apiKey: "openiap-kit_sk_unknown",
    });
  });

  it("answers unknown commerce paths with a protocol 404", async () => {
    const response = await buildApp().request("/commerce/v1/does-not-exist");
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });
});

describe("commerce GraphQL adapter", () => {
  beforeEach(() => {
    mocks.action.mockReset();
    mocks.mutation.mockReset();
    mocks.query.mockReset();
    mocks.handleConvexError.mockReset();
    mocks.handleConvexError.mockReturnValue(null);
  });

  it("serves the generated projection", () => {
    // operations-sdl.json.sdl is pinned byte-identical to operations.graphql
    // (the normative projection per SPEC.md 7) in the spec package's
    // operations.test.mjs, so building the served schema from it is equivalent
    // to building it from the .graphql file.
    expect(printSchema(commerceGraphqlSchema)).toBe(
      printSchema(buildSchema(operationsSdl.sdl)),
    );
    expect(commerceGraphqlSchema.getSubscriptionType()).toBeUndefined();
  });

  it("answers the standard introspection query through the real endpoint", async () => {
    // Exercise the HTTP path (bounds + validate + execute), not graphqlSync —
    // the bounds check must let a single-root-field introspection through.
    const response = await post(buildApp(), "/commerce/v1/graphql", {
      query: getIntrospectionQuery(),
      operationName: "IntrospectionQuery",
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.errors).toBeUndefined();
    expect(body.data.__schema).toBeTruthy();
  });

  it("blocks alias amplification hidden in an inline fragment", async () => {
    const response = await post(buildApp(), "/commerce/v1/graphql", {
      query:
        "query Amplify { ... on Query { a: providerCapabilities { specVersion } b: providerCapabilities { specVersion } c: providerCapabilities { specVersion } } }",
      operationName: "Amplify",
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toBeUndefined();
    expect(body.errors[0].extensions.code).toBe("INVALID_REQUEST");
    expect(body.errors[0].message).toContain("one operation field");
  });

  it("blocks alias amplification hidden in a named fragment spread", async () => {
    const response = await post(buildApp(), "/commerce/v1/graphql", {
      query:
        "query Amplify { ...F } fragment F on Query { a: providerCapabilities { specVersion } b: providerCapabilities { specVersion } }",
      operationName: "Amplify",
    });
    const body = await response.json();
    expect(body.data).toBeUndefined();
    expect(body.errors[0].extensions.code).toBe("INVALID_REQUEST");
  });

  it("rejects a request with more than one operation", async () => {
    const response = await post(buildApp(), "/commerce/v1/graphql", {
      query:
        "query A { providerCapabilities { specVersion } } query B { providerCapabilities { specVersion } }",
      operationName: "A",
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.errors[0].extensions.code).toBe("INVALID_REQUEST");
  });

  it("rejects a subscription operation at the door", async () => {
    const response = await post(buildApp(), "/commerce/v1/graphql", {
      query: "subscription { anything }",
    });
    const body = await response.json();
    expect(body.errors[0].extensions.code).toBe("INVALID_REQUEST");
    expect(body.errors[0].message).toContain("no subscriptions");
  });

  it("returns a fixed safe message, never the raw provider detail (GraphQL)", async () => {
    mocks.query.mockRejectedValue(
      new Error("ConvexHttpClient exploded at /very/private/path.ts"),
    );
    // A Convex error whose message carries diagnostic detail.
    mocks.handleConvexError.mockReturnValue({
      code: "INVALID_INPUT",
      message:
        "row subscriptions:abc123 for project proj_secret failed at :512",
    });
    const response = await post(buildApp(), "/commerce/v1/graphql", {
      query:
        "query SubscriptionStatus($input: SubscriptionStatusInput!) { subscriptionStatus(input: $input) { active } }",
      operationName: "SubscriptionStatus",
      variables: { input: { userId: "user-1" } },
    });
    const body = await response.json();
    expect(body.errors[0].extensions.code).toBe("INVALID_REQUEST");
    expect(body.errors[0].message).toBe("The request is invalid");
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("subscriptions:abc123");
    expect(serialized).not.toContain("proj_secret");
    expect(serialized).not.toContain("private/path");
  });

  it("refuses a verification credential on a server operation", async () => {
    const response = await post(
      buildApp(),
      "/commerce/v1/graphql",
      {
        query:
          "mutation EraseUser($input: EraseUserInput!) { eraseUser(input: $input) { accepted } }",
        operationName: "EraseUser",
        variables: { input: { userId: "user-1" } },
      },
      CLIENT_KEY,
    );
    const body = await response.json();
    expect(body.errors[0].extensions.code).toBe("FORBIDDEN");
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  // The two bindings must return the same protocol code for the same input
  // (SPEC.md 8). GraphQL scalar coercion does not check the generated schema's
  // patterns and bounds, so the binding runs the same Ajv validation REST does.
  it("rejects a value-space violation with INVALID_REQUEST, matching REST", async () => {
    const badStore = {
      query:
        "mutation VerifyPurchase($input: VerifyPurchaseInput!) { verifyPurchase(input: $input) { isValid } }",
      operationName: "VerifyPurchase",
      variables: { input: { store: "APPLE", apple: { jws: "x".repeat(200) } } },
    };
    const gql = await post(
      buildApp(),
      "/commerce/v1/graphql",
      badStore,
      CLIENT_KEY,
    );
    const gqlBody = await gql.json();
    expect(gqlBody.errors[0].extensions.code).toBe("INVALID_REQUEST");

    const rest = await post(
      buildApp(),
      "/commerce/v1/purchases/verify",
      { store: "APPLE", apple: { jws: "x".repeat(200) } },
      CLIENT_KEY,
    );
    expect(rest.status).toBe(400);
    expect((await rest.json()).error.code).toBe("INVALID_REQUEST");
    expect(mocks.action).not.toHaveBeenCalled();
  });

  it("rejects an empty JWS with INVALID_REQUEST rather than forwarding it", async () => {
    const response = await post(
      buildApp(),
      "/commerce/v1/graphql",
      {
        query:
          "mutation VerifyPurchase($input: VerifyPurchaseInput!) { verifyPurchase(input: $input) { isValid } }",
        operationName: "VerifyPurchase",
        variables: { input: { store: "apple", apple: { jws: "" } } },
      },
      CLIENT_KEY,
    );
    expect((await response.json()).errors[0].extensions.code).toBe(
      "INVALID_REQUEST",
    );
    expect(mocks.action).not.toHaveBeenCalled();
  });

  it("caps a single request to one root field, blocking alias amplification", async () => {
    const aliases = Array.from(
      { length: 5 },
      (_unused, index) =>
        `a${index}: entitlements(input: {userId: "user-1"}) { userId }`,
    ).join(" ");
    const response = await post(buildApp(), "/commerce/v1/graphql", {
      query: `query Amplify { ${aliases} }`,
      operationName: "Amplify",
    });
    const body = await response.json();
    expect(body.errors[0].extensions.code).toBe("INVALID_REQUEST");
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("answers every GraphQL failure with HTTP 200 (single status policy)", async () => {
    // SPEC.md 7: the GraphQL binding's operation and request-level failures are
    // HTTP 200 with the code in extensions — an oversized body included, so the
    // endpoint never splits its own status contract (429 vs 200).
    const oversized = await post(buildApp(), "/commerce/v1/graphql", {
      query: `query { providerCapabilities { specVersion } } # ${"x".repeat(40_000)}`,
    });
    expect(oversized.status).toBe(200);
    const body = await oversized.json();
    expect(body.errors[0].extensions.code).toBe("INVALID_REQUEST");
  });

  it("rejects an exponential fragment DAG in bounded time (no CPU blowup)", async () => {
    // f0 spreads f1 twice, f1 spreads f2 twice … — naive full expansion is
    // 2^N. A ~1.3 KB request must be rejected in milliseconds, not seconds.
    const depth = 24;
    let query = "query Dos { providerCapabilities { specVersion ...f0 } }\n";
    for (let i = 0; i < depth; i += 1) {
      const next = i + 1 < depth ? `...f${i + 1} ...f${i + 1}` : "specVersion";
      query += `fragment f${i} on ProviderCapabilities { ${next} }\n`;
    }
    const start = performance.now();
    const response = await post(buildApp(), "/commerce/v1/graphql", {
      query,
      operationName: "Dos",
    });
    const elapsedMs = performance.now() - start;
    const body = await response.json();
    expect(body.data).toBeUndefined();
    expect(body.errors[0].extensions.code).toBe("INVALID_REQUEST");
    expect(elapsedMs).toBeLessThan(250);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});

// The verify admission (replay burst + in-flight cap + stable-failure cooldown)
// must apply on BOTH bindings, since verifyPurchase reaches the same
// store-hitting Convex actions as /v1. These use the process-global replay
// store, so each test uses a distinct payload to stay isolated.
describe("commerce verify admission on both bindings", () => {
  let tokenSeq = 0;
  const uniqueToken = () =>
    `admission-google-token-${(tokenSeq += 1)}-${"z".repeat(30)}`;

  beforeEach(() => {
    mocks.action.mockReset();
    mocks.mutation.mockReset();
    mocks.query.mockReset();
    mocks.handleConvexError.mockReset();
    mocks.handleConvexError.mockReturnValue(null);
    mocks.action.mockResolvedValue({
      isValid: true,
      state: "ENTITLED",
      productId: "premium.monthly",
      environment: "Production",
    });
  });

  const restVerify = (app: Hono, token: string) =>
    post(
      app,
      "/commerce/v1/purchases/verify",
      { store: "google", google: { purchaseToken: token } },
      CLIENT_KEY,
    );
  const gqlVerify = (app: Hono, token: string) =>
    post(
      app,
      "/commerce/v1/graphql",
      {
        query:
          "mutation VerifyPurchase($input: VerifyPurchaseInput!) { verifyPurchase(input: $input) { isValid } }",
        operationName: "VerifyPurchase",
        variables: {
          input: { store: "google", google: { purchaseToken: token } },
        },
      },
      CLIENT_KEY,
    );

  it("applies the per-payload replay burst cap to the GraphQL binding", async () => {
    const app = buildApp();
    const token = uniqueToken();
    // Replay guard capacity is 30 per (key, payload). Attempt 31 must be denied.
    let lastBody: { errors?: Array<{ extensions: { code: string } }> } = {};
    for (let attempt = 0; attempt < 31; attempt += 1) {
      lastBody = await (await gqlVerify(app, token)).json();
    }
    expect(lastBody.errors?.[0].extensions.code).toBe("RATE_LIMITED");
  });

  it("shares one replay bucket across REST and GraphQL for the same receipt", async () => {
    const app = buildApp();
    const token = uniqueToken();
    // Spend 30 tokens over REST, then the first GraphQL attempt is denied —
    // proving both bindings key the same bucket.
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const res = await restVerify(app, token);
      expect(res.status).toBe(200);
    }
    const gql = await (await gqlVerify(app, token)).json();
    expect(gql.errors?.[0].extensions.code).toBe("RATE_LIMITED");
  });

  it("arms the stable-failure cooldown on both bindings", async () => {
    const app = buildApp();
    const token = uniqueToken();
    // A store verdict that is a stable rejection (INAUTHENTIC) must arm the
    // negative cooldown so the next same-payload verify is short-circuited —
    // this was never recorded on the commerce surface before.
    mocks.action.mockResolvedValue({
      isValid: false,
      state: "INAUTHENTIC",
      stableRejection: true,
    });
    const first = await restVerify(app, token);
    expect(first.status).toBe(200);
    expect((await first.json()).isValid).toBe(false);

    // The next attempt for the same payload — on the OTHER binding — is denied
    // by the cooldown before reaching the store again, carrying the retry hint
    // in the GraphQL error extensions (SPEC.md 7: operation failure is 200).
    mocks.action.mockClear();
    const secondResponse = await gqlVerify(app, token);
    expect(secondResponse.status).toBe(200);
    const second = await secondResponse.json();
    expect(second.errors?.[0].extensions.code).toBe("RATE_LIMITED");
    expect(second.errors?.[0].extensions.retryAfterSec).toBeGreaterThan(0);
    expect(mocks.action).not.toHaveBeenCalled();
  });

  it("returns the retry hint as a REST Retry-After header on cooldown", async () => {
    const app = buildApp();
    const token = uniqueToken();
    mocks.action.mockResolvedValue({
      isValid: false,
      state: "INAUTHENTIC",
      stableRejection: true,
    });
    await restVerify(app, token);
    mocks.action.mockClear();
    const second = await restVerify(app, token);
    expect(second.status).toBe(429);
    expect(Number(second.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await second.json()).error.code).toBe("RATE_LIMITED");
    expect(mocks.action).not.toHaveBeenCalled();
  });

  it("never arms the cooldown for a valid verdict, even in a stable-looking state", async () => {
    const app = buildApp();
    const token = uniqueToken();
    // isValid: true must never arm the cooldown, regardless of the state token.
    mocks.action.mockResolvedValue({
      isValid: true,
      state: "EXPIRED",
      stableRejection: true,
    });
    const first = await restVerify(app, token);
    expect((await first.json()).isValid).toBe(true);
    mocks.action.mockClear();
    mocks.action.mockResolvedValue({ isValid: true, state: "EXPIRED" });
    const second = await restVerify(app, token);
    expect(second.status).toBe(200); // not RATE_LIMITED
    expect(mocks.action).toHaveBeenCalled();
  });

  it("does not cool down Horizon, whose ownership can flip immediately", async () => {
    const app = buildApp();
    const userId = `hz-${(tokenSeq += 1)}`;
    const horizonVerify = () =>
      post(
        app,
        "/commerce/v1/purchases/verify",
        { store: "horizon", horizon: { userId, sku: "premium.addon" } },
        CLIENT_KEY,
      );
    // A stable INAUTHENTIC on Horizon must stay retryable.
    mocks.action.mockResolvedValue({
      isValid: false,
      state: "INAUTHENTIC",
      stableRejection: true,
    });
    await horizonVerify();
    mocks.action.mockClear();
    mocks.action.mockResolvedValue({ isValid: true, state: "ENTITLED" });
    const second = await horizonVerify();
    expect(second.status).toBe(200);
    expect((await second.json()).isValid).toBe(true);
    expect(mocks.action).toHaveBeenCalled();
  });

  it("keys the Amazon replay bucket on sandbox so a sandbox failure spares production", async () => {
    const app = buildApp();
    const userId = `az-${(tokenSeq += 1)}`;
    const receiptId = `receipt-${(tokenSeq += 1)}-${"9".repeat(10)}`;
    const amazonVerify = (sandbox: boolean) =>
      post(
        app,
        "/commerce/v1/purchases/verify",
        { store: "amazon", amazon: { userId, receiptId, sandbox } },
        CLIENT_KEY,
      );
    // A stable failure in sandbox arms its own bucket…
    mocks.action.mockResolvedValue({
      isValid: false,
      state: "INAUTHENTIC",
      stableRejection: true,
    });
    await amazonVerify(true);
    // …and must NOT block the production request for the same receipt id.
    mocks.action.mockClear();
    mocks.action.mockResolvedValue({ isValid: true, state: "ENTITLED" });
    const prod = await amazonVerify(false);
    expect(prod.status).toBe(200);
    expect((await prod.json()).isValid).toBe(true);
    expect(mocks.action).toHaveBeenCalled();
  });
});
