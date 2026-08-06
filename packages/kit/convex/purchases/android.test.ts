import { google, type Common } from "googleapis";
import { describe, expect, it } from "vitest";
import {
  isProductNotFoundError,
  mapProductResponseToReceiptData,
  selectProductLineItem,
  verifyPurchaseWithGooglePlay,
  mapSubscriptionResponseToReceiptData,
  parseTimeToMillis,
  recordGooglePlayVerifiedSubscription,
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

  it("selects the longest-dated subscription line item and preserves renewal price", () => {
    const soon = "2026-01-01T00:00:00.000Z";
    const later = "2026-02-01T00:00:00.000Z";
    const subscriptionResponse = {
      kind: "androidpublisher#subscriptionPurchaseV2",
      latestOrderId: "GPA.1234-5678-9012-34567",
      startTime: "2025-10-13T20:13:42.748Z",
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
      lineItems: [
        {
          productId: "premium_monthly",
          expiryTime: soon,
          latestSuccessfulOrderId: "GPA.1111-1111-1111-11111",
          autoRenewingPlan: {
            recurringPrice: {
              currencyCode: "USD",
              units: "4",
              nanos: 990_000_000,
            },
          },
        },
        {
          productId: "premium_yearly",
          expiryTime: later,
          latestSuccessfulOrderId: "GPA.2222-2222-2222-22222",
          autoRenewingPlan: {
            recurringPrice: {
              currencyCode: "USD",
              units: "49",
              nanos: 990_000_000,
            },
          },
        },
      ],
    };

    const receipt = mapSubscriptionResponseToReceiptData({
      packageName,
      purchaseToken: "sub-token",
      subscriptionResponse,
    });

    expect(receipt.productId).toBe("premium_yearly");
    expect(receipt.orderId).toBe("GPA.2222-2222-2222-22222");
    expect(receipt.expiryTime).toBe(Date.parse(later));
    expect(receipt.renewsAt).toBe(Date.parse(later));
    expect(receipt.currency).toBe("USD");
    expect(receipt.priceAmountMicros).toBe(49_990_000);
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

describe("recordGooglePlayVerifiedSubscription", () => {
  function makeRunMutationRecorder(): {
    ctx: Parameters<typeof recordGooglePlayVerifiedSubscription>[0];
    calls: Record<string, unknown>[];
  } {
    const calls: Record<string, unknown>[] = [];
    const ctx = {
      runMutation: async (
        _mutation: unknown,
        args: Record<string, unknown>,
      ) => {
        calls.push(args);
        return null;
      },
    } as unknown as Parameters<typeof recordGooglePlayVerifiedSubscription>[0];
    return { ctx, calls };
  }

  it("uses the store-verified state for canonical subscription persistence", async () => {
    const { ctx, calls } = makeRunMutationRecorder();

    await recordGooglePlayVerifiedSubscription(ctx, {
      projectId: "projects_1" as never,
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      receiptData: {
        transactionId: "GPA.1234-5678-9012-34567",
        packageName,
        productId: "premium_monthly",
        purchaseToken: "sub-token",
        purchaseDate: 1_700_000_000_000,
        quantity: 1,
        type: "Subscription",
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        expiryTime: 1_769_904_000_000,
        renewsAt: 1_769_904_000_000,
        currency: "USD",
        priceAmountMicros: 9_990_000,
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      projectId: "projects_1",
      platform: "Android",
      purchaseToken: "sub-token",
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      expiresAt: 1_769_904_000_000,
      renewsAt: 1_769_904_000_000,
      currency: "USD",
      priceAmountMicros: 9_990_000,
    });
  });

  it("persists pending-acknowledgment subscriptions as bindable rows", async () => {
    const { ctx, calls } = makeRunMutationRecorder();

    await recordGooglePlayVerifiedSubscription(ctx, {
      projectId: "projects_1" as never,
      purchaseState: HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT,
      receiptData: {
        transactionId: "GPA.1234-5678-9012-34567",
        packageName,
        productId: "premium_monthly",
        purchaseToken: "pending-sub-token",
        purchaseDate: 1_700_000_000_000,
        quantity: 1,
        type: "Subscription",
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
        expiryTime: 1_769_904_000_000,
        renewsAt: 1_769_904_000_000,
        currency: "USD",
        priceAmountMicros: 9_990_000,
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      projectId: "projects_1",
      platform: "Android",
      purchaseToken: "pending-sub-token",
      productId: "premium_monthly",
      purchaseState: HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT,
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      expiresAt: 1_769_904_000_000,
      renewsAt: 1_769_904_000_000,
      currency: "USD",
      priceAmountMicros: 9_990_000,
    });
  });

  it("skips one-time product receipts", async () => {
    const { ctx, calls } = makeRunMutationRecorder();

    await recordGooglePlayVerifiedSubscription(ctx, {
      projectId: "projects_1" as never,
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      receiptData: {
        transactionId: "GPA.1234-5678-9012-34567",
        packageName,
        productId: "coins_pack",
        purchaseToken: "product-token",
        purchaseDate: 1_700_000_000_000,
        quantity: 1,
        type: "InApp",
      },
    });

    expect(calls).toHaveLength(0);
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

// Issue #289: a token that covers more than one line item resolved to
// whichever item Google listed first, so `expectedProductId` could be
// compared against the wrong product and reject a valid purchase.
describe("selectProductLineItem", () => {
  const bulbs = { productId: "dev.hyo.martie.10bulbs" };
  const premium = { productId: "dev.hyo.martie.premium" };

  it("prefers the line item the caller expects", () => {
    expect(
      selectProductLineItem([bulbs, premium], "dev.hyo.martie.premium"),
    ).toBe(premium);
  });

  it("falls back to the first item when the expectation doesn't match", () => {
    expect(
      selectProductLineItem([bulbs, premium], "dev.hyo.martie.absent"),
    ).toBe(bulbs);
  });

  it("keeps the historical first-item behaviour when nothing is expected", () => {
    expect(selectProductLineItem([bulbs, premium])).toBe(bulbs);
  });

  it("is safe on empty and missing line items", () => {
    expect(selectProductLineItem([])).toBeUndefined();
    expect(selectProductLineItem(undefined)).toBeUndefined();
    expect(selectProductLineItem(null)).toBeUndefined();
  });

  it("resolves a multi-item token to the expected product end to end", () => {
    const receipt = mapProductResponseToReceiptData({
      packageName,
      purchaseToken: "token-multi",
      productResponse: {
        purchaseStateContext: { purchaseState: "PURCHASED" },
        acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
        productLineItem: [
          {
            productId: "dev.hyo.martie.10bulbs",
            productOfferDetails: {
              quantity: 1,
              consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
            },
          },
          {
            productId: "dev.hyo.martie.premium",
            productOfferDetails: {
              quantity: 3,
              consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
            },
          },
        ],
      },
      expectedProductId: "dev.hyo.martie.premium",
    });

    expect(receipt.productId).toBe("dev.hyo.martie.premium");
    expect(receipt.quantity).toBe(3);
    // Would previously have been INAUTHENTIC: productId resolved to the
    // first line item and then failed the expectedProductId comparison.
    expect(mapToGooglePlayReceiptResponse(receipt).isValid).toBe(true);
  });
});

// Issue #289: productsv2/subscriptionsv2 are eventually consistent, so a
// token seconds old can 404 in both. 4xx is excluded from
// `retryOnTransient`, so that became a hard failure on the first attempt
// — the app then never acknowledged, and Google voided the purchase at
// ~301s.
describe("verifyPurchaseWithGooglePlay fresh-token retry", () => {
  function stubPublisher(responder: (attempt: number) => unknown) {
    let calls = 0;
    const androidpublisher = google.androidpublisher({
      version: "v3",
      // gaxios adds its own retry on top of every call. A thrown
      // adapter error looks like a network failure to it, which would
      // triple each count and hide what this test measures — kit's own
      // retry depth. Production 404s arrive as HTTP responses and are
      // not gaxios-retried, so disabling it here matches reality.
      retryConfig: { retry: 0, noResponseRetries: 0 },
      adapter: async <T>(
        request: Common.gaxios.GaxiosOptionsPrepared,
      ): Promise<Common.GaxiosResponse<T>> => {
        calls += 1;
        const data = responder(calls);
        if (data === undefined) {
          throw Object.assign(new Error("not found"), { code: 404 });
        }
        return Object.assign(new Response(null, { status: 200 }), {
          config: request,
          data: data as T,
        });
      },
    });
    return { androidpublisher, callCount: () => calls };
  }

  const freshPurchase = {
    purchaseStateContext: { purchaseState: "PURCHASED" },
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
    productLineItem: [
      {
        productId: "dev.hyo.martie.10bulbs",
        productOfferDetails: {
          quantity: 1,
          consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
        },
      },
    ],
  };

  it("recovers a token that has not propagated yet", async () => {
    // Attempts 1-2 are the product+subscription pair for a token Google
    // doesn't know about yet; the product lookup then succeeds.
    const { androidpublisher, callCount } = stubPublisher((attempt) =>
      attempt <= 2 ? undefined : freshPurchase,
    );

    const result = await verifyPurchaseWithGooglePlay(androidpublisher, {
      packageName,
      purchaseToken: "fresh-token",
    });

    expect(result.receiptData.productId).toBe("dev.hyo.martie.10bulbs");
    expect(mapToGooglePlayReceiptResponse(result.receiptData).isValid).toBe(
      true,
    );
    expect(callCount()).toBe(3);
  });

  it("gives up quickly on a token that genuinely does not exist", async () => {
    // Every attempt 404s. The retry must stay shallow: each attempt
    // costs TWO Play calls, so a bogus-token probe would otherwise
    // multiply upstream cost and hold a request open.
    const { androidpublisher, callCount } = stubPublisher(() => undefined);

    await expect(
      verifyPurchaseWithGooglePlay(androidpublisher, {
        packageName,
        purchaseToken: "bogus-token",
      }),
    ).rejects.toThrow();
    // 3 attempts x (product + subscription). Each extra attempt would
    // double the upstream cost of a token that will never resolve.
    expect(callCount()).toBe(6);
  });
});
