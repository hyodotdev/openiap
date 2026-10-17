import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ getAuthUserId: vi.fn() }));
vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: auth.getAuthUserId,
}));
import type { Id } from "../_generated/dataModel";
import { testableFunction } from "../test.setup";
import * as mutations from "./mutation";
import { getMyInvitations, getPendingInvitations } from "./query";
import { pruneExpiredInvitations } from "./internal";
const invite = testableFunction(mutations.inviteMember);
const respond = testableFunction(mutations.respondToInvitation);
const remove = testableFunction(mutations.removeMember);
const list = testableFunction(getMyInvitations);
const prune = testableFunction(pruneExpiredInvitations);
const cancel = testableFunction(mutations.cancelInvitation);
const pendingList = testableFunction(getPendingInvitations);
const org = "organizations_a" as Id<"organizations">;
const invitee = "users_invitee" as Id<"users">;
const owner = "users_owner" as Id<"users">;
type Row = Record<string, unknown> & { _id: string };
class Filter {
  predicates: ((r: Row) => boolean)[] = [];
  eq(field: string, value: unknown): this {
    this.predicates.push((r) => r[field] === value);
    return this;
  }
  gt(field: string, value: number): this {
    this.predicates.push(
      (r) => typeof r[field] === "number" && r[field] > value,
    );
    return this;
  }
  lte(field: string, value: number): this {
    this.predicates.push(
      (r) => typeof r[field] === "number" && r[field] <= value,
    );
    return this;
  }
}
function fixture() {
  const tables = new Map<string, Row[]>();
  let sequence = 0;
  const rows = (table: string): Row[] => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table)!;
  };
  const db = {
    async insert(table: string, value: Record<string, unknown>) {
      const id = `${table}_${++sequence}`;
      rows(table).push({ ...value, _id: id });
      return id;
    },
    async get(id: string) {
      return [...tables.values()].flat().find((r) => r._id === id) ?? null;
    },
    async patch(id: string, value: Record<string, unknown>) {
      const row = await db.get(id);
      if (!row) throw new Error("missing fixture row");
      for (const [key, v] of Object.entries(value)) {
        if (v === undefined) delete row[key];
        else row[key] = v;
      }
    },
    async delete(id: string) {
      for (const table of tables.values()) {
        const index = table.findIndex((r) => r._id === id);
        if (index >= 0) table.splice(index, 1);
      }
    },
    query(table: string) {
      return {
        withIndex(_index: string, build: (q: Filter) => unknown) {
          const f = new Filter();
          build(f);
          const matching = () =>
            rows(table).filter((r) => f.predicates.every((p) => p(r)));
          return {
            first: async () => matching()[0] ?? null,
            take: async (n: number) => matching().slice(0, n),
            paginate: async ({
              cursor,
              numItems,
            }: {
              cursor: string | null;
              numItems: number;
            }) => {
              const start = Number(cursor ?? 0);
              const page = matching().slice(start, start + numItems);
              return {
                page,
                isDone: start + page.length >= matching().length,
                continueCursor: String(start + page.length),
              };
            },
            filter: () => ({
              collect: async () => matching().filter((r) => r.role === "owner"),
            }),
          };
        },
      };
    },
  };
  rows("organizations").push({
    _id: org,
    name: "Inviting org",
    slug: "inviting",
  });
  rows("users").push(
    { _id: owner, email: "owner@example.test" },
    { _id: invitee, email: "invitee@example.test" },
  );
  rows("organizationMembers").push({
    _id: "membership_owner",
    organizationId: org,
    userId: owner,
    role: "owner",
  });
  return {
    db,
    ctx: { db },
    rows,
    invitationId: () =>
      rows("organizationInvitations")[0]._id as Id<"organizationInvitations">,
  };
}
describe("organization invitation consent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T00:00:00Z"));
    auth.getAuthUserId.mockReset().mockResolvedValue(owner);
  });
  afterEach(() => vi.useRealTimers());
  const send = (
    f: ReturnType<typeof fixture>,
    role: "admin" | "member" = "member",
  ) =>
    invite._handler(f.ctx, {
      organizationId: org,
      email: "invitee@example.test",
      role,
    });
  it("creates a pending invitation without forcing membership", async () => {
    const f = fixture();
    await send(f);
    expect(f.rows("organizationMembers")).toHaveLength(1);
    expect(f.rows("organizationInvitations")).toMatchObject([
      { userId: invitee, invitedBy: owner, role: "member" },
    ]);
  });
  it("lets current managers list and withdraw offers, preventing later acceptance", async () => {
    const f = fixture();
    await send(f);
    const invitationId = f.invitationId();
    expect(
      (
        await pendingList._handler(f.ctx, {
          organizationId: org,
          paginationOpts: { cursor: null, numItems: 10 },
        })
      ).page,
    ).toMatchObject([{ email: "invitee@example.test", role: "member" }]);
    await cancel._handler(f.ctx, { invitationId });
    auth.getAuthUserId.mockResolvedValue(invitee);
    await expect(
      respond._handler(f.ctx, { invitationId, accept: true }),
    ).rejects.toThrow();
    expect(f.rows("organizationMembers")).toHaveLength(1);
  });
  it.each([null, invitee, "users_outsider"])(
    "denies pending invitation listing and withdrawal by %s",
    async (actor) => {
      const f = fixture();
      await send(f);
      auth.getAuthUserId.mockResolvedValue(actor);
      await expect(
        pendingList._handler(f.ctx, {
          organizationId: org,
          paginationOpts: { cursor: null, numItems: 10 },
        }),
      ).rejects.toThrow();
      await expect(
        cancel._handler(f.ctx, { invitationId: f.invitationId() }),
      ).rejects.toThrow();
      expect(f.rows("organizationInvitations")).toHaveLength(1);
    },
  );
  it.each([null, invitee, "users_outsider"])(
    "rejects non-manager invitation by %s",
    async (actor) => {
      const f = fixture();
      auth.getAuthUserId.mockResolvedValue(actor);
      await expect(send(f)).rejects.toThrow();
      expect(f.rows("organizationInvitations")).toEqual([]);
    },
  );
  it("does not authorize an invite through another organization", async () => {
    const f = fixture();
    f.rows("organizationMembers")[0].organizationId = "organizations_other";
    await expect(send(f)).rejects.toThrow();
  });
  it("only accepts through the addressed account session and refuses reuse", async () => {
    const f = fixture();
    await send(f, "admin");
    const invitationId = f.invitationId();
    await expect(
      respond._handler(f.ctx, { invitationId, accept: true }),
    ).rejects.toThrow();
    auth.getAuthUserId.mockResolvedValue(null);
    await expect(
      respond._handler(f.ctx, { invitationId, accept: true }),
    ).rejects.toThrow();
    auth.getAuthUserId.mockResolvedValue(invitee);
    await expect(
      respond._handler(f.ctx, { invitationId, accept: true }),
    ).resolves.toEqual({ organizationId: org, slug: "inviting" });
    expect(
      f.rows("organizationMembers").find((r) => r.userId === invitee)?.role,
    ).toBe("admin");
    await expect(
      respond._handler(f.ctx, { invitationId, accept: true }),
    ).rejects.toThrow();
    expect(f.rows("organizationMembers")).toHaveLength(2);
  });
  it("declines without adding membership", async () => {
    const f = fixture();
    await send(f);
    const invitationId = f.invitationId();
    auth.getAuthUserId.mockResolvedValue(invitee);
    await respond._handler(f.ctx, { invitationId, accept: false });
    expect(f.rows("organizationMembers")).toHaveLength(1);
    await expect(
      respond._handler(f.ctx, { invitationId, accept: true }),
    ).rejects.toThrow();
  });
  it.each(["role change", "expired"])(
    "replaces a %s invitation so stale consent cannot accept a different offer",
    async (reason) => {
      const f = fixture();
      await send(f);
      const oldId = f.invitationId();
      if (reason === "expired") vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000);
      await send(f, "admin");
      expect(f.rows("organizationInvitations")).toHaveLength(1);
      expect(f.invitationId()).not.toBe(oldId);
      auth.getAuthUserId.mockResolvedValue(invitee);
      await expect(
        respond._handler(f.ctx, { invitationId: oldId, accept: true }),
      ).rejects.toThrow();
      expect(f.rows("organizationMembers")).toHaveLength(1);
      await respond._handler(f.ctx, {
        invitationId: f.invitationId(),
        accept: true,
      });
      expect(
        f.rows("organizationMembers").find((r) => r.userId === invitee)?.role,
      ).toBe("admin");
    },
  );
  it("allows an admin to invite but never lets another account decline the offer", async () => {
    const f = fixture();
    f.rows("organizationMembers")[0].role = "admin";
    await send(f);
    await expect(
      respond._handler(f.ctx, {
        invitationId: f.invitationId(),
        accept: false,
      }),
    ).rejects.toThrow();
    expect(f.rows("organizationInvitations")).toHaveLength(1);
  });
  it("preserves pagination after filtering a page of deleting organizations", async () => {
    const f = fixture();
    await send(f);
    const original = f.rows("organizationInvitations")[0];
    f.rows("organizationInvitations").splice(0);
    for (let i = 0; i < 11; i++) {
      const organizationId = `organizations_page_${i}`;
      f.rows("organizations").push({
        _id: organizationId,
        name: `Org ${i}`,
        slug: `org-${i}`,
        pendingDeletion: i < 10,
      });
      f.rows("organizationInvitations").push({
        ...original,
        _id: `invitation_${i}`,
        organizationId,
      });
    }
    auth.getAuthUserId.mockResolvedValue(invitee);
    const first = await list._handler(f.ctx, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(first.page).toEqual([]);
    expect(first.isDone).toBe(false);
    const next = await list._handler(f.ctx, {
      paginationOpts: { cursor: first.continueCursor, numItems: 10 },
    });
    expect(next.page).toMatchObject([{ organizationName: "Org 10" }]);
    expect(next.isDone).toBe(true);
  });
  it("refuses an invitation at its exact expiry", async () => {
    const f = fixture();
    await send(f);
    vi.setSystemTime(Number(f.rows("organizationInvitations")[0].expiresAt));
    auth.getAuthUserId.mockResolvedValue(invitee);
    await expect(
      respond._handler(f.ctx, { invitationId: f.invitationId(), accept: true }),
    ).rejects.toThrow("expired");
    expect(f.rows("organizationMembers")).toHaveLength(1);
  });
  it.each(["removed", "demoted", "deleted", "deleting"])(
    "refuses acceptance after inviter/org is %s",
    async (change) => {
      const f = fixture();
      await send(f);
      if (change === "removed") f.rows("organizationMembers").splice(0);
      if (change === "demoted")
        f.rows("organizationMembers")[0].role = "member";
      if (change === "deleted") f.rows("organizations").splice(0);
      if (change === "deleting")
        f.rows("organizations")[0].pendingDeletion = true;
      auth.getAuthUserId.mockResolvedValue(invitee);
      await expect(
        respond._handler(f.ctx, {
          invitationId: f.invitationId(),
          accept: true,
        }),
      ).rejects.toThrow();
      expect(
        f.rows("organizationMembers").some((r) => r.userId === invitee),
      ).toBe(false);
    },
  );
  it("does not downgrade an existing membership through stale consent", async () => {
    const f = fixture();
    await send(f);
    f.rows("organizationMembers").push({
      _id: "already",
      organizationId: org,
      userId: invitee,
      role: "owner",
    });
    auth.getAuthUserId.mockResolvedValue(invitee);
    await respond._handler(f.ctx, {
      invitationId: f.invitationId(),
      accept: true,
    });
    expect(
      f.rows("organizationMembers").filter((r) => r.userId === invitee),
    ).toMatchObject([{ role: "owner" }]);
  });
  it("lists only the current account's live invitations and prunes expiry", async () => {
    const f = fixture();
    await send(f);
    f.rows("organizationInvitations").push({
      ...f.rows("organizationInvitations")[0],
      _id: "other",
      userId: owner,
    });
    auth.getAuthUserId.mockResolvedValue(invitee);
    const result = await list._handler(f.ctx, {
      paginationOpts: { cursor: null, numItems: 1 },
    });
    expect(result.page).toHaveLength(1);
    expect(result.page[0]).toMatchObject({
      organizationName: "Inviting org",
      role: "member",
    });
    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000);
    expect(
      (
        await list._handler(f.ctx, {
          paginationOpts: { cursor: null, numItems: 1 },
        })
      ).page,
    ).toEqual([]);
    await prune._handler(f.ctx, {});
    expect(f.rows("organizationInvitations")).toEqual([]);
  });
  it("lets a member leave and clears its current organization", async () => {
    const f = fixture();
    f.rows("organizationMembers").push({
      _id: "member",
      organizationId: org,
      userId: invitee,
      role: "member",
    });
    f.rows("userProfiles").push({
      _id: "profile",
      userId: invitee,
      currentOrganizationId: org,
    });
    auth.getAuthUserId.mockResolvedValue(invitee);
    await remove._handler(f.ctx, { organizationId: org, userId: invitee });
    expect(
      f.rows("organizationMembers").some((r) => r.userId === invitee),
    ).toBe(false);
    expect(f.rows("userProfiles")[0].currentOrganizationId).toBeUndefined();
  });
  it("prevents a member removing somebody else", async () => {
    const f = fixture();
    f.rows("organizationMembers").push({
      _id: "member",
      organizationId: org,
      userId: invitee,
      role: "member",
    });
    auth.getAuthUserId.mockResolvedValue(invitee);
    await expect(
      remove._handler(f.ctx, { organizationId: org, userId: owner }),
    ).rejects.toThrow();
    expect(f.rows("organizationMembers")).toHaveLength(2);
  });
  it("preserves the last owner but allows another owner to leave", async () => {
    const f = fixture();
    await expect(
      remove._handler(f.ctx, { organizationId: org, userId: owner }),
    ).rejects.toThrow();
    f.rows("organizationMembers").push({
      _id: "second-owner",
      organizationId: org,
      userId: invitee,
      role: "owner",
    });
    await remove._handler(f.ctx, { organizationId: org, userId: owner });
    expect(f.rows("organizationMembers")).toMatchObject([
      { userId: invitee, role: "owner" },
    ]);
  });
});
