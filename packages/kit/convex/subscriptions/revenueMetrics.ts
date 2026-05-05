// Daily revenue rollup populator. Reads `webhookEvents` (the canonical
// store-side event log — Apple ASN v2 / Google RTDN / Meta Horizon
// reconciler all converge here) over a trailing window and writes
// per-(project, day, productId, currency) rollups to
// `revenueMetricsDaily`.
//
// Using the event log instead of walking `subscriptions` is what lets
// us count renewals correctly: the `subscriptions` table holds the
// CURRENT state of each entitlement, so the fact that a sub renewed
// three times since signup is invisible there. The webhook event
// stream records every transition individually, including
// `SubscriptionRenewed` with its `priceAmountMicros` extracted at
// receive time.
//
// `activeSubs` is a different shape — it's an end-of-day snapshot,
// not a count of events. We compute it from the `subscriptions` table
// in the same per-project mutation, in one pass, for every day in the
// window.
//
// Trailing window: 3 days. Apple ASN v2 retries up to 5 days and
// Google RTDN's Pub/Sub default is 7 days, but in practice 99% of
// late-arriving notifications land within 24-48h. RevenueCat picked
// the same 3-day reprocess window for the same reason. Each cron
// tick overwrites the trailing 3 days, so a webhook arriving up to
// 3 days late still gets folded into its correct day's bucket.
//
// Scaling pattern: per-project recompute uses the same scheduler-
// chained pagination as `recomputeSubscriptionStats` so each page
// gets its own 40k document-read budget. The events pass runs once
// in the kickoff page; the subscriptions pass walks counted-state
// rows only (Active / InGracePeriod / InBillingRetry) via
// `by_project_and_state_and_updated` ordered descending — most-
// recently-updated first — and chains continuation pages until
// every state is exhausted before committing.

import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

// Trailing recompute window in days. Bumping this past ~7 days means
// every cron tick walks more events for diminishing accuracy gains
// (late events past 7d are vanishingly rare — Apple/Google both
// quarantine those into manual reconciliation paths instead).
const TRAILING_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

// UTC day key (YYYY-MM-DD) for an epoch-millis timestamp. Keying in
// UTC matches `revenueMetricsDaily.day`'s stored format and avoids
// the off-by-one a project's local timezone would introduce when
// the same day's events get split across two rollup rows after a
// dashboard timezone change.
export function utcDayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function startOfUtcDay(ts: number): number {
  const date = new Date(ts);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export type Platform = "IOS" | "Android";

// Composite key for daily buckets: (day, productId, currency, platform).
// Same SKU sold in multiple storefront currencies / platforms on the
// same day produces distinct buckets — same reasoning as
// `revenueMetricsDaily`'s composite index.
type BucketKey = string;
export function bucketKey(
  day: string,
  productId: string,
  currency: string,
  platform: Platform,
): string {
  return `${day}|${productId}|${currency}|${platform}`;
}

export type RollupBucket = {
  day: string;
  productId: string;
  currency: string;
  platform: Platform;
  activeSubs: number;
  newSubs: number;
  renewals: number;
  cancellations: number;
  refunds: number;
  revenueMicros: number;
};

const COUNTED_STATES = new Set([
  "Active",
  "InGracePeriod",
  "InBillingRetry",
] as const);

// Order matters: pagination cursors index into this list. Adding a
// state requires a migration of in-flight cursors stored on the
// scheduler queue, so prepend new states to the END of the list,
// never the middle.
const COUNTED_STATES_ORDERED = [
  "Active",
  "InGracePeriod",
  "InBillingRetry",
] as const;
type CountedState = (typeof COUNTED_STATES_ORDERED)[number];

// Cron picker entry. Walks `revenueMetricsRunStatus.by_run` ascending
// so the least-recently-processed projects surface first. Each
// successful per-project recompute upserts its own
// `revenueMetricsRunStatus` row with `lastRunAt = now`, so the
// picker self-rotates without piggybacking on the subscription-stats
// drift cron's freshness signal.
//
// Bootstrap: a brand-new project has no `revenueMetricsRunStatus`
// row yet. Pad the picker from `subscriptionStats` (any project
// with at least one stats row has had a counted-state sub at some
// point) so first-time analytics processing happens on the next
// tick after a project's first sub instead of waiting for some
// other code path to seed the status table.
export const recomputeAllRevenueMetrics = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({ scheduled: v.number() }),
  handler: async (ctx, args) => {
    const limit = args.batchSize ?? 100;
    const SCAN_CAP = Math.max(limit * 3, 300);

    const stale = await ctx.db
      .query("revenueMetricsRunStatus")
      .withIndex("by_run")
      .order("asc")
      .take(SCAN_CAP);

    const seen = new Set<string>();
    const projects: Id<"projects">[] = [];
    for (const row of stale) {
      if (seen.has(row.projectId)) continue;
      seen.add(row.projectId);
      projects.push(row.projectId);
      if (projects.length >= limit) break;
    }

    if (projects.length < limit) {
      const fresh = await ctx.db
        .query("subscriptionStats")
        .withIndex("by_updated_at")
        .take(SCAN_CAP);
      for (const row of fresh) {
        if (seen.has(row.projectId)) continue;
        seen.add(row.projectId);
        projects.push(row.projectId);
        if (projects.length >= limit) break;
      }
    }

    let scheduled = 0;
    for (const projectId of projects) {
      await ctx.scheduler.runAfter(
        0,
        internal.subscriptions.revenueMetrics.recomputeRevenueMetricsForProject,
        { projectId },
      );
      scheduled += 1;
    }
    return { scheduled };
  },
});

// Per-project kickoff. Schedules itself by chaining
// `recomputeRevenueMetricsPage` mutations, each with its own 40k
// document-read budget, so a project with arbitrarily many active
// subscriptions completes without ever exceeding the per-mutation
// ceiling.
export const recomputeRevenueMetricsForProject = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runRecompute(ctx, args.projectId, Date.now());
    return null;
  },
});

// Per-page event scan size. The webhookEvents pass paginates via
// the scheduler so this caps reads PER MUTATION, not per project.
// A noisy project that emits 50k events in the trailing 3-day
// window paginates across ~10 chained mutations, each well under
// the 32k document-read budget.
const EVENTS_PAGE_SIZE = 5_000;

// Per-page subscription scan size. Each page chains via the
// scheduler so this caps reads PER MUTATION, not per project. A
// project with 50k active subs paginates across ~10 chained
// mutations, each comfortably under the 32k document-read budget.
const SUBS_PAGE_SIZE = 5_000;

// Number of accumulator buckets above which the commit phase
// chains per-day mutations instead of running inline. Below this
// threshold, a single commit fits comfortably under Convex's 8192
// writes-per-mutation budget (each bucket is one delete + one
// insert = 2 ops, plus the per-day existing-row scan reads). For
// large multi-product projects (e.g. 100 SKUs × 5 currencies × 2
// platforms × 3 days = 3000 buckets → 6000 ops, breaking the cap),
// we split by day so each commit mutation handles one day's
// buckets and gets its own write budget.
const COMMIT_INLINE_BUCKET_LIMIT = 500;

// Per-day commit safety margin under Convex's 8192-writes-per-
// mutation budget. Single-mutation per-day commits do
// `existing.length` deletes + `nonZero.length` inserts, so any day
// whose `existing + nonZero` exceeds this limit splits into a
// delete pass on the kickoff mutation followed by chained
// `commitRevenueMetricsDayInsertChunk` mutations of size
// `INSERT_CHUNK_SIZE` each. 7000 leaves headroom for the
// existing-row read pass and the `markRevenueMetricsRun` upsert.
const COMMIT_DAY_WRITES_LIMIT = 7_000;
const INSERT_CHUNK_SIZE = 3_500;

// Validators for the chained-page args. Buckets serialize as a flat
// array so they survive the scheduler's JSON round-trip; the cursor
// is a tagged union covering both phases of the recompute pipeline
// (events scan first, then subscriptions scan) so a single
// scheduled `recomputeRevenueMetricsPage` handler can resume from
// either phase. Cursors come from Convex's `paginate(...)` API,
// which includes the row `_id` as a stable tiebreaker (a
// hand-rolled `lt(receivedAt, ...)` / `lt(updatedAt, ...)`
// watermark would silently skip rows that share a timestamp at the
// page boundary).
const platformValidator = v.union(v.literal("IOS"), v.literal("Android"));
const bucketValidator = v.object({
  day: v.string(),
  productId: v.string(),
  currency: v.string(),
  platform: platformValidator,
  activeSubs: v.number(),
  newSubs: v.number(),
  renewals: v.number(),
  cancellations: v.number(),
  refunds: v.number(),
  revenueMicros: v.number(),
});
const accumulatorValidator = v.array(bucketValidator);
const cursorValidator = v.union(
  v.object({
    phase: v.literal("events"),
    paginationCursor: v.union(v.string(), v.null()),
  }),
  v.object({
    phase: v.literal("subs"),
    stateIdx: v.number(),
    paginationCursor: v.union(v.string(), v.null()),
  }),
);

async function markRevenueMetricsRun(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  now: number,
): Promise<void> {
  const existing = await ctx.db
    .query("revenueMetricsRunStatus")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { lastRunAt: now });
  } else {
    await ctx.db.insert("revenueMetricsRunStatus", {
      projectId,
      lastRunAt: now,
    });
  }
}

// Kickoff: build window, then start the events-pagination phase.
// Events scan paginates through `webhookEvents`; once exhausted the
// pipeline transitions to the subscriptions phase, which paginates
// through counted-state rows; once that's exhausted the commit
// phase fans out per-day mutations. Each phase reads its accumulator
// from / writes back to a single buckets map carried through the
// scheduler chain.
//
// Exported so tests can drive it directly without the cron scheduler.
// In tests with small datasets every phase completes in one page
// inline; the chained-page path only kicks in once the per-mutation
// EVENTS_PAGE_SIZE / SUBS_PAGE_SIZE / COMMIT_INLINE_BUCKET_LIMIT
// thresholds are exceeded.
export async function runRecompute(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  now: number,
): Promise<void> {
  const todayStart = startOfUtcDay(now);
  const windowStart = todayStart - (TRAILING_DAYS - 1) * DAY_MS;
  // Inclusive end-of-window — covers events received up to "now"
  // on the most recent day in the window. Events received after the
  // cron ran will be folded in by the next tick.
  const windowEnd = now;

  // Pre-build the day list for activeSubs snapshots and to ensure
  // every day in the window gets a row even when it had zero events
  // (so a "no churn yesterday" day still surfaces as activeSubs=N
  // instead of disappearing from the chart).
  const days: string[] = [];
  for (let i = 0; i < TRAILING_DAYS; i++) {
    days.push(utcDayKey(windowStart + i * DAY_MS));
  }

  const buckets = new Map<BucketKey, RollupBucket>();
  await processEventsPage(ctx, {
    projectId,
    days,
    windowStart,
    windowEnd,
    buckets,
    paginationCursor: null,
    runStartedAt: now,
  });
}

// Process one page of `webhookEvents`. Buckets accumulate event-
// driven counters (newSubs / renewals / cancellations / refunds /
// revenueMicros) from `occurredAt`; `activeSubs` lands later in
// `processSubsPage`. When the events scan finishes, transitions
// to the subscriptions phase by calling `processSubsPage` directly.
//
// Scan by `receivedAt` (the index we have on webhookEvents) but
// bucket by `occurredAt` (the store-side event time). A renewal
// that occurred yesterday but arrived today must land in
// yesterday's bucket — otherwise a retry-delayed notification
// would flip its day on the dashboard.
//
// Scan window matches the bucket window exactly. The webhook
// receivers in `webhooks/apple.ts` and `webhooks/google.ts` set
// `receivedAt` to the HTTP receive time and `occurredAt` to the
// store-side timestamp (Apple `signedDate` / Google
// `eventTimeMillis`), so by construction `receivedAt >=
// occurredAt`: any event whose `occurredAt` lands in
// `[windowStart, windowEnd]` necessarily has `receivedAt` in the
// same range too.
async function processEventsPage(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    days: string[];
    windowStart: number;
    windowEnd: number;
    buckets: Map<BucketKey, RollupBucket>;
    paginationCursor: string | null;
    runStartedAt: number;
  },
): Promise<void> {
  const { projectId, days, windowStart, windowEnd, buckets, runStartedAt } =
    args;
  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  const result = await ctx.db
    .query("webhookEvents")
    .withIndex("by_project_and_received", (q) =>
      q
        .eq("projectId", projectId)
        .gte("receivedAt", windowStart)
        .lte("receivedAt", windowEnd),
    )
    .paginate({ numItems: EVENTS_PAGE_SIZE, cursor: args.paginationCursor });

  for (const event of result.page) {
    if (!event.productId) continue;
    const day = utcDayKey(event.occurredAt);
    // Skip events whose store-side day falls outside the bucket
    // window. Their bucket row (if any) lives outside the
    // delete-then-insert window in `commitBuckets`, so writing
    // here would either duplicate counters or stomp on a row
    // that wasn't rescanned. Late-by-more-than-grace events are
    // a rounding error — Apple/Google both quarantine those.
    if (day < firstDay || day > lastDay) continue;
    const currency = event.currency ?? "";
    // The webhookEvents schema only allows `IOS` / `Android` for
    // `platform`; the Meta Horizon reconciler synthesizes events
    // under `platform: "Android"` because Quest devices map to the
    // Play store's commerce model. No third value to handle here.
    const platform = event.platform;
    const key = bucketKey(day, event.productId, currency, platform);
    const bucket = getOrCreateBucket(
      buckets,
      key,
      day,
      event.productId,
      currency,
      platform,
    );
    applyEventToBucket(bucket, event);
  }

  if (result.isDone) {
    // Events exhausted — transition to the subscriptions phase.
    await processSubsPage(ctx, {
      projectId,
      days,
      windowStart,
      buckets,
      cursor: { stateIdx: 0, paginationCursor: null },
      runStartedAt,
    });
    return;
  }

  // More events to read. Serialize the accumulator + cursor and
  // chain a fresh events page.
  await ctx.scheduler.runAfter(
    0,
    internal.subscriptions.revenueMetrics.recomputeRevenueMetricsPage,
    {
      projectId,
      days,
      buckets: Array.from(buckets.values()),
      cursor: { phase: "events", paginationCursor: result.continueCursor },
      runStartedAt,
    },
  );
}

// Process one page of counted-state subscriptions. Greedily
// advances through states until either the page fills (chain
// continuation) or every counted state is exhausted (commit).
//
// `buckets` is the live accumulator: pass-1 (events) populated it
// in the kickoff, this function adds activeSubs contributions and
// commits at the end of the last page.
async function processSubsPage(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    days: string[];
    windowStart: number;
    buckets: Map<BucketKey, RollupBucket>;
    cursor: { stateIdx: number; paginationCursor: string | null };
    runStartedAt: number;
  },
): Promise<void> {
  const { projectId, days, buckets, runStartedAt } = args;
  const dayEnds = days.map((day) => Date.parse(`${day}T23:59:59.999Z`));

  let { stateIdx, paginationCursor } = args.cursor;
  let pageRemaining = SUBS_PAGE_SIZE;
  let chainContinuation = false;

  while (stateIdx < COUNTED_STATES_ORDERED.length && pageRemaining > 0) {
    const state: CountedState = COUNTED_STATES_ORDERED[stateIdx];
    const result = await ctx.db
      .query("subscriptions")
      .withIndex("by_project_and_state_and_updated", (q) =>
        q.eq("projectId", projectId).eq("state", state),
      )
      .order("desc")
      .paginate({ numItems: pageRemaining, cursor: paginationCursor });

    for (const sub of result.page) {
      for (let i = 0; i < days.length; i++) {
        if (!isActiveAt(sub, dayEnds[i])) continue;
        const currency = sub.currency ?? "";
        const platform = sub.platform;
        const key = bucketKey(days[i], sub.productId, currency, platform);
        const bucket = getOrCreateBucket(
          buckets,
          key,
          days[i],
          sub.productId,
          currency,
          platform,
        );
        bucket.activeSubs += 1;
      }
    }

    pageRemaining -= result.page.length;
    if (result.isDone) {
      // State exhausted, advance to next state with a fresh cursor.
      stateIdx += 1;
      paginationCursor = null;
    } else {
      // Convex's `continueCursor` is opaque and includes a stable
      // tiebreaker (the row `_id`), so subsequent pages won't drop
      // rows that share an `updatedAt` with the page boundary.
      paginationCursor = result.continueCursor;
      if (pageRemaining <= 0) {
        chainContinuation = true;
        break;
      }
    }
  }

  if (!chainContinuation && stateIdx >= COUNTED_STATES_ORDERED.length) {
    // All counted states processed — commit.
    await commitOrSchedulePerDay(ctx, projectId, days, buckets, runStartedAt);
    return;
  }

  // More work to do. Serialize the accumulator + cursor and chain
  // a fresh mutation so the next page gets its own 32k read budget.
  const serialized = Array.from(buckets.values());
  await ctx.scheduler.runAfter(
    0,
    internal.subscriptions.revenueMetrics.recomputeRevenueMetricsPage,
    {
      projectId,
      days,
      buckets: serialized,
      cursor: { phase: "subs", stateIdx, paginationCursor },
      runStartedAt,
    },
  );
}

// Continuation page handler. Rehydrates the accumulator from the
// scheduler args and dispatches to the right phase based on the
// tagged cursor.
export const recomputeRevenueMetricsPage = internalMutation({
  args: {
    projectId: v.id("projects"),
    days: v.array(v.string()),
    buckets: accumulatorValidator,
    cursor: cursorValidator,
    runStartedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const buckets = new Map<BucketKey, RollupBucket>();
    for (const row of args.buckets) {
      const key = bucketKey(row.day, row.productId, row.currency, row.platform);
      buckets.set(key, { ...row });
    }
    const todayStart = startOfUtcDay(args.runStartedAt);
    const windowStart = todayStart - (TRAILING_DAYS - 1) * DAY_MS;
    if (args.cursor.phase === "events") {
      await processEventsPage(ctx, {
        projectId: args.projectId,
        days: args.days,
        windowStart,
        windowEnd: args.runStartedAt,
        buckets,
        paginationCursor: args.cursor.paginationCursor,
        runStartedAt: args.runStartedAt,
      });
      return null;
    }
    await processSubsPage(ctx, {
      projectId: args.projectId,
      days: args.days,
      windowStart,
      buckets,
      cursor: {
        stateIdx: args.cursor.stateIdx,
        paginationCursor: args.cursor.paginationCursor,
      },
      runStartedAt: args.runStartedAt,
    });
    return null;
  },
});

// Commit one day's worth of recomputed buckets. Used by the
// scheduler-chained commit path for projects whose total bucket
// count exceeds COMMIT_INLINE_BUCKET_LIMIT and would otherwise
// blow Convex's 8192-writes-per-mutation budget on a single
// commit. Each per-day commit:
//   - reads existing rollup rows for THIS day (bounded by
//     productCount × currencyCount × platformCount)
//   - deletes them and inserts the recomputed non-zero buckets
//   - upserts `revenueMetricsRunStatus` so the picker rotates
//     even if some other day's commit ran later or never
// Multiple per-day commits run in parallel; OCC retries make the
// shared `revenueMetricsRunStatus` upsert race-safe.
export const commitRevenueMetricsDay = internalMutation({
  args: {
    projectId: v.id("projects"),
    day: v.string(),
    buckets: accumulatorValidator,
    runStartedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("revenueMetricsDaily")
      .withIndex("by_project_and_day_and_currency", (q) =>
        q.eq("projectId", args.projectId).eq("day", args.day),
      )
      .collect();
    const nonZero = args.buckets.filter((b) => !isAllZeroBucket(b));

    // Stay under Convex's 8192-writes-per-mutation budget. Single
    // mutation does `existing.length` deletes + `nonZero.length`
    // inserts; if that combined sum exceeds COMMIT_DAY_WRITES_LIMIT
    // we delete inline (existing.length is already bounded by the
    // budget — a project that has stored more than 7000 rows for
    // one day is pathological enough to trip Convex's hard ceiling
    // on the prior commit, so this branch shouldn't be reached
    // in practice) and fan inserts out across chained chunk
    // mutations of size INSERT_CHUNK_SIZE.
    if (existing.length + nonZero.length <= COMMIT_DAY_WRITES_LIMIT) {
      await Promise.all(existing.map((row) => ctx.db.delete(row._id)));
      await Promise.all(
        nonZero.map((bucket) => insertBucket(ctx, args, bucket)),
      );
      await markRevenueMetricsRun(ctx, args.projectId, args.runStartedAt);
      return null;
    }

    if (existing.length > COMMIT_DAY_WRITES_LIMIT) {
      // Bigger than the per-mutation write budget can absorb in
      // one shot. We could split the deletes across chained
      // mutations too, but a single day's existing-row count
      // crossing 7k requires somewhere north of 3500 distinct
      // (productId, currency, platform) tuples already on disk
      // for the same UTC day — operationally implausible for the
      // SaaS workloads this dashboard targets, and it would have
      // tripped the Convex write limit on the commit that wrote
      // those rows in the first place. Surface the impossible
      // state rather than silently succeeding with a partial
      // delete.
      throw new Error(
        `commitRevenueMetricsDay: existing row count ${existing.length} for project=${args.projectId} day=${args.day} exceeds COMMIT_DAY_WRITES_LIMIT=${COMMIT_DAY_WRITES_LIMIT}; manual intervention required.`,
      );
    }

    await Promise.all(existing.map((row) => ctx.db.delete(row._id)));
    for (let i = 0; i < nonZero.length; i += INSERT_CHUNK_SIZE) {
      const chunk = nonZero.slice(i, i + INSERT_CHUNK_SIZE);
      await ctx.scheduler.runAfter(
        0,
        internal.subscriptions.revenueMetrics
          .commitRevenueMetricsDayInsertChunk,
        {
          projectId: args.projectId,
          day: args.day,
          buckets: chunk,
          runStartedAt: args.runStartedAt,
        },
      );
    }
    await markRevenueMetricsRun(ctx, args.projectId, args.runStartedAt);
    return null;
  },
});

// Insert chunk for the per-day fan-out path. Used only when the
// per-day commit's `existing + nonZero` would have exceeded
// COMMIT_DAY_WRITES_LIMIT: the kickoff `commitRevenueMetricsDay`
// performs the deletes and schedules these chunks afterwards. Each
// chunk gets its own 8192-writes budget, so a project with
// ~10k buckets/day fans out across ~3 chained chunks instead of
// blowing the limit. `markRevenueMetricsRun` is OCC-safe across
// the parallel chunks; the kickoff calls it too so even a 0-row
// inserted-chunk path still marks the run.
export const commitRevenueMetricsDayInsertChunk = internalMutation({
  args: {
    projectId: v.id("projects"),
    day: v.string(),
    buckets: accumulatorValidator,
    runStartedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await Promise.all(
      args.buckets.map((bucket) => insertBucket(ctx, args, bucket)),
    );
    await markRevenueMetricsRun(ctx, args.projectId, args.runStartedAt);
    return null;
  },
});

function insertBucket(
  ctx: MutationCtx,
  args: { projectId: Id<"projects">; runStartedAt: number },
  bucket: {
    day: string;
    productId: string;
    currency: string;
    platform: Platform;
    activeSubs: number;
    newSubs: number;
    renewals: number;
    cancellations: number;
    refunds: number;
    revenueMicros: number;
  },
): Promise<Id<"revenueMetricsDaily">> {
  return ctx.db.insert("revenueMetricsDaily", {
    projectId: args.projectId,
    day: bucket.day,
    productId: bucket.productId,
    currency: bucket.currency,
    platform: bucket.platform,
    activeSubs: bucket.activeSubs,
    newSubs: bucket.newSubs,
    renewals: bucket.renewals,
    cancellations: bucket.cancellations,
    refunds: bucket.refunds,
    revenueMicros: bucket.revenueMicros,
    updatedAt: args.runStartedAt,
  });
}

// Decide whether to commit inline (small projects) or fan out one
// scheduled mutation per day (large projects). The threshold is
// expressed in total bucket count because each bucket contributes
// at most 2 writes (one delete of the prior row + one insert of
// the new row); 500 buckets × 2 = 1000 writes per day worst-case
// is comfortably under Convex's 8192-writes-per-mutation budget
// even with the per-day existing-row reads.
async function commitOrSchedulePerDay(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  days: string[],
  buckets: Map<BucketKey, RollupBucket>,
  runStartedAt: number,
): Promise<void> {
  if (buckets.size <= COMMIT_INLINE_BUCKET_LIMIT) {
    await commitBuckets(ctx, projectId, days, buckets, runStartedAt);
    await markRevenueMetricsRun(ctx, projectId, runStartedAt);
    return;
  }

  // Group buckets by day so each scheduled mutation receives only
  // its own slice. Args size per scheduled mutation is therefore
  // bounded by the per-day bucket count (productCount ×
  // currencyCount × platformCount), well under the ~1MB scheduler
  // arg limit at any realistic SaaS scale.
  const bucketsByDay = new Map<string, RollupBucket[]>();
  for (const day of days) bucketsByDay.set(day, []);
  for (const bucket of buckets.values()) {
    const list = bucketsByDay.get(bucket.day);
    if (list) list.push(bucket);
  }

  for (const day of days) {
    await ctx.scheduler.runAfter(
      0,
      internal.subscriptions.revenueMetrics.commitRevenueMetricsDay,
      {
        projectId,
        day,
        buckets: bucketsByDay.get(day) ?? [],
        runStartedAt,
      },
    );
  }
}

function isAllZeroBucket(bucket: {
  activeSubs: number;
  newSubs: number;
  renewals: number;
  cancellations: number;
  refunds: number;
  revenueMicros: number;
}): boolean {
  return (
    bucket.activeSubs === 0 &&
    bucket.newSubs === 0 &&
    bucket.renewals === 0 &&
    bucket.cancellations === 0 &&
    bucket.refunds === 0 &&
    bucket.revenueMicros === 0
  );
}

function getOrCreateBucket(
  buckets: Map<BucketKey, RollupBucket>,
  key: BucketKey,
  day: string,
  productId: string,
  currency: string,
  platform: Platform,
): RollupBucket {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = {
      day,
      productId,
      currency,
      platform,
      activeSubs: 0,
      newSubs: 0,
      renewals: 0,
      cancellations: 0,
      refunds: 0,
      revenueMicros: 0,
    };
    buckets.set(key, bucket);
  }
  return bucket;
}

export function applyEventToBucket(
  bucket: RollupBucket,
  event: Doc<"webhookEvents">,
): void {
  const price = event.priceAmountMicros ?? 0;
  switch (event.type) {
    case "SubscriptionStarted":
      bucket.newSubs += 1;
      bucket.revenueMicros += price;
      break;
    case "SubscriptionRenewed":
      bucket.renewals += 1;
      bucket.revenueMicros += price;
      break;
    case "SubscriptionCanceled":
      // User-initiated cancellations. Counted only when the user
      // turned off renewal — uncancellations are caught by
      // `SubscriptionUncanceled`. The day-bucket counter is allowed
      // to go negative on its own: an uncancel that arrives on a
      // different day than the original cancel must still net to
      // zero when the dashboard sums across a weekly / monthly
      // bucket (or across multiple per-day rollup rows for the
      // same period). Clamping at zero per-day would silently lose
      // cross-day cancel/uncancel pairs.
      bucket.cancellations += 1;
      break;
    case "SubscriptionUncanceled":
      bucket.cancellations -= 1;
      break;
    case "PurchaseRefunded":
    case "SubscriptionRevoked":
      // Both are store-initiated reversals. Count under refunds so
      // the dashboard's "money lost" line includes both routes.
      bucket.refunds += 1;
      break;
    default:
      // Lifecycle-only events (Expired, InGracePeriod, etc.) don't
      // affect the financial counters — they're surfaced via the
      // existing `metricsSummary` live counters instead.
      break;
  }
  // No clamps. `cancellations` is intentionally allowed to go
  // negative (cross-day uncancel offset, see above). `revenueMicros`
  // never decreases under the current event mapping — refunds bump
  // the `refunds` counter, not `revenueMicros` — so a clamp would
  // be dead code; if a future event type ever subtracts revenue,
  // the same cross-period reasoning applies and a clamp would hide
  // the offset.
}

export function isActiveAt(sub: Doc<"subscriptions">, dayEnd: number): boolean {
  if (sub.startedAt > dayEnd) return false;
  if (!COUNTED_STATES.has(sub.state as "Active")) return false;
  if (typeof sub.expiresAt === "number" && sub.expiresAt <= dayEnd) {
    return false;
  }
  return true;
}

async function commitBuckets(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  days: string[],
  buckets: Map<BucketKey, RollupBucket>,
  now: number,
): Promise<void> {
  // Delete every existing row in the window first, then insert the
  // freshly computed set. Cleaner than a per-key upsert/delete diff
  // because the window is bounded (TRAILING_DAYS × productCount ×
  // currencyCount × platformCount) — typically tens of rows per
  // project, not thousands.
  //
  // Both the per-day queries and the delete batches dispatch with
  // `Promise.all` so the round trips overlap. Convex still
  // serializes the underlying writes within the mutation
  // transaction, but firing them concurrently shaves the wall-clock
  // for the commit phase down to roughly one round-trip per day
  // instead of (existing-row-count × days).
  const existingPerDay = await Promise.all(
    days.map((day) =>
      ctx.db
        .query("revenueMetricsDaily")
        .withIndex("by_project_and_day_and_currency", (q) =>
          q.eq("projectId", projectId).eq("day", day),
        )
        .collect(),
    ),
  );
  await Promise.all(existingPerDay.flat().map((row) => ctx.db.delete(row._id)));

  const inserts: Array<Promise<unknown>> = [];
  for (const bucket of buckets.values()) {
    // Skip empty buckets — happens when a sub became active mid-day
    // but was later refunded so its (newSubs, refunds) net to zero
    // and it wasn't active at end-of-day either. No row beats an
    // all-zero row in storage / scan cost.
    if (isAllZeroBucket(bucket)) continue;
    inserts.push(
      ctx.db.insert("revenueMetricsDaily", {
        projectId,
        day: bucket.day,
        productId: bucket.productId,
        currency: bucket.currency,
        platform: bucket.platform,
        activeSubs: bucket.activeSubs,
        newSubs: bucket.newSubs,
        renewals: bucket.renewals,
        cancellations: bucket.cancellations,
        refunds: bucket.refunds,
        revenueMicros: bucket.revenueMicros,
        updatedAt: now,
      }),
    );
  }
  await Promise.all(inserts);
}
