import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { ErrorCode, createError } from "../utils/errors";

// Per-job hard ceiling. Convex actions cap at ~10min; we allow 9min
// for the worker and rely on the reaper to mark anything still
// running 1min past that as failed.
export const PRODUCT_SYNC_JOB_DEADLINE_MS = 9 * 60 * 1_000;
export const PRODUCT_SYNC_REAPER_GRACE_MS = 60 * 1_000;
export const PRODUCT_SYNC_SUCCEEDED_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
export const PRODUCT_SYNC_FAILED_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
export const PRODUCT_SYNC_FAILURES_CAP = 200;

// Cap the failures array stored on the job row so a runaway sync
// (every product fails for the same upstream config reason) doesn't
// blow past Convex's per-document size budget. The dashboard sees
// `failuresTruncated: true` and renders a notice; the operator can
// re-run after fixing the root cause.
export function truncateFailures<
  T extends { productId: string; reason: string },
>(failures: T[]): { items: T[]; truncated: boolean } {
  if (failures.length <= PRODUCT_SYNC_FAILURES_CAP) {
    return { items: failures, truncated: false };
  }
  return {
    items: failures.slice(0, PRODUCT_SYNC_FAILURES_CAP),
    truncated: true,
  };
}

const platformValidator = v.union(v.literal("IOS"), v.literal("Android"));
const directionValidator = v.union(
  v.literal("pull"),
  v.literal("push"),
  v.literal("both"),
  v.literal("purge-local"),
);

async function requireProjectMember(
  ctx: QueryCtx,
  apiKey: string,
): Promise<{ project: Doc<"projects">; userId: Id<"users"> }> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw createError(ErrorCode.NOT_AUTHENTICATED);
  }
  const project = await ctx.db
    .query("projects")
    .withIndex("by_api_key", (q) => q.eq("apiKey", apiKey))
    .first();
  if (!project) {
    throw createError(ErrorCode.PROJECT_NOT_FOUND);
  }
  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_org_and_user", (q) =>
      q.eq("organizationId", project.organizationId).eq("userId", userId),
    )
    .first();
  if (!membership) {
    throw createError(ErrorCode.NOT_ORGANIZATION_MEMBER);
  }
  return { project, userId };
}

async function requireJobAccess(
  ctx: QueryCtx,
  jobId: Id<"productSyncJobs">,
): Promise<{ job: Doc<"productSyncJobs">; userId: Id<"users"> }> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw createError(ErrorCode.NOT_AUTHENTICATED);
  }
  const job = await ctx.db.get(jobId);
  if (!job) {
    throw createError(ErrorCode.INVALID_INPUT, "Sync job not found");
  }
  const project = await ctx.db.get(job.projectId);
  if (!project) {
    throw createError(ErrorCode.PROJECT_NOT_FOUND);
  }
  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_org_and_user", (q) =>
      q.eq("organizationId", project.organizationId).eq("userId", userId),
    )
    .first();
  if (!membership) {
    throw createError(ErrorCode.NOT_ORGANIZATION_MEMBER);
  }
  return { job, userId };
}

// Latest job (any status) for a project+platform — drives the
// dashboard's button state, progress, and last-result toast.
export const getActiveSyncJob = query({
  args: {
    apiKey: v.string(),
    platform: platformValidator,
  },
  handler: async (ctx, args) => {
    const { project } = await requireProjectMember(ctx, args.apiKey);
    return await ctx.db
      .query("productSyncJobs")
      .withIndex("by_project_and_created", (q) =>
        q.eq("projectId", project._id),
      )
      .filter((q) => q.eq(q.field("platform"), args.platform))
      .order("desc")
      .first();
  },
});

export const getSyncJobById = query({
  args: { jobId: v.id("productSyncJobs") },
  handler: async (ctx, args) => {
    const { job } = await requireJobAccess(ctx, args.jobId);
    return job;
  },
});

// Idempotent enqueue: if there's already a queued/running job for this
// (project, platform) we return the existing jobId so a double-tap or
// page reload doesn't fan out duplicate workers.
export const enqueueProductSync = mutation({
  args: {
    apiKey: v.string(),
    platform: platformValidator,
    direction: v.optional(directionValidator),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    jobId: v.id("productSyncJobs"),
    deduped: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { project, userId } = await requireProjectMember(ctx, args.apiKey);
    const existingActive = await ctx.db
      .query("productSyncJobs")
      .withIndex("by_project_platform_status", (q) =>
        q
          .eq("projectId", project._id)
          .eq("platform", args.platform)
          .eq("status", "queued"),
      )
      .first();
    const existingRunning = await ctx.db
      .query("productSyncJobs")
      .withIndex("by_project_platform_status", (q) =>
        q
          .eq("projectId", project._id)
          .eq("platform", args.platform)
          .eq("status", "running"),
      )
      .first();
    const existing = existingActive ?? existingRunning;
    if (existing) {
      return { jobId: existing._id, deduped: true };
    }
    const now = Date.now();
    const jobId = await ctx.db.insert("productSyncJobs", {
      projectId: project._id,
      platform: args.platform,
      direction: args.direction ?? "both",
      dryRun: args.dryRun ?? false,
      status: "queued",
      progress: { phase: "queued" },
      createdBy: userId,
      createdAt: now,
    });
    if (args.direction === "purge-local") {
      // Purge runs in this module's V8-isolate runtime — no Apple
      // credentials, no Play OAuth, no `"use node"` cost. Just a
      // bounded delete loop against `products`.
      await ctx.scheduler.runAfter(
        0,
        internal.products.jobs.runProductSyncPurgeLocal,
        { jobId },
      );
    } else if (args.platform === "IOS") {
      await ctx.scheduler.runAfter(0, internal.products.asc.runProductSyncIOS, {
        jobId,
      });
    } else {
      await ctx.scheduler.runAfter(
        0,
        internal.products.play.runProductSyncAndroid,
        { jobId },
      );
    }
    return { jobId, deduped: false };
  },
});

// Worker for `direction: "purge-local"`. Empties kit's local
// `products` rows for the (project, platform) in page-bounded
// batches; never touches App Store Connect or Play Console. The
// next regular sync re-pulls from the upstream store, so this is
// the recovery hatch when kit's cache drifts (manual store edits,
// failed partial pushes, stale prices). Cancel checks between
// pages so an operator can stop a runaway wipe within seconds.
export const runProductSyncPurgeLocal = internalAction({
  args: { jobId: v.id("productSyncJobs") },
  handler: async (ctx, args): Promise<void> => {
    const job = await ctx.runQuery(internal.products.jobs.getJobForWorker, {
      jobId: args.jobId,
    });
    if (!job) return;
    if (job.status !== "queued") return;
    await ctx.runMutation(internal.products.jobs.markJobRunning, {
      jobId: args.jobId,
    });
    try {
      const PAGE = 100;
      let total = 0;
      // 200-page guard caps a runaway loop at 20k rows — far past
      // any real project's catalog. The bounded `take(limit + 1)`
      // inside `deletePlatformCatalog` decides `hasMore` from the
      // overflow row, so we exit cleanly the moment the page returns
      // short.
      for (let page = 0; page < 200; page += 1) {
        const cancelled = await ctx.runQuery(
          internal.products.jobs.isCancelRequested,
          { jobId: args.jobId },
        );
        if (cancelled) {
          await ctx.runMutation(internal.products.jobs.markJobFailed, {
            jobId: args.jobId,
            error: "Cancelled by operator",
          });
          return;
        }
        await ctx.runMutation(internal.products.jobs.updateJobProgress, {
          jobId: args.jobId,
          phase: "purge-local",
          current: total,
        });
        const { deleted, hasMore } = await ctx.runMutation(
          internal.products.sync.deletePlatformCatalog,
          {
            projectId: job.projectId,
            platform: job.platform,
            limit: PAGE,
          },
        );
        total += deleted;
        if (!hasMore) break;
      }
      await ctx.runMutation(internal.products.jobs.markJobSucceeded, {
        jobId: args.jobId,
        pulled: 0,
        pushed: 0,
        deleted: total,
        failures: [],
      });
    } catch (error) {
      await ctx.runMutation(internal.products.jobs.markJobFailed, {
        jobId: args.jobId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});

// Operator-initiated cancel. The worker checks `cancelRequested` at
// phase boundaries — granularity is per-phase, not per-product, but
// that's enough to stop a runaway sync within seconds on most paths.
export const cancelProductSync = mutation({
  args: { jobId: v.id("productSyncJobs") },
  handler: async (ctx, args) => {
    const { job } = await requireJobAccess(ctx, args.jobId);
    if (job.status !== "queued" && job.status !== "running") {
      return { ok: false, reason: "not active" as const };
    }
    await ctx.db.patch(job._id, { cancelRequested: true });
    return { ok: true as const };
  },
});

// Soft-dismiss a finished job from the dashboard. Doesn't delete the
// row (the pruner handles retention) — just makes a future
// `getActiveSyncJob` skip it.
//
// Implemented via a tombstone field instead of a status change so
// audit-style queries can still see succeeded/failed history.
export const dismissCompletedJob = mutation({
  args: { jobId: v.id("productSyncJobs") },
  handler: async (ctx, args) => {
    const { job } = await requireJobAccess(ctx, args.jobId);
    if (job.status !== "succeeded" && job.status !== "failed") {
      return { ok: false as const };
    }
    // Reuse `cancelRequested` as a dismissal marker would muddle
    // semantics; instead we shift `completedAt` into the past so the
    // active-job query (ordered desc by createdAt) still sees newer
    // jobs while the dashboard filter on the client treats this row
    // as "dismissed" via `dismissed: true`.
    await ctx.db.patch(job._id, {
      progress: { ...job.progress, phase: "dismissed" },
    });
    return { ok: true as const };
  },
});

// Worker-side helpers (internal — only the runner actions call these).

export const getJobForWorker = internalQuery({
  args: { jobId: v.id("productSyncJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

export const isCancelRequested = internalQuery({
  args: { jobId: v.id("productSyncJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    return job?.cancelRequested === true;
  },
});

export const markJobRunning = internalMutation({
  args: { jobId: v.id("productSyncJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    if (job.status !== "queued") return;
    const now = Date.now();
    await ctx.db.patch(args.jobId, {
      status: "running",
      startedAt: now,
      expectedDeadline: now + PRODUCT_SYNC_JOB_DEADLINE_MS,
      progress: { phase: "starting" },
    });
  },
});

export const updateJobProgress = internalMutation({
  args: {
    jobId: v.id("productSyncJobs"),
    phase: v.string(),
    current: v.optional(v.number()),
    total: v.optional(v.number()),
    failuresCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      progress: {
        phase: args.phase,
        current: args.current,
        total: args.total,
        failuresCount: args.failuresCount,
      },
    });
  },
});

export const markJobSucceeded = internalMutation({
  args: {
    jobId: v.id("productSyncJobs"),
    pulled: v.number(),
    pushed: v.number(),
    deleted: v.optional(v.number()),
    failures: v.array(v.object({ productId: v.string(), reason: v.string() })),
    plannedWrites: v.optional(
      v.array(
        v.object({
          productId: v.string(),
          step: v.string(),
          detail: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { items: failures, truncated } = truncateFailures(args.failures);
    await ctx.db.patch(args.jobId, {
      status: "succeeded",
      completedAt: Date.now(),
      progress: {
        phase: "completed",
        failuresCount: args.failures.length,
      },
      result: {
        pulled: args.pulled,
        pushed: args.pushed,
        ...(args.deleted !== undefined ? { deleted: args.deleted } : {}),
        failures,
        ...(truncated ? { failuresTruncated: true } : {}),
        ...(args.plannedWrites ? { plannedWrites: args.plannedWrites } : {}),
      },
    });
  },
});

export const markJobFailed = internalMutation({
  args: {
    jobId: v.id("productSyncJobs"),
    error: v.string(),
    pulled: v.optional(v.number()),
    pushed: v.optional(v.number()),
    failures: v.optional(
      v.array(v.object({ productId: v.string(), reason: v.string() })),
    ),
  },
  handler: async (ctx, args) => {
    const rawFailures = args.failures ?? [];
    const { items: failures, truncated } = truncateFailures(rawFailures);
    await ctx.db.patch(args.jobId, {
      status: "failed",
      completedAt: Date.now(),
      error: args.error,
      progress: {
        phase: "failed",
        failuresCount: failures.length,
      },
      result: {
        pulled: args.pulled ?? 0,
        pushed: args.pushed ?? 0,
        failures,
        ...(truncated ? { failuresTruncated: true } : {}),
      },
    });
  },
});

// Cron: flip `running` rows whose `expectedDeadline + grace` has
// passed to `failed("worker timed out")`. Without this, a crashed
// action permanently pins the project's "active job" slot.
export const reapStaleProductSyncJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - PRODUCT_SYNC_REAPER_GRACE_MS;
    const stale = await ctx.db
      .query("productSyncJobs")
      .withIndex("by_status_and_deadline", (q) =>
        q.eq("status", "running").lt("expectedDeadline", cutoff),
      )
      .take(50);
    for (const job of stale) {
      await ctx.db.patch(job._id, {
        status: "failed",
        completedAt: Date.now(),
        error: "Worker timed out — sync exceeded the 9-minute ceiling",
        progress: { phase: "reaped" },
      });
    }
    return { reaped: stale.length };
  },
});

// Cron: drop succeeded jobs older than 7d, failed older than 30d.
export const pruneProductSyncJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const succeededCutoff = now - PRODUCT_SYNC_SUCCEEDED_RETENTION_MS;
    const failedCutoff = now - PRODUCT_SYNC_FAILED_RETENTION_MS;
    const succeeded = await ctx.db
      .query("productSyncJobs")
      .withIndex("by_status_and_completed", (q) =>
        q.eq("status", "succeeded").lt("completedAt", succeededCutoff),
      )
      .take(100);
    const failed = await ctx.db
      .query("productSyncJobs")
      .withIndex("by_status_and_completed", (q) =>
        q.eq("status", "failed").lt("completedAt", failedCutoff),
      )
      .take(100);
    for (const row of [...succeeded, ...failed]) {
      await ctx.db.delete(row._id);
    }
    return { pruned: succeeded.length + failed.length };
  },
});
