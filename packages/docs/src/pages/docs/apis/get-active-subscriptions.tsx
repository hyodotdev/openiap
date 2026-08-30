import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import StoreConnectionCallout from '../../../components/StoreConnectionCallout';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function GetActiveSubscriptions() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getActiveSubscriptions"
        description="Get all active subscriptions with detailed renewal status information."
        path="/docs/apis/get-active-subscriptions"
        keywords="getActiveSubscriptions, active subscriptions, renewal info, ActiveSubscription"
      />
      <h1>getActiveSubscriptions</h1>
      <p>
        Get all active subscriptions with detailed renewal status information.
      </p>
      <p>
        <strong>iOS:</strong> Iterates{' '}
        <code>Transaction.currentEntitlements</code> and filters to subscription
        product types; checks <code>expirationDate</code> and{' '}
        <code>revocationDate</code>.{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/product/subscriptioninfo"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple docs
        </a>
        . <strong>Android:</strong> Calls <code>queryPurchasesAsync(SUBS)</code>{' '}
        and treats{' '}
        <code>purchaseState == PURCHASED &amp;&amp; autoRenewing</code> as
        active.{' '}
        <a
          href="https://developer.android.com/google/play/billing/subscriptions#lifecycle"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google docs
        </a>
        .
      </p>
      <p>
        <strong>Fire OS:</strong> uses the Amazon adapter's purchase-update
        stream under the Android API shape. App code still passes the same
        subscription SKU list and reads the same <code>ActiveSubscription</code>
        fields; the adapter handles Amazon receipt IDs and the in-flight
        purchase response correlation so examples and framework apps do not need
        ad-hoc SKU alias logic.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`getActiveSubscriptions(subscriptionIds?: string[]): Promise<ActiveSubscription[]>`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func getActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> [ActiveSubscription]`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun getActiveSubscriptions(subscriptionIds: List<String>? = null): List<ActiveSubscription>`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun getActiveSubscriptions(subscriptionIds: List<String>? = null): List<ActiveSubscription>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<List<ActiveSubscription>> getActiveSubscriptions([
  List<String>? subscriptionIds,
]);`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<IReadOnlyList<ActiveSubscription>> GetActiveSubscriptionsAsync(
    IReadOnlyList<string>? subscriptionIds = null
);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func get_active_subscriptions(subscription_ids: Array[String] = []) -> Array[ActiveSubscription]

# Godot failure-aware variant:
func get_active_subscriptions_result(subscription_ids: Array[String] = []) -> Dictionary
# { "success": true, "subscriptions": Array[ActiveSubscription] }
# { "success": false, "code": String, "error": String }`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <StoreConnectionCallout />

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <ul className="api-params">
        <li>
          <code>subscriptionIds</code>{' '}
          <em>
            (optional, <code>string[]</code>)
          </em>{' '}
          — If provided, the result is filtered to these SKUs. Omit / pass{' '}
          <code>null</code> to return every active subscription the store knows
          about.
        </li>
      </ul>

      <AnchorLink id="failure-semantics" level="h2">
        Failure semantics
      </AnchorLink>
      <p>
        Store, serialization, and bridge-decoding failures reject the query;
        they are not an authoritative empty subscription list. The React Native
        and Expo hooks call <code>onError</code> and rethrow. Godot entitlement
        code must use <code>get_active_subscriptions_result()</code> and leave
        its existing entitlement state unchanged when <code>success</code> is{' '}
        <code>false</code>.
      </p>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/active-subscription">
          <code>Promise&lt;ActiveSubscription[]&gt;</code>
        </Link>{' '}
        — one entry per active subscription. Each row carries:
      </p>
      <ul className="api-params">
        <li>
          <code>productId</code>{' '}
          <em>
            (required, <code>string</code>)
          </em>{' '}
          — Subscription product identifier.
        </li>
        <li>
          <code>basePlanIdAndroid</code>{' '}
          <em>
            (optional, <code>string</code>)
          </em>{' '}
          — <strong>Android.</strong> Base plan identifier when applicable.
        </li>
        <li>
          <code>isActive</code>{' '}
          <em>
            (required, <code>boolean</code>)
          </em>{' '}
          — <code>true</code> while the subscription is in a paying or grace
          state.
        </li>
        <li>
          <code>expirationDateIOS</code>{' '}
          <em>
            (optional, <code>number</code>)
          </em>{' '}
          — <strong>iOS.</strong> Epoch ms expiration timestamp.
        </li>
        <li>
          <code>environmentIOS</code>{' '}
          <em>
            (optional, <code>string</code>)
          </em>{' '}
          — <strong>iOS.</strong> <code>"Sandbox"</code> or{' '}
          <code>"Production"</code>.
        </li>
        <li>
          <code>autoRenewingAndroid</code>{' '}
          <em>
            (optional, <code>boolean</code>)
          </em>{' '}
          — <strong>Android.</strong> Whether Play will auto-renew at the next
          cycle.
        </li>
      </ul>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap
import { getActiveSubscriptions } from 'expo-iap';
// Same API in react-native-iap:
// import { getActiveSubscriptions } from 'react-native-iap';

const subscriptions = await getActiveSubscriptions();

for (const sub of subscriptions) {
  console.log(\`Product: \${sub.productId}\`);
  if (sub.renewalInfoIOS?.willAutoRenew === false) {
    console.log('Subscription cancelled, will not renew');
  }
}

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
// useIAP exposes getActiveSubscriptions plus a reactive activeSubscriptions
// list that is refreshed whenever the call resolves.
import { useEffect } from 'react';
import { FlatList, Text } from 'react-native';
import { useIAP } from 'expo-iap';

function SubscriptionStatus() {
  const { connected, activeSubscriptions, getActiveSubscriptions } = useIAP();

  useEffect(() => {
    if (!connected) return;
    void getActiveSubscriptions().catch((error) =>
      console.warn('Subscription lookup failed:', error),
    );
  }, [connected, getActiveSubscriptions]);

  return (
    <FlatList
      data={activeSubscriptions}
      keyExtractor={(subscription) => subscription.productId}
      renderItem={({ item }) => <Text>{item.productId}</Text>}
    />
  );
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`let subscriptions = try await OpenIapModule.shared.getActiveSubscriptions(nil)`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`val subscriptions = openIapStore.getActiveSubscriptions()`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`val subscriptions = kmpIAP.getActiveSubscriptions()`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`final subscriptions = await FlutterInappPurchase.instance.getActiveSubscriptions();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var subscriptions = await ((QueryResolver)OpenIapClient.Instance).GetActiveSubscriptionsAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`var result = await iap.get_active_subscriptions_result()
if not result.success:
    push_error("Subscription query failed: %s (%s)" % [result.error, result.code])
    return
var subscriptions: Array = result.subscriptions`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p className="type-link">
        Live example:{' '}
        <a
          href="https://github.com/hyodotdev/openiap/blob/main/libraries/expo-iap/example/app/subscription-flow.tsx"
          target="_blank"
          rel="noopener noreferrer"
        >
          expo-iap
        </a>{' '}
        ·{' '}
        <a
          href="https://github.com/hyodotdev/openiap/blob/main/libraries/react-native-iap/example/screens/SubscriptionFlow.tsx"
          target="_blank"
          rel="noopener noreferrer"
        >
          react-native-iap
        </a>{' '}
        ·{' '}
        <a
          href="https://github.com/hyodotdev/openiap/blob/main/libraries/flutter_inapp_purchase/example/lib/src/screens/subscription_flow_screen.dart"
          target="_blank"
          rel="noopener noreferrer"
        >
          flutter_inapp_purchase
        </a>{' '}
        ·{' '}
        <a
          href="https://github.com/hyodotdev/openiap/blob/main/libraries/kmp-iap/example/composeApp/src/commonMain/kotlin/dev/hyo/martie/screens/SubscriptionFlowScreen.kt"
          target="_blank"
          rel="noopener noreferrer"
        >
          kmp-iap
        </a>
      </p>

      <p className="type-link">
        See:{' '}
        <Link to="/docs/types/active-subscription">ActiveSubscription</Link>
      </p>
    </div>
  );
}

export default GetActiveSubscriptions;
