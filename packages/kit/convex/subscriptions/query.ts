import { query, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

import { monthlyMicrosForSub } from "./monthlyMicros";
import { selectMostRecentlyUpdatedSubscription } from "./selectLatest";

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
// updated active subscription when the user is entitled, otherwise the
// most-recently-updated subscription overall, plus one `active` boolean
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
      .collect();

    const now = Date.now();
    const activeSubs = subs.filter((candidate) => isActive(candidate, now));
    const sub = selectMostRecentlyUpdatedSubscription(
      activeSubs.length > 0 ? activeSubs : subs,
    );
    if (!sub) return { active: false, subscription: null };

    return {
      active: activeSubs.length > 0,
      subscription: shapeRow(sub),
    };
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

    // userId path: subscriptions per user is a small population
    // (single digits in practice — a user with 50 subscriptions on a
    // single project is pathological), so we collect the entire
    // by_project_and_user slice and apply state/productId filters in
    // memory rather than throwing. Earlier behaviour rejected the
    // combo with an error, which made the dashboard "filter user X by
    // state Active" path unusable (PR #124
    // (https://github.com/hyodotdev/openiap/pull/124) review).
    if (args.userId) {
      const userRows = await ctx.db
        .query("subscriptions")
        .withIndex("by_project_and_user", (q) =>
          q.eq("projectId", project._id).eq("userId", args.userId),
        )
        .order("desc")
        .collect();
      const filtered = userRows.filter((sub) => {
        if (args.state && sub.state !== args.state) return false;
        if (args.productId && sub.productId !== args.productId) return false;
        return true;
      });
      return {
        items: filtered.slice(0, limit).map(shapeRow),
        total: filtered.length,
      };
    }

    // Pick the most-selective index for the supplied filters. Schema
    // covers single-filter combinations directly; the composite
    // (projectId, state, productId) index handles the dashboard's
    // common "filter by state and SKU" combination so we don't need
    // an over-fetch + in-memory post-filter that could miss rows
    // past the take() boundary.
    let rows: Array<Doc<"subscriptions">>;
    if (args.state && args.productId) {
      rows = await ctx.db
        .query("subscriptions")
        .withIndex("by_project_and_state_and_product", (q) =>
          q
            .eq("projectId", project._id)
            .eq("state", args.state!)
            .eq("productId", args.productId!),
        )
        .order("desc")
        .take(limit);
    } else if (args.state) {
      rows = await ctx.db
        .query("subscriptions")
        .withIndex("by_project_and_state", (q) =>
          q.eq("projectId", project._id).eq("state", args.state!),
        )
        .order("desc")
        .take(limit);
    } else if (args.productId) {
      rows = await ctx.db
        .query("subscriptions")
        .withIndex("by_project_and_product", (q) =>
          q.eq("projectId", project._id).eq("productId", args.productId!),
        )
        .order("desc")
        .take(limit);
    } else {
      rows = await ctx.db
        .query("subscriptions")
        .withIndex("by_project_and_updated", (q) =>
          q.eq("projectId", project._id),
        )
        .order("desc")
        .take(limit);
    }

    // All filter combinations hit an index that covers the supplied
    // columns now (the (state + productId) composite was added in
    // schema.ts), so no in-memory post-filter is needed here.

    // `total` reflects the filtered window we actually materialized,
    // not the full server-side count. Computing a true total would
    // require a separate aggregate scan that defeats the take() bound
    // we just put in. The dashboard treats `total` as "rows shown
    // matching the current filter" and surfaces "+ more" affordances
    // via the next page request.
    return { items: rows.slice(0, limit).map(shapeRow), total: rows.length };
  },
});

// Metrics aggregation. Reads incrementally-maintained per-currency
// counters out of `subscriptionStats` for the live state buckets +
// MRR (O(currencies-per-project) — typically 1-3 rows), and bounded
// indexed scans over `by_project_and_state` for the 30-day rolling
// counters. The prior implementation took up to 10,000 subscriptions
// off the by_project_and_updated index and aggregated in memory,
// which silently undercounted projects above that cap.
//
// Migration safety: when the stats table is empty for a project
// (pre-rollout state) we fall through to a one-shot recompute via
// the same statsContributionFor logic so the dashboard stays
// correct on first read after deploy. The
// `recomputeSubscriptionStats` internal mutation populates rows for
// future reads.
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

    const now = Date.now();
    const cutoff = now - 30 * 24 * 60 * 60 * 1000;

    // Live state counters + MRR — read out of the incrementally
    // maintained `subscriptionStats` table.
    const statsRows = await ctx.db
      .query("subscriptionStats")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    let activeSubs = 0;
    let inGracePeriod = 0;
    let inBillingRetry = 0;
    const mrrAccumulators = new Map<string, number>();

    if (statsRows.length > 0) {
      for (const row of statsRows) {
        activeSubs += row.activeSubs;
        inGracePeriod += row.inGracePeriod;
        inBillingRetry += row.inBillingRetry;
        if (row.currency && row.mrrMicros > 0) {
          mrrAccumulators.set(
            row.currency,
            (mrrAccumulators.get(row.currency) ?? 0) + row.mrrMicros,
          );
        }
      }
    } else {
      // No stats rows yet — pre-rollout state for this project.
      // Compute on the fly so the dashboard isn't blank on first
      // read after deploy. Bounded by the same per-project scan the
      // backfill mutation does; for projects past the prior 10k cap
      // this is a one-time cost until `recomputeSubscriptionStats`
      // populates the table.
      //
      // Bounded by FALLBACK_SCAN_CAP so a project that's hugely past
      // the prior 10k scan limit can't crash the dashboard render.
      // The cap matches the previous implementation's bound; the
      // first read after deploy schedules an async backfill via the
      // drift-correction cron, after which subsequent reads come
      // out of subscriptionStats and have no scan at all.
      const FALLBACK_SCAN_CAP = 10_000;
      const periodByProductId = await loadPeriodByProductId(ctx, project._id);
      const allSubs = await ctx.db
        .query("subscriptions")
        .withIndex("by_project_and_updated", (q) =>
          q.eq("projectId", project._id),
        )
        .order("desc")
        .take(FALLBACK_SCAN_CAP);
      for (const sub of allSubs) {
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
      }
    }

    // 30-day rolling counters — bounded by churn rather than by
    // historical state archive. The previous implementation walked
    // every `Refunded` row + every (Active|InGracePeriod|InBillingRetry
    // |Expired) row for the project and filtered in memory, which
    // grew unbounded as the historical archive accumulated. We now
    // do a single time-windowed scan via `by_project_and_updated`
    // with `gte(cutoff)`, then derive both refunded + canceled
    // counters in one pass. The candidate set is bounded by the
    // last 30 days of state changes (typically thousands per
    // project, never the full lifetime).
    // Cap the windowed scan so a project with > 10k state changes
    // in 30 days can't exceed Convex's 40k document-read limit. The
    // rolling counters degrade gracefully — if a project genuinely
    // hits this bound the dashboard shows an approximate count that
    // still tracks the cohort closely (this is the same trade-off
    // the previous SUBS_SCAN_CAP made for active counts, before the
    // incremental subscriptionStats path replaced it). Real-world
    // monthly churn is well under 10k for any realistic deployment.
    const ROLLING_SCAN_CAP = 10_000;
    const recentlyChanged = await ctx.db
      .query("subscriptions")
      .withIndex("by_project_and_updated", (q) =>
        q.eq("projectId", project._id).gte("updatedAt", cutoff),
      )
      .take(ROLLING_SCAN_CAP);
    let refunded30d = 0;
    let canceled30d = 0;
    const CANCELED_STATES = new Set([
      "Active",
      "InGracePeriod",
      "InBillingRetry",
      "Expired",
    ]);
    for (const sub of recentlyChanged) {
      if (sub.state === "Refunded") {
        refunded30d += 1;
      }
      if (
        sub.willRenew === false &&
        sub.cancellationReason === "UserCanceled" &&
        CANCELED_STATES.has(sub.state)
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

// Daily revenue + lifecycle metrics for the Analytics dashboard. Reads
// pre-computed rollups from `revenueMetricsDaily` (populated by the
// `recomputeAllRevenueMetrics` cron) so the dashboard never scans the
// raw webhookEvents log on render.
//
// `fromDay` and `toDay` are inclusive ISO date strings (YYYY-MM-DD,
// UTC) — same format `revenueMetricsDaily.day` is stored under, so
// the index range is a direct string comparison.
//
// Return shape: one entry per rollup row, i.e. one per
// (day, currency, productId, platform). Aggregation across rows
// happens client-side (`analytics.tsx`) so the dashboard can switch
// between filter combinations without re-querying. Summing across
// currencies is a UI-side concern — `revenueMicros` from a USD row
// and a EUR row cannot be added without an FX rate.
const platformValidator = v.union(v.literal("IOS"), v.literal("Android"));

export const getRevenueMetrics = query({
  args: {
    apiKey: v.string(),
    fromDay: v.string(),
    toDay: v.string(),
    productId: v.optional(v.string()),
    currency: v.optional(v.string()),
    platform: v.optional(platformValidator),
  },
  returns: v.object({
    days: v.array(
      v.object({
        day: v.string(),
        currency: v.string(),
        productId: v.string(),
        platform: platformValidator,
        activeSubs: v.number(),
        newSubs: v.number(),
        renewals: v.number(),
        cancellations: v.number(),
        refunds: v.number(),
        revenueMicros: v.number(),
      }),
    ),
    // Available filter values surfaced to the dashboard so the UI
    // can render dropdowns / chiclets for everything the project
    // actually has data for, without a second round-trip.
    currencies: v.array(v.string()),
    productIds: v.array(v.string()),
    platforms: v.array(platformValidator),
    // True when the underlying scan hit `REVENUE_SCAN_CAP` and the
    // returned rows are a partial view of the requested window. The
    // dashboard surfaces this as a banner so a truncated chart is
    // visible to the operator instead of silently rendering a
    // partial tail.
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const project = await projectByApiKey(ctx, args.apiKey);
    if (!project) {
      return {
        days: [],
        currencies: [],
        productIds: [],
        platforms: [],
        truncated: false,
      };
    }

    // Reject ranges past the dashboard's longest preset (90 days)
    // before issuing the index scan. A misbehaving client can
    // otherwise request `fromDay = "1970-01-01"` and force the
    // server to materialize every rollup row in the project. The
    // 90-day cap matches `RANGES` in `analytics.tsx`; widening
    // there should bump this in lockstep.
    const MAX_RANGE_DAYS = 92;
    if (args.fromDay > args.toDay) {
      throw new Error(
        `getRevenueMetrics: fromDay (${args.fromDay}) is after toDay (${args.toDay}).`,
      );
    }
    const fromMs = Date.parse(`${args.fromDay}T00:00:00.000Z`);
    const toMs = Date.parse(`${args.toDay}T00:00:00.000Z`);
    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
      throw new Error(
        `getRevenueMetrics: invalid ISO date(s) fromDay=${args.fromDay} toDay=${args.toDay}.`,
      );
    }
    const spanDays = Math.round((toMs - fromMs) / 86_400_000) + 1;
    if (spanDays > MAX_RANGE_DAYS) {
      throw new Error(
        `getRevenueMetrics: span of ${spanDays} days exceeds MAX_RANGE_DAYS=${MAX_RANGE_DAYS}.`,
      );
    }

    // Range scan via `by_project_and_day_and_currency`. The index
    // is `[projectId, day, currency]`, so `eq(projectId).gte(day)
    // .lte(day)` resolves the entire window in one index hit;
    // currency / product / platform filters are applied in-memory
    // afterward.
    //
    // Capped at REVENUE_SCAN_CAP — same number `metricsSummary` uses
    // for its FALLBACK_SCAN_CAP / ROLLING_SCAN_CAP — to stay under
    // Convex's 32k document-scan limit per query. A 92-day range
    // across a maximalist project (30 SKUs × 3 currencies × 2
    // platforms = 180 rows/day → ~16.5k rows for 92 days) fits
    // comfortably; truncation at the cap surfaces as the warning
    // below so we never silently render a partial chart.
    const REVENUE_SCAN_CAP = 10_000;
    const allRows = await ctx.db
      .query("revenueMetricsDaily")
      .withIndex("by_project_and_day_and_currency", (q) =>
        q
          .eq("projectId", project._id)
          .gte("day", args.fromDay)
          .lte("day", args.toDay),
      )
      .take(REVENUE_SCAN_CAP);
    const truncated = allRows.length === REVENUE_SCAN_CAP;
    if (truncated) {
      console.warn(
        `[getRevenueMetrics] revenueMetricsDaily scan hit REVENUE_SCAN_CAP=${REVENUE_SCAN_CAP} for project=${project._id} range=${args.fromDay}..${args.toDay}; chart will undercount the tail.`,
      );
    }

    // Populate filter-dropdown choices from the UNFILTERED set so the
    // UI can keep showing every available currency / product /
    // platform regardless of which filter is currently active —
    // otherwise selecting one currency would prune the dropdown to
    // just that currency and the user could never get back without
    // clearing.
    const currencies = new Set<string>();
    const productIds = new Set<string>();
    const platforms = new Set<"IOS" | "Android">();
    for (const row of allRows) {
      if (row.currency) currencies.add(row.currency);
      productIds.add(row.productId);
      platforms.add(row.platform);
    }

    let rows = allRows;
    if (args.productId) {
      rows = rows.filter((row) => row.productId === args.productId);
    }
    if (args.currency) {
      rows = rows.filter((row) => row.currency === args.currency);
    }
    if (args.platform) {
      rows = rows.filter((row) => row.platform === args.platform);
    }

    return {
      days: rows.map((row) => ({
        day: row.day,
        currency: row.currency,
        productId: row.productId,
        platform: row.platform,
        activeSubs: row.activeSubs,
        newSubs: row.newSubs,
        renewals: row.renewals,
        cancellations: row.cancellations,
        refunds: row.refunds,
        revenueMicros: row.revenueMicros,
      })),
      currencies: Array.from(currencies).sort(),
      productIds: Array.from(productIds).sort(),
      platforms: Array.from(platforms).sort(),
      truncated,
    };
  },
});

async function loadPeriodByProductId(
  ctx: QueryCtx,
  projectId: Id<"projects">,
): Promise<Map<string, string | undefined>> {
  const periodByProductId = new Map<string, string | undefined>();
  for (const platform of ["IOS", "Android"] as const) {
    const productRows = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform", (q) =>
        q.eq("projectId", projectId).eq("platform", platform),
      )
      .collect();
    for (const product of productRows) {
      if (
        !periodByProductId.has(product.productId) ||
        (periodByProductId.get(product.productId) === undefined &&
          product.billingPeriod !== undefined)
      ) {
        periodByProductId.set(product.productId, product.billingPeriod);
      }
    }
  }
  return periodByProductId;
}
