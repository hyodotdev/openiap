import { Link } from 'react-router-dom';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function IsTransactionVerifiedIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="isTransactionVerifiedIOS"
        description="Verify a StoreKit 2 transaction signature (iOS 15+)."
        path="/docs/apis/ios/is-transaction-verified-ios"
        keywords="isTransactionVerifiedIOS, JWS verification, StoreKit 2"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        isTransactionVerifiedIOS
      </h1>
      <p>Verify a StoreKit 2 transaction signature (iOS 15+).</p>
      <p>
        Inspects the <code>VerificationResult</code> from{' '}
        <code>Transaction.latest(for:)</code> — <code>.verified</code> vs{' '}
        <code>.unverified</code>. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/verificationresult"
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
          typescript: (
            <CodeBlock language="typescript">{`isTransactionVerifiedIOS(sku: string): Promise<boolean>`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func isTransactionVerifiedIOS(sku: String) async throws -> Bool`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun isTransactionVerifiedIOS(sku: String): Boolean`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun isTransactionVerifiedIOS(sku: String): Boolean`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> isTransactionVerifiedIOS(String sku);`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap
import { isTransactionVerifiedIOS } from 'expo-iap';
// Same API in react-native-iap:
// import { isTransactionVerifiedIOS } from 'react-native-iap';

const verified = await isTransactionVerifiedIOS('com.example.premium');
if (!verified) {
  // StoreKit 2 reported the JWS signature as unverified - don't grant entitlement.
  return;
}

// --- Or alongside the useIAP() hook (also exported from react-native-iap) ---
// isTransactionVerifiedIOS is a module-level helper; useIAP doesn't expose it
// on the hook return, so call the module function from inside your component.
import { useIAP } from 'expo-iap';

function VerifyButton({ sku }: { sku: string }) {
  const { connected } = useIAP();

  const verify = async () => {
    if (!connected) return;
    const ok = await isTransactionVerifiedIOS(sku);
    Alert.alert(ok ? 'Verified' : 'Verification failed');
  };

  return <Button title="Verify" onPress={verify} />;
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`let isVerified = try await OpenIapModule.shared.isTransactionVerifiedIOS(sku: "com.example.premium")`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`val isVerified = openIapStore.isTransactionVerifiedIOS(sku = "com.example.premium")`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`val isVerified = kmpIAP.isTransactionVerifiedIOS(sku = "com.example.premium")`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`final isVerified = await FlutterInappPurchase.instance
    .isTransactionVerifiedIOS('com.example.premium');`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p>
        Returns <code>true</code> when StoreKit 2 has locally verified the
        transaction&apos;s JWS signature. For server-side validation, fetch the
        signed payload with{' '}
        <Link to="/docs/apis/ios/get-transaction-jws-ios">
          <code>getTransactionJwsIOS</code>
        </Link>{' '}
        and verify it on your backend using Apple&apos;s public keys.
      </p>
    </div>
  );
}

export default IsTransactionVerifiedIOS;
