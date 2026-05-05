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

// Daily entry point: schedule per-project recomputes. Mirrors the
// `recomputeAllSubscriptionStats` pattern so each project gets its
// own 40k document-read budget rather than sharing the picker's.
export const recomputeAllRevenueMetrics = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({ scheduled: v.number() }),
  handler: async (ctx, args) => {
    const limit = args.batchSize ?? 50;
    // Walk the same `subscriptionStats.by_updated_at` index the
    // existing drift cron uses, so the two crons stay in sync on
    // which projects need attention. A project without
    // `subscriptionStats` rows has never had a counted-state sub
    // either, so it has nothing to roll up.
    const SCAN_CAP = Math.max(limit * 3, 300);
    const stale = await ctx.db
      .query("subscriptionStats")
      .withIndex("by_updated_at")
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

// Per-project recompute. Scans the trailing-window slice of
// `webhookEvents` once and the project's `subscriptions` table once,
// then writes one rollup row per (day, productId, currency) bucket.
//
// Bounded reads:
//  - webhookEvents: trailing TRAILING_DAYS × per-project event rate.
//    Capped at WEBHOOK_SCAN_CAP so a runaway-loop project can't
//    exceed Convex's 40k document-read mutation budget.
//  - subscriptions: walks the project's full sub list once via
//    `by_project_and_updated`. Capped at SUBS_SCAN_CAP — projects
//    past the cap should switch to incremental maintenance in v2.
export const recomputeRevenueMetricsForProject = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runRecompute(ctx, args.projectId, Date.now());
    return null;
  },
});

const WEBHOOK_SCAN_CAP = 20_000;
const SUBS_SCAN_CAP = 20_000;

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

  // ---- Pass 1: webhookEvents → newSubs / renewals / cancellations
  // / refunds / revenueMicros buckets.
  const events = await ctx.db
    .query("webhookEvents")
    .withIndex("by_project_and_received", (q) =>
      q
        .eq("projectId", projectId)
        .gte("receivedAt", windowStart)
        .lte("receivedAt", windowEnd),
    )
    .take(WEBHOOK_SCAN_CAP);

  for (const event of events) {
    if (!event.productId) continue;
    const day = utcDayKey(event.receivedAt);
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
  // We need every project sub (not just the trailing window)
  // because a sub started months ago can still be active "today".
  // Walk the by_project_and_updated index ascending for index-order
  // determinism; the activeSubs computation doesn't care about
  // order, but this avoids surprising tiebreak behaviour if a
  // future caller pages off the same handle.
  const subs = await ctx.db
    .query("subscriptions")
    .withIndex("by_project_and_updated", (q) => q.eq("projectId", projectId))
    .take(SUBS_SCAN_CAP);

  // Per-day end-of-day boundary timestamps. activeSubs snapshot is
  // taken at `dayEnd` (start of next UTC day - 1ms) so a sub that
  // expires at exactly midnight UTC counts toward the day it was
  // active during, not the day it expired into.
  const dayEnds = days.map((day) => Date.parse(`${day}T23:59:59.999Z`));

  for (const sub of subs) {
    for (let i = 0; i < days.length; i++) {
      if (!isActiveAt(sub, dayEnds[i])) continue;
      // activeSubs key uses the sub's productId + currency + platform
      // so it composes with the event-driven counters that share the
      // same bucket key.
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

  // ---- Commit: upsert each bucket, delete any pre-existing row in
  // the window that's no longer in the recomputed set (otherwise a
  // sub that switched products would leave a stale bucket behind).
  await commitBuckets(ctx, projectId, days, buckets, now);
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
  // currencyCount) — typically tens of rows per project, not
  // thousands.
  for (const day of days) {
    const existing = await ctx.db
      .query("revenueMetricsDaily")
      .withIndex("by_project_and_day_and_currency", (q) =>
        q.eq("projectId", projectId).eq("day", day),
      )
      .collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }
  }

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
    await ctx.db.insert("revenueMetricsDaily", {
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
    });
  }
}
