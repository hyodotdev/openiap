// Daily revenue rollups. Reads `webhookEvents` (Apple ASN v2 and Google RTDN)
// and writes per-(project, day, productId, currency, platform, environment)
// rows to `revenueMetricsDaily`. Legacy synthetic Horizon reconciler rows are
// excluded.
//
// Metric definitions (UTC days; list price in the store's currency, before
// store fees; IAPKit never converts currencies):
// - revenueMicros: gross list price of paid charges (paid starts, trial
//   conversions, renewals, billing recoveries). Free periods add 0.
// - refundedMicros: store-reported amount of refunds, less refund reversals.
// - newSubs: paid and free-trial starts; not refund reversals, Google plan
//   changes, free offer periods, or Apple resubscribes (reactivations) other
//   than the first charge after a lapsed trial.
// - trialStarts / trialConversions / directPaidStarts: see `applyEventToBucket`.
// - renewals: every other paid charge: renewals, billing recoveries, Apple
//   resubscribes and charged Google plan changes (at list price). A trial's
//   first paid charge is a conversion instead.
// - cancellations: auto-renew turned off, less turned back on. Not churn.
// - expirations: paid access actually ended (store expiry notification). A
//   free period that ended unpaid is not churn.
// - refunds: refunds, less refund reversals. One per refund: revocations are
//   never counted (see `isRefund`).
// - activeSubs / activeTrials: subscriptions with access at the end of each day
//   (today: when the run started), and the subset still in a free trial.
//   Billing retry has no access.
//
// Each cron tick recomputes the last 3 days, so a notification up to 3 days
// late still lands on its day: Apple retries for up to 5 days and Google
// Pub/Sub for 7, but nearly all late ones arrive within 48h. Later arrivals
// are counted as pending and trigger a bounded catch-up over the retained
// event window (see `markRevenueMetricsRun`).
//
// A run is a chain of scheduled mutations, each with its own read budget. The
// kickoff stamps the run; then the window goes in slices of at most
// TRAILING_DAYS days, one after another: per slice, the events received from
// its first day until the run started, then counted-state subscriptions via
// `by_project_and_state_and_updated`, newest first, then the commit, which
// replaces the slice's days. A slice counts every event that occurred on its
// days, so a day is only ever replaced with a complete count, never added to:
// a retried or overlapping run cannot double-count. Each page also stops once
// a newer run has started, and stamps the run's progress so the picker never
// restarts a slow run that is still moving. A slice carries only its own
// buckets between mutations, so a 30-day rebuild never carries more than a
// regular run does.

import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { getWritableProject } from "../projects/writable";
import { WEBHOOK_RETENTION_MS } from "../webhooks/shared";
import { isMisrecordedApplePass } from "./stateMachine";
import {
  analyticsEnvironment,
  endedInFreePeriod,
  isInTrialAt,
  isPaidCharge,
  isRefund,
  isTrialStart,
  startsSubscription,
  subscriptionEnvironment,
  type AnalyticsEnvironment,
  type SubscriptionAnalytics,
} from "./analyticsFacts";
import {
  findSubscriptionByToken,
  findSupersedingSubscription,
} from "./internal";
import { REVENUE_COUNTERS, zeroRevenueCounters } from "./revenueCounters";
import { STATS_DEFINITIONS_VERSION } from "./stats";
import { receiptEnvironmentValidator } from "../utils/validation";

// Raising this past ~7 days reads more events for almost no gain: later events
// are rare and handled by the catch-up below. It is also the slice size, which
// bounds what a run carries between mutations: 3 days × the project's
// (product, currency, platform, environment) combinations must stay under
// Convex's 8,192-item array limit, about 2,700 combinations.
const TRAILING_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

// Rebuilds and catch-ups reach back as far as events are retained.
const RETAINED_DAYS = Math.floor(WEBHOOK_RETENTION_MS / DAY_MS);

// Bump when a metric's definition changes: each project then rebuilds its
// retained window once, and `definitionsFromDay` marks where the new
// definitions start.
export const ROLLUP_DEFINITIONS_VERSION = 4;

// Catch-ups and stats rebuilds reread a project's data, so each is requested
// at most this often.
const WIDE_RECOMPUTE_INTERVAL_MS = 6 * 60 * 60 * 1000;

// A run that commits no page for this long failed: the picker retries it,
// doubling the wait for each further failure in a row, up to a day. A slow run
// that keeps committing pages is left to finish.
const RUN_RETRY_MS = 60 * 60 * 1000;

function runRetryMs(failedRuns: number): number {
  return Math.min(RUN_RETRY_MS * 2 ** failedRuns, DAY_MS);
}

// Pages stamp progress at most this often: far inside RUN_RETRY_MS, and a run
// that finishes sooner writes no stamp beyond its start.
const PROGRESS_STAMP_MS = 5 * 60 * 1000;

const COHORTS_INTERVAL_MS = DAY_MS;

// Only these reach IAPKit from the stores; re-syncs and reconciliation do not
// show that notifications are set up. Amazon's count nowhere in analytics.
const STORE_NOTIFICATION_SOURCES = new Set<Doc<"webhookEvents">["source"]>([
  "AppleAppStoreServerNotificationsV2",
  "GooglePlayRealTimeDeveloperNotifications",
]);

// UTC YYYY-MM-DD, the format `revenueMetricsDaily.day` stores; a local timezone
// would split a day across rows when the dashboard's zone changes.
export function utcDayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function startOfUtcDay(ts: number): number {
  const date = new Date(ts);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export type Platform = "IOS" | "Android";

// One SKU in several currencies, platforms or environments gets separate
// buckets, as in `revenueMetricsDaily`'s key.
type BucketKey = string;
export function bucketKey(
  day: string,
  productId: string,
  currency: string,
  platform: Platform,
  environment: AnalyticsEnvironment,
): string {
  return `${day}|${productId}|${currency}|${platform}|${environment}`;
}

const platformValidator = v.union(v.literal("IOS"), v.literal("Android"));
const bucketValidator = v.object({
  day: v.string(),
  productId: v.string(),
  currency: v.string(),
  platform: platformValidator,
  environment: receiptEnvironmentValidator,
  activeSubs: v.number(),
  activeTrials: v.number(),
  newSubs: v.number(),
  trialStarts: v.number(),
  trialConversions: v.number(),
  directPaidStarts: v.number(),
  renewals: v.number(),
  cancellations: v.number(),
  expirations: v.number(),
  refunds: v.number(),
  revenueMicros: v.number(),
  refundedMicros: v.number(),
});
export type RollupBucket = Infer<typeof bucketValidator>;

// Pagination cursors index into this list: append new states at the end, or
// in-flight cursors break. `Expired` and `InBillingRetry` rows count on the
// days before their `expiresAt`.
const COUNTED_STATES_ORDERED = [
  "Active",
  "InGracePeriod",
  "InBillingRetry",
  "Expired",
] as const;
type CountedState = (typeof COUNTED_STATES_ORDERED)[number];
const COUNTED_STATES = new Set<string>(COUNTED_STATES_ORDERED);

// Cron picker. Projects without a `revenueMetricsRunStatus` row come first,
// found through recent webhook events (the strongest sign someone expects
// Analytics soon) and then subscriptionStats; the stalest run starts fill the
// rest of the batch. Filling from stale rows first would rotate the same cohort
// forever once it reached `batchSize`, leaving new projects' Analytics empty.
export const recomputeAllRevenueMetrics = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({ scheduled: v.number() }),
  handler: async (ctx, args) => {
    const limit = args.batchSize ?? 100;
    const projects = await pickRevenueMetricsProjects(ctx, limit, Date.now());

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

type RevenueMetricsPickerCtx = Pick<MutationCtx, "db">;

function pickerScanCap(limit: number): number {
  return Math.max(limit * 3, 300);
}

async function getRunStatus(
  ctx: Pick<MutationCtx, "db">,
  projectId: Id<"projects">,
): Promise<Doc<"revenueMetricsRunStatus"> | null> {
  return ctx.db
    .query("revenueMetricsRunStatus")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .unique();
}

// The start of a run that has not finished: in flight, or failed.
function unfinishedRunStart(
  status: Doc<"revenueMetricsRunStatus">,
): number | undefined {
  return status.runStartedAt !== undefined &&
    status.runStartedAt > (status.lastRunAt ?? -Infinity)
    ? status.runStartedAt
    : undefined;
}

// Unfinished, and made progress less than its retry wait ago: still running,
// or failed too recently to retry.
function isRunPending(
  status: Doc<"revenueMetricsRunStatus">,
  now: number,
): boolean {
  const startedAt = unfinishedRunStart(status);
  return (
    startedAt !== undefined &&
    now - (status.runProgressAt ?? startedAt) <
      runRetryMs(status.failedRuns ?? 0)
  );
}

function addProjectOnce(
  projects: Id<"projects">[],
  seen: Set<string>,
  projectId: Id<"projects">,
  limit: number,
): void {
  if (projects.length >= limit) return;
  if (seen.has(projectId)) return;
  seen.add(projectId);
  projects.push(projectId);
}

async function addUnseededProjectOnce(
  ctx: RevenueMetricsPickerCtx,
  projects: Id<"projects">[],
  seen: Set<string>,
  checkedUnseeded: Set<string>,
  projectId: Id<"projects">,
  limit: number,
): Promise<void> {
  if (projects.length >= limit) return;
  if (seen.has(projectId)) return;
  if (checkedUnseeded.has(projectId)) return;
  checkedUnseeded.add(projectId);
  if (await getRunStatus(ctx, projectId)) return;
  addProjectOnce(projects, seen, projectId, limit);
}

async function pickRevenueMetricsProjects(
  ctx: RevenueMetricsPickerCtx,
  limit: number,
  now: number,
): Promise<Id<"projects">[]> {
  if (limit <= 0) return [];

  const scanCap = pickerScanCap(limit);
  const seen = new Set<string>();
  const checkedUnseeded = new Set<string>();
  const projects: Id<"projects">[] = [];

  const recentEvents = await ctx.db
    .query("webhookEvents")
    .withIndex("by_received_at")
    .order("desc")
    .take(scanCap);
  for (const row of recentEvents) {
    // Quarantine events synthesized by the removed experimental Horizon
    // reconciler. They were not store notifications and had no authoritative
    // product-type, term, or price data, so they must not seed revenue work.
    if (row.source === "MetaHorizonReconciler") continue;
    await addUnseededProjectOnce(
      ctx,
      projects,
      seen,
      checkedUnseeded,
      row.projectId,
      limit,
    );
    if (projects.length >= limit) return projects;
  }

  const recentStats = await ctx.db
    .query("subscriptionStats")
    .withIndex("by_updated_at")
    .order("desc")
    .take(scanCap);
  for (const row of recentStats) {
    await addUnseededProjectOnce(
      ctx,
      projects,
      seen,
      checkedUnseeded,
      row.projectId,
      limit,
    );
    if (projects.length >= limit) return projects;
  }

  // Ordered by the latest start, so a failed run moves to the back like a
  // finished one instead of being picked again on every tick.
  const stale = await ctx.db
    .query("revenueMetricsRunStatus")
    .withIndex("by_run_started")
    .order("asc")
    .take(scanCap);
  for (const row of stale) {
    if (isRunPending(row, now)) continue;
    addProjectOnce(projects, seen, row.projectId, limit);
    if (projects.length >= limit) return projects;
  }

  return projects;
}

// Per-project kickoff; chains `recomputeRevenueMetricsPage` mutations so any
// number of events and subscriptions fits the per-mutation read limits.
// `fromDay` widens the window for a late-event catch-up.
export const recomputeRevenueMetricsForProject = internalMutation({
  args: { projectId: v.id("projects"), fromDay: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await startRun(ctx, args.projectId, Date.now(), args.fromDay);
    return null;
  },
});

// Reads per mutation, not per project. An Apple event stores its signed
// payload, about 20 KB with its certificate chains, so 400 events read at most
// ~12.5 MiB even at 32 KB each, under the 16 MiB a mutation may read. Each
// event adds at most two index reads (alias, subscription): 800 of the 4,096
// allowed.
const EVENTS_PAGE_SIZE = 400;

// Subscription rows are about 1 KB: 50k active subs take ~10 chained pages.
const SUBS_PAGE_SIZE = 5_000;

// Each failed run in a row halves both page sizes, down to this floor.
const MIN_PAGE_SIZE = 25;

function pageSize(base: number, run: RunSummary): number {
  return Math.max(MIN_PAGE_SIZE, Math.floor(base / 2 ** run.failedRuns));
}

// Above this many buckets a slice commits one day per mutation. Each bucket is
// a delete plus an insert against Convex's 16,000-write limit; a day of the
// largest slice the array limit allows (about 2,700 buckets) fits.
const COMMIT_INLINE_BUCKET_LIMIT = 500;

// Chained-page args. Buckets travel as a flat array through the scheduler's
// JSON; the cursor is tagged by phase (events, then subscriptions) so one
// handler resumes either. Cursors come from `paginate()`, which breaks ties by
// `_id`; a timestamp watermark would skip rows sharing a boundary time.
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
const coverageValidator = v.object({ at: v.number(), fromDay: v.string() });
const notificationTimesValidator = v.object({
  Production: v.optional(v.number()),
  Sandbox: v.optional(v.number()),
});
// One run of every slice: its window starts at `firstDay` and ends today.
const runValidator = v.object({
  runStartedAt: v.number(),
  firstDay: v.string(),
  // Late events found that no finished run covered.
  late: v.object({ count: v.number(), oldestDay: v.optional(v.string()) }),
  coverage: v.array(coverageValidator),
  lastNotificationAt: notificationTimesValidator,
  // Runs in a row that failed before this one; see `pageSize`.
  failedRuns: v.number(),
});

type Coverage = Infer<typeof coverageValidator>;
type NotificationTimes = Infer<typeof notificationTimesValidator>;
type RunSummary = Infer<typeof runValidator>;

export type RecomputeRevenueMetricsPageArgs = {
  projectId: Id<"projects">;
  // The slice: consecutive days of the run's window.
  days: string[];
  buckets: RollupBucket[];
  cursor: Infer<typeof cursorValidator>;
  run: RunSummary;
};

function addUtcDays(day: string, days: number): string {
  return utcDayKey(Date.parse(`${day}T00:00:00.000Z`) + days * DAY_MS);
}

function trailingFirstDay(now: number): string {
  return addUtcDays(utcDayKey(now), -(TRAILING_DAYS - 1));
}

function retainedFirstDay(now: number): string {
  return addUtcDays(utcDayKey(now), -(RETAINED_DAYS - 1));
}

// Every day in the slice is computed, so a day without events still counts its
// active subscriptions; only a bucket with nothing to count writes no row.
function sliceDays(firstDay: string, today: string): string[] {
  const days: string[] = [];
  for (
    let day = firstDay;
    day <= today && days.length < TRAILING_DAYS;
    day = addUtcDays(day, 1)
  ) {
    days.push(day);
  }
  return days;
}

// A finished run recomputed every event received by `at` for a day from
// `fromDay` on, so such an event is already counted.
function isCovered(
  coverage: Coverage[],
  day: string,
  receivedAt: number,
): boolean {
  return coverage.some(
    (entry) => entry.at >= receivedAt && entry.fromDay <= day,
  );
}

// Adds a finished run to the coverage and drops entries it supersedes (no
// later and no wider) or that predate every retained event.
function addCoverage(
  coverage: Coverage[],
  entry: Coverage,
  oldestRetainedAt: number,
): Coverage[] {
  const kept = coverage.filter((existing) => existing.at >= oldestRetainedAt);
  if (kept.some((c) => c.at >= entry.at && c.fromDay <= entry.fromDay)) {
    return kept;
  }
  return [
    ...kept.filter((c) => !(c.at <= entry.at && c.fromDay >= entry.fromDay)),
    entry,
  ];
}

// Records the finished run, then asks for a catch-up when late events wait,
// a stats rebuild when `subscriptionStats` follows older definitions, and the
// daily cohort job when it is due.
async function markRevenueMetricsRun(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  run: RunSummary,
): Promise<void> {
  const existing = await getRunStatus(ctx, projectId);
  const previousFromDay =
    existing?.definitionsVersion === ROLLUP_DEFINITIONS_VERSION
      ? existing.definitionsFromDay
      : undefined;
  const definitionsFromDay =
    previousFromDay !== undefined && previousFromDay < run.firstDay
      ? previousFromDay
      : run.firstDay;
  // A row an earlier release finished was built from notifications stored
  // without the trial, refund-reversal and resubscribe flags; the first full
  // day after this upgrade is the first one ingested with them. A project no
  // earlier run finished is caught by a notification older than a day.
  const upgradedFromOldDefinitions =
    existing?.definitionsVersion === undefined &&
    (existing?.lastRunAt !== undefined ||
      (await hasNotificationBefore(ctx, projectId, run.runStartedAt - DAY_MS)));
  const trialSplitFromDay =
    existing?.trialSplitFromDay ??
    (upgradedFromOldDefinitions
      ? addUtcDays(utcDayKey(run.runStartedAt), 1)
      : undefined);
  const lastNotificationAt = latestNotifications(
    existing?.lastNotificationAt ?? {},
    run.lastNotificationAt,
  );

  const catchUpDue =
    run.late.count > 0 &&
    run.late.oldestDay !== undefined &&
    (existing?.catchUpRequestedAt === undefined ||
      run.runStartedAt - existing.catchUpRequestedAt >=
        WIDE_RECOMPUTE_INTERVAL_MS);
  const statsDue =
    existing?.statsDefinitionsVersion !== STATS_DEFINITIONS_VERSION &&
    (existing?.statsRequestedAt === undefined ||
      run.runStartedAt - existing.statsRequestedAt >=
        WIDE_RECOMPUTE_INTERVAL_MS);
  const cohortsDue =
    existing?.cohortsRequestedAt === undefined ||
    run.runStartedAt - existing.cohortsRequestedAt >= COHORTS_INTERVAL_MS;

  const fields = {
    lastRunAt: run.runStartedAt,
    definitionsVersion: ROLLUP_DEFINITIONS_VERSION,
    definitionsFromDay,
    trialSplitFromDay,
    lastNotificationAt,
    failedRuns: undefined,
    pendingLateEvents: run.late.count,
    oldestPendingLateDay: run.late.oldestDay,
    coverage: addCoverage(
      existing?.coverage ?? [],
      { at: run.runStartedAt, fromDay: run.firstDay },
      run.runStartedAt - WEBHOOK_RETENTION_MS,
    ),
    ...(catchUpDue ? { catchUpRequestedAt: run.runStartedAt } : {}),
    ...(statsDue ? { statsRequestedAt: run.runStartedAt } : {}),
    ...(cohortsDue ? { cohortsRequestedAt: run.runStartedAt } : {}),
  };
  if (existing) {
    await ctx.db.patch(existing._id, fields);
  } else {
    await ctx.db.insert("revenueMetricsRunStatus", { projectId, ...fields });
  }

  if (catchUpDue) {
    await ctx.scheduler.runAfter(
      0,
      internal.subscriptions.revenueMetrics.recomputeRevenueMetricsForProject,
      { projectId, fromDay: run.late.oldestDay },
    );
  }
  if (statsDue) {
    await ctx.scheduler.runAfter(
      0,
      internal.subscriptions.stats.recomputeSubscriptionStats,
      { projectId },
    );
  }
  if (cohortsDue) {
    await ctx.scheduler.runAfter(
      0,
      internal.subscriptions.revenueCohorts.recomputeRevenueCohortsPage,
      { projectId, asOf: run.runStartedAt, cursor: null, buckets: [] },
    );
  }
}

async function hasNotificationBefore(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  before: number,
): Promise<boolean> {
  // Only a store notification shows the flags are missing; a test
  // notification or a re-sync carries none.
  const oldest = await ctx.db
    .query("webhookEvents")
    .withIndex("by_project", (q) =>
      q.eq("projectId", projectId).lt("_creationTime", before),
    )
    .take(100);
  return oldest.some(isStoreNotification);
}

function latestNotifications(
  a: NotificationTimes,
  b: NotificationTimes,
): NotificationTimes {
  const latest: NotificationTimes = { ...a };
  for (const environment of ["Production", "Sandbox"] as const) {
    const at = b[environment];
    if (at !== undefined) {
      latest[environment] = Math.max(latest[environment] ?? at, at);
    }
  }
  return latest;
}

// Stamps the run's start and schedules the first slice. The stamp commits on
// its own, so a first page that fails still leaves the project to the
// picker's retry wait, and it stops any older run still in flight. Only an
// older run that had stopped making progress counts as failed.
//
// The window is the trailing 3 days, widened to the retained event window
// when the project's rows follow older definitions (or none exist yet), back
// to `fromDay` for a catch-up, and back to an unfinished run's first day, so
// a retry still covers what that run was asked to.
async function startRun(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  now: number,
  fromDay?: string,
): Promise<void> {
  if (!(await getWritableProject(ctx, projectId))) return;
  const status = await getRunStatus(ctx, projectId);
  const unfinished =
    status !== null && unfinishedRunStart(status) !== undefined;
  const retainedFirst = retainedFirstDay(now);
  let firstDay =
    status?.definitionsVersion === ROLLUP_DEFINITIONS_VERSION
      ? trailingFirstDay(now)
      : retainedFirst;
  for (const day of [fromDay, unfinished ? status.runFirstDay : undefined]) {
    if (day !== undefined && day < firstDay) firstDay = day;
  }
  if (firstDay < retainedFirst) firstDay = retainedFirst;
  const failedRuns = unfinished
    ? (status.failedRuns ?? 0) + (isRunPending(status, now) ? 0 : 1)
    : 0;
  const stamp = {
    runStartedAt: now,
    runProgressAt: now,
    runFirstDay: firstDay,
    failedRuns: failedRuns || undefined,
  };
  if (status) {
    await ctx.db.patch(status._id, stamp);
  } else {
    await ctx.db.insert("revenueMetricsRunStatus", { projectId, ...stamp });
  }

  await scheduleRecomputePage(ctx, {
    projectId,
    days: sliceDays(firstDay, utcDayKey(now)),
    buckets: [],
    cursor: { phase: "events", paginationCursor: null },
    run: {
      runStartedAt: now,
      firstDay,
      late: { count: 0 },
      coverage: status?.coverage ?? [],
      lastNotificationAt: {},
      failedRuns,
    },
  });
}

// One page of `webhookEvents` into the slice's event counters; `activeSubs`
// comes from processSubsPage. The subscriptions phase starts in a new mutation,
// since Convex allows one paginated query per mutation.
//
// Scans by `receivedAt` (the indexed field) but buckets by `occurredAt`, so a
// renewal delivered a day late stays on its own day. Receivers set `receivedAt`
// at HTTP receipt and `occurredAt` from the store (Apple `signedDate`, Google
// `eventTimeMillis`), so `receivedAt >= occurredAt`: the events received from
// the slice's first day on include every event of its days.
async function processEventsPage(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    days: string[];
    buckets: Map<BucketKey, RollupBucket>;
    paginationCursor: string | null;
    run: RunSummary;
  },
): Promise<void> {
  const { projectId, days, buckets } = args;
  const sliceFirst = days[0];
  const sliceLast = days[days.length - 1];
  // The first slice reads every event the run reads, so it alone records
  // notification times and late events.
  const firstSlice = sliceFirst === args.run.firstDay;
  const retainedFirst = retainedFirstDay(args.run.runStartedAt);
  const run: RunSummary = {
    ...args.run,
    late: { ...args.run.late },
    lastNotificationAt: { ...args.run.lastNotificationAt },
  };

  const result = await ctx.db
    .query("webhookEvents")
    .withIndex("by_project_and_received", (q) =>
      q
        .eq("projectId", projectId)
        .gte("receivedAt", Date.parse(`${sliceFirst}T00:00:00.000Z`))
        .lte("receivedAt", run.runStartedAt),
    )
    .paginate({
      numItems: pageSize(EVENTS_PAGE_SIZE, run),
      cursor: args.paginationCursor,
    });
  const productTypes = await productTypesForRows(ctx, projectId, result.page);

  const notifications = firstSlice
    ? result.page.filter(isStoreNotification)
    : [];
  const counted: Array<{
    event: Doc<"webhookEvents">;
    day: string;
    catalogType?: Doc<"products">["type"];
  }> = [];
  for (const event of result.page) {
    // Android revenue metrics are the Google Play series.
    if (event.store === "amazon") continue;
    // Legacy events from the removed Horizon reconciler were synthetic guesses
    // rather than store notifications. Keep the schema literal so existing
    // rows remain readable, but never fold those rows into revenue metrics.
    if (event.source === "MetaHorizonReconciler") continue;
    const catalogType = event.productId
      ? productTypes.get(productTypeKey(event.platform, event.productId))
      : undefined;
    if (!isSubscriptionAnalyticsEvent(event, catalogType)) continue;
    const day = utcDayKey(event.occurredAt);
    // This run leaves days before its window alone. A late event no finished
    // run covered is counted so the next catch-up can fold it in; one older
    // than the retained window can never be, and is left out.
    if (day < run.firstDay) {
      if (
        firstSlice &&
        day >= retainedFirst &&
        !isCovered(run.coverage, day, event.receivedAt)
      ) {
        run.late.count += 1;
        if (run.late.oldestDay === undefined || day < run.late.oldestDay) {
          run.late.oldestDay = day;
        }
      }
      continue;
    }
    // Another slice counts other days. Only a store clock ahead of ours dates
    // an event after its arrival.
    if (day < sliceFirst || day > sliceLast) continue;
    counted.push({ event, day, catalogType });
  }

  const tokens = await resolveTokens(ctx, projectId, [
    ...counted.map(({ event }) => event).filter(needsSubscription),
    // A one-time purchase has no subscription to take an environment from.
    ...notifications.filter(
      (event) => event.environmentDefaulted && event.productKind !== "one_time",
    ),
  ]);
  for (const event of notifications) {
    const environment = notificationEnvironment(event, tokens);
    if (environment === undefined) continue;
    run.lastNotificationAt[environment] = Math.max(
      run.lastNotificationAt[environment] ?? 0,
      event.receivedAt,
    );
  }
  for (const { event, day, catalogType } of counted) {
    const token = event.purchaseToken
      ? tokens.get(event.purchaseToken)
      : undefined;
    // The token Play replaced expires with the plan change: no churn.
    if (token?.replaced && event.type === "SubscriptionExpired") continue;
    const subject = bucketSubject(event, token);
    if (!subject) continue;
    applyEventToBucket(
      getOrCreateBucket(buckets, { day, platform: event.platform, ...subject }),
      event,
      catalogType,
      token?.subscription?.analytics,
    );
  }

  // New mutation either way: this one already used its paginated query.
  await scheduleRecomputePage(ctx, {
    projectId,
    days,
    buckets: Array.from(buckets.values()),
    cursor: result.isDone
      ? { phase: "subs", stateIdx: 0, paginationCursor: null }
      : { phase: "events", paginationCursor: result.continueCursor },
    run,
  });
}

function isStoreNotification(event: Doc<"webhookEvents">): boolean {
  return (
    STORE_NOTIFICATION_SOURCES.has(event.source) &&
    event.type !== "TestNotification"
  );
}

// A notification Play sent without an environment shows that its
// subscription's environment receives notifications; without a subscription
// it shows neither.
function notificationEnvironment(
  event: Doc<"webhookEvents">,
  tokens: Map<string, ResolvedToken>,
): AnalyticsEnvironment | undefined {
  if (!event.environmentDefaulted) {
    return analyticsEnvironment(event.environment);
  }
  const subscription = event.purchaseToken
    ? tokens.get(event.purchaseToken)?.subscription
    : undefined;
  return subscription ? subscriptionEnvironment(subscription) : undefined;
}

// Play's voided-purchase refund names no product, price or test flag, an
// expiry without Apple's trial flag needs the facts to tell a lapsed free
// trial from paid churn, and an event without a Play-reported environment
// takes its subscription's.
function needsSubscription(event: Doc<"webhookEvents">): boolean {
  return (
    (!event.productId && isRefund(event)) ||
    (event.type === "SubscriptionExpired" && event.freeTrial === undefined) ||
    event.environmentDefaulted === true
  );
}

// A token Play replaced resolves to its successor's row; `productId` is the
// product the replaced token was for.
type ResolvedToken = {
  subscription: Doc<"subscriptions"> | null;
  replaced: boolean;
  productId?: string;
};

async function resolveTokens(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  events: Doc<"webhookEvents">[],
): Promise<Map<string, ResolvedToken>> {
  const tokens = [
    ...new Set(
      events.flatMap((event) =>
        event.purchaseToken ? [event.purchaseToken] : [],
      ),
    ),
  ];
  const resolved = await Promise.all(
    tokens.map(async (token): Promise<ResolvedToken> => {
      const alias = await findSupersedingSubscription(ctx, projectId, token);
      return alias.aliased
        ? {
            subscription: alias.subscription,
            replaced: true,
            productId: alias.productId,
          }
        : {
            subscription: await findSubscriptionByToken(ctx, projectId, token),
            replaced: false,
          };
    }),
  );
  return new Map(tokens.map((token, i) => [token, resolved[i]]));
}

// The product, currency and environment an event is counted under. An event
// without a product or a Play-reported environment takes them from its
// subscription.
function bucketSubject(
  event: Doc<"webhookEvents">,
  token: ResolvedToken | undefined,
): Pick<RollupBucket, "productId" | "currency" | "environment"> | null {
  const subscription = token?.subscription;
  const environment =
    subscription && (event.environmentDefaulted || !event.productId)
      ? subscriptionEnvironment(subscription)
      : analyticsEnvironment(event.environment);
  if (event.productId) {
    return {
      productId: event.productId,
      currency: event.currency ?? "",
      environment,
    };
  }
  if (!subscription) return null;
  return {
    productId: token?.productId ?? subscription.productId,
    currency: subscription.currency ?? "",
    environment,
  };
}

// One page of one counted state per mutation; even an empty state chains to the
// next, since each `paginate()` uses the mutation's one allowance. Adds
// activeSubs to the event buckets and commits after the last page.
async function processSubsPage(
  ctx: MutationCtx,
  args: Omit<RecomputeRevenueMetricsPageArgs, "buckets" | "cursor"> & {
    buckets: Map<BucketKey, RollupBucket>;
    cursor: { stateIdx: number; paginationCursor: string | null };
  },
): Promise<void> {
  const { projectId, days, buckets, run } = args;
  // Today counts what is active when the run started, not at midnight.
  const dayEnds = days.map((day) =>
    Math.min(Date.parse(`${day}T23:59:59.999Z`), run.runStartedAt),
  );
  const { stateIdx, paginationCursor } = args.cursor;

  if (stateIdx >= COUNTED_STATES_ORDERED.length) {
    await commitSlice(ctx, projectId, days, buckets, run);
    return;
  }

  const state: CountedState = COUNTED_STATES_ORDERED[stateIdx];
  const result = await ctx.db
    .query("subscriptions")
    .withIndex("by_project_and_state_and_updated", (q) =>
      q.eq("projectId", projectId).eq("state", state),
    )
    .order("desc")
    .paginate({
      numItems: pageSize(SUBS_PAGE_SIZE, run),
      cursor: paginationCursor,
    });
  const productTypes = await productTypesForRows(ctx, projectId, result.page);

  for (const sub of result.page) {
    if (sub.store === "amazon") continue;
    if (
      sub.productKind !== "subscription" &&
      productTypes.get(productTypeKey(sub.platform, sub.productId)) !==
        "Subscription"
    ) {
      continue;
    }
    const environment = subscriptionEnvironment(sub);
    for (let i = 0; i < days.length; i++) {
      if (!isActiveAt(sub, dayEnds[i])) continue;
      const bucket = getOrCreateBucket(buckets, {
        day: days[i],
        productId: sub.productId,
        currency: sub.currency ?? "",
        platform: sub.platform,
        environment,
      });
      bucket.activeSubs += 1;
      if (isInTrialAt(sub.analytics, dayEnds[i])) bucket.activeTrials += 1;
    }
  }

  const nextStateIdx = result.isDone ? stateIdx + 1 : stateIdx;
  if (nextStateIdx >= COUNTED_STATES_ORDERED.length) {
    await commitSlice(ctx, projectId, days, buckets, run);
    return;
  }

  await scheduleRecomputePage(ctx, {
    projectId,
    days,
    buckets: Array.from(buckets.values()),
    cursor: {
      phase: "subs",
      stateIdx: nextStateIdx,
      paginationCursor: result.isDone ? null : result.continueCursor,
    },
    run,
  });
}

// A page of a run a newer one replaced, or of a deleted project, does nothing.
// A page of the current run stamps its progress, which commits with the page.
async function resumeCurrentRun(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  run: RunSummary,
): Promise<boolean> {
  if (!(await getWritableProject(ctx, projectId))) return false;
  const status = await getRunStatus(ctx, projectId);
  if (status?.runStartedAt !== run.runStartedAt) return false;
  const now = Date.now();
  if (now - (status.runProgressAt ?? run.runStartedAt) >= PROGRESS_STAMP_MS) {
    await ctx.db.patch(status._id, { runProgressAt: now });
  }
  return true;
}

async function scheduleRecomputePage(
  ctx: MutationCtx,
  args: RecomputeRevenueMetricsPageArgs,
): Promise<void> {
  await ctx.scheduler.runAfter(
    0,
    internal.subscriptions.revenueMetrics.recomputeRevenueMetricsPage,
    args,
  );
}

// Continuation page: rebuilds the buckets and resumes the cursor's phase.
export const recomputeRevenueMetricsPage = internalMutation({
  args: {
    projectId: v.id("projects"),
    days: v.array(v.string()),
    buckets: accumulatorValidator,
    cursor: cursorValidator,
    run: runValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!(await resumeCurrentRun(ctx, args.projectId, args.run))) return null;
    const buckets = new Map<BucketKey, RollupBucket>();
    for (const row of args.buckets) {
      buckets.set(keyOf(row), { ...row });
    }
    if (args.cursor.phase === "events") {
      await processEventsPage(ctx, {
        ...args,
        buckets,
        paginationCursor: args.cursor.paginationCursor,
      });
    } else {
      await processSubsPage(ctx, {
        ...args,
        buckets,
        cursor: {
          stateIdx: args.cursor.stateIdx,
          paginationCursor: args.cursor.paginationCursor,
        },
      });
    }
    return null;
  },
});

// Inline for a small slice, one scheduled mutation per day above
// COMMIT_INLINE_BUCKET_LIMIT.
async function commitSlice(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  days: string[],
  buckets: Map<BucketKey, RollupBucket>,
  run: RunSummary,
): Promise<void> {
  if (buckets.size <= COMMIT_INLINE_BUCKET_LIMIT) {
    await commitBuckets(ctx, projectId, days, buckets.values(), run);
    await continueRun(ctx, projectId, days[days.length - 1], run);
    return;
  }
  await ctx.scheduler.runAfter(
    0,
    internal.subscriptions.revenueMetrics.commitRevenueMetricsDays,
    { projectId, days, buckets: Array.from(buckets.values()), run },
  );
}

// Commits the first of `days`, then chains the rest. Sequential, so the run is
// marked only after every day of every slice is written.
export const commitRevenueMetricsDays = internalMutation({
  args: {
    projectId: v.id("projects"),
    days: v.array(v.string()),
    buckets: accumulatorValidator,
    run: runValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!(await resumeCurrentRun(ctx, args.projectId, args.run))) return null;
    const [day, ...rest] = args.days;
    await commitBuckets(
      ctx,
      args.projectId,
      [day],
      args.buckets.filter((bucket) => bucket.day === day),
      args.run,
    );
    if (rest.length === 0) {
      await continueRun(ctx, args.projectId, day, args.run);
      return null;
    }
    await ctx.scheduler.runAfter(
      0,
      internal.subscriptions.revenueMetrics.commitRevenueMetricsDays,
      {
        ...args,
        days: rest,
        buckets: args.buckets.filter((bucket) => bucket.day !== day),
      },
    );
    return null;
  },
});

// Starts the next slice, or records the run after the last one.
async function continueRun(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  lastDay: string,
  run: RunSummary,
): Promise<void> {
  const today = utcDayKey(run.runStartedAt);
  if (lastDay >= today) {
    await markRevenueMetricsRun(ctx, projectId, run);
    return;
  }
  await scheduleRecomputePage(ctx, {
    projectId,
    days: sliceDays(addUtcDays(lastDay, 1), today),
    buckets: [],
    cursor: { phase: "events", paginationCursor: null },
    run,
  });
}

// A computed day with no rows is a real zero; `definitionsFromDay` and
// `lastRunAt` tell readers which days were computed.
function isAllZeroBucket(bucket: RollupBucket): boolean {
  return REVENUE_COUNTERS.every((counter) => bucket[counter] === 0);
}

function keyOf(
  bucket: Pick<
    RollupBucket,
    "day" | "productId" | "currency" | "platform" | "environment"
  >,
): BucketKey {
  return bucketKey(
    bucket.day,
    bucket.productId,
    bucket.currency,
    bucket.platform,
    bucket.environment,
  );
}

function getOrCreateBucket(
  buckets: Map<BucketKey, RollupBucket>,
  identity: Pick<
    RollupBucket,
    "day" | "productId" | "currency" | "platform" | "environment"
  >,
): RollupBucket {
  const key = keyOf(identity);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { ...identity, ...zeroRevenueCounters() };
    buckets.set(key, bucket);
  }
  return bucket;
}

// Counter changes for one event. Counters may go negative on a day (an
// uncancel or refund reversal on a later day), so a period sum nets out; no
// clamps, which would hide a cross-period offset.
//
// - trialStarts: starts whose store offer data says free trial (revenue 0).
// - trialConversions: a subscription's first paid charge after a free trial.
// - directPaidStarts: a first paid charge delivered as a start with no trial.
// - A Google replacement or an Apple resubscribe is no start (see
//   `startsSubscription`); one that charged is a renewal.
// Restores never reach here: only store notifications are counted, and a
// restore re-verifies an existing purchase without one.
export function applyEventToBucket(
  bucket: RollupBucket,
  event: Doc<"webhookEvents">,
  catalogType?: Doc<"products">["type"],
  facts?: SubscriptionAnalytics,
): void {
  // One-time notifications share legacy internal event names with subscription
  // events, but they are operational-only and must not enter subscription
  // revenue, new-subscription, or refund counters.
  if (!isSubscriptionAnalyticsEvent(event, catalogType)) return;
  const price = event.priceAmountMicros ?? 0;
  if (event.refundReversal === true) {
    bucket.refunds -= 1;
    bucket.refundedMicros -= price;
    return;
  }
  if (isTrialStart(event)) {
    bucket.newSubs += 1;
    bucket.trialStarts += 1;
    return;
  }
  if (isPaidCharge(event)) {
    bucket.revenueMicros += price;
    if (event.paidStart === "trial_conversion") {
      bucket.trialConversions += 1;
    } else if (startsSubscription(event)) {
      bucket.newSubs += 1;
      if (event.paidStart === "direct") bucket.directPaidStarts += 1;
    } else {
      bucket.renewals += 1;
    }
    return;
  }
  // A free start stored before the trial flag existed may be a trial or a free
  // offer, so it counts as a new subscription, as it did then.
  if (startsSubscription(event) && event.freeTrial === undefined) {
    bucket.newSubs += 1;
    return;
  }
  if (isRefund(event)) {
    bucket.refunds += 1;
    bucket.refundedMicros += price;
    return;
  }
  switch (event.type) {
    case "SubscriptionCanceled":
      bucket.cancellations += 1;
      break;
    case "SubscriptionUncanceled":
      bucket.cancellations -= 1;
      break;
    case "SubscriptionExpired":
      if (!endedInFreePeriod(event, facts)) bucket.expirations += 1;
      break;
    default:
      // Lifecycle-only events (grace period, billing retry, price change, a
      // free promotional period, an uncharged plan change, ...) carry no
      // counter.
      break;
  }
}

export function isSubscriptionAnalyticsEvent(
  event: Pick<Doc<"webhookEvents">, "productKind">,
  catalogType?: Doc<"products">["type"],
): boolean {
  if (event.productKind === "one_time") return false;
  if (event.productKind === "subscription") return true;
  return catalogType === "Subscription";
}

function productTypeKey(platform: string, productId: string): string {
  return `${platform}\u0000${productId}`;
}

async function productTypesForRows(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  rows: Array<{
    platform: Doc<"products">["platform"];
    productId?: string;
    productKind?: string;
  }>,
): Promise<Map<string, Doc<"products">["type"]>> {
  const keys = [
    ...new Map(
      rows
        .filter(
          (
            row,
          ): row is {
            platform: Doc<"products">["platform"];
            productId: string;
            productKind?: string;
          } => row.productKind === undefined && Boolean(row.productId),
        )
        .map((row) => [productTypeKey(row.platform, row.productId), row]),
    ).entries(),
  ];
  const products = await Promise.all(
    keys.map(([, row]) =>
      ctx.db
        .query("products")
        .withIndex("by_project_and_platform_and_product", (q) =>
          q
            .eq("projectId", projectId)
            .eq("platform", row.platform)
            .eq("productId", row.productId),
        )
        .unique(),
    ),
  );
  return new Map(
    products
      .filter((product): product is Doc<"products"> => product !== null)
      .map((product) => [
        productTypeKey(product.platform, product.productId),
        product.type,
      ]),
  );
}

// Access at the end of a day. `expiresAt` wins over state: an Active sub past
// it does not count, an Expired or billing-retry sub before it does. Without
// an expiry only Active and grace-period rows count, since the day an Expired
// or billing-retry row lost access is unknown.
export function isActiveAt(sub: Doc<"subscriptions">, dayEnd: number): boolean {
  if (sub.startedAt > dayEnd || isMisrecordedApplePass(sub)) return false;
  if (!COUNTED_STATES.has(sub.state)) return false;
  if (typeof sub.expiresAt === "number") {
    return sub.expiresAt > dayEnd;
  }
  return sub.state === "Active" || sub.state === "InGracePeriod";
}

// Replaces the given days' rows rather than diffing them: tens of rows per
// project. Queries and deletes run under Promise.all to overlap round trips.
async function commitBuckets(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  days: string[],
  buckets: Iterable<RollupBucket>,
  run: RunSummary,
): Promise<void> {
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

  await Promise.all(
    Array.from(buckets)
      .filter((bucket) => !isAllZeroBucket(bucket))
      .map((bucket) =>
        ctx.db.insert("revenueMetricsDaily", {
          projectId,
          ...bucket,
          updatedAt: run.runStartedAt,
        }),
      ),
  );
}
