import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { testableFunction } from "../test.setup";

import {
  assertUserSubscriptionRowLimit,
  entitlementsV2 as registeredEntitlementsV2,
  MAX_USER_SUBSCRIPTION_ROWS,
  selectReportingMrr,
  shapeSubscriptionEvaluationSnapshot,
  shapeSubscriptionRow,
  shapeSubscriptionV2Row,
  subscriptionStatusV2 as registeredSubscriptionStatusV2,
} from "./query";

const subscriptionStatusV2 = testableFunction(registeredSubscriptionStatusV2);
const entitlementsV2 = testableFunction(registeredEntitlementsV2);

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

  // Security debt, pinned so a removal is a deliberate decision: MAUI declares
  // purchaseToken `required` and drops the row when it is missing, so removing
  // it silently strips entitlement from every installed MAUI app.
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

describe("v2 account-read authorization", () => {
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
    for (const query of [subscriptionStatusV2, entitlementsV2]) {
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
    for (const query of [subscriptionStatusV2, entitlementsV2]) {
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
});
