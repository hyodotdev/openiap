import { useState, type ChangeEvent } from 'react';
import { toast } from 'react-toastify';
import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import PlatformTabs from '../../components/PlatformTabs';
import { useScrollToHash } from '../../hooks/useScrollToHash';
import { GQL_RELEASE } from '../../lib/versioning';

const RELEASE_VERSION = GQL_RELEASE.tag;
const RELEASE_PAGE_URL = GQL_RELEASE.pageUrl;
const RELEASE_DOWNLOAD_PREFIX = GQL_RELEASE.downloadPrefix;

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
  type: "in-app" | "subs";
  displayName?: string;
  displayPrice: string;
  currency: string;
  price?: number;
  debugDescription?: string;
  platform?: string;
};`}</CodeBlock>
        <div style={{ marginTop: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Field Reference</h4>
          <ul style={{ marginTop: '0.5rem' }}>
            <li>
              <code>id</code> — Unique product identifier
            </li>
            <li>
              <code>title</code> — Product title
            </li>
            <li>
              <code>description</code> — Product description
            </li>
            <li>
              <code>type</code> — Product type
            </li>
            <li>
              <code>displayName</code> — Display name
            </li>
            <li>
              <code>displayPrice</code> — Formatted price with currency symbol
            </li>
            <li>
              <code>currency</code> — ISO 4217 currency code
            </li>
            <li>
              <code>price</code> — Numeric price
            </li>
            <li>
              <code>debugDescription</code> — Debug description
            </li>
            <li>
              <code>platform</code> — Platform discriminator (e.g., ios,
              android)
            </li>
          </ul>
        </div>

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
  platform: "ios";
  subscriptionInfoIOS?: SubscriptionInfo;
  typeIOS: ProductTypeIOS;
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
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>displayNameIOS</code> — iOS display name
                    </li>
                    <li>
                      <code>isFamilyShareableIOS</code> — Family Sharing support
                    </li>
                    <li>
                      <code>jsonRepresentationIOS</code> — Raw JSON string
                    </li>
                    <li>
                      <code>platform</code> — Platform discriminator
                    </li>
                    <li>
                      <code>subscriptionInfoIOS</code> — Subscription metadata
                    </li>
                    <li>
                      <code>typeIOS</code> — Detailed iOS product type
                    </li>
                  </ul>
                  <h5 style={{ margin: '0.75rem 0 0.25rem' }}>
                    SubscriptionInfo
                  </h5>
                  <ul>
                    <li>
                      <code>introductoryOffer</code> — Introductory offer
                    </li>
                    <li>
                      <code>promotionalOffers</code> — Promotional offers
                    </li>
                    <li>
                      <code>subscriptionGroupId</code> — Subscription group ID
                    </li>
                    <li>
                      <code>subscriptionPeriod</code> — Subscription period
                      <ul>
                        <li>
                          <code>unit</code> — Period unit
                        </li>
                        <li>
                          <code>value</code> — Period length
                        </li>
                      </ul>
                    </li>
                  </ul>
                  <h5 style={{ margin: '0.75rem 0 0.25rem' }}>
                    SubscriptionOffer
                  </h5>
                  <ul>
                    <li>
                      <code>displayPrice</code> — Formatted price
                    </li>
                    <li>
                      <code>id</code> — Offer ID
                    </li>
                    <li>
                      <code>paymentMode</code> — Payment mode
                    </li>
                    <li>
                      <code>period</code> — Offer period
                      <ul>
                        <li>
                          <code>unit</code> — Period unit
                        </li>
                        <li>
                          <code>value</code> — Period length
                        </li>
                      </ul>
                    </li>
                    <li>
                      <code>periodCount</code> — Billing cycles
                    </li>
                    <li>
                      <code>price</code> — Numeric price
                    </li>
                    <li>
                      <code>type</code> — Offer type
                    </li>
                  </ul>
                </div>
              </>
            ),
            android: (
              <>
                <h4>ProductAndroid</h4>
                <CodeBlock language="typescript">{`type ProductAndroid = ProductCommon & {
  nameAndroid: string;
  oneTimePurchaseOfferDetailsAndroid?: ProductAndroidOneTimePurchaseOfferDetail;
  platform: "android";
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
  billingPeriod: string;
  billingCycleCount: number;
  priceAmountMicros: string;
  recurrenceMode: number;
};`}</CodeBlock>
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>nameAndroid</code> — Android product name
                    </li>
                    <li>
                      <code>oneTimePurchaseOfferDetailsAndroid</code> — One-time
                      purchase offer details
                    </li>
                    <li>
                      <code>platform</code> — Platform discriminator
                    </li>
                    <li>
                      <code>subscriptionOfferDetailsAndroid</code> —
                      Subscription offer details
                    </li>
                  </ul>
                  <h5 style={{ margin: '0.75rem 0 0.25rem' }}>
                    ProductAndroidOneTimePurchaseOfferDetail
                  </h5>
                  <ul>
                    <li>
                      <code>priceCurrencyCode</code> — Currency code
                    </li>
                    <li>
                      <code>formattedPrice</code> — Formatted price
                    </li>
                    <li>
                      <code>priceAmountMicros</code> — Price in micros
                    </li>
                  </ul>
                  <h5 style={{ margin: '0.75rem 0 0.25rem' }}>
                    SubscriptionProductAndroidOfferDetail
                  </h5>
                  <ul>
                    <li>
                      <code>basePlanId</code> — Base plan ID
                    </li>
                    <li>
                      <code>offerId</code> — Offer ID
                    </li>
                    <li>
                      <code>offerToken</code> — Offer token
                    </li>
                    <li>
                      <code>offerTags</code> — Offer tags
                    </li>
                    <li>
                      <code>pricingPhases</code> — Pricing phases
                    </li>
                  </ul>
                  <h5 style={{ margin: '0.75rem 0 0.25rem' }}>
                    PricingPhasesAndroid / PricingPhaseAndroid
                  </h5>
                  <ul>
                    <li>
                      <code>pricingPhaseList</code> — Pricing phase list
                    </li>
                    <li>
                      <code>formattedPrice</code> — Phase formatted price
                    </li>
                    <li>
                      <code>priceCurrencyCode</code> — Currency code
                    </li>
                    <li>
                      <code>billingPeriod</code> — Billing period (P1W/P1M/P1Y)
                    </li>
                    <li>
                      <code>billingCycleCount</code> — Billing cycles
                    </li>
                    <li>
                      <code>priceAmountMicros</code> — Price in micros
                    </li>
                    <li>
                      <code>recurrenceMode</code> — Recurrence mode
                    </li>
                  </ul>
                </div>
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
        <div style={{ marginTop: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Field Reference</h4>
          <ul style={{ marginTop: '0.5rem' }}>
            <li>
              <code>type</code> — Discriminator indicating a subscription
              product
            </li>
          </ul>
        </div>

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
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>discountsIOS</code> — iOS discount list
                    </li>
                    <li>
                      <code>introductoryPrice</code> — Introductory price
                      details
                      <ul>
                        <li>
                          <code>introductoryPriceIOS</code> — Formatted price
                        </li>
                        <li>
                          <code>introductoryPriceAsAmountIOS</code> — Numeric
                          price
                        </li>
                        <li>
                          <code>introductoryPricePaymentModeIOS</code> — Payment
                          mode
                        </li>
                        <li>
                          <code>introductoryPriceNumberOfPeriodsIOS</code> —
                          Number of periods
                        </li>
                        <li>
                          <code>introductoryPriceSubscriptionPeriodIOS</code> —
                          Period unit
                        </li>
                      </ul>
                    </li>
                    <li>
                      <code>platform</code> — Platform discriminator
                    </li>
                    <li>
                      <code>subscriptionPeriodNumberIOS</code> — Subscription
                      period length
                    </li>
                    <li>
                      <code>subscriptionPeriodUnitIOS</code> — Subscription
                      period unit
                    </li>
                  </ul>
                </div>
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
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>subscriptionOfferDetailsAndroid</code> — Android
                      subscription offers
                    </li>
                  </ul>
                  <h5 style={{ margin: '0.75rem 0 0.25rem' }}>
                    SubscriptionProductAndroidOfferDetails
                  </h5>
                  <ul>
                    <li>
                      <code>basePlanId</code> — Base plan ID
                    </li>
                    <li>
                      <code>offerId</code> — Offer ID
                    </li>
                    <li>
                      <code>offerToken</code> — Offer token
                    </li>
                    <li>
                      <code>pricingPhases</code> — Pricing phases
                    </li>
                    <li>
                      <code>offerTags</code> — Offer tags
                    </li>
                  </ul>
                </div>
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
        <AnchorLink id="storefront" level="h2">
          Storefront
        </AnchorLink>
        <p>
          ISO 3166-1 alpha-2 storefront code returned by{' '}
          <code>getStorefront</code>.
        </p>
        <CodeBlock language="typescript">{`type StorefrontCode = string;`}</CodeBlock>
        <div style={{ marginTop: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Usage Notes</h4>
          <ul style={{ marginTop: '0.5rem' }}>
            <li>
              Example values: <code>"US"</code>, <code>"KR"</code>,
              <code>"JP"</code>
            </li>
            <li>
              May return an empty string when the storefront cannot be
              determined.
            </li>
          </ul>
        </div>
        <blockquote className="info-note">
          <p>
            iOS sources the value from the active StoreKit storefront. Android
            queries Google Play Billing configuration and returns the same
            country code string when available.
          </p>
        </blockquote>
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
  Restored = "Restored",
  Deferred = "Deferred",
  Unknown = "Unknown"
}

type PurchaseCommon = {
  id: string;
  productId: string;
  ids?: string[];
  transactionDate: number;
  purchaseToken?: string;
  platform?: string;
  quantity: number;
  purchaseState: PurchaseState;
  isAutoRenewing: boolean;
  currentPlanId?: string;
};`}</CodeBlock>
        <div style={{ marginTop: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Field Reference</h4>
          <ul style={{ marginTop: '0.5rem' }}>
            <li>
              <code>id</code> — Purchase identifier (primary key)
            </li>
            <li>
              <code>productId</code> — Purchased product ID
            </li>
            <li>
              <code>ids</code> — Included SKUs for bundled purchases
            </li>
            <li>
              <code>transactionDate</code> — Epoch ms timestamp
            </li>
            <li>
              <code>purchaseToken</code> — Unified token (JWS/Play token)
            </li>
            <li>
              <code>platform</code> — Platform discriminator
            </li>
            <li>
              <code>quantity</code> — Purchase quantity
            </li>
            <li>
              <code>purchaseState</code> — Purchase state
            </li>
            <li>
              <code>isAutoRenewing</code> — Auto-renew flag
            </li>
            <li>
              <code>currentPlanId</code> — The current plan identifier. This
              provides a unified way to identify which specific plan/tier the
              user is subscribed to:
              <ul>
                <li>
                  On Android: the basePlanId (e.g., "premium", "premium-year")
                </li>
                <li>
                  On iOS: the productId (e.g., "com.example.premium_monthly",
                  "com.example.premium_yearly")
                </li>
              </ul>
            </li>
          </ul>
        </div>

        <p>
          The shared <code>id</code> field maps to Google Play's{' '}
          <code>orderId</code>. When Play omits it—common for consumables—the
          SDK falls back to the long <code>purchaseToken</code> so you retain a
          stable primary key. The token length makes the fallback easy to spot.
        </p>
        <p>
          <code>transactionId</code> also mirrors the same <code>orderId</code>
          value for consistency. On iOS, <code>id</code> and{' '}
          <code>transactionId</code> are always identical; on Android they match
          unless the <code>id</code> field needs to fall back to the token.
        </p>

        <h3>Platform-Specific Fields</h3>
        <PlatformTabs>
          {{
            ios: (
              <>
                <h4>PurchaseIOS</h4>
                <CodeBlock language="typescript">{`type PurchaseIOS = PurchaseCommon & {
  platform: "ios";
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
  currentPlanId?: string;
  renewalInfoIOS?: RenewalInfoIOS;
};

// RenewalInfoIOS - from Product.SubscriptionInfo.RenewalInfo
// https://developer.apple.com/documentation/storekit/product/subscriptioninfo/renewalinfo
type RenewalInfoIOS = {
  willAutoRenew: boolean;
  autoRenewPreference?: string;
  jsonRepresentation?: string;
  expirationReason?: string;
  gracePeriodExpirationDate?: number;
  isInBillingRetry?: boolean;
  pendingUpgradeProductId?: string;
  priceIncreaseStatus?: string;
  renewalDate?: number;
  renewalOfferId?: string;
  renewalOfferType?: string;
};`}</CodeBlock>
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>quantityIOS</code> — Quantity (iOS)
                    </li>
                    <li>
                      <code>originalTransactionDateIOS</code> — Original
                      purchase timestamp
                    </li>
                    <li>
                      <code>originalTransactionIdentifierIOS</code> — Original
                      transaction ID
                    </li>
                    <li>
                      <code>appAccountToken</code> — App account token
                    </li>
                    <li>
                      <code>expirationDateIOS</code> — Expiration timestamp
                    </li>
                    <li>
                      <code>webOrderLineItemIdIOS</code> — Web order line item
                      ID
                    </li>
                    <li>
                      <code>environmentIOS</code> — Environment
                      (Sandbox/Production)
                    </li>
                    <li>
                      <code>storefrontCountryCodeIOS</code> — Storefront country
                      code
                    </li>
                    <li>
                      <code>appBundleIdIOS</code> — App bundle ID
                    </li>
                    <li>
                      <code>subscriptionGroupIdIOS</code> — Subscription group
                      ID
                    </li>
                    <li>
                      <code>isUpgradedIOS</code> — Upgraded flag
                    </li>
                    <li>
                      <code>ownershipTypeIOS</code> — Ownership type
                    </li>
                    <li>
                      <code>transactionReasonIOS</code> — Transaction reason
                    </li>
                    <li>
                      <code>revocationDateIOS</code> — Revocation timestamp
                    </li>
                    <li>
                      <code>revocationReasonIOS</code> — Revocation reason
                    </li>
                    <li>
                      <code>offerIOS</code> — Offer metadata
                      <ul>
                        <li>
                          <code>id</code> — Offer ID
                        </li>
                        <li>
                          <code>type</code> — Offer type
                        </li>
                        <li>
                          <code>paymentMode</code> — Payment mode
                        </li>
                      </ul>
                    </li>
                    <li>
                      <code>currencyCodeIOS</code> — Currency code
                    </li>
                    <li>
                      <code>currencySymbolIOS</code> — Currency symbol
                    </li>
                    <li>
                      <code>countryCodeIOS</code> — Country code
                    </li>
                    <li>
                      <code>currentPlanId</code> — The current plan identifier.
                      On iOS, this is the productId (e.g.,
                      "com.example.premium_monthly",
                      "com.example.premium_yearly"). This provides a unified way
                      to identify which specific plan/tier the user is
                      subscribed to across platforms.
                    </li>
                    <li>
                      <code>renewalInfoIOS</code> — Subscription renewal
                      information object (see RenewalInfoIOS type below)
                    </li>
                  </ul>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ margin: 0 }}>
                    RenewalInfoIOS{' '}
                    <span style={{ fontSize: '0.85rem', fontWeight: 'normal' }}>
                      (from{' '}
                      <a
                        href="https://developer.apple.com/documentation/storekit/product/subscriptioninfo/renewalinfo"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Product.SubscriptionInfo.RenewalInfo
                      </a>
                      )
                    </span>
                  </h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>willAutoRenew</code> — Whether the subscription will
                      automatically renew
                    </li>
                    <li>
                      <code>autoRenewPreference</code> — Product ID the
                      subscription will renew to (may differ from current if
                      upgrade/downgrade pending)
                    </li>
                    <li>
                      <code>jsonRepresentation</code> — JSON representation of
                      renewal info
                    </li>
                    <li>
                      <code>expirationReason</code> — Why the subscription
                      expired. Possible values: "VOLUNTARY", "BILLING_ERROR",
                      "DID_NOT_AGREE_TO_PRICE_INCREASE",
                      "PRODUCT_NOT_AVAILABLE", "UNKNOWN"
                    </li>
                    <li>
                      <code>gracePeriodExpirationDate</code> — Grace period
                      expiration timestamp (milliseconds since epoch). When set,
                      subscription is in grace period
                    </li>
                    <li>
                      <code>isInBillingRetry</code> — True if subscription
                      failed to renew due to billing issue and is retrying
                    </li>
                    <li>
                      <code>pendingUpgradeProductId</code> — Product ID that
                      will be used on next renewal (when user
                      upgrades/downgrades). If set and different from current
                      productId, subscription will change on expiration
                    </li>
                    <li>
                      <code>priceIncreaseStatus</code> — User's response to
                      subscription price increase. Possible values: "AGREED",
                      "PENDING", null
                    </li>
                    <li>
                      <code>renewalDate</code> — Expected renewal timestamp
                      (milliseconds since epoch)
                    </li>
                    <li>
                      <code>renewalOfferId</code> — Offer ID applied to next
                      renewal
                    </li>
                    <li>
                      <code>renewalOfferType</code> — Type of offer applied to
                      next renewal: "PROMOTIONAL", "SUBSCRIPTION_OFFER_CODE",
                      "WIN_BACK", etc.
                    </li>
                  </ul>
                </div>
              </>
            ),
            android: (
              <>
                <h4>PurchaseAndroid</h4>
                <CodeBlock language="typescript">{`type PurchaseAndroid = PurchaseCommon & {
  platform: "android";
  dataAndroid?: string;
  transactionId?: string;
  signatureAndroid?: string;
  autoRenewingAndroid?: boolean;
  isAcknowledgedAndroid?: boolean;
  packageNameAndroid?: string;
  developerPayloadAndroid?: string;
  obfuscatedAccountIdAndroid?: string;
  obfuscatedProfileIdAndroid?: string;
  currentPlanId?: string;
};`}</CodeBlock>
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>dataAndroid</code> — Raw receipt data
                    </li>
                    <li>
                      <code>transactionId</code> — Transaction ID
                    </li>
                    <li>
                      <code>signatureAndroid</code> — Signature
                    </li>
                    <li>
                      <code>autoRenewingAndroid</code> — Auto-renewing flag
                    </li>
                    <li>
                      <code>isAcknowledgedAndroid</code> — Acknowledged flag
                    </li>
                    <li>
                      <code>packageNameAndroid</code> — Package name
                    </li>
                    <li>
                      <code>developerPayloadAndroid</code> — Developer payload
                    </li>
                    <li>
                      <code>obfuscatedAccountIdAndroid</code> — Obfuscated
                      account ID
                    </li>
                    <li>
                      <code>obfuscatedProfileIdAndroid</code> — Obfuscated
                      profile ID
                    </li>
                    <li>
                      <code>currentPlanId</code> — The current plan identifier.
                      On Android, this is the basePlanId (e.g., "premium",
                      "premium-year"). This provides a unified way to identify
                      which specific plan/tier the user is subscribed to across
                      platforms.
                    </li>
                  </ul>
                </div>
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
        <AnchorLink id="active-subscription" level="h2">
          ActiveSubscription
        </AnchorLink>
        <p>
          Represents an active subscription returned by{' '}
          <code>getActiveSubscriptions()</code>.
        </p>

        <CodeBlock language="typescript">{`type ActiveSubscription = {
  productId: string;
  isActive: boolean;
  expirationDateIOS?: number;        // iOS only
  autoRenewingAndroid?: boolean;     // Android only
  environmentIOS?: string;           // iOS only: "Sandbox" | "Production"
  willExpireSoon?: boolean;          // True if expiring within 7 days
  daysUntilExpirationIOS?: number;   // iOS only
  transactionId: string;             // Transaction identifier for backend validation
  purchaseToken?: string;            // JWT token (iOS) or purchase token (Android) for backend validation
  transactionDate: number;           // Transaction timestamp
  basePlanIdAndroid?: string;        // Android only: base plan identifier
  currentPlanId?: string;            // Unified plan/tier identifier
  purchaseTokenAndroid?: string;     // Android only: purchase token for subscription upgrade/downgrade
  renewalInfoIOS?: RenewalInfoIOS;   // iOS only: subscription renewal information from StoreKit 2
};`}</CodeBlock>

        <div style={{ marginTop: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Field Reference</h4>
          <ul style={{ marginTop: '0.5rem' }}>
            <li>
              <code>productId</code> — Subscription product identifier
            </li>
            <li>
              <code>isActive</code> — Whether the subscription is currently
              active
            </li>
            <li>
              <code>expirationDateIOS</code> — iOS expiration timestamp (epoch
              ms)
            </li>
            <li>
              <code>autoRenewingAndroid</code> — Android auto-renewal status
            </li>
            <li>
              <code>environmentIOS</code> — iOS environment ("Sandbox" |
              "Production")
            </li>
            <li>
              <code>willExpireSoon</code> — True if expiring within 7 days
            </li>
            <li>
              <code>daysUntilExpirationIOS</code> — iOS days until expiration
            </li>
            <li>
              <code>transactionId</code> — Transaction identifier for backend
              validation
            </li>
            <li>
              <code>purchaseToken</code> — JWT token (iOS) or purchase token
              (Android)
            </li>
            <li>
              <code>transactionDate</code> — Transaction timestamp (epoch ms)
            </li>
            <li>
              <code>basePlanIdAndroid</code> — Android-specific base plan
              identifier (e.g., "premium", "premium-year")
            </li>
            <li>
              <code>currentPlanId</code> — The current plan identifier. This
              provides a unified way to identify which specific plan/tier the
              user is subscribed to:
              <ul>
                <li>
                  On Android: the basePlanId (e.g., "premium", "premium-year")
                </li>
                <li>
                  On iOS: the productId (e.g., "com.example.premium_monthly",
                  "com.example.premium_yearly")
                </li>
              </ul>
            </li>
            <li>
              <code>purchaseTokenAndroid</code> — Android-specific purchase
              token required for subscription upgrade/downgrade operations
            </li>
            <li>
              <code>renewalInfoIOS</code> — iOS-specific subscription renewal
              information from StoreKit 2. Contains details about subscription
              renewal status, pending upgrades/downgrades, and auto-renewal
              preferences. See <a href="#renewal-info-ios">RenewalInfoIOS</a>{' '}
              for details.
            </li>
          </ul>
        </div>

        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#f0f9ff',
            borderLeft: '4px solid #3b82f6',
            borderRadius: '0.25rem',
          }}
        >
          <strong>💡 Tip:</strong> Use <code>renewalInfoIOS</code> to detect
          subscription upgrades/downgrades:
          <CodeBlock language="typescript">{`// Check for pending upgrades
if (subscription.renewalInfoIOS?.pendingUpgradeProductId) {
  console.log('Upgrade pending to:', subscription.renewalInfoIOS.pendingUpgradeProductId);
}

// Check if subscription is cancelled
if (subscription.renewalInfoIOS?.willAutoRenew === false) {
  console.log('Subscription will not auto-renew');
}`}</CodeBlock>
        </div>
      </section>

      <section>
        <AnchorLink id="product-request" level="h2">
          Product Request
        </AnchorLink>
        <p>Product request parameters for fetching products from the store.</p>

        <h3>ProductRequest</h3>
        <CodeBlock language="typescript">{`type ProductRequest = {
  skus: string[];
  type?: "in-app" | "subs" | "all";
};`}</CodeBlock>
        <div style={{ marginTop: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Field Reference</h4>
          <ul style={{ marginTop: '0.5rem' }}>
            <li>
              <code>skus</code> — Product identifiers to fetch
            </li>
            <li>
              <code>type</code> — Result filter: in-app (IAPs), subs
              (subscriptions), all (both)
            </li>
          </ul>
        </div>

        <h3>Usage Example</h3>
        <CodeBlock language="typescript">{`// Fetch in-app purchases (default)
const inappProducts = await fetchProducts({ skus: ["product1", "product2"] });

// Explicitly fetch in-app purchases
const inappProducts = await fetchProducts({
  skus: ["product1", "product2"],
  type: "in-app"
});

// Fetch only subscriptions
const subscriptions = await fetchProducts({
  skus: ["sub1", "sub2"],
  type: "subs"
});

// Fetch all products (both in-app and subscriptions)
const allProducts = await fetchProducts({
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
        <div style={{ marginTop: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Field Reference</h4>
          <ul>
            <li>
              <code>params</code> — Platform-specific purchase parameters
            </li>
            <li>
              <code>type</code> — Purchase type discriminator (
              <code>'in-app'</code> or <code>'subs'</code>)
            </li>
          </ul>
        </div>
        <p>
          Use the <code>'in-app'</code> variant when purchasing regular items
          and <code>'subs'</code> when purchasing subscriptions. This keeps the
          payloads aligned with their platform-specific structures.
        </p>

        <h4>Basic Usage Example</h4>
        <CodeBlock language="typescript">{`// Standard in-app purchase
await requestPurchase({
  params: {
    ios: { sku: 'premium' },
    android: { skus: ['premium'] }
  },
  type: 'in-app'
});

// Subscription purchase
await requestPurchase({
  params: {
    ios: { sku: 'monthly_sub' },
    android: { skus: ['monthly_sub'] }
  },
  type: 'subs'
});`}</CodeBlock>

        <AnchorLink id="ios-external-purchase-links" level="h4">
          iOS External Purchase Links
        </AnchorLink>
        <p>
          Starting from openiap-gql 1.0.10, iOS supports external purchase links
          via the <code>externalPurchaseUrlOnIOS</code> parameter.
        </p>
        <blockquote className="info-note">
          <p>
            <strong>Important:</strong> External purchase links redirect users
            to an external website. No StoreKit transaction is created, and{' '}
            <code>purchaseUpdatedListener</code> will not be triggered. You must
            implement your own flow to handle purchase completion (deep links,
            server verification, offer codes).
          </p>
        </blockquote>

        <h5>iOS External Purchase Example</h5>
        <CodeBlock language="typescript">{`// iOS external purchase link
await requestPurchase({
  params: {
    ios: {
      sku: 'premium',
      externalPurchaseUrlOnIOS: 'https://your-payment-site.com/checkout'
    }
  },
  type: 'in-app'
});`}</CodeBlock>

        <AnchorLink id="request-purchase-props-by-platforms" level="h3">
          RequestPurchasePropsByPlatforms
        </AnchorLink>
        <p>
          Platform-specific request structure for regular purchases. Allows
          clear separation of iOS and Android props.
        </p>
        <CodeBlock language="graphql">{`input RequestPurchasePropsByPlatforms {
  ios: RequestPurchaseIosProps
  android: RequestPurchaseAndroidProps
}`}</CodeBlock>
        <div style={{ marginTop: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Field Reference</h4>
          <ul style={{ marginTop: '0.5rem' }}>
            <li>
              <code>ios</code> — iOS in‑app purchase parameters
            </li>
            <li>
              <code>android</code> — Android in‑app purchase parameters
            </li>
          </ul>
        </div>

        <AnchorLink id="request-subscription-props-by-platforms" level="h3">
          RequestSubscriptionPropsByPlatforms
        </AnchorLink>
        <p>Platform-specific subscription request structure.</p>
        <CodeBlock language="graphql">{`input RequestSubscriptionPropsByPlatforms {
  ios: RequestSubscriptionIosProps
  android: RequestSubscriptionAndroidProps
}`}</CodeBlock>
        <div style={{ marginTop: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Field Reference</h4>
          <ul style={{ marginTop: '0.5rem' }}>
            <li>
              <code>ios</code> — iOS subscription parameters
            </li>
            <li>
              <code>android</code> — Android subscription parameters
            </li>
          </ul>
        </div>

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
  sku: String!
  andDangerouslyFinishTransactionAutomatically: Boolean
  appAccountToken: String
  quantity: Int
  withOffer: DiscountOffer
  externalPurchaseUrlOnIOS: String
}`}</CodeBlock>
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>sku</code> — Product identifier to purchase
                    </li>
                    <li>
                      <code>andDangerouslyFinishTransactionAutomatically</code>{' '}
                      — Auto‑finish transaction (advanced)
                    </li>
                    <li>
                      <code>appAccountToken</code> — App server account token
                    </li>
                    <li>
                      <code>quantity</code> — Quantity to purchase
                    </li>
                    <li>
                      <code>withOffer</code> — Promotional/discount offer to
                      apply
                    </li>
                    <li>
                      <code>externalPurchaseUrlOnIOS</code> — URL for external
                      purchase link (requires{' '}
                      <code>useAlternativeBilling: true</code>)
                    </li>
                  </ul>
                </div>
              </>
            ),
            android: (
              <>
                <h4>RequestPurchaseAndroidProps</h4>
                <p>Android-specific purchase request props.</p>
                <CodeBlock language="graphql">{`input RequestPurchaseAndroidProps {
  skus: [String!]!
  obfuscatedAccountIdAndroid: String
  obfuscatedProfileIdAndroid: String
  isOfferPersonalized: Boolean
}`}</CodeBlock>
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>skus</code> — Product identifiers to purchase
                    </li>
                    <li>
                      <code>obfuscatedAccountIdAndroid</code> — Obfuscated
                      account ID
                    </li>
                    <li>
                      <code>obfuscatedProfileIdAndroid</code> — Obfuscated
                      profile ID
                    </li>
                    <li>
                      <code>isOfferPersonalized</code> — Indicates a
                      personalized offer
                    </li>
                  </ul>
                </div>
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
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>RequestSubscriptionIosProps</code> — Alias of{' '}
                      <code>RequestPurchaseIosProps</code>
                    </li>
                  </ul>
                </div>
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
  skus: [String!]!
  obfuscatedAccountIdAndroid: String
  obfuscatedProfileIdAndroid: String
  isOfferPersonalized: Boolean
  purchaseTokenAndroid: String
  replacementModeAndroid: Int
  subscriptionOffers: [SubscriptionOffer!]
}

type SubscriptionOffer {
  sku: String!
  offerToken: String!
}`}</CodeBlock>
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>skus</code> — Subscription identifiers to purchase
                    </li>
                    <li>
                      <code>obfuscatedAccountIdAndroid</code> — Obfuscated
                      account ID
                    </li>
                    <li>
                      <code>obfuscatedProfileIdAndroid</code> — Obfuscated
                      profile ID
                    </li>
                    <li>
                      <code>isOfferPersonalized</code> — Indicates a
                      personalized offer
                    </li>
                    <li>
                      <code>purchaseTokenAndroid</code> — Existing purchase
                      token for change (upgrade/downgrade)
                    </li>
                    <li>
                      <code>replacementModeAndroid</code> — Replacement mode
                      strategy
                    </li>
                    <li>
                      <code>subscriptionOffers</code> — Offers to apply
                    </li>
                  </ul>
                  <h5 style={{ margin: '0.75rem 0 0.25rem' }}>
                    SubscriptionOffer
                  </h5>
                  <ul>
                    <li>
                      <code>sku</code> — Product identifier
                    </li>
                    <li>
                      <code>offerToken</code> — Play Billing offer token
                    </li>
                  </ul>
                </div>
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="alternative-billing-types" level="h2">
          Alternative Billing Types
        </AnchorLink>

        <AnchorLink id="alternative-billing-mode-android" level="h3">
          AlternativeBillingModeAndroid
        </AnchorLink>
        <p>
          Alternative billing mode for Android. Controls which billing system is
          used during <code>initConnection</code>.
        </p>
        <CodeBlock language="graphql">{`enum AlternativeBillingModeAndroid {
  """
  Standard Google Play billing (default)
  """
  NONE

  """
  User choice billing - user can select between Google Play or alternative
  Requires Google Play Billing Library 7.0+
  """
  USER_CHOICE

  """
  Alternative billing only - no Google Play billing option
  Requires Google Play Billing Library 6.2+
  """
  ALTERNATIVE_ONLY
}`}</CodeBlock>
        <div style={{ marginTop: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Values</h4>
          <ul style={{ marginTop: '0.5rem' }}>
            <li>
              <code>NONE</code> — Standard Google Play billing (default)
            </li>
            <li>
              <code>USER_CHOICE</code> — User can select between Google Play or
              alternative billing (requires Billing Library 7.0+)
            </li>
            <li>
              <code>ALTERNATIVE_ONLY</code> — Alternative billing only, no
              Google Play billing option (requires Billing Library 6.2+)
            </li>
          </ul>
        </div>

        <AnchorLink id="init-connection-config" level="h3">
          InitConnectionConfig
        </AnchorLink>
        <p>Configuration options for initializing the billing connection.</p>
        <CodeBlock language="typescript">{`interface InitConnectionConfig {
  alternativeBillingModeAndroid?: AlternativeBillingModeAndroid;
}`}</CodeBlock>
        <div style={{ marginTop: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Field Reference</h4>
          <ul style={{ marginTop: '0.5rem' }}>
            <li>
              <code>alternativeBillingModeAndroid</code> — (Android only)
              Alternative billing mode. Defaults to <code>NONE</code> if not
              specified.
            </li>
          </ul>
        </div>

        <h4>Usage Example</h4>
        <CodeBlock language="typescript">{`// Initialize with user choice billing
await initConnection({
  alternativeBillingModeAndroid: 'USER_CHOICE'
});

// Initialize with alternative billing only
await initConnection({
  alternativeBillingModeAndroid: 'ALTERNATIVE_ONLY'
});

// Standard billing (default)
await initConnection();`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="external-purchase-link" level="h2">
          External Purchase Link (iOS)
        </AnchorLink>
        <p>
          External purchase link support for iOS, available from openiap-gql
          1.0.10+. Redirects users to an external website for payment
          processing.
        </p>

        <blockquote className="info-note">
          <p>
            <strong>Important:</strong> When using external purchase links, no
            StoreKit transaction is created, and{' '}
            <code>purchaseUpdatedListener</code> will NOT be triggered. You must
            implement your own flow to handle purchase completion using deep
            links, server verification, or offer codes.
          </p>
        </blockquote>

        <AnchorLink id="external-purchase-url" level="h3">
          externalPurchaseUrlOnIOS
        </AnchorLink>
        <p>
          Optional parameter in <code>RequestPurchaseIosProps</code> that
          redirects users to an external payment website instead of using
          StoreKit.
        </p>

        <CodeBlock language="typescript">{`interface RequestPurchaseIosProps {
  sku: string;
  externalPurchaseUrlOnIOS?: string;  // External purchase link
  // ... other fields
}`}</CodeBlock>

        <div style={{ marginTop: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Field Reference</h4>
          <ul style={{ marginTop: '0.5rem' }}>
            <li>
              <code>externalPurchaseUrlOnIOS</code> — URL to redirect users for
              external payment. Requires{' '}
              <code>useAlternativeBilling: true</code> in requestPurchase
              options.
            </li>
          </ul>
        </div>

        <h4>Usage Example</h4>
        <CodeBlock language="typescript">{`// Redirect to external payment site
await requestPurchase({
  request: {
    ios: {
      sku: 'premium_product',
      externalPurchaseUrlOnIOS: 'https://your-payment-site.com/checkout',
      quantity: 1,
    },
  },
  type: 'in-app',
  useAlternativeBilling: true,  // Required for external links
});

// User will be redirected to Safari
// Implement deep linking to return users to your app`}</CodeBlock>

        <h4>Requirements</h4>
        <ul>
          <li>iOS 16.0+ required</li>
          <li>
            Must set <code>useAlternativeBilling: true</code>
          </li>
          <li>
            No <code>onPurchaseUpdated</code> callback will fire
          </li>
          <li>Implement deep linking for app return flow</li>
          <li>Handle purchase verification on your backend</li>
        </ul>
      </section>

      <section>
        <AnchorLink id="receipt-validation-types" level="h2">
          ReceiptValidation Types
        </AnchorLink>

        <AnchorLink id="receipt-validation-props" level="h3">
          ReceiptValidationProps
        </AnchorLink>
        <CodeBlock language="typescript">{`interface ReceiptValidationProps {
  sku: string;
  androidOptions?: {
    packageName: string;
    productToken: string;
    accessToken: string;
    isSub?: boolean;
  };
}`}</CodeBlock>
        <div style={{ marginTop: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Field Reference</h4>
          <ul style={{ marginTop: '0.5rem' }}>
            <li>
              <code>sku</code> — Product identifier to validate
            </li>
            <li>
              <code>androidOptions</code> — Android Play Developer API options
            </li>
          </ul>
          <h5 style={{ margin: '0.75rem 0 0.25rem' }}>androidOptions</h5>
          <ul>
            <li>
              <code>packageName</code> — Application package name
            </li>
            <li>
              <code>productToken</code> — Purchase token
            </li>
            <li>
              <code>accessToken</code> — OAuth access token
            </li>
            <li>
              <code>isSub</code> — Treat as subscription when true
            </li>
          </ul>
        </div>

        <AnchorLink id="receipt-validation-result" level="h3">
          ReceiptValidationResult
        </AnchorLink>
        <PlatformTabs>
          {{
            ios: (
              <>
                <h4>ReceiptValidationResultIOS</h4>
                <CodeBlock language="typescript">{`interface ReceiptValidationResultIOS {
  isValid: boolean;
  receiptData: string;
  jwsRepresentation: string;
  latestTransaction?: Purchase;
}`}</CodeBlock>
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>isValid</code> — Validation success flag
                    </li>
                    <li>
                      <code>receiptData</code> — Raw App Store receipt
                    </li>
                    <li>
                      <code>jwsRepresentation</code> — JWS-encoded receipt
                    </li>
                    <li>
                      <code>latestTransaction</code> — Most recent related
                      transaction
                    </li>
                  </ul>
                </div>
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
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>autoRenewing</code> — Auto‑renew state
                    </li>
                    <li>
                      <code>betaProduct</code> — Indicates a beta product
                    </li>
                    <li>
                      <code>cancelDate</code> — Cancellation timestamp
                    </li>
                    <li>
                      <code>cancelReason</code> — Cancellation reason
                    </li>
                    <li>
                      <code>deferredDate</code> — Deferred change date
                    </li>
                    <li>
                      <code>deferredSku</code> — Deferred SKU
                    </li>
                    <li>
                      <code>freeTrialEndDate</code> — Free trial end
                    </li>
                    <li>
                      <code>gracePeriodEndDate</code> — Grace period end
                    </li>
                    <li>
                      <code>parentProductId</code> — Parent product ID
                    </li>
                    <li>
                      <code>productId</code> — Product ID
                    </li>
                    <li>
                      <code>productType</code> — Product type
                    </li>
                    <li>
                      <code>purchaseDate</code> — Purchase timestamp
                    </li>
                    <li>
                      <code>quantity</code> — Quantity
                    </li>
                    <li>
                      <code>receiptId</code> — Receipt ID
                    </li>
                    <li>
                      <code>renewalDate</code> — Renewal timestamp
                    </li>
                    <li>
                      <code>term</code> — Subscription term
                    </li>
                    <li>
                      <code>termSku</code> — Term SKU
                    </li>
                    <li>
                      <code>testTransaction</code> — Test transaction flag
                    </li>
                  </ul>
                </div>
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
  identifier: String!
  keyIdentifier: String!
  nonce: String!
  signature: String!
  timestamp: Float!
}`}</CodeBlock>
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>identifier</code> — Discount identifier
                    </li>
                    <li>
                      <code>keyIdentifier</code> — Key ID used for validation
                    </li>
                    <li>
                      <code>nonce</code> — Cryptographic nonce
                    </li>
                    <li>
                      <code>signature</code> — Signature for validation
                    </li>
                    <li>
                      <code>timestamp</code> — Offer timestamp
                    </li>
                  </ul>
                </div>

                <h4>Discount</h4>
                <p>
                  Discount information returned from the store as part of
                  product details.
                </p>
                <CodeBlock language="graphql">{`type Discount {
  identifier: String!
  type: String!
  numberOfPeriods: Int!
  price: String!
  priceAmount: Float!
  paymentMode: String!
  subscriptionPeriod: String!
}`}</CodeBlock>
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>identifier</code> — Discount identifier
                    </li>
                    <li>
                      <code>type</code> — Discount type (introductory,
                      subscription, etc.)
                    </li>
                    <li>
                      <code>numberOfPeriods</code> — Billing periods covered
                    </li>
                    <li>
                      <code>price</code> — Formatted price
                    </li>
                    <li>
                      <code>priceAmount</code> — Numeric price amount
                    </li>
                    <li>
                      <code>paymentMode</code> — Payment mode label
                    </li>
                    <li>
                      <code>subscriptionPeriod</code> — Subscription period
                      label
                    </li>
                  </ul>
                </div>

                <h4>SubscriptionPeriodIOS</h4>
                <CodeBlock language="graphql">{`enum SubscriptionPeriodIOS {
  Day
  Week
  Month
  Year
  ""
}`}</CodeBlock>
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>Day</code> — Daily period
                    </li>
                    <li>
                      <code>Week</code> — Weekly period
                    </li>
                    <li>
                      <code>Month</code> — Monthly period
                    </li>
                    <li>
                      <code>Year</code> — Yearly period
                    </li>
                    <li>
                      <code>""</code> — Unspecified
                    </li>
                  </ul>
                </div>

                <h4>PaymentMode</h4>
                <CodeBlock language="graphql">{`enum PaymentMode {
  ""
  FreeTrial
  PayAsYouGo
  PayUpFront
}`}</CodeBlock>
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>""</code> — Unspecified
                    </li>
                    <li>
                      <code>FreeTrial</code> — Free trial
                    </li>
                    <li>
                      <code>PayAsYouGo</code> — Pay as you go
                    </li>
                    <li>
                      <code>PayUpFront</code> — Pay up front
                    </li>
                  </ul>
                </div>

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
  state: string;
  renewalInfo?: RenewalInfo;
};`}</CodeBlock>
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>state</code> — StoreKit renewal state
                    </li>
                    <li>
                      <code>renewalInfo</code> — Renewal details
                      <ul>
                        <li>
                          <code>jsonRepresentation</code> — Raw JSON
                        </li>
                        <li>
                          <code>willAutoRenew</code> — Auto-renew flag
                        </li>
                        <li>
                          <code>autoRenewPreference</code> — Auto-renew
                          preference
                        </li>
                      </ul>
                    </li>
                  </ul>
                </div>
              </>
            ),
            android: (
              <>
                <h3>Android Types</h3>

                <h4>SubscriptionOffer</h4>
                <p>Subscription offer details for Android purchases.</p>
                <CodeBlock language="graphql">{`type SubscriptionOffer {
  sku: String!
  offerToken: String!
}`}</CodeBlock>
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>sku</code> — Product identifier
                    </li>
                    <li>
                      <code>offerToken</code> — Play Billing offer token
                    </li>
                  </ul>
                </div>

                <h4>PricingPhase</h4>
                <p>Pricing phase information for Android subscriptions.</p>
                <CodeBlock language="graphql">{`type PricingPhase {
  billingPeriod: String!
  formattedPrice: String!
  priceAmountMicros: String!
  priceCurrencyCode: String!
  billingCycleCount: Int
  recurrenceMode: RecurrenceMode
}`}</CodeBlock>
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>billingPeriod</code> — ISO8601 period (e.g., P1W,
                      P1M, P1Y)
                    </li>
                    <li>
                      <code>formattedPrice</code> — Formatted price
                    </li>
                    <li>
                      <code>priceAmountMicros</code> — Price in micros
                    </li>
                    <li>
                      <code>priceCurrencyCode</code> — ISO 4217 currency
                    </li>
                    <li>
                      <code>billingCycleCount</code> — Number of cycles
                    </li>
                    <li>
                      <code>recurrenceMode</code> — Recurrence mode
                    </li>
                  </ul>
                </div>

                <h4>PricingPhasesAndroid</h4>
                <CodeBlock language="graphql">{`type PricingPhasesAndroid {
  pricingPhaseList: [PricingPhaseAndroid!]!
}`}</CodeBlock>
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>pricingPhaseList</code> — Pricing phases
                      <ul>
                        <li>See PricingPhaseAndroid for item fields</li>
                      </ul>
                    </li>
                  </ul>
                </div>

                <h4>PricingPhaseAndroid</h4>
                <CodeBlock language="graphql">{`type PricingPhaseAndroid {
  formattedPrice: String!
  priceCurrencyCode: String!
  billingPeriod: String!
  billingCycleCount: Int!
  priceAmountMicros: String!
  recurrenceMode: Int!
}`}</CodeBlock>
                <div style={{ marginTop: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Field Reference</h4>
                  <ul style={{ marginTop: '0.5rem' }}>
                    <li>
                      <code>formattedPrice</code> — Formatted price
                    </li>
                    <li>
                      <code>priceCurrencyCode</code> — ISO 4217 currency
                    </li>
                    <li>
                      <code>billingPeriod</code> — ISO8601 period (e.g., P1W,
                      P1M, P1Y)
                    </li>
                    <li>
                      <code>billingCycleCount</code> — Number of cycles
                    </li>
                    <li>
                      <code>priceAmountMicros</code> — Price in micros
                    </li>
                    <li>
                      <code>recurrenceMode</code> — Recurrence mode
                    </li>
                  </ul>
                </div>
              </>
            ),
          }}
        </PlatformTabs>
      </section>
    </div>
  );
}

export default Types;
