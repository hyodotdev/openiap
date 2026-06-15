import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function ClearTransactionIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="clearTransactionIOS"
        description="Clear pending transactions from the StoreKit payment queue."
        path="/docs/apis/ios/clear-transaction-ios"
        keywords="clearTransactionIOS, StoreKit, clear queue"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        clearTransactionIOS
      </h1>
      <p>Clear pending transactions from the StoreKit payment queue.</p>
      <p>
        Iterates <code>Transaction.unfinished</code> and calls{' '}
        <code>.finish()</code> on each — sandbox/dev helper, do NOT ship in
        production paths. See the{' '}
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
            <CodeBlock language="swift">{`func clearTransactionIOS() async throws -> Bool`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun clearTransactionIOS(): Boolean`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`clearTransactionIOS(): Promise<boolean>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> clearTransactionIOS();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<bool> ClearTransactionIOSAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func clear_transaction_ios() -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> once unfinished
        transactions in the queue have been cleared.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`try await OpenIapModule.shared.clearTransactionIOS()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
kmpIAP.clearTransactionIOS()`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { clearTransactionIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  await clearTransactionIOS();
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  await FlutterInappPurchase.instance.clearTransactionIOS();
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// kmp-iap (iOS targets only — no-op on Android)
await ((MutationResolver)OpenIapClient.Instance).ClearTransactionIOSAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var result = await iap.clear_transaction_ios()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default ClearTransactionIOS;
