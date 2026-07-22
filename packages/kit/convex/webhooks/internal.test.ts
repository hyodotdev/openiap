import { describe, expect, it, vi } from "vitest";

import {
  lookupExistingEvent as registeredLookupExistingEvent,
  recordWebhookEvent as registeredRecordWebhookEvent,
} from "./internal";
import { testableFunction } from "../test.setup";

const lookupExistingEvent = testableFunction(registeredLookupExistingEvent);
const recordWebhookEvent = testableFunction(registeredRecordWebhookEvent);

interface TestRow {
  _id: string;
  [field: string]: unknown;
}

class TestIndexBuilder {
  constructor(
    private readonly filters: Array<[field: string, value: unknown]>,
  ) {}

  eq(field: string, value: unknown): this {
    this.filters.push([field, value]);
    return this;
  }
}

class TestQuery {
  private readonly filters: Array<[field: string, value: unknown]> = [];

  constructor(private readonly rows: TestRow[]) {}

  withIndex(
    _indexName: string,
    configure: (builder: TestIndexBuilder) => unknown,
  ): this {
    configure(new TestIndexBuilder(this.filters));
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

  private matchingRows(): TestRow[] {
    return this.rows.filter((row) =>
      this.filters.every(([field, value]) => row[field] === value),
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
  it("dedups a replay by the source-aware event index while retaining key writes", async () => {
    const db = createWritableDb();
    const args = webhookArgs("project_a", "apple", "notification_same");

    const first = await recordWebhookEvent._handler({ db }, args);
    expect(db.rows("webhookIdempotencyKeys")).toHaveLength(1);
    db.rows("webhookIdempotencyKeys").splice(0);
    const replay = await recordWebhookEvent._handler({ db }, args);

    expect(first.deduped).toBe(false);
    expect(replay).toEqual({ eventId: first.eventId, deduped: true });
    expect(db.rows("webhookEvents")).toHaveLength(1);
    expect(db.rows("webhookIdempotencyKeys")).toHaveLength(0);
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

  it("uses the event row for the Google preflight before the key fallback", async () => {
    const db = createWritableDb({
      webhookEvents: [
        {
          _id: "event_google",
          projectId: "project_a",
          source: "GooglePlayRealTimeDeveloperNotifications",
          sourceNotificationId: "message_a",
        },
        {
          _id: "event_apple",
          projectId: "project_a",
          source: "AppleAppStoreServerNotificationsV2",
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
    ).resolves.toBe("event_google");
  });

  it("retains the project-keyed preflight fallback during phase 1", async () => {
    const db = createWritableDb({
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
    ).resolves.toBe("event_from_key");
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
