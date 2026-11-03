// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";

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

describe("sponsorship internal functions", () => {
  it("lists an organization's projects and its sponsorship state", async () => {
    const t = convexTest(schema, modules);
    const organizationId = await seedOrganization(t);
    const page = await t.query(
      internal.sponsorship.internal.listOrganizationRevenue,
      { paginationOpts: { numItems: 10, cursor: null } },
    );
    const projectIds = await t.run(async (ctx) =>
      (await ctx.db.query("projects").collect()).map((project) => project._id),
    );
    expect(page.organizations).toEqual([
      {
        organizationId,
        name: "Acme",
        projectIds,
        state: null,
      },
    ]);
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
    const page = await t.query(internal.sponsorship.internal.sumProjectMrr, {
      projectId,
      now: 1_000,
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(page.amounts).toEqual([{ currency: "USD", micros: 10_000_000 }]);
  });

  it("sums recent production charges of uncataloged products, legacy rows included", async () => {
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
        {
          day: "2026-09-01",
          currency: "USD",
          environment: "Production" as const,
          revenueMicros: 1_000_000,
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
    const sum = (legacy: boolean) =>
      t.query(internal.sponsorship.internal.sumRecentCharges, {
        projectId,
        fromDay: "2026-10-05",
        legacy,
        paginationOpts: { numItems: 100, cursor: null },
      });
    expect((await sum(false)).amounts).toEqual([
      { currency: "USD", micros: 7_000_000 },
    ]);
    expect((await sum(true)).amounts).toEqual([
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
