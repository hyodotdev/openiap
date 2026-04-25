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
                Renewal details. Contains: <code>willAutoRenew</code>,{' '}
                <code>autoRenewPreference</code>
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
          </tbody>
        </table>

        <AnchorLink id="expiration-reasons" level="h3">
          iOS Expiration Reasons
        </AnchorLink>
        <p>
          When <code>willAutoRenew</code> is <code>false</code>, the{' '}
          <code>expirationReason</code> field in <code>renewalInfo</code>{' '}
          indicates why:
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Reason</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>VOLUNTARY</code>
              </td>
              <td>User cancelled the subscription</td>
            </tr>
            <tr>
              <td>
                <code>BILLING_ERROR</code>
              </td>
              <td>Payment failed (card declined, etc.)</td>
            </tr>
            <tr>
              <td>
                <code>DID_NOT_AGREE_TO_PRICE_INCREASE</code>
              </td>
              <td>User declined a price increase</td>
            </tr>
            <tr>
              <td>
                <code>PRODUCT_NOT_AVAILABLE</code>
              </td>
              <td>Product no longer available for purchase</td>
            </tr>
            <tr>
              <td>
                <code>UNKNOWN</code>
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
