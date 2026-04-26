import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function GetPromotedProductIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getPromotedProductIOS"
        description="Get the currently promoted product from App Store (iOS 11+)."
        path="/docs/apis/ios/get-promoted-product-ios"
        keywords="getPromotedProductIOS, promoted product, App Store"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        getPromotedProductIOS
      </h1>
      <p>Get the currently promoted product from App Store (iOS 11+).</p>
      <p>
        Reads the product surfaced via App Store promoted IAP campaigns (
        <code>SKPaymentTransactionObserver.shouldAddStorePayment</code>). iOS
        11+. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/in-app-purchase/promoting-in-app-purchases"
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
      <p>None.</p>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;ProductIOS | null&gt;</code> — The currently promoted
        product, or <code>null</code> if none is queued.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func getPromotedProductIOS() async throws -> Product?`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default GetPromotedProductIOS;
