import { afterEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../_generated/dataModel";
import { testableFunction } from "../test.setup";
import {
  PURCHASE_ISSUE_RETENTION_MS,
  PURCHASE_ISSUE_ROWS_PER_SHARD,
  prunePurchaseIssuesHandler,
  purchaseIssueShard,
  record as registeredRecord,
  recordBindIssue,
  recordPurchaseIssue,
  type PurchaseIssueInput,
} from "./internal";
import { MemoryDb, memoryCtx } from "./memoryDb.testing";

const record = testableFunction(registeredRecord);
const PROJECT = "projects_1" as Id<"projects">;
const FINGERPRINT = "a".repeat(64);
const CORRELATION_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

function setup() {
  const db = new MemoryDb();
  db.seed("organizations", { _id: "organizations_1" });
  db.seed("projects", { _id: PROJECT, organizationId: "organizations_1" });
  const runAfter = vi.fn();
  const ctx = { ...memoryCtx(db), scheduler: { runAfter } };
  return { db, ctx, runAfter };
}

const issue = (
  overrides: Partial<PurchaseIssueInput> = {},
): PurchaseIssueInput => ({
  cause: "INAUTHENTIC",
  store: "apple",
  fingerprint: FINGERPRINT,
  ...overrides,
});

afterEach(() => vi.useRealTimers());

describe("recordPurchaseIssue", () => {
  it("counts a repeated failure on one row and keeps the latest request", async () => {
    vi.useFakeTimers({ now: 1_000 });
    const { db, ctx } = setup();
    await recordPurchaseIssue(ctx as never, PROJECT, issue());
    vi.setSystemTime(5_000);
    await recordPurchaseIssue(
      ctx as never,
      PROJECT,
      issue({ correlationId: CORRELATION_ID }),
    );

    expect(db.rows("purchaseIssues")).toEqual([
      expect.objectContaining({
        cause: "INAUTHENTIC",
        fingerprint: FINGERPRINT,
        shard: 10,
        count: 2,
        firstSeenAt: 1_000,
        lastSeenAt: 5_000,
        correlationId: CORRELATION_ID,
      }),
    ]);
  });

  it("keeps one row per cause for the same evidence", async () => {
    const { db, ctx } = setup();
    await recordPurchaseIssue(ctx as never, PROJECT, issue());
    await recordPurchaseIssue(
      ctx as never,
      PROJECT,
      issue({ cause: "VERIFICATION_FAILED", retryAfterSec: 5 }),
    );
    expect(
      db.rows("purchaseIssues").map((row) => [row.cause, row.retryAfterSec]),
    ).toEqual([
      ["INAUTHENTIC", undefined],
      ["VERIFICATION_FAILED", 5],
    ]);
  });

  it("replaces the least recently seen row once a shard is full", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const { db, ctx } = setup();
    // Fill shard "a" with older rows, plus one row in another shard.
    for (let index = 0; index < PURCHASE_ISSUE_ROWS_PER_SHARD; index += 1) {
      db.seed("purchaseIssues", {
        projectId: PROJECT,
        cause: "INAUTHENTIC",
        store: "apple",
        fingerprint: `a${String(index).padStart(63, "0")}`,
        shard: 10,
        count: 1,
        firstSeenAt: index,
        lastSeenAt: index,
      });
    }
    db.seed("purchaseIssues", {
      projectId: PROJECT,
      cause: "INAUTHENTIC",
      store: "apple",
      fingerprint: "b".repeat(64),
      shard: 11,
      count: 1,
      firstSeenAt: 0,
      lastSeenAt: 0,
    });

    await recordPurchaseIssue(ctx as never, PROJECT, issue());

    const shardA = db.rows("purchaseIssues").filter((row) => row.shard === 10);
    expect(shardA).toHaveLength(PURCHASE_ISSUE_ROWS_PER_SHARD);
    expect(shardA.map((row) => row.lastSeenAt)).not.toContain(0);
    expect(shardA.map((row) => row.fingerprint)).toContain(FINGERPRINT);
    // Another shard's older row is untouched.
    expect(
      db.rows("purchaseIssues").find((row) => row.shard === 11),
    ).toBeDefined();
  });

  it("never stores what a caller could pass off as evidence or free text", async () => {
    const { db, ctx } = setup();
    const jws = "header.payload.signature";
    // Not a fingerprint: a raw token in the fingerprint slot records nothing.
    await recordPurchaseIssue(
      ctx as never,
      PROJECT,
      issue({ fingerprint: jws }),
    );
    expect(db.rows("purchaseIssues")).toEqual([]);

    await recordPurchaseIssue(
      ctx as never,
      PROJECT,
      issue({
        claimedProductId: "x".repeat(257),
        productId: "y".repeat(257),
        appUserId: " ",
        correlationId: "not-a-uuid",
        retryAfterSec: Number.NaN,
      }),
    );
    const [row] = db.rows("purchaseIssues");
    expect(row).not.toHaveProperty("claimedProductId");
    expect(row).not.toHaveProperty("productId");
    expect(row).not.toHaveProperty("appUserId");
    expect(row).not.toHaveProperty("correlationId");
    expect(row).not.toHaveProperty("retryAfterSec");
  });

  it("records nothing for a project being deleted", async () => {
    const { db, ctx } = setup();
    await db.patch(PROJECT, { pendingDeletion: true });
    await record._handler(ctx, { projectId: PROJECT, issue: issue() });
    expect(db.rows("purchaseIssues")).toEqual([]);
  });

  it("derives the shard from the fingerprint's first hex digit", () => {
    expect(purchaseIssueShard("0".repeat(64))).toBe(0);
    expect(purchaseIssueShard("f".repeat(64))).toBe(15);
  });
});

describe("recordBindIssue", () => {
  it("schedules the record instead of writing in the bind", async () => {
    const { db, ctx, runAfter } = setup();
    await recordBindIssue(
      ctx as never,
      PROJECT,
      { reason: "bound_to_other_user", store: "google", productId: "gold" },
      { purchaseToken: "token", userId: "alice" },
    );
    expect(db.rows("purchaseIssues")).toEqual([]);
    expect(runAfter).toHaveBeenCalledWith(0, expect.anything(), {
      projectId: PROJECT,
      issue: expect.objectContaining({
        cause: "OWNERSHIP_CONFLICT",
        appUserId: "alice",
        productId: "gold",
      }),
    });
    // No reason to record: nothing is scheduled.
    await recordBindIssue(
      ctx as never,
      PROJECT,
      { reason: "not_found" },
      { purchaseToken: "token", userId: "alice" },
    );
    expect(runAfter).toHaveBeenCalledTimes(1);
  });
});

describe("prunePurchaseIssuesHandler", () => {
  it("drops rows past retention and continues a full batch", async () => {
    const now = PURCHASE_ISSUE_RETENTION_MS + 1_000_000;
    vi.useFakeTimers({ now });
    const { db, ctx, runAfter } = setup();
    for (const [index, lastSeenAt] of [1, 2, 3, now].entries()) {
      db.seed("purchaseIssues", {
        projectId: PROJECT,
        cause: "INAUTHENTIC",
        store: "google",
        fingerprint: String(index).repeat(64),
        shard: index,
        count: 1,
        firstSeenAt: lastSeenAt,
        lastSeenAt,
      });
    }

    await expect(
      prunePurchaseIssuesHandler(ctx as never, PURCHASE_ISSUE_RETENTION_MS, 2),
    ).resolves.toEqual({ deleted: 2 });
    expect(runAfter).toHaveBeenCalledTimes(1);

    await expect(
      prunePurchaseIssuesHandler(ctx as never, PURCHASE_ISSUE_RETENTION_MS, 2),
    ).resolves.toEqual({ deleted: 1 });
    expect(runAfter).toHaveBeenCalledTimes(1);
    expect(db.rows("purchaseIssues").map((row) => row.lastSeenAt)).toEqual([
      now,
    ]);
  });
});
