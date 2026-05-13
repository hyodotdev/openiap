// External dependencies
import {Platform} from 'react-native';

// Internal modules
import ExpoIapModule, {getNativeModule} from './ExpoIapModule';
import {
  isProductIOS,
  validateReceiptIOS,
  deepLinkToSubscriptionsIOS,
  syncIOS,
} from './modules/ios';
import {
  isProductAndroid,
  validateReceiptAndroid,
  deepLinkToSubscriptionsAndroid,
} from './modules/android';
import {ExpoIapConsole} from './utils/debug';

// Types
import type {
  ActiveSubscription,
  AndroidSubscriptionOfferInput,
  DeepLinkOptions,
  DeveloperProvidedBillingDetailsAndroid,
  MutationField,
  MutationRequestPurchaseArgs,
  MutationValidateReceiptArgs,
  Product,
  ProductQueryType,
  ProductSubscription,
  Purchase,
  PurchaseOptions,
  PurchaseUpdatedListenerOptions,
  QueryField,
  RequestPurchasePropsByPlatforms,
  RequestPurchaseAndroidProps,
  RequestPurchaseIosProps,
  RequestSubscriptionPropsByPlatforms,
  RequestSubscriptionAndroidProps,
  RequestSubscriptionIosProps,
  UserChoiceBillingDetails,
} from './types';
import {ErrorCode} from './types';
import {createPurchaseError, type PurchaseError} from './utils/errorMapping';

// Export all types
export * from './types';
export * from './modules/android';
export * from './modules/ios';
export * from './onside';

// Get the native constant value
export enum OpenIapEvent {
  PurchaseUpdated = 'purchase-updated',
  PurchaseError = 'purchase-error',
  PromotedProductIOS = 'promoted-product-ios',
  UserChoiceBillingAndroid = 'user-choice-billing-android',
  /**
   * Fired when user selects developer billing in External Payments flow (Android 8.3.0+)
   * Only available in Japan. Contains externalTransactionToken for reporting.
   */
  DeveloperProvidedBillingAndroid = 'developer-provided-billing-android',
  /**
   * Fired when an active subscription enters a billing-issue state (cross-platform).
   * Unifies StoreKit 2 `Message.Reason.billingIssue` (iOS 18+) and Play Billing 8.1+
   * `Purchase.isSuspended`. NOT fired on the Meta Horizon flavor.
   */
  SubscriptionBillingIssue = 'subscription-billing-issue',
}

type ExpoIapEventPayloads = {
  [OpenIapEvent.PurchaseUpdated]: Purchase;
  [OpenIapEvent.PurchaseError]: PurchaseError;
  [OpenIapEvent.PromotedProductIOS]:
    | Product
    | string
    | {id?: string; productId?: string};
  [OpenIapEvent.UserChoiceBillingAndroid]: UserChoiceBillingDetails;
  [OpenIapEvent.DeveloperProvidedBillingAndroid]: DeveloperProvidedBillingDetailsAndroid;
  [OpenIapEvent.SubscriptionBillingIssue]: Purchase;
};

type ExpoIapEventListener<E extends OpenIapEvent> = (
  payload: ExpoIapEventPayloads[E],
) => void;

type ExpoIapEmitter = {
  addListener<E extends OpenIapEvent>(
    eventName: E,
    listener: ExpoIapEventListener<E>,
  ): {remove: () => void};
  removeListener<E extends OpenIapEvent>(
    eventName: E,
    listener: ExpoIapEventListener<E>,
  ): void;
};

type NativePurchaseUpdatedOptionsModule = {
  setPurchaseUpdatedListenerOptions?: (
    options?: PurchaseUpdatedListenerOptions | null,
  ) => Promise<void>;
};

// Use the raw native module for listener calls — JSI HostObjects require the
// real native module as `this` when calling addListener. Using a Proxy as
// `this` triggers "native state unsupported on Proxy" on New Architecture / Hermes.
// Resolved lazily so importing this module doesn't throw on unsupported platforms.
export const emitter: ExpoIapEmitter = {
  addListener(eventName, listener) {
    return getNativeModule().addListener(eventName, listener);
  },
  removeListener(eventName, listener) {
    return getNativeModule().removeListener(eventName, listener);
  },
};

let nonDedupingPurchaseUpdatedListenerCountIOS = 0;
const purchaseUpdatedDedupeHistoryLimitIOS = 512;
const purchaseUpdatedDedupeHistoryIOS = {
  ids: new Set<string>(),
  order: [] as string[],
};
let purchaseUpdatedDedupeGenerationIOS = 0;

type PurchaseUpdatedDedupeHistoryIOS = {
  ids: Set<string>;
  order: string[];
};

const purchaseUpdatedTransactionIdIOS = (purchase: Purchase) => {
  if (typeof purchase.id === 'string' && purchase.id.length > 0) {
    return purchase.id;
  }
  return null;
};

const rememberPurchaseUpdatedTransactionIOS = (
  transactionId: string,
  history: PurchaseUpdatedDedupeHistoryIOS,
) => {
  if (history.ids.has(transactionId)) {
    return;
  }

  history.ids.add(transactionId);
  history.order.push(transactionId);
  if (history.order.length > purchaseUpdatedDedupeHistoryLimitIOS) {
    const evicted = history.order.shift();
    if (evicted != null) {
      history.ids.delete(evicted);
    }
  }
};

const clearPurchaseUpdatedDedupeHistoryIOS = (
  history: PurchaseUpdatedDedupeHistoryIOS,
) => {
  history.ids.clear();
  history.order.length = 0;
};

const resetPurchaseUpdatedDedupeHistoryIOS = () => {
  clearPurchaseUpdatedDedupeHistoryIOS(purchaseUpdatedDedupeHistoryIOS);
  purchaseUpdatedDedupeGenerationIOS += 1;
};

const configurePurchaseUpdatedListenerOptionsIOS = (
  dedupeTransactionIOS: boolean,
) => {
  if (Platform.OS !== 'ios') return;

  const nativeModule = getNativeModule() as NativePurchaseUpdatedOptionsModule;
  const promise = nativeModule.setPurchaseUpdatedListenerOptions?.({
    dedupeTransactionIOS,
  });
  void promise?.catch((error: unknown) => {
    ExpoIapConsole.warn(
      'Failed to configure purchase updated listener options:',
      error,
    );
  });
};

/**
 * TODO(v3.1.0): Remove legacy 'inapp' alias once downstream apps migrate to 'in-app'.
 */
export type ProductTypeInput = ProductQueryType | 'inapp';

const normalizeProductType = (type?: ProductTypeInput) => {
  if (type === 'inapp') {
    ExpoIapConsole.warn(
      "'inapp' product type is deprecated and will be removed in v3.1.0. Use 'in-app' instead.",
    );
  }

  if (!type || type === 'inapp' || type === 'in-app') {
    return {
      canonical: 'in-app' as ProductQueryType,
      native: 'in-app' as const,
    };
  }
  if (type === 'subs') {
    return {
      canonical: 'subs' as ProductQueryType,
      native: 'subs' as const,
    };
  }
  if (type === 'all') {
    return {
      canonical: 'all' as ProductQueryType,
      native: 'all' as const,
    };
  }
  throw new Error(`Unsupported product type: ${type}`);
};

const normalizePurchasePlatform = (purchase: Purchase): Purchase => {
  const platform = purchase.platform;
  if (typeof platform !== 'string') {
    return purchase;
  }

  const lowered = platform.toLowerCase();
  if (lowered === platform || (lowered !== 'ios' && lowered !== 'android')) {
    return purchase;
  }

  return {...purchase, platform: lowered};
};

const normalizePurchaseArray = (purchases: Purchase[]): Purchase[] =>
  purchases.map((purchase) => normalizePurchasePlatform(purchase));

export const purchaseUpdatedListener = (
  listener: (event: Purchase) => void,
  options?: PurchaseUpdatedListenerOptions | null,
) => {
  const receiveDuplicateTransactionUpdatesIOS =
    Platform.OS === 'ios' && options?.dedupeTransactionIOS === false;
  const listenerDedupeHistoryIOS: PurchaseUpdatedDedupeHistoryIOS = {
    ids: new Set(purchaseUpdatedDedupeHistoryIOS.ids),
    order: [...purchaseUpdatedDedupeHistoryIOS.order],
  };
  let listenerDedupeGenerationIOS = purchaseUpdatedDedupeGenerationIOS;

  const wrappedListener = (event: Purchase) => {
    const normalized = normalizePurchasePlatform(event);
    if (Platform.OS === 'ios') {
      if (listenerDedupeGenerationIOS !== purchaseUpdatedDedupeGenerationIOS) {
        clearPurchaseUpdatedDedupeHistoryIOS(listenerDedupeHistoryIOS);
        listenerDedupeGenerationIOS = purchaseUpdatedDedupeGenerationIOS;
      }
      const transactionId = purchaseUpdatedTransactionIdIOS(normalized);
      if (transactionId != null) {
        const isDuplicateForListener =
          listenerDedupeHistoryIOS.ids.has(transactionId);
        rememberPurchaseUpdatedTransactionIOS(
          transactionId,
          listenerDedupeHistoryIOS,
        );
        rememberPurchaseUpdatedTransactionIOS(
          transactionId,
          purchaseUpdatedDedupeHistoryIOS,
        );
        if (!receiveDuplicateTransactionUpdatesIOS && isDuplicateForListener) {
          return;
        }
      }
    }
    listener(normalized);
  };
  const emitterSubscription = emitter.addListener(
    OpenIapEvent.PurchaseUpdated,
    wrappedListener,
  );

  if (!receiveDuplicateTransactionUpdatesIOS) {
    return emitterSubscription;
  }

  nonDedupingPurchaseUpdatedListenerCountIOS += 1;
  configurePurchaseUpdatedListenerOptionsIOS(false);
  let removed = false;

  return {
    remove: () => {
      if (removed) {
        return;
      }
      removed = true;
      try {
        emitterSubscription?.remove?.();
      } finally {
        nonDedupingPurchaseUpdatedListenerCountIOS = Math.max(
          0,
          nonDedupingPurchaseUpdatedListenerCountIOS - 1,
        );
        configurePurchaseUpdatedListenerOptionsIOS(
          nonDedupingPurchaseUpdatedListenerCountIOS === 0,
        );
      }
    },
  };
};

export const purchaseErrorListener = (
  listener: (error: PurchaseError) => void,
) => {
  const wrappedListener = (error: PurchaseError) => {
    listener(error);
  };
  const emitterSubscription = emitter.addListener(
    OpenIapEvent.PurchaseError,
    wrappedListener,
  );
  return emitterSubscription;
};

/**
 * iOS-only listener for App Store promoted product events.
 * This fires when a user taps on a promoted product in the App Store.
 *
 * @param listener - Callback function that receives the promoted product details
 * @returns EventSubscription that can be used to unsubscribe
 *
 * @example
 * ```typescript
 * const subscription = promotedProductListenerIOS((product) => {
 *   console.log('Promoted product:', product);
 *   // Handle the promoted product
 * });
 *
 * // Later, clean up
 * subscription.remove();
 * ```
 *
 * @platform iOS
 */
export const promotedProductListenerIOS = (
  listener: (product: Product) => void,
) => {
  if (Platform.OS !== 'ios') {
    ExpoIapConsole.warn(
      'promotedProductListenerIOS: This listener is only available on iOS',
    );
    return {remove: () => {}};
  }

  let deliveredProductId: string | undefined;
  const deliver = (product: Product) => {
    const productId =
      product.id ?? (product as Product & {productId?: string}).productId;
    if (productId && productId === deliveredProductId) {
      return;
    }
    deliveredProductId = productId;
    listener(product);
  };

  const replayPendingProduct = () => {
    let pendingProduct: Promise<Product | null> | undefined;
    try {
      pendingProduct = ExpoIapModule.getPromotedProductIOS() as
        | Promise<Product | null>
        | undefined;
    } catch {
      return Promise.resolve();
    }

    if (!pendingProduct || typeof pendingProduct.then !== 'function') {
      return Promise.resolve();
    }

    return pendingProduct
      .then((product: Product | null) => {
        if (product) {
          deliver(product);
        }
      })
      .catch(() => {});
  };

  const subscription = emitter.addListener(
    OpenIapEvent.PromotedProductIOS,
    (payload) => {
      if (typeof payload === 'string') {
        void replayPendingProduct();
        return;
      }

      deliver(payload as Product);
    },
  );

  void replayPendingProduct();

  return subscription;
};

/**
 * Android-only listener for User Choice Billing events.
 * This fires when a user selects alternative billing instead of Google Play billing
 * in the User Choice Billing dialog (only in 'user-choice' mode).
 *
 * @param listener - Callback function that receives the external transaction token and product IDs
 * @returns EventSubscription that can be used to unsubscribe
 *
 * @example
 * ```typescript
 * const subscription = userChoiceBillingListenerAndroid((details) => {
 *   console.log('User selected alternative billing');
 *   console.log('Token:', details.externalTransactionToken);
 *   console.log('Products:', details.products);
 *
 *   // Process payment in your system, then report token to Google
 *   await processPaymentAndReportToken(details);
 * });
 *
 * // Later, clean up
 * subscription.remove();
 * ```
 *
 * @platform Android
 */
export const userChoiceBillingListenerAndroid = (
  listener: (details: UserChoiceBillingDetails) => void,
) => {
  if (Platform.OS !== 'android') {
    ExpoIapConsole.warn(
      'userChoiceBillingListenerAndroid: This listener is only available on Android',
    );
    return {remove: () => {}};
  }
  return emitter.addListener(OpenIapEvent.UserChoiceBillingAndroid, listener);
};

/**
 * Android-only listener for Developer Provided Billing events (External Payments).
 * This fires when a user selects the developer's payment option in the External Payments
 * side-by-side choice dialog during purchase flow.
 *
 * Requires Google Play Billing Library 8.3.0+ and is currently only available in Japan.
 *
 * @param listener - Callback function that receives the external transaction token
 * @returns EventSubscription that can be used to unsubscribe
 *
 * @example
 * ```typescript
 * const subscription = developerProvidedBillingListenerAndroid(async (details) => {
 *   console.log('User selected developer billing');
 *   console.log('Token:', details.externalTransactionToken);
 *
 *   // Process payment with your payment gateway
 *   await processPaymentWithYourGateway(details.externalTransactionToken);
 *
 *   // IMPORTANT: Report the token to Google Play within 24 hours
 *   await reportExternalTransactionToGoogle(details.externalTransactionToken);
 * });
 *
 * // Later, clean up
 * subscription.remove();
 * ```
 *
 * @platform Android (8.3.0+, Japan only)
 */
export const developerProvidedBillingListenerAndroid = (
  listener: (details: DeveloperProvidedBillingDetailsAndroid) => void,
) => {
  if (Platform.OS !== 'android') {
    ExpoIapConsole.warn(
      'developerProvidedBillingListenerAndroid: This listener is only available on Android',
    );
    return {remove: () => {}};
  }
  return emitter.addListener(
    OpenIapEvent.DeveloperProvidedBillingAndroid,
    listener,
  );
};

/**
 * Listen for subscription billing-issue events (cross-platform).
 *
 * Fires when a user's active subscription enters a state that needs attention
 * for a payment problem. Unifies:
 * - iOS 18+ / Mac Catalyst 18+: StoreKit 2 `Message.Reason.billingIssue`.
 * - Android (Play Billing 8.1+): when `Purchase.isSuspendedAndroid === true`.
 * - Meta Horizon / iOS 17 / older platforms: never fires.
 *
 * Recommended UX: call `deepLinkToSubscriptions()` when this fires so the user
 * can update their payment method in the platform subscription center.
 *
 * @example
 * ```typescript
 * const subscription = subscriptionBillingIssueListener((purchase) => {
 *   console.warn('Needs attention:', purchase.productId);
 *   deepLinkToSubscriptions({
 *     skuAndroid: purchase.productId,
 *     packageNameAndroid: 'com.example.app',
 *   });
 * });
 * ```
 */
export const subscriptionBillingIssueListener = (
  listener: (purchase: Purchase) => void,
) => {
  // Mirror purchaseUpdatedListener's platform normalization so consumers get
  // a consistent payload regardless of native casing.
  const wrappedListener = (event: Purchase) => {
    listener(normalizePurchasePlatform(event));
  };
  return emitter.addListener(
    OpenIapEvent.SubscriptionBillingIssue,
    wrappedListener,
  );
};

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
 * @see {@link https://www.openiap.dev/docs/apis/init-connection}
 */
export const initConnection: MutationField<'initConnection'> = async (config) =>
  ExpoIapModule.initConnection(config ?? null);

/**
 * Close the store connection and release resources.
 *
 * @see {@link https://www.openiap.dev/docs/apis/end-connection}
 */
export const endConnection: MutationField<'endConnection'> = async () => {
  const result = await ExpoIapModule.endConnection();
  if (result === true && Platform.OS === 'ios') {
    resetPurchaseUpdatedDedupeHistoryIOS();
  }
  return result;
};

/**
 * Retrieve products or subscriptions from the store by SKU.
 *
 * @param request `ProductRequest` — `skus` (string[]) and optional `type`
 *   (`'in-app' | 'subs' | 'all'`, defaults to `'in-app'`).
 * @returns Promise resolving to a `FetchProductsResult` union — `Product[]` for `'in-app'`,
 *   `ProductSubscription[]` for `'subs'`, or a mixed array for `'all'`.
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
 * @see {@link https://www.openiap.dev/docs/apis/fetch-products}
 */
export const fetchProducts: QueryField<'fetchProducts'> = async (request) => {
  ExpoIapConsole.debug('fetchProducts called with:', request);
  const {skus, type} = request ?? {};

  if (!Array.isArray(skus) || skus.length === 0) {
    throw createPurchaseError({
      message: 'No SKUs provided',
      code: ErrorCode.EmptySkuList,
    });
  }

  const {canonical, native} = normalizeProductType(
    type as ProductTypeInput | undefined,
  );
  const skuSet = new Set(skus);

  const filterIosItems = (
    items: unknown[],
  ): (Product | ProductSubscription)[] =>
    items.filter((item): item is Product | ProductSubscription => {
      if (!isProductIOS(item)) {
        return false;
      }
      const candidate = item as Product | ProductSubscription;
      return typeof candidate.id === 'string' && skuSet.has(candidate.id);
    });

  const filterAndroidItems = (
    items: unknown[],
  ): (Product | ProductSubscription)[] =>
    items.filter((item): item is Product | ProductSubscription => {
      if (!isProductAndroid(item)) {
        return false;
      }
      const candidate = item as Product | ProductSubscription;
      return typeof candidate.id === 'string' && skuSet.has(candidate.id);
    });

  const castResult = (
    items: (Product | ProductSubscription)[],
  ):
    | (Product | ProductSubscription)[]
    | Product[]
    | ProductSubscription[]
    | null => {
    if (canonical === 'in-app') {
      return items as Product[];
    }
    if (canonical === 'subs') {
      return items as ProductSubscription[];
    }
    // For 'all' type, items contain both Product and ProductSubscription
    // Return as ProductOrSubscription[] to preserve discriminated union
    return items;
  };

  if (Platform.OS === 'ios') {
    const rawItems = await ExpoIapModule.fetchProducts({skus, type: native});
    return castResult(filterIosItems(rawItems));
  }

  if (Platform.OS === 'android') {
    const rawItems = await ExpoIapModule.fetchProducts(native, skus);
    return castResult(filterAndroidItems(rawItems));
  }

  throw new Error('Unsupported platform');
};

/**
 * List the user's unfinished purchases — non-consumables, active subscriptions, and any
 * pending transactions not yet finished.
 *
 * @param options Optional `PurchaseOptions`. iOS-only flags:
 *   `alsoPublishToEventListenerIOS`, `onlyIncludeActiveItemsIOS`.
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
 * @see {@link https://www.openiap.dev/docs/apis/get-available-purchases}
 */
export const getAvailablePurchases: QueryField<
  'getAvailablePurchases'
> = async (options) => {
  const normalizedOptions: PurchaseOptions = {
    alsoPublishToEventListenerIOS:
      options?.alsoPublishToEventListenerIOS ?? false,
    onlyIncludeActiveItemsIOS: options?.onlyIncludeActiveItemsIOS ?? true,
    includeSuspendedAndroid: options?.includeSuspendedAndroid ?? false,
  };

  const resolvePurchases: () => Promise<Purchase[]> =
    Platform.select({
      ios: () =>
        ExpoIapModule.getAvailableItems(
          normalizedOptions.alsoPublishToEventListenerIOS,
          normalizedOptions.onlyIncludeActiveItemsIOS,
        ) as Promise<Purchase[]>,
      android: () =>
        ExpoIapModule.getAvailableItems(normalizedOptions) as Promise<
          Purchase[]
        >,
    }) ?? (() => Promise.resolve([] as Purchase[]));

  const purchases = await resolvePurchases();
  return normalizePurchaseArray(purchases as Purchase[]);
};

/**
 * Get all active subscriptions with detailed information.
 * Uses native OpenIAP module for accurate subscription status and renewal info.
 *
 * On iOS: Returns subscriptions with renewalInfoIOS containing pendingUpgradeProductId,
 * willAutoRenew, autoRenewPreference, and other renewal details.
 *
 * On Android: Filters available purchases to find active subscriptions (fallback implementation).
 *
 * @param subscriptionIds - Optional array of subscription product IDs to filter. If not provided, returns all active subscriptions.
 * @returns Promise resolving to array of active subscriptions with details
 *
 * @example
 * ```typescript
 * // Get all active subscriptions
 * const subs = await getActiveSubscriptions();
 *
 * // Get specific subscriptions
 * const premiumSubs = await getActiveSubscriptions(['premium', 'premium_year']);
 *
 * // Check for pending upgrades (iOS)
 * subs.forEach(sub => {
 *   if (sub.renewalInfoIOS?.pendingUpgradeProductId) {
 *     console.log(`Upgrade pending to: ${sub.renewalInfoIOS.pendingUpgradeProductId}`);
 *   }
 * });
 * ```
 *
 * @see {@link https://www.openiap.dev/docs/apis/get-active-subscriptions}
 */
export const getActiveSubscriptions: QueryField<
  'getActiveSubscriptions'
> = async (subscriptionIds) => {
  const result = await ExpoIapModule.getActiveSubscriptions(
    subscriptionIds ?? null,
  );
  return (result ?? []) as ActiveSubscription[];
};

/**
 * Check if user has any active subscriptions.
 *
 * @param subscriptionIds - Optional array of subscription product IDs to check. If not provided, checks all subscriptions.
 * @returns Promise resolving to true if user has at least one active subscription
 *
 * @example
 * ```typescript
 * // Check any active subscription
 * const hasAny = await hasActiveSubscriptions();
 *
 * // Check specific subscriptions
 * const hasPremium = await hasActiveSubscriptions(['premium', 'premium_year']);
 * ```
 *
 * @see {@link https://www.openiap.dev/docs/apis/has-active-subscriptions}
 */
export const hasActiveSubscriptions: QueryField<
  'hasActiveSubscriptions'
> = async (subscriptionIds) => {
  return !!(await ExpoIapModule.hasActiveSubscriptions(
    subscriptionIds ?? null,
  ));
};

/**
 * Return the user's storefront country code.
 *
 * @see {@link https://www.openiap.dev/docs/apis/get-storefront}
 */
export const getStorefront: QueryField<'getStorefront'> = async () => {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return '';
  }
  return ExpoIapModule.getStorefront();
};

/**
 * Helper to normalize request props to platform-specific format
 */
function normalizeRequestProps(
  request: RequestPurchasePropsByPlatforms,
  platform: 'ios',
): RequestPurchaseIosProps | null | undefined;
function normalizeRequestProps(
  request: RequestPurchasePropsByPlatforms,
  platform: 'android',
): RequestPurchaseAndroidProps | null | undefined;
function normalizeRequestProps(
  request: RequestSubscriptionPropsByPlatforms,
  platform: 'ios',
): RequestSubscriptionIosProps | null | undefined;
function normalizeRequestProps(
  request: RequestSubscriptionPropsByPlatforms,
  platform: 'android',
): RequestSubscriptionAndroidProps | null | undefined;
function normalizeRequestProps(
  request:
    | RequestPurchasePropsByPlatforms
    | RequestSubscriptionPropsByPlatforms,
  platform: 'ios' | 'android',
) {
  // Support both new (apple/google) and legacy (ios/android) field names
  // New fields take precedence over deprecated ones
  if (platform === 'ios') {
    return request.apple ?? request.ios;
  }
  return request.google ?? request.android;
}

/**
 * Initiate a purchase or subscription flow. The result is delivered through
 * `purchaseUpdatedListener` — NOT the return value.
 *
 * @param args `RequestPurchaseProps`, discriminated by `type`:
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
 * @see {@link https://www.openiap.dev/docs/apis/request-purchase}
 */
export const requestPurchase: MutationField<'requestPurchase'> = async (
  args,
) => {
  const {request, type} = args;
  const {canonical, native} = normalizeProductType(type as ProductTypeInput);
  const isInAppPurchase = canonical === 'in-app';

  if (Platform.OS === 'ios') {
    const normalizedRequest = normalizeRequestProps(request, 'ios');

    if (!normalizedRequest?.sku) {
      throw new Error(
        'Invalid request for Apple. The `sku` property is required and must be a string.\n\n' +
          'Expected format:\n' +
          '  requestPurchase({\n' +
          '    request: {\n' +
          '      apple: { sku: "product_id" },\n' +
          '      google: { skus: ["product_id"] }\n' +
          '    },\n' +
          '    type: "in-app"\n' +
          '  })\n\n' +
          'See: https://hyochan.github.io/expo-iap/docs/api/methods/core-methods#requestpurchase',
      );
    }

    if (canonical !== 'in-app' && canonical !== 'subs') {
      throw new Error(`Unsupported product type: ${canonical}`);
    }

    const payload: MutationRequestPurchaseArgs = {
      type: canonical === 'in-app' ? 'in-app' : 'subs',
      request: {ios: normalizedRequest},
      useAlternativeBilling: args.useAlternativeBilling,
    };

    const purchase = (await ExpoIapModule.requestPurchase(payload)) as
      | Purchase
      | Purchase[]
      | null;

    if (Array.isArray(purchase)) {
      return normalizePurchaseArray(purchase);
    }

    if (purchase) {
      return normalizePurchasePlatform(purchase);
    }

    return canonical === 'subs' ? [] : null;
  }

  if (Platform.OS === 'android') {
    if (isInAppPurchase) {
      const normalizedRequest = normalizeRequestProps(
        request as RequestPurchasePropsByPlatforms,
        'android',
      ) as RequestPurchaseAndroidProps | null | undefined;

      if (!normalizedRequest?.skus?.length) {
        throw new Error(
          'Invalid request for Google. The `skus` property is required and must be a non-empty array.\n\n' +
            'Expected format:\n' +
            '  requestPurchase({\n' +
            '    request: {\n' +
            '      apple: { sku: "product_id" },\n' +
            '      google: { skus: ["product_id"] }\n' +
            '    },\n' +
            '    type: "in-app"\n' +
            '  })\n\n' +
            'See: https://hyochan.github.io/expo-iap/docs/api/methods/core-methods#requestpurchase',
        );
      }

      const {
        skus,
        obfuscatedAccountId,
        obfuscatedProfileId,
        isOfferPersonalized,
        offerToken,
      } = normalizedRequest;

      const result = (await ExpoIapModule.requestPurchase({
        type: native,
        skuArr: skus,
        purchaseToken: undefined,
        replacementMode: -1,
        obfuscatedAccountId: obfuscatedAccountId,
        obfuscatedProfileId: obfuscatedProfileId,
        offerToken: offerToken,
        offerTokenArr: [],
        isOfferPersonalized: isOfferPersonalized ?? false,
      })) as Purchase[];

      return normalizePurchaseArray(result);
    }

    if (canonical === 'subs') {
      const normalizedRequest = normalizeRequestProps(
        request as RequestSubscriptionPropsByPlatforms,
        'android',
      ) as RequestSubscriptionAndroidProps | null | undefined;

      if (!normalizedRequest?.skus?.length) {
        throw new Error(
          'Invalid request for Google. The `skus` property is required and must be a non-empty array.\n\n' +
            'Expected format:\n' +
            '  requestPurchase({\n' +
            '    request: {\n' +
            '      apple: { sku: "subscription_id" },\n' +
            '      google: { skus: ["subscription_id"] }\n' +
            '    },\n' +
            '    type: "subs"\n' +
            '  })\n\n' +
            'See: https://hyochan.github.io/expo-iap/docs/api/methods/core-methods#requestpurchase',
        );
      }

      const {
        skus,
        obfuscatedAccountId,
        obfuscatedProfileId,
        isOfferPersonalized,
        subscriptionOffers,
        replacementMode: replacementModeInput,
        purchaseToken: purchaseTokenInput,
        subscriptionProductReplacementParams,
      } = normalizedRequest;

      const normalizedOffers = subscriptionOffers ?? [];
      const replacementMode = replacementModeInput ?? -1;
      const purchaseToken = purchaseTokenInput ?? undefined;

      const result = (await ExpoIapModule.requestPurchase({
        type: native,
        skuArr: skus,
        purchaseToken,
        replacementMode,
        obfuscatedAccountId: obfuscatedAccountId,
        obfuscatedProfileId: obfuscatedProfileId,
        offerTokenArr: normalizedOffers.map(
          (offer: AndroidSubscriptionOfferInput) => offer.offerToken,
        ),
        subscriptionOffers: normalizedOffers,
        isOfferPersonalized: isOfferPersonalized ?? false,
        subscriptionProductReplacementParams:
          subscriptionProductReplacementParams ?? undefined,
      })) as Purchase[];

      return normalizePurchaseArray(result);
    }

    throw new Error(
      "Invalid request for Android: Expected a valid request object with 'skus' array.",
    );
  }

  throw new Error('Platform not supported');
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
 * // Inside purchaseUpdatedListener:
 * if (await verifyOnServer(purchase)) {
 *   await finishTransaction({ purchase, isConsumable: false });
 * }
 * ```
 *
 * @remarks **Critical:** Android purchases must be finalized within 3 days or Google
 *   auto-refunds. iOS unfinished transactions replay on every app launch.
 *
 * @see {@link https://www.openiap.dev/docs/apis/finish-transaction}
 */
export const finishTransaction: MutationField<'finishTransaction'> = async ({
  purchase,
  isConsumable = false,
}) => {
  if (Platform.OS === 'ios') {
    await ExpoIapModule.finishTransaction(purchase, isConsumable);
    return;
  }

  if (Platform.OS === 'android') {
    const token = purchase.purchaseToken ?? undefined;

    if (!token) {
      throw createPurchaseError({
        message: 'Purchase token is required to finish transaction',
        code: ErrorCode.DeveloperError,
        productId: purchase.productId,
        platform: 'android',
      });
    }

    if (isConsumable) {
      await ExpoIapModule.consumePurchaseAndroid(token);
      return;
    }

    await ExpoIapModule.acknowledgePurchaseAndroid(token);
    return;
  }

  throw new Error('Unsupported Platform');
};

/**
 * Restore completed transactions (cross-platform behavior)
 *
 * - iOS: perform a lightweight sync to refresh transactions and ignore sync errors,
 *   then fetch available purchases to surface restored items to the app.
 * - Android: simply fetch available purchases (restoration happens via query).
 *
 * This helper triggers the refresh flows but does not return the purchases; consumers should
 * call `getAvailablePurchases` or rely on hook state to inspect the latest items.
 *
 * @see {@link https://www.openiap.dev/docs/apis/restore-purchases}
 */
export const restorePurchases: MutationField<'restorePurchases'> = async () => {
  if (Platform.OS === 'ios') {
    await syncIOS().catch(() => undefined);
  }

  await getAvailablePurchases({
    alsoPublishToEventListenerIOS: false,
    onlyIncludeActiveItemsIOS: true,
  });
};

/**
 * Deeplinks to native interface that allows users to manage their subscriptions
 * @param options.skuAndroid - Required for Android to locate specific subscription (ignored on iOS)
 * @param options.packageNameAndroid - Required for Android to identify your app (ignored on iOS)
 *
 * @returns Promise that resolves when the deep link is successfully opened
 *
 * @throws {Error} When called on unsupported platform or when required Android parameters are missing
 *
 * @example
 * import { deepLinkToSubscriptions } from 'expo-iap';
 *
 * // Works on both iOS and Android
 * await deepLinkToSubscriptions({
 *   skuAndroid: 'your_subscription_sku',
 *   packageNameAndroid: 'com.example.app'
 * });
 *
 * @see {@link https://www.openiap.dev/docs/apis/deep-link-to-subscriptions}
 */
export const deepLinkToSubscriptions: MutationField<
  'deepLinkToSubscriptions'
> = async (options) => {
  if (Platform.OS === 'ios') {
    await deepLinkToSubscriptionsIOS();
    return;
  }

  if (Platform.OS === 'android') {
    await deepLinkToSubscriptionsAndroid((options as DeepLinkOptions) ?? null);
    return;
  }

  throw new Error(`Unsupported platform: ${Platform.OS}`);
};

/**
 * Internal receipt validation function (NOT RECOMMENDED for production use)
 *
 * WARNING: This function performs client-side validation which is NOT secure.
 * For production apps, always validate receipts on your secure server:
 * - iOS: Send receipt data to Apple's verification endpoint from your server
 * - Android: Use Google Play Developer API with service account credentials
 *
 * @deprecated Use verifyPurchase instead
 *
 * @see {@link https://www.openiap.dev/docs/apis/validate-receipt}
 */
export const validateReceipt: MutationField<'validateReceipt'> = async (
  options,
) => {
  const {apple, google} = options as MutationValidateReceiptArgs;

  if (Platform.OS === 'ios') {
    if (!apple?.sku) {
      throw new Error('iOS validation requires apple.sku');
    }
    return validateReceiptIOS({apple: {sku: apple.sku}});
  }

  if (Platform.OS === 'android') {
    if (
      !google ||
      !google.sku ||
      !google.packageName ||
      !google.purchaseToken ||
      !google.accessToken
    ) {
      throw new Error(
        'Android validation requires google.sku, google.packageName, google.purchaseToken, and google.accessToken',
      );
    }
    return validateReceiptAndroid({
      packageName: google.packageName,
      productId: google.sku,
      productToken: google.purchaseToken,
      accessToken: google.accessToken,
      isSub: google.isSub ?? undefined,
    });
  }

  throw new Error('Platform not supported');
};

/**
 * Verify purchase with the configured providers
 *
 * This function uses the native OpenIAP verifyPurchase implementation
 * which validates purchases using platform-specific methods.
 *
 * @param options - Receipt validation options containing the SKU
 * @returns Promise resolving to receipt validation result
 *
 * @see {@link https://www.openiap.dev/docs/features/validation#verify-purchase}
 */
export const verifyPurchase: MutationField<'verifyPurchase'> = async (
  options,
) => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return ExpoIapModule.verifyPurchase(options);
  }

  throw new Error(`Unsupported platform: ${Platform.OS}`);
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
 *     apple: {
 *       jws: purchase.purchaseToken // JWS from purchase
 *     },
 *     google: {
 *       purchaseToken: purchase.purchaseToken
 *     }
 *   }
 * });
 * ```
 *
 * @see {@link https://www.openiap.dev/docs/features/validation#verify-purchase-with-provider}
 */
export const verifyPurchaseWithProvider: MutationField<
  'verifyPurchaseWithProvider'
> = async (options) => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    // Auto-fill apiKey from config if not provided and provider is iapkit
    if (
      options.provider === 'iapkit' &&
      options.iapkit &&
      !options.iapkit.apiKey
    ) {
      try {
        // Dynamically import expo-constants to avoid hard dependency
        const {default: Constants} = await import('expo-constants');
        const configApiKey = Constants.expoConfig?.extra?.iapkitApiKey;
        if (configApiKey) {
          options = {
            ...options,
            iapkit: {
              ...options.iapkit,
              apiKey: configApiKey,
            },
          };
        }
      } catch {
        throw new Error(
          'expo-constants is required for auto-filling iapkitApiKey from config. ' +
            'Please install it: npx expo install expo-constants\n' +
            'Or provide apiKey directly in verifyPurchaseWithProvider options.',
        );
      }
    }
    return ExpoIapModule.verifyPurchaseWithProvider(options);
  }

  throw new Error(`Unsupported platform: ${Platform.OS}`);
};

export * from './useIAP';
export {useWebhookEvents} from './useWebhookEvents';
export type {
  UseWebhookEventsOptions,
  UseWebhookEventsResult,
} from './useWebhookEvents';
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
export {
  ErrorCodeUtils,
  ErrorCodeMapping,
  createPurchaseError,
  createPurchaseErrorFromPlatform,
} from './utils/errorMapping';
export type {
  PurchaseError as ExpoPurchaseError,
  PurchaseErrorProps,
} from './utils/errorMapping';
export {ExpoIapConsole} from './utils/debug';
