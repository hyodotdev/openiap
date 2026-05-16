// External dependencies
import {Platform} from 'react-native';
// Side-effect import ensures Nitro installs its dispatcher before IAP is used (no-op in tests)
import 'react-native-nitro-modules';
import {NitroModules} from 'react-native-nitro-modules';

// Internal modules
import type {
  NitroActiveSubscription,
  NitroReceiptValidationParams,
  NitroReceiptValidationResultIOS,
  NitroReceiptValidationResultAndroid,
  NitroPurchaseUpdatedListenerOptions,
  NitroSubscriptionStatus,
  RnIap,
} from './specs/RnIap.nitro';
import {ErrorCode} from './types';
import type {
  AndroidSubscriptionOfferInput,
  DiscountOfferInputIOS,
  ExternalPurchaseCustomLinkNoticeResultIOS,
  ExternalPurchaseCustomLinkNoticeTypeIOS,
  ExternalPurchaseCustomLinkTokenResultIOS,
  ExternalPurchaseCustomLinkTokenTypeIOS,
  ExternalPurchaseNoticeResultIOS,
  FetchProductsResult,
  MutationField,
  Product,
  ProductIOS,
  ProductQueryType,
  ProductSubscription,
  Purchase,
  PurchaseError,
  PurchaseUpdatedListenerOptions,
  PurchaseIOS,
  QueryField,
  AppTransaction,
  VerifyPurchaseResultAndroid,
  VerifyPurchaseResultIOS,
  RequestPurchaseAndroidProps,
  RequestPurchaseIosProps,
  RequestPurchasePropsByPlatforms,
  RequestSubscriptionAndroidProps,
  RequestSubscriptionIosProps,
  RequestSubscriptionPropsByPlatforms,
  ActiveSubscription,
  DeveloperProvidedBillingDetailsAndroid,
  UserChoiceBillingDetails,
} from './types';
import {
  convertNitroProductToProduct,
  convertNitroPurchaseToPurchase,
  convertProductToProductSubscription,
  validateNitroProduct,
  validateNitroPurchase,
  convertNitroSubscriptionStatusToSubscriptionStatusIOS,
} from './utils/type-bridge';
import {parseErrorStringToJsonObj} from './utils/error';
import {
  normalizeErrorCodeFromNative,
  createPurchaseError,
  DUPLICATE_PURCHASE_CODE,
} from './utils/errorMapping';
import {RnIapConsole} from './utils/debug';
import {getSuccessFromPurchaseVariant} from './utils/purchase';
import {parseAppTransactionPayload} from './utils';

// ------------------------------
// Billing Programs API (Android 8.2.0+)
// ------------------------------

// Note: BillingProgramAndroid, ExternalLinkLaunchModeAndroid, and ExternalLinkTypeAndroid
// are exported from './types' (auto-generated from openiap-gql).
// Import them here for use in this file's interfaces and functions.
import type {
  BillingProgramAndroid,
} from './types';

// Export all types
export type {
  RnIap,
  NitroProduct,
  NitroPurchase,
  NitroPurchaseResult,
} from './specs/RnIap.nitro';
export * from './types';
export * from './utils/error';

export type ProductTypeInput = 'inapp' | 'in-app' | 'subs';

const LEGACY_INAPP_WARNING =
  "[react-native-iap] `type: 'inapp'` is deprecated and will be removed in a future major version. Use 'in-app' instead.";

type NitroPurchaseRequest = Parameters<RnIap['requestPurchase']>[0];
type NitroAvailablePurchasesOptions = NonNullable<
  Parameters<RnIap['getAvailablePurchases']>[0]
>;
type NitroFinishTransactionParamsInternal = Parameters<
  RnIap['finishTransaction']
>[0];
type NitroPurchaseListener = Parameters<RnIap['addPurchaseUpdatedListener']>[0];
type NitroPurchaseUpdatedListenerOptionsParam = NonNullable<
  Parameters<RnIap['addPurchaseUpdatedListener']>[1]
>;
type NitroPurchaseErrorListener = Parameters<
  RnIap['addPurchaseErrorListener']
>[0];
type NitroPromotedProductListener = Parameters<
  RnIap['addPromotedProductListenerIOS']
>[0];

const toErrorMessage = (error: unknown): string => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    (error as {message?: unknown}).message != null
  ) {
    return String((error as {message?: unknown}).message);
  }
  return String(error ?? '');
};

const unsupportedPlatformError = (): Error =>
  new Error(`Unsupported platform: ${Platform.OS}`);

export interface EventSubscription {
  remove(): void;
}

// ActiveSubscription and PurchaseError types are already exported via 'export * from ./types'

// Export hooks
export {useIAP} from './hooks/useIAP';
export {useWebhookEvents} from './hooks/useWebhookEvents';
export type {
  UseWebhookEventsOptions,
  UseWebhookEventsResult,
} from './hooks/useWebhookEvents';
export {connectWebhookStream, parseWebhookEventData} from './webhook-client';
export type {
  WebhookEventPayload,
  WebhookEventStream,
  WebhookEventType as WebhookEventTypeName,
  WebhookListener,
  WebhookListenerError,
  WebhookListenerOptions,
} from './webhook-client';
export {kitApi, KitApiError} from './kit-api';
export type {
  KitApiOptions,
  KitSubscription,
  EntitlementsResponse,
  StatusResponse,
} from './kit-api';

// Restore completed transactions (cross-platform)
// Development utilities removed - use type bridge functions directly if needed

// Create the RnIap HybridObject instance lazily to avoid early JSI crashes
let iapRef: RnIap | null = null;

/**
 * Check if Nitro runtime is ready for IAP operations.
 * This is useful for platforms like tvOS where Nitro may initialize later.
 * @returns true if Nitro is ready, false otherwise
 */
export const isNitroReady = (): boolean => {
  if (iapRef) return true;
  try {
    iapRef = NitroModules.createHybridObject<RnIap>('RnIap');
    return true;
  } catch {
    return false;
  }
};

/**
 * Check if we're running on tvOS.
 * tvOS reports Platform.OS as 'ios' but has Platform.isTV = true.
 */
export const isTVOS = (): boolean => {
  return Platform.OS === 'ios' && (Platform as any).isTV === true;
};

/**
 * Check if we're running on macOS (Catalyst or native).
 * macOS may report Platform.OS as 'ios' (Catalyst) or 'macos'.
 */
export const isMacOS = (): boolean => {
  return (
    Platform.OS === 'macos' ||
    (Platform.OS === 'ios' && (Platform as any).isMacCatalyst === true)
  );
};

/**
 * Check if we're running on a standard iOS device (iPhone/iPad, not tvOS or macOS Catalyst).
 */
export const isStandardIOS = (): boolean => {
  return Platform.OS === 'ios' && !isTVOS() && !isMacOS();
};

const IAP = {
  get instance(): RnIap {
    if (iapRef) return iapRef;

    // Attempt to create the HybridObject and map common Nitro/JSI readiness errors
    try {
      iapRef = NitroModules.createHybridObject<RnIap>('RnIap');
    } catch (e) {
      const msg = toErrorMessage(e);
      if (
        msg.includes('Nitro') ||
        msg.includes('JSI') ||
        msg.includes('dispatcher') ||
        msg.includes('HybridObject')
      ) {
        throw new Error(
          'Nitro runtime not installed yet. Ensure react-native-nitro-modules is initialized before calling IAP.',
        );
      }
      throw e;
    }
    return iapRef;
  },
};

// ============================================================================
// EVENT LISTENERS
//
// Uses a singleton native listener per event type with JS-level fan-out.
// This avoids the iOS bug where removePurchaseUpdatedListener calls
// removeAll() instead of removing a specific listener, which caused ALL
// listeners to be lost when any single useIAP instance unmounted.
// See: https://github.com/hyochan/react-native-iap/issues/3150
// ============================================================================

const purchaseUpdateJsListeners = new Set<(purchase: Purchase) => void>();
const purchaseUpdateDuplicateJsListeners = new Set<
  (purchase: Purchase) => void
>();
let purchaseUpdateNativeAttached = false;
let purchaseUpdateDuplicateNativeAttached = false;
let purchaseUpdateNativeToken: number | null = null;
let purchaseUpdateDuplicateNativeToken: number | null = null;
const emitPurchaseUpdateToListeners = (
  nitroPurchase: Parameters<NitroPurchaseListener>[0],
  listeners: Set<(purchase: Purchase) => void>,
) => {
  if (validateNitroPurchase(nitroPurchase)) {
    const convertedPurchase = convertNitroPurchaseToPurchase(nitroPurchase);
    for (const listener of listeners) {
      try {
        listener(convertedPurchase);
      } catch (e) {
        RnIapConsole.error('[purchaseUpdatedListener] callback threw:', e);
      }
    }
  } else {
    RnIapConsole.error(
      'Invalid purchase data received from native — productId:',
      (nitroPurchase as any)?.productId ?? 'unknown',
    );
  }
};
const purchaseUpdateNativeHandler: NitroPurchaseListener = (nitroPurchase) => {
  emitPurchaseUpdateToListeners(nitroPurchase, purchaseUpdateJsListeners);
};
const purchaseUpdateDuplicateNativeHandler: NitroPurchaseListener = (
  nitroPurchase,
) => {
  emitPurchaseUpdateToListeners(
    nitroPurchase,
    purchaseUpdateDuplicateJsListeners,
  );
};

const purchaseErrorJsListeners = new Set<(error: PurchaseError) => void>();
let purchaseErrorNativeAttached = false;
const purchaseErrorNativeHandler: NitroPurchaseErrorListener = (error) => {
  const normalized: PurchaseError = {
    code:
      error.code === DUPLICATE_PURCHASE_CODE
        ? ErrorCode.DuplicatePurchase
        : normalizeErrorCodeFromNative(error.code),
    message: error.message,
    productId: undefined,
  };
  for (const listener of purchaseErrorJsListeners) {
    try {
      listener(normalized);
    } catch (e) {
      RnIapConsole.error('[purchaseErrorListener] callback threw:', e);
    }
  }
};

const promotedProductJsListeners = new Set<(product: Product) => void>();
let promotedProductNativeAttached = false;
const promotedProductNativeHandler: NitroPromotedProductListener = (
  nitroProduct,
) => {
  if (validateNitroProduct(nitroProduct)) {
    const convertedProduct = convertNitroProductToProduct(nitroProduct);
    for (const listener of promotedProductJsListeners) {
      try {
        listener(convertedProduct);
      } catch (e) {
        RnIapConsole.error('[promotedProductListenerIOS] callback threw:', e);
      }
    }
  } else {
    RnIapConsole.error(
      'Invalid promoted product data received from native — id:',
      (nitroProduct as any)?.id ?? 'unknown',
    );
  }
};

/**
 * Reset all JS-level listener tracking state.
 * Called during endConnection to ensure clean re-registration on next initConnection.
 */
export const resetListenerState = (): void => {
  purchaseUpdateNativeAttached = false;
  purchaseUpdateDuplicateNativeAttached = false;
  purchaseUpdateNativeToken = null;
  purchaseUpdateDuplicateNativeToken = null;
  purchaseErrorNativeAttached = false;
  promotedProductNativeAttached = false;
  userChoiceBillingNativeAttached = false;
  developerProvidedBillingNativeAttached = false;
  subscriptionBillingIssueNativeAttached = false;
  // Clear all JS listeners since native side clears them in endConnection
  purchaseUpdateJsListeners.clear();
  purchaseUpdateDuplicateJsListeners.clear();
  purchaseErrorJsListeners.clear();
  promotedProductJsListeners.clear();
  userChoiceBillingJsListeners.clear();
  developerProvidedBillingJsListeners.clear();
  subscriptionBillingIssueJsListeners.clear();
};

export const purchaseUpdatedListener = (
  listener: (purchase: Purchase) => void,
  options?: PurchaseUpdatedListenerOptions | null,
): EventSubscription => {
  const receiveDuplicateTransactionUpdatesIOS =
    Platform.OS === 'ios' && options?.dedupeTransactionIOS === false;
  const listeners = receiveDuplicateTransactionUpdatesIOS
    ? purchaseUpdateDuplicateJsListeners
    : purchaseUpdateJsListeners;

  listeners.add(listener);

  if (!purchaseUpdateNativeAttached && !receiveDuplicateTransactionUpdatesIOS) {
    try {
      const token = IAP.instance.addPurchaseUpdatedListener(
        purchaseUpdateNativeHandler,
      );
      purchaseUpdateNativeToken = typeof token === 'number' ? token : null;
      purchaseUpdateNativeAttached = true;
    } catch (e) {
      const msg = toErrorMessage(e);
      if (msg.includes('Nitro runtime not installed')) {
        RnIapConsole.warn(
          '[purchaseUpdatedListener] Nitro not ready yet; listener inert until initConnection()',
        );
      } else {
        throw e;
      }
    }
  }

  if (
    !purchaseUpdateDuplicateNativeAttached &&
    receiveDuplicateTransactionUpdatesIOS
  ) {
    try {
      const nativeOptions: NitroPurchaseUpdatedListenerOptions &
        NitroPurchaseUpdatedListenerOptionsParam = {
        dedupeTransactionIOS: false,
      };
      const token = IAP.instance.addPurchaseUpdatedListener(
        purchaseUpdateDuplicateNativeHandler,
        nativeOptions,
      );
      purchaseUpdateDuplicateNativeToken =
        typeof token === 'number' ? token : null;
      purchaseUpdateDuplicateNativeAttached = true;
    } catch (e) {
      const msg = toErrorMessage(e);
      if (msg.includes('Nitro runtime not installed')) {
        RnIapConsole.warn(
          '[purchaseUpdatedListener] Nitro not ready yet; listener inert until initConnection()',
        );
      } else {
        throw e;
      }
    }
  }

  let removed = false;
  return {
    remove: () => {
      if (removed) {
        return;
      }
      removed = true;
      listeners.delete(listener);
      if (listeners.size > 0) {
        return;
      }

      const token = receiveDuplicateTransactionUpdatesIOS
        ? purchaseUpdateDuplicateNativeToken
        : purchaseUpdateNativeToken;
      if (token == null) {
        return;
      }

      try {
        IAP.instance.removePurchaseUpdatedListener(token);
        if (receiveDuplicateTransactionUpdatesIOS) {
          purchaseUpdateDuplicateNativeToken = null;
          purchaseUpdateDuplicateNativeAttached = false;
        } else {
          purchaseUpdateNativeToken = null;
          purchaseUpdateNativeAttached = false;
        }
      } catch (e) {
        RnIapConsole.warn('[purchaseUpdatedListener] native remove failed:', e);
      }
    },
  };
};

export const purchaseErrorListener = (
  listener: (error: PurchaseError) => void,
): EventSubscription => {
  purchaseErrorJsListeners.add(listener);

  if (!purchaseErrorNativeAttached) {
    try {
      IAP.instance.addPurchaseErrorListener(purchaseErrorNativeHandler);
      purchaseErrorNativeAttached = true;
    } catch (e) {
      const msg = toErrorMessage(e);
      if (msg.includes('Nitro runtime not installed')) {
        RnIapConsole.warn(
          '[purchaseErrorListener] Nitro not ready yet; listener inert until initConnection()',
        );
      } else {
        throw e;
      }
    }
  }

  return {
    remove: () => {
      purchaseErrorJsListeners.delete(listener);
    },
  };
};

export const promotedProductListenerIOS = (
  listener: (product: Product) => void,
): EventSubscription => {
  if (Platform.OS !== 'ios') {
    RnIapConsole.warn(
      'promotedProductListenerIOS: This listener is only available on iOS',
    );
    return {remove: () => {}};
  }

  // tvOS and macOS do not support App Store promoted products
  if (isTVOS() || isMacOS()) {
    RnIapConsole.debug(
      'promotedProductListenerIOS: Promoted products not available on tvOS/macOS',
    );
    return {remove: () => {}};
  }

  promotedProductJsListeners.add(listener);

  if (!promotedProductNativeAttached) {
    try {
      IAP.instance.addPromotedProductListenerIOS(promotedProductNativeHandler);
      promotedProductNativeAttached = true;
    } catch (e) {
      const msg = toErrorMessage(e);
      if (msg.includes('Nitro runtime not installed')) {
        RnIapConsole.warn(
          '[promotedProductListenerIOS] Nitro not ready yet; listener inert until initConnection()',
        );
      } else {
        throw e;
      }
    }
  }

  return {
    remove: () => {
      promotedProductJsListeners.delete(listener);
    },
  };
};

/**
 * Add a listener for user choice billing events (Android only).
 * Fires when a user selects alternative billing in the User Choice Billing dialog.
 *
 * @param listener - Function to call when user chooses alternative billing
 * @returns EventSubscription with remove() method to unsubscribe
 * @platform Android
 *
 * @example
 * ```typescript
 * const subscription = userChoiceBillingListenerAndroid((details) => {
 *   console.log('User chose alternative billing');
 *   console.log('Products:', details.products);
 *   console.log('External transaction token received; send it to your backend without logging it.');
 *
 *   // Send token to backend for Google Play reporting
 *   await reportToGooglePlay(details.externalTransactionToken);
 * });
 *
 * // Later, remove the listener
 * subscription.remove();
 * ```
 */
type NitroUserChoiceBillingListener = Parameters<
  RnIap['addUserChoiceBillingListenerAndroid']
>[0];

const userChoiceBillingJsListeners = new Set<
  (details: UserChoiceBillingDetails) => void
>();
let userChoiceBillingNativeAttached = false;
const userChoiceBillingNativeHandler: NitroUserChoiceBillingListener = (
  details,
) => {
  for (const listener of userChoiceBillingJsListeners) {
    try {
      listener(details);
    } catch (e) {
      RnIapConsole.error(
        '[userChoiceBillingListenerAndroid] callback threw:',
        e,
      );
    }
  }
};

export const userChoiceBillingListenerAndroid = (
  listener: (details: UserChoiceBillingDetails) => void,
): EventSubscription => {
  if (Platform.OS !== 'android') {
    RnIapConsole.warn(
      'userChoiceBillingListenerAndroid: This listener is only available on Android',
    );
    return {remove: () => {}};
  }

  userChoiceBillingJsListeners.add(listener);

  if (!userChoiceBillingNativeAttached) {
    try {
      IAP.instance.addUserChoiceBillingListenerAndroid(
        userChoiceBillingNativeHandler,
      );
      userChoiceBillingNativeAttached = true;
    } catch (e) {
      const msg = toErrorMessage(e);
      if (msg.includes('Nitro runtime not installed')) {
        RnIapConsole.warn(
          '[userChoiceBillingListenerAndroid] Nitro not ready yet; listener inert until initConnection()',
        );
      } else {
        throw e;
      }
    }
  }

  return {
    remove: () => {
      userChoiceBillingJsListeners.delete(listener);
    },
  };
};

/**
 * Add a listener for developer provided billing events (Android 8.3.0+ only).
 * Fires when a user selects developer billing in the External Payments flow.
 *
 * External Payments is part of Google Play Billing Library 8.3.0+ and allows
 * showing a side-by-side choice between Google Play Billing and developer's
 * external payment option directly in the purchase flow. (Japan only)
 *
 * @param listener - Function to call when user chooses developer billing
 * @returns EventSubscription with remove() method to unsubscribe
 * @platform Android
 * @since Google Play Billing Library 8.3.0+
 *
 * @example
 * ```typescript
 * const subscription = developerProvidedBillingListenerAndroid((details) => {
 *   console.log('User chose developer billing');
 *   console.log('External transaction token received; send it to your backend without logging it.');
 *
 *   // Process payment through your external payment system
 *   await processExternalPayment();
 *
 *   // Report transaction to Google Play (within 24 hours)
 *   await reportToGooglePlay(details.externalTransactionToken);
 * });
 *
 * // Later, remove the listener
 * subscription.remove();
 * ```
 */
type NitroDeveloperProvidedBillingListener = Parameters<
  RnIap['addDeveloperProvidedBillingListenerAndroid']
>[0];

const developerProvidedBillingJsListeners = new Set<
  (details: DeveloperProvidedBillingDetailsAndroid) => void
>();
let developerProvidedBillingNativeAttached = false;
const developerProvidedBillingNativeHandler: NitroDeveloperProvidedBillingListener =
  (details) => {
    for (const listener of developerProvidedBillingJsListeners) {
      try {
        listener(details);
      } catch (e) {
        RnIapConsole.error(
          '[developerProvidedBillingListenerAndroid] callback threw:',
          e,
        );
      }
    }
  };

export const developerProvidedBillingListenerAndroid = (
  listener: (details: DeveloperProvidedBillingDetailsAndroid) => void,
): EventSubscription => {
  if (Platform.OS !== 'android') {
    RnIapConsole.warn(
      'developerProvidedBillingListenerAndroid: This listener is only available on Android',
    );
    return {remove: () => {}};
  }

  developerProvidedBillingJsListeners.add(listener);

  if (!developerProvidedBillingNativeAttached) {
    try {
      IAP.instance.addDeveloperProvidedBillingListenerAndroid(
        developerProvidedBillingNativeHandler,
      );
      developerProvidedBillingNativeAttached = true;
    } catch (e) {
      const msg = toErrorMessage(e);
      if (msg.includes('Nitro runtime not installed')) {
        RnIapConsole.warn(
          '[developerProvidedBillingListenerAndroid] Nitro not ready yet; listener inert until initConnection()',
        );
      } else {
        throw e;
      }
    }
  }

  return {
    remove: () => {
      developerProvidedBillingJsListeners.delete(listener);
    },
  };
};

/**
 * Listen for subscription billing-issue events (cross-platform).
 *
 * Fires when an active subscription enters a billing-issue state:
 * - iOS 18+ / Mac Catalyst 18+: via StoreKit 2 `Message.Reason.billingIssue`.
 * - Android (Play Billing 8.1+): when `isSuspendedAndroid === true` is observed.
 * - Horizon / iOS 17 / older platforms: never fires.
 *
 * Recommended UX: on fire, call `deepLinkToSubscriptions()` so the user can
 * update their payment method in the platform subscription center.
 *
 * @param listener - Function to call with the affected Purchase
 * @returns EventSubscription with remove() method to unsubscribe
 *
 * @example
 * ```typescript
 * const subscription = subscriptionBillingIssueListener((purchase) => {
 *   console.warn('Subscription needs attention:', purchase.productId);
 *   deepLinkToSubscriptions({skuAndroid: purchase.productId, packageNameAndroid: 'com.example.app'});
 * });
 *
 * subscription.remove();
 * ```
 */
type NitroSubscriptionBillingIssueListener = Parameters<
  RnIap['addSubscriptionBillingIssueListener']
>[0];

const subscriptionBillingIssueJsListeners = new Set<
  (purchase: Purchase) => void
>();
let subscriptionBillingIssueNativeAttached = false;
const subscriptionBillingIssueNativeHandler: NitroSubscriptionBillingIssueListener =
  (nitroPurchase) => {
    if (!validateNitroPurchase(nitroPurchase)) {
      RnIapConsole.warn(
        '[subscriptionBillingIssueListener] dropped malformed native payload',
      );
      return;
    }
    const purchase = convertNitroPurchaseToPurchase(nitroPurchase);
    for (const listener of subscriptionBillingIssueJsListeners) {
      try {
        listener(purchase);
      } catch (e) {
        RnIapConsole.error(
          '[subscriptionBillingIssueListener] callback threw:',
          e,
        );
      }
    }
  };

function tryAttachSubscriptionBillingIssueNative(): void {
  if (subscriptionBillingIssueNativeAttached) return;
  try {
    IAP.instance.addSubscriptionBillingIssueListener(
      subscriptionBillingIssueNativeHandler,
    );
    subscriptionBillingIssueNativeAttached = true;
  } catch (e) {
    const msg = toErrorMessage(e);
    if (msg.includes('Nitro runtime not installed')) {
      RnIapConsole.warn(
        '[subscriptionBillingIssueListener] Nitro not ready yet; will retry on next registration after initConnection()',
      );
    } else {
      throw e;
    }
  }
}

export const subscriptionBillingIssueListener = (
  listener: (purchase: Purchase) => void,
): EventSubscription => {
  subscriptionBillingIssueJsListeners.add(listener);
  // Retry attachment every call so a listener registered before initConnection()
  // doesn't stay permanently inert once Nitro is ready.
  try {
    tryAttachSubscriptionBillingIssueNative();
  } catch (error) {
    subscriptionBillingIssueJsListeners.delete(listener);
    throw error;
  }

  return {
    remove: () => {
      subscriptionBillingIssueJsListeners.delete(listener);
    },
  };
};

// ------------------------------
// Query API
// ------------------------------

/**
 * Retrieve products or subscriptions from the store by SKU.
 *
 * @param request `ProductRequest` — `skus` (string[]) and optional `type`
 *   (`'in-app' | 'subs' | 'all'`, defaults to `'in-app'`).
 * @returns Promise resolving to a `FetchProductsResult` union — `Product[]` for `'in-app'`,
 *   `ProductSubscription[]` for `'subs'`, a mixed array for `'all'`, or `null`
 *   (the schema retains the nullable branch for backwards compatibility).
 * @throws When the store rejects the request (empty `skus`, not connected,
 *   network/store error). Unknown SKUs are simply omitted from the result, not thrown.
 *
 * @example
 * ```ts
 * const products = await fetchProducts({
 *   skus: ['com.app.coins_100', 'com.app.premium'],
 *   type: 'in-app',
 * });
 * ```
 *
 * @remarks This is a regular promise-based call. Don't confuse with `request*` APIs
 *   (`requestPurchase`), which are event-based.
 *
 * @see {@link https://openiap.dev/docs/apis/fetch-products}
 */
export const fetchProducts: QueryField<'fetchProducts'> = async (request) => {
  const {skus, type} = request;

  try {
    if (!skus?.length) {
      throw new Error('No SKUs provided');
    }

    const normalizedType = normalizeProductQueryType(type);

    const fetchAndConvert = async (
      nitroType: ReturnType<typeof toNitroProductType> | 'all',
    ) => {
      const nitroProducts = await IAP.instance.fetchProducts(skus, nitroType);
      const validProducts = nitroProducts.filter(validateNitroProduct);
      if (validProducts.length !== nitroProducts.length) {
        RnIapConsole.warn(
          `[fetchProducts] Some products failed validation: ${nitroProducts.length - validProducts.length} invalid`,
        );
      }
      return validProducts.map(convertNitroProductToProduct);
    };

    if (normalizedType === 'all') {
      const converted = (await fetchAndConvert('all')) as (
        | Product
        | ProductSubscription
      )[];

      RnIapConsole.debug(
        '[fetchProducts] Converted items before filtering:',
        converted.map((item) => ({
          id: item.id,
          type: item.type,
          platform: item.platform,
        })),
      );

      // For 'all' type, need to properly distinguish between products and subscriptions
      // On Android, check subscriptionOfferDetailsAndroid to determine if it's a real subscription
      const productItems: Product[] = [];
      const subscriptionItems: ProductSubscription[] = [];

      converted.forEach((item) => {
        // With discriminated unions, type field is now reliable
        if (item.type === 'in-app') {
          productItems.push(item);
          return;
        }

        // item.type === 'subs' case
        // For Android, check if subscription items have actual offers
        if (
          Platform.OS === 'android' &&
          item.platform === 'android' &&
          item.type === 'subs'
        ) {
          // TypeScript now knows this is ProductSubscriptionAndroid
          const hasSubscriptionOffers =
            item.subscriptionOfferDetailsAndroid &&
            Array.isArray(item.subscriptionOfferDetailsAndroid) &&
            item.subscriptionOfferDetailsAndroid.length > 0;

          RnIapConsole.debug(
            `[fetchProducts] ${item.id}: type=${item.type}, hasOffers=${hasSubscriptionOffers}`,
          );

          if (hasSubscriptionOffers) {
            subscriptionItems.push(item);
          } else {
            // Treat as product if no offers - convert type
            const {subscriptionOfferDetailsAndroid: _, ...productFields} =
              item as any;
            productItems.push({
              ...productFields,
              type: 'in-app' as const,
            } as Product);
          }
        } else if (item.platform === 'ios' && item.type === 'subs') {
          // iOS: type field is reliable with discriminated unions
          // TypeScript now knows this is ProductSubscriptionIOS
          subscriptionItems.push(item);
        }
      });

      RnIapConsole.debug(
        '[fetchProducts] After filtering - products:',
        productItems.length,
        'subs:',
        subscriptionItems.length,
      );
      return [...productItems, ...subscriptionItems] as FetchProductsResult;
    }

    const convertedProducts = await fetchAndConvert(
      toNitroProductType(normalizedType),
    );

    if (normalizedType === 'subs') {
      return convertedProducts.map(
        convertProductToProductSubscription,
      ) as FetchProductsResult;
    }

    return convertedProducts as FetchProductsResult;
  } catch (error) {
    RnIapConsole.error('[fetchProducts] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
      productId: parsedError.productId,
      productIds: parsedError.productIds,
      productType: parsedError.productType,
      isEmptyProductList: parsedError.isEmptyProductList,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
  }
};

/**
 * List the user's unfinished purchases — non-consumables, active subscriptions, and any
 * pending transactions not yet finished.
 *
 * @param options Optional `PurchaseOptions`.
 *   - iOS: `alsoPublishToEventListenerIOS`, `onlyIncludeActiveItemsIOS`.
 *   - Android: `includeSuspendedAndroid` (include subscriptions in a paused/grace state).
 * @returns Promise resolving to an array of `Purchase` currently held by the store.
 * @throws When the platform query fails.
 *
 * @example
 * ```ts
 * const purchases = await getAvailablePurchases();
 * for (const p of purchases) {
 *   if (await verifyOnServer(p)) await finishTransaction({ purchase: p, isConsumable: false });
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/get-available-purchases}
 */
export const getAvailablePurchases: QueryField<
  'getAvailablePurchases'
> = async (options) => {
  const alsoPublishToEventListenerIOS = Boolean(
    options?.alsoPublishToEventListenerIOS ?? false,
  );
  const onlyIncludeActiveItemsIOS = Boolean(
    options?.onlyIncludeActiveItemsIOS ?? true,
  );
  try {
    if (Platform.OS === 'ios') {
      const nitroOptions: NitroAvailablePurchasesOptions = {
        ios: {
          alsoPublishToEventListenerIOS,
          onlyIncludeActiveItemsIOS,
          alsoPublishToEventListener: alsoPublishToEventListenerIOS,
          onlyIncludeActiveItems: onlyIncludeActiveItemsIOS,
        },
      };
      const nitroPurchases =
        await IAP.instance.getAvailablePurchases(nitroOptions);

      const validPurchases = nitroPurchases.filter(validateNitroPurchase);
      if (validPurchases.length !== nitroPurchases.length) {
        RnIapConsole.warn(
          `[getAvailablePurchases] Some purchases failed validation: ${nitroPurchases.length - validPurchases.length} invalid`,
        );
      }

      return validPurchases.map(convertNitroPurchaseToPurchase);
    } else if (Platform.OS === 'android') {
      // For Android, we need to call twice for inapp and subs
      const includeSuspended = Boolean(
        options?.includeSuspendedAndroid ?? false,
      );
      const inappNitroPurchases = await IAP.instance.getAvailablePurchases({
        android: {type: 'inapp', includeSuspended},
      });
      const subsNitroPurchases = await IAP.instance.getAvailablePurchases({
        android: {type: 'subs', includeSuspended},
      });

      // Validate and convert both sets of purchases
      const allNitroPurchases = [...inappNitroPurchases, ...subsNitroPurchases];
      const validPurchases = allNitroPurchases.filter(validateNitroPurchase);
      if (validPurchases.length !== allNitroPurchases.length) {
        RnIapConsole.warn(
          `[getAvailablePurchases] Some Android purchases failed validation: ${allNitroPurchases.length - validPurchases.length} invalid`,
        );
      }

      return validPurchases.map(convertNitroPurchaseToPurchase);
    } else {
      throw unsupportedPlatformError();
    }
  } catch (error) {
    RnIapConsole.error('Failed to get available purchases:', error);
    throw error;
  }
};

/**
 * Request the promoted product from the App Store (iOS only)
 * @returns Promise<Product | null> - The promoted product or null if none available
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-promoted-product-ios}
 */
export const getPromotedProductIOS: QueryField<
  'getPromotedProductIOS'
> = async () => {
  if (Platform.OS !== 'ios') {
    return null;
  }

  try {
    const nitroProduct =
      typeof IAP.instance.getPromotedProductIOS === 'function'
        ? await IAP.instance.getPromotedProductIOS()
        : await IAP.instance.requestPromotedProductIOS();
    if (!nitroProduct) {
      return null;
    }
    const converted = convertNitroProductToProduct(nitroProduct);
    return converted.platform === 'ios' ? (converted as ProductIOS) : null;
  } catch (error) {
    RnIapConsole.error('[getPromotedProductIOS] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

export const requestPromotedProductIOS = getPromotedProductIOS;

/**
 * Get the storefront identifier for the user's App Store account (iOS only)
 * @returns Promise<string> - The storefront identifier (e.g., 'USA' for United States)
 * @platform iOS
 *
 * @example
 * ```typescript
 * const storefront = await getStorefrontIOS();
 * console.log('User storefront:', storefront); // e.g., 'USA', 'GBR', 'KOR'
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-storefront-ios}
 */
export const getStorefrontIOS: QueryField<'getStorefrontIOS'> = async () => {
  if (Platform.OS !== 'ios') {
    throw new Error('getStorefrontIOS is only available on iOS');
  }

  try {
    const storefront = await IAP.instance.getStorefrontIOS();
    return storefront;
  } catch (error) {
    RnIapConsole.error('Failed to get storefront:', error);
    throw error;
  }
};

/**
 * Return the user's storefront country code.
 *
 * @see {@link https://openiap.dev/docs/apis/get-storefront}
 */
export const getStorefront: QueryField<'getStorefront'> = async () => {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    RnIapConsole.warn(
      '[getStorefront] Storefront lookup is only supported on iOS and Android.',
    );
    return '';
  }

  const hasUnifiedMethod = typeof IAP.instance.getStorefront === 'function';

  if (!hasUnifiedMethod && Platform.OS === 'ios') {
    return getStorefrontIOS();
  }

  if (!hasUnifiedMethod) {
    RnIapConsole.warn(
      '[getStorefront] Native getStorefront is not available on this build.',
    );
    return '';
  }

  try {
    const storefront = await IAP.instance.getStorefront();
    return storefront ?? '';
  } catch (error) {
    RnIapConsole.error(
      `[getStorefront] Failed to get storefront on ${Platform.OS}:`,
      error,
    );
    throw error;
  }
};

/**
 * iOS only - Gets the original app transaction ID if the app was purchased from the App Store
 * @platform iOS
 * @description
 * This function retrieves the original app transaction information if the app was purchased
 * from the App Store. Returns null if the app was not purchased (e.g., free app or TestFlight).
 *
 * @returns {Promise<string | null>} The original app transaction ID or null
 *
 * @example
 * ```typescript
 * const appTransaction = await getAppTransactionIOS();
 * if (appTransaction) {
 *   console.log('App was purchased, transaction ID:', appTransaction);
 * } else {
 *   console.log('App was not purchased from App Store');
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-app-transaction-ios}
 */
export const getAppTransactionIOS: QueryField<
  'getAppTransactionIOS'
> = async () => {
  if (Platform.OS !== 'ios') {
    throw new Error('getAppTransactionIOS is only available on iOS');
  }

  try {
    const appTransaction = await IAP.instance.getAppTransactionIOS();
    if (appTransaction == null) {
      return null;
    }

    if (typeof appTransaction === 'string') {
      const parsed = parseAppTransactionPayload(appTransaction);
      if (parsed) {
        return parsed;
      }
      throw new Error('Unable to parse app transaction payload');
    }

    if (typeof appTransaction === 'object' && appTransaction !== null) {
      return appTransaction as AppTransaction;
    }

    return null;
  } catch (error) {
    RnIapConsole.error('Failed to get app transaction:', error);
    throw error;
  }
};

/**
 * Get subscription status for a product (iOS only)
 * @param sku - The product SKU
 * @returns Promise<SubscriptionStatusIOS[]> - Array of subscription status objects
 * @throws Error when called on non-iOS platforms or when IAP is not initialized
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/subscription-status-ios}
 */
export const subscriptionStatusIOS: QueryField<
  'subscriptionStatusIOS'
> = async (sku) => {
  if (Platform.OS !== 'ios') {
    throw new Error('subscriptionStatusIOS is only available on iOS');
  }

  try {
    const statuses = await IAP.instance.subscriptionStatusIOS(sku);
    if (!Array.isArray(statuses)) return [];
    return statuses
      .filter((status): status is NitroSubscriptionStatus => status != null)
      .map(convertNitroSubscriptionStatusToSubscriptionStatusIOS);
  } catch (error) {
    RnIapConsole.error('[subscriptionStatusIOS] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Get current entitlement for a product (iOS only)
 * @param sku - The product SKU
 * @returns Promise<Purchase | null> - Current entitlement or null
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/current-entitlement-ios}
 */
export const currentEntitlementIOS: QueryField<
  'currentEntitlementIOS'
> = async (sku) => {
  if (Platform.OS !== 'ios') {
    return null;
  }

  try {
    const nitroPurchase = await IAP.instance.currentEntitlementIOS(sku);
    if (nitroPurchase) {
      const converted = convertNitroPurchaseToPurchase(nitroPurchase);
      return converted.platform === 'ios' ? (converted as PurchaseIOS) : null;
    }
    return null;
  } catch (error) {
    RnIapConsole.error('[currentEntitlementIOS] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Get latest transaction for a product (iOS only)
 * @param sku - The product SKU
 * @returns Promise<Purchase | null> - Latest transaction or null
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/latest-transaction-ios}
 */
export const latestTransactionIOS: QueryField<'latestTransactionIOS'> = async (
  sku,
) => {
  if (Platform.OS !== 'ios') {
    return null;
  }

  try {
    const nitroPurchase = await IAP.instance.latestTransactionIOS(sku);
    if (nitroPurchase) {
      const converted = convertNitroPurchaseToPurchase(nitroPurchase);
      return converted.platform === 'ios' ? (converted as PurchaseIOS) : null;
    }
    return null;
  } catch (error) {
    RnIapConsole.error('[latestTransactionIOS] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Get pending transactions (iOS only)
 * @returns Promise<Purchase[]> - Array of pending transactions
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-pending-transactions-ios}
 */
export const getPendingTransactionsIOS: QueryField<
  'getPendingTransactionsIOS'
> = async () => {
  if (Platform.OS !== 'ios') {
    return [];
  }

  try {
    const nitroPurchases = await IAP.instance.getPendingTransactionsIOS();
    return nitroPurchases
      .map(convertNitroPurchaseToPurchase)
      .filter(
        (purchase): purchase is PurchaseIOS => purchase.platform === 'ios',
      );
  } catch (error) {
    RnIapConsole.error('[getPendingTransactionsIOS] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * List every StoreKit transaction (finished + unfinished) for the current user.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-all-transactions-ios}
 */
export const getAllTransactionsIOS: QueryField<
  'getAllTransactionsIOS'
> = async () => {
  if (Platform.OS !== 'ios') {
    return [];
  }

  try {
    const nitroPurchases = await IAP.instance.getAllTransactionsIOS();
    return nitroPurchases
      .map(convertNitroPurchaseToPurchase)
      .filter(
        (purchase): purchase is PurchaseIOS => purchase.platform === 'ios',
      );
  } catch (error) {
    RnIapConsole.error('[getAllTransactionsIOS] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Show manage subscriptions screen (iOS only)
 * @returns Promise<Purchase[]> - Subscriptions where auto-renewal status changed
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios}
 */
export const showManageSubscriptionsIOS: MutationField<
  'showManageSubscriptionsIOS'
> = async () => {
  if (Platform.OS !== 'ios') {
    return [];
  }

  try {
    const nitroPurchases = await IAP.instance.showManageSubscriptionsIOS();
    return nitroPurchases
      .map(convertNitroPurchaseToPurchase)
      .filter(
        (purchase): purchase is PurchaseIOS => purchase.platform === 'ios',
      );
  } catch (error) {
    RnIapConsole.error('[showManageSubscriptionsIOS] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Check if user is eligible for intro offer (iOS only)
 * @param groupID - The subscription group ID
 * @returns Promise<boolean> - Eligibility status
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios}
 */
export const isEligibleForIntroOfferIOS: QueryField<
  'isEligibleForIntroOfferIOS'
> = async (groupID) => {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    return await IAP.instance.isEligibleForIntroOfferIOS(groupID);
  } catch (error) {
    RnIapConsole.error('[isEligibleForIntroOfferIOS] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Get receipt data (iOS only)
 * @returns Promise<string> - Base64 encoded receipt data
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-receipt-data-ios}
 */
export const getReceiptDataIOS: QueryField<'getReceiptDataIOS'> = async () => {
  if (Platform.OS !== 'ios') {
    throw new Error('getReceiptDataIOS is only available on iOS');
  }

  RnIapConsole.warn(
    '[getReceiptDataIOS] ⚠️ iOS receipts contain ALL transactions, not just the latest one. ' +
      'For individual purchase validation, use getTransactionJwsIOS(productId) instead. ' +
      'See: https://react-native-iap.hyo.dev/docs/guides/receipt-validation',
  );

  try {
    return await IAP.instance.getReceiptDataIOS();
  } catch (error) {
    RnIapConsole.error('[getReceiptDataIOS] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

export const getReceiptIOS = async (): Promise<string> => {
  if (Platform.OS !== 'ios') {
    throw new Error('getReceiptIOS is only available on iOS');
  }

  RnIapConsole.warn(
    '[getReceiptIOS] ⚠️ iOS receipts contain ALL transactions, not just the latest one. ' +
      'For individual purchase validation, use getTransactionJwsIOS(productId) instead. ' +
      'See: https://react-native-iap.hyo.dev/docs/guides/receipt-validation',
  );

  try {
    if (typeof IAP.instance.getReceiptIOS === 'function') {
      return await IAP.instance.getReceiptIOS();
    }
    return await IAP.instance.getReceiptDataIOS();
  } catch (error) {
    RnIapConsole.error('[getReceiptIOS] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

export const requestReceiptRefreshIOS = async (): Promise<string> => {
  if (Platform.OS !== 'ios') {
    throw new Error('requestReceiptRefreshIOS is only available on iOS');
  }

  RnIapConsole.warn(
    '[requestReceiptRefreshIOS] ⚠️ iOS receipts contain ALL transactions, not just the latest one. ' +
      'For individual purchase validation, use getTransactionJwsIOS(productId) instead. ' +
      'See: https://react-native-iap.hyo.dev/docs/guides/receipt-validation',
  );

  try {
    if (typeof IAP.instance.requestReceiptRefreshIOS === 'function') {
      return await IAP.instance.requestReceiptRefreshIOS();
    }
    return await IAP.instance.getReceiptDataIOS();
  } catch (error) {
    RnIapConsole.error('[requestReceiptRefreshIOS] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Check if transaction is verified (iOS only)
 * @param sku - The product SKU
 * @returns Promise<boolean> - Verification status
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/is-transaction-verified-ios}
 */
export const isTransactionVerifiedIOS: QueryField<
  'isTransactionVerifiedIOS'
> = async (sku) => {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    return await IAP.instance.isTransactionVerifiedIOS(sku);
  } catch (error) {
    RnIapConsole.error('[isTransactionVerifiedIOS] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Get transaction JWS representation (iOS only)
 * @param sku - The product SKU
 * @returns Promise<string | null> - JWS representation or null
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-transaction-jws-ios}
 */
export const getTransactionJwsIOS: QueryField<'getTransactionJwsIOS'> = async (
  sku,
) => {
  if (Platform.OS !== 'ios') {
    return null;
  }

  try {
    return await IAP.instance.getTransactionJwsIOS(sku);
  } catch (error) {
    RnIapConsole.error('[getTransactionJwsIOS] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

// ------------------------------
// Mutation API
// ------------------------------

/**
 * Initialize the store connection. Must be called before any other IAP API.
 *
 * @param config Optional connection config. Use `enableBillingProgramAndroid` (Android,
 *   Play Billing 8.2.0+) to opt into External Payments etc. iOS ignores Android-specific fields.
 * @returns Promise resolving to `true` when the platform billing client is connected.
 * @throws When the platform billing client fails to initialize.
 *
 * @example
 * ```ts
 * await initConnection();
 * await initConnection({ enableBillingProgramAndroid: 'external-offer' });
 * ```
 *
 * @remarks When using `useIAP()`, connection is auto-managed on mount/unmount —
 *   pass options to the hook instead of calling this directly.
 *
 * @see {@link https://openiap.dev/docs/apis/init-connection}
 */
export const initConnection: MutationField<'initConnection'> = async (
  config,
) => {
  try {
    return await IAP.instance.initConnection(
      config as Record<string, unknown> | undefined,
    );
  } catch (error) {
    RnIapConsole.error('Failed to initialize IAP connection:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Close the store connection and release resources.
 *
 * @see {@link https://openiap.dev/docs/apis/end-connection}
 */
export const endConnection: MutationField<'endConnection'> = async () => {
  try {
    if (!iapRef) return true;
    const result = await IAP.instance.endConnection();
    resetListenerState();
    return result;
  } catch (error) {
    RnIapConsole.error('Failed to end IAP connection:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Restore non-consumable and active subscription purchases.
 *
 * @see {@link https://openiap.dev/docs/apis/restore-purchases}
 */
export const restorePurchases: MutationField<'restorePurchases'> = async () => {
  try {
    if (Platform.OS === 'ios') {
      await syncIOS();
    }

    await getAvailablePurchases({
      alsoPublishToEventListenerIOS: false,
      onlyIncludeActiveItemsIOS: true,
    });
  } catch (error) {
    RnIapConsole.error('Failed to restore purchases:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Initiate a purchase or subscription flow. The result is delivered through
 * `purchaseUpdatedListener` — NOT the return value.
 *
 * @param request `RequestPurchaseProps`, discriminated by `type`:
 *   - `type: 'in-app'` — pass `request.apple.sku` (iOS) and/or `request.google.skus` (Android).
 *   - `type: 'subs'`  — same shape, plus `request.google.subscriptionOffers: [{ sku, offerToken }]`.
 * @returns The dispatched purchase payload. **Do not rely on it** for the actual outcome.
 * @throws Synchronous rejection from the store (e.g. `E_NOT_PREPARED`, validation failure).
 *
 * @example
 * ```ts
 * await requestPurchase({
 *   request: {
 *     apple: { sku: 'com.app.premium' },
 *     google: { skus: ['com.app.premium'] },
 *   },
 *   type: 'in-app',
 * });
 * ```
 *
 * @remarks Event-based. Listen for the result via {@link purchaseUpdatedListener} /
 *   {@link purchaseErrorListener}, or use `useIAP({ onPurchaseSuccess, onPurchaseError })`.
 *
 * @see {@link https://openiap.dev/docs/apis/request-purchase}
 */
export const requestPurchase: MutationField<'requestPurchase'> = async (
  request,
) => {
  try {
    const {request: platformRequest, type} = request;
    const normalizedType = normalizeProductQueryType(type ?? 'in-app');
    const isSubs = isSubscriptionQuery(normalizedType);
    const perPlatformRequest = platformRequest as
      | RequestPurchasePropsByPlatforms
      | RequestSubscriptionPropsByPlatforms
      | undefined;

    if (!perPlatformRequest) {
      throw new Error('Missing purchase request configuration');
    }

    if (Platform.OS === 'ios') {
      // Support both 'apple' (recommended) and 'ios' (deprecated) fields
      const iosRequest = perPlatformRequest.apple ?? perPlatformRequest.ios;
      if (!iosRequest?.sku) {
        throw new Error(
          'Invalid request for iOS. The `sku` property is required.',
        );
      }
    } else if (Platform.OS === 'android') {
      // Support both 'google' (recommended) and 'android' (deprecated) fields
      const androidRequest =
        perPlatformRequest.google ?? perPlatformRequest.android;
      if (!androidRequest?.skus?.length) {
        throw new Error(
          'Invalid request for Android. The `skus` property is required and must be a non-empty array.',
        );
      }
    } else {
      throw unsupportedPlatformError();
    }

    const unifiedRequest: NitroPurchaseRequest = {};

    // Support both 'apple' (recommended) and 'ios' (deprecated) fields
    const iosRequestSource = perPlatformRequest.apple ?? perPlatformRequest.ios;
    if (Platform.OS === 'ios' && iosRequestSource) {
      const iosRequest = isSubs
        ? (iosRequestSource as RequestSubscriptionIosProps)
        : (iosRequestSource as RequestPurchaseIosProps);

      const iosPayload: NonNullable<NitroPurchaseRequest['ios']> = {
        sku: iosRequest.sku,
      };

      if (
        iosRequest.andDangerouslyFinishTransactionAutomatically !== undefined
      ) {
        iosPayload.andDangerouslyFinishTransactionAutomatically =
          iosRequest.andDangerouslyFinishTransactionAutomatically;
      }
      if (iosRequest.appAccountToken) {
        iosPayload.appAccountToken = iosRequest.appAccountToken;
      }
      if (typeof iosRequest.quantity === 'number') {
        iosPayload.quantity = iosRequest.quantity;
      }
      const offerRecord = toDiscountOfferRecordIOS(iosRequest.withOffer);
      if (offerRecord) {
        iosPayload.withOffer = offerRecord;
      }
      if (iosRequest.advancedCommerceData) {
        iosPayload.advancedCommerceData = iosRequest.advancedCommerceData;
      }
      if (isSubs) {
        const subscriptionRequest = iosRequest as RequestSubscriptionIosProps;
        if (
          subscriptionRequest.introductoryOfferEligibility !== undefined
        ) {
          iosPayload.introductoryOfferEligibility =
            subscriptionRequest.introductoryOfferEligibility;
        }
        if (subscriptionRequest.promotionalOfferJWS) {
          iosPayload.promotionalOfferJWS =
            subscriptionRequest.promotionalOfferJWS;
        }
        if (subscriptionRequest.winBackOffer) {
          iosPayload.winBackOffer = subscriptionRequest.winBackOffer;
        }
      }

      unifiedRequest.ios = iosPayload;
    }

    // Support both 'google' (recommended) and 'android' (deprecated) fields
    const androidRequestSource =
      perPlatformRequest.google ?? perPlatformRequest.android;
    if (Platform.OS === 'android' && androidRequestSource) {
      const androidRequest = isSubs
        ? (androidRequestSource as RequestSubscriptionAndroidProps)
        : (androidRequestSource as RequestPurchaseAndroidProps);

      const androidPayload: NonNullable<NitroPurchaseRequest['android']> = {
        skus: androidRequest.skus,
      };

      if (androidRequest.obfuscatedAccountId) {
        androidPayload.obfuscatedAccountId = androidRequest.obfuscatedAccountId;
      }
      if (androidRequest.obfuscatedProfileId) {
        androidPayload.obfuscatedProfileId = androidRequest.obfuscatedProfileId;
      }
      if (androidRequest.isOfferPersonalized != null) {
        androidPayload.isOfferPersonalized = androidRequest.isOfferPersonalized;
      }

      // One-time purchase offerToken (Android 7.0+)
      if (!isSubs) {
        const purchaseRequest = androidRequest as RequestPurchaseAndroidProps;
        if (purchaseRequest.offerToken) {
          androidPayload.offerToken = purchaseRequest.offerToken;
        }
      }

      if (isSubs) {
        const subsRequest = androidRequest as RequestSubscriptionAndroidProps;
        if (subsRequest.purchaseToken) {
          androidPayload.purchaseToken = subsRequest.purchaseToken;
        }
        if (subsRequest.replacementMode != null) {
          androidPayload.replacementMode = subsRequest.replacementMode;
        }
        if (subsRequest.subscriptionProductReplacementParams) {
          androidPayload.subscriptionProductReplacementParams =
            subsRequest.subscriptionProductReplacementParams;
        }
        androidPayload.subscriptionOffers = (
          subsRequest.subscriptionOffers ?? []
        )
          .filter(
            (offer): offer is AndroidSubscriptionOfferInput => offer != null,
          )
          .map((offer) => ({
            sku: offer.sku,
            offerToken: offer.offerToken,
          }));
      }

      unifiedRequest.android = androidPayload;
    }

    return await IAP.instance.requestPurchase(unifiedRequest);
  } catch (error) {
    RnIapConsole.error('Failed to request purchase:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
      productId: parsedError.productId,
    });
  }
};

/**
 * Complete a purchase transaction. Call after server-side verification to remove it
 * from the queue.
 *
 * @param args.purchase The `Purchase` to finalize.
 * @param args.isConsumable `true` for consumables (consumes the token so the SKU can be
 *   re-bought, e.g. coins); `false` (default) for non-consumables and subscriptions.
 * @returns Promise that resolves once the platform finalizes the transaction.
 * @throws When the platform finalize call fails.
 *
 * @example
 * ```ts
 * purchaseUpdatedListener(async (purchase) => {
 *   if (await verifyOnServer(purchase)) {
 *     await finishTransaction({ purchase, isConsumable: false });
 *   }
 * });
 * ```
 *
 * @remarks **Critical:** Android purchases must be finalized within 3 days or Google
 *   auto-refunds. iOS unfinished transactions replay on every app launch.
 *
 * @see {@link https://openiap.dev/docs/apis/finish-transaction}
 */
export const finishTransaction: MutationField<'finishTransaction'> = async (
  args,
) => {
  const {purchase, isConsumable} = args;
  try {
    let params: NitroFinishTransactionParamsInternal;
    if (Platform.OS === 'ios') {
      if (!purchase.id) {
        throw new Error('purchase.id required to finish iOS transaction');
      }
      params = {
        ios: {
          transactionId: purchase.id,
        },
      };
    } else if (Platform.OS === 'android') {
      const token = purchase.purchaseToken ?? undefined;

      if (!token) {
        throw new Error('purchaseToken required to finish Android transaction');
      }

      params = {
        android: {
          purchaseToken: token,
          isConsumable: isConsumable ?? false,
        },
      };
    } else {
      throw unsupportedPlatformError();
    }

    const result = await IAP.instance.finishTransaction(params);
    const success = getSuccessFromPurchaseVariant(result, 'finishTransaction');
    if (!success) {
      throw new Error('Failed to finish transaction');
    }
    return;
  } catch (error) {
    // If iOS transaction has already been auto-finished natively, treat as success
    if (Platform.OS === 'ios') {
      const err = parseErrorStringToJsonObj(error);
      const msg = (err?.message || '').toString();
      const code = (err?.code || '').toString();
      if (
        msg.includes('Transaction not found') ||
        code === 'E_ITEM_UNAVAILABLE'
      ) {
        // Consider already finished
        return;
      }
    }
    RnIapConsole.error('Failed to finish transaction:', error);
    throw error;
  }
};

/**
 * Acknowledge a purchase (Android only)
 * @param purchaseToken - The purchase token to acknowledge
 * @returns Promise<boolean> - Indicates whether the acknowledgement succeeded
 *
 * @example
 * ```typescript
 * await acknowledgePurchaseAndroid('purchase_token_here');
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/acknowledge-purchase-android}
 */
export const acknowledgePurchaseAndroid: MutationField<
  'acknowledgePurchaseAndroid'
> = async (purchaseToken) => {
  try {
    if (Platform.OS !== 'android') {
      throw new Error(
        'acknowledgePurchaseAndroid is only available on Android',
      );
    }

    const result = await IAP.instance.finishTransaction({
      android: {
        purchaseToken,
        isConsumable: false,
      },
    });
    return getSuccessFromPurchaseVariant(result, 'acknowledgePurchaseAndroid');
  } catch (error) {
    RnIapConsole.error('Failed to acknowledge purchase Android:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Consume a purchase (Android only)
 * @param purchaseToken - The purchase token to consume
 * @returns Promise<boolean> - Indicates whether the consumption succeeded
 *
 * @example
 * ```typescript
 * await consumePurchaseAndroid('purchase_token_here');
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/consume-purchase-android}
 */
export const consumePurchaseAndroid: MutationField<
  'consumePurchaseAndroid'
> = async (purchaseToken) => {
  try {
    if (Platform.OS !== 'android') {
      throw new Error('consumePurchaseAndroid is only available on Android');
    }

    const result = await IAP.instance.finishTransaction({
      android: {
        purchaseToken,
        isConsumable: true,
      },
    });
    return getSuccessFromPurchaseVariant(result, 'consumePurchaseAndroid');
  } catch (error) {
    RnIapConsole.error('Failed to consume purchase Android:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

// ============================================================================
// iOS-SPECIFIC FUNCTIONS
// ============================================================================

/**
 * Validate receipt on both iOS and Android platforms
 * @deprecated Use `verifyPurchase` instead. This function will be removed in a future version.
 * @param options - Platform-specific verification options
 * @param options.apple - Apple App Store verification options (iOS)
 * @param options.google - Google Play verification options (Android)
 * @param options.horizon - Meta Horizon (Quest) verification options
 * @returns Promise<VerifyPurchaseResultIOS | VerifyPurchaseResultAndroid> - Platform-specific receipt validation result
 *
 * @example
 * ```typescript
 * // Use verifyPurchase instead:
 * const result = await verifyPurchase({
 *   apple: { sku: 'premium_monthly' },
 *   google: {
 *     sku: 'premium_monthly',
 *     packageName: 'com.example.app',
 *     purchaseToken: 'token...',
 *     accessToken: 'oauth_token...',
 *     isSub: true
 *   }
 * });
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/validate-receipt}
 */
export const validateReceipt: MutationField<'validateReceipt'> = async (
  options,
) => {
  const {apple, google, horizon} = options;
  try {
    // Validate required fields based on platform
    if (Platform.OS === 'ios') {
      if (!apple?.sku) {
        throw new Error('Missing required parameter: apple.sku');
      }
    } else if (Platform.OS === 'android') {
      // Horizon verification path (e.g., Meta Quest) - skip Google validation
      if (horizon?.sku) {
        // Validate all required Horizon fields
        if (!horizon.userId || !horizon.accessToken) {
          throw new Error(
            'Missing required Horizon parameters: userId and accessToken are required when horizon.sku is provided',
          );
        }
        // Horizon verification will be handled by native layer
      } else if (!google) {
        throw new Error('Missing required parameter: google options');
      } else {
        const requiredFields: (keyof typeof google)[] = [
          'sku',
          'accessToken',
          'packageName',
          'purchaseToken',
        ];
        for (const field of requiredFields) {
          if (!google[field]) {
            throw new Error(
              `Missing or empty required parameter: google.${field}`,
            );
          }
        }
      }
    }

    const params: NitroReceiptValidationParams = {
      apple: apple?.sku
        ? {
            sku: apple.sku,
          }
        : null,
      google:
        google?.sku &&
        google.accessToken &&
        google.packageName &&
        google.purchaseToken
          ? {
              sku: google.sku,
              accessToken: google.accessToken,
              packageName: google.packageName,
              purchaseToken: google.purchaseToken,
              isSub: google.isSub == null ? undefined : Boolean(google.isSub),
            }
          : null,
      horizon:
        horizon?.sku && horizon.userId && horizon.accessToken
          ? {
              sku: horizon.sku,
              userId: horizon.userId,
              accessToken: horizon.accessToken,
            }
          : null,
    };

    const nitroResult = await IAP.instance.validateReceipt(params);

    // Convert Nitro result to public API result
    if (Platform.OS === 'ios') {
      const iosResult = nitroResult as NitroReceiptValidationResultIOS;
      const result: VerifyPurchaseResultIOS = {
        isValid: iosResult.isValid,
        receiptData: iosResult.receiptData,
        jwsRepresentation: iosResult.jwsRepresentation,
        latestTransaction: iosResult.latestTransaction
          ? convertNitroPurchaseToPurchase(iosResult.latestTransaction)
          : undefined,
      };
      return result;
    } else {
      // Android
      const androidResult = nitroResult as NitroReceiptValidationResultAndroid;
      const result: VerifyPurchaseResultAndroid = {
        autoRenewing: androidResult.autoRenewing,
        betaProduct: androidResult.betaProduct,
        cancelDate: androidResult.cancelDate,
        cancelReason: androidResult.cancelReason,
        deferredDate: androidResult.deferredDate,
        deferredSku: androidResult.deferredSku?.toString() ?? null,
        freeTrialEndDate: androidResult.freeTrialEndDate,
        gracePeriodEndDate: androidResult.gracePeriodEndDate,
        parentProductId: androidResult.parentProductId,
        productId: androidResult.productId,
        productType: androidResult.productType === 'subs' ? 'subs' : 'inapp',
        purchaseDate: androidResult.purchaseDate,
        quantity: androidResult.quantity,
        receiptId: androidResult.receiptId,
        renewalDate: androidResult.renewalDate,
        term: androidResult.term,
        termSku: androidResult.termSku,
        testTransaction: androidResult.testTransaction,
      };
      return result;
    }
  } catch (error) {
    RnIapConsole.error('[validateReceipt] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Verify purchase with the configured providers
 *
 * This function uses the native OpenIAP verifyPurchase implementation
 * which validates purchases using platform-specific methods.
 * This is an alias for validateReceipt for API consistency with OpenIAP.
 *
 * @param options - Receipt validation options containing the SKU
 * @returns Promise resolving to receipt validation result
 *
 * @see {@link https://openiap.dev/docs/features/validation#verify-purchase}
 */
export const verifyPurchase: MutationField<'verifyPurchase'> = validateReceipt;

/**
 * iOS-only receipt validation alias.
 *
 * @deprecated Use `verifyPurchase` (or `validateReceipt`) instead. Kept so
 * consumers who imported `validateReceiptIOS` — which is still declared on the
 * OpenIAP Query interface — keep working. Throws on non-iOS platforms.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/validate-receipt-ios}
 */
export const validateReceiptIOS: QueryField<'validateReceiptIOS'> = async (
  options,
) => {
  if (Platform.OS !== 'ios') {
    throw new Error('validateReceiptIOS is only available on iOS');
  }
  const result = await validateReceipt(options);
  return result as VerifyPurchaseResultIOS;
};

/**
 * Verify purchase with a specific provider (e.g., IAPKit)
 *
 * This function allows you to verify purchases using external verification
 * services like IAPKit, which provide additional validation and security.
 *
 * @param options - Verification options including provider and credentials
 * @returns Promise resolving to provider-specific verification result
 *
 * @example
 * ```typescript
 * const result = await verifyPurchaseWithProvider({
 *   provider: 'iapkit',
 *   iapkit: {
 *     apiKey: 'your-api-key',
 *     apple: { jws: purchase.purchaseToken },
 *     google: { purchaseToken: purchase.purchaseToken },
 *   },
 * });
 * ```
 *
 * @see {@link https://openiap.dev/docs/features/validation#verify-purchase-with-provider}
 */
export const verifyPurchaseWithProvider: MutationField<
  'verifyPurchaseWithProvider'
> = async (options) => {
  try {
    const result = await IAP.instance.verifyPurchaseWithProvider({
      provider: options.provider,
      iapkit: options.iapkit ?? null,
    });
    // Validate provider - Nitro spec allows 'none' for compatibility, but this function only supports 'iapkit'
    if (result.provider !== 'iapkit') {
      throw createPurchaseError({
        code: ErrorCode.DeveloperError,
        message: `Unsupported provider: ${result.provider}. Only 'iapkit' is supported.`,
      });
    }
    return {
      provider: result.provider,
      iapkit: result.iapkit
        ? {
            isValid: result.iapkit.isValid,
            state: result.iapkit.state,
            store: result.iapkit.store,
          }
        : null,
      errors: result.errors ?? null,
    };
  } catch (error) {
    RnIapConsole.error('[verifyPurchaseWithProvider] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Sync iOS purchases with App Store (iOS only)
 * @returns Promise<boolean>
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/sync-ios}
 */
export const syncIOS: MutationField<'syncIOS'> = async () => {
  if (Platform.OS !== 'ios') {
    throw new Error('syncIOS is only available on iOS');
  }

  try {
    const result = await IAP.instance.syncIOS();
    return Boolean(result);
  } catch (error) {
    RnIapConsole.error('[syncIOS] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Present the code redemption sheet for offer codes (iOS only)
 * @returns Promise<boolean> - Indicates whether the redemption sheet was presented
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/present-code-redemption-sheet-ios}
 */
export const presentCodeRedemptionSheetIOS: MutationField<
  'presentCodeRedemptionSheetIOS'
> = async () => {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    const result = await IAP.instance.presentCodeRedemptionSheetIOS();
    return Boolean(result);
  } catch (error) {
    RnIapConsole.error('[presentCodeRedemptionSheetIOS] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Buy promoted product on iOS
 * @deprecated In StoreKit 2, promoted products can be purchased directly via the standard `requestPurchase()` flow.
 * Use `promotedProductListenerIOS` to receive the product ID when a user taps a promoted product,
 * then call `requestPurchase()` with the received SKU directly.
 *
 * @example
 * ```typescript
 * // Recommended approach
 * promotedProductListenerIOS(async (product) => {
 *   await requestPurchase({
 *     request: { apple: { sku: product.id } },
 *     type: 'in-app'
 *   });
 * });
 * ```
 *
 * @returns Promise<boolean> - true when the request triggers successfully
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/request-purchase-on-promoted-product-ios}
 */
export const requestPurchaseOnPromotedProductIOS =
  async (): Promise<boolean> => {
    if (Platform.OS !== 'ios') {
      throw new Error(
        'requestPurchaseOnPromotedProductIOS is only available on iOS',
      );
    }

    try {
      await IAP.instance.buyPromotedProductIOS();
      const pending = await IAP.instance.getPendingTransactionsIOS();
      const latest = pending.find((purchase) => purchase != null);
      if (!latest) {
        throw new Error('No promoted purchase available after request');
      }

      const converted = convertNitroPurchaseToPurchase(latest);
      if (converted.platform !== 'ios') {
        throw new Error('Promoted purchase result not available for iOS');
      }

      return true;
    } catch (error) {
      RnIapConsole.error(
        '[requestPurchaseOnPromotedProductIOS] Failed:',
        error,
      );
      const parsedError = parseErrorStringToJsonObj(error);
      throw createPurchaseError({
        code: parsedError.code,
        message: parsedError.message,
        responseCode: parsedError.responseCode,
        debugMessage: parsedError.debugMessage,
      });
    }
  };

/**
 * Clear unfinished transactions on iOS
 * @returns Promise<boolean>
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/clear-transaction-ios}
 */
export const clearTransactionIOS: MutationField<
  'clearTransactionIOS'
> = async () => {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    await IAP.instance.clearTransactionIOS();
    return true;
  } catch (error) {
    RnIapConsole.error('[clearTransactionIOS] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Begin a refund request for a product on iOS 15+
 * @param sku - The product SKU to refund
 * @returns Promise<string | null> - The refund status or null if not available
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/begin-refund-request-ios}
 */
export const beginRefundRequestIOS: MutationField<
  'beginRefundRequestIOS'
> = async (sku) => {
  if (Platform.OS !== 'ios') {
    throw new Error('beginRefundRequestIOS is only available on iOS');
  }

  try {
    const status = await IAP.instance.beginRefundRequestIOS(sku);
    return status ?? null;
  } catch (error) {
    RnIapConsole.error('[beginRefundRequestIOS] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Deeplinks to native interface that allows users to manage their subscriptions
 * Cross-platform alias aligning with expo-iap
 *
 * @see {@link https://openiap.dev/docs/apis/deep-link-to-subscriptions}
 */
export const deepLinkToSubscriptions: MutationField<
  'deepLinkToSubscriptions'
> = async (options) => {
  const resolvedOptions = options ?? undefined;

  if (Platform.OS === 'android') {
    await IAP.instance.deepLinkToSubscriptionsAndroid?.({
      skuAndroid: resolvedOptions?.skuAndroid ?? undefined,
      packageNameAndroid: resolvedOptions?.packageNameAndroid ?? undefined,
    });
    return;
  }
  if (Platform.OS === 'ios') {
    if (typeof IAP.instance.deepLinkToSubscriptionsIOS === 'function') {
      await IAP.instance.deepLinkToSubscriptionsIOS();
    } else {
      await IAP.instance.showManageSubscriptionsIOS();
    }
    return;
  }

  throw unsupportedPlatformError();
};

export const deepLinkToSubscriptionsIOS = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    throw new Error('deepLinkToSubscriptionsIOS is only available on iOS');
  }

  try {
    if (typeof IAP.instance.deepLinkToSubscriptionsIOS === 'function') {
      return await IAP.instance.deepLinkToSubscriptionsIOS();
    }
    await IAP.instance.showManageSubscriptionsIOS();
    return true;
  } catch (error) {
    RnIapConsole.error('[deepLinkToSubscriptionsIOS] Failed:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Get all active subscriptions with detailed information (OpenIAP compliant)
 * Returns an array of active subscriptions. If subscriptionIds is not provided,
 * returns all active subscriptions. Platform-specific fields are populated based
 * on the current platform.
 *
 * On iOS, this uses the native getActiveSubscriptions method which includes
 * renewalInfoIOS with details about subscription renewal status, pending
 * upgrades/downgrades, and auto-renewal preferences.
 *
 * @param subscriptionIds - Optional array of subscription IDs to filter by
 * @returns Promise<ActiveSubscription[]> - Array of active subscriptions
 *
 * @see {@link https://openiap.dev/docs/apis/get-active-subscriptions}
 */
export const getActiveSubscriptions: QueryField<
  'getActiveSubscriptions'
> = async (subscriptionIds) => {
  try {
    // Use native getActiveSubscriptions on both platforms
    // iOS: includes renewalInfoIOS with subscription lifecycle info
    // Android: uses OpenIAP which calls Google Play Billing's getActiveSubscriptions
    const activeSubscriptions = await IAP.instance.getActiveSubscriptions(
      subscriptionIds ?? undefined,
    );

    // Convert NitroActiveSubscription to ActiveSubscription
    return activeSubscriptions.map(
      (sub: NitroActiveSubscription): ActiveSubscription => ({
        productId: sub.productId,
        isActive: sub.isActive,
        transactionId: sub.transactionId,
        purchaseToken: sub.purchaseToken ?? null,
        transactionDate: sub.transactionDate,
        // iOS specific fields
        expirationDateIOS: sub.expirationDateIOS ?? null,
        environmentIOS: sub.environmentIOS ?? null,
        willExpireSoon: sub.willExpireSoon ?? null,
        daysUntilExpirationIOS: sub.daysUntilExpirationIOS ?? null,
        // renewalInfoIOS contains subscription lifecycle information on iOS.
        renewalInfoIOS: sub.renewalInfoIOS
          ? {
              willAutoRenew: sub.renewalInfoIOS.willAutoRenew ?? false,
              autoRenewPreference:
                sub.renewalInfoIOS.autoRenewPreference ?? null,
              pendingUpgradeProductId:
                sub.renewalInfoIOS.pendingUpgradeProductId ?? null,
              renewalDate: sub.renewalInfoIOS.renewalDate ?? null,
              expirationReason: sub.renewalInfoIOS.expirationReason ?? null,
              isInBillingRetry: sub.renewalInfoIOS.isInBillingRetry ?? null,
              gracePeriodExpirationDate:
                sub.renewalInfoIOS.gracePeriodExpirationDate ?? null,
              priceIncreaseStatus:
                sub.renewalInfoIOS.priceIncreaseStatus ?? null,
              renewalOfferType: sub.renewalInfoIOS.renewalOfferType ?? null,
              renewalOfferId: sub.renewalInfoIOS.renewalOfferId ?? null,
            }
          : null,
        // Android specific fields
        autoRenewingAndroid: sub.autoRenewingAndroid ?? null,
        basePlanIdAndroid: sub.basePlanIdAndroid ?? null,
        currentPlanId:
          sub.currentPlanId ?? (Platform.OS === 'ios' ? sub.productId : null),
        purchaseTokenAndroid: sub.purchaseTokenAndroid ?? null,
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('NotPrepared')) {
      RnIapConsole.error('IAP connection not initialized:', error);
      throw error;
    }
    RnIapConsole.error('Failed to get active subscriptions:', error);
    const parsedError = parseErrorStringToJsonObj(error);
    throw createPurchaseError({
      code: parsedError.code,
      message: parsedError.message,
      responseCode: parsedError.responseCode,
      debugMessage: parsedError.debugMessage,
    });
  }
};

/**
 * Check if the user has any active subscriptions (OpenIAP compliant)
 * Returns true if the user has at least one active subscription, false otherwise.
 * If subscriptionIds is provided, only checks for those specific subscriptions.
 *
 * @param subscriptionIds - Optional array of subscription IDs to check
 * @returns Promise<boolean> - True if there are active subscriptions
 *
 * @see {@link https://openiap.dev/docs/apis/has-active-subscriptions}
 */
export const hasActiveSubscriptions: QueryField<
  'hasActiveSubscriptions'
> = async (subscriptionIds) => {
  try {
    const activeSubscriptions = await getActiveSubscriptions(subscriptionIds);
    return activeSubscriptions.length > 0;
  } catch (error) {
    // If there's an error getting subscriptions, return false
    RnIapConsole.warn('Error checking active subscriptions:', error);
    return false;
  }
};

// Type conversion utilities
export {
  convertNitroProductToProduct,
  convertNitroPurchaseToPurchase,
  convertProductToProductSubscription,
  validateNitroProduct,
  validateNitroPurchase,
  checkTypeSynchronization,
} from './utils/type-bridge';

// Deprecated exports for backward compatibility
/**
 * @deprecated Use acknowledgePurchaseAndroid instead
 */
export const acknowledgePurchase = acknowledgePurchaseAndroid;

/**
 * @deprecated Use consumePurchaseAndroid instead
 */
export const consumePurchase = consumePurchaseAndroid;

// ============================================================================
// Internal Helpers
// ============================================================================

type NitroDiscountOfferRecord = NonNullable<
  NonNullable<NitroPurchaseRequest['ios']>['withOffer']
>;

const toDiscountOfferRecordIOS = (
  offer: DiscountOfferInputIOS | null | undefined,
): NitroDiscountOfferRecord | undefined => {
  if (!offer) {
    return undefined;
  }
  return {
    identifier: offer.identifier,
    keyIdentifier: offer.keyIdentifier,
    nonce: offer.nonce,
    signature: offer.signature,
    timestamp: String(offer.timestamp),
  };
};

const toNitroProductType = (
  type?: ProductTypeInput | ProductQueryType | null,
): 'inapp' | 'subs' | 'all' => {
  if (type === 'subs') {
    return 'subs';
  }
  if (type === 'all') {
    return 'all';
  }
  if (type === 'inapp') {
    RnIapConsole.warn(LEGACY_INAPP_WARNING);
    return 'inapp';
  }
  return 'inapp';
};

const isSubscriptionQuery = (type?: ProductQueryType | null): boolean =>
  type === 'subs';

const normalizeProductQueryType = (
  type?: ProductQueryType | string | null,
): ProductQueryType => {
  if (type === 'all' || type === 'subs' || type === 'in-app') {
    return type;
  }

  if (typeof type === 'string') {
    const normalized = type.trim().toLowerCase().replace(/_/g, '-');

    if (normalized === 'all') {
      return 'all';
    }
    if (normalized === 'subs') {
      return 'subs';
    }
    if (normalized === 'inapp') {
      RnIapConsole.warn(LEGACY_INAPP_WARNING);
      return 'in-app';
    }
    if (normalized === 'in-app') {
      return 'in-app';
    }
  }
  return 'in-app';
};

// ============================================================================
// ALTERNATIVE BILLING APIs
// ============================================================================

// ------------------------------
// Android Alternative Billing
// ------------------------------

/**
 * Check if alternative billing is available for this user/device (Android only).
 * Step 1 of alternative billing flow.
 *
 * @returns Promise<boolean> - true if available, false otherwise
 * @throws Error if billing client not ready
 * @platform Android
 *
 * @example
 * ```typescript
 * const isAvailable = await checkAlternativeBillingAvailabilityAndroid();
 * if (isAvailable) {
 *   // Proceed with alternative billing flow
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/check-alternative-billing-availability-android}
 */
export const checkAlternativeBillingAvailabilityAndroid: MutationField<
  'checkAlternativeBillingAvailabilityAndroid'
> = async () => {
  if (Platform.OS !== 'android') {
    throw new Error('Alternative billing is only supported on Android');
  }
  try {
    return await IAP.instance.checkAlternativeBillingAvailabilityAndroid();
  } catch (error) {
    RnIapConsole.error(
      'Failed to check alternative billing availability:',
      error,
    );
    throw error;
  }
};

/**
 * Show alternative billing information dialog to user (Android only).
 * Step 2 of alternative billing flow.
 * Must be called BEFORE processing payment in your payment system.
 *
 * @returns Promise<boolean> - true if user accepted, false if user canceled
 * @throws Error if billing client not ready
 * @platform Android
 *
 * @example
 * ```typescript
 * const userAccepted = await showAlternativeBillingDialogAndroid();
 * if (userAccepted) {
 *   // Process payment in your payment system
 *   const success = await processCustomPayment();
 *   if (success) {
 *     // Create reporting token
 *     const token = await createAlternativeBillingTokenAndroid();
 *     // Send token to your backend for Google Play reporting
 *   }
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/show-alternative-billing-dialog-android}
 */
export const showAlternativeBillingDialogAndroid: MutationField<
  'showAlternativeBillingDialogAndroid'
> = async () => {
  if (Platform.OS !== 'android') {
    throw new Error('Alternative billing is only supported on Android');
  }
  try {
    return await IAP.instance.showAlternativeBillingDialogAndroid();
  } catch (error) {
    RnIapConsole.error('Failed to show alternative billing dialog:', error);
    throw error;
  }
};

/**
 * Create external transaction token for Google Play reporting (Android only).
 * Step 3 of alternative billing flow.
 * Must be called AFTER successful payment in your payment system.
 * Token must be reported to Google Play backend within 24 hours.
 *
 * @param sku - Optional product SKU that was purchased
 * @returns Promise<string | null> - Token string or null if creation failed
 * @throws Error if billing client not ready
 * @platform Android
 *
 * @example
 * ```typescript
 * const token = await createAlternativeBillingTokenAndroid('premium_subscription');
 * if (token) {
 *   // Send token to your backend
 *   await fetch('/api/report-transaction', {
 *     method: 'POST',
 *     body: JSON.stringify({ token, sku: 'premium_subscription' })
 *   });
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/create-alternative-billing-token-android}
 */
export const createAlternativeBillingTokenAndroid: MutationField<
  'createAlternativeBillingTokenAndroid'
> = async (sku?: string) => {
  if (Platform.OS !== 'android') {
    throw new Error('Alternative billing is only supported on Android');
  }
  try {
    return await IAP.instance.createAlternativeBillingTokenAndroid(sku ?? null);
  } catch (error) {
    RnIapConsole.error('Failed to create alternative billing token:', error);
    throw error;
  }
};

/**
 * Enable a billing program before initConnection (Android only).
 * Must be called BEFORE initConnection() to configure the BillingClient.
 *
 * @param program - The billing program to enable (external-content-link or external-offer)
 * @platform Android
 * @since Google Play Billing Library 8.2.0+
 *
 * @example
 * ```typescript
 * // Enable external offers before connecting
 * enableBillingProgramAndroid('external-offer');
 * await initConnection();
 * ```
 */
export const enableBillingProgramAndroid = (
  program: BillingProgramAndroid,
): void => {
  if (Platform.OS !== 'android') {
    RnIapConsole.warn(
      'enableBillingProgramAndroid is only supported on Android',
    );
    return;
  }
  try {
    IAP.instance.enableBillingProgramAndroid(program);
  } catch (error) {
    RnIapConsole.error('Failed to enable billing program:', error);
  }
};

/**
 * Check if a billing program is available for this user/device (Android only).
 *
 * @param program - The billing program to check
 * @returns Promise with availability result
 * @platform Android
 * @since Google Play Billing Library 8.2.0+
 *
 * @example
 * ```typescript
 * const result = await isBillingProgramAvailableAndroid('external-offer');
 * if (result.isAvailable) {
 *   // External offers are available for this user
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/is-billing-program-available-android}
 */
export const isBillingProgramAvailableAndroid: MutationField<
  'isBillingProgramAvailableAndroid'
> = async (program) => {
  if (Platform.OS !== 'android') {
    throw new Error('Billing Programs API is only supported on Android');
  }
  try {
    const result = await IAP.instance.isBillingProgramAvailableAndroid(program);
    return {
      billingProgram: result.billingProgram as unknown as BillingProgramAndroid,
      isAvailable: result.isAvailable,
    };
  } catch (error) {
    RnIapConsole.error('Failed to check billing program availability:', error);
    throw error;
  }
};

/**
 * Create billing program reporting details for external transactions (Android only).
 * Used to get the external transaction token needed for reporting to Google.
 *
 * @param program - The billing program to create reporting details for
 * @returns Promise with reporting details including external transaction token
 * @platform Android
 * @since Google Play Billing Library 8.2.0+
 *
 * @example
 * ```typescript
 * const details = await createBillingProgramReportingDetailsAndroid('external-offer');
 * // Use details.externalTransactionToken to report the transaction
 * await fetch('/api/report-external-transaction', {
 *   method: 'POST',
 *   body: JSON.stringify({ token: details.externalTransactionToken })
 * });
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android}
 */
export const createBillingProgramReportingDetailsAndroid: MutationField<
  'createBillingProgramReportingDetailsAndroid'
> = async (program) => {
  if (Platform.OS !== 'android') {
    throw new Error('Billing Programs API is only supported on Android');
  }
  try {
    const result =
      await IAP.instance.createBillingProgramReportingDetailsAndroid(program);
    return {
      billingProgram: result.billingProgram as unknown as BillingProgramAndroid,
      externalTransactionToken: result.externalTransactionToken,
    };
  } catch (error) {
    RnIapConsole.error(
      'Failed to create billing program reporting details:',
      error,
    );
    throw error;
  }
};

/**
 * Launch external link for external offers or app download (Android only).
 *
 * @param params - Parameters for launching the external link
 * @returns Promise<boolean> - true if user accepted, false otherwise
 * @platform Android
 * @since Google Play Billing Library 8.2.0+
 *
 * @example
 * ```typescript
 * const success = await launchExternalLinkAndroid({
 *   billingProgram: 'external-offer',
 *   launchMode: 'launch-in-external-browser-or-app',
 *   linkType: 'link-to-digital-content-offer',
 *   linkUri: 'https://your-website.com/purchase'
 * });
 * if (success) {
 *   console.log('User accepted external link');
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/launch-external-link-android}
 */
export const launchExternalLinkAndroid: MutationField<
  'launchExternalLinkAndroid'
> = async (params) => {
  if (Platform.OS !== 'android') {
    throw new Error('Billing Programs API is only supported on Android');
  }
  try {
    return await IAP.instance.launchExternalLinkAndroid({
      billingProgram: params.billingProgram,
      launchMode: params.launchMode,
      linkType: params.linkType,
      linkUri: params.linkUri,
    });
  } catch (error) {
    RnIapConsole.error('Failed to launch external link:', error);
    throw error;
  }
};

// ------------------------------
// iOS External Purchase
// ------------------------------

/**
 * Check if the device can present an external purchase notice sheet (iOS 17.4+).
 *
 * Wraps `ExternalPurchase.canPresent`, which Apple introduced in iOS 17.4.
 * Note: the notice sheet itself (`presentExternalPurchaseNoticeSheetIOS`)
 * still requires iOS 18.2+; only the eligibility check is available earlier.
 *
 * @returns Promise<boolean> - true if notice sheet can be presented
 * @platform iOS
 *
 * @example
 * ```typescript
 * const canPresent = await canPresentExternalPurchaseNoticeIOS();
 * if (canPresent) {
 *   // Present notice before external purchase
 *   const result = await presentExternalPurchaseNoticeSheetIOS();
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios}
 */
export const canPresentExternalPurchaseNoticeIOS: QueryField<
  'canPresentExternalPurchaseNoticeIOS'
> = async () => {
  if (Platform.OS !== 'ios') {
    return false;
  }
  try {
    return await IAP.instance.canPresentExternalPurchaseNoticeIOS();
  } catch (error) {
    RnIapConsole.error(
      'Failed to check external purchase notice availability:',
      error,
    );
    return false;
  }
};

/**
 * Present an external purchase notice sheet to inform users about external purchases (iOS 18.2+).
 * This must be called before opening an external purchase link.
 *
 * @returns Promise<ExternalPurchaseNoticeResultIOS> - Result with action and error if any
 * @platform iOS
 *
 * @example
 * ```typescript
 * const result = await presentExternalPurchaseNoticeSheetIOS();
 * if (result.result === 'continue') {
 *   // User chose to continue, open external purchase link
 *   await presentExternalPurchaseLinkIOS('https://your-website.com/purchase');
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios}
 */
export const presentExternalPurchaseNoticeSheetIOS =
  async (): Promise<ExternalPurchaseNoticeResultIOS> => {
    if (Platform.OS !== 'ios') {
      throw new Error('External purchase is only supported on iOS');
    }
    try {
      return await IAP.instance.presentExternalPurchaseNoticeSheetIOS();
    } catch (error) {
      RnIapConsole.error(
        'Failed to present external purchase notice sheet:',
        error,
      );
      throw error;
    }
  };

/**
 * Present an external purchase link to redirect users to your website (iOS 16.0+).
 *
 * @param url - The external purchase URL to open
 * @returns Promise<ExternalPurchaseLinkResultIOS> - Result with success status and error if any
 * @platform iOS
 *
 * @example
 * ```typescript
 * const result = await presentExternalPurchaseLinkIOS('https://your-website.com/purchase');
 * if (result.success) {
 *   console.log('User completed external purchase');
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/ios/present-external-purchase-link-ios}
 */
export const presentExternalPurchaseLinkIOS: MutationField<
  'presentExternalPurchaseLinkIOS'
> = async (url) => {
  if (Platform.OS !== 'ios') {
    throw new Error('External purchase is only supported on iOS');
  }
  try {
    return await IAP.instance.presentExternalPurchaseLinkIOS(url);
  } catch (error) {
    RnIapConsole.error('Failed to present external purchase link:', error);
    throw error;
  }
};

// ╔════════════════════════════════════════════════════════════════════════╗
// ║            EXTERNAL PURCHASE CUSTOM LINK (iOS 18.1+)                   ║
// ╚════════════════════════════════════════════════════════════════════════╝

/**
 * Check if app is eligible for ExternalPurchaseCustomLink API (iOS 18.1+).
 * Returns true if the app can use custom external purchase links.
 *
 * @returns Promise<boolean> - true if eligible
 * @platform iOS
 * @see https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/iseligible
 *
 * @example
 * ```typescript
 * const isEligible = await isEligibleForExternalPurchaseCustomLinkIOS();
 * if (isEligible) {
 *   // App can use custom external purchase links
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios}
 */
export const isEligibleForExternalPurchaseCustomLinkIOS =
  async (): Promise<boolean> => {
    if (Platform.OS !== 'ios') {
      return false;
    }
    try {
      return await IAP.instance.isEligibleForExternalPurchaseCustomLinkIOS();
    } catch (error) {
      RnIapConsole.error(
        'Failed to check external purchase custom link eligibility:',
        error,
      );
      return false;
    }
  };

/**
 * Get external purchase token for reporting to Apple (iOS 18.1+).
 * Use this token with Apple's External Purchase Server API to report transactions.
 *
 * @param tokenType - Token type: 'acquisition' (new customers) or 'services' (existing customers)
 * @returns Promise<ExternalPurchaseCustomLinkTokenResultIOS> - Result with token string or error
 * @platform iOS
 * @see https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)
 *
 * @example
 * ```typescript
 * // For new customer acquisition
 * const result = await getExternalPurchaseCustomLinkTokenIOS('acquisition');
 * if (result.token) {
 *   // Report token to Apple's External Purchase Server API
 *   await reportToApple(result.token);
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios}
 */
export const getExternalPurchaseCustomLinkTokenIOS = async (
  tokenType: ExternalPurchaseCustomLinkTokenTypeIOS,
): Promise<ExternalPurchaseCustomLinkTokenResultIOS> => {
  if (Platform.OS !== 'ios') {
    throw new Error(
      'External purchase custom link is only supported on iOS 18.1+',
    );
  }
  try {
    return await IAP.instance.getExternalPurchaseCustomLinkTokenIOS(tokenType);
  } catch (error) {
    RnIapConsole.error(
      'Failed to get external purchase custom link token:',
      error,
    );
    throw error;
  }
};

/**
 * Show ExternalPurchaseCustomLink notice sheet (iOS 18.1+).
 * Displays the system disclosure notice sheet for custom external purchase links.
 * Call this after a deliberate customer interaction before linking out to external purchases.
 *
 * @param noticeType - Notice type: 'browser' (external purchases displayed in browser)
 * @returns Promise<ExternalPurchaseCustomLinkNoticeResultIOS> - Result with continued status and error if any
 * @platform iOS
 * @see https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/shownotice(type:)
 *
 * @example
 * ```typescript
 * const result = await showExternalPurchaseCustomLinkNoticeIOS('browser');
 * if (result.continued) {
 *   // User agreed to continue to external purchase
 *   await Linking.openURL('https://your-store.com/checkout');
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios}
 */
export const showExternalPurchaseCustomLinkNoticeIOS = async (
  noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS,
): Promise<ExternalPurchaseCustomLinkNoticeResultIOS> => {
  if (Platform.OS !== 'ios') {
    throw new Error(
      'External purchase custom link is only supported on iOS 18.1+',
    );
  }
  try {
    return await IAP.instance.showExternalPurchaseCustomLinkNoticeIOS(
      noticeType,
    );
  } catch (error) {
    RnIapConsole.error(
      'Failed to show external purchase custom link notice:',
      error,
    );
    throw error;
  }
};
