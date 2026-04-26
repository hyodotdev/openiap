import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function GetTransactionJwsIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getTransactionJwsIOS"
        description="Get the transaction JWS for server-side validation (iOS 15+)."
        path="/docs/apis/ios/get-transaction-jws-ios"
        keywords="getTransactionJwsIOS, JWS, server validation"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        getTransactionJwsIOS
      </h1>
      <p>Get the transaction JWS for server-side validation (iOS 15+).</p>
      <p>
        Returns <code>Transaction.jsonRepresentation</code> (signed JWS) — pass
        to your backend for cryptographic validation. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/transaction/jsonrepresentation"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple StoreKit reference
        </a>
        .
      </p>

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
        <code>Promise&lt;string | null&gt;</code> — Signed JWS for the latest
        transaction, or <code>null</code>.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func getTransactionJwsIOS(sku: String) async throws -> String?`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun getTransactionJwsIOS(sku: String): String?`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`getTransactionJwsIOS(sku: string): Promise<string | null>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<String?> getTransactionJwsIOS(String sku);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func get_transaction_jws_ios(sku: String) -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let jws = try await OpenIapModule.shared.getTransactionJwsIOS(sku: "com.app.premium")`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val jws = kmpIAP.getTransactionJwsIOS(sku = "com.app.premium")`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { getTransactionJwsIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const jws = await getTransactionJwsIOS('com.app.premium');
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  final jws = await FlutterInappPurchase.instance
      .getTransactionJwsIOS('com.app.premium');
}`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var jws = await iap.get_transaction_jws_ios("com.app.premium")`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p className="type-link">
        Returns the StoreKit 2 JWS representation of the most recent verified
        transaction for the given product, or <code>null</code> when none
        exists. Compare with{' '}
        <Link to="/docs/apis/ios/is-transaction-verified-ios">
          <code>isTransactionVerifiedIOS</code>
        </Link>{' '}
        for local-only checks, and{' '}
        <Link to="/docs/apis/ios/get-receipt-data-ios">
          <code>getReceiptDataIOS</code>
        </Link>{' '}
        for the legacy bundle-wide receipt. See{' '}
        <Link to="/docs/types/purchase">
          <code>Purchase</code>
        </Link>{' '}
        for the parsed transaction shape.
      </p>
    </div>
  );
}

export default GetTransactionJwsIOS;
