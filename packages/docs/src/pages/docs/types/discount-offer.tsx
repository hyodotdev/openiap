import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function DiscountOffer() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="DiscountOffer"
        description="DiscountOffer type definition and field reference."
        path="/docs/types/discount-offer"
        keywords="DiscountOffer, OpenIAP types, Discount Offer"
      />
      <h1>DiscountOffer</h1>
      <section>
        <AnchorLink id="discount-offer" level="h2">
          DiscountOffer
        </AnchorLink>
        <p>
          Unified discount-offer type covering both subscription discounts (
          <code>Introductory</code>, <code>Promotional</code>) and one-time
          product offers (<code>OneTime</code>, Android only on Google Play
          Billing Library 7.0+). For iOS-specific WinBack offers see{' '}
          <Link to="/docs/types/ios/discount-offer-ios">DiscountOfferIOS</Link>;
          iOS does not support one-time product discounts.
        </p>
        <p>
          Cross-platform discount-offer envelope. <strong>iOS:</strong> maps to
          a signed <code>Product.SubscriptionOffer</code> (
          <a
            href="https://developer.apple.com/documentation/storekit/product/subscriptionoffer"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple docs
          </a>
          ). <strong>Android:</strong> maps to a Play{' '}
          <code>SubscriptionOfferDetails</code> entry (
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
            href="https://developer.android.com/google/play/billing/subscriptions#discount-offer"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google · Discounted offers
          </a>
          {' · '}
          <a
            href="https://developer.android.com/reference/com/android/billingclient/api/ProductDetails.OneTimePurchaseOfferDetails"
            target="_blank"
            rel="noopener noreferrer"
          >
            ProductDetails.OneTimePurchaseOfferDetails
          </a>
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
              <td>
                Type of offer: <code>Introductory</code>,{' '}
                <code>Promotional</code>, or <code>OneTime</code> (Android-only
                Play Billing 7.0+ feature).
              </td>
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
                <Link to="/docs/types/android/one-time-purchase-offer-detail-android#valid-time-window-android">
                  <code>ValidTimeWindowAndroid</code>
                </Link>
              </td>
              <td>Time window for limited-time offers</td>
            </tr>
            <tr>
              <td>
                <code>limitedQuantityInfoAndroid</code>
              </td>
              <td>
                <Link to="/docs/types/android/one-time-purchase-offer-detail-android#limited-quantity-info-android">
                  <code>LimitedQuantityInfoAndroid</code>
                </Link>
              </td>
              <td>Quantity limits for the offer</td>
            </tr>
            <tr>
              <td>
                <code>preorderDetailsAndroid</code>
              </td>
              <td>
                <Link to="/docs/types/android/one-time-purchase-offer-detail-android#preorder-details-android">
                  <code>PreorderDetailsAndroid</code>
                </Link>
              </td>
              <td>Pre-order details (Billing Library 8.1.0+)</td>
            </tr>
            <tr>
              <td>
                <code>rentalDetailsAndroid</code>
              </td>
              <td>
                <Link to="/docs/types/android/one-time-purchase-offer-detail-android#rental-details-android">
                  <code>RentalDetailsAndroid</code>
                </Link>
              </td>
              <td>Rental offer details</td>
            </tr>
            <tr>
              <td>
                <code>purchaseOptionIdAndroid</code>
              </td>
              <td>
                <code>String</code>
              </td>
              <td>
                Purchase option ID for identifying which purchase option was
                selected (7.0+)
              </td>
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
  purchaseOptionIdAndroid?: string;
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
    let purchaseOptionIdAndroid: String?
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
    val rentalDetailsAndroid: RentalDetailsAndroid? = null,
    val purchaseOptionIdAndroid: String? = null
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
  final String? purchaseOptionIdAndroid;

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
    this.purchaseOptionIdAndroid,
  });
}

enum DiscountOfferType {
  introductory,
  promotional,
  winBack,    // iOS 18+
  oneTime,
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;
using System.Collections.Generic;

public sealed record DiscountOffer
{
    // Common fields
    public string? Id { get; init; }
    public required string DisplayPrice { get; init; }
    public required double Price { get; init; }
    public required string Currency { get; init; }
    public required DiscountOfferType Type { get; init; }

    // Android-specific fields
    public string? OfferTokenAndroid { get; init; }
    public IReadOnlyList<string>? OfferTagsAndroid { get; init; }
    public string? FullPriceMicrosAndroid { get; init; }
    public int? PercentageDiscountAndroid { get; init; }
    public string? DiscountAmountMicrosAndroid { get; init; }
    public string? FormattedDiscountAmountAndroid { get; init; }
    public ValidTimeWindowAndroid? ValidTimeWindowAndroid { get; init; }
    public LimitedQuantityInfoAndroid? LimitedQuantityInfoAndroid { get; init; }
    public PreorderDetailsAndroid? PreorderDetailsAndroid { get; init; }
    public RentalDetailsAndroid? RentalDetailsAndroid { get; init; }
    public string? PurchaseOptionIdAndroid { get; init; }
}

public enum DiscountOfferType
{
    Introductory,
    Promotional,
    OneTime
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
var purchase_option_id_android: String

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
    </div>
  );
}

export default DiscountOffer;
