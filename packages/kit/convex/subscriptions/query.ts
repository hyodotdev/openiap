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

    // Over-fetch enough to honor an in-memory `productId` filter
    // without scanning the entire table, but cap so a project with
    // millions of expired subs can't blow Convex's read budget.
    // Indexes don't cover (state, productId) so we still do an
    // in-memory filter for productId — over-fetching by 4× keeps the
    // dashboard's filter UX reactive in the common case while the
    // bound prevents a runaway query.
    const fetchLimit = args.productId ? Math.min(limit * 4, 500) : limit;

    let rows: Array<Doc<"subscriptions">>;
    if (args.state) {
      rows = await ctx.db
        .query("subscriptions")
        .withIndex("by_project_and_state", (q) =>
          q.eq("projectId", project._id).eq("state", args.state!),
        )
        .order("desc")
        .take(fetchLimit);
    } else if (args.userId) {
      rows = await ctx.db
        .query("subscriptions")
        .withIndex("by_project_and_user", (q) =>
          q.eq("projectId", project._id).eq("userId", args.userId),
        )
        .order("desc")
        .take(fetchLimit);
    } else {
      rows = await ctx.db
        .query("subscriptions")
        .withIndex("by_project_and_updated", (q) =>
          q.eq("projectId", project._id),
        )
        .order("desc")
        .take(fetchLimit);
    }

    if (args.productId) {
      rows = rows.filter((row) => row.productId === args.productId);
    }

    // `total` reflects the filtered window we actually materialized,
    // not the full server-side count. Computing a true total would
    // require a separate aggregate scan that defeats the take() bound
    // we just put in. The dashboard treats `total` as "rows shown
    // matching the current filter" and surfaces "+ more" affordances
    // via the next page request.
    return { items: rows.slice(0, limit).map(shapeRow), total: rows.length };
  },
});

// Normalize a single subscription's recurring charge to a *monthly*
// micros figure so MRR can sum across products with different billing
// periods. Formula uses calendar averages — yearly /12, weekly *4.345
// (= 52.14/12), bi-weekly *2.17, daily *30.44 — chosen to land in the
// same order of magnitude as the standard SaaS MRR convention. The
// previous implementation summed `priceAmountMicros` raw, so a $120/yr
// plan inflated MRR by 12×.
function monthlyMicrosForSub(
  sub: Doc<"subscriptions">,
  productPeriod: string | undefined,
): number {
  if (typeof sub.priceAmountMicros !== "number") return 0;
  const amount = sub.priceAmountMicros;
  switch (productPeriod) {
    case "P1Y":
      return Math.round(amount / 12);
    case "P6M":
      return Math.round(amount / 6);
    case "P3M":
      return Math.round(amount / 3);
    case "P2M":
      return Math.round(amount / 2);
    case "P1W":
      return Math.round(amount * 4.345);
    case "P3D":
      return Math.round(amount * (30.44 / 3));
    case "P2W":
      return Math.round(amount * (30.44 / 14));
    case "P1M":
    case undefined:
    default:
      return amount;
  }
}

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
    // Headline MRR in the project's most-popular currency, normalized
    // to monthly. Historical field name kept for backward compat with
    // dashboard / MCP consumers.
    mrrMicros: v.number(),
    currency: v.optional(v.string()),
    // Full per-currency breakdown so consumers that care about
    // multi-currency aren't left guessing. Each entry's `mrrMicros`
    // is summed only over subscriptions in that currency, normalized
    // to monthly via the product's billingPeriod.
    mrrByCurrency: v.array(
      v.object({ currency: v.string(), mrrMicros: v.number() }),
    ),
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
        mrrByCurrency: [],
      };
    }

    const all = await ctx.db
      .query("subscriptions")
      .withIndex("by_project_and_updated", (q) =>
        q.eq("projectId", project._id),
      )
      .collect();

    // Look up each productId's billingPeriod from the products table
    // so we can normalize yearly / quarterly / weekly subs to monthly.
    // Cached per-productId because a project can have thousands of
    // active subs but typically <50 products.
    const productIds = new Set(all.map((sub) => sub.productId));
    const periodByProductId = new Map<string, string | undefined>();
    for (const productId of productIds) {
      // Same productId can exist for both iOS + Android with the same
      // billing period; either row's period works.
      const productRows = await ctx.db
        .query("products")
        .withIndex("by_project_and_platform_and_product", (q) =>
          q
            .eq("projectId", project._id)
            .eq("platform", "IOS")
            .eq("productId", productId),
        )
        .take(1);
      const fallback = productRows[0]
        ? productRows[0].billingPeriod
        : (
            await ctx.db
              .query("products")
              .withIndex("by_project_and_platform_and_product", (q) =>
                q
                  .eq("projectId", project._id)
                  .eq("platform", "Android")
                  .eq("productId", productId),
              )
              .take(1)
          )[0]?.billingPeriod;
      periodByProductId.set(productId, fallback);
    }

    const now = Date.now();
    const cutoff = now - 30 * 24 * 60 * 60 * 1000;

    let activeSubs = 0;
    let inGracePeriod = 0;
    let inBillingRetry = 0;
    let refunded30d = 0;
    let canceled30d = 0;
    const mrrAccumulators = new Map<string, number>();

    for (const sub of all) {
      if (sub.state === "Active" && isActive(sub, now)) {
        activeSubs += 1;
        if (typeof sub.priceAmountMicros === "number" && sub.currency) {
          const monthly = monthlyMicrosForSub(
            sub,
            periodByProductId.get(sub.productId),
          );
          mrrAccumulators.set(
            sub.currency,
            (mrrAccumulators.get(sub.currency) ?? 0) + monthly,
          );
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

    // Pick the most-popular currency (largest accumulator) as the
    // headline `currency` + `mrrMicros` so dashboards / MCP consumers
    // that don't yet read the multi-currency breakdown still show a
    // sensible single value. Stable tie-break via alphabetical sort.
    const sorted = Array.from(mrrAccumulators.entries()).sort(
      ([a, av], [b, bv]) => (bv !== av ? bv - av : a.localeCompare(b)),
    );
    const headline = sorted[0];

    return {
      activeSubs,
      inGracePeriod,
      inBillingRetry,
      refunded30d,
      canceled30d,
      mrrMicros: headline ? headline[1] : 0,
      currency: headline ? headline[0] : undefined,
      mrrByCurrency: sorted.map(([currency, mrrMicros]) => ({
        currency,
        mrrMicros,
      })),
    };
  },
});
