import { afterEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../_generated/dataModel";
import { testableFunction } from "../test.setup";
import {
  PURCHASE_ISSUE_CAP_PER_PROJECT,
  PURCHASE_ISSUE_RETENTION_MS,
  prunePurchaseIssuesHandler,
  record as registeredRecord,
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
  db.seed("apiKeys", {
    key: "openiap-kit_pk_app",
    keyType: "publishable",
    isActive: true,
    projectId: PROJECT,
    organizationId: "organizations_1",
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
        count: 2,
        firstSeenAt: 1_000,
        lastSeenAt: 5_000,
        correlationId: CORRELATION_ID,
      }),
    ]);
    expect(db.rows("purchaseIssueCounts")).toEqual([
      expect.objectContaining({ projectId: PROJECT, rows: 1 }),
    ]);
  });

  it("keeps one row per cause for the same evidence", async () => {
    const { db, ctx } = setup();
    await recordPurchaseIssue(ctx as never, PROJECT, issue());
    await recordPurchaseIssue(
      ctx as never,
      PROJECT,
      issue({ cause: "STORE_UNAVAILABLE", retryAfterSec: 5 }),
    );
    expect(
      db.rows("purchaseIssues").map((row) => [row.cause, row.retryAfterSec]),
    ).toEqual([
      ["INAUTHENTIC", undefined],
      ["STORE_UNAVAILABLE", 5],
    ]);
  });

  it("replaces the least recently seen row once the project is at its cap", async () => {
    vi.useFakeTimers({ now: 10_000 });
    const { db, ctx } = setup();
    db.seed("purchaseIssues", {
      projectId: PROJECT,
      cause: "INAUTHENTIC",
      store: "apple",
      fingerprint: "b".repeat(64),
      count: 1,
      firstSeenAt: 100,
      lastSeenAt: 100,
    });
    db.seed("purchaseIssues", {
      projectId: PROJECT,
      cause: "INAUTHENTIC",
      store: "apple",
      fingerprint: "c".repeat(64),
      count: 1,
      firstSeenAt: 200,
      lastSeenAt: 200,
    });
    db.seed("purchaseIssueCounts", {
      projectId: PROJECT,
      rows: PURCHASE_ISSUE_CAP_PER_PROJECT,
    });

    await recordPurchaseIssue(ctx as never, PROJECT, issue());

    expect(db.rows("purchaseIssues").map((row) => row.fingerprint)).toEqual([
      "c".repeat(64),
      FINGERPRINT,
    ]);
    expect(db.rows("purchaseIssueCounts")[0].rows).toBe(
      PURCHASE_ISSUE_CAP_PER_PROJECT,
    );
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
    await recordPurchaseIssue(ctx as never, PROJECT, issue());
    expect(db.rows("purchaseIssues")).toEqual([]);
  });
});

describe("record", () => {
  it("resolves the project from the API key and ignores an unknown key", async () => {
    const { db, ctx } = setup();
    await record._handler(ctx, {
      apiKey: "openiap-kit_pk_unknown",
      issue: issue(),
    });
    expect(db.rows("purchaseIssues")).toEqual([]);

    await record._handler(ctx, {
      apiKey: "openiap-kit_pk_app",
      issue: issue(),
    });
    expect(db.rows("purchaseIssues")).toEqual([
      expect.objectContaining({ projectId: PROJECT }),
    ]);
  });
});

describe("prunePurchaseIssuesHandler", () => {
  it("drops rows past retention, keeps the counter true, and continues a full batch", async () => {
    const now = PURCHASE_ISSUE_RETENTION_MS + 1_000_000;
    vi.useFakeTimers({ now });
    const { db, ctx, runAfter } = setup();
    for (const [index, lastSeenAt] of [1, 2, 3, now].entries()) {
      db.seed("purchaseIssues", {
        projectId: PROJECT,
        cause: "INAUTHENTIC",
        store: "google",
        fingerprint: String(index).repeat(64),
        count: 1,
        firstSeenAt: lastSeenAt,
        lastSeenAt,
      });
    }
    db.seed("purchaseIssueCounts", { projectId: PROJECT, rows: 4 });

    await expect(
      prunePurchaseIssuesHandler(ctx as never, PURCHASE_ISSUE_RETENTION_MS, 2),
    ).resolves.toEqual({ deleted: 2 });
    expect(runAfter).toHaveBeenCalledTimes(1);
    expect(db.rows("purchaseIssueCounts")[0].rows).toBe(2);

    await expect(
      prunePurchaseIssuesHandler(ctx as never, PURCHASE_ISSUE_RETENTION_MS, 2),
    ).resolves.toEqual({ deleted: 1 });
    expect(runAfter).toHaveBeenCalledTimes(1);
    expect(db.rows("purchaseIssues").map((row) => row.lastSeenAt)).toEqual([
      now,
    ]);
    expect(db.rows("purchaseIssueCounts")[0].rows).toBe(1);
  });
});
