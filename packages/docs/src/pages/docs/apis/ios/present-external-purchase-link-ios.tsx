import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function PresentExternalPurchaseLinkIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="presentExternalPurchaseLinkIOS"
        description="Open external purchase URL in Safari (iOS 18.2+)."
        path="/docs/apis/ios/present-external-purchase-link-ios"
        keywords="presentExternalPurchaseLinkIOS, external link, external purchase"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        presentExternalPurchaseLinkIOS
      </h1>
      <p>Open external purchase URL in Safari (iOS 18.2+).</p>
      <p>
        Wraps <code>ExternalPurchaseLink.open(url:)</code> — StoreKit External,
        iOS 16+ (EU app store). See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/externalpurchaselink"
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
      <table className="doc-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>url</code>
            </td>
            <td>
              <code>string</code>
            </td>
            <td>Yes</td>
            <td>External purchase URL to present.</td>
          </tr>
        </tbody>
      </table>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/external-purchase-link">
          <code>Promise&lt;ExternalPurchaseLinkResultIOS&gt;</code>
        </Link>{' '}
        — carries the result of opening the external link (success flag + any
        error string from StoreKit).
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func presentExternalPurchaseLinkIOS(_ url: String) async throws -> ExternalPurchaseLinkResultIOS

struct ExternalPurchaseLinkResultIOS {
    let error: String?
    let success: Bool
}`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default PresentExternalPurchaseLinkIOS;
