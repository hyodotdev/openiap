import Ajv from "ajv/dist/2020.js";
import {
  commerceEventSchema,
  primitivesSchema,
} from "@hyodotdev/openiap-commerce-protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = { userId: "users_1" as string | null };
vi.mock(import("@convex-dev/auth/server"), async (importOriginal) => ({
  ...(await importOriginal()),
  getAuthUserId: async () => auth.userId as never,
}));

const { getFunctionName } = await import("convex/server");
const { MemoryDb, seedProject } = await import("../test.memoryDb");
const {
  appleStatusSnapshot,
  applyPurchaseResyncHandler,
  applyStoreResyncHandler,
  getResyncTarget,
} = await import("./resync");
const { testableFunction } = await import("../test.setup");
const {
  applySubscriptionEventHandler,
  bindSubscriptionToUserHandler,
  drainSubscriptionUserErasurePage,
  rebindSubscriptionToUserHandler,
  recordVerifiedSubscriptionHandler,
  RESYNC_DISPUTE_COOLDOWN_MS,
} = await import("./internal");
const { HarmonizedPurchaseState } = await import("../purchases/purchaseState");
const { recordWebhookEventHandler } = await import("../webhooks/internal");
const { resolveOperatorProject } = await import("../projects/helpers");
const { buildEventPayload } = await import("../commerce/deliveryState");

type Db = InstanceType<typeof MemoryDb>;
const ctxOf = (db: Db) =>
  ({ db, scheduler: { runAfter: async () => null } }) as never;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const TOKEN = "2000000000000001";

// The wire bodies, each held to the protocol's own event schema, which pairs
// every state-naming lifecycle event with its state.
function deliveredBodies(db: Db) {
  const ajv = new Ajv({ strict: true, allErrors: true });
  ajv.addSchema(primitivesSchema, "primitives.schema.json");
  const validate = ajv.compile(commerceEventSchema);
  return db.rows("commerceEvents").map((row) => {
    const body = buildEventPayload(row as never);
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    return body;
  });
}

const typesAndUsers = (db: Db) =>
  deliveredBodies(db).map((body) => [body.eventType, body.userId]);

type StoreEvent = Parameters<typeof recordWebhookEventHandler>[1]["event"];

// An Apple notification, recorded and applied as the webhook path does.
async function applyStoreEvent(
  db: Db,
  sourceNotificationId: string,
  event: Pick<StoreEvent, "type" | "occurredAt"> & Partial<StoreEvent>,
) {
  const { eventId } = await recordWebhookEventHandler(ctxOf(db), {
    projectId: "projects_1" as never,
    source: "apple",
    sourceNotificationId,
    event: {
      sourceFull: "AppleAppStoreServerNotificationsV2",
      platform: "IOS",
      store: "apple",
      environment: "Production",
      purchaseToken: TOKEN,
      originalTransactionId: TOKEN,
      productKind: "subscription",
      productId: "premium_monthly",
      ...event,
    },
  });
  await applySubscriptionEventHandler(ctxOf(db), {
    projectId: "projects_1" as never,
    eventId,
  });
}

// A mutation ctx whose scheduled calls are recorded, not run.
function schedulingCtx(db: Db) {
  const runAfter = vi.fn(
    async (
      _delay: number,
      _reference: Parameters<typeof getFunctionName>[0],
      _args: Record<string, unknown>,
    ) => null,
  );
  return { ctx: { db, scheduler: { runAfter } } as never, runAfter };
}
const scheduledNames = (runAfter: ReturnType<typeof vi.fn>) =>
  runAfter.mock.calls
    .map(([, reference]) => getFunctionName(reference))
    .filter(
      (name) => name === "subscriptions/action:resyncDisputedSubscription",
    );

beforeEach(() => {
  auth.userId = "users_1";
});

describe("appleStatusSnapshot", () => {
  const transaction = {
    productId: "premium_monthly",
    expiresDate: 1_000,
    currency: "USD",
    price: 9990,
  };

  it("maps each App Store status", () => {
    expect(
      appleStatusSnapshot({
        status: 1,
        transaction,
        renewal: { autoRenewStatus: 1, renewalDate: 1_000 },
      }),
    ).toMatchObject({
      state: "Active",
      willRenew: true,
      renewsAt: 1_000,
      priceAmountMicros: 9_990_000,
      clearCancellationReason: true,
    });
    expect(
      appleStatusSnapshot({
        status: 2,
        transaction,
        renewal: { autoRenewStatus: 0, expirationIntent: 1 },
      }),
    ).toMatchObject({
      state: "Expired",
      willRenew: false,
      cancellationReason: "UserCanceled",
    });
    expect(
      appleStatusSnapshot({
        status: 3,
        transaction,
        renewal: { expirationIntent: 2 },
      }),
    ).toMatchObject({
      state: "InBillingRetry",
      cancellationReason: "BillingError",
    });
    expect(
      appleStatusSnapshot({
        status: 4,
        transaction,
        renewal: { gracePeriodExpiresDate: 5_000 },
      }),
    ).toMatchObject({ state: "InGracePeriod", expiresAt: 5_000 });
    expect(
      appleStatusSnapshot({ status: 4, transaction, renewal: null })?.expiresAt,
    ).toBeUndefined();
    expect(
      appleStatusSnapshot({
        status: 5,
        transaction: { ...transaction, revocationReason: 1 },
      }),
    ).toMatchObject({ state: "Refunded", cancellationReason: "Refunded" });
    expect(
      appleStatusSnapshot({ status: 5, transaction: { ...transaction } }),
    ).toMatchObject({ state: "Revoked", clearCancellationReason: true });
    expect(appleStatusSnapshot({ status: 9, transaction })).toBeNull();
  });
});

describe("applyStoreResync", () => {
  async function seed(db: Db, overrides: Record<string, unknown> = {}) {
    seedProject(db, "admin");
    await db.insert("outboundDestinations", {
      projectId: "projects_1",
      url: "https://hooks.example.com/iapkit",
      secret: "whsec_test",
      enabled: true,
      createdAt: 1,
      updatedAt: 1,
    });
    // A row a store event already governs and reported to its owner.
    return db.insert("subscriptions", {
      projectId: "projects_1",
      purchaseToken: "2000000000000001",
      userId: "owner-1",
      productId: "premium_monthly",
      platform: "IOS",
      state: "Active",
      expiresAt: Date.now() + HOUR,
      willRenew: true,
      startedAt: 1,
      updatedAt: Date.now(),
      lastEventId: "webhookEvents_seed",
      lastEventOccurredAt: 1,
      ...overrides,
    });
  }

  const expired = {
    projectId: "projects_1" as never,
    platform: "IOS" as const,
    store: "apple" as const,
    purchaseToken: "2000000000000001",
    observedAt: Date.now(),
    snapshot: {
      productId: "premium_monthly",
      state: "Expired" as const,
      expiresAt: 1_000,
      willRenew: false,
      cancellationReason: "BillingError" as const,
    },
    context: {
      environment: "Production" as const,
      originalTransactionId: "2000000000000001",
    },
  };

  it("applies store state, keeps the owner and emits only the entitlement delta", async () => {
    const db = new MemoryDb();
    const subscriptionId = await seed(db);

    const outcome = await applyStoreResyncHandler(ctxOf(db), expired);

    expect(outcome).toMatchObject({
      status: "updated",
      subscriptionId,
      state: "Expired",
      emittedEvents: 1,
    });
    expect(await db.get(subscriptionId)).toMatchObject({
      userId: "owner-1",
      state: "Expired",
      willRenew: false,
      cancellationReason: "BillingError",
    });
    expect(db.rows("commerceEvents")).toEqual([
      expect.objectContaining({
        eventType: "entitlement.revoked",
        userId: "owner-1",
        entitlementActive: false,
      }),
    ]);
    // No store notification caused it, so no store event id (SPEC 9.3).
    expect(db.rows("commerceEvents")[0]).not.toHaveProperty(
      "sourceStoreNotificationId",
    );
    expect(db.rows("webhookEvents")).toEqual([
      expect.objectContaining({
        source: "StoreResync",
        type: "ReceiptRechecked",
        store: "apple",
        appliedAt: expect.any(Number),
      }),
    ]);
    expect(db.rows("outboundDeliveries")).toHaveLength(1);
  });

  it("is idempotent for the same store state", async () => {
    const db = new MemoryDb();
    await seed(db);
    await applyStoreResyncHandler(ctxOf(db), expired);
    const second = await applyStoreResyncHandler(ctxOf(db), {
      ...expired,
      observedAt: expired.observedAt + 1,
    });
    expect(second).toMatchObject({ status: "unchanged", emittedEvents: 0 });
    expect(db.rows("commerceEvents")).toHaveLength(1);
    expect(db.rows("webhookEvents")).toHaveLength(1);
    expect(db.rows("subscriptions")[0]?.resyncedAt).toBe(
      expired.observedAt + 1,
    );
    expect(db.rows("outboundDeliveries")).toHaveLength(1);
  });

  it("keeps an agreeing store read ahead of delayed notifications", async () => {
    const db = new MemoryDb();
    const subscriptionId = await seed(db, { ...expired.snapshot });

    await expect(
      applyStoreResyncHandler(ctxOf(db), expired),
    ).resolves.toMatchObject({ status: "unchanged", emittedEvents: 0 });
    expect(db.rows("webhookEvents")).toHaveLength(0);
    await applyStoreEvent(db, "late-renewal-after-agreeing-read", {
      type: "SubscriptionRenewed",
      expiresAt: expired.observedAt + HOUR,
      willRenew: true,
      occurredAt: expired.observedAt - 1,
    });
    expect(await db.get(subscriptionId)).toMatchObject({
      state: "Expired",
      resyncedAt: expired.observedAt,
    });
    expect(db.rows("commerceEvents")).toHaveLength(0);
    expect(db.rows("outboundDeliveries")).toHaveLength(0);
  });

  it("reports expiry once when an agreeing read completes after the access deadline", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1000);
      const db = new MemoryDb();
      await seed(db, { expiresAt: 1500, updatedAt: 1000 });
      vi.setSystemTime(2000);
      await expect(
        applyStoreResyncHandler(ctxOf(db), {
          ...expired,
          observedAt: 1200,
          snapshot: {
            productId: "premium_monthly",
            state: "Active",
            expiresAt: 1500,
            willRenew: true,
          },
        }),
      ).resolves.toMatchObject({ status: "updated", emittedEvents: 1 });
      expect(typesAndUsers(db)).toEqual([["entitlement.revoked", "owner-1"]]);
      vi.setSystemTime(2100);
      await applyStoreResyncHandler(ctxOf(db), {
        ...expired,
        observedAt: 2100,
        snapshot: { ...expired.snapshot, expiresAt: 1500 },
      });
      expect(typesAndUsers(db)).toEqual([["entitlement.revoked", "owner-1"]]);
      expect(db.rows("outboundDeliveries")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("repairs an unchanged legacy sandbox row and its production stats", async () => {
    const db = new MemoryDb();
    const snapshot = {
      productId: "premium_monthly",
      state: "Active" as const,
      expiresAt: Date.now() + HOUR,
      willRenew: true,
    };
    const subscriptionId = await seed(db, snapshot);
    await db.insert("subscriptionStats", {
      projectId: "projects_1",
      currency: "",
      activeSubs: 1,
      inGracePeriod: 0,
      inBillingRetry: 0,
      mrrMicros: 0,
      updatedAt: 0,
    });

    await expect(
      applyStoreResyncHandler(ctxOf(db), {
        ...expired,
        observedAt: expired.observedAt + 1,
        snapshot,
        context: { ...expired.context, environment: "Sandbox" },
      }),
    ).resolves.toMatchObject({ status: "unchanged", emittedEvents: 0 });

    expect(await db.get(subscriptionId)).toMatchObject({
      environment: "Sandbox",
      resyncedAt: expired.observedAt + 1,
    });
    expect(db.rows("subscriptionStats")).toMatchObject([
      { activeSubs: 0, mrrMicros: 0 },
    ]);
    expect(db.rows("commerceEvents")).toHaveLength(0);
    expect(db.rows("webhookEvents")).toHaveLength(0);
  });

  it("never binds an unowned row or moves an owned one", async () => {
    const db = new MemoryDb();
    const subscriptionId = await seed(db, { userId: undefined });
    await applyStoreResyncHandler(ctxOf(db), expired);
    expect((await db.get(subscriptionId))?.userId).toBeUndefined();
    expect(db.rows("subscriptions")).toHaveLength(1);
    // No bound user, so the closed gate has nobody to tell.
    expect(db.rows("commerceEvents")).toHaveLength(0);
  });

  it.each(["IOS", "Android"] as const)(
    "preserves a newer verified %s snapshot over an earlier in-flight store read",
    async (platform) => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(3000);
        const db = new MemoryDb();
        seedProject(db, "admin");
        const { ctx } = schedulingCtx(db);
        await recordVerifiedSubscriptionHandler(ctx, {
          projectId: "projects_1" as never,
          platform,
          purchaseToken: TOKEN,
          productId: "premium_monthly",
          purchaseState: HarmonizedPurchaseState.ENTITLED,
          expiresAt: 10000,
          evidenceAt: 2500,
          ...(platform === "IOS"
            ? { verifiedPurchaseDate: 2500, verifiedSignedDate: 2500 }
            : { subscriptionState: "SUBSCRIPTION_STATE_ACTIVE" }),
        });
        vi.setSystemTime(4000);
        const args = {
          ...expired,
          platform,
          store: platform === "IOS" ? ("apple" as const) : ("google" as const),
          observedAt: 2000,
          snapshot: { ...expired.snapshot, expiresAt: 900 },
        };
        await expect(applyStoreResyncHandler(ctx, args)).resolves.toMatchObject(
          { status: "unchanged" },
        );
        expect(db.rows("subscriptions")[0]).toMatchObject({
          state: "Active",
          expiresAt: 10000,
          verifiedEvidenceAt: 2500,
        });
        expect(db.rows("webhookEvents")).toHaveLength(0);
        await expect(
          applyStoreResyncHandler(ctx, { ...args, observedAt: 4000 }),
        ).resolves.toMatchObject({ status: "updated", state: "Expired" });
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("reports the first bound entitlement on an agreeing read exactly once", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    const { ctx } = schedulingCtx(db);
    const now = Date.now();
    const expiresAt = now + DAY;
    await recordVerifiedSubscriptionHandler(ctx, {
      projectId: "projects_1" as never,
      platform: "IOS",
      purchaseToken: TOKEN,
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      expiresAt,
      willRenew: true,
      evidenceAt: now - 1,
    });
    const args = {
      ...expired,
      observedAt: now,
      snapshot: {
        productId: "premium_monthly",
        state: "Active" as const,
        expiresAt,
        willRenew: true,
      },
    };
    await expect(applyStoreResyncHandler(ctx, args)).resolves.toMatchObject({
      status: "unchanged",
      emittedEvents: 0,
    });
    await bindSubscriptionToUserHandler(ctx, {
      projectId: "projects_1" as never,
      purchaseToken: TOKEN,
      userId: "buyer",
    });
    await db.insert("outboundDestinations", {
      projectId: "projects_1",
      url: "https://hooks.example.com/iapkit",
      secret: "whsec_test",
      enabled: true,
      createdAt: 1,
      updatedAt: 1,
    });
    await expect(
      applyStoreResyncHandler(ctx, { ...args, observedAt: now + 1 }),
    ).resolves.toMatchObject({ status: "updated", emittedEvents: 1 });
    await expect(
      applyStoreResyncHandler(ctx, { ...args, observedAt: now + 2 }),
    ).resolves.toMatchObject({ status: "unchanged", emittedEvents: 0 });
    expect(typesAndUsers(db)).toEqual([["entitlement.granted", "buyer"]]);
    expect(db.rows("webhookEvents")).toHaveLength(1);
    expect(db.rows("outboundDeliveries")).toHaveLength(1);
  });

  it("orders overlapping Google verifies by their store observation time", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(3000);
      const db = new MemoryDb();
      seedProject(db, "admin");
      const { ctx } = schedulingCtx(db);
      const verify = (
        evidenceAt: number,
        expiresAt: number,
        purchaseState:
          | typeof HarmonizedPurchaseState.ENTITLED
          | typeof HarmonizedPurchaseState.EXPIRED,
      ) =>
        recordVerifiedSubscriptionHandler(ctx, {
          projectId: "projects_1" as never,
          platform: "Android",
          purchaseToken: TOKEN,
          productId: "premium_monthly",
          purchaseState,
          expiresAt,
          evidenceAt,
          subscriptionState:
            purchaseState === HarmonizedPurchaseState.ENTITLED
              ? "SUBSCRIPTION_STATE_ACTIVE"
              : "SUBSCRIPTION_STATE_EXPIRED",
        });
      await verify(2500, 10000, HarmonizedPurchaseState.ENTITLED);
      vi.setSystemTime(4000);
      await verify(1500, 900, HarmonizedPurchaseState.EXPIRED);
      await expect(
        applyStoreResyncHandler(ctx, {
          ...expired,
          platform: "Android",
          store: "google",
          observedAt: 2000,
        }),
      ).resolves.toMatchObject({ status: "unchanged" });
      expect(db.rows("subscriptions")[0]).toMatchObject({
        state: "Active",
        expiresAt: 10000,
        verifiedEvidenceAt: 2500,
      });
      vi.setSystemTime(5000);
      await verify(4500, 20000, HarmonizedPurchaseState.ENTITLED);
      expect(db.rows("subscriptions")[0]).toMatchObject({
        state: "Active",
        expiresAt: 20000,
        verifiedEvidenceAt: 4500,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves state alone when a newer store event or re-sync already applied", async () => {
    for (const newer of ["lastEventOccurredAt", "resyncedAt"]) {
      const db = new MemoryDb();
      const subscriptionId = await seed(db, {
        [newer]: expired.observedAt + 1,
      });
      await expect(
        applyStoreResyncHandler(ctxOf(db), expired),
      ).resolves.toMatchObject({ status: "unchanged" });
      expect((await db.get(subscriptionId))?.state).toBe("Active");
    }
  });

  it("keeps the re-synced state and drops an older event naming another state", async () => {
    const db = new MemoryDb();
    const subscriptionId = await seed(db);
    await applyStoreResyncHandler(ctxOf(db), expired);

    // DID_RENEW from before the re-sync, delivered after it: reporting it
    // would pair `subscription.renewed` with the Expired state.
    await applyStoreEvent(db, "late-did-renew", {
      type: "SubscriptionRenewed",
      expiresAt: expired.observedAt + HOUR,
      willRenew: true,
      occurredAt: expired.observedAt - 1_000,
    });

    expect(typesAndUsers(db)).toEqual([["entitlement.revoked", "owner-1"]]);
    expect(await db.get(subscriptionId)).toMatchObject({
      state: "Expired",
      expiresAt: 1_000,
      resyncedAt: expired.observedAt,
      lastEventOccurredAt: expired.observedAt - 1_000,
    });
  });

  it("reports an older event naming the re-synced state, with that state", async () => {
    const db = new MemoryDb();
    await seed(db);
    const renewedUntil = expired.observedAt + 30 * DAY;
    // The re-sync sees a renewal whose notification is still on its way.
    await applyStoreResyncHandler(ctxOf(db), {
      ...expired,
      snapshot: {
        productId: "premium_monthly",
        state: "Active",
        expiresAt: renewedUntil,
        willRenew: true,
      },
    });

    await applyStoreEvent(db, "late-did-renew", {
      type: "SubscriptionRenewed",
      transactionId: "2000000000000002",
      expiresAt: renewedUntil,
      willRenew: true,
      currency: "USD",
      priceAmountMicros: 9_990_000,
      amountProvenance: "store",
      occurredAt: expired.observedAt - 1_000,
    });

    expect(deliveredBodies(db)).toEqual([
      {
        eventId: expect.any(String),
        eventType: "subscription.renewed",
        eventVersion: "1.0",
        occurredAt: expired.observedAt - 1_000,
        processedAt: expect.any(Number),
        store: "apple",
        environment: "production",
        projectId: "projects_1",
        userId: "owner-1",
        productId: "premium_monthly",
        transactionId: "2000000000000002",
        originalTransactionId: TOKEN,
        subscription: {
          state: "Active",
          productId: "premium_monthly",
          expiresAt: renewedUntil,
          willRenew: true,
          active: true,
        },
        price: {
          currency: "USD",
          amountMicros: 9_990_000,
          provenance: "store",
        },
        sourceStoreEventId: "late-did-renew",
      },
    ]);
  });

  it("does not resurrect a replaced Google token", async () => {
    const db = new MemoryDb();
    await seed(db);
    await db.insert("subscriptionTokenAliases", {
      projectId: "projects_1",
      purchaseToken: "2000000000000001",
      successorPurchaseToken: "successor",
      createdAt: 1,
      updatedAt: 1,
    });
    await expect(applyStoreResyncHandler(ctxOf(db), expired)).resolves.toEqual({
      status: "superseded",
      emittedEvents: 0,
    });
  });
});

describe("the entitlement baseline after a re-sync", () => {
  // A verify-created row: nothing has been reported to anyone yet.
  async function verifiedRow(db: Db, active = false) {
    seedProject(db, "admin");
    await recordVerifiedSubscriptionHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      platform: "IOS",
      purchaseToken: TOKEN,
      productId: "premium_monthly",
      purchaseState: active
        ? HarmonizedPurchaseState.ENTITLED
        : HarmonizedPurchaseState.EXPIRED,
      expiresAt: Date.now() + (active ? DAY : -DAY),
      verifiedPurchaseDate: Date.now() - 31 * DAY,
      evidenceAt: Date.now() - 31 * DAY,
    });
  }
  const bind = (db: Db, userId: string) =>
    bindSubscriptionToUserHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      purchaseToken: TOKEN,
      userId,
    });
  const resyncActive = (db: Db) =>
    applyStoreResyncHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      platform: "IOS",
      store: "apple",
      purchaseToken: TOKEN,
      observedAt: Date.now(),
      snapshot: {
        productId: "premium_monthly",
        state: "Active",
        expiresAt: Date.now() + 30 * DAY,
        willRenew: true,
      },
      context: { environment: "Production" },
    });
  const renew = (db: Db) =>
    applyStoreEvent(db, "did-renew", {
      type: "SubscriptionRenewed",
      expiresAt: Date.now() + 60 * DAY,
      willRenew: true,
      occurredAt: Date.now() + 1_000,
    });

  it("is the grant a re-sync sent, so the next store event does not repeat it", async () => {
    // A verify that called the row active still told nobody.
    for (const verifiedActive of [false, true]) {
      const db = new MemoryDb();
      await verifiedRow(db, verifiedActive);
      await bind(db, "owner-1");
      await resyncActive(db);
      expect(typesAndUsers(db)).toEqual([["entitlement.granted", "owner-1"]]);

      await renew(db);
      expect(typesAndUsers(db)).toEqual([
        ["entitlement.granted", "owner-1"],
        ["subscription.renewed", "owner-1"],
      ]);
    }
  });

  it("is what the re-sync told, though a newer verify moved the row since", async () => {
    // A transaction bought or refunded after the store was read.
    const verifyNewer = (db: Db, purchaseState: string) =>
      recordVerifiedSubscriptionHandler(ctxOf(db), {
        projectId: "projects_1" as never,
        platform: "IOS",
        purchaseToken: TOKEN,
        productId: "premium_monthly",
        purchaseState,
        revocationReasonIOS: 1,
        expiresAt: Date.now() + 30 * DAY,
        verifiedPurchaseDate: Date.now() + 1_000,
        evidenceAt: Date.now() + 1_000,
      });

    // Told nothing was granted, then a newer purchase: the renewal grants.
    const renewed = new MemoryDb();
    await verifiedRow(renewed);
    await bind(renewed, "owner-1");
    await applyStoreResyncHandler(ctxOf(renewed), {
      projectId: "projects_1" as never,
      platform: "IOS",
      store: "apple",
      purchaseToken: TOKEN,
      observedAt: Date.now(),
      snapshot: {
        productId: "premium_monthly",
        state: "Expired",
        expiresAt: Date.now() - DAY,
        willRenew: false,
      },
      context: { environment: "Production" },
    });
    await verifyNewer(renewed, HarmonizedPurchaseState.ENTITLED);
    await renew(renewed);
    expect(typesAndUsers(renewed)).toEqual([
      ["subscription.renewed", "owner-1"],
      ["entitlement.granted", "owner-1"],
    ]);

    // Told it was granted, then refunded: the store's refund revokes.
    const refunded = new MemoryDb();
    await verifiedRow(refunded);
    await bind(refunded, "owner-1");
    await resyncActive(refunded);
    await verifyNewer(refunded, HarmonizedPurchaseState.CANCELED);
    await applyStoreEvent(refunded, "refund", {
      type: "PurchaseRefunded",
      occurredAt: Date.now() + 2_000,
    });
    expect(typesAndUsers(refunded)).toEqual([
      ["entitlement.granted", "owner-1"],
      ["subscription.refunded", "owner-1"],
      ["entitlement.revoked", "owner-1"],
    ]);
  });

  it("is still closed when the owner binds after the re-sync", async () => {
    const db = new MemoryDb();
    await verifiedRow(db);
    await resyncActive(db);
    await bind(db, "owner-1");
    expect(typesAndUsers(db)).toEqual([]);

    await renew(db);
    expect(typesAndUsers(db)).toEqual([
      ["subscription.renewed", "owner-1"],
      ["entitlement.granted", "owner-1"],
    ]);
  });

  it("owes the previous owner a revoke when a verify ended access silently", async () => {
    const db = new MemoryDb();
    await verifiedRow(db);
    await bind(db, "owner-1");
    await resyncActive(db);
    // A refund bought after the read moves the row without telling anyone.
    await recordVerifiedSubscriptionHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      platform: "IOS",
      purchaseToken: TOKEN,
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.CANCELED,
      revocationReasonIOS: 1,
      expiresAt: Date.now() + 30 * DAY,
      verifiedPurchaseDate: Date.now() + 1_000,
      evidenceAt: Date.now() + 1_000,
    });

    // No store event to attribute the revoke to, so the operator is told.
    await expect(
      rebindSubscriptionToUserHandler(ctxOf(db), {
        projectId: "projects_1" as never,
        purchaseToken: TOKEN,
        userId: "owner-2",
      }),
    ).resolves.toMatchObject({ notified: false });
  });

  it("is closed again for an owner the row moved to", async () => {
    for (const move of ["rebind", "erase and bind"] as const) {
      const db = new MemoryDb();
      await verifiedRow(db);
      await bind(db, "owner-1");
      await resyncActive(db);
      if (move === "rebind") {
        await rebindSubscriptionToUserHandler(ctxOf(db), {
          projectId: "projects_1" as never,
          purchaseToken: TOKEN,
          userId: "owner-2",
        });
      } else {
        const jobId = await db.insert("subscriptionUserErasureJobs", {
          projectId: "projects_1",
          userId: "owner-1",
          userIdHash: "digest",
          status: "queued",
          subscriptionsErased: 0,
          commerceEventsErased: 0,
          createdAt: 1,
          updatedAt: 1,
        });
        await drainSubscriptionUserErasurePage(
          { db, scheduler: { runAfter: vi.fn() } } as never,
          jobId as never,
        );
        await bind(db, "owner-2");
      }

      await renew(db);
      expect(typesAndUsers(db).slice(-2), move).toEqual([
        ["subscription.renewed", "owner-2"],
        ["entitlement.granted", "owner-2"],
      ]);
    }
  });
});

describe("a verify after a re-sync", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const appleResync = (
    observedAt: number,
    snapshot: {
      state:
        | "Active"
        | "Revoked"
        | "Refunded"
        | "InBillingRetry"
        | "InGracePeriod";
      expiresAt: number;
      cancellationReason?: "Refunded";
    },
  ) => ({
    projectId: "projects_1" as never,
    platform: "IOS" as const,
    store: "apple" as const,
    purchaseToken: "2000000000000001",
    observedAt,
    snapshot: { productId: "premium_monthly", ...snapshot },
    context: { environment: "Production" as const },
  });

  it("cannot roll Apple back with a re-signed older transaction, but newer evidence applies", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    const { ctx, runAfter } = schedulingCtx(db);
    const now = Date.now();
    const first = {
      projectId: "projects_1" as never,
      platform: "IOS" as const,
      purchaseToken: "2000000000000001",
      productId: "premium_monthly",
      verifiedPurchaseDate: now - 60 * DAY,
      evidenceAt: now - 60 * DAY,
    };
    // A verify-only row from the first period.
    await recordVerifiedSubscriptionHandler(ctx, {
      ...first,
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      expiresAt: now - 30 * DAY,
      verifiedSignedDate: now - 60 * DAY,
    });
    // The re-sync sees the renewal the server never verified.
    await applyStoreResyncHandler(
      ctx,
      appleResync(now, { state: "Active", expiresAt: now + 30 * DAY }),
    );

    // The first transaction replayed: Apple re-signs it now, still expired.
    // It disagrees, so the store is asked again; its answer holds the renewal.
    await recordVerifiedSubscriptionHandler(ctx, {
      ...first,
      purchaseState: HarmonizedPurchaseState.EXPIRED,
      expiresAt: now - 30 * DAY,
      verifiedSignedDate: now + 1_000,
    });
    expect(scheduledNames(runAfter)).toEqual([
      "subscriptions/action:resyncDisputedSubscription",
    ]);
    await applyStoreResyncHandler(
      ctx,
      appleResync(now + 2_000, { state: "Active", expiresAt: now + 30 * DAY }),
    );
    expect(db.rows("subscriptions")).toMatchObject([
      { state: "Active", expiresAt: now + 30 * DAY },
    ]);

    // A renewal bought after the re-sync is newer evidence.
    await recordVerifiedSubscriptionHandler(ctx, {
      ...first,
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      expiresAt: now + 60 * DAY,
      verifiedPurchaseDate: now + DAY,
      verifiedSignedDate: now + DAY,
      evidenceAt: now + DAY,
    });
    expect(db.rows("subscriptions")).toMatchObject([
      { state: "Active", expiresAt: now + 60 * DAY },
    ]);
    expect(scheduledNames(runAfter)).toHaveLength(1);
  });

  it("re-reads the store for an Apple refund reversal instead of dropping it", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    const { ctx, runAfter } = schedulingCtx(db);
    const now = Date.now();
    const transaction = {
      projectId: "projects_1" as never,
      platform: "IOS" as const,
      purchaseToken: "2000000000000001",
      productId: "premium_monthly",
      expiresAt: now + 20 * DAY,
      verifiedPurchaseDate: now - 10 * DAY,
      evidenceAt: now - 10 * DAY,
    };
    await recordVerifiedSubscriptionHandler(ctx, {
      ...transaction,
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      verifiedSignedDate: now - 10 * DAY,
    });
    // The refund, seen by a re-sync.
    await applyStoreResyncHandler(
      ctx,
      appleResync(now, {
        state: "Revoked",
        expiresAt: now + 20 * DAY,
        cancellationReason: "Refunded",
      }),
    );
    const [row] = db.rows("subscriptions");

    // Apple reverses it: the same transaction without its revocation date
    // reports nothing newer than the re-sync, so it is not applied blind.
    await recordVerifiedSubscriptionHandler(ctx, {
      ...transaction,
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      verifiedSignedDate: now + HOUR,
    });
    expect(db.rows("subscriptions")).toMatchObject([{ state: "Revoked" }]);
    expect(
      runAfter.mock.calls.filter(
        ([, reference]) =>
          getFunctionName(reference) ===
          "subscriptions/action:resyncDisputedSubscription",
      ),
    ).toEqual([
      [
        0,
        expect.anything(),
        { projectId: "projects_1", subscriptionId: row._id },
      ],
    ]);

    // The scheduled re-read finds it active again.
    await applyStoreResyncHandler(
      ctx,
      appleResync(now + HOUR, { state: "Active", expiresAt: now + 20 * DAY }),
    );
    expect(db.rows("subscriptions")).toMatchObject([{ state: "Active" }]);
  });

  // The app's latest transaction: its period ended, so Apple calls it expired.
  const latestTransaction = (now: number) => ({
    projectId: "projects_1" as never,
    platform: "IOS" as const,
    purchaseToken: TOKEN,
    productId: "premium_monthly",
    expiresAt: now - HOUR,
    verifiedPurchaseDate: now - 30 * DAY,
    evidenceAt: now - 30 * DAY,
  });

  it("takes an Expired transaction as agreeing with billing retry and grace, and a revoked one with a refund", async () => {
    for (const [state, verified] of [
      ["InBillingRetry", HarmonizedPurchaseState.EXPIRED],
      ["InGracePeriod", HarmonizedPurchaseState.EXPIRED],
      ["Refunded", HarmonizedPurchaseState.CANCELED],
    ] as const) {
      const db = new MemoryDb();
      seedProject(db, "admin");
      const { ctx, runAfter } = schedulingCtx(db);
      const now = Date.now();
      await recordVerifiedSubscriptionHandler(ctx, {
        ...latestTransaction(now),
        purchaseState: HarmonizedPurchaseState.ENTITLED,
        verifiedSignedDate: now - 30 * DAY,
      });
      await applyStoreResyncHandler(
        ctx,
        appleResync(now, { state, expiresAt: now + DAY }),
      );

      for (const signedAt of [1, 2, 3]) {
        await recordVerifiedSubscriptionHandler(ctx, {
          ...latestTransaction(now),
          purchaseState: verified,
          verifiedSignedDate: now + signedAt,
        });
      }
      expect(runAfter, state).not.toHaveBeenCalled();
      expect(db.rows("subscriptions")).toMatchObject([{ state }]);
    }
  });

  it("re-reads the store for a real dispute at most once an hour", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const db = new MemoryDb();
    seedProject(db, "admin");
    const { ctx, runAfter } = schedulingCtx(db);
    const now = Date.now();
    await recordVerifiedSubscriptionHandler(ctx, {
      ...latestTransaction(now),
      purchaseState: HarmonizedPurchaseState.EXPIRED,
      verifiedSignedDate: now - 30 * DAY,
    });
    // The re-sync sees a renewal the app has not verified.
    await applyStoreResyncHandler(
      ctx,
      appleResync(now, { state: "Active", expiresAt: now + 30 * DAY }),
    );
    const replay = () =>
      recordVerifiedSubscriptionHandler(ctx, {
        ...latestTransaction(now),
        purchaseState: HarmonizedPurchaseState.EXPIRED,
        verifiedSignedDate: Date.now(),
      });

    await replay();
    await replay();
    await replay();
    expect(scheduledNames(runAfter)).toEqual([
      "subscriptions/action:resyncDisputedSubscription",
    ]);
    expect(db.rows("subscriptions")).toMatchObject([
      { state: "Active", resyncDisputedAt: now },
    ]);

    vi.setSystemTime(now + RESYNC_DISPUTE_COOLDOWN_MS - 1);
    await replay();
    expect(scheduledNames(runAfter)).toHaveLength(1);
    vi.setSystemTime(now + RESYNC_DISPUTE_COOLDOWN_MS);
    await replay();
    expect(scheduledNames(runAfter)).toHaveLength(2);
  });

  it("applies a Google read made after the re-sync, never one made before it", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    const { ctx, runAfter } = schedulingCtx(db);
    const now = Date.now();
    const verify = (readAt: number, expiresAt: number) =>
      recordVerifiedSubscriptionHandler(ctx, {
        projectId: "projects_1" as never,
        platform: "Android",
        purchaseToken: "google-token",
        productId: "premium_monthly",
        purchaseState: HarmonizedPurchaseState.ENTITLED,
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        expiresAt,
        evidenceAt: readAt,
      });
    await verify(now - DAY, now + DAY);
    await applyStoreResyncHandler(ctx, {
      projectId: "projects_1" as never,
      platform: "Android",
      store: "google",
      purchaseToken: "google-token",
      observedAt: now,
      snapshot: {
        productId: "premium_monthly",
        state: "Expired",
        expiresAt: now - HOUR,
        willRenew: false,
      },
      context: { environment: "Production" },
    });

    // Read before the re-sync but committed after it: the store is asked again.
    await verify(now - 1, now + DAY);
    expect(db.rows("subscriptions")).toMatchObject([{ state: "Expired" }]);
    expect(scheduledNames(runAfter)).toHaveLength(1);

    await verify(now + 1, now + 30 * DAY);
    expect(db.rows("subscriptions")).toMatchObject([
      { state: "Active", expiresAt: now + 30 * DAY },
    ]);
  });
});

describe("re-sync targets", () => {
  it("re-reads Apple in the subscription's stored environment", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    const subscriptionId = await db.insert("subscriptions", {
      projectId: "projects_1",
      purchaseToken: "2000000000000001",
      productId: "premium_monthly",
      platform: "IOS",
      store: "apple",
      state: "Active",
      environment: "Sandbox",
      startedAt: 1,
      updatedAt: 1,
    });
    await expect(
      testableFunction(getResyncTarget)._handler(ctxOf(db), {
        projectId: "projects_1" as never,
        subscriptionId,
      }),
    ).resolves.toMatchObject({ kind: "subscription", environment: "Sandbox" });
  });

  it("keeps a purchase verdict saved while the store was being read", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    const now = Date.now();
    const purchaseId = await db.insert("purchases", {
      projectId: "projects_1",
      store: "google",
      applicationId: "dev.example",
      remoteId: "play-token",
      requestData: { store: "google", purchaseToken: "play-token" },
      remoteResponse: "{}",
      state: "ENTITLED",
      isValid: true,
      updatedAt: now + 1,
    });
    const resync = (observedAt: number) =>
      applyPurchaseResyncHandler(ctxOf(db), {
        projectId: "projects_1" as never,
        purchaseId: purchaseId as never,
        observedAt,
        applicationId: "dev.example",
        remoteResponse: JSON.stringify({ purchaseStateContext: {} }),
        state: HarmonizedPurchaseState.CANCELED,
        isValid: false,
      });

    // A verify landed after the store read began: the older read loses.
    await expect(resync(now)).resolves.toEqual({
      id: purchaseId,
      state: "ENTITLED",
      isValid: true,
      changed: false,
    });
    expect(db.rows("purchases")).toMatchObject([{ state: "ENTITLED" }]);

    await expect(resync(now + 2)).resolves.toEqual({
      id: purchaseId,
      state: "CANCELED",
      isValid: false,
      changed: true,
    });
    expect(db.rows("purchases")).toMatchObject([
      { state: "CANCELED", isValid: false },
    ]);
  });
});

describe("re-sync access", () => {
  it("lets members read but not write", async () => {
    const db = new MemoryDb();
    seedProject(db, "member");
    const args = { projectId: "projects_1" as never };
    await expect(
      resolveOperatorProject(ctxOf(db), args, "read"),
    ).resolves.toMatchObject({ _id: "projects_1" });
    await expect(
      resolveOperatorProject(ctxOf(db), args, "write"),
    ).rejects.toMatchObject({ data: { code: "INSUFFICIENT_PERMISSIONS" } });
  });

  it("rejects a publishable key for operations", async () => {
    const db = new MemoryDb();
    seedProject(db, "owner");
    const { sha256Hex } = await import("../utils/sha256");
    db.rows("apiKeys").push({
      _id: "apiKeys_1",
      _creationTime: 0,
      projectId: "projects_1",
      organizationId: "organizations_1",
      keyHash: await sha256Hex("openiap-kit_pk_mobile"),
      keyType: "publishable",
      isActive: true,
    });
    await expect(
      resolveOperatorProject(
        ctxOf(db),
        { apiKey: "openiap-kit_pk_mobile" },
        "read",
      ),
    ).rejects.toMatchObject({ data: { code: "INSUFFICIENT_SCOPE" } });
  });
});
