import { describe, expect, it } from "vitest";
import { recordAppStoreVerifiedSubscription } from "./ios";
import {
  applyExpectedProductId,
  AppStoreProductType,
  mapToAppStoreReceiptResponse,
} from "./shared";
import { HarmonizedPurchaseState } from "./purchaseState";

describe("App Store mappings (real data)", () => {
  it("treats non-consumable purchase as entitled", () => {
    const receipt = mapToAppStoreReceiptResponse({
      transactionId: "60002463315105",
      originalTransactionId: "60002463315105",
      bundleId: "com.gotterdammerung.untold.ios",
      productId: "untold_full_premium",
      purchaseDate: 1749823893000,
      originalPurchaseDate: 1749823893000,
      quantity: 1,
      type: "Non-Consumable",
      price: 5990,
      currency: "USD",
      storefront: "USA",
      storefrontId: "143441",
      environment: "Production",
      inAppOwnershipType: "PURCHASED",
      signedDate: 1765006915846,
      transactionReason: "PURCHASE",
      appTransactionId: "704587545466907739",
    });

    expect(receipt).toEqual({
      isValid: true,
      state: HarmonizedPurchaseState.ENTITLED,
      productId: "untold_full_premium",
    });
  });

  it("treats consumable purchase as ready to consume", () => {
    const receipt = mapToAppStoreReceiptResponse({
      transactionId: "2000001013981797",
      originalTransactionId: "2000001013981797",
      bundleId: "dev.hyo.martie",
      productId: "dev.hyo.martie.10bulbs",
      purchaseDate: 1758057259000,
      originalPurchaseDate: 1758057259000,
      quantity: 1,
      type: "Consumable",
      price: 9000,
      currency: "SEK",
      storefront: "SWE",
      storefrontId: "143456",
      environment: "Sandbox",
      inAppOwnershipType: "PURCHASED",
      signedDate: 1765025940929,
      transactionReason: "PURCHASE",
      appTransactionId: "704857133985478242",
    });

    expect(receipt).toEqual({
      isValid: true,
      state: HarmonizedPurchaseState.READY_TO_CONSUME,
      productId: "dev.hyo.martie.10bulbs",
    });
  });

  it("treats valid auto-renewable subscription as entitled", () => {
    const now = Date.now();
    const receipt = mapToAppStoreReceiptResponse({
      transactionId: "2000001075170530",
      originalTransactionId: "2000000996303915",
      bundleId: "dev.hyo.martie",
      productId: "dev.hyo.martie.premium",
      purchaseDate: now - 86400000, // 1 day ago
      originalPurchaseDate: now - 86400000 * 10, // 10 days ago
      quantity: 1,
      type: "Auto-Renewable Subscription",
      price: 14000000,
      currency: "KRW",
      storefront: "KOR",
      storefrontId: "143466",
      environment: "Sandbox",
      webOrderLineItemId: "2000000120963779",
      subscriptionGroupIdentifier: "21686373",
      expiresDate: now + 86400000, // 1 day in the future
      inAppOwnershipType: "PURCHASED",
      signedDate: now,
      transactionReason: "PURCHASE",
      appTransactionId: "704794367555291146",
    });

    expect(receipt).toEqual({
      isValid: true,
      state: HarmonizedPurchaseState.ENTITLED,
      productId: "dev.hyo.martie.premium",
    });
  });

  it("treats expired auto-renewable subscription as expired", () => {
    const now = Date.now();
    const receipt = mapToAppStoreReceiptResponse({
      transactionId: "2000001075170530",
      originalTransactionId: "2000000996303915",
      bundleId: "dev.hyo.martie",
      productId: "dev.hyo.martie.premium",
      purchaseDate: now - 86400000 * 2, // 2 days ago
      originalPurchaseDate: now - 86400000 * 10, // 10 days ago
      quantity: 1,
      type: "Auto-Renewable Subscription",
      price: 14000000,
      currency: "KRW",
      storefront: "KOR",
      storefrontId: "143466",
      environment: "Sandbox",
      webOrderLineItemId: "2000000120963779",
      subscriptionGroupIdentifier: "21686373",
      expiresDate: now - 86400000, // 1 day in the past (expired)
      inAppOwnershipType: "PURCHASED",
      signedDate: now,
      transactionReason: "PURCHASE",
      appTransactionId: "704794367555291146",
    });

    expect(receipt).toEqual({
      isValid: false,
      state: HarmonizedPurchaseState.EXPIRED,
      productId: "dev.hyo.martie.premium",
    });
  });

  it("treats revoked transaction as canceled", () => {
    const now = Date.now();
    const receipt = mapToAppStoreReceiptResponse({
      transactionId: "2000001075170530",
      originalTransactionId: "2000000996303915",
      bundleId: "dev.hyo.martie",
      productId: "dev.hyo.martie.premium",
      purchaseDate: now - 86400000 * 2,
      originalPurchaseDate: now - 86400000 * 10,
      quantity: 1,
      type: "Auto-Renewable Subscription",
      price: 14000000,
      currency: "KRW",
      storefront: "KOR",
      storefrontId: "143466",
      environment: "Sandbox",
      webOrderLineItemId: "2000000120963779",
      subscriptionGroupIdentifier: "21686373",
      expiresDate: now + 86400000,
      revocationDate: now - 1000,
      revocationReason: 0,
      inAppOwnershipType: "PURCHASED",
      signedDate: now,
      transactionReason: "PURCHASE",
      appTransactionId: "704794367555291146",
    });

    expect(receipt).toEqual({
      isValid: false,
      state: HarmonizedPurchaseState.CANCELED,
      productId: "dev.hyo.martie.premium",
    });
  });

  it("marks a valid receipt inauthentic when expectedProductId mismatches", () => {
    const receipt = applyExpectedProductId(
      {
        isValid: true,
        state: HarmonizedPurchaseState.ENTITLED,
        productId: "dev.hyo.martie.premium",
      },
      "dev.hyo.martie.coins",
    );

    expect(receipt).toEqual({
      isValid: false,
      state: HarmonizedPurchaseState.INAUTHENTIC,
      productId: "dev.hyo.martie.premium",
    });
  });
});

describe("recordAppStoreVerifiedSubscription", () => {
  function makeRunMutationRecorder(): {
    ctx: Parameters<typeof recordAppStoreVerifiedSubscription>[0];
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
    } as unknown as Parameters<typeof recordAppStoreVerifiedSubscription>[0];
    return { ctx, calls };
  }

  it("records subscription transactions with store-verified state and micros pricing", async () => {
    const { ctx, calls } = makeRunMutationRecorder();

    await recordAppStoreVerifiedSubscription(ctx, {
      projectId: "projects_1" as never,
      remoteId: "original-transaction-1",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      transactionData: {
        transactionId: "transaction-1",
        originalTransactionId: "original-transaction-1",
        bundleId: "dev.hyo.martie",
        productId: "dev.hyo.martie.premium",
        type: AppStoreProductType.AUTO_RENEWABLE_SUBSCRIPTION,
        environment: "Sandbox",
        expiresDate: 1_769_904_000_000,
        currency: "USD",
        price: 9990,
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      projectId: "projects_1",
      platform: "IOS",
      purchaseToken: "original-transaction-1",
      productId: "dev.hyo.martie.premium",
      purchaseState: HarmonizedPurchaseState.ENTITLED,
      expiresAt: 1_769_904_000_000,
      currency: "USD",
      priceAmountMicros: 9_990_000,
    });
  });

  it("skips non-subscription transactions", async () => {
    const { ctx, calls } = makeRunMutationRecorder();

    await recordAppStoreVerifiedSubscription(ctx, {
      projectId: "projects_1" as never,
      remoteId: "transaction-1",
      purchaseState: HarmonizedPurchaseState.READY_TO_CONSUME,
      transactionData: {
        transactionId: "transaction-1",
        bundleId: "dev.hyo.martie",
        productId: "dev.hyo.martie.10bulbs",
        type: AppStoreProductType.CONSUMABLE,
        environment: "Sandbox",
        currency: "USD",
        price: 9990,
      },
    });

    expect(calls).toHaveLength(0);
  });
});
