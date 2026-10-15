// Daily revenue rollups. Reads `webhookEvents` (Apple ASN v2 and Google RTDN)
// and writes per-(project, day, productId, currency, platform, environment)
// rows to `revenueMetricsDaily`. Legacy synthetic Horizon reconciler rows are
// excluded.
//
// Metric definitions (UTC days; list price in the store's currency, before
// store fees; IAPKit never converts currencies):
// - revenueMicros: gross list price of paid charges (paid starts, trial
//   conversions, renewals, billing recoveries). Free trial periods add 0.
// - refundedMicros: store-reported amount of refunds, less refund reversals.
// - newSubs: subscription starts, free trials included, refund reversals not.
// - trialStarts / trialConversions / directPaidStarts: see `applyEventToBucket`.
// - renewals: paid renewals and billing recoveries, except a trial's first
//   paid charge, which is a conversion.
// - cancellations: auto-renew turned off, less turned back on. Not churn.
// - expirations: paid access actually ended (store expiry notification).
// - refunds: refunds, less refund reversals. Apple REVOKE (Family Sharing) is
//   not a refund.
// - activeSubs / activeTrials: end-of-day snapshot of subscriptions with
//   access, and the subset still in a free trial. Billing retry has no access.
//
// Each cron tick recomputes the last 3 days, so a notification up to 3 days
// late still lands on its day: Apple retries for up to 5 days and Google
// Pub/Sub for 7, but nearly all late ones arrive within 48h. Later arrivals
// are counted as pending and trigger a bounded catch-up over the retained
// event window (see `markRevenueMetricsRun`).
//
// Like `recomputeSubscriptionStats`, each project's recompute is a chain of
// scheduled pages, each with its own read budget: events in the kickoff, then
// counted-state subscriptions via `by_project_and_state_and_updated`, newest
// first, then the commit.

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
  isInTrialAt,
  isPaidCharge,
  isRefund,
  isTrialStart,
  subscriptionEnvironment,
  type AnalyticsEnvironment,
} from "./analyticsFacts";
import { analyticsEnvironmentValidator } from "../utils/validation";

// Raising this past ~7 days reads more events for almost no gain: later events
// are rare and handled by the catch-up below.
const TRAILING_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

// Rebuilds and catch-ups reach back as far as events are retained.
const RETAINED_DAYS = Math.floor(WEBHOOK_RETENTION_MS / DAY_MS);

// Bump when a metric's definition changes: each project then rebuilds its
// retained window once, and `definitionsFromDay` marks where the new
// definitions start.
export const ROLLUP_DEFINITIONS_VERSION = 2;

// A catch-up rereads up to 30 days of events, so it runs at most this often.
const CATCH_UP_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

const COHORTS_INTERVAL_MS = DAY_MS;

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
  environment: analyticsEnvironmentValidator,
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

const COUNTERS = [
  "activeSubs",
  "activeTrials",
  "newSubs",
  "trialStarts",
  "trialConversions",
  "directPaidStarts",
  "renewals",
  "cancellations",
  "expirations",
  "refunds",
  "revenueMicros",
  "refundedMicros",
] as const;

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
// Analytics soon) and then subscriptionStats; the stalest statuses fill the
// rest of the batch. Filling from stale rows first would rotate the same cohort
// forever once it reached `batchSize`, leaving new projects' Analytics empty.
export const recomputeAllRevenueMetrics = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({ scheduled: v.number() }),
  handler: async (ctx, args) => {
    const limit = args.batchSize ?? 100;
    const projects = await pickRevenueMetricsProjects(ctx, limit);

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

export async function pickRevenueMetricsProjects(
  ctx: RevenueMetricsPickerCtx,
  limit: number,
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

  const stale = await ctx.db
    .query("revenueMetricsRunStatus")
    .withIndex("by_run")
    .order("asc")
    .take(scanCap);
  for (const row of stale) {
    addProjectOnce(projects, seen, row.projectId, limit);
    if (projects.length >= limit) return projects;
  }

  return projects;
}

// Per-project kickoff; chains `recomputeRevenueMetricsPage` mutations so any
// number of subscriptions fits the per-mutation read limit. `fromDay` widens
// the window for a late-event catch-up.
export const recomputeRevenueMetricsForProject = internalMutation({
  args: { projectId: v.id("projects"), fromDay: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runRecompute(ctx, args.projectId, Date.now(), args.fromDay);
    return null;
  },
});

// Reads per mutation, not per project: 50k events take ~10 chained pages, each
// well under the 32k read budget.
const EVENTS_PAGE_SIZE = 5_000;

// Same for subscriptions: 50k active subs take ~10 chained pages.
const SUBS_PAGE_SIZE = 5_000;

// Above this many buckets, commit one day per mutation. Each bucket is a delete
// plus an insert against Convex's 8192-write limit (100 SKUs × 5 currencies × 2
// platforms × 3 days is 6000 writes).
const COMMIT_INLINE_BUCKET_LIMIT = 500;

// A day whose deletes plus inserts exceed this deletes first, then inserts in
// chained `commitRevenueMetricsDayInsertChunk` mutations of INSERT_CHUNK_SIZE.
// 7000 leaves headroom under 8192 for the reads and the run-status upsert.
const COMMIT_DAY_WRITES_LIMIT = 7_000;
const INSERT_CHUNK_SIZE = 3_500;

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
// Late events seen by this run that no earlier catch-up covered.
const lateValidator = v.object({
  count: v.number(),
  oldestDay: v.optional(v.string()),
});
// What the last catch-up covered: events received by `at` for days from
// `fromDay`.
const coveredValidator = v.object({ at: v.number(), fromDay: v.string() });
const runSummaryValidator = v.object({
  runStartedAt: v.number(),
  firstDay: v.string(),
  late: lateValidator,
});

type LateEvents = Infer<typeof lateValidator>;
type CatchUpCoverage = Infer<typeof coveredValidator>;
type RunSummary = Infer<typeof runSummaryValidator>;

export type RecomputeRevenueMetricsPageArgs = {
  projectId: Id<"projects">;
  days: string[];
  buckets: RollupBucket[];
  cursor: Infer<typeof cursorValidator>;
  runStartedAt: number;
  late: LateEvents;
  covered?: CatchUpCoverage;
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

// Records the run, then asks for a catch-up when late events wait and the
// daily cohort job when it is due. Per-day commits call this once per day;
// the request timestamps keep the follow-ups from being scheduled twice.
async function markRevenueMetricsRun(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  run: RunSummary,
): Promise<void> {
  const existing = await getRunStatus(ctx, projectId);
  const wide = run.firstDay < trailingFirstDay(run.runStartedAt);
  const previousFromDay =
    existing?.definitionsVersion === ROLLUP_DEFINITIONS_VERSION
      ? existing.definitionsFromDay
      : undefined;
  const definitionsFromDay =
    previousFromDay !== undefined && previousFromDay < run.firstDay
      ? previousFromDay
      : run.firstDay;

  const catchUpDue =
    run.late.count > 0 &&
    run.late.oldestDay !== undefined &&
    (existing?.catchUpRequestedAt === undefined ||
      run.runStartedAt - existing.catchUpRequestedAt >=
        CATCH_UP_MIN_INTERVAL_MS);
  const cohortsDue =
    existing?.cohortsRequestedAt === undefined ||
    run.runStartedAt - existing.cohortsRequestedAt >= COHORTS_INTERVAL_MS;

  const fields = {
    lastRunAt: run.runStartedAt,
    definitionsVersion: ROLLUP_DEFINITIONS_VERSION,
    definitionsFromDay,
    pendingLateEvents: run.late.count,
    oldestPendingLateDay: run.late.oldestDay,
    ...(wide
      ? { lastCatchUpAt: run.runStartedAt, lastCatchUpFromDay: run.firstDay }
      : {}),
    ...(catchUpDue ? { catchUpRequestedAt: run.runStartedAt } : {}),
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
  if (cohortsDue) {
    await ctx.scheduler.runAfter(
      0,
      internal.subscriptions.revenueCohorts.recomputeRevenueCohortsPage,
      { projectId, asOf: run.runStartedAt, cursor: null, buckets: [] },
    );
  }
}

// Builds the window and starts the chain: events, then counted-state
// subscriptions, then the commit, carrying one buckets map through the
// scheduler. Exported so tests can drive it without the cron; small datasets
// need one page per phase.
//
// The window is the trailing 3 days, widened to the retained event window
// when the project's rows follow older definitions (or none exist yet), or
// back to `fromDay` for a catch-up.
export async function runRecompute(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  now: number,
  fromDay?: string,
): Promise<void> {
  if (!(await getWritableProject(ctx, projectId))) return;
  const status = await getRunStatus(ctx, projectId);
  const retainedFirst = retainedFirstDay(now);
  let firstDay =
    status?.definitionsVersion === ROLLUP_DEFINITIONS_VERSION
      ? trailingFirstDay(now)
      : retainedFirst;
  if (fromDay !== undefined && fromDay < firstDay) {
    firstDay = fromDay < retainedFirst ? retainedFirst : fromDay;
  }

  // Every day gets a row, so a day without events still shows its activeSubs
  // instead of vanishing from the chart.
  const today = utcDayKey(now);
  const days: string[] = [];
  for (let day = firstDay; day <= today; day = addUtcDays(day, 1)) {
    days.push(day);
  }

  await processEventsPage(ctx, {
    projectId,
    days,
    buckets: new Map(),
    paginationCursor: null,
    runStartedAt: now,
    late: { count: 0 },
    covered:
      status?.lastCatchUpAt !== undefined &&
      status.lastCatchUpFromDay !== undefined
        ? { at: status.lastCatchUpAt, fromDay: status.lastCatchUpFromDay }
        : undefined,
  });
}

// One page of `webhookEvents` into the event counters; `activeSubs` comes
// from processSubsPage. The subscriptions phase starts in a new mutation,
// since Convex allows one paginated query per mutation.
//
// Scans by `receivedAt` (the indexed field) but buckets by `occurredAt`, so a
// renewal delivered a day late stays on its own day. Receivers set `receivedAt`
// at HTTP receipt and `occurredAt` from the store (Apple `signedDate`, Google
// `eventTimeMillis`), so `receivedAt >= occurredAt` and every event that
// belongs in the window is scanned.
async function processEventsPage(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    days: string[];
    buckets: Map<BucketKey, RollupBucket>;
    paginationCursor: string | null;
    runStartedAt: number;
    late: LateEvents;
    covered?: CatchUpCoverage;
  },
): Promise<void> {
  const { projectId, days, buckets, runStartedAt, covered } = args;
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const retainedFirst = retainedFirstDay(runStartedAt);
  const late = { ...args.late };

  const result = await ctx.db
    .query("webhookEvents")
    .withIndex("by_project_and_received", (q) =>
      q
        .eq("projectId", projectId)
        .gte("receivedAt", Date.parse(`${firstDay}T00:00:00.000Z`))
        .lte("receivedAt", runStartedAt),
    )
    .paginate({ numItems: EVENTS_PAGE_SIZE, cursor: args.paginationCursor });
  const productTypes = await productTypesForRows(ctx, projectId, result.page);

  for (const event of result.page) {
    // Android revenue metrics are the Google Play series.
    if (event.store === "amazon") continue;
    // Legacy events from the removed Horizon reconciler were synthetic guesses
    // rather than store notifications. Keep the schema literal so existing
    // rows remain readable, but never fold those rows into revenue metrics.
    if (event.source === "MetaHorizonReconciler") continue;
    if (!event.productId) continue;
    const catalogType = productTypes.get(
      productTypeKey(event.platform, event.productId),
    );
    if (!isSubscriptionAnalyticsEvent(event, catalogType)) {
      continue;
    }
    const day = utcDayKey(event.occurredAt);
    // Outside the window commitBuckets does not rewrite the row, so writing
    // here would double-count or clobber it. A late event a catch-up has not
    // covered is counted so the next catch-up can fold it in; one older than
    // the retained window can never be, and is left out.
    if (day < firstDay) {
      const isCovered =
        covered !== undefined &&
        event.receivedAt <= covered.at &&
        day >= covered.fromDay;
      if (!isCovered && day >= retainedFirst) {
        late.count += 1;
        if (late.oldestDay === undefined || day < late.oldestDay) {
          late.oldestDay = day;
        }
      }
      continue;
    }
    if (day > lastDay) continue;
    const bucket = getOrCreateBucket(buckets, {
      day,
      productId: event.productId,
      currency: event.currency ?? "",
      platform: event.platform,
      environment: analyticsEnvironment(event.environment),
    });
    applyEventToBucket(bucket, event, catalogType);
  }

  // New mutation either way: this one already used its paginated query.
  await scheduleRecomputePage(ctx, {
    projectId,
    days,
    buckets: Array.from(buckets.values()),
    cursor: result.isDone
      ? { phase: "subs", stateIdx: 0, paginationCursor: null }
      : { phase: "events", paginationCursor: result.continueCursor },
    runStartedAt,
    late,
    covered,
  });
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
  const { projectId, days, buckets } = args;
  const dayEnds = days.map((day) => Date.parse(`${day}T23:59:59.999Z`));
  const { stateIdx, paginationCursor } = args.cursor;
  const run: RunSummary = {
    runStartedAt: args.runStartedAt,
    firstDay: days[0],
    late: args.late,
  };

  if (stateIdx >= COUNTED_STATES_ORDERED.length) {
    await commitOrSchedulePerDay(ctx, projectId, days, buckets, run);
    return;
  }

  const state: CountedState = COUNTED_STATES_ORDERED[stateIdx];
  const result = await ctx.db
    .query("subscriptions")
    .withIndex("by_project_and_state_and_updated", (q) =>
      q.eq("projectId", projectId).eq("state", state),
    )
    .order("desc")
    .paginate({ numItems: SUBS_PAGE_SIZE, cursor: paginationCursor });
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
    await commitOrSchedulePerDay(ctx, projectId, days, buckets, run);
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
    runStartedAt: args.runStartedAt,
    late: args.late,
    covered: args.covered,
  });
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
    runStartedAt: v.number(),
    late: lateValidator,
    covered: v.optional(coveredValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runRecomputePage(ctx, args);
    return null;
  },
});

export async function runRecomputePage(
  ctx: MutationCtx,
  args: RecomputeRevenueMetricsPageArgs,
): Promise<void> {
  if (!(await getWritableProject(ctx, args.projectId))) return;
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
    return;
  }
  await processSubsPage(ctx, {
    ...args,
    buckets,
    cursor: {
      stateIdx: args.cursor.stateIdx,
      paginationCursor: args.cursor.paginationCursor,
    },
  });
}

// Commits one day's buckets when a project is over COMMIT_INLINE_BUCKET_LIMIT:
// replaces the day's rows and upserts `revenueMetricsRunStatus`, so the picker
// rotates even if another day's commit never runs. Days commit in parallel; OCC
// retries make the shared upsert safe.
export const commitRevenueMetricsDay = internalMutation({
  args: {
    projectId: v.id("projects"),
    day: v.string(),
    buckets: accumulatorValidator,
    run: runSummaryValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!(await getWritableProject(ctx, args.projectId))) return null;
    const existing = await ctx.db
      .query("revenueMetricsDaily")
      .withIndex("by_project_and_day_and_currency", (q) =>
        q.eq("projectId", args.projectId).eq("day", args.day),
      )
      .collect();
    const nonZero = args.buckets.filter((b) => !isAllZeroBucket(b));

    // Over COMMIT_DAY_WRITES_LIMIT: delete here, then chain insert chunks.
    if (existing.length + nonZero.length <= COMMIT_DAY_WRITES_LIMIT) {
      await Promise.all(existing.map((row) => ctx.db.delete(row._id)));
      await Promise.all(
        nonZero.map((bucket) =>
          insertBucket(ctx, args.projectId, bucket, args.run.runStartedAt),
        ),
      );
      await markRevenueMetricsRun(ctx, args.projectId, args.run);
      return null;
    }

    if (existing.length > COMMIT_DAY_WRITES_LIMIT) {
      // Deletes are not chained: over 7k existing rows for one day is
      // implausible and would have broken the write limit when they were
      // written. Fail loudly rather than delete partially.
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
          run: args.run,
        },
      );
    }
    await markRevenueMetricsRun(ctx, args.projectId, args.run);
    return null;
  },
});

// Insert chunk for a day over COMMIT_DAY_WRITES_LIMIT, after
// commitRevenueMetricsDay deleted the old rows (~10k buckets take ~3 chunks).
// The chunks and the day commit all mark the run; the upsert is OCC-safe.
export const commitRevenueMetricsDayInsertChunk = internalMutation({
  args: {
    projectId: v.id("projects"),
    day: v.string(),
    buckets: accumulatorValidator,
    run: runSummaryValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!(await getWritableProject(ctx, args.projectId))) return null;
    await Promise.all(
      args.buckets.map((bucket) =>
        insertBucket(ctx, args.projectId, bucket, args.run.runStartedAt),
      ),
    );
    await markRevenueMetricsRun(ctx, args.projectId, args.run);
    return null;
  },
});

function insertBucket(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  bucket: RollupBucket,
  runStartedAt: number,
): Promise<Id<"revenueMetricsDaily">> {
  return ctx.db.insert("revenueMetricsDaily", {
    projectId,
    ...bucket,
    updatedAt: runStartedAt,
  });
}

// Inline for small projects, one scheduled mutation per day above
// COMMIT_INLINE_BUCKET_LIMIT.
async function commitOrSchedulePerDay(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  days: string[],
  buckets: Map<BucketKey, RollupBucket>,
  run: RunSummary,
): Promise<void> {
  if (buckets.size <= COMMIT_INLINE_BUCKET_LIMIT) {
    await commitBuckets(ctx, projectId, days, buckets, run.runStartedAt);
    await markRevenueMetricsRun(ctx, projectId, run);
    return;
  }

  // Each scheduled day gets only its own buckets, keeping args far below the
  // ~1MB scheduler limit.
  const bucketsByDay = new Map<string, RollupBucket[]>();
  for (const day of days) bucketsByDay.set(day, []);
  for (const bucket of buckets.values()) {
    bucketsByDay.get(bucket.day)?.push(bucket);
  }

  for (const day of days) {
    await ctx.scheduler.runAfter(
      0,
      internal.subscriptions.revenueMetrics.commitRevenueMetricsDay,
      {
        projectId,
        day,
        buckets: bucketsByDay.get(day) ?? [],
        run,
      },
    );
  }
}

// A computed day with no rows is a real zero; `definitionsFromDay` and
// `lastRunAt` tell readers which days were computed.
function isAllZeroBucket(bucket: RollupBucket): boolean {
  return COUNTERS.every((counter) => bucket[counter] === 0);
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
    bucket = {
      ...identity,
      activeSubs: 0,
      activeTrials: 0,
      newSubs: 0,
      trialStarts: 0,
      trialConversions: 0,
      directPaidStarts: 0,
      renewals: 0,
      cancellations: 0,
      expirations: 0,
      refunds: 0,
      revenueMicros: 0,
      refundedMicros: 0,
    };
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
// Restores never reach here: only store notifications are counted, and a
// restore re-verifies an existing purchase without one.
export function applyEventToBucket(
  bucket: RollupBucket,
  event: Doc<"webhookEvents">,
  catalogType?: Doc<"products">["type"],
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
    } else if (event.type === "SubscriptionStarted") {
      bucket.newSubs += 1;
      if (event.paidStart === "direct") bucket.directPaidStarts += 1;
    } else {
      bucket.renewals += 1;
    }
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
      bucket.expirations += 1;
      break;
    default:
      // Lifecycle-only events (grace period, billing retry, price change, a
      // free promotional renewal, ...) carry no counter.
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

async function commitBuckets(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  days: string[],
  buckets: Map<BucketKey, RollupBucket>,
  now: number,
): Promise<void> {
  // Replace the window's rows rather than diff them; it is tens of rows per
  // project. Queries and deletes run under Promise.all to overlap round trips.
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
    Array.from(buckets.values())
      .filter((bucket) => !isAllZeroBucket(bucket))
      .map((bucket) => insertBucket(ctx, projectId, bucket, now)),
  );
}
