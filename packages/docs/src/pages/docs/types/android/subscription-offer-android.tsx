import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function SubscriptionOfferAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="ProductSubscriptionAndroidOfferDetails"
        description="ProductSubscriptionAndroidOfferDetails type definition and field reference."
        path="/docs/types/android/subscription-offer-android"
        keywords="ProductSubscriptionAndroidOfferDetails, SubscriptionOfferAndroid, OpenIAP types"
      />
      <h1>ProductSubscriptionAndroidOfferDetails</h1>
      <section>
        <AnchorLink id="subscription-offer" level="h2">
          ProductSubscriptionAndroidOfferDetails{' '}
          <span className="deprecated-badge">Deprecated</span>
        </AnchorLink>
        <p>
          <strong>Deprecated:</strong> Use{' '}
          <Link to="/docs/types/subscription-offer">
            <code>SubscriptionOffer</code>
          </Link>{' '}
          (cross-platform) instead.
        </p>
        <p>Offer details for subscription purchases:</p>

        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>basePlanId</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Base plan identifier (e.g., "monthly", "yearly")</td>
            </tr>
            <tr>
              <td>
                <code>offerId</code>
              </td>
              <td>
                <code>string?</code>
              </td>
              <td>Offer identifier (null for the base plan)</td>
            </tr>
            <tr>
              <td>
                <code>offerToken</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Play Billing offer token (required for purchase)</td>
            </tr>
            <tr>
              <td>
                <code>offerTags</code>
              </td>
              <td>
                <code>string[]</code>
              </td>
              <td>Tags for categorizing offers</td>
            </tr>
            <tr>
              <td>
                <code>pricingPhases</code>
              </td>
              <td>
                <Link to="/docs/types/android/pricing-phase-android">
                  <code>PricingPhasesAndroid</code>
                </Link>
              </td>
              <td>Pricing phase list for the offer</td>
            </tr>
            <tr>
              <td>
                <code>installmentPlanDetails</code>
              </td>
              <td>
                <code>InstallmentPlanDetailsAndroid?</code>
              </td>
              <td>
                Installment plan details (Play Billing 7.0+, null for
                non-installment plans)
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          <strong>Note:</strong> The <code>offerToken</code> must be passed to{' '}
          <Link to="/docs/apis/request-purchase">
            <code>requestPurchase()</code>
          </Link>{' '}
          when purchasing Android subscriptions.
        </p>
      </section>
    </div>
  );
}

export default SubscriptionOfferAndroid;
