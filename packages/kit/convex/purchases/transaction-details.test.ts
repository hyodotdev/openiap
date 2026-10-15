import { describe, expect, it } from "vitest";

import { googlePlayTransactionDetails } from "./android";
import { appStoreTransactionDetails } from "./ios";

// Verify returns the identifiers commerce events carry, under the same names:
// Apple's transaction ids, and a Google order id as transactionId only.
describe("transaction details", () => {
  it("takes Apple's transaction ids and subscription expiry", () => {
    expect(
      appStoreTransactionDetails({
        transactionId: "2000000000000002",
        originalTransactionId: "2000000000000001",
        expiresDate: 1_800_000_000_000,
        environment: "Production",
      }),
    ).toEqual({
      transactionId: "2000000000000002",
      originalTransactionId: "2000000000000001",
      expiresAt: 1_800_000_000_000,
    });
    expect(
      appStoreTransactionDetails({
        transactionId: "3",
        originalTransactionId: "3",
        environment: "Sandbox",
      }),
    ).toEqual({ transactionId: "3", originalTransactionId: "3" });
  });

  it("never labels a Play purchase token as a transaction id", () => {
    const receipt = {
      transactionId: "play-purchase-token",
      packageName: "com.example",
      productId: "premium",
      purchaseToken: "play-purchase-token",
      purchaseDate: 0,
      quantity: 1,
    };
    expect(
      googlePlayTransactionDetails({
        ...receipt,
        type: "Subscription",
        orderId: "GPA.1234-5678-9012-34567..1",
        expiryTime: 1_800_000_000_000,
      }),
    ).toEqual({
      transactionId: "GPA.1234-5678-9012-34567..1",
      expiresAt: 1_800_000_000_000,
    });
    expect(
      googlePlayTransactionDetails({
        ...receipt,
        type: "InApp",
        expiryTime: 1_800_000_000_000,
      }),
    ).toEqual({});
  });
});
