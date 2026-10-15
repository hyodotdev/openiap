import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  handleConvexError: vi.fn(),
  mutation: vi.fn(),
  query: vi.fn(),
}));

vi.mock("hono/bun", () => ({
  getConnInfo: () => ({ remote: { address: "127.0.0.1" } }),
}));

vi.mock("@/convex", () => ({
  api: {
    commerce: {
      deliveryState: { listDeliveries: "listDeliveries", resend: "resend" },
    },
    webhooks: {
      inbound: { listInboundNotifications: "listInboundNotifications" },
    },
    subscriptions: {
      action: { resyncFromStore: "resyncFromStore" },
      query: { userTimeline: "userTimeline" },
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

const { operationsRoutes } = await import("./operations");

const SECRET = "openiap-kit_sk_operations";
const app = new Hono();
app.route("/", operationsRoutes);

function call(path: string, init: RequestInit = {}, key = SECRET) {
  return app.request(path, {
    ...init,
    headers: { authorization: `Bearer ${key}`, ...init.headers },
  });
}

beforeEach(() => {
  mocks.action.mockReset();
  mocks.mutation.mockReset();
  mocks.query.mockReset();
  mocks.handleConvexError.mockReset();
  mocks.handleConvexError.mockReturnValue(null);
});

describe("operations routes", () => {
  it("rejects publishable keys before Convex", async () => {
    const response = await call(
      "/webhooks/deliveries",
      {},
      "openiap-kit_pk_mobile",
    );
    expect(response.status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("pages deliveries with validated filters", async () => {
    mocks.query.mockResolvedValueOnce({
      page: [{ _id: "outboundDeliveries_1" }],
      isDone: false,
      continueCursor: "next",
    });
    const response = await call(
      "/webhooks/deliveries?status=failed&eventType=entitlement.revoked&limit=10&cursor=abc",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      deliveries: [{ _id: "outboundDeliveries_1" }],
      hasMore: true,
      nextCursor: "next",
    });
    expect(mocks.query).toHaveBeenCalledWith("listDeliveries", {
      apiKey: SECRET,
      status: "failed",
      eventType: "entitlement.revoked",
      paginationOpts: { numItems: 10, cursor: "abc" },
    });

    expect((await call("/webhooks/deliveries?status=lost")).status).toBe(400);
    expect((await call("/webhooks/deliveries?limit=500")).status).toBe(400);
  });

  it("re-sends with 202 and maps rate limits to 429", async () => {
    mocks.mutation.mockResolvedValueOnce({
      deliveryId: "outboundDeliveries_1",
      eventId: "commerceEvents_1",
      status: "pending",
    });
    const accepted = await call(
      "/webhooks/deliveries/outboundDeliveries_1/resend",
      {
        method: "POST",
      },
    );
    expect(accepted.status).toBe(202);
    expect(mocks.mutation).toHaveBeenCalledWith("resend", {
      apiKey: SECRET,
      deliveryId: "outboundDeliveries_1",
    });

    mocks.mutation.mockRejectedValueOnce(new Error("limited"));
    mocks.handleConvexError.mockReturnValueOnce({
      code: "RATE_LIMITED",
      message: "A project can re-send at most 30 deliveries per minute.",
      retryAfterSec: 12,
    });
    const limited = await call(
      "/webhooks/deliveries/outboundDeliveries_1/resend",
      { method: "POST" },
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("12");
  });

  it("pages inbound notifications", async () => {
    mocks.query.mockResolvedValueOnce({
      page: [],
      isDone: true,
      continueCursor: "end",
    });
    const response = await call("/webhooks/notifications");
    expect(await response.json()).toEqual({
      notifications: [],
      hasMore: false,
      nextCursor: null,
    });
    expect(mocks.query).toHaveBeenCalledWith("listInboundNotifications", {
      apiKey: SECRET,
      paginationOpts: { numItems: 25, cursor: null },
    });
  });

  it("re-syncs exactly one target", async () => {
    mocks.action.mockResolvedValueOnce({ target: "subscription" });
    const response = await call("/subscriptions/resync", {
      method: "POST",
      body: JSON.stringify({ subscriptionId: "subscriptions_1" }),
    });
    expect(response.status).toBe(200);
    expect(mocks.action).toHaveBeenCalledWith("resyncFromStore", {
      apiKey: SECRET,
      subscriptionId: "subscriptions_1",
    });

    const both = await call("/subscriptions/resync", {
      method: "POST",
      body: JSON.stringify({ purchaseId: "p", subscriptionId: "s" }),
    });
    expect(both.status).toBe(400);
    const neither = await call("/subscriptions/resync", {
      method: "POST",
      body: "{}",
    });
    expect(neither.status).toBe(400);
  });

  it("maps a missing row to 404 and reads one user's timeline", async () => {
    mocks.query.mockRejectedValueOnce(new Error("missing"));
    mocks.handleConvexError.mockReturnValueOnce({
      code: "NOT_FOUND",
      message: "Project not found",
    });
    expect((await call("/subscriptions/timeline?userId=u1")).status).toBe(404);

    mocks.query.mockResolvedValueOnce({
      appUserId: "u1",
      items: [],
      truncated: false,
    });
    const response = await call("/subscriptions/timeline?userId=u1");
    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenLastCalledWith("userTimeline", {
      apiKey: SECRET,
      appUserId: "u1",
    });
    expect((await call("/subscriptions/timeline")).status).toBe(400);
  });
});
