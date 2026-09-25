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
import { hashStoredSecretApiKeyPatch } from "./apiKeys/helpers.js";

export const migrations = new Migrations<DataModel>(components.migrations);

/**
 * Migration: move the old free/starter/growth/scale tiers to developer.
 * Enterprise is unchanged.
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
 * Migration: replace the deprecated `isAuthentic` with `isValid`, computed
 * from `state` by isValidState().
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
 * Migration: backfill `purchaseStats` from `purchases`, one purchase and one
 * stats upsert per mutation, so a large project never exceeds the
 * per-transaction read/write budget.
 *
 * The `statsCounted` and `storeStatsCounted` sentinels make it resumable and
 * let it run before or after `backfillPurchaseStatsStoreBuckets`. Writes
 * during the run are safe: `savePurchaseInternal` creates purchases with both
 * sentinels set, and processed rows are not revisited.
 *
 * Run once per dataset, and finish it before
 * `collapseDuplicatePurchasesByOrderId`, which fails fast on a duplicate
 * sibling that has not claimed its base contribution. Replaces the deprecated
 * `backfillPurchaseStats` below, which read every receipt of a project in one
 * mutation.
 */
export const backfillPurchaseStatsFromPurchases = migrations.define({
  table: "purchases",
  batchSize: 1,
  migrateOne: async (ctx, doc) => {
    if (doc.statsCounted === true && doc.storeStatsCounted === true) return;

    // Fall back to `remoteResponse` so this can run before or after
    // `backfillPurchaseOrderIds` and still count googleOrders.
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
 * @deprecated Use `backfillPurchaseStatsFromPurchases`; do not run it on new
 * installs. Kept so the migration runner does not re-run completed
 * deployments under a new name, and exported so its function path stays
 * stable for Convex dashboards that reference it.
 */
export const backfillPurchaseStats = migrations.define({
  table: "projects",
  migrateOne: async (ctx, project) => {
    await recomputePurchaseStatsForProject(ctx, project._id);
  },
});

/**
 * Migration: recompute every project's `purchaseStats` row from scratch.
 *
 * Run it last. `backfillPurchaseStatsFromPurchases` must finish before
 * `collapseDuplicatePurchasesByOrderId`; `backfillPurchaseStatsStoreBuckets`
 * may run on either side of that cleanup. Finish all of them, and
 * `backfillPurchaseOrderIds` when needed, before this: a recompute does not
 * set the per-purchase sentinels, so a later row migration would count the
 * same purchase again.
 *
 * Required after a non-dry duplicate cleanup deletes rows, otherwise an
 * optional drift correction. The per-row backfill can over-count
 * `googleOrders` while duplicate-orderId rows exist; this rebuilds it as the
 * distinct-orderId count and realigns the total, per-store, valid, and
 * invalid counters with the `purchases` table.
 *
 * One mutation per project fits today's data (largest project: low thousands
 * of rows). A project past the read limit (~hundreds of thousands of
 * receipts) fails fast with a read-bytes error instead of writing a bad row;
 * then switch to a paginated action that accumulates counts and writes the
 * row once (`collapseDuplicatePurchasesByOrderId` shows the pagination).
 */
export const recomputeAllPurchaseStats = migrations.define({
  table: "projects",
  migrateOne: async (ctx, project) => {
    await recomputePurchaseStatsForProject(ctx, project._id);
  },
});

/**
 * Migration: populate the Horizon and Amazon purchase-stat buckets.
 *
 * A separate migration on purpose: the runner does not rerun a completed
 * `recomputeAllPurchaseStats` after its code changes, and older
 * `purchaseStats` rows predate the store-specific counters.
 *
 * One purchase per mutation, with `storeStatsCounted` set in the same
 * transaction as the Horizon/Amazon delta, so an interrupted or reset run
 * cannot double count. New purchases update the widened stats row and are
 * born marked, so this skips them.
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
 * Migration: backfill the `productId` column on older purchases, so the list
 * query need not JSON.parse each receipt's `remoteResponse`. New rows get it
 * on write.
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
 * Migration: backfill the `orderId` column on older Google purchases so the
 * `by_project_app_orderId` index covers them.
 *
 * `orderId` is Google's stable per-transaction id. `savePurchaseInternal`
 * extracts it on write and uses it as the secondary dedup key, which
 * prevents token-reissue inflation.
 *
 * Safe to rerun: rows with an `orderId` are skipped, and rows whose
 * `remoteResponse` has none (pending acknowledgement, errors) stay untouched.
 *
 * It does not collapse duplicate rows; that destructive step is kept out of
 * the migration runner on purpose. See `collapseDuplicatePurchasesByOrderId`
 * in convex/purchases/cleanup.ts, and `recomputeAllPurchaseStats` above for
 * the order of operations.
 */
export const backfillPurchaseOrderIds = migrations.define({
  table: "purchases",
  migrateOne: async (_ctx, doc) => {
    // Re-extract over an empty string too: the extractor never writes one,
    // but a manual write could.
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
 * Migration: backfill `organizationId` on existing `purchaseStats` rows.
 *
 * It lets `getOrganizationReceiptStats` query by org instead of reading every
 * `projects` row, whose large Horizon/iOS credential fields can trip Convex's
 * read-bytes limit on orgs with many projects.
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
 * Replace stored secret API keys with a digest and one-way display preview.
 * Deploy the dual-read lookup before running this migration.
 */
export const hashStoredSecretApiKeys = migrations.define({
  table: "apiKeys",
  // A null patch means "no work"; returning undefined makes the component
  // skip the write instead of patching the row back onto itself.
  migrateOne: async (_ctx, doc) =>
    (await hashStoredSecretApiKeyPatch(doc)) ?? undefined,
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
