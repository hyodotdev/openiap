import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const mocks = vi.hoisted(() => ({
  handleConvexError: vi.fn(),
  query: vi.fn(),
  mutation: vi.fn(),
}));

vi.mock("@/convex", () => ({
  api: {
    subscriptions: {
      query: {
        subscriptionEvaluationSnapshot: "subscriptionEvaluationSnapshot",
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
  handleConvexError: mocks.handleConvexError,
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

function subscriptionRow(
  overrides: Partial<{
    id: string;
    productId: string;
    platform: "IOS" | "Android";
    state:
      | "Active"
      | "InGracePeriod"
      | "InBillingRetry"
      | "Expired"
      | "Revoked"
      | "Refunded"
      | "Paused"
      | "Unknown";
    expiresAt: number;
    startedAt: number;
    updatedAt: number;
    createdAt: number;
    purchaseToken: string;
    userId: string;
  }> = {},
) {
  return {
    id: "subscription-1",
    productId: "premium",
    platform: "IOS" as const,
    state: "Active" as const,
    startedAt: 1,
    updatedAt: 2,
    createdAt: 1,
    purchaseToken: "transaction-1",
    userId: "user-1",
    ...overrides,
  };
}

function evaluationSnapshot(
  candidates: Array<ReturnType<typeof subscriptionRow>> = [],
  fallback: ReturnType<typeof subscriptionRow> | null = candidates[0] ?? null,
) {
  return { projectId: "project-1", candidates, fallback };
}

describe("subscriptionsRoutes", () => {
  beforeEach(() => {
    mocks.handleConvexError.mockReset();
    mocks.handleConvexError.mockReturnValue(null);
    mocks.query.mockReset();
    mocks.mutation.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("supports Bearer-authenticated routes without keys in URLs", async () => {
    const app = buildApp();
    const headers = {
      authorization: "Bearer openiap-kit_sk_admin",
      "content-type": "application/json",
    };
    mocks.query.mockResolvedValue(evaluationSnapshot());
    mocks.mutation.mockResolvedValue({ ok: true });

    const responses = [
      await app.request("/subscriptions/status?userId=user-1", { headers }),
      await app.request("/subscriptions/entitlements?userId=user-1", {
        headers,
      }),
      await app.request("/subscriptions/list?limit=10", { headers }),
      await app.request("/subscriptions/metrics", { headers }),
      await app.request(
        "/subscriptions/revenue?fromDay=2026-06-01&toDay=2026-06-04",
        { headers },
      ),
      await app.request("/subscriptions/bind-user", {
        method: "POST",
        headers,
        body: JSON.stringify({
          purchaseToken: "token",
          userId: "user-1",
        }),
      }),
    ];

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200, 200, 200, 200,
    ]);
    for (const [, args] of mocks.query.mock.calls) {
      expect(args).toMatchObject({ apiKey: "openiap-kit_sk_admin" });
    }
    expect(mocks.mutation).toHaveBeenCalledWith("bindUser", {
      apiKey: "openiap-kit_sk_admin",
      purchaseToken: "token",
      userId: "user-1",
    });
  });

  it("labels v1 status and entitlement usage without logging credentials or user IDs", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = buildApp();
    const headers = {
      authorization: "Bearer openiap-kit_pk_header",
    };
    mocks.query.mockResolvedValue(evaluationSnapshot());

    const responses = [
      await app.request("/subscriptions/status?userId=private-user", {
        headers,
      }),
      await app.request(
        "/subscriptions/status/openiap-kit_pk_path?userId=private-user",
      ),
      await app.request("/subscriptions/entitlements?userId=private-user", {
        headers,
      }),
      await app.request(
        "/subscriptions/entitlements/openiap-kit_pk_path?userId=private-user",
      ),
    ];

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200, 200,
    ]);
    const usageLogs = logSpy.mock.calls
      .map(([line]) => {
        if (typeof line !== "string") return null;
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((line) => line?.kind === "legacy_subscription_request");

    expect(
      usageLogs.map((line) => ({
        operation: line?.operation,
        credentialTransport: line?.credentialTransport,
        statusCode: line?.statusCode,
      })),
    ).toEqual([
      {
        operation: "status",
        credentialTransport: "authorization",
        statusCode: 200,
      },
      {
        operation: "status",
        credentialTransport: "path",
        statusCode: 200,
      },
      {
        operation: "entitlements",
        credentialTransport: "authorization",
        statusCode: 200,
      },
      {
        operation: "entitlements",
        credentialTransport: "path",
        statusCode: 200,
      },
    ]);
    expect(usageLogs).toHaveLength(4);
    for (const line of usageLogs) {
      expect(line?.apiVersion).toBe("v1");
      expect(line?.projectIdHash).toMatch(/^[0-9a-f]{16}$/);
      expect(line).not.toHaveProperty("path");
    }
    const serialized = JSON.stringify(usageLogs);
    expect(serialized).not.toContain("private-user");
    expect(serialized).not.toContain("openiap-kit_pk_header");
    expect(serialized).not.toContain("openiap-kit_pk_path");
  });

  it("returns 403 before publishable keys can read administrative subscription data", async () => {
    const app = buildApp();
    const headers = {
      authorization: "Bearer openiap-kit_pk_mobile",
    };
    const responses = [
      await app.request("/subscriptions/list?limit=10", { headers }),
      await app.request("/subscriptions/list/openiap-kit_pk_mobile?limit=10"),
      await app.request("/subscriptions/metrics", { headers }),
      await app.request(
        "/subscriptions/revenue?fromDay=2026-06-01&toDay=2026-06-04",
        { headers },
      ),
    ];

    for (const response of responses) {
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        errors: [
          {
            code: "INSUFFICIENT_SCOPE",
            message:
              "This operation requires a secret admin key. Publishable mobile keys cannot access administrative operations.",
          },
        ],
      });
    }
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("keeps publishable entitlement helpers and user binding available", async () => {
    const app = buildApp();
    const headers = {
      authorization: "Bearer openiap-kit_pk_mobile",
      "content-type": "application/json",
    };
    mocks.query
      .mockResolvedValueOnce(evaluationSnapshot())
      .mockResolvedValueOnce(evaluationSnapshot());
    mocks.mutation.mockResolvedValueOnce({ ok: true, bound: true });

    const responses = [
      await app.request("/subscriptions/status?userId=user-1", { headers }),
      await app.request("/subscriptions/entitlements?userId=user-1", {
        headers,
      }),
      await app.request("/subscriptions/bind-user", {
        method: "POST",
        headers,
        body: JSON.stringify({
          purchaseToken: "purchase-token",
          userId: "user-1",
        }),
      }),
    ];

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200,
    ]);
    for (const response of responses) {
      expect(response.headers.get("x-ratelimit-limit")).toBe("600");
      expect(response.headers.get("x-ratelimit-remaining")).not.toBeNull();
    }
    expect(mocks.query).toHaveBeenNthCalledWith(
      1,
      "subscriptionEvaluationSnapshot",
      {
        apiKey: "openiap-kit_pk_mobile",
        userId: "user-1",
      },
    );
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      "subscriptionEvaluationSnapshot",
      {
        apiKey: "openiap-kit_pk_mobile",
        userId: "user-1",
      },
    );
    expect(mocks.mutation).toHaveBeenCalledWith("bindUser", {
      apiKey: "openiap-kit_pk_mobile",
      purchaseToken: "purchase-token",
      userId: "user-1",
    });
  });

  it("conditionally revalidates user-scoped snapshots without mutations", async () => {
    const app = buildApp();
    const headers = {
      authorization: "Bearer openiap-kit_pk_mobile",
    };
    const snapshot = evaluationSnapshot([subscriptionRow()]);
    mocks.query.mockResolvedValueOnce(snapshot);

    const initialStatus = await app.request(
      "/subscriptions/status?userId=user-1",
      { headers },
    );
    const statusEtag = initialStatus.headers.get("etag");

    expect(initialStatus.status).toBe(200);
    expect(statusEtag).toMatch(/^W\/"iapkit-subscription-status-[^"]+"$/);
    expect(statusEtag).not.toContain("openiap-kit_pk_mobile");
    expect(initialStatus.headers.get("cache-control")).toBe(
      "private, no-cache",
    );
    expect(initialStatus.headers.get("vary")).toBe("Authorization");

    mocks.query.mockResolvedValueOnce(snapshot);
    const unchangedStatus = await app.request(
      "/subscriptions/status?userId=user-1",
      {
        headers: {
          ...headers,
          "if-none-match": `"other", ${statusEtag?.replace(/^W\//, "")}`,
        },
      },
    );

    expect(unchangedStatus.status).toBe(304);
    expect(unchangedStatus.headers.get("etag")).toBe(statusEtag);
    expect(await unchangedStatus.text()).toBe("");

    mocks.query.mockResolvedValueOnce(snapshot);
    const initialEntitlements = await app.request(
      "/subscriptions/entitlements?userId=user-1",
      { headers },
    );
    const entitlementsEtag = initialEntitlements.headers.get("etag");

    expect(initialEntitlements.status).toBe(200);
    expect(entitlementsEtag).toMatch(
      /^W\/"iapkit-subscription-entitlements-[^"]+"$/,
    );
    expect(entitlementsEtag).not.toBe(statusEtag);

    mocks.query.mockResolvedValueOnce(snapshot);
    const unchangedEntitlements = await app.request(
      "/subscriptions/entitlements?userId=user-1",
      {
        headers: {
          ...headers,
          "if-none-match": entitlementsEtag!,
        },
      },
    );

    expect(unchangedEntitlements.status).toBe(304);
    expect(mocks.query).toHaveBeenCalledTimes(4);
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("derives status and entitlements from the sorted row snapshot at the Fly boundary", async () => {
    const app = buildApp();
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    const expiredNewest = subscriptionRow({
      id: "expired-newest",
      state: "Expired",
      updatedAt: 4,
    });
    const snapshot = evaluationSnapshot(
      [
        subscriptionRow({
          id: "grace-current",
          productId: "premium",
          state: "InGracePeriod",
          expiresAt: 2_000,
          updatedAt: 3,
        }),
        subscriptionRow({
          id: "active-duplicate-product",
          productId: "premium",
          state: "Active",
          updatedAt: 2,
        }),
        subscriptionRow({
          id: "expired-by-time",
          productId: "legacy",
          state: "Active",
          expiresAt: 999,
          updatedAt: 1,
        }),
      ],
      expiredNewest,
    );
    mocks.query.mockResolvedValue(snapshot);
    const headers = {
      authorization: "Bearer openiap-kit_pk_mobile",
    };

    const status = await app.request("/subscriptions/status?userId=user-1", {
      headers,
    });
    const entitlements = await app.request(
      "/subscriptions/entitlements?userId=user-1",
      { headers },
    );

    await expect(status.json()).resolves.toMatchObject({
      active: true,
      subscription: { id: "grace-current" },
    });
    await expect(entitlements.json()).resolves.toMatchObject({
      userId: "user-1",
      productIds: ["premium"],
      subscriptions: [
        { id: "grace-current" },
        { id: "active-duplicate-product" },
      ],
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("uses creation time to break equal-updatedAt status ties", async () => {
    const app = buildApp();
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    mocks.query.mockResolvedValue(
      evaluationSnapshot([
        subscriptionRow({
          id: "older-created",
          updatedAt: 5,
          createdAt: 10,
        }),
        subscriptionRow({
          id: "newer-created",
          updatedAt: 5,
          createdAt: 20,
        }),
      ]),
    );

    const response = await app.request("/subscriptions/status?userId=user-1", {
      headers: {
        authorization: "Bearer openiap-kit_pk_mobile",
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      active: true,
      subscription: { id: "newer-created" },
    });
    expect(body.subscription).not.toHaveProperty("createdAt");
  });

  it("does not accept a snapshot ETag for a different representation or route", async () => {
    const app = buildApp();
    const snapshot = evaluationSnapshot();
    mocks.query.mockResolvedValue(snapshot);

    const first = await app.request("/subscriptions/status?userId=user-1", {
      headers: {
        authorization: "Bearer openiap-kit_pk_first",
      },
    });
    const etag = first.headers.get("etag");
    expect(first.status).toBe(200);
    expect(etag).not.toBeNull();

    mocks.query.mockResolvedValueOnce(
      evaluationSnapshot([subscriptionRow({ id: "different", updatedAt: 99 })]),
    );
    const differentResult = await app.request(
      "/subscriptions/status?userId=user-1",
      {
        headers: {
          authorization: "Bearer openiap-kit_pk_second",
          "if-none-match": etag!,
        },
      },
    );
    const sameRepresentation = await app.request(
      "/subscriptions/status?userId=user-2",
      {
        headers: {
          authorization: "Bearer openiap-kit_pk_first",
          "if-none-match": etag!,
        },
      },
    );
    const otherRoute = await app.request(
      "/subscriptions/entitlements?userId=user-1",
      {
        headers: {
          authorization: "Bearer openiap-kit_pk_first",
          "if-none-match": etag!,
        },
      },
    );

    expect([
      differentResult.status,
      sameRepresentation.status,
      otherRoute.status,
    ]).toEqual([200, 304, 200]);
    expect(differentResult.headers.get("etag")).not.toBe(etag);
    expect(sameRepresentation.headers.get("etag")).toBe(etag);
    expect(otherRoute.headers.get("etag")).not.toBe(etag);
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("uses the response representation rather than credentials as ETag input", async () => {
    const app = buildApp();
    mocks.query.mockResolvedValue(evaluationSnapshot());

    const first = await app.request("/subscriptions/status?userId=user-1", {
      headers: {
        authorization: "Bearer openiap-kit_pk_first",
      },
    });
    const second = await app.request("/subscriptions/status?userId=user-1", {
      headers: {
        authorization: "Bearer openiap-kit_pk_second",
      },
    });

    expect(second.headers.get("etag")).toBe(first.headers.get("etag"));
  });

  it("keeps compatibility-path ETags stable for the same row snapshot", async () => {
    const app = buildApp();
    mocks.query
      .mockResolvedValueOnce(evaluationSnapshot())
      .mockResolvedValueOnce(evaluationSnapshot());

    const initial = await app.request(
      "/subscriptions/status/openiap-kit_pk_mobile?userId=user-1",
    );
    const etag = initial.headers.get("etag");
    expect(initial.status).toBe(200);
    expect(etag).not.toBeNull();

    const unchanged = await app.request(
      "/subscriptions/status/openiap-kit_pk_mobile?userId=user-1",
      {
        headers: {
          "if-none-match": etag!,
        },
      },
    );

    expect(unchanged.status).toBe(304);
    expect(unchanged.headers.get("cache-control")).toBe("private, no-cache");
    expect(unchanged.headers.get("x-ratelimit-limit")).toBe("600");
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("does not cache or conditionally reuse secret-key snapshot responses", async () => {
    const app = buildApp();
    const snapshot = evaluationSnapshot();
    mocks.query.mockResolvedValue(snapshot);

    const response = await app.request("/subscriptions/status?userId=user-1", {
      headers: {
        authorization: "Bearer openiap-kit_sk_admin",
        "if-none-match": "*",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
    expect(response.headers.get("etag")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      active: false,
      subscription: null,
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("returns a new snapshot when webhook-backed state changes", async () => {
    const app = buildApp();
    const headers = {
      authorization: "Bearer openiap-kit_pk_mobile",
    };
    mocks.query.mockResolvedValueOnce(
      evaluationSnapshot([subscriptionRow({ state: "Active", updatedAt: 1 })]),
    );

    const initial = await app.request("/subscriptions/status?userId=user-1", {
      headers,
    });
    const initialEtag = initial.headers.get("etag");

    const expired = subscriptionRow({ state: "Expired", updatedAt: 2 });
    mocks.query.mockResolvedValueOnce(evaluationSnapshot([], expired));
    const changed = await app.request("/subscriptions/status?userId=user-1", {
      headers: {
        ...headers,
        "if-none-match": initialEtag!,
      },
    });

    expect(changed.status).toBe(200);
    expect(changed.headers.get("etag")).not.toBe(initialEtag);
    await expect(changed.json()).resolves.toMatchObject({
      active: false,
      subscription: { state: "Expired" },
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("reevaluates the identical cached row snapshot when time crosses expiry", async () => {
    const app = buildApp();
    const expiresAt = Date.UTC(2026, 6, 28, 12, 0, 30);
    const dateNow = vi.spyOn(Date, "now");
    mocks.query.mockResolvedValue(
      evaluationSnapshot([subscriptionRow({ expiresAt, updatedAt: 1 })]),
    );

    dateNow.mockReturnValue(expiresAt - 1);
    const initial = await app.request("/subscriptions/status?userId=user-1", {
      headers: {
        authorization: "Bearer openiap-kit_pk_mobile",
      },
    });
    const initialEtag = initial.headers.get("etag");
    expect(initial.status).toBe(200);
    await expect(initial.json()).resolves.toMatchObject({ active: true });

    dateNow.mockReturnValue(expiresAt + 1);
    const expired = await app.request("/subscriptions/status?userId=user-1", {
      headers: {
        authorization: "Bearer openiap-kit_pk_mobile",
        "if-none-match": initialEtag!,
      },
    });

    expect(expired.status).toBe(200);
    expect(expired.headers.get("etag")).not.toBe(initialEtag);
    await expect(expired.json()).resolves.toMatchObject({ active: false });
    expect(mocks.query).toHaveBeenNthCalledWith(
      1,
      "subscriptionEvaluationSnapshot",
      {
        apiKey: "openiap-kit_pk_mobile",
        userId: "user-1",
      },
    );
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      "subscriptionEvaluationSnapshot",
      {
        apiKey: "openiap-kit_pk_mobile",
        userId: "user-1",
      },
    );
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("requires Bearer authentication on keyless routes", async () => {
    const app = buildApp();
    const response = await app.request("/subscriptions/metrics");

    expect(response.status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("retires secret-key-in-path administrative routes", async () => {
    const app = buildApp();
    const response = await app.request(
      "/subscriptions/metrics/openiap-kit_sk_secret",
    );

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "SECRET_API_KEY_IN_URL",
          message:
            "Secret API keys are not accepted in URLs. Use Authorization: Bearer <secret-key> on the canonical route. This key has been exposed in a URL — rotate it.",
        },
      ],
    });
    expect(mocks.query).not.toHaveBeenCalled();
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

  it("fails closed when a user exceeds the bounded snapshot row limit", async () => {
    const app = buildApp();
    const overflowError = {
      code: "ENTITLEMENT_SNAPSHOT_TOO_LARGE",
      message:
        "This user has more than 200 subscription rows. Contact IAPKit support before retrying.",
    };
    mocks.query.mockRejectedValueOnce(new Error("convex structured error"));
    mocks.handleConvexError.mockReturnValueOnce(overflowError);

    const response = await app.request(
      "/subscriptions/entitlements?userId=user-1",
      {
        headers: {
          authorization: "Bearer openiap-kit_pk_mobile",
        },
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: [overflowError],
    });
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects publishable-key analytics before Convex access", async () => {
    const app = buildApp();
    const scopeError = {
      code: "INSUFFICIENT_SCOPE",
      message:
        "This operation requires a secret admin key. Publishable mobile keys cannot access administrative operations.",
    };

    const response = await app.request(
      "/subscriptions/metrics/openiap-kit_pk_public",
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ errors: [scopeError] });
    expect(mocks.query).not.toHaveBeenCalled();
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
