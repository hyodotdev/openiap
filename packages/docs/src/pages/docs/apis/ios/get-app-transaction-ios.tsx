import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function GetAppTransactionIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getAppTransactionIOS"
        description="Fetch the current app transaction (iOS 16+)."
        path="/docs/apis/ios/get-app-transaction-ios"
        keywords="getAppTransactionIOS, app transaction, StoreKit 2"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        getAppTransactionIOS
      </h1>
      <p>Fetch the current app transaction (iOS 16+).</p>
      <p>
        Wraps <code>AppTransaction.shared</code> — the JWS-verified record of
        how the app was acquired. iOS 16+. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/apptransaction"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple StoreKit reference
        </a>
        .
      </p>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/ios/app-transaction-ios">
          <code>Promise&lt;AppTransaction | null&gt;</code>
        </Link>{' '}
        — JWS-verified record of how the app was acquired. Returns{' '}
        <code>null</code> on iOS &lt; 16 or when no transaction is available.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func getAppTransactionIOS() async throws -> AppTransactionIOS?`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun getAppTransactionIOS(): AppTransaction?`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`getAppTransactionIOS(): Promise<AppTransaction | null>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<AppTransaction?> getAppTransactionIOS();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func get_app_transaction_ios() -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let appTx = try await OpenIapModule.shared.getAppTransactionIOS()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val appTx = kmpIAP.getAppTransactionIOS()`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { getAppTransactionIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const appTx = await getAppTransactionIOS();
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  final appTx = await FlutterInappPurchase.instance.getAppTransactionIOS();
}`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var app_tx = await iap.get_app_transaction_ios()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p className="type-link">
        See:{' '}
        <Link to="/docs/types/ios/app-transaction-ios">
          <code>AppTransactionIOS</code>
        </Link>{' '}
        for the full field reference (<code>bundleId</code>,{' '}
        <code>appVersion</code>, <code>originalAppVersion</code>,{' '}
        <code>originalPurchaseDate</code>, <code>environment</code>,{' '}
        <code>deviceVerification</code>, <code>deviceVerificationNonce</code>,{' '}
        <code>signedDate</code>, <code>appId</code>, <code>appVersionId</code>,{' '}
        <code>preorderDate</code>, plus iOS 18.4+ additions like{' '}
        <code>appTransactionId</code> and <code>originalPlatform</code>).
      </p>
    </div>
  );
}

export default GetAppTransactionIOS;
