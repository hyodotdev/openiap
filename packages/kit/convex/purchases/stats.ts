import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Infer } from "convex/values";
import type { purchaseStoreValidator } from "../schema";

type PurchaseStore = Infer<typeof purchaseStoreValidator>;

export type PurchaseStats = {
  total: number;
  apple: number;
  google: number;
  /**
   * Count of distinct Google `orderId`s across this project's purchase
   * rows. On post-fix data this equals the number of `google` rows that
   * carry an `orderId`, because `savePurchaseInternal`'s secondary
   * dedup guarantees one row per orderId. Pre-fix / pre-backfill rows
   * without an orderId stored don't contribute — they inflate `google`
   * but not `googleOrders`.
   */
  googleOrders: number;
  valid: number;
  invalid: number;
};

const ZERO_STATS: PurchaseStats = {
  total: 0,
  apple: 0,
  google: 0,
  googleOrders: 0,
  valid: 0,
  invalid: 0,
};

export async function readPurchaseStats(
  ctx: QueryCtx,
  projectId: Id<"projects">,
): Promise<PurchaseStats> {
  const row = await ctx.db
    .query("purchaseStats")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .first();

  if (!row) {
    return { ...ZERO_STATS };
  }

  return {
    total: row.total,
    apple: row.apple,
    google: row.google,
    googleOrders: row.googleOrders ?? 0,
    valid: row.valid,
    invalid: row.invalid,
  };
}

export type PurchaseStatsDelta = Partial<PurchaseStats>;

/**
 * Result of applying a stats delta. `wasFirstValidTransition` lets
 * callers detect the "project just booked its first valid receipt"
 * activation moment without re-reading the stats row on the hot
 * path — they pass their intended delta in and get the transition
 * bool back from the same read/write cycle.
 */
export type ApplyPurchaseStatsDeltaResult = {
  wasFirstValidTransition: boolean;
};

/**
 * Apply an incremental delta to a project's maintained purchase counters.
 * Creates the row on first write. All counters are clamped at >= 0 so a
 * bug elsewhere can't push a counter negative.
 */
export async function applyPurchaseStatsDelta(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  delta: PurchaseStatsDelta,
): Promise<ApplyPurchaseStatsDeltaResult> {
  if (
    !delta.total &&
    !delta.apple &&
    !delta.google &&
    !delta.googleOrders &&
    !delta.valid &&
    !delta.invalid
  ) {
    return { wasFirstValidTransition: false };
  }

  const row = await ctx.db
    .query("purchaseStats")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .first();

  const now = Date.now();
  const previousValid = row?.valid ?? 0;
  const nextValid = Math.max(previousValid + (delta.valid ?? 0), 0);
  const wasFirstValidTransition = previousValid === 0 && nextValid > 0;

  if (!row) {
    const project = await ctx.db.get(projectId);
    await ctx.db.insert("purchaseStats", {
      projectId,
      organizationId: project?.organizationId,
      total: Math.max(delta.total ?? 0, 0),
      apple: Math.max(delta.apple ?? 0, 0),
      google: Math.max(delta.google ?? 0, 0),
      googleOrders: Math.max(delta.googleOrders ?? 0, 0),
      valid: nextValid,
      invalid: Math.max(delta.invalid ?? 0, 0),
      updatedAt: now,
    });
    return { wasFirstValidTransition };
  }

  // Backfill organizationId on first patch if the existing row predates
  // the denormalization. Cheap and idempotent.
  const needsOrgIdBackfill = row.organizationId === undefined;
  const backfillPatch: { organizationId?: Id<"organizations"> } = {};
  if (needsOrgIdBackfill) {
    const project = await ctx.db.get(projectId);
    if (project) {
      backfillPatch.organizationId = project.organizationId;
    }
  }

  await ctx.db.patch(row._id, {
    ...backfillPatch,
    total: Math.max(row.total + (delta.total ?? 0), 0),
    apple: Math.max(row.apple + (delta.apple ?? 0), 0),
    google: Math.max(row.google + (delta.google ?? 0), 0),
    googleOrders: Math.max(
      (row.googleOrders ?? 0) + (delta.googleOrders ?? 0),
      0,
    ),
    valid: nextValid,
    invalid: Math.max(row.invalid + (delta.invalid ?? 0), 0),
    updatedAt: now,
  });

  return { wasFirstValidTransition };
}

/**
 * Delta for inserting a new purchase row.
 *
 * `hasOrderId` drives the `googleOrders` counter separately from
 * `google`: a Google row without an `orderId` (pending-acknowledgement,
 * error body) still counts toward total / google / valid / invalid —
 * nothing about the existing call-count semantics changes — but it
 * doesn't increment `googleOrders`, because it doesn't represent a
 * logical Play Console order yet. Apple and Horizon always contribute
 * to their respective counters; they don't have an orderId concept.
 */
export function deltaForInsert(
  store: PurchaseStore,
  isValid: boolean,
  hasOrderId: boolean = false,
): PurchaseStatsDelta {
  return {
    total: 1,
    apple: store === "apple" ? 1 : 0,
    google: store === "google" ? 1 : 0,
    googleOrders: store === "google" && hasOrderId ? 1 : 0,
    valid: isValid ? 1 : 0,
    invalid: isValid ? 0 : 1,
  };
}

/**
 * Delta for updating an existing purchase row.
 *
 * Emits diffs for `store`, `isValid`, and the Google-orderId presence
 * transition. The last one lets a pending-acknowledgement row gain an
 * `orderId` on a later re-verify and bump `googleOrders` at that
 * point (and symmetrically back down if an orderId were ever cleared,
 * which shouldn't happen in practice but is guarded for correctness).
 */
export function deltaForUpdate(
  prevStore: PurchaseStore,
  prevIsValid: boolean,
  nextStore: PurchaseStore,
  nextIsValid: boolean,
  prevHasOrderId: boolean = false,
  nextHasOrderId: boolean = false,
): PurchaseStatsDelta {
  const delta: PurchaseStatsDelta = {};

  if (prevStore !== nextStore) {
    if (prevStore === "apple") delta.apple = (delta.apple ?? 0) - 1;
    if (prevStore === "google") delta.google = (delta.google ?? 0) - 1;
    if (nextStore === "apple") delta.apple = (delta.apple ?? 0) + 1;
    if (nextStore === "google") delta.google = (delta.google ?? 0) + 1;
  }

  if (prevIsValid !== nextIsValid) {
    delta.valid = (delta.valid ?? 0) + (nextIsValid ? 1 : -1);
    delta.invalid = (delta.invalid ?? 0) + (nextIsValid ? -1 : 1);
  }

  const prevCountedForOrders = prevStore === "google" && prevHasOrderId;
  const nextCountedForOrders = nextStore === "google" && nextHasOrderId;
  if (prevCountedForOrders !== nextCountedForOrders) {
    delta.googleOrders =
      (delta.googleOrders ?? 0) + (nextCountedForOrders ? 1 : -1);
  }

  return delta;
}

/**
 * Delete the stats row for a project (used by the project-delete cascade).
 */
export async function deletePurchaseStatsForProject(
  ctx: MutationCtx,
  projectId: Id<"projects">,
): Promise<void> {
  const row = await ctx.db
    .query("purchaseStats")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .first();
  if (row) {
    await ctx.db.delete(row._id);
  }
}

/**
 * Recompute the stats row for a project from scratch by scanning the
 * `by_project` index. Used by the backfill migration; not called from the
 * hot path. O(N) in receipts-per-project, but bounded per project.
 *
 * `googleOrders` is computed as the count of DISTINCT `orderId` values
 * across this project's google rows — so even if the table still
 * carries duplicate-orderId rows (collapse migration not yet run), the
 * counter reflects true logical orders and matches what the user sees
 * in Play Console.
 */
export async function recomputePurchaseStatsForProject(
  ctx: MutationCtx,
  projectId: Id<"projects">,
): Promise<PurchaseStats> {
  const totals: PurchaseStats = { ...ZERO_STATS };
  const distinctGoogleOrders = new Set<string>();

  for await (const purchase of ctx.db
    .query("purchases")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))) {
    totals.total += 1;
    if (purchase.store === "apple") totals.apple += 1;
    else if (purchase.store === "google") {
      totals.google += 1;
      if (purchase.orderId) {
        distinctGoogleOrders.add(purchase.orderId);
      }
    }
    if (purchase.isValid) totals.valid += 1;
    else totals.invalid += 1;
  }

  totals.googleOrders = distinctGoogleOrders.size;

  const existing = await ctx.db
    .query("purchaseStats")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .first();

  const now = Date.now();
  const project = await ctx.db.get(projectId);
  const organizationId = project?.organizationId;

  if (existing) {
    await ctx.db.patch(existing._id, {
      ...totals,
      ...(organizationId ? { organizationId } : {}),
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("purchaseStats", {
      projectId,
      organizationId,
      ...totals,
      updatedAt: now,
    });
  }

  return totals;
}
