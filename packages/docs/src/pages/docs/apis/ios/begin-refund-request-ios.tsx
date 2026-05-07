import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function BeginRefundRequestIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="beginRefundRequestIOS"
        description="Initiate a refund request for a product (iOS 15+). Presents the StoreKit refund sheet."
        path="/docs/apis/ios/begin-refund-request-ios"
        keywords="beginRefundRequestIOS, refund, StoreKit refund sheet, refund request"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        beginRefundRequestIOS
      </h1>
      <p>
        Initiate a refund request for a product (iOS 15+). Presents the StoreKit
        refund sheet.
      </p>
      <p>
        Wraps <code>Transaction.beginRefundRequest(in:)</code> — presents the
        refund-request sheet. iOS 15+. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/transaction/beginrefundrequest(in:)"
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
            <CodeBlock language="swift">{`func beginRefundRequestIOS(sku: String) async throws -> String?`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun beginRefundRequestIOS(sku: String): String?`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`beginRefundRequestIOS(sku: string): Promise<string | null>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<String?> beginRefundRequestIOS(String sku);`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<String?> BeginRefundRequestIOSAsync(String Sku)`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func begin_refund_request_ios(product_id: String) -> Types.RefundResultIOS`}</CodeBlock>
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
          — Product identifier to refund.
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;string | null&gt;</code> — Refund request status
        string, or <code>null</code> if the user dismissed the sheet.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let status = try await OpenIapModule.shared.beginRefundRequestIOS(sku: "com.app.premium")`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val status = kmpIAP.beginRefundRequestIOS(sku = "com.app.premium")`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { Platform } from 'react-native';
import { beginRefundRequestIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const status = await beginRefundRequestIOS('com.app.premium');
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  final status = await FlutterInappPurchase.instance
      .beginRefundRequestIOS('com.app.premium');
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using Hyo.OpenIap;
using Hyo.OpenIap.Maui;

// kmp-iap (iOS targets only — no-op on Android)
var status = await ((QueryResolver)OpenIap.Instance).BeginRefundRequestIOSAsync(sku = "com.app.premium")`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    # Synchronous — no await; returns Types.RefundResultIOS directly.
    var result = iap.begin_refund_request_ios("com.app.premium")`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p className="type-link">
        See: <Link to="/docs/features/refund">Refund Guide</Link>
      </p>
    </div>
  );
}

export default BeginRefundRequestIOS;
