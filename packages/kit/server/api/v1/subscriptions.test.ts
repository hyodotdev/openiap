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

  it("rejects oversized bind-user purchaseToken before calling Convex", async () => {
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
          message: "purchaseToken must be ≤ 2000 chars",
        },
      ],
    });
    expect(mocks.query).not.toHaveBeenCalled();
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
        padding: "x".repeat(8 * 1024),
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
      headers: { "content-length": String(8 * 1024 + 1) },
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
