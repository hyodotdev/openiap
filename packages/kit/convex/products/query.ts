import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

const productShape = v.object({
  productId: v.string(),
  platform: v.union(v.literal("IOS"), v.literal("Android")),
  type: v.union(
    v.literal("Subscription"),
    v.literal("NonConsumable"),
    v.literal("Consumable"),
  ),
  title: v.string(),
  description: v.optional(v.string()),
  priceAmountMicros: v.optional(v.number()),
  currency: v.optional(v.string()),
  state: v.union(
    v.literal("Draft"),
    v.literal("Ready"),
    v.literal("Active"),
    v.literal("Removed"),
  ),
  storeRef: v.optional(v.string()),
  updatedAt: v.number(),
});

function shape(product: Doc<"products">) {
  return {
    productId: product.productId,
    platform: product.platform,
    type: product.type,
    title: product.title,
    description: product.description,
    priceAmountMicros: product.priceAmountMicros,
    currency: product.currency,
    state: product.state,
    storeRef: product.storeRef,
    updatedAt: product.updatedAt,
  };
}

export const listProducts = query({
  args: {
    apiKey: v.string(),
    platform: v.optional(v.union(v.literal("IOS"), v.literal("Android"))),
  },
  returns: v.array(productShape),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .unique();
    if (!project) return [];

    if (args.platform) {
      const rows = await ctx.db
        .query("products")
        .withIndex("by_project_and_platform", (q) =>
          q.eq("projectId", project._id).eq("platform", args.platform!),
        )
        .collect();
      return rows.map(shape);
    }

    const rows = await ctx.db
      .query("products")
      .withIndex("by_project_and_product", (q) =>
        q.eq("projectId", project._id),
      )
      .collect();
    return rows.map(shape);
  },
});
