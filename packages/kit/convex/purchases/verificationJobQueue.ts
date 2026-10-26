import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { resolveProjectByApiKeyFromDb } from "../projects/helpers";
import { hashApiKeyForStorage } from "../apiKeys/helpers";
import { sha256Hex } from "../utils/sha256";
import { purchaseStoreValidator } from "../schema";
import { receiptResponseValidator } from "./shared";
import { evaluateVerificationAdmission } from "./verificationAdmission";
import { VERIFICATION_REJECTION_COOLDOWN_MS } from "./verificationVerdict";
import {
  verificationQueue,
  readyVerificationProject,
  wakeVerificationQueue,
  finishVerificationJob,
  requeueVerificationJob,
  releaseExpiredVerificationLease,
  releaseDetachedVerificationLease,
  deleteVerificationJob,
} from "./verificationJobState";
import {
  verificationJobCiphertext,
  verificationJobError,
  activeVerificationJob,
  expiredVerificationJobError,
  type VerificationJobView,
  VERIFICATION_JOB_DEADLINE_MS,
  VERIFICATION_JOB_RETENTION_MS,
  VERIFICATION_JOB_LEASE_MS,
  VERIFICATION_JOB_MAX_ATTEMPTS,
  VERIFICATION_JOB_PROJECT_CAPACITY,
  VERIFICATION_JOB_GLOBAL_CAPACITY,
  VERIFICATION_JOB_PROJECT_WORKERS,
  VERIFICATION_JOB_GLOBAL_WORKERS,
} from "./verificationJobModel";

function notFound(): never {
  throw new ConvexError({
    code: "NOT_FOUND",
    message: "Verification job not found.",
  });
}

export const enqueue = internalMutation({
  args: {
    apiKey: v.string(),
    idempotencyHash: v.string(),
    requestHash: v.string(),
    evidenceHash: v.string(),
    verdictHash: v.string(),
    payload: verificationJobCiphertext,
    store: purchaseStoreValidator,
    includeClientPayload: v.optional(v.boolean()),
    includeTransactionDetails: v.optional(v.boolean()),
    correlationId: v.string(),
  },
  returns: v.object({ jobId: v.id("verificationJobs"), deduped: v.boolean() }),
  handler: async (ctx, args) => {
    const resolved = await resolveProjectByApiKeyFromDb(ctx, args.apiKey);
    if (!resolved || args.apiKey.startsWith("session-project:"))
      throw new ConvexError({
        code: "INVALID_API_KEY",
        message: "Invalid API key.",
      });
    const apiKeyHash = await hashApiKeyForStorage(args.apiKey);
    let existing = await ctx.db
      .query("verificationJobs")
      .withIndex("by_key_idempotency", (q) =>
        q
          .eq("apiKeyHash", apiKeyHash)
          .eq("idempotencyHash", args.idempotencyHash),
      )
      .unique();
    if (
      existing?.completedAt !== undefined &&
      Date.now() >= existing.completedAt + VERIFICATION_JOB_RETENTION_MS
    ) {
      await deleteVerificationJob(ctx, existing);
      existing = null;
    }
    if (existing) {
      if (existing.requestHash !== args.requestHash)
        throw new ConvexError({
          code: "IDEMPOTENCY_CONFLICT",
          message:
            "Idempotency-Key was already used for a different verification request.",
        });
      return { jobId: existing._id, deduped: true };
    }
    const global = await verificationQueue(ctx);
    const project = await verificationQueue(ctx, resolved.project._id);
    if (
      global.active >= VERIFICATION_JOB_GLOBAL_CAPACITY ||
      project.active >= VERIFICATION_JOB_PROJECT_CAPACITY
    ) {
      throw new ConvexError({
        code: "SERVICE_BUSY",
        message: "Verification queue is full. This request was not accepted.",
        retryAfterSec: 2,
      });
    }
    const now = Date.now();
    const admission = evaluateVerificationAdmission({
      tokens: project.tokens,
      refilledAt: project.refilledAt,
      now,
    });
    if (!admission.admitted)
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "Too many verification job requests.",
        retryAfterSec: admission.retryAfterSec,
      });
    const previous = await ctx.db
      .query("verificationJobs")
      .withIndex("by_project_evidence", (q) =>
        q
          .eq("projectId", resolved.project._id)
          .eq("evidenceHash", args.evidenceHash),
      )
      .order("desc")
      .first();
    const rejection = await ctx.db
      .query("verificationJobs")
      .withIndex("by_project_verdict_rejected", (q) =>
        q
          .eq("projectId", resolved.project._id)
          .eq("verdictHash", args.verdictHash)
          .gt("rejectedAt", now - VERIFICATION_REJECTION_COOLDOWN_MS),
      )
      .order("desc")
      .first();
    if (rejection?.rejectedAt !== undefined)
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "This purchase evidence was recently rejected.",
        retryAfterSec: Math.max(
          1,
          Math.ceil(
            (rejection.rejectedAt + VERIFICATION_REJECTION_COOLDOWN_MS - now) /
              1_000,
          ),
        ),
      });
    const replay = evaluateVerificationAdmission({
      tokens: previous?.replayTokens,
      refilledAt: previous?.replayRefilledAt,
      now,
      capacity: 30,
      refillPerSecond: 1 / 60,
    });
    if (!replay.admitted)
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "Too many requests for the same purchase evidence.",
        retryAfterSec: replay.retryAfterSec,
      });
    const jobId = await ctx.db.insert("verificationJobs", {
      projectId: resolved.project._id,
      apiKeyHash,
      idempotencyHash: args.idempotencyHash,
      requestHash: args.requestHash,
      evidenceHash: args.evidenceHash,
      verdictHash: args.verdictHash,
      replayTokens: replay.tokens,
      replayRefilledAt: now,
      payload: args.payload,
      store: args.store,
      includeClientPayload: args.includeClientPayload,
      includeTransactionDetails: args.includeTransactionDetails,
      correlationId: args.correlationId,
      status: "queued",
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
      expiresAt: now + VERIFICATION_JOB_DEADLINE_MS,
    });
    await ctx.db.patch(global._id, { active: global.active + 1 });
    await ctx.db.patch(project._id, {
      active: project.active + 1,
      tokens: admission.tokens,
      refilledAt: now,
    });
    await readyVerificationProject(ctx, resolved.project._id);
    if (global.running < VERIFICATION_JOB_GLOBAL_WORKERS)
      await wakeVerificationQueue(ctx);
    return { jobId, deduped: false };
  },
});

export const read = internalMutation({
  args: { apiKey: v.string(), idempotencyKey: v.string(), jobId: v.string() },
  handler: async (ctx, args): Promise<VerificationJobView> => {
    const resolved = await resolveProjectByApiKeyFromDb(ctx, args.apiKey);
    if (!resolved || args.apiKey.startsWith("session-project:"))
      return notFound();
    const id = ctx.db.normalizeId("verificationJobs", args.jobId);
    let job = id ? await ctx.db.get(id) : null;
    if (
      !job ||
      job.projectId !== resolved.project._id ||
      job.apiKeyHash !== (await hashApiKeyForStorage(args.apiKey)) ||
      job.idempotencyHash !== (await sha256Hex(args.idempotencyKey)) ||
      (job.completedAt !== undefined &&
        Date.now() >= job.completedAt + VERIFICATION_JOB_RETENTION_MS)
    )
      return notFound();
    if (activeVerificationJob(job.status) && Date.now() >= job.expiresAt) {
      await finishVerificationJob(
        ctx,
        job,
        { status: "expired", error: expiredVerificationJobError() },
        false,
      );
      job = await ctx.db.get(job._id);
      if (!job) return notFound();
    }
    return {
      jobId: job._id,
      status: job.status,
      createdAt: job.createdAt,
      expiresAt: job.expiresAt,
      ...(job.completedAt !== undefined
        ? { completedAt: job.completedAt }
        : {}),
      ...(job.receipt ? { receipt: job.receipt } : {}),
      ...(job.error ? { error: job.error } : {}),
      store: job.store,
      includeClientPayload: job.includeClientPayload,
      includeTransactionDetails: job.includeTransactionDetails,
      correlationId: job.correlationId,
    };
  },
});

export const dispatch = internalMutation({
  args: { generation: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const global = await verificationQueue(ctx);
    if (global.generation !== args.generation) return null;
    await ctx.db.patch(global._id, { dispatchAt: undefined });
    const now = Date.now();
    let running = global.running;
    for (
      let count = 0;
      count < VERIFICATION_JOB_GLOBAL_WORKERS &&
      running < VERIFICATION_JOB_GLOBAL_WORKERS;
      count++
    ) {
      const project = await ctx.db
        .query("verificationJobQueues")
        .withIndex("by_ready", (q) => q.gte("readyAt", 0).lte("readyAt", now))
        .first();
      if (!project?.projectId) break;
      const job = await ctx.db
        .query("verificationJobs")
        .withIndex("by_project_status_due", (q) =>
          q
            .eq("projectId", project.projectId!)
            .eq("status", "queued")
            .lte("nextAttemptAt", now),
        )
        .first();
      if (!job || project.running >= VERIFICATION_JOB_PROJECT_WORKERS) {
        await readyVerificationProject(ctx, project.projectId);
        continue;
      }
      if (now >= job.expiresAt) {
        await finishVerificationJob(ctx, job, {
          status: "expired",
          error: expiredVerificationJobError(),
        });
        continue;
      }
      const lease = crypto.randomUUID();
      await ctx.db.patch(job._id, {
        status: "running",
        attempts: job.attempts + 1,
        executionStartedAt: undefined,
        lease,
        leaseUntil: now + VERIFICATION_JOB_LEASE_MS,
      });
      await ctx.db.patch(project._id, { running: project.running + 1 });
      running++;
      await readyVerificationProject(ctx, project.projectId);
      await ctx.scheduler.runAfter(0, internal.purchases.verificationJobs.run, {
        jobId: job._id,
        lease,
      });
    }
    await ctx.db.patch(global._id, { running });
    if (running < VERIFICATION_JOB_GLOBAL_WORKERS) {
      const next = await ctx.db
        .query("verificationJobQueues")
        .withIndex("by_ready", (q) => q.gte("readyAt", 0))
        .first();
      if (next?.readyAt !== undefined)
        await wakeVerificationQueue(
          ctx,
          Math.max(Date.now() + 1, next.readyAt),
        );
    }
    return null;
  },
});

export const forWorker = internalMutation({
  args: { jobId: v.id("verificationJobs"), lease: v.string() },
  handler: async (ctx, args): Promise<Doc<"verificationJobs"> | null> => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      if (await releaseDetachedVerificationLease(ctx, args.lease, true))
        await wakeVerificationQueue(ctx);
      return null;
    }
    if (
      (job.status !== "running" && job.status !== "expired") ||
      job.lease !== args.lease ||
      (job.leaseUntil ?? 0) <= Date.now() ||
      job.executionStartedAt !== undefined
    )
      return null;
    if (job.status === "expired" || job.expiresAt <= Date.now()) {
      if (job.status === "expired")
        await releaseExpiredVerificationLease(ctx, job);
      else
        await finishVerificationJob(ctx, job, {
          status: "expired",
          error: expiredVerificationJobError(),
        });
      await wakeVerificationQueue(ctx);
      return null;
    }
    const executionStartedAt = Date.now();
    const leaseUntil = executionStartedAt + VERIFICATION_JOB_LEASE_MS;
    await ctx.db.patch(job._id, { executionStartedAt, leaseUntil });
    return { ...job, executionStartedAt, leaseUntil };
  },
});

export const complete = internalMutation({
  args: {
    jobId: v.id("verificationJobs"),
    lease: v.string(),
    receipt: v.optional(receiptResponseValidator),
    error: v.optional(verificationJobError),
    retryAfterSec: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      if (await releaseDetachedVerificationLease(ctx, args.lease))
        await wakeVerificationQueue(ctx);
      return null;
    }
    if (
      (job.status !== "running" && job.status !== "expired") ||
      job.lease !== args.lease ||
      (job.leaseUntil ?? 0) <= Date.now()
    )
      return null;
    if (job.status === "expired") {
      await releaseExpiredVerificationLease(ctx, job);
      await wakeVerificationQueue(ctx);
      return null;
    }
    const retryAt =
      Date.now() +
      Math.max(2 ** job.attempts * 1_000, (args.retryAfterSec ?? 0) * 1_000);
    if (
      args.error &&
      args.retryAfterSec !== undefined &&
      job.attempts < VERIFICATION_JOB_MAX_ATTEMPTS &&
      retryAt < job.expiresAt
    ) {
      await requeueVerificationJob(ctx, job, retryAt);
    } else {
      await finishVerificationJob(
        ctx,
        job,
        args.receipt
          ? { status: "succeeded", receipt: args.receipt }
          : {
              status: "failed",
              error: args.error ?? {
                code: "VERIFICATION_FAILED",
                message: "Verification could not finish.",
              },
            },
      );
    }
    await wakeVerificationQueue(ctx);
    return null;
  },
});

export const maintain = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const capacity = await ctx.db
      .query("verificationJobQueues")
      .withIndex("by_scope", (q) => q.eq("scope", "global"))
      .unique();
    for (const lease of capacity?.detachedLeases ?? []) {
      if (lease.until <= now)
        await releaseDetachedVerificationLease(ctx, lease.lease);
    }
    for (const job of await ctx.db
      .query("verificationJobs")
      .withIndex("by_status_expiry", (q) =>
        q.eq("status", "running").lte("expiresAt", now),
      )
      .take(VERIFICATION_JOB_GLOBAL_WORKERS)) {
      await finishVerificationJob(
        ctx,
        job,
        { status: "expired", error: expiredVerificationJobError() },
        false,
      );
    }
    for (const job of await ctx.db
      .query("verificationJobs")
      .withIndex("by_status_lease", (q) =>
        q.eq("status", "expired").gt("leaseUntil", 0).lte("leaseUntil", now),
      )
      .take(VERIFICATION_JOB_GLOBAL_WORKERS)) {
      await releaseExpiredVerificationLease(ctx, job);
    }
    const expiredQueued = await ctx.db
      .query("verificationJobs")
      .withIndex("by_status_expiry", (q) =>
        q.eq("status", "queued").lte("expiresAt", now),
      )
      .take(32);
    for (const job of expiredQueued) {
      await finishVerificationJob(ctx, job, {
        status: "expired",
        error: expiredVerificationJobError(),
      });
    }
    for (const job of await ctx.db
      .query("verificationJobs")
      .withIndex("by_status_lease", (q) =>
        q.eq("status", "running").lte("leaseUntil", now),
      )
      .take(VERIFICATION_JOB_GLOBAL_WORKERS)) {
      if (
        now >= job.expiresAt ||
        job.attempts >= VERIFICATION_JOB_MAX_ATTEMPTS
      ) {
        await finishVerificationJob(ctx, job, {
          status: now >= job.expiresAt ? "expired" : "failed",
          error: {
            code: "VERIFICATION_FAILED",
            message: "Verification worker did not finish.",
          },
        });
      } else {
        await requeueVerificationJob(ctx, job, now);
      }
    }
    if (expiredQueued.length === 32)
      await ctx.scheduler.runAfter(
        0,
        internal.purchases.verificationJobQueue.maintain,
        {},
      );
    await pruneVerificationJobs(ctx);
    const global = await ctx.db
      .query("verificationJobQueues")
      .withIndex("by_scope", (q) => q.eq("scope", "global"))
      .unique();
    if (
      global &&
      global.active > 0 &&
      global.running < VERIFICATION_JOB_GLOBAL_WORKERS &&
      (global.dispatchAt === undefined || global.dispatchAt < now - 60_000)
    ) {
      await ctx.db.patch(global._id, { dispatchAt: undefined });
      await wakeVerificationQueue(ctx);
    }
    return null;
  },
});

async function pruneVerificationJobs(ctx: MutationCtx): Promise<void> {
  const rows = await ctx.db
    .query("verificationJobs")
    .withIndex("by_completed", (q) =>
      q
        .gt("completedAt", 0)
        .lt("completedAt", Date.now() - VERIFICATION_JOB_RETENTION_MS),
    )
    .take(64);
  for (const job of rows) {
    await deleteVerificationJob(ctx, job);
  }
  if (rows.length === 64)
    await ctx.scheduler.runAfter(
      0,
      internal.purchases.verificationJobQueue.prune,
      {},
    );
}

export const prune = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    await pruneVerificationJobs(ctx);
    return null;
  },
});
