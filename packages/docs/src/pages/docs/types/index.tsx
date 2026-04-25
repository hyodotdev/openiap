import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

// Old bookmarks like /docs/types#product redirect to the flat
// per-symbol pages introduced in this PR so existing links keep
// working. Legacy combined-page anchors (request, alternative,
// verification, ios, android, offer) point to the relevant section
// of the new index instead.
const LEGACY_ANCHOR_REDIRECTS: Record<string, string> = {
  product: '/docs/types/product',
  'subscription-product': '/docs/types/subscription-product',
  'product-subscription': '/docs/types/subscription-product',
  storefront: '/docs/types/storefront',
  purchase: '/docs/types/purchase',
  'active-subscription': '/docs/types/active-subscription',
  'product-request': '/docs/types/product-request',
  'request-purchase-props': '/docs/types/request-purchase-props',
  'discount-offer': '/docs/types/discount-offer',
  'subscription-offer': '/docs/types/subscription-offer',
  'verify-purchase': '/docs/types/verify-purchase',
  'verify-purchase-with-provider-props':
    '/docs/types/verify-purchase-with-provider-props',
  'verify-purchase-with-provider-result':
    '/docs/types/verify-purchase-with-provider-result',
  'alternative-billing': '/docs/types/alternative-billing-types',
  'billing-programs': '/docs/types/billing-programs',
  'external-purchase-link': '/docs/types/external-purchase-link',
  // iOS-specific
  'discount-offer-ios': '/docs/types/ios/discount-offer-ios',
  'discount-ios': '/docs/types/ios/discount-ios',
  'subscription-period-ios': '/docs/types/ios/subscription-period-ios',
  'payment-mode-ios': '/docs/types/ios/payment-mode-ios',
  'subscription-status-ios': '/docs/types/ios/subscription-status-ios',
  'app-transaction-ios': '/docs/types/ios/app-transaction-ios',
  'renewal-info-ios': '/docs/types/ios/renewal-info-ios',
  // Android-specific
  'one-time-purchase-offer-detail-android':
    '/docs/types/android/one-time-purchase-offer-detail-android',
  'subscription-offer-android':
    '/docs/types/android/subscription-offer-android',
  'pricing-phase-android': '/docs/types/android/pricing-phase-android',
  // Legacy section anchors that pointed at the old combined type pages
  'product-common': '/docs/types/product#product-common',
  'product-ios': '/docs/types/product#product-ios',
  'product-android': '/docs/types/product#product-android',
  'subscription-product-common':
    '/docs/types/subscription-product#subscription-product-common',
  'subscription-product-ios':
    '/docs/types/subscription-product#subscription-product-ios',
  'subscription-product-android':
    '/docs/types/subscription-product#subscription-product-android',
  'purchase-state': '/docs/types/purchase#purchase-state',
  'purchase-common': '/docs/types/purchase#purchase-common',
  'purchase-ios': '/docs/types/purchase#purchase-ios',
  'purchase-android': '/docs/types/purchase#purchase-android',
  'active-subscription-common':
    '/docs/types/active-subscription#active-subscription-common',
  'active-subscription-ios':
    '/docs/types/active-subscription#active-subscription-ios',
  'active-subscription-android':
    '/docs/types/active-subscription#active-subscription-android',
  'app-transaction': '/docs/types/ios/app-transaction-ios',
  'payment-mode': '/docs/types/ios/payment-mode-ios',
  'subscription-period': '/docs/types/ios/subscription-period-ios',
  'subscription-status': '/docs/types/ios/subscription-status-ios',
  'discount-ios-deprecated': '/docs/types/ios/discount-ios',
  // Top-level anchors on the old combined types page — map to the
  // matching section on the new types index when one exists.
  common: '/docs/types#common',
  'platform-specific': '/docs/types#ios-types',
  ios: '/docs/types#ios-types',
  android: '/docs/types#android-types',
  alternative: '/docs/types#alternative-billing',
  verification: '/docs/types#validation',
  offer: '/docs/types#common',
  request: '/docs/types#common',
};

interface TypeRow {
  to: string;
  name: string;
  description: string;
}

const COMMON_TYPES: TypeRow[] = [
  {
    to: '/docs/types/product',
    name: 'Product',
    description: 'Base product type with platform-specific extensions.',
  },
  {
    to: '/docs/types/subscription-product',
    name: 'ProductSubscription',
    description: 'Subscription product with billing periods and offers.',
  },
  {
    to: '/docs/types/storefront',
    name: 'Storefront',
    description: 'Store region info from getStorefront().',
  },
  {
    to: '/docs/types/purchase',
    name: 'Purchase',
    description: 'Transaction record from a successful purchase.',
  },
  {
    to: '/docs/types/active-subscription',
    name: 'ActiveSubscription',
    description: 'Active subscription with renewal status.',
  },
  {
    to: '/docs/types/product-request',
    name: 'ProductRequest',
    description: 'Input for fetchProducts (skus + type).',
  },
  {
    to: '/docs/types/request-purchase-props',
    name: 'RequestPurchaseProps',
    description: 'Discriminated union for one-time purchases or subscriptions.',
  },
  {
    to: '/docs/types/discount-offer',
    name: 'DiscountOffer',
    description: 'Cross-platform discount offer details.',
  },
  {
    to: '/docs/types/subscription-offer',
    name: 'SubscriptionOffer',
    description: 'Cross-platform subscription offer details.',
  },
];

const VALIDATION_TYPES: TypeRow[] = [
  {
    to: '/docs/types/verify-purchase',
    name: 'VerifyPurchase Types',
    description: 'VerifyPurchaseProps and VerifyPurchaseResult definitions.',
  },
  {
    to: '/docs/types/verify-purchase-with-provider-props',
    name: 'VerifyPurchaseWithProviderProps',
    description: 'Provider-based verification input (e.g., IAPKit).',
  },
  {
    to: '/docs/types/verify-purchase-with-provider-result',
    name: 'VerifyPurchaseWithProviderResult',
    description: 'Provider-based verification response.',
  },
];

const ALT_BILLING_TYPES: TypeRow[] = [
  {
    to: '/docs/types/alternative-billing-types',
    name: 'Alternative Billing',
    description: 'AlternativeBillingModeAndroid and InitConnectionConfig.',
  },
  {
    to: '/docs/types/billing-programs',
    name: 'Billing Programs',
    description: 'Google Play Billing Programs API types (8.2.0+).',
  },
  {
    to: '/docs/types/external-purchase-link',
    name: 'External Purchase Link',
    description: 'iOS external purchase link result types.',
  },
];

const IOS_TYPES: TypeRow[] = [
  {
    to: '/docs/types/ios/discount-offer-ios',
    name: 'DiscountOfferIOS',
    description: 'iOS-specific discount offer payload.',
  },
  {
    to: '/docs/types/ios/discount-ios',
    name: 'DiscountIOS',
    description: 'iOS discount details (type, payment mode, period).',
  },
  {
    to: '/docs/types/ios/subscription-period-ios',
    name: 'SubscriptionPeriodIOS',
    description: 'iOS subscription period units (Day/Week/Month/Year).',
  },
  {
    to: '/docs/types/ios/payment-mode-ios',
    name: 'PaymentModeIOS',
    description: 'iOS payment modes for promotional offers.',
  },
  {
    to: '/docs/types/ios/subscription-status-ios',
    name: 'SubscriptionStatusIOS',
    description: 'StoreKit 2 subscription status values.',
  },
  {
    to: '/docs/types/ios/app-transaction-ios',
    name: 'AppTransactionIOS',
    description: 'iOS 16+ app transaction info.',
  },
  {
    to: '/docs/types/ios/renewal-info-ios',
    name: 'RenewalInfoIOS',
    description:
      'StoreKit 2 subscription renewal details — auto-renew intent, billing-retry state, price-increase responses, JWS payload.',
  },
];

const ANDROID_TYPES: TypeRow[] = [
  {
    to: '/docs/types/android/one-time-purchase-offer-detail-android',
    name: 'OneTimePurchaseOfferDetailAndroid',
    description: 'Android one-time purchase offer details.',
  },
  {
    to: '/docs/types/android/subscription-offer-android',
    name: 'SubscriptionOfferAndroid',
    description: 'Android subscription offer (Play Billing).',
  },
  {
    to: '/docs/types/android/pricing-phase-android',
    name: 'PricingPhaseAndroid',
    description: 'Android pricing phases (intro / paid / free trial).',
  },
];

function TypeTable({ rows }: { rows: TypeRow[] }) {
  return (
    <table className="doc-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.to}>
            <td>
              <Link to={row.to}>
                <code>{row.name}</code>
              </Link>
            </td>
            <td>{row.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TypesIndex() {
  useScrollToHash();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!location.hash) return;
    const anchor = location.hash.slice(1);
    const redirect = LEGACY_ANCHOR_REDIRECTS[anchor];
    if (!redirect) return;
    // Skip the navigate when the legacy anchor already resolves to this
    // exact page + hash — prevents an infinite redirect loop on
    // same-page section anchors like `common`.
    const [redirectPath, redirectHash = ''] = redirect.split('#');
    const currentHash = location.hash.startsWith('#')
      ? location.hash.slice(1)
      : '';
    // Normalise trailing slashes so `/foo` and `/foo/` compare equal.
    const stripSlash = (p: string) =>
      p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
    if (
      stripSlash(redirectPath) === stripSlash(location.pathname) &&
      redirectHash === currentHash
    ) {
      return;
    }
    navigate(redirect, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  return (
    <div className="doc-page">
      <SEO
        title="Types"
        description="OpenIAP type definitions for Product, Purchase, SubscriptionOffer, and more — unified across TypeScript, Swift, Kotlin, Dart, and GDScript."
        path="/docs/types"
        keywords="OpenIAP types, Product type, Purchase type, SubscriptionOffer, IAP TypeScript, IAP Swift, IAP Kotlin, IAP Dart, IAP GDScript, Godot types"
      />
      <h1>Types</h1>
      <p>
        Complete type reference for OpenIAP. Each type below has its own page
        with field definitions, examples, and related links.
      </p>

      <section>
        <AnchorLink id="common" level="h2">
          Common
        </AnchorLink>
        <TypeTable rows={COMMON_TYPES} />
      </section>

      <section>
        <AnchorLink id="validation" level="h2">
          Validation
        </AnchorLink>
        <TypeTable rows={VALIDATION_TYPES} />
      </section>

      <section>
        <AnchorLink id="alternative-billing" level="h2">
          Alternative Billing
        </AnchorLink>
        <TypeTable rows={ALT_BILLING_TYPES} />
      </section>

      <section>
        <AnchorLink id="ios-types" level="h2">
          iOS Specific
        </AnchorLink>
        <TypeTable rows={IOS_TYPES} />
      </section>

      <section>
        <AnchorLink id="android-types" level="h2">
          Android Specific
        </AnchorLink>
        <TypeTable rows={ANDROID_TYPES} />
      </section>
    </div>
  );
}

export default TypesIndex;
