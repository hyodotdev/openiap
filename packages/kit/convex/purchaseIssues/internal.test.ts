import { createHash, createHmac } from "node:crypto";
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
import { MemoryDb, memoryCtx } from "../test.memoryDb";

const record = testableFunction(registeredRecord);
const PROJECT = "projects_1" as Id<"projects">;
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
const SALT = "project-fingerprint-salt";
const DIGEST = sha256("2000000000000001");
const FINGERPRINT = createHmac("sha256", SALT).update(DIGEST).digest("hex");
const SHARD = purchaseIssueShard(FINGERPRINT);
const CORRELATION_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

function setup(project: Record<string, string> = { fingerprintSalt: SALT }) {
  const db = new MemoryDb();
  db.seed("organizations", { _id: "organizations_1" });
  db.seed("projects", {
    _id: PROJECT,
    organizationId: "organizations_1",
    ...project,
  });
  const runAfter = vi.fn();
  const ctx = { ...memoryCtx(db), scheduler: { runAfter } };
  return { db, ctx, runAfter };
}

const issue = (
  overrides: Partial<PurchaseIssueInput> = {},
): PurchaseIssueInput => ({
  cause: "INAUTHENTIC",
  store: "apple",
  digest: DIGEST,
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
        shard: SHARD,
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
    // Fill the new row's shard with older rows, plus one row in another shard.
    const otherShard = (SHARD + 1) % 16;
    for (let index = 0; index < PURCHASE_ISSUE_ROWS_PER_SHARD; index += 1) {
      db.seed("purchaseIssues", {
        projectId: PROJECT,
        cause: "INAUTHENTIC",
        store: "apple",
        fingerprint: `${FINGERPRINT[0]}${String(index).padStart(63, "0")}`,
        shard: SHARD,
        count: 1,
        firstSeenAt: index,
        lastSeenAt: index,
      });
    }
    db.seed("purchaseIssues", {
      projectId: PROJECT,
      cause: "INAUTHENTIC",
      store: "apple",
      fingerprint: otherShard.toString(16).repeat(64),
      shard: otherShard,
      count: 1,
      firstSeenAt: 0,
      lastSeenAt: 0,
    });

    await recordPurchaseIssue(ctx as never, PROJECT, issue());

    const shardRows = db
      .rows("purchaseIssues")
      .filter((row) => row.shard === SHARD);
    expect(shardRows).toHaveLength(PURCHASE_ISSUE_ROWS_PER_SHARD);
    expect(shardRows.map((row) => row.lastSeenAt)).not.toContain(0);
    expect(shardRows.map((row) => row.fingerprint)).toContain(FINGERPRINT);
    // Another shard's older row is untouched.
    expect(
      db.rows("purchaseIssues").find((row) => row.shard === otherShard),
    ).toBeDefined();
  });

  it("never stores what a caller could pass off as evidence or free text", async () => {
    const { db, ctx } = setup();
    const jws = "header.payload.signature";
    // Not a digest: a raw token in the digest slot records nothing.
    await recordPurchaseIssue(ctx as never, PROJECT, issue({ digest: jws }));
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

  it("salts the fingerprint with a project secret it creates once", async () => {
    const { db, ctx } = setup({});
    await recordPurchaseIssue(ctx as never, PROJECT, issue());
    await recordPurchaseIssue(
      ctx as never,
      PROJECT,
      issue({ cause: "VERIFICATION_FAILED" }),
    );
    const [{ fingerprintSalt: salt }] = db.rows("projects");
    if (typeof salt !== "string") throw new Error("no salt was created");
    expect(salt).toMatch(/^[0-9a-f]{64}$/);
    const salted = createHmac("sha256", salt).update(DIGEST).digest("hex");
    const rows = db.rows("purchaseIssues");
    expect(rows.map((row) => row.fingerprint)).toEqual([salted, salted]);
    expect(rows[0].fingerprint).not.toBe(DIGEST);
  });

  it("never names a user whose erasure was requested", async () => {
    const { db, ctx } = setup();
    db.seed("subscriptionUserErasureJobs", {
      projectId: PROJECT,
      userId: "alice",
      userIdHash: sha256("alice"),
      status: "queued",
      subscriptionsErased: 0,
      commerceEventsErased: 0,
      createdAt: 0,
      updatedAt: 0,
    });
    await recordPurchaseIssue(
      ctx as never,
      PROJECT,
      issue({ cause: "OWNERSHIP_CONFLICT", appUserId: "alice" }),
    );
    await recordPurchaseIssue(
      ctx as never,
      PROJECT,
      issue({ cause: "BIND_LIMIT_REACHED", appUserId: "bob" }),
    );
    expect(
      db.rows("purchaseIssues").map((row) => [row.cause, row.appUserId]),
    ).toEqual([
      ["OWNERSHIP_CONFLICT", undefined],
      ["BIND_LIMIT_REACHED", "bob"],
    ]);
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
      {
        reason: "bound_to_other_user",
        store: "google",
        productId: "gold",
        remoteId: "matched-token",
      },
      { evidence: "token", userId: "alice" },
    );
    expect(db.rows("purchaseIssues")).toEqual([]);
    expect(runAfter).toHaveBeenCalledWith(0, expect.anything(), {
      projectId: PROJECT,
      issue: {
        cause: "OWNERSHIP_CONFLICT",
        store: "google",
        // The purchase the bind matched, as its detail page fingerprints it.
        digest: sha256("google:matched-token"),
        appUserId: "alice",
        productId: "gold",
      },
    });
    // No purchase named: the bind's own token stands in.
    await recordBindIssue(
      ctx as never,
      PROJECT,
      { reason: "bound_to_other_user", store: "google" },
      { evidence: "token", userId: "alice" },
    );
    expect(runAfter).toHaveBeenLastCalledWith(0, expect.anything(), {
      projectId: PROJECT,
      issue: expect.objectContaining({ digest: sha256("google:token") }),
    });
    // No reason to record: nothing is scheduled.
    await recordBindIssue(
      ctx as never,
      PROJECT,
      { reason: "not_found" },
      { evidence: "token", userId: "alice" },
    );
    expect(runAfter).toHaveBeenCalledTimes(2);
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
