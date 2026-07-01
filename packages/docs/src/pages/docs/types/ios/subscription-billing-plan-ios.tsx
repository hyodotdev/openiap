import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function SubscriptionBillingPlanIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="SubscriptionBillingPlanIOS"
        description="StoreKit 26.4 billing plan and commitment fields for iOS subscriptions."
        path="/docs/types/ios/subscription-billing-plan-ios"
        keywords="SubscriptionBillingPlanTypeIOS, SubscriptionPricingTermsIOS, commitment subscription, StoreKit billing plan"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        Subscription Billing Plans
      </h1>
      <p>
        StoreKit 26.4 adds billing plans for auto-renewable subscriptions,
        including monthly billing with a 12-month commitment and up-front
        billing for the full subscription period. OpenIAP exposes the selected
        billing plan on purchase results, available pricing terms on fetched
        products, and commitment renewal details when StoreKit returns them.
      </p>

      <div className="alert-card alert-card--info">
        <p>
          <strong>Availability:</strong> billing plan selection requires iOS,
          iPadOS, macOS, tvOS, or visionOS 26.4+ and an app compiled with the
          StoreKit billing-plan APIs available in Xcode 26.4+ / Swift 6.3+. On
          older runtimes, omit <code>billingPlanType</code> and use the store's
          default billing plan.
        </p>
      </div>

      <section>
        <AnchorLink id="subscription-billing-plan-type-ios" level="h2">
          SubscriptionBillingPlanTypeIOS
        </AnchorLink>
        <p>
          Enum used by{' '}
          <Link to="/docs/types/request-purchase-props#request-subscription-ios-props">
            <code>RequestSubscriptionIosProps.billingPlanType</code>
          </Link>
          , <code>PurchaseIOS.billingPlanTypeIOS</code>, pricing terms, and
          renewal commitment fields.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Value</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>unknown</code>
              </td>
              <td>
                StoreKit returned an unsupported or unavailable billing plan
                type.
              </td>
            </tr>
            <tr>
              <td>
                <code>monthly</code>
              </td>
              <td>Monthly billing with a 12-month commitment.</td>
            </tr>
            <tr>
              <td>
                <code>up-front</code>
              </td>
              <td>Up-front billing for the full subscription period.</td>
            </tr>
          </tbody>
        </table>

        <CodeBlock language="typescript">{`type SubscriptionBillingPlanTypeIOS = 'unknown' | 'monthly' | 'up-front';`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="subscription-pricing-terms-ios" level="h2">
          SubscriptionPricingTermsIOS
        </AnchorLink>
        <p>
          Pricing term returned on <code>ProductIOS.pricingTermsIOS</code>,{' '}
          <code>ProductSubscriptionIOS.pricingTermsIOS</code>, and{' '}
          <code>SubscriptionInfoIOS.pricingTerms</code>. Use it to display the
          available commitment choices before starting a purchase.
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
                <code>billingDisplayPrice</code>
              </td>
              <td>Localized billing price for this plan.</td>
            </tr>
            <tr>
              <td>
                <code>billingPeriod</code>
              </td>
              <td>
                Billing cadence as a{' '}
                <Link to="/docs/types/ios/subscription-period-ios">
                  <code>SubscriptionPeriodIOS</code>
                </Link>
                .
              </td>
            </tr>
            <tr>
              <td>
                <code>billingPlanType</code>
              </td>
              <td>
                <code>monthly</code>, <code>up-front</code>, or{' '}
                <code>unknown</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>billingPrice</code>
              </td>
              <td>Numeric billing price for this plan.</td>
            </tr>
            <tr>
              <td>
                <code>commitmentInfo</code>
              </td>
              <td>
                Full commitment price and period for this plan. See{' '}
                <Link to="/docs/types/ios/subscription-billing-plan-ios#subscription-commitment-info-ios">
                  <code>SubscriptionCommitmentInfoIOS</code>
                </Link>
                .
              </td>
            </tr>
            <tr>
              <td>
                <code>subscriptionOffers</code>
              </td>
              <td>
                StoreKit offers attached to this billing plan, normalized as{' '}
                <Link to="/docs/types/subscription-offer">
                  <code>SubscriptionOffer</code>
                </Link>
                .
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="subscription-commitment-info-ios" level="h2">
          SubscriptionCommitmentInfoIOS
        </AnchorLink>
        <p>
          Commitment summary attached to a pricing term before purchase. It
          describes the full commitment, not just one billing installment.
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
                <code>displayPrice</code>
              </td>
              <td>Localized commitment total.</td>
            </tr>
            <tr>
              <td>
                <code>period</code>
              </td>
              <td>Full commitment duration.</td>
            </tr>
            <tr>
              <td>
                <code>price</code>
              </td>
              <td>Numeric commitment total.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="transaction-commitment-info-ios" level="h2">
          TransactionCommitmentInfoIOS
        </AnchorLink>
        <p>
          Commitment state attached to{' '}
          <code>PurchaseIOS.commitmentInfoIOS</code> after purchase and on later
          transaction reads such as{' '}
          <Link to="/docs/apis/ios/latest-transaction-ios">
            <code>latestTransactionIOS</code>
          </Link>
          .
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
                <code>billingPeriodNumber</code>
              </td>
              <td>Current billing period number within the commitment.</td>
            </tr>
            <tr>
              <td>
                <code>totalBillingPeriods</code>
              </td>
              <td>Total number of billing periods in the commitment.</td>
            </tr>
            <tr>
              <td>
                <code>commitmentExpiresDate</code>
              </td>
              <td>Commitment expiration timestamp in epoch milliseconds.</td>
            </tr>
            <tr>
              <td>
                <code>commitmentPrice</code>
              </td>
              <td>Numeric price StoreKit reports for the commitment.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="renewal-commitment-info-ios" level="h2">
          RenewalCommitmentInfoIOS
        </AnchorLink>
        <p>
          Commitment renewal state attached to{' '}
          <Link to="/docs/types/ios/renewal-info-ios">
            <code>RenewalInfoIOS.commitmentInfo</code>
          </Link>
          . Use this when StoreKit reports the next commitment renewal plan or
          renewal price.
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
                <code>commitmentAutoRenewProductId</code>
              </td>
              <td>Product ID StoreKit will auto-renew to.</td>
            </tr>
            <tr>
              <td>
                <code>commitmentAutoRenewStatus</code>
              </td>
              <td>Whether StoreKit reports the commitment will auto-renew.</td>
            </tr>
            <tr>
              <td>
                <code>commitmentRenewalBillingPlanType</code>
              </td>
              <td>Billing plan type for the next commitment renewal.</td>
            </tr>
            <tr>
              <td>
                <code>commitmentRenewalDate</code>
              </td>
              <td>Next commitment renewal timestamp in epoch milliseconds.</td>
            </tr>
            <tr>
              <td>
                <code>commitmentRenewalPrice</code>
              </td>
              <td>Numeric renewal price for the next commitment.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <p className="type-link">
        See also:{' '}
        <Link to="/docs/features/subscription#ios-commitment-billing-plans">
          iOS commitment billing plans guide
        </Link>
        {' · '}
        <Link to="/docs/apis/request-purchase">requestPurchase</Link>
        {' · '}
        <Link to="/docs/types/purchase#purchase-ios">PurchaseIOS</Link>
      </p>
    </div>
  );
}

export default SubscriptionBillingPlanIOS;
