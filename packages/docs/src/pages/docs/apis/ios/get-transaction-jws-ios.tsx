import { Link } from 'react-router-dom';
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

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`getTransactionJwsIOS(sku: string): Promise<string | null>`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func getTransactionJwsIOS(sku: String) async throws -> String?`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun getTransactionJwsIOS(sku: String): String?`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun getTransactionJwsIOS(sku: String): String?`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<String?> getTransactionJwsIOS(String sku);`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap
import { getTransactionJwsIOS } from 'expo-iap';
// Same API in react-native-iap:
// import { getTransactionJwsIOS } from 'react-native-iap';

const jws = await getTransactionJwsIOS('com.example.premium');
if (jws) {
  // Send the JWS to your server; verify it with Apple's public keys.
  await fetch('/api/verify-transaction', {
    method: 'POST',
    body: JSON.stringify({ jws }),
  });
}

// --- Or alongside the useIAP() hook (also exported from react-native-iap) ---
// getTransactionJwsIOS is a module-level helper; useIAP doesn't expose it on
// the hook return, so call the module function from inside your component.
import { useIAP } from 'expo-iap';

function ServerValidateButton({ sku }: { sku: string }) {
  const { connected } = useIAP();

  const validate = async () => {
    if (!connected) return;
    const jws = await getTransactionJwsIOS(sku);
    if (!jws) return;
    await api.verify(jws);
  };

  return <Button title="Validate on server" onPress={validate} />;
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`let jws = try await OpenIapModule.shared.getTransactionJwsIOS(sku: "com.example.premium")`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`val jws = openIapStore.getTransactionJwsIOS(sku = "com.example.premium")`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`val jws = kmpIAP.getTransactionJwsIOS(sku = "com.example.premium")`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`final jws = await FlutterInappPurchase.instance
    .getTransactionJwsIOS('com.example.premium');`}</CodeBlock>
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
