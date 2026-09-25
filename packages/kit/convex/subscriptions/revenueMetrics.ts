// Daily revenue rollups. Reads `webhookEvents` (Apple ASN v2 and Google RTDN)
// over a trailing window and writes per-(project, day, productId, currency)
// rows to `revenueMetricsDaily`. Legacy synthetic Horizon reconciler rows are
// excluded.
//
// Renewals come from the event log because `subscriptions` holds only each
// entitlement's current state. `activeSubs` is an end-of-day snapshot, computed
// from `subscriptions` in the same per-project pass.
//
// Each cron tick recomputes the last 3 days, so a notification up to 3 days
// late still lands on its day: Apple retries for up to 5 days and Google
// Pub/Sub for 7, but nearly all late ones arrive within 48h (RevenueCat uses
// the same window).
//
// Like `recomputeSubscriptionStats`, each project's recompute is a chain of
// scheduled pages, each with its own read budget: events in the kickoff, then
// counted-state subscriptions via `by_project_and_state_and_updated`, newest
// first, then the commit.

import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { getWritableProject } from "../projects/writable";

// Raising this past ~7 days reads more events for almost no gain: later events
// are vanishingly rare (the stores route them to manual reconciliation).
const TRAILING_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

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

// (day, productId, currency, platform): one SKU in several currencies or
// platforms gets separate buckets, as in `revenueMetricsDaily`'s index.
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

// States scanned for activeSubs. `Expired` is included so a sub that expired
// yesterday still counts on the days it was active; `isActiveAt` drops it after
// expiry.
const COUNTED_STATES = new Set([
  "Active",
  "InGracePeriod",
  "InBillingRetry",
  "Expired",
] as const);

// Pagination cursors index into this list: append new states at the end, or
// in-flight cursors break.
const COUNTED_STATES_ORDERED = [
  "Active",
  "InGracePeriod",
  "InBillingRetry",
  "Expired",
] as const;
type CountedState = (typeof COUNTED_STATES_ORDERED)[number];

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

async function hasRevenueMetricsRunStatus(
  ctx: RevenueMetricsPickerCtx,
  projectId: Id<"projects">,
): Promise<boolean> {
  const existing = await ctx.db
    .query("revenueMetricsRunStatus")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .unique();
  return existing !== null;
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
  if (await hasRevenueMetricsRunStatus(ctx, projectId)) return;
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
// number of subscriptions fits the per-mutation read limit.
export const recomputeRevenueMetricsForProject = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runRecompute(ctx, args.projectId, Date.now());
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

type RecomputeRevenueMetricsCursor =
  | { phase: "events"; paginationCursor: string | null }
  | {
      phase: "subs";
      stateIdx: number;
      paginationCursor: string | null;
    };

export type RecomputeRevenueMetricsPageArgs = {
  projectId: Id<"projects">;
  days: string[];
  buckets: RollupBucket[];
  cursor: RecomputeRevenueMetricsCursor;
  runStartedAt: number;
};

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

// Builds the window and starts the chain: events, then counted-state
// subscriptions, then the commit, carrying one buckets map through the
// scheduler. Exported so tests can drive it without the cron; small datasets
// need one page per phase.
export async function runRecompute(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  now: number,
): Promise<void> {
  if (!(await getWritableProject(ctx, projectId))) return;
  const todayStart = startOfUtcDay(now);
  const windowStart = todayStart - (TRAILING_DAYS - 1) * DAY_MS;
  // Inclusive; events received after this run land in the next tick.
  const windowEnd = now;

  // Every day gets a row, so a day without events still shows its activeSubs
  // instead of vanishing from the chart.
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

// One page of `webhookEvents` into the event counters (newSubs, renewals,
// cancellations, refunds, revenueMicros); `activeSubs` comes from
// processSubsPage. The subscriptions phase starts in a new mutation, since
// Convex allows one paginated query per mutation.
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
  const productTypes = await productTypesForRows(ctx, projectId, result.page);

  for (const event of result.page) {
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
    // here would double-count or clobber it.
    if (day < firstDay || day > lastDay) continue;
    const currency = event.currency ?? "";
    // The webhookEvents schema only allows `IOS` / `Android` for platform.
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
    applyEventToBucket(bucket, event, catalogType);
  }

  if (result.isDone) {
    // New mutation: this one already used its paginated query.
    await scheduleRecomputePage(ctx, {
      projectId,
      days,
      buckets: Array.from(buckets.values()),
      cursor: { phase: "subs", stateIdx: 0, paginationCursor: null },
      runStartedAt,
    });
    return;
  }

  // More events to read. Serialize the accumulator + cursor and
  // chain a fresh events page.
  await scheduleRecomputePage(ctx, {
    projectId,
    days,
    buckets: Array.from(buckets.values()),
    cursor: { phase: "events", paginationCursor: result.continueCursor },
    runStartedAt,
  });
}

// One page of one counted state per mutation; even an empty state chains to the
// next, since each `paginate()` uses the mutation's one allowance. Adds
// activeSubs to the event buckets and commits after the last page.
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
  const { stateIdx, paginationCursor } = args.cursor;

  if (stateIdx >= COUNTED_STATES_ORDERED.length) {
    // All counted states processed — commit.
    await commitOrSchedulePerDay(ctx, projectId, days, buckets, runStartedAt);
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
    if (
      sub.productKind !== "subscription" &&
      productTypes.get(productTypeKey(sub.platform, sub.productId)) !==
        "Subscription"
    ) {
      continue;
    }
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

  if (!result.isDone) {
    await scheduleRecomputePage(ctx, {
      projectId,
      days,
      buckets: Array.from(buckets.values()),
      cursor: {
        phase: "subs",
        stateIdx,
        paginationCursor: result.continueCursor,
      },
      runStartedAt,
    });
    return;
  }

  const nextStateIdx = stateIdx + 1;
  if (nextStateIdx >= COUNTED_STATES_ORDERED.length) {
    await commitOrSchedulePerDay(ctx, projectId, days, buckets, runStartedAt);
    return;
  }

  await scheduleRecomputePage(ctx, {
    projectId,
    days,
    buckets: Array.from(buckets.values()),
    cursor: {
      phase: "subs",
      stateIdx: nextStateIdx,
      paginationCursor: null,
    },
    runStartedAt,
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
    return;
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
    runStartedAt: v.number(),
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
        nonZero.map((bucket) => insertBucket(ctx, args, bucket)),
      );
      await markRevenueMetricsRun(ctx, args.projectId, args.runStartedAt);
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
          runStartedAt: args.runStartedAt,
        },
      );
    }
    await markRevenueMetricsRun(ctx, args.projectId, args.runStartedAt);
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
    runStartedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!(await getWritableProject(ctx, args.projectId))) return null;
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

// Inline for small projects, one scheduled mutation per day above
// COMMIT_INLINE_BUCKET_LIMIT.
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

  // Each scheduled day gets only its own buckets, keeping args far below the
  // ~1MB scheduler limit.
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
  catalogType?: Doc<"products">["type"],
): void {
  // One-time notifications share legacy internal event names with subscription
  // events, but they are operational-only and must not enter subscription
  // revenue, new-subscription, or refund counters.
  if (!isSubscriptionAnalyticsEvent(event, catalogType)) return;
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
      // A day may go negative: a cancel and an uncancel on different days must
      // still net to zero when the dashboard sums a period.
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
      // Lifecycle-only events (Expired, InGracePeriod, ...) show in
      // `metricsSummary`'s live counters instead.
      break;
  }
  // No clamps: refunds never subtract from `revenueMicros`, and a clamp would
  // hide a cross-period offset if a future event did.
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

export function isActiveAt(sub: Doc<"subscriptions">, dayEnd: number): boolean {
  if (sub.startedAt > dayEnd) return false;
  if (!COUNTED_STATES.has(sub.state as "Active")) return false;
  // `expiresAt` wins over state: an Active sub past it does not count, an
  // Expired sub before it does.
  if (typeof sub.expiresAt === "number") {
    return sub.expiresAt > dayEnd;
  }
  // No expiry on file: the other counted states count as active; an Expired sub
  // never counts, since the day it stopped is unknown.
  return sub.state !== "Expired";
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

  const inserts: Array<Promise<unknown>> = [];
  for (const bucket of buckets.values()) {
    // Skip all-zero buckets, e.g. a sub refunded the day it started.
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
