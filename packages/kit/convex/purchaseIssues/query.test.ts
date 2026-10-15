import { describe, expect, it } from "vitest";

import type { Id } from "../_generated/dataModel";
import { testableFunction } from "../test.setup";
import { MemoryDb, memoryCtx } from "../test.memoryDb";
import {
  getPurchaseIssue as registeredGetPurchaseIssue,
  listPurchaseIssues as registeredListPurchaseIssues,
} from "./query";

const listPurchaseIssues = testableFunction(registeredListPurchaseIssues);
const getPurchaseIssue = testableFunction(registeredGetPurchaseIssue);
const PROJECT = "projects_1" as Id<"projects">;
const OTHER_PROJECT = "projects_2" as Id<"projects">;
const page = { numItems: 10, cursor: null };

function setup() {
  const db = new MemoryDb();
  db.seed("organizations", { _id: "organizations_1" });
  db.seed("projects", { _id: PROJECT, organizationId: "organizations_1" });
  db.seed("projects", {
    _id: OTHER_PROJECT,
    organizationId: "organizations_1",
  });
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
      shard: 15,
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
    claimed: issue({ lastSeenAt: 400, claimedProductId: "gold" }),
    elsewhere: issue({ projectId: OTHER_PROJECT, lastSeenAt: 500 }),
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

    expect(await list()).toEqual([
      ids.claimed,
      ids.google,
      ids.conflict,
      ids.old,
    ]);
    expect(await list({ cause: "OWNERSHIP_CONFLICT" })).toEqual([ids.conflict]);
    expect(await list({ store: "google" })).toEqual([ids.google]);
    expect(await list({ productId: "gold" })).toEqual([
      ids.claimed,
      ids.google,
      ids.old,
    ]);
    expect(await list({ appUserId: "user-7" })).toEqual([ids.conflict]);
    expect(await list({ from: 150, to: 250 })).toEqual([ids.conflict]);
  });

  it("returns rows without the project or shard", async () => {
    const { db, ids } = setup();
    const { page: rows } = await listPurchaseIssues._handler(
      memoryCtx(db, "users_member"),
      { projectId: PROJECT, paginationOpts: page, cause: "OWNERSHIP_CONFLICT" },
    );
    expect(rows).toEqual([
      {
        _id: ids.conflict,
        cause: "OWNERSHIP_CONFLICT",
        store: "apple",
        fingerprint: "f".repeat(64),
        appUserId: "user-7",
        count: 1,
        firstSeenAt: 0,
        lastSeenAt: 200,
      },
    ]);
  });

  it("refuses a caller outside the organization and oversized pages", async () => {
    const { db } = setup();
    await expect(
      listPurchaseIssues._handler(memoryCtx(db, "users_other") as never, {
        projectId: PROJECT,
        paginationOpts: page,
      }),
    ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
    await expect(
      listPurchaseIssues._handler(memoryCtx(db, "users_member") as never, {
        projectId: PROJECT,
        paginationOpts: { numItems: 101, cursor: null },
      }),
    ).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
  });
});

describe("getPurchaseIssue", () => {
  it("returns a project's issue to a member and null to anyone else", async () => {
    const { db, ids } = setup();
    const get = (userId: string, projectId: Id<"projects">, issueId: string) =>
      getPurchaseIssue._handler(memoryCtx(db, userId), { projectId, issueId });
    await expect(get("users_member", PROJECT, ids.old)).resolves.toMatchObject({
      _id: ids.old,
      productId: "gold",
    });
    await expect(get("users_other", PROJECT, ids.old)).resolves.toBeNull();
    await expect(
      get("users_member", PROJECT, ids.elsewhere),
    ).resolves.toBeNull();
  });

  it("answers null for a malformed id from the page URL", async () => {
    const { db } = setup();
    await expect(
      getPurchaseIssue._handler(memoryCtx(db, "users_member"), {
        projectId: PROJECT,
        issueId: "not-an-id",
      }),
    ).resolves.toBeNull();
  });
});
