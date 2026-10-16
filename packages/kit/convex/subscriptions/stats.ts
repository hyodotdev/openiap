import {
  SUBSCRIPTION_SCAN_PAGE_SIZE,
  SUBSCRIPTION_SCAN_BYTES,
} from "./accessHistory";
// Keeps `subscriptionStats` in step with subscription transitions, so
// metricsSummary's headline counts need no scan.

import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { compareValues, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

import { monthlyMicrosForSub } from "./monthlyMicros";
import { isMisrecordedApplePass } from "./stateMachine";
import { subscriptionEnvironment } from "./analyticsFacts";
import { getWritableProject } from "../projects/writable";

// Bump when `statsContributionFor` changes what counts. Stored rows keep the
// old totals until rebuilt, so each project's next revenue rollup then
// requests one rebuild (see `markRevenueMetricsRun`), instead of waiting up to
// a month for the drift-correction cron.
export const STATS_DEFINITIONS_VERSION = 1;

// Other states carry no MRR; metricsSummary counts the recent ones in its
// 30-day scan.
const COUNTED_STATES = ["Active", "InGracePeriod", "InBillingRetry"] as const;
type CountedState = (typeof COUNTED_STATES)[number];

function isCountedState(state: string): state is CountedState {
  return (COUNTED_STATES as readonly string[]).includes(state);
}

type StatsContribution = {
  // "" for a counted sub with no price yet (before the first webhook), so it is
  // still counted.
  currency: string;
  state: CountedState | null;
  mrrMicros: number;
};

// What one row adds to the stats; null for a non-counted state. The stats are
// production-only: sandbox testers never reach live counts or MRR.
export function statsContributionFor(
  sub: Doc<"subscriptions">,
  billingPeriod: string | undefined,
  now: number = Date.now(),
): StatsContribution | null {
  if (!isCountedState(sub.state) || isMisrecordedApplePass(sub)) return null;
  if (subscriptionEnvironment(sub) !== "Production") return null;
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
  return { currency, state: sub.state, mrrMicros };
}

// Applies one transition to the stats: `before` null is an insert, `after` null
// a delete. Reads the stats rows itself so callers never handle the aggregate.
// While a rebuild runs, a row its scan has passed also moves the rebuild's
// totals; the scan reads any other row as it is.
export async function applyStatsTransition(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  before: StatsContribution | null,
  after: StatsContribution | null,
  subscription: Pick<Doc<"subscriptions">, "_creationTime" | "_id">,
): Promise<void> {
  // No-op when neither side counts.
  if (before === null && after === null) return;
  // Common case: a renewal changes nothing.
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
  // One row unless the currency changed.
  if (before && after && before.currency === after.currency) {
    await touchStatsRow(ctx, projectId, before.currency, now, (row) =>
      applyDelta(applyDelta(row, before, "subtract"), after, "add"),
    );
  } else {
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

  const rebuild = await getStatsRebuild(ctx, projectId);
  if (
    rebuild?.scannedThrough !== undefined &&
    rebuild.scannedThroughId !== undefined &&
    compareValues(
      [subscription._creationTime, subscription._id],
      [rebuild.scannedThrough, rebuild.scannedThroughId],
    ) <= 0
  ) {
    const totals = totalsFromRows(rebuild.totals);
    if (before) addToTotals(totals, before, "subtract");
    if (after) addToTotals(totals, after, "add");
    await ctx.db.patch(rebuild._id, { totals: totalsToRows(totals) });
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
      // Unreachable for callers; keeps the switch total.
      break;
  }
  // A negative count means a missed event; clamp it and let
  // recomputeSubscriptionStats repair the drift.
  next.activeSubs = Math.max(0, next.activeSubs);
  next.inGracePeriod = Math.max(0, next.inGracePeriod);
  next.inBillingRetry = Math.max(0, next.inBillingRetry);
  if (next.mrrMicros < 0) next.mrrMicros = 0;
  return next;
}

type StatsTotals = Map<string, StatsRowShape>;
type StatsTotalRows = Doc<"subscriptionStatsRebuilds">["totals"];

const ZERO_STATS: StatsRowShape = {
  activeSubs: 0,
  inGracePeriod: 0,
  inBillingRetry: 0,
  mrrMicros: 0,
};

function addToTotals(
  totals: StatsTotals,
  contribution: StatsContribution,
  op: "add" | "subtract",
): void {
  totals.set(
    contribution.currency,
    applyDelta(
      totals.get(contribution.currency) ?? ZERO_STATS,
      contribution,
      op,
    ),
  );
}

function totalsFromRows(rows: StatsTotalRows): StatsTotals {
  return new Map(rows.map(({ currency, ...row }) => [currency, row]));
}

function totalsToRows(totals: StatsTotals): StatsTotalRows {
  return Array.from(totals, ([currency, row]) => ({ currency, ...row }));
}

function getStatsRebuild(
  ctx: Pick<MutationCtx, "db">,
  projectId: Id<"projects">,
): Promise<Doc<"subscriptionStatsRebuilds"> | null> {
  return ctx.db
    .query("subscriptionStatsRebuilds")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .unique();
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
  const next = mutate(existing ?? ZERO_STATS);
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

// Daily drift correction: the incremental path drifts after a missed call
// (action timeout, schema drift during rollout, a manual db.patch), so the
// least recently recomputed projects are rebuilt. Each project runs as its own
// scheduled mutation, with its own read budget instead of sharing the picker's.
export const recomputeAllSubscriptionStats = internalMutation({
  args: {
    // Projects per tick, kept modest so thousands are not queued at once.
    batchSize: v.optional(v.number()),
  },
  returns: v.object({ scheduled: v.number() }),
  handler: async (ctx, args) => {
    const limit = args.batchSize ?? 50;
    // Oldest rows first: a recompute replaces a project's rows and incremental
    // writes never re-create one, so daily activity cannot hold a project back.
    // A project has a row per currency, so read ~3× the limit to find enough
    // distinct projects.
    const SCAN_CAP = Math.max(limit * 3, 300);
    const stale = await ctx.db
      .query("subscriptionStats")
      .withIndex("by_creation_time")
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

// Shared row and byte bounds leave room for catalog and stats reads.
const RECOMPUTE_PAGE_SIZE = SUBSCRIPTION_SCAN_PAGE_SIZE;

// Scans subscriptions in creation order, which writes never reorder, so each
// row is read once; concurrent writes reach the totals through
// `applyStatsTransition`. The last page replaces the project's stats.
async function runRecomputePageInline(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    startedAt: number;
    cursor: string | null;
  },
): Promise<void> {
  // Every scheduled page is a fresh transaction and can run after project or
  // account deletion starts. Stop before reading/rewriting aggregate rows.
  if (!(await getWritableProject(ctx, args.projectId))) return;

  const rebuild = await getStatsRebuild(ctx, args.projectId);
  const ours = rebuild?.startedAt === args.startedAt ? rebuild : null;
  // A newer rebuild replaced this one.
  if (args.cursor !== null && !ours) return;

  // Timestamp-only checkpoints can already double-count tied rows. Start over
  // with a new generation so queued pages cannot reuse the corrupt totals.
  const restart =
    args.cursor === null ||
    (ours?.scannedThrough !== undefined && ours.scannedThroughId === undefined);
  const startedAt = restart
    ? Math.max(Date.now(), (rebuild?.startedAt ?? -Infinity) + 1)
    : args.startedAt;

  // Keyed by platform too: one SKU can have a different period per store.
  // Re-read on every page; catalogs are small and cheaper to read than to pass
  // through scheduler args.
  const periodByPlatformProduct = new Map<string, string | undefined>();
  for (const platform of ["IOS", "Android"] as const) {
    const productRows = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform", (q) =>
        q.eq("projectId", args.projectId).eq("platform", platform),
      )
      .collect();
    for (const product of productRows) {
      periodByPlatformProduct.set(
        `${platform}:${product.productId}`,
        product.billingPeriod,
      );
    }
  }

  const result = await ctx.db
    .query("subscriptions")
    .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
    .paginate({
      maximumBytesRead: SUBSCRIPTION_SCAN_BYTES,
      numItems: RECOMPUTE_PAGE_SIZE,
      cursor: restart ? null : args.cursor,
    });

  const totals: StatsTotals =
    ours && !restart ? totalsFromRows(ours.totals) : new Map();
  const now = Date.now();
  for (const sub of result.page) {
    const contribution = statsContributionFor(
      sub,
      periodByPlatformProduct.get(`${sub.platform}:${sub.productId}`),
      now,
    );
    if (contribution) addToTotals(totals, contribution, "add");
  }

  if (!result.isDone) {
    const lastRead = result.page[result.page.length - 1];
    const fields = {
      startedAt,
      totals: totalsToRows(totals),
      scannedThrough:
        lastRead?._creationTime ?? (restart ? undefined : ours?.scannedThrough),
      scannedThroughId:
        lastRead?._id ?? (restart ? undefined : ours?.scannedThroughId),
    };
    if (ours) {
      await ctx.db.patch(ours._id, fields);
    } else {
      if (rebuild) await ctx.db.delete(rebuild._id);
      await ctx.db.insert("subscriptionStatsRebuilds", {
        projectId: args.projectId,
        ...fields,
      });
    }
    await ctx.scheduler.runAfter(
      0,
      internal.subscriptions.stats.runRecomputePage,
      {
        projectId: args.projectId,
        startedAt,
        cursor: result.continueCursor,
      },
    );
    return;
  }
  if (rebuild) await ctx.db.delete(rebuild._id);

  // Last page — commit the totals to subscriptionStats. Replace rather than
  // patch: the drift-correction picker orders projects by row creation.
  const existing = await ctx.db
    .query("subscriptionStats")
    .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
    .collect();
  for (const row of existing) {
    await ctx.db.delete(row._id);
  }
  if (totals.size === 0) {
    // Zero-row sentinel: the picker finds projects only through
    // subscriptionStats, so a project with no counted subs would drop out of
    // drift correction for good. metricsSummary ignores the "" currency.
    await ctx.db.insert("subscriptionStats", {
      projectId: args.projectId,
      currency: "",
      ...ZERO_STATS,
      updatedAt: now,
    });
  } else {
    for (const [currency, row] of totals) {
      await ctx.db.insert("subscriptionStats", {
        projectId: args.projectId,
        currency,
        ...row,
        updatedAt: now,
      });
    }
  }

  const runStatus = await ctx.db
    .query("revenueMetricsRunStatus")
    .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
    .unique();
  if (
    runStatus &&
    runStatus.statsDefinitionsVersion !== STATS_DEFINITIONS_VERSION
  ) {
    await ctx.db.patch(runStatus._id, {
      statsDefinitionsVersion: STATS_DEFINITIONS_VERSION,
    });
  }
}

// Scheduler entry for chained pages; the kickoff runs the first page itself.
export const runRecomputePage = internalMutation({
  args: {
    projectId: v.id("projects"),
    startedAt: v.number(),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runRecomputePageInline(ctx, args);
    return null;
  },
});

// Full rebuild of one project's subscriptionStats in bounded pages, for
// migrations and manual reconciliation; never on the read path.
export const recomputeSubscriptionStats = internalMutation({
  args: {
    projectId: v.id("projects"),
  },
  // Null: later pages run on the scheduler, so read subscriptionStats
  // afterwards for the result.
  returns: v.null(),
  handler: async (ctx, args) => {
    await runRecomputePageInline(ctx, {
      projectId: args.projectId,
      startedAt: Date.now(),
      cursor: null,
    });
    return null;
  },
});
