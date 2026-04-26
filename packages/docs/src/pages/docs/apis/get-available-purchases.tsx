import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function GetAvailablePurchases() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getAvailablePurchases"
        description="Get all available (unfinished) purchases for the current user. Use this to restore purchases or check for pending transactions."
        path="/docs/apis/get-available-purchases"
        keywords="getAvailablePurchases, restore purchases, pending transactions"
      />
      <h1>getAvailablePurchases</h1>
      <p>
        Get the user's purchases held by the store — owned non-consumables,
        active subscriptions, and any pending transactions not yet finished.
      </p>
      <p>
        <strong>iOS:</strong> By default iterates <code>Transaction.all</code>{' '}
        (the full StoreKit 2 history, including refunded / revoked entries).
        Pass <code>onlyIncludeActiveItemsIOS = true</code> to switch to{' '}
        <code>Transaction.currentEntitlements</code>, which narrows the result
        to active non-consumables and live subscriptions.{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/transaction/all"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple docs
        </a>
        . <strong>Android:</strong> Calls{' '}
        <code>BillingClient.queryPurchasesAsync</code> for both{' '}
        <code>INAPP</code> and <code>SUBS</code> and merges. Only returns
        purchases still owned by the user.{' '}
        <a
          href="https://developer.android.com/reference/com/android/billingclient/api/BillingClient#queryPurchasesAsync(com.android.billingclient.api.QueryPurchasesParams,com.android.billingclient.api.PurchasesResponseListener)"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google docs
        </a>
        .
      </p>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <p>
        Pass an optional{' '}
        <Link to="/docs/types/purchase#purchase-options">
          <code>PurchaseOptions</code>
        </Link>
        :
      </p>
      <ul className="api-params">
        <li>
          <code>alsoPublishToEventListenerIOS</code>{' '}
          <em>
            (optional, <code>boolean</code>, default <code>false</code>)
          </em>{' '}
          — <strong>iOS.</strong> Re-emit results on{' '}
          <code>purchaseUpdatedListener</code>.
        </li>
        <li>
          <code>onlyIncludeActiveItemsIOS</code>{' '}
          <em>
            (optional, <code>boolean</code>, default <code>false</code>)
          </em>{' '}
          — <strong>iOS.</strong> Switch from <code>Transaction.all</code> (full
          history) to <code>Transaction.currentEntitlements</code> (active
          only).
        </li>
        <li>
          <code>includeSuspendedAndroid</code>{' '}
          <em>
            (optional, <code>boolean</code>, default <code>false</code>)
          </em>{' '}
          — <strong>Android.</strong> Include subscriptions in a paused/grace
          state.
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/purchase">
          <code>Promise&lt;Purchase[]&gt;</code>
        </Link>{' '}
        — owned/available purchases held by the store.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`getAvailablePurchases(options?: PurchaseOptions): Promise<Purchase[]>

interface PurchaseOptions {
  alsoPublishToEventListenerIOS?: boolean;
  onlyIncludeActiveItemsIOS?: boolean;
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func getAvailablePurchases(options: PurchaseOptions? = nil) async throws -> [Purchase]`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun getAvailablePurchases(): List<Purchase>`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun getAvailablePurchases(): List<Purchase>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<List<Purchase>> getAvailablePurchases({PurchaseOptions? options});`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func get_available_purchases(options: PurchaseOptions = null) -> Array[Purchase]`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap
import { getAvailablePurchases, finishTransaction } from 'expo-iap';
// Same API in react-native-iap:
// import { getAvailablePurchases, finishTransaction } from 'react-native-iap';

const purchases = await getAvailablePurchases();

for (const purchase of purchases) {
  const verified = await verifyOnServer(purchase);
  if (verified) {
    await finishTransaction({ purchase, isConsumable: false });
  }
}

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
// useIAP's getAvailablePurchases() returns Promise<void> and updates the
// reactive availablePurchases array — process new entries inside an effect.
import { useIAP } from 'expo-iap';

function PendingPurchases() {
  const { availablePurchases, getAvailablePurchases, finishTransaction } =
    useIAP();

  useEffect(() => {
    void getAvailablePurchases();
  }, [getAvailablePurchases]);

  useEffect(() => {
    (async () => {
      for (const purchase of availablePurchases) {
        const verified = await verifyOnServer(purchase);
        if (verified) {
          await finishTransaction({ purchase, isConsumable: false });
        }
      }
    })();
  }, [availablePurchases, finishTransaction]);

  return null;
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`let purchases = try await OpenIapModule.shared.getAvailablePurchases()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`val purchases = openIapStore.getAvailablePurchases()`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`val purchases = kmpIAP.getAvailablePurchases()`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`final purchases = await FlutterInappPurchase.instance.getAvailablePurchases();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`var purchases = await iap.get_available_purchases()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p className="type-link">
        See: <Link to="/docs/types/purchase">Purchase</Link>
      </p>
    </div>
  );
}

export default GetAvailablePurchases;
