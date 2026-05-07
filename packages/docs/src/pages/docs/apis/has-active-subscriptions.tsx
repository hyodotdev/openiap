import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
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
            <CodeBlock language="swift">{`func hasActiveSubscriptions(subscriptionIds: [String]? = nil) async throws -> Bool`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun hasActiveSubscriptions(subscriptionIds: List<String>? = null): Boolean`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun hasActiveSubscriptions(subscriptionIds: List<String>? = null): Boolean`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> hasActiveSubscriptions({List<String>? subscriptionIds});`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<Boolean> HasActiveSubscriptionsAsync(List<String>? SubscriptionIds = null)`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func has_active_subscriptions(subscription_ids: Array[String] = []) -> bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

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
import { useIAP } from 'expo-iap';

function PremiumGate({ children }: { children: React.ReactNode }) {
  const { hasActiveSubscriptions } = useIAP();
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    void hasActiveSubscriptions().then(setIsPremium);
  }, [hasActiveSubscriptions]);

  return isPremium ? <>{children}</> : <Text>Subscribe to unlock</Text>;
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`let isPremium = try await OpenIapModule.shared.hasActiveSubscriptions()`}</CodeBlock>
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
            <CodeBlock language="csharp">{`using Hyo.OpenIap;
using OpenIap.Maui;

var isPremium = await ((QueryResolver)OpenIap.Instance).HasActiveSubscriptionsAsync()`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`var is_premium = await iap.has_active_subscriptions()`}</CodeBlock>
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
