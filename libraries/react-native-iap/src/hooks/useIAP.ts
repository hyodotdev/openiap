// External dependencies
import {useCallback, useEffect, useState, useRef} from 'react';
import {Platform} from 'react-native';
import {RnIapConsole} from '../utils/debug';
import {createPurchaseError} from '../utils/errorMapping';

// Internal modules
import {
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  promotedProductListenerIOS,
  getAvailablePurchases,
  finishTransaction as finishTransactionInternal,
  requestPurchase as requestPurchaseInternal,
  fetchProducts,
  verifyPurchase as verifyPurchaseTopLevel,
  verifyPurchaseWithProvider as verifyPurchaseWithProviderTopLevel,
  getActiveSubscriptions,
  hasActiveSubscriptions,
  syncIOS,
  getPromotedProductIOS,
  getBillingChoiceInfoAndroid,
  isBillingProgramAvailableAndroid,
  createBillingProgramReportingDetailsAndroid,
  launchExternalLinkAndroid,
  showBillingProgramInformationDialogAndroid,
  showInAppMessagesAndroid,
  openRedeemOfferCode,
  openRedeemOfferCodeAndroid,
  userChoiceBillingListenerAndroid,
  developerProvidedBillingListenerAndroid,
  subscriptionBillingIssueListener,
  isStandardIOS,
} from '../';

// Types
import {ErrorCode} from '../types';
import type {
  ProductQueryType,
  RequestPurchaseProps,
  BillingChoiceScreenTypeAndroid,
  BillingProgramAndroid,
  DeveloperProvidedBillingDetailsAndroid,
  UserChoiceBillingDetails,
  VerifyPurchaseProps,
  VerifyPurchaseResult,
  VerifyPurchaseWithProviderProps,
  VerifyPurchaseWithProviderResult,
  PurchaseOptions,
  ActiveSubscription,
  Product,
  Purchase,
  PurchaseError,
  PurchaseUpdatedListenerOptions,
  ProductSubscription,
  MutationField,
  QueryField,
  MutationFinishTransactionArgs,
} from '../types';

// Types for event subscriptions
interface EventSubscription {
  remove(): void;
}

type UseIap = {
  connected: boolean;
  products: Product[];
  subscriptions: ProductSubscription[];
  availablePurchases: Purchase[];
  promotedProductIOS?: Product;
  activeSubscriptions: ActiveSubscription[];
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
  finishTransaction: (args: MutationFinishTransactionArgs) => Promise<void>;
  /**
   * List the user's unfinished purchases — non-consumables, active subscriptions, and any
   * pending transactions not yet finished.
   *
   * @param options Optional `PurchaseOptions`.
   *   - iOS: `alsoPublishToEventListenerIOS`, `onlyIncludeActiveItemsIOS`.
   *   - Android: `includeSuspendedAndroid` (include subscriptions in a paused/grace state).
   * @returns Promise that resolves when the request is dispatched; results land in the
   *   hook's reactive `availablePurchases` state — read from there, don't expect a return value.
   * @throws When the platform query fails.
   *
   * @example
   * ```ts
   * const { availablePurchases, getAvailablePurchases, finishTransaction } = useIAP();
   *
   * useEffect(() => {
   *   void getAvailablePurchases();
   * }, [getAvailablePurchases]);
   *
   * useEffect(() => {
   *   for (const p of availablePurchases) {
   *     void verifyOnServer(p).then((ok) => {
   *       if (ok) finishTransaction({ purchase: p, isConsumable: false });
   *     });
   *   }
   * }, [availablePurchases, finishTransaction]);
   * ```
   *
   * @see {@link https://openiap.dev/docs/apis/get-available-purchases}
   */
  getAvailablePurchases: (options?: PurchaseOptions) => Promise<void>;
  /**
   * Retrieve products or subscriptions from the store by SKU.
   *
   * @param params `ProductRequest` — `skus` (string[]) and optional `type`
   *   (`'in-app' | 'subs' | 'all'`, defaults to `'in-app'`).
   * @returns Promise that resolves when the request is dispatched; results land in the
   *   hook's reactive `products` / `subscriptions` state — read from there, don't expect a return value.
   * @throws When the store rejects the request (empty `skus`, not connected,
   *   network/store error). Unknown SKUs are simply omitted from the result, not thrown.
   *
   * @example
   * ```ts
   * const { products, fetchProducts } = useIAP();
   *
   * useEffect(() => {
   *   void fetchProducts({
   *     skus: ['com.app.coins_100', 'com.app.premium'],
   *     type: 'in-app',
   *   });
   * }, [fetchProducts]);
   *
   * // Render `products` directly from hook state.
   * ```
   *
   * @remarks This is a regular promise-based call. Don't confuse with `request*` APIs
   *   (`requestPurchase`), which are event-based.
   *
   * @see {@link https://openiap.dev/docs/apis/fetch-products}
   */
  fetchProducts: (params: {
    skus: string[];
    type?: ProductQueryType | null;
  }) => Promise<void>;
  /**
   * Initiate a purchase or subscription flow. The result is delivered through
   * `purchaseUpdatedListener` — NOT the return value.
   *
   * @param props `RequestPurchaseProps`, discriminated by `type`:
   *   - `type: 'in-app'` — pass `request.apple.sku` (iOS) and/or `request.google.skus` (Android).
   *   - `type: 'subs'`  — same shape, plus `request.google.subscriptionOffers: [{ sku, offerToken }]`.
   * @returns Promise that resolves when the request is dispatched; results land in the
   *   hook's `onPurchaseSuccess` / `onPurchaseError` callbacks.
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
  requestPurchase: (params: RequestPurchaseProps) => Promise<void>;
  /**
   * Verify a purchase against your own backend (returns isValid + raw store metadata).
   *
   * @see {@link https://openiap.dev/docs/features/validation#verify-purchase}
   */
  verifyPurchase: (
    options: VerifyPurchaseProps,
  ) => Promise<VerifyPurchaseResult>;
  /**
   * Verify via a managed provider — currently only `iapkit` (IAPKit). The PurchaseVerificationProvider enum exposes no other provider literal today.
   *
   * @see {@link https://openiap.dev/docs/features/validation#verify-purchase-with-provider}
   */
  verifyPurchaseWithProvider: (
    options: VerifyPurchaseWithProviderProps,
  ) => Promise<VerifyPurchaseWithProviderResult>;
  /**
   * Restore non-consumable and active subscription purchases.
   *
   * @see {@link https://openiap.dev/docs/apis/restore-purchases}
   */
  restorePurchases: (options?: PurchaseOptions) => Promise<void>;
  /**
   * Read the App Store-promoted product, if any.
   *
   * @see {@link https://openiap.dev/docs/apis/ios/get-promoted-product-ios}
   */
  getPromotedProductIOS: () => Promise<Product | null>;
  /**
   * Get details of all currently active subscriptions.
   *
   * @see {@link https://openiap.dev/docs/apis/get-active-subscriptions}
   */
  getActiveSubscriptions: (
    subscriptionIds?: string[],
  ) => Promise<ActiveSubscription[]>;
  /**
   * Check whether the user has any active subscription.
   *
   * @see {@link https://openiap.dev/docs/apis/has-active-subscriptions}
   */
  hasActiveSubscriptions: (subscriptionIds?: string[]) => Promise<boolean>;
  /**
   * Manually retry the store connection.
   * Useful when the initial auto-connect fails (e.g., Play Store not ready at mount time).
   * Updates the `connected` state on success.
   */
  reconnect: () => Promise<boolean>;
  /**
   * Open the store's offer/promo code redemption flow. Resolves the redeemed
   * purchase only when StoreKit reports it synchronously (iOS 27+ built with
   * Xcode 27+), otherwise null; redeemed purchases arrive through the standard
   * purchase listeners.
   *
   * @see {@link https://openiap.dev/docs/apis/open-redeem-offer-code}
   */
  openRedeemOfferCode: MutationField<'openRedeemOfferCode'>;
  /** Fetch assets and loyalty text for a developer-rendered Billing Choice screen. */
  getBillingChoiceInfoAndroid?: QueryField<'getBillingChoiceInfoAndroid'>;
  /** Check Billing Program availability and the configured choice renderer. */
  isBillingProgramAvailableAndroid?: MutationField<'isBillingProgramAvailableAndroid'>;
  /** Create Google Play reporting details for a developer billing transaction. */
  createBillingProgramReportingDetailsAndroid?: MutationField<'createBillingProgramReportingDetailsAndroid'>;
  /** Launch a supported Billing Program external link. */
  launchExternalLinkAndroid?: MutationField<'launchExternalLinkAndroid'>;
  /** Show the required Billing Choice information dialog. */
  showBillingProgramInformationDialogAndroid?: MutationField<'showBillingProgramInformationDialogAndroid'>;
  /** Show Play billing in-app messages. */
  showInAppMessagesAndroid?: MutationField<'showInAppMessagesAndroid'>;
  /**
   * Open the Play Store offer code redemption page; purchases arrive via the standard purchase listeners.
   * @deprecated Use openRedeemOfferCode. Scheduled for removal in OpenIAP 4.0.
   */
  openRedeemOfferCodeAndroid?: MutationField<'openRedeemOfferCodeAndroid'>;
};

export interface UseIapOptions {
  onPurchaseSuccess?: (purchase: Purchase) => void;
  /**
   * Options for the purchase success listener. iOS defaults to suppressing
   * StoreKit replay events for the same transaction ID; set
   * `dedupeTransactionIOS` to false only for diagnostics.
   */
  purchaseUpdatedListenerOptions?: PurchaseUpdatedListenerOptions | null;
  onPurchaseError?: (error: PurchaseError) => void;
  /** Callback for non-purchase errors (fetchProducts, getAvailablePurchases, etc.) */
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
  /**
   * Fires when a subscription enters a billing-issue state
   * (StoreKit 2 Message.billingIssue on iOS / Mac Catalyst 16.4+ and visionOS 1.0+, Purchase.isSuspended on
   * Play Billing 8.1+). Not invoked on Meta Horizon or Amazon Appstore.
   *
   * Recommended: call deepLinkToSubscriptions on the returned purchase so
   * the user can update their payment method in the platform subscription
   * center.
   */
  onSubscriptionBillingIssue?: (purchase: Purchase) => void;
  /**
   * Enable a specific billing program for Android (8.2.0+)
   * Use 'user-choice-billing' for User Choice Billing (7.0+).
   * Use 'external-offer' for External Offer program.
   * Use 'external-payments' for Developer Provided Billing (Japan only, 8.3.0+).
   * Use 'billing-choice' for Billing Choice (9.1.0+).
   */
  enableBillingProgramAndroid?: BillingProgramAndroid;
  /**
   * Select who renders the Billing Choice screen (9.1.0+). Must match the
   * choiceScreenType returned by isBillingProgramAvailableAndroid.
   */
  billingChoiceScreenTypeAndroid?: BillingChoiceScreenTypeAndroid;
}

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

/**
 * React Hook for managing In-App Purchases.
 * See documentation at https://react-native-iap.hyo.dev/docs/hooks/useIAP
 */
export function useIAP(options?: UseIapOptions): UseIap {
  const [connected, setConnected] = useState<boolean>(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [subscriptions, setSubscriptions] = useState<ProductSubscription[]>([]);
  const [availablePurchases, setAvailablePurchases] = useState<Purchase[]>([]);
  const [promotedProductIOS, setPromotedProductIOS] = useState<Product>();
  const [activeSubscriptions, setActiveSubscriptions] = useState<
    ActiveSubscription[]
  >([]);

  const optionsRef = useRef<UseIapOptions | undefined>(options);
  const connectedRef = useRef<boolean>(false);

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

  // Track if component is mounted to prevent listener leaks on early unmount
  const isMountedRef = useRef<boolean>(false);
  const initializationGenerationRef = useRef(0);

  const subscriptionsRefState = useRef<ProductSubscription[]>([]);

  useEffect(() => {
    subscriptionsRefState.current = subscriptions;
  }, [subscriptions]);

  // Helper function to invoke onError callback
  const invokeOnError = useCallback((error: unknown) => {
    if (optionsRef.current?.onError) {
      optionsRef.current.onError(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }, []);

  const fetchProductsInternal = useCallback(
    async (params: {
      skus: string[];
      type?: ProductQueryType | null;
    }): Promise<void> => {
      try {
        const requestType = params.type ?? 'in-app';
        RnIapConsole.debug('[useIAP] Calling fetchProducts with:', {
          skus: params.skus,
          type: requestType,
        });
        const result = await fetchProducts({
          skus: params.skus,
          type: requestType,
        });
        RnIapConsole.debug(
          '[useIAP] fetchProducts count:',
          result?.length ?? 0,
        );
        const items = (result ?? []) as (Product | ProductSubscription)[];

        // fetchProducts already returns properly filtered results based on type
        if (requestType === 'subs') {
          // All items are already subscriptions
          setSubscriptions((prevSubscriptions: ProductSubscription[]) =>
            mergeByKey(
              prevSubscriptions,
              items as ProductSubscription[],
              (subscription: ProductSubscription) => subscription.id,
            ),
          );
          return;
        }

        if (requestType === 'all') {
          // fetchProducts already properly separates products and subscriptions
          const newProducts = items.filter(
            (item): item is Product => item.type === 'in-app',
          );
          const newSubscriptions = items.filter(
            (item): item is ProductSubscription => item.type === 'subs',
          );

          setProducts((prevProducts: Product[]) =>
            mergeByKey(
              prevProducts,
              newProducts,
              (product: Product) => product.id,
            ),
          );
          setSubscriptions((prevSubscriptions: ProductSubscription[]) =>
            mergeByKey(
              prevSubscriptions,
              newSubscriptions,
              (subscription: ProductSubscription) => subscription.id,
            ),
          );
          return;
        }

        // For 'in-app' type, all items are already products
        setProducts((prevProducts: Product[]) =>
          mergeByKey(
            prevProducts,
            items as Product[],
            (product: Product) => product.id,
          ),
        );
      } catch (error) {
        RnIapConsole.error('Error fetching products:', error);
        invokeOnError(error);
      }
    },
    [invokeOnError],
  );

  const getAvailablePurchasesInternal = useCallback(
    async (options?: PurchaseOptions): Promise<void> => {
      try {
        const result = await getAvailablePurchases({
          alsoPublishToEventListenerIOS:
            options?.alsoPublishToEventListenerIOS ?? false,
          onlyIncludeActiveItemsIOS: options?.onlyIncludeActiveItemsIOS ?? true,
          includeSuspendedAndroid: options?.includeSuspendedAndroid ?? false,
        });
        if (isMountedRef.current) {
          setAvailablePurchases(result);
        }
      } catch (error) {
        RnIapConsole.error('Error fetching available purchases:', error);
        invokeOnError(error);
        throw error;
      }
    },
    [invokeOnError],
  );

  const getActiveSubscriptionsInternal = useCallback(
    async (subscriptionIds?: string[]): Promise<ActiveSubscription[]> => {
      try {
        const result = await getActiveSubscriptions(subscriptionIds);
        if (isMountedRef.current) {
          setActiveSubscriptions(result);
        }
        return result;
      } catch (error) {
        RnIapConsole.error('Error getting active subscriptions:', error);
        invokeOnError(error);
        throw error;
      }
    },
    [invokeOnError],
  );

  const hasActiveSubscriptionsInternal = useCallback(
    async (subscriptionIds?: string[]): Promise<boolean> => {
      try {
        return await hasActiveSubscriptions(subscriptionIds);
      } catch (error) {
        RnIapConsole.error('Error checking active subscriptions:', error);
        invokeOnError(error);
        throw error;
      }
    },
    [invokeOnError],
  );

  const finishTransaction = useCallback(
    async (args: MutationFinishTransactionArgs): Promise<void> => {
      // Directly delegate to root API finishTransaction without catching errors.
      // This allows the root API's error handling logic to work correctly, including:
      // - iOS: treating "Transaction not found" as success (already-finished transactions)
      // - Proper validation and error messages for required fields
      // Users should handle errors in their onPurchaseSuccess callback if needed.
      await finishTransactionInternal(args);
    },
    [],
  );

  const requestPurchase = useCallback(
    async (requestObj: RequestPurchaseProps): Promise<void> => {
      await requestPurchaseInternal(requestObj);
    },
    [],
  );

  const restorePurchases = useCallback(
    async (options?: PurchaseOptions): Promise<void> => {
      if (Platform.OS === 'ios') {
        try {
          const synced = await syncIOS();
          if (!synced) {
            throw createPurchaseError({
              code: ErrorCode.SyncError,
              message: 'App Store purchase sync did not complete',
              platform: 'ios',
            });
          }
        } catch (error) {
          RnIapConsole.warn('Failed to restore purchases:', error);
          invokeOnError(error);
          throw error;
        }
      }

      // The query helper reports and rethrows its own error, avoiding a second
      // onError call while keeping restore failure observable to the caller.
      await getAvailablePurchasesInternal(options);
    },
    [getAvailablePurchasesInternal, invokeOnError],
  );

  const verifyPurchase = useCallback(
    async (options: VerifyPurchaseProps): Promise<VerifyPurchaseResult> => {
      return verifyPurchaseTopLevel(options);
    },
    [],
  );

  const verifyPurchaseWithProvider = useCallback(
    async (
      options: VerifyPurchaseWithProviderProps,
    ): Promise<VerifyPurchaseWithProviderResult> => {
      return verifyPurchaseWithProviderTopLevel(options);
    },
    [],
  );

  // Shared helper: build Android billing config from options
  const buildAndroidConfig = useCallback(() => {
    let config:
      | {
          enableBillingProgramAndroid?: BillingProgramAndroid;
          billingChoiceScreenTypeAndroid?: BillingChoiceScreenTypeAndroid;
        }
      | undefined;

    if (Platform.OS === 'android') {
      if (optionsRef.current?.enableBillingProgramAndroid) {
        config = {
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
    }

    return config;
  }, []);

  // Shared helper: register event listeners if not already active
  const registerListeners = useCallback(() => {
    if (!subscriptionsRef.current.purchaseUpdate) {
      subscriptionsRef.current.purchaseUpdate = purchaseUpdatedListener(
        async (purchase: Purchase) => {
          try {
            await getActiveSubscriptionsInternal();
            await getAvailablePurchasesInternal();
          } catch (e) {
            RnIapConsole.warn('[useIAP] post-purchase refresh failed:', e);
          }

          // Deliver even if the hook unmounted while the refresh was pending:
          // onPurchaseSuccess is where apps call finishTransaction, and a
          // dropped event has no in-session redelivery. Internal setState is
          // mount-guarded inside the refresh helpers.
          if (optionsRef.current?.onPurchaseSuccess) {
            optionsRef.current.onPurchaseSuccess(purchase);
          }
        },
        optionsRef.current?.purchaseUpdatedListenerOptions,
      );
    }

    if (!subscriptionsRef.current.purchaseError) {
      subscriptionsRef.current.purchaseError = purchaseErrorListener(
        (error) => {
          if (
            error.code === ErrorCode.InitConnection &&
            !connectedRef.current
          ) {
            return;
          }
          if (optionsRef.current?.onPurchaseError) {
            optionsRef.current.onPurchaseError(error);
          }
        },
      );
    }

    if (isStandardIOS() && !subscriptionsRef.current.promotedProductIOS) {
      subscriptionsRef.current.promotedProductIOS = promotedProductListenerIOS(
        (product: Product) => {
          setPromotedProductIOS(product);
          if (optionsRef.current?.onPromotedProductIOS) {
            optionsRef.current.onPromotedProductIOS(product);
          }
        },
      );
    }

    if (
      Platform.OS === 'android' &&
      !subscriptionsRef.current.userChoiceBillingAndroid
    ) {
      subscriptionsRef.current.userChoiceBillingAndroid =
        userChoiceBillingListenerAndroid((details) => {
          if (optionsRef.current?.onUserChoiceBillingAndroid) {
            optionsRef.current.onUserChoiceBillingAndroid(details);
          }
        });
    }

    if (
      Platform.OS === 'android' &&
      !subscriptionsRef.current.developerProvidedBillingAndroid
    ) {
      subscriptionsRef.current.developerProvidedBillingAndroid =
        developerProvidedBillingListenerAndroid((details) => {
          optionsRef.current?.onDeveloperProvidedBillingAndroid?.(details);
        });
    }

    // Always attach so callers that supply `onSubscriptionBillingIssue` later
    // (after the hook has already set up listeners) still receive events.
    if (!subscriptionsRef.current.subscriptionBillingIssue) {
      subscriptionsRef.current.subscriptionBillingIssue =
        subscriptionBillingIssueListener((purchase: Purchase) => {
          optionsRef.current?.onSubscriptionBillingIssue?.(purchase);
        });
    }
  }, [getActiveSubscriptionsInternal, getAvailablePurchasesInternal]);

  // Shared helper: clean up all listeners
  const cleanupListeners = useCallback(() => {
    subscriptionsRef.current.purchaseUpdate?.remove();
    subscriptionsRef.current.purchaseError?.remove();
    subscriptionsRef.current.promotedProductIOS?.remove();
    subscriptionsRef.current.userChoiceBillingAndroid?.remove();
    subscriptionsRef.current.developerProvidedBillingAndroid?.remove();
    subscriptionsRef.current.subscriptionBillingIssue?.remove();
    subscriptionsRef.current.purchaseUpdate = undefined;
    subscriptionsRef.current.purchaseError = undefined;
    subscriptionsRef.current.promotedProductIOS = undefined;
    subscriptionsRef.current.userChoiceBillingAndroid = undefined;
    subscriptionsRef.current.developerProvidedBillingAndroid = undefined;
    subscriptionsRef.current.subscriptionBillingIssue = undefined;
  }, []);

  const initIapWithSubscriptions = useCallback(
    async (generation: number): Promise<void> => {
      if (
        !isMountedRef.current ||
        initializationGenerationRef.current !== generation
      ) {
        return;
      }

      const config = buildAndroidConfig();

      try {
        const result = await initConnection(config);

        if (
          !isMountedRef.current ||
          initializationGenerationRef.current !== generation
        ) {
          return;
        }

        if (!result) {
          cleanupListeners();
          setConnected(false);
          RnIapConsole.warn('[useIAP] initConnection returned false');
          return;
        }

        // Android retains events emitted during connection setup in bounded
        // native queues; registration flushes that backlog after Nitro is ready.
        // Other platforms preserve the existing post-init listener ordering.
        registerListeners();
        setConnected(true);
      } catch (error) {
        if (
          !isMountedRef.current ||
          initializationGenerationRef.current !== generation
        ) {
          return;
        }
        RnIapConsole.error('initConnection failed:', error);
        cleanupListeners();
        if (isMountedRef.current) {
          setConnected(false);
        }
        invokeOnError(error);
      }
    },
    [buildAndroidConfig, registerListeners, cleanupListeners, invokeOnError],
  );

  const reconnect = useCallback(async (): Promise<boolean> => {
    const config = buildAndroidConfig();

    try {
      const result = await initConnection(config);

      if (!isMountedRef.current) {
        return false;
      }

      if (result) {
        registerListeners();
        setConnected(true);
        return true;
      }

      setConnected(false);
      return false;
    } catch (error) {
      RnIapConsole.error('[useIAP] reconnect failed:', error);
      cleanupListeners();
      if (isMountedRef.current) {
        setConnected(false);
      }
      invokeOnError(error);
      return false;
    }
  }, [buildAndroidConfig, registerListeners, cleanupListeners, invokeOnError]);

  useEffect(() => {
    const generation = ++initializationGenerationRef.current;
    isMountedRef.current = true;
    void Promise.resolve().then(() => initIapWithSubscriptions(generation));

    return () => {
      isMountedRef.current = false;
      cleanupListeners();
      // Keep connection alive across screens to avoid race conditions
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
    restorePurchases,
    getPromotedProductIOS,
    getActiveSubscriptions: getActiveSubscriptionsInternal,
    hasActiveSubscriptions: hasActiveSubscriptionsInternal,
    reconnect,
    openRedeemOfferCode,
    // Alternative billing (Android only)
    ...(Platform.OS === 'android'
      ? {
          getBillingChoiceInfoAndroid,
          isBillingProgramAvailableAndroid,
          createBillingProgramReportingDetailsAndroid,
          launchExternalLinkAndroid,
          showBillingProgramInformationDialogAndroid,
          showInAppMessagesAndroid,
          openRedeemOfferCodeAndroid,
        }
      : {}),
  };
}
