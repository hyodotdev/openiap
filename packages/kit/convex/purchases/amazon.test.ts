import { describe, expect, test, vi } from "vitest";

import {
  buildAmazonRemoteId,
  mapAmazonReceiptState,
  parseAmazonReceiptResponse,
} from "./amazon";
import { AmazonReceiptVerificationError } from "./errors";
import { HarmonizedPurchaseState } from "./purchaseState";

describe("buildAmazonRemoteId", () => {
  test("separates sandbox and production receipts", () => {
    expect(
      buildAmazonRemoteId({
        userId: "user/one",
        receiptId: "receipt:one",
        sandbox: true,
      }),
    ).toBe("sandbox:user%2Fone:receipt%3Aone");

    expect(
      buildAmazonRemoteId({
        userId: "user/one",
        receiptId: "receipt:one",
        sandbox: false,
      }),
    ).toBe("production:user%2Fone:receipt%3Aone");
  });
});

describe("mapAmazonReceiptState", () => {
  test("maps canceled receipts before product type handling", () => {
    expect(
      mapAmazonReceiptState({
        cancelDate: 1_700_000_000_000,
        productType: "CONSUMABLE",
      }),
    ).toBe(HarmonizedPurchaseState.CANCELED);
  });

  test("maps Amazon product types to harmonized states", () => {
    expect(mapAmazonReceiptState({ productType: "CONSUMABLE" })).toBe(
      HarmonizedPurchaseState.READY_TO_CONSUME,
    );
    expect(mapAmazonReceiptState({ productType: "ENTITLED" })).toBe(
      HarmonizedPurchaseState.ENTITLED,
    );
    expect(mapAmazonReceiptState({ productType: "SUBSCRIPTION" })).toBe(
      HarmonizedPurchaseState.ENTITLED,
    );
  });

  test("maps expired subscription renewalDate to expired", () => {
    vi.spyOn(Date, "now").mockReturnValue(2_000);

    expect(
      mapAmazonReceiptState({
        productType: "SUBSCRIPTION",
        renewalDate: 1_000,
      }),
    ).toBe(HarmonizedPurchaseState.EXPIRED);

    vi.restoreAllMocks();
  });

  test("falls back to unknown for unrecognized product types", () => {
    expect(mapAmazonReceiptState({ productType: "FUTURE_KIND" })).toBe(
      HarmonizedPurchaseState.UNKNOWN,
    );
  });
});

describe("parseAmazonReceiptResponse", () => {
  test("accepts object responses from RVS", () => {
    const raw = {
      productId: "dev.hyo.martie.premium",
      productType: "SUBSCRIPTION",
    };

    expect(parseAmazonReceiptResponse(raw)).toBe(raw);
  });

  test("rejects non-object RVS responses", () => {
    expect(() => parseAmazonReceiptResponse(null)).toThrow(
      AmazonReceiptVerificationError,
    );
    expect(() => parseAmazonReceiptResponse("not-json")).toThrow(
      AmazonReceiptVerificationError,
    );
  });
});
