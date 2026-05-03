import { describe, expect, it } from "vitest";
import {
  mapAppleNotificationType,
  mapGoogleSubscriptionNotificationType,
  mapGoogleOneTimeNotificationType,
  normalizeAppleAsn,
  normalizeGoogleRtdn,
  WebhookNormalizationError,
  type AppleAsnPayload,
  type AppleDecodedTransaction,
  type GoogleRtdnPayload,
  type GoogleSubscriptionInfo,
} from "./shared";

// ---------------------------------------------------------------------------
// Apple ASN v2 mapping
// ---------------------------------------------------------------------------

describe("mapAppleNotificationType", () => {
  it("maps SUBSCRIBED with INITIAL_BUY / RESUBSCRIBE / no subtype to Started", () => {
    expect(mapAppleNotificationType("SUBSCRIBED", "INITIAL_BUY")).toBe(
      "SubscriptionStarted",
    );
    expect(mapAppleNotificationType("SUBSCRIBED", "RESUBSCRIBE")).toBe(
      "SubscriptionStarted",
    );
    expect(mapAppleNotificationType("SUBSCRIBED")).toBe("SubscriptionStarted");
  });

  it("distinguishes DID_RENEW (Renewed) from BILLING_RECOVERY (Recovered)", () => {
    expect(mapAppleNotificationType("DID_RENEW")).toBe("SubscriptionRenewed");
    expect(mapAppleNotificationType("DID_RENEW", "BILLING_RECOVERY")).toBe(
      "SubscriptionRecovered",
    );
  });

  it("distinguishes DID_FAIL_TO_RENEW grace vs billing-retry", () => {
    expect(mapAppleNotificationType("DID_FAIL_TO_RENEW", "GRACE_PERIOD")).toBe(
      "SubscriptionInGracePeriod",
    );
    expect(mapAppleNotificationType("DID_FAIL_TO_RENEW")).toBe(
      "SubscriptionInBillingRetry",
    );
  });

  it("maps GRACE_PERIOD_EXPIRED to InBillingRetry", () => {
    expect(mapAppleNotificationType("GRACE_PERIOD_EXPIRED")).toBe(
      "SubscriptionInBillingRetry",
    );
  });

  it("maps DID_CHANGE_RENEWAL_STATUS by subtype", () => {
    expect(
      mapAppleNotificationType(
        "DID_CHANGE_RENEWAL_STATUS",
        "AUTO_RENEW_DISABLED",
      ),
    ).toBe("SubscriptionCanceled");
    expect(
      mapAppleNotificationType(
        "DID_CHANGE_RENEWAL_STATUS",
        "AUTO_RENEW_ENABLED",
      ),
    ).toBe("SubscriptionUncanceled");
    // No subtype -> ambiguous, returns null so receiver can drop it
    expect(mapAppleNotificationType("DID_CHANGE_RENEWAL_STATUS")).toBeNull();
  });

  it("maps the remaining single-shot notification types", () => {
    expect(mapAppleNotificationType("EXPIRED")).toBe("SubscriptionExpired");
    expect(mapAppleNotificationType("DID_CHANGE_RENEWAL_PREF")).toBe(
      "SubscriptionProductChanged",
    );
    expect(mapAppleNotificationType("PRICE_INCREASE")).toBe(
      "SubscriptionPriceChange",
    );
    expect(mapAppleNotificationType("REVOKE")).toBe("SubscriptionRevoked");
    expect(mapAppleNotificationType("REFUND")).toBe("PurchaseRefunded");
    expect(mapAppleNotificationType("REFUND_REVERSED")).toBe(
      "SubscriptionStarted",
    );
    expect(mapAppleNotificationType("CONSUMPTION_REQUEST")).toBe(
      "PurchaseConsumptionRequest",
    );
    expect(mapAppleNotificationType("TEST")).toBe("TestNotification");
  });

  it("returns null for notification types not in the openiap spec yet", () => {
    expect(mapAppleNotificationType("OFFER_REDEEMED")).toBeNull();
    expect(mapAppleNotificationType("RENEWAL_EXTENDED")).toBeNull();
    expect(mapAppleNotificationType("EXTERNAL_PURCHASE_TOKEN")).toBeNull();
    expect(mapAppleNotificationType("SOMETHING_NEW_FROM_APPLE")).toBeNull();
  });
});

const baseApplePayload: AppleAsnPayload = {
  notificationType: "DID_RENEW",
  notificationUUID: "uuid-renew-1",
  signedDate: 1_711_000_000_000,
  data: { environment: "Production" },
};

const baseTransaction: AppleDecodedTransaction = {
  originalTransactionId: "1000000000000001",
  transactionId: "1000000000000099",
  productId: "com.example.premium_monthly",
  expiresDate: 1_713_592_000_000,
  // ASN reports `price` in milliunits (1/1000 of a currency unit —
  // $9.99 → 9990). Earlier draft mistakenly called these "millicents"
  // and applied a 10× multiplier, which #123 review correctly flagged.
  price: 9_990,
  currency: "USD",
};

describe("normalizeAppleAsn", () => {
  it("normalizes a vanilla DID_RENEW into SubscriptionRenewed with active state", () => {
    const event = normalizeAppleAsn({
      payload: baseApplePayload,
      transaction: baseTransaction,
      renewalInfo: { renewalDate: 1_713_592_000_000 },
    });

    expect(event.type).toBe("SubscriptionRenewed");
    expect(event.source).toBe("AppleAppStoreServerNotificationsV2");
    expect(event.platform).toBe("IOS");
    expect(event.environment).toBe("Production");
    expect(event.purchaseToken).toBe("1000000000000001");
    expect(event.productId).toBe("com.example.premium_monthly");
    expect(event.subscriptionState).toBe("Active");
    expect(event.expiresAt).toBe(1_713_592_000_000);
    expect(event.renewsAt).toBe(1_713_592_000_000);
    expect(event.currency).toBe("USD");
    // 9_990 milliunits × 1000 = 9_990_000 micros ($9.99)
    expect(event.priceAmountMicros).toBe(9_990_000);
    expect(event.occurredAt).toBe(1_711_000_000_000);
    expect(event.sourceNotificationId).toBe("uuid-renew-1");
  });

  it("derives Sandbox/Xcode environments and falls back to Production on missing data", () => {
    const sandbox = normalizeAppleAsn({
      payload: { ...baseApplePayload, data: { environment: "Sandbox" } },
      transaction: baseTransaction,
    });
    expect(sandbox.environment).toBe("Sandbox");

    const xcode = normalizeAppleAsn({
      payload: { ...baseApplePayload, data: { environment: "Xcode" } },
      transaction: baseTransaction,
    });
    expect(xcode.environment).toBe("Xcode");

    const missing = normalizeAppleAsn({
      payload: { ...baseApplePayload, data: null },
      transaction: baseTransaction,
    });
    expect(missing.environment).toBe("Production");
  });

  it("maps AUTO_RENEW_DISABLED into Canceled while keeping state Active until expiry", () => {
    const event = normalizeAppleAsn({
      payload: {
        ...baseApplePayload,
        notificationType: "DID_CHANGE_RENEWAL_STATUS",
        subtype: "AUTO_RENEW_DISABLED",
      },
      transaction: baseTransaction,
    });
    expect(event.type).toBe("SubscriptionCanceled");
    expect(event.subscriptionState).toBe("Active");
    expect(event.cancellationReason).toBe("UserCanceled");
  });

  it("translates Apple expirationIntent codes 1..5 to cancellation reasons", () => {
    const cases: Array<[number, string]> = [
      [1, "UserCanceled"],
      [2, "BillingError"],
      [3, "PriceIncreaseDeclined"],
      [4, "ProductUnavailable"],
      [5, "Other"],
    ];
    for (const [intent, reason] of cases) {
      const event = normalizeAppleAsn({
        payload: { ...baseApplePayload, notificationType: "EXPIRED" },
        transaction: baseTransaction,
        renewalInfo: { expirationIntent: intent },
      });
      expect(event.type).toBe("SubscriptionExpired");
      expect(event.cancellationReason).toBe(reason);
    }
  });

  it("flags REVOKE / REFUND with cancellationReason = Refunded", () => {
    const revoke = normalizeAppleAsn({
      payload: { ...baseApplePayload, notificationType: "REVOKE" },
      transaction: baseTransaction,
    });
    expect(revoke.type).toBe("SubscriptionRevoked");
    expect(revoke.cancellationReason).toBe("Refunded");

    const refund = normalizeAppleAsn({
      payload: { ...baseApplePayload, notificationType: "REFUND" },
      transaction: baseTransaction,
    });
    expect(refund.type).toBe("PurchaseRefunded");
    expect(refund.cancellationReason).toBe("Refunded");
    expect(refund.subscriptionState).toBe("Refunded");
  });

  it("accepts a TEST notification with no transaction/renewal data", () => {
    const event = normalizeAppleAsn({
      payload: {
        notificationType: "TEST",
        notificationUUID: "test-uuid-1",
        signedDate: 1_711_000_000_000,
        data: { environment: "Sandbox" },
      },
    });
    expect(event.type).toBe("TestNotification");
    // TestNotification carries no transaction → no purchaseToken.
    expect(event.purchaseToken).toBeUndefined();
    expect(event.environment).toBe("Sandbox");
    // Test notifications have no subscription state in the spec
    expect(event.subscriptionState).toBeUndefined();
  });

  it("rejects unsupported notification types", () => {
    expect(() =>
      normalizeAppleAsn({
        payload: { ...baseApplePayload, notificationType: "OFFER_REDEEMED" },
        transaction: baseTransaction,
      }),
    ).toThrow(WebhookNormalizationError);
  });

  it("rejects payloads missing notificationUUID", () => {
    expect(() =>
      normalizeAppleAsn({
        payload: {
          ...baseApplePayload,
          notificationUUID: "",
        },
        transaction: baseTransaction,
      }),
    ).toThrow(/notificationUUID/);
  });

  it("rejects non-test payloads missing originalTransactionId", () => {
    expect(() =>
      normalizeAppleAsn({
        payload: baseApplePayload,
        transaction: { productId: "x" },
      }),
    ).toThrow(/originalTransactionId/);
  });
});

// ---------------------------------------------------------------------------
// Google RTDN mapping
// ---------------------------------------------------------------------------

describe("mapGoogleSubscriptionNotificationType", () => {
  it("maps the documented numeric codes to spec event types", () => {
    // RTDN code reference:
    // https://developer.android.com/google/play/billing/rtdn-reference#sub
    // Codes 1 / 4 were swapped in an earlier draft (caught in PR #123 (https://github.com/hyodotdev/openiap/pull/123)
    // review). 1 = RECOVERED, 4 = PURCHASED. 7 = RESTARTED maps to
    // Uncanceled (auto-renew re-enabled), not Started.
    expect(mapGoogleSubscriptionNotificationType(1)).toBe(
      "SubscriptionRecovered",
    );
    expect(mapGoogleSubscriptionNotificationType(2)).toBe(
      "SubscriptionRenewed",
    );
    expect(mapGoogleSubscriptionNotificationType(3)).toBe(
      "SubscriptionCanceled",
    );
    expect(mapGoogleSubscriptionNotificationType(4)).toBe(
      "SubscriptionStarted",
    );
    expect(mapGoogleSubscriptionNotificationType(7)).toBe(
      "SubscriptionUncanceled",
    );
    expect(mapGoogleSubscriptionNotificationType(5)).toBe(
      "SubscriptionInBillingRetry",
    );
    expect(mapGoogleSubscriptionNotificationType(6)).toBe(
      "SubscriptionInGracePeriod",
    );
    expect(mapGoogleSubscriptionNotificationType(8)).toBe(
      "SubscriptionPriceChange",
    );
    expect(mapGoogleSubscriptionNotificationType(9)).toBe(
      "SubscriptionProductChanged",
    );
    expect(mapGoogleSubscriptionNotificationType(10)).toBe(
      "SubscriptionPaused",
    );
    expect(mapGoogleSubscriptionNotificationType(12)).toBe(
      "SubscriptionRevoked",
    );
    expect(mapGoogleSubscriptionNotificationType(13)).toBe(
      "SubscriptionExpired",
    );
  });

  it("returns null for unknown codes", () => {
    expect(mapGoogleSubscriptionNotificationType(999)).toBeNull();
  });
});

describe("mapGoogleOneTimeNotificationType", () => {
  it("maps purchased and canceled to spec types", () => {
    expect(mapGoogleOneTimeNotificationType(1)).toBe("SubscriptionStarted");
    expect(mapGoogleOneTimeNotificationType(2)).toBe("PurchaseRefunded");
  });
});

const baseRtdnSubscription: GoogleRtdnPayload = {
  messageId: "rtdn-msg-1",
  packageName: "com.example.app",
  eventTimeMillis: 1_711_000_000_000,
  subscriptionNotification: {
    notificationType: 2,
    purchaseToken: "play-token-abc",
    subscriptionId: "premium_monthly",
  },
};

describe("normalizeGoogleRtdn", () => {
  it("normalizes SUBSCRIPTION_RENEWED with active state from subscriptionsv2 fetch", () => {
    const info: GoogleSubscriptionInfo = {
      state: "SUBSCRIPTION_STATE_ACTIVE",
      expiryTimeMillis: 1_713_592_000_000,
      autoRenewingPlanRenewsTimeMillis: 1_713_592_000_000,
      currency: "KRW",
      priceAmountMicros: 12_900_000_000,
    };
    const event = normalizeGoogleRtdn({
      payload: baseRtdnSubscription,
      subscriptionInfo: info,
    });

    expect(event.type).toBe("SubscriptionRenewed");
    expect(event.source).toBe("GooglePlayRealTimeDeveloperNotifications");
    expect(event.platform).toBe("Android");
    expect(event.environment).toBe("Production");
    expect(event.purchaseToken).toBe("play-token-abc");
    expect(event.productId).toBe("premium_monthly");
    expect(event.subscriptionState).toBe("Active");
    expect(event.expiresAt).toBe(1_713_592_000_000);
    expect(event.renewsAt).toBe(1_713_592_000_000);
    expect(event.currency).toBe("KRW");
    expect(event.priceAmountMicros).toBe(12_900_000_000);
    expect(event.occurredAt).toBe(1_711_000_000_000);
    expect(event.sourceNotificationId).toBe("rtdn-msg-1");
  });

  it("derives state from subscriptionsv2 when present, otherwise from event type", () => {
    const grace = normalizeGoogleRtdn({
      payload: {
        ...baseRtdnSubscription,
        subscriptionNotification: {
          ...baseRtdnSubscription.subscriptionNotification!,
          notificationType: 6,
        },
      },
    });
    expect(grace.type).toBe("SubscriptionInGracePeriod");
    expect(grace.subscriptionState).toBe("InGracePeriod");

    const onHold = normalizeGoogleRtdn({
      payload: baseRtdnSubscription,
      subscriptionInfo: { state: "SUBSCRIPTION_STATE_ON_HOLD" },
    });
    expect(onHold.subscriptionState).toBe("InBillingRetry");
  });

  it("preserves Active state when SUBSCRIPTION_STATE_CANCELED reports auto-renew off", () => {
    const event = normalizeGoogleRtdn({
      payload: {
        ...baseRtdnSubscription,
        subscriptionNotification: {
          ...baseRtdnSubscription.subscriptionNotification!,
          notificationType: 3,
        },
      },
      subscriptionInfo: { state: "SUBSCRIPTION_STATE_CANCELED" },
    });
    expect(event.type).toBe("SubscriptionCanceled");
    expect(event.subscriptionState).toBe("Active");
    expect(event.cancellationReason).toBe("UserCanceled");
  });

  it("translates Google cancelReason values to openiap reasons", () => {
    const cases: Array<[string, string]> = [
      ["USER_CANCELED", "UserCanceled"],
      ["BILLING_ERROR", "BillingError"],
      ["SYSTEM_INITIATED_CANCELLATION", "BillingError"],
      ["NEW_PRICE_REJECTED", "PriceIncreaseDeclined"],
      ["DEVELOPER_CANCELED", "ProductUnavailable"],
      ["UNKNOWN_NEW_REASON", "Other"],
    ];
    for (const [cancelReason, expected] of cases) {
      const event = normalizeGoogleRtdn({
        payload: {
          ...baseRtdnSubscription,
          subscriptionNotification: {
            ...baseRtdnSubscription.subscriptionNotification!,
            notificationType: 13,
          },
        },
        subscriptionInfo: { cancelReason },
      });
      expect(event.type).toBe("SubscriptionExpired");
      expect(event.cancellationReason).toBe(expected);
    }
  });

  it("normalizes a one-time refund into PurchaseRefunded", () => {
    const event = normalizeGoogleRtdn({
      payload: {
        messageId: "rtdn-otp-1",
        packageName: "com.example.app",
        eventTimeMillis: 1_711_111_111_000,
        oneTimeProductNotification: {
          notificationType: 2,
          purchaseToken: "otp-token-xyz",
          sku: "coin_pack_100",
        },
      },
    });
    expect(event.type).toBe("PurchaseRefunded");
    expect(event.purchaseToken).toBe("otp-token-xyz");
    expect(event.productId).toBe("coin_pack_100");
    expect(event.subscriptionState).toBe("Refunded");
    expect(event.cancellationReason).toBe("Refunded");
  });

  it("normalizes a voidedPurchase to PurchaseRefunded", () => {
    const event = normalizeGoogleRtdn({
      payload: {
        messageId: "rtdn-void-1",
        packageName: "com.example.app",
        eventTimeMillis: 1_711_222_222_000,
        voidedPurchaseNotification: {
          purchaseToken: "void-token-1",
          orderId: "GPA.1234-5678-9012-34567",
          productType: 1,
          refundType: 1,
        },
      },
    });
    expect(event.type).toBe("PurchaseRefunded");
    expect(event.purchaseToken).toBe("void-token-1");
    expect(event.cancellationReason).toBe("Refunded");
  });

  it("normalizes a testNotification to Sandbox environment", () => {
    const event = normalizeGoogleRtdn({
      payload: {
        messageId: "rtdn-test-1",
        eventTimeMillis: 1_711_000_000_000,
        testNotification: { version: "1.0" },
      },
    });
    expect(event.type).toBe("TestNotification");
    expect(event.environment).toBe("Sandbox");
    // RTDN test payloads carry no transaction → no purchaseToken.
    expect(event.purchaseToken).toBeUndefined();
  });

  it("rejects RTDN payloads missing messageId", () => {
    expect(() =>
      normalizeGoogleRtdn({
        payload: {
          ...baseRtdnSubscription,
          messageId: "",
        },
      }),
    ).toThrow(/messageId/);
  });

  it("rejects RTDN payloads with no notification variant", () => {
    expect(() =>
      normalizeGoogleRtdn({
        payload: {
          messageId: "x",
          eventTimeMillis: 1,
        },
      }),
    ).toThrow(WebhookNormalizationError);
  });

  it("rejects unsupported RTDN subscription notification codes", () => {
    expect(() =>
      normalizeGoogleRtdn({
        payload: {
          ...baseRtdnSubscription,
          subscriptionNotification: {
            ...baseRtdnSubscription.subscriptionNotification!,
            notificationType: 9999,
          },
        },
      }),
    ).toThrow(WebhookNormalizationError);
  });
});
