import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function GetAllTransactionsIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getAllTransactionsIOS"
        description="Get the full StoreKit 2 transaction history as PurchaseIOS values. Requires the SK2ConsumableTransactionHistory Info.plist key for finished consumables to be included (iOS 18+)."
        path="/docs/apis/ios/get-all-transactions-ios"
        keywords="getAllTransactionsIOS, StoreKit 2, transaction history"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        getAllTransactionsIOS
      </h1>
      <p>
        Get the full StoreKit 2 transaction history as PurchaseIOS values.
        Requires the SK2ConsumableTransactionHistory Info.plist key for finished
        consumables to be included (iOS 18+).
      </p>
      <p>
        Iterates <code>Transaction.all</code>. iOS 18+ requires{' '}
        <code>SK2ConsumableTransactionHistory</code> Info.plist key for finished
        consumables to appear. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/transaction/all"
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
            <CodeBlock language="swift">{`func getAllTransactionsIOS() async throws -> [PurchaseIOS]`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun getAllTransactionsIOS(): List<PurchaseIOS>`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`getAllTransactionsIOS(): Promise<PurchaseIOS[]>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<List<PurchaseIOS>> getAllTransactionsIOS();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func get_all_transactions_ios() -> Variant`}</CodeBlock>
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
            <CodeBlock language="swift">{`let txs = try await OpenIapModule.shared.getAllTransactionsIOS()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val txs = kmpIAP.getAllTransactionsIOS()`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { getAllTransactionsIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const txs = await getAllTransactionsIOS();
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  final txs = await FlutterInappPurchase.instance.getAllTransactionsIOS();
}`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var txs = await iap.get_all_transactions_ios()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default GetAllTransactionsIOS;
