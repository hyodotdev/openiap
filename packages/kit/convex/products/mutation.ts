import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

const platformValidator = v.union(v.literal("IOS"), v.literal("Android"));
const typeValidator = v.union(
  v.literal("Subscription"),
  v.literal("NonConsumable"),
  v.literal("Consumable"),
);
const stateValidator = v.union(
  v.literal("Draft"),
  v.literal("Ready"),
  v.literal("Active"),
  v.literal("Removed"),
);

// Public mutation: upsert a product in kit's catalog. Authoritative
// state lives in App Store Connect / Play Console; this row is a
// kit-side cache so the dashboard, MCP server, and SDKs share one
// canonical view. Phase 3 follow-ups will add ASC / Play push-sync
// — until then, treat this as a hand-managed catalog.
export const upsertProduct = mutation({
  args: {
    apiKey: v.string(),
    productId: v.string(),
    platform: platformValidator,
    type: typeValidator,
    title: v.string(),
    description: v.optional(v.string()),
    priceAmountMicros: v.optional(v.number()),
    currency: v.optional(v.string()),
    state: v.optional(stateValidator),
    storeRef: v.optional(v.string()),
  },
  returns: v.object({
    id: v.id("products"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .unique();
    if (!project) throw new Error("Invalid API key");

    const existing: Doc<"products"> | null = await ctx.db
      .query("products")
      .withIndex("by_project_and_product", (q) =>
        q.eq("projectId", project._id).eq("productId", args.productId),
      )
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        platform: args.platform,
        type: args.type,
        // upsertProduct is also called by `manage_product` with a blank
        // title to flip state; preserve the existing title in that case.
        title: args.title || existing.title,
        description: args.description ?? existing.description,
        priceAmountMicros: args.priceAmountMicros ?? existing.priceAmountMicros,
        currency: args.currency ?? existing.currency,
        state: args.state ?? existing.state,
        storeRef: args.storeRef ?? existing.storeRef,
        updatedAt: now,
      });
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("products", {
      projectId: project._id,
      productId: args.productId,
      platform: args.platform,
      type: args.type,
      title: args.title,
      description: args.description,
      priceAmountMicros: args.priceAmountMicros,
      currency: args.currency,
      state: args.state ?? "Draft",
      storeRef: args.storeRef,
      updatedAt: now,
    });
    return { id, created: true };
  },
});

export const removeProduct = mutation({
  args: {
    apiKey: v.string(),
    productId: v.string(),
    platform: platformValidator,
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .unique();
    if (!project) return { ok: false };

    const existing = await ctx.db
      .query("products")
      .withIndex("by_project_and_product", (q) =>
        q.eq("projectId", project._id).eq("productId", args.productId),
      )
      .unique();
    if (!existing) return { ok: false };
    if (existing.platform !== args.platform) return { ok: false };

    // Soft-remove via state flag — keeps audit history for the
    // dashboard and does not break paywalls referencing this productId.
    await ctx.db.patch(existing._id, {
      state: "Removed",
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});
