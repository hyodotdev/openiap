import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
  type PurchaseFlowGuidanceKey,
  type PurchaseFlowOutcome,
  type PurchaseFlowStatus,
} from 'expo-iap';
import {
  CONSUMABLE_PRODUCT_IDS,
  PRODUCT_IDS,
  SUBSCRIPTION_PRODUCT_IDS,
} from '../utils/constants';
import {extractErrorMessage} from '../utils/errorUtils';
import ExampleButton from './ExampleButton';
import StoreProductCard from './StoreProductCard';

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

/**
 * "App backend" verification: the app backend verifies with IAPKit, links the
 * purchase to the signed-in account, and grants once; the app finishes only
 * after access is granted. Guide: https://kit.openiap.dev/docs/purchase-flow
 */
export default function BackendEntitlementFlow() {
  const backendUrl = appBackendUrl();
  const [account, setAccount] = useState('demo-user-1');
  const [outcomes, setOutcomes] = useState<PurchaseFlowOutcome<Purchase>[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const didStartRef = useRef(false);

  const flow = useMemo(
    () =>
      createPurchaseFlow<Purchase>({
        confirmWithBackend: async (purchase) => {
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
        finishTransaction,
        isConsumable: (productId) => CONSUMABLES.has(productId),
        getAvailablePurchases,
        getPendingTransactionsIOS:
          Platform.OS === 'ios' ? getPendingTransactionsIOS : undefined,
      }),
    [account],
  );
  const activeFlow = useRef<typeof flow | null>(flow);

  useEffect(() => {
    activeFlow.current = flow;
    return () => {
      activeFlow.current = null;
    };
  }, [flow]);

  const record = useCallback(
    (purchase: Purchase, status: PurchaseFlowStatus) => {
      setOutcomes((current) => [
        {purchase, status},
        ...current.filter((item) => item.purchase.id !== purchase.id),
      ]);
    },
    [],
  );

  const processPurchase = useCallback(
    async (purchase: Purchase) => {
      const status = await flow.processPurchase(purchase);
      if (activeFlow.current === flow) record(purchase, status);
    },
    [flow, record],
  );

  const recover = useCallback(
    async (includeFinished: boolean) => {
      setRecovering(true);
      try {
        const results = await flow.recoverPurchases({includeFinished});
        if (activeFlow.current !== flow) return;
        results.forEach(({purchase, status}) => record(purchase, status));
        if (includeFinished && results.length === 0) {
          setMessage('No purchases to restore.');
        }
      } catch (error) {
        if (activeFlow.current === flow) {
          setMessage(`Recovery failed: ${extractErrorMessage(error)}`);
        }
      } finally {
        if (activeFlow.current === flow) setRecovering(false);
      }
    },
    [flow, record],
  );

  const {connected, products, subscriptions, fetchProducts, requestPurchase} =
    useIAP({
      onPurchaseSuccess: (purchase) => {
        // Without a backend, leave the purchase unfinished for a later run.
        if (appBackendUrl()) void processPurchase(purchase);
      },
      onPurchaseError: (error) => {
        if (error.code === ErrorCode.UserCancelled) return;
        // Ask to Buy reports a deferred payment instead of a purchase.
        setMessage(
          error.code === ErrorCode.DeferredPayment
            ? GUIDANCE_COPY[
                describePurchaseFlowStatus({status: 'store_pending'}).key
              ]
            : `Purchase failed: ${error.message}`,
        );
      },
    });

  // onPurchaseError already reports a failure such as a cancelled sheet.
  const buy = (request: Parameters<typeof requestPurchase>[0]) =>
    requestPurchase(request).catch(() => undefined);

  const subscribe = (
    subscription: ProductSubscription,
    offerToken: string | undefined,
  ) => {
    return buy({
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
    });
  };

  useEffect(() => {
    if (!connected || !backendUrl || didStartRef.current) return;
    didStartRef.current = true;
    fetchProducts({skus: PRODUCT_IDS, type: 'in-app'})
      .then(() => fetchProducts({skus: SUBSCRIPTION_PRODUCT_IDS, type: 'subs'}))
      .catch((error) =>
        setMessage(`Product loading failed: ${extractErrorMessage(error)}`),
      );
    void recover(false);
  }, [backendUrl, connected, fetchProducts, recover]);

  useEffect(() => {
    if (!backendUrl) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void recover(false);
    });
    return () => subscription.remove();
  }, [backendUrl, recover]);

  if (!backendUrl) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.text}>
            Pay at the store. Your backend confirms the purchase and unlocks
            access before the app finishes it.
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
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.text}>
          Pay at the store. Your backend confirms the purchase and unlocks
          access before the app finishes it.
        </Text>
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
            style={styles.input}
            value={account}
            onChangeText={(value) => {
              if (value === account) return;
              activeFlow.current = null;
              setAccount(value);
              setOutcomes([]);
              setMessage(null);
              setRecovering(false);
            }}
          />
        </View>

        <View>
          <Text style={styles.cardTitle}>Products</Text>
          {products.map((product) => (
            <StoreProductCard
              key={product.id}
              product={product}
              kind={
                CONSUMABLES.has(product.id) ? 'Consumable' : 'One-time purchase'
              }
            >
              <ExampleButton
                title="Buy"
                accessibilityLabel={`Buy ${product.displayName || product.title}`}
                disabled={!connected}
                style={styles.productAction}
                onPress={() =>
                  void buy({
                    request: {
                      apple: {sku: product.id},
                      google: {skus: [product.id]},
                    },
                    type: 'in-app',
                  })
                }
              />
            </StoreProductCard>
          ))}
        </View>
        <View>
          <Text style={styles.cardTitle}>Subscriptions</Text>
          {subscriptions.map((subscription) => {
            // Quote the same Play offer whose token opens the purchase sheet.
            const offer =
              subscription.platform === 'android'
                ? subscription.subscriptionOffers?.find(
                    (candidate) => candidate.offerTokenAndroid,
                  )
                : undefined;
            return (
              <StoreProductCard
                key={subscription.id}
                product={subscription}
                kind="Subscription"
                price={offer?.displayPrice ?? subscription.displayPrice}
              >
                <ExampleButton
                  title="Subscribe"
                  accessibilityLabel={`Subscribe to ${subscription.displayName || subscription.title}`}
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
