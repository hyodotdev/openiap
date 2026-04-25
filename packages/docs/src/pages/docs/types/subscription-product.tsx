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

        <AnchorLink id="subscription-product-common" level="h3">
          Common Fields
        </AnchorLink>
        <p>
          Inherits all{' '}
          <Link to="/docs/types/product#product-common">
            Product common fields
          </Link>
          .
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
                <code>id</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Unique product identifier</td>
            </tr>
            <tr>
              <td>
                <code>title</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Localized product title</td>
            </tr>
            <tr>
              <td>
                <code>description</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Localized description</td>
            </tr>
            <tr>
              <td>
                <code>type</code>
              </td>
              <td>
                <code>"subs"</code>
              </td>
              <td>
                Always <code>"subs"</code> for subscription products
              </td>
            </tr>
            <tr>
              <td>
                <code>displayName</code>
              </td>
              <td>
                <code>string?</code>
              </td>
              <td>Display-friendly product name (optional)</td>
            </tr>
            <tr>
              <td>
                <code>displayPrice</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Formatted price with currency symbol</td>
            </tr>
            <tr>
              <td>
                <code>currency</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>ISO 4217 currency code</td>
            </tr>
            <tr>
              <td>
                <code>price</code>
              </td>
              <td>
                <code>number?</code>
              </td>
              <td>Numeric price value</td>
            </tr>
            <tr>
              <td>
                <code>debugDescription</code>
              </td>
              <td>
                <code>string?</code>
              </td>
              <td>Debug-friendly description (optional)</td>
            </tr>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>platform</code>
              </td>
              <td>
                <code>IapPlatform</code>
              </td>
              <td>
                <strong>Deprecated.</strong> Use <code>store</code> instead.
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
                        Detailed product type (e.g.,{' '}
                        <code>auto-renewable-subscription</code>)
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
                    <tr>
                      <td>
                        <code>subscriptionOffers</code>
                      </td>
                      <td>
                        Cross-platform array of{' '}
                        <Link to="/docs/types/subscription-offer">
                          <code>SubscriptionOffer</code>
                        </Link>
                      </td>
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
                        <code>discountOffers</code>
                      </td>
                      <td>
                        Cross-platform array of{' '}
                        <Link to="/docs/types/discount-offer">
                          <code>DiscountOffer</code>
                        </Link>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>subscriptionOffers</code>
                      </td>
                      <td>
                        Cross-platform array of{' '}
                        <Link to="/docs/types/subscription-offer">
                          <code>SubscriptionOffer</code>
                        </Link>
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
