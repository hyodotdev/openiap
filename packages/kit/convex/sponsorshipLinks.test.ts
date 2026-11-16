// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const aws = {
  login: "@AWS",
  githubId: 2232217,
  monthlyUsd: 1000,
  isOneTime: false,
};

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const organizationId = await ctx.db.insert("organizations", {
      name: "Acme",
      slug: "acme",
      createdAt: now,
      updatedAt: now,
    });
    const quiet = await ctx.db.insert("organizations", {
      name: "Quiet",
      slug: "quiet",
      createdAt: now,
      updatedAt: now,
    });
    const owner = await ctx.db.insert("users", { email: "owner@acme.test" });
    const member = await ctx.db.insert("users", { email: "dev@acme.test" });
    const outsider = await ctx.db.insert("users", { email: "x@other.test" });
    for (const [userId, role] of [
      [owner, "owner"],
      [member, "member"],
    ] as const) {
      await ctx.db.insert("organizationMembers", {
        organizationId,
        userId,
        role,
        joinedAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.insert("sponsorshipStates", {
      organizationId,
      stage: "request",
      lastUsdMrr: 9_200,
      updatedAt: now,
    });
    return { organizationId, quiet, owner, member, outsider };
  });
  const link = (sponsor: typeof aws | null) =>
    t.mutation(internal.sponsorship.internal.setSponsorshipLink, {
      organizationId: ids.organizationId,
      sponsor,
    });
  const seen = (userId: Id<"users">) =>
    t
      .withIdentity({
        subject: `${userId}|s`,
        issuer: "https://test.convex.site",
      })
      .query(api.sponsorship.query.getSponsorshipLink, {
        organizationId: ids.organizationId,
      });
  const quietState = async () =>
    (
      await t.query(internal.sponsorship.internal.listOrganizations, {
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).organizations.find((o) => o.organizationId === ids.organizationId)?.state;
  return { t, ...ids, link, seen, quietState };
}

describe("GitHub sponsorship links", () => {
  it("links a sponsorship that every member sees and stops the emails", async () => {
    const { link, seen, owner, member, outsider, quietState } = await setup();

    expect(await link(aws)).toEqual({ organization: "Acme", linked: "aws" });
    const expected = { login: "aws", monthlyUsd: 1000, isOneTime: false };
    expect(await seen(owner)).toEqual(expected);
    expect(await seen(member)).toEqual(expected);
    expect(await seen(outsider)).toBeNull();
    expect((await quietState())?.linked).toBe(true);
  });

  it("replaces an earlier link instead of adding a second", async () => {
    const { t, link, seen, owner } = await setup();
    await link(aws);
    await link({ ...aws, monthlyUsd: 2000 });
    expect((await seen(owner))?.monthlyUsd).toBe(2000);
    expect(
      await t.run((ctx) => ctx.db.query("sponsorshipLinks").collect()),
    ).toHaveLength(1);
  });

  it("removes a link, which puts the organization back on the schedule", async () => {
    const { link, seen, owner, quietState } = await setup();
    await link(aws);
    expect(await link(null)).toEqual({ organization: "Acme", linked: null });
    expect(await seen(owner)).toBeNull();
    expect((await quietState())?.linked).toBe(false);
  });

  it("refuses a bad login, id, or amount, and a missing organization", async () => {
    const { t, link } = await setup();
    await expect(link({ ...aws, login: "not a login" })).rejects.toThrow(
      "GitHub login",
    );
    await expect(link({ ...aws, githubId: 0 })).rejects.toThrow("GitHub login");
    await expect(link({ ...aws, monthlyUsd: 0 })).rejects.toThrow("amount");
    const gone = await t.run(async (ctx) => {
      const id = await ctx.db.insert("organizations", {
        name: "Gone",
        slug: "gone",
        createdAt: 0,
        updatedAt: 0,
      });
      await ctx.db.delete(id);
      return id;
    });
    await expect(
      t.mutation(internal.sponsorship.internal.setSponsorshipLink, {
        organizationId: gone,
        sponsor: aws,
      }),
    ).rejects.toThrow("Organization not found");
    const deleting = await t.run((ctx) =>
      ctx.db.insert("organizations", {
        name: "Deleting",
        slug: "deleting",
        pendingDeletion: true,
        createdAt: 0,
        updatedAt: 0,
      }),
    );
    await expect(
      t.mutation(internal.sponsorship.internal.setSponsorshipLink, {
        organizationId: deleting,
        sponsor: aws,
      }),
    ).rejects.toThrow("Organization not found");
  });

  it("lists link candidates without member emails", async () => {
    const { t, link, quiet } = await setup();
    await link(aws);
    const candidates = await t.query(
      internal.sponsorship.internal.listLinkCandidates,
      { slug: "quiet" },
    );
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Acme",
          slug: "acme",
          stage: "request",
          lastUsdMrr: 9_200,
          link: { login: "aws", monthlyUsd: 1000 },
        }),
        expect.objectContaining({ organizationId: quiet, slug: "quiet" }),
      ]),
    );
    expect(JSON.stringify(candidates)).not.toContain("@");
  });
});
