import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function GetReceiptDataIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getReceiptDataIOS"
        description="Get base64-encoded receipt data for legacy validation."
        path="/docs/apis/ios/get-receipt-data-ios"
        keywords="getReceiptDataIOS, receipt, legacy validation"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        getReceiptDataIOS
      </h1>
      <p>Get base64-encoded receipt data for legacy validation.</p>
      <p>
        Reads <code>Bundle.main.appStoreReceiptURL</code> and base64-encodes the
        file. Legacy StoreKit 1 flow — prefer JWS / <code>verifyPurchase</code>.
        See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/original_api_for_in-app_purchase"
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
            <CodeBlock language="swift">{`func getReceiptDataIOS() async throws -> String?`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun getReceiptDataIOS(): String?`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`getReceiptDataIOS(): Promise<string | null>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<String?> getReceiptDataIOS();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<String?> GetReceiptDataIOSAsync()`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func get_receipt_data_ios() -> String`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;string | null&gt;</code> — Base64-encoded receipt data
        (legacy StoreKit 1 path).
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let data = try await OpenIapModule.shared.getReceiptDataIOS()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val data = kmpIAP.getReceiptDataIOS()`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { getReceiptDataIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const data = await getReceiptDataIOS();
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  final data = await FlutterInappPurchase.instance.getReceiptDataIOS();
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using Hyo.OpenIap;
using Hyo.OpenIap.Maui;

// kmp-iap (iOS targets only — no-op on Android)
var data = await ((QueryResolver)OpenIap.Instance).GetReceiptDataIOSAsync()`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var data = await iap.get_receipt_data_ios()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p>
        iOS receipts contain <strong>all</strong> transactions for the bundle,
        not just the latest one. For per-transaction validation prefer{' '}
        <Link to="/docs/apis/ios/get-transaction-jws-ios">
          <code>getTransactionJwsIOS</code>
        </Link>
        . If the receipt file has not yet been written (e.g. immediately after
        the very first purchase), Apple recommends calling{' '}
        <Link to="/docs/apis/ios/sync-ios">
          <code>syncIOS</code>
        </Link>{' '}
        and retrying.
      </p>
    </div>
  );
}

export default GetReceiptDataIOS;
