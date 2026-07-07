import { mutation } from "../_generated/server";
import { v } from "convex/values";

import { resolveProjectByApiKeyFromDb } from "../projects/helpers";
import { bindSubscriptionToUserHandler } from "./internal";

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
    const resolved = await resolveProjectByApiKeyFromDb(ctx, args.apiKey);
    const project = resolved?.project ?? null;
    if (!project) return { ok: false, bound: false };

    const subscriptionId = await bindSubscriptionToUserHandler(ctx, {
      projectId: project._id,
      purchaseToken: args.purchaseToken,
      userId: args.userId,
    });

    return { ok: true, bound: subscriptionId !== null };
  },
});
