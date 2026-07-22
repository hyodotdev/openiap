import { describe, expect, it, vi } from "vitest";

import { recordHorizonStatus as registeredRecordHorizonStatus } from "./horizonInternal";
import { testableFunction } from "../test.setup";

const recordHorizonStatus = testableFunction(registeredRecordHorizonStatus);

interface TestRow {
  _id: string;
  [field: string]: unknown;
}

class EqualityBuilder {
  readonly filters: Array<[field: string, value: unknown]> = [];

  eq(field: string, value: unknown): this {
    this.filters.push([field, value]);
    return this;
  }
}

function indexedUniqueQuery(rows: TestRow[]) {
  return {
    withIndex(
      _indexName: string,
      configure: (builder: EqualityBuilder) => unknown,
    ) {
      const builder = new EqualityBuilder();
      configure(builder);
      const matches = rows.filter((row) =>
        builder.filters.every(([field, value]) => row[field] === value),
      );
      return {
        unique: async (): Promise<TestRow | null> => {
          if (matches.length > 1) {
            throw new Error(
              `Expected at most one row, received ${matches.length}`,
            );
          }
          return matches[0] ?? null;
        },
      };
    },
  };
}

function createHorizonHarness(eventRows: TestRow[], lastEventId: string) {
  const organization: TestRow = { _id: "organization_a" };
  const project: TestRow = {
    _id: "project_a",
    organizationId: organization._id,
  };
  const subscription: TestRow = {
    _id: "subscription_a",
    projectId: project._id,
    purchaseToken: "purchase_token",
    productId: "premium_monthly",
    platform: "Android",
    state: "Expired",
    lastEventId,
  };
  const events = eventRows.map((row) => ({ ...row }));
  const insert = vi.fn(
    async (table: string, value: Record<string, unknown>): Promise<string> => {
      if (table !== "webhookEvents") {
        throw new Error(`Unexpected insert table: ${table}`);
      }
      const id = "event_meta_new";
      events.push({ _id: id, ...value });
      return id;
    },
  );
  const patch = vi.fn(
    async (id: string, value: Record<string, unknown>): Promise<void> => {
      if (id !== subscription._id) {
        throw new Error(`Unexpected patch row: ${id}`);
      }
      Object.assign(subscription, value);
    },
  );
  const get = vi.fn(async (id: string): Promise<TestRow | null> => {
    if (id === organization._id) return organization;
    if (id === project._id) return project;
    if (id === subscription._id) return subscription;
    return events.find((event) => event._id === id) ?? null;
  });
  const query = vi.fn((table: string) => {
    if (table === "subscriptions") return indexedUniqueQuery([subscription]);
    if (table === "webhookEvents") return indexedUniqueQuery(events);
    throw new Error(`Unexpected query table: ${table}`);
  });

  return {
    db: { get, insert, patch, query },
    events,
    insert,
    subscription,
  };
}

const horizonArgs = {
  projectId: "project_a" as never,
  purchaseToken: "purchase_token",
  userId: "user_a",
  productId: "premium_monthly",
  eventType: "SubscriptionExpired" as const,
};
const horizonNotificationId =
  "meta-horizon-SubscriptionExpired-purchase_token-premium_monthly";

describe("recordHorizonStatus source-aware dedup", () => {
  it("does not reuse another source's event with the same notification id", async () => {
    const harness = createHorizonHarness(
      [
        {
          _id: "event_apple",
          projectId: "project_a",
          source: "AppleAppStoreServerNotificationsV2",
          sourceNotificationId: horizonNotificationId,
        },
      ],
      "event_apple",
    );

    await expect(
      recordHorizonStatus._handler({ db: harness.db }, horizonArgs),
    ).resolves.toBe("subscription_a");

    expect(harness.insert).toHaveBeenCalledTimes(1);
    expect(harness.events).toEqual([
      expect.objectContaining({ _id: "event_apple" }),
      expect.objectContaining({
        _id: "event_meta_new",
        projectId: "project_a",
        source: "MetaHorizonReconciler",
        sourceNotificationId: horizonNotificationId,
      }),
    ]);
    expect(harness.subscription.lastEventId).toBe("event_meta_new");
  });

  it("reuses the Meta event when another source has the same notification id", async () => {
    const harness = createHorizonHarness(
      [
        {
          _id: "event_apple",
          projectId: "project_a",
          source: "AppleAppStoreServerNotificationsV2",
          sourceNotificationId: horizonNotificationId,
        },
        {
          _id: "event_meta",
          projectId: "project_a",
          source: "MetaHorizonReconciler",
          sourceNotificationId: horizonNotificationId,
        },
      ],
      "event_meta",
    );

    await expect(
      recordHorizonStatus._handler({ db: harness.db }, horizonArgs),
    ).resolves.toBe("subscription_a");

    expect(harness.insert).not.toHaveBeenCalled();
    expect(harness.events).toHaveLength(2);
    expect(harness.subscription.lastEventId).toBe("event_meta");
  });
});
