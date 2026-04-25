import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function OneTimePurchaseOfferDetailAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="ProductAndroidOneTimePurchaseOfferDetail"
        description="ProductAndroidOneTimePurchaseOfferDetail type definition and field reference."
        path="/docs/types/android/one-time-purchase-offer-detail-android"
        keywords="ProductAndroidOneTimePurchaseOfferDetail, OneTimePurchaseOfferDetailAndroid, OpenIAP types"
      />
      <h1>ProductAndroidOneTimePurchaseOfferDetail</h1>
      <section>
        <AnchorLink id="one-time-purchase-offer-detail" level="h2">
          ProductAndroidOneTimePurchaseOfferDetail{' '}
          <span className="deprecated-badge">Deprecated</span>
        </AnchorLink>
        <p>
          <strong>Deprecated.</strong> Use{' '}
          <Link to="/docs/types/discount-offer">
            <code>DiscountOffer</code>
          </Link>{' '}
          (cross-platform) instead.
        </p>
        <p>
          One-time purchase offer details for Android products. Available with{' '}
          <a
            href="https://developer.android.com/google/play/billing/release-notes#7-0-0"
            target="_blank"
            rel="noopener noreferrer"
          >
            Play Billing Library 7.0+
          </a>
          . For implementation examples, see the{' '}
          <Link to="/docs/features/discount">Discounts feature guide</Link>.
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
                <code>offerId</code>
              </td>
              <td>
                <code>string | null</code>
              </td>
              <td>
                Unique offer identifier. <code>null</code> for base offers
              </td>
            </tr>
            <tr>
              <td>
                <code>offerToken</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Token required for purchase requests</td>
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
                <code>formattedPrice</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Localized price string (e.g., &quot;$4.99&quot;)</td>
            </tr>
            <tr>
              <td>
                <code>priceAmountMicros</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Price in micro-units (divide by 1,000,000)</td>
            </tr>
            <tr>
              <td>
                <code>priceCurrencyCode</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>ISO 4217 currency code</td>
            </tr>
            <tr>
              <td>
                <code>discountDisplayInfo</code>
              </td>
              <td>
                <code>DiscountDisplayInfoAndroid | null</code>
              </td>
              <td>Discount display information (percentage, badge text)</td>
            </tr>
            <tr>
              <td>
                <code>fullPriceMicros</code>
              </td>
              <td>
                <code>string | null</code>
              </td>
              <td>Original price before discount in micro-units</td>
            </tr>
            <tr>
              <td>
                <code>validTimeWindow</code>
              </td>
              <td>
                <code>
                  <a href="#valid-time-window-android">
                    ValidTimeWindowAndroid
                  </a>{' '}
                  | null
                </code>
              </td>
              <td>Time-limited offer validity window</td>
            </tr>
            <tr>
              <td>
                <code>limitedQuantityInfo</code>
              </td>
              <td>
                <code>
                  <a href="#limited-quantity-info-android">
                    LimitedQuantityInfoAndroid
                  </a>{' '}
                  | null
                </code>
              </td>
              <td>Quantity-limited offer availability</td>
            </tr>
            <tr>
              <td>
                <code>purchaseOptionId</code>
              </td>
              <td>
                <code>string | null</code>
              </td>
              <td>
                Purchase option ID to identify which option was selected (7.0+)
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="valid-time-window-android" level="h3">
          ValidTimeWindowAndroid
        </AnchorLink>
        <p>Defines the validity period for time-limited offers:</p>
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
                <code>startTimeMillis</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Offer start time (Unix timestamp in milliseconds)</td>
            </tr>
            <tr>
              <td>
                <code>endTimeMillis</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Offer end time (Unix timestamp in milliseconds)</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="limited-quantity-info-android" level="h3">
          LimitedQuantityInfoAndroid
        </AnchorLink>
        <p>Defines availability for quantity-limited offers:</p>
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
                <code>maximumQuantity</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>Maximum number of times offer can be redeemed</td>
            </tr>
            <tr>
              <td>
                <code>remainingQuantity</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>Remaining redemptions available for this user</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default OneTimePurchaseOfferDetailAndroid;
