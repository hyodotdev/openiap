// External dependencies
import {useCallback, useEffect, useState, useRef} from 'react';
import {Platform} from 'react-native';
import {EventSubscription} from 'expo-modules-core';

// Internal modules
import {
  endConnection,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  promotedProductListenerIOS,
  getAvailablePurchases,
  finishTransaction as finishTransactionInternal,
  requestPurchase as requestPurchaseInternal,
  fetchProducts,
  validateReceipt as validateReceiptInternal,
  verifyPurchase as verifyPurchaseInternal,
  verifyPurchaseWithProvider as verifyPurchaseWithProviderInternal,
  getActiveSubscriptions,
  hasActiveSubscriptions,
  type ActiveSubscription,
  type ProductTypeInput,
} from './index';
import {ExpoIapConsole} from './utils/debug';
import {
  getPromotedProductIOS,
  requestPurchaseOnPromotedProductIOS,
  syncIOS,
} from './modules/ios';
import {
  checkAlternativeBillingAvailabilityAndroid,
  showAlternativeBillingDialogAndroid,
  createAlternativeBillingTokenAndroid,
} from './modules/android';

// Types
import type {
  Product,
  ProductSubscription,
  ProductQueryType,
  ProductRequest,
  Purchase,
  MutationRequestPurchaseArgs,
  PurchaseInput,
  VerifyPurchaseProps,
  VerifyPurchaseResult,
  VerifyPurchaseWithProviderProps,
  VerifyPurchaseWithProviderResult,
  ProductAndroid,
  ProductSubscriptionIOS,
  PurchaseOptions,
} from './types';
import {ErrorCode} from './types';
import type {PurchaseError} from './utils/errorMapping';
import {
  getUserFriendlyErrorMessage,
  isUserCancelledError,
  isRecoverableError,
} from './utils/errorMapping';

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
  /** @deprecated Use verifyPurchase instead */
  validateReceipt: (
    props: VerifyPurchaseProps,
  ) => Promise<VerifyPurchaseResult>;
  verifyPurchase: (props: VerifyPurchaseProps) => Promise<VerifyPurchaseResult>;
  verifyPurchaseWithProvider: (
    props: VerifyPurchaseWithProviderProps,
  ) => Promise<VerifyPurchaseWithProviderResult>;
  restorePurchases: (options?: PurchaseOptions) => Promise<void>;
  getPromotedProductIOS: () => Promise<Product | null>;
  /**
   * @deprecated Use promotedProductListenerIOS to receive the productId,
   * then call requestPurchase with that SKU instead.
   */
  requestPurchaseOnPromotedProductIOS: () => Promise<boolean>;
  getActiveSubscriptions: (subscriptionIds?: string[]) => Promise<void>;
  hasActiveSubscriptions: (subscriptionIds?: string[]) => Promise<boolean>;
  /**
   * Manually retry the store connection.
   * Useful when the initial auto-connect fails (e.g., Play Store not ready at mount time).
   * Updates the `connected` state on success.
   */
  reconnect: () => Promise<boolean>;
  checkAlternativeBillingAvailabilityAndroid: () => Promise<boolean>;
  showAlternativeBillingDialogAndroid: () => Promise<boolean>;
  createAlternativeBillingTokenAndroid: (
    sku?: string,
  ) => Promise<string | null>;
};

export interface UseIAPOptions {
  onPurchaseSuccess?: (purchase: Purchase) => void;
  onPurchaseError?: (error: PurchaseError) => void;
  /**
   * Callback for general errors from hook methods like fetchProducts,
   * getAvailablePurchases, getActiveSubscriptions, restorePurchases, etc.
   * These are Promise-based operations that can fail due to network issues
   * or store unavailability.
   */
  onError?: (error: Error) => void;
  onPromotedProductIOS?: (product: Product) => void;
  /**
   * Alternative billing mode for Android
   * If not specified, defaults to NONE (standard Google Play billing)
   * @deprecated Use enableBillingProgramAndroid instead.
   * - 'user-choice' → 'user-choice-billing'
   * - 'alternative-only' → 'external-offer'
   */
  alternativeBillingModeAndroid?: 'none' | 'user-choice' | 'alternative-only';
  /**
   * Enable a specific billing program for Android (8.2.0+)
   * When set, enables the specified billing program for external transactions.
   * Use 'external-payments' for Developer Provided Billing (Japan only, 8.3.0+).
   * Use 'user-choice-billing' for User Choice Billing (7.0+).
   */
  enableBillingProgramAndroid?:
    | 'unspecified'
    | 'external-content-link'
    | 'external-offer'
    | 'external-payments'
    | 'user-choice-billing';
}

/**
 * React Hook for managing In-App Purchases.
 * See documentation at https://hyochan.github.io/expo-iap/docs/hooks/useIAP
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
  }>({});

  const subscriptionsRefState = useRef<ProductSubscription[]>([]);

  useEffect(() => {
    subscriptionsRefState.current = subscriptions;
  }, [subscriptions]);

  const normalizeProductQueryType = useCallback(
    (type?: ProductTypeInput): ProductQueryType => {
      if (!type || type === 'inapp' || type === 'in-app') {
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
      platform: purchase.platform,
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
   * @throws When the store rejects the request (unknown SKU, network, not connected).
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
   * @see {@link https://www.openiap.dev/docs/apis/fetch-products}
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
          // For 'all' type, need to properly distinguish between products and subscriptions
          // On Android, check subscriptionOfferDetailsAndroid to determine if it's a real subscription
          const productItems = items.filter((item) => {
            // iOS: check type
            if (Platform.OS === 'ios') {
              return canonicalProductType(item.type as string) === 'in-app';
            }
            // Android: check if it has actual subscription details
            const androidItem = item as ProductAndroid;
            return (
              !androidItem.subscriptionOfferDetailsAndroid ||
              (Array.isArray(androidItem.subscriptionOfferDetailsAndroid) &&
                androidItem.subscriptionOfferDetailsAndroid.length === 0)
            );
          }) as Product[];

          const subscriptionItems = items.filter((item) => {
            // iOS: check type
            if (Platform.OS === 'ios') {
              return (
                canonicalProductType(
                  item.type as ProductSubscriptionIOS['type'],
                ) === 'subs'
              );
            }
            // Android: check if it has actual subscription details
            const androidItem = item as ProductAndroid;

            return (
              androidItem.subscriptionOfferDetailsAndroid &&
              Array.isArray(androidItem.subscriptionOfferDetailsAndroid) &&
              androidItem.subscriptionOfferDetailsAndroid.length > 0
            );
          }) as ProductSubscription[];

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
   * @see {@link https://www.openiap.dev/docs/apis/get-available-purchases}
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
   * @see {@link https://www.openiap.dev/docs/apis/get-active-subscriptions}
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
   * @see {@link https://www.openiap.dev/docs/apis/has-active-subscriptions}
   */
  const hasActiveSubscriptionsInternal = useCallback(
    async (subscriptionIds?: string[]): Promise<boolean> => {
      try {
        return await hasActiveSubscriptions(subscriptionIds);
      } catch (error) {
        ExpoIapConsole.error('Error checking active subscriptions:', error);
        return false;
      }
    },
    [],
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
   * @see {@link https://www.openiap.dev/docs/apis/finish-transaction}
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
   * @see {@link https://www.openiap.dev/docs/apis/request-purchase}
   */
  const requestPurchaseWithReset = useCallback(
    (requestObj: MutationRequestPurchaseArgs) => {
      return requestPurchaseInternal(requestObj);
    },
    [],
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
   * Restore non-consumable and active subscription purchases.
   *
   * @see {@link https://www.openiap.dev/docs/apis/restore-purchases}
   */
  const restorePurchasesInternal = useCallback(
    async (options?: PurchaseOptions): Promise<void> => {
      try {
        // iOS: Try to sync first, but don't fail if sync errors occur
        if (Platform.OS === 'ios') {
          await syncIOS().catch(() => undefined); // syncIOS returns Promise<boolean>, we don't need the result
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
   * Deprecated. Use verifyPurchase instead — same input/output shape.
   *
   * @see {@link https://www.openiap.dev/docs/apis/validate-receipt}
   */
  const validateReceipt = useCallback(async (props: VerifyPurchaseProps) => {
    return validateReceiptInternal(props);
  }, []);

  /**
   * Verify a purchase against your own backend (returns isValid + raw store metadata).
   *
   * @see {@link https://www.openiap.dev/docs/features/validation#verify-purchase}
   */
  const verifyPurchase = useCallback(async (props: VerifyPurchaseProps) => {
    return verifyPurchaseInternal(props);
  }, []);

  /**
   * Verify via a managed provider — currently only `iapkit` (IAPKit). The PurchaseVerificationProvider enum exposes no other provider literal today.
   *
   * @see {@link https://www.openiap.dev/docs/features/validation#verify-purchase-with-provider}
   */
  const verifyPurchaseWithProvider = useCallback(
    async (props: VerifyPurchaseWithProviderProps) => {
      return verifyPurchaseWithProviderInternal(props);
    },
    [],
  );

  // Build config from options (prefer new enableBillingProgramAndroid over deprecated alternativeBillingModeAndroid)
  const buildConnectionConfig = useCallback(() => {
    return optionsRef.current?.enableBillingProgramAndroid ||
      optionsRef.current?.alternativeBillingModeAndroid
      ? {
          enableBillingProgramAndroid:
            optionsRef.current.enableBillingProgramAndroid,
          alternativeBillingModeAndroid:
            optionsRef.current.alternativeBillingModeAndroid,
        }
      : undefined;
  }, []);

  const initIapWithSubscriptions = useCallback(async (): Promise<void> => {
    // CRITICAL: Register listeners BEFORE initConnection to avoid race condition
    // Events might fire immediately after initConnection, so listeners must be ready
    // Register purchase update listener BEFORE initConnection to avoid race conditions.
    subscriptionsRef.current.purchaseUpdate = purchaseUpdatedListener(
      async (purchase: Purchase) => {
        // Refresh subscription status for both iOS and Android subscription purchases.
        // refreshSubscriptionStatus internally checks whether the product is a known
        // subscription, so it is safe to call unconditionally for any purchase event.
        await refreshSubscriptionStatus(purchase.productId);

        if (optionsRef.current?.onPurchaseSuccess) {
          optionsRef.current.onPurchaseSuccess(purchase);
        }
      },
    );

    // Register purchase error listener EARLY. Ignore init-related errors until connected.
    subscriptionsRef.current.purchaseError = purchaseErrorListener(
      (error: PurchaseError) => {
        if (!connectedRef.current && error.code === ErrorCode.InitConnection) {
          return; // Ignore initialization error before connected
        }
        const friendly = getUserFriendlyErrorMessage(error);
        if (!isUserCancelledError(error) && !isRecoverableError(error)) {
          ExpoIapConsole.warn('[useIAP] Purchase error:', friendly);
        }

        if (optionsRef.current?.onPurchaseError) {
          optionsRef.current.onPurchaseError(error);
        }
      },
    );

    if (Platform.OS === 'ios') {
      // iOS promoted products listener
      subscriptionsRef.current.promotedProductIOS = promotedProductListenerIOS(
        (product: Product) => {
          setPromotedProductIOS(product);

          if (optionsRef.current?.onPromotedProductIOS) {
            optionsRef.current.onPromotedProductIOS(product);
          }
        },
      );
    }

    // NOW call initConnection after listeners are ready
    const config = buildConnectionConfig();

    try {
      const result = await initConnection(config);
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
      ExpoIapConsole.error('initConnection failed:', error);
      invokeOnError(error);
      // Clean up listeners on error
      subscriptionsRef.current.purchaseUpdate?.remove();
      subscriptionsRef.current.promotedProductIOS?.remove();
      subscriptionsRef.current.purchaseUpdate = undefined;
      subscriptionsRef.current.promotedProductIOS = undefined;
    }
  }, [buildConnectionConfig, refreshSubscriptionStatus, invokeOnError]);

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
              await refreshSubscriptionStatus(purchase.productId);

              if (optionsRef.current?.onPurchaseSuccess) {
                optionsRef.current.onPurchaseSuccess(purchase);
              }
            },
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
  }, [buildConnectionConfig, refreshSubscriptionStatus, invokeOnError]);

  useEffect(() => {
    initIapWithSubscriptions();
    const currentSubscriptions = subscriptionsRef.current;

    return () => {
      currentSubscriptions.purchaseUpdate?.remove();
      currentSubscriptions.purchaseError?.remove();
      currentSubscriptions.promotedProductIOS?.remove();
      endConnection();
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
    validateReceipt,
    verifyPurchase,
    verifyPurchaseWithProvider,
    restorePurchases: restorePurchasesInternal,
    // internal getters kept for hook state management
    getPromotedProductIOS,
    requestPurchaseOnPromotedProductIOS,
    getActiveSubscriptions: getActiveSubscriptionsInternal,
    hasActiveSubscriptions: hasActiveSubscriptionsInternal,
    // Reconnect method for manual retry
    reconnect,
    // Alternative billing methods (Android only)
    checkAlternativeBillingAvailabilityAndroid,
    showAlternativeBillingDialogAndroid,
    createAlternativeBillingTokenAndroid,
  };
}
