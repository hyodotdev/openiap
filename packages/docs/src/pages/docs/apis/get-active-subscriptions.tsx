import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
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

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>subscriptionIds</code>
            </td>
            <td>
              <code>string[]</code>
            </td>
            <td>No</td>
            <td>
              If provided, the result is filtered to these SKUs. Omit / pass{' '}
              <code>null</code> to return every active subscription the store
              knows about.
            </td>
          </tr>
        </tbody>
      </table>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/active-subscription">
          <code>Promise&lt;ActiveSubscription[]&gt;</code>
        </Link>{' '}
        — one entry per active subscription. Each row carries:
      </p>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>productId</code>
            </td>
            <td>
              <code>string</code>
            </td>
            <td>Subscription product identifier.</td>
          </tr>
          <tr>
            <td>
              <code>basePlanId</code>
            </td>
            <td>
              <code>string?</code>
            </td>
            <td>
              <strong>Android.</strong> Base plan identifier when applicable.
            </td>
          </tr>
          <tr>
            <td>
              <code>isActive</code>
            </td>
            <td>
              <code>boolean</code>
            </td>
            <td>
              <code>true</code> while the subscription is in a paying or grace
              state.
            </td>
          </tr>
          <tr>
            <td>
              <code>willExpireSoon</code>
            </td>
            <td>
              <code>boolean?</code>
            </td>
            <td>Hint that renewal is imminent (cancelled or grace period).</td>
          </tr>
          <tr>
            <td>
              <code>expirationDateIOS</code>
            </td>
            <td>
              <code>number?</code>
            </td>
            <td>
              <strong>iOS.</strong> Epoch ms expiration timestamp.
            </td>
          </tr>
          <tr>
            <td>
              <code>environmentIOS</code>
            </td>
            <td>
              <code>string?</code>
            </td>
            <td>
              <strong>iOS.</strong> <code>"Sandbox"</code> or{' '}
              <code>"Production"</code>.
            </td>
          </tr>
          <tr>
            <td>
              <code>autoRenewingAndroid</code>
            </td>
            <td>
              <code>boolean?</code>
            </td>
            <td>
              <strong>Android.</strong> Whether Play will auto-renew at the next
              cycle.
            </td>
          </tr>
        </tbody>
      </table>

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
import { useIAP } from 'expo-iap';

function SubscriptionStatus() {
  const { activeSubscriptions, getActiveSubscriptions } = useIAP();

  useEffect(() => {
    void getActiveSubscriptions();
  }, [getActiveSubscriptions]);

  return (
    <View>
      {activeSubscriptions.map((sub) => (
        <Text key={sub.productId}>{sub.productId}</Text>
      ))}
    </View>
  );
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
