import { afterEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { testableFunction } from "../test.setup";
import { statsContributionFor } from "./stats";
import { MemoryDb } from "../test.memoryDb";
import { metricsSummary } from "./query";

import {
  assertUserSubscriptionRowLimit,
  entitlementsV2 as registeredEntitlementsV2,
  entitlements as registeredEntitlements,
  MAX_USER_SUBSCRIPTION_ROWS,
  selectReportingMrr,
  shapeSubscriptionEvaluationSnapshot,
  shapeSubscriptionRow,
  shapeSubscriptionV2Row,
  subscriptionStatusV2 as registeredSubscriptionStatusV2,
  subscriptionStatus as registeredSubscriptionStatus,
  subscriptionEvaluationSnapshot as registeredSubscriptionEvaluationSnapshot,
} from "./query";

const subscriptionStatusV2 = testableFunction(registeredSubscriptionStatusV2);
const entitlementsV2 = testableFunction(registeredEntitlementsV2);
const legacyAccountReads = [
  testableFunction(registeredSubscriptionStatus),
  testableFunction(registeredEntitlements),
  testableFunction(registeredSubscriptionEvaluationSnapshot),
];

function subscriptionDoc(
  overrides: Partial<Doc<"subscriptions">>,
): Doc<"subscriptions"> {
  return {
    _id: "subscriptions_1" as Id<"subscriptions">,
    _creationTime: 0,
    projectId: "projects_1" as Id<"projects">,
    purchaseToken: "purchase_token_1",
    productId: "premium_monthly",
    platform: "IOS",
    state: "Active",
    startedAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

describe("selectReportingMrr", () => {
  it("uses only the reporting currency for the headline MRR", () => {
    const result = selectReportingMrr(
      [
        { currency: "EUR", mrrMicros: 8_500_000 },
        { currency: "USD", mrrMicros: 9_990_000 },
        { currency: "HUF", mrrMicros: 12_000_000 },
      ],
      "USD",
    );

    expect(result).toEqual({
      currency: "USD",
      mrrMicros: 9_990_000,
      excludedMrrByCurrency: [
        { currency: "EUR", mrrMicros: 8_500_000 },
        { currency: "HUF", mrrMicros: 12_000_000 },
      ],
    });
  });

  it("returns zero when the reporting currency has no matching MRR", () => {
    const result = selectReportingMrr(
      [
        { currency: "EUR", mrrMicros: 8_500_000 },
        { currency: "HUF", mrrMicros: 12_000_000 },
      ],
      "USD",
    );

    expect(result).toEqual({
      currency: "USD",
      mrrMicros: 0,
      excludedMrrByCurrency: [
        { currency: "EUR", mrrMicros: 8_500_000 },
        { currency: "HUF", mrrMicros: 12_000_000 },
      ],
    });
  });

  it("falls back to USD for invalid reporting currency input", () => {
    const result = selectReportingMrr(
      [
        { currency: "USD", mrrMicros: 9_990_000 },
        { currency: "EUR", mrrMicros: 8_500_000 },
      ],
      "US",
    );

    expect(result).toEqual({
      currency: "USD",
      mrrMicros: 9_990_000,
      excludedMrrByCurrency: [{ currency: "EUR", mrrMicros: 8_500_000 }],
    });
  });
});

describe("shapeSubscriptionRow", () => {
  it("exposes originalTransactionId for iOS subscription rows", () => {
    const row = shapeSubscriptionRow(
      subscriptionDoc({
        platform: "IOS",
        purchaseToken: "2000001177054625",
      }),
    );

    expect(row.purchaseToken).toBe("2000001177054625");
    expect(row.originalTransactionId).toBe("2000001177054625");
  });

  // Legacy server responses preserve the required MAUI field; mobile keys cannot read them.
  it("still carries the Play purchaseToken an installed MAUI app requires", () => {
    const row = shapeSubscriptionRow(
      subscriptionDoc({
        platform: "Android",
        purchaseToken: "play-token-1",
      }),
    );

    expect(row.purchaseToken).toBe("play-token-1");
    expect(row.originalTransactionId).toBeUndefined();
  });
});

describe("shapeSubscriptionV2Row", () => {
  it("keeps Amazon identity on tokenless v2 reads without adding fields to the v1 shape", () => {
    const sub = subscriptionDoc({
      platform: "Android",
      store: "amazon",
      purchaseToken: "amazon:private-evidence",
    });
    expect(shapeSubscriptionV2Row(sub)).toMatchObject({ store: "amazon" });
    expect(shapeSubscriptionV2Row(sub)).not.toHaveProperty("purchaseToken");
    expect(shapeSubscriptionRow(sub)).not.toHaveProperty("store");
  });
  it("omits both Android and Apple store credentials", () => {
    const row = shapeSubscriptionV2Row(
      subscriptionDoc({
        platform: "IOS",
        purchaseToken: "2000001177054625",
        userId: "user-1",
      }),
    );

    expect(row).toMatchObject({
      id: "subscriptions_1",
      productId: "premium_monthly",
      userId: "user-1",
    });
    expect(row).not.toHaveProperty("purchaseToken");
    expect(row).not.toHaveProperty("originalTransactionId");
  });
});

describe("account-read authorization", () => {
  const db = {
    rows: {
      apiKeys: [
        {
          _id: "apiKeys_1",
          key: "openiap-kit_pk_mobile",
          keyType: "publishable",
          isActive: true,
          projectId: "projects_1",
          organizationId: "organizations_1",
        },
        {
          _id: "apiKeys_2",
          key: "openiap-kit_sk_backend",
          keyType: "secret",
          isActive: true,
          projectId: "projects_1",
          organizationId: "organizations_1",
        },
      ],
      projects: [
        {
          _id: "projects_1",
          organizationId: "organizations_1",
        },
      ],
      organizations: [{ _id: "organizations_1" }],
      subscriptions: [
        subscriptionDoc({
          userId: "user-1",
          expiresAt: 10,
        }),
        subscriptionDoc({
          _id: "subscriptions_pass" as Id<"subscriptions">,
          userId: "user-pass",
          platform: "IOS",
          state: "Active",
          expiresAt: undefined,
        }),
        subscriptionDoc({
          _id: "subscriptions_grace" as Id<"subscriptions">,
          userId: "user-grace",
          platform: "IOS",
          state: "InGracePeriod",
          expiresAt: undefined,
        }),
      ],
    } as Record<string, Record<string, unknown>[]>,
    async get(id: string) {
      return (
        Object.values(this.rows)
          .flat()
          .find((row) => row._id === id) ?? null
      );
    },
    query(table: string) {
      const rows = this.rows[table] ?? [];
      return {
        withIndex: (_name: string, capture: (q: unknown) => unknown) => {
          const expected: Record<string, unknown> = {};
          const q: Record<string, (field: string, value: unknown) => unknown> =
            {};
          q.eq = (field, value) => {
            expected[field] = value;
            return q;
          };
          capture(q);
          const matches = () =>
            rows.filter((row) =>
              Object.entries(expected).every(
                ([field, value]) => row[field] === value,
              ),
            );
          return {
            first: async () => matches()[0] ?? null,
            order: () => ({
              take: async (limit: number) => matches().slice(0, limit),
            }),
          };
        },
      };
    },
  };

  it("rejects publishable keys inside Convex", async () => {
    const ctx = { db } as never;
    for (const query of [
      subscriptionStatusV2,
      entitlementsV2,
      ...legacyAccountReads,
    ]) {
      await expect(
        query._handler(ctx, {
          apiKey: "openiap-kit_pk_mobile",
          userId: "user-1",
          now: 1,
        }),
      ).rejects.toSatisfy(
        (error: unknown) =>
          (error as { data?: { code?: string } }).data?.code ===
          "INSUFFICIENT_SCOPE",
      );
    }
  });

  it("rejects an unknown secret-shaped key instead of returning empty data", async () => {
    const ctx = { db } as never;
    for (const query of [
      subscriptionStatusV2,
      entitlementsV2,
      ...legacyAccountReads,
    ]) {
      await expect(
        query._handler(ctx, {
          apiKey: "openiap-kit_sk_unknown",
          userId: "user-1",
          now: 1,
        }),
      ).rejects.toSatisfy(
        (error: unknown) =>
          (error as { data?: { code?: string } }).data?.code ===
          "INVALID_API_KEY",
      );
    }
  });

  it.each([
    ["production", ["shared", "event-derived"], "prod"],
    ["sandbox", ["shared", "test", "local-test"], "sandbox-only"],
    ["all", ["shared", "test", "local-test", "event-derived"], "sandbox-only"],
  ] as const)(
    "filters %s before status selection and product deduplication",
    async (environment, products, statusId) => {
      const previous = db.rows.subscriptions;
      db.rows.subscriptions = [
        subscriptionDoc({
          _id: "prod" as Id<"subscriptions">,
          userId: "mixed",
          productId: "shared",
          updatedAt: 10,
          environment: "Production",
        }),
        subscriptionDoc({
          _id: "sandbox" as Id<"subscriptions">,
          userId: "mixed",
          productId: "shared",
          updatedAt: 20,
          environment: "Sandbox",
        }),
        subscriptionDoc({
          _id: "sandbox-only" as Id<"subscriptions">,
          userId: "mixed",
          productId: "test",
          updatedAt: 30,
          environment: "Sandbox",
        }),
        subscriptionDoc({
          _id: "legacy" as Id<"subscriptions">,
          userId: "mixed",
          productId: "unknown",
          updatedAt: 50,
        }),
        subscriptionDoc({
          _id: "xcode" as Id<"subscriptions">,
          userId: "mixed",
          productId: "local-test",
          updatedAt: 15,
          environment: "Xcode",
        }),
        subscriptionDoc({
          _id: "event" as Id<"subscriptions">,
          userId: "mixed",
          productId: "event-derived",
          updatedAt: 5,
          lastEventSource: { environment: "Production" },
        }),
        subscriptionDoc({
          _id: "expired" as Id<"subscriptions">,
          userId: "mixed",
          productId: "expired",
          updatedAt: 99,
          expiresAt: 1,
          environment: "Production",
        }),
      ].map((row) => ({ ...row, expiresAt: row.expiresAt ?? 10 }));
      try {
        const args = {
          apiKey: "openiap-kit_sk_backend",
          userId: "mixed",
          now: 2,
          environment,
        };
        expect(await entitlementsV2._handler({ db }, args)).toMatchObject({
          environmentScope: environment,
          productIds: [...products],
        });
        expect(await subscriptionStatusV2._handler({ db }, args)).toMatchObject(
          {
            environmentScope: environment,
            active: true,
            subscription: { id: statusId },
          },
        );
        const legacyArgs = {
          apiKey: args.apiKey,
          userId: args.userId,
          now: args.now,
        };
        expect(
          await subscriptionStatusV2._handler({ db }, legacyArgs),
        ).toMatchObject({ active: true, subscription: { id: "legacy" } });
        expect(
          await entitlementsV2._handler({ db }, legacyArgs),
        ).not.toHaveProperty("environmentScope");
      } finally {
        db.rows.subscriptions = previous;
      }
    },
  );

  it("uses the caller-supplied time so cache keys advance past expiry", async () => {
    const ctx = { db } as never;
    const beforeExpiry = await subscriptionStatusV2._handler(ctx, {
      apiKey: "openiap-kit_sk_backend",
      userId: "user-1",
      now: 9,
    });
    const atExpiry = await subscriptionStatusV2._handler(ctx, {
      apiKey: "openiap-kit_sk_backend",
      userId: "user-1",
      now: 10,
    });
    const entitlements = await entitlementsV2._handler(ctx, {
      apiKey: "openiap-kit_sk_backend",
      userId: "user-1",
      now: 10,
    });

    expect(beforeExpiry.active).toBe(true);
    expect(atExpiry.active).toBe(false);
    expect(entitlements.productIds).toEqual([]);
  });

  it("never entitles an iOS row without an expiry (a non-renewing pass)", async () => {
    const ctx = { db } as never;
    const read = { apiKey: "openiap-kit_sk_backend", userId: "user-pass" };

    const status = await subscriptionStatusV2._handler(ctx, {
      ...read,
      now: 1,
    });
    const entitlements = await entitlementsV2._handler(ctx, {
      ...read,
      now: 1,
    });

    expect(status.active).toBe(false);
    expect(entitlements.productIds).toEqual([]);
  });

  it("keeps an iOS grace period without a deadline entitled", async () => {
    const ctx = { db } as never;
    const status = await subscriptionStatusV2._handler(ctx, {
      apiKey: "openiap-kit_sk_backend",
      userId: "user-grace",
      now: 1,
    });

    expect(status.active).toBe(true);
  });
});

describe("statsContributionFor", () => {
  it("keeps an iOS row without an expiry out of active counts and MRR", () => {
    const pass = subscriptionDoc({
      state: "Active",
      expiresAt: undefined,
      currency: "USD",
      priceAmountMicros: 9_990_000,
    });

    expect(statsContributionFor(pass, "P1M", 5)).toBeNull();
    expect(
      statsContributionFor({ ...pass, expiresAt: 10 }, "P1M", 5),
    ).toMatchObject({ state: "Active", mrrMicros: 9_990_000 });
  });
});

describe("assertUserSubscriptionRowLimit", () => {
  it("accepts the documented 200-row boundary", () => {
    const rows = Array.from(
      { length: MAX_USER_SUBSCRIPTION_ROWS },
      (_, index) =>
        subscriptionDoc({
          _id: `subscriptions_${index}` as Id<"subscriptions">,
        }),
    );

    expect(() => assertUserSubscriptionRowLimit(rows)).not.toThrow();
  });

  it("fails closed on the single overflow-probe row", () => {
    const rows = Array.from(
      { length: MAX_USER_SUBSCRIPTION_ROWS + 1 },
      (_, index) =>
        subscriptionDoc({
          _id: `subscriptions_${index}` as Id<"subscriptions">,
        }),
    );

    try {
      assertUserSubscriptionRowLimit(rows);
      throw new Error("Expected the subscription row limit to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ConvexError);
      expect(
        (error as ConvexError<{ code: string; message: string }>).data,
      ).toEqual({
        code: "ENTITLEMENT_SNAPSHOT_TOO_LARGE",
        message:
          "This user has more than 200 subscription rows. Contact IAPKit support before retrying.",
      });
    }
  });
});

describe("shapeSubscriptionEvaluationSnapshot", () => {
  it("exposes only entitlement candidates and the latest status fallback", () => {
    const rows = [
      subscriptionDoc({
        _id: "subscriptions_latest" as Id<"subscriptions">,
        state: "Expired",
        updatedAt: 4,
        purchaseToken: "latest-token",
      }),
      subscriptionDoc({
        _id: "subscriptions_active" as Id<"subscriptions">,
        state: "Active",
        expiresAt: 10,
        updatedAt: 3,
        purchaseToken: "active-token",
      }),
      subscriptionDoc({
        _id: "subscriptions_refunded" as Id<"subscriptions">,
        state: "Refunded",
        updatedAt: 2,
        purchaseToken: "historical-token",
      }),
    ];

    const snapshot = shapeSubscriptionEvaluationSnapshot(rows);

    expect(snapshot.candidates).toHaveLength(1);
    expect(snapshot.candidates[0]?.id).toBe("subscriptions_active");
    expect(snapshot.candidates[0]?.createdAt).toBe(0);
    expect(snapshot.fallback?.createdAt).toBe(0);
    expect(snapshot.candidates[0]?.purchaseToken).toBe("active-token");
    expect(snapshot.fallback?.purchaseToken).toBe("latest-token");
    expect(JSON.stringify(snapshot)).not.toContain("historical-token");
  });

  it("drops a legacy non-renewing pass but keeps a store-governed row", () => {
    const snapshot = shapeSubscriptionEvaluationSnapshot([
      subscriptionDoc({
        _id: "subscriptions_pass" as Id<"subscriptions">,
        state: "Active",
        expiresAt: undefined,
      }),
      subscriptionDoc({
        _id: "subscriptions_recovered" as Id<"subscriptions">,
        state: "Active",
        expiresAt: undefined,
        lastEventId: "webhookEvents_1" as Id<"webhookEvents">,
      }),
    ]);

    expect(snapshot.candidates.map((row) => row.id)).toEqual([
      "subscriptions_recovered",
    ]);
  });
});

describe("metricsSummary byte budgets", () => {
  afterEach(() => vi.useRealTimers());
  function fixture() {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(100_000);
    const db = new MemoryDb();
    const projectId = "projects_metrics";
    db.seed("organizations", { _id: "organizations_metrics" });
    db.seed("projects", {
      _id: projectId,
      organizationId: "organizations_metrics",
    });
    db.seed("apiKeys", {
      key: "openiap-kit_sk_metrics_budget",
      keyType: "secret",
      isActive: true,
      projectId,
      organizationId: "organizations_metrics",
    });
    return {
      db,
      projectId,
      args: { apiKey: "openiap-kit_sk_metrics_budget", refreshAt: Date.now() },
    };
  }
  it("marks a byte-limited subscription page incomplete", async () => {
    const { db, projectId, args } = fixture();
    const description = "x".repeat(100_000);
    for (let i = 0; i < 100; i++)
      db.seed("subscriptions", {
        projectId,
        productId: "premium",
        platform: "Android",
        state: "Active",
        purchaseToken: `budget-${i}`,
        environment: "Production",
        startedAt: 1,
        updatedAt: Date.now(),
        cancellationReason: description,
      });
    const result = await testableFunction(metricsSummary)._handler(
      { db },
      args,
    );
    expect(result.stats.state).toBe("incomplete");
    expect(result.activeSubs).toBeLessThan(100);
    expect(result.recentCountsTruncated).toBe(true);
  });
  it("bounds distinct catalog lookups even when every product is missing", async () => {
    const { db, projectId, args } = fixture();
    for (let i = 0; i < 300; i++)
      db.seed("subscriptions", {
        projectId,
        productId: `missing-${i}`,
        platform: "Android",
        state: "Active",
        purchaseToken: `missing-${i}`,
        environment: "Production",
        startedAt: 1,
        updatedAt: Date.now(),
      });
    const reads = vi.spyOn(db, "query");
    const result = await testableFunction(metricsSummary)._handler(
      { db },
      args,
    );
    expect(result.stats.state).toBe("incomplete");
    expect(
      reads.mock.calls.filter(([table]) => table === "products"),
    ).toHaveLength(250);
    expect(result.recentCountsTruncated).toBe(false);
  });

  it("bounds catalog reads even when all subscriptions fit", async () => {
    const { db, projectId, args } = fixture();
    for (let i = 0; i < 8; i++) {
      const productId = `premium-${i}`;
      db.seed("products", {
        projectId,
        platform: "Android",
        productId,
        billingPeriod: "P1M",
        description: "x".repeat(900_000),
      });
      db.seed("subscriptions", {
        projectId,
        productId,
        platform: "Android",
        state: "Active",
        purchaseToken: `catalog-${i}`,
        environment: "Production",
        startedAt: 1,
        updatedAt: Date.now(),
      });
    }
    const reads = vi.spyOn(db, "query");
    const result = await testableFunction(metricsSummary)._handler(
      { db },
      args,
    );
    expect(result.stats.state).toBe("incomplete");
    expect(
      reads.mock.calls.filter(([table]) => table === "products"),
    ).toHaveLength(3);
    expect(result.recentCountsTruncated).toBe(false);
  });
});
