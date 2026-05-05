import { v } from "convex/values";

import { internalQuery } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { getApiKeyByKey } from "../apiKeys/helpers";
import { getProjectById as getProjectByIdFromDb } from "./helpers";

export const getProjectByApiKey = internalQuery({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"projects"> | null> => {
    // Preferred path: look the key up in the `apiKeys` table. This is what
    // `createProject` writes every new project's default key to, and is
    // what carries per-key `isActive` / rotation semantics.
    const apiKey = await getApiKeyByKey(ctx, args.apiKey);

    if (apiKey !== null) {
      if (apiKey.isActive === false) {
        return null;
      }
      return getProjectByIdFromDb(ctx, apiKey.projectId);
    }

    // Legacy fallback: early projects — or anything created before the
    // `apiKeys` table was introduced — only had the key on the `projects`
    // row. Match those via the `by_api_key` index on `projects` so
    // receipt verification doesn't fail on un-migrated rows. Paid for
    // only on a miss in the `apiKeys` table, so new installs pay zero.
    const legacyProject = await ctx.db
      .query("projects")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .first();

    return legacyProject ?? null;
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
