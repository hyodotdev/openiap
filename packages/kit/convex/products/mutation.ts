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
    billingPeriod: v.optional(
      v.union(
        v.literal("P1W"),
        v.literal("P1M"),
        v.literal("P2M"),
        v.literal("P3M"),
        v.literal("P6M"),
        v.literal("P1Y"),
      ),
    ),
    subscriptionGroupName: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
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

    // iOS subscriptions REQUIRE a subscriptionGroupName upstream —
    // related tiers must share a group for StoreKit 2's native
    // upgrade/downgrade UI to work. The Apple push-sync (asc.ts)
    // falls back to using the productId as the group name when this
    // is missing, which results in each subscription landing in its
    // own fragmented group and silently breaks the upgrade flow.
    // Reject the upsert before that drift can happen so the operator
    // gets a loud, actionable error instead of a broken store
    // experience two sync passes later (PR #124
    // (https://github.com/hyodotdev/openiap/pull/124) review).
    if (
      args.platform === "IOS" &&
      args.type === "Subscription" &&
      (!args.subscriptionGroupName || !args.subscriptionGroupName.trim())
    ) {
      throw new Error(
        "subscriptionGroupName is required for iOS Subscription products — related tiers must share a group for StoreKit 2 upgrade/downgrade to work. Pick a group name (e.g. 'premium_tiers') and reuse it for every related subscription.",
      );
    }

    const existing: Doc<"products"> | null = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", project._id)
          .eq("platform", args.platform)
          .eq("productId", args.productId),
      )
      .unique();

    const now = Date.now();
    if (existing) {
      // State-only flips moved to `setProductState`. This mutation
      // now treats every supplied field as authoritative — keeping
      // the prior "blank title preserves existing" hack would still
      // mask cases where a caller really did mean to clear a field.
      await ctx.db.patch(existing._id, {
        type: args.type,
        title: args.title,
        description: args.description ?? existing.description,
        priceAmountMicros: args.priceAmountMicros ?? existing.priceAmountMicros,
        currency: args.currency ?? existing.currency,
        billingPeriod: args.billingPeriod ?? existing.billingPeriod,
        subscriptionGroupName:
          args.subscriptionGroupName ?? existing.subscriptionGroupName,
        reviewNote: args.reviewNote ?? existing.reviewNote,
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
      billingPeriod: args.billingPeriod,
      subscriptionGroupName: args.subscriptionGroupName,
      reviewNote: args.reviewNote,
      state: args.state ?? "Draft",
      storeRef: args.storeRef,
      updatedAt: now,
    });
    return { id, created: true };
  },
});

// State-only mutation used by `manage_product` (MCP) and the
// dashboard's enable/disable affordance. Distinct from `upsertProduct`
// because the previous reuse pattern (passing a blank title +
// hardcoded type so only `state` would update) would silently
// overwrite the existing row's `type` — e.g. flipping a NonConsumable
// to Subscription. Splitting the mutation prevents that class of
// drive-by clobber.
export const setProductState = mutation({
  args: {
    apiKey: v.string(),
    productId: v.string(),
    platform: platformValidator,
    state: stateValidator,
  },
  returns: v.object({
    id: v.id("products"),
    state: stateValidator,
  }),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .unique();
    if (!project) throw new Error("Invalid API key");

    const existing = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", project._id)
          .eq("platform", args.platform)
          .eq("productId", args.productId),
      )
      .unique();
    if (!existing) throw new Error("Product not found");

    await ctx.db.patch(existing._id, {
      state: args.state,
      updatedAt: Date.now(),
    });
    return { id: existing._id, state: args.state };
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
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", project._id)
          .eq("platform", args.platform)
          .eq("productId", args.productId),
      )
      .unique();
    if (!existing) return { ok: false };

    // Soft-remove via state flag — keeps audit history for the
    // dashboard and preserves any webhook events that reference this productId.
    await ctx.db.patch(existing._id, {
      state: "Removed",
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});
