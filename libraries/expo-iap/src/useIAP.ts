// External dependencies
import {useCallback, useEffect, useLayoutEffect, useState, useRef} from 'react';
import {Platform} from 'react-native';
import type {EventSubscription} from 'expo-modules-core';

// Internal modules
import {
  endConnection,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  promotedProductListenerIOS,
  userChoiceBillingListenerAndroid,
  developerProvidedBillingListenerAndroid,
  subscriptionBillingIssueListener,
  getAvailablePurchases,
  finishTransaction as finishTransactionInternal,
  requestPurchase as requestPurchaseInternal,
  fetchProducts,
  verifyPurchase as verifyPurchaseInternal,
  verifyPurchaseWithProvider as verifyPurchaseWithProviderInternal,
  getActiveSubscriptions,
  hasActiveSubscriptions,
  openRedeemOfferCode,
  type ActiveSubscription,
  type ProductTypeInput,
} from './index';
import {ExpoIapConsole} from './utils/debug';
import type {PurchaseFlow, PurchaseFlowOutcome} from './purchase-flow';
import {getPromotedProductIOS} from './modules/ios';
import {restorePurchasesNative} from './utils/restorePurchases';
import {
  getBillingChoiceInfoAndroid,
  isBillingProgramAvailableAndroid,
  createBillingProgramReportingDetailsAndroid,
  launchExternalLinkAndroid,
  showBillingProgramInformationDialogAndroid,
  showInAppMessagesAndroid,
} from './modules/android';

// Types
import type {
  Product,
  ProductSubscription,
  ProductQueryType,
  ProductRequest,
  BillingChoiceScreenTypeAndroid,
  BillingProgramAndroid,
  DeveloperProvidedBillingDetailsAndroid,
  InitConnectionConfig,
  Purchase,
  MutationRequestPurchaseArgs,
  PurchaseInput,
  PurchaseUpdatedListenerOptions,
  VerifyPurchaseProps,
  VerifyPurchaseResult,
  VerifyPurchaseWithProviderProps,
  VerifyPurchaseWithProviderResult,
  PurchaseOptions,
  MutationField,
  QueryField,
  UserChoiceBillingDetails,
} from './types';
import {ErrorCode} from './types';
import type {PurchaseError} from './utils/errorMapping';
import {
  getUserFriendlyErrorMessage,
  isUserCancelledError,
  isRecoverableError,
} from './utils/errorMapping';

// Hooks share one native connection; the last mounted hook ends it.
let connectionOwnerCount = 0;

const releaseConnection = (): void => {
  connectionOwnerCount = Math.max(0, connectionOwnerCount - 1);
  if (connectionOwnerCount > 0) return;
  endConnection().catch((error: unknown) => {
    ExpoIapConsole.warn('[useIAP] endConnection failed:', error);
  });
};

type UseIap = {
  connected: boolean;
  products: Product[];
  subscriptions: ProductSubscription[];
  availablePurchases: Purchase[];
  promotedProductIOS?: Product;
  activeSubscriptions: ActiveSubscription[];
  finishTransaction: ({
    purchase,
    isConsumable,
  }: {
    purchase: Purchase;
    isConsumable?: boolean;
  }) => Promise<void>;
  getAvailablePurchases: (options?: PurchaseOptions) => Promise<void>;
  fetchProducts: (params: {
    skus: string[];
    type?: ProductTypeInput;
  }) => Promise<void>;

  requestPurchase: (
    params: MutationRequestPurchaseArgs,
  ) => ReturnType<typeof requestPurchaseInternal>;
  verifyPurchase: (props: VerifyPurchaseProps) => Promise<VerifyPurchaseResult>;
  verifyPurchaseWithProvider: (
    props: VerifyPurchaseWithProviderProps,
  ) => Promise<VerifyPurchaseWithProviderResult>;
  restorePurchases: (options?: PurchaseOptions) => Promise<void>;
  getPromotedProductIOS: () => Promise<Product | null>;
  getActiveSubscriptions: (subscriptionIds?: string[]) => Promise<void>;
  hasActiveSubscriptions: (subscriptionIds?: string[]) => Promise<boolean>;
  /**
   * Manually retry the store connection.
   * Useful when the initial auto-connect fails (e.g., Play Store not ready at mount time).
   * Updates the `connected` state on success.
   */
  reconnect: () => Promise<boolean>;
  getBillingChoiceInfoAndroid: QueryField<'getBillingChoiceInfoAndroid'>;
  isBillingProgramAvailableAndroid: MutationField<'isBillingProgramAvailableAndroid'>;
  createBillingProgramReportingDetailsAndroid: MutationField<'createBillingProgramReportingDetailsAndroid'>;
  launchExternalLinkAndroid: MutationField<'launchExternalLinkAndroid'>;
  showBillingProgramInformationDialogAndroid: MutationField<'showBillingProgramInformationDialogAndroid'>;
  showInAppMessagesAndroid: MutationField<'showInAppMessagesAndroid'>;
  openRedeemOfferCode: MutationField<'openRedeemOfferCode'>;
};

export interface UseIAPOptions {
  onPurchaseSuccess?: (purchase: Purchase) => void;
  /**
   * The app's flow from `createPurchaseFlow`, which confirms and finishes
   * every purchase. The hook recovers unfinished purchases once connected or
   * when the flow changes, reports outcomes, and refreshes ownership after
   * each. Leave finishing out of `onPurchaseSuccess` when this is set.
   */
  purchaseFlow?: PurchaseFlow<Purchase>;
  /** Each purchase's outcome from `purchaseFlow`. */
  onPurchaseFlowOutcome?: (outcome: PurchaseFlowOutcome<Purchase>) => void;
  onPurchaseError?: (error: PurchaseError) => void;
  /**
   * Options for the purchase success listener. iOS defaults to suppressing
   * StoreKit replay events for the same transaction ID; set
   * `dedupeTransactionIOS` to false only for diagnostics.
   */
  purchaseUpdatedListenerOptions?: PurchaseUpdatedListenerOptions | null;
  /**
   * Called when a hook method such as fetchProducts, getAvailablePurchases,
   * getActiveSubscriptions or restorePurchases fails.
   */
  onError?: (error: Error) => void;
  onPromotedProductIOS?: (product: Product) => void;
  onUserChoiceBillingAndroid?: (details: UserChoiceBillingDetails) => void;
  /**
   * Fires when the user selects developer-provided billing in an External
   * Payments or Google-rendered Billing Choice flow.
   */
  onDeveloperProvidedBillingAndroid?: (
    details: DeveloperProvidedBillingDetailsAndroid,
  ) => void;
  /** Fires when a subscription enters a billing-issue state. */
  onSubscriptionBillingIssue?: (purchase: Purchase) => void;
  /**
   * Enable a specific billing program for Android (8.2.0+).
   * Use 'external-payments' for Developer Provided Billing (Japan only, 8.3.0+).
   * Use 'user-choice-billing' for User Choice Billing (7.0+).
   * Use 'billing-choice' for Billing Choice (9.1.0+).
   */
  enableBillingProgramAndroid?: BillingProgramAndroid;
  /**
   * Select who renders the Billing Choice screen (9.1.0+). Must match the
   * choiceScreenType returned by isBillingProgramAvailableAndroid.
   */
  billingChoiceScreenTypeAndroid?: BillingChoiceScreenTypeAndroid;
}

// A fetched item replaces the one it updates, keeping the list's order.
function mergeByKey<T>(
  existingItems: T[],
  newItems: T[],
  getKey: (item: T) => string,
): T[] {
  const merged = new Map(
    existingItems.map((item) => [getKey(item), item] as const),
  );
  newItems.forEach((item) => merged.set(getKey(item), item));
  return Array.from(merged.values());
}

// Store reads can resolve out of order. A result publishes only when no newer
// read has published, so a failed newer read lets an older result through,
// and a purchase makes every read that started before it stale.
interface ReadOrder {
  started: number;
  published: number;
}
const startRead = (order: ReadOrder): number => ++order.started;
const claimPublish = (order: ReadOrder, read: number): boolean => {
  if (read <= order.published) return false;
  order.published = read;
  return true;
};
const invalidateReads = (order: ReadOrder): void => {
  order.published = ++order.started;
};

/**
 * React Hook for managing In-App Purchases. Mounted hooks share one store
 * connection, which ends when the last of them unmounts.
 * See documentation at https://openiap.dev/docs/setup/expo#useIAP-hook
 */
export function useIAP(options?: UseIAPOptions): UseIap {
  const [connected, setConnected] = useState<boolean>(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [subscriptions, setSubscriptions] = useState<ProductSubscription[]>([]);

  const [availablePurchases, setAvailablePurchases] = useState<Purchase[]>([]);
  const [promotedProductIOS, setPromotedProductIOS] = useState<Product>();
  const [activeSubscriptions, setActiveSubscriptions] = useState<
    ActiveSubscription[]
  >([]);

  const optionsRef = useRef<UseIAPOptions | undefined>(options);
  const connectedRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(false);
  const initializationGenerationRef = useRef(0);
  const startedInitializationGenerationRef = useRef(0);
  const availablePurchasesReads = useRef<ReadOrder>({started: 0, published: 0});
  const activeSubscriptionsReads = useRef<ReadOrder>({
    started: 0,
    published: 0,
  });

  // Before any effect runs, so a purchase never reaches a stale callback.
  useLayoutEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

  const subscriptionsRef = useRef<{
    purchaseUpdate?: EventSubscription;
    purchaseError?: EventSubscription;
    promotedProductIOS?: EventSubscription;
    userChoiceBillingAndroid?: EventSubscription;
    developerProvidedBillingAndroid?: EventSubscription;
    subscriptionBillingIssue?: EventSubscription;
  }>({});

  const subscriptionsRefState = useRef<ProductSubscription[]>([]);

  useEffect(() => {
    subscriptionsRefState.current = subscriptions;
  }, [subscriptions]);

  const normalizeProductQueryType = useCallback(
    (type?: ProductTypeInput): ProductQueryType => {
      if (!type || type === 'in-app') {
        return 'in-app';
      }
      return type;
    },
    [],
  );

  const canonicalProductType = useCallback(
    (value?: string): ProductQueryType => {
      if (!value) {
        return 'in-app';
      }

      const normalized = value.trim().toLowerCase().replace(/[_-]/g, '');
      return normalized === 'subs' ? 'subs' : 'in-app';
    },
    [],
  );

  const toPurchaseInput = useCallback(
    (purchase: Purchase): PurchaseInput => ({
      ...purchase,
      ids: purchase.ids ?? undefined,
    }),
    [],
  );

  const invokeOnError = useCallback((error: unknown) => {
    if (isMountedRef.current && optionsRef.current?.onError) {
      optionsRef.current.onError(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }, []);

  /**
   * Retrieve products or subscriptions from the store by SKU.
   *
   * @param params `ProductRequest` — `skus` (string[]) and optional `type`
   *   (`'in-app' | 'subs' | 'all'`, defaults to `'in-app'`).
   * @returns Promise that resolves when the request is dispatched; results land in the
   *   hook's reactive `products` / `subscriptions` state.
   * @throws When the store rejects the request (empty `skus`, not connected,
   *   network/store error). Unknown SKUs are omitted from the result, not thrown.
   *
   * @example
   * ```ts
   * const { fetchProducts, products } = useIAP();
   * await fetchProducts({
   *   skus: ['com.app.coins_100', 'com.app.premium'],
   *   type: 'in-app',
   * });
   * ```
   *
   * @remarks Promise-based, unlike the event-based `request*` APIs such as `requestPurchase`.
   *
   * @see {@link https://openiap.dev/docs/apis/fetch-products}
   */
  const fetchProductsInternal = useCallback(
    async (params: {
      skus: string[];
      type?: ProductTypeInput;
    }): Promise<void> => {
      try {
        const queryType = normalizeProductQueryType(params.type);
        const request: ProductRequest = {skus: params.skus, type: queryType};
        const result = await fetchProducts(request);
        const items = (result ?? []) as (Product | ProductSubscription)[];

        ExpoIapConsole.debug('Fetched products:', items);

        if (queryType === 'subs') {
          const subscriptionsResult = items as ProductSubscription[];
          setSubscriptions((prevSubscriptions) =>
            mergeByKey(
              prevSubscriptions,
              subscriptionsResult,
              (subscription) => subscription.id,
            ),
          );
        } else if (queryType === 'in-app') {
          const productsResult = items as Product[];
          setProducts((prevProducts) =>
            mergeByKey(prevProducts, productsResult, (product) => product.id),
          );
        } else {
          const productItems = items.filter(
            (item) => canonicalProductType(item.type as string) === 'in-app',
          ) as Product[];

          const subscriptionItems = items.filter(
            (item) => canonicalProductType(item.type as string) === 'subs',
          ) as ProductSubscription[];

          setProducts((prevProducts) =>
            mergeByKey(prevProducts, productItems, (product) => product.id),
          );

          setSubscriptions((prevSubscriptions) =>
            mergeByKey(
              prevSubscriptions,
              subscriptionItems,
              (subscription) => subscription.id,
            ),
          );
        }
      } catch (error) {
        ExpoIapConsole.error('Error fetching products:', error);
        invokeOnError(error);
        throw error;
      }
    },
    [canonicalProductType, invokeOnError, normalizeProductQueryType],
  );

  /**
   * List the user's unfinished purchases: non-consumables, active subscriptions,
   * and pending transactions.
   *
   * @param options Optional `PurchaseOptions`. iOS-only flags:
   *   `alsoPublishToEventListenerIOS`, `onlyIncludeActiveItemsIOS`.
   * @returns Promise that resolves when the request is dispatched; results land in the
   *   hook's reactive `availablePurchases` state.
   * @throws When the platform query fails.
   *
   * @example
   * ```ts
   * const { getAvailablePurchases, availablePurchases } = useIAP();
   * await getAvailablePurchases();
   * for (const p of availablePurchases) {
   *   if (await verifyOnServer(p)) await finishTransaction({ purchase: p, isConsumable: false });
   * }
   * ```
   *
   * @see {@link https://openiap.dev/docs/apis/get-available-purchases}
   */
  const getAvailablePurchasesInternal = useCallback(
    async (options?: PurchaseOptions): Promise<void> => {
      const read = startRead(availablePurchasesReads.current);
      try {
        const result = await getAvailablePurchases({
          alsoPublishToEventListenerIOS:
            options?.alsoPublishToEventListenerIOS ?? false,
          onlyIncludeActiveItemsIOS: options?.onlyIncludeActiveItemsIOS ?? true,
          includeSuspendedAndroid: options?.includeSuspendedAndroid ?? false,
        });
        if (claimPublish(availablePurchasesReads.current, read)) {
          setAvailablePurchases(result);
        }
      } catch (error) {
        ExpoIapConsole.error('Error fetching available purchases:', error);
        invokeOnError(error);
        throw error;
      }
    },
    [invokeOnError],
  );

  /**
   * Get details of all currently active subscriptions.
   *
   * @see {@link https://openiap.dev/docs/apis/get-active-subscriptions}
   */
  const getActiveSubscriptionsInternal = useCallback(
    async (subscriptionIds?: string[]): Promise<void> => {
      const read = startRead(activeSubscriptionsReads.current);
      try {
        const result = await getActiveSubscriptions(subscriptionIds);
        if (claimPublish(activeSubscriptionsReads.current, read)) {
          setActiveSubscriptions(result);
        }
      } catch (error) {
        ExpoIapConsole.error('Error getting active subscriptions:', error);
        invokeOnError(error);
        throw error;
      }
    },
    [invokeOnError],
  );

  /**
   * Check whether the user has any active subscription.
   *
   * @see {@link https://openiap.dev/docs/apis/has-active-subscriptions}
   */
  const hasActiveSubscriptionsInternal = useCallback(
    async (subscriptionIds?: string[]): Promise<boolean> => {
      try {
        return await hasActiveSubscriptions(subscriptionIds);
      } catch (error) {
        ExpoIapConsole.error('Error checking active subscriptions:', error);
        invokeOnError(error);
        throw error;
      }
    },
    [invokeOnError],
  );

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
  const finishTransaction = useCallback(
    async ({
      purchase,
      isConsumable,
    }: {
      purchase: Purchase;
      isConsumable?: boolean;
    }): Promise<void> => {
      await finishTransactionInternal({
        purchase: toPurchaseInput(purchase),
        isConsumable,
      });
    },
    [toPurchaseInput],
  );

  // Replaces the reads a purchase invalidated; a known subscription also
  // refreshes its catalog entry first.
  const refreshAfterPurchase = useCallback(
    async (productId: string) => {
      const generation = initializationGenerationRef.current;
      const isCurrent = (): boolean =>
        isMountedRef.current &&
        initializationGenerationRef.current === generation;
      const ownership = [
        getAvailablePurchasesInternal,
        getActiveSubscriptionsInternal,
      ];
      const refreshes = subscriptionsRefState.current.some(
        (sub) => sub.id === productId,
      )
        ? [
            () => fetchProductsInternal({skus: [productId], type: 'subs'}),
            ...ownership,
          ]
        : ownership;
      for (const refresh of refreshes) {
        if (!isCurrent()) return;
        try {
          await refresh();
        } catch (error) {
          if (isCurrent()) {
            ExpoIapConsole.warn('Failed to refresh after a purchase:', error);
          }
        }
      }
    },
    [
      fetchProductsInternal,
      getAvailablePurchasesInternal,
      getActiveSubscriptionsInternal,
    ],
  );

  /**
   * Restore non-consumable and active subscription purchases.
   *
   * @see {@link https://openiap.dev/docs/apis/restore-purchases}
   */
  const restorePurchasesInternal = useCallback(
    async (options?: PurchaseOptions): Promise<void> => {
      try {
        await restorePurchasesNative();
        await optionsRef.current?.purchaseFlow?.recoverPurchases({
          includeFinished: true,
        });

        const read = startRead(availablePurchasesReads.current);
        const purchases = await getAvailablePurchases({
          alsoPublishToEventListenerIOS:
            options?.alsoPublishToEventListenerIOS ?? false,
          onlyIncludeActiveItemsIOS: options?.onlyIncludeActiveItemsIOS ?? true,
          includeSuspendedAndroid: options?.includeSuspendedAndroid ?? false,
        });
        if (claimPublish(availablePurchasesReads.current, read)) {
          setAvailablePurchases(purchases);
        }
      } catch (error) {
        ExpoIapConsole.warn('Failed to restore purchases:', error);
        invokeOnError(error);
        throw error;
      }
    },
    [invokeOnError],
  );

  /**
   * Verify a purchase against your own backend (returns isValid + raw store metadata).
   *
   * @see {@link https://openiap.dev/docs/features/validation#verify-purchase}
   */
  const verifyPurchase = useCallback(async (props: VerifyPurchaseProps) => {
    return verifyPurchaseInternal(props);
  }, []);

  /**
   * Verify via a managed provider; `iapkit` (IAPKit) is the only one.
   *
   * @see {@link https://openiap.dev/docs/features/validation#verify-purchase-with-provider}
   */
  const verifyPurchaseWithProvider = useCallback(
    async (props: VerifyPurchaseWithProviderProps) => {
      return verifyPurchaseWithProviderInternal(props);
    },
    [],
  );

  const buildConnectionConfig = useCallback(():
    | InitConnectionConfig
    | undefined => {
    if (optionsRef.current?.enableBillingProgramAndroid) {
      return {
        enableBillingProgramAndroid:
          optionsRef.current.enableBillingProgramAndroid,
        ...(optionsRef.current.billingChoiceScreenTypeAndroid
          ? {
              billingChoiceScreenTypeAndroid:
                optionsRef.current.billingChoiceScreenTypeAndroid,
            }
          : {}),
      };
    }

    return undefined;
  }, []);

  const handlePurchaseUpdate = useCallback(
    async (purchase: Purchase): Promise<void> => {
      // Before the callback, which may read again: a read that started before
      // this purchase is stale.
      invalidateReads(availablePurchasesReads.current);
      invalidateReads(activeSubscriptionsReads.current);
      // Deliver first so a store refresh cannot delay finishing the transaction.
      try {
        const callbackResult: unknown =
          optionsRef.current?.onPurchaseSuccess?.(purchase);
        Promise.resolve(callbackResult).catch((error: unknown) => {
          ExpoIapConsole.error('[useIAP] onPurchaseSuccess failed:', error);
        });
      } catch (error) {
        ExpoIapConsole.error('[useIAP] onPurchaseSuccess failed:', error);
      }

      // With a purchase flow, its outcome refreshes once the purchase is
      // finished instead.
      if (!optionsRef.current?.purchaseFlow) {
        await refreshAfterPurchase(purchase.productId);
      }
    },
    [refreshAfterPurchase],
  );

  // Registers only missing listeners, so reconnect can restore removed ones.
  const registerListeners = useCallback(() => {
    const current = subscriptionsRef.current;
    if (!current.purchaseUpdate) {
      current.purchaseUpdate = purchaseUpdatedListener(
        handlePurchaseUpdate,
        optionsRef.current?.purchaseUpdatedListenerOptions,
      );
    }

    if (!current.purchaseError) {
      current.purchaseError = purchaseErrorListener((error: PurchaseError) => {
        if (!connectedRef.current && error.code === ErrorCode.InitConnection) {
          return; // Ignore initialization error before connected
        }
        if (
          error.code !== ErrorCode.AlreadyOwned &&
          !isUserCancelledError(error) &&
          !isRecoverableError(error)
        ) {
          ExpoIapConsole.warn(
            '[useIAP] Purchase error:',
            getUserFriendlyErrorMessage(error),
          );
        }
        optionsRef.current?.onPurchaseError?.(error);
      });
    }

    // Android billing callbacks are read at event time, so they may be set after mount.
    if (Platform.OS === 'android' && !current.userChoiceBillingAndroid) {
      current.userChoiceBillingAndroid = userChoiceBillingListenerAndroid(
        (details) => {
          optionsRef.current?.onUserChoiceBillingAndroid?.(details);
        },
      );
    }

    if (Platform.OS === 'android' && !current.developerProvidedBillingAndroid) {
      current.developerProvidedBillingAndroid =
        developerProvidedBillingListenerAndroid((details) => {
          optionsRef.current?.onDeveloperProvidedBillingAndroid?.(details);
        });
    }

    if (!current.subscriptionBillingIssue) {
      current.subscriptionBillingIssue = subscriptionBillingIssueListener(
        (purchase) => {
          optionsRef.current?.onSubscriptionBillingIssue?.(purchase);
        },
      );
    }

    if (Platform.OS === 'ios' && !current.promotedProductIOS) {
      current.promotedProductIOS = promotedProductListenerIOS(
        (product: Product) => {
          setPromotedProductIOS(product);
          optionsRef.current?.onPromotedProductIOS?.(product);
        },
      );
    }
  }, [handlePurchaseUpdate]);

  /**
   * Initiate a purchase or subscription flow. The result arrives through
   * `purchaseUpdatedListener` / `purchaseErrorListener`, not the return value.
   *
   * @param props `RequestPurchaseProps`, discriminated by `type`:
   *   - `type: 'in-app'` — pass `request.apple.sku` (iOS) and/or `request.google.skus` (Android).
   *   - `type: 'subs'`  — same shape, plus `request.google.subscriptionOffers: [{ sku, offerToken }]`.
   * @returns Promise that resolves when the request is dispatched; the actual purchase
   *   outcome lands in the hook's `onPurchaseSuccess` / `onPurchaseError` callbacks.
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
  const requestPurchase = useCallback(
    (requestObj: MutationRequestPurchaseArgs) => {
      // A failed hook init removes the purchase listener; restore it before buying.
      if (isMountedRef.current) {
        registerListeners();
      }
      return requestPurchaseInternal(requestObj);
    },
    [registerListeners],
  );

  // Purchase-error listening stays on so later retries still report errors.
  const removePurchaseListeners = useCallback(() => {
    subscriptionsRef.current.purchaseUpdate?.remove();
    subscriptionsRef.current.promotedProductIOS?.remove();
    subscriptionsRef.current.purchaseUpdate = undefined;
    subscriptionsRef.current.promotedProductIOS = undefined;
  }, []);

  const cleanupListeners = useCallback(() => {
    const current = subscriptionsRef.current;
    current.purchaseUpdate?.remove();
    current.purchaseError?.remove();
    current.promotedProductIOS?.remove();
    current.userChoiceBillingAndroid?.remove();
    current.developerProvidedBillingAndroid?.remove();
    current.subscriptionBillingIssue?.remove();
    subscriptionsRef.current = {};
  }, []);

  const initIapWithSubscriptions = useCallback(
    async (generation: number): Promise<void> => {
      if (
        !isMountedRef.current ||
        initializationGenerationRef.current !== generation
      ) {
        return;
      }
      startedInitializationGenerationRef.current = generation;
      connectionOwnerCount += 1;

      // Register listeners before initConnection; events can fire as soon as it connects.
      registerListeners();

      const config = buildConnectionConfig();

      try {
        const result = await initConnection(config);
        if (
          !isMountedRef.current ||
          initializationGenerationRef.current !== generation
        ) {
          if (startedInitializationGenerationRef.current === generation) {
            startedInitializationGenerationRef.current = 0;
            releaseConnection();
          }
          return;
        }
        setConnected(result);
        if (!result) {
          ExpoIapConsole.warn(
            '[useIAP] Connection failed, cleaning up listeners...',
          );
          removePurchaseListeners();
        }
      } catch (error) {
        if (
          !isMountedRef.current ||
          initializationGenerationRef.current !== generation
        ) {
          return;
        }
        ExpoIapConsole.error('initConnection failed:', error);
        invokeOnError(error);
        removePurchaseListeners();
      }
    },
    [
      buildConnectionConfig,
      registerListeners,
      removePurchaseListeners,
      invokeOnError,
    ],
  );

  const reconnect = useCallback(async (): Promise<boolean> => {
    const config = buildConnectionConfig();

    try {
      const result = await initConnection(config);
      setConnected(result);

      if (result) {
        registerListeners();
      }

      return result;
    } catch (error) {
      ExpoIapConsole.error('[useIAP] reconnect failed:', error);
      invokeOnError(error);
      return false;
    }
  }, [buildConnectionConfig, registerListeners, invokeOnError]);

  const purchaseFlow = options?.purchaseFlow;
  useEffect(
    () =>
      purchaseFlow?.subscribe((outcome) => {
        // Reads that started before the purchase settled are stale.
        invalidateReads(availablePurchasesReads.current);
        invalidateReads(activeSubscriptionsReads.current);
        try {
          optionsRef.current?.onPurchaseFlowOutcome?.(outcome);
        } catch (error) {
          ExpoIapConsole.error('[useIAP] onPurchaseFlowOutcome failed:', error);
        }
        void refreshAfterPurchase(outcome.purchase.productId);
      }),
    [purchaseFlow, refreshAfterPurchase],
  );

  // Once connected, and again for a new account's flow.
  useEffect(() => {
    if (!connected || !purchaseFlow) return;
    purchaseFlow.recoverPurchases().catch((error: unknown) => {
      ExpoIapConsole.warn('[useIAP] purchase recovery failed:', error);
      invokeOnError(error);
    });
  }, [connected, purchaseFlow, invokeOnError]);

  useEffect(() => {
    const generation = ++initializationGenerationRef.current;
    isMountedRef.current = true;
    void Promise.resolve().then(() => initIapWithSubscriptions(generation));

    return () => {
      isMountedRef.current = false;
      cleanupListeners();
      if (startedInitializationGenerationRef.current === generation) {
        startedInitializationGenerationRef.current = 0;
        releaseConnection();
      }
      setConnected(false);
    };
  }, [initIapWithSubscriptions, cleanupListeners]);

  return {
    connected,
    products,
    subscriptions,
    finishTransaction,
    availablePurchases,
    promotedProductIOS,
    activeSubscriptions,
    getAvailablePurchases: getAvailablePurchasesInternal,
    fetchProducts: fetchProductsInternal,
    requestPurchase,
    verifyPurchase,
    verifyPurchaseWithProvider,
    restorePurchases: restorePurchasesInternal,
    getPromotedProductIOS,
    getActiveSubscriptions: getActiveSubscriptionsInternal,
    hasActiveSubscriptions: hasActiveSubscriptionsInternal,
    reconnect,
    getBillingChoiceInfoAndroid,
    isBillingProgramAvailableAndroid,
    createBillingProgramReportingDetailsAndroid,
    launchExternalLinkAndroid,
    showBillingProgramInformationDialogAndroid,
    showInAppMessagesAndroid,
    // Offer code redemption
    openRedeemOfferCode,
  };
}
