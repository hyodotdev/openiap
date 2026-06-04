import { v, Infer } from "convex/values";
import { internal } from "../_generated/api";
import { ActionCtx } from "../_generated/server";
import { InvalidApiKeyError } from "./errors";
import {
  harmonizedPurchaseStateValidator,
  HarmonizedPurchaseState,
} from "./purchaseState";

// Copy of TransactionReason enum and Type enum from @apple/app-store-server-library (to avoid importing the library because it required node)
export enum AppStoreTransactionReason {
  PURCHASE = "PURCHASE",
  RENEWAL = "RENEWAL",
}

export enum AppStoreProductType {
  AUTO_RENEWABLE_SUBSCRIPTION = "Auto-Renewable Subscription",
  NON_CONSUMABLE = "Non-Consumable",
  CONSUMABLE = "Consumable",
  NON_RENEWING_SUBSCRIPTION = "Non-Renewing Subscription",
}

export enum PurchaseType {
  NON_CONSUMABLE = "NON_CONSUMABLE",
  SUB = "SUBSCRIPTION",
  CONSUMABLE = "CONSUMABLE",
  UNKNOWN = "UNKNOWN",
}

export const googlePlayReceiptDataValidator = v.object({
  transactionId: v.string(),
  packageName: v.string(),
  productId: v.string(),
  purchaseToken: v.string(),
  purchaseDate: v.number(),
  quantity: v.number(),
  type: v.union(v.literal("Subscription"), v.literal("InApp")),
  orderId: v.optional(v.string()),
  subscriptionState: v.optional(v.string()),
  purchaseState: v.optional(v.string()),
  acknowledgementState: v.optional(v.string()),
  consumptionState: v.optional(v.string()),
  expiryTime: v.optional(v.number()),
});

export type GooglePlayReceiptData = Infer<
  typeof googlePlayReceiptDataValidator
>;

export const appStoreReceiptDataValidator = v.object({
  transactionId: v.optional(v.string()),
  originalTransactionId: v.optional(v.string()),
  bundleId: v.optional(v.string()),
  productId: v.optional(v.string()),
  purchaseDate: v.optional(v.number()),
  originalPurchaseDate: v.optional(v.number()),
  quantity: v.optional(v.number()),
  type: v.optional(v.string()),
  price: v.optional(v.number()),
  currency: v.optional(v.string()),
  environment: v.union(v.literal("Sandbox"), v.literal("Production")),
  storefront: v.optional(v.string()),
  storefrontId: v.optional(v.string()),
  webOrderLineItemId: v.optional(v.string()),
  subscriptionGroupIdentifier: v.optional(v.string()),
  expiresDate: v.optional(v.number()),
  gracePeriodExpiresDate: v.optional(v.number()),
  revocationDate: v.optional(v.number()),
  revocationReason: v.optional(v.number()),
  deviceVerification: v.optional(v.string()),
  deviceVerificationNonce: v.optional(v.string()),
  inAppOwnershipType: v.optional(v.string()),
  signedDate: v.optional(v.number()),
  transactionReason: v.optional(v.string()),
  appTransactionId: v.optional(v.string()),
  failureReason: v.optional(
    v.object({
      code: v.string(),
      message: v.string(),
      details: v.optional(v.any()),
    }),
  ),
});

export type AppStoreReceiptData = Infer<typeof appStoreReceiptDataValidator>;

export type ReceiptResponse = Infer<typeof receiptResponseValidator>;

export const purchaseTypeValidator = v.union(
  v.literal("NON_CONSUMABLE"),
  v.literal("SUBSCRIPTION"),
  v.literal("CONSUMABLE"),
  v.literal("UNKNOWN"),
);

export const receiptResponseValidator = v.object({
  isValid: v.boolean(),
  state: harmonizedPurchaseStateValidator,
  productId: v.optional(v.string()),
});

export async function getProjectByApiKey(ctx: ActionCtx, apiKey: string) {
  const project = await ctx.runQuery(
    internal.projects.internal.getProjectByApiKey,
    { apiKey },
  );

  if (!project) {
    throw new InvalidApiKeyError();
  }

  return project;
}

function normalizeAppStoreTransactionReason(
  reason?: string,
): AppStoreTransactionReason | undefined {
  if (!reason) {
    return undefined;
  }

  const normalizedReason = reason as AppStoreTransactionReason;

  if (
    normalizedReason === AppStoreTransactionReason.PURCHASE ||
    normalizedReason === AppStoreTransactionReason.RENEWAL
  ) {
    return normalizedReason;
  }

  return undefined;
}

function normalizeAppStoreProductType(
  type?: string,
): AppStoreProductType | undefined {
  if (!type) {
    return undefined;
  }

  const normalizedType = type as AppStoreProductType;

  if (
    normalizedType === AppStoreProductType.CONSUMABLE ||
    normalizedType === AppStoreProductType.NON_CONSUMABLE ||
    normalizedType === AppStoreProductType.AUTO_RENEWABLE_SUBSCRIPTION ||
    normalizedType === AppStoreProductType.NON_RENEWING_SUBSCRIPTION
  ) {
    return normalizedType;
  }

  return undefined;
}

export function mapToAppStoreReceiptResponse(
  receiptData: AppStoreReceiptData,
): ReceiptResponse {
  const state = mapAppStorePurchaseState(
    normalizeAppStoreTransactionReason(receiptData.transactionReason),
    receiptData.expiresDate,
    normalizeAppStoreProductType(receiptData.type),
    receiptData.revocationDate,
  );

  return {
    isValid: isValidState(state),
    state,
    ...(receiptData.productId ? { productId: receiptData.productId } : {}),
  };
}

export function mapToGooglePlayReceiptResponse(
  receiptData: GooglePlayReceiptData,
): ReceiptResponse {
  const state = mapGooglePlayPurchaseState(receiptData);

  return {
    isValid: isValidState(state),
    state,
    productId: receiptData.productId,
  };
}

export function applyExpectedProductId(
  receiptResponse: ReceiptResponse,
  expectedProductId?: string,
): ReceiptResponse {
  if (
    expectedProductId === undefined ||
    receiptResponse.productId === expectedProductId
  ) {
    return receiptResponse;
  }

  return {
    ...receiptResponse,
    isValid: false,
    state: HarmonizedPurchaseState.INAUTHENTIC,
  };
}

function isAcknowledged(acknowledgementState?: string): boolean {
  const normalized = acknowledgementState?.toUpperCase();

  if (!normalized) {
    return false;
  }

  if (normalized.includes("NOT_ACKNOWLEDGED")) {
    return false;
  }

  return normalized.includes("ACKNOWLEDGED");
}

function hasConsumptionFlag(consumptionState?: string): boolean {
  if (!consumptionState) {
    return false;
  }

  const normalized = consumptionState.toUpperCase();

  switch (normalized) {
    case "CONSUMPTION_STATE_CONSUMED":
    case "CONSUMED":
      return true;
    case "CONSUMPTION_STATE_YET_TO_BE_CONSUMED":
    case "CONSUMPTION_STATE_NOT_CONSUMED":
    case "CONSUMPTION_STATE_UNSPECIFIED":
    case "CONSUMPTION_STATE_UNKNOWN":
    case "NOT_CONSUMED":
      return false;
    default:
      return matchesConsumedToken(normalized);
  }
}

// Anchored fallback for Google states the switch above doesn't list
// (e.g. future `CONSUMPTION_STATE_*_CONSUMED` variants). The earlier
// loose `.includes("CONSUMED")` check would have wrongly matched
// arbitrary substrings like `RECONSUMED`; key on word-boundary tokens
// (`_CONSUMED` suffix or full equality) and treat any `_NOT_CONSUMED`
// suffix or `YET_TO_BE_CONSUMED` substring as a negative.
function matchesConsumedToken(normalized: string): boolean {
  const isConsumedToken =
    normalized.endsWith("_CONSUMED") || normalized === "CONSUMED";
  const isNotConsumedToken =
    normalized.endsWith("_NOT_CONSUMED") ||
    normalized === "NOT_CONSUMED" ||
    normalized.includes("YET_TO_BE_CONSUMED");
  return isConsumedToken && !isNotConsumedToken;
}

export function mapGooglePlayPurchaseState(
  receipt: Pick<
    GooglePlayReceiptData,
    | "type"
    | "subscriptionState"
    | "purchaseState"
    | "acknowledgementState"
    | "consumptionState"
    | "expiryTime"
  >,
): HarmonizedPurchaseState {
  if (receipt.type === "Subscription") {
    if (receipt.expiryTime && receipt.expiryTime < Date.now()) {
      return HarmonizedPurchaseState.EXPIRED;
    }

    const subscriptionState = receipt.subscriptionState?.toUpperCase();

    switch (subscriptionState) {
      case "SUBSCRIPTION_STATE_CANCELED":
        return HarmonizedPurchaseState.CANCELED;
      case "SUBSCRIPTION_STATE_EXPIRED":
        return HarmonizedPurchaseState.EXPIRED;
      case "SUBSCRIPTION_STATE_PENDING":
      case "SUBSCRIPTION_STATE_ON_HOLD":
      case "SUBSCRIPTION_STATE_PAUSED":
        return HarmonizedPurchaseState.PENDING;
      case "SUBSCRIPTION_STATE_ACTIVE":
      case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
        return isAcknowledged(receipt.acknowledgementState)
          ? HarmonizedPurchaseState.ENTITLED
          : HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT;
      default:
        break;
    }

    // If we have an acknowledgement state but no clear subscription state
    if (isAcknowledged(receipt.acknowledgementState)) {
      return HarmonizedPurchaseState.ENTITLED;
    }

    return HarmonizedPurchaseState.UNKNOWN;
  }

  const purchaseState = receipt.purchaseState?.toUpperCase();

  if (purchaseState?.includes("PURCHASED")) {
    if (hasConsumptionFlag(receipt.consumptionState)) {
      return HarmonizedPurchaseState.CONSUMED;
    }

    return isAcknowledged(receipt.acknowledgementState)
      ? HarmonizedPurchaseState.ENTITLED
      : HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT;
  }

  if (purchaseState?.includes("PENDING")) {
    return HarmonizedPurchaseState.PENDING;
  }

  if (
    purchaseState?.includes("CANCELED") ||
    purchaseState?.includes("CANCELLED")
  ) {
    return HarmonizedPurchaseState.CANCELED;
  }

  return HarmonizedPurchaseState.UNKNOWN;
}

export function mapAppStorePurchaseState(
  transactionReason?: AppStoreTransactionReason,
  expiresDate?: number,
  type?: AppStoreProductType,
  revocationDate?: number,
): HarmonizedPurchaseState {
  if (revocationDate !== undefined) {
    return HarmonizedPurchaseState.CANCELED;
  }

  if (expiresDate && expiresDate < Date.now()) {
    return HarmonizedPurchaseState.EXPIRED;
  }

  switch (transactionReason) {
    case AppStoreTransactionReason.PURCHASE:
      // For consumables, they're ready to be consumed after purchase
      if (type === AppStoreProductType.CONSUMABLE) {
        return HarmonizedPurchaseState.READY_TO_CONSUME;
      }
      return HarmonizedPurchaseState.ENTITLED;
    case AppStoreTransactionReason.RENEWAL:
      return HarmonizedPurchaseState.ENTITLED;
    default:
      // For App Store, if we have a valid transaction, it's generally purchased
      // For consumables without explicit transaction reason, assume ready to consume
      if (type === AppStoreProductType.CONSUMABLE) {
        return HarmonizedPurchaseState.READY_TO_CONSUME;
      }
      return HarmonizedPurchaseState.ENTITLED;
  }
}

export function mapToPurchaseType(
  platformType?: string,
  state?: HarmonizedPurchaseState,
): PurchaseType {
  // If we have state information that indicates consumable
  if (
    state === HarmonizedPurchaseState.READY_TO_CONSUME ||
    state === HarmonizedPurchaseState.CONSUMED
  ) {
    return PurchaseType.CONSUMABLE;
  }

  // Map platform-specific types
  if (!platformType) {
    return PurchaseType.UNKNOWN;
  }

  const lowerType = platformType.toLowerCase();

  // Google Play types
  if (lowerType === "subscription") {
    return PurchaseType.SUB;
  }
  if (lowerType === "inapp") {
    // For Google Play InApp products, we can't determine consumable vs non-consumable
    // from the type alone - we need to rely on the state parameter.
    // If state doesn't indicate consumable, default to NON_CONSUMABLE
    return PurchaseType.NON_CONSUMABLE;
  }

  // App Store types
  if (
    lowerType === "auto-renewable subscription" ||
    lowerType.includes("subscription")
  ) {
    return PurchaseType.SUB;
  }
  if (lowerType === "consumable") {
    return PurchaseType.CONSUMABLE;
  }
  if (lowerType === "non-consumable" || lowerType.includes("purchase")) {
    return PurchaseType.NON_CONSUMABLE;
  }

  return PurchaseType.UNKNOWN;
}

export function isConsumableState(state: HarmonizedPurchaseState): boolean {
  return (
    state === HarmonizedPurchaseState.READY_TO_CONSUME ||
    state === HarmonizedPurchaseState.CONSUMED
  );
}

export function canBeConsumed(state: HarmonizedPurchaseState): boolean {
  return state === HarmonizedPurchaseState.READY_TO_CONSUME;
}

export function isConsumed(state: HarmonizedPurchaseState): boolean {
  return state === HarmonizedPurchaseState.CONSUMED;
}

export function needsAcknowledgment(state: HarmonizedPurchaseState): boolean {
  return state === HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT;
}

export function isValidState(state: HarmonizedPurchaseState): boolean {
  return (
    state === HarmonizedPurchaseState.ENTITLED ||
    state === HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT ||
    state === HarmonizedPurchaseState.READY_TO_CONSUME
  );
}

/**
 * Extract Google Play's stable `orderId` from the raw receipt response
 * stored at receipt time. Returns null for non-Google stores, for
 * responses that haven't reached a state where Google assigns an
 * `orderId` yet (e.g. pending-acknowledgement products), and for
 * payloads we can't parse.
 *
 * This is the secondary dedup key for Google receipts — see
 * `savePurchaseInternal`. Apple flows already use
 * `originalTransactionId` as a stable `remoteId`, and Horizon uses
 * `(userId, sku)`, so neither needs an orderId-level fallback.
 *
 * Kept here (not in android.ts) so the migration that backfills the
 * `orderId` column and the write path share one implementation, and
 * so no node-only import is introduced.
 */
export function extractOrderIdFromRemoteResponse(
  store: "apple" | "google" | "horizon",
  remoteResponse?: string | null,
): string | null {
  if (store !== "google" || !remoteResponse) {
    return null;
  }

  try {
    const parsed = JSON.parse(remoteResponse);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    // Products V2 and legacy products API: orderId is at the top level
    // once the purchase is acknowledged. Pending-acknowledgement rows
    // legitimately have no orderId and must stay dedup-only by
    // purchaseToken until the next verify call surfaces one.
    if (
      "orderId" in parsed &&
      typeof (parsed as { orderId?: unknown }).orderId === "string" &&
      (parsed as { orderId: string }).orderId.length > 0
    ) {
      return (parsed as { orderId: string }).orderId;
    }

    // Subscriptions V2: the top-level identifier is `latestOrderId`,
    // with `lineItems[].latestSuccessfulOrderId` as the per-line
    // fallback. `mapSubscriptionResponseToReceiptData` in android.ts
    // already prefers the per-line id, so mirror that precedence here
    // to keep the write-time column and the response-extracted id in
    // sync.
    if ("lineItems" in parsed && Array.isArray(parsed.lineItems)) {
      const lineItem = parsed.lineItems[0];
      if (
        lineItem &&
        typeof lineItem === "object" &&
        "latestSuccessfulOrderId" in lineItem &&
        typeof lineItem.latestSuccessfulOrderId === "string" &&
        lineItem.latestSuccessfulOrderId.length > 0
      ) {
        return lineItem.latestSuccessfulOrderId;
      }
    }

    if (
      "latestOrderId" in parsed &&
      typeof (parsed as { latestOrderId?: unknown }).latestOrderId ===
        "string" &&
      (parsed as { latestOrderId: string }).latestOrderId.length > 0
    ) {
      return (parsed as { latestOrderId: string }).latestOrderId;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Extract a best-effort product id from the raw store response stored
 * at receipt time. Returns null when the payload isn't present or
 * doesn't expose a usable productId field.
 *
 * Kept here so the write path (`savePurchaseInternal`) and the read
 * path can share one implementation — and so the productId column can
 * be backfilled from `remoteResponse` by the migration without
 * importing from a query module.
 */
export function extractProductIdFromRemoteResponse(
  store: "apple" | "google" | "horizon",
  remoteResponse?: string | null,
): string | null {
  if (!remoteResponse) {
    return null;
  }

  try {
    const parsed = JSON.parse(remoteResponse);

    if (parsed && typeof parsed === "object") {
      if (
        store === "apple" &&
        "productId" in parsed &&
        typeof (parsed as { productId?: unknown }).productId === "string"
      ) {
        return (parsed as { productId: string }).productId;
      }

      if (store === "google") {
        if (
          "productLineItem" in parsed &&
          Array.isArray(parsed.productLineItem)
        ) {
          const productLineItem = parsed.productLineItem[0];
          if (
            productLineItem &&
            typeof productLineItem === "object" &&
            "productId" in productLineItem &&
            typeof productLineItem.productId === "string"
          ) {
            return productLineItem.productId;
          }
        }

        if ("lineItems" in parsed && Array.isArray(parsed.lineItems)) {
          const lineItem = parsed.lineItems[0];
          if (
            lineItem &&
            typeof lineItem === "object" &&
            "productId" in lineItem &&
            typeof lineItem.productId === "string"
          ) {
            return lineItem.productId;
          }
        }
      }

      if (
        store === "horizon" &&
        // Meta's `verify_entitlement` response shape is
        // `{ success, grant_time }` — no productId. The horizon
        // action packs the SKU into the persisted remoteResponse
        // under a `sku` field so stats + admin views can still
        // display what was purchased.
        "sku" in parsed &&
        typeof (parsed as { sku?: unknown }).sku === "string"
      ) {
        return (parsed as { sku: string }).sku;
      }
    }
  } catch {
    return null;
  }

  return null;
}
