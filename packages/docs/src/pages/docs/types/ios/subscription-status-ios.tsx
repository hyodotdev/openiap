import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function SubscriptionStatusIos() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="SubscriptionStatusIOS"
        description="SubscriptionStatusIOS type definition and field reference."
        path="/docs/types/ios/subscription-status-ios"
        keywords="SubscriptionStatusIOS, OpenIAP types, Subscription Status I O S"
      />
      <h1>SubscriptionStatusIOS</h1>
      <section>
        <AnchorLink id="subscription-status-ios" level="h2">
          SubscriptionStatusIOS
        </AnchorLink>
        <p>
          Subscription status from StoreKit 2. Use{' '}
          <code>subscriptionStatusIOS(sku)</code> to get detailed subscription
          state.
        </p>
        <p>
          <strong>iOS only.</strong> A trimmed projection of Apple's{' '}
          <code>Product.SubscriptionInfo.Status</code> — the OpenIAP wrapper
          exposes <code>renewalInfo</code> and <code>state</code> only;{' '}
          <code>transaction</code> from the Apple type is not surfaced (
          <a
            href="https://developer.apple.com/documentation/storekit/product/subscriptioninfo/status"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple docs
          </a>
          ).
        </p>
        <p className="type-link">
          <strong>Native reference:</strong>{' '}
          <a
            href="https://developer.apple.com/documentation/storekit/product/subscriptioninfo/renewalstate"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple · Product.SubscriptionInfo.RenewalState
          </a>
        </p>

        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>state</code>
              </td>
              <td>Current renewal state (see values below)</td>
            </tr>
            <tr>
              <td>
                <code>renewalInfo</code>
              </td>
              <td>
                Verified{' '}
                <Link to="/docs/types/ios/renewal-info-ios">
                  <code>RenewalInfoIOS</code>
                </Link>{' '}
                for this product, including <code>jsonRepresentation</code>;{' '}
                <code>null</code> when StoreKit cannot verify it
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="subscription-state-values" level="h3">
          Subscription State Values
        </AnchorLink>
        <p>
          The <code>state</code> field indicates the current subscription
          status:
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>State</th>
              <th>Description</th>
              <th>User Access</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>subscribed</code>
              </td>
              <td>Active subscription</td>
              <td>Grant access</td>
            </tr>
            <tr>
              <td>
                <code>expired</code>
              </td>
              <td>Subscription has expired</td>
              <td>Deny access</td>
            </tr>
            <tr>
              <td>
                <code>revoked</code>
              </td>
              <td>Refunded by Apple</td>
              <td>Deny access</td>
            </tr>
            <tr>
              <td>
                <code>inGracePeriod</code>
              </td>
              <td>Billing failed but grace period active</td>
              <td>Grant access (temporary)</td>
            </tr>
            <tr>
              <td>
                <code>inBillingRetryPeriod</code>
              </td>
              <td>Billing retry in progress</td>
              <td>Consider granting access</td>
            </tr>
            <tr>
              <td>
                <code>unknown</code>
              </td>
              <td>A state this SDK version does not recognize</td>
              <td>Check entitlement on your server</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="expiration-reasons" level="h3">
          iOS Expiration Reasons
        </AnchorLink>
        <p>
          After a subscription expires, <code>expirationReason</code> in{' '}
          <code>renewalInfo</code> holds StoreKit&apos;s raw reason value as a
          string. Keep values you do not recognize.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Value</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>&quot;1&quot;</code>
              </td>
              <td>The user turned off auto-renew</td>
            </tr>
            <tr>
              <td>
                <code>&quot;2&quot;</code>
              </td>
              <td>Billing error (card declined, etc.)</td>
            </tr>
            <tr>
              <td>
                <code>&quot;3&quot;</code>
              </td>
              <td>The user did not agree to a price increase</td>
            </tr>
            <tr>
              <td>
                <code>&quot;4&quot;</code>
              </td>
              <td>The product was no longer available</td>
            </tr>
            <tr>
              <td>
                <code>&quot;5&quot;</code>
              </td>
              <td>Unknown reason</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default SubscriptionStatusIos;
