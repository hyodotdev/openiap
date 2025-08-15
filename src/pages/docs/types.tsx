import AnchorLink from '../../components/AnchorLink'
import CodeBlock from '../../components/CodeBlock'
import { useScrollToHash } from '../../hooks/useScrollToHash'

function Types() {
  useScrollToHash()
  
  return (
    <div className="doc-page">
      <h1>Types</h1>
      
      <section>
        <AnchorLink id="product" level="h2">Product</AnchorLink>
        <p className="type-definition">Product = ProductBase & (ProductIOS | ProductAndroid)</p>
        
        <h3>ProductBase</h3>
        <CodeBlock language="graphql">{`type ProductBase {
  "Product SKU/ID"
  id: String!
  
  "Display name"
  title: String!
  
  "Product description"  
  description: String!
  
  "Formatted price string"
  price: String!
  
  "Raw price value"
  priceAmount: Float!
  
  "Currency code (USD, EUR, etc)"
  currency: String!
}`}</CodeBlock>

        <h3>ProductIOS</h3>
        <CodeBlock language="graphql">{`type ProductIOS {
  "Display name on App Store"
  displayName: String!
  
  "Whether product can be shared with family"
  isFamilyShareable: Boolean!
  
  "JSON representation from StoreKit"
  jsonRepresentation: String!
  
  "Available discounts"
  discounts: [Discount]
  
  "Subscription information"
  subscription: SubscriptionInfo
  
  "Intro price number of periods"
  introductoryPriceNumberOfPeriodsIOS: String
  
  "Intro price subscription period"
  introductoryPriceSubscriptionPeriodIOS: SubscriptionIosPeriod
}`}</CodeBlock>

        <h3>ProductAndroid</h3>
        <CodeBlock language="graphql">{`type ProductAndroid {
  "Original price before discount"
  originalPrice: String
  
  "Original price amount before discount"
  originalPriceAmount: Float
  
  "Free trial period"
  freeTrialPeriod: String
  
  "Icon URL"
  iconUrl: String
  
  "Subscription offer details"
  subscriptionOfferDetails: [OfferDetail]
}`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="purchase" level="h2">Purchase</AnchorLink>
        <p className="type-definition">Purchase = PurchaseBase & (PurchaseIOS | PurchaseAndroid)</p>
        
        <h3>PurchaseBase</h3>
        <CodeBlock language="graphql">{`type PurchaseBase {
  "Product SKU"
  productId: String!
  
  "Purchase timestamp"
  transactionDate: Float!
  
  "Receipt/Token for validation"
  transactionReceipt: String!
}`}</CodeBlock>

        <h3>PurchaseIOS</h3>
        <CodeBlock language="graphql">{`type PurchaseIOS {
  "Transaction ID from StoreKit"
  transactionId: String!
  
  "Original transaction date"
  originalTransactionDateIOS: Float
  
  "Original transaction ID"
  originalTransactionIdIOS: String
  
  "Transaction state"
  transactionState: TransactionState
  
  "Verification result"
  verificationResult: VerificationResult
}`}</CodeBlock>

        <h3>PurchaseAndroid</h3>
        <CodeBlock language="graphql">{`type PurchaseAndroid {
  "Purchase token for validation"
  purchaseTokenAndroid: String!
  
  "Purchase state (0=purchased, 1=canceled)"
  purchaseStateAndroid: Int!
  
  "Purchase signature"
  signatureAndroid: String!
  
  "Auto-renewing subscription"
  autoRenewingAndroid: Boolean
  
  "Order ID"
  orderIdAndroid: String
  
  "Package name"
  packageNameAndroid: String
  
  "Developer payload"
  developerPayloadAndroid: String
  
  "Acknowledged"
  acknowledgedAndroid: Boolean
}`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="product-purchase" level="h2">ProductPurchase</AnchorLink>
        <p className="type-definition">ProductPurchase = Purchase & PurchaseDetails</p>
        
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
        <AnchorLink id="subscription-product" level="h2">SubscriptionProduct</AnchorLink>
        <p className="type-definition">SubscriptionProduct = Product & SubscriptionExtensions</p>
        
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
  subscriptionGroupIdentifier: String!
  
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
        <AnchorLink id="request-types" level="h2">Request Types</AnchorLink>
        
        <AnchorLink id="request-purchase-props" level="h3">RequestPurchaseProps</AnchorLink>
        <p>Modern request purchase parameters. This is the recommended API moving forward.</p>
        <CodeBlock language="graphql">{`type RequestPurchaseProps = RequestPurchasePropsByPlatforms`}</CodeBlock>
        
        <AnchorLink id="request-purchase-props-by-platforms" level="h3">RequestPurchasePropsByPlatforms</AnchorLink>
        <p>Platform-specific request structure for regular purchases. Allows clear separation of iOS and Android parameters.</p>
        <CodeBlock language="graphql">{`input RequestPurchasePropsByPlatforms {
  "iOS-specific purchase parameters"
  ios: RequestPurchaseIosProps
  
  "Android-specific purchase parameters"
  android: RequestPurchaseAndroidProps
}`}</CodeBlock>

        <AnchorLink id="request-subscription-props-by-platforms" level="h3">RequestSubscriptionPropsByPlatforms</AnchorLink>
        <p>Platform-specific subscription request structure.</p>
        <CodeBlock language="graphql">{`input RequestSubscriptionPropsByPlatforms {
  "iOS-specific subscription parameters"
  ios: RequestPurchaseIosProps
  
  "Android-specific subscription parameters"
  android: RequestSubscriptionAndroidProps
}`}</CodeBlock>

        <AnchorLink id="request-purchase-ios-props" level="h3">RequestPurchaseIosProps</AnchorLink>
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

        <AnchorLink id="request-purchase-android-props" level="h3">RequestPurchaseAndroidProps</AnchorLink>
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

        <AnchorLink id="request-subscription-android-props" level="h3">RequestSubscriptionAndroidProps</AnchorLink>
        <p>Android-specific subscription request parameters. Extends RequestPurchaseAndroidProps.</p>
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
        <AnchorLink id="platform-specific-types" level="h2">Platform-Specific Types</AnchorLink>
        
        <AnchorLink id="ios-types" level="h3">iOS Specific Types</AnchorLink>
        
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
  P1W   # 1 week
  P1M   # 1 month
  P2M   # 2 months
  P3M   # 3 months
  P6M   # 6 months
  P1Y   # 1 year
}`}</CodeBlock>

        <h4>TransactionState</h4>
        <CodeBlock language="graphql">{`enum TransactionState {
  PURCHASING
  PURCHASED
  FAILED
  RESTORED
  DEFERRED
}`}</CodeBlock>

        <AnchorLink id="android-types" level="h3">Android Specific Types</AnchorLink>
        
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
      </section>

      <section>
        <AnchorLink id="validation-types" level="h2">Validation Types</AnchorLink>
        
        <AnchorLink id="validation-options" level="h3">ValidationOptions</AnchorLink>
        <CodeBlock language="graphql">{`input ValidationOptions {
  "iOS validation: receipt body"
  receiptBody: IOSReceiptBody
  
  "Android validation: package name"
  packageName: String
  
  "Product purchase token"
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

        <AnchorLink id="validation-result" level="h3">ValidationResult</AnchorLink>
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
        <AnchorLink id="event-types" level="h2">Event Types</AnchorLink>
        
        <AnchorLink id="iap-event" level="h3">IapEvent</AnchorLink>
        <CodeBlock language="graphql">{`enum IapEvent {
  "Purchase successful or updated"
  PURCHASE_UPDATED
  
  "Purchase failed or cancelled"
  PURCHASE_ERROR
  
  "Promoted product clicked (iOS)"
  PROMOTED_PRODUCT_IOS
}`}</CodeBlock>

        <AnchorLink id="purchase-error" level="h3">PurchaseError</AnchorLink>
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
  )
}

export default Types