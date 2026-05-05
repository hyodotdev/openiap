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

// Late-delivery grace days. Bucketing by `occurredAt` (the store-side
// event time) means we have to scan further back on `receivedAt`
// than the bucket window itself, otherwise an event that arrived
// 4 days late but occurred yesterday would not be in this tick's
// receivedAt scan and would silently undercount yesterday's bucket
// after the delete-then-insert in `commitBuckets`. Apple ASN v2
// retries up to 5 days; Google RTDN's Pub/Sub default is 7 days.
// 7 days covers both stores' published retry policies.
const LATE_DELIVERY_GRACE_DAYS = 7;

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

// Cap on the events pass scan. Events arrive at the receivedAt
// timestamp, so the index range is bounded by the trailing-window
// + late-delivery-grace span (10 days). Generously sized for
// realistic SaaS event rates — at 1k events/day a project burns
// 10k of the cap in 10 days, well clear of the limit.
const WEBHOOK_SCAN_CAP = 15_000;

// Per-page subscription scan size. Each page chains via the
// scheduler so this caps reads PER MUTATION, not per project. A
// project with 50k active subs paginates across ~10 chained
// mutations, each comfortably under the 40k document-read budget
// (page reads + the events pass on page 0 + commit-time existing-
// row deletes all share the budget).
const SUBS_PAGE_SIZE = 5_000;

// Validators for the chained-page args. Buckets serialize as a flat
// array so they survive the scheduler's JSON round-trip; the cursor
// is a small enum + watermark.
const platformValidator = v.union(v.literal("IOS"), v.literal("Android"));
const accumulatorValidator = v.array(
  v.object({
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
  }),
);
const cursorValidator = v.object({
  stateIdx: v.number(),
  updatedBefore: v.union(v.number(), v.null()),
});

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

// Kickoff: build window, run events pass, then process the first
// subscriptions page. If all counted states fit in a single page
// (typical for projects under SUBS_PAGE_SIZE active subs), commit
// inline. Otherwise schedule continuation pages.
//
// Exported so tests can drive it directly without the cron scheduler.
// In tests with small datasets the inline commit path always
// triggers; the chained-page path only kicks in for projects that
// exceed SUBS_PAGE_SIZE in any one counted state.
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
  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  const buckets = new Map<BucketKey, RollupBucket>();

  // ---- Pass 1: webhookEvents → newSubs / renewals / cancellations
  // / refunds / revenueMicros buckets.
  //
  // Scan by `receivedAt` (the index we have on webhookEvents) but
  // bucket by `occurredAt` (the store-side event time). A renewal
  // that occurred yesterday but arrived today must land in
  // yesterday's bucket — otherwise a retry-delayed notification
  // would flip its day on the dashboard, contradicting the
  // "late notifications fold into their correct day" promise.
  //
  // The scan window extends `LATE_DELIVERY_GRACE_DAYS` beyond the
  // bucket window so an event with `occurredAt` inside the bucket
  // window but `receivedAt` from a prior tick still gets reread
  // (after `commitBuckets` deletes the day's existing rows, anything
  // not rescanned silently drops out of the rebuilt bucket).
  const eventScanStart = windowStart - LATE_DELIVERY_GRACE_DAYS * DAY_MS;
  const events = await ctx.db
    .query("webhookEvents")
    .withIndex("by_project_and_received", (q) =>
      q
        .eq("projectId", projectId)
        .gte("receivedAt", eventScanStart)
        .lte("receivedAt", windowEnd),
    )
    .take(WEBHOOK_SCAN_CAP);
  if (events.length === WEBHOOK_SCAN_CAP) {
    // Hitting the cap means the scan was truncated and the project's
    // bucket counters are undercounted for this tick. Surface to
    // ops via the standard Convex log stream — silent truncation
    // would manifest as flat-line analytics that look like a quiet
    // day rather than a budget breach.
    console.warn(
      `[revenueMetrics] webhookEvents scan hit WEBHOOK_SCAN_CAP=${WEBHOOK_SCAN_CAP} for project=${projectId}; results truncated, bucket counters will undercount this tick.`,
    );
  }

  for (const event of events) {
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

  // ---- Pass 2: subscriptions → activeSubs end-of-day snapshots.
  // Walks ONLY counted-state rows via `by_project_and_state_and_updated`
  // ordered descending — most-recently-updated first. Active subs
  // tick `updatedAt` on every renewal so descending puts the rows
  // most likely to satisfy `isActiveAt(...)` at the front of the
  // page; an under-budget project gets its full picture from a
  // single page, an over-budget project chains continuations.
  await processSubsPage(ctx, {
    projectId,
    days,
    windowStart,
    buckets,
    cursor: { stateIdx: 0, updatedBefore: null },
    runStartedAt: now,
  });
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
    cursor: { stateIdx: number; updatedBefore: number | null };
    runStartedAt: number;
  },
): Promise<void> {
  const { projectId, days, buckets, runStartedAt } = args;
  const dayEnds = days.map((day) => Date.parse(`${day}T23:59:59.999Z`));

  let { stateIdx, updatedBefore } = args.cursor;
  let pageRemaining = SUBS_PAGE_SIZE;
  let chainContinuation = false;

  while (stateIdx < COUNTED_STATES_ORDERED.length && pageRemaining > 0) {
    const state: CountedState = COUNTED_STATES_ORDERED[stateIdx];
    const upperBound = updatedBefore;
    const requested = pageRemaining;
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_project_and_state_and_updated", (q) => {
        const base = q.eq("projectId", projectId).eq("state", state);
        return upperBound === null ? base : base.lt("updatedAt", upperBound);
      })
      .order("desc")
      .take(requested);

    for (const sub of subs) {
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

    pageRemaining -= subs.length;
    if (subs.length < requested) {
      // Took less than we asked for → state exhausted, advance.
      stateIdx += 1;
      updatedBefore = null;
    } else {
      // Page is full and the current state may still have rows we
      // haven't seen. Carry the watermark on this state and chain a
      // continuation; the next page reads `lt(updatedAt, watermark)`
      // so we skip the rows we already processed.
      updatedBefore = subs[subs.length - 1].updatedAt;
      chainContinuation = true;
      break;
    }
  }

  if (!chainContinuation && stateIdx >= COUNTED_STATES_ORDERED.length) {
    // All counted states processed — commit.
    await commitBuckets(ctx, projectId, days, buckets, runStartedAt);
    await markRevenueMetricsRun(ctx, projectId, runStartedAt);
    return;
  }

  // More work to do. Serialize the accumulator + cursor and chain
  // a fresh mutation so the next page gets its own 40k budget.
  const serialized = Array.from(buckets.values());
  await ctx.scheduler.runAfter(
    0,
    internal.subscriptions.revenueMetrics.recomputeRevenueMetricsPage,
    {
      projectId,
      days,
      buckets: serialized,
      cursor: { stateIdx, updatedBefore },
      runStartedAt,
    },
  );
}

// Continuation page handler. Rehydrates the accumulator from the
// scheduler args and resumes pagination from the saved cursor.
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
    await processSubsPage(ctx, {
      projectId: args.projectId,
      days: args.days,
      windowStart,
      buckets,
      cursor: args.cursor,
      runStartedAt: args.runStartedAt,
    });
    return null;
  },
});

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
      // `SubscriptionUncanceled` so a cancel-then-uncancel pair
      // within the same window is net-zero in the chart.
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
  if (bucket.cancellations < 0) bucket.cancellations = 0;
  if (bucket.revenueMicros < 0) bucket.revenueMicros = 0;
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
    if (
      bucket.activeSubs === 0 &&
      bucket.newSubs === 0 &&
      bucket.renewals === 0 &&
      bucket.cancellations === 0 &&
      bucket.refunds === 0 &&
      bucket.revenueMicros === 0
    ) {
      continue;
    }
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
