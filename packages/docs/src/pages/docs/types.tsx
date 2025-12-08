import { useState, type ChangeEvent } from 'react';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import LanguageTabs from '../../components/LanguageTabs';
import PlatformTabs from '../../components/PlatformTabs';
import SEO from '../../components/SEO';
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
      <SEO
        title="Types"
        description="OpenIAP type definitions - Product, Purchase, PurchaseError, SubscriptionPeriod, purchase verification types, and more for TypeScript, Swift, Kotlin."
        path="/docs/types"
        keywords="IAP types, Product, Purchase, PurchaseError, TypeScript, Swift, Kotlin, purchase verification"
      />
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
                <code>platform</code>
              </td>
              <td>
                Platform discriminator: <code>"ios"</code> or{' '}
                <code>"android"</code>
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
                        For one-time purchases. Contains:{' '}
                        <code>formattedPrice</code>,{' '}
                        <code>priceAmountMicros</code> (divide by 1,000,000),{' '}
                        <code>priceCurrencyCode</code>
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
          <code>platform</code> discriminator for type-safe handling across iOS
          and Android.
        </p>

        <AnchorLink id="platform-discriminators" level="h3">
          Platform Discriminators
        </AnchorLink>
        <p>
          Each unified type includes a <code>platform</code> field that
          identifies the source platform:
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
                <code>IosPlatform</code>
              </td>
              <td>
                Contains <code>platform: 'ios'</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>AndroidPlatform</code>
              </td>
              <td>
                Contains <code>platform: 'android'</code>
              </td>
            </tr>
          </tbody>
        </table>

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

      <section>
        <AnchorLink id="purchase" level="h2">
          Purchase
        </AnchorLink>
        <p>
          Represents a completed or pending purchase transaction. The type is a
          union of <code>PurchaseIOS</code> and <code>PurchaseAndroid</code>,
          discriminated by the <code>platform</code> field.
        </p>

        <AnchorLink id="purchase-state" level="h3">
          PurchaseState
        </AnchorLink>
        <p>Enum representing the current state of a purchase:</p>
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
                <code>Pending</code>
              </td>
              <td>Purchase initiated, awaiting completion</td>
            </tr>
            <tr>
              <td>
                <code>Purchased</code>
              </td>
              <td>Payment successful, needs validation</td>
            </tr>
            <tr>
              <td>
                <code>Failed</code>
              </td>
              <td>Purchase failed or was cancelled</td>
            </tr>
            <tr>
              <td>
                <code>Restored</code>
              </td>
              <td>Previous purchase restored</td>
            </tr>
            <tr>
              <td>
                <code>Deferred</code>
              </td>
              <td>Awaiting approval (e.g., parental consent)</td>
            </tr>
            <tr>
              <td>
                <code>Unknown</code>
              </td>
              <td>State could not be determined</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="purchase-common" level="h3">
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
                Purchase identifier (primary key). Maps to orderId on Android,
                transactionId on iOS
              </td>
            </tr>
            <tr>
              <td>
                <code>productId</code>
              </td>
              <td>Product identifier that was purchased</td>
            </tr>
            <tr>
              <td>
                <code>ids</code>
              </td>
              <td>Array of SKUs for bundled purchases (optional)</td>
            </tr>
            <tr>
              <td>
                <code>transactionDate</code>
              </td>
              <td>Transaction timestamp (epoch ms)</td>
            </tr>
            <tr>
              <td>
                <code>purchaseToken</code>
              </td>
              <td>
                JWS token (iOS) or Play purchase token (Android) for server
                validation
              </td>
            </tr>
            <tr>
              <td>
                <code>platform</code>
              </td>
              <td>
                Platform discriminator: <code>"ios"</code> or{' '}
                <code>"android"</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>quantity</code>
              </td>
              <td>Number of items purchased</td>
            </tr>
            <tr>
              <td>
                <code>purchaseState</code>
              </td>
              <td>Current purchase state (see PurchaseState above)</td>
            </tr>
            <tr>
              <td>
                <code>isAutoRenewing</code>
              </td>
              <td>Whether subscription will auto-renew</td>
            </tr>
            <tr>
              <td>
                <code>currentPlanId</code>
              </td>
              <td>
                Unified plan identifier. On Android: basePlanId (e.g.,
                "premium"). On iOS: productId (e.g.,
                "com.example.premium_monthly"). <strong>⚠️ Android:</strong> May
                be inaccurate for multi-plan subscriptions. See{' '}
                <a href="/docs/apis#android-baseplanid-limitation">
                  limitation
                </a>
                .
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          The shared <code>id</code> field maps to Google Play&apos;s{' '}
          <code>orderId</code>. When Play omits it—common for consumables—the
          SDK falls back to the long <code>purchaseToken</code> so you retain a
          stable primary key.
        </p>

        <AnchorLink id="purchase-platform" level="h3">
          Platform-Specific Fields
        </AnchorLink>
        <PlatformTabs>
          {{
            ios: (
              <>
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
                        <code>quantityIOS</code>
                      </td>
                      <td>Purchase quantity (iOS-specific)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>originalTransactionDateIOS</code>
                      </td>
                      <td>
                        Original purchase timestamp (for renewals/restores)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>originalTransactionIdentifierIOS</code>
                      </td>
                      <td>Original transaction ID (links renewal chain)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>appAccountToken</code>
                      </td>
                      <td>
                        Your server's user identifier (UUID you provided at
                        purchase)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>expirationDateIOS</code>
                      </td>
                      <td>Subscription expiration timestamp</td>
                    </tr>
                    <tr>
                      <td>
                        <code>webOrderLineItemIdIOS</code>
                      </td>
                      <td>Web order line item ID</td>
                    </tr>
                    <tr>
                      <td>
                        <code>environmentIOS</code>
                      </td>
                      <td>Environment: "Sandbox" or "Production"</td>
                    </tr>
                    <tr>
                      <td>
                        <code>storefrontCountryCodeIOS</code>
                      </td>
                      <td>Storefront country code</td>
                    </tr>
                    <tr>
                      <td>
                        <code>appBundleIdIOS</code>
                      </td>
                      <td>App bundle identifier</td>
                    </tr>
                    <tr>
                      <td>
                        <code>subscriptionGroupIdIOS</code>
                      </td>
                      <td>Subscription group identifier</td>
                    </tr>
                    <tr>
                      <td>
                        <code>isUpgradedIOS</code>
                      </td>
                      <td>True if this transaction was upgraded</td>
                    </tr>
                    <tr>
                      <td>
                        <code>ownershipTypeIOS</code>
                      </td>
                      <td>Ownership type (purchased, family shared)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>transactionReasonIOS</code>
                      </td>
                      <td>Reason: "PURCHASE" or "RENEWAL"</td>
                    </tr>
                    <tr>
                      <td>
                        <code>revocationDateIOS</code>
                      </td>
                      <td>Revocation timestamp (if refunded)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>revocationReasonIOS</code>
                      </td>
                      <td>Revocation reason</td>
                    </tr>
                    <tr>
                      <td>
                        <code>offerIOS</code>
                      </td>
                      <td>
                        Applied offer details. Contains: <code>id</code>,{' '}
                        <code>type</code>, <code>paymentMode</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>currencyCodeIOS</code>
                      </td>
                      <td>ISO 4217 currency code</td>
                    </tr>
                    <tr>
                      <td>
                        <code>currencySymbolIOS</code>
                      </td>
                      <td>Currency symbol</td>
                    </tr>
                    <tr>
                      <td>
                        <code>countryCodeIOS</code>
                      </td>
                      <td>Country code</td>
                    </tr>
                    <tr>
                      <td>
                        <code>renewalInfoIOS</code>
                      </td>
                      <td>
                        Subscription renewal information (see RenewalInfoIOS
                        below)
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ marginTop: '1rem' }}>
                  <AnchorLink id="renewal-info-ios" level="h4">
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
                  </AnchorLink>
                  <table className="doc-table" style={{ marginTop: '0.5rem' }}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Summary</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <code>willAutoRenew</code>
                        </td>
                        <td>Whether subscription will automatically renew</td>
                      </tr>
                      <tr>
                        <td>
                          <code>autoRenewPreference</code>
                        </td>
                        <td>
                          Product ID the subscription will renew to (may differ
                          if upgrade/downgrade pending)
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <code>expirationReason</code>
                        </td>
                        <td>
                          Why subscription expired: "VOLUNTARY",
                          "BILLING_ERROR", "DID_NOT_AGREE_TO_PRICE_INCREASE",
                          "PRODUCT_NOT_AVAILABLE", "UNKNOWN"
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <code>gracePeriodExpirationDate</code>
                        </td>
                        <td>Grace period end timestamp (epoch ms)</td>
                      </tr>
                      <tr>
                        <td>
                          <code>isInBillingRetry</code>
                        </td>
                        <td>True if retrying after billing failure</td>
                      </tr>
                      <tr>
                        <td>
                          <code>pendingUpgradeProductId</code>
                        </td>
                        <td>Product ID for pending upgrade/downgrade</td>
                      </tr>
                      <tr>
                        <td>
                          <code>priceIncreaseStatus</code>
                        </td>
                        <td>
                          Price increase response: "AGREED", "PENDING", or null
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <code>renewalDate</code>
                        </td>
                        <td>Expected renewal timestamp (epoch ms)</td>
                      </tr>
                      <tr>
                        <td>
                          <code>renewalOfferId</code>
                        </td>
                        <td>Offer ID for next renewal</td>
                      </tr>
                      <tr>
                        <td>
                          <code>renewalOfferType</code>
                        </td>
                        <td>
                          Offer type: "PROMOTIONAL", "SUBSCRIPTION_OFFER_CODE",
                          "WIN_BACK"
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            ),
            android: (
              <>
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
                        <code>dataAndroid</code>
                      </td>
                      <td>Raw JSON purchase data for server validation</td>
                    </tr>
                    <tr>
                      <td>
                        <code>transactionId</code>
                      </td>
                      <td>Transaction ID (orderId)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>signatureAndroid</code>
                      </td>
                      <td>INAPP_DATA_SIGNATURE for verification</td>
                    </tr>
                    <tr>
                      <td>
                        <code>autoRenewingAndroid</code>
                      </td>
                      <td>Whether subscription will auto-renew</td>
                    </tr>
                    <tr>
                      <td>
                        <code>isAcknowledgedAndroid</code>
                      </td>
                      <td>
                        Whether purchase has been acknowledged (must be done
                        within 3 days)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>packageNameAndroid</code>
                      </td>
                      <td>Application package name</td>
                    </tr>
                    <tr>
                      <td>
                        <code>developerPayloadAndroid</code>
                      </td>
                      <td>Developer-specified payload string</td>
                    </tr>
                    <tr>
                      <td>
                        <code>obfuscatedAccountIdAndroid</code>
                      </td>
                      <td>Obfuscated account ID you provided</td>
                    </tr>
                    <tr>
                      <td>
                        <code>obfuscatedProfileIdAndroid</code>
                      </td>
                      <td>Obfuscated profile ID you provided</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="active-subscription" level="h2">
          ActiveSubscription
        </AnchorLink>
        <p>
          Represents an active subscription returned by{' '}
          <code>getActiveSubscriptions()</code>. Provides a unified view of
          subscription status across platforms.
        </p>

        <AnchorLink id="active-subscription-common" level="h3">
          Common Fields
        </AnchorLink>
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
                <code>productId</code>
              </td>
              <td>Subscription product identifier</td>
            </tr>
            <tr>
              <td>
                <code>isActive</code>
              </td>
              <td>Whether the subscription is currently active</td>
            </tr>
            <tr>
              <td>
                <code>willExpireSoon</code>{' '}
                <span className="deprecated">deprecated</span>
              </td>
              <td>
                iOS only - returns null on Android. Use{' '}
                <code>daysUntilExpirationIOS</code> for more precise control.
              </td>
            </tr>
            <tr>
              <td>
                <code>transactionId</code>
              </td>
              <td>Transaction identifier for backend validation</td>
            </tr>
            <tr>
              <td>
                <code>purchaseToken</code>
              </td>
              <td>
                JWS token (iOS) or purchase token (Android) for server
                validation
              </td>
            </tr>
            <tr>
              <td>
                <code>transactionDate</code>
              </td>
              <td>Transaction timestamp (epoch ms)</td>
            </tr>
            <tr>
              <td>
                <code>currentPlanId</code>
              </td>
              <td>
                Unified plan identifier. On Android: basePlanId (e.g.,
                "premium"). On iOS: productId (e.g.,
                "com.example.premium_monthly"). <strong>⚠️ Android:</strong> May
                be inaccurate for multi-plan subscriptions. See{' '}
                <a href="/docs/apis#android-baseplanid-limitation">
                  limitation
                </a>
                .
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="active-subscription-platform" level="h3">
          Platform-Specific Fields
        </AnchorLink>
        <PlatformTabs>
          {{
            ios: (
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
                      <code>expirationDateIOS</code>
                    </td>
                    <td>Expiration timestamp (epoch ms)</td>
                  </tr>
                  <tr>
                    <td>
                      <code>environmentIOS</code>
                    </td>
                    <td>Environment: "Sandbox" or "Production"</td>
                  </tr>
                  <tr>
                    <td>
                      <code>daysUntilExpirationIOS</code>
                    </td>
                    <td>Days until expiration</td>
                  </tr>
                  <tr>
                    <td>
                      <code>renewalInfoIOS</code>
                    </td>
                    <td>
                      Subscription renewal details (see{' '}
                      <a href="#renewal-info-ios">RenewalInfoIOS</a>)
                    </td>
                  </tr>
                </tbody>
              </table>
            ),
            android: (
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
                      <code>autoRenewingAndroid</code>
                    </td>
                    <td>Whether subscription will auto-renew</td>
                  </tr>
                  <tr>
                    <td>
                      <code>basePlanIdAndroid</code>
                    </td>
                    <td>
                      Base plan identifier. <strong>⚠️</strong> May be
                      inaccurate for multi-plan subscriptions. See{' '}
                      <a href="/docs/apis#android-baseplanid-limitation">
                        limitation
                      </a>
                      .
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <code>purchaseTokenAndroid</code>
                    </td>
                    <td>Purchase token for upgrade/downgrade operations</td>
                  </tr>
                </tbody>
              </table>
            ),
          }}
        </PlatformTabs>

        <AnchorLink id="active-subscription-example" level="h3">
          Usage Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Check for pending upgrades
if (subscription.renewalInfoIOS?.pendingUpgradeProductId) {
  console.log('Upgrade pending to:', subscription.renewalInfoIOS.pendingUpgradeProductId);
}

// Check if subscription is cancelled
if (subscription.renewalInfoIOS?.willAutoRenew === false) {
  console.log('Subscription will not auto-renew');
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Check for pending upgrades
if let pendingProductId = subscription.renewalInfoIOS?.pendingUpgradeProductId {
    print("Upgrade pending to: \\(pendingProductId)")
}

// Check if subscription is cancelled
if subscription.renewalInfoIOS?.willAutoRenew == false {
    print("Subscription will not auto-renew")
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Check for pending upgrades
subscription.renewalInfoIOS?.pendingUpgradeProductId?.let { pendingProductId ->
    println("Upgrade pending to: $pendingProductId")
}

// Check if subscription is cancelled
if (subscription.renewalInfoIOS?.willAutoRenew == false) {
    println("Subscription will not auto-renew")
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Check for pending upgrades
if (subscription.renewalInfoIOS?.pendingUpgradeProductId != null) {
  print('Upgrade pending to: \${subscription.renewalInfoIOS!.pendingUpgradeProductId}');
}

// Check if subscription is cancelled
if (subscription.renewalInfoIOS?.willAutoRenew == false) {
  print('Subscription will not auto-renew');
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="product-request" level="h2">
          ProductRequest
        </AnchorLink>
        <p>
          Parameters for fetching products from the store via{' '}
          <code>fetchProducts()</code>.
        </p>

        <AnchorLink id="product-request-fields" level="h3">
          Fields
        </AnchorLink>
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
                <code>skus</code>
              </td>
              <td>Array of product identifiers to fetch</td>
            </tr>
            <tr>
              <td>
                <code>type</code>
              </td>
              <td>
                Product type filter (optional): <code>"in-app"</code> (default),{' '}
                <code>"subs"</code>, or <code>"all"</code>
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="product-request-example" level="h3">
          Usage Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Fetch in-app purchases (default)
const inappProducts = await fetchProducts({ skus: ["product1", "product2"] });

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
            ),
            swift: (
              <CodeBlock language="swift">{`// Fetch in-app purchases (default)
let inappProducts = try await OpenIapModule.shared.fetchProducts(
    ProductRequest(skus: ["product1", "product2"])
)

// Fetch only subscriptions
let subscriptions = try await OpenIapModule.shared.fetchProducts(
    ProductRequest(skus: ["sub1", "sub2"], type: .subs)
)

// Fetch all products (both in-app and subscriptions)
let allProducts = try await OpenIapModule.shared.fetchProducts(
    ProductRequest(skus: ["product1", "sub1"], type: .all)
)`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Fetch in-app purchases (default)
val inappProducts = openIapStore.fetchProducts(
    ProductRequest(skus = listOf("product1", "product2"))
)

// Fetch only subscriptions
val subscriptions = openIapStore.fetchProducts(
    ProductRequest(skus = listOf("sub1", "sub2"), type = ProductQueryType.Subs)
)

// Fetch all products (both in-app and subscriptions)
val allProducts = openIapStore.fetchProducts(
    ProductRequest(skus = listOf("product1", "sub1"), type = ProductQueryType.All)
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Fetch in-app purchases (default)
final inappProducts = await FlutterInappPurchase.instance.fetchProducts(
  skus: ['product1', 'product2'],
);

// Fetch only subscriptions
final subscriptions = await FlutterInappPurchase.instance.fetchProducts(
  skus: ['sub1', 'sub2'],
  type: ProductQueryType.subs,
);

// Fetch all products (both in-app and subscriptions)
final allProducts = await FlutterInappPurchase.instance.fetchProducts(
  skus: ['product1', 'sub1'],
  type: ProductQueryType.all,
);`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="request-types" level="h2">
          Request Types
        </AnchorLink>
        <p>
          Types used when initiating purchases via{' '}
          <code>requestPurchase()</code>.
        </p>

        <AnchorLink id="request-purchase-props" level="h3">
          RequestPurchaseProps
        </AnchorLink>
        <p>
          Top-level arguments for <code>requestPurchase()</code>. Wraps
          platform-specific props with a type discriminator.
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
                <code>params</code>
              </td>
              <td>Platform-specific purchase parameters (see below)</td>
            </tr>
            <tr>
              <td>
                <code>type</code>
              </td>
              <td>
                Purchase type: <code>"in-app"</code> or <code>"subs"</code>
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="request-purchase-example" level="h4">
          Usage Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
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
            ),
            swift: (
              <CodeBlock language="swift">{`// Standard in-app purchase
try await OpenIapModule.shared.requestPurchase(
    RequestPurchaseProps(
        request: RequestPurchasePropsByPlatforms(
            ios: RequestPurchaseIosProps(sku: "premium")
        ),
        type: .inApp
    )
)

// Subscription purchase
try await OpenIapModule.shared.requestPurchase(
    RequestPurchaseProps(
        request: RequestPurchasePropsByPlatforms(
            ios: RequestPurchaseIosProps(sku: "monthly_sub")
        ),
        type: .subs
    )
)`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Standard in-app purchase
openIapStore.requestPurchase(
    RequestPurchaseProps(
        request = RequestPurchasePropsByPlatforms(
            android = RequestPurchaseAndroidProps(skus = listOf("premium"))
        ),
        type = ProductType.InApp
    )
)

// Subscription purchase
openIapStore.requestPurchase(
    RequestPurchaseProps(
        request = RequestPurchasePropsByPlatforms(
            android = RequestPurchaseAndroidProps(skus = listOf("monthly_sub"))
        ),
        type = ProductType.Subs
    )
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Standard in-app purchase
await FlutterInappPurchase.instance.requestPurchase(
  RequestPurchaseProps(
    request: RequestPurchasePropsByPlatforms(
      ios: RequestPurchaseIosProps(sku: 'premium'),
      android: RequestPurchaseAndroidProps(skus: ['premium']),
    ),
    type: ProductType.inApp,
  ),
);

// Subscription purchase
await FlutterInappPurchase.instance.requestPurchase(
  RequestPurchaseProps(
    request: RequestPurchasePropsByPlatforms(
      ios: RequestPurchaseIosProps(sku: 'monthly_sub'),
      android: RequestPurchaseAndroidProps(skus: ['monthly_sub']),
    ),
    type: ProductType.subs,
  ),
);`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="request-purchase-props-by-platforms" level="h3">
          RequestPurchasePropsByPlatforms
        </AnchorLink>
        <p>
          Platform-specific request structure for regular purchases (in-app).
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
                <code>ios</code>
              </td>
              <td>iOS purchase parameters (RequestPurchaseIosProps)</td>
            </tr>
            <tr>
              <td>
                <code>android</code>
              </td>
              <td>Android purchase parameters (RequestPurchaseAndroidProps)</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="request-subscription-props-by-platforms" level="h3">
          RequestSubscriptionPropsByPlatforms
        </AnchorLink>
        <p>Platform-specific request structure for subscriptions.</p>
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
                <code>ios</code>
              </td>
              <td>iOS subscription parameters (RequestSubscriptionIosProps)</td>
            </tr>
            <tr>
              <td>
                <code>android</code>
              </td>
              <td>
                Android subscription parameters
                (RequestSubscriptionAndroidProps)
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="platform-specific-request-props" level="h3">
          Platform-Specific Request Props
        </AnchorLink>
        <PlatformTabs>
          {{
            ios: (
              <>
                <h4>RequestPurchaseIosProps</h4>
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
                        <code>sku</code>
                      </td>
                      <td>Product identifier to purchase (required)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>
                          andDangerouslyFinishTransactionAutomatically
                        </code>
                      </td>
                      <td>
                        Auto-finish transaction without validation (use with
                        caution)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>appAccountToken</code>
                      </td>
                      <td>UUID linking purchase to your server's user</td>
                    </tr>
                    <tr>
                      <td>
                        <code>quantity</code>
                      </td>
                      <td>Number of items to purchase</td>
                    </tr>
                    <tr>
                      <td>
                        <code>withOffer</code>
                      </td>
                      <td>
                        Promotional/discount offer to apply (see DiscountOffer)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>externalPurchaseUrlOnIOS</code>
                      </td>
                      <td>
                        External payment URL (requires alternative billing)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
            android: (
              <>
                <h4>RequestPurchaseAndroidProps</h4>
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
                        <code>skus</code>
                      </td>
                      <td>Array of product identifiers (required)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>obfuscatedAccountIdAndroid</code>
                      </td>
                      <td>Obfuscated user account ID</td>
                    </tr>
                    <tr>
                      <td>
                        <code>obfuscatedProfileIdAndroid</code>
                      </td>
                      <td>Obfuscated user profile ID</td>
                    </tr>
                    <tr>
                      <td>
                        <code>isOfferPersonalized</code>
                      </td>
                      <td>True if offer is personalized (EU compliance)</td>
                    </tr>
                  </tbody>
                </table>
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
                  iOS subscriptions use the same props as regular purchases
                  (RequestPurchaseIosProps).
                </p>
              </>
            ),
            android: (
              <>
                <h4>RequestSubscriptionAndroidProps</h4>
                <p>
                  Extends RequestPurchaseAndroidProps with subscription-specific
                  fields:
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
                        <code>purchaseTokenAndroid</code>
                      </td>
                      <td>Existing subscription token for upgrade/downgrade</td>
                    </tr>
                    <tr>
                      <td>
                        <code>replacementModeAndroid</code>
                      </td>
                      <td>
                        How to handle subscription change (proration mode)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>subscriptionOffers</code>
                      </td>
                      <td>
                        Array of offers to apply. Each contains:{' '}
                        <code>sku</code>, <code>offerToken</code>
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
        <AnchorLink id="alternative-billing-types" level="h2">
          Alternative Billing Types
        </AnchorLink>
        <p>
          Types for configuring alternative billing systems, primarily used for
          Android.
        </p>

        <AnchorLink id="alternative-billing-mode-android" level="h3">
          AlternativeBillingModeAndroid
        </AnchorLink>
        <p>
          Enum controlling which billing system is used during{' '}
          <code>initConnection()</code>:
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
                <code>NONE</code>
              </td>
              <td>Standard Google Play billing (default)</td>
            </tr>
            <tr>
              <td>
                <code>USER_CHOICE</code>
              </td>
              <td>
                User can select between Google Play or alternative billing
                (requires Billing Library 7.0+)
              </td>
            </tr>
            <tr>
              <td>
                <code>ALTERNATIVE_ONLY</code>
              </td>
              <td>
                Alternative billing only, no Google Play option (requires
                Billing Library 6.2+)
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="init-connection-config" level="h3">
          InitConnectionConfig
        </AnchorLink>
        <p>
          Configuration options for <code>initConnection()</code>:
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
                <code>alternativeBillingModeAndroid</code>
              </td>
              <td>
                (Android only) Which billing mode to use. Defaults to{' '}
                <code>NONE</code>.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="init-connection-example" level="h4">
          Usage Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Initialize with user choice billing
await initConnection({
  alternativeBillingModeAndroid: 'user-choice'
});

// Initialize with alternative billing only
await initConnection({
  alternativeBillingModeAndroid: 'alternative-only'
});

// Standard billing (default)
await initConnection();`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// iOS uses standard StoreKit billing
// Alternative billing is Android-only
try await OpenIapModule.shared.initConnection()

// Check connection status
let isConnected = try await OpenIapModule.shared.initConnection()`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Initialize with user choice billing
openIapStore.initConnection(
    InitConnectionConfig(
        alternativeBillingModeAndroid = AlternativeBillingModeAndroid.UserChoice
    )
)

// Initialize with alternative billing only
openIapStore.initConnection(
    InitConnectionConfig(
        alternativeBillingModeAndroid = AlternativeBillingModeAndroid.AlternativeOnly
    )
)

// Standard billing (default)
openIapStore.initConnection()`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Initialize with user choice billing
await FlutterInappPurchase.instance.initConnection(
  alternativeBillingModeAndroid: AlternativeBillingModeAndroid.UserChoice,
);

// Initialize with alternative billing only
await FlutterInappPurchase.instance.initConnection(
  alternativeBillingModeAndroid: AlternativeBillingModeAndroid.AlternativeOnly,
);

// Standard billing (default)
await FlutterInappPurchase.instance.initConnection();`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="external-purchase-link" level="h2">
          External Purchase Link (iOS)
        </AnchorLink>
        <p>
          iOS-specific feature for redirecting users to an external website for
          payment using Apple&apos;s StoreKit <code>ExternalPurchase</code> API.
          Available from iOS 15.4+ (notice sheet) and iOS 18.2+ (custom links).
        </p>

        <blockquote className="info-note">
          <p>
            <strong>Important:</strong> External purchase links bypass StoreKit
            completely. No <code>purchaseUpdatedListener</code> will fire. You
            must implement deep links and server-side verification.
          </p>
        </blockquote>

        <AnchorLink id="external-purchase-apis" level="h3">
          External Purchase APIs
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>API</th>
              <th>Description</th>
              <th>Availability</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>canPresentExternalPurchaseNoticeIOS</code>
              </td>
              <td>Check if external purchase notice sheet can be presented</td>
              <td>iOS 17.4+</td>
            </tr>
            <tr>
              <td>
                <code>presentExternalPurchaseNoticeSheetIOS</code>
              </td>
              <td>
                Present Apple&apos;s compliance notice sheet (required before
                external purchase)
              </td>
              <td>iOS 15.4+</td>
            </tr>
            <tr>
              <td>
                <code>presentExternalPurchaseLinkIOS</code>
              </td>
              <td>Open external purchase URL in Safari</td>
              <td>iOS 18.2+</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="external-purchase-types" level="h3">
          Types
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Result from presenting external purchase link
interface ExternalPurchaseLinkResultIOS {
  error?: string;
  success: boolean;
}

// Result from presenting notice sheet
interface ExternalPurchaseNoticeResultIOS {
  error?: string;
  result: ExternalPurchaseNoticeAction;
}

// User action on notice sheet
type ExternalPurchaseNoticeAction = 'continue' | 'dismissed';`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Result from presenting external purchase link
struct ExternalPurchaseLinkResultIOS {
    let error: String?
    let success: Bool
}

// Result from presenting notice sheet
struct ExternalPurchaseNoticeResultIOS {
    let error: String?
    let result: ExternalPurchaseNoticeAction
}

// User action on notice sheet
enum ExternalPurchaseNoticeAction: String {
    case \`continue\` = "continue"
    case dismissed = "dismissed"
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Result from presenting external purchase link (iOS-only via KMP)
data class ExternalPurchaseLinkResultIOS(
    val error: String? = null,
    val success: Boolean
)

// Result from presenting notice sheet
data class ExternalPurchaseNoticeResultIOS(
    val error: String? = null,
    val result: ExternalPurchaseNoticeAction
)

// User action on notice sheet
enum class ExternalPurchaseNoticeAction(val rawValue: String) {
    Continue("continue"),
    Dismissed("dismissed")
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Result from presenting external purchase link
class ExternalPurchaseLinkResultIOS {
  final String? error;
  final bool success;
}

// Result from presenting notice sheet
class ExternalPurchaseNoticeResultIOS {
  final String? error;
  final ExternalPurchaseNoticeAction result;
}

// User action on notice sheet
enum ExternalPurchaseNoticeAction {
  \`continue\`('continue'),
  dismissed('dismissed');
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="external-purchase-flow" level="h3">
          External Purchase Flow
        </AnchorLink>
        <p>The external purchase flow requires 3 steps for Apple compliance:</p>
        <ol>
          <li>
            <strong>Check availability</strong> - Verify the device supports
            external purchase
          </li>
          <li>
            <strong>Present notice sheet</strong> - Show Apple&apos;s required
            disclosure
          </li>
          <li>
            <strong>Open external link</strong> - Redirect to your payment page
          </li>
        </ol>

        <AnchorLink id="external-purchase-example" level="h3">
          Complete Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import {
  canPresentExternalPurchaseNoticeIOS,
  presentExternalPurchaseNoticeSheetIOS,
  presentExternalPurchaseLinkIOS,
} from 'expo-iap';

async function handleExternalPurchase(externalUrl: string) {
  // Step 1: Check if external purchase is available
  const canPresent = await canPresentExternalPurchaseNoticeIOS();
  if (!canPresent) {
    console.log('External purchase not available on this device');
    return;
  }

  // Step 2: Present Apple's compliance notice sheet
  const noticeResult = await presentExternalPurchaseNoticeSheetIOS();
  if (noticeResult.result === 'dismissed') {
    console.log('User dismissed the notice sheet');
    return;
  }

  // Step 3: Open external purchase link
  const linkResult = await presentExternalPurchaseLinkIOS(externalUrl);
  if (linkResult.success) {
    console.log('User redirected to external payment');
    // Implement deep linking to handle return from payment
  } else {
    console.error('Failed:', linkResult.error);
  }
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

@available(iOS 18.2, *)
func handleExternalPurchase(externalUrl: String) async {
    do {
        // Step 1: Check if external purchase is available
        let canPresent = try await OpenIapModule.shared.canPresentExternalPurchaseNoticeIOS()
        guard canPresent else {
            print("External purchase not available on this device")
            return
        }

        // Step 2: Present Apple's compliance notice sheet
        let noticeResult = try await OpenIapModule.shared.presentExternalPurchaseNoticeSheetIOS()
        guard noticeResult.result == .continue else {
            print("User dismissed the notice sheet")
            return
        }

        // Step 3: Open external purchase link
        let linkResult = try await OpenIapModule.shared.presentExternalPurchaseLinkIOS(externalUrl)
        if linkResult.success {
            print("User redirected to external payment")
            // Implement deep linking to handle return from payment
        } else if let error = linkResult.error {
            print("Failed: \\(error)")
        }
    } catch {
        print("External purchase error: \\(error)")
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.kmpIapInstance
import io.github.hyochan.kmpiap.ExternalPurchaseNoticeAction

// External purchase is iOS-only. For iOS targets in KMP:
suspend fun handleExternalPurchase(externalUrl: String) {
    // Step 1: Check if external purchase is available
    val canPresent = kmpIapInstance.canPresentExternalPurchaseNoticeIOS()
    if (!canPresent) {
        println("External purchase not available on this device")
        return
    }

    // Step 2: Present Apple's compliance notice sheet
    val noticeResult = kmpIapInstance.presentExternalPurchaseNoticeSheetIOS()
    if (noticeResult.result == ExternalPurchaseNoticeAction.Dismissed) {
        println("User dismissed the notice sheet")
        return
    }

    // Step 3: Open external purchase link
    val linkResult = kmpIapInstance.presentExternalPurchaseLinkIOS(externalUrl)
    if (linkResult.success) {
        println("User redirected to external payment")
        // Implement deep linking to handle return from payment
    } else {
        println("Failed: \${linkResult.error}")
    }
}

// For Android: Use alternative billing APIs instead
// See: checkAlternativeBillingAvailability, showAlternativeBillingDialog`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

Future<void> handleExternalPurchase(String externalUrl) async {
  final iap = FlutterInappPurchase.instance;

  // Step 1: Check if external purchase is available
  final canPresent = await iap.canPresentExternalPurchaseNoticeIOS();
  if (!canPresent) {
    print('External purchase not available on this device');
    return;
  }

  // Step 2: Present Apple's compliance notice sheet
  final noticeResult = await iap.presentExternalPurchaseNoticeSheetIOS();
  if (noticeResult.result == ExternalPurchaseNoticeAction.dismissed) {
    print('User dismissed the notice sheet');
    return;
  }

  // Step 3: Open external purchase link
  final linkResult = await iap.presentExternalPurchaseLinkIOS(externalUrl);
  if (linkResult.success) {
    print('User redirected to external payment');
    // Implement deep linking to handle return from payment
  } else {
    print('Failed: \${linkResult.error}');
  }
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="external-purchase-requirements" level="h3">
          Requirements
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Requirement</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Platform</td>
              <td>iOS 15.4+ (notice sheet), iOS 18.2+ (custom links)</td>
            </tr>
            <tr>
              <td>Entitlement</td>
              <td>
                App must have StoreKit external purchase entitlement from Apple
              </td>
            </tr>
            <tr>
              <td>Deep Linking</td>
              <td>Implement deep linking for app return flow after payment</td>
            </tr>
            <tr>
              <td>Verification</td>
              <td>
                Handle purchase verification on your backend (no StoreKit
                receipt)
              </td>
            </tr>
          </tbody>
        </table>

        <blockquote className="info-note">
          <p>
            <strong>Android alternative:</strong> For Android, use the{' '}
            <Link to="/docs/apis#alternative-billing-android">
              alternative billing APIs
            </Link>{' '}
            (<code>checkAlternativeBillingAvailability</code>,{' '}
            <code>showAlternativeBillingDialog</code>,{' '}
            <code>createAlternativeBillingToken</code>) instead.
          </p>
        </blockquote>
      </section>

      <section>
        <AnchorLink id="purchase-verification-types" level="h2">
          Purchase Verification Types
        </AnchorLink>
        <p>
          Types used with <code>verifyPurchase()</code> for server-side purchase
          verification.
        </p>

        <AnchorLink id="purchase-verification-props" level="h3">
          PurchaseVerificationProps
        </AnchorLink>
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
                <code>sku</code>
              </td>
              <td>Product identifier to verify</td>
            </tr>
            <tr>
              <td>
                <code>androidOptions</code>
              </td>
              <td>
                Android Play Developer API options. Contains:{' '}
                <code>packageName</code>, <code>productToken</code>,{' '}
                <code>accessToken</code>, <code>isSub</code>
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="purchase-verification-result" level="h3">
          PurchaseVerificationResult
        </AnchorLink>
        <p>
          Union of <code>PurchaseVerificationResultIOS</code> and{' '}
          <code>PurchaseVerificationResultAndroid</code>.
        </p>
        <PlatformTabs>
          {{
            ios: (
              <>
                <h4>PurchaseVerificationResultIOS</h4>
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
                        <code>isValid</code>
                      </td>
                      <td>Whether verification succeeded</td>
                    </tr>
                    <tr>
                      <td>
                        <code>receiptData</code>
                      </td>
                      <td>Raw App Store receipt data</td>
                    </tr>
                    <tr>
                      <td>
                        <code>jwsRepresentation</code>
                      </td>
                      <td>JWS-encoded transaction</td>
                    </tr>
                    <tr>
                      <td>
                        <code>latestTransaction</code>
                      </td>
                      <td>Most recent transaction for this product</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
            android: (
              <>
                <h4>PurchaseVerificationResultAndroid</h4>
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
                        <code>autoRenewing</code>
                      </td>
                      <td>Whether subscription will auto-renew</td>
                    </tr>
                    <tr>
                      <td>
                        <code>betaProduct</code>
                      </td>
                      <td>True if beta/test product</td>
                    </tr>
                    <tr>
                      <td>
                        <code>cancelDate</code>
                      </td>
                      <td>Cancellation timestamp (null if active)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>cancelReason</code>
                      </td>
                      <td>Reason for cancellation</td>
                    </tr>
                    <tr>
                      <td>
                        <code>freeTrialEndDate</code>
                      </td>
                      <td>Free trial end timestamp</td>
                    </tr>
                    <tr>
                      <td>
                        <code>gracePeriodEndDate</code>
                      </td>
                      <td>Grace period end timestamp</td>
                    </tr>
                    <tr>
                      <td>
                        <code>productId</code>
                      </td>
                      <td>Product identifier</td>
                    </tr>
                    <tr>
                      <td>
                        <code>productType</code>
                      </td>
                      <td>Product type</td>
                    </tr>
                    <tr>
                      <td>
                        <code>purchaseDate</code>
                      </td>
                      <td>Purchase timestamp</td>
                    </tr>
                    <tr>
                      <td>
                        <code>quantity</code>
                      </td>
                      <td>Purchase quantity</td>
                    </tr>
                    <tr>
                      <td>
                        <code>transactionId</code>
                      </td>
                      <td>Transaction identifier</td>
                    </tr>
                    <tr>
                      <td>
                        <code>renewalDate</code>
                      </td>
                      <td>Next renewal timestamp</td>
                    </tr>
                    <tr>
                      <td>
                        <code>term</code>
                      </td>
                      <td>Subscription term (e.g., "P1M")</td>
                    </tr>
                    <tr>
                      <td>
                        <code>testTransaction</code>
                      </td>
                      <td>True if test/sandbox transaction</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="verify-purchase-with-provider-props" level="h2">
          VerifyPurchaseWithProviderProps
        </AnchorLink>
        <p>
          Input type for <code>verifyPurchaseWithProvider()</code> - used to
          verify purchases through external providers like{' '}
          <a
            href="https://iapkit.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            IAPKit
          </a>
          .
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>provider</code>
              </td>
              <td>
                <code>PurchaseVerificationProvider</code>
              </td>
              <td>
                The verification provider to use. Currently only{' '}
                <code>'iapkit'</code> is supported.
              </td>
            </tr>
            <tr>
              <td>
                <code>iapkit</code>
              </td>
              <td>
                <code>RequestVerifyPurchaseWithIapkitProps?</code>
              </td>
              <td>IAPKit-specific verification parameters.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="request-verify-purchase-with-iapkit-props" level="h3">
          RequestVerifyPurchaseWithIapkitProps
        </AnchorLink>
        <p>Parameters for IAPKit verification.</p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>apiKey</code>
              </td>
              <td>
                <code>string?</code>
              </td>
              <td>
                API key used for the Authorization header (Bearer {'{apiKey}'}
                ).
              </td>
            </tr>
            <tr>
              <td>
                <code>apple</code>
              </td>
              <td>
                <code>RequestVerifyPurchaseWithIapkitAppleProps?</code>
              </td>
              <td>Apple/iOS verification parameters.</td>
            </tr>
            <tr>
              <td>
                <code>google</code>
              </td>
              <td>
                <code>RequestVerifyPurchaseWithIapkitGoogleProps?</code>
              </td>
              <td>Google/Android verification parameters.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink
          id="request-verify-purchase-with-iapkit-apple-props"
          level="h4"
        >
          RequestVerifyPurchaseWithIapkitAppleProps
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>jws</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>The JWS token returned with the purchase response.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink
          id="request-verify-purchase-with-iapkit-google-props"
          level="h4"
        >
          RequestVerifyPurchaseWithIapkitGoogleProps
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>purchaseToken</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>
                The token provided to the user's device when the product or
                subscription was purchased.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="verify-purchase-with-provider-result" level="h2">
          VerifyPurchaseWithProviderResult
        </AnchorLink>
        <p>
          Result type returned by <code>verifyPurchaseWithProvider()</code>.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>provider</code>
              </td>
              <td>
                <code>PurchaseVerificationProvider</code>
              </td>
              <td>The provider used for verification.</td>
            </tr>
            <tr>
              <td>
                <code>iapkit</code>
              </td>
              <td>
                <code>RequestVerifyPurchaseWithIapkitResult[]</code>
              </td>
              <td>
                IAPKit verification results (can include Apple and Google
                entries).
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="request-verify-purchase-with-iapkit-result" level="h3">
          RequestVerifyPurchaseWithIapkitResult
        </AnchorLink>
        <p>Individual verification result from IAPKit.</p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>store</code>
              </td>
              <td>
                <code>IapkitStore</code>
              </td>
              <td>
                The store that processed the purchase (<code>'apple'</code> or{' '}
                <code>'google'</code>).
              </td>
            </tr>
            <tr>
              <td>
                <code>isValid</code>
              </td>
              <td>
                <code>boolean</code>
              </td>
              <td>Whether the purchase is valid (not falsified).</td>
            </tr>
            <tr>
              <td>
                <code>state</code>
              </td>
              <td>
                <code>IapkitPurchaseState</code>
              </td>
              <td>The current state of the purchase.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="iapkit-purchase-state" level="h3">
          IapkitPurchaseState
        </AnchorLink>
        <p>Unified purchase states from IAPKit verification response.</p>
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
                <code>'entitled'</code>
              </td>
              <td>
                User is entitled to the product (purchase is complete and
                active).
              </td>
            </tr>
            <tr>
              <td>
                <code>'pending-acknowledgment'</code>
              </td>
              <td>Purchase needs acknowledgment (Android only).</td>
            </tr>
            <tr>
              <td>
                <code>'pending'</code>
              </td>
              <td>Purchase is pending completion.</td>
            </tr>
            <tr>
              <td>
                <code>'canceled'</code>
              </td>
              <td>Purchase was canceled by the user.</td>
            </tr>
            <tr>
              <td>
                <code>'expired'</code>
              </td>
              <td>Subscription has expired.</td>
            </tr>
            <tr>
              <td>
                <code>'ready-to-consume'</code>
              </td>
              <td>Consumable purchase is ready to be consumed.</td>
            </tr>
            <tr>
              <td>
                <code>'consumed'</code>
              </td>
              <td>Consumable product has been consumed.</td>
            </tr>
            <tr>
              <td>
                <code>'unknown'</code>
              </td>
              <td>Purchase state could not be determined.</td>
            </tr>
            <tr>
              <td>
                <code>'inauthentic'</code>
              </td>
              <td>Purchase failed authenticity validation (potentially fraudulent).</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="iapkit-store" level="h3">
          IapkitStore
        </AnchorLink>
        <p>Enumeration of stores supported by IAPKit.</p>
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
                <code>'apple'</code>
              </td>
              <td>Apple App Store.</td>
            </tr>
            <tr>
              <td>
                <code>'google'</code>
              </td>
              <td>Google Play Store.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="purchase-verification-provider" level="h3">
          PurchaseVerificationProvider
        </AnchorLink>
        <p>Supported verification providers.</p>
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
                <code>'iapkit'</code>
              </td>
              <td>
                <a
                  href="https://iapkit.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  IAPKit
                </a>{' '}
                - Server-side purchase verification service.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="verify-purchase-with-provider-example" level="h3">
          Usage Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { verifyPurchaseWithProvider } from 'openiap';
import type {
  VerifyPurchaseWithProviderProps,
  VerifyPurchaseWithProviderResult,
} from 'openiap';

// iOS verification
const iosResult = await verifyPurchaseWithProvider({
  provider: 'iapkit',
  iapkit: {
    apiKey: 'your-iapkit-api-key',
    apple: {
      jws: purchase.purchaseToken, // JWS from StoreKit 2
    },
  },
});

// Android verification
const androidResult = await verifyPurchaseWithProvider({
  provider: 'iapkit',
  iapkit: {
    apiKey: 'your-iapkit-api-key',
    google: {
      purchaseToken: purchase.purchaseToken,
    },
  },
});

// Check result
for (const item of result.iapkit) {
  if (item.isValid && item.state === 'entitled') {
    // Grant entitlement to user
    console.log(\`Valid purchase from \${item.store}\`);
  }
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIAP

// Create verification props for iOS
let props = VerifyPurchaseWithProviderProps(
    iapkit: RequestVerifyPurchaseWithIapkitProps(
        apiKey: "your-iapkit-api-key",
        apple: RequestVerifyPurchaseWithIapkitAppleProps(
            jws: purchase.jwsRepresentationIOS ?? ""
        ),
        google: nil
    ),
    provider: .iapkit
)

// Verify purchase
let result = try await store.verifyPurchaseWithProvider(props)

// Check results
for item in result.iapkit {
    if item.isValid && item.state == .entitled {
        // Grant entitlement to user
        print("Valid purchase from \\(item.store)")
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.*

// Create verification props for Android
val props = VerifyPurchaseWithProviderProps(
    iapkit = RequestVerifyPurchaseWithIapkitProps(
        apiKey = "your-iapkit-api-key",
        apple = null,
        google = RequestVerifyPurchaseWithIapkitGoogleProps(
            purchaseToken = purchase.purchaseToken
        )
    ),
    provider = PurchaseVerificationProvider.Iapkit
)

// Verify purchase
val result = module.verifyPurchaseWithProvider(props)

// Check results
result.iapkit.forEach { item ->
    if (item.isValid && item.state == IapkitPurchaseState.Entitled) {
        // Grant entitlement to user
        println("Valid purchase from \${item.store}")
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Create verification props for iOS
final props = VerifyPurchaseWithProviderProps(
  provider: PurchaseVerificationProvider.iapkit,
  iapkit: RequestVerifyPurchaseWithIapkitProps(
    apiKey: 'your-iapkit-api-key',
    apple: RequestVerifyPurchaseWithIapkitAppleProps(
      jws: purchase.jwsRepresentationIOS ?? '',
    ),
  ),
);

// Verify purchase
final result = await iap.verifyPurchaseWithProvider(props);

// Check results
for (final item in result.iapkit) {
  if (item.isValid && item.state == IapkitPurchaseState.entitled) {
    // Grant entitlement to user
    print('Valid purchase from \${item.store}');
  }
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="platform-specific-types" level="h2">
          Platform-Specific Types
        </AnchorLink>
        <p>
          Additional types specific to each platform for discounts, offers, and
          pricing.
        </p>

        <PlatformTabs>
          {{
            ios: (
              <>
                <h3>iOS Types</h3>

                <h4>DiscountOffer</h4>
                <p>
                  Used when requesting a purchase with a promotional offer.
                  Generate signature server-side.
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
                        <code>identifier</code>
                      </td>
                      <td>Discount identifier from App Store Connect</td>
                    </tr>
                    <tr>
                      <td>
                        <code>keyIdentifier</code>
                      </td>
                      <td>Key ID for signature validation</td>
                    </tr>
                    <tr>
                      <td>
                        <code>nonce</code>
                      </td>
                      <td>Cryptographic nonce (UUID)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>signature</code>
                      </td>
                      <td>Server-generated signature</td>
                    </tr>
                    <tr>
                      <td>
                        <code>timestamp</code>
                      </td>
                      <td>Timestamp when signature was generated</td>
                    </tr>
                  </tbody>
                </table>

                <h4>Discount</h4>
                <p>Discount info returned as part of product details:</p>
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
                        <code>identifier</code>
                      </td>
                      <td>Discount identifier</td>
                    </tr>
                    <tr>
                      <td>
                        <code>type</code>
                      </td>
                      <td>Discount type (introductory, promotional)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>numberOfPeriods</code>
                      </td>
                      <td>Number of billing periods</td>
                    </tr>
                    <tr>
                      <td>
                        <code>price</code>
                      </td>
                      <td>Formatted price string</td>
                    </tr>
                    <tr>
                      <td>
                        <code>priceAmount</code>
                      </td>
                      <td>Numeric price value</td>
                    </tr>
                    <tr>
                      <td>
                        <code>paymentMode</code>
                      </td>
                      <td>Payment mode (FreeTrial, PayAsYouGo, PayUpFront)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>subscriptionPeriod</code>
                      </td>
                      <td>Period duration string</td>
                    </tr>
                  </tbody>
                </table>

                <h4>SubscriptionPeriodIOS</h4>
                <p>Subscription period units:</p>
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
                        <code>Day</code>, <code>Week</code>, <code>Month</code>,{' '}
                        <code>Year</code>
                      </td>
                      <td>Available subscription period units</td>
                    </tr>
                  </tbody>
                </table>

                <h4>PaymentMode</h4>
                <p>Payment mode for offers:</p>
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
                        <code>FreeTrial</code>
                      </td>
                      <td>Free trial period</td>
                    </tr>
                    <tr>
                      <td>
                        <code>PayAsYouGo</code>
                      </td>
                      <td>Pay each period at reduced price</td>
                    </tr>
                    <tr>
                      <td>
                        <code>PayUpFront</code>
                      </td>
                      <td>Pay full amount upfront</td>
                    </tr>
                  </tbody>
                </table>

                <AnchorLink id="subscription-status-ios" level="h4">
                  SubscriptionStatusIOS
                </AnchorLink>
                <p>
                  Subscription status from StoreKit 2. Use{' '}
                  <code>subscriptionStatusIOS(sku)</code> to get detailed
                  subscription state.
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
                        <code>state</code>
                      </td>
                      <td>Current renewal state (see values below)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>renewalInfo</code>
                      </td>
                      <td>
                        Renewal details. Contains: <code>willAutoRenew</code>,{' '}
                        <code>autoRenewPreference</code>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <h5>Subscription State Values</h5>
                <p>
                  The <code>state</code> field indicates the current
                  subscription status:
                </p>
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>State</th>
                      <th>Description</th>
                      <th>User Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>subscribed</code>
                      </td>
                      <td>Active subscription</td>
                      <td>Grant access</td>
                    </tr>
                    <tr>
                      <td>
                        <code>expired</code>
                      </td>
                      <td>Subscription has expired</td>
                      <td>Deny access</td>
                    </tr>
                    <tr>
                      <td>
                        <code>revoked</code>
                      </td>
                      <td>Refunded by Apple</td>
                      <td>Deny access</td>
                    </tr>
                    <tr>
                      <td>
                        <code>inGracePeriod</code>
                      </td>
                      <td>Billing failed but grace period active</td>
                      <td>Grant access (temporary)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>inBillingRetryPeriod</code>
                      </td>
                      <td>Billing retry in progress</td>
                      <td>Consider granting access</td>
                    </tr>
                  </tbody>
                </table>

                <h5>iOS Expiration Reasons</h5>
                <p>
                  When <code>willAutoRenew</code> is <code>false</code>, the{' '}
                  <code>expirationReason</code> field in{' '}
                  <code>renewalInfo</code> indicates why:
                </p>
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>Reason</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>VOLUNTARY</code>
                      </td>
                      <td>User cancelled the subscription</td>
                    </tr>
                    <tr>
                      <td>
                        <code>BILLING_ERROR</code>
                      </td>
                      <td>Payment failed (card declined, etc.)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>DID_NOT_AGREE_TO_PRICE_INCREASE</code>
                      </td>
                      <td>User declined a price increase</td>
                    </tr>
                    <tr>
                      <td>
                        <code>PRODUCT_NOT_AVAILABLE</code>
                      </td>
                      <td>Product no longer available for purchase</td>
                    </tr>
                    <tr>
                      <td>
                        <code>UNKNOWN</code>
                      </td>
                      <td>Unknown reason</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
            android: (
              <>
                <h3>Android Types</h3>

                <h4>SubscriptionOffer</h4>
                <p>Offer details for subscription purchases:</p>
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
                        <code>sku</code>
                      </td>
                      <td>Product identifier</td>
                    </tr>
                    <tr>
                      <td>
                        <code>offerToken</code>
                      </td>
                      <td>Play Billing offer token (required for purchase)</td>
                    </tr>
                  </tbody>
                </table>

                <h4>PricingPhase</h4>
                <p>Pricing phase for Android subscriptions:</p>
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
                        <code>billingPeriod</code>
                      </td>
                      <td>ISO 8601 period (P1W, P1M, P1Y)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>formattedPrice</code>
                      </td>
                      <td>Formatted price string</td>
                    </tr>
                    <tr>
                      <td>
                        <code>priceAmountMicros</code>
                      </td>
                      <td>Price in micro-units (divide by 1,000,000)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>priceCurrencyCode</code>
                      </td>
                      <td>ISO 4217 currency code</td>
                    </tr>
                    <tr>
                      <td>
                        <code>billingCycleCount</code>
                      </td>
                      <td>Number of cycles for this phase</td>
                    </tr>
                    <tr>
                      <td>
                        <code>recurrenceMode</code>
                      </td>
                      <td>
                        How this phase recurs (1 = infinite, 2 = finite, 3 =
                        non-recurring)
                      </td>
                    </tr>
                  </tbody>
                </table>

                <h4>PricingPhasesAndroid</h4>
                <p>Container for pricing phases:</p>
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
                        <code>pricingPhaseList</code>
                      </td>
                      <td>Array of PricingPhase objects</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="app-transaction" level="h2">
          AppTransaction (iOS)
        </AnchorLink>
        <p>
          Represents the app transaction information returned by{' '}
          <code>getAppTransactionIOS()</code>. Contains metadata about the
          app&apos;s purchase and installation.
        </p>

        <AnchorLink id="app-transaction-fields" level="h3">
          Fields
        </AnchorLink>
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
                <code>bundleId</code>
              </td>
              <td>App bundle identifier</td>
            </tr>
            <tr>
              <td>
                <code>appVersion</code>
              </td>
              <td>Current app version</td>
            </tr>
            <tr>
              <td>
                <code>originalAppVersion</code>
              </td>
              <td>Version when user originally purchased/downloaded</td>
            </tr>
            <tr>
              <td>
                <code>originalPurchaseDate</code>
              </td>
              <td>Original purchase timestamp</td>
            </tr>
            <tr>
              <td>
                <code>deviceVerification</code>
              </td>
              <td>Device verification data</td>
            </tr>
            <tr>
              <td>
                <code>deviceVerificationNonce</code>
              </td>
              <td>Nonce for device verification</td>
            </tr>
            <tr>
              <td>
                <code>environment</code>
              </td>
              <td>
                Environment: &quot;Sandbox&quot; or &quot;Production&quot;
              </td>
            </tr>
            <tr>
              <td>
                <code>signedDate</code>
              </td>
              <td>Date when the transaction was signed</td>
            </tr>
            <tr>
              <td>
                <code>appId</code>
              </td>
              <td>App ID number</td>
            </tr>
            <tr>
              <td>
                <code>appVersionId</code>
              </td>
              <td>App version ID number</td>
            </tr>
            <tr>
              <td>
                <code>preorderDate</code>
              </td>
              <td>Preorder date (optional)</td>
            </tr>
            <tr>
              <td>
                <code>appTransactionId</code>
              </td>
              <td>App transaction ID (iOS 18.4+)</td>
            </tr>
            <tr>
              <td>
                <code>originalPlatform</code>
              </td>
              <td>Original platform (iOS 18.4+)</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="app-transaction-type-definition" level="h3">
          Type Definition
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`interface AppTransaction {
  bundleId: string;
  appVersion: string;
  originalAppVersion: string;
  originalPurchaseDate: number;  // epoch ms
  deviceVerification: string;
  deviceVerificationNonce: string;
  environment: 'Sandbox' | 'Production';
  signedDate: number;  // epoch ms
  appId: number;
  appVersionId: number;
  preorderDate?: number;  // epoch ms
  // iOS 18.4+ properties
  appTransactionId?: string;
  originalPlatform?: string;
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`struct AppTransaction {
    let bundleId: String
    let appVersion: String
    let originalAppVersion: String
    let originalPurchaseDate: Date
    let deviceVerification: String
    let deviceVerificationNonce: String
    let environment: String  // "Sandbox" | "Production"
    let signedDate: Date
    let appId: Int
    let appVersionId: Int
    let preorderDate: Date?
    // iOS 18.4+ properties
    let appTransactionId: String?
    let originalPlatform: String?
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`data class AppTransaction(
    val bundleId: String,
    val appVersion: String,
    val originalAppVersion: String,
    val originalPurchaseDate: Long,  // epoch ms
    val deviceVerification: String,
    val deviceVerificationNonce: String,
    val environment: String,  // "Sandbox" | "Production"
    val signedDate: Long,  // epoch ms
    val appId: Long,
    val appVersionId: Long,
    val preorderDate: Long? = null,
    // iOS 18.4+ properties
    val appTransactionId: String? = null,
    val originalPlatform: String? = null
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`class AppTransaction {
  final String bundleId;
  final String appVersion;
  final String originalAppVersion;
  final int originalPurchaseDate;  // epoch ms
  final String deviceVerification;
  final String deviceVerificationNonce;
  final String environment;  // "Sandbox" | "Production"
  final int signedDate;  // epoch ms
  final int appId;
  final int appVersionId;
  final int? preorderDate;
  // iOS 18.4+ properties
  final String? appTransactionId;
  final String? originalPlatform;

  AppTransaction({
    required this.bundleId,
    required this.appVersion,
    required this.originalAppVersion,
    required this.originalPurchaseDate,
    required this.deviceVerification,
    required this.deviceVerificationNonce,
    required this.environment,
    required this.signedDate,
    required this.appId,
    required this.appVersionId,
    this.preorderDate,
    this.appTransactionId,
    this.originalPlatform,
  });
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="app-transaction-example" level="h3">
          Usage Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { getAppTransactionIOS } from 'expo-iap';

// Get app transaction (iOS only)
const appTransaction = await getAppTransactionIOS();

if (appTransaction) {
  console.log('Bundle ID:', appTransaction.bundleId);
  console.log('Original version:', appTransaction.originalAppVersion);
  console.log('Environment:', appTransaction.environment);

  // Check if user originally purchased on a different platform (iOS 18.4+)
  if (appTransaction.originalPlatform) {
    console.log('Originally purchased on:', appTransaction.originalPlatform);
  }
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

// Get app transaction (iOS only)
let appTransaction = try await OpenIapModule.shared.getAppTransactionIOS()

if let transaction = appTransaction {
    print("Bundle ID: \\(transaction.bundleId)")
    print("Original version: \\(transaction.originalAppVersion)")
    print("Environment: \\(transaction.environment)")

    // Check if user originally purchased on a different platform (iOS 18.4+)
    if let platform = transaction.originalPlatform {
        print("Originally purchased on: \\(platform)")
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.kmpIapInstance

// Get app transaction (iOS only via KMP)
val appTransaction = kmpIapInstance.getAppTransactionIOS()

appTransaction?.let { transaction ->
    println("Bundle ID: \${transaction.bundleId}")
    println("Original version: \${transaction.originalAppVersion}")
    println("Environment: \${transaction.environment}")

    // Check if user originally purchased on a different platform (iOS 18.4+)
    transaction.originalPlatform?.let { platform ->
        println("Originally purchased on: $platform")
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Get app transaction (iOS only)
final appTransaction = await FlutterInappPurchase.instance.getAppTransactionIOS();

if (appTransaction != null) {
  print('Bundle ID: \${appTransaction.bundleId}');
  print('Original version: \${appTransaction.originalAppVersion}');
  print('Environment: \${appTransaction.environment}');

  // Check if user originally purchased on a different platform (iOS 18.4+)
  if (appTransaction.originalPlatform != null) {
    print('Originally purchased on: \${appTransaction.originalPlatform}');
  }
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>
    </div>
  );
}

export default Types;
