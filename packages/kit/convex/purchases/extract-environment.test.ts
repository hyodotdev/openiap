import { describe, expect, it } from "vitest";

import { extractEnvironmentFromRemoteResponse } from "./shared";

/**
 * The environment a purchase row shows comes from the response the store sent.
 * It must stay null when the response does not say, so the dashboard shows
 * "Not reported" instead of a guess.
 */
describe("extractEnvironmentFromRemoteResponse", () => {
  it("returns null for missing or malformed responses", () => {
    expect(extractEnvironmentFromRemoteResponse("apple", undefined)).toBeNull();
    expect(extractEnvironmentFromRemoteResponse("google", null)).toBeNull();
    expect(extractEnvironmentFromRemoteResponse("google", "")).toBeNull();
    expect(
      extractEnvironmentFromRemoteResponse("apple", "not json"),
    ).toBeNull();
    expect(extractEnvironmentFromRemoteResponse("apple", "null")).toBeNull();
  });

  it("reads Apple's environment and counts every non-production one as Sandbox", () => {
    const apple = (environment: string) =>
      extractEnvironmentFromRemoteResponse(
        "apple",
        JSON.stringify({ productId: "premium", environment }),
      );
    expect(apple("Production")).toBe("Production");
    expect(apple("Sandbox")).toBe("Sandbox");
    expect(apple("Xcode")).toBe("Sandbox");
    expect(
      extractEnvironmentFromRemoteResponse(
        "apple",
        JSON.stringify({ productId: "premium" }),
      ),
    ).toBeNull();
  });

  it("reads a Google one-time purchase from testPurchaseContext", () => {
    const productLineItem = [{ productId: "coins_500" }];
    expect(
      extractEnvironmentFromRemoteResponse(
        "google",
        JSON.stringify({ productLineItem }),
      ),
    ).toBe("Production");
    expect(
      extractEnvironmentFromRemoteResponse(
        "google",
        JSON.stringify({
          productLineItem,
          testPurchaseContext: { fopType: "TEST" },
        }),
      ),
    ).toBe("Sandbox");
  });

  it("reads a Google subscription from testPurchase", () => {
    const lineItems = [{ productId: "premium_monthly" }];
    expect(
      extractEnvironmentFromRemoteResponse(
        "google",
        JSON.stringify({ lineItems }),
      ),
    ).toBe("Production");
    expect(
      extractEnvironmentFromRemoteResponse(
        "google",
        JSON.stringify({ lineItems, testPurchase: {} }),
      ),
    ).toBe("Sandbox");
  });

  it("returns null for a Google error body", () => {
    expect(
      extractEnvironmentFromRemoteResponse(
        "google",
        JSON.stringify({
          errorCode: "PLAYSTORE_PURCHASE_VERIFICATION_FAILED",
          message: "Google returned 500",
        }),
      ),
    ).toBeNull();
  });

  it("returns null for Horizon, and for Amazon, whose caller passes it", () => {
    expect(
      extractEnvironmentFromRemoteResponse(
        "horizon",
        JSON.stringify({ success: true, sku: "level_pack_2" }),
      ),
    ).toBeNull();
    expect(
      extractEnvironmentFromRemoteResponse(
        "amazon",
        JSON.stringify({ productId: "premium", environment: "Sandbox" }),
      ),
    ).toBeNull();
  });
});
