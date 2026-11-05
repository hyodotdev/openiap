// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { STATS_DEFINITIONS_VERSION } from "./subscriptions/stats";

const modules = import.meta.glob("./**/*.ts");

async function seedOrganization(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const now = Date.now();
    const organizationId = await ctx.db.insert("organizations", {
      name: "Acme",
      slug: "acme",
      createdAt: now,
      updatedAt: now,
    });
    const owner = await ctx.db.insert("users", { email: "owner@acme.test" });
    const member = await ctx.db.insert("users", { email: "dev@acme.test" });
    await ctx.db.insert("organizationMembers", {
      organizationId,
      userId: owner,
      role: "owner",
      joinedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("organizationMembers", {
      organizationId,
      userId: member,
      role: "member",
      joinedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("projects", {
      organizationId,
      name: "App",
      slug: "app",
      apiKey: "legacy",
      createdAt: now,
      updatedAt: now,
    });
    return organizationId;
  });
}

async function catalog(
  t: ReturnType<typeof convexTest>,
  projectId: Id<"projects">,
) {
  const page = await t.query(internal.sponsorship.internal.listBillingPeriods, {
    projectId,
    paginationOpts: { numItems: 100, cursor: null },
  });
  return page.items;
}

describe("sponsorship internal functions", () => {
  it("lists an organization's projects and its sponsorship state", async () => {
    const t = convexTest(schema, modules);
    const organizationId = await seedOrganization(t);
    const page = await t.query(
      internal.sponsorship.internal.listOrganizations,
      { paginationOpts: { numItems: 10, cursor: null } },
    );
    expect(page.organizations).toEqual([
      { organizationId, name: "Acme", state: null },
    ]);
    const projectIds = await t.run(async (ctx) =>
      (await ctx.db.query("projects").collect()).map((project) => project._id),
    );
    expect(
      await t.query(internal.sponsorship.internal.listProjectIds, {
        organizationId,
      }),
    ).toEqual(projectIds);
  });

  it("counts MRR from active production subscriptions", async () => {
    const t = convexTest(schema, modules);
    await seedOrganization(t);
    const projectId = await t.run(async (ctx) => {
      const project = (await ctx.db.query("projects").first())!;
      await ctx.db.insert("products", {
        projectId: project._id,
        platform: "IOS",
        productId: "pro.yearly",
        type: "Subscription",
        title: "Pro yearly",
        state: "Active",
        billingPeriod: "P1Y",
        updatedAt: 0,
      });
      const sub = {
        projectId: project._id,
        productId: "pro.yearly",
        platform: "IOS" as const,
        state: "Active" as const,
        currency: "usd",
        priceAmountMicros: 120_000_000,
        startedAt: 0,
        updatedAt: 0,
      };
      await ctx.db.insert("subscriptions", {
        ...sub,
        purchaseToken: "live",
        environment: "Production",
        expiresAt: 2_000,
      });
      await ctx.db.insert("subscriptions", {
        ...sub,
        purchaseToken: "sandbox",
        environment: "Sandbox",
        expiresAt: 2_000,
      });
      await ctx.db.insert("subscriptions", {
        ...sub,
        purchaseToken: "lapsed",
        environment: "Production",
        expiresAt: 500,
      });
      return project._id;
    });
    const billingPeriods = await catalog(t, projectId);
    const page = await t.query(internal.sponsorship.internal.sumProjectMrr, {
      projectId,
      now: 1_000,
      billingPeriods,
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(page.items).toEqual([{ currency: "USD", micros: 10_000_000 }]);
  });

  it("reads MRR from current stats rows and refuses stale ones", async () => {
    const t = convexTest(schema, modules);
    await seedOrganization(t);
    const projectId = await t.run(async (ctx) => {
      const project = (await ctx.db.query("projects").first())!;
      await ctx.db.insert("subscriptionStats", {
        projectId: project._id,
        currency: "usd",
        activeSubs: 2,
        inGracePeriod: 0,
        inBillingRetry: 0,
        mrrMicros: 9_100_000_000,
        updatedAt: 0,
      });
      await ctx.db.insert("revenueMetricsRunStatus", {
        projectId: project._id,
        statsDefinitionsVersion: STATS_DEFINITIONS_VERSION,
        statsUpdatedAt: 0,
        statsValidUntil: 2_000,
      });
      return project._id;
    });
    const cached = (now: number) =>
      t.query(internal.sponsorship.internal.cachedProjectMrr, {
        projectId,
        now,
      });
    expect(await cached(1_000)).toEqual([
      { currency: "USD", micros: 9_100_000_000 },
    ]);
    expect(await cached(3_000)).toBeNull();
  });

  it("sums a day of production charges for uncataloged products, legacy rows included", async () => {
    const t = convexTest(schema, modules);
    await seedOrganization(t);
    const projectId = await t.run(async (ctx) => {
      const project = await ctx.db.query("projects").first();
      const rollup = {
        projectId: project!._id,
        productId: "pro.monthly",
        platform: "IOS" as const,
        activeSubs: 1,
        newSubs: 0,
        renewals: 1,
        cancellations: 0,
        refunds: 0,
        updatedAt: 0,
      };
      const rows = [
        {
          day: "2026-10-20",
          currency: "USD",
          environment: "Production" as const,
          revenueMicros: 5_000_000,
        },
        {
          day: "2026-10-21",
          currency: "usd",
          environment: "Production" as const,
          revenueMicros: 2_000_000,
        },
        {
          day: "2026-10-22",
          currency: "KRW",
          environment: undefined,
          revenueMicros: 9_000_000_000,
        },
        {
          day: "2026-10-22",
          currency: "USD",
          environment: "Sandbox" as const,
          revenueMicros: 7_000_000,
        },
      ];
      for (const row of rows) {
        await ctx.db.insert("revenueMetricsDaily", { ...rollup, ...row });
      }
      // MRR already counts a product with a known billing period.
      await ctx.db.insert("revenueMetricsDaily", {
        ...rollup,
        productId: "pro.yearly",
        day: "2026-10-20",
        currency: "USD",
        environment: "Production",
        revenueMicros: 60_000_000,
      });
      await ctx.db.insert("products", {
        projectId: project!._id,
        platform: "IOS",
        productId: "pro.yearly",
        type: "Subscription",
        title: "Pro yearly",
        state: "Active",
        billingPeriod: "P1Y",
        updatedAt: 0,
      });
      return project!._id;
    });
    const billingPeriods = await catalog(t, projectId);
    const sum = (day: string) =>
      t.query(internal.sponsorship.internal.sumDayCharges, {
        projectId,
        day,
        billingPeriods,
      });
    expect(await sum("2026-10-20")).toEqual([
      { currency: "USD", micros: 5_000_000 },
    ]);
    expect(await sum("2026-10-21")).toEqual([
      { currency: "USD", micros: 2_000_000 },
    ]);
    expect(await sum("2026-10-22")).toEqual([
      { currency: "KRW", micros: 9_000_000_000 },
    ]);
  });

  it("emails owners and admins only", async () => {
    const t = convexTest(schema, modules);
    const organizationId = await seedOrganization(t);
    const recipients = await t.query(
      internal.sponsorship.internal.listRecipients,
      { organizationId },
    );
    expect(recipients).toEqual(["owner@acme.test"]);
  });

  it("records a request with a 30-day deadline and stops after a sponsorship", async () => {
    const t = convexTest(schema, modules);
    const organizationId = await seedOrganization(t);
    await t.mutation(internal.sponsorship.internal.recordNotice, {
      organizationId,
      stage: "request",
      usdMrr: 9_100,
      sentAt: 1_000,
    });
    let state = await t.run((ctx) =>
      ctx.db.query("sponsorshipStates").unique(),
    );
    expect(state?.stage).toBe("request");
    expect(state?.requestDeadlineAt).toBe(1_000 + 30 * 24 * 60 * 60 * 1000);

    await t.mutation(internal.sponsorship.internal.markSponsored, {
      organizationId,
    });
    state = await t.run((ctx) => ctx.db.query("sponsorshipStates").unique());
    expect(state?.sponsoredAt).toBeTypeOf("number");
  });
});
