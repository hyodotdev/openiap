import {useCallback, useEffect, useRef, useState} from 'react';
import {
  AppState,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createPurchaseFlow,
  describePurchaseFlowStatus,
  ErrorCode,
  finishTransaction,
  getAvailablePurchases,
  getPendingTransactionsIOS,
  toPurchaseConfirmationRequest,
  useIAP,
  type ProductSubscription,
  type Purchase,
  type PurchaseFlow,
  type PurchaseFlowGuidanceKey,
  type PurchaseFlowOutcome,
  type PurchaseFlowStatus,
} from 'expo-iap';
import {
  CONSUMABLE_PRODUCT_IDS,
  PRODUCT_IDS,
  SUBSCRIPTION_PRODUCT_IDS,
} from '../utils/constants';
import {extractErrorCode, extractErrorMessage} from '../utils/errorUtils';
import {subscriptionDisplay} from '../utils/subscriptionDisplay';
import ExampleButton from './ExampleButton';
import StoreProductCard from './StoreProductCard';
import usePurchaseFlowScroll from './usePurchaseFlowScroll';
import PurchaseFlowDiagram, {
  usePurchaseFlowActivity,
} from './PurchaseFlowDiagram';

const CONSUMABLES = new Set(CONSUMABLE_PRODUCT_IDS);

// Example copy for each guidance key; an app supplies its own.
const GUIDANCE_COPY: Record<PurchaseFlowGuidanceKey, string> = {
  payment_pending:
    'Payment is pending at the store. Access unlocks once it completes.',
  verification_delayed:
    'The store has not confirmed the purchase yet. Retrying soon.',
  owned_by_another_account:
    'This purchase belongs to another account. Sign in to that account or contact support.',
  test_purchase_not_accepted:
    'This backend does not accept sandbox or test purchases.',
  purchase_not_valid: 'The store did not confirm this purchase.',
  access_pending: 'Purchase confirmed. Access is being prepared.',
  access_granted: 'Access granted.',
  try_again_later: 'Could not confirm the purchase. Try again later.',
};

// The backend holds the IAPKit secret key; the app only knows this URL.
function appBackendUrl(): string | undefined {
  return (
    process.env.EXPO_PUBLIC_APP_BACKEND_URL?.replace(/\/$/, '') || undefined
  );
}

interface Props {
  productType?: 'in-app' | 'subs';
}

/** Backend confirmation for the captured app account; the helper owns settlement. */
export default function BackendEntitlementFlow({
  productType = 'in-app',
}: Props) {
  const {
    activity,
    startStore,
    startPurchase,
    update,
    reset,
    captureVersion,
    observeRecoveredPending,
    storeError,
  } = usePurchaseFlowActivity();
  const {
    setScrollView,
    expanded,
    changeExpanded,
    beginPurchase,
    onScroll,
    onScrollBeginDrag,
    onContentLayout,
    onDiagramLayout,
    onDiagramBodyLayout,
    onStepLayout,
  } = usePurchaseFlowScroll(activity);
  const purchaseRequestTrace = useRef('');
  const backendUrl = appBackendUrl();
  const [account, setAccount] = useState('demo-user-1');
  const [outcomes, setOutcomes] = useState<PurchaseFlowOutcome<Purchase>[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(Boolean(backendUrl));
  const didStartRef = useRef(false);
  const activeFlow = useRef<PurchaseFlow<Purchase> | null>(null);
  useEffect(() => {
    const owner: PurchaseFlow<Purchase> = createPurchaseFlow<Purchase>({
      confirmWithBackend: async (purchase) => {
        if (activeFlow.current === owner) {
          startPurchase(purchase);
          update(
            purchase.id,
            'confirmation',
            'running',
            'Waiting for your backend’s account-access decision.',
          );
        }
        const response = await fetch(`${appBackendUrl()}/purchases/confirm`, {
          method: 'POST',
          headers: {
            // Stands in for your app's session token.
            authorization: `Bearer ${account}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(toPurchaseConfirmationRequest(purchase)),
        });
        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }
        return response.json();
      },
      finishTransaction: async (args) => {
        if (activeFlow.current === owner) {
          update(
            args.purchase.id,
            'confirmation',
            'done',
            'Backend decision received. Settling a transaction does not necessarily grant access.',
          );
          update(
            args.purchase.id,
            'finish',
            'running',
            'Finishing the store transaction.',
          );
        }
        try {
          await finishTransaction(args);
          if (activeFlow.current === owner)
            update(
              args.purchase.id,
              'finish',
              'done',
              'Store transaction settled.',
            );
        } catch (error) {
          if (activeFlow.current === owner)
            update(
              args.purchase.id,
              'finish',
              'failed',
              'Backend decision received, but finishing needs retry.',
            );
          throw error;
        }
      },
      isConsumable: (productId) => CONSUMABLES.has(productId),
      getAvailablePurchases: async () => {
        const purchases = await getAvailablePurchases();
        return activeFlow.current === owner ? purchases : [];
      },
      getPendingTransactionsIOS:
        Platform.OS === 'ios'
          ? async () => {
              const purchases = await getPendingTransactionsIOS();
              return activeFlow.current === owner ? purchases : [];
            }
          : undefined,
    });
    activeFlow.current = owner;
    return () => {
      if (activeFlow.current === owner) activeFlow.current = null;
    };
  }, [account, startPurchase, update]);

  const record = useCallback(
    (
      purchase: Purchase,
      status: PurchaseFlowStatus,
      recoveryVersion?: number,
    ) => {
      const guidance = describePurchaseFlowStatus(status);
      if (status.status === 'store_pending') {
        if (recoveryVersion !== undefined)
          observeRecoveredPending(purchase, recoveryVersion);
        else
          update(purchase.id, 'store', 'waiting', GUIDANCE_COPY[guidance.key]);
      } else {
        update(
          purchase.id,
          'confirmation',
          status.status === 'failed'
            ? 'failed'
            : status.status === 'verified' ||
                status.status === 'linked' ||
                status.status === 'verification_delayed' ||
                (status.status === 'ownership_conflict' &&
                  !status.alreadyGranted)
              ? 'waiting'
              : 'done',
          'finishError' in status
            ? `${GUIDANCE_COPY[guidance.key]} Finishing needs retry.`
            : GUIDANCE_COPY[guidance.key],
        );
      }
      setOutcomes((current) => [
        {purchase, status},
        ...current.filter((item) => item.purchase.id !== purchase.id),
      ]);
    },
    [update, observeRecoveredPending],
  );

  const processPurchase = useCallback(
    async (purchase: Purchase) => {
      const owner = activeFlow.current;
      if (!owner) return;
      if (purchase.purchaseState === 'pending') startPurchase(purchase);
      const status = await owner.processPurchase(purchase);
      if (activeFlow.current === owner) record(purchase, status);
    },
    [record, startPurchase],
  );

  const recover = useCallback(
    (includeFinished: boolean): Promise<void> => {
      const owner = activeFlow.current;
      if (!owner) return Promise.resolve();
      const recoveryVersion = captureVersion();
      return owner
        .recoverPurchases({includeFinished})
        .then((results) => {
          if (activeFlow.current !== owner) return;
          results.forEach(({purchase, status}) =>
            record(purchase, status, recoveryVersion),
          );
          if (includeFinished && results.length === 0)
            setMessage('No purchases to restore.');
        })
        .catch((error: unknown) => {
          if (activeFlow.current === owner)
            setMessage(`Recovery failed: ${extractErrorMessage(error)}`);
        })
        .finally(() => {
          if (activeFlow.current === owner) setRecovering(false);
        });
    },
    [record, captureVersion, setRecovering],
  );

  const reportStoreError = (
    error: unknown,
    requestTrace: string,
    owner: PurchaseFlow<Purchase> | null,
  ) => {
    if (
      !owner ||
      activeFlow.current !== owner ||
      purchaseRequestTrace.current !== requestTrace
    )
      return;
    const code = extractErrorCode(error, ErrorCode.PurchaseError);
    storeError(requestTrace, code);
    if (code === ErrorCode.UserCancelled) return;
    setMessage(
      code === ErrorCode.DeferredPayment
        ? GUIDANCE_COPY[
            describePurchaseFlowStatus({status: 'store_pending'}).key
          ]
        : `Purchase failed: ${extractErrorMessage(error)}`,
    );
  };

  const {connected, products, subscriptions, fetchProducts, requestPurchase} =
    useIAP({
      onPurchaseSuccess: (purchase) => {
        // Without a backend, leave the purchase unfinished for a later run.
        if (appBackendUrl()) void processPurchase(purchase);
      },
      onPurchaseError: (error) =>
        reportStoreError(
          error,
          purchaseRequestTrace.current,
          activeFlow.current,
        ),
    });

  const buy = (
    request: Parameters<typeof requestPurchase>[0],
    productId: string,
  ) => {
    const owner = activeFlow.current;
    if (!owner) return;
    beginPurchase(productId);
    purchaseRequestTrace.current = startStore(productId);
    const requestTrace = purchaseRequestTrace.current;
    setMessage(null);
    return requestPurchase(request).catch((error: unknown) =>
      reportStoreError(error, requestTrace, owner),
    );
  };

  const subscribe = (
    subscription: ProductSubscription,
    offerToken: string | undefined,
  ) => {
    return buy(
      {
        request: {
          apple: {sku: subscription.id},
          google: {
            skus: [subscription.id],
            subscriptionOffers: offerToken
              ? [{sku: subscription.id, offerToken}]
              : undefined,
          },
        },
        type: 'subs',
      },
      subscription.id,
    );
  };

  useEffect(() => {
    if (!connected || !backendUrl) return;
    if (!didStartRef.current) {
      didStartRef.current = true;
      fetchProducts({
        skus: productType === 'subs' ? SUBSCRIPTION_PRODUCT_IDS : PRODUCT_IDS,
        type: productType,
      }).catch((error) =>
        setMessage(`Product loading failed: ${extractErrorMessage(error)}`),
      );
    }
    void recover(false);
  }, [backendUrl, connected, fetchProducts, productType, recover]);

  useEffect(() => {
    if (!backendUrl) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setRecovering(true);
        void recover(false);
      }
    });
    return () => subscription.remove();
  }, [backendUrl, recover]);

  if (!backendUrl) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <PurchaseFlowDiagram
            backend
            activity={activity}
            expanded={expanded}
            onExpandedChange={changeExpanded}
            onLayout={onDiagramLayout}
            onBodyLayout={onDiagramBodyLayout}
            onStepLayout={onStepLayout}
          />
          <Text style={styles.text}>
            Your backend verifies the purchase, checks account ownership and
            decides access. The app finishes only a settled decision.
          </Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Set up your app backend</Text>
            <Text style={styles.text}>
              {`1. Deploy the reference confirmPurchase handler from kit.openiap.dev/docs/purchase-flow behind POST /purchases/confirm.\n2. Give it your IAPKit secret key on the server. Never put that key in this app.\n3. Set EXPO_PUBLIC_APP_BACKEND_URL to the backend URL and restart Metro.`}
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      ref={setScrollView}
      style={styles.container}
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="on-drag"
      onScroll={onScroll}
      scrollEventThrottle={16}
      onScrollBeginDrag={onScrollBeginDrag}
    >
      <View style={styles.content} onLayout={onContentLayout}>
        <Text style={styles.text}>
          Your backend verifies the purchase, checks account ownership and
          decides access. The app finishes only a settled decision.
        </Text>
        <PurchaseFlowDiagram
          backend
          activity={activity}
          expanded={expanded}
          onExpandedChange={changeExpanded}
          onLayout={onDiagramLayout}
          onBodyLayout={onDiagramBodyLayout}
          onStepLayout={onStepLayout}
        />
        <Text style={styles.text}>
          {connected ? 'Connected to the store' : 'Connecting to the store...'}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>App account</Text>
          <Text style={styles.hint}>
            Demo sign-in. Change accounts, then restore to test ownership.
          </Text>
          <TextInput
            accessibilityLabel="App account"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="done"
            style={styles.input}
            value={account}
            onChangeText={(value) => {
              if (value === account) return;
              activeFlow.current = null;
              purchaseRequestTrace.current = '';
              reset();
              setAccount(value);
              setOutcomes([]);
              setMessage(null);
              setRecovering(false);
            }}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Already purchased?</Text>
          <Text style={styles.text}>
            Restore purchases for the app account above.
          </Text>
          <ExampleButton
            title={recovering ? 'Restoring...' : 'Restore purchases'}
            variant="secondary"
            disabled={recovering || !connected}
            onPress={() => {
              setRecovering(true);
              void recover(true);
            }}
          />
        </View>

        {productType === 'in-app' ? (
          <View>
            <Text style={styles.cardTitle}>Products</Text>
            {products.map((product) => (
              <StoreProductCard
                key={product.id}
                product={product}
                kind={
                  CONSUMABLES.has(product.id)
                    ? 'Consumable'
                    : 'One-time purchase'
                }
              >
                <ExampleButton
                  title="Buy"
                  accessibilityLabel={`Buy ${
                    product.displayName || product.title
                  }`}
                  disabled={!connected}
                  style={styles.productAction}
                  onPress={() =>
                    void buy(
                      {
                        request: {
                          apple: {sku: product.id},
                          google: {skus: [product.id]},
                        },
                        type: 'in-app',
                      },
                      product.id,
                    )
                  }
                />
              </StoreProductCard>
            ))}
          </View>
        ) : (
          <View>
            <Text style={styles.cardTitle}>Subscriptions</Text>
            {subscriptions.map((subscription) => {
              const {offer, price, terms} = subscriptionDisplay(subscription);
              return (
                <StoreProductCard
                  key={subscription.id}
                  product={subscription}
                  kind="Subscription"
                  price={price}
                  terms={terms}
                >
                  <ExampleButton
                    title="Subscribe"
                    accessibilityLabel={`Subscribe to ${
                      subscription.displayName || subscription.title
                    }`}
                    disabled={!connected}
                    style={styles.productAction}
                    onPress={() =>
                      void subscribe(
                        subscription,
                        offer?.offerTokenAndroid ?? undefined,
                      )
                    }
                  />
                </StoreProductCard>
              );
            })}
          </View>
        )}

        {message ? <Text style={styles.message}>{message}</Text> : null}

        {outcomes.map(({purchase, status}) => {
          const guidance = describePurchaseFlowStatus(status);
          return (
            <View key={purchase.id} style={styles.card}>
              <Text style={styles.cardTitle}>{purchase.productId}</Text>
              <Text style={styles.status}>{status.status}</Text>
              <Text style={styles.text}>{GUIDANCE_COPY[guidance.key]}</Text>
              {guidance.retryAfterMs !== undefined ? (
                <Text style={styles.hint}>
                  Retry after {Math.ceil(guidance.retryAfterMs / 1000)}s
                </Text>
              ) : null}
              {status.status !== 'entitled' &&
              status.status !== 'store_pending' ? (
                <ExampleButton
                  title="Check again"
                  variant="secondary"
                  onPress={() => void processPurchase(purchase)}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8FAFC'},
  content: {padding: 20, paddingBottom: 64, gap: 16},
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  text: {fontSize: 14, color: '#334155', lineHeight: 20},
  hint: {fontSize: 13, lineHeight: 19, color: '#64748B'},
  status: {fontFamily: 'Courier', fontSize: 13, color: '#2563EB'},
  message: {fontSize: 14, color: '#B91C1C'},
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 48,
    color: '#0F172A',
  },
  productAction: {flex: 1},
});
