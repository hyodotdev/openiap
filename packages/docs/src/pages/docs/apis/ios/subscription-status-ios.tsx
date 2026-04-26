import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function SubscriptionStatusIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="subscriptionStatusIOS"
        description="Get detailed subscription status using StoreKit 2 (iOS 15+)."
        path="/docs/apis/ios/subscription-status-ios"
        keywords="subscriptionStatusIOS, StoreKit 2, subscription state"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        subscriptionStatusIOS
      </h1>
      <p>Get detailed subscription status using StoreKit 2 (iOS 15+).</p>
      <p>
        Wraps <code>Product.SubscriptionInfo.status</code> — returns an array
        projected onto <code>SubscriptionStatusIOS</code>, which exposes only{' '}
        <code>renewalInfo</code> and <code>state</code>. The{' '}
        <code>transaction</code> field on Apple's <code>Status</code> type is
        not surfaced by this wrapper; if you need the underlying transaction,
        call <code>latestTransactionIOS(sku)</code> separately. iOS 15+. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/product/subscriptioninfo/status"
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
            <td>Subscription product identifier.</td>
          </tr>
        </tbody>
      </table>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/ios/subscription-status-ios">
          <code>Promise&lt;SubscriptionStatusIOS[]&gt;</code>
        </Link>{' '}
        — one entry per status the user has on the subscription:
      </p>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>state</code>
            </td>
            <td>
              <code>string</code>
            </td>
            <td>
              StoreKit 2 renewal state (e.g. <code>"subscribed"</code>,{' '}
              <code>"inGracePeriod"</code>, <code>"expired"</code>).
            </td>
          </tr>
          <tr>
            <td>
              <code>renewalInfo</code>
            </td>
            <td>
              <Link to="/docs/types/ios/renewal-info-ios">
                <code>RenewalInfoIOS?</code>
              </Link>
            </td>
            <td>
              Renewal metadata (auto-renew flag, renewal date, expiration
              reason). May be <code>null</code>.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func subscriptionStatusIOS(sku: String) async throws -> [SubscriptionStatusIOS]`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default SubscriptionStatusIOS;
