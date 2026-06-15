import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function SubscriptionStatusIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="subscriptionStatusIOS"
        description="Get detailed subscription status using StoreKit 2 (iOS 15+)."
        path="/docs/apis/ios/subscription-status-ios"
        keywords="subscriptionStatusIOS, StoreKit 2, subscription state"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        subscriptionStatusIOS
      </h1>
      <p>Get detailed subscription status using StoreKit 2 (iOS 15+).</p>
      <p>
        Wraps <code>Product.SubscriptionInfo.status</code> — returns an array
        projected onto <code>SubscriptionStatusIOS</code>, which exposes only{' '}
        <code>renewalInfo</code> and <code>state</code>. The{' '}
        <code>transaction</code> field on Apple's <code>Status</code> type is
        not surfaced by this wrapper; if you need the underlying transaction,
        call <code>latestTransactionIOS(sku)</code> separately. iOS 15+. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/product/subscriptioninfo/status"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple StoreKit reference
        </a>
        .
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func subscriptionStatusIOS(sku: String) async throws -> [SubscriptionStatusIOS]`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun subscriptionStatusIOS(sku: String): List<SubscriptionStatusIOS>`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`subscriptionStatusIOS(sku: string): Promise<SubscriptionStatusIOS[]>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<List<SubscriptionStatusIOS>> subscriptionStatusIOS(String sku);`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<List<SubscriptionStatusIOS>> SubscriptionStatusIOSAsync(String Sku)`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func subscription_status_ios(sku: String) -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <ul className="api-params">
        <li>
          <code>sku</code>{' '}
          <em>
            (required, <code>string</code>)
          </em>{' '}
          — Subscription product identifier.
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/ios/subscription-status-ios">
          <code>Promise&lt;SubscriptionStatusIOS[]&gt;</code>
        </Link>{' '}
        — one entry per status the user has on the subscription:
      </p>
      <ul className="api-params">
        <li>
          <code>state</code>{' '}
          <em>
            (<code>string</code>)
          </em>{' '}
          — StoreKit 2 renewal state (e.g. <code>"subscribed"</code>,{' '}
          <code>"inGracePeriod"</code>, <code>"expired"</code>).
        </li>
        <li>
          <code>renewalInfo</code>{' '}
          <em>
            (
            <Link to="/docs/types/ios/renewal-info-ios">
              <code>RenewalInfoIOS?</code>
            </Link>
            )
          </em>{' '}
          — Renewal metadata (auto-renew flag, renewal date, expiration reason).
          May be <code>null</code>.
        </li>
      </ul>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let status = try await OpenIapModule.shared.subscriptionStatusIOS(sku: "com.app.monthly")`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val status = kmpIAP.subscriptionStatusIOS(sku = "com.app.monthly")`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { subscriptionStatusIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const status = await subscriptionStatusIOS('com.app.monthly');
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  final status = await FlutterInappPurchase.instance
      .subscriptionStatusIOS('com.app.monthly');
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// kmp-iap (iOS targets only — no-op on Android)
var status = await ((QueryResolver)OpenIapClient.Instance).SubscriptionStatusIOSAsync(sku: "com.app.monthly");`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var status = await iap.subscription_status_ios("com.app.monthly")`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default SubscriptionStatusIOS;
