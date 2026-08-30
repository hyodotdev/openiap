import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import StoreConnectionCallout from '../../../components/StoreConnectionCallout';
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
            <CodeBlock language="swift">{`func getAvailablePurchases(_ options: PurchaseOptions?) async throws -> [Purchase]`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun getAvailablePurchases(options: PurchaseOptions? = null): List<Purchase>`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun getAvailablePurchases(options: PurchaseOptions? = null): List<Purchase>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<List<Purchase>> getAvailablePurchases({
  bool? alsoPublishToEventListenerIOS,
  bool? includeSuspendedAndroid,
  bool? onlyIncludeActiveItemsIOS,
});`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<IReadOnlyList<Purchase>> GetAvailablePurchasesAsync(
    PurchaseOptions? options = null
);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func get_available_purchases(options: PurchaseOptions = null) -> Array[Purchase]

# Godot failure-aware variant:
func get_available_purchases_result(options: PurchaseOptions = null) -> Dictionary
# { "success": true, "purchases": Array[Purchase] }
# { "success": false, "code": String, "error": String }`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <StoreConnectionCallout />

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
            (optional, <code>boolean</code>, default <code>true</code>)
          </em>{' '}
          — <strong>iOS.</strong> Use{' '}
          <code>Transaction.currentEntitlements</code> (active only). Pass{' '}
          <code>false</code> to use <code>Transaction.all</code> instead.
        </li>
        <li>
          <code>includeSuspendedAndroid</code>{' '}
          <em>
            (optional, <code>boolean</code>, default <code>false</code>)
          </em>{' '}
          — <strong>Android (Billing 8.1+).</strong> Include suspended
          subscriptions in the result. Suspended entries (
          <code>isSuspendedAndroid === true</code>) should NOT grant
          entitlements — direct the user to the subscription center to resolve
          payment first.
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

      <AnchorLink id="failure-semantics" level="h2">
        Failure semantics
      </AnchorLink>
      <p>
        In SDK APIs that surface failures and in Godot&apos;s result-bearing
        API, an empty purchase list is an authoritative store result: the store
        query completed and found no purchases. Native transaction verification,
        serialization, or bridge decoding failures reject the whole query (or
        return <code>success = false</code>) with an error such as{' '}
        <code>billing-response-json-parse-error</code>; OpenIAP does not return
        a partial list.
      </p>
      <p>
        Godot keeps <code>get_available_purchases()</code> for compatibility, so
        that array-only method still maps a failure to an empty array. Code that
        restores purchases, grants entitlements, or clears cached ownership must
        call <code>get_available_purchases_result()</code> and check{' '}
        <code>success</code> before using <code>purchases</code>. Never revoke
        or clear entitlements after a failed query.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import { useEffect } from 'react';

// expo-iap
import {
  getAvailablePurchases,
  finishTransaction,
  useIAP,
} from 'expo-iap';
// Same API in react-native-iap:
// import {
//   getAvailablePurchases,
//   finishTransaction,
//   useIAP,
// } from 'react-native-iap';

try {
  const purchases = await getAvailablePurchases();

  for (const purchase of purchases) {
    const verified = await verifyOnServer(purchase);
    if (verified) {
      await finishTransaction({ purchase, isConsumable: false });
    }
  }
} catch (error) {
  console.warn('Purchase restore failed:', error);
}

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
// useIAP's getAvailablePurchases() returns Promise<void> and updates the
// reactive availablePurchases array — process new entries inside an effect.

function PendingPurchases() {
  const {
    connected,
    availablePurchases,
    getAvailablePurchases,
    finishTransaction,
  } = useIAP();

  useEffect(() => {
    if (!connected) return;
    void getAvailablePurchases().catch((error) =>
      console.warn('Purchase restore failed:', error),
    );
  }, [connected, getAvailablePurchases]);

  useEffect(() => {
    void (async () => {
      for (const purchase of availablePurchases) {
        const verified = await verifyOnServer(purchase);
        if (verified) {
          await finishTransaction({ purchase, isConsumable: false });
        }
      }
    })().catch((error) => {
      console.warn('Restored purchase processing failed:', error);
    });
  }, [availablePurchases, finishTransaction]);

  return null;
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`let purchases = try await OpenIapModule.shared.getAvailablePurchases(nil)`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`val purchases = openIapStore.getAvailablePurchases(null)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`val purchases = kmpIAP.getAvailablePurchases()`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`final purchases = await FlutterInappPurchase.instance.getAvailablePurchases();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var purchases = await ((QueryResolver)OpenIapClient.Instance).GetAvailablePurchasesAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`var result = await iap.get_available_purchases_result()
if not result.success:
    push_error("Purchase query failed: %s (%s)" % [result.error, result.code])
    return

# An empty array here is a confirmed, successful store result.
var purchases: Array = result.purchases`}</CodeBlock>
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
