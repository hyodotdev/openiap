import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function CurrentEntitlementIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="currentEntitlementIOS"
        description="Get current StoreKit 2 entitlement for a product (iOS 15+)."
        path="/docs/apis/ios/current-entitlement-ios"
        keywords="currentEntitlementIOS, entitlement, StoreKit 2"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        currentEntitlementIOS
      </h1>
      <p>Get current StoreKit 2 entitlement for a product (iOS 15+).</p>
      <p>
        Wraps <code>Transaction.currentEntitlement(for:)</code> — single-product
        convenience over <code>currentEntitlements</code>. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/transaction/currententitlement(for:)"
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
            <CodeBlock language="swift">{`func currentEntitlementIOS(sku: String) async throws -> Purchase?`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default CurrentEntitlementIOS;
