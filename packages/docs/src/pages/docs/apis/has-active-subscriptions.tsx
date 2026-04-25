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
          gdscript: (
            <CodeBlock language="gdscript">{`func has_active_subscriptions(subscription_ids: Array[String] = []) -> bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import { hasActiveSubscriptions } from 'expo-iap';

const isPremium = await hasActiveSubscriptions();
const hasProPlan = await hasActiveSubscriptions(['pro_monthly', 'pro_yearly']);`}</CodeBlock>
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
          gdscript: (
            <CodeBlock language="gdscript">{`var is_premium = await iap.has_active_subscriptions()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default HasActiveSubscriptions;
