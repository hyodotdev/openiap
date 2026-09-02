import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const mocks = vi.hoisted(() => ({
  handleConvexError: vi.fn(),
  mutation: vi.fn(),
  query: vi.fn(),
}));

vi.mock("@/convex", () => ({
  api: {
    subscriptions: {
      query: {
        subscriptionStatusV2: "subscriptionStatusV2",
        entitlementsV2: "entitlementsV2",
        userErasureStatusV2: "userErasureStatusV2",
      },
      mutation: {
        requestUserErasure: "requestUserErasure",
      },
    },
  },
}));

vi.mock("../../convex", () => ({
  client: { mutation: mocks.mutation, query: mocks.query },
  handleConvexError: mocks.handleConvexError,
}));

const { subscriptionsRoutesV2 } = await import("./subscriptions");

function buildApp(): Hono {
  const app = new Hono();
  app.route("/subscriptions", subscriptionsRoutesV2);
  return app;
}

describe("v2 subscription routes", () => {
  beforeEach(() => {
    mocks.handleConvexError.mockReset();
    mocks.handleConvexError.mockReturnValue(null);
    mocks.mutation.mockReset();
    mocks.query.mockReset();
  });

  it("rejects publishable keys before querying account data", async () => {
    const response = await buildApp().request(
      "/subscriptions/status?userId=user-1",
      { headers: { authorization: "Bearer openiap-kit_pk_mobile" } },
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("uses the Convex v2 admin query and returns no store credential", async () => {
    mocks.query.mockResolvedValue({
      active: true,
      subscription: {
        id: "subscription-1",
        productId: "premium",
        platform: "Android",
        state: "Active",
        startedAt: 1,
        updatedAt: 2,
        userId: "user-1",
      },
    });

    const response = await buildApp().request(
      "/subscriptions/status?userId=user-1",
      { headers: { authorization: "Bearer openiap-kit_sk_backend" } },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
    expect(mocks.query).toHaveBeenCalledWith(
      "subscriptionStatusV2",
      expect.objectContaining({
        apiKey: "openiap-kit_sk_backend",
        userId: "user-1",
        now: expect.any(Number),
      }),
    );
    expect(JSON.stringify(body)).not.toContain("purchaseToken");
    expect(JSON.stringify(body)).not.toContain("originalTransactionId");
  });

  it("uses the tokenless entitlement query", async () => {
    mocks.query.mockResolvedValue({
      userId: "user-1",
      productIds: ["premium"],
      subscriptions: [],
    });

    const response = await buildApp().request(
      "/subscriptions/entitlements?userId=user-1",
      { headers: { authorization: "Bearer openiap-kit_sk_backend" } },
    );

    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith(
      "entitlementsV2",
      expect.objectContaining({
        apiKey: "openiap-kit_sk_backend",
        userId: "user-1",
        now: expect.any(Number),
      }),
    );
  });

  it("schedules and polls durable user erasure without putting userId in the URL", async () => {
    mocks.mutation.mockResolvedValue({
      ok: true,
      jobId: "subscriptionUserErasureJobs_1",
      status: "queued",
    });
    mocks.query.mockResolvedValue({
      jobId: "subscriptionUserErasureJobs_1",
      status: "completed",
      subscriptionsErased: 2,
      commerceEventsErased: 4,
      createdAt: 1,
      updatedAt: 2,
      completedAt: 2,
    });
    const app = buildApp();
    const headers = {
      authorization: "Bearer openiap-kit_sk_backend",
      "content-type": "application/json",
    };

    const scheduled = await app.request("/subscriptions/user-erasure", {
      method: "POST",
      headers,
      body: JSON.stringify({ userId: "user-private" }),
    });
    expect(scheduled.status).toBe(202);
    expect(mocks.mutation).toHaveBeenCalledWith("requestUserErasure", {
      apiKey: "openiap-kit_sk_backend",
      userId: "user-private",
    });

    const status = await app.request(
      "/subscriptions/user-erasure/subscriptionUserErasureJobs_1",
      { headers },
    );
    expect(status.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith("userErasureStatusV2", {
      apiKey: "openiap-kit_sk_backend",
      jobId: "subscriptionUserErasureJobs_1",
    });
    expect(JSON.stringify(await status.json())).not.toContain("user-private");
  });
});

describe("v2 subscription state vocabulary", () => {
  it("matches the Commerce Protocol's, so the OpenAPI copy cannot drift", async () => {
    const { SUBSCRIPTION_STATES } = await import("openiap-commerce-protocol");
    const { subscriptionV2Schema } = await import("./route-schemas");
    const stateSchema = subscriptionV2Schema.entries.state as {
      options: readonly { literal: string }[];
    };
    const documented = stateSchema.options
      .map((option) => option.literal)
      .sort();
    expect(documented).toEqual([...SUBSCRIPTION_STATES].sort());
  });
});

describe("GET /v2/subscriptions/user-erasure/:jobId input handling", () => {
  it("treats a malformed job id as not found, not a server error", async () => {
    // The Convex query normalizes the id and returns null for garbage, so the
    // route must answer with its documented 404 rather than a 500.
    mocks.query.mockReset();
    mocks.query.mockResolvedValueOnce(null);
    const response = await buildApp().request(
      "/subscriptions/user-erasure/not-a-convex-id",
      { headers: { authorization: "Bearer openiap-kit_sk_backend" } },
    );
    expect(response.status).toBe(404);
  });
});

describe("v2 subscription input and error handling", () => {
  const authorization = {
    authorization: "Bearer openiap-kit_sk_backend",
  };
  const jsonHeaders = {
    ...authorization,
    "content-type": "application/json",
  };

  beforeEach(() => {
    mocks.handleConvexError.mockReset();
    mocks.handleConvexError.mockReturnValue(null);
    mocks.mutation.mockReset();
    mocks.query.mockReset();
  });

  it("rejects invalid user and erasure inputs before Convex", async () => {
    const app = buildApp();
    const tooLong = "u".repeat(513);
    const responses = await Promise.all([
      app.request("/subscriptions/status", { headers: authorization }),
      app.request(`/subscriptions/entitlements?userId=${tooLong}`, {
        headers: authorization,
      }),
      app.request("/subscriptions/user-erasure", {
        method: "POST",
        headers: jsonHeaders,
        body: "{",
      }),
      app.request("/subscriptions/user-erasure", {
        method: "POST",
        headers: jsonHeaders,
        body: "{}",
      }),
      app.request("/subscriptions/user-erasure", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ userId: tooLong }),
      }),
      app.request("/subscriptions/user-erasure", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ userId: "u".repeat(5_000) }),
      }),
      app.request(`/subscriptions/user-erasure/${"j".repeat(257)}`, {
        headers: authorization,
      }),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([
      400, 400, 400, 400, 400, 413, 400,
    ]);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("maps structured Convex failures and hides unstructured details", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = buildApp();

    mocks.query.mockRejectedValueOnce(new Error("private status detail"));
    mocks.handleConvexError.mockReturnValueOnce({
      code: "INSUFFICIENT_SCOPE",
      message: "Secret key required",
    });
    const status = await app.request("/subscriptions/status?userId=user-1", {
      headers: authorization,
    });

    mocks.query.mockRejectedValue(new Error("private query detail"));
    const entitlements = await app.request(
      "/subscriptions/entitlements?userId=user-1",
      { headers: authorization },
    );
    const erasureStatus = await app.request(
      "/subscriptions/user-erasure/job-1",
      { headers: authorization },
    );

    mocks.mutation.mockRejectedValueOnce("private mutation detail");
    const erasure = await app.request("/subscriptions/user-erasure", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ userId: "user-1" }),
    });

    expect(status.status).toBe(403);
    expect(await status.json()).toEqual({
      errors: [{ code: "INSUFFICIENT_SCOPE", message: "Secret key required" }],
    });
    expect([entitlements.status, erasureStatus.status, erasure.status]).toEqual(
      [500, 500, 500],
    );
    for (const response of [entitlements, erasureStatus, erasure]) {
      expect(JSON.stringify(await response.json())).not.toContain("private");
    }
    expect(logSpy).toHaveBeenCalledTimes(3);
    logSpy.mockRestore();
  });
});

describe("v2 unauthenticated admission", () => {
  it("rate-limits malformed credentials before authentication", async () => {
    mocks.query.mockClear();
    const app = buildApp();
    let response: Response | undefined;
    for (let attempt = 0; attempt <= 600; attempt += 1) {
      response = await app.request("/subscriptions/status?userId=user-1", {
        headers: { authorization: "not-a-bearer-token" },
      });
      if (response.status === 429) break;
    }

    expect(response?.status).toBe(429);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
