import AnchorLink from '../../../../components/AnchorLink';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function PaymentModeIos() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="PaymentMode"
        description="PaymentMode type definition and field reference."
        path="/docs/types/ios/payment-mode-ios"
        keywords="PaymentMode, OpenIAP types, Payment Mode"
      />
      <h1>PaymentMode</h1>
      <section>
        <AnchorLink id="payment-mode" level="h2">
          PaymentMode
        </AnchorLink>
        <p>Payment mode for offers:</p>
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
                <code>FreeTrial</code>
              </td>
              <td>Free trial period</td>
            </tr>
            <tr>
              <td>
                <code>PayAsYouGo</code>
              </td>
              <td>Pay each period at reduced price</td>
            </tr>
            <tr>
              <td>
                <code>PayUpFront</code>
              </td>
              <td>Pay full amount upfront</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default PaymentModeIos;
