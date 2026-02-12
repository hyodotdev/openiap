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
    // Apple 1.3.15 - Feb 12, 2026
    {
      id: 'apple-1-3-15',
      date: new Date('2026-02-12'),
      element: (
        <div key="apple-1-3-15" style={noteCardStyle}>
          <AnchorLink id="apple-1-3-15" level="h4">
            📅 openiap-apple v1.3.15 - iOS 15 Compatibility & watchOS Support
          </AnchorLink>

          <p style={{ marginTop: '0.75rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            Fixed iOS 15 compatibility for currency code retrieval, unified platform availability annotations, and added watchOS support.
          </p>

          {/* Section 1: iOS 15 Compatibility */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              1. iOS 15 Compatibility Fix
            </h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Fixed potential crash when using <code>priceFormatStyle.currencyCode</code> on iOS 15 devices.
              Now uses <code>product.priceFormatStyle.locale.currencyCode</code> as fallback to get the correct App Store currency.
            </p>
            <CodeBlock language="swift">{`// iOS 16+: Direct API
product.priceFormatStyle.currencyCode

// iOS 15: Fallback using product's locale
product.priceFormatStyle.locale.currencyCode`}</CodeBlock>
          </div>

          {/* Section 2: watchOS Support */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              2. watchOS Support Added
            </h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Added <code>watchOS 8.0+</code> deployment target to podspec and unified all <code>@available</code> annotations.
            </p>
            <CodeBlock language="swift">{`@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)`}</CodeBlock>
          </div>

          {/* Section 3: Documentation Links */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              3. Apple Documentation Links
            </h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Added <code>SeeAlso</code> documentation links to all main types for easier navigation to Apple's official StoreKit documentation.
            </p>
          </div>

          {/* References */}
          <details open style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600', color: 'var(--text-secondary)' }}>References</summary>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
              <li><a href="https://developer.apple.com/documentation/storekit/product" target="_blank" rel="noopener noreferrer">StoreKit Product Documentation</a></li>
              <li><a href="https://developer.apple.com/documentation/storekit/in-app_purchase" target="_blank" rel="noopener noreferrer">In-App Purchase Documentation</a></li>
              <li><a href="https://github.com/hyodotdev/openiap/pull/80" target="_blank" rel="noopener noreferrer">PR #80</a></li>
            </ul>
          </details>
        </div>
      ),
    },
    // GQL 1.3.17 / Google 1.3.28 - Feb 11, 2026
    {
      id: 'gql-1-3-17-google-1-3-28',
      date: new Date('2026-02-11'),
      element: (
        <div key="gql-1-3-17-google-1-3-28" style={noteCardStyle}>
          <AnchorLink id="gql-1-3-17-google-1-3-28" level="h4">
            📅 openiap-gql v1.3.17 / openiap-google v1.3.28 - Android BillingClient Enhancement
          </AnchorLink>

          <p style={{ marginTop: '0.75rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            Added new fields from Google Play Billing Library 5.0+ and 7.0+ for offer details, installment plans, and pending subscription updates.
          </p>

          {/* Section 1: purchaseOptionId */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              1. <code>purchaseOptionId</code> for One-Time Purchase Offers
            </h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Identifies which purchase option the user selected for one-time products with multiple offers.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              <a href="/docs/types/android#one-time-purchase-offer-detail" style={{ fontSize: '0.85rem' }}>
                <code>ProductAndroidOneTimePurchaseOfferDetail.purchaseOptionId</code>
              </a>
              <a href="/docs/types/offer#discount-offer" style={{ fontSize: '0.85rem' }}>
                <code>DiscountOffer.purchaseOptionIdAndroid</code>
              </a>
            </div>
          </div>

          {/* Section 2: InstallmentPlanDetailsAndroid */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              2. <code>InstallmentPlanDetailsAndroid</code> for Subscriptions
            </h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Subscription installment plans - users pay over a commitment period (e.g., 12 monthly payments).
            </p>
            <CodeBlock language="graphql">{`type InstallmentPlanDetailsAndroid {
  commitmentPaymentsCount: Int!           # Initial commitment payments
  subsequentCommitmentPaymentsCount: Int! # Renewal commitment (0 = reverts to normal)
}`}</CodeBlock>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              <a href="/docs/types/android#subscription-offer-details" style={{ fontSize: '0.85rem' }}>
                <code>ProductSubscriptionAndroidOfferDetails.installmentPlanDetails</code>
              </a>
              <a href="/docs/types/offer#subscription-offer" style={{ fontSize: '0.85rem' }}>
                <code>SubscriptionOffer.installmentPlanDetailsAndroid</code>
              </a>
            </div>
          </div>

          {/* Section 3: PendingPurchaseUpdateAndroid */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              3. <code>PendingPurchaseUpdateAndroid</code> for Upgrades/Downgrades
            </h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Track pending subscription plan changes that take effect at the end of the current billing period.
            </p>
            <CodeBlock language="graphql">{`type PendingPurchaseUpdateAndroid {
  products: [String!]!   # New product IDs user is switching to
  purchaseToken: String! # Token for the pending transaction
}`}</CodeBlock>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              <a href="/docs/types/purchase#pending-purchase-update-android" style={{ fontSize: '0.85rem' }}>
                <code>PurchaseAndroid.pendingPurchaseUpdateAndroid</code>
              </a>
            </div>
          </div>

          {/* References */}
          <details open style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600', color: 'var(--text-secondary)' }}>References</summary>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
              <li><a href="https://developer.android.com/reference/com/android/billingclient/api/ProductDetails.OneTimePurchaseOfferDetails#getPurchaseOptionId()" target="_blank" rel="noopener noreferrer">getPurchaseOptionId() (7.0+)</a></li>
              <li><a href="https://developer.android.com/reference/com/android/billingclient/api/ProductDetails.InstallmentPlanDetails" target="_blank" rel="noopener noreferrer">InstallmentPlanDetails (7.0+)</a></li>
              <li><a href="https://developer.android.com/reference/com/android/billingclient/api/Purchase.PendingPurchaseUpdate" target="_blank" rel="noopener noreferrer">PendingPurchaseUpdate (5.0+)</a></li>
              <li><a href="https://github.com/hyodotdev/openiap/issues/77" target="_blank" rel="noopener noreferrer">Issue #77</a></li>
            </ul>
          </details>
        </div>
      ),
    },
    // GQL 1.3.16 / Apple 1.3.14 - Jan 26, 2026
    {
      id: 'gql-1-3-16-apple-1-3-14',
      date: new Date('2026-01-26'),
      element: (
        <div key="gql-1-3-16-apple-1-3-14" style={noteCardStyle}>
          <AnchorLink id="gql-1-3-16-apple-1-3-14" level="h4">
            📅 openiap-gql v1.3.16 / openiap-apple v1.3.14 - ExternalPurchaseCustomLink Support (iOS 18.1+)
          </AnchorLink>

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Added full support for Apple's <code>ExternalPurchaseCustomLink</code> API (iOS 18.1+) for apps using custom external purchase links with token-based reporting.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>1. New APIs</h5>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li><code>isEligibleForExternalPurchaseCustomLinkIOS()</code> - Check if app can use ExternalPurchaseCustomLink API</li>
              <li><code>getExternalPurchaseCustomLinkTokenIOS(tokenType)</code> - Get token for reporting to Apple's External Purchase Server API</li>
              <li><code>showExternalPurchaseCustomLinkNoticeIOS(noticeType)</code> - Show CustomLink-specific disclosure notice sheet</li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>2. New Types</h5>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li><code>ExternalPurchaseCustomLinkTokenTypeIOS</code> - Token types: <code>acquisition</code>, <code>services</code></li>
              <li><code>ExternalPurchaseCustomLinkNoticeTypeIOS</code> - Notice types: <code>browser</code></li>
              <li><code>ExternalPurchaseCustomLinkTokenResultIOS</code> - Token result with <code>token</code> and <code>error</code></li>
              <li><code>ExternalPurchaseCustomLinkNoticeResultIOS</code> - Notice result with <code>continued</code> and <code>error</code></li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>3. Improved <code>presentExternalPurchaseNoticeSheetIOS()</code></h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Now returns <code>externalPurchaseToken</code> field when user continues. This token is required for reporting transactions to Apple's External Purchase Server API.
            </p>
            <CodeBlock language="typescript">{`// Before
result.result  // "continue" or "dismissed"
result.error   // optional error

// After (v1.3.14+)
result.result                 // "continue" or "dismissed"
result.externalPurchaseToken  // Token string (when result is "continue")
result.error                  // optional error`}</CodeBlock>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>4. API Comparison</h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <code>ExternalPurchase</code> (17.4+): Basic external purchase notice | <code>ExternalPurchaseCustomLink</code> (18.1+): Custom links with token-based reporting
            </p>
          </div>

          <details open style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600', color: 'var(--text-secondary)' }}>References</summary>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
              <li><a href="https://developer.apple.com/documentation/storekit/externalpurchasecustomlink" target="_blank" rel="noopener noreferrer">Apple ExternalPurchaseCustomLink Documentation</a></li>
              <li><a href="https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)" target="_blank" rel="noopener noreferrer">token(for:) API Reference</a></li>
              <li><a href="https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/shownotice(type:)" target="_blank" rel="noopener noreferrer">showNotice(type:) API Reference</a></li>
              <li><a href="https://github.com/dooboolab-community/react-native-iap/discussions/3135" target="_blank" rel="noopener noreferrer">Feature Request Discussion #3135</a></li>
            </ul>
          </details>
        </div>
      ),
    },
    // GQL 1.3.15 / Google 1.3.27 / Apple 1.3.13 - Jan 21, 2026
    {
      id: 'gql-1-3-15-google-1-3-27-apple-1-3-13',
      date: new Date('2026-01-21'),
      element: (
        <div key="gql-1-3-15-google-1-3-27-apple-1-3-13" style={noteCardStyle}>
          <AnchorLink id="gql-1-3-15-google-1-3-27-apple-1-3-13" level="h4">
            📅 openiap-gql v1.3.15 / openiap-google v1.3.27 / openiap-apple v1.3.13 - Bug Fix
          </AnchorLink>

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Fixed incorrect <code>replacementModeConstant</code> mapping in <code>applySubscriptionProductReplacementParams</code>. The function was using values from the legacy <code>SubscriptionUpdateParams.ReplacementMode</code> API instead of the new <code>SubscriptionProductReplacementParams.ReplacementMode</code> API (Billing Library 8.1.0+). Issue: <a href="https://github.com/hyodotdev/openiap/issues/71" target="_blank" rel="noopener noreferrer">#71</a>
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>Mode Value Changes</h5>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li><code>CHARGE_FULL_PRICE</code>: 5 → 4</li>
              <li><code>DEFERRED</code>: 6 → 5</li>
              <li><code>KEEP_EXISTING</code>: 7 → 6</li>
            </ul>
          </div>

          <details open style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600', color: 'var(--text-secondary)' }}>References</summary>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
              <li><a href="https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode" target="_blank" rel="noopener noreferrer">SubscriptionProductReplacementParams.ReplacementMode (Billing 8.1.0+)</a></li>
              <li><a href="https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams.SubscriptionUpdateParams.ReplacementMode" target="_blank" rel="noopener noreferrer">SubscriptionUpdateParams.ReplacementMode (Legacy)</a></li>
            </ul>
          </details>
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

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Breaking changes for iOS subscription props, bug fixes for Android displayPrice, and Objective-C bridge updates.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>1. iOS - Subscription-Only Props Cleanup (Breaking Change)</h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Removed subscription-specific fields from <code>RequestPurchaseIosProps</code>. These fields now only exist in <code>RequestSubscriptionIosProps</code>.
            </p>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li><code>introductoryOfferEligibility</code> - Removed</li>
              <li><code>promotionalOfferJWS</code> - Removed</li>
              <li><code>winBackOffer</code> - Removed</li>
            </ul>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Migration: Use <code>requestSubscription()</code> API.</p>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>2. Known Issue - <code>introductoryOfferEligibility</code> API (<a href="https://github.com/hyodotdev/openiap/issues/68" target="_blank" rel="noopener noreferrer">#68</a>)</h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Current field uses <code>Boolean</code> type, but Apple's <a href="https://developer.apple.com/documentation/storekit/product/purchaseoption/introductoryoffereligibility(compactjws:)" target="_blank" rel="noopener noreferrer">introductoryOfferEligibility(compactJWS:)</a> API requires a JWS string. Will be corrected in future release.
            </p>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>3. Android - Fix <code>displayPrice</code> for Subscriptions with Free Trials</h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Fixed <code>displayPrice</code> returning "Free" or "$0.00" instead of actual base/recurring price.
            </p>
            <CodeBlock language="typescript">{`// Before (bug): displayPrice = "Free", price = 0.0
// After (fixed): displayPrice = "$9.99", price = 9.99
// Free trial info available in: subscriptionOffers[0].displayPrice`}</CodeBlock>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>4. Apple v1.3.13 - Objective-C Bridge Updates</h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Updated <code>OpenIapModule+ObjC.swift</code> to expose new Swift async functions to Objective-C. Critical for kmp-iap. See <a href="https://github.com/hyodotdev/openiap/blob/main/knowledge/internal/04-platform-packages.md#objective-c-bridge-critical-for-kmp-iap" target="_blank" rel="noopener noreferrer">Objective-C Bridge Documentation</a>.
            </p>
          </div>

          <details open style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600', color: 'var(--text-secondary)' }}>References</summary>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
              <li><a href="https://github.com/hyodotdev/openiap/issues/68" target="_blank" rel="noopener noreferrer">Issue #68 - introductoryOfferEligibility API Correction</a></li>
              <li><a href="/docs/types/purchase">Purchase Types Documentation</a></li>
            </ul>
          </details>
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

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            New iOS win-back offers, JWS promotional offers, and Android product status codes.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>1. iOS - Win-Back Offers (iOS 18+)</h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Added support for <a href="https://developer.apple.com/documentation/storekit/product/subscriptionoffer" target="_blank" rel="noopener noreferrer">win-back offers</a> to re-engage churned subscribers.
            </p>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li><code>winBackOffer</code> - New field in purchase props</li>
              <li><code>WinBackOfferInputIOS</code> - Input type with <code>offerId</code> field</li>
              <li><code>SubscriptionOfferTypeIOS.WinBack</code> - New enum value</li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>2. iOS - JWS Promotional Offers (iOS 15+, WWDC 2025)</h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              New signature format using compact JWS string for promotional offers. Back-deployed to iOS 15. Requires Xcode 16.4+.
            </p>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li><code>promotionalOfferJWS</code> - New field in purchase props</li>
              <li><code>PromotionalOfferJWSInputIOS</code> - Input type with <code>offerId</code> and <code>jws</code> fields</li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>3. iOS - Introductory Offer Eligibility Override (iOS 15+, WWDC 2025)</h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <code>introductoryOfferEligibility</code> - Override system eligibility check. Set <code>true</code>/<code>false</code>/<code>nil</code> for system default. Requires Xcode 16.4+.
            </p>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>4. Android - Product Status Codes (Billing 8.0+)</h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Product-level status codes indicating why products couldn't be fetched.
            </p>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li><code>ProductStatusAndroid</code> - Enum: <code>Ok</code>, <code>NotFound</code>, <code>NoOffersAvailable</code>, <code>Unknown</code></li>
              <li><code>productStatusAndroid</code> - New field on <code>ProductAndroid</code></li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>5. Android - Auto Service Reconnection</h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <code>enableAutoServiceReconnection()</code> is now always enabled internally since OpenIAP uses Billing Library 8.3.0+.
            </p>
          </div>

          <details open style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600', color: 'var(--text-secondary)' }}>References</summary>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
              <li><a href="https://developer.apple.com/documentation/storekit/product/subscriptionoffer" target="_blank" rel="noopener noreferrer">Apple StoreKit 2 - SubscriptionOffer</a></li>
              <li><a href="https://developer.android.com/google/play/billing/release-notes#8-0-0" target="_blank" rel="noopener noreferrer">Google Play Billing 8.0.0 Release Notes</a></li>
              <li><a href="/docs/types/product">Product Types Documentation</a></li>
            </ul>
          </details>
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

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Introduced standardized <code>DiscountOffer</code> and <code>SubscriptionOffer</code> types for unified handling across iOS and Android.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>1. <code>DiscountOffer</code> (One-time products)</h5>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li>Cross-platform type for one-time purchase discounts</li>
              <li>Android fields: <code>offerTokenAndroid</code>, <code>fullPriceMicrosAndroid</code>, <code>percentageDiscountAndroid</code></li>
              <li>Replaces deprecated <code>ProductAndroidOneTimePurchaseOfferDetail</code></li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>2. <code>SubscriptionOffer</code></h5>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li>Cross-platform type for subscription offers (introductory, promotional)</li>
              <li>Includes <code>paymentMode</code>: FreeTrial, PayAsYouGo, PayUpFront</li>
              <li>Replaces deprecated <code>ProductSubscriptionAndroidOfferDetails</code>, <code>DiscountOfferIOS</code>, <code>DiscountIOS</code></li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>3. New Fields on Product Types</h5>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li><code>discountOffers: [DiscountOffer!]</code> - One-time product discounts</li>
              <li><code>subscriptionOffers: [SubscriptionOffer!]</code> - Subscription offers</li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>4. PaymentMode Logic Fix (Android)</h5>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li>Zero price → FreeTrial (regardless of recurrenceMode)</li>
              <li>NON_RECURRING (3) with paid → PayUpFront</li>
              <li>FINITE_RECURRING (2) / INFINITE_RECURRING (1) with paid → PayAsYouGo</li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>5. Deprecated Types</h5>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li><del><code>ProductAndroidOneTimePurchaseOfferDetail</code></del> → <code>DiscountOffer</code></li>
              <li><del><code>ProductSubscriptionAndroidOfferDetails</code></del> → <code>SubscriptionOffer</code></li>
              <li><del><code>oneTimePurchaseOfferDetailsAndroid</code></del> → <code>discountOffers</code></li>
              <li><del><code>subscriptionOfferDetailsAndroid</code></del> → <code>subscriptionOffers</code></li>
            </ul>
          </div>

          <details open style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600', color: 'var(--text-secondary)' }}>References</summary>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
              <li><a href="/docs/types/offer">Offer Types Documentation</a></li>
              <li><a href="/docs/features/discount">Discount Feature Guide</a></li>
            </ul>
          </details>
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

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Simplified PurchaseState enum and deprecated AlternativeBillingModeAndroid in favor of BillingProgramAndroid.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>1. PurchaseState Simplified</h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Removed unused <code>Failed</code>, <code>Restored</code>, <code>Deferred</code> states. Now: <code>Pending</code>, <code>Purchased</code>, <code>Unknown</code>
            </p>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li><code>Failed</code> - Platforms return errors instead</li>
              <li><code>Restored</code> - Returns as <code>Purchased</code> state</li>
              <li><code>Deferred</code> - StoreKit 2 has no transaction state; Android uses <code>Pending</code></li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>2. API Consolidation - BillingProgramAndroid</h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Deprecated <code>AlternativeBillingModeAndroid</code> in favor of unified <code>BillingProgramAndroid</code> enum.
            </p>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li><code>BillingProgramAndroid.USER_CHOICE_BILLING</code> - New enum value (7.0+)</li>
              <li><del><code>AlternativeBillingModeAndroid</code></del> - Deprecated</li>
              <li><del><code>InitConnectionConfig.alternativeBillingModeAndroid</code></del> - Deprecated</li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>3. Migration</h5>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li><code>alternativeBillingModeAndroid: USER_CHOICE</code> → <code>enableBillingProgramAndroid: USER_CHOICE_BILLING</code></li>
              <li><code>alternativeBillingModeAndroid: ALTERNATIVE_ONLY</code> → <code>enableBillingProgramAndroid: EXTERNAL_OFFER</code></li>
            </ul>
          </div>

          <details open style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600', color: 'var(--text-secondary)' }}>References</summary>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
              <li><a href="https://developer.android.com/reference/com/android/billingclient/api/Purchase.PurchaseState" target="_blank" rel="noopener noreferrer">Google Play Billing - Purchase.PurchaseState</a></li>
              <li><a href="https://developer.apple.com/documentation/storekit/product/purchaseresult" target="_blank" rel="noopener noreferrer">Apple StoreKit 2 - Product.PurchaseResult</a></li>
            </ul>
          </details>
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
            📅 openiap-gql v1.3.10 / openiap-google v1.3.19 / openiap-apple v1.3.8 - <a href="https://developer.android.com/google/play/billing/release-notes#8-3-0" target="_blank" rel="noopener noreferrer">Google Play Billing 8.3.0 External Payments</a>
          </AnchorLink>

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            InitConnectionConfig enhancement, auto connection management for iOS, and External Payments program support.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>1. GQL v1.3.10 - InitConnectionConfig Enhancement</h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Added <code>enableBillingProgramAndroid: BillingProgramAndroid</code> field for easier billing program setup during <code>initConnection()</code>.
            </p>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>2. Apple v1.3.8 - Auto Connection Management</h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              All API methods now automatically call <code>initConnection()</code> internally. No need to manually call it before using any API. Backward compatible.
            </p>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>3. Google v1.3.19 - External Payments Program (Japan Only)</h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Billing Library 8.3.0 introduces side-by-side choice between Google Play Billing and developer's external payment.
            </p>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li><code>BillingProgramAndroid.EXTERNAL_PAYMENTS</code> - New billing program type</li>
              <li><code>DeveloperBillingOptionParamsAndroid</code> - Configure external payment option</li>
              <li><code>DeveloperProvidedBillingDetailsAndroid</code> - Contains externalTransactionToken</li>
              <li><code>IapEvent.DeveloperProvidedBillingAndroid</code> - New event</li>
            </ul>
          </div>

          <details open style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600', color: 'var(--text-secondary)' }}>References</summary>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
              <li><a href="https://developer.android.com/google/play/billing/externalpaymentlinks" target="_blank" rel="noopener noreferrer">External Payment Links Documentation</a></li>
              <li><a href="/docs/features/external-purchase#external-payments-830---japan-only">External Payments Implementation Guide</a></li>
            </ul>
          </details>
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
            📅 openiap-google v1.3.16 - <a href="https://developer.android.com/google/play/billing/release-notes#8-2-1" target="_blank" rel="noopener noreferrer">Google Play Billing 8.2.1</a>
          </AnchorLink>

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Upgraded from 8.1.0 to 8.2.1 with new Billing Programs API. Skipped 8.2.0 due to bugs in <code>isBillingProgramAvailableAsync</code> and <code>createBillingProgramReportingDetailsAsync</code>.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>1. New APIs</h5>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li><code>enableBillingProgram()</code> - Setup BillingClient for billing programs</li>
              <li><code>isBillingProgramAvailableAsync()</code> - Determine user eligibility</li>
              <li><code>createBillingProgramReportingDetailsAsync()</code> - Create external transaction token</li>
              <li><code>launchExternalLink()</code> - Initiate external link</li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>2. Deprecated APIs</h5>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li><del><code>enableExternalOffer()</code></del> → <code>enableBillingProgram(BillingProgramAndroid.ExternalOffer)</code></li>
              <li><del><code>isExternalOfferAvailableAsync()</code></del> → <code>isBillingProgramAvailable()</code></li>
              <li><del><code>createExternalOfferReportingDetailsAsync()</code></del> → <code>createBillingProgramReportingDetails()</code></li>
              <li><del><code>showExternalOfferInformationDialog()</code></del> → <code>launchExternalLink()</code></li>
            </ul>
          </div>

          <details open style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600', color: 'var(--text-secondary)' }}>References</summary>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
              <li><a href="https://developer.android.com/google/play/billing/release-notes#8-2-0" target="_blank" rel="noopener noreferrer">Billing Library 8.2.0 Release Notes</a></li>
              <li><a href="/docs/features/external-purchase">External Purchase Guide</a></li>
            </ul>
          </details>
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
            📅 openiap-gql v1.3.8 - Kotlin Null-Safe Casting
          </AnchorLink>

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Fixed potential <code>TypeCastException</code> in generated Kotlin types by using safe casts (<code>as?</code>) instead of unsafe casts (<code>as</code>).
          </p>

          <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
            <li>Lists now use <code>mapNotNull</code> with safe element casting</li>
            <li>Non-nullable fields provide sensible defaults (empty string, false, 0, emptyList)</li>
            <li>Prevents crashes when JSON keys are missing or contain unexpected null values</li>
          </ul>
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
            📅 openiap-gql v1.3.7 / openiap-apple v1.3.7 / openiap-google v1.3.15 - Advanced Commerce Data
          </AnchorLink>

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Added support for <a href="https://developer.apple.com/documentation/storekit/product/purchaseoption/custom(key:value:)" target="_blank" rel="noopener noreferrer">StoreKit 2's Product.PurchaseOption.custom API</a> to pass attribution data during purchases.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>1. <code>advancedCommerceData</code> Field</h5>
            <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li>New optional field in <code>RequestPurchaseIosProps</code> and <code>RequestSubscriptionIosProps</code></li>
              <li>Use cases: Campaign attribution, affiliate marketing, promotional code tracking</li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>2. Deprecated <code>requestPurchaseOnPromotedProductIOS()</code></h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              In StoreKit 2, use <code>promotedProductListenerIOS</code> + <code>requestPurchase()</code> directly.
            </p>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>3. Android: <code>google</code> Field Support</h5>
            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Now supports <code>google</code> field with fallback to deprecated <code>android</code> field.
            </p>
          </div>
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

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            No API changes. Updated GitHub release tag management for Swift Package Manager (SPM) compatibility.
          </p>

          <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
            <li><strong>Apple</strong>: Uses semver tags directly (e.g., <code>1.3.5</code>) - Required for SPM</li>
            <li><strong>GQL</strong>: Uses <code>gql-</code> prefix (e.g., <code>gql-1.3.5</code>)</li>
            <li><strong>Google</strong>: Uses <code>google-</code> prefix (e.g., <code>google-1.3.5</code>)</li>
          </ul>
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
            📅 openiap-gql v1.3.4 / openiap-google v1.3.14 / openiap-apple v1.3.2 - Platform-Specific Verification
          </AnchorLink>

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            <code>verifyPurchase</code> API refactored (Breaking Change). Now requires platform-specific options. <code>sku</code> moved inside each platform options.
          </p>

          <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
            <li><code>VerifyPurchaseAppleOptions</code> - Apple App Store verification</li>
            <li><code>VerifyPurchaseGoogleOptions</code> - Google Play with packageName, purchaseToken, accessToken</li>
            <li><code>VerifyPurchaseHorizonOptions</code> - Meta Horizon (Quest) via S2S API</li>
            <li><del><code>androidOptions</code></del> → Use <code>google</code> instead</li>
          </ul>

          <p style={{ fontSize: '0.9rem' }}>See: <a href="/docs/apis#verify-purchase">verifyPurchase API</a></p>
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
            📅 openiap-google v1.3.12 / openiap-gql v1.3.2 - <a href="https://developer.android.com/google/play/billing/release-notes#8-2-0" target="_blank" rel="noopener noreferrer">Google Play Billing 8.2.0</a> Billing Programs API
          </AnchorLink>

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            New Billing Programs API (8.2.0+) and deprecated alternative billing APIs.
          </p>

          <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
            <li><code>enableBillingProgram()</code>, <code>isBillingProgramAvailable()</code>, <code>createBillingProgramReportingDetails()</code>, <code>launchExternalLink()</code></li>
            <li><del><code>checkAlternativeBillingAvailability()</code></del> → <code>isBillingProgramAvailable()</code></li>
            <li><del><code>showAlternativeBillingInformationDialog()</code></del> → <code>launchExternalLink()</code></li>
          </ul>

          <p style={{ fontSize: '0.9rem' }}>See: <a href="/docs/features/external-purchase">External Purchase Guide</a></p>
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
            📅 openiap-google v1.3.11 / openiap-gql v1.3.1 - <a href="https://developer.android.com/google/play/billing/release-notes#8-1-0" target="_blank" rel="noopener noreferrer">Google Play Billing 8.1.0</a>
          </AnchorLink>

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Billing Library 8.0.0 → 8.1.0, minSdk 21 → 23, Kotlin 2.0.21 → 2.2.0.
          </p>

          <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
            <li><code>isSuspendedAndroid</code> - Detect suspended subscriptions due to payment failures</li>
            <li><code>PreorderDetailsAndroid</code> - New type for pre-order products</li>
            <li><code>oneTimePurchaseOfferDetailsAndroid</code> - Changed to array type</li>
          </ul>
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

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Breaking Changes: <del><code>Purchase.platform</code></del> → <code>store</code>, <del><code>ios/android</code></del> props → <code>apple/google</code>.
          </p>

          <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
            <li>New: <code>verifyPurchaseWithProvider</code> - Verification with external providers like IAPKit</li>
          </ul>
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
            📅 openiap v1.2.6 - <del>validateReceipt</del> → verifyPurchase
          </AnchorLink>

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Terminology alignment with modern StoreKit 2. "Receipt Validation" was Apple's legacy term. Unified interface across iOS and Android.
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

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Version jumped from 1.0.12 to 1.2.0 to align with native libraries. iOS External Purchase & Android Alternative Billing support.
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

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            iOS External Purchase (iOS 17.4+, 18.2+) and Android Alternative Billing (Billing Library 6.2+/7.0+).
          </p>

          <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
            <li><code>canPresentExternalPurchaseNoticeIOS()</code>, <code>presentExternalPurchaseNoticeSheetIOS()</code>, <code>presentExternalPurchaseLinkIOS()</code></li>
          </ul>
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

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            New standardized APIs: <code>getActiveSubscriptions()</code>, <code>hasActiveSubscriptions()</code> - automatic detection without requiring product IDs.
          </p>
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

          <p style={{ marginTop: '0.75rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            All apps must use Google Play Billing Library v6.0.1 or later. Deadline extended to November 1, 2024.
          </p>
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
