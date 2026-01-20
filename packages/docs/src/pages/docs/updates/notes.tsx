import { useMemo } from 'react';
import SEO from '../../../components/SEO';
import {
  useScrollToHash,
  getHashId,
} from '../../../hooks/useScrollToHash';
import CodeBlock from '../../../components/CodeBlock';
import Pagination from '../../../components/Pagination';
import AnchorLink from '../../../components/AnchorLink';

const noteCardStyle = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: '0.5rem',
  padding: '1rem',
  marginBottom: '1.5rem',
};

interface Note {
  id: string;
  date: Date;
  element: React.ReactNode;
}

function Notes() {
  useScrollToHash();

  const allNotes: Note[] = [
    // GQL 1.3.15 / Google 1.3.27 / Apple 1.3.13 - Jan 21, 2026
    {
      id: 'gql-1-3-15-google-1-3-27-apple-1-3-13',
      date: new Date('2026-01-21'),
      element: (
        <div key="gql-1-3-15-google-1-3-27-apple-1-3-13" style={noteCardStyle}>
          <AnchorLink id="gql-1-3-15-google-1-3-27-apple-1-3-13" level="h4">
            📅 openiap-gql v1.3.15 / openiap-google v1.3.27 / openiap-apple v1.3.13 - Bug Fix
          </AnchorLink>

          <p><strong>Android - Fix SubscriptionProductReplacementParams ReplacementMode Mapping:</strong></p>
          <p>
            Fixed incorrect <code>replacementModeConstant</code> mapping in <code>applySubscriptionProductReplacementParams</code>.
            The function was using values from the legacy <code>SubscriptionUpdateParams.ReplacementMode</code> API instead of
            the new <code>SubscriptionProductReplacementParams.ReplacementMode</code> API (Billing Library 8.1.0+).
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Issue: <a href="https://github.com/hyodotdev/openiap/issues/71" target="_blank" rel="noopener noreferrer">#71</a>
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Mode</th>
                <th style={{ textAlign: 'center', padding: '0.5rem' }}>Before (Wrong)</th>
                <th style={{ textAlign: 'center', padding: '0.5rem' }}>After (Correct)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ padding: '0.25rem 0.5rem' }}>CHARGE_FULL_PRICE</td><td style={{ textAlign: 'center' }}>5</td><td style={{ textAlign: 'center' }}>4</td></tr>
              <tr><td style={{ padding: '0.25rem 0.5rem' }}>DEFERRED</td><td style={{ textAlign: 'center' }}>6</td><td style={{ textAlign: 'center' }}>5</td></tr>
              <tr><td style={{ padding: '0.25rem 0.5rem' }}>KEEP_EXISTING</td><td style={{ textAlign: 'center' }}>7</td><td style={{ textAlign: 'center' }}>6</td></tr>
            </tbody>
          </table>

          <p><strong>References:</strong></p>
          <ul>
            <li><a href="https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode" target="_blank" rel="noopener noreferrer">SubscriptionProductReplacementParams.ReplacementMode (Billing 8.1.0+)</a></li>
            <li><a href="https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams.SubscriptionUpdateParams.ReplacementMode" target="_blank" rel="noopener noreferrer">SubscriptionUpdateParams.ReplacementMode (Legacy)</a></li>
          </ul>
        </div>
      ),
    },
    // GQL 1.3.14 / Google 1.3.25 / Apple 1.3.13 - Jan 19, 2026
    {
      id: 'gql-1-3-14-google-1-3-25-apple-1-3-13',
      date: new Date('2026-01-19'),
      element: (
        <div key="gql-1-3-14-google-1-3-25-apple-1-3-13" style={noteCardStyle}>
          <AnchorLink id="gql-1-3-14-google-1-3-25-apple-1-3-13" level="h4">
            📅 openiap-gql v1.3.14 / openiap-google v1.3.25 / openiap-apple v1.3.13 - Breaking Changes & Bug Fixes
          </AnchorLink>

          <p><strong>iOS - Subscription-Only Props Cleanup (Breaking Change):</strong></p>
          <p>
            Removed subscription-specific fields from <code>RequestPurchaseIosProps</code>. These fields now only exist in <code>RequestSubscriptionIosProps</code>.
          </p>
          <ul>
            <li><code>introductoryOfferEligibility</code> - Removed from <code>RequestPurchaseIosProps</code></li>
            <li><code>promotionalOfferJWS</code> - Removed from <code>RequestPurchaseIosProps</code></li>
            <li><code>winBackOffer</code> - Removed from <code>RequestPurchaseIosProps</code></li>
          </ul>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Migration: If using these fields for non-subscription purchases, move to <code>requestSubscription()</code> API.
          </p>

          <hr style={{ margin: '1rem 0', borderColor: 'var(--border-color)' }} />

          <p><strong>Known Issue - introductoryOfferEligibility API (Issue <a href="https://github.com/hyodotdev/openiap/issues/68" target="_blank" rel="noopener noreferrer">#68</a>):</strong></p>
          <p>
            The current <code>introductoryOfferEligibility</code> field uses <code>Boolean</code> type, but Apple's actual
            <a href="https://developer.apple.com/documentation/storekit/product/purchaseoption/introductoryoffereligibility(compactjws:)" target="_blank" rel="noopener noreferrer"> introductoryOfferEligibility(compactJWS:)</a> API
            requires a JWS string parameter, not a boolean.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            This will be corrected in a future release. The API signature will change from <code>Boolean</code> to <code>String</code> (JWS).
          </p>

          <hr style={{ margin: '1rem 0', borderColor: 'var(--border-color)' }} />

          <p><strong>Android - Fix displayPrice for Subscriptions with Free Trials:</strong></p>
          <p>
            Fixed an issue where <code>displayPrice</code> returned "Free" or "$0.00" for subscription products
            with free trials, instead of the actual base/recurring price.
          </p>
          <pre style={{ background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '0.25rem', fontSize: '0.875rem', overflow: 'auto' }}>
{`// Before (bug)
product.displayPrice  // "Free" or "$0.00"
product.price         // 0.0

// After (fixed)
product.displayPrice  // "$9.99" (base recurring price)
product.price         // 9.99

// Note: Free trial info is still available in subscriptionOffers
product.subscriptionOffers[0].displayPrice   // "$0.00"
product.subscriptionOffers[0].paymentMode    // "free-trial"`}
          </pre>

          <hr style={{ margin: '1rem 0', borderColor: 'var(--border-color)' }} />

          <p><strong>Apple v1.3.13 - Objective-C Bridge Updates:</strong></p>
          <p>
            Updated <code>OpenIapModule+ObjC.swift</code> to properly expose new Swift async functions to Objective-C.
            This is critical for <strong>kmp-iap</strong> and other platforms using Kotlin/Native cinterop.
          </p>
          <ul>
            <li>Added ObjC wrappers for new purchase option parameters</li>
            <li>Ensures all Swift async functions are callable from Kotlin Multiplatform</li>
          </ul>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Note: When updating iOS functions in OpenIapModule.swift, always update OpenIapModule+ObjC.swift as well.
            See <a href="https://github.com/hyodotdev/openiap/blob/main/knowledge/internal/04-platform-packages.md#objective-c-bridge-critical-for-kmp-iap" target="_blank" rel="noopener noreferrer">Objective-C Bridge Documentation</a>.
          </p>

          <p><strong>References:</strong></p>
          <ul>
            <li><a href="https://github.com/hyodotdev/openiap/issues/68" target="_blank" rel="noopener noreferrer">Issue #68 - introductoryOfferEligibility API Correction</a></li>
            <li><a href="/docs/types/purchase">Purchase Types Documentation</a></li>
          </ul>
        </div>
      ),
    },
    // GQL 1.3.13 / Google 1.3.24 / Apple 1.3.11 - Jan 18, 2026
    {
      id: 'gql-1-3-13-google-1-3-24-apple-1-3-11',
      date: new Date('2026-01-18'),
      element: (
        <div key="gql-1-3-13-google-1-3-24-apple-1-3-11" style={noteCardStyle}>
          <AnchorLink id="gql-1-3-13-google-1-3-24-apple-1-3-11" level="h4">
            📅 openiap-gql v1.3.13 / openiap-google v1.3.24 / openiap-apple v1.3.11 - Platform API Gap Analysis
          </AnchorLink>

          <p><strong>iOS - Win-Back Offers (iOS 18+):</strong></p>
          <p>
            Added support for <a href="https://developer.apple.com/documentation/storekit/product/subscriptionoffer" target="_blank" rel="noopener noreferrer">win-back offers</a> to re-engage churned subscribers.
          </p>
          <ul>
            <li><code>winBackOffer</code> - New field in <code>RequestPurchaseIosProps</code> and <code>RequestSubscriptionIosProps</code></li>
            <li><code>WinBackOfferInputIOS</code> - Input type with <code>offerId</code> field</li>
            <li><code>SubscriptionOfferTypeIOS.WinBack</code> - New enum value</li>
          </ul>
          <pre style={{ background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '0.25rem', fontSize: '0.875rem', overflow: 'auto' }}>
{`// Apply win-back offer to subscription purchase
requestSubscription({
  sku: 'premium_monthly',
  winBackOffer: { offerId: 'winback_50_off' }
});`}
          </pre>

          <p><strong>iOS - JWS Promotional Offers (iOS 15+, WWDC 2025):</strong></p>
          <p>
            New signature format using compact JWS string for promotional offers. Back-deployed to iOS 15.
          </p>
          <ul>
            <li><code>promotionalOfferJWS</code> - New field in purchase props</li>
            <li><code>PromotionalOfferJWSInputIOS</code> - Input type with <code>offerId</code> and <code>jws</code> fields</li>
          </ul>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Note: Requires Xcode 16.4+ to compile. Falls back to legacy signature-based offers until then.
          </p>

          <p><strong>iOS - Introductory Offer Eligibility Override (iOS 15+, WWDC 2025):</strong></p>
          <ul>
            <li><code>introductoryOfferEligibility</code> - Override system eligibility check for intro offers</li>
            <li>Set <code>true</code> to indicate eligible, <code>false</code> for not eligible, <code>nil</code> for system default</li>
          </ul>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Note: Requires Xcode 16.4+ to compile. System determines eligibility automatically until then.
          </p>

          <hr style={{ margin: '1rem 0', borderColor: 'var(--border-color)' }} />

          <p><strong>Android - Product Status Codes (Billing 8.0+):</strong></p>
          <p>
            Product-level status codes indicating why products couldn't be fetched.
          </p>
          <ul>
            <li><code>ProductStatusAndroid</code> - New enum with values: <code>Ok</code>, <code>NotFound</code>, <code>NoOffersAvailable</code>, <code>Unknown</code></li>
            <li><code>productStatusAndroid</code> - New field on <code>ProductAndroid</code> and <code>ProductSubscriptionAndroid</code></li>
          </ul>
          <pre style={{ background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '0.25rem', fontSize: '0.875rem', overflow: 'auto' }}>
{`// Check product fetch status
val product = fetchProducts(skus).firstOrNull()
when (product?.productStatusAndroid) {
    ProductStatusAndroid.Ok -> { /* Success */ }
    ProductStatusAndroid.NotFound -> { /* SKU doesn't exist */ }
    ProductStatusAndroid.NoOffersAvailable -> { /* User not eligible */ }
    ProductStatusAndroid.Unknown -> { /* Unknown status */ }
    null -> { /* No product or status */ }
}`}
          </pre>

          <p><strong>Android - Auto Service Reconnection:</strong></p>
          <p>
            <code>enableAutoServiceReconnection()</code> is now always enabled internally since OpenIAP uses Billing Library 8.3.0+.
            No configuration needed - the library automatically re-establishes connection if disconnected.
          </p>

          <p><strong>References:</strong></p>
          <ul>
            <li><a href="https://developer.apple.com/documentation/storekit/product/subscriptionoffer" target="_blank" rel="noopener noreferrer">Apple StoreKit 2 - SubscriptionOffer</a></li>
            <li><a href="https://developer.android.com/google/play/billing/release-notes#8-0-0" target="_blank" rel="noopener noreferrer">Google Play Billing 8.0.0 Release Notes</a></li>
            <li><a href="/docs/types/product">Product Types Documentation</a></li>
          </ul>
        </div>
      ),
    },
    // GQL 1.3.12 / Google 1.3.22 / Apple 1.3.10 - Jan 17, 2026
    {
      id: 'gql-1-3-12-google-1-3-22-apple-1-3-10',
      date: new Date('2026-01-17'),
      element: (
        <div key="gql-1-3-12-google-1-3-22-apple-1-3-10" style={noteCardStyle}>
          <AnchorLink id="gql-1-3-12-google-1-3-22-apple-1-3-10" level="h4">
            📅 openiap-gql v1.3.12 / openiap-google v1.3.22 / openiap-apple v1.3.10 - Standardized Offer Types
          </AnchorLink>

          <p><strong>New Cross-Platform Offer Types:</strong></p>
          <p>
            Introduced standardized <code>DiscountOffer</code> and <code>SubscriptionOffer</code> types
            for unified handling of discounts and subscription offers across iOS and Android.
          </p>

          <p><strong>DiscountOffer (One-time products):</strong></p>
          <ul>
            <li>Cross-platform type for one-time purchase discounts</li>
            <li>Android-specific fields use suffix: <code>offerTokenAndroid</code>, <code>fullPriceMicrosAndroid</code>, <code>percentageDiscountAndroid</code></li>
            <li>Replaces deprecated <code>ProductAndroidOneTimePurchaseOfferDetail</code></li>
          </ul>

          <p><strong>SubscriptionOffer:</strong></p>
          <ul>
            <li>Cross-platform type for subscription offers (introductory, promotional)</li>
            <li>Includes <code>paymentMode</code>: FreeTrial, PayAsYouGo, PayUpFront</li>
            <li>Android fields: <code>offerTokenAndroid</code>, <code>basePlanIdAndroid</code></li>
            <li>iOS fields: <code>signatureIOS</code>, <code>keyIdentifierIOS</code></li>
            <li>Replaces deprecated <code>ProductSubscriptionAndroidOfferDetails</code>, <code>DiscountOfferIOS</code>, <code>DiscountIOS</code></li>
          </ul>

          <p><strong>New Fields on Product Types:</strong></p>
          <pre style={{ background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '0.25rem', fontSize: '0.875rem', overflow: 'auto' }}>
{`// ProductAndroid & ProductIOS now include:
discountOffers: [DiscountOffer!]      // One-time product discounts
subscriptionOffers: [SubscriptionOffer!]  // Subscription offers`}
          </pre>

          <p><strong>PaymentMode Logic Fix (Android):</strong></p>
          <ul>
            <li>Fixed <code>determinePaymentMode</code> in BillingConverters</li>
            <li>Zero price → FreeTrial (regardless of recurrenceMode)</li>
            <li>NON_RECURRING (3) with paid → PayUpFront</li>
            <li>FINITE_RECURRING (2) / INFINITE_RECURRING (1) with paid → PayAsYouGo</li>
          </ul>

          <p><strong>Deprecated Types:</strong></p>
          <ul>
            <li>
              <code style={{ textDecoration: 'line-through' }}>ProductAndroidOneTimePurchaseOfferDetail</code>{' '}
              → Use <code>DiscountOffer</code>
            </li>
            <li>
              <code style={{ textDecoration: 'line-through' }}>ProductSubscriptionAndroidOfferDetails</code>{' '}
              → Use <code>SubscriptionOffer</code>
            </li>
            <li>
              <code style={{ textDecoration: 'line-through' }}>DiscountOfferIOS</code>{' '}
              → Use <code>SubscriptionOffer</code>
            </li>
            <li>
              <code style={{ textDecoration: 'line-through' }}>DiscountIOS</code>{' '}
              → Use <code>SubscriptionOffer</code>
            </li>
            <li>
              <code style={{ textDecoration: 'line-through' }}>oneTimePurchaseOfferDetailsAndroid</code> (field){' '}
              → Use <code>discountOffers</code>
            </li>
            <li>
              <code style={{ textDecoration: 'line-through' }}>subscriptionOfferDetailsAndroid</code> (field){' '}
              → Use <code>subscriptionOffers</code>
            </li>
          </ul>

          <p><strong>Migration Example:</strong></p>
          <pre style={{ background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '0.25rem', fontSize: '0.875rem', overflow: 'auto' }}>
{`// Before (deprecated)
val discount = product.oneTimePurchaseOfferDetailsAndroid?.firstOrNull()
val offerToken = discount?.offerToken

// After (recommended)
val discount = product.discountOffers?.firstOrNull()
val offerToken = discount?.offerTokenAndroid`}
          </pre>

          <p><strong>References:</strong></p>
          <ul>
            <li><a href="/docs/types/offer">Offer Types Documentation</a></li>
            <li><a href="/docs/features/discount">Discount Feature Guide</a></li>
          </ul>
        </div>
      ),
    },
    // GQL 1.3.11 / Google 1.3.20 / Apple 1.3.9 - Dec 28, 2025
    {
      id: 'gql-1-3-11-google-1-3-20-apple-1-3-9',
      date: new Date('2025-12-28'),
      element: (
        <div key="gql-1-3-11-google-1-3-21-apple-1-3-9" style={noteCardStyle}>
          <AnchorLink id="gql-1-3-11-google-1-3-21-apple-1-3-9" level="h4">
            📅 openiap-gql v1.3.11 / openiap-google v1.3.21 / openiap-apple v1.3.9 - PurchaseState Cleanup
          </AnchorLink>

          {/* PurchaseState Changes */}
          <p><strong>PurchaseState Simplified:</strong></p>
          <p>
            Removed unused <code>Failed</code>, <code>Restored</code>, and{' '}
            <code>Deferred</code> states from <code>PurchaseState</code> enum.
          </p>
          <pre style={{ background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '0.25rem', fontSize: '0.875rem', overflow: 'auto' }}>
{`// Before
enum PurchaseState {
  Pending, Purchased, Failed, Restored, Deferred, Unknown
}

// After
enum PurchaseState {
  Pending, Purchased, Unknown
}`}
          </pre>
          <p><strong>Why removed?</strong></p>
          <ul>
            <li>
              <code>Failed</code> - Both platforms return errors instead of Purchase objects on failure
            </li>
            <li>
              <code>Restored</code> - Restored purchases return as <code>Purchased</code> state
            </li>
            <li>
              <code>Deferred</code> - iOS StoreKit 2 has no transaction state; Android uses <code>Pending</code>
            </li>
          </ul>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Note: Apple StoreKit 1's{' '}
            <a
              href="https://developer.apple.com/documentation/storekit/skpaymenttransactionstate"
              target="_blank"
              rel="noopener noreferrer"
            >
              SKPaymentTransactionState
            </a>{' '}
            (purchasing, purchased, failed, restored, deferred) is fully deprecated. StoreKit 2 uses{' '}
            <a
              href="https://developer.apple.com/documentation/storekit/product/purchaseresult"
              target="_blank"
              rel="noopener noreferrer"
            >
              Product.PurchaseResult
            </a>{' '}
            instead, which only provides a <code>Transaction</code> on success.
          </p>
          <p><strong>References:</strong></p>
          <ul>
            <li>
              <a
                href="https://developer.android.com/reference/com/android/billingclient/api/Purchase.PurchaseState"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Play Billing - Purchase.PurchaseState
              </a>
            </li>
            <li>
              <a
                href="https://developer.apple.com/documentation/storekit/product/purchaseresult"
                target="_blank"
                rel="noopener noreferrer"
              >
                Apple StoreKit 2 - Product.PurchaseResult
              </a>
            </li>
            <li>
              <a
                href="https://developer.apple.com/documentation/storekit/skpaymenttransactionstate"
                target="_blank"
                rel="noopener noreferrer"
              >
                Apple StoreKit 1 - SKPaymentTransactionState (Deprecated)
              </a>
            </li>
          </ul>

          <hr style={{ margin: '1rem 0', borderColor: 'var(--border-color)' }} />

          <p>
            <strong>API Consolidation:</strong> Deprecated{' '}
            <code>AlternativeBillingModeAndroid</code> in favor of unified{' '}
            <code>BillingProgramAndroid</code> enum.
          </p>

          {/* GQL 1.3.11 Changes */}
          <p><strong>GQL v1.3.11 Other Changes:</strong></p>
          <ul>
            <li>
              <strong><code>BillingProgramAndroid.USER_CHOICE_BILLING</code></strong>{' '}
              - New enum value for User Choice Billing (7.0+)
            </li>
            <li>
              <code>AlternativeBillingModeAndroid</code> - <strong>Deprecated</strong>
            </li>
            <li>
              <code>InitConnectionConfig.alternativeBillingModeAndroid</code> - <strong>Deprecated</strong>
            </li>
            <li>
              <code>RequestPurchaseProps.useAlternativeBilling</code> - <strong>Deprecated</strong>{' '}
              (only logged debug info, had no effect on purchase flow)
            </li>
          </ul>

          {/* Google 1.3.21 Changes */}
          <p><strong>Google v1.3.21 Changes:</strong></p>
          <ul>
            <li>
              Updated <code>OpenIapModule.initConnection()</code> to handle{' '}
              <code>enableBillingProgramAndroid</code> config
            </li>
            <li>
              Maps <code>USER_CHOICE_BILLING</code> to internal AlternativeBillingMode.USER_CHOICE
            </li>
            <li>
              Maps <code>EXTERNAL_OFFER</code> to internal AlternativeBillingMode.ALTERNATIVE_ONLY
            </li>
            <li>
              Example app updated to use new API
            </li>
          </ul>

          <p><strong>Migration Guide:</strong></p>
          <table style={{ width: '100%', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.25rem' }}>Before (Deprecated)</th>
                <th style={{ textAlign: 'left', padding: '0.25rem' }}>After (Recommended)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '0.25rem' }}><code>alternativeBillingModeAndroid: USER_CHOICE</code></td>
                <td style={{ padding: '0.25rem' }}><code>enableBillingProgramAndroid: USER_CHOICE_BILLING</code></td>
              </tr>
              <tr>
                <td style={{ padding: '0.25rem' }}><code>alternativeBillingModeAndroid: ALTERNATIVE_ONLY</code></td>
                <td style={{ padding: '0.25rem' }}><code>enableBillingProgramAndroid: EXTERNAL_OFFER</code></td>
              </tr>
            </tbody>
          </table>
          <pre style={{ background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '0.25rem', fontSize: '0.875rem', overflow: 'auto' }}>
{`// Before (deprecated)
val config = InitConnectionConfig(
    alternativeBillingModeAndroid = AlternativeBillingModeAndroid.UserChoice
)

// After (recommended)
val config = InitConnectionConfig(
    enableBillingProgramAndroid = BillingProgramAndroid.UserChoiceBilling
)`}
          </pre>
        </div>
      ),
    },
    // Combined Release - Dec 28, 2025
    {
      id: 'release-dec-28-2025',
      date: new Date('2025-12-28'),
      element: (
        <div key="release-dec-28-2025" style={noteCardStyle}>
          <AnchorLink id="release-dec-28-2025" level="h4">
            📅 openiap-gql v1.3.10 / openiap-google v1.3.19 / openiap-apple v1.3.8 -{' '}
            <a
              href="https://developer.android.com/google/play/billing/release-notes#8-3-0"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Play Billing 8.3.0 External Payments
            </a>
          </AnchorLink>

          {/* GQL 1.3.10 */}
          <p>
            <strong>GQL v1.3.10 - InitConnectionConfig Enhancement:</strong>
          </p>
          <p>
            Added <code>enableBillingProgramAndroid</code> field to{' '}
            <code>InitConnectionConfig</code> for easier billing program setup during connection initialization.
          </p>
          <ul>
            <li>
              <strong>
                <code>enableBillingProgramAndroid: BillingProgramAndroid</code>
              </strong>{' '}
              - Enable a specific billing program during <code>initConnection()</code>
            </li>
          </ul>
          <pre style={{ background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '0.25rem', fontSize: '0.875rem', overflow: 'auto' }}>
{`// Enable External Payments during connection
val config = InitConnectionConfig(
    enableBillingProgramAndroid = BillingProgramAndroid.ExternalPayments
)
iapStore.initConnection(config)`}
          </pre>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            This provides a cleaner alternative to calling <code>enableBillingProgram()</code>{' '}
            separately before <code>initConnection()</code>.
          </p>

          <hr style={{ margin: '1rem 0', borderColor: 'var(--border-color)' }} />

          {/* Apple 1.3.8 */}
          <p>
            <strong>Apple v1.3.8 - Auto Connection Management:</strong>
          </p>
          <p>
            All API methods now automatically call <code>initConnection()</code> internally
            if the connection hasn't been established yet. This eliminates the need to
            manually call <code>initConnection()</code> before using any API.
          </p>
          <ul>
            <li>
              <strong><code>ensureConnection()</code></strong> - New internal helper that automatically initializes the connection when needed
            </li>
            <li>
              All public API methods (<code>fetchProducts</code>, <code>requestPurchase</code>,{' '}
              <code>finishTransaction</code>, etc.) now use <code>ensureConnection()</code>
            </li>
            <li>
              <strong>Backward Compatible</strong> - Existing code that calls{' '}
              <code>initConnection()</code> explicitly will continue to work
            </li>
          </ul>
          <p><strong>Before (v1.3.7):</strong></p>
          <pre style={{ background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '0.25rem', fontSize: '0.875rem', overflow: 'auto' }}>
{`// Must call initConnection first
try await OpenIapModule.shared.initConnection()
let products = try await OpenIapModule.shared.fetchProducts(request)`}
          </pre>
          <p><strong>After (v1.3.8):</strong></p>
          <pre style={{ background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '0.25rem', fontSize: '0.875rem', overflow: 'auto' }}>
{`// Just call the API directly - connection is handled automatically
let products = try await OpenIapModule.shared.fetchProducts(request)`}
          </pre>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Note: While explicit <code>initConnection()</code> is no longer required,
            you may still want to call it during app startup to pre-initialize the
            StoreKit connection for faster subsequent API calls.
          </p>

          <hr style={{ margin: '1rem 0', borderColor: 'var(--border-color)' }} />

          {/* Google 1.3.19 - External Payments */}
          <p>
            <strong>Google v1.3.19 - External Payments Program (Japan Only):</strong>
          </p>
          <p>
            Google Play Billing Library 8.3.0 introduces the External Payments
            program, which presents a side-by-side choice between Google Play
            Billing and the developer's external payment option directly in the
            purchase flow.
          </p>
          <p><strong>New APIs:</strong></p>
          <ul>
            <li>
              <strong><code>BillingProgramAndroid.EXTERNAL_PAYMENTS</code></strong>{' '}
              - New billing program type for external payments
            </li>
            <li>
              <strong><code>DeveloperBillingOptionParamsAndroid</code></strong>{' '}
              - Configure external payment option in purchase flow
            </li>
            <li>
              <strong><code>DeveloperBillingLaunchModeAndroid</code></strong>{' '}
              - How to launch the external payment link
            </li>
            <li>
              <strong><code>DeveloperProvidedBillingDetailsAndroid</code></strong>{' '}
              - Contains externalTransactionToken when user selects developer billing
            </li>
            <li>
              <strong><code>developerProvidedBillingListenerAndroid</code></strong>{' '}
              - New listener for when user selects developer billing
            </li>
            <li>
              <strong><code>developerBillingOptionAndroid</code></strong>{' '}
              - New field in RequestPurchaseAndroidProps and RequestSubscriptionAndroidProps
            </li>
          </ul>
          <p><strong>New Event:</strong></p>
          <ul>
            <li>
              <strong><code>IapEvent.DeveloperProvidedBillingAndroid</code></strong>{' '}
              - Fired when user selects developer billing in External Payments flow
            </li>
          </ul>
          <p><strong>Key Differences from User Choice Billing:</strong></p>
          <table style={{ width: '100%', fontSize: '0.875rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.25rem' }}>Feature</th>
                <th style={{ textAlign: 'left', padding: '0.25rem' }}>User Choice Billing</th>
                <th style={{ textAlign: 'left', padding: '0.25rem' }}>External Payments</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '0.25rem' }}>Billing Library</td>
                <td style={{ padding: '0.25rem' }}>7.0+</td>
                <td style={{ padding: '0.25rem' }}>8.3.0+</td>
              </tr>
              <tr>
                <td style={{ padding: '0.25rem' }}>Availability</td>
                <td style={{ padding: '0.25rem' }}>Eligible regions</td>
                <td style={{ padding: '0.25rem' }}>Japan only</td>
              </tr>
              <tr>
                <td style={{ padding: '0.25rem' }}>UI</td>
                <td style={{ padding: '0.25rem' }}>Separate dialog</td>
                <td style={{ padding: '0.25rem' }}>Side-by-side in purchase dialog</td>
              </tr>
            </tbody>
          </table>
          <p><strong>References:</strong></p>
          <ul>
            <li>
              <a
                href="https://developer.android.com/google/play/billing/externalpaymentlinks"
                target="_blank"
                rel="noopener noreferrer"
              >
                External Payment Links Documentation
              </a>
            </li>
            <li>
              <a href="/docs/features/external-purchase#external-payments-830---japan-only">
                External Payments Implementation Guide
              </a>
            </li>
            <li>
              <a href="/docs/events#developer-provided-billing-event-android">
                DeveloperProvidedBilling Event
              </a>
            </li>
            <li>
              <a href="/docs/types/alternative#billing-programs">
                Billing Programs Types
              </a>
            </li>
          </ul>
        </div>
      ),
    },

    // v1.3.16 Billing Library 8.2.1 - Dec 24, 2025
    {
      id: 'v1.3.16-billing-821',
      date: new Date('2025-12-24'),
      element: (
        <div key="v1.3.16-billing-821" style={noteCardStyle}>
          <AnchorLink id="v1.3.16-billing-821" level="h4">
            📅 openiap-google v1.3.16 -{' '}
            <a
              href="https://developer.android.com/google/play/billing/release-notes#8-2-1"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Play Billing 8.2.1
            </a>
          </AnchorLink>
          <p>
            <strong>Billing Library Upgrade: 8.1.0 → 8.2.1</strong>
          </p>
          <p>
            Upgraded to Google Play Billing Library 8.2.1 which includes the new
            Billing Programs API and bug fixes.
          </p>
          <p>
            <strong>Why 8.2.1 instead of 8.2.0?</strong>
          </p>
          <p>
            Version 8.2.0 had a bug in <code>isBillingProgramAvailableAsync</code>{' '}
            and <code>createBillingProgramReportingDetailsAsync</code>. This was
            fixed in 8.2.1 (released 2025-12-15).
          </p>
          <p>
            <strong>New APIs for External Content Links and External Offers:</strong>
          </p>
          <ul>
            <li>
              <strong>
                <code>enableBillingProgram()</code>
              </strong>{' '}
              - Setup BillingClient for billing programs before{' '}
              <code>initConnection()</code>
            </li>
            <li>
              <strong>
                <code>isBillingProgramAvailableAsync()</code>
              </strong>{' '}
              - Determine user eligibility for the billing program
            </li>
            <li>
              <strong>
                <code>createBillingProgramReportingDetailsAsync()</code>
              </strong>{' '}
              - Create external transaction token for reporting
            </li>
            <li>
              <strong>
                <code>launchExternalLink()</code>
              </strong>{' '}
              - Initiate external link to digital content offer or app download
            </li>
          </ul>
          <p>
            <strong>Deprecated External Offers APIs:</strong>
          </p>
          <ul>
            <li>
              <code style={{ textDecoration: 'line-through' }}>
                enableExternalOffer()
              </code>{' '}
              → Use <code>enableBillingProgram(BillingProgramAndroid.ExternalOffer)</code>
            </li>
            <li>
              <code style={{ textDecoration: 'line-through' }}>
                isExternalOfferAvailableAsync()
              </code>{' '}
              → Use <code>isBillingProgramAvailable(BillingProgramAndroid.ExternalOffer)</code>
            </li>
            <li>
              <code style={{ textDecoration: 'line-through' }}>
                createExternalOfferReportingDetailsAsync()
              </code>{' '}
              → Use <code>createBillingProgramReportingDetails()</code>
            </li>
            <li>
              <code style={{ textDecoration: 'line-through' }}>
                showExternalOfferInformationDialog()
              </code>{' '}
              → Use <code>launchExternalLink()</code>
            </li>
          </ul>
          <p>
            <strong>References:</strong>
          </p>
          <ul>
            <li>
              <a
                href="https://developer.android.com/google/play/billing/release-notes#8-2-0"
                target="_blank"
                rel="noopener noreferrer"
              >
                Billing Library 8.2.0 Release Notes
              </a>{' '}
              - New Billing Programs API
            </li>
            <li>
              <a
                href="https://developer.android.com/google/play/billing/release-notes#8-2-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                Billing Library 8.2.1 Release Notes
              </a>{' '}
              - Bug fixes for isBillingProgramAvailableAsync and createBillingProgramReportingDetailsAsync
            </li>
            <li>
              <a href="/docs/features/external-purchase">External Purchase Guide</a>
            </li>
          </ul>
        </div>
      ),
    },

    // v1.3.8 Kotlin null-safe casting - Dec 24, 2025
    {
      id: 'v1.3.8-kotlin-null-safe',
      date: new Date('2025-12-24'),
      element: (
        <div key="v1.3.8-kotlin-null-safe" style={noteCardStyle}>
          <AnchorLink id="v1.3.8-kotlin-null-safe" level="h4">
            📅 openiap-gql v1.3.8
          </AnchorLink>
          <p>
            <strong>Kotlin Type Generation: Null-Safe Casting</strong>
          </p>
          <p>
            Fixed potential <code>TypeCastException</code> in generated Kotlin
            types by using safe casts (<code>as?</code>) instead of unsafe casts
            (<code>as</code>).
          </p>
          <ul>
            <li>
              Lists now use <code>mapNotNull</code> with safe element casting
            </li>
            <li>
              Non-nullable fields provide sensible defaults (empty string,
              false, 0, emptyList)
            </li>
            <li>
              Prevents crashes when JSON keys are missing or contain unexpected
              null values
            </li>
          </ul>
          <p>
            <strong>Before (unsafe):</strong>
          </p>
          <CodeBlock language="kotlin">
            {`offerTags = (json["offerTags"] as List<*>).map { it as String }
offerToken = json["offerToken"] as String`}
          </CodeBlock>
          <p>
            <strong>After (null-safe):</strong>
          </p>
          <CodeBlock language="kotlin">
            {`offerTags = (json["offerTags"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
offerToken = json["offerToken"] as? String ?: ""`}
          </CodeBlock>
        </div>
      ),
    },

    // v1.3.7 Advanced Commerce Data - Dec 23, 2025
    {
      id: 'v1.3.7-advanced-commerce',
      date: new Date('2025-12-23'),
      element: (
        <div key="v1.3.7-advanced-commerce" style={noteCardStyle}>
          <AnchorLink id="v1.3.7-advanced-commerce" level="h4">
            📅 openiap-gql v1.3.7 / openiap-apple v1.3.7 / openiap-google v1.3.15
          </AnchorLink>
          <p>
            <strong>New Feature: Advanced Commerce Data</strong>
          </p>
          <p>
            Added support for{' '}
            <a
              href="https://developer.apple.com/documentation/storekit/product/purchaseoption/custom(key:value:)"
              target="_blank"
              rel="noopener noreferrer"
            >
              StoreKit 2's Product.PurchaseOption.custom API
            </a>{' '}
            to pass attribution data during purchases.
          </p>
          <ul>
            <li>
              <strong>
                <code>advancedCommerceData</code>
              </strong>{' '}
              - New optional field in <code>RequestPurchaseIosProps</code> and{' '}
              <code>RequestSubscriptionIosProps</code>
            </li>
            <li>
              Enables passing campaign tokens, affiliate IDs, and other
              attribution data to StoreKit during purchase
            </li>
            <li>
              Data is formatted as JSON:{' '}
              <code>{`{"signatureInfo": {"token": "<value>"}}`}</code>
            </li>
          </ul>
          <p>
            <strong>Usage:</strong>
          </p>
          <CodeBlock language="typescript">
            {`requestPurchase({
  request: {
    apple: {
      sku: 'com.example.premium',
      advancedCommerceData: 'campaign_summer_2025',
    }
  },
  type: 'in-app'
});`}
          </CodeBlock>
          <p>
            <strong>Use Cases:</strong>
          </p>
          <ul>
            <li>Campaign attribution tracking</li>
            <li>Affiliate marketing integration</li>
            <li>Promotional code tracking</li>
          </ul>
          <p>
            Reference:{' '}
            <a
              href="https://github.com/hyochan/react-native-iap/pull/3106"
              target="_blank"
              rel="noopener noreferrer"
            >
              react-native-iap PR #3106
            </a>
          </p>
          <p>
            <strong>
              Deprecated:{' '}
              <code style={{ textDecoration: 'line-through' }}>
                requestPurchaseOnPromotedProductIOS()
              </code>
            </strong>
          </p>
          <p>
            The{' '}
            <code style={{ textDecoration: 'line-through' }}>
              requestPurchaseOnPromotedProductIOS()
            </code>{' '}
            API is now deprecated. In StoreKit 2, promoted products can be
            purchased directly via the standard <code>requestPurchase()</code>{' '}
            flow.
          </p>
          <ul>
            <li>
              Use <code>promotedProductListenerIOS</code> to receive the product
              ID when a user taps a promoted product in the App Store
            </li>
            <li>
              Call <code>requestPurchase()</code> with the received SKU directly
            </li>
          </ul>
          <CodeBlock language="typescript">
            {`// Recommended approach
promotedProductListenerIOS(async (productId) => {
  await requestPurchase({
    request: { apple: { sku: productId } },
    type: 'in-app'
  });
});`}
          </CodeBlock>
          <p>
            <strong>
              Android: Support for `google` field (openiap-google v1.3.15)
            </strong>
          </p>
          <p>
            The Android library now supports the <code>google</code> field in
            request parameters, with fallback to the deprecated{' '}
            <code style={{ textDecoration: 'line-through' }}>android</code>{' '}
            field for backward compatibility.
          </p>
          <CodeBlock language="kotlin">
            {`// Recommended (new)
requestPurchase(RequestPurchaseProps(
    request = RequestPurchaseProps.Request.Purchase(
        RequestPurchasePropsByPlatforms(
            google = RequestPurchaseAndroidProps(skus = listOf("sku_id"))
        )
    ),
    type = ProductQueryType.InApp
))

// Still supported (deprecated)
requestPurchase(RequestPurchaseProps(
    request = RequestPurchaseProps.Request.Purchase(
        RequestPurchasePropsByPlatforms(
            android = RequestPurchaseAndroidProps(skus = listOf("sku_id"))
        )
    ),
    type = ProductQueryType.InApp
))`}
          </CodeBlock>
        </div>
      ),
    },

    // v1.3.5 Tag Management - Dec 16, 2025
    {
      id: 'v1.3.5-tag',
      date: new Date('2025-12-16'),
      element: (
        <div key="v1.3.5-tag" style={noteCardStyle}>
          <AnchorLink id="v1.3.5-tag" level="h4">
            📅 openiap-gql v1.3.5 / openiap-apple v1.3.5 - GitHub Release Tag Management Update
          </AnchorLink>
          <p>
            <strong>GitHub Release Tag Naming Convention:</strong>
          </p>
          <p>
            No API changes in this release. This update focuses on GitHub
            release tag management for better Swift Package Manager (SPM)
            compatibility.
          </p>
          <ul>
            <li>
              <strong>Apple (openiap-apple)</strong>: Uses semantic version tags
              directly (e.g., <code>1.3.5</code>) - Required for SPM to
              recognize package versions
            </li>
            <li>
              <strong>GQL (openiap-gql)</strong>: Uses <code>gql-</code> prefix
              (e.g., <code>gql-1.3.5</code>)
            </li>
            <li>
              <strong>Google (openiap-google)</strong>: Uses{' '}
              <code>google-</code> prefix (e.g., <code>google-1.3.5</code>)
            </li>
          </ul>
          <p>
            <strong>Swift Package Manager Integration:</strong>
          </p>
          <p>
            <a
              href="https://docs.swift.org/swiftpm/documentation/packagemanagerdocs/"
              target="_blank"
              rel="noopener noreferrer"
            >
              SPM
            </a>{' '}
            requires semver-only tags (without prefixes) to properly resolve
            package versions. The Apple package now uses direct version tags
            (e.g., <code>1.3.5</code>) instead of prefixed tags (e.g.,{' '}
            <code>apple-v1.3.5</code>).
          </p>
        </div>
      ),
    },

    // v1.3.4 Platform-Specific Verification - Dec 10, 2025
    {
      id: 'v1.3.4-verify',
      date: new Date('2025-12-10'),
      element: (
        <div key="v1.3.4-verify" style={noteCardStyle}>
          <AnchorLink id="v1.3.4-verify" level="h4">
            📅 openiap-gql v1.3.4 / openiap-google v1.3.14 / openiap-apple v1.3.2 - Platform-Specific Verification Options
          </AnchorLink>
          <p>
            <strong>verifyPurchase API Refactored (Breaking Change):</strong>
          </p>
          <p>
            The <code>verifyPurchase</code> API now requires platform-specific
            options for Apple, Google, and Meta Horizon stores. The{' '}
            <code>sku</code> field has been moved inside each platform-specific
            options object.
          </p>
          <ul>
            <li>
              <strong>
                <code>VerifyPurchaseAppleOptions</code>
              </strong>{' '}
              - Apple App Store verification with sku
            </li>
            <li>
              <strong>
                <code>VerifyPurchaseGoogleOptions</code>
              </strong>{' '}
              - Google Play verification with sku, packageName, purchaseToken,
              and accessToken
            </li>
            <li>
              <strong>
                <code>VerifyPurchaseHorizonOptions</code>
              </strong>{' '}
              - Meta Horizon (Quest) verification via S2S API with sku, userId,
              and accessToken
            </li>
          </ul>
          <p>
            <strong>New VerifyPurchaseProps Structure:</strong>
          </p>
          <CodeBlock language="typescript">
            {`// Platform-specific verification
verifyPurchase({
  apple: { sku: 'premium_monthly' },     // iOS App Store
  google: {                              // Google Play
    sku: 'premium_monthly',
    packageName: 'com.example.app',
    purchaseToken: 'token...',
    accessToken: 'oauth_token...',
    isSub: true
  },
  horizon: {                             // Meta Quest
    sku: '50_gems',
    userId: '123456789',
    accessToken: 'OC|app_id|app_secret'
  }
})`}
          </CodeBlock>
          <p>
            <strong>Breaking Changes:</strong>
          </p>
          <ul>
            <li>
              <code>sku</code> removed from <code>VerifyPurchaseProps</code>{' '}
              root level → Now inside each platform options
            </li>
            <li>
              <code>androidOptions</code> completely removed → Use{' '}
              <code>google</code> instead
            </li>
          </ul>
          <p>
            See: <a href="/docs/apis#verify-purchase">verifyPurchase API</a>,{' '}
            <a href="/docs/types#verify-purchase-props">VerifyPurchaseProps</a>
          </p>
        </div>
      ),
    },

    // v1.3.12 Billing Programs API - Dec 5, 2025
    {
      id: 'v1.3.12-billing',
      date: new Date('2025-12-05'),
      element: (
        <div key="v1.3.12-billing" style={noteCardStyle}>
          <AnchorLink id="v1.3.12-billing" level="h4">
            📅 openiap-google v1.3.12 / openiap-gql v1.3.2 -{' '}
            <a
              href="https://developer.android.com/google/play/billing/release-notes#8-2-0"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Play Billing 8.2.0
            </a>{' '}
            Billing Programs API
          </AnchorLink>
          <p>
            <strong>New Billing Programs API (8.2.0+):</strong>
          </p>
          <ul>
            <li>
              <strong>
                <code>enableBillingProgram()</code>
              </strong>{' '}
              - Enable a billing program before <code>initConnection()</code>
            </li>
            <li>
              <strong>
                <code>isBillingProgramAvailable()</code>
              </strong>{' '}
              - Check if a billing program is available (replaces{' '}
              <code>checkAlternativeBillingAvailability()</code>)
            </li>
            <li>
              <strong>
                <code>createBillingProgramReportingDetails()</code>
              </strong>{' '}
              - Create reporting details with token (replaces{' '}
              <code>createAlternativeBillingReportingToken()</code>)
            </li>
            <li>
              <strong>
                <code>launchExternalLink()</code>
              </strong>{' '}
              - Launch external link for external offers (replaces{' '}
              <code>showAlternativeBillingInformationDialog()</code>)
            </li>
          </ul>
          <p>
            <strong>Deprecated APIs:</strong>
          </p>
          <ul>
            <li>
              <code style={{ textDecoration: 'line-through' }}>
                checkAlternativeBillingAvailability()
              </code>{' '}
              → Use <code>isBillingProgramAvailable()</code>
            </li>
            <li>
              <code style={{ textDecoration: 'line-through' }}>
                showAlternativeBillingInformationDialog()
              </code>{' '}
              → Use <code>launchExternalLink()</code>
            </li>
            <li>
              <code style={{ textDecoration: 'line-through' }}>
                createAlternativeBillingReportingToken()
              </code>{' '}
              → Use <code>createBillingProgramReportingDetails()</code>
            </li>
          </ul>
          <p>
            See:{' '}
            <a href="/docs/features/external-purchase">
              External Purchase Guide
            </a>
            ,{' '}
            <a href="/docs/features/subscription-upgrade-downgrade">
              Subscription Upgrade/Downgrade
            </a>
          </p>
        </div>
      ),
    },

    // v1.3.11 Billing 8.1.0 Support - Nov 15, 2025
    {
      id: 'v1.3.11-billing',
      date: new Date('2025-11-15'),
      element: (
        <div key="v1.3.11-billing" style={noteCardStyle}>
          <AnchorLink id="v1.3.11-billing" level="h4">
            📅 openiap-google v1.3.11 / openiap-gql v1.3.1 -{' '}
            <a
              href="https://developer.android.com/google/play/billing/release-notes#8-1-0"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Play Billing 8.1.0
            </a>{' '}
            Support
          </AnchorLink>
          <p>
            <strong>Google Play Billing Library Upgrade:</strong>
          </p>
          <ul>
            <li>
              <strong>Billing Library 8.0.0 → 8.1.0</strong> - Upgraded to
              latest Google Play Billing Library
            </li>
            <li>
              <strong>minSdk 21 → 23</strong> - Minimum SDK increased to Android
              6.0 (Marshmallow) as required by Billing Library 8.1.0
            </li>
            <li>
              <strong>Kotlin 2.0.21 → 2.2.0</strong> - Upgraded Kotlin version
              for compatibility
            </li>
          </ul>
          <p>
            <strong>New Features:</strong>
          </p>
          <ul>
            <li>
              <strong>isSuspendedAndroid</strong> - New field on{' '}
              <code>PurchaseAndroid</code> to detect suspended subscriptions due
              to payment failures.
            </li>
            <li>
              <strong>PreorderDetailsAndroid</strong> - New type for pre-order
              products.
            </li>
            <li>
              <strong>oneTimePurchaseOfferDetailsAndroid</strong> - Changed from
              single object to array type.
            </li>
          </ul>
          <p>
            See:{' '}
            <a href="/docs/types#purchase-platform">Purchase Platform Fields</a>
            , <a href="/docs/types#product-platform">Product Platform Fields</a>
          </p>
        </div>
      ),
    },

    // v1.3.0 Platform Props - Oct 15, 2025
    {
      id: 'v1.3.0-platform',
      date: new Date('2025-10-15'),
      element: (
        <div key="v1.3.0-platform" style={noteCardStyle}>
          <AnchorLink id="v1.3.0-platform" level="h4">
            📅 openiap v1.3.0 - Platform Props & Store Field Updates
          </AnchorLink>
          <p>
            <strong>Breaking Changes:</strong>
          </p>
          <ul>
            <li>
              <strong>
                <code style={{ textDecoration: 'line-through' }}>
                  Purchase.platform
                </code>{' '}
                → Purchase.store
              </strong>{' '}
              - The{' '}
              <code style={{ textDecoration: 'line-through' }}>platform</code>{' '}
              field is deprecated. Use <code>store</code> instead which returns{' '}
              <code>'apple'</code> or <code>'google'</code>.
            </li>
            <li>
              <strong>requestPurchase props</strong> - The{' '}
              <code style={{ textDecoration: 'line-through' }}>ios</code> and{' '}
              <code style={{ textDecoration: 'line-through' }}>android</code>{' '}
              props are deprecated. Use <code>apple</code> and{' '}
              <code>google</code> instead.
            </li>
          </ul>
          <p>
            <strong>New Feature:</strong>
          </p>
          <ul>
            <li>
              <strong>verifyPurchaseWithProvider</strong> - New API for purchase
              verification with external providers like IAPKit.
            </li>
          </ul>
          <p>
            See:{' '}
            <a href="/docs/apis#verify-purchase-with-provider">
              verifyPurchaseWithProvider API
            </a>
          </p>
        </div>
      ),
    },

    // v1.2.6 validateReceipt → verifyPurchase - Sep 20, 2025
    {
      id: 'v1.2.6-verify',
      date: new Date('2025-09-20'),
      element: (
        <div key="v1.2.6-verify" style={noteCardStyle}>
          <AnchorLink id="v1.2.6-verify" level="h4">
            📅 openiap v1.2.6 - validateReceipt → verifyPurchase
          </AnchorLink>
          <p>
            Starting from <strong>openiap v1.2.6</strong>, the{' '}
            <code style={{ textDecoration: 'line-through' }}>
              validateReceipt
            </code>{' '}
            API is deprecated in favor of <code>verifyPurchase</code>.
          </p>
          <p>
            <strong>Why the change?</strong>
          </p>
          <ul>
            <li>
              <strong>Terminology alignment</strong> - "Receipt Validation" was
              Apple's legacy term from StoreKit 1.
            </li>
            <li>
              <strong>Cross-platform consistency</strong> - Android never used
              "receipt" terminology.
            </li>
            <li>
              <strong>Modern API design</strong> - Unified interface that works
              consistently across iOS and Android.
            </li>
          </ul>
          <p>
            See:{' '}
            <a href="/docs/lifecycle#purchase-verification">
              Purchase Verification
            </a>
            , <a href="/docs/apis#verify-purchase">verifyPurchase API</a>
          </p>
        </div>
      ),
    },

    // v1.2.0 Version Alignment - Sep 1, 2025
    {
      id: 'v1.2.0-alignment',
      date: new Date('2025-09-01'),
      element: (
        <div key="v1.2.0-alignment" style={noteCardStyle}>
          <AnchorLink id="v1.2.0-alignment" level="h4">
            📅 openiap v1.2.0 - Version Alignment & Alternative Billing
          </AnchorLink>
          <p>
            Version jumped directly from <strong>1.0.12</strong> to{' '}
            <strong>1.2.0</strong> to align with native libraries (iOS/Android)
            that were evolving rapidly.
          </p>
          <ul>
            <li>
              <strong>iOS External Purchase</strong> - StoreKit External
              Purchase API support
            </li>
            <li>
              <strong>Android Alternative Billing</strong> - Google Play
              Alternative Billing support
            </li>
          </ul>
          <p style={{ margin: 0 }}>
            See:{' '}
            <a href="/docs/features/external-purchase">
              External Purchase Guide
            </a>
          </p>
        </div>
      ),
    },

    // openiap-gql 1.0.12 - External Purchase Support - Aug 25, 2025
    {
      id: 'gql-1.0.12-external',
      date: new Date('2025-08-25'),
      element: (
        <div key="gql-1.0.12-external" style={noteCardStyle}>
          <AnchorLink id="gql-1.0.12-external" level="h4">
            📅 openiap-gql 1.0.12 - External Purchase Support
          </AnchorLink>
          <p>
            External purchase/alternative billing support for iOS and Android.
          </p>
          <ul>
            <li>
              <strong>iOS External Purchase</strong> - StoreKit External
              Purchase API support (iOS 15.4+, iOS 18.2+ recommended)
            </li>
            <li>
              <strong>Android Alternative Billing</strong> - Google Play
              Alternative Billing support (Billing Library 6.2+/7.0+)
            </li>
            <li>
              <code>canPresentExternalPurchaseNoticeIOS()</code>,{' '}
              <code>presentExternalPurchaseNoticeSheetIOS()</code>,{' '}
              <code>presentExternalPurchaseLinkIOS()</code> - iOS 18.2+ APIs
            </li>
          </ul>
          <p>
            See:{' '}
            <a href="/docs/features/external-purchase">
              External Purchase Guide
            </a>
            ,{' '}
            <a href="/docs/events#user-choice-billing-event-android">
              User Choice Billing Event
            </a>
          </p>
        </div>
      ),
    },

    // Subscription Status APIs - Aug 15, 2025
    {
      id: 'subscription-status-apis',
      date: new Date('2025-08-15'),
      element: (
        <div key="subscription-status-apis" style={noteCardStyle}>
          <AnchorLink id="subscription-status-apis" level="h4">
            📅 August 2025 - Subscription Status APIs
          </AnchorLink>
          <p>
            New standardized APIs for checking subscription status across
            platforms.
          </p>
          <ul>
            <li>
              <code>getActiveSubscriptions()</code> - Get detailed information
              about active subscriptions
            </li>
            <li>
              <code>hasActiveSubscriptions()</code> - Simple boolean check for
              subscription status
            </li>
            <li>
              Automatic detection of all active subscriptions without requiring
              product IDs
            </li>
            <li>
              Platform-specific details (iOS expiration dates, Android
              auto-renewal status)
            </li>
          </ul>
        </div>
      ),
    },

    // Billing Library v5 Deprecated - Aug 31, 2024
    {
      id: 'billing-v5-deprecated',
      date: new Date('2024-08-31'),
      element: (
        <div key="billing-v5-deprecated" style={noteCardStyle}>
          <AnchorLink id="billing-v5-deprecated" level="h4">
            📅 August 31, 2024 - Billing Library v5 Deprecated
          </AnchorLink>
          <p>All apps must use Google Play Billing Library v6.0.1 or later.</p>
          <ul>
            <li>
              Migration deadline: August 31, 2024 (extended to November 1, 2024)
            </li>
            <li>New apps must use v6+ immediately</li>
            <li>Existing apps must update before deadline</li>
          </ul>
        </div>
      ),
    },
  ];

  // Sort by date (newest first)
  const sortedNotes = [...allNotes].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  const itemsPerPage = 5;

  // Calculate initial page based on URL hash
  const initialPage = useMemo(() => {
    const hashId = getHashId();
    if (!hashId) return 1;

    const noteIndex = sortedNotes.findIndex((note) => note.id === hashId);
    if (noteIndex === -1) return 1;

    return Math.floor(noteIndex / itemsPerPage) + 1;
  }, [sortedNotes]);

  return (
    <div className="doc-page">
      <SEO
        title="Notes"
        description="Important changes and deprecations in IAP libraries and platforms - API changes, breaking changes, validateReceipt to verifyPurchase migration, and guides."
        path="/docs/updates/notes"
        keywords="IAP updates, validateReceipt, verifyPurchase, receipt validation, purchase verification, migration guide"
      />
      <h1>Notes</h1>
      <p>Important changes and deprecations in IAP libraries and platforms.</p>

      <Pagination itemsPerPage={itemsPerPage} initialPage={initialPage}>
        {sortedNotes.map((note) => (
          <section key={note.id}>{note.element}</section>
        ))}
      </Pagination>
    </div>
  );
}

export default Notes;
