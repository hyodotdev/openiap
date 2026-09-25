import { v } from "convex/values";

import { internalMutation, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import {
  applyPurchaseStatsDelta,
  deltaForCountedPurchaseRemoval,
  mergePurchaseStatsDeltas,
  type PurchaseStatsDelta,
} from "./stats";

export type CollapseDuplicateArgs = {
  cursor?: string | null;
  batchSize?: number;
  dryRun?: boolean;
};

export type CollapseDuplicateResult = {
  scanned: number;
  duplicateGroupsProcessed: number;
  rowsDeleted: number;
  cursor: string | null;
  isDone: boolean;
  dryRun: boolean;
};

/**
 * Handler of `collapseDuplicatePurchasesByOrderId`, exported so tests can pass
 * an in-memory `ctx.db`.
 */
export async function collapseDuplicatePurchasesByOrderIdHandler(
  ctx: MutationCtx,
  args: CollapseDuplicateArgs,
): Promise<CollapseDuplicateResult> {
  const dryRun = args.dryRun ?? false;
  const batchSize = args.batchSize ?? 200;

  const page = await ctx.db
    .query("purchases")
    .paginate({ cursor: args.cursor ?? null, numItems: batchSize });

  // One entry per group in the page, so each group costs one index query.
  type GroupKey = {
    projectId: Id<"projects">;
    applicationId: string;
    orderId: string;
  };
  const pageGroups = new Map<string, GroupKey>();
  for (const row of page.page) {
    if (!row.orderId || row.store !== "google") {
      continue;
    }
    const key = `${row.projectId}\x00${row.applicationId}\x00${row.orderId}`;
    if (!pageGroups.has(key)) {
      pageGroups.set(key, {
        projectId: row.projectId,
        applicationId: row.applicationId,
        orderId: row.orderId,
      });
    }
  }

  let duplicateGroupsProcessed = 0;
  let rowsDeleted = 0;
  // One purchaseStats read and patch per project per call.
  const projectDeltas = new Map<Id<"projects">, PurchaseStatsDelta>();

  for (const { projectId, applicationId, orderId } of pageGroups.values()) {
    const indexHits = await ctx.db
      .query("purchases")
      .withIndex("by_project_app_orderId", (q) =>
        q
          .eq("projectId", projectId)
          .eq("applicationId", applicationId)
          .eq("orderId", orderId),
      )
      .collect();

    // The index ignores `store`, so a non-Google row with an orderId could join
    // a group. Keep only Google rows with an orderId before picking the
    // survivor, or real receipts could be deleted.
    const siblings = indexHits.filter(
      (r) =>
        r.store === "google" &&
        typeof r.orderId === "string" &&
        r.orderId.length > 0,
    );

    if (siblings.length <= 1) {
      continue;
    }

    if (siblings.some((sibling) => sibling.statsCounted !== true)) {
      throw new Error(
        "Complete migrations:backfillPurchaseStatsFromPurchases before running purchases/cleanup:collapseDuplicatePurchasesByOrderId.",
      );
    }

    duplicateGroupsProcessed += 1;

    const newest = siblings.reduce((acc, candidate) =>
      candidate._creationTime > acc._creationTime ? candidate : acc,
    );

    for (const sibling of siblings) {
      if (sibling._id === newest._id) {
        continue;
      }
      rowsDeleted += 1;

      if (dryRun) {
        continue;
      }

      await ctx.db.delete(sibling._id);

      const isValid = sibling.isValid ?? false;
      const existing = projectDeltas.get(sibling.projectId) ?? {};
      projectDeltas.set(
        sibling.projectId,
        mergePurchaseStatsDeltas(
          existing,
          deltaForCountedPurchaseRemoval(
            sibling.store,
            isValid,
            // The surviving sibling still owns this logical order, so deleting
            // a duplicate row must not decrement `googleOrders`.
            false,
            sibling.statsCounted === true,
            sibling.storeStatsCounted === true,
          ),
        ),
      );
    }
  }

  if (!dryRun) {
    for (const [projectId, delta] of projectDeltas) {
      await applyPurchaseStatsDelta(ctx, projectId, delta);
    }
  }

  return {
    scanned: page.page.length,
    duplicateGroupsProcessed,
    rowsDeleted,
    cursor: page.continueCursor,
    isDone: page.isDone,
    dryRun,
  };
}

/**
 * Collapses purchase rows that share a Google Play `orderId`, left from before
 * the orderId dedup, when Google reissued `purchaseToken` for one order.
 *
 * Per `(projectId, applicationId, orderId)` group with more than one row: keep
 * the newest, delete the rest, and decrement the row counters per deleted row,
 * but not `googleOrders` (the survivor keeps the orderId). Fails before
 * deleting if a sibling has not been through
 * `backfillPurchaseStatsFromPurchases`; Convex then rolls back the whole call.
 * Rows without an `orderId`, including pending acknowledgements, are never
 * touched.
 *
 * Migration order: finish `backfillPurchaseStatsFromPurchases`, run this, then
 * `recomputeAllPurchaseStats` whenever a non-dry run deleted rows.
 * `backfillPurchaseStatsStoreBuckets` may run before or after this, but must
 * finish before that recompute.
 *
 * Pages of `batchSize` rows (default 200); thread `cursor` until `isDone`.
 * Each group costs one sibling lookup and each project one stats write.
 * `dryRun: true` reports the deletions without writing.
 */
export const collapseDuplicatePurchasesByOrderId = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    scanned: v.number(),
    duplicateGroupsProcessed: v.number(),
    rowsDeleted: v.number(),
    cursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
    dryRun: v.boolean(),
  }),
  handler: async (ctx, args) =>
    collapseDuplicatePurchasesByOrderIdHandler(ctx, args),
});
