// External dependencies

// Internal modules
// import removed: use purchaseUpdatedListener directly in app code
import ExpoIapModule from '../ExpoIapModule';

// Types
import type {
  ExternalPurchaseCustomLinkNoticeResultIOS,
  ExternalPurchaseCustomLinkTokenResultIOS,
  ExternalPurchaseLinkResultIOS,
  ExternalPurchaseNoticeResultIOS,
  MutationField,
  ProductIOS,
  Purchase,
  PurchaseIOS,
  QueryField,
  SubscriptionStatusIOS,
} from '../types';
import {type PurchaseError} from '../utils/errorMapping';
import {decodeApplePurchases} from '../utils/availablePurchases';
import {Linking, Platform} from 'react-native';

/**
 * Enforce the documented iOS-only contract. Without this, calling a
 * suffixed wrapper on another platform falls through to the native proxy
 * and surfaces as an opaque `TypeError: ExpoIapModule.<name> is not a
 * function` instead of the promised platform error.
 */
const requireIosPlatform = (methodName: string): void => {
  if (Platform.OS !== 'ios') {
    throw new Error(`${methodName} is only available on iOS`);
  }
};

export type TransactionEvent = {
  transaction?: Purchase;
  error?: PurchaseError;
};

// Listeners

// Type guards
export function isProductIOS<T extends {platform?: string}>(
  item: unknown,
): item is T & {platform: 'ios'} {
  return (
    item != null &&
    typeof item === 'object' &&
    'platform' in item &&
    typeof (item as any).platform === 'string' &&
    (item as any).platform.toLowerCase() === 'ios'
  );
}

// Functions
/**
 * Sync state with Appstore (iOS only)
 * https://developer.apple.com/documentation/storekit/appstore/3791906-sync
 *
 * @returns Promise resolving to null on success
 * @throws Error if called on non-iOS platform
 *
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/sync-ios}
 */
export const syncIOS: MutationField<'syncIOS'> = async () => {
  requireIosPlatform('syncIOS');
  return !!(await ExpoIapModule.syncIOS());
};

/**
 * Check if user is eligible for introductory offer
 *
 * @param groupId - The subscription group ID
 * @returns Promise resolving to true if eligible
 * @throws Error if called on non-iOS platform
 *
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios}
 */
export const isEligibleForIntroOfferIOS: QueryField<
  'isEligibleForIntroOfferIOS'
> = async (groupId) => {
  requireIosPlatform('isEligibleForIntroOfferIOS');
  if (!groupId) {
    throw new Error('isEligibleForIntroOfferIOS requires a groupId');
  }
  return ExpoIapModule.isEligibleForIntroOfferIOS(groupId);
};

/**
 * Get subscription status for a specific SKU
 *
 * @param sku The product SKU
 * @returns Promise resolving to array of subscription status
 * @throws Error if called on non-iOS platform
 *
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/subscription-status-ios}
 */
export const subscriptionStatusIOS: QueryField<
  'subscriptionStatusIOS'
> = async (sku) => {
  requireIosPlatform('subscriptionStatusIOS');
  if (!sku) {
    throw new Error('subscriptionStatusIOS requires a SKU');
  }
  const status = await ExpoIapModule.subscriptionStatusIOS(sku);
  return (status ?? []) as SubscriptionStatusIOS[];
};

/**
 * Get current entitlement for a specific SKU
 *
 * @param sku The product SKU
 * @returns Promise resolving to current entitlement
 * @throws Error if called on non-iOS platform
 *
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/current-entitlement-ios}
 */
export const currentEntitlementIOS: QueryField<
  'currentEntitlementIOS'
> = async (sku) => {
  requireIosPlatform('currentEntitlementIOS');
  if (!sku) {
    throw new Error('currentEntitlementIOS requires a SKU');
  }
  const purchase = await ExpoIapModule.currentEntitlementIOS(sku);
  return (purchase ?? null) as PurchaseIOS | null;
};

/**
 * Get latest transaction for a specific SKU
 *
 * @param sku The product SKU
 * @returns Promise resolving to latest transaction
 * @throws Error if called on non-iOS platform
 *
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/latest-transaction-ios}
 */
export const latestTransactionIOS: QueryField<'latestTransactionIOS'> = async (
  sku,
) => {
  requireIosPlatform('latestTransactionIOS');
  if (!sku) {
    throw new Error('latestTransactionIOS requires a SKU');
  }
  const transaction = await ExpoIapModule.latestTransactionIOS(sku);
  return (transaction ?? null) as PurchaseIOS | null;
};

/**
 * Begin refund request for a specific SKU
 *
 * @param sku The product SKU
 * @returns Promise resolving to refund request status
 * @throws Error if called on non-iOS platform
 *
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/begin-refund-request-ios}
 */
export const beginRefundRequestIOS: MutationField<
  'beginRefundRequestIOS'
> = async (sku) => {
  requireIosPlatform('beginRefundRequestIOS');
  if (!sku) {
    throw new Error('beginRefundRequestIOS requires a SKU');
  }
  const status = await ExpoIapModule.beginRefundRequestIOS(sku);
  return status ?? null;
};

/**
 * Shows the system UI for managing subscriptions.
 * Returns an array of subscriptions that had status changes after the UI is closed.
 *
 * @returns Promise<Purchase[]> - Array of subscriptions with status changes (e.g., auto-renewal toggled)
 * @throws Error if called on non-iOS platform
 *
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios}
 */
export const showManageSubscriptionsIOS: MutationField<
  'showManageSubscriptionsIOS'
> = async () => {
  requireIosPlatform('showManageSubscriptionsIOS');
  const purchases = await ExpoIapModule.showManageSubscriptionsIOS();
  return decodeApplePurchases(purchases);
};

/**
 * Get the receipt data from the iOS device.
 * This returns the base64 encoded receipt data which can be sent to your server
 * for verification with Apple's server.
 *
 * NOTE: For proper security, always verify receipts on your server using
 * Apple's verifyReceipt endpoint, not directly from the app.
 *
 * @returns {Promise<string>} Base64 encoded receipt data
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-receipt-data-ios}
 */
export const getReceiptDataIOS: QueryField<'getReceiptDataIOS'> = async () => {
  requireIosPlatform('getReceiptDataIOS');
  return ExpoIapModule.getReceiptDataIOS();
};

/**
 * Refresh the receipt data from Apple's servers and return the updated receipt.
 * This calls AppStore.sync() before reading the receipt, ensuring the latest
 * receipt data is available. Use this after a first purchase when
 * getReceiptDataIOS() may return an empty string because the receipt file
 * has not yet been written to disk.
 *
 * @returns {Promise<string>} Base64 encoded receipt data
 *
 * @platform iOS
 */
export const requestReceiptRefreshIOS = async (): Promise<string> => {
  requireIosPlatform('requestReceiptRefreshIOS');
  return ExpoIapModule.requestReceiptRefreshIOS();
};

/**
 * Check if a transaction is verified through StoreKit 2.
 * StoreKit 2 performs local verification of transaction JWS signatures.
 *
 * @param sku The product's SKU (on iOS)
 * @returns Promise resolving to true if the transaction is verified
 * @throws Error if called on non-iOS platform
 *
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/is-transaction-verified-ios}
 */
export const isTransactionVerifiedIOS: QueryField<
  'isTransactionVerifiedIOS'
> = async (sku) => {
  requireIosPlatform('isTransactionVerifiedIOS');
  if (!sku) {
    throw new Error('isTransactionVerifiedIOS requires a SKU');
  }
  return ExpoIapModule.isTransactionVerifiedIOS(sku);
};

/**
 * Get the JWS representation of a purchase for server-side verification.
 * The JWS (JSON Web Signature) can be verified on your server using Apple's public keys.
 *
 * @param sku The product's SKU (on iOS)
 * @returns Promise resolving to JWS representation of the transaction
 * @throws Error if called on non-iOS platform
 *
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-transaction-jws-ios}
 */
export const getTransactionJwsIOS: QueryField<'getTransactionJwsIOS'> = async (
  sku,
) => {
  requireIosPlatform('getTransactionJwsIOS');
  if (!sku) {
    throw new Error('getTransactionJwsIOS requires a SKU');
  }
  const jws = await ExpoIapModule.getTransactionJwsIOS(sku);
  return jws ?? '';
};

/**
 * Present the code redemption sheet for offer codes (iOS only).
 * This allows users to redeem promotional codes for in-app purchases and subscriptions.
 *
 * Note: This only works on real devices, not simulators.
 *
 * @returns The verified redeemed purchase when built with Xcode 27+ and
 * running on Apple 27+, or null when the system sheet cannot return the
 * transaction directly (StoreKit 2 on iOS/Catalyst 16–26 and visionOS 1–26;
 * StoreKit 1 on iOS/Catalyst 15).
 * @throws Error if called on non-iOS platform or tvOS
 *
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/present-code-redemption-sheet-ios}
 */
export const presentCodeRedemptionSheetIOS: MutationField<
  'presentCodeRedemptionSheetIOS'
> = async () => {
  requireIosPlatform('presentCodeRedemptionSheetIOS');
  return await ExpoIapModule.presentCodeRedemptionSheetIOS();
};

/**
 * Get app transaction information (iOS 16.0+).
 * AppTransaction represents the initial purchase that unlocked the app.
 *
 * NOTE: This function requires:
 * - iOS 16.0 or later at runtime
 * - Xcode 15.0+ with iOS 16.0 SDK for compilation
 *
 * @returns Promise resolving to the app transaction information or null if not available
 * @throws Error if called on non-iOS platform, iOS version < 16.0, or compiled with older SDK
 *
 * @platform iOS
 * @since iOS 16.0
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-app-transaction-ios}
 */
export const getAppTransactionIOS: QueryField<
  'getAppTransactionIOS'
> = async () => {
  requireIosPlatform('getAppTransactionIOS');
  return (await ExpoIapModule.getAppTransactionIOS()) ?? null;
};

/**
 * Get information about a promoted product if one is available (iOS only).
 * Promoted products are products that the App Store promotes on your behalf.
 * This is called after a promoted product event is received from the App Store.
 *
 * @returns Promise resolving to the promoted product information or null if none available
 * @throws Error if called on non-iOS platform
 *
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-promoted-product-ios}
 */
export const getPromotedProductIOS: QueryField<
  'getPromotedProductIOS'
> = async () => {
  requireIosPlatform('getPromotedProductIOS');
  const product = await ExpoIapModule.getPromotedProductIOS();
  return (product ?? null) as ProductIOS | null;
};

/**
 * Get pending transactions that haven't been finished yet (iOS only).
 *
 * @returns Promise resolving to array of pending transactions
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-pending-transactions-ios}
 */
export const getPendingTransactionsIOS: QueryField<
  'getPendingTransactionsIOS'
> = async () => {
  requireIosPlatform('getPendingTransactionsIOS');
  const transactions = await ExpoIapModule.getPendingTransactionsIOS();
  return decodeApplePurchases(transactions);
};

/**
 * List every StoreKit transaction (finished + unfinished) for the current user.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-all-transactions-ios}
 */
export const getAllTransactionsIOS: QueryField<
  'getAllTransactionsIOS'
> = async () => {
  requireIosPlatform('getAllTransactionsIOS');
  const transactions = await ExpoIapModule.getAllTransactionsIOS();
  return decodeApplePurchases(transactions);
};

/**
 * Clear a specific transaction (iOS only).
 *
 * @returns Promise resolving when transaction is cleared
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/clear-transaction-ios}
 */
export const clearTransactionIOS: MutationField<
  'clearTransactionIOS'
> = async () => {
  requireIosPlatform('clearTransactionIOS');
  return !!(await ExpoIapModule.clearTransactionIOS());
};

/**
 * Deep link to subscriptions screen on iOS.
 * @returns {Promise<void>}
 *
 * @platform iOS
 */
export const deepLinkToSubscriptionsIOS = (): Promise<void> =>
  Linking.openURL('https://apps.apple.com/account/subscriptions');

/**
 * Check if the device can present an external purchase notice sheet (iOS 17.4+).
 *
 * Wraps `ExternalPurchase.canPresent`, which Apple introduced in iOS 17.4.
 * Note: the notice sheet itself (`presentExternalPurchaseNoticeSheetIOS`)
 * still requires iOS 18.2+; only the eligibility check is available earlier.
 *
 * @returns Promise resolving to true if the notice sheet can be presented
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios}
 */
export const canPresentExternalPurchaseNoticeIOS: QueryField<
  'canPresentExternalPurchaseNoticeIOS'
> = async () => {
  requireIosPlatform('canPresentExternalPurchaseNoticeIOS');
  return !!(await ExpoIapModule.canPresentExternalPurchaseNoticeIOS());
};

/**
 * Present an external purchase notice sheet to inform users about external purchases (iOS 15.4+).
 * This must be called before opening an external purchase link.
 * Returns the external purchase token when user continues.
 *
 * @returns Promise resolving to the result with action, token, and error if any
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios}
 */
export const presentExternalPurchaseNoticeSheetIOS: MutationField<
  'presentExternalPurchaseNoticeSheetIOS'
> = async () => {
  requireIosPlatform('presentExternalPurchaseNoticeSheetIOS');
  const result = await ExpoIapModule.presentExternalPurchaseNoticeSheetIOS();
  return result as ExternalPurchaseNoticeResultIOS;
};

/**
 * Present an external purchase link to redirect users to your website (iOS 16.0+).
 *
 * @param url - The external purchase URL to open
 * @returns Promise resolving to the result with success status and error if any
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/present-external-purchase-link-ios}
 */
export const presentExternalPurchaseLinkIOS: MutationField<
  'presentExternalPurchaseLinkIOS'
> = async (url: string) => {
  requireIosPlatform('presentExternalPurchaseLinkIOS');
  const result = await ExpoIapModule.presentExternalPurchaseLinkIOS(url);
  return result as ExternalPurchaseLinkResultIOS;
};

/**
 * Check if app is eligible for ExternalPurchaseCustomLink API (iOS 18.1+).
 * Returns true if the app can use custom external purchase links.
 *
 * @returns Promise resolving to true if eligible
 * @platform iOS
 * @see https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/iseligible
 *
 * @see {@link https://openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios}
 */
export const isEligibleForExternalPurchaseCustomLinkIOS: QueryField<
  'isEligibleForExternalPurchaseCustomLinkIOS'
> = async () => {
  requireIosPlatform('isEligibleForExternalPurchaseCustomLinkIOS');
  return !!(await ExpoIapModule.isEligibleForExternalPurchaseCustomLinkIOS());
};

/**
 * Get external purchase token for reporting to Apple (iOS 18.1+).
 * Use this token with Apple's External Purchase Server API to report transactions.
 *
 * @param tokenType - Token type: 'acquisition' (new customers) or 'services' (existing customers)
 * @returns Promise resolving to the token result with token string or error
 * @platform iOS
 * @see https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios}
 */
export const getExternalPurchaseCustomLinkTokenIOS: QueryField<
  'getExternalPurchaseCustomLinkTokenIOS'
> = async (tokenType) => {
  requireIosPlatform('getExternalPurchaseCustomLinkTokenIOS');
  if (!tokenType) {
    throw new Error(
      "getExternalPurchaseCustomLinkTokenIOS requires a tokenType ('acquisition' or 'services')",
    );
  }
  const result = await ExpoIapModule.getExternalPurchaseCustomLinkTokenIOS(
    tokenType,
  );
  return result as ExternalPurchaseCustomLinkTokenResultIOS;
};

/**
 * Show ExternalPurchaseCustomLink notice sheet (iOS 18.1+).
 * Displays the system disclosure notice sheet for custom external purchase links.
 * Call this after a deliberate customer interaction before linking out to external purchases.
 *
 * @param noticeType - Notice type: 'browser' (external purchases displayed in browser)
 * @returns Promise resolving to the result with continued status and error if any
 * @platform iOS
 * @see https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/shownotice(type:)
 *
 * @see {@link https://openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios}
 */
export const showExternalPurchaseCustomLinkNoticeIOS: MutationField<
  'showExternalPurchaseCustomLinkNoticeIOS'
> = async (noticeType) => {
  requireIosPlatform('showExternalPurchaseCustomLinkNoticeIOS');
  if (!noticeType) {
    throw new Error(
      "showExternalPurchaseCustomLinkNoticeIOS requires a noticeType ('browser')",
    );
  }
  const result = await ExpoIapModule.showExternalPurchaseCustomLinkNoticeIOS(
    noticeType,
  );
  return result as ExternalPurchaseCustomLinkNoticeResultIOS;
};

// iOS-specific APIs only; cross-platform wrappers live in src/index.ts
