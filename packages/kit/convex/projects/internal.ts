import { v } from "convex/values";

import { internalMutation, internalQuery } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { deleteProjectWithData, resolveProjectByApiKeyFromDb } from "./helpers";

export const getProjectByApiKey = internalQuery({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"projects"> | null> => {
    const resolved = await resolveProjectByApiKeyFromDb(ctx, args.apiKey);
    return resolved?.project ?? null;
  },
});

// Direct id-based lookup. Used by the product-sync workers, which
// resolve the project from a job row's `projectId` instead of the
// apiKey path so the worker can run without re-entering the api-key
// table on every poll.
export const getProjectById = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<Doc<"projects"> | null> => {
    const project = await ctx.db.get(args.projectId);
    if (!project || project.pendingDeletion) return null;
    const organization = await ctx.db.get(project.organizationId);
    return !organization || organization.pendingDeletion ? null : project;
  },
});

/** Continue the bounded cascade started by the authenticated delete mutation. */
export const continueProjectDeletion = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project?.pendingDeletion) return null;
    await deleteProjectWithData(ctx, args.projectId);
    return null;
  },
});

/** Recovery path in case a scheduled continuation is cancelled or fails. */
export const drainPendingProjectDeletion = internalMutation({
  args: {},
  returns: v.object({
    progressed: v.boolean(),
    projectId: v.union(v.id("projects"), v.null()),
  }),
  handler: async (ctx) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_pending_deletion", (q) => q.eq("pendingDeletion", true))
      .first();
    if (!project) return { progressed: false, projectId: null };

    await deleteProjectWithData(ctx, project._id);
    return { progressed: true, projectId: project._id };
  },
});
