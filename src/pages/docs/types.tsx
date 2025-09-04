import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function Types() {
  useScrollToHash();

  const handleDownloadTypes = () => {
    const link = document.createElement('a');
    link.href = '/types';
    link.download = 'types.ts';
    link.click();
  };

  return (
    <div className="doc-page">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <h1 style={{ margin: 0 }}>Types</h1>
        <button
          onClick={handleDownloadTypes}
          style={{
            backgroundColor: '#007acc',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = '#005a9e')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = '#007acc')
          }
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 12l-4-4h2.5V3h3v5H12l-4 4z" />
            <path d="M2 14h12v1H2v-1z" />
          </svg>
          Download types.ts
        </button>
      </div>

      <section>
        <AnchorLink id="product" level="h2">
          Product
        </AnchorLink>
        <p className="type-definition">
          Product = (ProductAndroid & AndroidPlatform) | (ProductIOS &
          IosPlatform)
        </p>

        <h3>ProductCommon</h3>
        <CodeBlock language="typescript">{`type ProductCommon = {
  id: string;
  title: string;
  description: string;
  type: ProductType;
  displayName?: string;
  displayPrice: string;
  currency: string;
  price?: number;
  debugDescription?: string;
  platform?: string;  // Added for platform identification
};

type ProductType = 'inapp' | 'subs';`}</CodeBlock>

        <h3>ProductIOS</h3>
        <CodeBlock language="typescript">{`type ProductIOS = ProductCommon & {
  displayNameIOS: string;
  isFamilyShareableIOS: boolean;
  jsonRepresentationIOS: string;
  platform: "ios";  // Literal type
  subscriptionInfoIOS?: SubscriptionInfo;
};

type SubscriptionInfo = {
  introductoryOffer?: SubscriptionOffer;
  promotionalOffers?: SubscriptionOffer[];
  subscriptionGroupId: string;
  subscriptionPeriod: {
    unit: SubscriptionIosPeriod;
    value: number;
  };
};

type SubscriptionOffer = {
  displayPrice: string;
  id: string;
  paymentMode: PaymentMode;
  period: {
    unit: SubscriptionIosPeriod;
    value: number;
  };
  periodCount: number;
  price: number;
  type: 'introductory' | 'promotional';
};

type PaymentMode = '' | 'FREETRIAL' | 'PAYASYOUGO' | 'PAYUPFRONT';
type SubscriptionIosPeriod = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | '';`}</CodeBlock>

        <h3>ProductAndroid</h3>
        <CodeBlock language="typescript">{`type ProductAndroid = ProductCommon & {
  nameAndroid: string;
  oneTimePurchaseOfferDetailsAndroid?: ProductAndroidOneTimePurchaseOfferDetail;
  platform: "android";  // Literal type
  subscriptionOfferDetailsAndroid?: ProductSubscriptionAndroidOfferDetail[];
};

type ProductAndroidOneTimePurchaseOfferDetail = {
  priceCurrencyCode: string;
  formattedPrice: string;
  priceAmountMicros: string;
};

type ProductSubscriptionAndroidOfferDetail = {
  basePlanId: string;
  offerId: string;
  offerToken: string;
  offerTags: string[];
  pricingPhases: PricingPhasesAndroid;
};

type PricingPhasesAndroid = {
  pricingPhaseList: PricingPhaseAndroid[];
};

type PricingPhaseAndroid = {
  formattedPrice: string;
  priceCurrencyCode: string;
  billingPeriod: string; // P1W, P1M, P1Y
  billingCycleCount: number;
  priceAmountMicros: string;
  recurrenceMode: number;
};`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="product-subscription" level="h2">
          ProductSubscription
        </AnchorLink>
        <p className="type-definition">
          ProductSubscription = (ProductSubscriptionAndroid & AndroidPlatform) |
          (ProductSubscriptionIOS & IosPlatform)
        </p>

        <h3>ProductSubscriptionCommon</h3>
        <CodeBlock language="typescript">{`type ProductSubscriptionCommon = ProductCommon & {
  type: 'subs';
};`}</CodeBlock>

        <h3>ProductSubscriptionIOS</h3>
        <CodeBlock language="typescript">{`type Discount = {
  identifier: string;
  type: string;
  numberOfPeriods: string;
  price: string;
  localizedPrice: string;
  paymentMode: PaymentMode;
  subscriptionPeriod: string;
};

type ProductSubscriptionIOS = ProductIOS & {
  discountsIOS?: Discount[];
  introductoryPriceIOS?: string;
  introductoryPriceAsAmountIOS?: string;
  introductoryPricePaymentModeIOS?: PaymentMode;
  introductoryPriceNumberOfPeriodsIOS?: string;
  introductoryPriceSubscriptionPeriodIOS?: SubscriptionIosPeriod;
  platform: "ios";
  subscriptionPeriodNumberIOS?: string;
  subscriptionPeriodUnitIOS?: SubscriptionIosPeriod;
};`}</CodeBlock>

        <h3>ProductSubscriptionAndroid</h3>
        <CodeBlock language="typescript">{`type ProductSubscriptionAndroidOfferDetails = {
  basePlanId: string;
  offerId: string | null;
  offerToken: string;
  pricingPhases: PricingPhasesAndroid;
  offerTags: string[];
};

type ProductSubscriptionAndroid = ProductAndroid & {
  subscriptionOfferDetailsAndroid: ProductSubscriptionAndroidOfferDetails[];
};`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="purchase" level="h2">
          Purchase
        </AnchorLink>
        <p className="type-definition">
          Purchase = (PurchaseAndroid & AndroidPlatform) | (PurchaseIOS &
          IosPlatform)
        </p>

        <h3>PurchaseCommon</h3>
        <CodeBlock language="typescript">{`type PurchaseCommon = {
  id: string;
  productId: string;
  ids?: string[];  // Common field for both platforms
  transactionDate: number;
  transactionReceipt: string;
  purchaseToken?: string;
  platform?: string;  // Added for platform identification
};`}</CodeBlock>

        <h3>PurchaseIOS</h3>
        <CodeBlock language="typescript">{`type PurchaseIOS = PurchaseCommon & {
  platform: "ios";  // Literal type
  quantityIOS?: number;
  originalTransactionDateIOS?: number;
  originalTransactionIdentifierIOS?: string;
  appAccountToken?: string;
  expirationDateIOS?: number;
  webOrderLineItemIdIOS?: number;
  environmentIOS?: string;
  storefrontCountryCodeIOS?: string;
  appBundleIdIOS?: string;
  productTypeIOS?: string;
  subscriptionGroupIdIOS?: string;
  isUpgradedIOS?: boolean;
  ownershipTypeIOS?: string;
  reasonIOS?: string;
  reasonStringRepresentationIOS?: string;
  transactionReasonIOS?: 'PURCHASE' | 'RENEWAL' | string;
  revocationDateIOS?: number;
  revocationReasonIOS?: string;
  offerIOS?: {
    id: string;
    type: string;
    paymentMode: string;
  };
  
  currencyCodeIOS?: string;
  currencySymbolIOS?: string;
  countryCodeIOS?: string;
};`}</CodeBlock>

        <h3>PurchaseAndroid</h3>
        <CodeBlock language="typescript">{`export enum PurchaseAndroidState {
  UNSPECIFIED_STATE = 0,
  PURCHASED = 1,
  PENDING = 2,
}

type PurchaseAndroid = PurchaseCommon & {
  platform: "android";  // Literal type
  dataAndroid?: string;
  signatureAndroid?: string;
  autoRenewingAndroid?: boolean;
  purchaseStateAndroid?: PurchaseAndroidState;
  isAcknowledgedAndroid?: boolean;
  packageNameAndroid?: string;
  developerPayloadAndroid?: string;
  obfuscatedAccountIdAndroid?: string;
  obfuscatedProfileIdAndroid?: string;
};`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="unified-platform-types" level="h2">
          Unified Platform Types
        </AnchorLink>
        <p className="type-definition">
          These types combine platform-specific types with discriminators for
          type safety.
        </p>

        <h3>Platform Discriminators</h3>
        <CodeBlock language="typescript">{`type IosPlatform = { platform: 'ios' };
type AndroidPlatform = { platform: 'android' };`}</CodeBlock>

        <h3>Unified Types</h3>
        <CodeBlock language="typescript">{`// Product Union Types
type Product = 
  | (ProductAndroid & AndroidPlatform)
  | (ProductIOS & IosPlatform);

type SubscriptionProduct =
  | (ProductSubscriptionAndroid & AndroidPlatform)
  | (ProductSubscriptionIOS & IosPlatform);

// Purchase Union Types  
type Purchase =
  | (PurchaseAndroid & AndroidPlatform)
  | (PurchaseIOS & IosPlatform);`}</CodeBlock>
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
  andDangerouslyFinishTransactionAutomatically: Boolean
  
  "App account token for user tracking"
  appAccountToken: String
  
  "Purchase quantity"
  quantity: Int
  
  "Discount offer to apply"
  withOffer: DiscountOffer
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
        <AnchorLink id="receipt-validation-types" level="h2">
          ReceiptValidation Types
        </AnchorLink>

        <AnchorLink id="receipt-validation" level="h3">
          ReceiptValidation
        </AnchorLink>
        <CodeBlock language="typescript">{`interface ReceiptValidationProps {
  /** Product SKU to validate */
  sku: string;
  /** Android-specific validation options */
  androidOptions?: {
    packageName: string;
    productToken: string;
    accessToken: string;
    isSub?: boolean;
  };
}`}</CodeBlock>

        <AnchorLink id="validation-result" level="h3">
          ReceiptValidationResult
        </AnchorLink>
        <CodeBlock language="typescript">{`// iOS Receipt Validation Result
interface ReceiptValidationResultIOS {
  /** Whether the receipt is valid */
  isValid: boolean;
  /** Receipt data string */
  receiptData: string;
  /** JWS representation */
  jwsRepresentation: string;
  /** Latest transaction if available */
  latestTransaction?: Purchase;
}

// Android Receipt Validation Result
interface ReceiptValidationResultAndroid {
  autoRenewing: boolean;
  betaProduct: boolean;
  cancelDate: number | null;
  cancelReason: string;
  deferredDate: number | null;
  deferredSku: number | null;
  freeTrialEndDate: number;
  gracePeriodEndDate: number;
  parentProductId: string;
  productId: string;
  productType: string;
  purchaseDate: number;
  quantity: number;
  receiptId: string;
  renewalDate: number;
  term: string;
  termSku: string;
  testTransaction: boolean;
}

// Union type for receipt validation results
type ReceiptValidationResult = ReceiptValidationResultAndroid | ReceiptValidationResultIOS;`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="platform-specific-types" level="h2">
          Platform-Specific Types
        </AnchorLink>

        <AnchorLink id="ios-types" level="h3">
          iOS Specific Types
        </AnchorLink>

        <h4>DiscountOffer</h4>
        <p>
          Used when requesting a purchase with a promotional offer or discount.
        </p>
        <CodeBlock language="graphql">{`type DiscountOffer {
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
        <p>
          Discount information returned from the store as part of product
          details.
        </p>
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
    </div>
  );
}

export default Types;
