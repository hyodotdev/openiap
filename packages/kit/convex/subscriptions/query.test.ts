import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

import {
  assertUserSubscriptionRowLimit,
  MAX_USER_SUBSCRIPTION_ROWS,
  selectReportingMrr,
  shapeSubscriptionEvaluationSnapshot,
  shapeSubscriptionRow,
} from "./query";

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

  it("keeps Android rows on the Play purchaseToken only", () => {
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
    expect(snapshot.candidates[0]?.purchaseToken).toBe("active-token");
    expect(snapshot.candidates[0]?.createdAt).toBe(0);
    expect(snapshot.fallback?.purchaseToken).toBe("latest-token");
    expect(snapshot.fallback?.createdAt).toBe(0);
    expect(JSON.stringify(snapshot)).not.toContain("historical-token");
  });
});
