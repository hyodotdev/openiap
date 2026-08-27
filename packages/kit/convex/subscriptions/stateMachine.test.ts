import { describe, expect, it } from "vitest";
import {
  applySubscriptionTransition,
  entitlementActive,
  type CurrentSubscription,
} from "./stateMachine";

const baseSub: NonNullable<CurrentSubscription> = {
  state: "Active",
  productId: "com.example.premium",
  expiresAt: Date.now() + 3_600_000,
  willRenew: true,
};

describe("applySubscriptionTransition", () => {
  it("creates an Active row from SubscriptionStarted with no prior record", () => {
    const result = applySubscriptionTransition(null, {
      type: "SubscriptionStarted",
      productId: "com.example.premium",
      expiresAt: 2_000_000_000_000,
      renewsAt: 2_000_000_000_000,
    });
    expect(result.next?.state).toBe("Active");
    expect(result.active).toBe(true);
    expect(result.transition).toBe("Started");
  });

  it("treats SubscriptionStarted on top of an existing record as Recovered", () => {
    const result = applySubscriptionTransition(
      { ...baseSub, state: "Expired" },
      {
        type: "SubscriptionStarted",
        productId: baseSub.productId,
        expiresAt: 2_000_000_000_000,
      },
    );
    expect(result.next?.state).toBe("Active");
    expect(result.transition).toBe("Recovered");
  });

  it("renews and keeps Active", () => {
    const result = applySubscriptionTransition(baseSub, {
      type: "SubscriptionRenewed",
      productId: baseSub.productId,
      expiresAt: 2_100_000_000_000,
    });
    expect(result.next?.state).toBe("Active");
    expect(result.next?.expiresAt).toBe(2_100_000_000_000);
    expect(result.active).toBe(true);
    expect(result.transition).toBe("Renewed");
  });

  it("Canceled keeps state Active until expiry but flips willRenew", () => {
    const result = applySubscriptionTransition(baseSub, {
      type: "SubscriptionCanceled",
      productId: baseSub.productId,
    });
    expect(result.next?.state).toBe("Active");
    expect(result.next?.willRenew).toBe(false);
    expect(result.active).toBe(true);
    expect(result.transition).toBe("Canceled");
  });

  it("Uncanceled flips willRenew back to true", () => {
    const canceled = {
      ...baseSub,
      willRenew: false,
      cancellationReason: "UserCanceled" as const,
    };
    const result = applySubscriptionTransition(canceled, {
      type: "SubscriptionUncanceled",
      productId: baseSub.productId,
    });
    expect(result.next?.willRenew).toBe(true);
    expect(result.next?.cancellationReason).toBeUndefined();
    expect(result.active).toBe(true);
    expect(result.transition).toBe("Uncanceled");
  });

  it("reconstructs active access when cancellation is the first event", () => {
    const result = applySubscriptionTransition(null, {
      type: "SubscriptionCanceled",
      productId: baseSub.productId,
      subscriptionState: "Active",
      expiresAt: 2_500_000_000_000,
    });
    expect(result.next).toMatchObject({
      state: "Active",
      willRenew: false,
      cancellationReason: "UserCanceled",
    });
    expect(result.active).toBe(true);
  });

  it("InGracePeriod keeps the user entitled", () => {
    const result = applySubscriptionTransition(baseSub, {
      type: "SubscriptionInGracePeriod",
      productId: baseSub.productId,
    });
    expect(result.next?.state).toBe("InGracePeriod");
    expect(result.active).toBe(true);
  });

  it("InBillingRetry de-entitles", () => {
    const result = applySubscriptionTransition(baseSub, {
      type: "SubscriptionInBillingRetry",
      productId: baseSub.productId,
    });
    expect(result.next?.state).toBe("InBillingRetry");
    expect(result.active).toBe(false);
  });

  it("Expired de-entitles and clears willRenew", () => {
    const result = applySubscriptionTransition(baseSub, {
      type: "SubscriptionExpired",
      productId: baseSub.productId,
    });
    expect(result.next?.state).toBe("Expired");
    expect(result.next?.willRenew).toBe(false);
    expect(result.active).toBe(false);
  });

  it("Revoked is immediate de-entitlement", () => {
    const result = applySubscriptionTransition(baseSub, {
      type: "SubscriptionRevoked",
      productId: baseSub.productId,
    });
    expect(result.next?.state).toBe("Revoked");
    expect(result.next?.cancellationReason).toBe("Refunded");
    expect(result.active).toBe(false);
  });

  it("PurchaseRefunded with no current row records the refund without conjuring a sub", () => {
    const result = applySubscriptionTransition(null, {
      type: "PurchaseRefunded",
    });
    expect(result.next).toBeNull();
    expect(result.active).toBe(false);
    expect(result.transition).toBe("Refunded");
  });

  it("PurchaseRefunded on an existing sub flips it to Refunded", () => {
    const result = applySubscriptionTransition(baseSub, {
      type: "PurchaseRefunded",
      productId: baseSub.productId,
    });
    expect(result.next?.state).toBe("Refunded");
    expect(result.active).toBe(false);
  });

  it("Paused / Resumed move state and entitlement together", () => {
    const paused = applySubscriptionTransition(baseSub, {
      type: "SubscriptionPaused",
      productId: baseSub.productId,
    });
    expect(paused.next?.state).toBe("Paused");
    expect(paused.active).toBe(false);

    const resumed = applySubscriptionTransition(paused.next, {
      // Google reports RECOVERED after a pause; prior state disambiguates it.
      type: "SubscriptionRecovered",
      productId: baseSub.productId,
      expiresAt: 2_500_000_000_000,
    });
    expect(resumed.next?.state).toBe("Active");
    expect(resumed.active).toBe(true);
    expect(resumed.transition).toBe("Resumed");
  });

  it("does not revoke access for a pause schedule change", () => {
    const result = applySubscriptionTransition(baseSub, {
      type: "SubscriptionPauseScheduleChanged",
      productId: baseSub.productId,
    });
    expect(result.next).toEqual(baseSub);
    expect(result.active).toBe(true);
    expect(result.transition).toBe("Ignored");
  });

  it.each([
    "SubscriptionPendingPurchaseCanceled",
    "SubscriptionPriceStepUpConsentChanged",
  ] as const)("records %s without changing an existing entitlement", (type) => {
    const result = applySubscriptionTransition(baseSub, {
      type,
      productId: baseSub.productId,
    });
    expect(result.next).toEqual(baseSub);
    expect(result.active).toBe(true);
    expect(result.transition).toBe("Ignored");
  });

  it("does not create a subscription for a canceled pending purchase", () => {
    const result = applySubscriptionTransition(null, {
      type: "SubscriptionPendingPurchaseCanceled",
      productId: baseSub.productId,
    });
    expect(result.next).toBeNull();
    expect(result.active).toBe(false);
    expect(result.transition).toBe("Ignored");
  });

  it("keeps a future price off the canonical row until renewal", () => {
    const current = {
      ...baseSub,
      currency: "USD",
      priceAmountMicros: 9_990_000,
    };
    const result = applySubscriptionTransition(current, {
      type: "SubscriptionPriceChange",
      productId: baseSub.productId,
      currency: "USD",
      priceAmountMicros: 12_990_000,
    });
    expect(result.next).toEqual(current);
    expect(result.transition).toBe("PriceChanged");
  });

  it("applies a Google item change with its current price", () => {
    const result = applySubscriptionTransition(baseSub, {
      type: "SubscriptionProductChanged",
      productId: "com.example.premium.yearly",
      currency: "USD",
      priceAmountMicros: 99_990_000,
    });
    expect(result.next).toMatchObject({
      productId: "com.example.premium.yearly",
      currency: "USD",
      priceAmountMicros: 99_990_000,
    });
    expect(result.transition).toBe("ProductChanged");
  });

  it("does not create a subscription from an orphan price notice", () => {
    const result = applySubscriptionTransition(null, {
      type: "SubscriptionPriceChange",
      productId: baseSub.productId,
      currency: "USD",
      priceAmountMicros: 12_990_000,
    });
    expect(result.next).toBeNull();
    expect(result.transition).toBe("Ignored");
  });

  it("updates a deferred renewal without calling it a product change", () => {
    const result = applySubscriptionTransition(baseSub, {
      type: "SubscriptionDeferred",
      productId: baseSub.productId,
      expiresAt: 2_500_000_000_000,
    });
    expect(result.next?.expiresAt).toBe(2_500_000_000_000);
    expect(result.active).toBe(true);
    expect(result.transition).toBe("Ignored");
  });

  it.each([
    "SubscriptionStarted",
    "SubscriptionRenewed",
    "SubscriptionRecovered",
    "SubscriptionInGracePeriod",
    "SubscriptionProductChanged",
  ] as const)("does not mark an expired %s transition active", (type) => {
    const result = applySubscriptionTransition(
      type === "SubscriptionStarted" ? null : baseSub,
      {
        type,
        productId: baseSub.productId,
        expiresAt: Date.now() - 1,
      },
    );
    expect(result.active).toBe(false);
  });

  it("TestNotification and PurchaseConsumptionRequest do not mutate state", () => {
    const test = applySubscriptionTransition(baseSub, {
      type: "TestNotification",
    });
    expect(test.next).toEqual(baseSub);
    expect(test.transition).toBeNull();

    const consumption = applySubscriptionTransition(baseSub, {
      type: "PurchaseConsumptionRequest",
    });
    expect(consumption.next).toEqual(baseSub);
  });
});

describe("entitlementActive", () => {
  it("returns true for Active subs whose period has not yet expired", () => {
    expect(
      entitlementActive(
        { state: "Active", productId: "p", expiresAt: 2_000 },
        1_000,
      ),
    ).toBe(true);
  });

  it("returns false once the period has lapsed", () => {
    expect(
      entitlementActive(
        { state: "Active", productId: "p", expiresAt: 1_000 },
        2_000,
      ),
    ).toBe(false);
  });

  it("treats InGracePeriod as entitled", () => {
    expect(
      entitlementActive({
        state: "InGracePeriod",
        productId: "p",
        expiresAt: 2_000_000_000_000,
      }),
    ).toBe(true);
  });

  it("treats Expired / InBillingRetry / Revoked / Refunded / Paused as not entitled", () => {
    for (const state of [
      "Expired",
      "InBillingRetry",
      "Revoked",
      "Refunded",
      "Paused",
    ] as const) {
      expect(
        entitlementActive({
          state,
          productId: "p",
          expiresAt: 2_000_000_000_000,
        }),
      ).toBe(false);
    }
  });
});
