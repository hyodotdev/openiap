import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { ReceiptResponse } from "./shared";
import { isSettledRejection } from "./verificationVerdict";
import {
  activeVerificationJob,
  VERIFICATION_JOB_PROJECT_WORKERS,
  expiredVerificationJobError,
  type VerificationJobError,
} from "./verificationJobModel";

export async function verificationQueue(
  ctx: MutationCtx,
  projectId?: Id<"projects">,
): Promise<Doc<"verificationJobQueues">> {
  const scope = projectId ? `project:${projectId}` : "global";
  const existing = await ctx.db
    .query("verificationJobQueues")
    .withIndex("by_scope", (q) => q.eq("scope", scope))
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert("verificationJobQueues", {
    scope,
    ...(projectId ? { projectId } : {}),
    active: 0,
    running: 0,
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Verification queue insert failed");
  return created;
}

export async function readyVerificationProject(
  ctx: MutationCtx,
  projectId: Id<"projects">,
): Promise<void> {
  const queue = await verificationQueue(ctx, projectId);
  const next =
    queue.running < VERIFICATION_JOB_PROJECT_WORKERS
      ? await ctx.db
          .query("verificationJobs")
          .withIndex("by_project_status_due", (q) =>
            q.eq("projectId", projectId).eq("status", "queued"),
          )
          .first()
      : null;
  await ctx.db.patch(queue._id, {
    readyAt: next ? Math.max(Date.now(), next.nextAttemptAt) : undefined,
  });
}

export async function wakeVerificationQueue(
  ctx: MutationCtx,
  when = Date.now(),
): Promise<void> {
  const global = await verificationQueue(ctx);
  if (global.dispatchAt !== undefined && global.dispatchAt <= when) return;
  const generation = (global.generation ?? 0) + 1;
  await ctx.db.patch(global._id, { generation, dispatchAt: when });
  await ctx.scheduler.runAt(
    when,
    internal.purchases.verificationJobQueue.dispatch,
    { generation },
  );
}

export async function finishVerificationJob(
  ctx: MutationCtx,
  job: Doc<"verificationJobs">,
  outcome:
    | { status: "succeeded"; receipt: ReceiptResponse }
    | { status: "failed" | "expired"; error: VerificationJobError },
  workFinished = true,
): Promise<void> {
  if (!activeVerificationJob(job.status)) return;
  const now = Date.now();
  const terminal =
    now >= job.expiresAt
      ? { status: "expired" as const, error: expiredVerificationJobError() }
      : outcome;
  const retainLease = job.status === "running" && !workFinished;
  await ctx.db.patch(job._id, {
    status: terminal.status,
    completedAt: now,
    payload: undefined,
    lease: retainLease ? job.lease : undefined,
    leaseUntil: retainLease ? job.leaseUntil : undefined,
    receipt: terminal.status === "succeeded" ? terminal.receipt : undefined,
    error: terminal.status === "succeeded" ? undefined : terminal.error,
  });
  for (const queue of [
    await verificationQueue(ctx),
    await verificationQueue(ctx, job.projectId),
  ]) {
    await ctx.db.patch(queue._id, {
      active: queue.active - 1,
      running:
        queue.running - (job.status === "running" && !retainLease ? 1 : 0),
    });
  }
  if (
    terminal.status === "succeeded" &&
    isSettledRejection(job.store, terminal.receipt)
  ) {
    await ctx.db.patch(job._id, { rejectedAt: now });
  }
  await readyVerificationProject(ctx, job.projectId);
}

export async function releaseExpiredVerificationLease(
  ctx: MutationCtx,
  job: Doc<"verificationJobs">,
): Promise<void> {
  if (job.status !== "expired" || !job.lease) return;
  await ctx.db.patch(job._id, { lease: undefined, leaseUntil: undefined });
  for (const queue of [
    await verificationQueue(ctx),
    await verificationQueue(ctx, job.projectId),
  ]) {
    await ctx.db.patch(queue._id, { running: queue.running - 1 });
  }
  await readyVerificationProject(ctx, job.projectId);
}

export async function releaseDetachedVerificationLease(
  ctx: MutationCtx,
  lease: string,
  onlyUnstarted = false,
): Promise<boolean> {
  const global = await verificationQueue(ctx);
  const existing = global.detachedLeases ?? [];
  if (
    !existing.some(
      (item) => item.lease === lease && (!onlyUnstarted || !item.started),
    )
  )
    return false;
  await ctx.db.patch(global._id, {
    running: global.running - 1,
    detachedLeases: existing.filter((item) => item.lease !== lease),
  });
  return true;
}

export async function deleteVerificationJob(
  ctx: MutationCtx,
  job: Doc<"verificationJobs">,
): Promise<void> {
  if (job.lease && (job.leaseUntil ?? 0) > Date.now()) {
    const global = await verificationQueue(ctx);
    const project = await verificationQueue(ctx, job.projectId);
    const active = activeVerificationJob(job.status) ? 1 : 0;
    await ctx.db.patch(global._id, {
      active: global.active - active,
      detachedLeases: [
        ...(global.detachedLeases ?? []),
        {
          lease: job.lease,
          until: job.leaseUntil!,
          started: job.executionStartedAt !== undefined,
        },
      ],
    });
    await ctx.db.patch(project._id, {
      active: project.active - active,
      running: project.running - 1,
    });
    await ctx.db.delete(job._id);
    await readyVerificationProject(ctx, job.projectId);
    return;
  }
  if (activeVerificationJob(job.status)) {
    await finishVerificationJob(ctx, job, {
      status: "failed",
      error: {
        code: "INVALID_API_KEY",
        message: "Verification credentials are no longer available.",
      },
    });
  } else {
    await releaseExpiredVerificationLease(ctx, job);
  }
  await ctx.db.delete(job._id);
}

export async function requeueVerificationJob(
  ctx: MutationCtx,
  job: Doc<"verificationJobs">,
  nextAttemptAt: number,
): Promise<void> {
  await ctx.db.patch(job._id, {
    status: "queued",
    nextAttemptAt,
    lease: undefined,
    leaseUntil: undefined,
  });
  for (const queue of [
    await verificationQueue(ctx),
    await verificationQueue(ctx, job.projectId),
  ])
    await ctx.db.patch(queue._id, { running: queue.running - 1 });
  await readyVerificationProject(ctx, job.projectId);
}
