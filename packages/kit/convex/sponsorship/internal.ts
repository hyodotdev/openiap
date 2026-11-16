import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { internalMutation, internalQuery } from "../_generated/server";
import { countsTowardMrr } from "../subscriptions/monthlyMicros";
import { statsAreCurrent, statsContributionFor } from "../subscriptions/stats";
import type { Id } from "../_generated/dataModel";
import { getLink } from "./links";
import { GRACE_PERIOD_MS, normalizeGitHubLogin } from "./logic";

const stageValidator = v.union(v.literal("advisory"), v.literal("request"));

/**
 * Maintainer-only, run by $link-sponsor: links a GitHub sponsorship to an
 * organization, replacing any earlier link, or removes it with
 * `sponsor: null`. The one production write the agent guardrail allows, and
 * only after Hyo confirms the pair.
 */
export const setSponsorshipLink = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    sponsor: v.union(
      v.null(),
      v.object({
        login: v.string(),
        githubId: v.number(),
        monthlyUsd: v.number(),
        isOneTime: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const organization = await ctx.db.get(args.organizationId);
    if (!organization || organization.pendingDeletion)
      throw new Error("Organization not found");
    const existing = await getLink(ctx, args.organizationId);
    if (existing) await ctx.db.delete(existing._id);
    if (!args.sponsor) return { organization: organization.name, linked: null };

    const { githubId, monthlyUsd, isOneTime } = args.sponsor;
    const login = normalizeGitHubLogin(args.sponsor.login);
    if (!login || !Number.isSafeInteger(githubId) || githubId <= 0)
      throw new Error("Pass the sponsor's GitHub login and numeric id");
    if (!Number.isFinite(monthlyUsd) || monthlyUsd <= 0)
      throw new Error("Pass the sponsorship amount in US dollars");
    await ctx.db.insert("sponsorshipLinks", {
      organizationId: args.organizationId,
      githubId,
      login,
      monthlyUsd,
      isOneTime,
      linkedAt: Date.now(),
    });
    return { organization: organization.name, linked: login };
  },
});

/**
 * What $link-sponsor shows the maintainer to pick an organization: those that
 * reached a sponsorship notice or already have a link, plus `slug` if given.
 * Names, slugs and figures only; never member emails.
 */
export const listLinkCandidates = internalQuery({
  args: { slug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const ids = new Set<Id<"organizations">>();
    for (const state of await ctx.db.query("sponsorshipStates").take(500))
      ids.add(state.organizationId);
    for (const link of await ctx.db.query("sponsorshipLinks").take(500))
      ids.add(link.organizationId);
    const { slug } = args;
    if (slug) {
      const bySlug = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (bySlug) ids.add(bySlug._id);
    }
    const candidates = [];
    for (const id of ids) {
      const organization = await ctx.db.get(id);
      if (!organization || organization.pendingDeletion) continue;
      const state = await ctx.db
        .query("sponsorshipStates")
        .withIndex("by_organization", (q) => q.eq("organizationId", id))
        .unique();
      const link = await getLink(ctx, id);
      candidates.push({
        organizationId: id,
        name: organization.name,
        slug: organization.slug,
        stage: state?.stage,
        lastUsdMrr: state?.lastUsdMrr,
        sponsoredAt: state?.sponsoredAt,
        link: link && { login: link.login, monthlyUsd: link.monthlyUsd },
      });
    }
    return candidates;
  },
});

/** One page of organizations with their sponsorship state. */
export const listOrganizations = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("organizations")
      .paginate(args.paginationOpts);
    const organizations = [];
    for (const organization of page.page) {
      if (organization.pendingDeletion) continue;
      const state = await ctx.db
        .query("sponsorshipStates")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organization._id),
        )
        .unique();
      const link = await getLink(ctx, organization._id);
      organizations.push({
        organizationId: organization._id,
        name: organization.name,
        state:
          state || link
            ? {
                stage: state?.stage,
                sponsoredAt: state?.sponsoredAt,
                linked: Boolean(link),
              }
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

export const listProjectIds = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();
    return projects.map((project) => project._id);
  },
});

const billingPeriodValidator = v.object({
  platform: v.union(v.literal("IOS"), v.literal("Android")),
  productId: v.string(),
  billingPeriod: v.string(),
});

/**
 * One page of a project's catalog billing periods. Read once per project and
 * passed to both sums, so MRR and uncataloged charges classify each product
 * the same way even if a catalog sync runs mid-scan.
 */
export const listBillingPeriods = internalQuery({
  args: {
    projectId: v.id("projects"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q.eq("projectId", args.projectId),
      )
      .paginate(args.paginationOpts);
    return {
      items: page.page.flatMap((product) =>
        product.billingPeriod
          ? [
              {
                platform: product.platform,
                productId: product.productId,
                billingPeriod: product.billingPeriod,
              },
            ]
          : [],
      ),
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

const productKey = (platform: string, productId: string) =>
  `${platform}:${productId}`;

function sumByCurrency(rows: Array<{ currency: string; micros: number }>) {
  const byCurrency = new Map<string, number>();
  for (const row of rows) {
    const currency = row.currency.toUpperCase();
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + row.micros);
  }
  return [...byCurrency].map(([currency, micros]) => ({ currency, micros }));
}

/**
 * A project's production MRR per currency from `subscriptionStats`, which
 * every subscription change updates in the same transaction, so one read is a
 * consistent total. Null when the rows are stale (an expiry passed, or a
 * catalog billing period changed) and MRR must be counted live.
 */
export const cachedProjectMrr = internalQuery({
  args: { projectId: v.id("projects"), now: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("subscriptionStats")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const status = await ctx.db
      .query("revenueMetricsRunStatus")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();
    if (rows.length === 0 || !statsAreCurrent(status, args.now)) return null;
    return sumByCurrency(
      rows
        .filter((row) => row.currency && row.mrrMicros > 0)
        .map((row) => ({ currency: row.currency, micros: row.mrrMicros })),
    );
  },
});

/**
 * One page of a project's production subscription MRR per currency, counted
 * from the subscriptions themselves with the rule `subscriptionStats` uses.
 * Pages read separate snapshots, so this is only the fallback for stale stats.
 */
export const sumProjectMrr = internalQuery({
  args: {
    projectId: v.id("projects"),
    now: v.number(),
    billingPeriods: v.array(billingPeriodValidator),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const periods = new Map(
      args.billingPeriods.map((product) => [
        productKey(product.platform, product.productId),
        product.billingPeriod,
      ]),
    );
    const page = await ctx.db
      .query("subscriptions")
      .withIndex("by_project_and_state", (q) =>
        q.eq("projectId", args.projectId).eq("state", "Active"),
      )
      .paginate(args.paginationOpts);
    const rows = [];
    for (const sub of page.page) {
      const contribution = statsContributionFor(
        sub,
        periods.get(productKey(sub.platform, sub.productId)),
        args.now,
      );
      if (contribution && contribution.mrrMicros > 0) {
        rows.push({
          currency: contribution.currency,
          micros: contribution.mrrMicros,
        });
      }
    }
    return {
      items: sumByCurrency(rows),
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

/**
 * One day of a project's production subscription charges for products MRR
 * cannot count (no known billing period), summed per currency, from the
 * analytics rollup (subscriptions/revenueMetrics.ts). The rollup replaces a
 * day's rows in one mutation, so a one-day read is never half refreshed. Rows
 * from before the environment split count as production, as on the dashboard.
 */
export const sumDayCharges = internalQuery({
  args: {
    projectId: v.id("projects"),
    day: v.string(),
    billingPeriods: v.array(billingPeriodValidator),
  },
  handler: async (ctx, args) => {
    const inMrr = new Set(
      args.billingPeriods
        .filter((product) => countsTowardMrr(product.billingPeriod))
        .map((product) => productKey(product.platform, product.productId)),
    );
    const rows = [];
    for (const environment of ["Production", undefined] as const) {
      rows.push(
        ...(await ctx.db
          .query("revenueMetricsDaily")
          .withIndex("by_project_and_environment_and_day", (q) =>
            q
              .eq("projectId", args.projectId)
              .eq("environment", environment)
              .eq("day", args.day),
          )
          .collect()),
      );
    }
    return sumByCurrency(
      rows
        .filter((row) => !inMrr.has(productKey(row.platform, row.productId)))
        .map((row) => ({ currency: row.currency, micros: row.revenueMicros })),
    );
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
