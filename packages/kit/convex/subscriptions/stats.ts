// Incremental subscription stats maintenance — keeps the
// `subscriptionStats` aggregation table in sync as subscriptions
// transition through state machine events. The dashboard's
// `metricsSummary` reads from this table so the headline counters
// stay accurate above the prior SUBS_SCAN_CAP=10,000 bound.

import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

import { monthlyMicrosForSub } from "./monthlyMicros";

// Counted state buckets. Other states (Expired / Revoked / Refunded /
// Paused / Unknown) don't contribute to the live counters — those are
// either historical archive (no MRR) or surfaced via the rolling
// 30-day window which `metricsSummary` queries directly off the
// `by_project_and_state` index.
const COUNTED_STATES = ["Active", "InGracePeriod", "InBillingRetry"] as const;
type CountedState = (typeof COUNTED_STATES)[number];

function isCountedState(state: string): state is CountedState {
  return (COUNTED_STATES as readonly string[]).includes(state);
}

type StatsContribution = {
  // Currency the row contributes under. `null` when the row is in a
  // counted state but has no priceAmountMicros/currency (e.g. fresh
  // sub before the first webhook surfaced pricing) — those bump the
  // state counter under the special "" currency bucket so we don't
  // lose them entirely.
  currency: string;
  state: CountedState | null;
  mrrMicros: number;
};

// Compute what a single subscription row contributes to the stats
// table. Returns null when the row is in a non-counted state — the
// caller should just skip applying any delta.
export function statsContributionFor(
  sub: Doc<"subscriptions">,
  billingPeriod: string | undefined,
  now: number = Date.now(),
): StatsContribution | null {
  if (!isCountedState(sub.state)) return null;
  // Active subs whose `expiresAt` has passed but webhook hasn't yet
  // marked them Expired don't contribute (matches the read-path
  // `isActive` semantics).
  if (
    sub.state === "Active" &&
    typeof sub.expiresAt === "number" &&
    sub.expiresAt <= now
  ) {
    return null;
  }
  const currency = sub.currency ?? "";
  const mrrMicros =
    sub.state === "Active" &&
    typeof sub.priceAmountMicros === "number" &&
    sub.currency
      ? monthlyMicrosForSub(sub, billingPeriod)
      : 0;
  // `isCountedState` already narrowed the union earlier, so sub.state
  // is provably one of "Active" | "InGracePeriod" | "InBillingRetry"
  // here.
  return { currency, state: sub.state, mrrMicros };
}

// Apply a (subscription, before, after) state-machine transition to
// the stats table. Both `before` and `after` are nullable: insert =
// `before == null`, delete = `after == null`. Pure DB writes — the
// caller is responsible for fetching the current docs.
//
// The function fetches the relevant `subscriptionStats` row(s) on
// demand. We accept the small extra read cost in exchange for not
// requiring callers to pre-fetch — the alternative (caller passes
// the stats row in) bleeds the aggregation invariant across every
// call site.
export async function applyStatsTransition(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  before: StatsContribution | null,
  after: StatsContribution | null,
): Promise<void> {
  // No-op when neither side counts.
  if (before === null && after === null) return;
  // No-op when contribution didn't change. Cheap early-out for the
  // common Active-renewal case where state + currency + MRR all stay
  // the same.
  if (
    before !== null &&
    after !== null &&
    before.currency === after.currency &&
    before.state === after.state &&
    before.mrrMicros === after.mrrMicros
  ) {
    return;
  }

  const now = Date.now();

  // Currency-cohort handling: if before/after differ in currency, we
  // touch two rows (decrement before, increment after). When they
  // match, one row is enough.
  if (before && after && before.currency === after.currency) {
    await touchStatsRow(ctx, projectId, before.currency, now, (row) => {
      const next = applyDelta(row, before, "subtract");
      return applyDelta(next, after, "add");
    });
    return;
  }

  if (before) {
    await touchStatsRow(ctx, projectId, before.currency, now, (row) =>
      applyDelta(row, before, "subtract"),
    );
  }
  if (after) {
    await touchStatsRow(ctx, projectId, after.currency, now, (row) =>
      applyDelta(row, after, "add"),
    );
  }
}

type StatsRowShape = Pick<
  Doc<"subscriptionStats">,
  "activeSubs" | "inGracePeriod" | "inBillingRetry" | "mrrMicros"
>;

function applyDelta(
  row: StatsRowShape,
  contribution: StatsContribution,
  op: "add" | "subtract",
): StatsRowShape {
  const sign = op === "add" ? 1 : -1;
  const next: StatsRowShape = {
    activeSubs: row.activeSubs,
    inGracePeriod: row.inGracePeriod,
    inBillingRetry: row.inBillingRetry,
    mrrMicros: row.mrrMicros,
  };
  switch (contribution.state) {
    case "Active":
      next.activeSubs += sign;
      next.mrrMicros += sign * contribution.mrrMicros;
      break;
    case "InGracePeriod":
      next.inGracePeriod += sign;
      break;
    case "InBillingRetry":
      next.inBillingRetry += sign;
      break;
    case null:
      // No counted state to apply to — caller shouldn't have called
      // us with this contribution, but guard anyway so the function
      // is total.
      break;
  }
  // Defensive clamp: stats rows must never go negative. A negative
  // count is a sign of a missed event somewhere upstream; clamping
  // to zero keeps the dashboard sensible while we surface the
  // underlying drift via the `recomputeSubscriptionStats` mutation.
  next.activeSubs = Math.max(0, next.activeSubs);
  next.inGracePeriod = Math.max(0, next.inGracePeriod);
  next.inBillingRetry = Math.max(0, next.inBillingRetry);
  if (next.mrrMicros < 0) next.mrrMicros = 0;
  return next;
}

async function touchStatsRow(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  currency: string,
  now: number,
  mutate: (row: StatsRowShape) => StatsRowShape,
): Promise<void> {
  const existing = await ctx.db
    .query("subscriptionStats")
    .withIndex("by_project_and_currency", (q) =>
      q.eq("projectId", projectId).eq("currency", currency),
    )
    .unique();
  const start: StatsRowShape = existing
    ? {
        activeSubs: existing.activeSubs,
        inGracePeriod: existing.inGracePeriod,
        inBillingRetry: existing.inBillingRetry,
        mrrMicros: existing.mrrMicros,
      }
    : {
        activeSubs: 0,
        inGracePeriod: 0,
        inBillingRetry: 0,
        mrrMicros: 0,
      };
  const next = mutate(start);
  if (existing) {
    await ctx.db.patch(existing._id, { ...next, updatedAt: now });
  } else {
    await ctx.db.insert("subscriptionStats", {
      projectId,
      currency,
      ...next,
      updatedAt: now,
    });
  }
}

// Daily drift-correction cron entry point. Walks every project that
// currently has a `subscriptionStats` row OR has any subscriptions
// AND recomputes its stats from scratch. Bounded per tick so a single
// runaway project doesn't time out the cron.
//
// Why: the incremental path in `applySubscriptionEvent` /
// `recordHorizonStatus` is correct in steady state, but a missed
// invocation (action timeout, schema drift during rollout, manual
// db.patch) can drift the counters. Running a full recompute daily
// keeps the dashboard self-healing without needing operator
// intervention. The recompute uses indexed reads only so it's safe
// to run alongside live traffic.
export const recomputeAllSubscriptionStats = internalMutation({
  args: {
    // Per-tick cap so a deployment with thousands of projects doesn't
    // try to recompute everything in one Convex transaction.
    batchSize: v.optional(v.number()),
  },
  returns: v.object({ recomputed: v.number() }),
  handler: async (ctx, args) => {
    const limit = args.batchSize ?? 100;
    // Walk the `by_updated_at` index ascending so the most-stale rows
    // surface first. Take ~3× the project budget to dedupe by
    // projectId (a project has one row per currency and we recompute
    // the whole project once per batch slot) without walking past
    // `limit` distinct projects' worth of stale data. Capped at
    // SCAN_CAP so a corrupted clock skew can't make us scan the
    // entire table.
    const SCAN_CAP = Math.max(limit * 3, 300);
    const stale = await ctx.db
      .query("subscriptionStats")
      .withIndex("by_updated_at")
      .order("asc")
      .take(SCAN_CAP);
    const seenProjects = new Set<string>();
    const ordered: Id<"projects">[] = [];
    for (const row of stale) {
      if (seenProjects.has(row.projectId)) continue;
      seenProjects.add(row.projectId);
      ordered.push(row.projectId);
      if (ordered.length >= limit) break;
    }
    let recomputed = 0;
    for (const projectId of ordered) {
      // Inline call — avoids an extra mutation hop per project.
      await runRecompute(ctx, projectId);
      recomputed += 1;
    }
    return { recomputed };
  },
});

// Hard upper bound on how many subscription rows the recompute walks
// per project. A project with more than this many rows will have its
// counters slightly truncated (newer rows toward the head are
// preferred via .order("desc")), and the next cron tick will pick the
// project up again — incremental drift correction stays correct
// because applySubscriptionEvent handles steady-state writes. The
// cap exists to prevent a runaway project from busting Convex's
// per-mutation document budget and stalling the entire cron.
const RECOMPUTE_PER_PROJECT_CAP = 50_000;

async function runRecompute(
  ctx: MutationCtx,
  projectId: Id<"projects">,
): Promise<void> {
  // Mirror of recomputeSubscriptionStats body; kept inline so the
  // cron loop doesn't pay an extra `runMutation` round-trip per
  // project. The exported handler delegates here too.
  //
  // Bounded by RECOMPUTE_PER_PROJECT_CAP so a single oversized
  // project can't blow the cron's document-read budget. Walks newest
  // first via .order("desc") so the cap (when it bites) keeps the
  // most-recently-active subs which dominate the live counters.
  const rows = await ctx.db
    .query("subscriptions")
    .withIndex("by_project_and_updated", (q) => q.eq("projectId", projectId))
    .order("desc")
    .take(RECOMPUTE_PER_PROJECT_CAP);
  const periodByProductId = new Map<string, string | undefined>();
  for (const platform of ["IOS", "Android"] as const) {
    const productRows = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform", (q) =>
        q.eq("projectId", projectId).eq("platform", platform),
      )
      .collect();
    for (const product of productRows) {
      if (
        !periodByProductId.has(product.productId) ||
        (periodByProductId.get(product.productId) === undefined &&
          product.billingPeriod !== undefined)
      ) {
        periodByProductId.set(product.productId, product.billingPeriod);
      }
    }
  }
  type Bucket = {
    activeSubs: number;
    inGracePeriod: number;
    inBillingRetry: number;
    mrrMicros: number;
  };
  const buckets = new Map<string, Bucket>();
  const now = Date.now();
  for (const sub of rows) {
    const contribution = statsContributionFor(
      sub,
      periodByProductId.get(sub.productId),
      now,
    );
    if (!contribution || contribution.state === null) continue;
    const bucket = buckets.get(contribution.currency) ?? {
      activeSubs: 0,
      inGracePeriod: 0,
      inBillingRetry: 0,
      mrrMicros: 0,
    };
    switch (contribution.state) {
      case "Active":
        bucket.activeSubs += 1;
        bucket.mrrMicros += contribution.mrrMicros;
        break;
      case "InGracePeriod":
        bucket.inGracePeriod += 1;
        break;
      case "InBillingRetry":
        bucket.inBillingRetry += 1;
        break;
    }
    buckets.set(contribution.currency, bucket);
  }
  const existing = await ctx.db
    .query("subscriptionStats")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();
  for (const row of existing) {
    await ctx.db.delete(row._id);
  }
  for (const [currency, bucket] of buckets) {
    await ctx.db.insert("subscriptionStats", {
      projectId,
      currency,
      ...bucket,
      updatedAt: now,
    });
  }
}

// Full rebuild of `subscriptionStats` for one project. Walks every
// subscription row and computes the canonical counts from scratch.
// Called from the migration / a manual reconciliation entry point —
// NOT on the read path. Bounded by the project's actual subscription
// count (no SUBS_SCAN_CAP); Convex paginates through the index so a
// 100k-sub project completes in batches of ~5000.
//
// Returns the resulting (currency, counts) tuples for telemetry +
// debugging.
export const recomputeSubscriptionStats = internalMutation({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.object({
    currencies: v.number(),
    activeSubs: v.number(),
  }),
  handler: async (ctx, args) => {
    await runRecompute(ctx, args.projectId);
    const rows = await ctx.db
      .query("subscriptionStats")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return {
      currencies: rows.length,
      activeSubs: rows.reduce((sum, r) => sum + r.activeSubs, 0),
    };
  },
});
