import { afterEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../_generated/dataModel";
import { amazonSubscriptionToken } from "../subscriptions/amazon";
import { MemoryDb, memoryCtx } from "../test.memoryDb";
import {
  UNRECOGNIZED_PURCHASE_RETENTION_MS,
  pruneUnrecognizedPurchasesHandler,
} from "./cleanup";
import { savePurchaseInternal } from "./internal";
import { HarmonizedPurchaseState } from "./purchaseState";
import { isValidState } from "./shared";
import { applyPurchaseStatsDelta, readPurchaseStats } from "./stats";

const PROJECT = "projects_1" as Id<"projects">;
const DAY_MS = 24 * 60 * 60 * 1_000;
const START = 1_800_000_000_000;

function setup() {
  vi.useFakeTimers({ now: START });
  const db = new MemoryDb();
  db.seed("organizations", { _id: "organizations_1" });
  db.seed("projects", { _id: PROJECT, organizationId: "organizations_1" });
  const runAfter = vi.fn();
  const ctx = { ...memoryCtx(db), scheduler: { runAfter } } as never;

  const verify = (
    store: "google" | "horizon",
    evidence: string,
    state: HarmonizedPurchaseState,
    persistIfChanged?: boolean,
  ) =>
    savePurchaseInternal({
      ctx,
      projectId: PROJECT,
      store,
      applicationId: "dev.example",
      remoteId: evidence,
      requestData:
        store === "google"
          ? { store, purchaseToken: evidence }
          : { store, userId: evidence, sku: "premium" },
      state,
      isValid: isValidState(state),
      persistIfChanged,
    });
  const prune = (batchSize = 100) =>
    pruneUnrecognizedPurchasesHandler(
      ctx,
      UNRECOGNIZED_PURCHASE_RETENTION_MS,
      batchSize,
    );
  const remoteIds = () => db.rows("purchases").map((row) => row.remoteId);
  return { db, ctx, runAfter, verify, prune, remoteIds };
}

const { INAUTHENTIC, ENTITLED, EXPIRED } = HarmonizedPurchaseState;

afterEach(() => vi.useRealTimers());

describe("pruneUnrecognizedPurchasesHandler", () => {
  it("deletes evidence no store recognized and lowers the counters to match", async () => {
    const { ctx, verify, prune, remoteIds } = setup();
    await verify("google", "unknown-token", INAUTHENTIC);
    await verify("horizon", "stranger", INAUTHENTIC);
    await verify("horizon", "owner", ENTITLED);
    expect(await readPurchaseStats(ctx, PROJECT)).toMatchObject({
      total: 3,
      google: 1,
      horizon: 2,
      valid: 1,
      invalid: 2,
    });

    vi.advanceTimersByTime(UNRECOGNIZED_PURCHASE_RETENTION_MS + 1);
    await expect(prune()).resolves.toEqual({ deleted: 2 });

    expect(remoteIds()).toEqual(["owner"]);
    expect(await readPurchaseStats(ctx, PROJECT)).toEqual({
      total: 1,
      apple: 0,
      google: 0,
      horizon: 1,
      amazon: 0,
      googleOrders: 0,
      valid: 1,
      invalid: 0,
    });
  });

  it("counts the window from the last unrecognized verdict", async () => {
    const { verify, prune, remoteIds } = setup();
    await verify("google", "unknown-token", INAUTHENTIC);
    vi.advanceTimersByTime(29 * DAY_MS);
    await expect(prune()).resolves.toEqual({ deleted: 0 });

    await verify("google", "unknown-token", INAUTHENTIC);
    vi.advanceTimersByTime(29 * DAY_MS);
    await expect(prune()).resolves.toEqual({ deleted: 0 });
    expect(remoteIds()).toEqual(["unknown-token"]);

    vi.advanceTimersByTime(2 * DAY_MS);
    await expect(prune()).resolves.toEqual({ deleted: 1 });
  });

  it("restarts the window on an unchanged recheck", async () => {
    const { verify, prune, remoteIds } = setup();
    await verify("horizon", "stranger", INAUTHENTIC);
    vi.advanceTimersByTime(29 * DAY_MS);
    await verify("horizon", "stranger", INAUTHENTIC, true);
    vi.advanceTimersByTime(2 * DAY_MS);

    await expect(prune()).resolves.toEqual({ deleted: 0 });
    expect(remoteIds()).toEqual(["stranger"]);
  });

  it("keeps a row that held any other verdict, before or after", async () => {
    const { ctx, verify, prune, remoteIds } = setup();
    await verify("horizon", "refunded", ENTITLED);
    await verify("horizon", "refunded", INAUTHENTIC);
    await verify("horizon", "late-buyer", INAUTHENTIC);
    await verify("horizon", "late-buyer", ENTITLED);
    await verify("horizon", "late-buyer", INAUTHENTIC);
    await verify("google", "propagated-token", INAUTHENTIC);
    await verify("google", "propagated-token", EXPIRED);
    await verify("google", "lapsed-token", EXPIRED);

    vi.advanceTimersByTime(UNRECOGNIZED_PURCHASE_RETENTION_MS + 1);
    await expect(prune()).resolves.toEqual({ deleted: 0 });

    expect(remoteIds()).toEqual([
      "refunded",
      "late-buyer",
      "propagated-token",
      "lapsed-token",
    ]);
    expect(await readPurchaseStats(ctx, PROJECT)).toMatchObject({
      total: 4,
      invalid: 4,
    });
  });

  it("keeps and unmarks a row with an owner, an order or a subscription", async () => {
    const { db, ctx, prune } = setup();
    const marked = (fields: Record<string, string | boolean>): string =>
      db.seed("purchases", {
        projectId: PROJECT,
        store: "google",
        applicationId: "dev.example",
        requestData: { store: "google", purchaseToken: "token" },
        state: INAUTHENTIC,
        isValid: false,
        statsCounted: true,
        storeStatsCounted: true,
        unrecognizedAt: START,
        ...fields,
      });
    const subscription = (purchaseToken: string): string =>
      db.seed("subscriptions", {
        projectId: PROJECT,
        purchaseToken,
        productId: "monthly",
        platform: "Android",
        state: "Expired",
        startedAt: START,
        updatedAt: START,
      });
    marked({ remoteId: "owned", appUserId: "user-1" });
    marked({ remoteId: "erased", accountErased: true });
    marked({ remoteId: "ordered", orderId: "GPA.1" });
    marked({ remoteId: "subscribed" });
    subscription("subscribed");
    marked({ remoteId: "replaced" });
    db.seed("subscriptionTokenAliases", {
      projectId: PROJECT,
      purchaseToken: "replaced",
      successorPurchaseToken: "successor",
      createdAt: START,
      updatedAt: START,
    });
    marked({ remoteId: "amazon-receipt", store: "amazon" });
    subscription(amazonSubscriptionToken("amazon-receipt"));
    // A row from before the marker existed is never a candidate.
    db.seed("purchases", {
      projectId: PROJECT,
      store: "google",
      applicationId: "dev.example",
      remoteId: "legacy",
      requestData: { store: "google", purchaseToken: "legacy" },
      state: INAUTHENTIC,
      isValid: false,
    });
    await applyPurchaseStatsDelta(ctx, PROJECT, { total: 7, invalid: 7 });

    vi.advanceTimersByTime(UNRECOGNIZED_PURCHASE_RETENTION_MS + 1);
    await expect(prune()).resolves.toEqual({ deleted: 0 });

    expect(db.rows("purchases")).toHaveLength(7);
    expect(
      db.rows("purchases").filter((row) => row.unrecognizedAt !== undefined),
    ).toEqual([]);
    expect(await readPurchaseStats(ctx, PROJECT)).toMatchObject({
      total: 7,
      invalid: 7,
    });
  });

  it("keeps a row whose reference check throws and prunes the rest", async () => {
    const { db, verify, prune, runAfter } = setup();
    await verify("google", "twice-subscribed", INAUTHENTIC);
    await verify("google", "unknown-token", INAUTHENTIC);
    for (const productId of ["monthly", "yearly"]) {
      db.seed("subscriptions", {
        projectId: PROJECT,
        purchaseToken: "twice-subscribed",
        productId,
        platform: "Android",
        state: "Expired",
        startedAt: START,
        updatedAt: START,
      });
    }
    vi.advanceTimersByTime(UNRECOGNIZED_PURCHASE_RETENTION_MS + 1);

    await expect(prune(2)).resolves.toEqual({ deleted: 1 });
    expect(db.rows("purchases")).toMatchObject([
      { remoteId: "twice-subscribed" },
    ]);
    expect(db.rows("purchases")[0]).not.toHaveProperty("unrecognizedAt");
    expect(runAfter).toHaveBeenCalledTimes(1);

    await expect(prune(2)).resolves.toEqual({ deleted: 0 });
    expect(runAfter).toHaveBeenCalledTimes(1);
  });

  it("does not reschedule itself for an empty batch size", async () => {
    const { verify, prune, runAfter, remoteIds } = setup();
    await verify("google", "unknown-token", INAUTHENTIC);
    vi.advanceTimersByTime(UNRECOGNIZED_PURCHASE_RETENTION_MS + 1);

    await expect(prune(0)).resolves.toEqual({ deleted: 0 });
    expect(remoteIds()).toEqual(["unknown-token"]);
    expect(runAfter).not.toHaveBeenCalled();
  });

  it("deletes one bounded batch per run and continues while it is full", async () => {
    const { verify, prune, runAfter, remoteIds } = setup();
    await verify("google", "token-1", INAUTHENTIC);
    await verify("google", "token-2", INAUTHENTIC);
    await verify("google", "token-3", INAUTHENTIC);
    vi.advanceTimersByTime(UNRECOGNIZED_PURCHASE_RETENTION_MS + 1);

    await expect(prune(2)).resolves.toEqual({ deleted: 2 });
    expect(remoteIds()).toEqual(["token-3"]);
    expect(runAfter).toHaveBeenCalledTimes(1);

    await expect(prune(2)).resolves.toEqual({ deleted: 1 });
    expect(runAfter).toHaveBeenCalledTimes(1);
  });
});
