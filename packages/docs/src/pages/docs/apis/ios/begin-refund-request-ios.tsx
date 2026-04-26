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
              <code>sku</code>
            </td>
            <td>
              <code>string</code>
            </td>
            <td>Yes</td>
            <td>Product identifier to refund.</td>
          </tr>
        </tbody>
      </table>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;string | null&gt;</code> — Refund request status
        string, or <code>null</code> if the user dismissed the sheet.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func beginRefundRequestIOS(sku: String) async throws -> String?`}</CodeBlock>
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
