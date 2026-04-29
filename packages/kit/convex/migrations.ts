import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api.js";
import { DataModel } from "./_generated/dataModel.js";
import {
  extractOrderIdFromRemoteResponse,
  extractProductIdFromRemoteResponse,
  isValidState,
} from "./purchases/shared.js";
import { HarmonizedPurchaseState } from "./purchases/purchaseState.js";
import {
  applyPurchaseStatsDelta,
  deltaForInsert,
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
    const isValid = isValidState(doc.state as HarmonizedPurchaseState);

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
 * budget. `statsCounted` on the purchase doc acts as a per-row sentinel
 * so the migration is safe to resume after partial runs; new purchases
 * from `savePurchaseInternal` are created with `statsCounted: true` so
 * they're skipped here.
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
  migrateOne: async (ctx, doc) => {
    if (doc.statsCounted === true) {
      return doc;
    }

    // Prefer the stored `orderId` column, but fall back to extracting
    // from `remoteResponse` so the stats backfill can run before OR
    // after `backfillPurchaseOrderIds` without losing googleOrders
    // signal on rows whose column hasn't been populated yet.
    const hasOrderId =
      typeof doc.orderId === "string" && doc.orderId.length > 0
        ? true
        : extractOrderIdFromRemoteResponse(doc.store, doc.remoteResponse) !==
          null;

    await applyPurchaseStatsDelta(
      ctx,
      doc.projectId,
      deltaForInsert(doc.store, doc.isValid ?? false, hasOrderId),
    );

    return { ...doc, statsCounted: true };
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
 * Run this as the FINAL step of the deploy sequence, after both
 * `backfillPurchaseOrderIds` and `collapseDuplicatePurchasesByOrderId`.
 * The per-row `backfillPurchaseStatsFromPurchases` path can slightly
 * over-count `googleOrders` while duplicate-orderId rows still exist;
 * running this mutation last rebuilds `googleOrders` as the true
 * distinct-orderId count and re-aligns `total` / `apple` / `google` /
 * `valid` / `invalid` against whatever the `purchases` table actually
 * contains after the collapse.
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
 */
export const recomputeAllPurchaseStats = migrations.define({
  table: "projects",
  migrateOne: async (ctx, project) => {
    await recomputePurchaseStatsForProject(ctx, project._id);
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
 * deploy sequence in PR #10 for the recommended order of operations.
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

export const run = migrations.runner();
