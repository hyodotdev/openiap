import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

import {
  applySubscriptionTransition,
  type CurrentSubscription,
} from "./stateMachine";

// Convex-runtime helpers used by the Horizon polling reconciler in
// `horizon.ts`. Kept separate so the action's "use node" boundary
// doesn't drag node-only imports into the regular Convex bundle.

export const listHorizonProjects = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("projects"),
      horizonEnabled: v.optional(v.boolean()),
      horizonAppId: v.optional(v.union(v.string(), v.null())),
      horizonAppSecret: v.optional(v.union(v.string(), v.null())),
    }),
  ),
  handler: async (ctx) => {
    const all = await ctx.db.query("projects").collect();
    return all
      .filter((project) => project.horizonEnabled === true)
      .map((project) => ({
        _id: project._id,
        horizonEnabled: project.horizonEnabled,
        horizonAppId: project.horizonAppId,
        horizonAppSecret: project.horizonAppSecret,
      }));
  },
});

export const getProjectByApiKey = internalQuery({
  args: { apiKey: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("projects"),
      horizonEnabled: v.optional(v.boolean()),
      horizonAppId: v.optional(v.union(v.string(), v.null())),
      horizonAppSecret: v.optional(v.union(v.string(), v.null())),
    }),
  ),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .unique();
    if (!project) return null;
    return {
      _id: project._id,
      horizonEnabled: project.horizonEnabled,
      horizonAppId: project.horizonAppId,
      horizonAppSecret: project.horizonAppSecret,
    };
  },
});

// All subscriptions for a Horizon project that might still mutate.
// Refunded/Revoked/Expired-with-no-renewal rows are excluded so the
// cron stays cheap as the historical archive grows.
export const listHorizonSubscriptions = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      userId: v.string(),
      sku: v.string(),
      purchaseToken: v.string(),
      state: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("subscriptions")
      .withIndex("by_project_and_updated", (q) =>
        q.eq("projectId", args.projectId),
      )
      .collect();
    return all
      .filter((sub) => sub.platform === "Android")
      .filter((sub) => !!sub.userId)
      .filter(
        (sub) =>
          sub.state === "Active" ||
          sub.state === "InGracePeriod" ||
          sub.state === "Paused" ||
          sub.state === "Unknown",
      )
      .map((sub) => ({
        userId: sub.userId!,
        sku: sub.productId,
        purchaseToken: sub.purchaseToken,
        state: sub.state,
      }));
  },
});

// The reconciler hands us a synthetic "event" describing what Meta
// just told us. We funnel it through the same state-machine the
// webhook receivers use so transition semantics stay consistent.
export const recordHorizonStatus = internalMutation({
  args: {
    projectId: v.id("projects"),
    purchaseToken: v.string(),
    userId: v.string(),
    productId: v.string(),
    eventType: v.union(
      v.literal("SubscriptionRenewed"),
      v.literal("SubscriptionExpired"),
    ),
  },
  returns: v.union(v.null(), v.id("subscriptions")),
  handler: async (ctx, args) => {
    const existing: Doc<"subscriptions"> | null = await ctx.db
      .query("subscriptions")
      .withIndex("by_project_and_token", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("purchaseToken", args.purchaseToken),
      )
      .unique();
    if (!existing) return null;

    const current: CurrentSubscription = {
      state: existing.state,
      productId: existing.productId,
      expiresAt: existing.expiresAt,
      renewsAt: existing.renewsAt,
      willRenew: existing.willRenew,
      cancellationReason: existing.cancellationReason,
      currency: existing.currency,
      priceAmountMicros: existing.priceAmountMicros,
    };
    const transition = applySubscriptionTransition(current, {
      type: args.eventType,
      productId: args.productId,
    });
    if (!transition.next) return existing._id;
    const now = Date.now();
    await ctx.db.patch(existing._id, {
      state: transition.next.state,
      willRenew: transition.next.willRenew,
      cancellationReason: transition.next.cancellationReason,
      updatedAt: now,
    });
    return existing._id;
  },
});
