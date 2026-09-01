import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HarmonizedPurchaseState } from "../purchases/purchaseState";
import {
  applySubscriptionEventHandler,
  bindSubscriptionToUserHandler,
  rebindSubscriptionToUserHandler,
  buildVerifiedSubscriptionSnapshot,
  getCurrentProductIdByTokenHandler,
  getSourceProductIdByTokenHandler,
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

  async collect(): Promise<Row[]> {
    return [...this.rows];
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

  constructor() {
    this.table("organizations").set("organizations_seed_1", {
      _id: "organizations_seed_1",
      _creationTime: Date.now(),
    });
    this.table("projects").set("projects_seed_1", {
      _id: "projects_seed_1",
      _creationTime: Date.now(),
      organizationId: "organizations_seed_1",
    });
  }

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
      _creationTime: Date.now() + this.counter / 1_000,
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

  async delete(id: string): Promise<void> {
    for (const table of this.tables.values()) {
      if (table.delete(id)) return;
    }
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

async function seedWebhookEvent(
  db: MemDb,
  args: {
    type:
      | "SubscriptionStarted"
      | "SubscriptionRenewed"
      | "SubscriptionExpired"
      | "SubscriptionProductChanged";
    notificationId: string;
    occurredAt: number;
    platform?: "IOS" | "Android";
    productId?: string;
  },
): Promise<string> {
  const platform = args.platform ?? "Android";
  return await db.insert("webhookEvents", {
    projectId: PROJECT_ID,
    type: args.type,
    source:
      platform === "IOS"
        ? "AppleAppStoreServerNotificationsV2"
        : "GooglePlayRealTimeDeveloperNotifications",
    platform,
    environment: "Sandbox",
    purchaseToken: TOKEN,
    sourceNotificationId: args.notificationId,
    productId: args.productId ?? "premium_monthly",
    subscriptionState:
      args.type === "SubscriptionExpired" ? "Expired" : "Active",
    expiresAt: 1_800_000_000_000,
    renewsAt: 1_800_000_000_000,
    currency: "USD",
    priceAmountMicros: 9_990_000,
    occurredAt: args.occurredAt,
    receivedAt: args.occurredAt,
  });
}

describe("bindSubscriptionToUser amount handling", () => {
  it("does not repeat an amount the webhook already reported", async () => {
    const db = new MemDb();
    db.seedProduct({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium_monthly",
      billingPeriod: "P1M",
    });
    const eventId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "message-webhook-first",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: eventId as never,
    });
    const afterWebhook = db
      .rows("commerceEvents")
      .filter((row) => row.amountMicros !== undefined).length;

    await bindSubscriptionToUserHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      purchaseToken: TOKEN,
      userId: "user_1",
    });

    const priced = db
      .rows("commerceEvents")
      .filter((row) => row.amountMicros !== undefined);
    // The bind grant correlates an existing purchase to a user; it is not a
    // second billing, so the count must not move.
    expect(priced.length).toBe(afterWebhook);
    expect(db.rows("commerceEvents").at(-1)?.eventType).toBe(
      "entitlement.granted",
    );
    expect(db.rows("commerceEvents").at(-1)?.amountMicros).toBeUndefined();
  });
});

describe("applySubscriptionEventHandler", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Commerce Protocol's `whenNoPriorStoreEvent` turns on store history, not on
  // whether a record exists — a purchase learned from a client receipt but
  // never from the store still begins the story. That distinction lives here,
  // in the override, and nowhere in the state machine, so it is tested here.
  it("starts rather than recovers when a record exists with no store history", async () => {
    const db = new MemDb();
    db.seedProduct({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium_monthly",
      billingPeriod: "P1M",
    });
    // A client receipt created this row; no store notification ever touched it,
    // so it carries no lastEventId.
    await db.insert("subscriptions", {
      projectId: PROJECT_ID,
      platform: "Android",
      purchaseToken: TOKEN,
      productId: "premium_monthly",
      state: "Unknown",
      willRenew: true,
      updatedAt: 0,
    });
    const eventId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "message-first-store-event",
      occurredAt: 1_000,
    });

    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: eventId as never,
    });
    // Assert on what was emitted, not what the handler returned: the override
    // applies to the commerce event, while the return value carries the state
    // machine's own transition.
    expect(db.rows("commerceEvents").map((row) => row.eventType)).toContain(
      "subscription.started",
    );
  });

  it.each([["SubscriptionPriceChange"], ["SubscriptionDeferred"]])(
    "emits no commerce event when %s is the first store event for a receipt-bootstrapped row",
    async (storeEventType) => {
      // store-event-mapping.json pins whenNoPriorStoreEvent -> event: null for
      // price changes and deferrals: with no earlier store event there is no
      // baseline the event could describe.
      const db = new MemDb();
      db.seedProduct({
        projectId: PROJECT_ID,
        platform: "Android",
        productId: "premium_monthly",
        billingPeriod: "P1M",
      });
      await db.insert("subscriptions", {
        projectId: PROJECT_ID,
        platform: "Android",
        purchaseToken: TOKEN,
        productId: "premium_monthly",
        state: "Active",
        expiresAt: 9_999_999_999_999,
        willRenew: true,
        updatedAt: 0,
      });
      const eventId = await seedWebhookEvent(db, {
        type: storeEventType as never,
        notificationId: `message-${storeEventType}`,
        occurredAt: 1_000,
      });

      await applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: eventId as never,
      });
      expect(db.rows("commerceEvents")).toEqual([]);
    },
  );

  // Rows written before `lastEventOccurredAt` existed carry only `lastEventId`,
  // so the timestamp guard cannot judge them. Both of its fallbacks protect a
  // money path: a redelivery re-applies the transition and books it twice.
  it.each([
    ["the same event redelivered", "message-legacy", 500, "Expired"],
    ["an older event arriving late", "message-older", 200, "Expired"],
  ])(
    "drops %s against a legacy row",
    async (_name, notificationId, occurredAt, expected) => {
      const db = new MemDb();
      db.seedProduct({
        projectId: PROJECT_ID,
        platform: "Android",
        productId: "premium_monthly",
        billingPeriod: "P1M",
      });
      const priorId = await seedWebhookEvent(db, {
        type: "SubscriptionExpired",
        notificationId: "message-legacy",
        occurredAt: 500,
      });
      await db.insert("subscriptions", {
        projectId: PROJECT_ID,
        platform: "Android",
        purchaseToken: TOKEN,
        productId: "premium_monthly",
        state: "Expired",
        willRenew: false,
        lastEventId: priorId,
        updatedAt: 0,
      });
      const replayId =
        notificationId === "message-legacy"
          ? priorId
          : await seedWebhookEvent(db, {
              type: "SubscriptionStarted",
              notificationId,
              occurredAt,
            });

      await expect(
        applySubscriptionEventHandler(makeCtx(db), {
          projectId: PROJECT_ID as never,
          eventId: replayId as never,
        }),
      ).resolves.toMatchObject({ transition: null });
      expect(db.rows("subscriptions")).toMatchObject([{ state: expected }]);
      expect(db.rows("commerceEvents")).toEqual([]);
    },
  );

  it("recovers when the record already has store history", async () => {
    const db = new MemDb();
    db.seedProduct({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium_monthly",
      billingPeriod: "P1M",
    });
    const priorId = await seedWebhookEvent(db, {
      type: "SubscriptionExpired",
      notificationId: "message-prior",
      occurredAt: 500,
    });
    await db.insert("subscriptions", {
      projectId: PROJECT_ID,
      platform: "Android",
      purchaseToken: TOKEN,
      productId: "premium_monthly",
      state: "Expired",
      willRenew: false,
      lastEventId: priorId,
      updatedAt: 0,
    });
    const eventId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "message-after-history",
      occurredAt: 1_000,
    });

    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: eventId as never,
    });
    expect(db.rows("commerceEvents").map((row) => row.eventType)).toContain(
      "subscription.recovered",
    );
  });

  it("applies a recorded-but-unapplied event exactly once on redelivery", async () => {
    const db = new MemDb();
    db.seedProduct({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium_monthly",
      billingPeriod: "P1M",
    });
    const eventId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "message-a",
      occurredAt: 1_000,
    });
    const args = {
      projectId: PROJECT_ID as never,
      eventId: eventId as never,
    };

    await expect(
      applySubscriptionEventHandler(makeCtx(db), args),
    ).resolves.toMatchObject({ transition: "Started", active: true });
    const appliedAt = db.rows("webhookEvents")[0]?.appliedAt;

    await expect(
      applySubscriptionEventHandler(makeCtx(db), args),
    ).resolves.toMatchObject({ transition: null, active: true });
    expect(db.rows("webhookEvents")[0]?.appliedAt).toBe(appliedAt);
    expect(db.rows("subscriptions")).toMatchObject([
      { state: "Active", lastEventId: eventId },
    ]);
    expect(db.rows("subscriptionStats")).toMatchObject([
      { activeSubs: 1, mrrMicros: 9_990_000 },
    ]);
  });

  it("applies distinct same-timestamp events without replaying the old one", async () => {
    const db = new MemDb();
    db.seedProduct({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium_monthly",
      billingPeriod: "P1M",
    });
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "message-a",
      occurredAt: 1_000,
    });
    const expiredId = await seedWebhookEvent(db, {
      type: "SubscriptionExpired",
      notificationId: "message-b",
      occurredAt: 1_000,
    });

    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: expiredId as never,
    });
    await expect(
      applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: startedId as never,
      }),
    ).resolves.toMatchObject({ transition: null, active: false });

    expect(db.rows("subscriptions")).toMatchObject([
      { state: "Expired", lastEventId: expiredId },
    ]);
    expect(db.rows("subscriptionStats")).toMatchObject([
      { activeSubs: 0, mrrMicros: 0 },
    ]);
  });

  it("uses ingestion order to backfill a same-timestamp legacy event", async () => {
    const db = new MemDb();
    db.seedProduct({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium_monthly",
      billingPeriod: "P1M",
    });
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "legacy-a",
      occurredAt: 1_000,
    });
    const expiredId = await seedWebhookEvent(db, {
      type: "SubscriptionExpired",
      notificationId: "legacy-b",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: expiredId as never,
    });
    await db.patch(startedId, { appliedAt: undefined });

    await expect(
      applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: startedId as never,
      }),
    ).resolves.toMatchObject({ transition: null, active: false });

    expect(
      db.rows("webhookEvents").find((row) => row._id === startedId),
    ).toHaveProperty("appliedAt", Date.now());
    expect(db.rows("subscriptions")).toMatchObject([
      { state: "Expired", lastEventId: expiredId },
    ]);
    expect(db.rows("subscriptionStats")).toMatchObject([
      { activeSubs: 0, mrrMicros: 0 },
    ]);
  });

  it("keeps durable ordering after the previous webhook row is pruned", async () => {
    const db = new MemDb();
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "newer",
      occurredAt: 2_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    await db.delete(startedId);
    const staleId = await seedWebhookEvent(db, {
      type: "SubscriptionExpired",
      notificationId: "older",
      occurredAt: 1_000,
    });

    await expect(
      applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: staleId as never,
      }),
    ).resolves.toMatchObject({ transition: null, active: true });
    expect(db.rows("subscriptions")).toMatchObject([
      {
        state: "Active",
        lastEventOccurredAt: 2_000,
        lastEventSourceNotificationId: "newer",
      },
    ]);
  });

  it("does not grant entitlement for an already-expired start event", async () => {
    const db = new MemDb();
    const eventId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "expired-start",
      occurredAt: 1_000,
    });
    await db.patch(eventId, { expiresAt: Date.now() - 1 });

    await expect(
      applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: eventId as never,
      }),
    ).resolves.toMatchObject({ transition: "Started", active: false });
    expect(db.rows("commerceEvents").map((row) => row.eventType)).toEqual([
      "subscription.started",
    ]);
  });

  it("records one-time events without creating subscription commerce", async () => {
    const db = new MemDb();
    const eventId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "one-time",
      occurredAt: 1_000,
    });
    await db.patch(eventId, { productKind: "one_time" });

    await expect(
      applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: eventId as never,
      }),
    ).resolves.toEqual({ transition: null, active: false });
    expect(db.rows("subscriptions")).toHaveLength(0);
    expect(db.rows("commerceEvents")).toHaveLength(0);
  });

  it("keeps an Apple renewal preference separate from the active product", async () => {
    const db = new MemDb();
    db.seedProduct({
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "premium_monthly",
      billingPeriod: "P1M",
    });
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "apple-started",
      occurredAt: 1_000,
      platform: "IOS",
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    const changedId = await seedWebhookEvent(db, {
      type: "SubscriptionProductChanged",
      notificationId: "apple-next-product",
      occurredAt: 2_000,
      platform: "IOS",
      productId: "premium_yearly",
    });
    await db.patch(changedId, { priceAmountMicros: 99_990_000 });

    await expect(
      applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: changedId as never,
      }),
    ).resolves.toMatchObject({ transition: "ProductChanged", active: true });
    expect(db.rows("subscriptions")).toMatchObject([
      {
        productId: "premium_monthly",
        platform: "IOS",
        priceAmountMicros: 9_990_000,
      },
    ]);
    expect(db.rows("commerceEvents").at(-1)).toMatchObject({
      eventType: "subscription.product_changed",
      productId: "premium_yearly",
      amountMicros: 99_990_000,
      subscription: { productId: "premium_monthly" },
    });
    await db.delete(changedId);

    await bindSubscriptionToUserHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      purchaseToken: TOKEN,
      userId: "user-1",
    });
    expect(db.rows("commerceEvents").at(-1)).toMatchObject({
      eventType: "entitlement.granted",
      productId: "premium_monthly",
      userId: "user-1",
    });
    expect(db.rows("commerceEvents").at(-1)?.amountMicros).toBeUndefined();

    const renewedId = await seedWebhookEvent(db, {
      type: "SubscriptionRenewed",
      notificationId: "apple-renewed-on-new-product",
      occurredAt: 3_000,
      platform: "IOS",
      productId: "premium_yearly",
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: renewedId as never,
    });
    expect(db.rows("commerceEvents").at(-1)).toMatchObject({
      eventType: "subscription.renewed",
      productId: "premium_yearly",
      previousProductId: "premium_monthly",
      userId: "user-1",
    });
  });

  it("applies an Apple upgrade product immediately", async () => {
    const db = new MemDb();
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "apple-started",
      occurredAt: 1_000,
      platform: "IOS",
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    const changedId = await seedWebhookEvent(db, {
      type: "SubscriptionProductChanged",
      notificationId: "apple-upgrade",
      occurredAt: 2_000,
      platform: "IOS",
      productId: "premium_yearly",
    });
    await db.patch(changedId, { effectiveImmediately: true });

    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: changedId as never,
    });

    expect(db.rows("subscriptions")[0]).toMatchObject({
      productId: "premium_yearly",
      lastEventId: changedId,
    });
  });

  it("includes the previous product for an applied Google item change", async () => {
    const db = new MemDb();
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "google-started",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    const changedId = await seedWebhookEvent(db, {
      type: "SubscriptionProductChanged",
      notificationId: "google-item-change",
      occurredAt: 2_000,
      productId: "premium_yearly",
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: changedId as never,
    });

    expect(db.rows("commerceEvents").at(-1)).toMatchObject({
      eventType: "subscription.product_changed",
      previousProductId: "premium_monthly",
      productId: "premium_yearly",
      subscription: { productId: "premium_yearly" },
    });
  });

  it("does not guess a product for a multi-item Google change", async () => {
    const db = new MemDb();
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "google-bundle-started",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    const changedId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionProductChanged",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: TOKEN,
      productKind: "subscription",
      sourceNotificationId: "google-bundle-change",
      occurredAt: 2_000,
      receivedAt: 2_000,
    });

    await expect(
      applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: changedId as never,
      }),
    ).resolves.toMatchObject({ transition: null, active: true });
    expect(db.rows("subscriptions")[0]).toMatchObject({
      productId: "premium_monthly",
      lastEventId: changedId,
      lastEventOccurredAt: 2_000,
    });
    expect(db.rows("commerceEvents")).toHaveLength(1);

    const delayedId = await seedWebhookEvent(db, {
      type: "SubscriptionExpired",
      notificationId: "google-delayed-expiry",
      occurredAt: 1_500,
    });
    await expect(
      applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: delayedId as never,
      }),
    ).resolves.toMatchObject({ transition: null, active: true });
    expect(db.rows("subscriptions")[0]).toMatchObject({
      state: "Active",
      lastEventId: changedId,
    });
  });

  it("moves a Google replacement flow onto the linked token row", async () => {
    const db = new MemDb();
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "google-old-token",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    const changedId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionProductChanged",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "purchase_token_2",
      linkedPurchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_yearly",
      subscriptionState: "Active",
      sourceNotificationId: "google-new-token",
      occurredAt: 2_000,
      receivedAt: 2_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: changedId as never,
    });

    expect(db.rows("subscriptions")).toHaveLength(1);
    expect(db.rows("subscriptions")[0]).toMatchObject({
      purchaseToken: "purchase_token_2",
      productId: "premium_yearly",
    });
    expect(db.rows("commerceEvents").at(-1)).toMatchObject({
      eventType: "subscription.product_changed",
      previousProductId: "premium_monthly",
      productId: "premium_yearly",
    });
  });

  it("classifies a linked Google purchase with a new product as a change", async () => {
    const db = new MemDb();
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "google-linked-start-old",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    const replacementId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionStarted",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "purchase_token_2",
      linkedPurchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_yearly",
      subscriptionState: "Active",
      sourceNotificationId: "google-linked-start-new",
      occurredAt: 2_000,
      receivedAt: 2_000,
    });

    await expect(
      applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: replacementId as never,
      }),
    ).resolves.toMatchObject({ transition: "ProductChanged", active: true });

    expect(
      db
        .rows("commerceEvents")
        .filter((event) => event.sourceEventId === replacementId),
    ).toEqual([
      expect.objectContaining({
        eventType: "subscription.product_changed",
        previousProductId: "premium_monthly",
        productId: "premium_yearly",
      }),
    ]);
  });

  it("defers a same-product token handoff until the replacement renews", async () => {
    const db = new MemDb();
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "google-deferred-start-old",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    const handoffId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionStarted",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "purchase_token_2",
      linkedPurchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_monthly",
      subscriptionState: "Active",
      sourceNotificationId: "google-deferred-token-handoff",
      occurredAt: 2_000,
      receivedAt: 2_000,
    });
    await expect(
      applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: handoffId as never,
      }),
    ).resolves.toMatchObject({ transition: null, active: true });
    expect(
      db
        .rows("commerceEvents")
        .filter((event) => event.sourceEventId === handoffId),
    ).toEqual([]);

    const predecessorExpiryId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionExpired",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_monthly",
      subscriptionState: "Expired",
      expiresAt: 2_500,
      sourceNotificationId: "google-deferred-predecessor-expired",
      occurredAt: 2_500,
      receivedAt: 2_500,
    });
    await expect(
      applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: predecessorExpiryId as never,
      }),
    ).resolves.toMatchObject({ transition: null, active: true });
    expect(db.rows("subscriptions")).toHaveLength(1);
    expect(db.rows("subscriptions")[0]).toMatchObject({
      purchaseToken: "purchase_token_2",
      state: "Active",
    });
    expect(
      db
        .rows("commerceEvents")
        .filter((event) => event.sourceEventId === predecessorExpiryId),
    ).toEqual([]);
    expect(db.rows("subscriptionTokenAliases")).toMatchObject([
      {
        purchaseToken: TOKEN,
        successorPurchaseToken: "purchase_token_2",
      },
    ]);

    const successor = db.rows("subscriptions")[0];
    const statsBeforeStaleVerification = structuredClone(
      db.rows("subscriptionStats"),
    );
    await expect(
      recordVerifiedSubscriptionHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        platform: "Android",
        purchaseToken: TOKEN,
        productId: "stale_monthly",
        purchaseState: "ENTITLED",
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        expiresAt: 2_600,
        willRenew: false,
      }),
    ).resolves.toBe(successor._id);
    expect(db.rows("subscriptions")).toMatchObject([
      {
        _id: successor._id,
        purchaseToken: "purchase_token_2",
        productId: "premium_monthly",
        state: "Active",
      },
    ]);
    expect(db.rows("subscriptionStats")).toEqual(statsBeforeStaleVerification);

    await expect(
      bindSubscriptionToUserHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        purchaseToken: TOKEN,
        userId: "user-after-handoff",
      }),
    ).resolves.toBe(successor._id);
    expect(db.rows("subscriptions")).toMatchObject([
      {
        _id: successor._id,
        purchaseToken: "purchase_token_2",
        userId: "user-after-handoff",
      },
    ]);
    expect(db.rows("subscriptions")).toHaveLength(1);

    const renewalId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionRenewed",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "purchase_token_2",
      linkedPurchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_yearly",
      subscriptionState: "Active",
      sourceNotificationId: "google-deferred-first-renewal",
      occurredAt: 3_000,
      receivedAt: 3_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: renewalId as never,
    });

    expect(db.rows("subscriptions")[0]).toMatchObject({
      purchaseToken: "purchase_token_2",
      productId: "premium_yearly",
    });
    expect(
      db
        .rows("commerceEvents")
        .filter((event) => event.sourceEventId === renewalId),
    ).toEqual([
      expect.objectContaining({
        eventType: "subscription.renewed",
        previousProductId: "premium_monthly",
        productId: "premium_yearly",
      }),
    ]);
  });

  it("resolves predecessor aliases beyond 32 replacement hops", async () => {
    const db = new MemDb();
    const hopCount = 40;
    for (let index = 0; index < hopCount; index += 1) {
      await db.insert("subscriptionTokenAliases", {
        projectId: PROJECT_ID,
        purchaseToken: `token_${index}`,
        successorPurchaseToken: `token_${index + 1}`,
        predecessorProductId:
          index === 0 ? "premium_monthly" : "premium_yearly",
        createdAt: index,
        updatedAt: index,
      });
    }
    const subscriptionId = await db.insert("subscriptions", {
      projectId: PROJECT_ID,
      purchaseToken: `token_${hopCount}`,
      productKind: "subscription",
      productId: "premium_yearly",
      platform: "Android",
      state: "Active",
      expiresAt: 1_900_000_000_000,
      willRenew: true,
      startedAt: 1,
      updatedAt: 1,
    });
    await db.insert("subscriptions", {
      projectId: PROJECT_ID,
      purchaseToken: "token_20",
      productKind: "subscription",
      productId: "stale_intermediate",
      platform: "Android",
      state: "Expired",
      expiresAt: 2_000,
      willRenew: false,
      startedAt: 1,
      updatedAt: 1,
    });
    const expiredId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionExpired",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "token_0",
      productKind: "subscription",
      productId: "premium_monthly",
      sourceNotificationId: "old-chain-expired",
      occurredAt: 2_000,
      receivedAt: 2_000,
    });

    await expect(
      getSourceProductIdByTokenHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        purchaseToken: "token_0",
      }),
    ).resolves.toBe("premium_monthly");
    await expect(
      getCurrentProductIdByTokenHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        purchaseToken: "token_0",
      }),
    ).resolves.toBe("premium_yearly");

    await expect(
      applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: expiredId as never,
      }),
    ).resolves.toEqual({
      transition: null,
      active: true,
      subscriptionId,
    });
    expect(db.rows("subscriptions")).toHaveLength(2);
    expect(
      db.rows("subscriptions").find((row) => row._id === subscriptionId),
    ).toMatchObject({
      purchaseToken: `token_${hopCount}`,
      productId: "premium_yearly",
      state: "Active",
    });
    expect(db.rows("commerceEvents")).toEqual([]);
  });

  it("emits predecessor refunds and revocations without deactivating the successor", async () => {
    const db = new MemDb();
    const subscriptionId = await db.insert("subscriptions", {
      projectId: PROJECT_ID,
      purchaseToken: "current_token",
      productKind: "subscription",
      productId: "premium_yearly",
      platform: "Android",
      state: "Active",
      expiresAt: 1_900_000_000_000,
      willRenew: true,
      startedAt: 1,
      updatedAt: 1,
    });
    await db.insert("subscriptionTokenAliases", {
      projectId: PROJECT_ID,
      purchaseToken: "old_token",
      successorPurchaseToken: "current_token",
      predecessorProductId: "premium_monthly",
      createdAt: 1,
      updatedAt: 1,
    });

    const cases = [
      ["PurchaseRefunded", "Refunded", "subscription.refunded"],
      ["SubscriptionRevoked", "Revoked", "subscription.revoked"],
    ] as const;
    for (const [type, transition, eventType] of cases) {
      const eventId = await db.insert("webhookEvents", {
        projectId: PROJECT_ID,
        type,
        source: "GooglePlayRealTimeDeveloperNotifications",
        platform: "Android",
        environment: "Production",
        purchaseToken: "old_token",
        productKind: "subscription",
        productId: "premium_monthly",
        sourceNotificationId: `old-token-${type}`,
        occurredAt: 2_000,
        receivedAt: 2_000,
      });
      await expect(
        applySubscriptionEventHandler(makeCtx(db), {
          projectId: PROJECT_ID as never,
          eventId: eventId as never,
        }),
      ).resolves.toEqual({ transition, active: true, subscriptionId });
      expect(
        db
          .rows("commerceEvents")
          .filter((event) => event.sourceEventId === eventId)
          .map((event) => [
            event.eventType,
            event.productId,
            (event.subscription as { state?: string } | undefined)?.state,
            event.entitlementActive,
          ]),
      ).toEqual([[eventType, "premium_monthly", transition, false]]);
    }
    expect(db.rows("subscriptions")).toMatchObject([
      {
        purchaseToken: "current_token",
        productId: "premium_yearly",
        state: "Active",
      },
    ]);
  });

  it("classifies a same-product linked prepaid extension as a renewal", async () => {
    const db = new MemDb();
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "google-prepaid-start",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    const topUpId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionStarted",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "purchase_token_2",
      linkedPurchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_monthly",
      subscriptionState: "Active",
      expiresAt: 1_900_000_000_000,
      willRenew: false,
      sourceNotificationId: "google-prepaid-top-up",
      occurredAt: 2_000,
      receivedAt: 2_000,
    });

    await expect(
      applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: topUpId as never,
      }),
    ).resolves.toMatchObject({ transition: "Renewed", active: true });
    expect(
      db
        .rows("commerceEvents")
        .filter((event) => event.sourceEventId === topUpId),
    ).toEqual([
      expect.objectContaining({
        eventType: "subscription.renewed",
        productId: "premium_monthly",
        subscription: expect.objectContaining({
          expiresAt: 1_900_000_000_000,
          willRenew: false,
        }),
      }),
    ]);
    expect(
      db.rows("commerceEvents").find((event) => event.sourceEventId === topUpId)
        ?.subscription,
    ).not.toHaveProperty("renewsAt");
    expect(db.rows("subscriptions")[0]).toMatchObject({
      willRenew: false,
      expiresAt: 1_900_000_000_000,
    });
    expect(db.rows("subscriptions")[0]?.renewsAt).toBeUndefined();
  });

  it("classifies an active same-product linked resubscribe as uncanceled", async () => {
    const db = new MemDb();
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "google-resubscribe-start",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    const canceledId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionCanceled",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_monthly",
      subscriptionState: "Active",
      expiresAt: 1_800_000_000_000,
      willRenew: false,
      sourceNotificationId: "google-resubscribe-canceled",
      occurredAt: 2_000,
      receivedAt: 2_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: canceledId as never,
    });
    const resubscribedId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionStarted",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "purchase_token_2",
      linkedPurchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_monthly",
      subscriptionState: "Active",
      expiresAt: 1_800_000_000_000,
      willRenew: true,
      sourceNotificationId: "google-resubscribe-linked",
      occurredAt: 3_000,
      receivedAt: 3_000,
    });

    await expect(
      applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: resubscribedId as never,
      }),
    ).resolves.toMatchObject({ transition: "Uncanceled", active: true });
    expect(
      db
        .rows("commerceEvents")
        .filter((event) => event.sourceEventId === resubscribedId)
        .map((event) => event.eventType),
    ).toEqual(["subscription.uncanceled"]);
  });

  it("recovers a linked inactive predecessor regardless of verification order", async () => {
    const db = new MemDb();
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "google-order-start",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    const expiredId = await seedWebhookEvent(db, {
      type: "SubscriptionExpired",
      notificationId: "google-order-expired",
      occurredAt: 2_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: expiredId as never,
    });
    await recordVerifiedSubscriptionHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      platform: "Android",
      purchaseToken: "purchase_token_2",
      productId: "premium_monthly",
      purchaseState: "ENTITLED",
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      expiresAt: 1_900_000_000_000,
    });
    const recoveredId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionStarted",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "purchase_token_2",
      linkedPurchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_monthly",
      subscriptionState: "Active",
      expiresAt: 1_900_000_000_000,
      willRenew: true,
      sourceNotificationId: "google-order-linked",
      occurredAt: 3_000,
      receivedAt: 3_000,
    });

    await expect(
      applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: recoveredId as never,
      }),
    ).resolves.toMatchObject({ transition: "Recovered", active: true });
    expect(
      db
        .rows("commerceEvents")
        .filter((event) => event.sourceEventId === recoveredId)
        .map((event) => event.eventType),
    ).toEqual(["subscription.recovered"]);
  });

  it("recovers an inactive predecessor through a linked Google purchase", async () => {
    const db = new MemDb();
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "google-linked-inactive-start",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    const expiredId = await seedWebhookEvent(db, {
      type: "SubscriptionExpired",
      notificationId: "google-linked-inactive-expired",
      occurredAt: 2_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: expiredId as never,
    });
    const recoveredId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionStarted",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "purchase_token_2",
      linkedPurchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_monthly",
      subscriptionState: "Active",
      sourceNotificationId: "google-linked-inactive-repurchase",
      occurredAt: 3_000,
      receivedAt: 3_000,
    });

    await expect(
      applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: recoveredId as never,
      }),
    ).resolves.toMatchObject({ transition: "Recovered", active: true });
    expect(
      db
        .rows("commerceEvents")
        .filter((event) => event.sourceEventId === recoveredId)
        .map((event) => event.eventType),
    ).toEqual(["subscription.recovered"]);
  });

  it("applies a delayed replacement after the predecessor expires", async () => {
    const db = new MemDb();
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "google-predecessor-started",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    const expiredId = await seedWebhookEvent(db, {
      type: "SubscriptionExpired",
      notificationId: "google-predecessor-expired",
      occurredAt: 3_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: expiredId as never,
    });
    const changedId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionProductChanged",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "purchase_token_2",
      linkedPurchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_yearly",
      subscriptionState: "Active",
      sourceNotificationId: "google-delayed-replacement",
      occurredAt: 2_000,
      receivedAt: 4_000,
    });

    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: changedId as never,
    });

    expect(db.rows("subscriptions")).toHaveLength(1);
    expect(db.rows("subscriptions")[0]).toMatchObject({
      purchaseToken: "purchase_token_2",
      productId: "premium_yearly",
      state: "Active",
      lastEventId: changedId,
    });
    expect(
      db.rows("webhookEvents").find((row) => row._id === changedId),
    ).toHaveProperty("appliedAt");
    expect(db.rows("commerceEvents")).toContainEqual(
      expect.objectContaining({
        eventType: "subscription.product_changed",
        previousProductId: "premium_monthly",
        productId: "premium_yearly",
      }),
    );
  });

  it("keeps verification-first replacement state over a later predecessor expiry", async () => {
    const db = new MemDb();
    db.seedProduct({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium_monthly",
      billingPeriod: "P1M",
    });
    db.seedProduct({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium_yearly",
      billingPeriod: "P1Y",
    });
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "google-old-token",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    await bindSubscriptionToUserHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      purchaseToken: TOKEN,
      userId: "user_1",
    });
    await recordVerifiedSubscriptionHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      platform: "Android",
      purchaseToken: "purchase_token_2",
      productId: "premium_yearly",
      purchaseState: "ENTITLED",
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    });
    expect(db.rows("subscriptions")).toHaveLength(2);
    expect(
      db
        .rows("subscriptionStats")
        .reduce((total, row) => total + Number(row.activeSubs), 0),
    ).toBe(2);

    const expiredId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionExpired",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_monthly",
      subscriptionState: "Expired",
      sourceNotificationId: "google-old-token-expired",
      occurredAt: 3_000,
      receivedAt: 3_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: expiredId as never,
    });

    const changedId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionProductChanged",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "purchase_token_2",
      linkedPurchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_yearly",
      subscriptionState: "Active",
      sourceNotificationId: "google-new-token",
      occurredAt: 2_000,
      receivedAt: 2_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: changedId as never,
    });

    expect(db.rows("subscriptions")).toHaveLength(1);
    expect(db.rows("subscriptions")[0]).toMatchObject({
      purchaseToken: "purchase_token_2",
      productId: "premium_yearly",
      userId: "user_1",
      state: "Active",
      lastEventId: changedId,
    });
    expect(
      db
        .rows("subscriptionStats")
        .reduce((total, row) => total + Number(row.activeSubs), 0),
    ).toBe(1);
  });

  it("preserves active predecessor semantics after replacement verification", async () => {
    const db = new MemDb();
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "google-active-predecessor",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    await recordVerifiedSubscriptionHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      platform: "Android",
      purchaseToken: "purchase_token_2",
      productId: "premium_yearly",
      purchaseState: "ENTITLED",
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    });
    const changedId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionProductChanged",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "purchase_token_2",
      linkedPurchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_yearly",
      subscriptionState: "Active",
      sourceNotificationId: "google-verified-replacement",
      occurredAt: 2_000,
      receivedAt: 2_000,
    });

    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: changedId as never,
    });

    expect(db.rows("subscriptions")).toHaveLength(1);
    expect(db.rows("subscriptions")[0]).toMatchObject({
      purchaseToken: "purchase_token_2",
      productId: "premium_yearly",
      state: "Active",
      lastEventId: changedId,
    });
    expect(
      db
        .rows("commerceEvents")
        .filter((event) => event.sourceEventId === changedId),
    ).toEqual([
      expect.objectContaining({
        eventType: "subscription.product_changed",
        previousProductId: "premium_monthly",
        productId: "premium_yearly",
      }),
    ]);
  });

  it("emits a verified replacement when multi-item enrichment omits the product", async () => {
    const db = new MemDb();
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "google-active-predecessor-ambiguous",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    await recordVerifiedSubscriptionHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      platform: "Android",
      purchaseToken: "purchase_token_2",
      productId: "premium_yearly",
      purchaseState: "ENTITLED",
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    });
    const changedId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionProductChanged",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "purchase_token_2",
      linkedPurchaseToken: TOKEN,
      productKind: "subscription",
      subscriptionState: "Active",
      sourceNotificationId: "google-verified-ambiguous-replacement",
      occurredAt: 2_000,
      receivedAt: 2_000,
    });

    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: changedId as never,
    });

    expect(db.rows("subscriptions")).toHaveLength(1);
    expect(db.rows("subscriptions")[0]).toMatchObject({
      purchaseToken: "purchase_token_2",
      productId: "premium_yearly",
      state: "Active",
      lastEventId: changedId,
    });
    expect(
      db
        .rows("commerceEvents")
        .filter((event) => event.sourceEventId === changedId),
    ).toEqual([
      expect.objectContaining({
        eventType: "subscription.product_changed",
        previousProductId: "premium_monthly",
        productId: "premium_yearly",
      }),
    ]);
  });

  it("rejects linked Google tokens bound to different users", async () => {
    const db = new MemDb();
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "google-old-token",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    await bindSubscriptionToUserHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      purchaseToken: TOKEN,
      userId: "user_1",
    });
    await recordVerifiedSubscriptionHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      platform: "Android",
      purchaseToken: "purchase_token_2",
      productId: "premium_yearly",
      purchaseState: "ENTITLED",
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    });
    await bindSubscriptionToUserHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      purchaseToken: "purchase_token_2",
      userId: "user_2",
    });
    const changedId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionProductChanged",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "purchase_token_2",
      linkedPurchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_yearly",
      sourceNotificationId: "google-conflicting-token",
      occurredAt: 2_000,
      receivedAt: 2_000,
    });

    await expect(
      applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: changedId as never,
      }),
    ).rejects.toThrow("different users");
    expect(db.rows("subscriptions")).toHaveLength(2);
  });

  it("keeps a newer store-governed replacement row over an older linked event", async () => {
    const db = new MemDb();
    const oldStartedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "google-old-token",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: oldStartedId as never,
    });
    const newStartedId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionStarted",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "purchase_token_2",
      productKind: "subscription",
      productId: "premium_monthly",
      subscriptionState: "Active",
      sourceNotificationId: "google-new-token-started",
      occurredAt: 3_000,
      receivedAt: 3_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: newStartedId as never,
    });
    const olderLinkedId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionProductChanged",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "purchase_token_2",
      linkedPurchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_yearly",
      subscriptionState: "Active",
      sourceNotificationId: "google-older-linked-event",
      occurredAt: 2_000,
      receivedAt: 4_000,
    });

    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: olderLinkedId as never,
    });

    expect(db.rows("subscriptions")).toHaveLength(1);
    expect(db.rows("subscriptions")[0]).toMatchObject({
      purchaseToken: "purchase_token_2",
      productId: "premium_monthly",
      lastEventId: newStartedId,
    });
    expect(
      db.rows("webhookEvents").find((row) => row._id === olderLinkedId),
    ).toHaveProperty("appliedAt");
    expect(db.rows("subscriptionTokenAliases")).toMatchObject([
      {
        purchaseToken: TOKEN,
        successorPurchaseToken: "purchase_token_2",
      },
    ]);

    const latePredecessorExpiryId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionExpired",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_monthly",
      subscriptionState: "Expired",
      sourceNotificationId: "google-late-predecessor-expired",
      occurredAt: 4_000,
      receivedAt: 4_000,
    });
    await expect(
      applySubscriptionEventHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        eventId: latePredecessorExpiryId as never,
      }),
    ).resolves.toMatchObject({ transition: null, active: true });
    expect(db.rows("subscriptions")).toHaveLength(1);
    expect(
      db
        .rows("commerceEvents")
        .filter((event) => event.sourceEventId === latePredecessorExpiryId),
    ).toEqual([]);
  });

  it("keeps current-token state when the predecessor expires later", async () => {
    const db = new MemDb();
    const oldStartedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "google-predecessor-started",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: oldStartedId as never,
    });
    const replacementStartedId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionStarted",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "purchase_token_2",
      productKind: "subscription",
      productId: "premium_monthly",
      subscriptionState: "Active",
      sourceNotificationId: "google-replacement-started",
      occurredAt: 2_000,
      receivedAt: 2_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: replacementStartedId as never,
    });
    const predecessorExpiredId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionExpired",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_monthly",
      subscriptionState: "Expired",
      sourceNotificationId: "google-predecessor-expired",
      occurredAt: 3_000,
      receivedAt: 3_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: predecessorExpiredId as never,
    });
    const linkedId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionProductChanged",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "purchase_token_2",
      linkedPurchaseToken: TOKEN,
      productKind: "subscription",
      productId: "premium_yearly",
      subscriptionState: "Active",
      sourceNotificationId: "google-linked-replacement",
      occurredAt: 4_000,
      receivedAt: 4_000,
    });

    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: linkedId as never,
    });

    expect(db.rows("subscriptions")).toHaveLength(1);
    expect(db.rows("subscriptions")[0]).toMatchObject({
      purchaseToken: "purchase_token_2",
      productId: "premium_yearly",
      state: "Active",
      lastEventId: linkedId,
    });
  });

  it("moves a multi-item Google replacement token without guessing a product", async () => {
    const db = new MemDb();
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "google-old-token",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    const changedId = await db.insert("webhookEvents", {
      projectId: PROJECT_ID,
      type: "SubscriptionProductChanged",
      source: "GooglePlayRealTimeDeveloperNotifications",
      platform: "Android",
      environment: "Production",
      purchaseToken: "purchase_token_2",
      linkedPurchaseToken: TOKEN,
      productKind: "subscription",
      sourceNotificationId: "google-bundle-change",
      occurredAt: 2_000,
      receivedAt: 2_000,
    });

    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: changedId as never,
    });

    expect(db.rows("subscriptions")).toHaveLength(1);
    expect(db.rows("subscriptions")[0]).toMatchObject({
      purchaseToken: "purchase_token_2",
      productId: "premium_monthly",
      lastEventId: changedId,
    });
    expect(db.rows("commerceEvents")).toHaveLength(1);
  });
});

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

  it("stamps Refunded only when Apple says the revocation was a refund", () => {
    // revocationReason 1 is Apple's app-issue refund; 0 also covers Family
    // Sharing loss, where asserting money moved back would be false.
    const refunded = buildVerifiedSubscriptionSnapshot({
      platform: "IOS",
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.CANCELED,
      revocationReasonIOS: 1,
    });
    expect(refunded).toMatchObject({
      state: "Revoked",
      willRenew: false,
      cancellationReason: "Refunded",
    });

    const familySharingLoss = buildVerifiedSubscriptionSnapshot({
      platform: "IOS",
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.CANCELED,
      revocationReasonIOS: 0,
    });
    expect(familySharingLoss).toMatchObject({
      state: "Revoked",
      willRenew: false,
    });
    expect(familySharingLoss?.cancellationReason).toBeUndefined();

    const unknown = buildVerifiedSubscriptionSnapshot({
      platform: "IOS",
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.CANCELED,
    });
    expect(unknown?.cancellationReason).toBeUndefined();
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
      expiresAt: 2_000_000_000_000,
    });
    expect(snapshot?.cancellationReason).toBeUndefined();
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
      clearCancellationReason: true,
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

  it("clears stale cancellation reason when verified snapshots request it", () => {
    const existing = {
      expiresAt: undefined,
      renewsAt: undefined,
      willRenew: false,
      cancellationReason: "UserCanceled" as const,
      currency: undefined,
      priceAmountMicros: undefined,
    };
    const appleSnapshot = buildVerifiedSubscriptionSnapshot({
      platform: "IOS",
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
    });
    const graceSnapshot = buildVerifiedSubscriptionSnapshot({
      platform: "Android",
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      subscriptionState: "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
    });

    expect(appleSnapshot?.clearCancellationReason).toBe(true);
    expect(graceSnapshot?.clearCancellationReason).toBe(true);

    const appleMerged = mergeVerifiedSubscriptionSnapshot(
      existing,
      appleSnapshot!,
    );
    const graceMerged = mergeVerifiedSubscriptionSnapshot(
      existing,
      graceSnapshot!,
    );

    expect(appleMerged.cancellationReason).toBeUndefined();
    expect(graceMerged.cancellationReason).toBeUndefined();
    expect(graceMerged.willRenew).toBe(true);
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

  it("rejects a receipt-verification write once project deletion starts", async () => {
    const db = new MemDb();
    await db.patch(PROJECT_ID, { pendingDeletion: true });

    await expect(
      recordVerifiedSubscriptionHandler(makeCtx(db), {
        projectId: PROJECT_ID as never,
        platform: "Android",
        purchaseToken: TOKEN,
        productId: "premium_monthly",
        purchaseState: HarmonizedPurchaseState.ENTITLED,
      }),
    ).rejects.toThrow("Project not found");
    expect(db.rows("subscriptions")).toEqual([]);
    expect(db.rows("subscriptionStats")).toEqual([]);
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

  it("keeps a verified Google prepaid subscription non-renewing", async () => {
    const db = new MemDb();

    await recordVerifiedSubscriptionHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      platform: "Android",
      purchaseToken: "prepaid-token",
      productId: "prepaid_monthly",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      expiresAt: 1_769_904_000_000,
      willRenew: false,
    });

    expect(db.rows("subscriptions")).toMatchObject([
      {
        purchaseToken: "prepaid-token",
        state: "Active",
        expiresAt: 1_769_904_000_000,
        willRenew: false,
        renewsAt: undefined,
      },
    ]);
  });

  it("clears a prior renewal date when verification becomes non-renewing", async () => {
    const db = new MemDb();
    const input = {
      projectId: PROJECT_ID as never,
      platform: "Android" as const,
      purchaseToken: "prepaid-transition-token",
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      expiresAt: 1_769_904_000_000,
    };

    await recordVerifiedSubscriptionHandler(makeCtx(db), {
      ...input,
      renewsAt: 1_769_904_000_000,
      willRenew: true,
    });
    await recordVerifiedSubscriptionHandler(makeCtx(db), {
      ...input,
      willRenew: false,
    });

    expect(db.rows("subscriptions")).toMatchObject([
      {
        purchaseToken: "prepaid-transition-token",
        state: "Active",
        willRenew: false,
        renewsAt: undefined,
      },
    ]);
    expect(db.rows("subscriptions")).toHaveLength(1);
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

  it("does not let an older verification overwrite webhook-governed state", async () => {
    const db = new MemDb();
    const startedId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "apple-monthly",
      occurredAt: 1_000,
      platform: "IOS",
      productId: "premium_monthly",
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: startedId as never,
    });
    const renewedId = await seedWebhookEvent(db, {
      type: "SubscriptionRenewed",
      notificationId: "apple-yearly",
      occurredAt: 2_000,
      platform: "IOS",
      productId: "premium_yearly",
    });
    await db.patch(renewedId, { expiresAt: 1_900_000_000_000 });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: renewedId as never,
    });

    await recordVerifiedSubscriptionHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      platform: "IOS",
      purchaseToken: TOKEN,
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      expiresAt: 1_700_000_000_000,
    });
    expect(db.rows("subscriptions")[0]).toMatchObject({
      productId: "premium_yearly",
      expiresAt: 1_900_000_000_000,
      lastEventSourceNotificationId: "apple-yearly",
    });
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

  it("supports the verify -> bind flow for SDK clients", async () => {
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

    const boundId = await bindSubscriptionToUserHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      purchaseToken: TOKEN,
      userId: "user-1",
    });

    expect(boundId).toBe(subscriptionId);
    expect(db.rows("subscriptions")).toMatchObject([
      {
        _id: subscriptionId,
        projectId: PROJECT_ID,
        purchaseToken: TOKEN,
        productId: "premium_monthly",
        platform: "Android",
        state: "Active",
        userId: "user-1",
        willRenew: true,
        currency: "USD",
        priceAmountMicros: 9_990_000,
      },
    ]);

    const eventId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "message-after-bind",
      occurredAt: 2_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: eventId as never,
    });
    expect(db.rows("commerceEvents")).toMatchObject([
      { eventType: "subscription.started", userId: "user-1" },
      { eventType: "entitlement.granted", userId: "user-1" },
    ]);
  });

  it("rejects unbounded user ids at the Convex storage boundary", async () => {
    const db = new MemDb();

    for (const userId of ["   ", "u".repeat(257)]) {
      await expect(
        bindSubscriptionToUserHandler(makeCtx(db), {
          projectId: PROJECT_ID as never,
          purchaseToken: TOKEN,
          userId,
        }),
      ).rejects.toThrow("userId must be nonblank and at most 256 characters");
    }
    expect(db.rows("subscriptions")).toHaveLength(0);
    expect(db.rows("commerceEvents")).toHaveLength(0);
  });

  it("emits a correlated grant when the webhook arrives before binding", async () => {
    const db = new MemDb();
    db.seedProduct({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium_monthly",
      billingPeriod: "P1M",
    });
    const eventId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "message-before-bind",
      occurredAt: 2_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: eventId as never,
    });

    await bindSubscriptionToUserHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      purchaseToken: TOKEN,
      userId: "user-1",
    });

    expect(db.rows("commerceEvents").at(-1)).toMatchObject({
      eventType: "entitlement.granted",
      userId: "user-1",
    });
  });

  it("does not replay an unbound grant that expired before binding", async () => {
    const db = new MemDb();
    db.seedProduct({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium_monthly",
      billingPeriod: "P1M",
    });
    const started = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "unbound-started",
      occurredAt: 1_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: started as never,
    });
    const expired = await seedWebhookEvent(db, {
      type: "SubscriptionExpired",
      notificationId: "unbound-expired",
      occurredAt: 2_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: expired as never,
    });

    const beforeBind = db.rows("commerceEvents").map((row) => row.eventType);
    expect(beforeBind).toEqual([
      "subscription.started",
      "subscription.expired",
    ]);

    await bindSubscriptionToUserHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      purchaseToken: TOKEN,
      userId: "user-after-expiry",
    });

    expect(db.rows("commerceEvents").map((row) => row.eventType)).toEqual(
      beforeBind,
    );
    expect(db.rows("subscriptions")[0]).toMatchObject({
      state: "Expired",
      userId: "user-after-expiry",
    });
  });

  it("uses the compact source snapshot after the webhook row is pruned", async () => {
    const db = new MemDb();
    const eventId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "old-webhook",
      occurredAt: 2_000,
    });
    await applySubscriptionEventHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      eventId: eventId as never,
    });
    await db.delete(eventId);

    await bindSubscriptionToUserHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      purchaseToken: TOKEN,
      userId: "user-after-retention",
    });
    expect(db.rows("commerceEvents").at(-1)).toMatchObject({
      eventType: "entitlement.granted",
      productId: "premium_monthly",
      userId: "user-after-retention",
      sourceStoreNotificationId: "old-webhook",
    });
  });
});

describe("user binding authorization", () => {
  const seedBound = async (db: MemDb, userId?: string) => {
    db.seedProduct({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium_monthly",
      billingPeriod: "P1M",
    });
    await db.insert("subscriptions", {
      projectId: PROJECT_ID,
      platform: "Android",
      purchaseToken: TOKEN,
      productId: "premium_monthly",
      state: "Active",
      willRenew: true,
      updatedAt: 0,
      ...(userId ? { userId } : {}),
    });
  };

  // Token possession is not proof of ownership, and a distinct rejection would
  // tell any holder of the app-embedded publishable key that a token exists
  // and belongs to someone.
  it("reports an already-bound subscription the same as an unknown token", async () => {
    const owned = new MemDb();
    await seedBound(owned, "victim");
    const unknown = new MemDb();
    await seedBound(unknown, "victim");
    await unknown.delete(unknown.rows("subscriptions")[0]._id);

    const attacker = {
      projectId: PROJECT_ID as never,
      purchaseToken: TOKEN,
      userId: "attacker",
    };
    await expect(
      bindSubscriptionToUserHandler(makeCtx(owned) as never, attacker),
    ).resolves.toBeNull();
    await expect(
      bindSubscriptionToUserHandler(makeCtx(unknown) as never, attacker),
    ).resolves.toBeNull();
    expect(owned.rows("subscriptions")[0].userId).toBe("victim");
  });

  // A consumer gating access on commerce events must be told the purchase
  // moved, or the wrong user keeps access and the real one never gets it.
  it("revokes the old user and grants the new one on a rebind", async () => {
    const db = new MemDb();
    db.seedProduct({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium_monthly",
      billingPeriod: "P1M",
    });
    const priorId = await seedWebhookEvent(db, {
      type: "SubscriptionStarted",
      notificationId: "rebind-source",
      occurredAt: 1_000,
    });
    await db.insert("subscriptions", {
      projectId: PROJECT_ID,
      platform: "Android",
      purchaseToken: TOKEN,
      productId: "premium_monthly",
      state: "Active",
      willRenew: true,
      userId: "wrong-user",
      lastEventId: priorId,
      lastEventOccurredAt: 1_000,
      lastEventSourceNotificationId: "rebind-source",
      lastEventSource: {
        type: "SubscriptionStarted",
        environment: "Production",
        productId: "premium_monthly",
      },
      expiresAt: Date.now() + 86_400_000,
      updatedAt: 0,
    });

    await rebindSubscriptionToUserHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      purchaseToken: TOKEN,
      userId: "real-owner",
    });

    const emitted = db
      .rows("commerceEvents")
      .map((r) => [r.eventType, r.userId]);
    expect(emitted).toEqual([
      ["entitlement.revoked", "wrong-user"],
      ["entitlement.granted", "real-owner"],
    ]);
  });

  // A rebind that cannot attribute events leaves the developer backend
  // believing the old user still owns the purchase. Say so rather than
  // reporting plain success.
  it("reports a rebind it could not notify about", async () => {
    const db = new MemDb();
    db.seedProduct({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium_monthly",
      billingPeriod: "P1M",
    });
    await db.insert("subscriptions", {
      projectId: PROJECT_ID,
      platform: "Android",
      purchaseToken: TOKEN,
      productId: "premium_monthly",
      state: "Active",
      willRenew: true,
      userId: "wrong-user",
      expiresAt: Date.now() + 86_400_000,
      updatedAt: 0,
    });

    const outcome = await rebindSubscriptionToUserHandler(makeCtx(db), {
      projectId: PROJECT_ID as never,
      purchaseToken: TOKEN,
      userId: "real-owner",
    });
    expect(outcome?.notified).toBe(false);
    expect(db.rows("subscriptions")[0].userId).toBe("real-owner");
    expect(db.rows("commerceEvents")).toEqual([]);
  });

  it("lets an operator move a wrong binding", async () => {
    const db = new MemDb();
    await seedBound(db, "wrong-user");
    await expect(
      rebindSubscriptionToUserHandler(makeCtx(db) as never, {
        projectId: PROJECT_ID as never,
        purchaseToken: TOKEN,
        userId: "real-owner",
      }),
    ).resolves.not.toBeNull();
    expect(db.rows("subscriptions")[0].userId).toBe("real-owner");
  });
});
