import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import PlatformTabs from '../../../components/PlatformTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function Product() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Product"
        description="Product type definition and field reference."
        path="/docs/types/product"
        keywords="Product, OpenIAP types, Product"
      />
      <h1>Product</h1>
      <section>
        <AnchorLink id="product" level="h2">
          Product
        </AnchorLink>
        <p>
          Represents a product available for purchase in the store. The type is
          a union of{' '}
          <Link to="/docs/types/product#product-ios">
            <code>ProductIOS</code>
          </Link>{' '}
          and{' '}
          <Link to="/docs/types/product#product-android">
            <code>ProductAndroid</code>
          </Link>
          , discriminated by the <code>platform</code> field.
        </p>
        <p className="type-link">
          <strong>Native references:</strong>{' '}
          <a
            href="https://developer.apple.com/documentation/storekit/product"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple · StoreKit Product
          </a>
          {' · '}
          <a
            href="https://developer.android.com/reference/com/android/billingclient/api/ProductDetails"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google · ProductDetails
          </a>
        </p>

        <AnchorLink id="product-common" level="h3">
          Common Fields
        </AnchorLink>
        <p>These fields are available on both iOS and Android:</p>
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
                <code>id</code>
              </td>
              <td>
                Unique product identifier configured in App Store Connect or
                Google Play Console
              </td>
            </tr>
            <tr>
              <td>
                <code>title</code>
              </td>
              <td>Localized product title</td>
            </tr>
            <tr>
              <td>
                <code>description</code>
              </td>
              <td>Localized product description</td>
            </tr>
            <tr>
              <td>
                <code>type</code>
              </td>
              <td>
                Product type: <code>"in-app"</code> for
                consumables/non-consumables, <code>"subs"</code> for
                subscriptions
              </td>
            </tr>
            <tr>
              <td>
                <code>displayName</code>
              </td>
              <td>Display-friendly product name (optional)</td>
            </tr>
            <tr>
              <td>
                <code>displayPrice</code>
              </td>
              <td>
                Formatted price with currency symbol (e.g., "$9.99", "₩12,000")
              </td>
            </tr>
            <tr>
              <td>
                <code>currency</code>
              </td>
              <td>ISO 4217 currency code (e.g., "USD", "KRW")</td>
            </tr>
            <tr>
              <td>
                <code>price</code>
              </td>
              <td>Numeric price value (e.g., 9.99)</td>
            </tr>
            <tr>
              <td>
                <code>debugDescription</code>
              </td>
              <td>Debug-friendly description (optional)</td>
            </tr>
            <tr>
              <td>
                <code>store</code>
              </td>
              <td>
                Store discriminator: <code>"apple"</code>, <code>"google"</code>
                , or <code>"horizon"</code>
              </td>
            </tr>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>platform</code>
              </td>
              <td>
                <strong>Deprecated.</strong> Use <code>store</code> instead.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="product-platform" level="h3">
          Platform-Specific Fields
        </AnchorLink>
        <PlatformTabs>
          {{
            ios: (
              <>
                <AnchorLink id="product-ios" level="h4">
                  ProductIOS
                </AnchorLink>
                <p>Additional fields available on iOS:</p>
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
                        <code>typeIOS</code>
                      </td>
                      <td>
                        Detailed product type: <code>Consumable</code>,{' '}
                        <code>NonConsumable</code>,{' '}
                        <code>AutoRenewableSubscription</code>, or{' '}
                        <code>NonRenewingSubscription</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>isFamilyShareableIOS</code>
                      </td>
                      <td>Whether the product supports Family Sharing</td>
                    </tr>
                    <tr>
                      <td>
                        <code>displayNameIOS</code>
                      </td>
                      <td>iOS-specific display name</td>
                    </tr>
                    <tr>
                      <td>
                        <code>subscriptionInfoIOS</code>
                      </td>
                      <td>
                        Subscription metadata (only for subscriptions).
                        Contains: <code>subscriptionGroupId</code>,{' '}
                        <code>subscriptionPeriod</code> (unit and value),{' '}
                        <code>introductoryOffer</code>,{' '}
                        <code>promotionalOffers</code>
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
                        </Link>{' '}
                        — unified across iOS/Android.
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>jsonRepresentationIOS</code>
                      </td>
                      <td>Raw StoreKit 2 JWS payload as a JSON string.</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
            android: (
              <>
                <AnchorLink id="product-android" level="h4">
                  ProductAndroid
                </AnchorLink>
                <p>Additional fields available on Android:</p>
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
                        <code>oneTimePurchaseOfferDetailsAndroid</code>
                      </td>
                      <td>
                        Array of one-time purchase offers. Each offer contains:{' '}
                        <code>formattedPrice</code>,{' '}
                        <code>priceAmountMicros</code>,{' '}
                        <code>priceCurrencyCode</code>, <code>offerToken</code>,{' '}
                        <code>discountDisplayInfo</code> (discount info),{' '}
                        <code>fullPriceMicros</code> (original price),{' '}
                        <code>validTimeWindow</code>,{' '}
                        <code>limitedQuantityInfo</code>,{' '}
                        <code>preorderDetailsAndroid</code>,{' '}
                        <code>rentalDetailsAndroid</code>. See{' '}
                        <Link to="/docs/features/discount">Discounts</Link>.
                        Requires{' '}
                        <a
                          href="https://developer.android.com/google/play/billing/release-notes#7-0-0"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Billing Library 7.0+
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>subscriptionOfferDetailsAndroid</code>
                      </td>
                      <td>
                        For subscriptions, array of offer details. Contains:{' '}
                        <code>basePlanId</code>, <code>offerId</code>,{' '}
                        <code>offerToken</code>, <code>pricingPhases</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>productStatusAndroid</code>
                      </td>
                      <td>
                        Product fetch status code. Values: <code>OK</code>{' '}
                        (success), <code>NOT_FOUND</code> (SKU doesn't exist),{' '}
                        <code>NO_OFFERS_AVAILABLE</code> (user not eligible for
                        any offers), <code>UNKNOWN</code>. Requires{' '}
                        <a
                          href="https://developer.android.com/google/play/billing/release-notes#8-0-0"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Billing Library 8.0+
                        </a>
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
                        </Link>{' '}
                        — unified discount metadata.
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
                        </Link>{' '}
                        — unified across iOS/Android.
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

export default Product;
