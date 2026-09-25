import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Infer } from "convex/values";
import type { purchaseStoreValidator } from "../schema";
import { getWritableProject } from "../projects/writable";

type PurchaseStore = Infer<typeof purchaseStoreValidator>;

export type PurchaseStats = {
  total: number;
  apple: number;
  google: number;
  horizon: number;
  amazon: number;
  /**
   * Distinct Google `orderId`s. savePurchaseInternal's secondary dedup keeps
   * one row per orderId; rows without one count in `google` only.
   */
  googleOrders: number;
  valid: number;
  invalid: number;
};

const ZERO_STATS: PurchaseStats = {
  total: 0,
  apple: 0,
  google: 0,
  horizon: 0,
  amazon: 0,
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
    horizon: row.horizon ?? 0,
    amazon: row.amazon ?? 0,
    googleOrders: row.googleOrders ?? 0,
    valid: row.valid,
    invalid: row.invalid,
  };
}

export type PurchaseStatsDelta = Partial<PurchaseStats>;

const PURCHASE_STATS_KEYS: (keyof PurchaseStatsDelta)[] = [
  "total",
  "apple",
  "google",
  "horizon",
  "amazon",
  "googleOrders",
  "valid",
  "invalid",
];

/** Merge several counter transitions while dropping zero-value fields. */
export function mergePurchaseStatsDeltas(
  ...deltas: PurchaseStatsDelta[]
): PurchaseStatsDelta {
  const merged: PurchaseStatsDelta = {};
  for (const key of PURCHASE_STATS_KEYS) {
    const value = deltas.reduce((sum, delta) => sum + (delta[key] ?? 0), 0);
    if (value !== 0) merged[key] = value;
  }
  return merged;
}

/**
 * `wasFirstValidTransition` flags the project's first valid receipt from the
 * same read/write, without a second read on the hot path.
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
  // Keep the guard at this lowest shared write layer: migrations, cleanup,
  // receipt verification, and public mutations all converge here. Returning a
  // no-op lets maintenance batches skip projects being deleted without
  // aborting unrelated work in the same batch.
  const project = await getWritableProject(ctx, projectId);
  if (!project) return { wasFirstValidTransition: false };

  if (
    !delta.total &&
    !delta.apple &&
    !delta.google &&
    !delta.horizon &&
    !delta.amazon &&
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
    await ctx.db.insert("purchaseStats", {
      projectId,
      organizationId: project.organizationId,
      total: Math.max(delta.total ?? 0, 0),
      apple: Math.max(delta.apple ?? 0, 0),
      google: Math.max(delta.google ?? 0, 0),
      horizon: Math.max(delta.horizon ?? 0, 0),
      amazon: Math.max(delta.amazon ?? 0, 0),
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
    backfillPatch.organizationId = project.organizationId;
  }

  await ctx.db.patch(row._id, {
    ...backfillPatch,
    total: Math.max(row.total + (delta.total ?? 0), 0),
    apple: Math.max(row.apple + (delta.apple ?? 0), 0),
    google: Math.max(row.google + (delta.google ?? 0), 0),
    horizon: Math.max((row.horizon ?? 0) + (delta.horizon ?? 0), 0),
    amazon: Math.max((row.amazon ?? 0) + (delta.amazon ?? 0), 0),
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
 * Delta for inserting a purchase row. A Google row without an `orderId`
 * (pending acknowledgement, error body) counts everywhere except
 * `googleOrders`: it is not a Play Console order yet.
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
    horizon: store === "horizon" ? 1 : 0,
    amazon: store === "amazon" ? 1 : 0,
    googleOrders: store === "google" && hasOrderId ? 1 : 0,
    valid: isValid ? 1 : 0,
    invalid: isValid ? 0 : 1,
  };
}

/**
 * Contributions still missing for one persisted purchase. `statsCounted` owns
 * the total/Apple/Google/order/validity buckets and `storeStatsCounted` the
 * later Horizon/Amazon ones, so either migration can run first without double
 * counting and a live update claims both atomically.
 */
export function deltaForMissingPurchaseStats(
  store: PurchaseStore,
  isValid: boolean,
  hasOrderId: boolean,
  statsCounted: boolean,
  storeStatsCounted: boolean,
): PurchaseStatsDelta {
  const delta: PurchaseStatsDelta = {};

  if (!statsCounted) {
    delta.total = 1;
    if (store === "apple") delta.apple = 1;
    if (store === "google") delta.google = 1;
    if (store === "google" && hasOrderId) delta.googleOrders = 1;
    if (isValid) delta.valid = 1;
    else delta.invalid = 1;
  }

  if (!storeStatsCounted) {
    if (store === "horizon") delta.horizon = 1;
    if (store === "amazon") delta.amazon = 1;
  }

  return delta;
}

/** Reverse only the contributions whose per-row sentinels were committed. */
export function deltaForCountedPurchaseRemoval(
  store: PurchaseStore,
  isValid: boolean,
  hasOrderId: boolean,
  statsCounted: boolean,
  storeStatsCounted: boolean,
): PurchaseStatsDelta {
  const delta: PurchaseStatsDelta = {};

  if (statsCounted) {
    delta.total = -1;
    if (store === "apple") delta.apple = -1;
    if (store === "google") delta.google = -1;
    if (store === "google" && hasOrderId) delta.googleOrders = -1;
    if (isValid) delta.valid = -1;
    else delta.invalid = -1;
  }

  if (storeStatsCounted) {
    if (store === "horizon") delta.horizon = -1;
    if (store === "amazon") delta.amazon = -1;
  }

  return delta;
}

/**
 * Delta for updating a purchase row: `store`, `isValid`, and orderId presence,
 * so a pending row that gains an orderId on re-verify bumps `googleOrders` (and
 * a cleared one, never expected, lowers it).
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
    if (prevStore === "horizon") delta.horizon = (delta.horizon ?? 0) - 1;
    if (prevStore === "amazon") delta.amazon = (delta.amazon ?? 0) - 1;
    if (nextStore === "apple") delta.apple = (delta.apple ?? 0) + 1;
    if (nextStore === "google") delta.google = (delta.google ?? 0) + 1;
    if (nextStore === "horizon") delta.horizon = (delta.horizon ?? 0) + 1;
    if (nextStore === "amazon") delta.amazon = (delta.amazon ?? 0) + 1;
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
 * Rebuilds a project's stats row by scanning `by_project`; for the backfill
 * migration, not the hot path. `googleOrders` counts distinct orderIds, so it
 * matches Play Console even before duplicate rows are collapsed.
 */
export async function recomputePurchaseStatsForProject(
  ctx: MutationCtx,
  projectId: Id<"projects">,
): Promise<PurchaseStats> {
  const project = await getWritableProject(ctx, projectId);
  if (!project) return { ...ZERO_STATS };

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
    } else if (purchase.store === "horizon") totals.horizon += 1;
    else if (purchase.store === "amazon") totals.amazon += 1;
    if (purchase.isValid) totals.valid += 1;
    else totals.invalid += 1;
  }

  totals.googleOrders = distinctGoogleOrders.size;

  const existing = await ctx.db
    .query("purchaseStats")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .first();

  const now = Date.now();
  const organizationId = project.organizationId;

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
