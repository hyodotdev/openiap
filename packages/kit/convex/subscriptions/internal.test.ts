import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HarmonizedPurchaseState } from "../purchases/purchaseState";
import {
  buildVerifiedSubscriptionSnapshot,
  mergeVerifiedSubscriptionSnapshot,
  recordVerifiedSubscriptionHandler,
} from "./internal";

type Row = Record<string, unknown> & { _id: string; _creationTime: number };

class MemQuery {
  constructor(private rows: Row[]) {}

  withIndex(_name: string, cb?: (q: IndexBuilder) => IndexBuilder): MemQuery {
    if (!cb) return this;
    const builder = new IndexBuilder();
    cb(builder);
    return new MemQuery(
      this.rows.filter((row) =>
        builder.predicates.every((predicate) => predicate(row)),
      ),
    );
  }

  async unique(): Promise<Row | null> {
    if (this.rows.length > 1) {
      throw new Error("unique() called on a query that returned > 1 row");
    }
    return this.rows[0] ?? null;
  }
}

class IndexBuilder {
  predicates: Array<(row: Row) => boolean> = [];

  eq(field: string, value: unknown): IndexBuilder {
    this.predicates.push((row) => row[field] === value);
    return this;
  }
}

class MemDb {
  tables = new Map<string, Map<string, Row>>();
  private counter = 0;

  private table(name: string): Map<string, Row> {
    let table = this.tables.get(name);
    if (!table) {
      table = new Map();
      this.tables.set(name, table);
    }
    return table;
  }

  query(tableName: string): MemQuery {
    return new MemQuery([...this.table(tableName).values()]);
  }

  async insert(
    tableName: string,
    doc: Record<string, unknown>,
  ): Promise<string> {
    const id = `${tableName}_${++this.counter}`;
    this.table(tableName).set(id, {
      ...doc,
      _id: id,
      _creationTime: Date.now(),
    });
    return id;
  }

  async get(id: string): Promise<Row | null> {
    for (const table of this.tables.values()) {
      const row = table.get(id);
      if (row) return row;
    }
    return null;
  }

  async patch(id: string, patch: Record<string, unknown>): Promise<void> {
    for (const table of this.tables.values()) {
      const row = table.get(id);
      if (row) {
        Object.assign(row, patch);
        return;
      }
    }
    throw new Error(`patch: no doc with id ${id}`);
  }

  rows(tableName: string): Row[] {
    return [...this.table(tableName).values()];
  }

  seedProduct(doc: {
    projectId: string;
    platform: "IOS" | "Android";
    productId: string;
    billingPeriod?: string;
  }): void {
    this.table("products").set(`products_${++this.counter}`, {
      _id: `products_${this.counter}`,
      _creationTime: Date.now(),
      ...doc,
    });
  }
}

function makeCtx(db: MemDb) {
  return { db } as unknown as Parameters<
    typeof recordVerifiedSubscriptionHandler
  >[0];
}

const PROJECT_ID = "projects_seed_1";
const TOKEN = "purchase_token_1";

describe("buildVerifiedSubscriptionSnapshot", () => {
  it("bootstraps an active subscription from an entitled Google verification", () => {
    const snapshot = buildVerifiedSubscriptionSnapshot({
      platform: "Android",
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      expiresAt: 2_000_000_000_000,
    });

    expect(snapshot).toEqual({
      productId: "premium_monthly",
      state: "Active",
      expiresAt: 2_000_000_000_000,
      renewsAt: undefined,
      willRenew: true,
      cancellationReason: undefined,
      clearCancellationReason: true,
      currency: undefined,
      priceAmountMicros: undefined,
    });
  });

  it("treats pending-acknowledgment subscriptions as entitled while still bindable", () => {
    const snapshot = buildVerifiedSubscriptionSnapshot({
      platform: "Android",
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT,
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    });

    expect(snapshot).toMatchObject({
      productId: "premium_monthly",
      state: "Active",
      willRenew: true,
      clearCancellationReason: true,
    });
  });

  it("preserves access for canceled Google subscriptions until expiry", () => {
    const snapshot = buildVerifiedSubscriptionSnapshot({
      platform: "Android",
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.CANCELED,
      subscriptionState: "SUBSCRIPTION_STATE_CANCELED",
      expiresAt: 2_000_000_000_000,
    });

    expect(snapshot).toMatchObject({
      productId: "premium_monthly",
      state: "Active",
      willRenew: false,
      cancellationReason: "UserCanceled",
      expiresAt: 2_000_000_000_000,
    });
  });

  it("maps on-hold Google subscriptions to billing retry", () => {
    const snapshot = buildVerifiedSubscriptionSnapshot({
      platform: "Android",
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.PENDING,
      subscriptionState: "SUBSCRIPTION_STATE_ON_HOLD",
    });

    expect(snapshot).toMatchObject({
      productId: "premium_monthly",
      state: "InBillingRetry",
      cancellationReason: "BillingError",
    });
  });

  it("does not infer renewal status when Google omits subscriptionState", () => {
    const snapshot = buildVerifiedSubscriptionSnapshot({
      platform: "Android",
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT,
    });

    expect(snapshot).toMatchObject({
      productId: "premium_monthly",
      state: "Active",
    });
    expect(snapshot?.willRenew).toBeUndefined();
    expect(snapshot?.cancellationReason).toBeUndefined();
    expect(snapshot?.clearCancellationReason).toBeUndefined();
  });

  it("does not create a subscription row for expected-product mismatches", () => {
    const snapshot = buildVerifiedSubscriptionSnapshot({
      platform: "Android",
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.INAUTHENTIC,
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    });

    expect(snapshot).toBeNull();
  });

  it("does not create a subscription row when Google omits the product id", () => {
    const snapshot = buildVerifiedSubscriptionSnapshot({
      platform: "Android",
      productId: "unknown",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    });

    expect(snapshot).toBeNull();
  });

  it("bootstraps an Apple subscription without guessing auto-renew status", () => {
    const snapshot = buildVerifiedSubscriptionSnapshot({
      platform: "IOS",
      productId: "com.example.premium",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      expiresAt: 2_000_000_000_000,
      currency: "USD",
      priceAmountMicros: 9_990_000,
    });

    expect(snapshot).toEqual({
      productId: "com.example.premium",
      state: "Active",
      expiresAt: 2_000_000_000_000,
      renewsAt: undefined,
      cancellationReason: undefined,
      currency: "USD",
      priceAmountMicros: 9_990_000,
    });
  });
});

describe("mergeVerifiedSubscriptionSnapshot", () => {
  it("preserves existing timing and price fields when verify omits them", () => {
    const snapshot = mergeVerifiedSubscriptionSnapshot(
      {
        expiresAt: 2_000_000_000_000,
        renewsAt: 2_000_000_000_000,
        willRenew: true,
        cancellationReason: undefined,
        currency: "USD",
        priceAmountMicros: 9_990_000,
      },
      {
        productId: "premium_monthly",
        state: "Active",
        willRenew: true,
      },
    );

    expect(snapshot).toEqual({
      productId: "premium_monthly",
      state: "Active",
      expiresAt: 2_000_000_000_000,
      renewsAt: 2_000_000_000_000,
      willRenew: true,
      cancellationReason: undefined,
      currency: "USD",
      priceAmountMicros: 9_990_000,
    });
  });

  it("clears stale cancellation reason when verify confirms active state", () => {
    const snapshot = mergeVerifiedSubscriptionSnapshot(
      {
        expiresAt: undefined,
        renewsAt: undefined,
        willRenew: false,
        cancellationReason: "UserCanceled",
        currency: undefined,
        priceAmountMicros: undefined,
      },
      {
        productId: "premium_monthly",
        state: "Active",
        willRenew: true,
        cancellationReason: undefined,
        clearCancellationReason: true,
      },
    );

    expect(snapshot.cancellationReason).toBeUndefined();
    expect(snapshot.willRenew).toBe(true);
  });

  it("preserves cancellation reason when verify cannot prove auto-renew is enabled", () => {
    const snapshot = mergeVerifiedSubscriptionSnapshot(
      {
        expiresAt: undefined,
        renewsAt: undefined,
        willRenew: false,
        cancellationReason: "UserCanceled",
        currency: undefined,
        priceAmountMicros: undefined,
      },
      {
        productId: "premium_monthly",
        state: "Active",
      },
    );

    expect(snapshot.cancellationReason).toBe("UserCanceled");
    expect(snapshot.willRenew).toBe(false);
  });
});

describe("recordVerifiedSubscriptionHandler", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a bindable subscription row from Google receipt verification", async () => {
    const db = new MemDb();
    db.seedProduct({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium_monthly",
      billingPeriod: "P1M",
    });

    const subscriptionId = await recordVerifiedSubscriptionHandler(
      makeCtx(db),
      {
        projectId: PROJECT_ID as never,
        platform: "Android",
        purchaseToken: TOKEN,
        productId: "premium_monthly",
        purchaseState: HarmonizedPurchaseState.ENTITLED,
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        expiresAt: 1_769_904_000_000,
        renewsAt: 1_769_904_000_000,
        currency: "USD",
        priceAmountMicros: 9_990_000,
      },
    );

    expect(subscriptionId).toBe("subscriptions_2");
    expect(db.rows("subscriptions")).toMatchObject([
      {
        _id: "subscriptions_2",
        projectId: PROJECT_ID,
        purchaseToken: TOKEN,
        productId: "premium_monthly",
        platform: "Android",
        state: "Active",
        willRenew: true,
        currency: "USD",
        priceAmountMicros: 9_990_000,
      },
    ]);
    expect(db.rows("subscriptionStats")).toMatchObject([
      {
        projectId: PROJECT_ID,
        currency: "USD",
        activeSubs: 1,
        inGracePeriod: 0,
        inBillingRetry: 0,
        mrrMicros: 9_990_000,
      },
    ]);
  });

  it("creates an active bindable row for pending-acknowledgment Google subscriptions", async () => {
    const db = new MemDb();
    db.seedProduct({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium_monthly",
      billingPeriod: "P1M",
    });

    await recordVerifiedSubscriptionHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      platform: "Android",
      purchaseToken: TOKEN,
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT,
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      expiresAt: 1_769_904_000_000,
      currency: "USD",
      priceAmountMicros: 9_990_000,
    });

    expect(db.rows("subscriptions")).toMatchObject([
      {
        purchaseToken: TOKEN,
        productId: "premium_monthly",
        platform: "Android",
        state: "Active",
        willRenew: true,
      },
    ]);
    expect(db.rows("subscriptionStats")).toMatchObject([
      {
        activeSubs: 1,
        mrrMicros: 9_990_000,
      },
    ]);
  });

  it("keeps repeated verification idempotent for subscription stats", async () => {
    const db = new MemDb();
    db.seedProduct({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium_monthly",
      billingPeriod: "P1M",
    });
    const args = {
      projectId: PROJECT_ID as never,
      platform: "Android" as const,
      purchaseToken: TOKEN,
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      expiresAt: 1_769_904_000_000,
      currency: "USD",
      priceAmountMicros: 9_990_000,
    };

    await recordVerifiedSubscriptionHandler(makeCtx(db), args);
    await recordVerifiedSubscriptionHandler(makeCtx(db), args);

    expect(db.rows("subscriptions")).toHaveLength(1);
    expect(db.rows("subscriptionStats")).toMatchObject([
      {
        activeSubs: 1,
        mrrMicros: 9_990_000,
      },
    ]);
  });

  it("creates a bindable Apple subscription row from receipt verification", async () => {
    const db = new MemDb();
    db.seedProduct({
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "com.example.premium",
      billingPeriod: "P1M",
    });

    const subscriptionId = await recordVerifiedSubscriptionHandler(
      makeCtx(db),
      {
        projectId: PROJECT_ID as never,
        platform: "IOS",
        purchaseToken: "original_transaction_1",
        productId: "com.example.premium",
        purchaseState: HarmonizedPurchaseState.ENTITLED,
        expiresAt: 1_769_904_000_000,
        currency: "USD",
        priceAmountMicros: 9_990_000,
      },
    );

    expect(subscriptionId).toBe("subscriptions_2");
    expect(db.rows("subscriptions")).toMatchObject([
      {
        _id: "subscriptions_2",
        projectId: PROJECT_ID,
        purchaseToken: "original_transaction_1",
        productId: "com.example.premium",
        platform: "IOS",
        state: "Active",
        willRenew: undefined,
      },
    ]);
    expect(db.rows("subscriptionStats")).toMatchObject([
      {
        projectId: PROJECT_ID,
        currency: "USD",
        activeSubs: 1,
        mrrMicros: 9_990_000,
      },
    ]);
  });
});
