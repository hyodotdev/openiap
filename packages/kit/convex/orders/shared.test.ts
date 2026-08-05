import { describe, expect, it } from "vitest";
import type { androidpublisher_v3 } from "googleapis";
import type { AppStoreReceiptData } from "../purchases/shared";
import {
  isValidAppleOrderId,
  orderLookupResponseValidator,
  selectAppleSubscriptionItem,
  summarizeAppleTransactions,
  summarizeGoogleOrder,
  summarizeGoogleSubscription,
  type OrderLookupResponse,
} from "./shared";

describe("isValidAppleOrderId", () => {
  it("accepts alphanumeric App Store order IDs", () => {
    expect(isValidAppleOrderId("MT0000000000000")).toBe(true);
    expect(isValidAppleOrderId("ABC123xyz")).toBe(true);
  });

  it("rejects values that could steer the request path", () => {
    // lookUpOrderId concatenates the value into the request path
    // without percent-encoding, so separators must never reach it.
    expect(isValidAppleOrderId("../../v2/history/123")).toBe(false);
    expect(isValidAppleOrderId("MT123/extra")).toBe(false);
    expect(isValidAppleOrderId("MT123?query=1")).toBe(false);
    expect(isValidAppleOrderId("MT123#frag")).toBe(false);
    expect(isValidAppleOrderId("MT 123")).toBe(false);
    expect(isValidAppleOrderId("")).toBe(false);
  });
});

describe("selectAppleSubscriptionItem", () => {
  const groups = [
    {
      lastTransactions: [
        { originalTransactionId: "1000000000000001", status: 2 },
        { originalTransactionId: "1000000000000002", status: 1 },
      ],
    },
    {
      lastTransactions: [
        { originalTransactionId: "1000000000000003", status: 5 },
      ],
    },
  ];

  it("returns the entry belonging to the looked-up order", () => {
    // Regression: taking [0][0] blindly reported an unrelated
    // subscription's status for customers holding several.
    expect(selectAppleSubscriptionItem(groups, ["1000000000000002"])).toEqual({
      originalTransactionId: "1000000000000002",
      status: 1,
    });
  });

  it("searches across every subscription group", () => {
    expect(selectAppleSubscriptionItem(groups, ["1000000000000003"])).toEqual({
      originalTransactionId: "1000000000000003",
      status: 5,
    });
  });

  it("returns undefined when the order's subscription is absent", () => {
    expect(
      selectAppleSubscriptionItem(groups, ["9999999999999999"]),
    ).toBeUndefined();
  });

  it("tolerates missing data and entries without an id", () => {
    expect(selectAppleSubscriptionItem(undefined, ["1"])).toBeUndefined();
    expect(selectAppleSubscriptionItem([{}], ["1"])).toBeUndefined();
    expect(
      selectAppleSubscriptionItem([{ lastTransactions: [{}] }], ["1"]),
    ).toBeUndefined();
  });
});

describe("summarizeGoogleOrder", () => {
  it("maps a subscription line item with servicePeriodEndTime to a subscription summary", () => {
    const order: androidpublisher_v3.Schema$Order = {
      orderId: "GPA.1111-2222-3333-44444",
      state: "CONFIRMED",
      createTime: "2026-01-01T00:00:00.000Z",
      lineItems: [
        {
          productId: "dev.hyo.martie.premium",
          productTitle: "Martie Premium",
          subscriptionDetails: {
            basePlanId: "premium",
            servicePeriodStartTime: "2026-01-01T00:00:00.000Z",
            servicePeriodEndTime: "2026-02-01T00:00:00.000Z",
          },
        },
      ],
      total: { currencyCode: "USD", units: "4", nanos: 990_000_000 },
    };

    expect(summarizeGoogleOrder(order)).toEqual({
      productId: "dev.hyo.martie.premium",
      productTitle: "Martie Premium",
      productType: "subscription",
      state: "CONFIRMED",
      purchaseDate: Date.parse("2026-01-01T00:00:00.000Z"),
      expiresDate: Date.parse("2026-02-01T00:00:00.000Z"),
      currency: "USD",
      priceAmountMicros: 4_990_000,
    });
  });

  it("maps a one-time purchase line item to inapp without an expiry", () => {
    const order: androidpublisher_v3.Schema$Order = {
      orderId: "GPA.5555-6666-7777-88888",
      state: "CONFIRMED",
      createTime: "2026-01-15T10:30:00.000Z",
      lineItems: [
        {
          productId: "dev.hyo.martie.10bulbs",
          productTitle: "10 Bulbs",
          oneTimePurchaseDetails: { quantity: 1 },
        },
      ],
      total: { currencyCode: "KRW", units: "1200" },
    };

    const summary = summarizeGoogleOrder(order);

    expect(summary).toEqual({
      productId: "dev.hyo.martie.10bulbs",
      productTitle: "10 Bulbs",
      productType: "inapp",
      state: "CONFIRMED",
      purchaseDate: Date.parse("2026-01-15T10:30:00.000Z"),
      currency: "KRW",
      priceAmountMicros: 1_200_000_000,
    });
    expect(summary.expiresDate).toBeUndefined();
  });

  it("converts Money nanos without units to micros", () => {
    const order: androidpublisher_v3.Schema$Order = {
      total: { currencyCode: "USD", nanos: 500_000_000 },
    };

    expect(summarizeGoogleOrder(order).priceAmountMicros).toBe(500_000);
  });

  it("drops the price when Money units are not numeric", () => {
    const order: androidpublisher_v3.Schema$Order = {
      total: { currencyCode: "USD", units: "not-a-number" },
    };

    expect(summarizeGoogleOrder(order).priceAmountMicros).toBeUndefined();
  });

  it("omits the price when Money has neither units nor nanos", () => {
    const order: androidpublisher_v3.Schema$Order = {
      total: { currencyCode: "USD" },
    };

    expect("priceAmountMicros" in summarizeGoogleOrder(order)).toBe(false);
  });

  it("omits every key for an order with no mappable fields", () => {
    expect(Object.keys(summarizeGoogleOrder({}))).toEqual([]);
  });

  it("reports the line item count only when the order has more than one", () => {
    // The summary describes lineItems[0]; the count lets the dashboard
    // say so instead of silently hiding the rest.
    const single: androidpublisher_v3.Schema$Order = {
      lineItems: [{ productId: "a" }],
    };
    const multiple: androidpublisher_v3.Schema$Order = {
      lineItems: [{ productId: "a" }, { productId: "b" }, { productId: "c" }],
    };

    expect("lineItemCount" in summarizeGoogleOrder(single)).toBe(false);
    expect(summarizeGoogleOrder(multiple).lineItemCount).toBe(3);
    expect(summarizeGoogleOrder(multiple).productId).toBe("a");
  });

  it("leaves timestamps unset when the store returns unparsable times", () => {
    const order: androidpublisher_v3.Schema$Order = {
      createTime: "not-a-date",
      lineItems: [
        {
          productId: "dev.hyo.martie.premium",
          subscriptionDetails: { servicePeriodEndTime: "also-not-a-date" },
        },
      ],
    };

    const summary = summarizeGoogleOrder(order);

    expect(summary.purchaseDate).toBeUndefined();
    expect(summary.expiresDate).toBeUndefined();
    expect(summary.productType).toBe("subscription");
  });
});

describe("summarizeAppleTransactions", () => {
  const baseTransaction: AppStoreReceiptData = {
    transactionId: "2000000123456789",
    productId: "dev.hyo.martie.premium",
    type: "Auto-Renewable Subscription",
    environment: "Production",
    purchaseDate: 1_700_000_000_000,
    currency: "USD",
    price: 9_990,
    quantity: 1,
  };

  it("returns undefined for an empty transaction list", () => {
    expect(summarizeAppleTransactions([])).toBeUndefined();
  });

  it("summarizes an active subscription as Valid with milliunit price in micros", () => {
    const expiresDate = Date.now() + 86_400_000;

    expect(
      summarizeAppleTransactions([{ ...baseTransaction, expiresDate }]),
    ).toEqual({
      productId: "dev.hyo.martie.premium",
      productType: "Auto-Renewable Subscription",
      state: "Valid",
      environment: "Production",
      purchaseDate: 1_700_000_000_000,
      expiresDate,
      currency: "USD",
      priceAmountMicros: 9_990_000,
      quantity: 1,
    });
  });

  it("marks a past expiresDate as Expired", () => {
    const summary = summarizeAppleTransactions([
      { ...baseTransaction, expiresDate: Date.now() - 86_400_000 },
    ]);

    expect(summary?.state).toBe("Expired");
  });

  it("marks a revoked transaction as Revoked even when it is also expired", () => {
    const summary = summarizeAppleTransactions([
      {
        ...baseTransaction,
        expiresDate: Date.now() - 86_400_000,
        revocationDate: 1_710_000_000_000,
      },
    ]);

    expect(summary?.state).toBe("Revoked");
  });

  it("treats a transaction without expiresDate as Valid", () => {
    const summary = summarizeAppleTransactions([
      { ...baseTransaction, type: "Consumable" },
    ]);

    expect(summary?.state).toBe("Valid");
    expect(summary?.expiresDate).toBeUndefined();
  });

  it("summarizes only the first transaction", () => {
    const summary = summarizeAppleTransactions([
      baseTransaction,
      { ...baseTransaction, productId: "dev.hyo.martie.other" },
    ]);

    expect(summary?.productId).toBe("dev.hyo.martie.premium");
  });

  it("omits unset optional fields", () => {
    expect(summarizeAppleTransactions([{ environment: "Sandbox" }])).toEqual({
      state: "Valid",
      environment: "Sandbox",
    });
  });
});

describe("summarizeGoogleSubscription", () => {
  it("maps state, auto-renew, expiry, and renewal product with raw passthrough", () => {
    const sub: androidpublisher_v3.Schema$SubscriptionPurchaseV2 = {
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      lineItems: [
        {
          productId: "dev.hyo.martie.premium",
          expiryTime: "2026-02-01T00:00:00.000Z",
          autoRenewingPlan: { autoRenewEnabled: true },
        },
      ],
    };

    expect(summarizeGoogleSubscription(sub)).toEqual({
      state: "SUBSCRIPTION_STATE_ACTIVE",
      autoRenewing: true,
      expiresDate: Date.parse("2026-02-01T00:00:00.000Z"),
      renewalProductId: "dev.hyo.martie.premium",
      raw: JSON.stringify(sub),
    });
  });

  it("reports autoRenewing false when the plan omits autoRenewEnabled", () => {
    const sub: androidpublisher_v3.Schema$SubscriptionPurchaseV2 = {
      lineItems: [{ autoRenewingPlan: {} }],
    };

    expect(summarizeGoogleSubscription(sub).autoRenewing).toBe(false);
  });

  it("omits autoRenewing entirely for plans without autoRenewingPlan", () => {
    const sub: androidpublisher_v3.Schema$SubscriptionPurchaseV2 = {
      subscriptionState: "SUBSCRIPTION_STATE_EXPIRED",
      lineItems: [
        {
          productId: "dev.hyo.martie.premium",
          expiryTime: "2025-12-06T09:55:21.497Z",
          prepaidPlan: {},
        },
      ],
    };

    const summary = summarizeGoogleSubscription(sub);

    expect("autoRenewing" in summary).toBe(false);
    expect(summary.expiresDate).toBe(Date.parse("2025-12-06T09:55:21.497Z"));
  });

  it("leaves expiresDate unset for an unparsable expiryTime", () => {
    const sub: androidpublisher_v3.Schema$SubscriptionPurchaseV2 = {
      lineItems: [{ expiryTime: "not-a-date" }],
    };

    expect(summarizeGoogleSubscription(sub).expiresDate).toBeUndefined();
  });

  it("always includes the raw JSON payload", () => {
    expect(summarizeGoogleSubscription({})).toEqual({ raw: "{}" });
  });
});

describe("orderLookupResponseValidator", () => {
  // No existing test exercises convex `v.*` validators at runtime (they have
  // no public parse API), so acceptance is asserted through the Infer'd
  // OrderLookupResponse type: these fixtures fail `bun run lint` if the
  // validator shape stops accepting them.
  it("declares the response fields the dashboard consumes", () => {
    expect(orderLookupResponseValidator.kind).toBe("object");
    expect(Object.keys(orderLookupResponseValidator.fields).sort()).toEqual([
      "found",
      "orderId",
      "purchaseToken",
      "raw",
      "store",
      "subscription",
      "summary",
      "transactions",
    ]);
  });

  it("accepts a representative full response shape", () => {
    const response: OrderLookupResponse = {
      store: "google",
      found: true,
      orderId: "GPA.1111-2222-3333-44444",
      summary: {
        productId: "dev.hyo.martie.premium",
        productTitle: "Martie Premium",
        productType: "subscription",
        state: "CONFIRMED",
        purchaseDate: 1_700_000_000_000,
        expiresDate: 1_769_904_000_000,
        currency: "USD",
        priceAmountMicros: 4_990_000,
      },
      purchaseToken: "sub-token",
      subscription: {
        state: "SUBSCRIPTION_STATE_ACTIVE",
        autoRenewing: true,
        expiresDate: 1_769_904_000_000,
        renewalProductId: "dev.hyo.martie.premium",
        raw: "{}",
      },
      raw: "{}",
    };

    expect(response.found).toBe(true);
    expect(response.store).toBe("google");
  });

  it("accepts a not-found response without optional sections", () => {
    const response: OrderLookupResponse = {
      store: "apple",
      found: false,
      orderId: "MT0000000000000",
      raw: "{}",
    };

    expect(response.found).toBe(false);
    expect(response.summary).toBeUndefined();
  });
});
