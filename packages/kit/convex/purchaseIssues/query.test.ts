import { describe, expect, it } from "vitest";

import type { Id } from "../_generated/dataModel";
import { testableFunction } from "../test.setup";
import { MemoryDb, memoryCtx } from "./memoryDb.testing";
import {
  getPurchaseIssue as registeredGetPurchaseIssue,
  listPurchaseIssues as registeredListPurchaseIssues,
} from "./query";

const listPurchaseIssues = testableFunction(registeredListPurchaseIssues);
const getPurchaseIssue = testableFunction(registeredGetPurchaseIssue);
const PROJECT = "projects_1" as Id<"projects">;
const page = { numItems: 10, cursor: null };

function setup() {
  const db = new MemoryDb();
  db.seed("organizations", { _id: "organizations_1" });
  db.seed("projects", { _id: PROJECT, organizationId: "organizations_1" });
  db.seed("organizationMembers", {
    organizationId: "organizations_1",
    userId: "users_member",
    role: "member",
  });
  const issue = (fields: Record<string, string | number>) =>
    db.seed("purchaseIssues", {
      projectId: PROJECT,
      cause: "INAUTHENTIC",
      store: "apple",
      fingerprint: "f".repeat(64),
      count: 1,
      firstSeenAt: 0,
      lastSeenAt: 0,
      ...fields,
    });
  const ids = {
    old: issue({ lastSeenAt: 100, productId: "gold" }),
    conflict: issue({
      lastSeenAt: 200,
      cause: "OWNERSHIP_CONFLICT",
      appUserId: "user-7",
    }),
    google: issue({ lastSeenAt: 300, store: "google", productId: "gold" }),
  };
  return { db, ids };
}

describe("listPurchaseIssues", () => {
  it("lets any member page issues newest first and narrow them", async () => {
    const { db, ids } = setup();
    const ctx = memoryCtx(db, "users_member");
    const list = async (filters: Record<string, string | number> = {}) =>
      (
        await listPurchaseIssues._handler(ctx as never, {
          projectId: PROJECT,
          paginationOpts: page,
          ...filters,
        })
      ).page.map((row) => row._id);

    expect(await list()).toEqual([ids.google, ids.conflict, ids.old]);
    expect(await list({ cause: "OWNERSHIP_CONFLICT" })).toEqual([ids.conflict]);
    expect(await list({ store: "google" })).toEqual([ids.google]);
    expect(await list({ productId: "gold" })).toEqual([ids.google, ids.old]);
    expect(await list({ appUserId: "user-7" })).toEqual([ids.conflict]);
    expect(await list({ from: 150, to: 250 })).toEqual([ids.conflict]);
  });

  it("refuses a caller outside the organization", async () => {
    const { db } = setup();
    await expect(
      listPurchaseIssues._handler(memoryCtx(db, "users_other") as never, {
        projectId: PROJECT,
        paginationOpts: page,
      }),
    ).rejects.toMatchObject({ data: { code: "NOT_AUTHORIZED" } });
  });
});

describe("getPurchaseIssue", () => {
  it("returns an issue to a member and null to anyone else", async () => {
    const { db, ids } = setup();
    await expect(
      getPurchaseIssue._handler(memoryCtx(db, "users_member") as never, {
        issueId: ids.old as Id<"purchaseIssues">,
      }),
    ).resolves.toMatchObject({ _id: ids.old });
    await expect(
      getPurchaseIssue._handler(memoryCtx(db, "users_other") as never, {
        issueId: ids.old as Id<"purchaseIssues">,
      }),
    ).resolves.toBeNull();
  });
});
