import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function ValidateReceiptIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="validateReceiptIOS"
        description="Deprecated. Use verifyPurchase instead."
        path="/docs/apis/ios/validate-receipt-ios"
        keywords="validateReceiptIOS, deprecated, receipt validation"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        validateReceiptIOS
      </h1>
      <p>Deprecated. Use verifyPurchase instead.</p>
      <p>
        <strong>Deprecated.</strong> Legacy <code>appStoreReceiptURL</code>{' '}
        validation. Use <code>verifyPurchase</code> with the JWS instead. See
        the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/original_api_for_in-app_purchase"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple StoreKit reference
        </a>
        .
      </p>

      <div className="alert-card alert-card--warning">
        <p>
          <strong>Deprecated.</strong> Use the modern cross-platform validation
          API. Use{' '}
          <Link to="/docs/features/validation#verify-purchase">
            verifyPurchase
          </Link>{' '}
          instead.
        </p>
      </div>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`@available(*, deprecated, message: "Use verifyPurchase()")
func validateReceiptIOS(options: ReceiptValidationProps) async throws -> ReceiptValidationResultIOS`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`@Deprecated("Use verifyPurchase()")
suspend fun validateReceiptIOS(options: VerifyPurchaseProps): VerifyPurchaseResultIOS`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`validateReceiptIOS(options: VerifyPurchaseProps): Promise<VerifyPurchaseResultIOS>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`@Deprecated('Use verifyPurchase()')
Future<VerifyPurchaseResultIOS> validateReceiptIOS(VerifyPurchaseProps options);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func validate_receipt_ios(options: Dictionary) -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <ul className="api-params">
        <li>
          <code>options</code>{' '}
          <em>
            (required, <code>VerifyPurchaseProps</code>)
          </em>{' '}
          — Receipt props. <strong>Deprecated</strong> — use{' '}
          <code>verifyPurchase</code>.
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/verify-purchase">
          <code>Promise&lt;VerifyPurchaseResultIOS&gt;</code>
        </Link>{' '}
        — legacy receipt validation result. Carries <code>isValid</code> +
        receipt/JWS metadata. <strong>Deprecated</strong> — use{' '}
        <Link to="/docs/features/validation#verify-purchase">
          verifyPurchase
        </Link>
        .
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`// Deprecated — prefer verifyPurchase().
try await OpenIapModule.shared.validateReceiptIOS(options: .init(sku: "com.app.premium"))`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
// Deprecated — prefer verifyPurchase().
kmpIAP.validateReceiptIOS(options = VerifyPurchaseProps(sku = "com.app.premium"))`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// Deprecated — prefer verifyPurchase().
await validateReceiptIOS({ sku: 'com.app.premium' });`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`// Deprecated — prefer verifyPurchase().
if (Platform.isIOS) {
  await FlutterInappPurchase.instance.validateReceiptIOS(
    VerifyPurchaseProps(sku: 'com.app.premium'),
  );
}`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var result = await iap.validate_receipt_ios({"sku": "com.app.premium"})`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default ValidateReceiptIOS;
