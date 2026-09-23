import { query, type QueryCtx } from "../_generated/server";
import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

import {
  resolveProjectByApiKeyFromDb,
  resolveProjectByIdForCurrentUserFromDb,
} from "../projects/helpers";
import { monthlyMicrosForSub } from "./monthlyMicros";
import { selectMostRecentlyUpdatedSubscription } from "./selectLatest";
import {
  DEFAULT_REPORTING_CURRENCY,
  normalizeReportingCurrencyOrDefault,
} from "../utils/currency";
import { subscriptionStateValidator } from "../utils/validation";

const subscriptionFields = {
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
  // SECURITY DEBT: on Android this is the credential a server accepts as proof
  // of purchase, and these rows reach routes that answer to a publishable key
  // shipped inside the app. It cannot be removed additively: MAUI declares it
  // `required`, and its tolerant deserializer turns a missing field into a null
  // subscription and silently drops entitlement rows — every installed MAUI app
  // would lose entitlement. Removal needs an explicit version transition.
  purchaseToken: v.string(),
  originalTransactionId: v.optional(v.string()),
  userId: v.optional(v.string()),
};
const subscriptionShape = v.object(subscriptionFields);
const subscriptionV2Shape = v.object({
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
  userId: v.optional(v.string()),
});
const subscriptionEvaluationRowShape = v.object({
  ...subscriptionFields,
  createdAt: v.number(),
});
type SubscriptionRow = Infer<typeof subscriptionShape>;
type SubscriptionV2Row = Infer<typeof subscriptionV2Shape>;
type SubscriptionEvaluationRow = Infer<typeof subscriptionEvaluationRowShape>;
export const MAX_USER_SUBSCRIPTION_ROWS = 200;

/**
 * SPEC.md 2.3 entitlement gate as a pure predicate: only Active and
 * InGracePeriod grant access, an omitted expiry means none is known, and the
 * boundary is exclusive — expiresAt == now is NOT entitled. Exported so the
 * conformance adapter certifies the same predicate every read uses.
 */
export function isEntitledAt(
  state: string,
  expiresAt: number | null | undefined,
  now: number,
): boolean {
  if (state !== "Active" && state !== "InGracePeriod") return false;
  if (expiresAt != null && expiresAt <= now) return false;
  return true;
}

function isActive(sub: Doc<"subscriptions">, now: number): boolean {
  return isEntitledAt(sub.state, sub.expiresAt, now);
}

function isEntitledState(sub: Doc<"subscriptions">): boolean {
  return sub.state === "Active" || sub.state === "InGracePeriod";
}

export function assertUserSubscriptionRowLimit(
  rows: Array<Doc<"subscriptions">>,
): void {
  if (rows.length <= MAX_USER_SUBSCRIPTION_ROWS) return;
  throw new ConvexError({
    code: "ENTITLEMENT_SNAPSHOT_TOO_LARGE",
    message:
      "This user has more than 200 subscription rows. Contact IAPKit support before retrying.",
  });
}

async function userSubscriptionRows(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  userId: string,
): Promise<Array<Doc<"subscriptions">>> {
  const rows = await ctx.db
    .query("subscriptions")
    .withIndex("by_project_and_user_and_updated", (q) =>
      q.eq("projectId", projectId).eq("userId", userId),
    )
    .order("desc")
    .take(MAX_USER_SUBSCRIPTION_ROWS + 1);
  assertUserSubscriptionRowLimit(rows);
  return rows;
}

export function shapeSubscriptionEvaluationSnapshot(
  rows: Array<Doc<"subscriptions">>,
): {
  candidates: SubscriptionEvaluationRow[];
  fallback: SubscriptionEvaluationRow | null;
} {
  const fallback = selectMostRecentlyUpdatedSubscription(rows);
  return {
    candidates: rows
      .filter(isEntitledState)
      .map(shapeSubscriptionEvaluationRow),
    fallback: fallback ? shapeSubscriptionEvaluationRow(fallback) : null,
  };
}

function shapeSubscriptionEvaluationRow(
  sub: Doc<"subscriptions">,
): SubscriptionEvaluationRow {
  return {
    ...shapeSubscriptionRow(sub),
    createdAt: sub._creationTime,
  };
}

export function shapeSubscriptionRow(
  sub: Doc<"subscriptions">,
): SubscriptionRow {
  const row: SubscriptionRow = {
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

  if (sub.platform === "IOS") {
    return {
      ...row,
      originalTransactionId: sub.purchaseToken,
    };
  }

  return row;
}

export function shapeSubscriptionV2Row(
  sub: Doc<"subscriptions">,
): SubscriptionV2Row {
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
    userId: sub.userId,
  };
}

async function projectByApiKey(
  ctx: QueryCtx,
  apiKey: string | undefined,
  requiredAccess: "client" | "admin" = "client",
): Promise<Doc<"projects"> | null> {
  if (!apiKey) return null;
  const resolved = await resolveProjectByApiKeyFromDb(
    ctx,
    apiKey,
    requiredAccess,
  );
  return resolved?.project ?? null;
}

async function requireAdminProjectByApiKey(
  ctx: QueryCtx,
  apiKey: string,
): Promise<Doc<"projects">> {
  const project = await projectByApiKey(ctx, apiKey, "admin");
  if (!project) {
    throw new ConvexError({
      code: "INVALID_API_KEY",
      message: "API key is invalid or inactive",
    });
  }
  return project;
}

async function projectByIdForCurrentUser(
  ctx: QueryCtx,
  projectId: Id<"projects"> | undefined,
): Promise<Doc<"projects"> | null> {
  if (!projectId) return null;
  const resolved = await resolveProjectByIdForCurrentUserFromDb(ctx, projectId);
  return resolved?.project ?? null;
}

async function projectForReadArgs(
  ctx: QueryCtx,
  args: {
    apiKey?: string;
    projectId?: Id<"projects">;
  },
  apiKeyAccess: "client" | "admin" = "client",
): Promise<Doc<"projects"> | null> {
  if (args.projectId) {
    return projectByIdForCurrentUser(ctx, args.projectId);
  }

  if (args.apiKey !== undefined) {
    return projectByApiKey(ctx, args.apiKey, apiKeyAccess);
  }

  throw new Error("apiKey or projectId is required.");
}

export interface MrrCurrencyEntry {
  currency: string;
  mrrMicros: number;
}

/**
 * Selects the headline MRR entry for a project's reporting currency.
 *
 * `reportingCurrency` is normalized via `normalizeReportingCurrencyOrDefault`,
 * so unknown or invalid input falls back to `DEFAULT_REPORTING_CURRENCY`.
 * If no entry matches the normalized currency, returned `mrrMicros` is `0`.
 * Returned `excludedMrrByCurrency` contains every non-reporting-currency entry.
 *
 * @param entries Per-currency MRR rows already summed for the project.
 * @param reportingCurrency Project-configured reporting currency, raw or normalized.
 * @returns The normalized `currency`, selected `mrrMicros`, and excluded rows.
 */
export function selectReportingMrr(
  entries: MrrCurrencyEntry[],
  reportingCurrency: string | null | undefined,
): {
  currency: string;
  mrrMicros: number;
  excludedMrrByCurrency: MrrCurrencyEntry[];
} {
  const normalizedReportingCurrency =
    normalizeReportingCurrencyOrDefault(reportingCurrency);
  const reportingEntry = entries.find(
    (entry) => entry.currency === normalizedReportingCurrency,
  );

  return {
    currency: normalizedReportingCurrency,
    mrrMicros: reportingEntry?.mrrMicros ?? 0,
    excludedMrrByCurrency: entries.filter(
      (entry) => entry.currency !== normalizedReportingCurrency,
    ),
  };
}

// Clock-free snapshot for the Fly HTTP layer, so Convex can cache it and
// invalidate it on row changes. Of the historical rows only the latest is kept,
// as the status fallback; Fly drops candidates whose expiresAt has passed using
// its own clock.
export const subscriptionEvaluationSnapshot = query({
  args: {
    apiKey: v.string(),
    userId: v.string(),
  },
  returns: v.object({
    projectId: v.union(v.id("projects"), v.null()),
    candidates: v.array(subscriptionEvaluationRowShape),
    fallback: v.union(subscriptionEvaluationRowShape, v.null()),
  }),
  handler: async (ctx, args) => {
    const project = await projectByApiKey(ctx, args.apiKey);
    if (!project) return { projectId: null, candidates: [], fallback: null };

    const rows = await userSubscriptionRows(ctx, project._id, args.userId);
    return {
      projectId: project._id,
      ...shapeSubscriptionEvaluationSnapshot(rows),
    };
  },
});

// `/v2` account reads are server-to-server. Convex repeats the admin check and
// shapes the response without store credentials before it crosses the HTTP
// boundary.
export const subscriptionStatusV2 = query({
  args: { apiKey: v.string(), userId: v.string(), now: v.number() },
  returns: v.object({
    active: v.boolean(),
    subscription: v.union(subscriptionV2Shape, v.null()),
  }),
  handler: async (ctx, args) => {
    const project = await requireAdminProjectByApiKey(ctx, args.apiKey);

    const subs = await userSubscriptionRows(ctx, project._id, args.userId);
    const activeSubs = subs.filter((candidate) =>
      isActive(candidate, args.now),
    );
    const selected = selectMostRecentlyUpdatedSubscription(
      activeSubs.length > 0 ? activeSubs : subs,
    );

    return {
      active: activeSubs.length > 0,
      subscription: selected ? shapeSubscriptionV2Row(selected) : null,
    };
  },
});

export const entitlementsV2 = query({
  args: { apiKey: v.string(), userId: v.string(), now: v.number() },
  returns: v.object({
    userId: v.string(),
    productIds: v.array(v.string()),
    subscriptions: v.array(subscriptionV2Shape),
  }),
  handler: async (ctx, args) => {
    const project = await requireAdminProjectByApiKey(ctx, args.apiKey);

    const all = await userSubscriptionRows(ctx, project._id, args.userId);
    const active = all.filter((sub) => isActive(sub, args.now));
    return {
      userId: args.userId,
      productIds: Array.from(new Set(active.map((sub) => sub.productId))),
      subscriptions: active.map(shapeSubscriptionV2Row),
    };
  },
});

// Authoritative server-credential gate with no side effect and no data. The
// commerce bindPurchase handler calls this before it parses store evidence, so
// an unknown or under-scoped key is rejected (UNAUTHORIZED / FORBIDDEN) before
// it can learn which stores bind or which evidence a store requires.
export const assertServerAccess = query({
  args: { apiKey: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdminProjectByApiKey(ctx, args.apiKey);
    return { ok: true };
  },
});

export const userErasureStatusV2 = query({
  args: {
    apiKey: v.string(),
    // The id arrives from a URL path; a malformed one must read as "no such
    // job" (404), not fail argument validation into a 500.
    jobId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      jobId: v.id("subscriptionUserErasureJobs"),
      status: v.union(
        v.literal("queued"),
        v.literal("running"),
        v.literal("completed"),
      ),
      subscriptionsErased: v.number(),
      commerceEventsErased: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
      completedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const project = await requireAdminProjectByApiKey(ctx, args.apiKey);
    const jobId = ctx.db.normalizeId("subscriptionUserErasureJobs", args.jobId);
    if (!jobId) return null;
    const job = await ctx.db.get(jobId);
    if (!job || job.projectId !== project._id) return null;
    return {
      jobId: job._id,
      status: job.status,
      subscriptionsErased: job.subscriptionsErased,
      commerceEventsErased: job.commerceEventsErased,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
    };
  },
});

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

    const subs = await userSubscriptionRows(ctx, project._id, args.userId);

    const now = Date.now();
    const activeSubs = subs.filter((candidate) => isActive(candidate, now));
    const sub = selectMostRecentlyUpdatedSubscription(
      activeSubs.length > 0 ? activeSubs : subs,
    );
    if (!sub) return { active: false, subscription: null };

    return {
      active: activeSubs.length > 0,
      subscription: shapeSubscriptionRow(sub),
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

    const all = await userSubscriptionRows(ctx, project._id, args.userId);

    const now = Date.now();
    const active = all.filter((sub) => isActive(sub, now));
    return {
      userId: args.userId,
      productIds: Array.from(new Set(active.map((sub) => sub.productId))),
      subscriptions: active.map(shapeSubscriptionRow),
    };
  },
});

// Filtered list for the dashboard's subscriptions page. Mirrors
// onesub's `SubscriptionStore.listFiltered` API.
export const listSubscriptions = query({
  args: {
    apiKey: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
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
    const project = await projectForReadArgs(ctx, args, "admin");
    if (!project) return { items: [], total: 0 };

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);

    // A user has few subscriptions, so load them all and filter by state and
    // productId in memory.
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
        items: filtered.slice(0, limit).map(shapeSubscriptionRow),
        total: filtered.length,
      };
    }

    // Every filter combination has an index (state + productId is a composite),
    // so take() never cuts off rows a post-filter would need.
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

    // `total` counts the rows loaded, not every match; a true count would need
    // an unbounded scan.
    return {
      items: rows.slice(0, limit).map(shapeSubscriptionRow),
      total: rows.length,
    };
  },
});

// Live counts and MRR come from `subscriptionStats` (one row per currency), the
// 30-day counters from a bounded indexed scan. A project with no stats rows yet
// is computed on the fly until `recomputeSubscriptionStats` fills them.
export const metricsSummary = query({
  args: {
    apiKey: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  returns: v.object({
    activeSubs: v.number(),
    inGracePeriod: v.number(),
    inBillingRetry: v.number(),
    refunded30d: v.number(),
    canceled30d: v.number(),
    // Monthly MRR in the reporting currency only; the name predates
    // per-currency MRR and is kept for dashboard and MCP consumers.
    mrrMicros: v.number(),
    currency: v.optional(v.string()),
    reportingCurrency: v.string(),
    // Per-currency MRR, each normalized to monthly by the product's
    // billingPeriod.
    mrrByCurrency: v.array(
      v.object({ currency: v.string(), mrrMicros: v.number() }),
    ),
    excludedMrrByCurrency: v.array(
      v.object({ currency: v.string(), mrrMicros: v.number() }),
    ),
  }),
  handler: async (ctx, args) => {
    const project = await projectForReadArgs(ctx, args, "admin");
    if (!project) {
      return {
        activeSubs: 0,
        inGracePeriod: 0,
        inBillingRetry: 0,
        refunded30d: 0,
        canceled30d: 0,
        mrrMicros: 0,
        currency: DEFAULT_REPORTING_CURRENCY,
        reportingCurrency: DEFAULT_REPORTING_CURRENCY,
        mrrByCurrency: [],
        excludedMrrByCurrency: [],
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
      // No stats rows yet: compute on the fly, capped so a huge project cannot
      // break the render, until the drift-correction cron backfills
      // `subscriptionStats`.
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

    // 30-day counters from one `by_project_and_updated` scan since the cutoff,
    // so the cost follows recent churn, not history. The cap keeps a project
    // with over 10k changes in 30 days under Convex's 40k read limit; past it
    // the counts are approximate.
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

    // Sorted for stable rendering. Only the reporting currency feeds the
    // headline; the others stay in `excludedMrrByCurrency` instead of being
    // summed.
    const sorted = Array.from(mrrAccumulators.entries()).sort(
      ([a, av], [b, bv]) => (bv !== av ? bv - av : a.localeCompare(b)),
    );
    const mrrByCurrency = sorted.map(([currency, mrrMicros]) => ({
      currency,
      mrrMicros,
    }));
    const reportingMrr = selectReportingMrr(
      mrrByCurrency,
      project.reportingCurrency,
    );

    return {
      activeSubs,
      inGracePeriod,
      inBillingRetry,
      refunded30d,
      canceled30d,
      mrrMicros: reportingMrr.mrrMicros,
      currency: reportingMrr.currency,
      reportingCurrency: reportingMrr.currency,
      mrrByCurrency,
      excludedMrrByCurrency: reportingMrr.excludedMrrByCurrency,
    };
  },
});

// Daily metrics for the Analytics dashboard from the `revenueMetricsDaily`
// rollups, so a render never scans `webhookEvents`. `fromDay` and `toDay` are
// inclusive UTC YYYY-MM-DD, compared as strings on the index. Returns one entry
// per (day, currency, productId, platform) for the dashboard to aggregate; rows
// in different currencies need an FX rate to add.
const platformValidator = v.union(v.literal("IOS"), v.literal("Android"));

export const getRevenueMetrics = query({
  args: {
    apiKey: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    fromDay: v.string(),
    toDay: v.string(),
    // No product, currency or platform args: the dashboard filters client-side
    // and fills its dropdowns from the unfiltered rows. Add a separate query if
    // another caller needs narrowing.
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
    // Every value in the window, for the dashboard's filter dropdowns.
    currencies: v.array(v.string()),
    productIds: v.array(v.string()),
    platforms: v.array(platformValidator),
    // The scan hit REVENUE_SCAN_CAP; the dashboard shows a banner.
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const project = await projectForReadArgs(ctx, args, "admin");
    if (!project) {
      return {
        days: [],
        currencies: [],
        productIds: [],
        platforms: [],
        truncated: false,
      };
    }

    // Cap at the dashboard's longest preset (`RANGES` in analytics.tsx; change
    // both together) so a client cannot load every rollup row.
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

    // Below Convex's 32k per-query scan limit, and above 92 days of 30 SKUs
    // × 3 currencies × 2 platforms (~16.5k rows). Hitting it sets `truncated`.
    const REVENUE_SCAN_CAP = 20_000;
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

    const currencies = new Set<string>();
    const productIds = new Set<string>();
    const platforms = new Set<"IOS" | "Android">();
    for (const row of allRows) {
      if (row.currency) currencies.add(row.currency);
      productIds.add(row.productId);
      platforms.add(row.platform);
    }

    return {
      days: allRows.map((row) => ({
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
