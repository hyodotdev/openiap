import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";

import { selectReportingMrr, shapeSubscriptionRow } from "./query";

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
