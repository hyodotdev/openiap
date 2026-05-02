import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

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

const offerKindValidator = v.union(
  v.literal("FreeTrial"),
  v.literal("IntroPayUpFront"),
  v.literal("IntroPayAsYouGo"),
  v.literal("PromotionalOffer"),
  v.literal("BasePlan"),
);
const offerValidator = v.object({
  id: v.string(),
  kind: offerKindValidator,
  duration: v.optional(v.string()),
  numberOfPeriods: v.optional(v.number()),
  priceAmountMicros: v.optional(v.number()),
  currency: v.optional(v.string()),
});

// Internal mutation called by the ASC / Play push-sync actions when a
// row is mirrored from the upstream store. Distinct from the public
// `upsertProduct` mutation in mutation.ts so server-driven sync can't
// be triggered by anyone holding the apiKey alone.
export const upsertFromStore = internalMutation({
  args: {
    projectId: v.id("projects"),
    productId: v.string(),
    platform: platformValidator,
    type: typeValidator,
    title: v.string(),
    description: v.optional(v.string()),
    priceAmountMicros: v.optional(v.number()),
    currency: v.optional(v.string()),
    storeRef: v.string(),
    state: stateValidator,
    subscriptionGroupId: v.optional(v.string()),
    subscriptionGroupName: v.optional(v.string()),
    offers: v.optional(v.array(offerValidator)),
  },
  returns: v.id("products"),
  handler: async (ctx, args) => {
    // Match by (projectId, platform, productId) — apps commonly use
    // the same productId on both stores, and the older
    // (projectId, productId)-only lookup would collide and silently
    // flip an existing Android row's platform to IOS (or vice versa)
    // mid-sync, deleting one platform's catalog from the dashboard's
    // perspective.
    const existing: Doc<"products"> | null = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("platform", args.platform)
          .eq("productId", args.productId),
      )
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        type: args.type,
        title: args.title || existing.title,
        description: args.description ?? existing.description,
        priceAmountMicros: args.priceAmountMicros ?? existing.priceAmountMicros,
        currency: args.currency ?? existing.currency,
        storeRef: args.storeRef,
        state: args.state,
        // Subscription metadata is sourced from the store on every
        // pull, so we overwrite (not coalesce) — a sub that was
        // moved between groups in ASC, or that lost a free trial in
        // Play Console, should reflect that on the next sync rather
        // than stick to whatever kit cached previously.
        subscriptionGroupId: args.subscriptionGroupId,
        subscriptionGroupName: args.subscriptionGroupName,
        offers: args.offers,
        syncedAt: now,
        updatedAt: now,
      });
      return existing._id;
    }
    const id: Id<"products"> = await ctx.db.insert("products", {
      projectId: args.projectId,
      productId: args.productId,
      platform: args.platform,
      type: args.type,
      title: args.title,
      description: args.description,
      priceAmountMicros: args.priceAmountMicros,
      currency: args.currency,
      storeRef: args.storeRef,
      state: args.state,
      subscriptionGroupId: args.subscriptionGroupId,
      subscriptionGroupName: args.subscriptionGroupName,
      offers: args.offers,
      syncedAt: now,
      updatedAt: now,
    });
    return id;
  },
});

// Persist the upstream resource id immediately after the create call
// succeeds, *without* advancing state past Draft. The follow-up steps
// (localization, price schedule) may still fail, and a hard failure
// there shouldn't strand the upstream resource — the next sync needs
// to find this row, see the populated storeRef, and resume from
// step 2 instead of trying to create a duplicate. `markPushed`
// remains the success path that flips state to Ready.
export const markStoreRef = internalMutation({
  args: {
    projectId: v.id("projects"),
    productId: v.string(),
    platform: platformValidator,
    storeRef: v.string(),
  },
  returns: v.union(v.id("products"), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("platform", args.platform)
          .eq("productId", args.productId),
      )
      .unique();
    if (!existing) return null;
    await ctx.db.patch(existing._id, {
      storeRef: args.storeRef,
      syncedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return existing._id;
  },
});

// After a successful push, write the upstream resource id back so the
// next pull doesn't double-create.
export const markPushed = internalMutation({
  args: {
    projectId: v.id("projects"),
    productId: v.string(),
    platform: platformValidator,
    storeRef: v.string(),
  },
  returns: v.union(v.id("products"), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("platform", args.platform)
          .eq("productId", args.productId),
      )
      .unique();
    if (!existing) return null;
    await ctx.db.patch(existing._id, {
      storeRef: args.storeRef,
      state: "Ready",
      syncedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return existing._id;
  },
});

// Pull every Draft iOS row that the push pass should attempt. We do
// NOT gate on `storeRef === undefined` here: a previous sync may have
// successfully created the upstream resource (storeRef now populated)
// but failed on a subsequent step (localization / price schedule).
// Such rows stay in state=Draft and the push branch needs to revisit
// them — using their existing storeRef to skip the create call and
// retry only the failed steps. The push branch handles the
// "skip create when storeRef already set" decision.
export const listDraftIosProducts = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
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
      storeRef: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform", (q) =>
        q.eq("projectId", args.projectId).eq("platform", "IOS"),
      )
      .collect();
    return all
      .filter((row) => row.state === "Draft")
      .map((row) => ({
        productId: row.productId,
        platform: row.platform,
        type: row.type,
        title: row.title,
        description: row.description,
        priceAmountMicros: row.priceAmountMicros,
        currency: row.currency,
        billingPeriod: row.billingPeriod,
        subscriptionGroupName: row.subscriptionGroupName,
        reviewNote: row.reviewNote,
        storeRef: row.storeRef,
      }));
  },
});

// Same for Android — used by the Play push action.
export const listDraftAndroidProducts = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
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
      storeRef: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform", (q) =>
        q.eq("projectId", args.projectId).eq("platform", "Android"),
      )
      .collect();
    // Mirror the iOS filter: state === Draft AND not already linked
    // upstream. Without the storeRef guard, a Draft row that came in
    // via Pull (already exists in Play Console) would be re-pushed on
    // every sync, colliding on the SKU's create call.
    return all
      .filter((row) => row.state === "Draft" && row.storeRef === undefined)
      .map((row) => ({
        productId: row.productId,
        platform: row.platform,
        type: row.type,
        title: row.title,
        description: row.description,
        priceAmountMicros: row.priceAmountMicros,
        currency: row.currency,
        billingPeriod: row.billingPeriod,
        storeRef: row.storeRef,
      }));
  },
});
