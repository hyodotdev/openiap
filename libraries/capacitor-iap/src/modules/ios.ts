import {CapacitorIap} from '../plugin';
import type {
  MutationField,
  ProductIOS,
  PurchaseIOS,
  QueryField,
  SubscriptionStatusIOS,
} from '../types';
import {decodeApplePurchases} from '../utils/availablePurchases';
import {ErrorCode} from '../types';
import {createPurchaseError} from '../utils/errorMapping';
import {invokeNativeWithPurchaseError} from '../utils/nativeError';
import {requireIOS} from '../utils/platform';

// iOS rejections carry the OpenIAP error payload; rethrow them as PurchaseError.
const callIOS = async <T>(operation: () => Promise<{value: T}>): Promise<T> =>
  (await invokeNativeWithPurchaseError(operation, 'ios')).value;

const requireArgument = (methodName: string, name: string, value: unknown) => {
  if (!value) {
    throw createPurchaseError({
      code: ErrorCode.DeveloperError,
      message: `${methodName} requires a ${name}`,
    });
  }
};

/** True when `item` is an App Store product or purchase payload. */
export function isProductIOS<T extends {platform?: string}>(
  item: unknown,
): item is T & {platform: 'ios'} {
  return (
    item != null &&
    typeof item === 'object' &&
    'platform' in item &&
    typeof item.platform === 'string' &&
    item.platform.toLowerCase() === 'ios'
  );
}

/**
 * Sync transactions with the App Store (`AppStore.sync()`).
 *
 * @see {@link https://openiap.dev/docs/apis/ios/sync-ios}
 */
export const syncIOS: MutationField<'syncIOS'> = async () => {
  requireIOS('syncIOS');
  return (await callIOS(() => CapacitorIap.syncIOS())) === true;
};

/**
 * Check whether the user can redeem the introductory offer of a subscription group.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios}
 */
export const isEligibleForIntroOfferIOS: QueryField<
  'isEligibleForIntroOfferIOS'
> = async (groupID) => {
  requireIOS('isEligibleForIntroOfferIOS');
  requireArgument('isEligibleForIntroOfferIOS', 'groupID', groupID);
  return callIOS(() => CapacitorIap.isEligibleForIntroOfferIOS({groupID}));
};

/**
 * Get the StoreKit subscription statuses for a SKU.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/subscription-status-ios}
 */
export const subscriptionStatusIOS: QueryField<
  'subscriptionStatusIOS'
> = async (sku) => {
  requireIOS('subscriptionStatusIOS');
  requireArgument('subscriptionStatusIOS', 'SKU', sku);
  const statuses = await callIOS(() =>
    CapacitorIap.subscriptionStatusIOS({sku}),
  );
  return (statuses ?? []) as SubscriptionStatusIOS[];
};

/**
 * Get the current entitlement for a SKU.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/current-entitlement-ios}
 */
export const currentEntitlementIOS: QueryField<
  'currentEntitlementIOS'
> = async (sku) => {
  requireIOS('currentEntitlementIOS');
  requireArgument('currentEntitlementIOS', 'SKU', sku);
  const purchase = await callIOS(() =>
    CapacitorIap.currentEntitlementIOS({sku}),
  );
  return (purchase ?? null) as PurchaseIOS | null;
};

/**
 * Get the latest transaction for a SKU.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/latest-transaction-ios}
 */
export const latestTransactionIOS: QueryField<'latestTransactionIOS'> = async (
  sku,
) => {
  requireIOS('latestTransactionIOS');
  requireArgument('latestTransactionIOS', 'SKU', sku);
  const transaction = await callIOS(() =>
    CapacitorIap.latestTransactionIOS({sku}),
  );
  return (transaction ?? null) as PurchaseIOS | null;
};

/**
 * Present the App Store refund request sheet for a SKU.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/begin-refund-request-ios}
 */
export const beginRefundRequestIOS: MutationField<
  'beginRefundRequestIOS'
> = async (sku) => {
  requireIOS('beginRefundRequestIOS');
  requireArgument('beginRefundRequestIOS', 'SKU', sku);
  return (
    (await callIOS(() => CapacitorIap.beginRefundRequestIOS({sku}))) ?? null
  );
};

/**
 * Show the system subscription management sheet. Resolves the subscriptions
 * whose status changed while it was open.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios}
 */
export const showManageSubscriptionsIOS: MutationField<
  'showManageSubscriptionsIOS'
> = async () => {
  requireIOS('showManageSubscriptionsIOS');
  return decodeApplePurchases(
    await callIOS(() => CapacitorIap.showManageSubscriptionsIOS()),
  );
};

/**
 * Get the base64 App Store receipt. Verify it on your server, never in the app.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-receipt-data-ios}
 */
export const getReceiptDataIOS: QueryField<'getReceiptDataIOS'> = async () => {
  requireIOS('getReceiptDataIOS');
  return callIOS(() => CapacitorIap.getReceiptDataIOS());
};

/**
 * Refresh the receipt with `AppStore.sync()` and return it. Use after a first
 * purchase, when `getReceiptDataIOS` can still return an empty string.
 */
export const requestReceiptRefreshIOS = async (): Promise<string> => {
  requireIOS('requestReceiptRefreshIOS');
  return callIOS(() => CapacitorIap.requestReceiptRefreshIOS());
};

/**
 * Check whether StoreKit verified the latest transaction for a SKU.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/is-transaction-verified-ios}
 */
export const isTransactionVerifiedIOS: QueryField<
  'isTransactionVerifiedIOS'
> = async (sku) => {
  requireIOS('isTransactionVerifiedIOS');
  requireArgument('isTransactionVerifiedIOS', 'SKU', sku);
  return callIOS(() => CapacitorIap.isTransactionVerifiedIOS({sku}));
};

/**
 * Get the JWS of the latest transaction for a SKU, for server verification.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-transaction-jws-ios}
 */
export const getTransactionJwsIOS: QueryField<'getTransactionJwsIOS'> = async (
  sku,
) => {
  requireIOS('getTransactionJwsIOS');
  requireArgument('getTransactionJwsIOS', 'SKU', sku);
  return (await callIOS(() => CapacitorIap.getTransactionJwsIOS({sku}))) ?? '';
};

/**
 * Get the AppTransaction that unlocked the app (iOS 16.0+); null on older systems.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-app-transaction-ios}
 */
export const getAppTransactionIOS: QueryField<
  'getAppTransactionIOS'
> = async () => {
  requireIOS('getAppTransactionIOS');
  const transaction = await callIOS(() => CapacitorIap.getAppTransactionIOS());
  return (transaction ?? null) as Awaited<
    ReturnType<QueryField<'getAppTransactionIOS'>>
  >;
};

/**
 * Get the product the App Store promoted, if a promotion is pending.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-promoted-product-ios}
 */
export const getPromotedProductIOS: QueryField<
  'getPromotedProductIOS'
> = async () => {
  requireIOS('getPromotedProductIOS');
  const product = await callIOS(() => CapacitorIap.getPromotedProductIOS());
  return (product ?? null) as ProductIOS | null;
};

/**
 * List StoreKit transactions that have not been finished.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-pending-transactions-ios}
 */
export const getPendingTransactionsIOS: QueryField<
  'getPendingTransactionsIOS'
> = async () => {
  requireIOS('getPendingTransactionsIOS');
  return decodeApplePurchases(
    await callIOS(() => CapacitorIap.getPendingTransactionsIOS()),
  );
};

/**
 * List every StoreKit transaction, finished and unfinished, for the current user.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-all-transactions-ios}
 */
export const getAllTransactionsIOS: QueryField<
  'getAllTransactionsIOS'
> = async () => {
  requireIOS('getAllTransactionsIOS');
  return decodeApplePurchases(
    await callIOS(() => CapacitorIap.getAllTransactionsIOS()),
  );
};

/**
 * Finish every unfinished StoreKit transaction.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/clear-transaction-ios}
 */
export const clearTransactionIOS: MutationField<
  'clearTransactionIOS'
> = async () => {
  requireIOS('clearTransactionIOS');
  return (await callIOS(() => CapacitorIap.clearTransactionIOS())) === true;
};

/** Open the App Store subscription management sheet. */
export const deepLinkToSubscriptionsIOS = async (): Promise<void> => {
  requireIOS('deepLinkToSubscriptionsIOS');
  await invokeNativeWithPurchaseError(
    () => CapacitorIap.deepLinkToSubscriptions({options: null}),
    'ios',
  );
};

/**
 * Check whether the external purchase notice sheet can be presented (iOS 17.4+).
 *
 * @see {@link https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios}
 */
export const canPresentExternalPurchaseNoticeIOS: QueryField<
  'canPresentExternalPurchaseNoticeIOS'
> = async () => {
  requireIOS('canPresentExternalPurchaseNoticeIOS');
  return (
    (await callIOS(() =>
      CapacitorIap.canPresentExternalPurchaseNoticeIOS(),
    )) === true
  );
};

/**
 * Present the external purchase notice sheet (iOS 17.4+). Call before opening
 * an external purchase link; resolves the external purchase token on continue.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios}
 */
export const presentExternalPurchaseNoticeSheetIOS: MutationField<
  'presentExternalPurchaseNoticeSheetIOS'
> = async () => {
  requireIOS('presentExternalPurchaseNoticeSheetIOS');
  return callIOS(() => CapacitorIap.presentExternalPurchaseNoticeSheetIOS());
};

/**
 * Open an external purchase link (iOS 16.0+).
 *
 * @see {@link https://openiap.dev/docs/apis/ios/present-external-purchase-link-ios}
 */
export const presentExternalPurchaseLinkIOS: MutationField<
  'presentExternalPurchaseLinkIOS'
> = async (url) => {
  requireIOS('presentExternalPurchaseLinkIOS');
  requireArgument('presentExternalPurchaseLinkIOS', 'URL', url);
  return callIOS(() => CapacitorIap.presentExternalPurchaseLinkIOS({url}));
};

/**
 * Check eligibility for the ExternalPurchaseCustomLink API (iOS 18.1+).
 *
 * @see {@link https://openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios}
 */
export const isEligibleForExternalPurchaseCustomLinkIOS: QueryField<
  'isEligibleForExternalPurchaseCustomLinkIOS'
> = async () => {
  requireIOS('isEligibleForExternalPurchaseCustomLinkIOS');
  return (
    (await callIOS(() =>
      CapacitorIap.isEligibleForExternalPurchaseCustomLinkIOS(),
    )) === true
  );
};

/**
 * Get an external purchase token to report to Apple (iOS 18.1+).
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios}
 */
export const getExternalPurchaseCustomLinkTokenIOS: QueryField<
  'getExternalPurchaseCustomLinkTokenIOS'
> = async (tokenType) => {
  requireIOS('getExternalPurchaseCustomLinkTokenIOS');
  requireArgument(
    'getExternalPurchaseCustomLinkTokenIOS',
    'tokenType',
    tokenType,
  );
  return callIOS(() =>
    CapacitorIap.getExternalPurchaseCustomLinkTokenIOS({tokenType}),
  );
};

/**
 * Show the ExternalPurchaseCustomLink notice sheet (iOS 18.1+) after a
 * deliberate customer interaction, before linking out.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios}
 */
export const showExternalPurchaseCustomLinkNoticeIOS: MutationField<
  'showExternalPurchaseCustomLinkNoticeIOS'
> = async (noticeType) => {
  requireIOS('showExternalPurchaseCustomLinkNoticeIOS');
  requireArgument(
    'showExternalPurchaseCustomLinkNoticeIOS',
    'noticeType',
    noticeType,
  );
  return callIOS(() =>
    CapacitorIap.showExternalPurchaseCustomLinkNoticeIOS({noticeType}),
  );
};
