import { Buffer } from "node:buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  mutation: vi.fn(),
}));

vi.mock("@/convex", () => ({
  api: {
    subscriptions: {
      query: {
        subscriptionStatus: "subscriptionStatus",
        entitlements: "entitlements",
        listSubscriptions: "listSubscriptions",
        metricsSummary: "metricsSummary",
        getRevenueMetrics: "getRevenueMetrics",
      },
      mutation: {
        bindUser: "bindUser",
      },
    },
  },
}));

vi.mock("../../convex", () => ({
  client: {
    query: mocks.query,
    mutation: mocks.mutation,
  },
  handleConvexError: () => null,
}));

const { subscriptionsRoutes } = await import("./subscriptions");

function buildApp() {
  const app = new Hono();
  app.route("/subscriptions", subscriptionsRoutes);
  return app;
}

function compactJws(payload: Record<string, unknown>): string {
  return compactJwsFromRawPayload(JSON.stringify(payload));
}

function compactJwsFromRawPayload(payload: string): string {
  return [
    Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(payload).toString("base64url"),
    Buffer.from("signature").toString("base64url"),
  ].join(".");
}

describe("subscriptionsRoutes", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.mutation.mockReset();
  });

  it("rejects oversized path apiKey before calling Convex", async () => {
    const app = buildApp();
    const response = await app.request(
      `/subscriptions/status/${"a".repeat(129)}?userId=user-1`,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      errors: [{ code: "INVALID_API_KEY", message: "API key is too long" }],
    });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects blank path apiKey before calling Convex", async () => {
    const app = buildApp();
    const response = await app.request(
      "/subscriptions/status/%20%20?userId=user-1",
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      errors: [{ code: "INVALID_API_KEY", message: "API key is required" }],
    });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects oversized userId inputs before calling Convex", async () => {
    const app = buildApp();
    const userId = "u".repeat(257);

    const cases = [
      app.request(`/subscriptions/status/key?userId=${userId}`),
      app.request(`/subscriptions/entitlements/key?userId=${userId}`),
      app.request(`/subscriptions/list/key?userId=${userId}`),
      app.request("/subscriptions/bind-user/key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purchaseToken: "token", userId }),
      }),
    ];

    for (const responsePromise of cases) {
      const response = await responsePromise;
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        errors: [
          { code: "INVALID_INPUT", message: "userId must be ≤ 256 chars" },
        ],
      });
    }

    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects blank query userId inputs before calling Convex", async () => {
    const app = buildApp();

    const cases = [
      app.request("/subscriptions/status/key?userId=%20%20"),
      app.request("/subscriptions/entitlements/key?userId=%20%20"),
    ];

    for (const responsePromise of cases) {
      const response = await responsePromise;
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        errors: [{ code: "INVALID_INPUT", message: "userId is required" }],
      });
    }

    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects invalid list filters before calling Convex", async () => {
    const app = buildApp();

    const cases = [
      [
        "/subscriptions/list/key?state=Deleted",
        { code: "INVALID_INPUT", message: "state is invalid" },
      ],
      [
        "/subscriptions/list/key?userId=",
        { code: "INVALID_INPUT", message: "userId must not be empty" },
      ],
      [
        "/subscriptions/list/key?userId=%20%20",
        { code: "INVALID_INPUT", message: "userId must not be empty" },
      ],
      [
        "/subscriptions/list/key?productId=",
        { code: "INVALID_INPUT", message: "productId must not be empty" },
      ],
      [
        "/subscriptions/list/key?productId=%20%20",
        { code: "INVALID_INPUT", message: "productId must not be empty" },
      ],
      [
        `/subscriptions/list/key?productId=${"p".repeat(257)}`,
        { code: "INVALID_INPUT", message: "productId must be ≤ 256 chars" },
      ],
      [
        "/subscriptions/list/key?limit=abc",
        {
          code: "INVALID_INPUT",
          message: "limit must be a positive integer",
        },
      ],
      [
        "/subscriptions/list/key?limit=",
        {
          code: "INVALID_INPUT",
          message: "limit must be a positive integer",
        },
      ],
      [
        "/subscriptions/list/key?limit=0",
        {
          code: "INVALID_INPUT",
          message: "limit must be a positive integer",
        },
      ],
      [
        "/subscriptions/list/key?limit=1.5",
        {
          code: "INVALID_INPUT",
          message: "limit must be a positive integer",
        },
      ],
      [
        "/subscriptions/list/key?limit=1e2",
        {
          code: "INVALID_INPUT",
          message: "limit must be a positive integer",
        },
      ],
    ] as const;

    for (const [url, error] of cases) {
      const response = await app.request(url);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ errors: [error] });
    }

    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("forwards revenue metrics ranges to Convex", async () => {
    const app = buildApp();
    mocks.query.mockResolvedValueOnce({
      days: [],
      currencies: [],
      productIds: [],
      platforms: [],
      truncated: false,
    });

    const response = await app.request(
      "/subscriptions/revenue/key?fromDay=2026-06-01&toDay=2026-06-04",
    );

    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith("getRevenueMetrics", {
      apiKey: "key",
      fromDay: "2026-06-01",
      toDay: "2026-06-04",
    });
  });

  it("rejects invalid revenue ranges before calling Convex", async () => {
    const app = buildApp();

    const cases = [
      {
        path: "/subscriptions/revenue/key?fromDay=bad&toDay=2026-06-04",
        message: "fromDay and toDay must be YYYY-MM-DD",
      },
      {
        path: "/subscriptions/revenue/key?fromDay=2026-02-31&toDay=2026-06-04",
        message: "fromDay and toDay must be valid calendar days",
      },
      {
        path: "/subscriptions/revenue/key?fromDay=2026-06-05&toDay=2026-06-04",
        message: "fromDay must be on or before toDay",
      },
      {
        path: "/subscriptions/revenue/key?fromDay=2026-01-01&toDay=2026-06-04",
        message: "revenue range must be 92 days or less",
      },
    ];

    for (const { path, message } of cases) {
      const response = await app.request(path);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        errors: [{ code: "INVALID_INPUT", message }],
      });
    }

    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("rejects oversized non-Apple bind-user purchaseToken before calling Convex", async () => {
    const app = buildApp();
    const response = await app.request("/subscriptions/bind-user/key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purchaseToken: "t".repeat(2_001),
        userId: "user-1",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "INVALID_INPUT",
          message:
            "purchaseToken must be ≤ 2000 chars, or an Apple JWS ≤ 16000 chars",
        },
      ],
    });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("normalizes Apple JWS bind-user purchaseToken to originalTransactionId", async () => {
    const app = buildApp();
    mocks.mutation.mockResolvedValueOnce({ ok: true, bound: true });
    const jws = compactJws({
      transactionId: "2000000000000001",
      originalTransactionId: "1000000000000001",
      bundleId: "dev.hyo.openiap.test",
      padding: "x".repeat(2_400),
    });

    expect(jws.length).toBeGreaterThan(2_000);

    const response = await app.request("/subscriptions/bind-user/key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purchaseToken: jws,
        userId: "user-1",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, bound: true });
    expect(mocks.mutation).toHaveBeenCalledWith("bindUser", {
      apiKey: "key",
      purchaseToken: "1000000000000001",
      userId: "user-1",
    });
  });

  it("normalizes numeric Apple JWS transaction ids to strings", async () => {
    const app = buildApp();
    mocks.mutation.mockResolvedValueOnce({ ok: true, bound: true });
    const jws = compactJws({
      transactionId: 2000000000000001,
      bundleId: "dev.hyo.openiap.test",
    });

    const response = await app.request("/subscriptions/bind-user/key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purchaseToken: jws,
        userId: "user-1",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, bound: true });
    expect(mocks.mutation).toHaveBeenCalledWith("bindUser", {
      apiKey: "key",
      purchaseToken: "2000000000000001",
      userId: "user-1",
    });
  });

  it("preserves unsafe 64-bit numeric Apple JWS transaction ids", async () => {
    const app = buildApp();
    mocks.mutation.mockResolvedValueOnce({ ok: true, bound: true });
    const transactionId = "9223372036854775807";
    const jws = compactJwsFromRawPayload(
      `{"transactionId":${transactionId},"bundleId":"dev.hyo.openiap.test"}`,
    );

    const response = await app.request("/subscriptions/bind-user/key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purchaseToken: jws,
        userId: "user-1",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, bound: true });
    expect(mocks.mutation).toHaveBeenCalledWith("bindUser", {
      apiKey: "key",
      purchaseToken: transactionId,
      userId: "user-1",
    });
  });

  it("rejects short Apple JWS-shaped bind-user purchaseToken without transaction ids", async () => {
    const app = buildApp();
    const jws = compactJws({
      bundleId: "dev.hyo.openiap.test",
    });

    expect(jws.length).toBeLessThanOrEqual(2_000);

    const response = await app.request("/subscriptions/bind-user/key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purchaseToken: jws,
        userId: "user-1",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "INVALID_INPUT",
          message:
            "purchaseToken must be a valid Apple JWS containing originalTransactionId or transactionId",
        },
      ],
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("accepts short dotted Google tokens that are not parseable Apple JWS", async () => {
    const app = buildApp();
    mocks.mutation.mockResolvedValueOnce({ ok: true, bound: true });
    const purchaseToken = "google.token.value";

    const response = await app.request("/subscriptions/bind-user/key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purchaseToken,
        userId: "user-1",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, bound: true });
    expect(mocks.mutation).toHaveBeenCalledWith("bindUser", {
      apiKey: "key",
      purchaseToken,
      userId: "user-1",
    });
  });

  it("rejects long Apple JWS-shaped bind-user purchaseToken without transaction ids", async () => {
    const app = buildApp();
    const jws = compactJws({
      bundleId: "dev.hyo.openiap.test",
      padding: "x".repeat(2_400),
    });

    expect(jws.length).toBeGreaterThan(2_000);

    const response = await app.request("/subscriptions/bind-user/key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purchaseToken: jws,
        userId: "user-1",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "INVALID_INPUT",
          message:
            "purchaseToken must be a valid Apple JWS containing originalTransactionId or transactionId",
        },
      ],
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects oversized bind-user bodies before calling Convex", async () => {
    const app = buildApp();
    const response = await app.request("/subscriptions/bind-user/key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purchaseToken: "token",
        userId: "user-1",
        padding: "x".repeat(32 * 1024),
      }),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "PAYLOAD_TOO_LARGE",
          message: "Subscription payload is too large",
        },
      ],
    });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects oversized bind-user content-length before reading the body", async () => {
    const app = buildApp();
    const response = await app.request("/subscriptions/bind-user/key", {
      method: "POST",
      headers: { "content-length": String(32 * 1024 + 1) },
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "PAYLOAD_TOO_LARGE",
          message: "Subscription payload is too large",
        },
      ],
    });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects non-object bind-user bodies before calling Convex", async () => {
    const app = buildApp();
    const response = await app.request("/subscriptions/bind-user/key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "null",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "INVALID_INPUT",
          message: "purchaseToken and userId are required",
        },
      ],
    });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects blank bind-user strings before calling Convex", async () => {
    const app = buildApp();
    const response = await app.request("/subscriptions/bind-user/key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ purchaseToken: "   ", userId: "user-1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "INVALID_INPUT",
          message: "purchaseToken and userId are required",
        },
      ],
    });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("does not return raw internal subscription query errors", async () => {
    const app = buildApp();
    mocks.query.mockRejectedValueOnce(new Error("internal query detail"));

    const response = await app.request(
      "/subscriptions/status/key?userId=user-1",
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "SUBSCRIPTION_STATUS_FAILED",
          message: "Subscription status lookup failed",
        },
      ],
    });
    expect(mocks.query).toHaveBeenCalledOnce();
  });

  it("does not return raw internal bind-user mutation errors", async () => {
    const app = buildApp();
    mocks.mutation.mockRejectedValueOnce(new Error("internal mutation detail"));

    const response = await app.request("/subscriptions/bind-user/key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purchaseToken: "token",
        userId: "user-1",
      }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "SUBSCRIPTION_BIND_USER_FAILED",
          message: "Subscription user binding failed",
        },
      ],
    });
    expect(mocks.mutation).toHaveBeenCalledOnce();
  });
});
