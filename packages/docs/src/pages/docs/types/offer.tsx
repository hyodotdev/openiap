import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function TypesOffer() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Discount & Subscription Offer Types"
        description="OpenIAP standardized discount and subscription offer types - cross-platform interfaces with platform-specific fields for iOS and Android."
        path="/docs/types/offer"
        keywords="IAP types, DiscountOffer, SubscriptionOffer, cross-platform, iOS, Android, discounts, promotional offers"
      />
      <h1>Discount & Subscription Offer Types</h1>
      <p>
        Standardized cross-platform types for handling discounts and
        subscription offers. These types provide a unified interface while
        preserving platform-specific functionality through suffixed fields.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <a href="#discount-offer">
              <code>DiscountOffer</code>
            </a>{' '}
            - One-time product discounts (Android 7.0+)
          </li>
          <li>
            <a href="#subscription-offer">
              <code>SubscriptionOffer</code>
            </a>{' '}
            - Subscription discounts (iOS & Android)
          </li>
          <li>
            Platform-specific fields use <code>IOS</code> or{' '}
            <code>Android</code> suffix
          </li>
          <li>
            Deprecated:{' '}
            <code>
              DiscountIOS, DiscountOfferIOS, SubscriptionOfferIOS,
              ProductAndroidOneTimePurchaseOfferDetail,
              ProductSubscriptionAndroidOfferDetails
            </code>
          </li>
        </ul>
      </TLDRBox>

      <div className="alert-card alert-card--info">
        <p>
          <strong>Migration Note:</strong> The legacy platform-specific types
          are now deprecated. Use these standardized types for new
          implementations and migrate existing code when convenient.
        </p>
      </div>

      <section>
        <AnchorLink id="discount-offer" level="h2">
          DiscountOffer
        </AnchorLink>
        <p>
          Standardized type for one-time product discount offers. Currently
          supported on Android (Google Play Billing Library 7.0+). iOS does not
          support one-time purchase discounts.
        </p>

        <AnchorLink id="discount-offer-common-fields" level="h3">
          Common Fields
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>id</code>
              </td>
              <td>
                <code>ID</code>
              </td>
              <td>Unique identifier for the offer</td>
            </tr>
            <tr>
              <td>
                <code>displayPrice</code>
              </td>
              <td>
                <code>String!</code>
              </td>
              <td>Formatted display price (e.g., "$4.99")</td>
            </tr>
            <tr>
              <td>
                <code>price</code>
              </td>
              <td>
                <code>Float!</code>
              </td>
              <td>Numeric price value</td>
            </tr>
            <tr>
              <td>
                <code>currency</code>
              </td>
              <td>
                <code>String!</code>
              </td>
              <td>Currency code (ISO 4217, e.g., "USD")</td>
            </tr>
            <tr>
              <td>
                <code>type</code>
              </td>
              <td>
                <code>DiscountOfferType!</code>
              </td>
              <td>Type of offer: <code>Introductory</code>, <code>Promotional</code>, <code>WinBack</code> (iOS 18+), or <code>OneTime</code></td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="discount-offer-android-fields" level="h3">
          Android-Specific Fields
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>offerTokenAndroid</code>
              </td>
              <td>
                <code>String</code>
              </td>
              <td>
                <strong>Required for purchase.</strong> Pass to
                requestPurchase()
              </td>
            </tr>
            <tr>
              <td>
                <code>offerTagsAndroid</code>
              </td>
              <td>
                <code>[String!]</code>
              </td>
              <td>Tags associated with this offer</td>
            </tr>
            <tr>
              <td>
                <code>fullPriceMicrosAndroid</code>
              </td>
              <td>
                <code>String</code>
              </td>
              <td>Original price in micro-units (divide by 1,000,000)</td>
            </tr>
            <tr>
              <td>
                <code>percentageDiscountAndroid</code>
              </td>
              <td>
                <code>Int</code>
              </td>
              <td>Percentage discount (e.g., 33 for 33% off)</td>
            </tr>
            <tr>
              <td>
                <code>discountAmountMicrosAndroid</code>
              </td>
              <td>
                <code>String</code>
              </td>
              <td>Fixed discount amount in micro-units</td>
            </tr>
            <tr>
              <td>
                <code>formattedDiscountAmountAndroid</code>
              </td>
              <td>
                <code>String</code>
              </td>
              <td>Formatted discount amount (e.g., "$5.00 OFF")</td>
            </tr>
            <tr>
              <td>
                <code>validTimeWindowAndroid</code>
              </td>
              <td>
                <code>ValidTimeWindowAndroid</code>
              </td>
              <td>Time window for limited-time offers</td>
            </tr>
            <tr>
              <td>
                <code>limitedQuantityInfoAndroid</code>
              </td>
              <td>
                <code>LimitedQuantityInfoAndroid</code>
              </td>
              <td>Quantity limits for the offer</td>
            </tr>
            <tr>
              <td>
                <code>preorderDetailsAndroid</code>
              </td>
              <td>
                <code>PreorderDetailsAndroid</code>
              </td>
              <td>Pre-order details (Billing Library 8.1.0+)</td>
            </tr>
            <tr>
              <td>
                <code>rentalDetailsAndroid</code>
              </td>
              <td>
                <code>RentalDetailsAndroid</code>
              </td>
              <td>Rental offer details</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="discount-offer-type-definition" level="h3">
          Type Definition
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`interface DiscountOffer {
  // Common fields
  id: string | null;
  displayPrice: string;
  price: number;
  currency: string;
  type: DiscountOfferType;

  // Android-specific fields
  offerTokenAndroid?: string;
  offerTagsAndroid?: string[];
  fullPriceMicrosAndroid?: string;
  percentageDiscountAndroid?: number;
  discountAmountMicrosAndroid?: string;
  formattedDiscountAmountAndroid?: string;
  validTimeWindowAndroid?: ValidTimeWindowAndroid;
  limitedQuantityInfoAndroid?: LimitedQuantityInfoAndroid;
  preorderDetailsAndroid?: PreorderDetailsAndroid;
  rentalDetailsAndroid?: RentalDetailsAndroid;
}

enum DiscountOfferType {
  Introductory = 'Introductory',
  Promotional = 'Promotional',
  WinBack = 'WinBack',    // iOS 18+
  OneTime = 'OneTime',
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`struct DiscountOffer: Codable {
    // Common fields
    let id: String?
    let displayPrice: String
    let price: Double
    let currency: String
    let type: DiscountOfferType

    // Android-specific fields
    let offerTokenAndroid: String?
    let offerTagsAndroid: [String]?
    let fullPriceMicrosAndroid: String?
    let percentageDiscountAndroid: Int?
    let discountAmountMicrosAndroid: String?
    let formattedDiscountAmountAndroid: String?
    let validTimeWindowAndroid: ValidTimeWindowAndroid?
    let limitedQuantityInfoAndroid: LimitedQuantityInfoAndroid?
    let preorderDetailsAndroid: PreorderDetailsAndroid?
    let rentalDetailsAndroid: RentalDetailsAndroid?
}

enum DiscountOfferType: String, Codable {
    case introductory = "Introductory"
    case promotional = "Promotional"
    case winBack = "WinBack"    // iOS 18+
    case oneTime = "OneTime"
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`data class DiscountOffer(
    // Common fields
    val id: String?,
    val displayPrice: String,
    val price: Double,
    val currency: String,
    val type: DiscountOfferType,

    // Android-specific fields
    val offerTokenAndroid: String? = null,
    val offerTagsAndroid: List<String>? = null,
    val fullPriceMicrosAndroid: String? = null,
    val percentageDiscountAndroid: Int? = null,
    val discountAmountMicrosAndroid: String? = null,
    val formattedDiscountAmountAndroid: String? = null,
    val validTimeWindowAndroid: ValidTimeWindowAndroid? = null,
    val limitedQuantityInfoAndroid: LimitedQuantityInfoAndroid? = null,
    val preorderDetailsAndroid: PreorderDetailsAndroid? = null,
    val rentalDetailsAndroid: RentalDetailsAndroid? = null
)

enum class DiscountOfferType {
    Introductory,
    Promotional,
    WinBack,    // iOS 18+
    OneTime
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`class DiscountOffer {
  // Common fields
  final String? id;
  final String displayPrice;
  final double price;
  final String currency;
  final DiscountOfferType type;

  // Android-specific fields
  final String? offerTokenAndroid;
  final List<String>? offerTagsAndroid;
  final String? fullPriceMicrosAndroid;
  final int? percentageDiscountAndroid;
  final String? discountAmountMicrosAndroid;
  final String? formattedDiscountAmountAndroid;
  final ValidTimeWindowAndroid? validTimeWindowAndroid;
  final LimitedQuantityInfoAndroid? limitedQuantityInfoAndroid;
  final PreorderDetailsAndroid? preorderDetailsAndroid;
  final RentalDetailsAndroid? rentalDetailsAndroid;

  DiscountOffer({
    this.id,
    required this.displayPrice,
    required this.price,
    required this.currency,
    required this.type,
    this.offerTokenAndroid,
    this.offerTagsAndroid,
    this.fullPriceMicrosAndroid,
    this.percentageDiscountAndroid,
    this.discountAmountMicrosAndroid,
    this.formattedDiscountAmountAndroid,
    this.validTimeWindowAndroid,
    this.limitedQuantityInfoAndroid,
    this.preorderDetailsAndroid,
    this.rentalDetailsAndroid,
  });
}

enum DiscountOfferType {
  introductory,
  promotional,
  winBack,    // iOS 18+
  oneTime,
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`class_name DiscountOffer

# Common fields
var id: String
var display_price: String
var price: float
var currency: String
var type: DiscountOfferType

# Android-specific fields
var offer_token_android: String
var offer_tags_android: Array[String]
var full_price_micros_android: String
var percentage_discount_android: int
var discount_amount_micros_android: String
var formatted_discount_amount_android: String
var valid_time_window_android: ValidTimeWindowAndroid
var limited_quantity_info_android: LimitedQuantityInfoAndroid
var preorder_details_android: PreorderDetailsAndroid
var rental_details_android: RentalDetailsAndroid

enum DiscountOfferType {
    INTRODUCTORY,
    PROMOTIONAL,
    WIN_BACK,    # iOS 18+
    ONE_TIME
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="subscription-offer" level="h2">
          SubscriptionOffer
        </AnchorLink>
        <p>
          Standardized type for subscription promotional offers. Supported on
          both iOS (introductory and promotional offers) and Android (offer
          tokens with pricing phases).
        </p>

        <AnchorLink id="subscription-offer-common-fields" level="h3">
          Common Fields
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>id</code>
              </td>
              <td>
                <code>ID!</code>
              </td>
              <td>Unique identifier for the offer</td>
            </tr>
            <tr>
              <td>
                <code>displayPrice</code>
              </td>
              <td>
                <code>String!</code>
              </td>
              <td>Formatted display price (e.g., "$9.99/month")</td>
            </tr>
            <tr>
              <td>
                <code>price</code>
              </td>
              <td>
                <code>Float!</code>
              </td>
              <td>Numeric price value</td>
            </tr>
            <tr>
              <td>
                <code>currency</code>
              </td>
              <td>
                <code>String</code>
              </td>
              <td>Currency code (ISO 4217)</td>
            </tr>
            <tr>
              <td>
                <code>type</code>
              </td>
              <td>
                <code>DiscountOfferType!</code>
              </td>
              <td><code>Introductory</code>, <code>Promotional</code>, or <code>WinBack</code> (iOS 18+)</td>
            </tr>
            <tr>
              <td>
                <code>period</code>
              </td>
              <td>
                <code>SubscriptionPeriod</code>
              </td>
              <td>Subscription period (unit + value)</td>
            </tr>
            <tr>
              <td>
                <code>periodCount</code>
              </td>
              <td>
                <code>Int</code>
              </td>
              <td>Number of periods the offer applies</td>
            </tr>
            <tr>
              <td>
                <code>paymentMode</code>
              </td>
              <td>
                <code>PaymentMode</code>
              </td>
              <td>FreeTrial, PayAsYouGo, or PayUpFront</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="subscription-offer-ios-fields" level="h3">
          iOS-Specific Fields
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>keyIdentifierIOS</code>
              </td>
              <td>
                <code>String</code>
              </td>
              <td>Key ID for server-side signature validation</td>
            </tr>
            <tr>
              <td>
                <code>nonceIOS</code>
              </td>
              <td>
                <code>String</code>
              </td>
              <td>Cryptographic nonce (UUID) for signature</td>
            </tr>
            <tr>
              <td>
                <code>signatureIOS</code>
              </td>
              <td>
                <code>String</code>
              </td>
              <td>Server-generated signature for validation</td>
            </tr>
            <tr>
              <td>
                <code>timestampIOS</code>
              </td>
              <td>
                <code>Float</code>
              </td>
              <td>Timestamp when signature was generated</td>
            </tr>
            <tr>
              <td>
                <code>numberOfPeriodsIOS</code>
              </td>
              <td>
                <code>Int</code>
              </td>
              <td>Number of billing periods for this discount</td>
            </tr>
            <tr>
              <td>
                <code>localizedPriceIOS</code>
              </td>
              <td>
                <code>String</code>
              </td>
              <td>Localized price string</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="subscription-offer-android-fields" level="h3">
          Android-Specific Fields
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>basePlanIdAndroid</code>
              </td>
              <td>
                <code>String</code>
              </td>
              <td>Base plan identifier</td>
            </tr>
            <tr>
              <td>
                <code>offerTokenAndroid</code>
              </td>
              <td>
                <code>String</code>
              </td>
              <td>
                <strong>Required for purchase.</strong> Pass to
                requestPurchase()
              </td>
            </tr>
            <tr>
              <td>
                <code>offerTagsAndroid</code>
              </td>
              <td>
                <code>[String!]</code>
              </td>
              <td>Tags associated with this offer</td>
            </tr>
            <tr>
              <td>
                <code>pricingPhasesAndroid</code>
              </td>
              <td>
                <code>PricingPhasesAndroid</code>
              </td>
              <td>Pricing phases (trial, intro, regular)</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="subscription-offer-type-definition" level="h3">
          Type Definition
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`interface SubscriptionOffer {
  // Common fields
  id: string;
  displayPrice: string;
  price: number;
  currency?: string;
  type: DiscountOfferType;
  period?: SubscriptionPeriod;
  periodCount?: number;
  paymentMode?: PaymentMode;

  // iOS-specific fields
  keyIdentifierIOS?: string;
  nonceIOS?: string;
  signatureIOS?: string;
  timestampIOS?: number;
  numberOfPeriodsIOS?: number;
  localizedPriceIOS?: string;

  // Android-specific fields
  basePlanIdAndroid?: string;
  offerTokenAndroid?: string;
  offerTagsAndroid?: string[];
  pricingPhasesAndroid?: PricingPhasesAndroid;
}

interface SubscriptionPeriod {
  unit: SubscriptionPeriodUnit;
  value: number;
}

enum SubscriptionPeriodUnit {
  Day = 'Day',
  Week = 'Week',
  Month = 'Month',
  Year = 'Year',
  Unknown = 'Unknown',
}

enum PaymentMode {
  FreeTrial = 'FreeTrial',
  PayAsYouGo = 'PayAsYouGo',
  PayUpFront = 'PayUpFront',
  Unknown = 'Unknown',
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`struct SubscriptionOffer: Codable {
    // Common fields
    let id: String
    let displayPrice: String
    let price: Double
    let currency: String?
    let type: DiscountOfferType
    let period: SubscriptionPeriod?
    let periodCount: Int?
    let paymentMode: PaymentMode?

    // iOS-specific fields
    let keyIdentifierIOS: String?
    let nonceIOS: String?
    let signatureIOS: String?
    let timestampIOS: Double?
    let numberOfPeriodsIOS: Int?
    let localizedPriceIOS: String?

    // Android-specific fields
    let basePlanIdAndroid: String?
    let offerTokenAndroid: String?
    let offerTagsAndroid: [String]?
    let pricingPhasesAndroid: PricingPhasesAndroid?
}

struct SubscriptionPeriod: Codable {
    let unit: SubscriptionPeriodUnit
    let value: Int
}

enum SubscriptionPeriodUnit: String, Codable {
    case day = "Day"
    case week = "Week"
    case month = "Month"
    case year = "Year"
    case unknown = "Unknown"
}

enum PaymentMode: String, Codable {
    case freeTrial = "FreeTrial"
    case payAsYouGo = "PayAsYouGo"
    case payUpFront = "PayUpFront"
    case unknown = "Unknown"
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`data class SubscriptionOffer(
    // Common fields
    val id: String,
    val displayPrice: String,
    val price: Double,
    val currency: String? = null,
    val type: DiscountOfferType,
    val period: SubscriptionPeriod? = null,
    val periodCount: Int? = null,
    val paymentMode: PaymentMode? = null,

    // iOS-specific fields
    val keyIdentifierIOS: String? = null,
    val nonceIOS: String? = null,
    val signatureIOS: String? = null,
    val timestampIOS: Double? = null,
    val numberOfPeriodsIOS: Int? = null,
    val localizedPriceIOS: String? = null,

    // Android-specific fields
    val basePlanIdAndroid: String? = null,
    val offerTokenAndroid: String? = null,
    val offerTagsAndroid: List<String>? = null,
    val pricingPhasesAndroid: PricingPhasesAndroid? = null
)

data class SubscriptionPeriod(
    val unit: SubscriptionPeriodUnit,
    val value: Int
)

enum class SubscriptionPeriodUnit {
    Day, Week, Month, Year, Unknown
}

enum class PaymentMode {
    FreeTrial, PayAsYouGo, PayUpFront, Unknown
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`class SubscriptionOffer {
  // Common fields
  final String id;
  final String displayPrice;
  final double price;
  final String? currency;
  final DiscountOfferType type;
  final SubscriptionPeriod? period;
  final int? periodCount;
  final PaymentMode? paymentMode;

  // iOS-specific fields
  final String? keyIdentifierIOS;
  final String? nonceIOS;
  final String? signatureIOS;
  final double? timestampIOS;
  final int? numberOfPeriodsIOS;
  final String? localizedPriceIOS;

  // Android-specific fields
  final String? basePlanIdAndroid;
  final String? offerTokenAndroid;
  final List<String>? offerTagsAndroid;
  final PricingPhasesAndroid? pricingPhasesAndroid;

  SubscriptionOffer({
    required this.id,
    required this.displayPrice,
    required this.price,
    this.currency,
    required this.type,
    this.period,
    this.periodCount,
    this.paymentMode,
    this.keyIdentifierIOS,
    this.nonceIOS,
    this.signatureIOS,
    this.timestampIOS,
    this.numberOfPeriodsIOS,
    this.localizedPriceIOS,
    this.basePlanIdAndroid,
    this.offerTokenAndroid,
    this.offerTagsAndroid,
    this.pricingPhasesAndroid,
  });
}

class SubscriptionPeriod {
  final SubscriptionPeriodUnit unit;
  final int value;

  SubscriptionPeriod({required this.unit, required this.value});
}

enum SubscriptionPeriodUnit { day, week, month, year, unknown }

enum PaymentMode { freeTrial, payAsYouGo, payUpFront, unknown }`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`class_name SubscriptionOffer

# Common fields
var id: String
var display_price: String
var price: float
var currency: String
var type: DiscountOfferType
var period: SubscriptionPeriod
var period_count: int
var payment_mode: PaymentMode

# iOS-specific fields
var key_identifier_ios: String
var nonce_ios: String
var signature_ios: String
var timestamp_ios: float
var number_of_periods_ios: int
var localized_price_ios: String

# Android-specific fields
var base_plan_id_android: String
var offer_token_android: String
var offer_tags_android: Array[String]
var pricing_phases_android: PricingPhasesAndroid

class SubscriptionPeriod:
    var unit: SubscriptionPeriodUnit
    var value: int

enum SubscriptionPeriodUnit { DAY, WEEK, MONTH, YEAR, UNKNOWN }
enum PaymentMode { FREE_TRIAL, PAY_AS_YOU_GO, PAY_UP_FRONT, UNKNOWN }`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="usage-example" level="h2">
          Usage Example
        </AnchorLink>
        <p>
          Access standardized offers from products and use platform-specific
          fields when needed:
        </p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { fetchProducts, requestPurchase, Product } from 'expo-iap';

const products = await fetchProducts({
  skus: ['premium_feature', 'premium_subscription'],
});

for (const product of products) {
  // Access standardized discount offers (one-time products)
  const discountOffers = product.discountOffers;
  if (discountOffers && discountOffers.length > 0) {
    const offer = discountOffers[0];
    console.log('Discount:', offer.displayPrice);
    console.log('Original:', offer.fullPriceMicrosAndroid);
    console.log('Percentage off:', offer.percentageDiscountAndroid);
  }

  // Access standardized subscription offers
  const subscriptionOffers = product.subscriptionOffers;
  if (subscriptionOffers && subscriptionOffers.length > 0) {
    const offer = subscriptionOffers[0];
    console.log('Subscription offer:', offer.displayPrice);
    console.log('Period:', offer.period?.unit, offer.period?.value);
    console.log('Payment mode:', offer.paymentMode);

    // Platform-specific: Android needs offerToken
    if (offer.offerTokenAndroid) {
      await requestPurchase({
        request: {
          google: {
            skus: [product.id],
            subscriptionOffers: [{
              sku: product.id,
              offerToken: offer.offerTokenAndroid,
            }],
          },
        },
        type: 'subs',
      });
    }

    // Platform-specific: iOS needs server-side signature for promotional offers
    if (offer.signatureIOS) {
      await requestPurchase({
        request: {
          apple: {
            sku: product.id,
            withOffer: {
              identifier: offer.id,
              keyIdentifier: offer.keyIdentifierIOS!,
              nonce: offer.nonceIOS!,
              signature: offer.signatureIOS,
              timestamp: offer.timestampIOS!,
            },
          },
        },
        type: 'subs',
      });
    }
  }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.OpenIapModule
import dev.hyo.openiap.types.*

val products = openIapModule.fetchProducts(
    skus = listOf("premium_feature", "premium_subscription"),
    type = ProductQueryType.All
)

products.forEach { product ->
    // Access standardized discount offers (one-time products)
    product.discountOffers?.forEach { offer ->
        println("Discount: \${offer.displayPrice}")
        println("Original: \${offer.fullPriceMicrosAndroid}")
        println("Percentage off: \${offer.percentageDiscountAndroid}")
    }

    // Access standardized subscription offers
    product.subscriptionOffers?.forEach { offer ->
        println("Subscription offer: \${offer.displayPrice}")
        println("Period: \${offer.period?.unit} \${offer.period?.value}")
        println("Payment mode: \${offer.paymentMode}")

        // Use offerToken for Android purchases
        offer.offerTokenAndroid?.let { token ->
            openIapModule.requestPurchase(
                sku = product.id,
                subscriptionOffers = listOf(
                    SubscriptionOfferAndroid(
                        sku = product.id,
                        offerToken = token
                    )
                )
            )
        }
    }
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

let products = try await OpenIapModule.shared.fetchProducts(
    skus: ["premium_feature", "premium_subscription"]
)

for product in products {
    // Access standardized subscription offers
    if let offers = product.subscriptionOffers {
        for offer in offers {
            print("Subscription offer: \\(offer.displayPrice)")
            if let period = offer.period {
                print("Period: \\(period.unit) \\(period.value)")
            }
            print("Payment mode: \\(offer.paymentMode ?? .unknown)")

            // iOS promotional offers require server-side signature
            if let signature = offer.signatureIOS,
               let keyId = offer.keyIdentifierIOS,
               let nonce = offer.nonceIOS,
               let timestamp = offer.timestampIOS {
                try await OpenIapModule.shared.requestPurchase(
                    sku: product.id,
                    withOffer: DiscountOfferInputIOS(
                        identifier: offer.id,
                        keyIdentifier: keyId,
                        nonce: nonce,
                        signature: signature,
                        timestamp: timestamp
                    )
                )
            }
        }
    }
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`var request = ProductRequest.new()
request.skus = ["premium_feature", "premium_subscription"]
request.type = ProductQueryType.ALL
var products = await iap.fetch_products(request)

for product in products:
    # Access standardized discount offers (one-time products)
    if product.discount_offers:
        for offer in product.discount_offers:
            print("Discount: %s" % offer.display_price)
            print("Original: %s" % offer.full_price_micros_android)
            print("Percentage off: %d" % offer.percentage_discount_android)

    # Access standardized subscription offers
    if product.subscription_offers:
        for offer in product.subscription_offers:
            print("Subscription offer: %s" % offer.display_price)
            if offer.period:
                print("Period: %s %d" % [offer.period.unit, offer.period.value])
            print("Payment mode: %s" % offer.payment_mode)

            # Use offerToken for Android purchases
            if offer.offer_token_android:
                var props = RequestPurchaseProps.new()
                props.request = RequestSubscriptionPropsByPlatforms.new()
                props.request.google = RequestSubscriptionAndroidProps.new()
                props.request.google.skus = [product.id]
                props.request.google.subscription_offers = [{
                    "sku": product.id,
                    "offerToken": offer.offer_token_android
                }]
                props.type = ProductQueryType.SUBS
                await iap.request_purchase(props)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="migration-guide" level="h2">
          Migration Guide
        </AnchorLink>
        <p>
          Migrate from deprecated platform-specific types to the new
          standardized types:
        </p>

        <table className="doc-table">
          <thead>
            <tr>
              <th>Deprecated Type</th>
              <th>New Type</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>DiscountIOS</code>
              </td>
              <td>
                <code>SubscriptionOffer</code>
              </td>
              <td>Use iOS-suffixed fields for platform-specific data</td>
            </tr>
            <tr>
              <td>
                <code>DiscountOfferIOS</code>
              </td>
              <td>
                <code>SubscriptionOffer</code>
              </td>
              <td>
                Signature fields: <code>keyIdentifierIOS</code>,{' '}
                <code>nonceIOS</code>, etc.
              </td>
            </tr>
            <tr>
              <td>
                <code>SubscriptionOfferIOS</code>
              </td>
              <td>
                <code>SubscriptionOffer</code>
              </td>
              <td>
                Period info in common <code>period</code> field
              </td>
            </tr>
            <tr>
              <td>
                <code>ProductAndroidOneTimePurchaseOfferDetail</code>
              </td>
              <td>
                <code>DiscountOffer</code>
              </td>
              <td>Use Android-suffixed fields</td>
            </tr>
            <tr>
              <td>
                <code>ProductSubscriptionAndroidOfferDetails</code>
              </td>
              <td>
                <code>SubscriptionOffer</code>
              </td>
              <td>
                <code>pricingPhasesAndroid</code> for detailed phases
              </td>
            </tr>
            <tr>
              <td>
                <code>subscriptionInfoIOS</code>
              </td>
              <td>
                <code>subscriptionOffers</code>
              </td>
              <td>Field on Product types</td>
            </tr>
            <tr>
              <td>
                <code>oneTimePurchaseOfferDetailsAndroid</code>
              </td>
              <td>
                <code>discountOffers</code>
              </td>
              <td>Field on Product types</td>
            </tr>
            <tr>
              <td>
                <code>subscriptionOfferDetailsAndroid</code>
              </td>
              <td>
                <code>subscriptionOffers</code>
              </td>
              <td>Field on Product types</td>
            </tr>
          </tbody>
        </table>

        <div className="alert-card alert-card--warning">
          <p>
            <strong>Backward Compatibility:</strong> The deprecated types and
            fields are still available but will be removed in a future major
            version. Plan your migration accordingly.
          </p>
        </div>
      </section>
    </div>
  );
}

export default TypesOffer;
