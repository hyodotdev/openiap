import { describe, expect, it } from "vitest";
import {
  isProductNotFoundError,
  mapProductResponseToReceiptData,
  mapSubscriptionResponseToReceiptData,
  parseTimeToMillis,
} from "./android";
import { HarmonizedPurchaseState } from "./purchaseState";
import { mapToGooglePlayReceiptResponse } from "./shared";

const packageName = "com.example.app";

describe("parseTimeToMillis", () => {
  it("accepts decimal epoch millis and RFC3339 timestamps", () => {
    expect(parseTimeToMillis("1700000000000")).toBe(1_700_000_000_000);
    expect(parseTimeToMillis(" 1700000000000 ")).toBe(1_700_000_000_000);
    expect(parseTimeToMillis("2025-10-13T20:13:42.748Z")).toBe(
      Date.parse("2025-10-13T20:13:42.748Z"),
    );
  });

  it("rejects malformed, numeric-like, and unsafe timestamps", () => {
    expect(parseTimeToMillis(undefined)).toBeUndefined();
    expect(parseTimeToMillis("")).toBeUndefined();
    expect(parseTimeToMillis("0x10")).toBeUndefined();
    expect(parseTimeToMillis("+1000")).toBeUndefined();
    expect(parseTimeToMillis("1e3")).toBeUndefined();
    expect(parseTimeToMillis("123.45")).toBeUndefined();
    expect(
      parseTimeToMillis(String(Number.MAX_SAFE_INTEGER + 1)),
    ).toBeUndefined();
    expect(parseTimeToMillis("not-a-date")).toBeUndefined();
  });
});

describe("Google Play v2 mappings", () => {
  it("maps productsv2.getproductpurchasev2 PURCHASED + acknowledged + not consumed to ENTITLED", () => {
    const fixtures = [
      {
        kind: "androidpublisher#productPurchaseV2",
        purchaseStateContext: {
          purchaseState: "PURCHASED",
        },
        orderId: "GPA.3398-7378-8657-58818",
        regionCode: "US",
        productLineItem: [
          {
            productId: "untold_full",
            productOfferDetails: {
              purchaseOptionId: "legacy-base",
              quantity: 1,
              refundableQuantity: 1,
              consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
            },
          },
        ],
        purchaseCompletionTime: "2025-10-13T20:13:42.748Z",
        acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
      },
      {
        kind: "androidpublisher#productPurchaseV2",
        purchaseStateContext: {
          purchaseState: "PURCHASED",
        },
        regionCode: "BR",
        productLineItem: [
          {
            productId: "red_tide_full_premium",
            productOfferDetails: {
              quantity: 1,
              refundableQuantity: 1,
              consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
            },
          },
        ],
        purchaseCompletionTime: "2025-09-03T13:15:14.436Z",
        acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
      },
    ];

    fixtures.forEach((productPurchaseV2Response) => {
      const receipt = mapProductResponseToReceiptData({
        packageName,
        purchaseToken: "",
        productResponse: productPurchaseV2Response,
      });

      const response = mapToGooglePlayReceiptResponse(receipt);

      expect(response).toEqual({
        isValid: true,
        state: HarmonizedPurchaseState.ENTITLED,
        productId: productPurchaseV2Response.productLineItem[0].productId,
      });
    });
  });

  it("maps subscriptionsv2.get active + acknowledged to ENTITLED", () => {
    const subscriptionResponse = {
      kind: "androidpublisher#subscriptionPurchaseV2",
      latestOrderId: "GPA.1234-5678-9012-34567",
      startTime: "2025-10-13T20:13:42.748Z",
      regionCode: "US",
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
      lineItems: [
        {
          productId: "untold_premium",
          expiryTime: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
          latestSuccessfulOrderId: "GPA.1234-5678-9012-34567",
          productOfferDetails: {
            basePlanId: "legacy-base",
            offerId: "default",
          },
        },
      ],
    };

    const receipt = mapSubscriptionResponseToReceiptData({
      packageName,
      purchaseToken: "",
      subscriptionResponse,
    });

    const response = mapToGooglePlayReceiptResponse(receipt);

    expect(response).toEqual({
      isValid: true,
      state: HarmonizedPurchaseState.ENTITLED,
      productId: "untold_premium",
    });
  });

  it("maps productsv2.get purchased consumable that has been consumed to CONSUMED", () => {
    const productPurchaseV2Response = {
      kind: "androidpublisher#productPurchaseV2",
      purchaseStateContext: {
        purchaseState: "PURCHASED",
      },
      testPurchaseContext: {
        fopType: "TEST",
      },
      orderId: "GPA.3342-0309-2354-68832",
      regionCode: "KR",
      productLineItem: [
        {
          productId: "dev.hyo.martie.10bulbs",
          productOfferDetails: {
            purchaseOptionId: "legacy-base",
            quantity: 1,
            refundableQuantity: 1,
            consumptionState: "CONSUMPTION_STATE_CONSUMED",
          },
        },
      ],
      purchaseCompletionTime: "2025-11-29T20:55:50.841Z",
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    };

    const receipt = mapProductResponseToReceiptData({
      packageName,
      purchaseToken: "",
      productResponse: productPurchaseV2Response,
    });

    const response = mapToGooglePlayReceiptResponse(receipt);

    expect(response).toEqual({
      isValid: false,
      state: HarmonizedPurchaseState.CONSUMED,
      productId: "dev.hyo.martie.10bulbs",
    });
  });

  it("maps subscriptionsv2.get expired to EXPIRED", () => {
    const subscriptionResponse = {
      kind: "androidpublisher#subscriptionPurchaseV2",
      startTime: "2025-12-06T09:50:22.086Z",
      regionCode: "KR",
      subscriptionState: "SUBSCRIPTION_STATE_EXPIRED",
      latestOrderId: "GPA.3380-7655-9819-83850",
      testPurchase: {},
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
      lineItems: [
        {
          productId: "dev.hyo.martie.premium",
          expiryTime: "2025-12-06T09:55:21.497Z",
          prepaidPlan: {},
          offerDetails: {
            basePlanId: "premium",
          },
          latestSuccessfulOrderId: "GPA.3380-7655-9819-83850",
        },
      ],
    };

    const receipt = mapSubscriptionResponseToReceiptData({
      packageName,
      purchaseToken: "",
      subscriptionResponse,
    });

    const response = mapToGooglePlayReceiptResponse(receipt);

    expect(response).toEqual({
      isValid: false,
      state: HarmonizedPurchaseState.EXPIRED,
      productId: "dev.hyo.martie.premium",
    });
  });

  it("maps productsv2.get PURCHASED + not acknowledged to PENDING_ACKNOWLEDGMENT", () => {
    const productPurchaseV2Response = {
      kind: "androidpublisher#productPurchaseV2",
      purchaseStateContext: {
        purchaseState: "PURCHASED",
      },
      testPurchaseContext: {
        fopType: "TEST",
      },
      orderId: "GPA.3369-3299-1934-88739",
      regionCode: "KR",
      productLineItem: [
        {
          productId: "dev.hyo.martie.10bulbs",
          productOfferDetails: {
            purchaseOptionId: "legacy-base",
            quantity: 1,
            refundableQuantity: 1,
            consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
          },
        },
      ],
      purchaseCompletionTime: "2025-12-07T09:01:52.107Z",
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
    };

    const receipt = mapProductResponseToReceiptData({
      packageName,
      purchaseToken: "",
      productResponse: productPurchaseV2Response,
    });

    const response = mapToGooglePlayReceiptResponse(receipt);

    expect(response).toEqual({
      isValid: true,
      state: HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT,
      productId: "dev.hyo.martie.10bulbs",
    });
  });

  it("maps productsv2.get PENDING to PENDING", () => {
    const productPurchaseV2Response = {
      kind: "androidpublisher#productPurchaseV2",
      purchaseStateContext: { purchaseState: "PENDING" },
      productLineItem: [
        {
          productId: "test.product",
          productOfferDetails: {
            quantity: 1,
            refundableQuantity: 1,
            consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
          },
        },
      ],
      purchaseCompletionTime: "2025-10-13T20:13:42.748Z",
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_NOT_ACKNOWLEDGED",
    };

    const receipt = mapProductResponseToReceiptData({
      packageName,
      purchaseToken: "",
      productResponse: productPurchaseV2Response,
    });

    const response = mapToGooglePlayReceiptResponse(receipt);

    expect(response).toEqual({
      isValid: false,
      state: HarmonizedPurchaseState.PENDING,
      productId: "test.product",
    });
  });

  it("maps productsv2.get CANCELLED to CANCELED", () => {
    const productPurchaseV2Response = {
      kind: "androidpublisher#productPurchaseV2",
      purchaseStateContext: {
        purchaseState: "CANCELLED",
      },
      orderId: "GPA.3326-6438-3750-50958",
      regionCode: "BR",
      productLineItem: [
        {
          productId: "untold_full",
          productOfferDetails: {
            purchaseOptionId: "legacy-base",
            quantity: 1,
            refundableQuantity: 0,
            consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
          },
        },
      ],
      purchaseCompletionTime: "2025-12-03T02:45:41.508Z",
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
    };

    const receipt = mapProductResponseToReceiptData({
      packageName,
      purchaseToken: "",
      productResponse: productPurchaseV2Response,
    });

    const response = mapToGooglePlayReceiptResponse(receipt);

    expect(response).toEqual({
      isValid: false,
      state: HarmonizedPurchaseState.CANCELED,
      productId: "untold_full",
    });
  });

  it("maps productsv2.get unrecognized states to UNKNOWN", () => {
    const productPurchaseV2Response = {
      kind: "androidpublisher#productPurchaseV2",
      purchaseStateContext: { purchaseState: "SOMETHING_UNRECOGNIZED" },
      productLineItem: [
        {
          productId: "test.product",
          productOfferDetails: {
            quantity: 1,
            refundableQuantity: 1,
            consumptionState: "CONSUMPTION_STATE_UNSPECIFIED",
          },
        },
      ],
      purchaseCompletionTime: "2025-10-13T20:13:42.748Z",
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_UNSPECIFIED",
    };

    const receipt = mapProductResponseToReceiptData({
      packageName,
      purchaseToken: "",
      productResponse: productPurchaseV2Response,
    });

    const response = mapToGooglePlayReceiptResponse(receipt);

    expect(response).toEqual({
      isValid: false,
      state: HarmonizedPurchaseState.UNKNOWN,
      productId: "test.product",
    });
  });
});

describe("isProductNotFoundError", () => {
  it("treats a 404 error code as product-not-found", () => {
    const error = Object.assign(new Error("Not Found"), { code: 404 });
    expect(isProductNotFoundError(error)).toBe(true);
  });

  it("treats a 404 code on a plain object as product-not-found", () => {
    expect(isProductNotFoundError({ code: 404 })).toBe(true);
  });

  it("detects Google's 'The purchase was not found.' message", () => {
    const error = new Error("The purchase was not found.");
    expect(isProductNotFoundError(error)).toBe(true);
  });

  it("matches case-insensitively on 'not found' in the message", () => {
    const error = new Error("Purchase Not Found for given token");
    expect(isProductNotFoundError(error)).toBe(true);
  });

  it("rejects auth failures so we don't retry as a subscription", () => {
    const error = Object.assign(new Error("invalid_grant"), { code: 401 });
    expect(isProductNotFoundError(error)).toBe(false);
  });

  it("rejects permission failures", () => {
    const error = Object.assign(new Error("insufficient permissions"), {
      code: 403,
    });
    expect(isProductNotFoundError(error)).toBe(false);
  });

  it("rejects network / generic errors", () => {
    const error = new Error("ECONNRESET");
    expect(isProductNotFoundError(error)).toBe(false);
  });

  it("is safe on null / undefined", () => {
    expect(isProductNotFoundError(null)).toBe(false);
    expect(isProductNotFoundError(undefined)).toBe(false);
  });
});
