import { mutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";

import { resolveProjectByApiKeyFromDb } from "../projects/helpers";
import {
  bindSubscriptionToUserHandler,
  rebindSubscriptionToUserHandler,
} from "./internal";
import { isValidSubscriptionUserId } from "./limits";
import { sha256Hex } from "../utils/sha256";

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

// Commerce Protocol bindPurchase: same idempotent, never-move binding as
// bindUser, but server-role only. The protocol says a shipped app must not
// reach an account mutation, and the edge prefix check alone cannot classify
// a legacy no-prefix key, so the admin access is asserted here in Convex where
// the stored key type is authoritative.
export const bindUserAsServer = mutation({
  args: {
    apiKey: v.string(),
    purchaseToken: v.string(),
    userId: v.string(),
  },
  returns: v.object({ ok: v.boolean(), bound: v.boolean() }),
  handler: async (ctx, args) => {
    // resolveProjectByApiKeyFromDb throws INSUFFICIENT_SCOPE for a valid but
    // under-scoped (publishable/legacy) key, and returns null for an unknown
    // or inactive one. The two must map to different protocol codes: an
    // unknown key is UNAUTHORIZED (INVALID_API_KEY), only a real-but-wrong-role
    // key is FORBIDDEN.
    const resolved = await resolveProjectByApiKeyFromDb(
      ctx,
      args.apiKey,
      "admin",
    );
    if (!resolved) {
      throw new ConvexError({
        code: "INVALID_API_KEY",
        message: "API key is invalid or inactive",
      });
    }

    const subscriptionId = await bindSubscriptionToUserHandler(ctx, {
      projectId: resolved.project._id,
      purchaseToken: args.purchaseToken,
      userId: args.userId,
    });

    return { ok: true, bound: subscriptionId !== null };
  },
});

// Recovery for a subscription bound to the wrong user. `bindUser` deliberately
// refuses to move an existing binding — token possession is not proof of
// ownership — so without this an operator has no way to correct one.
// Secret key only: this reassigns who owns a purchase.
export const rebindUser = mutation({
  args: {
    apiKey: v.string(),
    purchaseToken: v.string(),
    userId: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    rebound: v.boolean(),
    // False when the binding moved but no entitlement events could be
    // attributed, so the caller knows the developer backend still believes the
    // previous user owns the purchase.
    notified: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const resolved = await resolveProjectByApiKeyFromDb(
      ctx,
      args.apiKey,
      "admin",
    );
    const project = resolved?.project ?? null;
    if (!project) return { ok: false, rebound: false, notified: false };

    const result = await rebindSubscriptionToUserHandler(ctx, {
      projectId: project._id,
      purchaseToken: args.purchaseToken,
      userId: args.userId,
    });

    return {
      ok: true,
      rebound: result !== null,
      notified: result?.notified ?? true,
    };
  },
});

export const requestUserErasure = mutation({
  args: { apiKey: v.string(), userId: v.string() },
  returns: v.object({
    ok: v.boolean(),
    jobId: v.id("subscriptionUserErasureJobs"),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
    ),
  }),
  handler: async (ctx, args) => {
    const resolved = await resolveProjectByApiKeyFromDb(
      ctx,
      args.apiKey,
      "admin",
    );
    if (!resolved) {
      throw new ConvexError({
        code: "INVALID_API_KEY",
        message: "API key is invalid or inactive",
      });
    }
    if (!isValidSubscriptionUserId(args.userId)) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "userId is invalid",
      });
    }

    const userIdHash = await sha256Hex(args.userId);
    const existing = await ctx.db
      .query("subscriptionUserErasureJobs")
      .withIndex("by_project_and_user_hash", (q) =>
        q.eq("projectId", resolved.project._id).eq("userIdHash", userIdHash),
      )
      .unique();
    if (existing && existing.status !== "completed") {
      return { ok: true, jobId: existing._id, status: existing.status };
    }

    const now = Date.now();
    const jobId = existing?._id
      ? existing._id
      : await ctx.db.insert("subscriptionUserErasureJobs", {
          projectId: resolved.project._id,
          userId: args.userId,
          userIdHash,
          status: "queued",
          subscriptionsErased: 0,
          commerceEventsErased: 0,
          createdAt: now,
          updatedAt: now,
        });
    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: args.userId,
        status: "queued",
        subscriptionsErased: 0,
        commerceEventsErased: 0,
        completedAt: undefined,
        updatedAt: now,
      });
    }
    await ctx.scheduler.runAfter(
      0,
      internal.subscriptions.internal.drainSubscriptionUserErasureJob,
      { jobId },
    );
    return { ok: true, jobId, status: "queued" as const };
  },
});
