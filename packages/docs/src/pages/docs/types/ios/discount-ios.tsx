import AnchorLink from '../../../../components/AnchorLink';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function DiscountIos() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="DiscountIOS"
        description="DiscountIOS type definition and field reference."
        path="/docs/types/ios/discount-ios"
        keywords="DiscountIOS, OpenIAP types, Discount I O S"
      />
      <h1>DiscountIOS</h1>
      <section>
        <AnchorLink id="discount-ios" level="h2">
          DiscountIOS <span className="deprecated-badge">Deprecated</span>
        </AnchorLink>
        <p>
          <strong>Deprecated:</strong> Use{' '}
          <a href="/docs/types/subscription-offer">SubscriptionOffer</a>{' '}
          instead.
        </p>
        <p>Discount info returned as part of product details:</p>

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
                <code>identifier</code>
              </td>
              <td>Discount identifier</td>
            </tr>
            <tr>
              <td>
                <code>type</code>
              </td>
              <td>Discount type (introductory, promotional)</td>
            </tr>
            <tr>
              <td>
                <code>numberOfPeriods</code>
              </td>
              <td>Number of billing periods</td>
            </tr>
            <tr>
              <td>
                <code>price</code>
              </td>
              <td>Numeric discount price</td>
            </tr>
            <tr>
              <td>
                <code>localizedPrice</code>
              </td>
              <td>Formatted price string with currency symbol</td>
            </tr>
            <tr>
              <td>
                <code>priceAmount</code>
              </td>
              <td>Numeric price value (legacy alias)</td>
            </tr>
            <tr>
              <td>
                <code>paymentMode</code>
              </td>
              <td>Payment mode (FreeTrial, PayAsYouGo, PayUpFront)</td>
            </tr>
            <tr>
              <td>
                <code>subscriptionPeriod</code>
              </td>
              <td>Period duration string</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default DiscountIos;
