import { describe, expect, it, vi } from "vitest";

import {
  lookupExistingEvent as registeredLookupExistingEvent,
  pruneWebhookEvents as registeredPruneWebhookEvents,
  recordWebhookEvent as registeredRecordWebhookEvent,
} from "./internal";
import { testableFunction } from "../test.setup";

const lookupExistingEvent = testableFunction(registeredLookupExistingEvent);
const pruneWebhookEvents = testableFunction(registeredPruneWebhookEvents);
const recordWebhookEvent = testableFunction(registeredRecordWebhookEvent);

interface TestRow {
  _id: string;
  [field: string]: unknown;
}

class TestIndexBuilder {
  constructor(
    private readonly filters: Array<[field: string, value: unknown]>,
    private readonly upperBounds: Array<[field: string, value: number]>,
  ) {}

  eq(field: string, value: unknown): this {
    this.filters.push([field, value]);
    return this;
  }

  lt(field: string, value: number): this {
    this.upperBounds.push([field, value]);
    return this;
  }
}

class TestQuery {
  private readonly filters: Array<[field: string, value: unknown]> = [];
  private readonly upperBounds: Array<[field: string, value: number]> = [];

  constructor(private readonly rows: TestRow[]) {}

  withIndex(
    _indexName: string,
    configure: (builder: TestIndexBuilder) => unknown,
  ): this {
    configure(new TestIndexBuilder(this.filters, this.upperBounds));
    return this;
  }

  async unique(): Promise<TestRow | null> {
    const matches = this.matchingRows();
    if (matches.length > 1) {
      throw new Error(`Expected at most one row, received ${matches.length}`);
    }
    return matches[0] ?? null;
  }

  async collect(): Promise<TestRow[]> {
    return this.matchingRows();
  }

  async take(limit: number): Promise<TestRow[]> {
    return this.matchingRows().slice(0, limit);
  }

  private matchingRows(): TestRow[] {
    return this.rows.filter(
      (row) =>
        this.filters.every(([field, value]) => row[field] === value) &&
        this.upperBounds.every(
          ([field, value]) =>
            typeof row[field] === "number" && row[field] < value,
        ),
    );
  }
}

class TestDb {
  private nextId = 1;
  private readonly tables = new Map<string, TestRow[]>();

  constructor(seed: Record<string, TestRow[]>) {
    for (const [table, rows] of Object.entries(seed)) {
      this.tables.set(
        table,
        rows.map((row) => ({ ...row })),
      );
    }
  }

  query(table: string): TestQuery {
    return new TestQuery(this.table(table));
  }

  async get(id: string): Promise<TestRow | null> {
    for (const rows of this.tables.values()) {
      const match = rows.find((row) => row._id === id);
      if (match) return match;
    }
    return null;
  }

  async insert(table: string, value: Record<string, unknown>): Promise<string> {
    const id = `${table}_${this.nextId++}`;
    this.table(table).push({ _id: id, ...value });
    return id;
  }

  async patch(id: string, value: Record<string, unknown>): Promise<void> {
    const row = await this.get(id);
    if (!row) throw new Error(`Unknown row: ${id}`);
    Object.assign(row, value);
  }

  async delete(id: string): Promise<void> {
    for (const rows of this.tables.values()) {
      const index = rows.findIndex((row) => row._id === id);
      if (index >= 0) {
        rows.splice(index, 1);
        return;
      }
    }
  }

  rows(table: string): TestRow[] {
    return this.table(table);
  }

  private table(name: string): TestRow[] {
    const existing = this.tables.get(name);
    if (existing) return existing;
    const rows: TestRow[] = [];
    this.tables.set(name, rows);
    return rows;
  }
}

function createWritableDb(extra: Record<string, TestRow[]> = {}): TestDb {
  return new TestDb({
    organizations: [{ _id: "organization_a" }, { _id: "organization_b" }],
    projects: [
      { _id: "project_a", organizationId: "organization_a" },
      { _id: "project_b", organizationId: "organization_b" },
    ],
    webhookEvents: [],
    webhookIdempotencyKeys: [],
    ...extra,
  });
}

function webhookArgs(
  projectId: string,
  source: "apple" | "google",
  sourceNotificationId: string,
) {
  const apple = source === "apple";
  return {
    projectId: projectId as never,
    source,
    sourceNotificationId,
    event: {
      type: "SubscriptionStarted" as const,
      sourceFull: apple
        ? ("AppleAppStoreServerNotificationsV2" as const)
        : ("GooglePlayRealTimeDeveloperNotifications" as const),
      platform: apple ? ("IOS" as const) : ("Android" as const),
      environment: "Sandbox" as const,
      occurredAt: 1_000,
    },
  };
}

describe("recordWebhookEvent pending-deletion guard", () => {
  for (const pendingOwner of ["project", "organization"] as const) {
    it(`does not recreate webhook rows while the ${pendingOwner} drains`, async () => {
      const rows = new Map<string, Record<string, unknown>>([
        [
          "project_a",
          {
            _id: "project_a",
            organizationId: "organization_a",
            pendingDeletion: pendingOwner === "project",
          },
        ],
        [
          "organization_a",
          {
            _id: "organization_a",
            pendingDeletion: pendingOwner === "organization",
          },
        ],
      ]);
      const insert = vi.fn();
      const ctx = {
        db: {
          get: vi.fn(async (id: string) => rows.get(id) ?? null),
          insert,
        },
      };

      await expect(
        recordWebhookEvent._handler(ctx as never, {
          projectId: "project_a" as never,
          source: "apple",
          sourceNotificationId: "notification_a",
          event: {
            type: "SubscriptionStarted",
            sourceFull: "AppleAppStoreServerNotificationsV2",
            platform: "IOS",
            environment: "Sandbox",
            occurredAt: Date.now(),
          },
        }),
      ).rejects.toThrow("Project not found");
      expect(insert).not.toHaveBeenCalled();
    });
  }
});

describe("webhook event-first dedup migration", () => {
  it("dedups a replay by the source-aware event index, writing no key row", async () => {
    const db = createWritableDb();
    const args = webhookArgs("project_a", "apple", "notification_same");

    const first = await recordWebhookEvent._handler({ db }, args);
    // Phase 2: the event row IS the dedup record. A second row saying
    // the same thing doubled the write cost of every webhook.
    expect(db.rows("webhookIdempotencyKeys")).toHaveLength(0);

    const replay = await recordWebhookEvent._handler({ db }, args);

    expect(first.deduped).toBe(false);
    expect(replay).toEqual({ eventId: first.eventId, deduped: true });
    expect(db.rows("webhookEvents")).toHaveLength(1);
    expect(db.rows("webhookIdempotencyKeys")).toHaveLength(0);
  });

  it("still adopts and links a half-written legacy key row", async () => {
    // Rows written before phase 2 stay in the table for a retention
    // window. One that never got an eventId (its event insert failed)
    // must still be linked to the event this call creates — the orphan
    // sweep deletes unlinked rows, and a replay arriving in between
    // would otherwise be processed twice.
    const db = createWritableDb({
      webhookIdempotencyKeys: [
        {
          _id: "key_legacy",
          source: "apple",
          sourceNotificationId: "notification_half",
          firstSeenAt: 1,
        },
      ],
    });

    const result = await recordWebhookEvent._handler(
      { db },
      webhookArgs("project_a", "apple", "notification_half"),
    );

    expect(result.deduped).toBe(false);
    const keys = db.rows("webhookIdempotencyKeys");
    expect(keys).toHaveLength(1);
    expect(keys[0].eventId).toBe(result.eventId);
  });

  it("keeps equal notification ids from Apple and Google separate", async () => {
    const db = createWritableDb();

    const apple = await recordWebhookEvent._handler(
      { db },
      webhookArgs("project_a", "apple", "shared_notification"),
    );
    const google = await recordWebhookEvent._handler(
      { db },
      webhookArgs("project_a", "google", "shared_notification"),
    );

    expect(apple.deduped).toBe(false);
    expect(google.deduped).toBe(false);
    expect(google.eventId).not.toBe(apple.eventId);
    expect(db.rows("webhookEvents").map((row) => row.source)).toEqual([
      "AppleAppStoreServerNotificationsV2",
      "GooglePlayRealTimeDeveloperNotifications",
    ]);
  });

  it("keeps equal source notification ids from different projects separate", async () => {
    const db = createWritableDb();

    const firstProject = await recordWebhookEvent._handler(
      { db },
      webhookArgs("project_a", "google", "shared_message"),
    );
    const secondProject = await recordWebhookEvent._handler(
      { db },
      webhookArgs("project_b", "google", "shared_message"),
    );

    expect(firstProject.deduped).toBe(false);
    expect(secondProject.deduped).toBe(false);
    expect(secondProject.eventId).not.toBe(firstProject.eventId);
    expect(db.rows("webhookEvents").map((row) => row.projectId)).toEqual([
      "project_a",
      "project_b",
    ]);
  });

  it("persists the Google plan renewal flag for lifecycle application", async () => {
    const db = createWritableDb();
    const args = webhookArgs("project_a", "google", "prepaid_top_up");

    const result = await recordWebhookEvent._handler(
      { db },
      {
        ...args,
        event: {
          ...args.event,
          purchaseToken: "prepaid_token",
          productKind: "subscription" as const,
          productId: "prepaid_monthly",
          subscriptionState: "Active" as const,
          expiresAt: 1_900_000_000_000,
          willRenew: false,
        },
      },
    );

    expect(db.rows("webhookEvents")).toEqual([
      expect.objectContaining({
        _id: result.eventId,
        purchaseToken: "prepaid_token",
        willRenew: false,
      }),
    ]);
  });

  it("uses the event row for the Google preflight before the key fallback", async () => {
    const db = createWritableDb({
      webhookEvents: [
        {
          _id: "event_google",
          projectId: "project_a",
          type: "SubscriptionRenewed",
          source: "GooglePlayRealTimeDeveloperNotifications",
          platform: "Android",
          purchaseToken: "purchase_token",
          productId: "premium_monthly",
          subscriptionState: "Active",
          sourceNotificationId: "message_a",
        },
        {
          _id: "event_apple",
          projectId: "project_a",
          type: "SubscriptionRenewed",
          source: "AppleAppStoreServerNotificationsV2",
          platform: "IOS",
          sourceNotificationId: "message_a",
        },
      ],
      webhookIdempotencyKeys: [],
    });

    await expect(
      lookupExistingEvent._handler(
        { db },
        {
          projectId: "project_a" as never,
          source: "google",
          sourceNotificationId: "message_a",
        },
      ),
    ).resolves.toEqual({
      eventId: "event_google",
      type: "SubscriptionRenewed",
      purchaseToken: "purchase_token",
    });
  });

  it("retains the project-keyed preflight fallback during phase 1", async () => {
    const db = createWritableDb({
      webhookEvents: [
        {
          _id: "event_from_key",
          projectId: "project_a",
          type: "SubscriptionRenewed",
          source: "GooglePlayRealTimeDeveloperNotifications",
          platform: "Android",
          purchaseToken: "purchase_token",
          sourceNotificationId: "message_from_key",
        },
      ],
      webhookIdempotencyKeys: [
        {
          _id: "key_existing",
          projectId: "project_a",
          source: "google",
          sourceNotificationId: "message_from_key",
          eventId: "event_from_key",
        },
      ],
    });

    await expect(
      lookupExistingEvent._handler(
        { db },
        {
          projectId: "project_a" as never,
          source: "google",
          sourceNotificationId: "message_from_key",
        },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        eventId: "event_from_key",
        type: "SubscriptionRenewed",
        purchaseToken: "purchase_token",
      }),
    );
  });

  it("adopts a half-written legacy key when no event row exists", async () => {
    const db = createWritableDb({
      webhookIdempotencyKeys: [
        {
          _id: "legacy_key",
          source: "google",
          sourceNotificationId: "legacy_message",
          firstSeenAt: 500,
        },
      ],
    });

    const result = await recordWebhookEvent._handler(
      { db },
      webhookArgs("project_a", "google", "legacy_message"),
    );

    expect(result.deduped).toBe(false);
    expect(db.rows("webhookEvents")).toHaveLength(1);
    expect(db.rows("webhookIdempotencyKeys")).toEqual([
      expect.objectContaining({
        _id: "legacy_key",
        eventId: result.eventId,
        firstSeenAt: 500,
      }),
    ]);
  });

  it("rejects a short and stored source mismatch before writing", async () => {
    const db = createWritableDb();
    const args = webhookArgs("project_a", "apple", "mismatched_source");

    await expect(
      recordWebhookEvent._handler(
        { db },
        {
          ...args,
          event: {
            ...args.event,
            sourceFull: "GooglePlayRealTimeDeveloperNotifications",
          },
        },
      ),
    ).rejects.toThrow(
      "Webhook source mismatch: apple cannot store GooglePlayRealTimeDeveloperNotifications",
    );
    expect(db.rows("webhookEvents")).toHaveLength(0);
    expect(db.rows("webhookIdempotencyKeys")).toHaveLength(0);
  });
});

describe("pruneWebhookEvents", () => {
  it("preserves a compact source before deleting a referenced event", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(10_000));
    const db = createWritableDb({
      webhookEvents: [
        {
          _id: "event_old",
          _creationTime: 900,
          projectId: "project_a",
          type: "SubscriptionPriceChange",
          source: "AppleAppStoreServerNotificationsV2",
          platform: "IOS",
          environment: "Sandbox",
          productId: "premium_monthly",
          currency: "USD",
          priceAmountMicros: 19_990_000,
          sourceNotificationId: "apple_price_change",
          occurredAt: 1_000,
          receivedAt: 1_000,
        },
      ],
      subscriptions: [
        {
          _id: "subscription_a",
          projectId: "project_a",
          lastEventId: "event_old",
        },
      ],
    });

    await expect(
      pruneWebhookEvents._handler(
        { db },
        {
          olderThanMs: 5_000,
          batchSize: 10,
        },
      ),
    ).resolves.toEqual({ deletedEvents: 1, deletedKeys: 0 });
    expect(db.rows("webhookEvents")).toHaveLength(0);
    expect(db.rows("subscriptions")[0]).toMatchObject({
      lastEventOccurredAt: 1_000,
      lastEventCreationTime: 900,
      lastEventSourceNotificationId: "apple_price_change",
      lastEventSource: {
        type: "SubscriptionPriceChange",
        environment: "Sandbox",
        productId: "premium_monthly",
        currency: "USD",
        priceAmountMicros: 19_990_000,
      },
    });
    vi.useRealTimers();
  });
});
