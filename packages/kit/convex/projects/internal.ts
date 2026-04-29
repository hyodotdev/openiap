import { v } from "convex/values";

import { internalQuery } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { getApiKeyByKey } from "../apiKeys/helpers";
import { getProjectById } from "./helpers";

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
      return getProjectById(ctx, apiKey.projectId);
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
