import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

const subscriptionStateValidator = v.union(
  v.literal("Active"),
  v.literal("InGracePeriod"),
  v.literal("InBillingRetry"),
  v.literal("Expired"),
  v.literal("Revoked"),
  v.literal("Refunded"),
  v.literal("Paused"),
  v.literal("Unknown"),
);

const subscriptionShape = v.object({
  id: v.id("subscriptions"),
  productId: v.string(),
  platform: v.union(v.literal("IOS"), v.literal("Android")),
  state: subscriptionStateValidator,
  expiresAt: v.optional(v.number()),
  renewsAt: v.optional(v.number()),
  willRenew: v.optional(v.boolean()),
  cancellationReason: v.optional(v.string()),
  currency: v.optional(v.string()),
  priceAmountMicros: v.optional(v.number()),
  startedAt: v.number(),
  updatedAt: v.number(),
  purchaseToken: v.string(),
  userId: v.optional(v.string()),
});

function isActive(sub: Doc<"subscriptions">, now: number): boolean {
  const entitled = sub.state === "Active" || sub.state === "InGracePeriod";
  if (!entitled) return false;
  if (sub.expiresAt != null && sub.expiresAt <= now) return false;
  return true;
}

function shapeRow(sub: Doc<"subscriptions">) {
  return {
    id: sub._id,
    productId: sub.productId,
    platform: sub.platform,
    state: sub.state,
    expiresAt: sub.expiresAt,
    renewsAt: sub.renewsAt,
    willRenew: sub.willRenew,
    cancellationReason: sub.cancellationReason,
    currency: sub.currency,
    priceAmountMicros: sub.priceAmountMicros,
    startedAt: sub.startedAt,
    updatedAt: sub.updatedAt,
    purchaseToken: sub.purchaseToken,
    userId: sub.userId,
  };
}

async function projectByApiKey(
  ctx: { db: any },
  apiKey: string,
): Promise<Doc<"projects"> | null> {
  return await ctx.db
    .query("projects")
    .withIndex("by_api_key", (q: any) => q.eq("apiKey", apiKey))
    .unique();
}

// Match onesub's `/onesub/status?userId=` — returns the most-recently-
// updated subscription for the user along with a single `active` boolean
// for simple gating.
export const subscriptionStatus = query({
  args: { apiKey: v.string(), userId: v.string() },
  returns: v.object({
    active: v.boolean(),
    subscription: v.union(subscriptionShape, v.null()),
  }),
  handler: async (ctx, args) => {
    const project = await projectByApiKey(ctx, args.apiKey);
    if (!project) return { active: false, subscription: null };

    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_project_and_user", (q) =>
        q.eq("projectId", project._id).eq("userId", args.userId),
      )
      .order("desc")
      .take(1);

    const sub = subs[0] ?? null;
    if (!sub) return { active: false, subscription: null };

    return { active: isActive(sub, Date.now()), subscription: shapeRow(sub) };
  },
});

// Match onesub's entitlement evaluation — every productId the user
// currently has rights to. Aggregates across all subscription rows so
// a user with multiple offers (resub, family share, cross-grade) sees
// the union.
export const entitlements = query({
  args: { apiKey: v.string(), userId: v.string() },
  returns: v.object({
    userId: v.string(),
    productIds: v.array(v.string()),
    subscriptions: v.array(subscriptionShape),
  }),
  handler: async (ctx, args) => {
    const project = await projectByApiKey(ctx, args.apiKey);
    if (!project) {
      return { userId: args.userId, productIds: [], subscriptions: [] };
    }

    const all = await ctx.db
      .query("subscriptions")
      .withIndex("by_project_and_user", (q) =>
        q.eq("projectId", project._id).eq("userId", args.userId),
      )
      .collect();

    const now = Date.now();
    const active = all.filter((sub) => isActive(sub, now));
    return {
      userId: args.userId,
      productIds: Array.from(new Set(active.map((sub) => sub.productId))),
      subscriptions: active.map(shapeRow),
    };
  },
});

// Filtered list for the dashboard's subscriptions page. Mirrors
// onesub's `SubscriptionStore.listFiltered` API.
export const listSubscriptions = query({
  args: {
    apiKey: v.string(),
    state: v.optional(subscriptionStateValidator),
    productId: v.optional(v.string()),
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    items: v.array(subscriptionShape),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    const project = await projectByApiKey(ctx, args.apiKey);
    if (!project) return { items: [], total: 0 };

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);

    let rows: Array<Doc<"subscriptions">>;
    if (args.state) {
      rows = await ctx.db
        .query("subscriptions")
        .withIndex("by_project_and_state", (q) =>
          q.eq("projectId", project._id).eq("state", args.state!),
        )
        .order("desc")
        .collect();
    } else if (args.userId) {
      rows = await ctx.db
        .query("subscriptions")
        .withIndex("by_project_and_user", (q) =>
          q.eq("projectId", project._id).eq("userId", args.userId),
        )
        .order("desc")
        .collect();
    } else {
      rows = await ctx.db
        .query("subscriptions")
        .withIndex("by_project_and_updated", (q) =>
          q.eq("projectId", project._id),
        )
        .order("desc")
        .take(500);
    }

    if (args.productId) {
      rows = rows.filter((row) => row.productId === args.productId);
    }

    return { items: rows.slice(0, limit).map(shapeRow), total: rows.length };
  },
});

// Lightweight metrics aggregation. For high-volume projects this should
// move to the daily rollup table; for v0 we compute live from
// `subscriptions` so the UX doesn't depend on a cron having run.
export const metricsSummary = query({
  args: { apiKey: v.string() },
  returns: v.object({
    activeSubs: v.number(),
    inGracePeriod: v.number(),
    inBillingRetry: v.number(),
    refunded30d: v.number(),
    canceled30d: v.number(),
    mrrMicros: v.number(),
    currency: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const project = await projectByApiKey(ctx, args.apiKey);
    if (!project) {
      return {
        activeSubs: 0,
        inGracePeriod: 0,
        inBillingRetry: 0,
        refunded30d: 0,
        canceled30d: 0,
        mrrMicros: 0,
        currency: undefined,
      };
    }

    const all = await ctx.db
      .query("subscriptions")
      .withIndex("by_project_and_updated", (q) =>
        q.eq("projectId", project._id),
      )
      .collect();

    const now = Date.now();
    const cutoff = now - 30 * 24 * 60 * 60 * 1000;

    let activeSubs = 0;
    let inGracePeriod = 0;
    let inBillingRetry = 0;
    let refunded30d = 0;
    let canceled30d = 0;
    let mrrMicros = 0;
    let currency: string | undefined;

    for (const sub of all) {
      if (sub.state === "Active" && isActive(sub, now)) {
        activeSubs += 1;
        if (typeof sub.priceAmountMicros === "number") {
          mrrMicros += sub.priceAmountMicros;
          if (!currency && sub.currency) currency = sub.currency;
        }
      } else if (sub.state === "InGracePeriod") {
        inGracePeriod += 1;
      } else if (sub.state === "InBillingRetry") {
        inBillingRetry += 1;
      }

      if (sub.state === "Refunded" && sub.updatedAt >= cutoff) {
        refunded30d += 1;
      }
      if (
        sub.willRenew === false &&
        sub.cancellationReason === "UserCanceled" &&
        sub.updatedAt >= cutoff
      ) {
        canceled30d += 1;
      }
    }

    return {
      activeSubs,
      inGracePeriod,
      inBillingRetry,
      refunded30d,
      canceled30d,
      mrrMicros,
      currency,
    };
  },
});
