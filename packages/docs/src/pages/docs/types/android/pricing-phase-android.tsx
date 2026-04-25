import AnchorLink from '../../../../components/AnchorLink';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function PricingPhaseAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="PricingPhaseAndroid"
        description="PricingPhaseAndroid type definition and field reference."
        path="/docs/types/android/pricing-phase-android"
        keywords="PricingPhaseAndroid, OpenIAP types, Pricing Phase Android"
      />
      <h1>PricingPhaseAndroid</h1>
      <section>
        <AnchorLink id="pricing-phase" level="h2">
          PricingPhase
        </AnchorLink>
        <p>Pricing phase for Android subscriptions:</p>
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
                <code>billingPeriod</code>
              </td>
              <td>ISO 8601 period (P1W, P1M, P1Y)</td>
            </tr>
            <tr>
              <td>
                <code>formattedPrice</code>
              </td>
              <td>Formatted price string</td>
            </tr>
            <tr>
              <td>
                <code>priceAmountMicros</code>
              </td>
              <td>Price in micro-units (divide by 1,000,000)</td>
            </tr>
            <tr>
              <td>
                <code>priceCurrencyCode</code>
              </td>
              <td>ISO 4217 currency code</td>
            </tr>
            <tr>
              <td>
                <code>billingCycleCount</code>
              </td>
              <td>Number of cycles for this phase</td>
            </tr>
            <tr>
              <td>
                <code>recurrenceMode</code>
              </td>
              <td>
                How this phase recurs (1 = infinite, 2 = finite, 3 =
                non-recurring)
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="recurrence-mode-values" level="h3">
          Recurrence Mode Values
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Value</th>
              <th>Description</th>
              <th>Use Case</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>1</code>
              </td>
              <td>INFINITE_RECURRING</td>
              <td>Standard subscription (repeats forever)</td>
            </tr>
            <tr>
              <td>
                <code>2</code>
              </td>
              <td>FINITE_RECURRING</td>
              <td>Limited recurring (e.g., 3 months at intro price)</td>
            </tr>
            <tr>
              <td>
                <code>3</code>
              </td>
              <td>NON_RECURRING</td>
              <td>One-time (e.g., free trial)</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="pricing-phases-android" level="h3">
          PricingPhasesAndroid
        </AnchorLink>
        <p>Container wrapping the list of pricing phases for an offer.</p>
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
                <code>pricingPhaseList</code>
              </td>
              <td>
                <code>PricingPhaseAndroid[]</code>
              </td>
              <td>
                Ordered list of pricing phases (intro → trial → standard).
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default PricingPhaseAndroid;
