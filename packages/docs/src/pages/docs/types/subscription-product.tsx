import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import PlatformTabs from '../../../components/PlatformTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function SubscriptionProduct() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="ProductSubscription"
        description="ProductSubscription type definition and field reference."
        path="/docs/types/subscription-product"
        keywords="ProductSubscription, SubscriptionProduct, OpenIAP types"
      />
      <h1>ProductSubscription</h1>
      <section>
        <AnchorLink id="product-subscription" level="h2">
          ProductSubscription
        </AnchorLink>
        <p>
          Represents a subscription product available for purchase. Extends the
          base Product type with subscription-specific fields like pricing
          phases, introductory offers, and billing periods.
        </p>
        <p className="type-link">
          <strong>Native references:</strong>{' '}
          <a
            href="https://developer.apple.com/documentation/storekit/product/subscriptioninfo"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple · Product.SubscriptionInfo
          </a>
          {' · '}
          <a
            href="https://developer.android.com/reference/com/android/billingclient/api/ProductDetails.SubscriptionOfferDetails"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google · ProductDetails.SubscriptionOfferDetails
          </a>
        </p>

        <AnchorLink id="subscription-product-common" level="h3">
          Common Fields
        </AnchorLink>
        <p>
          Inherits every field from{' '}
          <Link to="/docs/types/product#product-common">
            <code>Product</code> common fields
          </Link>{' '}
          (<code>id</code>, <code>title</code>, <code>description</code>,{' '}
          <code>displayName</code>, <code>displayPrice</code>,{' '}
          <code>currency</code>, <code>price</code>,{' '}
          <code>debugDescription</code>,{' '}
          <code style={{ textDecoration: 'line-through' }}>platform</code> (
          <strong>Deprecated.</strong>)), plus the subscription-only override
          and the cross-platform offer arrays below.
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
                <code>type</code>
              </td>
              <td>
                <code>"subs"</code>
              </td>
              <td>
                Always <code>"subs"</code> for subscription products (overrides
                the parent <code>type</code> discriminator).
              </td>
            </tr>
            <tr>
              <td>
                <code>subscriptionOffers</code>
              </td>
              <td>
                <Link to="/docs/types/subscription-offer">
                  <code>SubscriptionOffer[]</code>
                </Link>
              </td>
              <td>
                Cross-platform offer list. Populated from StoreKit 2 promotional
                offers on iOS and from Play Billing offer details on Android.
              </td>
            </tr>
            <tr>
              <td>
                <code>discountOffers</code>
              </td>
              <td>
                <Link to="/docs/types/discount-offer">
                  <code>DiscountOffer[]</code>
                </Link>
              </td>
              <td>
                Cross-platform discount list (introductory pricing, promo
                codes). Always present in the schema; iOS-only stores may return
                an empty array.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="subscription-product-platform" level="h3">
          Platform-Specific Fields
        </AnchorLink>
        <PlatformTabs>
          {{
            ios: (
              <>
                <AnchorLink id="subscription-product-ios" level="h4">
                  ProductSubscriptionIOS
                </AnchorLink>
                <p>Additional fields available on iOS subscriptions:</p>
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
                        <code>discountsIOS</code>
                      </td>
                      <td>
                        Array of available discounts. Each contains:{' '}
                        <code>identifier</code>, <code>type</code>,{' '}
                        <code>numberOfPeriods</code>, <code>price</code>,{' '}
                        <code>localizedPrice</code>, <code>paymentMode</code>,{' '}
                        <code>subscriptionPeriod</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>introductoryPriceIOS</code>
                      </td>
                      <td>Formatted introductory price (e.g., "$0.99")</td>
                    </tr>
                    <tr>
                      <td>
                        <code>introductoryPriceAsAmountIOS</code>
                      </td>
                      <td>Numeric introductory price value</td>
                    </tr>
                    <tr>
                      <td>
                        <code>introductoryPricePaymentModeIOS</code>
                      </td>
                      <td>
                        Payment mode for intro offer (FreeTrial, PayAsYouGo,
                        PayUpFront)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>introductoryPriceNumberOfPeriodsIOS</code>
                      </td>
                      <td>Number of periods for intro pricing</td>
                    </tr>
                    <tr>
                      <td>
                        <code>introductoryPriceSubscriptionPeriodIOS</code>
                      </td>
                      <td>
                        Period unit for intro pricing (Day, Week, Month, Year)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>subscriptionPeriodNumberIOS</code>
                      </td>
                      <td>Number of units in a subscription period</td>
                    </tr>
                    <tr>
                      <td>
                        <code>subscriptionPeriodUnitIOS</code>
                      </td>
                      <td>Period unit (Day, Week, Month, Year)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>typeIOS</code>
                      </td>
                      <td>
                        Detailed product type — for subscriptions this is almost
                        always <code>AutoRenewableSubscription</code> (or{' '}
                        <code>NonRenewingSubscription</code>).
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>displayNameIOS</code>
                      </td>
                      <td>iOS-specific display name</td>
                    </tr>
                    <tr>
                      <td>
                        <code>isFamilyShareableIOS</code>
                      </td>
                      <td>Whether the subscription supports Family Sharing</td>
                    </tr>
                    <tr>
                      <td>
                        <code>jsonRepresentationIOS</code>
                      </td>
                      <td>Raw StoreKit 2 JWS payload</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
            android: (
              <>
                <AnchorLink id="subscription-product-android" level="h4">
                  ProductSubscriptionAndroid
                </AnchorLink>
                <p>Additional fields available on Android subscriptions:</p>
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
                        <code>nameAndroid</code>
                      </td>
                      <td>Android-specific product name</td>
                    </tr>
                    <tr>
                      <td>
                        <code>productStatusAndroid</code>
                      </td>
                      <td>
                        Product fetch status code (<code>OK</code>,{' '}
                        <code>NOT_FOUND</code>, <code>NO_OFFERS_AVAILABLE</code>
                        , <code>UNKNOWN</code>) — Billing Library 8.0+
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>subscriptionOfferDetailsAndroid</code>
                      </td>
                      <td>
                        Array of subscription offers. Each contains:{' '}
                        <code>basePlanId</code>, <code>offerId</code>,{' '}
                        <code>offerToken</code>, <code>pricingPhases</code>,{' '}
                        <code>offerTags</code>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
          }}
        </PlatformTabs>
      </section>
    </div>
  );
}

export default SubscriptionProduct;
