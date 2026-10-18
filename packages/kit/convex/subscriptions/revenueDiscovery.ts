import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { WEBHOOK_RETENTION_MS } from "../webhooks/shared";

export async function getRevenueRunStatus(
  ctx: Pick<QueryCtx, "db">,
  projectId: Id<"projects">,
): Promise<Doc<"revenueMetricsRunStatus"> | null> {
  return ctx.db
    .query("revenueMetricsRunStatus")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .unique();
}

export async function seedRevenueProject(
  ctx: Pick<MutationCtx, "db">,
  projectId: Id<"projects">,
): Promise<void> {
  if (!(await getRevenueRunStatus(ctx, projectId))) {
    await ctx.db.insert("revenueMetricsRunStatus", { projectId });
  }
}

// New input writers seed directly; this cursor only discovers pre-deploy data.
export async function discoverLegacyRevenueProjects(
  ctx: MutationCtx,
  now: number,
  expected?: {
    phase: "events" | "stats";
    cursor: string | null;
    through: number;
  },
): Promise<void> {
  const checkpoint = await ctx.db.query("revenueMetricsDiscovery").unique();
  if (
    expected &&
    (!checkpoint ||
      checkpoint.phase !== expected.phase ||
      checkpoint.cursor !== expected.cursor ||
      checkpoint.through !== expected.through)
  )
    return;
  if (checkpoint?.phase === "done") return;
  const phase = checkpoint?.phase ?? "events";
  const since = checkpoint?.since ?? now - WEBHOOK_RETENTION_MS;
  const through = checkpoint?.through ?? now;
  const options = {
    cursor: checkpoint?.cursor ?? null,
    numItems: 100,
    maximumBytesRead: 4 * 1024 * 1024,
  };
  const page =
    phase === "events"
      ? await ctx.db
          .query("webhookEvents")
          .withIndex("by_received_at", (q) =>
            q.gte("receivedAt", since).lte("receivedAt", through),
          )
          .paginate(options)
      : await ctx.db
          .query("subscriptionStats")
          .withIndex("by_creation_time", (q) => q.lte("_creationTime", through))
          .paginate(options);
  const projects = new Set<Id<"projects">>();
  for (const row of page.page) {
    if ("source" in row && row.source === "MetaHorizonReconciler") continue;
    projects.add(row.projectId);
  }
  for (const projectId of projects) {
    await ctx.scheduler.runAfter(
      0,
      internal.subscriptions.revenueMetrics.seedRevenueMetricsProject,
      { projectId },
    );
  }
  const nextPhase = page.isDone
    ? phase === "events"
      ? "stats"
      : "done"
    : phase;
  const fields = {
    phase: nextPhase,
    cursor: page.isDone ? null : page.continueCursor,
    since,
    through,
  } as const;
  if (checkpoint) await ctx.db.patch(checkpoint._id, fields);
  else await ctx.db.insert("revenueMetricsDiscovery", fields);
  if (fields.phase !== "done") {
    await ctx.scheduler.runAfter(
      1000,
      internal.subscriptions.revenueMetrics.continueRevenueDiscovery,
      { phase: fields.phase, cursor: fields.cursor, through },
    );
  }
}
