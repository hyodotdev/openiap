import { useState, useEffect, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import APICard from '../../../components/APICard';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { GQL_RELEASE } from '../../../lib/versioning';

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
  {
    filename: 'openiap-gdscript.zip',
    label: 'GDScript definitions',
    size: '36.9 KB',
    sha256: '',
  },
];

// Redirect map for legacy anchor links
const legacyAnchorRedirects: Record<string, string> = {
  // Product types
  product: '/docs/types/product#product',
  'product-common': '/docs/types/product#product-common',
  'product-platform': '/docs/types/product#product-platform',
  'product-subscription': '/docs/types/product#product-subscription',
  'subscription-product-common':
    '/docs/types/product#subscription-product-common',
  'subscription-product-platform':
    '/docs/types/product#subscription-product-platform',
  'unified-platform-types': '/docs/types/product#unified-platform-types',
  'store-discriminators': '/docs/types/product#store-discriminators',
  'union-types': '/docs/types/product#union-types',
  storefront: '/docs/types/product#storefront',
  // Purchase types
  purchase: '/docs/types/purchase#purchase',
  'purchase-state': '/docs/types/purchase#purchase-state',
  'purchase-common': '/docs/types/purchase#purchase-common',
  'purchase-platform': '/docs/types/purchase#purchase-platform',
  'renewal-info-ios': '/docs/types/purchase#renewal-info-ios',
  'active-subscription': '/docs/types/purchase#active-subscription',
  'active-subscription-common':
    '/docs/types/purchase#active-subscription-common',
  'active-subscription-platform':
    '/docs/types/purchase#active-subscription-platform',
  'active-subscription-example':
    '/docs/types/purchase#active-subscription-example',
  // Request types
  'product-request': '/docs/types/request#product-request',
  'product-request-fields': '/docs/types/request#product-request-fields',
  'product-request-example': '/docs/types/request#product-request-example',
  'request-types': '/docs/types/request#request-types',
  'request-purchase-props': '/docs/types/request#request-purchase-props',
  'request-purchase-example': '/docs/types/request#request-purchase-example',
  'request-purchase-props-by-platforms':
    '/docs/types/request#request-purchase-props-by-platforms',
  'request-subscription-props-by-platforms':
    '/docs/types/request#request-subscription-props-by-platforms',
  'platform-specific-request-props':
    '/docs/types/request#platform-specific-request-props',
  'subscription-request-props':
    '/docs/types/request#subscription-request-props',
  // Alternative billing types
  'alternative-billing-types':
    '/docs/types/alternative#alternative-billing-types',
  'alternative-billing-mode-android':
    '/docs/types/alternative#alternative-billing-mode-android',
  'init-connection-config': '/docs/types/alternative#init-connection-config',
  'init-connection-example': '/docs/types/alternative#init-connection-example',
  'external-purchase-link': '/docs/types/alternative#external-purchase-link',
  'external-purchase-apis': '/docs/types/alternative#external-purchase-apis',
  'external-purchase-types': '/docs/types/alternative#external-purchase-types',
  'external-purchase-flow': '/docs/types/alternative#external-purchase-flow',
  'external-purchase-example':
    '/docs/types/alternative#external-purchase-example',
  'external-purchase-requirements':
    '/docs/types/alternative#external-purchase-requirements',
  // Verification types
  'purchase-verification-types':
    '/docs/types/verification#purchase-verification-types',
  'verify-purchase-props': '/docs/types/verification#verify-purchase-props',
  'verify-purchase-result': '/docs/types/verification#verify-purchase-result',
  'verify-purchase-with-provider-props':
    '/docs/types/verification#verify-purchase-with-provider-props',
  'request-verify-purchase-with-iapkit-props':
    '/docs/types/verification#request-verify-purchase-with-iapkit-props',
  'request-verify-purchase-with-iapkit-apple-props':
    '/docs/types/verification#request-verify-purchase-with-iapkit-apple-props',
  'request-verify-purchase-with-iapkit-google-props':
    '/docs/types/verification#request-verify-purchase-with-iapkit-google-props',
  'verify-purchase-with-provider-result':
    '/docs/types/verification#verify-purchase-with-provider-result',
  'request-verify-purchase-with-iapkit-result':
    '/docs/types/verification#request-verify-purchase-with-iapkit-result',
  'iapkit-purchase-state': '/docs/types/verification#iapkit-purchase-state',
  'iapkit-store': '/docs/types/verification#iapkit-store',
  'purchase-verification-provider':
    '/docs/types/verification#purchase-verification-provider',
  'verify-purchase-with-provider-example':
    '/docs/types/verification#verify-purchase-with-provider-example',
  // Offer types (new standardized types)
  'discount-offer': '/docs/types/offer#discount-offer',
  'subscription-offer': '/docs/types/offer#subscription-offer',
  'discount-offer-type': '/docs/types/offer#discount-offer',
  'subscription-offer-type': '/docs/types/offer#subscription-offer',
  // iOS types
  'platform-specific-types': '/docs/types/offer#discount-offer',
  discount: '/docs/types/ios#discount',
  'subscription-period-ios': '/docs/types/ios#subscription-period-ios',
  'payment-mode': '/docs/types/ios#payment-mode',
  'subscription-status-ios': '/docs/types/ios#subscription-status-ios',
  'subscription-state-values': '/docs/types/ios#subscription-state-values',
  'expiration-reasons': '/docs/types/ios#expiration-reasons',
  'app-transaction': '/docs/types/ios#app-transaction',
  'app-transaction-fields': '/docs/types/ios#app-transaction-fields',
  'app-transaction-type-definition':
    '/docs/types/ios#app-transaction-type-definition',
  'app-transaction-example': '/docs/types/ios#app-transaction-example',
  // Android types (subscription-offer redirects to standardized offer page above)
  'subscription-offer-android': '/docs/types/android#subscription-offer',
  'pricing-phase': '/docs/types/android#pricing-phase',
  'recurrence-mode-values': '/docs/types/android#recurrence-mode-values',
  'pricing-phases-android': '/docs/types/android#pricing-phases-android',
  'android-type-example': '/docs/types/android#android-type-example',
  'base-plan-limitation': '/docs/types/android#base-plan-limitation',
};

function TypesIndex() {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedArchive, setSelectedArchive] = useState(SPEC_ARCHIVES[0]);

  // Redirect legacy anchor links to new paths
  useEffect(() => {
    const hash = location.hash.slice(1); // Remove '#'
    if (hash && legacyAnchorRedirects[hash]) {
      navigate(legacyAnchorRedirects[hash], { replace: true });
    }
  }, [location.hash, navigate]);

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
        description="OpenIAP type definitions for Product, Purchase, SubscriptionOffer, and more. Download type-safe definitions for TypeScript, Swift, Kotlin, Dart, and GDScript."
        path="/docs/types"
        keywords="OpenIAP types, Product type, Purchase type, SubscriptionOffer, IAP TypeScript, IAP Swift, IAP Kotlin, IAP Dart, IAP GDScript, Godot types"
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

      <p>
        Complete type definitions for OpenIAP. Types are organized by category
        to help you find what you need quickly.
      </p>

      <TLDRBox title="Type Categories">
        <ul>
          <li>
            <a href="/docs/types/product">
              <strong>Product</strong>
            </a>
            : Product, SubscriptionProduct, Storefront
          </li>
          <li>
            <a href="/docs/types/purchase">
              <strong>Purchase</strong>
            </a>
            : Purchase, ActiveSubscription
          </li>
          <li>
            <a href="/docs/types/offer">
              <strong>Offer</strong>
            </a>
            : DiscountOffer, SubscriptionOffer (cross-platform)
          </li>
          <li>
            <a href="/docs/types/request">
              <strong>Request</strong>
            </a>
            : ProductRequest, RequestPurchaseProps
          </li>
          <li>
            <a href="/docs/types/alternative">
              <strong>Alternative Billing</strong>
            </a>
            : External purchase and billing modes
          </li>
          <li>
            <a href="/docs/types/verification">
              <strong>Verification</strong>
            </a>
            : Purchase verification types
          </li>
          <li>
            <a href="/docs/types/ios">
              <strong>iOS</strong>
            </a>
            : SubscriptionStatusIOS, AppTransaction (platform-specific)
          </li>
          <li>
            <a href="/docs/types/android">
              <strong>Android</strong>
            </a>
            : PricingPhase, PricingPhasesAndroid (platform-specific)
          </li>
        </ul>
      </TLDRBox>

      <section>
        <h2>Core Types</h2>
        <p>Essential types used in every IAP implementation.</p>
        <div className="api-cards-grid">
          <APICard
            title="Product Types"
            description="Product, SubscriptionProduct, Unified Platform Types, and Storefront definitions."
            href="/docs/types/product"
            count={4}
          />
          <APICard
            title="Purchase Types"
            description="Purchase transaction and ActiveSubscription types with platform-specific fields."
            href="/docs/types/purchase"
            count={2}
          />
          <APICard
            title="Offer Types"
            description="DiscountOffer and SubscriptionOffer - cross-platform discount and promotional offer types."
            href="/docs/types/offer"
            count={2}
          />
          <APICard
            title="Request Types"
            description="ProductRequest and RequestPurchaseProps for initiating purchases."
            href="/docs/types/request"
            count={2}
          />
        </div>
      </section>

      <section>
        <h2>Advanced Types</h2>
        <p>Types for billing options and purchase verification.</p>
        <div className="api-cards-grid">
          <APICard
            title="Alternative Billing"
            description="Alternative billing modes and external purchase link types for iOS and Android."
            href="/docs/types/alternative"
            count={2}
          />
          <APICard
            title="Verification Types"
            description="Types for verifyPurchase and verifyPurchaseWithProvider APIs."
            href="/docs/types/verification"
            count={3}
          />
        </div>
      </section>

      <section>
        <h2>Platform-Specific Types</h2>
        <p>
          Types specific to iOS and Android platforms. Note: Discount/offer
          types have been standardized in{' '}
          <a href="/docs/types/offer">Offer Types</a>.
        </p>
        <div className="api-cards-grid">
          <APICard
            title="iOS Types"
            description="SubscriptionStatusIOS, PaymentModeIOS, AppTransaction, and deprecated discount types."
            href="/docs/types/ios"
            count={4}
          />
          <APICard
            title="Android Types"
            description="PricingPhase, PricingPhasesAndroid, and deprecated offer detail types."
            href="/docs/types/android"
            count={2}
          />
        </div>
      </section>
    </div>
  );
}

export default TypesIndex;
