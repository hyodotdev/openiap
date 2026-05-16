import { v } from "convex/values";

import { internalQuery } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { resolveProjectByApiKeyFromDb } from "./helpers";

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
    return await ctx.db.get(args.projectId);
  },
});
