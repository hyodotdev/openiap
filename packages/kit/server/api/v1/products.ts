import { Hono } from "hono";

import { api } from "@/convex";
import type { Id } from "@/convex";
import { client } from "../../convex";

// Catalog read/write surface mirroring onesub's @onesub/providers
// admin path. The actual App Store Connect / Play Console push-sync
// is a Phase 3 follow-up; for now this manages the kit-side cache,
// which the dashboard / MCP server / SDKs all share.

const products = new Hono();

products.get("/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  const platformParam = c.req.query("platform");
  const platform =
    platformParam === "IOS" || platformParam === "Android"
      ? platformParam
      : undefined;
  const list = await client.query(api.products.query.listProducts, {
    apiKey,
    platform,
  });
  return c.json({ products: list });
});

products.post("/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  let body: {
    productId?: string;
    platform?: "IOS" | "Android";
    type?: "Subscription" | "NonConsumable" | "Consumable";
    title?: string;
    description?: string;
    priceAmountMicros?: number;
    currency?: string;
    billingPeriod?: "P1W" | "P1M" | "P2M" | "P3M" | "P6M" | "P1Y";
    state?: "Draft" | "Ready" | "Active" | "Removed";
    storeRef?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { errors: [{ code: "INVALID_INPUT", message: "Body is not JSON" }] },
      400,
    );
  }
  if (!body.productId || !body.platform || !body.type || body.title == null) {
    return c.json(
      {
        errors: [
          {
            code: "INVALID_INPUT",
            message: "productId, platform, type, title are required",
          },
        ],
      },
      400,
    );
  }
  try {
    const result = await client.mutation(api.products.mutation.upsertProduct, {
      apiKey,
      productId: body.productId,
      platform: body.platform,
      type: body.type,
      title: body.title,
      description: body.description,
      priceAmountMicros: body.priceAmountMicros,
      currency: body.currency,
      billingPeriod: body.billingPeriod,
      state: body.state,
      storeRef: body.storeRef,
    });
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        errors: [
          {
            code: "PRODUCT_UPSERT_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      },
      400,
    );
  }
});

// State-only update for the existing row. MCP `manage_product` uses
// this so it doesn't have to re-supply `type` / `title` (and thus
// can't accidentally clobber them, which the prior `upsertProduct`
// reuse pattern silently did).
products.post("/:apiKey/state", async (c) => {
  const apiKey = c.req.param("apiKey");
  let body: {
    productId?: string;
    platform?: "IOS" | "Android";
    state?: "Draft" | "Ready" | "Active" | "Removed";
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { errors: [{ code: "INVALID_INPUT", message: "Body is not JSON" }] },
      400,
    );
  }
  if (!body.productId || !body.platform || !body.state) {
    return c.json(
      {
        errors: [
          {
            code: "INVALID_INPUT",
            message: "productId, platform, state are required",
          },
        ],
      },
      400,
    );
  }
  try {
    const result = await client.mutation(
      api.products.mutation.setProductState,
      {
        apiKey,
        productId: body.productId,
        platform: body.platform,
        state: body.state,
      },
    );
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        errors: [
          {
            code: "PRODUCT_STATE_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      },
      400,
    );
  }
});

// Enqueue an async sync job. Returns `{ jobId, deduped }`
// immediately. The caller polls `GET .../sync/jobs/:jobId` until
// `status` is `succeeded` or `failed`. The previous synchronous
// endpoint held the HTTP connection open for the entire sync, which
// iOS Safari aborted on cellular / backgrounded tabs as
// `TypeError: Load failed`.
products.post("/:apiKey/sync/:platform", async (c) => {
  const apiKey = c.req.param("apiKey");
  const platformParam = c.req.param("platform");
  const direction =
    (c.req.query("direction") as
      | "pull"
      | "push"
      | "both"
      | "purge-local"
      | undefined) ?? "both";
  const dryRun = c.req.query("dryRun") === "true";
  if (platformParam !== "ios" && platformParam !== "android") {
    return c.json(
      {
        errors: [
          { code: "INVALID_INPUT", message: "platform must be ios|android" },
        ],
      },
      400,
    );
  }
  const platform: "IOS" | "Android" =
    platformParam === "ios" ? "IOS" : "Android";
  try {
    const result = await client.mutation(api.products.jobs.enqueueProductSync, {
      apiKey,
      platform,
      direction,
      dryRun,
    });
    return c.json(result, 202);
  } catch (error) {
    return c.json(
      {
        errors: [
          {
            code: "PRODUCT_SYNC_ENQUEUE_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      },
      400,
    );
  }
});

// Poll the job state. Clients should backoff (e.g. 3s) between
// polls; the typical sync finishes in tens of seconds, larger
// catalogs in 1-2 min. SSE is a future option; polling kept simple
// for v1.
products.get("/:apiKey/sync/jobs/:jobId", async (c) => {
  const apiKey = c.req.param("apiKey");
  const jobId = c.req.param("jobId");
  try {
    const job = await client.query(api.products.jobs.getSyncJobById, {
      apiKey,
      jobId: jobId as Id<"productSyncJobs">,
    });
    if (!job) {
      return c.json(
        { errors: [{ code: "NOT_FOUND", message: "Sync job not found" }] },
        404,
      );
    }
    return c.json(job);
  } catch (error) {
    return c.json(
      {
        errors: [
          {
            code: "PRODUCT_SYNC_LOOKUP_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      },
      400,
    );
  }
});

// Operator-initiated cancel. The worker checks `cancelRequested`
// at phase boundaries.
products.post("/:apiKey/sync/jobs/:jobId/cancel", async (c) => {
  const apiKey = c.req.param("apiKey");
  const jobId = c.req.param("jobId");
  try {
    const result = await client.mutation(api.products.jobs.cancelProductSync, {
      apiKey,
      jobId: jobId as Id<"productSyncJobs">,
    });
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        errors: [
          {
            code: "PRODUCT_SYNC_CANCEL_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      },
      400,
    );
  }
});

products.delete("/:apiKey/:productId", async (c) => {
  const apiKey = c.req.param("apiKey");
  const productId = c.req.param("productId");
  const platform = c.req.query("platform") as "IOS" | "Android" | undefined;
  if (platform !== "IOS" && platform !== "Android") {
    return c.json(
      {
        errors: [
          {
            code: "INVALID_INPUT",
            message: "platform query param required (IOS | Android)",
          },
        ],
      },
      400,
    );
  }
  const result = await client.mutation(api.products.mutation.removeProduct, {
    apiKey,
    productId,
    platform,
  });
  return c.json(result);
});

export { products as productsRoutes };
