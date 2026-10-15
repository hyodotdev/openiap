import {useCallback, useEffect, useRef, useState} from 'react';
import {
  AppState,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
  type Purchase,
  type PurchaseFlowGuidanceKey,
  type PurchaseFlowOutcome,
  type PurchaseFlowStatus,
} from 'expo-iap';
import {CONSUMABLE_PRODUCT_IDS, PRODUCT_IDS} from '../utils/constants';
import {extractErrorMessage} from '../utils/errorUtils';

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
export default function BackendEntitlementFlow({onExit}: {onExit: () => void}) {
  const backendUrl = appBackendUrl();
  const [account, setAccount] = useState('demo-user-1');
  const [outcomes, setOutcomes] = useState<PurchaseFlowOutcome<Purchase>[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const accountRef = useRef(account);
  const didStartRef = useRef(false);

  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  const [flow] = useState(() =>
    createPurchaseFlow<Purchase>({
      confirmWithBackend: async (purchase) => {
        const response = await fetch(`${appBackendUrl()}/purchases/confirm`, {
          method: 'POST',
          headers: {
            // Stands in for your app's session token.
            authorization: `Bearer ${accountRef.current}`,
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
  );

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
      record(purchase, await flow.processPurchase(purchase));
    },
    [flow, record],
  );

  const recover = useCallback(
    async (includeFinished: boolean) => {
      setRecovering(true);
      try {
        const results = await flow.recoverPurchases({includeFinished});
        results.forEach(({purchase, status}) => record(purchase, status));
        if (includeFinished && results.length === 0) {
          setMessage('No purchases to restore.');
        }
      } catch (error) {
        setMessage(`Recovery failed: ${extractErrorMessage(error)}`);
      } finally {
        setRecovering(false);
      }
    },
    [flow, record],
  );

  const {connected, products, fetchProducts, requestPurchase} = useIAP({
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

  useEffect(() => {
    if (!connected || !backendUrl || didStartRef.current) return;
    didStartRef.current = true;
    fetchProducts({skus: PRODUCT_IDS, type: 'in-app'}).catch((error) =>
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

  const exitButton = (
    <TouchableOpacity
      style={[styles.button, styles.secondaryButton]}
      onPress={onExit}
    >
      <Text style={styles.buttonText}>Choose another verification method</Text>
    </TouchableOpacity>
  );

  if (!backendUrl) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>App Backend Verification</Text>
          {exitButton}
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
        <Text style={styles.title}>App Backend Verification</Text>
        {exitButton}
        <Text style={styles.text}>
          {connected ? 'Connected to the store' : 'Connecting to the store...'}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>App account</Text>
          <Text style={styles.hint}>
            Sent as the bearer token, standing in for your sign-in session.
            Switch accounts and restore to see ownership protection.
          </Text>
          <TextInput
            accessibilityLabel="App account"
            autoCapitalize="none"
            style={styles.input}
            value={account}
            onChangeText={setAccount}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Products</Text>
          {products.map((product) => (
            <TouchableOpacity
              key={product.id}
              style={styles.button}
              onPress={() =>
                void requestPurchase({
                  request: {
                    apple: {sku: product.id},
                    google: {skus: [product.id]},
                  },
                  type: 'in-app',
                })
              }
            >
              <Text style={styles.buttonText}>
                Buy {product.title} · {product.displayPrice}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            disabled={recovering}
            style={[styles.button, styles.secondaryButton]}
            onPress={() => void recover(true)}
          >
            <Text style={styles.buttonText}>
              {recovering ? 'Restoring...' : 'Restore purchases'}
            </Text>
          </TouchableOpacity>
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
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => void processPurchase(purchase)}
                >
                  <Text style={styles.buttonText}>Check again</Text>
                </TouchableOpacity>
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
  content: {padding: 20, gap: 12},
  title: {fontSize: 22, fontWeight: '700', color: '#0F172A'},
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: {fontSize: 16, fontWeight: '600', color: '#0F172A'},
  text: {fontSize: 14, color: '#334155', lineHeight: 20},
  hint: {fontSize: 12, color: '#64748B'},
  status: {fontFamily: 'Courier', fontSize: 13, color: '#2563EB'},
  message: {fontSize: 14, color: '#B91C1C'},
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButton: {backgroundColor: '#475569'},
  buttonText: {color: 'white', fontWeight: '600'},
});
