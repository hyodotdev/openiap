import { Link } from 'react-router-dom';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function RequestPurchaseOnPromotedProductIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="requestPurchaseOnPromotedProductIOS"
        description="Deprecated. Use promotedProductListenerIOS plus requestPurchase instead."
        path="/docs/apis/ios/request-purchase-on-promoted-product-ios"
        keywords="requestPurchaseOnPromotedProductIOS, deprecated, promoted product"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        requestPurchaseOnPromotedProductIOS
      </h1>
      <p>
        Deprecated. Use promotedProductListenerIOS plus requestPurchase instead.
      </p>
      <p>
        Triggers the promoted product's purchase. <strong>Deprecated</strong> —
        prefer <code>promotedProductListenerIOS</code> +{' '}
        <code>requestPurchase</code> for StoreKit 2. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/in-app-purchase/promoting-in-app-purchases"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple StoreKit reference
        </a>
        .
      </p>

      <div className="alert-card alert-card--warning">
        <p>
          <strong>Deprecated.</strong> In StoreKit 2, promoted products fire
          promotedProductListenerIOS with the productId — call requestPurchase
          with that SKU. Use{' '}
          <Link to="/docs/apis/request-purchase">requestPurchase</Link> instead.
        </p>
      </div>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`@available(*, deprecated, message: "Use promotedProductListenerIOS + requestPurchase instead")
func requestPurchaseOnPromotedProductIOS() async throws -> Bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default RequestPurchaseOnPromotedProductIOS;
