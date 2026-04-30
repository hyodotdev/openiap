import { Hono } from "hono";

import { api } from "@/convex";
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

products.post("/:apiKey/sync/:platform", async (c) => {
  const apiKey = c.req.param("apiKey");
  const platform = c.req.param("platform");
  const direction =
    (c.req.query("direction") as "pull" | "push" | "both" | undefined) ??
    "both";
  if (platform !== "ios" && platform !== "android") {
    return c.json(
      {
        errors: [
          { code: "INVALID_INPUT", message: "platform must be ios|android" },
        ],
      },
      400,
    );
  }
  try {
    const result =
      platform === "ios"
        ? await client.action(api.products.asc.pushSyncProductsApple, {
            apiKey,
            direction,
          })
        : await client.action(api.products.play.pushSyncProductsGoogle, {
            apiKey,
            direction,
          });
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        errors: [
          {
            code: "PRODUCT_SYNC_FAILED",
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
