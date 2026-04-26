import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function LatestTransactionIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="latestTransactionIOS"
        description="Get the most recent transaction for a product (iOS 15+)."
        path="/docs/apis/ios/latest-transaction-ios"
        keywords="latestTransactionIOS, latest transaction"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        latestTransactionIOS
      </h1>
      <p>Get the most recent transaction for a product (iOS 15+).</p>
      <p>
        Wraps <code>Transaction.latest(for:)</code> — returns the most recent
        verified transaction (success or refund). See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/transaction/latest(for:)"
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
            <td>Product identifier.</td>
          </tr>
        </tbody>
      </table>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/purchase">
          <code>Promise&lt;PurchaseIOS | null&gt;</code>
        </Link>{' '}
        — iOS purchase shape, or <code>null</code> if the SKU has no matching
        transaction.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func latestTransactionIOS(sku: String) async throws -> Purchase?`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default LatestTransactionIOS;
