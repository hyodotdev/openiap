import { describe, expect, it, test } from "vitest";
import { extractProductIdFromRemoteResponse } from "./shared";

describe("extractProductIdFromRemoteResponse (horizon)", () => {
  test("returns null when remoteResponse is missing or malformed", () => {
    expect(extractProductIdFromRemoteResponse("horizon", undefined)).toBeNull();
    expect(extractProductIdFromRemoteResponse("horizon", null)).toBeNull();
    expect(extractProductIdFromRemoteResponse("horizon", "")).toBeNull();
    expect(
      extractProductIdFromRemoteResponse("horizon", "not json"),
    ).toBeNull();
  });

  test("returns the packed sku from the persisted payload", () => {
    const remote = JSON.stringify({
      success: true,
      grant_time: 1_744_148_687,
      sku: "coin_pack_100",
    });
    expect(extractProductIdFromRemoteResponse("horizon", remote)).toBe(
      "coin_pack_100",
    );
  });

  test("returns null when sku is missing or wrong type", () => {
    expect(
      extractProductIdFromRemoteResponse(
        "horizon",
        JSON.stringify({ success: true, grant_time: 1 }),
      ),
    ).toBeNull();
    expect(
      extractProductIdFromRemoteResponse(
        "horizon",
        JSON.stringify({ success: true, sku: 42 }),
      ),
    ).toBeNull();
  });
});

describe("extractProductIdFromRemoteResponse (amazon)", () => {
  test("returns the Amazon RVS productId from the persisted payload", () => {
    const remote = JSON.stringify({
      productId: "dev.hyo.martie.premium",
      productType: "SUBSCRIPTION",
      receiptId: "receipt-123",
    });

    expect(extractProductIdFromRemoteResponse("amazon", remote)).toBe(
      "dev.hyo.martie.premium",
    );
  });

  test("returns null when the Amazon productId is missing or wrong type", () => {
    expect(
      extractProductIdFromRemoteResponse(
        "amazon",
        JSON.stringify({ receiptId: "receipt-123" }),
      ),
    ).toBeNull();
    expect(
      extractProductIdFromRemoteResponse(
        "amazon",
        JSON.stringify({ productId: 42 }),
      ),
    ).toBeNull();
  });
});

describe("extractProductIdFromRemoteResponse", () => {
  it("returns null when remoteResponse is missing", () => {
    expect(extractProductIdFromRemoteResponse("apple", undefined)).toBeNull();
    expect(extractProductIdFromRemoteResponse("apple", null)).toBeNull();
    expect(extractProductIdFromRemoteResponse("apple", "")).toBeNull();
  });

  it("returns null when remoteResponse is not valid JSON", () => {
    expect(extractProductIdFromRemoteResponse("apple", "not json")).toBeNull();
  });

  it("reads productId from a top-level apple payload", () => {
    expect(
      extractProductIdFromRemoteResponse(
        "apple",
        JSON.stringify({ productId: "monthly_pro", foo: 1 }),
      ),
    ).toBe("monthly_pro");
  });

  it("returns null for apple payloads without productId", () => {
    expect(
      extractProductIdFromRemoteResponse("apple", JSON.stringify({ foo: 1 })),
    ).toBeNull();
  });

  it("reads productId from a google v2 productLineItem", () => {
    expect(
      extractProductIdFromRemoteResponse(
        "google",
        JSON.stringify({
          productLineItem: [{ productId: "untold_full" }],
        }),
      ),
    ).toBe("untold_full");
  });

  it("reads productId from a google subscription lineItems array", () => {
    expect(
      extractProductIdFromRemoteResponse(
        "google",
        JSON.stringify({
          lineItems: [{ productId: "pro_monthly" }],
        }),
      ),
    ).toBe("pro_monthly");
  });

  it("is null-safe when google line-item arrays are empty", () => {
    expect(
      extractProductIdFromRemoteResponse(
        "google",
        JSON.stringify({ productLineItem: [] }),
      ),
    ).toBeNull();
    expect(
      extractProductIdFromRemoteResponse(
        "google",
        JSON.stringify({ lineItems: [] }),
      ),
    ).toBeNull();
  });

  it("ignores non-string productId values", () => {
    expect(
      extractProductIdFromRemoteResponse(
        "apple",
        JSON.stringify({ productId: 42 }),
      ),
    ).toBeNull();
  });
});
