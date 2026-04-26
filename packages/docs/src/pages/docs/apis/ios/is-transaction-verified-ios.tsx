import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
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
              <code>sku</code>
            </td>
            <td>
              <code>string</code>
            </td>
            <td>Yes</td>
            <td>Product identifier.</td>
          </tr>
        </tbody>
      </table>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — Whether the latest transaction for{' '}
        <code>sku</code> passed JWS verification.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func isTransactionVerifiedIOS(sku: String) async throws -> Bool`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun isTransactionVerifiedIOS(sku: String): Boolean`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`isTransactionVerifiedIOS(sku: string): Promise<boolean>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> isTransactionVerifiedIOS(String sku);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func is_transaction_verified_ios(sku: String) -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let ok = try await OpenIapModule.shared.isTransactionVerifiedIOS(sku: "com.app.premium")`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val ok = kmpIAP.isTransactionVerifiedIOS(sku = "com.app.premium")`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { isTransactionVerifiedIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const ok = await isTransactionVerifiedIOS('com.app.premium');
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  final ok = await FlutterInappPurchase.instance
      .isTransactionVerifiedIOS('com.app.premium');
}`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var ok = await iap.is_transaction_verified_ios("com.app.premium")`}</CodeBlock>
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
