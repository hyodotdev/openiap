// Incremental subscription stats maintenance — keeps the
// `subscriptionStats` aggregation table in sync as subscriptions
// transition through state machine events. The dashboard's
// `metricsSummary` reads from this table so the headline counters
// stay accurate above the prior SUBS_SCAN_CAP=10,000 bound.

import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
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

// Daily drift-correction cron entry point. Picks the most-stale
// projects (one mutation, tiny index scan) and SCHEDULES each
// project's recompute as a separate mutation via the Convex
// scheduler. Per-project mutations get their own 40k document-read
// budget — running them inline would force the picker mutation to
// share its budget with N project recomputes, which exceeds the
// 40k cap once batchSize × per-project-reads > 40k.
//
// Why: the incremental path in `applySubscriptionEvent` /
// `recordHorizonStatus` is correct in steady state, but a missed
// invocation (action timeout, schema drift during rollout, manual
// db.patch) can drift the counters. Running a full recompute daily
// keeps the dashboard self-healing without needing operator
// intervention.
export const recomputeAllSubscriptionStats = internalMutation({
  args: {
    // Per-tick cap on how many projects to schedule. Each project
    // runs in its own mutation (independent 40k budget), so a higher
    // batchSize is safe — but we still default conservatively so a
    // deployment with thousands of projects doesn't queue them all
    // at once.
    batchSize: v.optional(v.number()),
  },
  returns: v.object({ scheduled: v.number() }),
  handler: async (ctx, args) => {
    // Default to 50 projects per daily tick: each runs as its own
    // mutation so the picker's budget isn't shared. With cron daily
    // cadence + batchSize=50, a deployment with up to 1500 projects
    // cycles through every project at least monthly.
    const limit = args.batchSize ?? 50;
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
    let scheduled = 0;
    for (const projectId of ordered) {
      // Schedule each per-project recompute as its own mutation so
      // the 40k document-read limit is per-project, not summed
      // across the batch. `runAfter(0, ...)` queues immediately;
      // Convex serializes them on its scheduler.
      await ctx.scheduler.runAfter(
        0,
        internal.subscriptions.stats.recomputeSubscriptionStats,
        { projectId },
      );
      scheduled += 1;
    }
    return { scheduled };
  },
});

// Hard upper bound on how many subscription rows the recompute walks
// per project. Set conservatively below Convex's hard 40k document-
// Per-page subscription read budget. 5_000 keeps a single page well
// under Convex's 40k document-read mutation budget (with headroom for
// the per-page product + existing-stats reads). Pages chain via
// `ctx.scheduler.runAfter(0, ...)` so a project of ANY size completes
// without ever blowing the per-mutation ceiling — the prior
// "skip-when-exceeds 30k" path is gone (PR #124
// (https://github.com/hyodotdev/openiap/pull/124) review).
const RECOMPUTE_PAGE_SIZE = 5_000;

type RecomputeBucket = {
  activeSubs: number;
  inGracePeriod: number;
  inBillingRetry: number;
  mrrMicros: number;
};

// Convex value form of `Map<currency, RecomputeBucket>` so it survives
// scheduler-arg serialization between pages.
const recomputeAccumulator = v.array(
  v.object({
    currency: v.string(),
    activeSubs: v.number(),
    inGracePeriod: v.number(),
    inBillingRetry: v.number(),
    mrrMicros: v.number(),
  }),
);

async function runRecompute(
  ctx: MutationCtx,
  projectId: Id<"projects">,
): Promise<void> {
  // Kicks off the paginated recompute. The first page processes
  // RECOMPUTE_PAGE_SIZE rows and either schedules itself for the
  // next page or commits to subscriptionStats when isDone.
  //
  // `runStartedAt` is the watermark for stale-write detection: the
  // final commit aborts if any subscription row has been written
  // since this timestamp, because the incremental path's
  // `applyStatsTransition` will have already updated subscriptionStats
  // for those writes and our paged snapshot would clobber them with
  // older counts.
  await runRecomputePageInline(ctx, {
    projectId,
    cursor: null,
    accumulator: [],
    runStartedAt: Date.now(),
  });
}

async function runRecomputePageInline(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    cursor: string | null;
    accumulator: Array<RecomputeBucket & { currency: string }>;
    runStartedAt: number;
  },
): Promise<void> {
  // Build periodByProductId from the per-platform product index.
  // We re-fetch on every page because product catalogs are small
  // (typically 10-100 rows per platform per project) and re-reading
  // is much cheaper than serializing the map through scheduler args.
  const periodByProductId = new Map<string, string | undefined>();
  for (const platform of ["IOS", "Android"] as const) {
    const productRows = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform", (q) =>
        q.eq("projectId", args.projectId).eq("platform", platform),
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

  // Read one page of subscriptions oldest-first via the
  // by_project_and_updated index. Order is deterministic so the
  // continuation cursor stays valid across mutations.
  const result = await ctx.db
    .query("subscriptions")
    .withIndex("by_project_and_updated", (q) =>
      q.eq("projectId", args.projectId),
    )
    .order("asc")
    .paginate({ numItems: RECOMPUTE_PAGE_SIZE, cursor: args.cursor });

  // Hydrate the carry-in accumulator into a Map for fast lookup.
  const buckets = new Map<string, RecomputeBucket>();
  for (const row of args.accumulator) {
    buckets.set(row.currency, {
      activeSubs: row.activeSubs,
      inGracePeriod: row.inGracePeriod,
      inBillingRetry: row.inBillingRetry,
      mrrMicros: row.mrrMicros,
    });
  }
  const now = Date.now();
  for (const sub of result.page) {
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

  if (!result.isDone) {
    // Re-serialize buckets and chain the next page in a fresh
    // mutation so each page gets its own 40k document-read budget.
    const nextAccumulator: Array<RecomputeBucket & { currency: string }> = [];
    for (const [currency, bucket] of buckets) {
      nextAccumulator.push({ currency, ...bucket });
    }
    await ctx.scheduler.runAfter(
      0,
      internal.subscriptions.stats.runRecomputePage,
      {
        projectId: args.projectId,
        cursor: result.continueCursor,
        accumulator: nextAccumulator,
        runStartedAt: args.runStartedAt,
      },
    );
    return;
  }

  // Concurrent-write detection. If any subscription row was updated
  // since the recompute started, the incremental path
  // (applySubscriptionEvent / recordHorizonStatus) has already
  // applied that delta to subscriptionStats — our paged snapshot is
  // stale and must NOT overwrite it. Abort the commit; the next
  // cron tick will pick this project back up. Convex mutations are
  // transactional, so this read + the delete/insert below run in a
  // single serialized txn — no further race window.
  const concurrentWrite = await ctx.db
    .query("subscriptions")
    .withIndex("by_project_and_updated", (q) =>
      q.eq("projectId", args.projectId).gt("updatedAt", args.runStartedAt),
    )
    .first();
  if (concurrentWrite) {
    console.info(
      `[subscriptionStats] aborting recompute commit for project=${args.projectId} — subscription updated at ${concurrentWrite.updatedAt} > runStartedAt=${args.runStartedAt}; incremental path is authoritative.`,
    );
    return;
  }

  // Last page — commit the totals to subscriptionStats.
  const existing = await ctx.db
    .query("subscriptionStats")
    .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
    .collect();
  for (const row of existing) {
    await ctx.db.delete(row._id);
  }
  if (buckets.size === 0) {
    // Sentinel zero-row so the project still surfaces in the
    // `by_updated_at` index for the next cron pick. Without this, a
    // project whose subs are all in non-counted states (Expired /
    // Refunded / etc.) would have ZERO rows after the delete loop
    // above — the picker only discovers projects via
    // subscriptionStats, so the project would fall out of drift
    // correction permanently. The empty `""` currency bucket is
    // ignored by metricsSummary's mrrAccumulators (it only sums
    // currencies that have non-zero MRR + non-empty currency code).
    await ctx.db.insert("subscriptionStats", {
      projectId: args.projectId,
      currency: "",
      activeSubs: 0,
      inGracePeriod: 0,
      inBillingRetry: 0,
      mrrMicros: 0,
      updatedAt: now,
    });
  } else {
    for (const [currency, bucket] of buckets) {
      await ctx.db.insert("subscriptionStats", {
        projectId: args.projectId,
        currency,
        ...bucket,
        updatedAt: now,
      });
    }
  }
}

// Public mutation entry point for chained pages. Internal cron + the
// kick-off `runRecompute` call into `runRecomputePageInline` directly;
// only the scheduler dispatches into this exported handler.
export const runRecomputePage = internalMutation({
  args: {
    projectId: v.id("projects"),
    cursor: v.union(v.string(), v.null()),
    accumulator: recomputeAccumulator,
    runStartedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runRecomputePageInline(ctx, args);
    return null;
  },
});

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
  // null because the recompute is now async-paged: the kick-off
  // mutation processes the first page and chains the rest via
  // `ctx.scheduler.runAfter` so each page gets its own 40k
  // document-read budget. Reading subscriptionStats here would only
  // see the first page's contribution for any project > PAGE_SIZE
  // (PR #124 (https://github.com/hyodotdev/openiap/pull/124) review).
  // Callers that want post-recompute telemetry should query
  // subscriptionStats directly after a few seconds.
  returns: v.null(),
  handler: async (ctx, args) => {
    await runRecompute(ctx, args.projectId);
    return null;
  },
});
