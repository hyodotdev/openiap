import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

import { productLocalizationsValidator } from "./localizations";
import { productRegionsValidator } from "./regions";
import type { Doc, Id } from "../_generated/dataModel";
import { assertProjectWritable } from "../projects/writable";

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

// Narrows a store billing period to the schema's literals. An unmodelled value
// becomes undefined (MRR 0, logged as an unknown period) rather than failing
// the validator.
export type BillingPeriodLiteral =
  | "P1W"
  | "P1M"
  | "P2M"
  | "P3M"
  | "P6M"
  | "P1Y";
const KNOWN_BILLING_PERIODS = new Set<BillingPeriodLiteral>([
  "P1W",
  "P1M",
  "P2M",
  "P3M",
  "P6M",
  "P1Y",
]);
export function coerceBillingPeriod(
  raw: string | undefined,
): BillingPeriodLiteral | undefined {
  if (!raw) return undefined;
  return KNOWN_BILLING_PERIODS.has(raw as BillingPeriodLiteral)
    ? (raw as BillingPeriodLiteral)
    : undefined;
}

export function isSafePriceAmountMicros(value: number | undefined): boolean {
  return value === undefined || (Number.isSafeInteger(value) && value >= 0);
}

function assertSafePriceAmountMicros(
  value: number | undefined,
  fieldName: string,
): void {
  if (!isSafePriceAmountMicros(value)) {
    throw new Error(`${fieldName} must be a non-negative safe integer`);
  }
}

export function shouldPreserveKitRemovedDuringPull(
  existing: Pick<Doc<"products">, "state" | "origin"> | null | undefined,
): boolean {
  return existing?.state === "Removed" && existing.origin === "kit";
}

// Store-to-kit upsert for the sync workers; internal, unlike `upsertProduct`,
// so an apiKey alone cannot trigger it.
export const upsertFromStore = internalMutation({
  args: {
    projectId: v.id("projects"),
    productId: v.string(),
    platform: platformValidator,
    type: typeValidator,
    title: v.string(),
    description: v.optional(v.string()),
    baseLocale: v.optional(v.string()),
    // No `v.null()`, unlike upsertProduct: a pull never clears kit locales, so
    // a null would silently do nothing.
    localizations: v.optional(productLocalizationsValidator),
    priceAmountMicros: v.optional(v.number()),
    currency: v.optional(v.string()),
    storeRef: v.string(),
    state: stateValidator,
    // Needed for MRR: without it monthlyMicrosForSub returns 0. Callers coerce
    // store values with coerceBillingPeriod so this stays strict.
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
    subscriptionGroupId: v.optional(v.string()),
    subscriptionGroupName: v.optional(v.string()),
    offers: v.optional(v.array(offerValidator)),
  },
  returns: v.id("products"),
  handler: async (ctx, args) => {
    await assertProjectWritable(ctx, args.projectId);
    assertSafePriceAmountMicros(args.priceAmountMicros, "priceAmountMicros");
    args.offers?.forEach((offer, index) => {
      assertSafePriceAmountMicros(
        offer.priceAmountMicros,
        `offers[${index}].priceAmountMicros`,
      );
    });

    // Match on platform too: apps often reuse a productId on both stores, and
    // matching without it flips one platform's row to the other.
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
    if (existing && shouldPreserveKitRemovedDuringPull(existing)) {
      // A kit-authored removal is a pending upstream delete. In a `both` sync
      // the pull runs first and would otherwise resurrect the row before the
      // delete pass sees it.
      return existing._id;
    }
    // Null, since a patch ignores undefined: clears group fields on
    // non-subscriptions so a row that changed type does not show under a
    // subscription group.
    const groupId =
      args.type === "Subscription" ? (args.subscriptionGroupId ?? null) : null;
    const groupName =
      args.type === "Subscription"
        ? (args.subscriptionGroupName ?? null)
        : null;
    if (existing) {
      await ctx.db.patch(existing._id, {
        type: args.type,
        title: args.title || existing.title,
        description: args.description ?? existing.description,
        baseLocale: args.baseLocale ?? existing.baseLocale,
        localizations: args.localizations ?? existing.localizations,
        priceAmountMicros: args.priceAmountMicros ?? existing.priceAmountMicros,
        currency: args.currency ?? existing.currency,
        storeRef: args.storeRef,
        state: args.state,
        // Overwrite, not coalesce: the store owns subscription metadata,
        // including a group move or a removed free trial.
        billingPeriod: args.billingPeriod,
        subscriptionGroupId: groupId,
        subscriptionGroupName: groupName,
        offers: args.offers,
        syncedAt: now,
        updatedAt: now,
        // A store-reported removal is not a kit delete request: mark it
        // store-origin so the push half does not delete it again. Kit removals
        // returned above.
        ...(args.state === "Removed"
          ? { origin: "store" as const }
          : existing.origin === undefined
            ? { origin: "store" as const }
            : {}),
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
      baseLocale: args.baseLocale,
      localizations: args.localizations,
      priceAmountMicros: args.priceAmountMicros,
      currency: args.currency,
      storeRef: args.storeRef,
      state: args.state,
      billingPeriod: args.billingPeriod,
      subscriptionGroupId: groupId,
      subscriptionGroupName: groupName,
      offers: args.offers,
      syncedAt: now,
      updatedAt: now,
      origin: "store",
    });
    return id;
  },
});

// Saves the upstream id right after create but leaves the row Draft, so a
// failed later step resumes on the next sync instead of creating a duplicate.
// markPushed sets Ready.
export const markStoreRef = internalMutation({
  args: {
    projectId: v.id("projects"),
    productId: v.string(),
    platform: platformValidator,
    storeRef: v.string(),
  },
  returns: v.union(v.id("products"), v.null()),
  handler: async (ctx, args) => {
    await assertProjectWritable(ctx, args.projectId);
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
    reviewScreenshotFileId: v.optional(v.id("files")),
  },
  returns: v.union(v.id("products"), v.null()),
  handler: async (ctx, args) => {
    await assertProjectWritable(ctx, args.projectId);
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
      ...(args.reviewScreenshotFileId
        ? {
            lastAppleReviewScreenshotFileId: args.reviewScreenshotFileId,
          }
        : {}),
      syncedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return existing._id;
  },
});

export const getExistingProductType = internalQuery({
  args: {
    projectId: v.id("projects"),
    platform: platformValidator,
    productId: v.string(),
  },
  returns: v.union(typeValidator, v.null()),
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
    return existing?.type ?? null;
  },
});

export const listExistingProductTypes = internalQuery({
  args: {
    projectId: v.id("projects"),
    platform: platformValidator,
  },
  returns: v.array(
    v.object({
      productId: v.string(),
      type: typeValidator,
      // Lets the Play pull keep the authored currency (pickPlayRegionalPrice).
      currency: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform", (q) =>
        q.eq("projectId", args.projectId).eq("platform", args.platform),
      )
      .collect();
    return rows.map((row) => ({
      productId: row.productId,
      type: row.type,
      currency: row.currency,
    }));
  },
});

// Draft iOS rows to push, including ones with a storeRef: a create that
// succeeded before a later step failed stays Draft, and the push skips create
// for it.
export const listDraftIosProducts = internalQuery({
  args: {
    projectId: v.id("projects"),
    // A kit-created row previously promoted to Ready because no review
    // screenshot was configured must become eligible again once the operator
    // adds the project screenshot.
    includeReadyForReview: v.optional(v.boolean()),
    reviewScreenshotFileId: v.optional(v.id("files")),
  },
  returns: v.array(
    v.object({
      productId: v.string(),
      platform: platformValidator,
      state: v.union(v.literal("Draft"), v.literal("Ready")),
      type: typeValidator,
      title: v.string(),
      description: v.optional(v.string()),
      baseLocale: v.optional(v.string()),
      localizations: v.optional(productLocalizationsValidator),
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
      subscriptionGroupId: v.optional(v.string()),
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
      .filter(
        (row) =>
          (row.state === "Draft" ||
            (args.includeReadyForReview === true &&
              row.state === "Ready" &&
              (args.reviewScreenshotFileId === undefined ||
                row.lastAppleReviewScreenshotFileId !==
                  args.reviewScreenshotFileId))) &&
          // Skip store-imported rows: ASC states like PREPARE_FOR_SUBMISSION
          // map to Draft and would be re-pushed every sync. Legacy rows without
          // `origin` pass only without a storeRef; partial kit creates keep
          // `origin: "kit"`.
          (row.origin === "kit" || row.storeRef === undefined),
      )
      .sort((left, right) => {
        // Resume legacy Ready rows first, then use productId for deterministic
        // bounded batches across retries and workers.
        if (left.state !== right.state) return left.state === "Ready" ? -1 : 1;
        return left.productId.localeCompare(right.productId);
      })
      .map((row) => ({
        productId: row.productId,
        platform: row.platform,
        state: row.state as "Draft" | "Ready",
        type: row.type,
        title: row.title,
        description: row.description,
        baseLocale: row.baseLocale,
        // Coerce the nullable columns to optional at the worker
        // boundary: "cleared" and "never set" are the same thing to a
        // store push, and null would trip the validator.
        localizations: row.localizations ?? undefined,
        priceAmountMicros: row.priceAmountMicros,
        currency: row.currency,
        billingPeriod: row.billingPeriod,
        // Same coercion for the nullable group fields.
        subscriptionGroupName: row.subscriptionGroupName ?? undefined,
        subscriptionGroupId: row.subscriptionGroupId ?? undefined,
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
      baseLocale: v.optional(v.string()),
      localizations: v.optional(productLocalizationsValidator),
      regions: v.optional(productRegionsValidator),
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
    // As for iOS: Draft rows with or without a storeRef; play.ts patches
    // existing ones.
    return all
      .filter(
        (row) =>
          row.state === "Draft" &&
          // Same store-import filter as the iOS query.
          (row.origin === "kit" || row.storeRef === undefined),
      )
      .map((row) => ({
        productId: row.productId,
        platform: row.platform,
        type: row.type,
        title: row.title,
        description: row.description,
        baseLocale: row.baseLocale,
        // Coerce the nullable columns to optional at the worker
        // boundary: "cleared" and "never set" are the same thing to a
        // store push, and null would trip the validator.
        localizations: row.localizations ?? undefined,
        // Only Android one-time products have a region footprint. An empty or
        // leftover list from old rows must never reach Play as "withdraw
        // everywhere".
        regions:
          row.type !== "Subscription" &&
          (row.regions === "all" ||
            (Array.isArray(row.regions) && row.regions.length > 0))
            ? row.regions
            : undefined,
        priceAmountMicros: row.priceAmountMicros,
        currency: row.currency,
        billingPeriod: row.billingPeriod,
        storeRef: row.storeRef,
      }));
  },
});

const removedProductReturnValidator = v.object({
  productId: v.string(),
  platform: platformValidator,
  type: typeValidator,
  storeRef: v.optional(v.string()),
});

function removedProductsForPush(rows: Doc<"products">[]): Array<{
  productId: string;
  platform: "IOS" | "Android";
  type: "Subscription" | "NonConsumable" | "Consumable";
  storeRef?: string;
}> {
  return rows
    .filter(
      (row) =>
        row.state === "Removed" &&
        // Only push deletes that were authored in kit. Store-imported
        // removed/draft-ish rows are cache state, not an operator's
        // instruction to delete upstream resources.
        (row.origin === "kit" || row.storeRef === undefined),
    )
    .map((row) => ({
      productId: row.productId,
      platform: row.platform,
      type: row.type,
      storeRef: row.storeRef,
    }));
}

export const listRemovedIosProducts = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(removedProductReturnValidator),
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform", (q) =>
        q.eq("projectId", args.projectId).eq("platform", "IOS"),
      )
      .collect();
    return removedProductsForPush(all);
  },
});

export const listRemovedAndroidProducts = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(removedProductReturnValidator),
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform", (q) =>
        q.eq("projectId", args.projectId).eq("platform", "Android"),
      )
      .collect();
    return removedProductsForPush(all);
  },
});

export const deleteRemovedProductRow = internalMutation({
  args: {
    projectId: v.id("projects"),
    productId: v.string(),
    platform: platformValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    await assertProjectWritable(ctx, args.projectId);
    const existing = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("platform", args.platform)
          .eq("productId", args.productId),
      )
      .unique();
    if (
      !existing ||
      existing.state !== "Removed" ||
      !(existing.origin === "kit" || existing.storeRef === undefined)
    ) {
      return false;
    }
    // Client payloads live outside `products` and are kept, so a later pull
    // that recreates the row gets them back.
    await ctx.db.delete(existing._id);
    return true;
  },
});

// `purge-local`: deletes one page of a platform's kit product rows; the worker
// loops on `hasMore`. Client payloads and the stores are untouched: upstream
// deletes go through Removed rows and a push sync, which reports per product.
export const deletePlatformCatalog = internalMutation({
  args: {
    projectId: v.id("projects"),
    platform: platformValidator,
    limit: v.number(),
  },
  returns: v.object({ deleted: v.number(), hasMore: v.boolean() }),
  handler: async (ctx, args) => {
    await assertProjectWritable(ctx, args.projectId);
    // A limit of 0 would report hasMore with nothing deleted, looping the
    // worker until the reaper kills it.
    if (!Number.isInteger(args.limit) || args.limit < 1) {
      throw new Error("limit must be a positive integer");
    }
    const page = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform", (q) =>
        q.eq("projectId", args.projectId).eq("platform", args.platform),
      )
      .take(args.limit + 1);
    const hasMore = page.length > args.limit;
    const toDelete = hasMore ? page.slice(0, args.limit) : page;
    for (const row of toDelete) {
      await ctx.db.delete(row._id);
    }
    return { deleted: toDelete.length, hasMore };
  },
});
