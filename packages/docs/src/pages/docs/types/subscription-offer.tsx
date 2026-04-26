import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function SubscriptionOffer() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="SubscriptionOffer"
        description="SubscriptionOffer type definition and field reference."
        path="/docs/types/subscription-offer"
        keywords="SubscriptionOffer, OpenIAP types, Subscription Offer"
      />
      <h1>SubscriptionOffer</h1>
      <section>
        <AnchorLink id="subscription-offer" level="h2">
          SubscriptionOffer
        </AnchorLink>
        <p>
          Standardized type for subscription promotional offers. Supported on
          both iOS (introductory and promotional offers) and Android (offer
          tokens with pricing phases).
        </p>
        <p>
          Cross-platform subscription-offer envelope. <strong>iOS:</strong>{' '}
          maps to <code>Product.SubscriptionOffer</code> (
          <a
            href="https://developer.apple.com/documentation/storekit/product/subscriptionoffer"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple docs
          </a>
          ). <strong>Android:</strong> maps to{' '}
          <code>SubscriptionOfferDetails</code> (
          <a
            href="https://developer.android.com/reference/com/android/billingclient/api/ProductDetails.SubscriptionOfferDetails"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google docs
          </a>
          ).
        </p>
        <p className="type-link">
          <strong>Native references:</strong>{' '}
          <a
            href="https://developer.apple.com/documentation/storekit/product/subscriptionoffer"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple · Product.SubscriptionOffer
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
                <Link to="/docs/types/discount-offer">
                  <code>DiscountOfferType!</code>
                </Link>
              </td>
              <td>
                <code>Introductory</code>, <code>Promotional</code>, or{' '}
                <code>WinBack</code> (iOS 18+)
              </td>
            </tr>
            <tr>
              <td>
                <code>period</code>
              </td>
              <td>
                <Link to="/docs/types/ios/subscription-period-ios">
                  <code>SubscriptionPeriod</code>
                </Link>
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
                <Link to="/docs/types/ios/payment-mode-ios">
                  <code>PaymentMode</code>
                </Link>
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
                <Link to="/docs/types/android/pricing-phase-android">
                  <code>PricingPhasesAndroid</code>
                </Link>
              </td>
              <td>Pricing phases (trial, intro, regular)</td>
            </tr>
            <tr>
              <td>
                <code>installmentPlanDetailsAndroid</code>
              </td>
              <td>
                <Link to="/docs/types/android/subscription-offer-android">
                  <code>InstallmentPlanDetailsAndroid</code>
                </Link>
              </td>
              <td>
                Installment plan details for subscription commitments (7.0+)
              </td>
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
  installmentPlanDetailsAndroid?: InstallmentPlanDetailsAndroid;
}

interface InstallmentPlanDetailsAndroid {
  commitmentPaymentsCount: number;
  subsequentCommitmentPaymentsCount: number;
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
    let installmentPlanDetailsAndroid: InstallmentPlanDetailsAndroid?
}

struct InstallmentPlanDetailsAndroid: Codable {
    let commitmentPaymentsCount: Int
    let subsequentCommitmentPaymentsCount: Int
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
    val pricingPhasesAndroid: PricingPhasesAndroid? = null,
    val installmentPlanDetailsAndroid: InstallmentPlanDetailsAndroid? = null
)

data class InstallmentPlanDetailsAndroid(
    val commitmentPaymentsCount: Int,
    val subsequentCommitmentPaymentsCount: Int
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
  final InstallmentPlanDetailsAndroid? installmentPlanDetailsAndroid;

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
    this.installmentPlanDetailsAndroid,
  });
}

class InstallmentPlanDetailsAndroid {
  final int commitmentPaymentsCount;
  final int subsequentCommitmentPaymentsCount;

  InstallmentPlanDetailsAndroid({
    required this.commitmentPaymentsCount,
    required this.subsequentCommitmentPaymentsCount,
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
var installment_plan_details_android: InstallmentPlanDetailsAndroid

class InstallmentPlanDetailsAndroid:
    var commitment_payments_count: int
    var subsequent_commitment_payments_count: int

class SubscriptionPeriod:
    var unit: SubscriptionPeriodUnit
    var value: int

enum SubscriptionPeriodUnit { DAY, WEEK, MONTH, YEAR, UNKNOWN }
enum PaymentMode { FREE_TRIAL, PAY_AS_YOU_GO, PAY_UP_FRONT, UNKNOWN }`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>
    </div>
  );
}

export default SubscriptionOffer;
