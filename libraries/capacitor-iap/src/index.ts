import type {NativePurchaseRequest} from './definitions';
import {
  deepLinkToSubscriptionsIOS,
  getPendingTransactionsIOS,
  isProductIOS,
} from './modules/ios';
import {
  deepLinkToSubscriptionsAndroid,
  isProductAndroid,
} from './modules/android';
import {CapacitorIap} from './plugin';
import type {
  PurchaseFlow,
  PurchaseFlowOptions,
  PurchaseFlowPurchase,
} from './purchase-flow-core';
import {
  createDeviceConfirmationIOS,
  createIapkitConfirmation,
  type IapkitConfirmationOptions,
} from './purchase-flow-confirmers';
import type {
  ActiveSubscription,
  DeveloperProvidedBillingDetailsAndroid,
  IapEvent,
  MutationField,
  Product,
  ProductQueryType,
  ProductSubscription,
  Purchase,
  PurchaseOptions,
  PurchaseUpdatedListenerOptions,
  QueryField,
  RequestPurchasePropsByPlatforms,
  RequestSubscriptionPropsByPlatforms,
  UserChoiceBillingDetails,
} from './types';
import {ErrorCode, resolveStoreId} from './types';
import {
  decodeAndroidPurchases,
  decodeApplePurchases,
} from './utils/availablePurchases';
import {
  createPurchaseError,
  normalizeErrorCodeFromNative,
  type PurchaseError,
} from './utils/errorMapping';
import {showFirstPurchaseNotice} from './utils/firstPurchaseNotice';
import {invokeNativeWithPurchaseError} from './utils/nativeError';
import {
  isAndroid,
  isIOS,
  isStorePlatform,
  nativePlatform,
  requireStorePlatform,
  unsupportedPlatformError,
} from './utils/platform';
import {
  clearRequested,
  createSdkPurchaseFlow,
  markRequested,
  type PurchaseFlowSdk,
  type SdkPurchaseFlowOptions,
} from './utils/purchaseFlowBinding';

export * from './types';
export * from './modules/android';
export * from './modules/ios';

/** Event names the native plugins emit; values match the generated `IapEvent`. */
export enum OpenIapEvent {
  PurchaseUpdated = 'purchase-updated',
  PurchaseError = 'purchase-error',
  PromotedProductIOS = 'promoted-product-ios',
  UserChoiceBillingAndroid = 'user-choice-billing-android',
  /** External Payments (Play Billing 8.3.0+) and Billing Choice (9.1.0+) selections. */
  DeveloperProvidedBillingAndroid = 'developer-provided-billing-android',
  SubscriptionBillingIssue = 'subscription-billing-issue',
}

/** Returned by every listener; call `remove` to stop receiving events. */
export interface EventSubscription {
  remove: () => void;
}

type Subscriber = (payload: unknown) => void;

// The events Capacitor holds until a listener attaches; this layer does the
// same for its own subscribers.
const RETAINED_EVENTS = new Set<IapEvent>([
  OpenIapEvent.PurchaseUpdated,
  OpenIapEvent.PromotedProductIOS,
]);
const subscribers = new Map<IapEvent, Set<Subscriber>>();
const heldEvents = new Map<IapEvent, unknown[]>();

// Delivers to whoever is subscribed now, or holds a retained event for the
// next subscriber. A throwing listener does not stop the others.
const dispatch = (eventName: IapEvent, payload: unknown) => {
  const current = subscribers.get(eventName);
  if (!current?.size) {
    if (RETAINED_EVENTS.has(eventName)) {
      heldEvents.set(eventName, [
        ...(heldEvents.get(eventName) ?? []),
        payload,
      ]);
    }
    return;
  }
  for (const subscriber of [...current]) {
    try {
      subscriber(payload);
    } catch (error) {
      console.error(`[capacitor-iap] A ${eventName} listener threw:`, error);
    }
  }
};

// One native listener per event lives as long as the app, so a short-lived
// subscription cannot receive the held purchases and drop them.
const ensureNativeListener = (eventName: IapEvent): Set<Subscriber> => {
  const existing = subscribers.get(eventName);
  if (existing) return existing;
  const current = new Set<Subscriber>();
  subscribers.set(eventName, current);
  CapacitorIap.addListener(eventName, (payload) =>
    dispatch(eventName, payload),
  ).catch((error: unknown) => {
    subscribers.delete(eventName);
    console.warn(`[capacitor-iap] Failed to listen for ${eventName}:`, error);
  });
  return current;
};

const addNativeListener = <T>(
  eventName: IapEvent,
  listener: (payload: T) => void,
): EventSubscription => {
  if (!isStorePlatform()) return {remove: () => {}};

  const current = ensureNativeListener(eventName);
  const subscriber: Subscriber = (payload) => listener(payload as T);
  current.add(subscriber);
  const held = heldEvents.get(eventName);
  if (held) {
    heldEvents.delete(eventName);
    // After this call returns, as a native delivery would be; a subscriber
    // removed meanwhile leaves the events to the next one.
    queueMicrotask(() =>
      held.forEach((payload) => dispatch(eventName, payload)),
    );
  }
  return {remove: () => current.delete(subscriber)};
};

// iOS replays a transaction to each listener once unless the listener opts out
// with `dedupeTransactionIOS: false`; the shared history spans listeners.
type DedupeHistoryIOS = {ids: Set<string>; order: string[]; start: number};

const dedupeHistoryLimitIOS = 512;
const dedupeHistoryIOS: DedupeHistoryIOS = {
  ids: new Set(),
  order: [],
  start: 0,
};
let dedupeGenerationIOS = 0;
let nonDedupingListenerCountIOS = 0;

const rememberTransactionIOS = (id: string, history: DedupeHistoryIOS) => {
  if (history.ids.has(id)) return;
  history.ids.add(id);
  history.order.push(id);
  if (history.order.length - history.start > dedupeHistoryLimitIOS) {
    const evicted = history.order[history.start];
    history.start += 1;
    if (evicted != null) history.ids.delete(evicted);
    if (history.start > 128 && history.start * 2 > history.order.length) {
      history.order = history.order.slice(history.start);
      history.start = 0;
    }
  }
};

const clearHistoryIOS = (history: DedupeHistoryIOS) => {
  history.ids.clear();
  history.order.length = 0;
  history.start = 0;
};

// Native starts deduplicating; each change re-attaches its store listener.
let dedupeTransactionsIOS = true;

const configureListenerOptionsIOS = (dedupeTransactionIOS: boolean) => {
  if (!isIOS() || dedupeTransactionIOS === dedupeTransactionsIOS) return;
  dedupeTransactionsIOS = dedupeTransactionIOS;
  CapacitorIap.setPurchaseUpdatedListenerOptions({dedupeTransactionIOS}).catch(
    (error: unknown) => {
      dedupeTransactionsIOS = !dedupeTransactionIOS;
      console.warn(
        '[capacitor-iap] Failed to configure purchase updated listener options:',
        error,
      );
    },
  );
};

/**
 * Listen for purchases the store delivers: new purchases, restores, and
 * transactions that finish outside the app.
 *
 * @see {@link https://openiap.dev/docs/events/purchase-updated-listener}
 */
export const purchaseUpdatedListener = (
  listener: (purchase: Purchase) => void,
  options?: PurchaseUpdatedListenerOptions | null,
): EventSubscription => {
  const receiveDuplicatesIOS =
    isIOS() && options?.dedupeTransactionIOS === false;
  const ownHistory: DedupeHistoryIOS = {
    ids: new Set(dedupeHistoryIOS.ids),
    order: dedupeHistoryIOS.order.slice(dedupeHistoryIOS.start),
    start: 0,
  };
  let ownGeneration = dedupeGenerationIOS;

  const subscription = addNativeListener<Purchase>(
    OpenIapEvent.PurchaseUpdated,
    (purchase) => {
      if (isIOS() && typeof purchase.id === 'string' && purchase.id) {
        if (ownGeneration !== dedupeGenerationIOS) {
          clearHistoryIOS(ownHistory);
          ownGeneration = dedupeGenerationIOS;
        }
        const duplicate = ownHistory.ids.has(purchase.id);
        rememberTransactionIOS(purchase.id, ownHistory);
        rememberTransactionIOS(purchase.id, dedupeHistoryIOS);
        if (duplicate && !receiveDuplicatesIOS) return;
      }
      listener(purchase);
    },
  );
  if (!receiveDuplicatesIOS) return subscription;

  nonDedupingListenerCountIOS += 1;
  configureListenerOptionsIOS(false);
  let removed = false;
  return {
    remove: () => {
      if (removed) return;
      removed = true;
      subscription.remove();
      nonDedupingListenerCountIOS = Math.max(
        0,
        nonDedupingListenerCountIOS - 1,
      );
      configureListenerOptionsIOS(nonDedupingListenerCountIOS === 0);
    },
  };
};

/**
 * Listen for purchase failures, including cancellations.
 *
 * @see {@link https://openiap.dev/docs/events/purchase-error-listener}
 */
export const purchaseErrorListener = (
  listener: (error: PurchaseError) => void,
): EventSubscription =>
  // Native events may carry codes outside ErrorCode; deliver canonical codes.
  addNativeListener<PurchaseError>(OpenIapEvent.PurchaseError, (error) => {
    listener({...error, code: normalizeErrorCodeFromNative(error.code)});
  });

/**
 * Listen for products the user tapped in an App Store promotion (iOS). A
 * promotion pending when the listener attaches is delivered once.
 *
 * @see {@link https://openiap.dev/docs/events/ios/promoted-product-listener-ios}
 */
export const promotedProductListenerIOS = (
  listener: (product: Product) => void,
): EventSubscription => {
  if (!isIOS()) return {remove: () => {}};

  let removed = false;
  let deliveredProductId: string | undefined;
  const deliver = (product: Product) => {
    if (removed || (product.id && product.id === deliveredProductId)) return;
    deliveredProductId = product.id;
    listener(product);
  };
  const replayPendingProduct = () =>
    CapacitorIap.getPromotedProductIOS()
      .then(({value}) => {
        if (value) deliver(value as Product);
      })
      .catch(() => {});

  const subscription = addNativeListener<Product | {productId: string}>(
    OpenIapEvent.PromotedProductIOS,
    (payload) => {
      // Native sends only the id when it cannot load the product.
      if ('id' in payload) deliver(payload);
      else void replayPendingProduct();
    },
  );
  void replayPendingProduct();
  return {
    remove: () => {
      removed = true;
      subscription.remove();
    },
  };
};

/**
 * Listen for users who pick alternative billing in Play's User Choice Billing
 * dialog (Android).
 *
 * @see {@link https://openiap.dev/docs/events/android/user-choice-billing-listener-android}
 */
export const userChoiceBillingListenerAndroid = (
  listener: (details: UserChoiceBillingDetails) => void,
): EventSubscription =>
  isAndroid()
    ? addNativeListener(OpenIapEvent.UserChoiceBillingAndroid, listener)
    : {remove: () => {}};

/**
 * Listen for users who pick the developer's option in an External Payments
 * (Play Billing 8.3.0+) or Billing Choice (9.1.0+) flow (Android).
 *
 * @see {@link https://openiap.dev/docs/events/android/developer-provided-billing-listener-android}
 */
export const developerProvidedBillingListenerAndroid = (
  listener: (details: DeveloperProvidedBillingDetailsAndroid) => void,
): EventSubscription =>
  isAndroid()
    ? addNativeListener(OpenIapEvent.DeveloperProvidedBillingAndroid, listener)
    : {remove: () => {}};

/**
 * Listen for subscriptions that enter a billing-issue state: StoreKit billing
 * retry on iOS 16.4+, `isSuspendedAndroid` on Play Billing 8.1+. Send the user
 * to `deepLinkToSubscriptions` to fix the payment method.
 *
 * @see {@link https://openiap.dev/docs/events/subscription-billing-issue-listener}
 */
export const subscriptionBillingIssueListener = (
  listener: (purchase: Purchase) => void,
): EventSubscription =>
  addNativeListener(OpenIapEvent.SubscriptionBillingIssue, listener);

/**
 * Connect to the store. Call before any other API.
 *
 * @see {@link https://openiap.dev/docs/apis/init-connection}
 */
export const initConnection: MutationField<'initConnection'> = async (
  config,
) => {
  requireStorePlatform();
  const {value} = await invokeNativeWithPurchaseError(
    () => CapacitorIap.initConnection({config: config ?? null}),
    nativePlatform(),
  );
  return value;
};

/**
 * Close the store connection and release its resources.
 *
 * @see {@link https://openiap.dev/docs/apis/end-connection}
 */
export const endConnection: MutationField<'endConnection'> = async () => {
  requireStorePlatform();
  const {value} = await invokeNativeWithPurchaseError(
    () => CapacitorIap.endConnection(),
    nativePlatform(),
  );
  if (value === true && isIOS()) {
    clearHistoryIOS(dedupeHistoryIOS);
    dedupeGenerationIOS += 1;
  }
  return value;
};

const normalizeProductType = (
  type: ProductQueryType | null | undefined,
): ProductQueryType => {
  if (!type || type === 'in-app') return 'in-app';
  if (type === 'subs' || type === 'all') return type;
  throw createPurchaseError({
    code: ErrorCode.DeveloperError,
    message: `Unsupported product type: ${String(type)}`,
  });
};

/**
 * Load products or subscriptions by SKU. Unknown SKUs are left out of the result.
 *
 * @see {@link https://openiap.dev/docs/apis/fetch-products}
 */
export const fetchProducts: QueryField<'fetchProducts'> = async (request) => {
  const {skus, type} = request ?? {};
  if (!Array.isArray(skus) || skus.length === 0) {
    throw createPurchaseError({
      code: ErrorCode.EmptySkuList,
      message: 'No SKUs provided',
    });
  }
  requireStorePlatform();

  const productType = normalizeProductType(type);
  const platform = nativePlatform();
  const {value} = await invokeNativeWithPurchaseError(
    () => CapacitorIap.fetchProducts({skus, type: productType}),
    platform,
    {
      code: ErrorCode.QueryProduct,
      message: 'Failed to query products',
      productIds: skus,
      productType,
    },
  );

  const requested = new Set(skus);
  const isPlatformItem = platform === 'ios' ? isProductIOS : isProductAndroid;
  const items = (value ?? []).filter(
    (item): item is Product | ProductSubscription =>
      isPlatformItem(item) &&
      typeof (item as Product).id === 'string' &&
      requested.has((item as Product).id),
  );
  if (productType === 'in-app') return items as Product[];
  if (productType === 'subs') return items as ProductSubscription[];
  return items;
};

/**
 * List the purchases the store still holds: non-consumables, active
 * subscriptions, and unfinished transactions.
 *
 * @see {@link https://openiap.dev/docs/apis/get-available-purchases}
 */
export const getAvailablePurchases: QueryField<
  'getAvailablePurchases'
> = async (options) => {
  requireStorePlatform();
  const normalized = {
    alsoPublishToEventListenerIOS:
      options?.alsoPublishToEventListenerIOS ?? false,
    onlyIncludeActiveItemsIOS: options?.onlyIncludeActiveItemsIOS ?? true,
    includeSuspendedAndroid: options?.includeSuspendedAndroid ?? false,
  } satisfies PurchaseOptions;

  const {value} = await invokeNativeWithPurchaseError(
    () => CapacitorIap.getAvailablePurchases({options: normalized}),
    nativePlatform(),
  );
  return isIOS() ? decodeApplePurchases(value) : decodeAndroidPurchases(value);
};

/**
 * List active subscriptions, optionally limited to the given product IDs. iOS
 * entries carry `renewalInfoIOS`.
 *
 * @see {@link https://openiap.dev/docs/apis/get-active-subscriptions}
 */
export const getActiveSubscriptions: QueryField<
  'getActiveSubscriptions'
> = async (subscriptionIds) => {
  requireStorePlatform();
  const {value} = await invokeNativeWithPurchaseError(
    () =>
      CapacitorIap.getActiveSubscriptions({
        subscriptionIds: subscriptionIds ?? null,
      }),
    nativePlatform(),
  );
  return (value ?? []) as ActiveSubscription[];
};

/**
 * Check whether the user has an active subscription, optionally among the
 * given product IDs.
 *
 * @see {@link https://openiap.dev/docs/apis/has-active-subscriptions}
 */
export const hasActiveSubscriptions: QueryField<
  'hasActiveSubscriptions'
> = async (subscriptionIds) => {
  requireStorePlatform();
  const {value} = await invokeNativeWithPurchaseError(
    () =>
      CapacitorIap.hasActiveSubscriptions({
        subscriptionIds: subscriptionIds ?? null,
      }),
    nativePlatform(),
  );
  return value === true;
};

/**
 * Get the user's storefront country code.
 *
 * @see {@link https://openiap.dev/docs/apis/get-storefront}
 */
export const getStorefront: QueryField<'getStorefront'> = async () => {
  requireStorePlatform();
  const platform = nativePlatform();
  const {value} = await invokeNativeWithPurchaseError(
    () => CapacitorIap.getStorefront(),
    platform,
    {code: ErrorCode.ServiceError, message: 'Failed to get storefront.'},
  );
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createPurchaseError({
      code: ErrorCode.ServiceError,
      message: 'Storefront lookup returned no country code.',
      platform,
    });
  }
  return value;
};

const invalidRequestError = (message: string) =>
  createPurchaseError({
    code: ErrorCode.EmptySkuList,
    message: `${message}\n\nSee: https://openiap.dev/docs/apis/request-purchase`,
  });

const ANDROID_SUBSCRIPTION_ONLY_FIELDS = [
  'subscriptionOffers',
  'subscriptionProductReplacementParams',
  'purchaseToken',
  'originalExternalTransactionId',
];

// Builds the platform branch the native decoders read; options that do not
// match the product type are a developer error, not silently dropped.
const toNativePurchaseRequest = (
  request:
    RequestPurchasePropsByPlatforms | RequestSubscriptionPropsByPlatforms,
  type: 'in-app' | 'subs',
): NativePurchaseRequest => {
  let platformRequest: Record<string, unknown>;
  if (isIOS()) {
    const apple = request.apple;
    if (!apple?.sku) {
      throw invalidRequestError(
        'Invalid request for Apple. The `sku` property is required.',
      );
    }
    platformRequest = {apple};
  } else {
    const google = request.google as Record<string, unknown> | null | undefined;
    const skus = google?.skus as unknown;
    if (
      !Array.isArray(skus) ||
      skus.length === 0 ||
      skus.some((sku) => typeof sku !== 'string' || sku.trim() === '')
    ) {
      throw invalidRequestError(
        'Invalid request for Google. The `skus` property must contain only non-empty strings.',
      );
    }
    if (
      (type === 'in-app' &&
        ANDROID_SUBSCRIPTION_ONLY_FIELDS.some(
          (field) => google?.[field] != null,
        )) ||
      (type === 'subs' && google?.offerToken != null)
    ) {
      throw createPurchaseError({
        code: ErrorCode.DeveloperError,
        message:
          'Invalid request for Android. Purchase options must match the selected product type.',
      });
    }
    const offers = google?.subscriptionOffers as unknown;
    if (
      offers != null &&
      (!Array.isArray(offers) ||
        offers.some(
          (offer) =>
            typeof offer?.sku !== 'string' ||
            !offer.sku.trim() ||
            typeof offer?.offerToken !== 'string' ||
            !offer.offerToken.trim(),
        ))
    ) {
      throw createPurchaseError({
        code: ErrorCode.DeveloperError,
        message:
          'Invalid request for Android. Every subscription offer must include non-empty `sku` and `offerToken` strings.',
      });
    }
    platformRequest = {google};
  }

  return type === 'subs'
    ? {type, requestSubscription: platformRequest}
    : {type, requestPurchase: platformRequest};
};

/**
 * Start a purchase or subscription. The outcome also arrives through
 * `purchaseUpdatedListener` and `purchaseErrorListener`.
 *
 * @example
 * ```ts
 * await requestPurchase({
 *   request: {
 *     apple: {sku: 'com.app.premium'},
 *     google: {skus: ['com.app.premium']},
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

const requestPurchaseFromStore: MutationField<'requestPurchase'> = async ({
  request,
  type,
}) => {
  requireStorePlatform();
  const productType = normalizeProductType(type);
  if (productType === 'all') {
    throw createPurchaseError({
      code: ErrorCode.DeveloperError,
      message: 'Product type all is only supported for product queries.',
    });
  }
  const nativeRequest = toNativePurchaseRequest(request, productType);
  const skus = isIOS()
    ? [request.apple?.sku ?? '']
    : ((request.google?.skus ?? []) as string[]);

  const {value} = await invokeNativeWithPurchaseError(
    () => CapacitorIap.requestPurchase({request: nativeRequest}),
    nativePlatform(),
    {
      code: ErrorCode.PurchaseError,
      message: 'Failed to request purchase',
      productId: skus[0],
      productIds: skus,
      productType,
    },
  );
  if (value != null) return value as Purchase | Purchase[];
  return productType === 'subs' ? [] : null;
};

/**
 * Finish a purchase after you delivered it: consumes consumables, acknowledges
 * everything else. Unfinished Android purchases are refunded after 3 days.
 *
 * @see {@link https://openiap.dev/docs/apis/finish-transaction}
 */
export const finishTransaction: MutationField<'finishTransaction'> = async ({
  purchase,
  isConsumable,
}) => {
  requireStorePlatform();
  const consumable = isConsumable ?? false;

  // A community Android provider finishes from the full purchase.
  if (isIOS() || purchase.store === 'unknown') {
    await invokeNativeWithPurchaseError(
      () =>
        CapacitorIap.finishTransaction({purchase, isConsumable: consumable}),
      nativePlatform(),
      {productId: purchase.productId},
    );
  } else {
    const purchaseToken = purchase.purchaseToken;
    if (!purchaseToken) {
      throw createPurchaseError({
        code: ErrorCode.DeveloperError,
        message: 'Purchase token is required to finish transaction',
        productId: purchase.productId,
        platform: 'android',
      });
    }
    await invokeNativeWithPurchaseError(
      () =>
        consumable
          ? CapacitorIap.consumePurchaseAndroid({purchaseToken})
          : CapacitorIap.acknowledgePurchaseAndroid({purchaseToken}),
      'android',
      {productId: purchase.productId},
    );
  }

  showFirstPurchaseNotice(purchase);
};

/**
 * Restore completed purchases through the store, then refresh the owned
 * list. Read the result with `getAvailablePurchases`.
 *
 * @see {@link https://openiap.dev/docs/apis/restore-purchases}
 */
export const restorePurchases: MutationField<'restorePurchases'> = async () => {
  requireStorePlatform();
  const {value} = await invokeNativeWithPurchaseError(
    () => CapacitorIap.restorePurchases(),
    nativePlatform(),
    {code: ErrorCode.SyncError},
  );
  if (value !== true) {
    throw createPurchaseError({
      code: ErrorCode.SyncError,
      message: 'Store purchase restore did not complete',
      platform: nativePlatform(),
    });
  }
  await getAvailablePurchases({
    alsoPublishToEventListenerIOS: false,
    onlyIncludeActiveItemsIOS: true,
  });
};

/**
 * Open the store's subscription management screen. Android uses
 * `skuAndroid` and `packageNameAndroid`; iOS ignores them.
 *
 * @see {@link https://openiap.dev/docs/apis/deep-link-to-subscriptions}
 */
export const deepLinkToSubscriptions: MutationField<
  'deepLinkToSubscriptions'
> = async (options) => {
  if (isIOS()) return deepLinkToSubscriptionsIOS();
  if (isAndroid()) return deepLinkToSubscriptionsAndroid(options ?? null);
  throw unsupportedPlatformError();
};

/**
 * Open the store's offer code redemption flow. Resolves the redeemed purchase
 * when the store reports it at once; otherwise null, so reconcile with
 * `getAvailablePurchases` when the app resumes.
 *
 * @see {@link https://openiap.dev/docs/apis/open-redeem-offer-code}
 */
export const openRedeemOfferCode: MutationField<
  'openRedeemOfferCode'
> = async () => {
  requireStorePlatform();
  const {value} = await invokeNativeWithPurchaseError(
    () => CapacitorIap.openRedeemOfferCode(),
    nativePlatform(),
    {code: ErrorCode.PurchaseError, message: 'Failed to redeem offer code.'},
  );
  return (value ?? null) as Purchase | null;
};

/**
 * Check how the app was acquired. An Android integrity token stays `unknown`
 * until your backend verifies it.
 *
 * @see {@link https://openiap.dev/docs/apis/verify-app-ownership}
 */
export const verifyAppOwnership: QueryField<'verifyAppOwnership'> = async (
  options,
) => {
  if (!isStorePlatform()) {
    return {status: 'unknown', reason: 'unsupported', storeId: 'unknown'};
  }
  const {value} = await invokeNativeWithPurchaseError(
    () => CapacitorIap.verifyAppOwnership({options: options ?? {}}),
    nativePlatform(),
    {code: ErrorCode.ServiceError},
  );
  return value as Awaited<ReturnType<QueryField<'verifyAppOwnership'>>>;
};

/**
 * Verify a purchase with the store's server API.
 *
 * @see {@link https://openiap.dev/docs/features/validation#verify-purchase}
 */
export const verifyPurchase: MutationField<'verifyPurchase'> = async (
  props,
) => {
  requireStorePlatform();
  const {value} = await invokeNativeWithPurchaseError(
    () => CapacitorIap.verifyPurchase({props}),
    nativePlatform(),
  );
  return value as Awaited<ReturnType<MutationField<'verifyPurchase'>>>;
};

/**
 * Verify a purchase with a verification service such as IAPKit.
 *
 * @see {@link https://openiap.dev/docs/features/validation#verify-purchase-with-provider}
 */
export const verifyPurchaseWithProvider: MutationField<
  'verifyPurchaseWithProvider'
> = async (props) => {
  requireStorePlatform();
  const {value} = await invokeNativeWithPurchaseError(
    () => CapacitorIap.verifyPurchaseWithProvider({props}),
    nativePlatform(),
  );
  const result = value as Awaited<
    ReturnType<MutationField<'verifyPurchaseWithProvider'>>
  >;
  if (result.iapkit == null) return result;

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
  // The active-only iOS list drops subscriptions in billing grace.
  getAvailablePurchases: () =>
    getAvailablePurchases({onlyIncludeActiveItemsIOS: false}),
  get getPendingTransactionsIOS() {
    return isIOS() ? () => getPendingTransactionsIOS() : undefined;
  },
  purchaseUpdatedListener: (listener) =>
    purchaseUpdatedListener(listener, {dedupeTransactionIOS: false}),
  purchaseErrorListener: (listener) => purchaseErrorListener(listener),
};

/**
 * Create the app's purchase flow. It confirms and finishes every purchase the
 * store delivers and recovers unfinished ones. Create one per signed-in
 * account and dispose it when the account changes.
 *
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
 * Confirm purchases with IAPKit from the app, for apps without a backend:
 * pass it as `confirmWithBackend` with a publishable key. Credit consumables
 * in `grant`, which runs before the purchase is consumed.
 */
export function confirmWithIapkit(
  options: IapkitConfirmationOptions<Purchase>,
): PurchaseFlowOptions<Purchase>['confirmWithBackend'] {
  return createIapkitConfirmation(verifyPurchaseWithProvider, options);
}

/**
 * Confirm App Store purchases on the device, for apps with neither a backend
 * nor IAPKit: StoreKit must list the transaction as unfinished, or for a
 * restore in its verified history. Credit consumables in `grant`.
 */
export function confirmOnDeviceIOS(
  options: {
    /** Required for consumables; credit each purchase.id only once. */
    grant?: (
      purchase: Purchase,
      context: {isConsumable: boolean},
    ) => Promise<void>;
  } = {},
): PurchaseFlowOptions<Purchase>['confirmWithBackend'] {
  return createDeviceConfirmationIOS<Purchase>(
    () => getPendingTransactionsIOS(),
    {
      ...options,
      getTransactionHistoryIOS: () =>
        getAvailablePurchases({onlyIncludeActiveItemsIOS: false}),
    },
  );
}

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
} from './purchase-flow-core';
export type {
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
} from './purchase-flow-core';
export type {IapkitConfirmationOptions} from './purchase-flow-confirmers';
export {
  ErrorCodeUtils,
  ErrorCodeMapping,
  createPurchaseError,
  createPurchaseErrorFromPlatform,
  getUserFriendlyErrorMessage,
  isRecoverableError,
  isUserCancelledError,
} from './utils/errorMapping';
export type {
  PurchaseError as CapacitorPurchaseError,
  PurchaseErrorProps,
} from './utils/errorMapping';
