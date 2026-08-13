import { describe, expect, it } from "vitest";
import {
  AppStoreProductType,
  AppStoreTransactionReason,
  mapAppStorePurchaseState,
  mapGooglePlayPurchaseState,
  mapToPurchaseType,
  PurchaseType,
  isValidState,
} from "./shared";
import { HarmonizedPurchaseState } from "./purchaseState";

describe("mapGooglePlayPurchaseState", () => {
  it("treats acknowledged in-app purchases as entitled when not marked consumable", () => {
    const state = mapGooglePlayPurchaseState({
      type: "InApp",
      purchaseState: "PURCHASED",
      acknowledgementState: "ACKNOWLEDGED",
      consumptionState: "NOT_CONSUMED",
    });

    expect(state).toBe(HarmonizedPurchaseState.ENTITLED);
  });

  it("returns pending acknowledgment when an in-app purchase lacks acknowledgment", () => {
    const state = mapGooglePlayPurchaseState({
      type: "InApp",
      purchaseState: "PURCHASED",
      acknowledgementState: "NOT_ACKNOWLEDGED",
      consumptionState: "NOT_CONSUMED",
    });

    expect(state).toBe(HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT);
  });

  it("maps unconsumed catalog-known consumables to ready-to-consume", () => {
    const state = mapGooglePlayPurchaseState(
      {
        type: "InApp",
        purchaseState: "PURCHASED",
        acknowledgementState: "NOT_ACKNOWLEDGED",
        consumptionState: "NOT_CONSUMED",
      },
      "Consumable",
    );

    expect(state).toBe(HarmonizedPurchaseState.READY_TO_CONSUME);
  });

  it("maps acknowledged-but-unconsumed catalog-known consumables to ready-to-consume", () => {
    const state = mapGooglePlayPurchaseState(
      {
        type: "InApp",
        purchaseState: "PURCHASED",
        acknowledgementState: "ACKNOWLEDGED",
        consumptionState: "NOT_CONSUMED",
      },
      "Consumable",
    );

    expect(state).toBe(HarmonizedPurchaseState.READY_TO_CONSUME);
  });

  it("still reports consumed for catalog-known consumables Google marks consumed", () => {
    const state = mapGooglePlayPurchaseState(
      {
        type: "InApp",
        purchaseState: "PURCHASED",
        acknowledgementState: "ACKNOWLEDGED",
        consumptionState: "CONSUMED",
      },
      "Consumable",
    );

    expect(state).toBe(HarmonizedPurchaseState.CONSUMED);
  });

  it("keeps pending acknowledgment for catalog-known non-consumables", () => {
    const state = mapGooglePlayPurchaseState(
      {
        type: "InApp",
        purchaseState: "PURCHASED",
        acknowledgementState: "NOT_ACKNOWLEDGED",
        consumptionState: "NOT_CONSUMED",
      },
      "NonConsumable",
    );

    expect(state).toBe(HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT);
  });

  it("keeps pending acknowledgment when the product is not in the catalog", () => {
    const state = mapGooglePlayPurchaseState(
      {
        type: "InApp",
        purchaseState: "PURCHASED",
        acknowledgementState: "NOT_ACKNOWLEDGED",
        consumptionState: "NOT_CONSUMED",
      },
      null,
    );

    expect(state).toBe(HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT);
  });

  it("ignores the catalog type for subscription receipts", () => {
    const state = mapGooglePlayPurchaseState(
      {
        type: "Subscription",
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        acknowledgementState: "ACKNOWLEDGED",
        expiryTime: Date.now() + 1000,
      },
      "Consumable",
    );

    expect(state).toBe(HarmonizedPurchaseState.ENTITLED);
  });

  it("marks subscriptions as expired when past expiry date", () => {
    const state = mapGooglePlayPurchaseState({
      type: "Subscription",
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      acknowledgementState: "ACKNOWLEDGED",
      expiryTime: Date.now() - 1000,
    });

    expect(state).toBe(HarmonizedPurchaseState.EXPIRED);
  });

  it("keeps canceled-but-not-expired subscriptions entitled", () => {
    const state = mapGooglePlayPurchaseState({
      type: "Subscription",
      subscriptionState: "SUBSCRIPTION_STATE_CANCELED",
      acknowledgementState: "ACKNOWLEDGED",
      expiryTime: Date.now() + 1000,
    });

    expect(state).toBe(HarmonizedPurchaseState.ENTITLED);
  });

  it("marks in-app purchases as consumed when Google Play reports it", () => {
    const state = mapGooglePlayPurchaseState({
      type: "InApp",
      purchaseState: "PURCHASED",
      acknowledgementState: "ACKNOWLEDGED",
      consumptionState: "CONSUMED",
    });

    expect(state).toBe(HarmonizedPurchaseState.CONSUMED);
  });

  it("treats productPurchaseV2 yet-to-be-consumed purchases as entitled", () => {
    const state = mapGooglePlayPurchaseState({
      type: "InApp",
      purchaseState: "PURCHASED",
      acknowledgementState: "ACKNOWLEDGED",
      consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
    });

    expect(state).toBe(HarmonizedPurchaseState.ENTITLED);
  });

  it("marks productPurchaseV2 consumptions as consumed", () => {
    const state = mapGooglePlayPurchaseState({
      type: "InApp",
      purchaseState: "PURCHASED",
      acknowledgementState: "ACKNOWLEDGED",
      consumptionState: "CONSUMPTION_STATE_CONSUMED",
    });

    expect(state).toBe(HarmonizedPurchaseState.CONSUMED);
  });

  it("treats Google Play CANCELLED spelling as canceled state", () => {
    const state = mapGooglePlayPurchaseState({
      type: "InApp",
      purchaseState: "CANCELLED",
      acknowledgementState: "NOT_ACKNOWLEDGED",
    });

    expect(state).toBe(HarmonizedPurchaseState.CANCELED);
  });
});

describe("mapToPurchaseType", () => {
  it("infers consumable type from consumable states", () => {
    expect(
      mapToPurchaseType("InApp", HarmonizedPurchaseState.READY_TO_CONSUME),
    ).toBe(PurchaseType.CONSUMABLE);
  });

  it("defaults Google Play in-app products to non-consumable without hints", () => {
    expect(mapToPurchaseType("InApp", HarmonizedPurchaseState.ENTITLED)).toBe(
      PurchaseType.NON_CONSUMABLE,
    );
  });

  it("maps subscriptions to subscription purchase type", () => {
    expect(
      mapToPurchaseType("Subscription", HarmonizedPurchaseState.ENTITLED),
    ).toBe(PurchaseType.SUB);
  });
});

describe("mapAppStorePurchaseState", () => {
  it("returns expired when the purchase is past its expiration date", () => {
    const now = Date.now();
    const state = mapAppStorePurchaseState(
      undefined,
      now - 2000,
      undefined,
      undefined,
    );

    expect(state).toBe(HarmonizedPurchaseState.EXPIRED);
  });

  // Golden table. Every row decides what a published app sees for a real
  // App Store transaction, and IAPKit ships without an SDK release, so a
  // mapping change has to show up here as an explicit diff.
  const APP_STORE_GOLDEN: Array<{
    label: string;
    reason?: AppStoreTransactionReason;
    expiresDate?: number;
    type?: AppStoreProductType;
    revocationDate?: number;
    expected: HarmonizedPurchaseState;
  }> = [
    {
      label: "revoked transaction outranks everything else",
      reason: AppStoreTransactionReason.PURCHASE,
      revocationDate: 1_700_000_000_000,
      type: AppStoreProductType.NON_CONSUMABLE,
      expected: HarmonizedPurchaseState.CANCELED,
    },
    {
      label: "lapsed subscription",
      reason: AppStoreTransactionReason.RENEWAL,
      expiresDate: 1_700_000_000_000,
      type: AppStoreProductType.AUTO_RENEWABLE_SUBSCRIPTION,
      expected: HarmonizedPurchaseState.EXPIRED,
    },
    {
      label: "first purchase of a consumable",
      reason: AppStoreTransactionReason.PURCHASE,
      type: AppStoreProductType.CONSUMABLE,
      expected: HarmonizedPurchaseState.READY_TO_CONSUME,
    },
    {
      label: "first purchase of a non-consumable",
      reason: AppStoreTransactionReason.PURCHASE,
      type: AppStoreProductType.NON_CONSUMABLE,
      expected: HarmonizedPurchaseState.ENTITLED,
    },
    {
      label: "subscription renewal",
      reason: AppStoreTransactionReason.RENEWAL,
      type: AppStoreProductType.AUTO_RENEWABLE_SUBSCRIPTION,
      expected: HarmonizedPurchaseState.ENTITLED,
    },
    {
      label: "renewal of a consumable is still a renewal",
      reason: AppStoreTransactionReason.RENEWAL,
      type: AppStoreProductType.CONSUMABLE,
      expected: HarmonizedPurchaseState.ENTITLED,
    },
    {
      label: "consumable without a transaction reason",
      type: AppStoreProductType.CONSUMABLE,
      expected: HarmonizedPurchaseState.READY_TO_CONSUME,
    },
    {
      label: "non-renewing subscription without a transaction reason",
      type: AppStoreProductType.NON_RENEWING_SUBSCRIPTION,
      expected: HarmonizedPurchaseState.ENTITLED,
    },
    {
      label: "unexpired transaction with nothing else known",
      expiresDate: Date.now() + 86_400_000,
      expected: HarmonizedPurchaseState.ENTITLED,
    },
  ];

  it.each(APP_STORE_GOLDEN)("maps $label", (row) => {
    expect(
      mapAppStorePurchaseState(
        row.reason,
        row.expiresDate,
        row.type,
        row.revocationDate,
      ),
    ).toBe(row.expected);
  });
});

describe("isValidState", () => {
  it("returns true for ENTITLED state", () => {
    expect(isValidState(HarmonizedPurchaseState.ENTITLED)).toBe(true);
  });

  it("returns true for PENDING_ACKNOWLEDGMENT state", () => {
    expect(isValidState(HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT)).toBe(
      true,
    );
  });

  it("returns true for READY_TO_CONSUME state", () => {
    expect(isValidState(HarmonizedPurchaseState.READY_TO_CONSUME)).toBe(true);
  });

  it("returns false for PENDING state", () => {
    expect(isValidState(HarmonizedPurchaseState.PENDING)).toBe(false);
  });

  it("returns false for CANCELED state", () => {
    expect(isValidState(HarmonizedPurchaseState.CANCELED)).toBe(false);
  });

  it("returns false for EXPIRED state", () => {
    expect(isValidState(HarmonizedPurchaseState.EXPIRED)).toBe(false);
  });

  it("returns false for CONSUMED state", () => {
    expect(isValidState(HarmonizedPurchaseState.CONSUMED)).toBe(false);
  });

  it("returns false for UNKNOWN state", () => {
    expect(isValidState(HarmonizedPurchaseState.UNKNOWN)).toBe(false);
  });

  it("returns false for INAUTHENTIC state", () => {
    expect(isValidState(HarmonizedPurchaseState.INAUTHENTIC)).toBe(false);
  });

  // `isValid` is the field every SDK gates entitlement on, and IAPKit deploys
  // from main without an SDK release — widening or narrowing this set changes
  // what already-published apps unlock, for every user, immediately. Pinning
  // the whole set (rather than testing states one by one) means a state added
  // later cannot default into either answer unnoticed.
  it("entitles exactly these states", () => {
    const entitling = Object.values(HarmonizedPurchaseState).filter(
      isValidState,
    );

    expect(entitling).toEqual([
      HarmonizedPurchaseState.ENTITLED,
      HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT,
      HarmonizedPurchaseState.READY_TO_CONSUME,
    ]);
  });
});
