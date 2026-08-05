import { v, type Infer } from "convex/values";
import type { androidpublisher_v3 } from "googleapis";
import type { AppStoreReceiptData } from "../purchases/shared";

// Local RFC3339 → millis parser: importing the one in
// purchases/android.ts would pull a "use node" module into this
// runtime-agnostic file, which the Convex bundler rejects.
function parseTimeToMillis(time?: string | null): number | undefined {
  const value = time?.trim();
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// Read-only order lookup (dashboard support tooling, discussion #284).
// No rows are persisted: the action proxies the store APIs with the
// project's already-configured credentials and returns a normalized
// summary plus the raw payloads for the collapsible technical section.

export const orderLookupStoreValidator = v.union(
  v.literal("apple"),
  v.literal("google"),
);

export type OrderLookupStore = Infer<typeof orderLookupStoreValidator>;

const orderSummaryValidator = v.object({
  productId: v.optional(v.string()),
  productTitle: v.optional(v.string()),
  productType: v.optional(v.string()),
  state: v.optional(v.string()),
  environment: v.optional(v.string()),
  purchaseDate: v.optional(v.number()),
  expiresDate: v.optional(v.number()),
  currency: v.optional(v.string()),
  // Store-native minor/micro units are normalized to micros where the
  // store defines the scale; Apple order lookup prices are milliunits.
  priceAmountMicros: v.optional(v.number()),
  quantity: v.optional(v.number()),
  // Google orders can carry several line items; the summary describes
  // the first one, so the UI can say how many the raw payload holds.
  lineItemCount: v.optional(v.number()),
});

export type OrderSummary = Infer<typeof orderSummaryValidator>;

const subscriptionStatusValidator = v.object({
  // Non-fatal by contract: a failed optional status fetch reports its
  // message here instead of invalidating the order lookup itself.
  error: v.optional(v.string()),
  state: v.optional(v.string()),
  autoRenewing: v.optional(v.boolean()),
  expiresDate: v.optional(v.number()),
  renewalProductId: v.optional(v.string()),
  gracePeriodExpiresDate: v.optional(v.number()),
  raw: v.optional(v.string()),
});

export type OrderSubscriptionStatus = Infer<typeof subscriptionStatusValidator>;

export const orderLookupResponseValidator = v.object({
  store: orderLookupStoreValidator,
  found: v.boolean(),
  orderId: v.string(),
  summary: v.optional(orderSummaryValidator),
  // Apple: one entry per decoded signed transaction in the order.
  transactions: v.optional(v.array(v.any())),
  // Google: purchase token is returned unmasked; the dashboard masks it
  // by default with explicit Show / Copy actions.
  purchaseToken: v.optional(v.string()),
  subscription: v.optional(subscriptionStatusValidator),
  raw: v.string(),
});

export type OrderLookupResponse = Infer<typeof orderLookupResponseValidator>;

// App Store Server API order IDs are alphanumeric, and the client
// concatenates the value straight into the request path without
// percent-encoding — so anything else is rejected before it can steer
// the authenticated request to a different API path.
export function isValidAppleOrderId(orderId: string): boolean {
  return /^[A-Za-z0-9]+$/.test(orderId);
}

// getAllSubscriptionStatuses returns every subscription group the
// customer holds in this app, each with one entry per subscription.
// Pick the entry belonging to the looked-up order instead of the first
// one, or a customer with several subscriptions would see an unrelated
// subscription's status reported as this order's.
export function selectAppleSubscriptionItem<
  T extends { originalTransactionId?: string },
>(
  groups: { lastTransactions?: T[] }[] | undefined,
  orderTransactionIds: string[],
): T | undefined {
  const wanted = new Set(orderTransactionIds);
  return groups
    ?.flatMap((group) => group.lastTransactions ?? [])
    .find(
      (item) =>
        item.originalTransactionId !== undefined &&
        wanted.has(item.originalTransactionId),
    );
}

export function summarizeAppleTransactions(
  transactions: AppStoreReceiptData[],
): OrderSummary | undefined {
  const first = transactions[0];
  if (!first) return undefined;
  return {
    ...(first.productId !== undefined ? { productId: first.productId } : {}),
    ...(first.type !== undefined ? { productType: first.type } : {}),
    ...(first.revocationDate !== undefined
      ? { state: "Revoked" }
      : first.expiresDate !== undefined && first.expiresDate < Date.now()
        ? { state: "Expired" }
        : { state: "Valid" }),
    ...(first.environment !== undefined
      ? { environment: first.environment }
      : {}),
    ...(first.purchaseDate !== undefined
      ? { purchaseDate: first.purchaseDate }
      : {}),
    ...(first.expiresDate !== undefined
      ? { expiresDate: first.expiresDate }
      : {}),
    ...(first.currency !== undefined ? { currency: first.currency } : {}),
    ...(typeof first.price === "number"
      ? { priceAmountMicros: first.price * 1000 }
      : {}),
    ...(first.quantity !== undefined ? { quantity: first.quantity } : {}),
  };
}

export function summarizeGoogleOrder(
  order: androidpublisher_v3.Schema$Order,
): OrderSummary {
  const lineItem = order.lineItems?.[0];
  const total = order.total;
  return {
    ...(lineItem?.productId ? { productId: lineItem.productId } : {}),
    ...(lineItem?.productTitle ? { productTitle: lineItem.productTitle } : {}),
    ...(lineItem?.subscriptionDetails
      ? { productType: "subscription" }
      : lineItem?.oneTimePurchaseDetails
        ? { productType: "inapp" }
        : {}),
    ...(order.state ? { state: order.state } : {}),
    ...(order.createTime
      ? { purchaseDate: parseTimeToMillis(order.createTime) }
      : {}),
    ...(lineItem?.subscriptionDetails?.servicePeriodEndTime
      ? {
          expiresDate: parseTimeToMillis(
            lineItem.subscriptionDetails.servicePeriodEndTime,
          ),
        }
      : {}),
    ...(total?.currencyCode ? { currency: total.currencyCode } : {}),
    ...(total?.units !== undefined || total?.nanos !== undefined
      ? { priceAmountMicros: moneyToMicros(total) }
      : {}),
    ...(order.lineItems && order.lineItems.length > 1
      ? { lineItemCount: order.lineItems.length }
      : {}),
  };
}

export function summarizeGoogleSubscription(
  sub: androidpublisher_v3.Schema$SubscriptionPurchaseV2,
): OrderSubscriptionStatus {
  const lineItem = sub.lineItems?.[0];
  return {
    ...(sub.subscriptionState ? { state: sub.subscriptionState } : {}),
    ...(lineItem?.autoRenewingPlan
      ? { autoRenewing: lineItem.autoRenewingPlan.autoRenewEnabled === true }
      : {}),
    ...(lineItem?.expiryTime
      ? { expiresDate: parseTimeToMillis(lineItem.expiryTime) }
      : {}),
    ...(lineItem?.productId ? { renewalProductId: lineItem.productId } : {}),
    raw: JSON.stringify(sub),
  };
}

function moneyToMicros(
  money: androidpublisher_v3.Schema$Money,
): number | undefined {
  const units = Number(money.units ?? 0);
  const nanos = money.nanos ?? 0;
  if (!Number.isFinite(units)) return undefined;
  return units * 1_000_000 + Math.round(nanos / 1_000);
}
