import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

// Public mutation called by SDKs after a successful receipt verification:
// they know who the host-app user is, so they tell kit which userId owns
// the verified purchaseToken. Idempotent — re-binding the same userId is
// a no-op.
export const bindUser = mutation({
  args: {
    apiKey: v.string(),
    purchaseToken: v.string(),
    userId: v.string(),
  },
  returns: v.object({ ok: v.boolean(), bound: v.boolean() }),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .unique();
    if (!project) return { ok: false, bound: false };

    const sub: Doc<"subscriptions"> | null = await ctx.db
      .query("subscriptions")
      .withIndex("by_project_and_token", (q) =>
        q.eq("projectId", project._id).eq("purchaseToken", args.purchaseToken),
      )
      .unique();
    if (!sub) return { ok: true, bound: false };

    if (sub.userId === args.userId) {
      return { ok: true, bound: true };
    }

    await ctx.db.patch(sub._id, {
      userId: args.userId,
      updatedAt: Date.now(),
    });
    return { ok: true, bound: true };
  },
});
