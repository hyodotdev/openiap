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
