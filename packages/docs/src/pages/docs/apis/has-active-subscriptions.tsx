import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function HasActiveSubscriptions() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="hasActiveSubscriptions"
        description="Quick check if the user has any active subscriptions."
        path="/docs/apis/has-active-subscriptions"
        keywords="hasActiveSubscriptions, premium check, isPremium"
      />
      <h1>hasActiveSubscriptions</h1>
      <p>Quick check if the user has any active subscriptions.</p>
      <p>
        <strong>iOS:</strong> Convenience over{' '}
        <code>getActiveSubscriptions</code> — returns <code>true</code> if the
        iterator yields at least one non-expired subscription.{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/transaction/currententitlements"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple docs
        </a>
        . <strong>Android:</strong> Convenience over{' '}
        <code>queryPurchasesAsync(SUBS)</code> — returns <code>true</code> if
        any subscription is in <code>PURCHASED</code> state.{' '}
        <a
          href="https://developer.android.com/google/play/billing/subscriptions#lifecycle"
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
            <CodeBlock language="typescript">{`hasActiveSubscriptions(subscriptionIds?: string[]): Promise<boolean>`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func hasActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> Bool`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun hasActiveSubscriptions(subscriptionIds: List<String>? = null): Boolean`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun hasActiveSubscriptions(subscriptionIds: List<String>? = null): Boolean`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> hasActiveSubscriptions([
  List<String>? subscriptionIds,
]);`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<bool> HasActiveSubscriptionsAsync(
    IReadOnlyList<string>? subscriptionIds = null
);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func has_active_subscriptions(subscription_ids: Array[String] = []) -> bool

# Godot failure-aware variant:
func has_active_subscriptions_result(subscription_ids: Array[String] = []) -> Dictionary
# { "success": true, "hasActive": bool }
# { "success": false, "code": String, "error": String }`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <Callout kind="important" title="Requires an open connection">
        <p>
          Call{' '}
          <Link to="/docs/apis/init-connection">
            <code>initConnection()</code>
          </Link>{' '}
          first. React Native, Expo, and native promise APIs reject on failure.
          React Native and Expo hooks call <code>onError</code> before
          rethrowing. Gate hook examples on the <code>connected</code> flag and
          handle failures separately from a valid <code>false</code> result.
        </p>
      </Callout>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <ul className="api-params">
        <li>
          <code>subscriptionIds</code>{' '}
          <em>
            (optional, <code>string[]</code>)
          </em>{' '}
          — If provided, only these SKUs are checked. Omit to ask "any active
          subscription at all?".
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> when at least
        one (matching) subscription is in an active state. Convenience over{' '}
        <Link to="/docs/apis/get-active-subscriptions">
          <code>getActiveSubscriptions</code>
        </Link>{' '}
        when you only need a yes/no answer.
      </p>
      <p>
        Only a successful empty query resolves <code>false</code>. Godot
        entitlement code must use <code>has_active_subscriptions_result()</code>
        ; Godot's compatibility boolean helper still maps failure to{' '}
        <code>false</code> and is not safe for granting or revoking access.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap
import { hasActiveSubscriptions } from 'expo-iap';
// Same API in react-native-iap:
// import { hasActiveSubscriptions } from 'react-native-iap';

const isPremium = await hasActiveSubscriptions();
const hasProPlan = await hasActiveSubscriptions(['pro_monthly', 'pro_yearly']);

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useIAP } from 'expo-iap';

function PremiumGate({ children }: { children: React.ReactNode }) {
  const { connected, hasActiveSubscriptions } = useIAP();
  const [status, setStatus] = useState<'checking' | 'active' | 'inactive' | 'error'>('checking');

  useEffect(() => {
    if (!connected) {
      setStatus('checking');
      return;
    }

    let cancelled = false;
    setStatus('checking');
    void hasActiveSubscriptions()
      .then((active) => {
        if (!cancelled) setStatus(active ? 'active' : 'inactive');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [connected, hasActiveSubscriptions]);

  if (status === 'checking') return <Text>Checking subscription…</Text>;
  if (status === 'error') return <Text>Unable to check subscription</Text>;
  return status === 'active' ? <>{children}</> : <Text>Subscribe to unlock</Text>;
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`let isPremium = try await OpenIapModule.shared.hasActiveSubscriptions(nil)`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`val isPremium = openIapStore.hasActiveSubscriptions()`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`val isPremium = kmpIAP.hasActiveSubscriptions()`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`final isPremium = await FlutterInappPurchase.instance.hasActiveSubscriptions();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var isPremium = await ((QueryResolver)OpenIapClient.Instance).HasActiveSubscriptionsAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`var result = await iap.has_active_subscriptions_result()
if not result.success:
    push_error("Subscription status failed: %s (%s)" % [result.error, result.code])
    return
var is_premium: bool = result.hasActive`}</CodeBlock>
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
    </div>
  );
}

export default HasActiveSubscriptions;
