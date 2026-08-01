import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
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

// Coerce a free-form billingPeriod string into the schema's literal
// union, returning undefined for unknown values. ASC and Play both
// hand us ISO-8601 strings ("P1M" / "P1Y" / etc.) but a future Apple
// enum or Play SDK quirk could leak something we don't model — in
// that case we'd rather drop the field (so MRR shows 0 with a clear
// "unknown period" log line) than persist garbage that breaks the
// schema validator.
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
    // ISO-8601 billing period. Required for correct MRR
    // normalization in metricsSummary — without this field synced
    // subscriptions defaulted to undefined and monthlyMicrosForSub
    // returned 0, silently zeroing every synced sub's contribution
    // to the dashboard headline. Union mirrors the schema's
    // `billingPeriod` literal — non-matching upstream values (a
    // future Apple/Play enum) get coerced via mapBillingPeriodLiteral
    // at the call site so this validator can stay strict.
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
    if (existing && shouldPreserveKitRemovedDuringPull(existing)) {
      // A kit-authored removal is an upstream delete request. Pull
      // runs before push for direction="both", so without this guard
      // the still-existing store row would resurrect the local row to
      // Active/Ready and the delete pass would never see it.
      return existing._id;
    }
    // Subscription group metadata only applies to subscriptions —
    // explicitly null it out for non-Subscription rows so a row
    // that flipped types (or that the operator typed a group name
    // into via the form) doesn't cling to stale data and surface
    // under the dashboard's "Subscription Group" cluster
    // (LukasB-DEV report on PR #128). Convex patches treat
    // `undefined` as a no-op, so the field has to be `null` to
    // actually clear — schema widened accordingly.
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
        priceAmountMicros: args.priceAmountMicros ?? existing.priceAmountMicros,
        currency: args.currency ?? existing.currency,
        storeRef: args.storeRef,
        state: args.state,
        // Subscription metadata is sourced from the store on every
        // pull, so we overwrite (not coalesce) — a sub that was
        // moved between groups in ASC, or that lost a free trial in
        // Play Console, should reflect that on the next sync rather
        // than stick to whatever kit cached previously. Same applies
        // to billingPeriod: the upstream is the source of truth.
        billingPeriod: args.billingPeriod,
        subscriptionGroupId: groupId,
        subscriptionGroupName: groupName,
        offers: args.offers,
        syncedAt: now,
        updatedAt: now,
        // A store-reported removal is upstream state, not a new kit-authored
        // delete request. Reclassify it so the push half of a `both` job does
        // not attempt to delete the already-unavailable resource. An explicit
        // kit removal returned above before reaching this patch and therefore
        // keeps its deletion intent. Preserve origin for all other updates.
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
    }));
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
          // Skip rows that were imported from the upstream store —
          // ASC's "PREPARE_FOR_SUBMISSION" / "MISSING_METADATA" /
          // similar states map to kit `Draft`, and re-pushing them on
          // every sync inflated the `pushed` counter while looping
          // them back-and-forth between Draft and Ready (LukasB-DEV
          // report on PR #128). Legacy rows without `origin` set
          // pass when they have no `storeRef` — pure kit creations
          // — and partial-sync resumption (kit-created row whose
          // CREATE succeeded but localization/price failed) keeps
          // working because those rows have `origin: "kit"` set on
          // first insert.
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
        priceAmountMicros: row.priceAmountMicros,
        currency: row.currency,
        billingPeriod: row.billingPeriod,
        // Coerce nullable schema field back to optional at the
        // worker boundary — push code branches on
        // `row.subscriptionGroupName ?? row.productId` and treats
        // `undefined` correctly; null would slip past the `??`.
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
    // Mirror the iOS filter: state === Draft only. The earlier
    // `storeRef === undefined` guard was added to avoid re-pushing
    // Pull-imported rows that already existed upstream, but it also
    // blocked partial-sync resumption — a Draft row whose create
    // succeeded but whose listing/price step failed never got
    // retried. play.ts now branches on `row.storeRef` at the top of
    // the push loop and PATCHes existing storeRefs instead of
    // creating, so both the partial-sync and pull-then-push cases
    // are correct without the extra filter (PR #124
    // (https://github.com/hyodotdev/openiap/pull/124) review).
    return all
      .filter(
        (row) =>
          row.state === "Draft" &&
          // Same `origin === "kit" OR storeRef === undefined` filter
          // as the iOS query — see comment there. Excludes
          // pulled-from-Play rows that map to `Draft` and would
          // otherwise re-push on every sync.
          (row.origin === "kit" || row.storeRef === undefined),
      )
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
    // Client payload bodies and body-free dashboard summaries intentionally
    // live outside `products` and are retained. If a later pull recreates this
    // catalog row, the app-owned metadata becomes available again without an
    // operator re-entering it.
    await ctx.db.delete(existing._id);
    return true;
  },
});

// Bounded delete used by the `purge-local` sync direction. Deletes
// the project's kit-side product rows for one platform and returns
// `{ deleted, hasMore }` so the worker can loop until empty without
// blowing past Convex's per-mutation document budget. Does NOT touch
// either client-payload table, App Store Connect, or Play Console — upstream
// deletion is handled by
// marking individual rows Removed and running push/both sync so the
// platform-specific delete constraints can be reported per product.
export const deletePlatformCatalog = internalMutation({
  args: {
    projectId: v.id("projects"),
    platform: platformValidator,
    limit: v.number(),
  },
  returns: v.object({ deleted: v.number(), hasMore: v.boolean() }),
  handler: async (ctx, args) => {
    await assertProjectWritable(ctx, args.projectId);
    // Guard against `limit <= 0` — Convex would happily run
    // `.take(1)` (limit + 1 = 1) and the worker loop reads
    // `hasMore` to keep iterating, which combined with `deleted = 0`
    // traps the purge worker in a non-progressing loop until the
    // 9-min reaper kills it (CodeRabbit critical finding on
    // PR #127).
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
