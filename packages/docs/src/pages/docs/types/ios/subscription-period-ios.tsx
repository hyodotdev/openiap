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
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default SubscriptionPeriodIos;
