import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { internalMutation, internalQuery } from "../_generated/server";
import { countsTowardMrr } from "../subscriptions/monthlyMicros";
import { loadStatsPeriods, statsContributionFor } from "../subscriptions/stats";
import { GRACE_PERIOD_MS } from "./logic";

const stageValidator = v.union(v.literal("advisory"), v.literal("request"));

/** One page of organizations with their project ids and sponsorship state. */
export const listOrganizationRevenue = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("organizations")
      .paginate(args.paginationOpts);
    const organizations = [];
    for (const organization of page.page) {
      if (organization.pendingDeletion) continue;
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organization._id),
        )
        .collect();
      if (projects.length === 0) continue;
      const state = await ctx.db
        .query("sponsorshipStates")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organization._id),
        )
        .unique();
      organizations.push({
        organizationId: organization._id,
        name: organization.name,
        projectIds: projects.map((project) => project._id),
        state: state
          ? { stage: state.stage, sponsoredAt: state.sponsoredAt }
          : null,
      });
    }
    return {
      organizations,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

/**
 * One page of a project's production subscription MRR per currency, counted
 * from the subscriptions themselves with the rule `subscriptionStats` uses, so
 * a stale stats row cannot hide revenue.
 */
export const sumProjectMrr = internalQuery({
  args: {
    projectId: v.id("projects"),
    now: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("subscriptions")
      .withIndex("by_project_and_state", (q) =>
        q.eq("projectId", args.projectId).eq("state", "Active"),
      )
      .paginate(args.paginationOpts);
    const periods = await loadStatsPeriods(ctx, args.projectId, page.page);
    if (!periods) throw new Error("Product catalog page too large");
    const byCurrency = new Map<string, number>();
    for (const sub of page.page) {
      const contribution = statsContributionFor(
        sub,
        periods.get(`${sub.platform}:${sub.productId}`),
        args.now,
      );
      if (!contribution || contribution.mrrMicros <= 0) continue;
      const currency = contribution.currency.toUpperCase();
      byCurrency.set(
        currency,
        (byCurrency.get(currency) ?? 0) + contribution.mrrMicros,
      );
    }
    return {
      amounts: [...byCurrency].map(([currency, micros]) => ({
        currency,
        micros,
      })),
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

/**
 * One page of a project's production subscription charges since `fromDay` for
 * products MRR cannot count (no known billing period), summed per currency,
 * from the analytics rollup (subscriptions/revenueMetrics.ts). `legacy` reads
 * rows from before the environment split, which count as production as on the
 * dashboard.
 */
export const sumRecentCharges = internalQuery({
  args: {
    projectId: v.id("projects"),
    fromDay: v.string(),
    legacy: v.boolean(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("revenueMetricsDaily")
      .withIndex("by_project_and_environment_and_day", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("environment", args.legacy ? undefined : "Production")
          .gte("day", args.fromDay),
      )
      .paginate(args.paginationOpts);
    const inMrr = new Map<string, boolean>();
    const byCurrency = new Map<string, number>();
    for (const row of page.page) {
      const key = `${row.platform}:${row.productId}`;
      if (!inMrr.has(key)) {
        const product = await ctx.db
          .query("products")
          .withIndex("by_project_and_platform_and_product", (q) =>
            q
              .eq("projectId", args.projectId)
              .eq("platform", row.platform)
              .eq("productId", row.productId),
          )
          .unique();
        inMrr.set(key, countsTowardMrr(product?.billingPeriod));
      }
      if (inMrr.get(key)) continue;
      const currency = row.currency.toUpperCase();
      byCurrency.set(
        currency,
        (byCurrency.get(currency) ?? 0) + row.revenueMicros,
      );
    }
    return {
      amounts: [...byCurrency].map(([currency, micros]) => ({
        currency,
        micros,
      })),
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

/** Owner and admin email addresses; never logged by callers. */
export const listRecipients = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();
    const emails = new Set<string>();
    for (const member of members) {
      if (member.role === "member") continue;
      const user = await ctx.db.get(member.userId);
      if (user?.email) emails.add(user.email);
    }
    return [...emails];
  },
});

/** Records an email that was sent, so the same stage is never sent twice. */
export const recordNotice = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    stage: stageValidator,
    usdMrr: v.number(),
    sentAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sponsorshipStates")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .unique();
    const fields = {
      stage: args.stage,
      lastNotifiedAt: args.sentAt,
      lastUsdMrr: args.usdMrr,
      updatedAt: args.sentAt,
      ...(args.stage === "request"
        ? { requestDeadlineAt: args.sentAt + GRACE_PERIOD_MS }
        : {}),
    };
    if (existing) await ctx.db.patch(existing._id, fields);
    else
      await ctx.db.insert("sponsorshipStates", {
        organizationId: args.organizationId,
        ...fields,
      });
  },
});

/**
 * Operator-only: marks an organization as a sponsor, or as having declined or
 * moved to self-hosting, so it gets no more emails. Run by the maintainer.
 */
export const markSponsored = internalMutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("sponsorshipStates")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .unique();
    if (existing)
      await ctx.db.patch(existing._id, { sponsoredAt: now, updatedAt: now });
    else
      await ctx.db.insert("sponsorshipStates", {
        organizationId: args.organizationId,
        sponsoredAt: now,
        updatedAt: now,
      });
  },
});
