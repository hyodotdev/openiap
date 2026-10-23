import {useCallback, useEffect, useRef, useState} from 'react';
import {
  AppState,
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
  toPurchaseConfirmationRequest,
  useIAP,
  type ProductSubscription,
  type Purchase,
  type PurchaseFlow,
  type PurchaseFlowGuidanceKey,
  type PurchaseFlowOutcome,
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
  change_pending:
    'Your current plan stays active. The plan change applies later.',
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

/** Backend confirmation for the signed-in app account; the flow settles it. */
export default function BackendEntitlementFlow({
  productType = 'in-app',
}: Props) {
  const {
    activity,
    startStore,
    startPurchase,
    update,
    reset,
    observeOutcome,
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
  const [flow, setFlow] = useState<PurchaseFlow<Purchase>>();
  const [outcomes, setOutcomes] = useState<PurchaseFlowOutcome<Purchase>[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const didStartRef = useRef(false);
  const productLoadSequenceRef = useRef(0);

  // One flow per app account. Switching accounts disposes the old flow, so
  // nothing it still confirms reaches the new account.
  useEffect(() => {
    if (!backendUrl) return;
    // Its running confirmations still call back after dispose.
    let current = true;
    const accountFlow = createPurchaseFlow({
      confirmWithBackend: async (purchase) => {
        if (current) {
          startPurchase(purchase);
          update(
            purchase.id,
            'confirmation',
            'running',
            'Waiting for your backend’s account-access decision.',
          );
        }
        const response = await fetch(`${backendUrl}/purchases/confirm`, {
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
      // Wraps the SDK's finish only to show it on the diagram.
      finishTransaction: async (args) => {
        if (current) {
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
          if (current)
            update(
              args.purchase.id,
              'finish',
              'done',
              'Store transaction settled.',
            );
        } catch (error) {
          if (current)
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
    });
    setFlow(accountFlow);
    return () => {
      current = false;
      accountFlow.dispose();
    };
  }, [account, backendUrl, startPurchase, update]);

  const record = ({purchase, status}: PurchaseFlowOutcome<Purchase>): void => {
    const copy = GUIDANCE_COPY[describePurchaseFlowStatus(status).key];
    if (status.status === 'store_pending') {
      observeOutcome(purchase, {steps: {}, note: copy});
    } else {
      update(
        purchase.id,
        'confirmation',
        status.status === 'failed'
          ? 'failed'
          : status.status === 'verified' ||
            status.status === 'linked' ||
            status.status === 'verification_delayed' ||
            (status.status === 'ownership_conflict' && !status.alreadyGranted)
          ? 'waiting'
          : 'done',
        'finishError' in status ? `${copy} Finishing needs retry.` : copy,
      );
    }
    setOutcomes((recorded) => [
      {purchase, status},
      ...recorded.filter((item) => item.purchase.id !== purchase.id),
    ]);
  };

  const recover = useCallback(
    (includeFinished: boolean): Promise<void> => {
      if (!flow) return Promise.resolve();
      setRecovering(true);
      return flow
        .recoverPurchases({includeFinished})
        .then((recovered) => {
          if (includeFinished && recovered.length === 0)
            setMessage('No purchases to restore.');
        })
        .catch((error: unknown) => {
          setMessage(`Recovery failed: ${extractErrorMessage(error)}`);
        })
        .finally(() => setRecovering(false));
    },
    [flow],
  );

  const reportStoreError = (error: unknown, requestTrace: string) => {
    // A late rejection of an older request, or another account's, is stale.
    if (purchaseRequestTrace.current !== requestTrace) return;
    const code = extractErrorCode(error, ErrorCode.PurchaseError);
    storeError(requestTrace, code);
    if (code === ErrorCode.UserCancelled) return;
    setMessage(
      code === ErrorCode.DeferredPayment
        ? GUIDANCE_COPY.payment_pending
        : `Purchase failed: ${extractErrorMessage(error)}`,
    );
  };

  // useIAP recovers this account's unfinished purchases once connected.
  const {connected, products, subscriptions, fetchProducts, requestPurchase} =
    useIAP({
      purchaseFlow: flow,
      onPurchaseFlowOutcome: record,
      onPurchaseError: (error) =>
        reportStoreError(error, purchaseRequestTrace.current),
    });

  const buy = (
    request: Parameters<typeof requestPurchase>[0],
    productId: string,
  ) => {
    beginPurchase(productId);
    const requestTrace = startStore(productId);
    purchaseRequestTrace.current = requestTrace;
    setMessage(null);
    return requestPurchase(request).catch((error: unknown) =>
      reportStoreError(error, requestTrace),
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

  const loadProducts = useCallback(async (): Promise<void> => {
    const request = ++productLoadSequenceRef.current;
    setProductError(null);
    try {
      await fetchProducts({
        skus: productType === 'subs' ? SUBSCRIPTION_PRODUCT_IDS : PRODUCT_IDS,
        type: productType,
      });
    } catch (error) {
      if (request !== productLoadSequenceRef.current) return;
      setProductError(`Product loading failed: ${extractErrorMessage(error)}`);
    }
  }, [fetchProducts, productType]);

  useEffect(() => {
    if (!connected || !backendUrl || didStartRef.current) return;
    didStartRef.current = true;
    void loadProducts();
  }, [backendUrl, connected, loadProducts]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void recover(false);
    });
    return () => subscription.remove();
  }, [recover]);

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
            onPress={() => void recover(true)}
          />
        </View>

        {productError ? (
          <View style={styles.card}>
            <Text style={styles.text}>{productError}</Text>
            <ExampleButton
              title="Reload products"
              variant="secondary"
              disabled={!connected}
              onPress={() => void loadProducts()}
            />
          </View>
        ) : null}

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
                  onPress={() => void flow?.processPurchase(purchase)}
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
