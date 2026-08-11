import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api.js";
import { DataModel } from "./_generated/dataModel.js";
import {
  extractOrderIdFromRemoteResponse,
  extractProductIdFromRemoteResponse,
  isValidState,
} from "./purchases/shared.js";
import {
  applyPurchaseStatsDelta,
  deltaForMissingPurchaseStats,
  recomputePurchaseStatsForProject,
} from "./purchases/stats.js";

export const migrations = new Migrations<DataModel>(components.migrations);

/**
 * Migration: Update subscription tiers to Developer/Pro/Enterprise
 *
 * Maps old tier names to new tier names:
 * - free, starter, growth, scale -> developer
 * - enterprise -> enterprise (unchanged)
 *
 */
export const updateSubscriptionTiers = migrations.define({
  table: "organizations",
  migrateOne: async (ctx, doc) => {
    const oldTiers = ["free", "starter", "growth", "scale"];

    if (doc.subscriptionTier && oldTiers.includes(doc.subscriptionTier)) {
      return {
        ...doc,
        subscriptionTier: "developer" as const,
      };
    }

    return doc;
  },
});

/**
 * Migration: Remove deprecated avatar/bio fields from user profiles
 */
export const removeLegacyProfileFields = migrations.define({
  table: "userProfiles",
  migrateOne: async (_ctx, doc) => {
    const hasLegacyFields =
      "avatarUrl" in doc || "avatarFileId" in doc || "bio" in doc;

    if (!hasLegacyFields) {
      return doc;
    }

    const updatedDoc = { ...doc } as typeof doc & Record<string, unknown>;
    delete updatedDoc["avatarUrl"];
    delete updatedDoc["avatarFileId"];
    delete updatedDoc["bio"];
    return updatedDoc;
  },
});

/**
 * Migration: Replace isAuthentic with isValid on purchases
 *
 * - Adds `isValid` field computed from `state` using isValidState()
 * - Removes deprecated `isAuthentic` field
 */
export const replaceIsAuthenticWithIsValid = migrations.define({
  table: "purchases",
  migrateOne: async (_ctx, doc) => {
    const isValid = isValidState(doc.state);

    return {
      ...doc,
      isValid,
      isAuthentic: undefined,
    };
  },
});

/**
 * Migration: Remove deprecated purchaseId field from requestData on purchases
 */
export const removePurchaseIdFromRequestData = migrations.define({
  table: "purchases",
  migrateOne: async (_ctx, doc) => {
    return {
      ...doc,
      requestData: { ...doc.requestData, purchaseId: undefined },
    };
  },
});

/**
 * Migration: Backfill the `purchaseStats` counter table row-by-row.
 *
 * Iterates the `purchases` table. Each `migrateOne` call runs as its own
 * mutation — bounded to one purchase + one stats-row upsert — so
 * per-project receipt volume never blows the per-transaction read/write
 * budget. The base `statsCounted` and later `storeStatsCounted` sentinels
 * make the migration safe to resume after partial runs and coordinate it
 * with `backfillPurchaseStatsStoreBuckets` in either order. New purchases
 * from `savePurchaseInternal` are created with both sentinels set.
 * Complete this base backfill before running
 * `collapseDuplicatePurchasesByOrderId`; the cleanup fails fast when a
 * duplicate sibling has not claimed its base contribution.
 *
 * Run ONCE per dataset. Concurrent writes during the migration window
 * are safe because: (a) new inserts are already marked counted, and
 * (b) rows already processed by the cursor won't be revisited.
 *
 * NOTE: supersedes the deprecated project-level backfill below, which
 * iterated every receipt for a project inside a single mutation.
 */
export const backfillPurchaseStatsFromPurchases = migrations.define({
  table: "purchases",
  batchSize: 1,
  migrateOne: async (ctx, doc) => {
    if (doc.statsCounted === true && doc.storeStatsCounted === true) return;

    // Prefer the stored `orderId` column, but fall back to extracting
    // from `remoteResponse` so the stats backfill can run before OR
    // after `backfillPurchaseOrderIds` without losing googleOrders
    // signal on rows whose column hasn't been populated yet.
    const hasOrderId =
      typeof doc.orderId === "string" && doc.orderId.length > 0
        ? true
        : extractOrderIdFromRemoteResponse(
            doc.store,
            doc.remoteResponse,
            doc.requestData.store === "google"
              ? doc.requestData.expectedProductId
              : undefined,
          ) !== null;

    await applyPurchaseStatsDelta(
      ctx,
      doc.projectId,
      deltaForMissingPurchaseStats(
        doc.store,
        doc.isValid ?? false,
        hasOrderId,
        doc.statsCounted === true,
        doc.storeStatsCounted === true,
      ),
    );

    return { statsCounted: true, storeStatsCounted: true };
  },
});

/**
 * @deprecated Use `backfillPurchaseStatsFromPurchases` instead. Kept
 * around only so the migration runner doesn't re-run already-completed
 * deployments under a new name; do not invoke on new installs.
 * Retained exported so the function map stays stable for any Convex
 * dashboard that already references it.
 */
export const backfillPurchaseStats = migrations.define({
  table: "projects",
  migrateOne: async (ctx, project) => {
    await recomputePurchaseStatsForProject(ctx, project._id);
  },
});

/**
 * Migration: Recompute every project's `purchaseStats` row from scratch.
 *
 * Run this as the FINAL step of the deploy sequence. Complete
 * `backfillPurchaseStatsFromPurchases` before
 * `collapseDuplicatePurchasesByOrderId`; the independent
 * `backfillPurchaseStatsStoreBuckets` migration may run before or after that
 * cleanup. Finish all of them (and `backfillPurchaseOrderIds`, when needed)
 * before this recompute.
 * The per-row `backfillPurchaseStatsFromPurchases` path can slightly
 * over-count `googleOrders` while duplicate-orderId rows still exist;
 * running this mutation last rebuilds `googleOrders` as the true
 * distinct-orderId count and re-aligns the total, per-store, valid, and
 * invalid counters against whatever the `purchases` table actually contains
 * after the collapse.
 *
 * Runs in a single mutation per project. For every project in the
 * current dataset this fits inside Convex's per-transaction read
 * budget (largest project is in the low thousands of rows). If any
 * single project grows past the limit (~hundreds of thousands of
 * receipts), switch to a paginated action that accumulates counts
 * across calls before writing the `purchaseStats` row once — the
 * pagination pattern used by `collapseDuplicatePurchasesByOrderId` is
 * a good template. This migration will fail fast (read-bytes limit
 * error) rather than produce a bad stats row, so the failure mode is
 * safe.
 *
 * Do not run this before the two row migrations above: a full recompute does
 * not mark per-purchase sentinels, so a later row migration would replay the
 * same contribution. Run it last whenever a non-dry duplicate cleanup
 * deletes rows; otherwise it remains an optional final drift-correction step.
 */
export const recomputeAllPurchaseStats = migrations.define({
  table: "projects",
  migrateOne: async (ctx, project) => {
    await recomputePurchaseStatsForProject(ctx, project._id);
  },
});

/**
 * Migration: Populate the Horizon and Amazon purchase-stat buckets.
 *
 * This intentionally has a new migration identity. Deployments that already
 * completed `recomputeAllPurchaseStats` will not rerun that migration after
 * its implementation changes, and their legacy `purchaseStats` rows predate
 * the store-specific counters.
 *
 * Each mutation handles one purchase row. `storeStatsCounted` is written in
 * the same transaction as the Horizon/Amazon delta, so an interrupted or reset
 * run cannot double count a repaired row. New purchases are born marked after
 * updating the widened stats row and are therefore skipped safely while this
 * migration is in flight.
 */
export const backfillPurchaseStatsStoreBuckets = migrations.define({
  table: "purchases",
  batchSize: 1,
  migrateOne: async (ctx, purchase) => {
    if (purchase.storeStatsCounted === true) return;

    await applyPurchaseStatsDelta(
      ctx,
      purchase.projectId,
      deltaForMissingPurchaseStats(
        purchase.store,
        purchase.isValid ?? false,
        false,
        true,
        false,
      ),
    );

    return { storeStatsCounted: true };
  },
});

/**
 * Migration: Backfill the `productId` column on existing purchases.
 *
 * `productId` is now extracted on write so the list query doesn't have
 * to JSON.parse every receipt's `remoteResponse` per page. This
 * populates the column for rows that pre-date that change.
 */
export const backfillPurchaseProductIds = migrations.define({
  table: "purchases",
  migrateOne: async (_ctx, doc) => {
    if (typeof doc.productId === "string") {
      return doc;
    }

    const productId = extractProductIdFromRemoteResponse(
      doc.store,
      doc.remoteResponse,
      doc.requestData.store === "google"
        ? doc.requestData.expectedProductId
        : undefined,
    );

    if (productId === null) {
      return doc;
    }

    return { ...doc, productId };
  },
});

/**
 * Migration: Backfill the `orderId` column on existing Google purchases.
 *
 * `orderId` is Google's stable per-transaction identifier. We now
 * extract it on write and use it as the secondary dedup key in
 * `savePurchaseInternal`, which prevents the token-reissue inflation
 * Adam reported on Black Dust going forward. This migration populates
 * the column for rows that pre-date that change so the
 * `by_project_app_orderId` index can serve them too.
 *
 * Safe to run repeatedly: rows that already have `orderId` set are
 * skipped, and rows whose `remoteResponse` doesn't surface an orderId
 * (pending-acknowledgement, errors) stay untouched.
 *
 * NOTE: does NOT collapse duplicate rows — that's a separate,
 * destructive step deliberately kept out of the migration runner. See
 * `collapseDuplicatePurchasesByOrderId` in
 * [convex/purchases/cleanup.ts](convex/purchases/cleanup.ts) and the
 * deploy sequence in PR #10 (https://github.com/hyodotdev/openiap/pull/10) for the recommended order of operations.
 */
export const backfillPurchaseOrderIds = migrations.define({
  table: "purchases",
  migrateOne: async (_ctx, doc) => {
    // Only treat a NON-EMPTY string as "already backfilled". Empty
    // strings shouldn't exist in practice (the extractor rejects them
    // on the way in), but if one ever slipped through a manual write
    // we should still re-extract from `remoteResponse` rather than
    // preserving the broken value forever.
    if (typeof doc.orderId === "string" && doc.orderId.length > 0) {
      return doc;
    }

    const orderId = extractOrderIdFromRemoteResponse(
      doc.store,
      doc.remoteResponse,
      doc.requestData.store === "google"
        ? doc.requestData.expectedProductId
        : undefined,
    );

    if (orderId === null) {
      return doc;
    }

    return { ...doc, orderId };
  },
});

/**
 * Migration: Backfill `organizationId` on existing `purchaseStats` rows.
 *
 * The denormalized `organizationId` lets `getOrganizationReceiptStats`
 * query by org directly instead of walking every `projects` row (which
 * could carry large Horizon/iOS credential fields and trip Convex's
 * read-bytes limit on orgs with many projects).
 */
export const backfillPurchaseStatsOrganizationId = migrations.define({
  table: "purchaseStats",
  migrateOne: async (ctx, doc) => {
    if (doc.organizationId) {
      return doc;
    }
    const project = await ctx.db.get(doc.projectId);
    if (!project) {
      return doc;
    }
    return { ...doc, organizationId: project.organizationId };
  },
});

/**
 * Classify pre-scope API keys as publishable.
 *
 * Those credentials were explicitly documented for embedding in app builds,
 * so migration must fail closed: operators create a new secret key for MCP,
 * analytics, catalog writes, and store sync.
 */
export const classifyLegacyApiKeysAsPublishable = migrations.define({
  table: "apiKeys",
  migrateOne: async (_ctx, doc) => {
    return doc.keyType ? doc : { ...doc, keyType: "publishable" as const };
  },
});

/**
 * Permanently disable projects.apiKey fallback for projects that already have
 * scoped-key rows. Request-time authorization also checks for those rows while
 * this migration is rolling out.
 */
export const disableLegacyApiKeyFallbackForScopedProjects = migrations.define({
  table: "projects",
  migrateOne: async (ctx, doc) => {
    if (doc.legacyApiKeyFallbackDisabledAt !== undefined) {
      return doc;
    }
    const scopedKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_project", (q) => q.eq("projectId", doc._id))
      .first();
    return scopedKey
      ? { ...doc, legacyApiKeyFallbackDisabledAt: Date.now() }
      : doc;
  },
});

export const run = migrations.runner();
