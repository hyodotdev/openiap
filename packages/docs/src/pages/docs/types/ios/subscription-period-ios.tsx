import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function SubscriptionPeriodIos() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="SubscriptionPeriodIOS"
        description="SubscriptionPeriodIOS type definition and field reference."
        path="/docs/types/ios/subscription-period-ios"
        keywords="SubscriptionPeriodIOS, OpenIAP types, Subscription Period I O S"
      />
      <h1>SubscriptionPeriodIOS</h1>
      <section>
        <AnchorLink id="subscription-period-ios" level="h2">
          SubscriptionPeriodIOS
        </AnchorLink>
        <p>Subscription period units:</p>
        <p>
          <strong>iOS only.</strong> Mirrors{' '}
          <code>Product.SubscriptionPeriod</code> — <code>unit</code> and{' '}
          <code>value</code> (
          <a
            href="https://developer.apple.com/documentation/storekit/product/subscriptionperiod"
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
            href="https://developer.apple.com/documentation/storekit/product/subscriptionperiod"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple · Product.SubscriptionPeriod
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
                <code>Day</code>, <code>Week</code>, <code>Month</code>,{' '}
                <code>Year</code>
              </td>
              <td>Available subscription period units</td>
            </tr>
            <tr>
              <td>
                <code>Empty</code>
              </td>
              <td>Unspecified period</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="subscription-period-value-ios" level="h3">
          SubscriptionPeriodValueIOS
        </AnchorLink>
        <p>
          A period with its count, used by{' '}
          <Link to="/docs/types/purchase#advanced-commerce-info-ios">
            <code>AdvancedCommerceInfoIOS.period</code>
          </Link>{' '}
          and the{' '}
          <Link to="/docs/types/ios/subscription-billing-plan-ios">
            billing plan types
          </Link>
          :
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
                <code>unit</code>
              </td>
              <td>
                <code>SubscriptionPeriodIOS</code>
              </td>
              <td>Period unit</td>
            </tr>
            <tr>
              <td>
                <code>value</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>Number of units in the period</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default SubscriptionPeriodIos;
