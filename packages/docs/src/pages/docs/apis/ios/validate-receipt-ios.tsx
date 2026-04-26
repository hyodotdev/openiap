import { Link } from 'react-router-dom';
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
        }}
      </LanguageTabs>
    </div>
  );
}

export default ValidateReceiptIOS;
