import { describe, expect, it } from "vitest";
import {
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

  it("marks subscriptions as expired when past expiry date", () => {
    const state = mapGooglePlayPurchaseState({
      type: "Subscription",
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      acknowledgementState: "ACKNOWLEDGED",
      expiryTime: Date.now() - 1000,
    });

    expect(state).toBe(HarmonizedPurchaseState.EXPIRED);
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
});
