import AnchorLink from '../../../components/AnchorLink';
import PlatformTabs from '../../../components/PlatformTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function TypesProduct() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Product Types"
        description="OpenIAP Product type definitions - Product, SubscriptionProduct, Unified Platform Types, and Storefront for TypeScript, Swift, Kotlin, Dart."
        path="/docs/types/product"
        keywords="IAP types, Product, SubscriptionProduct, Storefront, TypeScript, Swift, Kotlin"
      />
      <h1>Product Types</h1>
      <p>
        Type definitions for products available in the store, including
        subscriptions and platform-specific fields.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <a href="#product"><code>Product</code></a> - Union of ProductIOS and ProductAndroid
          </li>
          <li>
            <a href="#product-subscription"><code>SubscriptionProduct</code></a> - Extends Product with subscription
            fields
          </li>
          <li>
            <a href="#store-discriminators"><code>store</code></a> discriminator: "apple", "google", or "horizon"
          </li>
          <li>
            <a href="#storefront"><code>Storefront</code></a> - User's store region (ISO 3166-1 alpha-2)
          </li>
        </ul>
      </TLDRBox>

      <section>
        <AnchorLink id="product" level="h2">
          Product
        </AnchorLink>
        <p>
          Represents a product available for purchase in the store. The type is
          a union of <code>ProductIOS</code> and <code>ProductAndroid</code>,
          discriminated by the <code>platform</code> field.
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
                <code>store</code>
              </td>
              <td>
                Store discriminator: <code>"apple"</code>,{' '}
                <code>"google"</code>, or <code>"horizon"</code>
              </td>
            </tr>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>platform</code>{' '}
                <span style={{ color: 'var(--text-warning)', fontSize: '0.8em' }}>
                  (deprecated)
                </span>
              </td>
              <td>
                Use <code>store</code> instead
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
                        <code>priceCurrencyCode</code>,{' '}
                        <code>offerToken</code>,{' '}
                        <code>discountDisplayInfo</code> (discount info),{' '}
                        <code>fullPriceMicros</code> (original price),{' '}
                        <code>validTimeWindow</code>,{' '}
                        <code>limitedQuantityInfo</code>,{' '}
                        <code>preorderDetailsAndroid</code>,{' '}
                        <code>rentalDetailsAndroid</code>.
                        See <a href="/docs/features/discount">Discounts</a>.
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
                  </tbody>
                </table>
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="product-subscription" level="h2">
          SubscriptionProduct
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
          In addition to all <a href="#product-common">Product common fields</a>
          , subscription products include:
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
                <code>type</code>
              </td>
              <td>
                Always <code>"subs"</code> for subscription products
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
                  SubscriptionProductIOS
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
                  </tbody>
                </table>
              </>
            ),
            android: (
              <>
                <AnchorLink id="subscription-product-android" level="h4">
                  SubscriptionProductAndroid
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

      <section>
        <AnchorLink id="unified-platform-types" level="h2">
          Unified Platform Types
        </AnchorLink>
        <p>
          These types combine platform-specific types with a{' '}
          <code>store</code> discriminator for type-safe handling across Apple,
          Google, and Horizon stores.
        </p>

        <AnchorLink id="store-discriminators" level="h3">
          Store Discriminators
        </AnchorLink>
        <p>
          Each unified type includes a <code>store</code> field that identifies
          the source store:
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
                <code>"apple"</code>
              </td>
              <td>Apple App Store (iOS/macOS)</td>
            </tr>
            <tr>
              <td>
                <code>"google"</code>
              </td>
              <td>Google Play Store (Android)</td>
            </tr>
            <tr>
              <td>
                <code>"horizon"</code>
              </td>
              <td>Meta Horizon Store (Quest)</td>
            </tr>
            <tr>
              <td>
                <code>"unknown"</code>
              </td>
              <td>Unknown store (default)</td>
            </tr>
          </tbody>
        </table>
        <blockquote className="info-note">
          <p>
            <strong>Note:</strong> The <code>platform</code> field is deprecated.
            Use <code>store</code> instead.
          </p>
        </blockquote>

        <AnchorLink id="union-types" level="h3">
          Union Types
        </AnchorLink>
        <p>The SDK provides these unified types for cross-platform code:</p>
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
                <code>Product</code>
              </td>
              <td>
                Union of <code>ProductIOS</code> and <code>ProductAndroid</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>SubscriptionProduct</code>
              </td>
              <td>
                Union of <code>SubscriptionProductIOS</code> and{' '}
                <code>SubscriptionProductAndroid</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>Purchase</code>
              </td>
              <td>
                Union of <code>PurchaseIOS</code> and{' '}
                <code>PurchaseAndroid</code>
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          Use the <code>platform</code> field to narrow the type and access
          platform-specific fields safely.
        </p>
      </section>

      <section>
        <AnchorLink id="storefront" level="h2">
          Storefront
        </AnchorLink>
        <p>
          Represents the user&apos;s App Store or Play Store region, returned by{' '}
          <code>getStorefront()</code>.
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
                <code>StorefrontCode</code>
              </td>
              <td>ISO 3166-1 alpha-2 country code (string)</td>
            </tr>
          </tbody>
        </table>
        <p>
          Example values: <code>"US"</code>, <code>"KR"</code>,{' '}
          <code>"JP"</code>. May return an empty string when the storefront
          cannot be determined.
        </p>
        <blockquote className="info-note">
          <p>
            iOS sources the value from the active StoreKit storefront. Android
            queries Google Play Billing configuration and returns the same
            country code string when available.
          </p>
        </blockquote>
      </section>
    </div>
  );
}

export default TypesProduct;
