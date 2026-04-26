import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function GetStorefrontIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getStorefrontIOS"
        description="Deprecated. Use getStorefront() (cross-platform) instead."
        path="/docs/apis/ios/get-storefront-ios"
        keywords="getStorefrontIOS, deprecated, storefront"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        getStorefrontIOS
      </h1>
      <p>Deprecated. Use getStorefront() (cross-platform) instead.</p>
      <p>
        Wraps <code>Storefront.current</code> — deprecated in OpenIAP. Returns
        the App Store storefront country code. iOS 13+. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/storefront"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple StoreKit reference
        </a>
        .
      </p>

      <div className="alert-card alert-card--warning">
        <p>
          <strong>Deprecated.</strong> Use the cross-platform API. Use{' '}
          <Link to="/docs/apis/get-storefront">getStorefront</Link> instead.
        </p>
      </div>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <p>
        None. <strong>Deprecated</strong> — use <code>getStorefront</code>.
      </p>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;string&gt;</code> — ISO country code of the App Store
        storefront.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`@available(*, deprecated, message: "Use getStorefront()")
func getStorefrontIOS() async throws -> String`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default GetStorefrontIOS;
