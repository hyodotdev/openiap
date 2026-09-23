import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  resolveProjectByApiKeyFromDb,
  resolveProjectByIdForCurrentUserFromDb,
} from "../projects/helpers";
import { ErrorCode, createError } from "../utils/errors";
import { getWritableProject } from "../projects/writable";
import {
  PRODUCT_SYNC_JOB_DEADLINE_MS,
  PRODUCT_SYNC_MANUAL_ACTIONS_CAP,
  truncateManualActions,
  truncatePlannedWrites,
} from "./syncResult";

export {
  PRODUCT_SYNC_JOB_DEADLINE_MS,
  PRODUCT_SYNC_MANUAL_ACTIONS_CAP,
  truncateManualActions,
  truncatePlannedWrites,
};

export const PRODUCT_SYNC_REAPER_GRACE_MS = 60 * 1_000;
export const PRODUCT_SYNC_SUCCEEDED_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
export const PRODUCT_SYNC_FAILED_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
export const PRODUCT_SYNC_FAILURES_CAP = 200;
// Reaper/pruner batch sizes: enough for one tick to clear a typical backlog,
// small enough to stay within Convex's per-mutation document budget.
export const PRODUCT_SYNC_REAPER_BATCH = 50;
export const PRODUCT_SYNC_PRUNER_BATCH = 100;

// Caps stored failures so a runaway sync (every product failing for one
// config reason) stays within Convex's document size budget. The dashboard
// shows a notice when `failuresTruncated` is set.
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

// A valid secret `apiKey` is enough, as in `upsertProduct` and the
// `server/api/v1/products.ts` routes. A signed-in user is recorded on
// `createdBy`; server-to-server calls have none and must not be blocked.
async function resolveProjectByApiKey(
  ctx: QueryCtx | MutationCtx,
  apiKey: string,
): Promise<{ project: Doc<"projects">; userId: Id<"users"> | null }> {
  const resolved = await resolveProjectByApiKeyFromDb(ctx, apiKey, "admin");
  const project = resolved?.project ?? null;
  if (!project) {
    throw createError(ErrorCode.PROJECT_NOT_FOUND);
  }
  let userId: Id<"users"> | null = null;
  try {
    userId = await getAuthUserId(ctx);
  } catch {
    userId = null;
  }
  // A signed-in user must belong to the key's organization. Without one, the
  // secret apiKey is the only credential (server, MCP tool, SDK).
  if (userId) {
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();
    if (!membership) {
      throw createError(ErrorCode.NOT_ORGANIZATION_MEMBER);
    }
  }
  return { project, userId };
}

async function resolveProjectForReadArgs(
  ctx: QueryCtx,
  args: { apiKey?: string; projectId?: Id<"projects"> },
): Promise<Doc<"projects">> {
  if (args.projectId) {
    const resolved = await resolveProjectByIdForCurrentUserFromDb(
      ctx,
      args.projectId,
    );
    if (!resolved) {
      throw createError(ErrorCode.PROJECT_NOT_FOUND);
    }
    return resolved.project;
  }

  if (args.apiKey !== undefined) {
    return (await resolveProjectByApiKey(ctx, args.apiKey)).project;
  }

  throw createError(ErrorCode.INVALID_INPUT, "apiKey or projectId is required");
}

async function resolveProjectForMutationArgs(
  ctx: MutationCtx,
  args: { apiKey?: string; projectId?: Id<"projects"> },
): Promise<{ project: Doc<"projects">; userId: Id<"users"> | null }> {
  if (args.projectId) {
    const resolved = await resolveProjectByIdForCurrentUserFromDb(
      ctx,
      args.projectId,
    );
    if (!resolved) {
      throw createError(ErrorCode.PROJECT_NOT_FOUND);
    }
    return resolved;
  }

  if (args.apiKey !== undefined) {
    return resolveProjectByApiKey(ctx, args.apiKey);
  }

  throw createError(ErrorCode.INVALID_INPUT, "apiKey or projectId is required");
}

// The job must belong to the apiKey's project, so another project's key
// cannot read or cancel it.
async function resolveJobByApiKey(
  ctx: QueryCtx | MutationCtx,
  apiKey: string,
  rawJobId: string,
): Promise<{ job: Doc<"productSyncJobs">; project: Doc<"projects"> }> {
  const { project } = await resolveProjectByApiKey(ctx, apiKey);
  // Ids arrive from URL paths; a malformed one must read as "not found"
  // rather than fail argument validation into a 500.
  const jobId = ctx.db.normalizeId("productSyncJobs", rawJobId);
  const job = jobId ? await ctx.db.get(jobId) : null;
  if (!job) {
    throw createError(ErrorCode.INVALID_INPUT, "Sync job not found");
  }
  if (job.projectId !== project._id) {
    // Treat cross-project lookups as not-found rather than 403 to
    // avoid leaking job existence across projects.
    throw createError(ErrorCode.INVALID_INPUT, "Sync job not found");
  }
  return { job, project };
}

async function resolveJobForMutationArgs(
  ctx: MutationCtx,
  args: {
    apiKey?: string;
    projectId?: Id<"projects">;
    jobId: string;
  },
): Promise<{ job: Doc<"productSyncJobs">; project: Doc<"projects"> }> {
  const { project } = await resolveProjectForMutationArgs(ctx, args);
  const jobId = ctx.db.normalizeId("productSyncJobs", args.jobId);
  const job = jobId ? await ctx.db.get(jobId) : null;
  if (!job || job.projectId !== project._id) {
    throw createError(ErrorCode.INVALID_INPUT, "Sync job not found");
  }
  return { job, project };
}

// Latest job (any status) for a project+platform — drives the
// dashboard's button state, progress, and last-result toast.
export const getActiveSyncJob = query({
  args: {
    apiKey: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    platform: platformValidator,
  },
  handler: async (ctx, args) => {
    const project = await resolveProjectForReadArgs(ctx, args);
    return await ctx.db
      .query("productSyncJobs")
      .withIndex("by_project_platform_created", (q) =>
        q.eq("projectId", project._id).eq("platform", args.platform),
      )
      .order("desc")
      .first();
  },
});

export const getSyncJobById = query({
  args: {
    apiKey: v.string(),
    jobId: v.string(),
  },
  handler: async (ctx, args) => {
    const { job } = await resolveJobByApiKey(ctx, args.apiKey, args.jobId);
    return job;
  },
});

// Idempotent enqueue: if there's already a queued/running job for this
// (project, platform) we return the existing jobId so a double-tap or
// page reload doesn't fan out duplicate workers.
export const enqueueProductSync = mutation({
  args: {
    apiKey: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    platform: platformValidator,
    direction: v.optional(directionValidator),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    jobId: v.id("productSyncJobs"),
    deduped: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { project, userId } = await resolveProjectForMutationArgs(ctx, args);
    // Dedup through the project's `activeSyncJobIds` lock: concurrent
    // enqueues all read and patch the project doc, so OCC retries the losers,
    // which then see the lock. An index lookup alone would let both insert.
    const lockedJobId = project.activeSyncJobIds?.[args.platform];
    if (lockedJobId) {
      const lockedJob = await ctx.db.get(lockedJobId);
      if (
        lockedJob &&
        (lockedJob.status === "queued" || lockedJob.status === "running")
      ) {
        return { jobId: lockedJob._id, deduped: true };
      }
      // The lock points at a finished job, e.g. after a worker crash or a
      // reaper timeout; claim a fresh slot.
    }
    const now = Date.now();
    const jobId = await ctx.db.insert("productSyncJobs", {
      projectId: project._id,
      platform: args.platform,
      direction: args.direction ?? "both",
      dryRun: args.dryRun ?? false,
      status: "queued",
      progress: { phase: "queued" },
      ...(userId ? { createdBy: userId } : {}),
      createdAt: now,
    });
    await ctx.db.patch(project._id, {
      activeSyncJobIds: {
        ...(project.activeSyncJobIds ?? {}),
        [args.platform]: jobId,
      },
    });
    if (args.direction === "purge-local") {
      // Purge only deletes local rows, so it runs here in the V8 runtime
      // with no store credentials and no "use node" cost.
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

// Deletes kit's local products for the (project, platform) in pages without
// touching either store; the next sync pulls them back. The recovery path
// when kit's cache drifts. Cancellation is checked between pages.
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
      // 200 pages caps a runaway loop at 20k rows, far past any real catalog.
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

// Operator-initiated cancel. Workers check the flag at phase/chunk boundaries;
// remote clients and review helpers also check before requests, multipart
// upload operations, and asset-delivery polls.
export const cancelProductSync = mutation({
  args: {
    apiKey: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    jobId: v.string(),
  },
  handler: async (ctx, args) => {
    const { job } = await resolveJobForMutationArgs(ctx, args);
    if (job.status !== "queued" && job.status !== "running") {
      return { ok: false, reason: "not active" as const };
    }
    await ctx.db.patch(job._id, { cancelRequested: true });
    return { ok: true as const };
  },
});

// Hides a finished job's dashboard banner and toast via the "dismissed"
// phase; the pruner still owns deletion. Leaves `cancelRequested` alone,
// which means something else to the worker.
export const dismissCompletedJob = mutation({
  args: {
    apiKey: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    jobId: v.id("productSyncJobs"),
  },
  handler: async (ctx, args) => {
    const { job } = await resolveJobForMutationArgs(ctx, args);
    if (job.status !== "succeeded" && job.status !== "failed") {
      return { ok: false as const };
    }
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
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    return (await getWritableProject(ctx, job.projectId)) ? job : null;
  },
});

export const isCancelRequested = internalQuery({
  args: { jobId: v.id("productSyncJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return true;
    if (!(await getWritableProject(ctx, job.projectId))) return true;
    return (
      job.cancelRequested === true ||
      (job.status !== "queued" && job.status !== "running")
    );
  },
});

export const markJobRunning = internalMutation({
  args: { jobId: v.id("productSyncJobs") },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    if (!(await getWritableProject(ctx, job.projectId))) return null;
    if (job.status !== "queued") return null;
    const now = Date.now();
    const expectedDeadline = now + PRODUCT_SYNC_JOB_DEADLINE_MS;
    await ctx.db.patch(args.jobId, {
      status: "running",
      startedAt: now,
      expectedDeadline,
      progress: { phase: "starting" },
    });
    return expectedDeadline;
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
    const job = await ctx.db.get(args.jobId);
    if (!job || !(await getWritableProject(ctx, job.projectId))) return;
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
    plannedWritesTruncated: v.optional(v.boolean()),
    manualActions: v.optional(
      v.array(
        v.object({
          productId: v.string(),
          code: v.string(),
          message: v.string(),
        }),
      ),
    ),
    manualActionsTruncated: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || !(await getWritableProject(ctx, job.projectId))) return;
    const { items: failures, truncated } = truncateFailures(args.failures);
    const boundedManualActions = truncateManualActions(
      args.manualActions ?? [],
    );
    const boundedPlannedWrites = truncatePlannedWrites(
      args.plannedWrites ?? [],
    );
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
        ...(boundedPlannedWrites.items.length > 0
          ? { plannedWrites: boundedPlannedWrites.items }
          : {}),
        ...(args.plannedWritesTruncated || boundedPlannedWrites.truncated
          ? { plannedWritesTruncated: true }
          : {}),
        ...(boundedManualActions.items.length > 0
          ? { manualActions: boundedManualActions.items }
          : {}),
        ...(args.manualActionsTruncated || boundedManualActions.truncated
          ? { manualActionsTruncated: true }
          : {}),
      },
    });
    // Release the project's lock only if it still points at this job.
    const project = await getWritableProject(ctx, job.projectId);
    if (project?.activeSyncJobIds?.[job.platform] === args.jobId) {
      await ctx.db.patch(project._id, {
        activeSyncJobIds: {
          ...project.activeSyncJobIds,
          [job.platform]: undefined,
        },
      });
    }
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
    const job = await ctx.db.get(args.jobId);
    if (!job || !(await getWritableProject(ctx, job.projectId))) return;
    const rawFailures = args.failures ?? [];
    const { items: failures, truncated } = truncateFailures(rawFailures);
    await ctx.db.patch(args.jobId, {
      status: "failed",
      completedAt: Date.now(),
      error: args.error,
      progress: {
        phase: "failed",
        // The untruncated count, as in `markJobSucceeded`.
        failuresCount: rawFailures.length,
      },
      result: {
        pulled: args.pulled ?? 0,
        pushed: args.pushed ?? 0,
        failures,
        ...(truncated ? { failuresTruncated: true } : {}),
      },
    });
    // Release the lock, as in `markJobSucceeded`.
    const project = await getWritableProject(ctx, job.projectId);
    if (project?.activeSyncJobIds?.[job.platform] === args.jobId) {
      await ctx.db.patch(project._id, {
        activeSyncJobIds: {
          ...project.activeSyncJobIds,
          [job.platform]: undefined,
        },
      });
    }
  },
});

// Cron: fail `running` jobs past `expectedDeadline + grace`. Otherwise a
// crashed action holds the project's active-job slot forever.
export const reapStaleProductSyncJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - PRODUCT_SYNC_REAPER_GRACE_MS;
    const stale = await ctx.db
      .query("productSyncJobs")
      .withIndex("by_status_and_deadline", (q) =>
        q.eq("status", "running").lt("expectedDeadline", cutoff),
      )
      .take(PRODUCT_SYNC_REAPER_BATCH);
    for (const job of stale) {
      await ctx.db.patch(job._id, {
        status: "failed",
        completedAt: Date.now(),
        error: "Worker timed out — sync exceeded the 9-minute ceiling",
        progress: { phase: "reaped" },
      });
      // Release the dead worker's lock.
      const project = await ctx.db.get(job.projectId);
      if (project && project.activeSyncJobIds?.[job.platform] === job._id) {
        await ctx.db.patch(project._id, {
          activeSyncJobIds: {
            ...project.activeSyncJobIds,
            [job.platform]: undefined,
          },
        });
      }
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
      .take(PRODUCT_SYNC_PRUNER_BATCH);
    const failed = await ctx.db
      .query("productSyncJobs")
      .withIndex("by_status_and_completed", (q) =>
        q.eq("status", "failed").lt("completedAt", failedCutoff),
      )
      .take(PRODUCT_SYNC_PRUNER_BATCH);
    for (const row of [...succeeded, ...failed]) {
      await ctx.db.delete(row._id);
    }
    return { pruned: succeeded.length + failed.length };
  },
});
