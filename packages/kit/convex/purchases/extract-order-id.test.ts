import { describe, expect, it } from "vitest";

import { extractOrderIdFromRemoteResponse } from "./shared";

/**
 * Unit tests for the write-time orderId extractor that feeds the
 * secondary (projectId, applicationId, orderId) dedup key. The goal is
 * to accept exactly the response shapes `verifyGooglePlayReceiptInternalV1`
 * persists today — and to stay silent (return null) on shapes that
 * genuinely have no stable identifier, because returning a wrong
 * orderId would merge unrelated purchases.
 */
describe("extractOrderIdFromRemoteResponse", () => {
  it("returns null for non-Google stores", () => {
    expect(
      extractOrderIdFromRemoteResponse(
        "apple",
        JSON.stringify({ orderId: "GPA.1234-5678" }),
      ),
    ).toBeNull();
    expect(
      extractOrderIdFromRemoteResponse(
        "horizon",
        JSON.stringify({ orderId: "GPA.1234-5678" }),
      ),
    ).toBeNull();
  });

  it("returns null for missing / malformed responses", () => {
    expect(extractOrderIdFromRemoteResponse("google", undefined)).toBeNull();
    expect(extractOrderIdFromRemoteResponse("google", null)).toBeNull();
    expect(extractOrderIdFromRemoteResponse("google", "")).toBeNull();
    expect(extractOrderIdFromRemoteResponse("google", "not json")).toBeNull();
  });

  it("reads top-level orderId from a Products v2 response", () => {
    const raw = JSON.stringify({
      kind: "androidpublisher#productPurchase",
      orderId: "GPA.3328-5001-2345-67890",
      acknowledgementState: "ACKNOWLEDGMENT_STATE_ACKNOWLEDGED",
      productLineItem: [{ productId: "dlc_mt_karnak" }],
      regionCode: "SE",
    });
    expect(extractOrderIdFromRemoteResponse("google", raw)).toBe(
      "GPA.3328-5001-2345-67890",
    );
  });

  it("returns null when orderId is absent (pending-ack Products v2)", () => {
    const raw = JSON.stringify({
      kind: "androidpublisher#productPurchase",
      acknowledgementState: "ACKNOWLEDGMENT_STATE_PENDING",
      productLineItem: [{ productId: "dlc_mt_karnak" }],
      regionCode: "SE",
    });
    expect(extractOrderIdFromRemoteResponse("google", raw)).toBeNull();
  });

  it("prefers lineItems[].latestSuccessfulOrderId for Subscriptions v2", () => {
    const raw = JSON.stringify({
      kind: "androidpublisher#subscriptionPurchaseV2",
      latestOrderId: "GPA.sub-latest-top",
      lineItems: [
        {
          productId: "pro_monthly",
          latestSuccessfulOrderId: "GPA.sub-line-preferred",
        },
      ],
    });
    expect(extractOrderIdFromRemoteResponse("google", raw)).toBe(
      "GPA.sub-line-preferred",
    );
  });

  it("falls back to top-level latestOrderId when line items lack an order id", () => {
    const raw = JSON.stringify({
      kind: "androidpublisher#subscriptionPurchaseV2",
      latestOrderId: "GPA.sub-latest-top",
      lineItems: [{ productId: "pro_monthly" }],
    });
    expect(extractOrderIdFromRemoteResponse("google", raw)).toBe(
      "GPA.sub-latest-top",
    );
  });

  it("returns null when the payload carries a non-string orderId", () => {
    expect(
      extractOrderIdFromRemoteResponse(
        "google",
        JSON.stringify({ orderId: 42 }),
      ),
    ).toBeNull();
  });

  it("returns null when orderId is an empty string", () => {
    // Defensive: an empty orderId from Google would collapse unrelated
    // purchases into one row under the secondary dedup.
    expect(
      extractOrderIdFromRemoteResponse(
        "google",
        JSON.stringify({ orderId: "" }),
      ),
    ).toBeNull();
  });

  it("returns null on error-body responses (no Google identifier present)", () => {
    // persistFailedGoogleReceipt stores a `{ errorCode, message }`
    // envelope when Google returns 4xx — these rows must not be
    // treated as a dedup target.
    expect(
      extractOrderIdFromRemoteResponse(
        "google",
        JSON.stringify({
          errorCode: "PLAYSTORE_PURCHASE_NOT_FOUND",
          message: "Purchase not found",
          details: null,
        }),
      ),
    ).toBeNull();
  });
});
