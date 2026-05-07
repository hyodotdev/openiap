import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function GetPendingTransactionsIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getPendingTransactionsIOS"
        description="Retrieve all pending transactions in the StoreKit queue."
        path="/docs/apis/ios/get-pending-transactions-ios"
        keywords="getPendingTransactionsIOS, StoreKit, pending"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        getPendingTransactionsIOS
      </h1>
      <p>Retrieve all pending transactions in the StoreKit queue.</p>
      <p>
        Iterates <code>Transaction.unfinished</code> to surface transactions
        still awaiting <code>finish()</code>. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/transaction/unfinished"
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
            <CodeBlock language="swift">{`func getPendingTransactionsIOS() async throws -> [Purchase]`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun getPendingTransactionsIOS(): List<PurchaseIOS>`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`getPendingTransactionsIOS(): Promise<PurchaseIOS[]>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<List<PurchaseIOS>> getPendingTransactionsIOS();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<List<PurchaseIOS>> GetPendingTransactionsIOSAsync()`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func get_pending_transactions_ios() -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/purchase">
          <code>Promise&lt;PurchaseIOS[]&gt;</code>
        </Link>{' '}
        — array of StoreKit transactions in the iOS-specific shape. See{' '}
        <Link to="/docs/types/purchase">
          <code>Purchase</code>
        </Link>{' '}
        for the full field reference.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let txs = try await OpenIapModule.shared.getPendingTransactionsIOS()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val txs = kmpIAP.getPendingTransactionsIOS()`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { getPendingTransactionsIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const txs = await getPendingTransactionsIOS();
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  final txs = await FlutterInappPurchase.instance.getPendingTransactionsIOS();
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// kmp-iap (iOS targets only — no-op on Android)
var txs = await ((QueryResolver)Iap.Instance).GetPendingTransactionsIOSAsync()`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var txs = await iap.get_pending_transactions_ios()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default GetPendingTransactionsIOS;
