import { v } from "convex/values";

import { internalMutation, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { applyPurchaseStatsDelta, type PurchaseStatsDelta } from "./stats";

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
 * Implementation of `collapseDuplicatePurchasesByOrderId`.
 *
 * Lifted out of the `internalMutation` wrapper so the unit tests
 * under `cleanup.test.ts` can drive it with a narrow in-memory
 * `ctx.db` stand-in without reaching into Convex's registered
 * mutation internals.
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

  // Step 1: gather every unique eligible group represented in the
  // page. We key by the composite group id so multiple page rows
  // from the same group collapse to a single entry here — that's
  // what prevents the "one index query per eligible row" shape.
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
  // Accumulate per-project deltas so the `purchaseStats` row for
  // each project is read + patched once per call, regardless of
  // how many rows we deleted from that project in this batch.
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

    // Defensive filter: the `by_project_app_orderId` index doesn't
    // know about `store`, so in principle a manually-written or
    // future non-Google row with an `orderId` set could share a
    // group key with Google siblings. Collapsing an Apple / Horizon
    // row (or, worse, picking one as the "newest" survivor of a
    // Google group) would silently corrupt counters and drop real
    // receipts. Narrow the candidate set to Google rows with a
    // non-empty orderId BEFORE picking the survivor, and only emit
    // stats deltas for the rows we actually delete.
    const siblings = indexHits.filter(
      (r) =>
        r.store === "google" &&
        typeof r.orderId === "string" &&
        r.orderId.length > 0,
    );

    if (siblings.length <= 1) {
      continue;
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
      projectDeltas.set(sibling.projectId, {
        total: (existing.total ?? 0) - 1,
        google: (existing.google ?? 0) - 1,
        // googleOrders intentionally untouched — see header comment.
        valid: (existing.valid ?? 0) + (isValid ? -1 : 0),
        invalid: (existing.invalid ?? 0) + (isValid ? 0 : -1),
      });
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
 * Collapse duplicate purchase rows that share a Google Play `orderId`.
 *
 * Context: before the orderId-based secondary dedup landed, Google's
 * practice of reissuing `purchaseToken` for the same logical order
 * could produce multiple rows for one transaction — the inflation
 * shape Adam reported on Black Dust. The `savePurchaseInternal` fix
 * prevents new rows of that shape; this mutation cleans up rows that
 * predate the fix.
 *
 * Behavior for each `(projectId, applicationId, orderId)` group with
 * N > 1 rows:
 *   - keep the row with the greatest `_creationTime` (newest)
 *   - delete the older rows
 *   - accumulate a `purchaseStats` delta per project that decrements
 *     `total`, the store bucket, and `valid` / `invalid` per deleted
 *     row. We DO NOT decrement `googleOrders` — that counter
 *     represents the count of distinct Google orderIds, which is
 *     unchanged by removing a duplicate (the surviving sibling still
 *     carries the same orderId). The recommended deploy order
 *     therefore puts `recomputeAllPurchaseStats` AFTER this mutation
 *     so any residual drift from the per-row backfill is corrected
 *     last.
 *
 * Rows with no `orderId` are NEVER touched — they can't be safely
 * correlated to any logical order and include legitimate
 * pending-acknowledgement rows.
 *
 * Pagination: processes up to `batchSize` rows per call (default
 * 200). Returns a `cursor` that the caller threads through until
 * `isDone`. Within each page we:
 *   1. Bucket eligible rows by `(projectId, applicationId, orderId)`
 *      so we issue AT MOST one sibling lookup per unique group in the
 *      page — the group's full membership (including cross-page
 *      siblings) is resolved in that single index query.
 *   2. Delete every non-newest sibling in a group with N > 1 rows.
 *   3. Accumulate per-project stats deltas and apply them ONCE per
 *      project at the end of the call, instead of issuing a separate
 *      `purchaseStats` read/patch for every deleted row.
 *
 * `dryRun: true` reports the would-be deletions without touching data.
 * Use it to confirm scope before flipping the switch.
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
