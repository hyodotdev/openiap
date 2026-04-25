import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

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
    name: 'SubscriptionProduct',
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
    name: 'PaymentMode',
    description: 'iOS payment modes for promotional offers.',
  },
  {
    to: '/docs/types/ios/subscription-status-ios',
    name: 'SubscriptionStatusIOS',
    description: 'StoreKit 2 subscription status values.',
  },
  {
    to: '/docs/types/ios/app-transaction-ios',
    name: 'AppTransaction',
    description: 'iOS 16+ app transaction info.',
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
