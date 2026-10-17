import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getAuthUserId: vi.fn() }));
vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: auth.getAuthUserId,
}));

import type { Id } from "../_generated/dataModel";
import { SPONSOR_CTA_THRESHOLD } from "../plans";
import { testableFunction } from "../test.setup";
import { removeMember as registeredRemoveMember } from "../organizations/mutation";
import { getUserStats as registeredGetUserStats } from "./query";

const getUserStats = testableFunction(registeredGetUserStats);
const removeMember = testableFunction(registeredRemoveMember);
const organizationId = "organizations_private" as Id<"organizations">;
const userId = "users_member" as Id<"users">;

function fixture() {
  const profile: {
    _id: string;
    userId: string;
    currentOrganizationId?: string;
  } = {
    _id: "userProfiles_member",
    userId,
    currentOrganizationId: organizationId,
  };
  const organization = {
    _id: organizationId,
    monthlyRequestCount: 54321,
    monthlyRequestLimit: SPONSOR_CTA_THRESHOLD + 9000,
    subscriptionTier: "enterprise",
    pendingDeletion: false,
  };
  const memberships = [
    {
      _id: "members_owner",
      organizationId,
      userId: "users_owner",
      role: "owner",
    },
    { _id: "members_member", organizationId, userId, role: "member" },
  ];
  const profiles = [profile];
  const projects = [{ _id: "projects_private", organizationId }];
  const tables: Record<string, Record<string, unknown>[]> = {
    userProfiles: profiles,
    organizationMembers: memberships,
    projects,
  };
  const db = {
    query: vi.fn((table: string) => ({
      withIndex: (
        _name: string,
        build: (q: { eq(field: string, value: unknown): unknown }) => unknown,
      ) => {
        const filters: Record<string, unknown> = {};
        const q = {
          eq(field: string, value: unknown) {
            filters[field] = value;
            return q;
          },
        };
        build(q);
        const rows = () =>
          tables[table].filter((row) =>
            Object.entries(filters).every(([key, value]) => row[key] === value),
          );
        return {
          unique: async () => rows()[0] ?? null,
          first: async () => rows()[0] ?? null,
          collect: async () => rows(),
        };
      },
    })),
    get: vi.fn(async () => organization),
    delete: vi.fn(async (id: string) => {
      const index = memberships.findIndex((row) => row._id === id);
      if (index >= 0) memberships.splice(index, 1);
    }),
  };
  return {
    ctx: { db },
    db,
    memberships,
    profiles,
    profile,
    organization,
    projects,
  };
}

const defaults = {
  projectCount: 0,
  recentValidationCount: 0,
  monthlyRequestCount: 0,
  monthlyRequestLimit: SPONSOR_CTA_THRESHOLD,
  subscriptionTier: "developer",
};

describe("getUserStats authorization", () => {
  beforeEach(() => {
    auth.getAuthUserId.mockReset().mockResolvedValue(userId);
  });

  it("stops former-organization reads immediately after the real removal mutation, including later updates", async () => {
    const f = fixture();
    expect(await getUserStats._handler(f.ctx, {})).toMatchObject({
      monthlyRequestCount: 54321,
      projectCount: 1,
    });
    auth.getAuthUserId.mockResolvedValue("users_owner");
    await removeMember._handler(f.ctx, { organizationId, userId });
    expect(f.profile.currentOrganizationId).toBe(organizationId);
    auth.getAuthUserId.mockResolvedValue(userId);
    f.db.get.mockClear();
    f.db.query.mockClear();
    for (const requestCount of [60000, 70000]) {
      f.organization.monthlyRequestCount = requestCount;
      expect(await getUserStats._handler(f.ctx, {})).toEqual({
        ...defaults,
        organizationCount: 0,
      });
    }
    expect(f.db.get).not.toHaveBeenCalled();
    expect(f.db.query.mock.calls.map(([table]) => table)).not.toContain(
      "projects",
    );
  });

  it("does not let membership in another organization authorize the saved pointer", async () => {
    const f = fixture();
    f.memberships[1].organizationId =
      "organizations_other" as Id<"organizations">;
    expect(await getUserStats._handler(f.ctx, {})).toEqual({
      ...defaults,
      organizationCount: 1,
    });
    expect(f.db.get).not.toHaveBeenCalled();
  });

  it.each(["owner", "admin", "member"])(
    "preserves stats for a current %s",
    async (role) => {
      const f = fixture();
      f.memberships[1].role = role;
      expect(await getUserStats._handler(f.ctx, {})).toEqual({
        organizationCount: 1,
        projectCount: 1,
        recentValidationCount: 0,
        monthlyRequestCount: 54321,
        monthlyRequestLimit: SPONSOR_CTA_THRESHOLD + 9000,
        subscriptionTier: "enterprise",
      });
    },
  );

  it("returns defaults for an organization pending deletion", async () => {
    const f = fixture();
    f.organization.pendingDeletion = true;
    expect(await getUserStats._handler(f.ctx, {})).toEqual({
      ...defaults,
      organizationCount: 1,
    });
    expect(f.db.query.mock.calls.map(([table]) => table)).not.toContain(
      "projects",
    );
  });

  it("preserves missing session, profile and active-organization behavior", async () => {
    const f = fixture();
    auth.getAuthUserId.mockResolvedValue(null);
    expect(await getUserStats._handler(f.ctx, {})).toBeNull();
    expect(f.db.query).not.toHaveBeenCalled();
    auth.getAuthUserId.mockResolvedValue(userId);
    f.profiles.length = 0;
    expect(await getUserStats._handler(f.ctx, {})).toBeNull();
    f.profiles.push(f.profile);
    delete f.profile.currentOrganizationId;
    expect(await getUserStats._handler(f.ctx, {})).toEqual({
      ...defaults,
      organizationCount: 1,
    });
    expect(f.db.get).not.toHaveBeenCalled();
  });
});
