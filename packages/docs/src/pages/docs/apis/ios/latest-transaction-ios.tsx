import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function LatestTransactionIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="latestTransactionIOS"
        description="Get the most recent transaction for a product (iOS 15+)."
        path="/docs/apis/ios/latest-transaction-ios"
        keywords="latestTransactionIOS, latest transaction"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        latestTransactionIOS
      </h1>
      <p>Get the most recent transaction for a product (iOS 15+).</p>
      <p>
        Wraps <code>Transaction.latest(for:)</code> — returns the most recent
        verified transaction (success or refund). See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/transaction/latest(for:)"
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
            <CodeBlock language="swift">{`func latestTransactionIOS(sku: String) async throws -> Purchase?`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun latestTransactionIOS(sku: String): PurchaseIOS?`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`latestTransactionIOS(sku: string): Promise<PurchaseIOS | null>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<PurchaseIOS?> latestTransactionIOS(String sku);`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<PurchaseIOS?> LatestTransactionIOSAsync(String Sku)`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func latest_transaction_ios(sku: String) -> Variant`}</CodeBlock>
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
          — Product identifier.
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/purchase">
          <code>Promise&lt;PurchaseIOS | null&gt;</code>
        </Link>{' '}
        — iOS purchase shape, or <code>null</code> if the SKU has no matching
        transaction.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let tx = try await OpenIapModule.shared.latestTransactionIOS(sku: "com.app.premium")`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val tx = kmpIAP.latestTransactionIOS(sku = "com.app.premium")`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { latestTransactionIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const tx = await latestTransactionIOS('com.app.premium');
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  final tx = await FlutterInappPurchase.instance
      .latestTransactionIOS('com.app.premium');
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// kmp-iap (iOS targets only — no-op on Android)
var tx = await ((QueryResolver)OpenIapClient.Instance).LatestTransactionIOSAsync(sku: "com.app.premium");`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var tx = await iap.latest_transaction_ios("com.app.premium")`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default LatestTransactionIOS;
