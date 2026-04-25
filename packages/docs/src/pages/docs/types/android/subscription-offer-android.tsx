import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function SubscriptionOfferAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="ProductSubscriptionAndroidOfferDetails (Deprecated)"
        description="Deprecated. Use the cross-platform SubscriptionOffer type instead. ProductSubscriptionAndroidOfferDetails type definition and field reference."
        path="/docs/types/android/subscription-offer-android"
        keywords="ProductSubscriptionAndroidOfferDetails, SubscriptionOfferAndroid, deprecated, OpenIAP types"
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
        <p className="type-link">
          <strong>Native reference:</strong>{' '}
          <a
            href="https://developer.android.com/reference/com/android/billingclient/api/ProductDetails.SubscriptionOfferDetails"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google · ProductDetails.SubscriptionOfferDetails
          </a>
        </p>

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
                <Link to="/docs/types/android/pricing-phase-android#pricing-phases-android">
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
                <Link to="/docs/types/android/subscription-offer-android#installment-plan-details-android">
                  <code>InstallmentPlanDetailsAndroid?</code>
                </Link>
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

        <AnchorLink id="installment-plan-details-android" level="h3">
          InstallmentPlanDetailsAndroid
        </AnchorLink>
        <p>
          Installment plan details for subscription offers — Play Billing
          Library 7.0+. Describes how many committed payments the user signs up
          for and the subsequent commitment after renewal.
        </p>
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
                <code>commitmentPaymentsCount</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>
                Committed payments count after the user signs up. e.g. for a
                monthly subscription with <code>commitmentPaymentsCount</code>{' '}
                of 12, the user is billed monthly for 12 months.
              </td>
            </tr>
            <tr>
              <td>
                <code>subsequentCommitmentPaymentsCount</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>
                Committed payments count after the plan renews. Returns{' '}
                <code>0</code> when the installment plan has no subsequent
                commitment (reverts to a regular plan after the first cycle).
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default SubscriptionOfferAndroid;
