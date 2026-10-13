import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ getAuthUserId: vi.fn() }));
vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: authMocks.getAuthUserId,
}));

import type { Id } from "../_generated/dataModel";
import { testableFunction } from "../test.setup";
import { removeMember as registeredRemoveMember } from "./mutation";

const removeMember = testableFunction(registeredRemoveMember);
const ORG_ID = "organizations_a" as Id<"organizations">;

describe("removeMember", () => {
  type Member = { _id: string; userId: string; role: string };

  function makeCtx(members: Member[]) {
    const rows = [...members];
    const matching = (userId?: string) =>
      rows.filter((row) => userId === undefined || row.userId === userId);
    const db = {
      query: () => ({
        withIndex: (
          _name: string,
          build: (q: { eq: (field: string, value: string) => unknown }) => void,
        ) => {
          let userId: string | undefined;
          const q = {
            eq: (field: string, value: string) => {
              if (field === "userId") userId = value;
              return q;
            },
          };
          build(q);
          return {
            first: async () => matching(userId)[0] ?? null,
            filter: () => ({
              collect: async () =>
                matching().filter((row) => row.role === "owner"),
            }),
          };
        },
      }),
      delete: vi.fn(async (id: string) => {
        rows.splice(
          rows.findIndex((row) => row._id === id),
          1,
        );
      }),
    };
    return { ctx: { db }, db, rows };
  }

  const owners: Member[] = [
    { _id: "m_owner_1", userId: "users_owner_1", role: "owner" },
    { _id: "m_owner_2", userId: "users_owner_2", role: "owner" },
    { _id: "m_admin", userId: "users_admin", role: "admin" },
  ];

  beforeEach(() => authMocks.getAuthUserId.mockReset());

  it("does not let an admin remove an owner", async () => {
    authMocks.getAuthUserId.mockResolvedValue("users_admin");
    const { ctx, db } = makeCtx(owners);

    await expect(
      removeMember._handler(ctx, {
        organizationId: ORG_ID,
        userId: "users_owner_1" as Id<"users">,
      }),
    ).rejects.toThrow();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("lets an owner remove another owner", async () => {
    authMocks.getAuthUserId.mockResolvedValue("users_owner_2");
    const { ctx, rows } = makeCtx(owners);

    await removeMember._handler(ctx, {
      organizationId: ORG_ID,
      userId: "users_owner_1" as Id<"users">,
    });
    expect(rows.map((row) => row._id)).toEqual(["m_owner_2", "m_admin"]);
  });
});
