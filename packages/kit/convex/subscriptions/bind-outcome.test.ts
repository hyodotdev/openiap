import { createHash, createHmac } from "node:crypto";
import { getFunctionName, type FunctionReference } from "convex/server";
import type { Value } from "convex/values";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../_generated/dataModel";
import {
  recordPurchaseIssue,
  type PurchaseIssueInput,
} from "../purchaseIssues/internal";
import { MemoryDb, memoryCtx } from "../test.memoryDb";
import { MAX_BOUND_PURCHASES_PER_USER } from "./limits";
import { drainSubscriptionUserErasurePage } from "./internal";
import { testableFunction } from "../test.setup";
import {
  bindUser as registeredBindUser,
  bindUserAsServer as registeredBindUserAsServer,
  rebindUser as registeredRebindUser,
} from "./mutation";

const bindUser = testableFunction(registeredBindUser);
const bindUserAsServer = testableFunction(registeredBindUserAsServer);
const rebindUser = testableFunction(registeredRebindUser);

const PROJECT = "projects_1" as Id<"projects">;
const PK = "openiap-kit_pk_app";
const SK = "openiap-kit_sk_server";
const SALT = "project-fingerprint-salt";
const fingerprint = (evidence: string): string =>
  createHmac("sha256", SALT)
    .update(createHash("sha256").update(evidence).digest("hex"))
    .digest("hex");
const CORRELATION_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

function oneTimePurchase(remoteId: string, fields: Record<string, Value> = {}) {
  return {
    projectId: PROJECT,
    store: "apple",
    applicationId: "dev.example",
    remoteId,
    requestData: { store: "apple", jws: `jws-for-${remoteId}` },
    remoteResponse: JSON.stringify({ type: "Non-Consumable" }),
    state: "ENTITLED",
    isValid: true,
    productId: "lifetime",
    ...fields,
  };
}

function setup() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const db = new MemoryDb();
  db.seed("organizations", { _id: "organizations_1" });
  db.seed("projects", {
    _id: PROJECT,
    organizationId: "organizations_1",
    fingerprintSalt: SALT,
  });
  for (const [key, keyType] of [
    [PK, "publishable"],
    [SK, "secret"],
  ]) {
    db.seed("apiKeys", {
      key,
      keyType,
      isActive: true,
      projectId: PROJECT,
      organizationId: "organizations_1",
    });
  }
  const subscription = (purchaseToken: string, userId?: string) =>
    db.seed("subscriptions", {
      projectId: PROJECT,
      purchaseToken,
      ...(userId ? { userId } : {}),
      productId: "monthly",
      platform: "IOS",
      store: "apple",
      state: "Active",
      startedAt: 0,
      updatedAt: 0,
    });
  subscription("sub-owned", "bob");
  subscription("sub-free");
  db.seed("purchases", oneTimePurchase("lifetime-1"));
  db.seed(
    "purchases",
    oneTimePurchase("coins-1", {
      remoteResponse: JSON.stringify({ type: "Consumable" }),
      state: "READY_TO_CONSUME",
    }),
  );
  // A subscription purchase row with no canonical subscription row.
  db.seed(
    "purchases",
    oneTimePurchase("renewing-1", {
      remoteResponse: JSON.stringify({ type: "Auto-Renewable Subscription" }),
    }),
  );
  db.seed(
    "purchases",
    oneTimePurchase("google-token-1", {
      store: "google",
      requestData: { store: "google", purchaseToken: "google-token-1" },
      remoteResponse: JSON.stringify({ productLineItem: [{}] }),
    }),
  );
  const ctx = {
    ...memoryCtx(db),
    // Runs a scheduled issue record at once, as the scheduler would later.
    scheduler: {
      runAfter: async (
        _delay: number,
        reference: FunctionReference<"mutation">,
        args: { projectId: Id<"projects">; issue: PurchaseIssueInput },
      ) => {
        expect(getFunctionName(reference)).toBe(
          "purchaseIssues/internal:record",
        );
        await recordPurchaseIssue(
          memoryCtx(db) as never,
          args.projectId,
          args.issue,
        );
      },
    },
  };
  return { db, ctx };
}

const bind = (
  ctx: unknown,
  apiKey: string,
  purchaseToken: string,
  userId = "alice",
) =>
  bindUser._handler(ctx, {
    apiKey,
    purchaseToken,
    userId,
    correlationId: CORRELATION_ID,
  });

const purchase = (db: MemoryDb, remoteId: string) =>
  db.rows("purchases").find((row) => row.remoteId === remoteId);

afterEach(() => vi.restoreAllMocks());

describe("bindUser with a publishable key", () => {
  it("answers a conflict exactly like an unknown token and records neither", async () => {
    const { db, ctx } = setup();
    const conflict = await bind(ctx, PK, "sub-owned");
    const unknown = await bind(ctx, PK, "no-such-token");
    expect(conflict).toEqual({ ok: true, bound: false });
    expect(JSON.stringify(conflict)).toBe(JSON.stringify(unknown));
    expect(db.rows("purchaseIssues")).toEqual([]);
  });

  it("keeps today's response and never links a one-time purchase", async () => {
    const { db, ctx } = setup();
    expect(await bind(ctx, PK, "sub-free")).toEqual({ ok: true, bound: true });
    expect(await bind(ctx, PK, "lifetime-1")).toEqual({
      ok: true,
      bound: false,
    });
    expect(purchase(db, "lifetime-1")).not.toHaveProperty("appUserId");
  });
});

describe("bindUser with a secret key", () => {
  it("names each outcome", async () => {
    const { ctx } = setup();
    expect(await bind(ctx, SK, "sub-free")).toEqual({
      ok: true,
      bound: true,
      reason: "bound",
    });
    expect(await bind(ctx, SK, "sub-free")).toEqual({
      ok: true,
      bound: true,
      reason: "already_bound",
    });
    expect(await bind(ctx, SK, "sub-owned")).toEqual({
      ok: true,
      bound: false,
      reason: "bound_to_other_user",
    });
    expect(await bind(ctx, SK, "no-such-token")).toEqual({
      ok: true,
      bound: false,
      reason: "not_found",
    });
  });

  it("links an Apple or Google one-time purchase and never moves its owner", async () => {
    const { db, ctx } = setup();
    expect(await bind(ctx, SK, "lifetime-1")).toMatchObject({
      bound: true,
      reason: "bound",
    });
    expect(await bind(ctx, SK, "google-token-1")).toMatchObject({
      reason: "bound",
    });
    expect(await bind(ctx, SK, "lifetime-1", "carol")).toMatchObject({
      bound: false,
      reason: "bound_to_other_user",
    });
    expect(purchase(db, "lifetime-1")?.appUserId).toBe("alice");
    expect(purchase(db, "google-token-1")?.appUserId).toBe("alice");
  });

  it("links a Google purchase still awaiting acknowledgment", async () => {
    // Apps confirm with their backend before finishTransaction acknowledges.
    const { db, ctx } = setup();
    db.seed(
      "purchases",
      oneTimePurchase("google-pending-1", {
        store: "google",
        requestData: { store: "google", purchaseToken: "google-pending-1" },
        remoteResponse: JSON.stringify({ productLineItem: [{}] }),
        state: "PENDING_ACKNOWLEDGMENT",
      }),
    );
    expect(await bind(ctx, SK, "google-pending-1")).toMatchObject({
      bound: true,
      reason: "bound",
    });
    expect(await bind(ctx, SK, "google-pending-1", "carol")).toMatchObject({
      bound: false,
      reason: "bound_to_other_user",
    });
    expect(purchase(db, "google-pending-1")?.appUserId).toBe("alice");
  });

  it("links any valid one-time state but no invalid or auto-renewing purchase", async () => {
    const { db, ctx } = setup();
    db.seed(
      "purchases",
      oneTimePurchase("refunded-1", { state: "CANCELED", isValid: false }),
    );
    expect(await bind(ctx, SK, "coins-1")).toMatchObject({ reason: "bound" });
    expect(await bind(ctx, SK, "refunded-1")).toMatchObject({
      reason: "not_bindable",
    });
    expect(await bind(ctx, SK, "renewing-1")).toMatchObject({
      reason: "not_found",
    });
    expect(purchase(db, "refunded-1")).not.toHaveProperty("appUserId");
    expect(purchase(db, "renewing-1")).not.toHaveProperty("appUserId");
  });

  it("records a conflict for support, keyed on the token it never stores", async () => {
    const { db, ctx } = setup();
    await bind(ctx, SK, "sub-owned");
    await bind(ctx, SK, "sub-owned");
    expect(db.rows("purchaseIssues")).toEqual([
      expect.objectContaining({
        cause: "OWNERSHIP_CONFLICT",
        store: "apple",
        productId: "monthly",
        appUserId: "alice",
        fingerprint: fingerprint("sub-owned"),
        correlationId: CORRELATION_ID,
        count: 2,
      }),
    ]);
    expect(JSON.stringify(db.rows("purchaseIssues"))).not.toContain(
      "sub-owned",
    );
  });

  it("links Apple and Google one-time purchases outside the Amazon and Horizon cap", async () => {
    const { db, ctx } = setup();
    for (let index = 0; index < MAX_BOUND_PURCHASES_PER_USER; index += 1) {
      db.seed(
        "purchases",
        oneTimePurchase(`held-${index}`, {
          appUserId: "alice",
          store: "amazon",
        }),
      );
    }
    expect(await bind(ctx, SK, "lifetime-1")).toMatchObject({
      bound: true,
      reason: "bound",
    });
    expect(db.rows("purchaseIssues")).toEqual([]);
  });
});

describe("rebindUser", () => {
  it("moves a one-time purchase and reports that no event was sent", async () => {
    const { db, ctx } = setup();
    await bind(ctx, SK, "lifetime-1");
    const rebind = (purchaseToken: string, userId: string) =>
      rebindUser._handler(ctx, { apiKey: SK, purchaseToken, userId });

    expect(await rebind("lifetime-1", "dave")).toEqual({
      ok: true,
      rebound: true,
      notified: false,
    });
    expect(purchase(db, "lifetime-1")?.appUserId).toBe("dave");
    expect(await rebind("lifetime-1", "dave")).toEqual({
      ok: true,
      rebound: true,
      notified: true,
    });
    expect(await rebind("renewing-1", "dave")).toEqual({
      ok: true,
      rebound: false,
      notified: true,
    });
  });
});

describe("bindUserAsServer", () => {
  it("stays subscription-only for Apple and Google", async () => {
    const { db, ctx } = setup();
    await expect(
      bindUserAsServer._handler(ctx as never, {
        apiKey: SK,
        purchaseToken: "lifetime-1",
        userId: "alice",
      }),
    ).resolves.toEqual({ ok: true, bound: false });
    expect(purchase(db, "lifetime-1")).not.toHaveProperty("appUserId");
  });

  function seedAmazonSubscription(db: MemoryDb) {
    db.seed("purchases", oneTimePurchase("rvs-1", { store: "amazon" }));
    db.seed("subscriptions", {
      projectId: PROJECT,
      purchaseToken: "amazon:rvs-1",
      productId: "monthly",
      platform: "Android",
      store: "amazon",
      state: "Active",
      startedAt: 0,
      updatedAt: 0,
    });
  }
  const bindAmazon = (ctx: unknown) =>
    bindUserAsServer._handler(ctx, {
      apiKey: SK,
      purchaseToken: "amazon:rvs-1",
      userId: "alice",
    });

  it("records an Amazon subscription refused by the bound-purchase cap", async () => {
    const { db, ctx } = setup();
    seedAmazonSubscription(db);
    for (let index = 0; index < MAX_BOUND_PURCHASES_PER_USER; index += 1) {
      db.seed(
        "purchases",
        oneTimePurchase(`held-${index}`, {
          appUserId: "alice",
          store: index % 2 ? "amazon" : "horizon",
        }),
      );
    }
    await expect(bindAmazon(ctx)).resolves.toEqual({ ok: true, bound: false });
    expect(db.rows("purchaseIssues")).toEqual([
      expect.objectContaining({
        cause: "BIND_LIMIT_REACHED",
        store: "amazon",
        appUserId: "alice",
      }),
    ]);
  });

  it("binds Amazon however many Apple and Google purchases the user holds", async () => {
    const { db, ctx } = setup();
    seedAmazonSubscription(db);
    for (let index = 0; index < MAX_BOUND_PURCHASES_PER_USER; index += 1) {
      db.seed(
        "purchases",
        oneTimePurchase(`held-${index}`, {
          appUserId: "alice",
          store: index % 2 ? "apple" : "google",
        }),
      );
    }
    await expect(bindAmazon(ctx)).resolves.toEqual({ ok: true, bound: true });
    expect(db.rows("purchaseIssues")).toEqual([]);
  });
});

describe("user erasure", () => {
  it("unlinks the erased user from purchase issues", async () => {
    const { db, ctx } = setup();
    await bind(ctx, SK, "sub-owned");
    const jobId = db.seed("subscriptionUserErasureJobs", {
      projectId: PROJECT,
      userId: "alice",
      userIdHash: "hash",
      status: "queued",
      subscriptionsErased: 0,
      commerceEventsErased: 0,
      createdAt: 0,
      updatedAt: 0,
    }) as Id<"subscriptionUserErasureJobs">;

    await drainSubscriptionUserErasurePage(ctx as never, jobId);

    const [issue] = db.rows("purchaseIssues");
    expect(issue).toMatchObject({ cause: "OWNERSHIP_CONFLICT" });
    expect(issue).not.toHaveProperty("appUserId");
  });
});
