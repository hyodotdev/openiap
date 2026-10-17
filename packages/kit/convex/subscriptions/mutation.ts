import { mutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";

import { resolveProjectByApiKeyFromDb } from "../projects/helpers";
import {
  bindOneTimePurchaseToUser,
  rebindOneTimePurchaseToUser,
} from "../purchases/binding";
import { recordBindIssue } from "../purchaseIssues/internal";
import {
  bindSubscriptionToUserOutcome,
  findSubscriptionByToken,
  rebindSubscriptionToUserHandler,
  type BindOutcome,
} from "./internal";
import { isValidSubscriptionUserId } from "./limits";
import { hmacSha256Hex, sha256Hex } from "../utils/sha256";
import { randomHex } from "../utils/helpers";
import { bindReasonValidator } from "../utils/validation";

const bindArgs = {
  apiKey: v.string(),
  purchaseToken: v.string(),
  userId: v.string(),
  // Labels a secret-key bind issue; never read otherwise.
  correlationId: v.optional(v.string()),
};

function isBound(outcome: BindOutcome): boolean {
  return outcome.reason === "bound" || outcome.reason === "already_bound";
}

// An authenticated app backend chooses the owner; store evidence alone cannot.
export const bindUser = mutation({
  args: bindArgs,
  returns: v.object({
    ok: v.boolean(),
    bound: v.boolean(),
    reason: v.optional(bindReasonValidator),
  }),
  handler: async (ctx, args) => {
    const resolved = await resolveProjectByApiKeyFromDb(
      ctx,
      args.apiKey,
      "admin",
    );
    if (!resolved) return { ok: false, bound: false };
    const { project } = resolved;
    if (!isValidSubscriptionUserId(args.userId)) {
      throw new ConvexError(
        "userId must be nonblank and at most 256 characters",
      );
    }

    const sub = await findSubscriptionByToken(
      ctx,
      project._id,
      args.purchaseToken,
    );
    // Amazon store identity is linked by the authenticated developer backend.
    let outcome: BindOutcome =
      sub?.store === "amazon"
        ? { reason: "not_bindable" }
        : await bindSubscriptionToUserOutcome(ctx, {
            projectId: project._id,
            purchaseToken: args.purchaseToken,
            userId: args.userId,
          });
    if (outcome.reason === "not_found") {
      outcome = await bindOneTimePurchaseToUser(
        ctx,
        project,
        args.purchaseToken,
        args.userId,
      );
    }
    await recordBindIssue(ctx, project._id, outcome, {
      evidence: args.purchaseToken,
      userId: args.userId,
      correlationId: args.correlationId,
    });
    return { ok: true, bound: isBound(outcome), reason: outcome.reason };
  },
});

// Commerce Protocol bindPurchase: same idempotent, never-move binding as
// bindUser, but server-role only. The protocol says a shipped app must not
// reach an account mutation, and the edge prefix check alone cannot classify
// a legacy no-prefix key, so the admin access is asserted here in Convex where
// the stored key type is authoritative. Apple and Google stay subscription-only
// here: a bound one-time purchase would have to appear in Commerce
// entitlements, which IAPKit cannot recheck with those stores (SPEC §4.3).
export const bindUserAsServer = mutation({
  args: bindArgs,
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

    const outcome = await bindSubscriptionToUserOutcome(ctx, {
      projectId: resolved.project._id,
      purchaseToken: args.purchaseToken,
      userId: args.userId,
    });
    await recordBindIssue(ctx, resolved.project._id, outcome, {
      evidence: args.purchaseToken,
      userId: args.userId,
      correlationId: args.correlationId,
    });

    return { ok: true, bound: isBound(outcome) };
  },
});

// Recovery for a purchase bound to the wrong user. `bindUser` deliberately
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
    if (result) {
      return { ok: true, rebound: true, notified: result.notified };
    }

    // One-time purchases emit no commerce events, so a move is never notified.
    const oneTime = await rebindOneTimePurchaseToUser(
      ctx,
      project,
      args.purchaseToken,
      args.userId,
    );
    return {
      ok: true,
      rebound: oneTime !== null,
      notified: oneTime?.moved !== true,
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

    const hashKey = resolved.project.userErasureHashKey ?? randomHex();
    if (resolved.project.userErasureHashKey === undefined) {
      await ctx.db.patch(resolved.project._id, { userErasureHashKey: hashKey });
    }
    const userIdHash = await hmacSha256Hex(hashKey, args.userId);
    let existing = await ctx.db
      .query("subscriptionUserErasureJobs")
      .withIndex("by_project_and_user_hash", (q) =>
        q.eq("projectId", resolved.project._id).eq("userIdHash", userIdHash),
      )
      .unique();
    if (!existing) {
      const legacyHash = await sha256Hex(args.userId);
      existing = await ctx.db
        .query("subscriptionUserErasureJobs")
        .withIndex("by_project_and_user_hash", (q) =>
          q.eq("projectId", resolved.project._id).eq("userIdHash", legacyHash),
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { userIdHash });
      }
    }
    if (existing) {
      return { ok: true, jobId: existing._id, status: existing.status };
    }

    const now = Date.now();
    const jobId = await ctx.db.insert("subscriptionUserErasureJobs", {
      projectId: resolved.project._id,
      userId: args.userId,
      userIdHash,
      status: "queued",
      subscriptionsErased: 0,
      commerceEventsErased: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.subscriptions.internal.drainSubscriptionUserErasureJob,
      { jobId },
    );
    return { ok: true, jobId, status: "queued" as const };
  },
});
