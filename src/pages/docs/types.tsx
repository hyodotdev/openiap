import { useState, type ChangeEvent } from 'react';
import { toast } from 'react-toastify';
import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import PlatformTabs from '../../components/PlatformTabs';
import { useScrollToHash } from '../../hooks/useScrollToHash';

const RELEASE_VERSION = '1.0.1';
const RELEASE_PAGE_URL =
  'https://github.com/hyodotdev/openiap-gql/releases/tag/1.0.1';
const RELEASE_DOWNLOAD_PREFIX =
  'https://github.com/hyodotdev/openiap-gql/releases/download/1.0.1/';

const SELECT_CARET_ICON =
  'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%228%22%20viewBox%3D%220%200%2012%208%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M1%201l5%205%205-5%22%20stroke%3D%22%23a2a9b0%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E';

const SPEC_ARCHIVES = [
  {
    filename: 'openiap-typescript.zip',
    label: 'TypeScript definitions',
    size: '4.71 KB',
    sha256: '0dfce08584584ce6d6c1106640338c8519b459bd5e304a16d6967afda3fe01b7',
  },
  {
    filename: 'openiap-swift.zip',
    label: 'Swift definitions',
    size: '4.95 KB',
    sha256: 'f4895459f08293e362bec537db56d584784540808c9af1abe8d77e59bf05f2da',
  },
  {
    filename: 'openiap-kotlin.zip',
    label: 'Kotlin definitions',
    size: '10.3 KB',
    sha256: 'a002b634270c029b52401c3a529b7d989d57df875310f077ae42328c7312813f',
  },
  {
    filename: 'openiap-dart.zip',
    label: 'Dart definitions',
    size: '11.9 KB',
    sha256: 'ee89e90a7a8aee3400bd9cc97bf1e9c5bef93a93b27a8da03490f1625b0d125e',
  },
];

function Types() {
  useScrollToHash();
  const [selectedArchive, setSelectedArchive] = useState(SPEC_ARCHIVES[0]);

  const handleChangeArchive = (event: ChangeEvent<HTMLSelectElement>) => {
    const archive = SPEC_ARCHIVES.find(
      (item) => item.filename === event.target.value
    );

    if (archive) {
      setSelectedArchive(archive);
    }
  };

  const handleDownloadSelected = () => {
    const link = document.createElement('a');
    link.href = `${RELEASE_DOWNLOAD_PREFIX}${selectedArchive.filename}`;
    link.download = selectedArchive.filename;
    link.rel = 'noreferrer';
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();

    toast.info(
      () => (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            maxWidth: '28rem',
            wordBreak: 'break-word',
          }}
        >
          <span>
            Downloading {selectedArchive.label} ({selectedArchive.size}) from
            openiap-gql {RELEASE_VERSION}.
          </span>
          <button
            type="button"
            onClick={() => {
              window.open(RELEASE_PAGE_URL, '_blank', 'noopener,noreferrer');
            }}
            style={{
              alignSelf: 'flex-start',
              backgroundColor: 'transparent',
              border: '1px solid var(--primary-color)',
              borderRadius: '9999px',
              padding: '0.25rem 0.75rem',
              color: 'var(--primary-color)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            View release
          </button>
        </div>
      ),
      { icon: '⬇️' }
    );
  };

  return (
    <div className="doc-page">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1.5rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0 }}>Types</h1>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <select
            value={selectedArchive.filename}
            onChange={handleChangeArchive}
            style={{
              padding: '0.35rem 2.5rem 0.35rem 0.75rem',
              borderRadius: '9999px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              cursor: 'pointer',
              minWidth: '200px',
              appearance: 'none',
              WebkitAppearance: 'none',
              backgroundImage: `url(${SELECT_CARET_ICON})`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'calc(100% - 1rem) center',
              backgroundSize: '12px',
            }}
          >
            {SPEC_ARCHIVES.map((archive) => (
              <option key={archive.filename} value={archive.filename}>
                {archive.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleDownloadSelected}
            style={{
              backgroundColor: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              padding: '0.4rem 1rem',
              borderRadius: '9999px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(event) =>
              (event.currentTarget.style.backgroundColor = '#0b7cd6')
            }
            onMouseLeave={(event) =>
              (event.currentTarget.style.backgroundColor =
                'var(--primary-color)')
            }
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 12l-4-4h2.5V3h3v5H12l-4 4z" />
              <path d="M2 14h12v1H2v-1z" />
            </svg>
            Download
          </button>
        </div>
      </div>

      <section>
        <AnchorLink id="product" level="h2">
          Product
        </AnchorLink>
        <p className="type-definition">
          Product = (ProductAndroid & AndroidPlatform) | (ProductIOS &
          IosPlatform)
        </p>

        <h3>Common Fields</h3>
        <CodeBlock language="typescript">{`type ProductCommon = {
  id: string;
  title: string;
  description: string;
  type: "in-app" | "subs";  // Product type for Android compatibility
  displayName?: string;
  displayPrice: string;
  currency: string;
  price?: number;
  debugDescription?: string;
  platform?: string;  // Added for platform identification
};`}</CodeBlock>

        <h3>Platform-Specific Fields</h3>
        <PlatformTabs>
          {{
            ios: (
              <>
                <h4>ProductIOS</h4>
                <CodeBlock language="typescript">{`enum ProductTypeIOS {
  Consumable = "Consumable",
  NonConsumable = "NonConsumable", 
  AutoRenewableSubscription = "AutoRenewableSubscription",
  NonRenewingSubscription = "NonRenewingSubscription"
}

type ProductIOS = ProductCommon & {
  displayNameIOS: string;
  isFamilyShareableIOS: boolean;
  jsonRepresentationIOS: string;
  platform: "ios";  // Literal type
  subscriptionInfoIOS?: SubscriptionInfo;
  typeIOS: ProductTypeIOS;  // Detailed iOS product type
};

type SubscriptionInfo = {
  introductoryOffer?: SubscriptionOffer;
  promotionalOffers?: SubscriptionOffer[];
  subscriptionGroupId: string;
  subscriptionPeriod: {
    unit: SubscriptionPeriodIOS;
    value: number;
  };
};

type SubscriptionOffer = {
  displayPrice: string;
  id: string;
  paymentMode: PaymentMode;
  period: {
    unit: SubscriptionPeriodIOS;
    value: number;
  };
  periodCount: number;
  price: number;
  type: 'introductory' | 'promotional';
};

type PaymentMode = '' | 'FreeTrial' | 'PayAsYouGo' | 'PayUpFront';
type SubscriptionPeriodIOS = 'Day' | 'Week' | 'Month' | 'Year' | '';`}</CodeBlock>
              </>
            ),
            android: (
              <>
                <h4>ProductAndroid</h4>
                <CodeBlock language="typescript">{`type ProductAndroid = ProductCommon & {
  nameAndroid: string;
  oneTimePurchaseOfferDetailsAndroid?: ProductAndroidOneTimePurchaseOfferDetail;
  platform: "android";  // Literal type
  subscriptionOfferDetailsAndroid?: SubscriptionProductAndroidOfferDetail[];
};

type ProductAndroidOneTimePurchaseOfferDetail = {
  priceCurrencyCode: string;
  formattedPrice: string;
  priceAmountMicros: string;
};

type SubscriptionProductAndroidOfferDetail = {
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
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="product-subscription" level="h2">
          SubscriptionProduct
        </AnchorLink>
        <p className="type-definition">
          SubscriptionProduct = (SubscriptionProductAndroid & AndroidPlatform) |
          (SubscriptionProductIOS & IosPlatform)
        </p>

        <h3>Common Fields</h3>
        <CodeBlock language="typescript">{`type SubscriptionProductCommon = ProductCommon & {
  type: 'subs';
};`}</CodeBlock>

        <h3>Platform-Specific Fields</h3>
        <PlatformTabs>
          {{
            ios: (
              <>
                <h4>SubscriptionProductIOS</h4>
                <CodeBlock language="typescript">{`type Discount = {
  identifier: string;
  type: string;
  numberOfPeriods: string;
  price: string;
  localizedPrice: string;
  paymentMode: PaymentMode;
  subscriptionPeriod: string;
};

type SubscriptionProductIOS = ProductIOS & {
  discountsIOS?: Discount[];
  introductoryPriceIOS?: string;
  introductoryPriceAsAmountIOS?: string;
  introductoryPricePaymentModeIOS?: PaymentMode;
  introductoryPriceNumberOfPeriodsIOS?: string;
  introductoryPriceSubscriptionPeriodIOS?: SubscriptionPeriodIOS;
  platform: "ios";
  subscriptionPeriodNumberIOS?: string;
  subscriptionPeriodUnitIOS?: SubscriptionPeriodIOS;
};`}</CodeBlock>
              </>
            ),
            android: (
              <>
                <h4>SubscriptionProductAndroid</h4>
                <CodeBlock language="typescript">{`type SubscriptionProductAndroidOfferDetails = {
  basePlanId: string;
  offerId: string | null;
  offerToken: string;
  pricingPhases: PricingPhasesAndroid;
  offerTags: string[];
};

type SubscriptionProductAndroid = ProductAndroid & {
  subscriptionOfferDetailsAndroid: SubscriptionProductAndroidOfferDetails[];
};`}</CodeBlock>
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="purchase" level="h2">
          Purchase
        </AnchorLink>
        <p className="type-definition">
          Purchase = (PurchaseAndroid & AndroidPlatform) | (PurchaseIOS &
          IosPlatform)
        </p>

        <h3>Common Fields</h3>
        <CodeBlock language="typescript">{`enum PurchaseState {
  Pending = "Pending",
  Purchased = "Purchased", 
  Failed = "Failed",
  Restored = "Restored",   // iOS only
  Deferred = "Deferred",    // iOS only
  Unknown = "Unknown"
}

type PurchaseCommon = {
  id: string;
  productId: string;
  ids?: string[];  // Common field for both platforms
  transactionDate: number;
  /** Unified purchase token (jwsRepresentation for iOS, purchaseToken for Android) */
  purchaseToken?: string;
  platform?: string;  // Added for platform identification
  quantity: number;  // Purchase quantity (defaults to 1)
  purchaseState: PurchaseState;  // Purchase state (common field)
  isAutoRenewing: boolean;  // Auto-renewable subscription flag (common field)
};`}</CodeBlock>

        <h3>Platform-Specific Fields</h3>
        <PlatformTabs>
          {{
            ios: (
              <>
                <h4>PurchaseIOS</h4>
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
              </>
            ),
            android: (
              <>
                <h4>PurchaseAndroid</h4>
                <CodeBlock language="typescript">{`type PurchaseAndroid = PurchaseCommon & {
  platform: "android";  // Literal type
  dataAndroid?: string;
  signatureAndroid?: string;
  autoRenewingAndroid?: boolean;
  isAcknowledgedAndroid?: boolean;
  packageNameAndroid?: string;
  developerPayloadAndroid?: string;
  obfuscatedAccountIdAndroid?: string;
  obfuscatedProfileIdAndroid?: string;
};

// Note: Android only maps to these PurchaseState values:
// - "purchased" (Google Play state 1)
// - "pending" (Google Play state 2)
// - "failed" (Google Play state 0 or errors)`}</CodeBlock>
              </>
            ),
          }}
        </PlatformTabs>
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
  | (SubscriptionProductAndroid & AndroidPlatform)
  | (SubscriptionProductIOS & IosPlatform);

// Purchase Union Types  
type Purchase =
  | (PurchaseAndroid & AndroidPlatform)
  | (PurchaseIOS & IosPlatform);`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="product-request" level="h2">
          Product Request
        </AnchorLink>
        <p>Product request parameters for fetching products from the store.</p>

        <h3>ProductRequest</h3>
        <CodeBlock language="typescript">{`type ProductRequest = {
  skus: string[];                           // Product SKUs to fetch
  type?: "in-app" | "subs" | "all";         // Filter type (default: "in-app")
};

// Filter types:
// - "in-app": Returns consumable, nonConsumable, and nonRenewingSubscription
// - "subs": Returns only autoRenewableSubscription
// - "all": Returns all product types`}</CodeBlock>

        <h3>Usage Example</h3>
        <CodeBlock language="typescript">{`// Fetch in-app purchases (default)
const inappProducts = await getProducts({ skus: ["product1", "product2"] });

// Explicitly fetch in-app purchases
const inappProducts = await getProducts({ 
  skus: ["product1", "product2"],
  type: "in-app"
});

// Fetch only subscriptions
const subscriptions = await getProducts({ 
  skus: ["sub1", "sub2"],
  type: "subs"
});

// Fetch all products (both in-app and subscriptions)
const allProducts = await getProducts({ 
  skus: ["product1", "sub1"],
  type: "all"
});`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="request-types" level="h2">
          Request Types
        </AnchorLink>

        <AnchorLink id="request-purchase-props" level="h3">
          RequestPurchaseProps
        </AnchorLink>
        <p>
          Top-level arguments for <code>requestPurchase</code>. Wraps
          platform-specific props and requires an explicit purchase type that
          matches the provided params.
        </p>
        <CodeBlock language="graphql">{`type RequestPurchaseProps =
  | {
      params: RequestPurchasePropsByPlatforms
      type: 'in-app'
    }
  | {
      params: RequestSubscriptionPropsByPlatforms
      type: 'subs'
    }`}</CodeBlock>
        <p>
          Use the <code>'in-app'</code> variant when purchasing regular items
          and
          <code>'subs'</code> when purchasing subscriptions. This keeps the
          payloads aligned with their platform-specific structures.
        </p>

        <AnchorLink id="request-purchase-props-by-platforms" level="h3">
          RequestPurchasePropsByPlatforms
        </AnchorLink>
        <p>
          Platform-specific request structure for regular purchases. Allows
          clear separation of iOS and Android props.
        </p>
        <CodeBlock language="graphql">{`input RequestPurchasePropsByPlatforms {
  """
  iOS-specific purchase parameters
  """
  ios: RequestPurchaseIosProps

  """
  Android-specific purchase parameters
  """
  android: RequestPurchaseAndroidProps
}`}</CodeBlock>

        <AnchorLink id="request-subscription-props-by-platforms" level="h3">
          RequestSubscriptionPropsByPlatforms
        </AnchorLink>
        <p>Platform-specific subscription request structure.</p>
        <CodeBlock language="graphql">{`input RequestSubscriptionPropsByPlatforms {
  """
  iOS-specific subscription parameters
  """
  ios: RequestSubscriptionIosProps

  """
  Android-specific subscription parameters
  """
  android: RequestSubscriptionAndroidProps
}`}</CodeBlock>

        <AnchorLink id="platform-specific-request-props" level="h3">
          Platform-Specific Request Props
        </AnchorLink>
        <PlatformTabs>
          {{
            ios: (
              <>
                <h4>RequestPurchaseIosProps</h4>
                <p>iOS-specific purchase request props.</p>
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
              </>
            ),
            android: (
              <>
                <h4>RequestPurchaseAndroidProps</h4>
                <p>Android-specific purchase request props.</p>
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
              </>
            ),
          }}
        </PlatformTabs>

        <AnchorLink id="subscription-request-props" level="h3">
          Subscription Request Props
        </AnchorLink>
        <PlatformTabs>
          {{
            ios: (
              <>
                <h4>RequestSubscriptionIosProps</h4>
                <p>
                  For iOS subscriptions, use the same props as
                  RequestPurchaseIosProps.
                </p>
                <CodeBlock language="graphql">{`// iOS uses the same props as regular purchases
type RequestSubscriptionIosProps = RequestPurchaseIosProps`}</CodeBlock>
              </>
            ),
            android: (
              <>
                <h4>RequestSubscriptionAndroidProps</h4>
                <p>
                  Android-specific subscription request props. Extends
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
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="receipt-validation-types" level="h2">
          ReceiptValidation Types
        </AnchorLink>

        <AnchorLink id="receipt-validation-props" level="h3">
          ReceiptValidationProps
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

        <AnchorLink id="receipt-validation-result" level="h3">
          ReceiptValidationResult
        </AnchorLink>
        <PlatformTabs>
          {{
            ios: (
              <>
                <h4>ReceiptValidationResultIOS</h4>
                <CodeBlock language="typescript">{`interface ReceiptValidationResultIOS {
  /** Whether the receipt is valid */
  isValid: boolean;
  /** Receipt data string */
  receiptData: string;
  /** JWS representation */
  jwsRepresentation: string;
  /** Latest transaction if available */
  latestTransaction?: Purchase;
}`}</CodeBlock>
              </>
            ),
            android: (
              <>
                <h4>ReceiptValidationResultAndroid</h4>
                <CodeBlock language="typescript">{`interface ReceiptValidationResultAndroid {
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
}`}</CodeBlock>
              </>
            ),
          }}
        </PlatformTabs>

        <h3>Union Type</h3>
        <CodeBlock language="typescript">{`// Union type for receipt validation results
type ReceiptValidationResult = ReceiptValidationResultAndroid | ReceiptValidationResultIOS;`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="platform-specific-types" level="h2">
          Platform-Specific Types
        </AnchorLink>

        <PlatformTabs>
          {{
            ios: (
              <>
                <h3>iOS Types</h3>

                <h4>DiscountOffer</h4>
                <p>
                  Used when requesting a purchase with a promotional offer or
                  discount.
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
                  Discount information returned from the store as part of
                  product details.
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
  
  "Payment mode (PayAsYouGo, PayUpFront, FreeTrial)"
  paymentMode: String!
  
  "Subscription period for discount"
  subscriptionPeriod: String!
}`}</CodeBlock>

                <h4>SubscriptionPeriodIOS</h4>
                <CodeBlock language="graphql">{`enum SubscriptionPeriodIOS {
  Day    # Daily period
  Week   # Weekly period
  Month  # Monthly period
  Year   # Yearly period
  ""     # Empty string (unspecified)
}`}</CodeBlock>

                <h4>PaymentMode</h4>
                <CodeBlock language="graphql">{`enum PaymentMode {
  ""            # Empty string
  FreeTrial      # Free trial
  PayAsYouGo     # Pay as you go
  PayUpFront     # Pay up front
}`}</CodeBlock>

                <h4>SubscriptionStatusIOS</h4>
                <p>
                  Represents subscription status information from StoreKit 2.
                </p>
                <CodeBlock language="typescript">{`type RenewalInfo = {
  jsonRepresentation?: string;
  willAutoRenew: boolean;
  autoRenewPreference?: string;
};

export type SubscriptionStatusIOS = {
  /**
   * StoreKit RenewalState
   * See: https://developer.apple.com/documentation/storekit/product/subscriptioninfo/renewalstate
   */
  state: string;
  renewalInfo?: RenewalInfo;
};`}</CodeBlock>
              </>
            ),
            android: (
              <>
                <h3>Android Types</h3>

                <h4>SubscriptionOffer</h4>
                <p>Subscription offer details for Android purchases.</p>
                <CodeBlock language="graphql">{`type SubscriptionOffer {
  "Product SKU"
  sku: String!
  
  "Offer token for purchase"
  offerToken: String!
}`}</CodeBlock>

                <h4>PricingPhase</h4>
                <p>Pricing phase information for Android subscriptions.</p>
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

                <h4>PricingPhasesAndroid</h4>
                <CodeBlock language="graphql">{`type PricingPhasesAndroid {
  pricingPhaseList: [PricingPhaseAndroid!]!
}`}</CodeBlock>

                <h4>PricingPhaseAndroid</h4>
                <CodeBlock language="graphql">{`type PricingPhaseAndroid {
  formattedPrice: String!
  priceCurrencyCode: String!
  billingPeriod: String!  # P1W, P1M, P1Y
  billingCycleCount: Int!
  priceAmountMicros: String!
  recurrenceMode: Int!
}`}</CodeBlock>
              </>
            ),
          }}
        </PlatformTabs>
      </section>
    </div>
  );
}

export default Types;
