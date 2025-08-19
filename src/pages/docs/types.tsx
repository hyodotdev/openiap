import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function Types() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <h1>Types</h1>

      <section>
        <AnchorLink id="product" level="h2">
          Product
        </AnchorLink>
        <p className="type-definition">
          Product = ProductBase & (ProductIOS | ProductAndroid)
        </p>

        <h3>ProductBase</h3>
        <CodeBlock language="graphql">{`type ProductBase {
  "Product SKU/ID"
  id: String!
  
  "Product title"
  title: String!
  
  "Product description"  
  description: String!
  
  "Product type (inapp or subs)"
  type: ProductType!
  
  "Display name (optional)"
  displayName: String
  
  "Formatted display price"
  displayPrice: String!
  
  "Currency code (USD, EUR, etc)"
  currency: String!
  
  "Raw price value (optional)"
  price: Float
}

enum ProductType {
  inapp
  subs
}`}</CodeBlock>

        <h3>ProductIOS</h3>
        <CodeBlock language="graphql">{`type ProductIOS {
  "Display name on App Store"
  displayName: String!
  
  "Whether product can be shared with family"
  isFamilyShareable: Boolean!
  
  "JSON representation from StoreKit"
  jsonRepresentation: String!
  
  "Subscription information"
  subscription: SubscriptionInfo
  
  "Intro price number of periods"
  introductoryPriceNumberOfPeriodsIOS: String
  
  "Intro price subscription period"
  introductoryPriceSubscriptionPeriodIOS: SubscriptionIosPeriod
}

type SubscriptionInfo {
  "Introductory offer"
  introductoryOffer: SubscriptionOffer
  
  "Promotional offers"
  promotionalOffers: [SubscriptionOffer!]
  
  "Subscription group ID"
  subscriptionGroupId: String!
  
  "Subscription period"
  subscriptionPeriod: SubscriptionPeriod!
}

type SubscriptionPeriod {
  "Period unit"
  unit: SubscriptionIosPeriod!
  
  "Period value"
  value: Int!
}`}</CodeBlock>

        <h3>ProductAndroid</h3>
        <CodeBlock language="graphql">{`type ProductAndroid {
  "Product name"
  name: String!
  
  "One-time purchase offer details"
  oneTimePurchaseOfferDetails: OneTimePurchaseOfferDetails
  
  "Subscription offer details"
  subscriptionOfferDetails: [SubscriptionOfferDetail!]
}

type OneTimePurchaseOfferDetails {
  "Price currency code"
  priceCurrencyCode: String!
  
  "Formatted price"
  formattedPrice: String!
  
  "Price amount in micros"
  priceAmountMicros: String!
}

type SubscriptionOfferDetail {
  "Base plan ID"
  basePlanId: String!
  
  "Offer ID"
  offerId: String!
  
  "Offer token"
  offerToken: String!
  
  "Offer tags"
  offerTags: [String!]!
  
  "Pricing phases"
  pricingPhases: PricingPhasesAndroid!
}

type PricingPhasesAndroid {
  "Pricing phase list"
  pricingPhaseList: [PricingPhaseAndroid!]!
}

type PricingPhaseAndroid {
  "Formatted price"
  formattedPrice: String!
  
  "Price currency code"
  priceCurrencyCode: String!
  
  "Billing period (P1W, P1M, P1Y)"
  billingPeriod: String!
  
  "Billing cycle count"
  billingCycleCount: Int!
  
  "Price amount in micros"
  priceAmountMicros: String!
  
  "Recurrence mode"
  recurrenceMode: Int!
}`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="purchase" level="h2">
          Purchase
        </AnchorLink>
        <p className="type-definition">
          Purchase = PurchaseBase & (PurchaseIOS | PurchaseAndroid)
        </p>

        <h3>PurchaseBase</h3>
        <CodeBlock language="graphql">{`type PurchaseBase {
  "Purchase ID (AKA transactionId)"
  id: String!
  
  "Product ID"
  productId: String!
  
  "Purchase timestamp"
  transactionDate: Float!
  
  "Receipt/Token for validation (deprecated - use transactionReceipt for legacy)"
  transactionReceipt: String!
  
  "Unified purchase token for validation (jwsRepresentationIOS for iOS, purchaseTokenAndroid for Android)"
  purchaseToken: String!
}`}</CodeBlock>

        <h3>PurchaseIOS</h3>
        <CodeBlock language="graphql">{`type PurchaseIOS {
  "iOS basic fields"
  quantityIOS: Int
  originalTransactionDateIOS: Float
  originalTransactionIdentifierIOS: String
  appAccountToken: String
  
  "iOS additional fields from StoreKit 2"
  expirationDateIOS: Float
  webOrderLineItemIdIOS: Int
  environmentIOS: String
  storefrontCountryCodeIOS: String
  appBundleIdIOS: String
  productTypeIOS: String
  subscriptionGroupIdIOS: String
  isUpgradedIOS: Boolean
  ownershipTypeIOS: String
  reasonIOS: String
  reasonStringRepresentationIOS: String
  transactionReasonIOS: String
  revocationDateIOS: Float
  revocationReasonIOS: String
  offerIOS: OfferIOS
  priceIOS: Float
  currencyIOS: String
  
  "JWS representation for StoreKit 2 receipt validation (deprecated - use purchaseToken instead)"
  jwsRepresentationIOS: String
}

type OfferIOS {
  id: String!
  type: String!
  paymentMode: String!
}`}</CodeBlock>

        <h3>PurchaseAndroid</h3>
        <CodeBlock language="graphql">{`type PurchaseAndroid {
  "Product IDs array"
  ids: [String!]
  
  "Purchase token for validation (deprecated - use purchaseToken instead)"
  purchaseTokenAndroid: String
  
  "Purchase data JSON"
  dataAndroid: String
  
  "Purchase signature"
  signatureAndroid: String
  
  "Auto-renewing subscription"
  autoRenewingAndroid: Boolean
  
  "Purchase state"
  purchaseStateAndroid: PurchaseStateAndroid
  
  "Acknowledgement status"
  isAcknowledgedAndroid: Boolean
  
  "Package name"
  packageNameAndroid: String
  
  "Developer payload"
  developerPayloadAndroid: String
  
  "Obfuscated account ID"
  obfuscatedAccountIdAndroid: String
  
  "Obfuscated profile ID"
  obfuscatedProfileIdAndroid: String
}`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="product-purchase" level="h2">
          ProductPurchase
        </AnchorLink>
        <p className="type-definition">
          ProductPurchase = Purchase & PurchaseDetails
        </p>

        <h3>PurchaseDetails</h3>
        <CodeBlock language="graphql">{`type PurchaseDetails {
  "Whether the purchase has been consumed (Android)"
  isConsumedAndroid: Boolean
  
  "Whether the purchase has been acknowledged (Android)"
  isAcknowledgedAndroid: Boolean
  
  "Whether the transaction is finished (iOS)"
  isFinishedIOS: Boolean
  
  "Purchase state details"
  purchaseState: PurchaseState
}`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="active-subscription" level="h2">
          ActiveSubscription
        </AnchorLink>
        <p className="type-definition">
          Represents an active subscription with platform-specific details.
        </p>

        <CodeBlock language="graphql">{`type ActiveSubscription {
  "Product identifier"
  productId: String!
  
  "Always true for active subscriptions"
  isActive: Boolean!
  
  "Subscription expiration date (iOS only)"
  expirationDateIOS: Date?
  
  "Auto-renewal status (Android only)"
  autoRenewingAndroid: Boolean?
  
  "Environment: 'Sandbox' | 'Production' (iOS only)"
  environmentIOS: String?
  
  "True if subscription expires within 7 days"
  willExpireSoon: Boolean?
  
  "Days remaining until expiration (iOS only)"
  daysUntilExpirationIOS: Number?
}`}</CodeBlock>

        <h3>Platform-Specific Behavior</h3>
        <ul>
          <li>
            <strong>iOS</strong>: Provides exact <code>expirationDate</code>,{' '}
            <code>daysUntilExpiration</code>, and <code>environment</code>
          </li>
          <li>
            <strong>Android</strong>: Provides <code>autoRenewing</code> status.
            When <code>false</code>, the subscription will not renew
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="subscription-product" level="h2">
          SubscriptionProduct
        </AnchorLink>
        <p className="type-definition">
          SubscriptionProduct = Product & SubscriptionExtensions
        </p>

        <h3>SubscriptionExtensions</h3>
        <CodeBlock language="graphql">{`type SubscriptionExtensions {
  "Subscription period (P1M, P3M, P1Y, etc)"
  subscriptionPeriod: String!
  
  "Introductory offer price"
  introductoryPrice: String
  
  "Intro price payment mode"
  introductoryPricePaymentMode: String
  
  "Number of intro price periods"
  introductoryPriceNumberOfPeriods: Int
  
  "Intro price subscription period"
  introductoryPriceSubscriptionPeriod: String
}`}</CodeBlock>

        <h3>SubscriptionInfo (iOS)</h3>
        <CodeBlock language="graphql">{`type SubscriptionInfo {
  "Subscription group identifier"
  subscriptionGroupId: String!
  
  "Subscription period"
  subscriptionPeriod: SubscriptionIosPeriod!
  
  "Introductory price info"
  introductoryPrice: IntroductoryPrice
  
  "Promotional offers"
  promotionalOffers: [PromotionalOffer]
}`}</CodeBlock>

        <h3>OfferDetail (Android)</h3>
        <CodeBlock language="graphql">{`type OfferDetail {
  "Offer ID"
  offerId: String!
  
  "Base plan ID"
  basePlanId: String!
  
  "Offer token"
  offerToken: String!
  
  "Pricing phases"
  pricingPhases: [PricingPhase]
  
  "Offer tags"
  offerTags: [String]
}`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="request-types" level="h2">
          Request Types
        </AnchorLink>

        <AnchorLink id="request-purchase-props" level="h3">
          RequestPurchaseProps
        </AnchorLink>
        <p>
          Modern request purchase parameters. This is the recommended API moving
          forward.
        </p>
        <CodeBlock language="graphql">{`type RequestPurchaseProps = RequestPurchasePropsByPlatforms`}</CodeBlock>

        <AnchorLink id="request-purchase-props-by-platforms" level="h3">
          RequestPurchasePropsByPlatforms
        </AnchorLink>
        <p>
          Platform-specific request structure for regular purchases. Allows
          clear separation of iOS and Android parameters.
        </p>
        <CodeBlock language="graphql">{`input RequestPurchasePropsByPlatforms {
  "iOS-specific purchase parameters"
  ios: RequestPurchaseIosProps
  
  "Android-specific purchase parameters"
  android: RequestPurchaseAndroidProps
}`}</CodeBlock>

        <AnchorLink id="request-subscription-props-by-platforms" level="h3">
          RequestSubscriptionPropsByPlatforms
        </AnchorLink>
        <p>Platform-specific subscription request structure.</p>
        <CodeBlock language="graphql">{`input RequestSubscriptionPropsByPlatforms {
  "iOS-specific subscription parameters"
  ios: RequestPurchaseIosProps
  
  "Android-specific subscription parameters"
  android: RequestSubscriptionAndroidProps
}`}</CodeBlock>

        <AnchorLink id="request-purchase-ios-props" level="h3">
          RequestPurchaseIosProps
        </AnchorLink>
        <p>iOS-specific purchase request parameters.</p>
        <CodeBlock language="graphql">{`input RequestPurchaseIosProps {
  "Product SKU"
  sku: String!
  
  "Auto-finish transaction (dangerous)"
  andDangerouslyFinishTransactionAutomaticallyIOS: Boolean
  
  "App account token for user tracking"
  appAccountToken: String
  
  "Purchase quantity"
  quantity: Int
  
  "Payment discount offer"
  withOffer: PaymentDiscount
}`}</CodeBlock>

        <AnchorLink id="request-purchase-android-props" level="h3">
          RequestPurchaseAndroidProps
        </AnchorLink>
        <p>Android-specific purchase request parameters.</p>
        <CodeBlock language="graphql">{`input RequestPurchaseAndroidProps {
  "List of product SKUs"
  skus: [String!]!
  
  "Obfuscated account ID"
  obfuscatedAccountIdAndroid: String
  
  "Obfuscated profile ID"
  obfuscatedProfileIdAndroid: String
  
  "Personalized offer flag"
  isOfferPersonalized: Boolean
}`}</CodeBlock>

        <AnchorLink id="request-subscription-android-props" level="h3">
          RequestSubscriptionAndroidProps
        </AnchorLink>
        <p>
          Android-specific subscription request parameters. Extends
          RequestPurchaseAndroidProps.
        </p>
        <CodeBlock language="graphql">{`input RequestSubscriptionAndroidProps {
  "List of subscription SKUs"
  skus: [String!]!
  
  "Obfuscated account ID"
  obfuscatedAccountIdAndroid: String
  
  "Obfuscated profile ID"
  obfuscatedProfileIdAndroid: String
  
  "Personalized offer flag"
  isOfferPersonalized: Boolean
  
  "Purchase token for upgrades/downgrades"
  purchaseTokenAndroid: String
  
  "Replacement mode for subscription changes"
  replacementModeAndroid: Int
  
  "Subscription offers"
  subscriptionOffers: [SubscriptionOffer!]
}

type SubscriptionOffer {
  "Product SKU"
  sku: String!
  
  "Offer token"
  offerToken: String!
}`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="platform-specific-types" level="h2">
          Platform-Specific Types
        </AnchorLink>

        <AnchorLink id="ios-types" level="h3">
          iOS Specific Types
        </AnchorLink>

        <h4>PaymentDiscount</h4>
        <CodeBlock language="graphql">{`type PaymentDiscount {
  "Discount identifier"
  identifier: String!
  
  "Key identifier for validation"
  keyIdentifier: String!
  
  "Cryptographic nonce"
  nonce: String!
  
  "Signature for validation"
  signature: String!
  
  "Timestamp of discount offer"
  timestamp: Float!
}`}</CodeBlock>

        <h4>Discount</h4>
        <CodeBlock language="graphql">{`type Discount {
  "Discount identifier"
  identifier: String!
  
  "Discount type (introductory, subscription)"
  type: String!
  
  "Number of billing periods"
  numberOfPeriods: Int!
  
  "Formatted discount price"
  price: String!
  
  "Raw discount price value"
  priceAmount: Float!
  
  "Payment mode (payAsYouGo, payUpFront, freeTrial)"
  paymentMode: String!
  
  "Subscription period for discount"
  subscriptionPeriod: String!
}`}</CodeBlock>

        <h4>SubscriptionIosPeriod</h4>
        <CodeBlock language="graphql">{`enum SubscriptionIosPeriod {
  DAY    # Daily period
  WEEK   # Weekly period
  MONTH  # Monthly period
  YEAR   # Yearly period
  ""     # Empty string (unspecified)
}`}</CodeBlock>

        <h4>TransactionState</h4>
        <CodeBlock language="graphql">{`enum TransactionState {
  PURCHASING
  PURCHASED
  FAILED
  RESTORED
  DEFERRED
}`}</CodeBlock>

        <AnchorLink id="android-types" level="h3">
          Android Specific Types
        </AnchorLink>

        <h4>SubscriptionOffer</h4>
        <CodeBlock language="graphql">{`type SubscriptionOffer {
  "Product SKU"
  sku: String!
  
  "Offer token for purchase"
  offerToken: String!
}`}</CodeBlock>

        <h4>PricingPhase</h4>
        <CodeBlock language="graphql">{`type PricingPhase {
  "Billing period (P1W, P1M, P3M, P6M, P1Y)"
  billingPeriod: String!
  
  "Formatted price"
  formattedPrice: String!
  
  "Price amount in micros"
  priceAmountMicros: String!
  
  "Currency code"
  priceCurrencyCode: String!
  
  "Number of cycles"
  billingCycleCount: Int
  
  "Recurrence mode"
  recurrenceMode: RecurrenceMode
}`}</CodeBlock>

        <h4>RecurrenceMode</h4>
        <CodeBlock language="graphql">{`enum RecurrenceMode {
  INFINITE_RECURRING    # Charges recur forever
  FINITE_RECURRING      # Charges recur for a fixed number of cycles
  NON_RECURRING        # Charges occur once
}`}</CodeBlock>

        <h4>ReplacementMode</h4>
        <CodeBlock language="graphql">{`enum ReplacementMode {
  UNKNOWN_REPLACEMENT_MODE
  IMMEDIATE_WITH_TIME_PRORATION
  IMMEDIATE_AND_CHARGE_PRORATED_PRICE
  IMMEDIATE_WITHOUT_PRORATION
  DEFERRED
  IMMEDIATE_AND_CHARGE_FULL_PRICE
}`}</CodeBlock>

        <h4>PurchaseState</h4>
        <CodeBlock language="graphql">{`enum PurchaseState {
  UNSPECIFIED  # 0 - Unspecified state
  PURCHASED    # 1 - Purchase completed
  PENDING      # 2 - Purchase pending
}`}</CodeBlock>

        <h4>PurchaseStateAndroid</h4>
        <CodeBlock language="graphql">{`enum PurchaseStateAndroid {
  UNSPECIFIED_STATE  # 0 - Unspecified state
  PURCHASED          # 1 - Purchase completed
  PENDING            # 2 - Purchase pending
}`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="validation-types" level="h2">
          Validation Types
        </AnchorLink>

        <AnchorLink id="validation-options" level="h3">
          ValidationOptions
        </AnchorLink>
        <CodeBlock language="graphql">{`input ValidationOptions {
  "iOS validation: receipt body (for legacy StoreKit 1)"
  receiptBody: IOSReceiptBody
  
  "Android validation: package name"
  packageName: String
  
  "Unified purchase token (jwsRepresentationIOS for iOS StoreKit 2, purchaseTokenAndroid for Android)"
  purchaseToken: String
  
  "Product purchase token (deprecated - use purchaseToken instead)"
  productToken: String
  
  "Server access token"
  accessToken: String
  
  "Is subscription product"
  isSub: Boolean
}

input IOSReceiptBody {
  "Base64 encoded receipt data"
  receiptData: String!
  
  "Shared secret for subscriptions"
  password: String
}`}</CodeBlock>

        <AnchorLink id="validation-result" level="h3">
          ValidationResult
        </AnchorLink>
        <CodeBlock language="graphql">{`type ValidationResult {
  "Validation success status"
  isValid: Boolean!
  
  "HTTP status code"
  status: Int!
  
  "iOS response fields: receipt object"
  receipt: JSON
  
  "Latest receipt string"
  latestReceipt: String
  
  "Latest receipt info array"
  latestReceiptInfo: [JSON]
  
  "Pending renewal info"
  pendingRenewalInfo: [JSON]
  
  "Android response fields: Purchase state (0=purchased, 1=canceled)"
  purchaseState: Int
  
  "Consumption state"
  consumptionState: Int
  
  "Acknowledgement state"
  acknowledgementState: Int
}`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="event-types" level="h2">
          Event Types
        </AnchorLink>

        <AnchorLink id="iap-event" level="h3">
          IapEvent
        </AnchorLink>
        <CodeBlock language="graphql">{`enum IapEvent {
  "Purchase successful or updated"
  PURCHASE_UPDATED
  
  "Purchase failed or cancelled"
  PURCHASE_ERROR
  
  "Promoted product clicked (iOS)"
  PROMOTED_PRODUCT_IOS
}`}</CodeBlock>

        <AnchorLink id="purchase-error" level="h3">
          PurchaseError
        </AnchorLink>
        <CodeBlock language="graphql">{`type PurchaseError {
  "Error code constant"
  code: String!
  
  "Human-readable error message"
  message: String!
  
  "Related product SKU"
  productId: String
}`}</CodeBlock>
      </section>
    </div>
  );
}

export default Types;
