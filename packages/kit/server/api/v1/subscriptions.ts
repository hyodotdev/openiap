import { Hono } from "hono";

import { api } from "@/convex";
import { client } from "../../convex";

// Subscription state, entitlements, metrics, and user-binding routes.
// Mirrors the role of onesub's `/onesub/status`, `/onesub/admin/...`
// and `/onesub/metrics/*` endpoints, but with kit-style apiKey-in-path
// auth so the routes work without sticky bearer headers from RN-side
// fetch implementations that strip them.

const subscriptions = new Hono();

subscriptions.get("/status/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  const userId = c.req.query("userId");
  if (!userId) {
    return c.json(
      { errors: [{ code: "INVALID_INPUT", message: "userId is required" }] },
      400,
    );
  }
  if (userId.length > 256) {
    return c.json(
      {
        errors: [
          { code: "INVALID_INPUT", message: "userId must be ≤ 256 chars" },
        ],
      },
      400,
    );
  }
  const result = await client.query(
    api.subscriptions.query.subscriptionStatus,
    {
      apiKey,
      userId,
    },
  );
  return c.json(result);
});

subscriptions.get("/entitlements/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  const userId = c.req.query("userId");
  if (!userId) {
    return c.json(
      { errors: [{ code: "INVALID_INPUT", message: "userId is required" }] },
      400,
    );
  }
  const result = await client.query(api.subscriptions.query.entitlements, {
    apiKey,
    userId,
  });
  return c.json(result);
});

subscriptions.get("/list/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  const state = c.req.query("state");
  const productId = c.req.query("productId");
  const userId = c.req.query("userId");
  const limit = parseLimit(c.req.query("limit"));
  const result = await client.query(api.subscriptions.query.listSubscriptions, {
    apiKey,
    state: state as never,
    productId: productId ?? undefined,
    userId: userId ?? undefined,
    limit,
  });
  return c.json(result);
});

subscriptions.get("/metrics/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  const result = await client.query(api.subscriptions.query.metricsSummary, {
    apiKey,
  });
  return c.json(result);
});

subscriptions.post("/bind-user/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  let body: { purchaseToken?: string; userId?: string };
  try {
    body = await c.req.json<{ purchaseToken?: string; userId?: string }>();
  } catch {
    return c.json(
      { errors: [{ code: "INVALID_INPUT", message: "Body is not JSON" }] },
      400,
    );
  }
  if (!body.purchaseToken || !body.userId) {
    return c.json(
      {
        errors: [
          {
            code: "INVALID_INPUT",
            message: "purchaseToken and userId are required",
          },
        ],
      },
      400,
    );
  }
  const result = await client.mutation(api.subscriptions.mutation.bindUser, {
    apiKey,
    purchaseToken: body.purchaseToken,
    userId: body.userId,
  });
  return c.json(result);
});

function parseLimit(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(Math.max(Math.trunc(n), 1), 200);
}

export { subscriptions as subscriptionsRoutes };
