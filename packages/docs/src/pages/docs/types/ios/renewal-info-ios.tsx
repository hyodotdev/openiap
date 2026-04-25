import AnchorLink from '../../../../components/AnchorLink';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function RenewalInfoIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="RenewalInfoIOS"
        description="RenewalInfoIOS type definition and field reference."
        path="/docs/types/ios/renewal-info-ios"
        keywords="RenewalInfoIOS, OpenIAP types, StoreKit 2 renewal info"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        RenewalInfoIOS
      </h1>
      <p>
        Subscription renewal details exposed by StoreKit 2's{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/product/subscriptioninfo/renewalinfo"
          target="_blank"
          rel="noopener noreferrer"
        >
          <code>Product.SubscriptionInfo.RenewalInfo</code>
        </a>
        . Carries auto-renewal intent, billing-retry state, price-increase
        responses, and the JWS payload for server-side verification.
      </p>

      <section>
        <AnchorLink id="renewal-info-ios" level="h2">
          RenewalInfoIOS
        </AnchorLink>
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
                <code>willAutoRenew</code>
              </td>
              <td>Whether the subscription will automatically renew.</td>
            </tr>
            <tr>
              <td>
                <code>autoRenewPreference</code>
              </td>
              <td>
                Product ID the subscription will renew to (may differ if an
                upgrade or downgrade is pending).
              </td>
            </tr>
            <tr>
              <td>
                <code>expirationReason</code>
              </td>
              <td>
                Why the subscription expired: <code>"VOLUNTARY"</code>,{' '}
                <code>"BILLING_ERROR"</code>,{' '}
                <code>"DID_NOT_AGREE_TO_PRICE_INCREASE"</code>,{' '}
                <code>"PRODUCT_NOT_AVAILABLE"</code>, <code>"UNKNOWN"</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>gracePeriodExpirationDate</code>
              </td>
              <td>Grace-period end timestamp (epoch ms).</td>
            </tr>
            <tr>
              <td>
                <code>isInBillingRetry</code>
              </td>
              <td>True if Apple is retrying after a billing failure.</td>
            </tr>
            <tr>
              <td>
                <code>pendingUpgradeProductId</code>
              </td>
              <td>Product ID for the pending upgrade/downgrade.</td>
            </tr>
            <tr>
              <td>
                <code>priceIncreaseStatus</code>
              </td>
              <td>
                Price-increase response: <code>"AGREED"</code>,{' '}
                <code>"PENDING"</code>, or <code>null</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>renewalDate</code>
              </td>
              <td>Expected renewal timestamp (epoch ms).</td>
            </tr>
            <tr>
              <td>
                <code>renewalOfferId</code>
              </td>
              <td>Offer ID applied to the next renewal.</td>
            </tr>
            <tr>
              <td>
                <code>renewalOfferType</code>
              </td>
              <td>
                Offer type: <code>"PROMOTIONAL"</code>,{' '}
                <code>"SUBSCRIPTION_OFFER_CODE"</code>, <code>"WIN_BACK"</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>jsonRepresentation</code>
              </td>
              <td>
                Raw JWS representation of the StoreKit renewal info — useful for
                server-side validation.
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default RenewalInfoIOS;
