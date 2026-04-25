import { Link } from 'react-router-dom';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
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

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`getActiveSubscriptions(subscriptionIds?: string[]): Promise<ActiveSubscription[]>`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func getActiveSubscriptions(subscriptionIds: [String]? = nil) async throws -> [ActiveSubscription]`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun getActiveSubscriptions(subscriptionIds: List<String>? = null): List<ActiveSubscription>`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun getActiveSubscriptions(subscriptionIds: List<String>? = null): List<ActiveSubscription>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<List<ActiveSubscription>> getActiveSubscriptions({List<String>? subscriptionIds});`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func get_active_subscriptions(subscription_ids: Array[String] = []) -> Array[ActiveSubscription]`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import { getActiveSubscriptions } from 'expo-iap';

const subscriptions = await getActiveSubscriptions();

for (const sub of subscriptions) {
  console.log(\`Product: \${sub.productId}\`);
  if (sub.renewalInfoIOS?.willAutoRenew === false) {
    console.log('Subscription cancelled, will not renew');
  }
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`let subscriptions = try await OpenIapModule.shared.getActiveSubscriptions()`}</CodeBlock>
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
          gdscript: (
            <CodeBlock language="gdscript">{`var subscriptions = await iap.get_active_subscriptions()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p className="type-link">
        See:{' '}
        <Link to="/docs/types/active-subscription">ActiveSubscription</Link>
      </p>
    </div>
  );
}

export default GetActiveSubscriptions;
