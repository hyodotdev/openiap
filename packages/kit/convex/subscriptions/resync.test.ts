import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { userId: "users_1" as string | null };
vi.mock(import("@convex-dev/auth/server"), async (importOriginal) => ({
  ...(await importOriginal()),
  getAuthUserId: async () => auth.userId as never,
}));

const { FakeDb, seedProject } = await import("../test.fakeDb");
const { appleStatusSnapshot, applyStoreResyncHandler } =
  await import("./resync");
const { resolveOperatorProject } = await import("../projects/helpers");

type Db = InstanceType<typeof FakeDb>;
const ctxOf = (db: Db) => ({ db }) as never;
const HOUR = 60 * 60 * 1000;

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
    ).toMatchObject({ state: "Revoked", cancellationReason: "Refunded" });
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
    const db = new FakeDb();
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
    const db = new FakeDb();
    await seed(db);
    await applyStoreResyncHandler(ctxOf(db), expired);
    const second = await applyStoreResyncHandler(ctxOf(db), {
      ...expired,
      observedAt: expired.observedAt + 1,
    });
    expect(second).toMatchObject({ status: "unchanged", emittedEvents: 0 });
    expect(db.rows("commerceEvents")).toHaveLength(1);
    expect(db.rows("webhookEvents")).toHaveLength(1);
  });

  it("never binds an unowned row or moves an owned one", async () => {
    const db = new FakeDb();
    const subscriptionId = await seed(db, { userId: undefined });
    await applyStoreResyncHandler(ctxOf(db), expired);
    expect((await db.get(subscriptionId))?.userId).toBeUndefined();
    expect(db.rows("subscriptions")).toHaveLength(1);
    // No bound user, so the closed gate has nobody to tell.
    expect(db.rows("commerceEvents")).toHaveLength(0);
  });

  it("leaves state alone when a newer store event already applied", async () => {
    const db = new FakeDb();
    const subscriptionId = await seed(db, {
      lastEventOccurredAt: expired.observedAt + 1,
    });
    await expect(
      applyStoreResyncHandler(ctxOf(db), expired),
    ).resolves.toMatchObject({ status: "unchanged" });
    expect((await db.get(subscriptionId))?.state).toBe("Active");
  });

  it("does not resurrect a replaced Google token", async () => {
    const db = new FakeDb();
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

describe("re-sync access", () => {
  it("lets members read but not write", async () => {
    const db = new FakeDb();
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
    const db = new FakeDb();
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
