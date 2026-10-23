// External dependencies
import {Platform} from 'react-native';

// Internal modules
import ExpoIapModule, {getNativeModule} from './ExpoIapModule';
import {isVegaOS} from './vega';
import {
  deepLinkToSubscriptionsIOS,
  getPendingTransactionsIOS,
  isProductIOS,
} from './modules/ios';
import {
  createIapkitConfirmation,
  type IapkitConfirmationOptions,
  type PurchaseConfirmation,
  type PurchaseFlow,
  type PurchaseFlowOptions,
  type PurchaseFlowPurchase,
} from './purchase-flow';
import {
  clearRequested,
  createSdkPurchaseFlow,
  markRequested,
  type PurchaseFlowSdk,
  type SdkPurchaseFlowOptions,
} from './utils/purchaseFlowBinding';
import {
  isProductAndroid,
  deepLinkToSubscriptionsAndroid,
} from './modules/android';
import {ExpoIapConsole} from './utils/debug';
import {showFirstPurchaseNotice} from './utils/firstPurchaseNotice';
import {restorePurchasesNative} from './utils/restorePurchases';
import {
  decodeAndroidPurchases,
  decodeApplePurchases,
} from './utils/availablePurchases';

// Types
import type {
  ActiveSubscription,
  DeepLinkOptions,
  DeveloperProvidedBillingDetailsAndroid,
  IapPlatform,
  MutationField,
  MutationRequestPurchaseArgs,
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
import {ErrorCode, resolveStoreId} from './types';
import {
  createPurchaseError,
  normalizeErrorCodeFromNative,
  type PurchaseError,
} from './utils/errorMapping';
import {
  createPurchaseErrorFromNativeException,
  invokeNativeWithPurchaseError,
} from './utils/nativeError';

export * from './types';
export * from './modules/android';
export * from './modules/ios';
export * from './onside';
export * from './vega';

export enum OpenIapEvent {
  PurchaseUpdated = 'purchase-updated',
  PurchaseError = 'purchase-error',
  PromotedProductIOS = 'promoted-product-ios',
  UserChoiceBillingAndroid = 'user-choice-billing-android',
  /**
   * Fired for External Payments (8.3.0+) and Billing Choice (9.1.0+)
   * developer billing flows. Nullable fields depend on the selected flow.
   */
  DeveloperProvidedBillingAndroid = 'developer-provided-billing-android',
  /** Fired when a subscription enters a billing-issue state; see `subscriptionBillingIssueListener`. */
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

const isStorePlatform = (): boolean =>
  Platform.OS === 'ios' || Platform.OS === 'android';

const isStoreRuntime = (): boolean =>
  Platform.OS === 'ios' || isAndroidStoreRuntime();

const unsupportedPlatformError = (): Error =>
  new Error(`Unsupported platform: ${Platform.OS}`);

// Platform tag for PurchaseErrors built from native rejections.
const nativePlatform = (): IapPlatform =>
  Platform.OS === 'ios' ? 'ios' : 'android';

// Listener calls go to the raw native module (see getNativeModule), resolved
// lazily so importing this module doesn't throw on unsupported platforms.
export const emitter: ExpoIapEmitter = {
  addListener(eventName, listener) {
    const nativeModule = getNativeModule();
    const nativeSubscription = nativeModule.addListener(eventName, listener);
    let removed = false;

    return {
      remove: () => {
        if (removed) {
          return;
        }
        removed = true;

        if (typeof nativeSubscription?.remove === 'function') {
          nativeSubscription.remove();
          return;
        }

        nativeModule.removeListener?.(eventName, listener);
      },
    };
  },
  removeListener(eventName, listener) {
    return getNativeModule().removeListener?.(eventName, listener);
  },
};

let nonDedupingPurchaseUpdatedListenerCountIOS = 0;
const purchaseUpdatedDedupeHistoryLimitIOS = 512;
const purchaseUpdatedDedupeHistoryIOS = {
  ids: new Set<string>(),
  order: [] as string[],
  start: 0,
};
let purchaseUpdatedDedupeGenerationIOS = 0;

type PurchaseUpdatedDedupeHistoryIOS = {
  ids: Set<string>;
  order: string[];
  start: number;
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
  if (
    history.order.length - history.start >
    purchaseUpdatedDedupeHistoryLimitIOS
  ) {
    const evicted = history.order[history.start];
    history.start += 1;
    if (evicted != null) {
      history.ids.delete(evicted);
    }
    if (history.start > 128 && history.start * 2 > history.order.length) {
      history.order = history.order.slice(history.start);
      history.start = 0;
    }
  }
};

const clearPurchaseUpdatedDedupeHistoryIOS = (
  history: PurchaseUpdatedDedupeHistoryIOS,
) => {
  history.ids.clear();
  history.order.length = 0;
  history.start = 0;
};

const resetPurchaseUpdatedDedupeHistoryIOS = () => {
  clearPurchaseUpdatedDedupeHistoryIOS(purchaseUpdatedDedupeHistoryIOS);
  purchaseUpdatedDedupeGenerationIOS += 1;
};

const configurePurchaseUpdatedListenerOptionsIOS = (
  dedupeTransactionIOS: boolean,
) => {
  if (Platform.OS !== 'ios') return;

  const promise = getNativeModule().setPurchaseUpdatedListenerOptions?.({
    dedupeTransactionIOS,
  });
  void promise?.catch((error: unknown) => {
    ExpoIapConsole.warn(
      'Failed to configure purchase updated listener options:',
      error,
    );
  });
};

export type ProductTypeInput = ProductQueryType;

const normalizeProductType = (type?: ProductTypeInput) => {
  if (!type || type === 'in-app') {
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

const isAndroidStoreRuntime = (): boolean => {
  return Platform.OS === 'android' || isVegaOS();
};

export const purchaseUpdatedListener = (
  listener: (event: Purchase) => void,
  options?: PurchaseUpdatedListenerOptions | null,
) => {
  const receiveDuplicateTransactionUpdatesIOS =
    Platform.OS === 'ios' && options?.dedupeTransactionIOS === false;
  const listenerDedupeHistoryIOS: PurchaseUpdatedDedupeHistoryIOS = {
    ids: new Set(purchaseUpdatedDedupeHistoryIOS.ids),
    order: purchaseUpdatedDedupeHistoryIOS.order.slice(
      purchaseUpdatedDedupeHistoryIOS.start,
    ),
    start: 0,
  };
  let listenerDedupeGenerationIOS = purchaseUpdatedDedupeGenerationIOS;

  const wrappedListener = (event: Purchase) => {
    const normalized = event;
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
  // Native events may carry codes outside ErrorCode; deliver canonical codes.
  const wrappedListener = (error: PurchaseError) => {
    listener({...error, code: normalizeErrorCodeFromNative(error.code)});
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
 *   console.log('External transaction token received; send it to your backend without logging it.');
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
 * Android-only listener for Developer Provided Billing events.
 * This fires when a user selects the developer's option in an External Payments
 * or Billing Choice purchase flow.
 *
 * @param listener - Callback that receives selected products and flow details
 * @returns EventSubscription that can be used to unsubscribe
 *
 * @example
 * ```typescript
 * const subscription = developerProvidedBillingListenerAndroid(async (details) => {
 *   await processPaymentWithYourGateway(details.products, details.linkUri);
 *   if (details.externalTransactionToken) {
 *     await reportExternalTransactionToGoogle(details.externalTransactionToken);
 *   }
 * });
 *
 * // Later, clean up
 * subscription.remove();
 * ```
 *
 * @platform Android (Play Billing Library 8.3.0+; Billing Choice 9.1.0+)
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
 * - iOS / Mac Catalyst 16.4+ and visionOS 1.0+: StoreKit 2 `Message.Reason.billingIssue`.
 * - Android (Play Billing 8.1+): when `Purchase.isSuspendedAndroid === true`.
 * - Meta Horizon, Amazon, macOS, tvOS, watchOS, and iOS before 16.4: never fires.
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
  const wrappedListener = (event: Purchase) => {
    listener(event);
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
 *   Play Billing 8.2.0+) to opt into a billing program. For Billing Choice 9.1.0+, set
 *   `billingChoiceScreenTypeAndroid` to the renderer configured in Play Console.
 *   iOS ignores Android-specific fields.
 * @returns Promise resolving to `true` when the platform billing client is connected.
 * @throws When the platform billing client fails to initialize.
 *
 * @example
 * ```ts
 * await initConnection();
 * await initConnection({ enableBillingProgramAndroid: 'external-offer' });
 * await initConnection({
 *   enableBillingProgramAndroid: 'billing-choice',
 *   billingChoiceScreenTypeAndroid: 'developer-rendered',
 * });
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
  const result = await invokeNativeWithPurchaseError(
    () => ExpoIapModule.initConnection(config ?? null),
    nativePlatform(),
  );
  if (
    result === true &&
    Platform.OS === 'ios' &&
    nonDedupingPurchaseUpdatedListenerCountIOS > 0
  ) {
    configurePurchaseUpdatedListenerOptionsIOS(false);
  }
  return result;
};

/**
 * Close the store connection and release resources.
 *
 * @see {@link https://openiap.dev/docs/apis/end-connection}
 */
export const endConnection: MutationField<'endConnection'> = async () => {
  const result = await invokeNativeWithPurchaseError(
    () => ExpoIapModule.endConnection(),
    nativePlatform(),
  );
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
 *   network/store error). Unknown SKUs are omitted from the result, not thrown.
 *
 * @example
 * ```ts
 * const products = await fetchProducts({
 *   skus: ['com.app.coins_100', 'com.app.premium'],
 *   type: 'in-app',
 * });
 * ```
 *
 * @remarks Promise-based, unlike the event-based `request*` APIs such as `requestPurchase`.
 *
 * @see {@link https://openiap.dev/docs/apis/fetch-products}
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
    // 'all' mixes products and subscriptions; returned as-is to keep the discriminated union.
    return items;
  };

  if (Platform.OS === 'ios') {
    const rawItems = await invokeNativeWithPurchaseError<unknown[]>(
      () => ExpoIapModule.fetchProducts({skus, type: native}),
      'ios',
      {
        code: ErrorCode.QueryProduct,
        message: 'Failed to query products',
        productIds: skus,
        productType: canonical,
      },
    );
    return castResult(filterIosItems(rawItems));
  }

  if (isAndroidStoreRuntime()) {
    const rawItems = await invokeNativeWithPurchaseError<unknown[]>(
      () => ExpoIapModule.fetchProducts(native, skus),
      'android',
      {
        code: ErrorCode.QueryProduct,
        message: 'Failed to query products',
        productIds: skus,
        productType: canonical,
      },
    );
    return castResult(filterAndroidItems(rawItems));
  }

  throw unsupportedPlatformError();
};

/**
 * List the user's unfinished purchases: non-consumables, active subscriptions,
 * and pending transactions.
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
 * @see {@link https://openiap.dev/docs/apis/get-available-purchases}
 */
export const getAvailablePurchases: QueryField<
  'getAvailablePurchases'
> = async (options) => {
  const normalizedOptions = {
    alsoPublishToEventListenerIOS:
      options?.alsoPublishToEventListenerIOS ?? false,
    onlyIncludeActiveItemsIOS: options?.onlyIncludeActiveItemsIOS ?? true,
    includeSuspendedAndroid: options?.includeSuspendedAndroid ?? false,
  } satisfies PurchaseOptions;

  if (isVegaOS()) {
    const purchases = await ExpoIapModule.getAvailableItems(normalizedOptions);
    return decodeAndroidPurchases(purchases);
  }

  let purchases: Purchase[];

  if (Platform.OS === 'ios') {
    purchases = (await invokeNativeWithPurchaseError(
      () =>
        ExpoIapModule.getAvailableItems(
          normalizedOptions.alsoPublishToEventListenerIOS,
          normalizedOptions.onlyIncludeActiveItemsIOS,
        ),
      'ios',
    )) as Purchase[];
  } else if (Platform.OS === 'android') {
    purchases = (await invokeNativeWithPurchaseError(
      () => ExpoIapModule.getAvailableItems(normalizedOptions),
      'android',
    )) as Purchase[];
  } else {
    throw unsupportedPlatformError();
  }

  return Platform.OS === 'ios'
    ? decodeApplePurchases(purchases)
    : decodeAndroidPurchases(purchases);
};

/**
 * Get all active subscriptions. On iOS each entry carries `renewalInfoIOS`
 * (e.g. pendingUpgradeProductId, willAutoRenew, autoRenewPreference); on
 * Android they are filtered from the available purchases.
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
 * @see {@link https://openiap.dev/docs/apis/get-active-subscriptions}
 */
export const getActiveSubscriptions: QueryField<
  'getActiveSubscriptions'
> = async (subscriptionIds) => {
  if (!isStoreRuntime()) {
    throw unsupportedPlatformError();
  }

  const result = await invokeNativeWithPurchaseError(
    () => ExpoIapModule.getActiveSubscriptions(subscriptionIds ?? null),
    nativePlatform(),
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
 * @see {@link https://openiap.dev/docs/apis/has-active-subscriptions}
 */
export const hasActiveSubscriptions: QueryField<
  'hasActiveSubscriptions'
> = async (subscriptionIds) => {
  if (!isStoreRuntime()) {
    throw unsupportedPlatformError();
  }

  return !!(await invokeNativeWithPurchaseError(
    () => ExpoIapModule.hasActiveSubscriptions(subscriptionIds ?? null),
    nativePlatform(),
  ));
};

/**
 * Return the user's storefront country code.
 *
 * @see {@link https://openiap.dev/docs/apis/get-storefront}
 */
export const getStorefront: QueryField<'getStorefront'> = async () => {
  if (Platform.OS !== 'ios' && !isAndroidStoreRuntime()) {
    throw createPurchaseError({
      code: ErrorCode.FeatureNotSupported,
      message: `Storefront lookup is not supported on ${Platform.OS}.`,
    });
  }

  const platform = nativePlatform();
  if (typeof ExpoIapModule.getStorefront !== 'function') {
    throw createPurchaseError({
      code: ErrorCode.FeatureNotSupported,
      message: 'Native getStorefront is not available on this build.',
      platform,
    });
  }

  let storefront: unknown;
  try {
    storefront = await ExpoIapModule.getStorefront();
  } catch (error) {
    throw createPurchaseErrorFromNativeException(error, platform, {
      code: ErrorCode.ServiceError,
      message: 'Failed to get storefront.',
      debugMessage: error instanceof Error ? error.message : String(error),
    });
  }

  if (typeof storefront !== 'string' || storefront.trim().length === 0) {
    throw createPurchaseError({
      code: ErrorCode.ServiceError,
      message: 'Storefront lookup returned no country code.',
      platform,
    });
  }
  return storefront;
};

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
  if (platform === 'ios') {
    return request.apple;
  }
  return request.google;
}

function validateAndroidPurchaseBranchOptions(
  request: unknown,
  type: ProductQueryType,
): void {
  if (request == null || typeof request !== 'object') return;
  const fields = request as Record<string, unknown>;
  const subscriptionOnlyFields = [
    'subscriptionOffers',
    'subscriptionProductReplacementParams',
    'purchaseToken',
    'originalExternalTransactionId',
  ];
  if (
    (type === 'in-app' &&
      subscriptionOnlyFields.some((field) => fields[field] != null)) ||
    (type === 'subs' && fields.offerToken != null)
  ) {
    throw createPurchaseError({
      code: ErrorCode.DeveloperError,
      message:
        'Invalid request for Android. Purchase options must match the selected product type.',
    });
  }
}

/** Verify app acquisition; send Android integrity tokens to your backend. */
export const verifyAppOwnership: QueryField<'verifyAppOwnership'> = async (
  options,
) => {
  if (
    isVegaOS() ||
    ExpoIapModule.USING_ONSIDE_SDK ||
    (Platform.OS !== 'ios' && Platform.OS !== 'android')
  ) {
    return {
      status: 'unknown',
      reason: 'unsupported',
      storeId: isVegaOS()
        ? 'amazon'
        : ExpoIapModule.USING_ONSIDE_SDK
        ? 'onside'
        : 'unknown',
    };
  }
  return invokeNativeWithPurchaseError(
    () => ExpoIapModule.verifyAppOwnership(options ?? {}),
    nativePlatform(),
    {
      code: ErrorCode.ServiceError,
    },
  );
};

/**
 * Initiate a purchase or subscription flow. The result arrives through
 * `purchaseUpdatedListener` / `purchaseErrorListener` (or `useIAP`'s
 * `onPurchaseSuccess` / `onPurchaseError`), not the return value.
 *
 * @param args `RequestPurchaseProps`, discriminated by `type`:
 *   - `type: 'in-app'` — pass `request.apple.sku` (iOS) and/or `request.google.skus` (Android).
 *   - `type: 'subs'`  — same shape, plus `request.google.subscriptionOffers: [{ sku, offerToken }]`.
 * @returns The dispatched purchase payload; do not rely on it for the outcome.
 * @throws Synchronous rejection from the store (e.g. `ErrorCode.NotPrepared`, validation failure).
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
 * @see {@link https://openiap.dev/docs/apis/request-purchase}
 */
export const requestPurchase: MutationField<'requestPurchase'> = async (
  args,
) => {
  const {request} = args;
  markRequested([request.apple?.sku, ...(request.google?.skus ?? [])]);
  try {
    return await requestPurchaseFromStore(args);
  } catch (error) {
    clearRequested();
    throw error;
  }
};

const requestPurchaseFromStore: MutationField<'requestPurchase'> = async (
  args,
) => {
  const {request, type} = args;
  const {canonical, native} = normalizeProductType(type as ProductTypeInput);
  if (canonical === 'all') {
    throw createPurchaseError({
      code: ErrorCode.DeveloperError,
      message: 'Product type all is only supported for product queries.',
    });
  }
  const isInAppPurchase = canonical === 'in-app';

  if (Platform.OS === 'ios') {
    const normalizedRequest = normalizeRequestProps(request, 'ios');

    if (!normalizedRequest?.sku) {
      throw createPurchaseError({
        message:
          'Invalid request for Apple. The `sku` property is required and must be a string.\n\n' +
          'Expected format:\n' +
          '  requestPurchase({\n' +
          '    request: {\n' +
          '      apple: { sku: "product_id" },\n' +
          '      google: { skus: ["product_id"] }\n' +
          '    },\n' +
          '    type: "in-app"\n' +
          '  })\n\n' +
          'See: https://openiap.dev/docs/apis/request-purchase',
        code: ErrorCode.EmptySkuList,
      });
    }

    if (canonical !== 'in-app' && canonical !== 'subs') {
      throw new Error(`Unsupported product type: ${canonical}`);
    }

    const payload: MutationRequestPurchaseArgs = {
      type: canonical === 'in-app' ? 'in-app' : 'subs',
      request: {apple: normalizedRequest},
    };

    const purchase = (await invokeNativeWithPurchaseError(
      () => ExpoIapModule.requestPurchase(payload),
      'ios',
      {
        code: ErrorCode.PurchaseError,
        message: 'Failed to request purchase',
        productId: normalizedRequest.sku,
        productIds: [normalizedRequest.sku],
        productType: canonical,
      },
    )) as Purchase | Purchase[] | null;

    if (Array.isArray(purchase)) {
      return purchase;
    }

    if (purchase) {
      return purchase;
    }

    return canonical === 'subs' ? [] : null;
  }

  if (isAndroidStoreRuntime()) {
    validateAndroidPurchaseBranchOptions(
      (
        request as
          | RequestPurchasePropsByPlatforms
          | RequestSubscriptionPropsByPlatforms
      )?.google,
      canonical,
    );
    if (isInAppPurchase) {
      const normalizedRequest = normalizeRequestProps(
        request as RequestPurchasePropsByPlatforms,
        'android',
      ) as RequestPurchaseAndroidProps | null | undefined;

      if (!normalizedRequest?.skus?.length) {
        throw createPurchaseError({
          message:
            'Invalid request for Google. The `skus` property is required and must be a non-empty array.\n\n' +
            'Expected format:\n' +
            '  requestPurchase({\n' +
            '    request: {\n' +
            '      apple: { sku: "product_id" },\n' +
            '      google: { skus: ["product_id"] }\n' +
            '    },\n' +
            '    type: "in-app"\n' +
            '  })\n\n' +
            'See: https://openiap.dev/docs/apis/request-purchase',
          code: ErrorCode.EmptySkuList,
        });
      }

      const {
        skus,
        obfuscatedAccountId,
        obfuscatedProfileId,
        isOfferPersonalized,
        offerToken,
        developerBillingOption,
      } = normalizedRequest;

      const result = (await invokeNativeWithPurchaseError(
        () =>
          ExpoIapModule.requestPurchase({
            type: native,
            skus,
            purchaseToken: undefined,
            obfuscatedAccountId: obfuscatedAccountId,
            obfuscatedProfileId: obfuscatedProfileId,
            offerToken: offerToken,
            developerBillingOption: developerBillingOption ?? undefined,
            isOfferPersonalized: isOfferPersonalized ?? false,
          }),
        'android',
        {
          code: ErrorCode.PurchaseError,
          message: 'Failed to request purchase',
          productId: skus[0],
          productIds: skus,
          productType: canonical,
        },
      )) as Purchase[];

      return result;
    }

    if (canonical === 'subs') {
      const normalizedRequest = normalizeRequestProps(
        request as RequestSubscriptionPropsByPlatforms,
        'android',
      ) as RequestSubscriptionAndroidProps | null | undefined;

      if (!normalizedRequest?.skus?.length) {
        throw createPurchaseError({
          message:
            'Invalid request for Google. The `skus` property is required and must be a non-empty array.\n\n' +
            'Expected format:\n' +
            '  requestPurchase({\n' +
            '    request: {\n' +
            '      apple: { sku: "subscription_id" },\n' +
            '      google: { skus: ["subscription_id"] }\n' +
            '    },\n' +
            '    type: "subs"\n' +
            '  })\n\n' +
            'See: https://openiap.dev/docs/apis/request-purchase',
          code: ErrorCode.EmptySkuList,
        });
      }

      const {
        skus,
        obfuscatedAccountId,
        obfuscatedProfileId,
        isOfferPersonalized,
        subscriptionOffers,
        purchaseToken: purchaseTokenInput,
        originalExternalTransactionId,
        developerBillingOption,
        subscriptionProductReplacementParams,
      } = normalizedRequest;

      const normalizedOffers = subscriptionOffers ?? [];
      const purchaseToken = purchaseTokenInput ?? undefined;

      const result = (await invokeNativeWithPurchaseError(
        () =>
          ExpoIapModule.requestPurchase({
            type: native,
            skus,
            purchaseToken,
            originalExternalTransactionId:
              originalExternalTransactionId ?? undefined,
            obfuscatedAccountId: obfuscatedAccountId,
            obfuscatedProfileId: obfuscatedProfileId,
            subscriptionOffers: normalizedOffers,
            isOfferPersonalized: isOfferPersonalized ?? false,
            developerBillingOption: developerBillingOption ?? undefined,
            subscriptionProductReplacementParams:
              subscriptionProductReplacementParams ?? undefined,
          }),
        'android',
        {
          code: ErrorCode.PurchaseError,
          message: 'Failed to request purchase',
          productId: skus[0],
          productIds: skus,
          productType: canonical,
        },
      )) as Purchase[];

      return result;
    }

    throw new Error(
      "Invalid request for Android: Expected a valid request object with 'skus' array.",
    );
  }

  throw unsupportedPlatformError();
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
 * @remarks Android purchases must be finalized within 3 days or Google
 *   auto-refunds. iOS unfinished transactions replay on every app launch.
 *
 * @see {@link https://openiap.dev/docs/apis/finish-transaction}
 */
export const finishTransaction: MutationField<'finishTransaction'> = async ({
  purchase,
  isConsumable,
}) => {
  // The schema allows explicit null; the native boolean cannot take it.
  const consumable = isConsumable ?? false;
  const platform = nativePlatform();
  if (
    Platform.OS === 'ios' ||
    (isAndroidStoreRuntime() && purchase.store === 'unknown')
  ) {
    await invokeNativeWithPurchaseError(
      () => ExpoIapModule.finishTransaction(purchase, consumable),
      platform,
      {productId: purchase.productId},
    );
  } else if (isAndroidStoreRuntime()) {
    const token = purchase.purchaseToken ?? undefined;

    if (!token) {
      throw createPurchaseError({
        message: 'Purchase token is required to finish transaction',
        code: ErrorCode.DeveloperError,
        productId: purchase.productId,
        platform: 'android',
      });
    }

    // Native rejects when the store refuses the token, so a failure cannot pass as finished.
    await invokeNativeWithPurchaseError(
      () =>
        consumable
          ? ExpoIapModule.consumePurchaseAndroid(token)
          : ExpoIapModule.acknowledgePurchaseAndroid(token),
      'android',
      {productId: purchase.productId},
    );
  } else {
    throw unsupportedPlatformError();
  }

  showFirstPurchaseNotice(purchase);
};

/**
 * Restore completed transactions. Returns nothing; read the restored items with
 * `getAvailablePurchases` or from hook state.
 *
 * - iOS: sync (or Onside restore when OnsideKit is active), then fetch available purchases.
 * - Android: run the provider's restore, then fetch available purchases.
 *
 * @see {@link https://openiap.dev/docs/apis/restore-purchases}
 */
export const restorePurchases: MutationField<'restorePurchases'> = async () => {
  await restorePurchasesNative();

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
 * @see {@link https://openiap.dev/docs/apis/deep-link-to-subscriptions}
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

  throw unsupportedPlatformError();
};

/**
 * Open the platform's offer/promo code redemption flow.
 *
 * Resolves the redeemed purchase only when the store reports it synchronously;
 * every other path resolves null, so reconcile with `getAvailablePurchases`
 * when the app resumes.
 *
 * @returns Promise resolving to the redeemed purchase, or null
 * @throws Error when a redemption flow exists but cannot be opened
 *
 * @see {@link https://openiap.dev/docs/apis/open-redeem-offer-code}
 */
export const openRedeemOfferCode: MutationField<
  'openRedeemOfferCode'
> = async () => {
  if (isVegaOS()) return null;
  if (Platform.OS !== 'ios' && !isAndroidStoreRuntime()) {
    throw unsupportedPlatformError();
  }
  return invokeNativeWithPurchaseError(
    () => ExpoIapModule.openRedeemOfferCode(),
    nativePlatform(),
    {code: ErrorCode.PurchaseError, message: 'Failed to redeem offer code.'},
  );
};

/**
 * Verify purchase with the configured providers.
 *
 * @param options - Receipt validation options containing the SKU
 * @returns Promise resolving to receipt validation result
 *
 * @see {@link https://openiap.dev/docs/features/validation#verify-purchase}
 */
export const verifyPurchase: MutationField<'verifyPurchase'> = async (
  options,
) => {
  if (!isStorePlatform()) {
    throw unsupportedPlatformError();
  }

  // The native result is already the flat union member, with `__typename`.
  return invokeNativeWithPurchaseError(
    () => ExpoIapModule.verifyPurchase(options),
    nativePlatform(),
  );
};

/**
 * Verify purchase with a specific provider (e.g., IAPKit).
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
 *     // Choose exactly one store payload.
 *     // apple: { jws: purchase.purchaseToken },
 *     // google: { purchaseToken: purchase.purchaseToken },
 *     amazon: {
 *       expectedProductId: purchase.productId,
 *       userId: amazonUserId,
 *       receiptId: purchase.purchaseToken,
 *       // Enable only for App Tester after the IAPKit project opt-in.
 *       sandbox: amazonSandboxEnabled,
 *     }
 *   }
 * });
 * ```
 *
 * @see {@link https://openiap.dev/docs/features/validation#verify-purchase-with-provider}
 */
export const verifyPurchaseWithProvider: MutationField<
  'verifyPurchaseWithProvider'
> = async (options) => {
  if (!isStoreRuntime()) {
    throw unsupportedPlatformError();
  }

  let resolvedOptions = options;

  if (
    resolvedOptions.provider === 'iapkit' &&
    resolvedOptions.iapkit &&
    !resolvedOptions.iapkit.apiKey
  ) {
    try {
      // Dynamically import expo-constants to avoid hard dependency
      const {default: Constants} = await import('expo-constants');
      const configApiKey = Constants.expoConfig?.extra?.iapkitApiKey;
      if (typeof configApiKey === 'string' && configApiKey.length > 0) {
        resolvedOptions = {
          ...resolvedOptions,
          iapkit: {
            ...resolvedOptions.iapkit,
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

  const result = await invokeNativeWithPurchaseError(
    () => ExpoIapModule.verifyPurchaseWithProvider(resolvedOptions),
    nativePlatform(),
  );
  if (result.iapkit == null) {
    return result;
  }

  const {clientPayload, productId, ...iapkit} = result.iapkit;
  return {
    ...result,
    iapkit: {
      ...iapkit,
      storeId: resolveStoreId(iapkit.storeId, iapkit.store),
      ...(clientPayload == null ? {} : {clientPayload}),
      ...(productId == null ? {} : {productId}),
    },
  };
};

export type {SdkPurchaseFlowOptions} from './utils/purchaseFlowBinding';

const purchaseFlowSdk: PurchaseFlowSdk = {
  finishTransaction: (args) => finishTransaction(args),
  getAvailablePurchases: () => getAvailablePurchases(),
  getPendingTransactionsIOS:
    Platform.OS === 'ios' ? () => getPendingTransactionsIOS() : undefined,
  purchaseUpdatedListener: (listener) => purchaseUpdatedListener(listener),
  purchaseErrorListener: (listener) => purchaseErrorListener(listener),
};

/**
 * Creates the app's purchase flow. It confirms and finishes every purchase the
 * store delivers, and recovers unfinished ones, through this SDK. Create one
 * per signed-in account, dispose it when the account changes, and pass it to
 * `useIAP({purchaseFlow})`.
 * @see {@link https://kit.openiap.dev/docs/purchase-flow}
 */
export function createPurchaseFlow(
  options: SdkPurchaseFlowOptions,
): PurchaseFlow<Purchase>;
export function createPurchaseFlow<P extends PurchaseFlowPurchase>(
  options: PurchaseFlowOptions<P>,
): PurchaseFlow<P>;
export function createPurchaseFlow(
  options: SdkPurchaseFlowOptions,
): PurchaseFlow<Purchase> {
  return createSdkPurchaseFlow(purchaseFlowSdk, options);
}

/**
 * Confirms purchases with IAPKit from the app, for apps without a backend:
 * pass it as `confirmWithBackend` with a publishable key. Credit consumables
 * in `grant`, which runs before the purchase is consumed.
 */
export function confirmWithIapkit(
  options: IapkitConfirmationOptions<Purchase>,
): (
  purchase: Purchase,
  context: {isConsumable: boolean},
) => Promise<PurchaseConfirmation> {
  return createIapkitConfirmation(verifyPurchaseWithProvider, options);
}

export * from './useIAP';
export {kitApi, KitApiError, resolveLocalizedPayload} from './kit-api';
export type {
  KitApiOptions,
  KitClientPayloadCache,
  KitClientPayloadOptions,
  KitClientPayloadResponse,
  KitLocalizedClientPayload,
  KitLocalizedClientPayloadOptions,
  KitLocalizedPayloadOptions,
  KitProduct,
  KitProductClientPayload,
  KitProductOffer,
  KitProductPlatform,
  KitProductsOptions,
  KitProductsResponse,
  KitSubscription,
  EntitlementsResponse,
  StatusResponse,
} from './kit-api';
export {
  describePurchaseFlowStatus,
  toPurchaseConfirmationRequest,
} from './purchase-flow';
export type {
  IapkitConfirmationOptions,
  PurchaseConfirmation,
  PurchaseConfirmationRequest,
  PurchaseFlow,
  PurchaseFlowGuidance,
  PurchaseFlowGuidanceKey,
  PurchaseFlowOptions,
  PurchaseFlowOutcome,
  PurchaseFlowPurchase,
  PurchaseFlowStatus,
  RecoverPurchasesOptions,
} from './purchase-flow';
export {
  ErrorCodeUtils,
  ErrorCodeMapping,
  createPurchaseError,
  createPurchaseErrorFromPlatform,
  getUserFriendlyErrorMessage,
  isUserCancelledError,
} from './utils/errorMapping';
export type {
  PurchaseError as ExpoPurchaseError,
  PurchaseErrorProps,
} from './utils/errorMapping';
export {ExpoIapConsole} from './utils/debug';
