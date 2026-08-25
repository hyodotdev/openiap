// External dependencies
import {useCallback, useEffect, useState, useRef} from 'react';
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
import {getPromotedProductIOS} from './modules/ios';
import {restorePurchasesIOSNative} from './utils/restorePurchases';
import {
  getBillingChoiceInfoAndroid,
  isBillingProgramAvailableAndroid,
  createBillingProgramReportingDetailsAndroid,
  launchExternalLinkAndroid,
  showBillingProgramInformationDialogAndroid,
  showInAppMessagesAndroid,
  openRedeemOfferCodeAndroid,
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

const PURCHASE_DELIVERY_DEDUP_WINDOW_MS = 30_000;

function getPurchaseDeliveryKey(purchase: Purchase): string {
  return [
    purchase.store ?? '',
    purchase.productId ?? '',
    purchase.purchaseToken ??
      purchase.transactionId ??
      purchase.id ??
      purchase.transactionDate ??
      '',
  ].join(':');
}

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
  /**
   * @deprecated Use `openRedeemOfferCode` instead. Scheduled for removal in
   * OpenIAP 4.0.
   */
  openRedeemOfferCodeAndroid: MutationField<'openRedeemOfferCodeAndroid'>;
};

export interface UseIAPOptions {
  onPurchaseSuccess?: (purchase: Purchase) => void;
  onPurchaseError?: (error: PurchaseError) => void;
  /**
   * iOS only. When enabled, the purchase success listener also receives
   * StoreKit replay events for a transaction ID already delivered during the
   * current connection session. Defaults to false.
   */
  purchaseUpdatedListenerOptions?: PurchaseUpdatedListenerOptions | null;
  /**
   * Callback for general errors from hook methods like fetchProducts,
   * getAvailablePurchases, getActiveSubscriptions, restorePurchases, etc.
   * These are Promise-based operations that can fail due to network issues
   * or store unavailability.
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
   * Enable a specific billing program for Android (8.2.0+)
   * When set, enables the specified billing program for external transactions.
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

/**
 * React Hook for managing In-App Purchases.
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
  const deliveredPurchaseKeysRef = useRef(new Set<string>());

  // Helper function to merge arrays with duplicate checking
  const mergeWithDuplicateCheck = useCallback(
    <T>(
      existingItems: T[],
      newItems: T[],
      getKey: (item: T) => string,
    ): T[] => {
      const merged = [...existingItems];
      newItems.forEach((newItem) => {
        const isDuplicate = merged.some(
          (existingItem) => getKey(existingItem) === getKey(newItem),
        );
        if (!isDuplicate) {
          merged.push(newItem);
        }
      });
      return merged;
    },
    [],
  );

  useEffect(() => {
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
      id: purchase.id,
      ids: purchase.ids ?? undefined,
      isAutoRenewing: purchase.isAutoRenewing,
      productId: purchase.productId,
      purchaseState: purchase.purchaseState,
      purchaseToken: purchase.purchaseToken ?? null,
      quantity: purchase.quantity,
      store: purchase.store,
      transactionDate: purchase.transactionDate,
      transactionId: purchase.transactionId,
    }),
    [],
  );

  const markPurchaseDelivered = useCallback((purchase: Purchase): boolean => {
    const key = getPurchaseDeliveryKey(purchase);
    if (deliveredPurchaseKeysRef.current.has(key)) {
      return false;
    }

    deliveredPurchaseKeysRef.current.add(key);
    setTimeout(() => {
      deliveredPurchaseKeysRef.current.delete(key);
    }, PURCHASE_DELIVERY_DEDUP_WINDOW_MS);
    return true;
  }, []);

  // Helper function to invoke onError callback
  const invokeOnError = useCallback((error: unknown) => {
    if (optionsRef.current?.onError) {
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
   *   network/store error). Unknown SKUs are simply omitted from the result, not thrown.
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
   * @remarks This is a regular promise-based call. Don't confuse with `request*` APIs
   *   (`requestPurchase`), which are event-based.
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
            mergeWithDuplicateCheck(
              prevSubscriptions,
              subscriptionsResult,
              (subscription) => subscription.id,
            ),
          );
        } else if (queryType === 'in-app') {
          const productsResult = items as Product[];
          setProducts((prevProducts) =>
            mergeWithDuplicateCheck(
              prevProducts,
              productsResult,
              (product) => product.id,
            ),
          );
        } else {
          const productItems = items.filter(
            (item) => canonicalProductType(item.type as string) === 'in-app',
          ) as Product[];

          const subscriptionItems = items.filter(
            (item) => canonicalProductType(item.type as string) === 'subs',
          ) as ProductSubscription[];

          setProducts((prevProducts) =>
            mergeWithDuplicateCheck(
              prevProducts,
              productItems,
              (product) => product.id,
            ),
          );

          setSubscriptions((prevSubscriptions) =>
            mergeWithDuplicateCheck(
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
    [
      canonicalProductType,
      invokeOnError,
      mergeWithDuplicateCheck,
      normalizeProductQueryType,
    ],
  );

  /**
   * List the user's unfinished purchases — non-consumables, active subscriptions, and any
   * pending transactions not yet finished.
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
      try {
        const result = await getAvailablePurchases({
          alsoPublishToEventListenerIOS:
            options?.alsoPublishToEventListenerIOS ?? false,
          onlyIncludeActiveItemsIOS: options?.onlyIncludeActiveItemsIOS ?? true,
          includeSuspendedAndroid: options?.includeSuspendedAndroid ?? false,
        });
        setAvailablePurchases(result);
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
      try {
        const result = await getActiveSubscriptions(subscriptionIds);
        setActiveSubscriptions(result);
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
   * @remarks **Critical:** Android purchases must be finalized within 3 days or Google
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

  const refreshSubscriptionStatus = useCallback(
    async (productId: string) => {
      try {
        if (subscriptionsRefState.current.some((sub) => sub.id === productId)) {
          await fetchProductsInternal({skus: [productId], type: 'subs'});
          await getAvailablePurchasesInternal();
          await getActiveSubscriptionsInternal();
        }
      } catch (error) {
        ExpoIapConsole.warn('Failed to refresh subscription status:', error);
      }
    },
    [
      fetchProductsInternal,
      getAvailablePurchasesInternal,
      getActiveSubscriptionsInternal,
    ],
  );

  /**
   * Initiate a purchase or subscription flow. The result is delivered through
   * `purchaseUpdatedListener` — NOT the return value.
   *
   * @param props `RequestPurchaseProps`, discriminated by `type`:
   *   - `type: 'in-app'` — pass `request.apple.sku` (iOS) and/or `request.google.skus` (Android).
   *   - `type: 'subs'`  — same shape, plus `request.google.subscriptionOffers: [{ sku, offerToken }]`.
   * @returns Promise that resolves when the request is dispatched; the actual purchase
   *   outcome lands in the hook's `onPurchaseSuccess` / `onPurchaseError` callbacks.
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
  const requestPurchaseWithReset = useCallback(
    async (requestObj: MutationRequestPurchaseArgs) => {
      const purchaseResult = await requestPurchaseInternal(requestObj);
      const purchases = Array.isArray(purchaseResult)
        ? purchaseResult
        : purchaseResult
        ? [purchaseResult]
        : [];

      for (const purchase of purchases ?? []) {
        if (!markPurchaseDelivered(purchase)) {
          continue;
        }

        if (purchase.productId) {
          await refreshSubscriptionStatus(purchase.productId);
        }
        if (optionsRef.current?.onPurchaseSuccess) {
          optionsRef.current.onPurchaseSuccess(purchase);
        }
      }

      return purchaseResult;
    },
    [markPurchaseDelivered, refreshSubscriptionStatus],
  );

  /**
   * Restore non-consumable and active subscription purchases.
   *
   * @see {@link https://openiap.dev/docs/apis/restore-purchases}
   */
  const restorePurchasesInternal = useCallback(
    async (options?: PurchaseOptions): Promise<void> => {
      try {
        if (Platform.OS === 'ios') {
          await restorePurchasesIOSNative();
        }

        const purchases = await getAvailablePurchases({
          alsoPublishToEventListenerIOS:
            options?.alsoPublishToEventListenerIOS ?? false,
          onlyIncludeActiveItemsIOS: options?.onlyIncludeActiveItemsIOS ?? true,
          includeSuspendedAndroid: options?.includeSuspendedAndroid ?? false,
        });
        setAvailablePurchases(purchases);
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
   * Verify via a managed provider — currently only `iapkit` (IAPKit). The PurchaseVerificationProvider enum exposes no other provider literal today.
   *
   * @see {@link https://openiap.dev/docs/features/validation#verify-purchase-with-provider}
   */
  const verifyPurchaseWithProvider = useCallback(
    async (props: VerifyPurchaseWithProviderProps) => {
      return verifyPurchaseWithProviderInternal(props);
    },
    [],
  );

  // Build the canonical billing-program connection config.
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

  const initIapWithSubscriptions = useCallback(
    async (generation: number): Promise<void> => {
      if (
        !isMountedRef.current ||
        initializationGenerationRef.current !== generation
      ) {
        return;
      }
      startedInitializationGenerationRef.current = generation;

      // CRITICAL: Register listeners BEFORE initConnection to avoid race condition
      // Events might fire immediately after initConnection, so listeners must be ready
      // Register purchase update listener BEFORE initConnection to avoid race conditions.
      subscriptionsRef.current.purchaseUpdate = purchaseUpdatedListener(
        async (purchase: Purchase) => {
          if (!markPurchaseDelivered(purchase)) {
            return;
          }

          // Refresh subscription status for both iOS and Android subscription purchases.
          // refreshSubscriptionStatus internally checks whether the product is a known
          // subscription, so it is safe to call unconditionally for any purchase event.
          await refreshSubscriptionStatus(purchase.productId);

          if (optionsRef.current?.onPurchaseSuccess) {
            optionsRef.current.onPurchaseSuccess(purchase);
          }
        },
        optionsRef.current?.purchaseUpdatedListenerOptions,
      );

      // Register purchase error listener EARLY. Ignore init-related errors until connected.
      subscriptionsRef.current.purchaseError = purchaseErrorListener(
        (error: PurchaseError) => {
          if (
            !connectedRef.current &&
            error.code === ErrorCode.InitConnection
          ) {
            return; // Ignore initialization error before connected
          }
          const friendly = getUserFriendlyErrorMessage(error);
          if (
            error?.code !== ErrorCode.AlreadyOwned &&
            error?.code !== ErrorCode.ServiceTimeout &&
            !isUserCancelledError(error) &&
            !isRecoverableError(error)
          ) {
            ExpoIapConsole.warn('[useIAP] Purchase error:', friendly);
          }

          if (optionsRef.current?.onPurchaseError) {
            optionsRef.current.onPurchaseError(error);
          }
        },
      );

      if (
        Platform.OS === 'android' &&
        optionsRef.current?.onUserChoiceBillingAndroid
      ) {
        subscriptionsRef.current.userChoiceBillingAndroid =
          userChoiceBillingListenerAndroid((details) => {
            optionsRef.current?.onUserChoiceBillingAndroid?.(details);
          });
      }

      if (
        Platform.OS === 'android' &&
        optionsRef.current?.onDeveloperProvidedBillingAndroid
      ) {
        subscriptionsRef.current.developerProvidedBillingAndroid =
          developerProvidedBillingListenerAndroid((details) => {
            optionsRef.current?.onDeveloperProvidedBillingAndroid?.(details);
          });
      }

      subscriptionsRef.current.subscriptionBillingIssue =
        subscriptionBillingIssueListener((purchase) => {
          optionsRef.current?.onSubscriptionBillingIssue?.(purchase);
        });

      if (Platform.OS === 'ios') {
        // iOS promoted products listener
        subscriptionsRef.current.promotedProductIOS =
          promotedProductListenerIOS((product: Product) => {
            setPromotedProductIOS(product);

            if (optionsRef.current?.onPromotedProductIOS) {
              optionsRef.current.onPromotedProductIOS(product);
            }
          });
      }

      // NOW call initConnection after listeners are ready
      const config = buildConnectionConfig();

      try {
        const result = await initConnection(config);
        if (
          !isMountedRef.current ||
          initializationGenerationRef.current !== generation
        ) {
          if (startedInitializationGenerationRef.current === generation) {
            startedInitializationGenerationRef.current = 0;
            await endConnection();
          }
          return;
        }
        setConnected(result);
        if (!result) {
          // If connection failed, clean up listeners
          ExpoIapConsole.warn(
            '[useIAP] Connection failed, cleaning up listeners...',
          );
          subscriptionsRef.current.purchaseUpdate?.remove();
          subscriptionsRef.current.promotedProductIOS?.remove();
          subscriptionsRef.current.purchaseUpdate = undefined;
          subscriptionsRef.current.promotedProductIOS = undefined;
          // Keep purchaseError listener registered to capture subsequent retries
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
        // Clean up listeners on error
        subscriptionsRef.current.purchaseUpdate?.remove();
        subscriptionsRef.current.promotedProductIOS?.remove();
        subscriptionsRef.current.purchaseUpdate = undefined;
        subscriptionsRef.current.promotedProductIOS = undefined;
      }
    },
    [
      buildConnectionConfig,
      markPurchaseDelivered,
      refreshSubscriptionStatus,
      invokeOnError,
    ],
  );

  // Manual reconnect method for when the initial auto-connect fails.
  // Re-runs initConnection and updates the connected state.
  // Re-registers event listeners if they were cleaned up during a previous failure.
  const reconnect = useCallback(async (): Promise<boolean> => {
    const config = buildConnectionConfig();

    try {
      const result = await initConnection(config);
      setConnected(result);

      if (result) {
        // Re-register listeners if they were cleaned up during a previous failure
        if (!subscriptionsRef.current.purchaseUpdate) {
          subscriptionsRef.current.purchaseUpdate = purchaseUpdatedListener(
            async (purchase: Purchase) => {
              if (!markPurchaseDelivered(purchase)) {
                return;
              }

              await refreshSubscriptionStatus(purchase.productId);

              if (optionsRef.current?.onPurchaseSuccess) {
                optionsRef.current.onPurchaseSuccess(purchase);
              }
            },
            optionsRef.current?.purchaseUpdatedListenerOptions,
          );
        }

        if (
          Platform.OS === 'ios' &&
          !subscriptionsRef.current.promotedProductIOS
        ) {
          subscriptionsRef.current.promotedProductIOS =
            promotedProductListenerIOS((product: Product) => {
              setPromotedProductIOS(product);

              if (optionsRef.current?.onPromotedProductIOS) {
                optionsRef.current.onPromotedProductIOS(product);
              }
            });
        }
      }

      return result;
    } catch (error) {
      ExpoIapConsole.error('[useIAP] reconnect failed:', error);
      invokeOnError(error);
      return false;
    }
  }, [
    buildConnectionConfig,
    markPurchaseDelivered,
    refreshSubscriptionStatus,
    invokeOnError,
  ]);

  useEffect(() => {
    const generation = ++initializationGenerationRef.current;
    isMountedRef.current = true;
    void Promise.resolve().then(() => initIapWithSubscriptions(generation));
    const currentSubscriptions = subscriptionsRef.current;

    return () => {
      isMountedRef.current = false;
      currentSubscriptions.purchaseUpdate?.remove();
      currentSubscriptions.purchaseError?.remove();
      currentSubscriptions.promotedProductIOS?.remove();
      currentSubscriptions.userChoiceBillingAndroid?.remove();
      currentSubscriptions.developerProvidedBillingAndroid?.remove();
      currentSubscriptions.subscriptionBillingIssue?.remove();
      if (startedInitializationGenerationRef.current === generation) {
        startedInitializationGenerationRef.current = 0;
        void endConnection();
      }
      setConnected(false);
    };
  }, [initIapWithSubscriptions]);

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
    requestPurchase: requestPurchaseWithReset,
    verifyPurchase,
    verifyPurchaseWithProvider,
    restorePurchases: restorePurchasesInternal,
    // internal getters kept for hook state management
    getPromotedProductIOS,
    getActiveSubscriptions: getActiveSubscriptionsInternal,
    hasActiveSubscriptions: hasActiveSubscriptionsInternal,
    // Reconnect method for manual retry
    reconnect,
    getBillingChoiceInfoAndroid,
    isBillingProgramAvailableAndroid,
    createBillingProgramReportingDetailsAndroid,
    launchExternalLinkAndroid,
    showBillingProgramInformationDialogAndroid,
    showInAppMessagesAndroid,
    // Offer code redemption
    openRedeemOfferCode,
    openRedeemOfferCodeAndroid,
  };
}
