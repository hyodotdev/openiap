import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import CodeBlock from '../../../components/CodeBlock';

function Notes() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Updates"
        description="Important changes and deprecations in IAP libraries and platforms - API changes, breaking changes, validateReceipt to verifyPurchase migration, and guides."
        path="/docs/updates/notes"
        keywords="IAP updates, validateReceipt, verifyPurchase, receipt validation, purchase verification, migration guide"
      />
      <h1>Updates</h1>
      <p>Important changes and deprecations in IAP libraries and platforms.</p>

      <section>
        <h2>📝 API & Terminology Changes</h2>

        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <h4 style={{ marginTop: 0, color: 'var(--text-primary)' }}>
            📅 openiap-google v1.3.12 / openiap-gql v1.3.2 -{' '}
            <a
              href="https://developer.android.com/google/play/billing/release-notes#8-2-0"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Play Billing 8.2.0
            </a>{' '}
            Billing Programs API
          </h4>
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
            <strong>New Types:</strong> (See{' '}
            <a href="/docs/types#billing-program-android">Types Reference</a>)
          </p>
          <ul>
            <li>
              <strong>
                <a href="/docs/types#billing-program-android">
                  <code>BillingProgramAndroid</code>
                </a>
              </strong>{' '}
              - Enum: <code>ExternalContentLink</code>, <code>ExternalOffer</code>
            </li>
            <li>
              <strong>
                <a href="/docs/types#launch-external-link-params-android">
                  <code>LaunchExternalLinkParamsAndroid</code>
                </a>
              </strong>{' '}
              - Parameters for launching external links
            </li>
            <li>
              <strong>
                <a href="/docs/types#external-link-launch-mode-android">
                  <code>ExternalLinkLaunchModeAndroid</code>
                </a>
              </strong>{' '}
              - Launch mode options
            </li>
            <li>
              <strong>
                <a href="/docs/types#external-link-type-android">
                  <code>ExternalLinkTypeAndroid</code>
                </a>
              </strong>{' '}
              - Link type options
            </li>
          </ul>
          <p>
            <strong>Google Play Billing 8.1.0 Support:</strong> (See{' '}
            <a href="/docs/features/subscription-upgrade-downgrade#replacement-modes">
              Subscription Upgrade/Downgrade
            </a>)
          </p>
          <ul>
            <li>
              <strong>
                <a href="/docs/types#subscription-product-replacement-params-android">
                  <code>SubscriptionProductReplacementParamsAndroid</code>
                </a>
              </strong>{' '}
              - Per-product subscription replacement configuration
            </li>
            <li>
              <strong>
                <a href="/docs/types#subscription-replacement-mode-android">
                  <code>SubscriptionReplacementModeAndroid.KeepExisting</code>
                </a>
              </strong>{' '}
              - New replacement mode to keep existing payment schedule
            </li>
          </ul>
          <CodeBlock language="kotlin">
            {`// Billing Programs API (8.2.0+) - Recommended approach
val iapStore = OpenIapStore(context)

// Step 0: Enable billing program BEFORE initConnection
iapStore.enableBillingProgram(BillingProgramAndroid.ExternalOffer)
iapStore.initConnection(null)

// Step 1: Check availability
val result = iapStore.isBillingProgramAvailable(BillingProgramAndroid.ExternalOffer)
if (!result.isAvailable) return

// Step 2: Launch external link
val launched = iapStore.launchExternalLink(
    activity,
    LaunchExternalLinkParamsAndroid(
        billingProgram = BillingProgramAndroid.ExternalOffer,
        launchMode = ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
        linkType = ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
        linkUri = "https://your-payment-site.com/checkout"
    )
)

// Step 3: Process payment with your backend...

// Step 4: Create reporting details
val reportingDetails = iapStore.createBillingProgramReportingDetails(
    BillingProgramAndroid.ExternalOffer
)
// Send reportingDetails.externalTransactionToken to Google within 24h`}
          </CodeBlock>
          <p>
            <strong>Deprecated APIs:</strong>
          </p>
          <ul>
            <li>
              <code>checkAlternativeBillingAvailability()</code> → Use{' '}
              <code>isBillingProgramAvailable()</code>
            </li>
            <li>
              <code>showAlternativeBillingInformationDialog()</code> → Use{' '}
              <code>launchExternalLink()</code>
            </li>
            <li>
              <code>createAlternativeBillingReportingToken()</code> → Use{' '}
              <code>createBillingProgramReportingDetails()</code>
            </li>
          </ul>
          <p>
            See:{' '}
            <a href="/docs/features/external-purchase">External Purchase Guide</a>
            ,{' '}
            <a href="/docs/features/subscription-upgrade-downgrade">
              Subscription Upgrade/Downgrade
            </a>
          </p>
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <h4 style={{ marginTop: 0, color: 'var(--text-primary)' }}>
            📅 openiap-google v1.3.11 / openiap-gql v1.3.1 -{' '}
            <a
              href="https://developer.android.com/google/play/billing/release-notes#8-1-0"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Play Billing 8.1.0
            </a>{' '}
            Support
          </h4>
          <p>
            <strong>Google Play Billing Library Upgrade:</strong>
          </p>
          <ul>
            <li>
              <strong>
                <a
                  href="https://developer.android.com/google/play/billing/release-notes#8-1-0"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Billing Library 8.0.0 → 8.1.0
                </a>
              </strong>{' '}
              - Upgraded to latest Google Play Billing Library
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
              to payment failures. Suspended subscriptions should NOT grant
              entitlements - direct users to the subscription center to resolve
              payment issues.
            </li>
            <li>
              <strong>PreorderDetailsAndroid</strong> - New type for pre-order
              products. Contains <code>preorderPresaleEndTimeMillis</code> and{' '}
              <code>preorderReleaseTimeMillis</code> for scheduling pre-order
              availability.
            </li>
            <li>
              <strong>oneTimePurchaseOfferDetailsAndroid</strong> - Changed from
              single object to array type. Now returns{' '}
              <code>[ProductAndroidOneTimePurchaseOfferDetail]</code> to support
              multiple offers per product (discounts, time-limited offers,
              etc.).
            </li>
          </ul>
          <CodeBlock language="kotlin">
            {`// Handling suspended subscriptions
val purchase = getAvailablePurchases()
if (purchase.isSuspendedAndroid == true) {
    // ❌ Do NOT grant entitlements
    // ✅ Direct user to subscription center
    showMessage("Payment issue detected. Please update your payment method.")
    deepLinkToSubscriptions()
}

// Pre-order details (oneTimePurchaseOfferDetailsAndroid is now an array)
val product = fetchProducts(skus)
product.oneTimePurchaseOfferDetailsAndroid?.firstOrNull()?.preorderDetailsAndroid?.let {
    val releaseTime = it.preorderReleaseTimeMillis.toLong()
    val presaleEndTime = it.preorderPresaleEndTimeMillis.toLong()
}`}
          </CodeBlock>
          <p>
            See:{' '}
            <a href="/docs/types#purchase-platform">Purchase Platform Fields</a>
            , <a href="/docs/types#product-platform">Product Platform Fields</a>
          </p>
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <h4 style={{ marginTop: 0, color: 'var(--text-primary)' }}>
            📅 openiap v1.3.0 - Platform Props & Store Field Updates
          </h4>
          <p>
            <strong>Breaking Changes:</strong>
          </p>
          <ul>
            <li>
              <strong>Purchase.platform → Purchase.store</strong> - The{' '}
              <code>platform</code> field is deprecated. Use <code>store</code>{' '}
              instead which returns <code>'apple'</code> or{' '}
              <code>'google'</code>.
            </li>
            <li>
              <strong>requestPurchase props</strong> - The <code>ios</code> and{' '}
              <code>android</code> props are deprecated. Use <code>apple</code>{' '}
              and <code>google</code> instead.
            </li>
          </ul>
          <p>
            <strong>New Feature:</strong>
          </p>
          <ul>
            <li>
              <strong>verifyPurchaseWithProvider</strong> - New API for purchase
              verification with external providers like IAPKit. Supports both
              Apple App Store and Google Play Store.
            </li>
          </ul>
          <p>
            <strong>Migration:</strong>
          </p>
          <CodeBlock language="typescript">
            {`// Before (deprecated)
requestPurchase({
  requestPurchase: {
    ios: { sku: 'product_id' },
    android: { skus: ['product_id'] }
  }
})

// After (recommended)
requestPurchase({
  requestPurchase: {
    apple: { sku: 'product_id' },
    google: { skus: ['product_id'] }
  }
})

// Purchase store field
purchase.store  // 'apple' | 'google'
purchase.platform  // deprecated`}
          </CodeBlock>
          <p>
            See:{' '}
            <a href="/docs/apis#verify-purchase-with-provider">
              verifyPurchaseWithProvider API
            </a>
          </p>
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <h4 style={{ marginTop: 0, color: 'var(--text-primary)' }}>
            📅 openiap v1.2.6 - validateReceipt → verifyPurchase
          </h4>
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
              Apple's legacy term from StoreKit 1. With StoreKit 2 (iOS 15+),
              Apple moved away from this terminology. "Purchase Verification" is
              a more accurate, platform-neutral term.
            </li>
            <li>
              <strong>Cross-platform consistency</strong> - Android never used
              "receipt" terminology. Using "purchase verification" better
              represents what the API does on both platforms.
            </li>
            <li>
              <strong>Modern API design</strong> - The new{' '}
              <code>verifyPurchase</code> API provides a unified interface that
              works consistently across iOS and Android.
            </li>
          </ul>
          <p>
            <strong>Migration:</strong>
          </p>
          <ul>
            <li>
              Replace <code>validateReceipt()</code> with{' '}
              <code>verifyPurchase()</code>
            </li>
            <li>
              Replace <code>validateReceiptIOS()</code> with{' '}
              <code>verifyPurchase()</code>
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

        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <h4 style={{ marginTop: 0, color: 'var(--text-primary)' }}>
            📅 openiap v1.2.0 - Version Alignment & Alternative Billing
          </h4>
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
      </section>

      <section>
        <h2>✨ New Features</h2>

        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <h4 style={{ marginTop: 0, color: 'var(--text-primary)' }}>
            📅 openiap-gql 1.0.12 - External Purchase Support
          </h4>
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
            <li>
              <code>checkAlternativeBillingAvailability()</code>,{' '}
              <code>showAlternativeBillingInformationDialog()</code>,{' '}
              <code>createAlternativeBillingReportingToken()</code> - Android
              APIs
            </li>
            <li>
              <code>userChoiceBillingListenerAndroid</code> - Event listener for
              User Choice Billing
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

        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <h4 style={{ marginTop: 0, color: 'var(--text-primary)' }}>
            📅 August 2025 - Subscription Status APIs
          </h4>
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
          <p>
            See:{' '}
            <a href="#subscription-management">Subscription Management APIs</a>
          </p>
        </div>
      </section>

      <section>
        <h2>⚠️ Breaking Changes</h2>

        <h3>Google Play Billing Library</h3>

        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <h4 style={{ marginTop: 0, color: 'var(--text-primary)' }}>
            📅 August 31, 2024 - Billing Library v5 Deprecated
          </h4>
          <p>All apps must use Google Play Billing Library v6.0.1 or later.</p>
          <ul>
            <li>
              Migration deadline: August 31, 2024 (extended to November 1, 2024)
            </li>
            <li>New apps must use v6+ immediately</li>
            <li>Existing apps must update before deadline</li>
          </ul>
        </div>

        <h3>Static Test Product IDs Deprecated</h3>
        <p>
          The following static test product IDs are{' '}
          <strong>no longer supported</strong> in Play Billing Library v3+:
        </p>

        <table className="error-table">
          <thead>
            <tr>
              <th>Deprecated Product ID</th>
              <th>Previous Behavior</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>
                  android.test.purchased
                </code>
              </td>
              <td>Simulated successful purchase</td>
              <td>❌ No longer works</td>
            </tr>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>
                  android.test.canceled
                </code>
              </td>
              <td>Simulated canceled purchase</td>
              <td>❌ No longer works</td>
            </tr>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>
                  android.test.refunded
                </code>
              </td>
              <td>Simulated refunded purchase</td>
              <td>❌ No longer works</td>
            </tr>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>
                  android.test.item_unavailable
                </code>
              </td>
              <td>Simulated unavailable item</td>
              <td>❌ No longer works</td>
            </tr>
          </tbody>
        </table>

        <h4>Alternative Testing Methods</h4>
        <p>Use these methods instead of static test IDs:</p>
        <ol>
          <li>
            <strong>License Testing</strong> - Configure test accounts in Google
            Play Console
          </li>
          <li>
            <strong>Test Tracks</strong> - Use internal/closed testing tracks
          </li>
          <li>
            <strong>Real Products</strong> - Create actual products and use test
            accounts
          </li>
        </ol>
      </section>

      <section>
        <h2>🔄 Migration Guides</h2>

        <h3>Migrating from Static Test IDs</h3>

        <h4>Before (Deprecated):</h4>
        <CodeBlock language="typescript">
          {`// ❌ This no longer works
const testProduct = await fetchProducts(['android.test.purchased'])
// Returns E_SERVICE_DISCONNECTED error`}
        </CodeBlock>

        <h4>After (Current approach):</h4>
        <CodeBlock language="typescript">
          {`// ✅ Use real product with test account
// 1. Add test account in Play Console
// 2. Use real product ID
const testProduct = await fetchProducts(['your_real_product_id'])
// Test account won't be charged`}
        </CodeBlock>

        <h3>Setting Up License Testing</h3>
        <ol>
          <li>Go to Google Play Console → Settings → License Testing</li>
          <li>Add tester email addresses (must be Google accounts)</li>
          <li>Testers must join your testing program</li>
          <li>Use real product IDs in your code</li>
          <li>Test purchases won't charge testers</li>
        </ol>
      </section>

      <section>
        <h2>📊 Version Compatibility</h2>

        <h3>Google Play Billing Library Timeline</h3>
        <table className="error-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Status</th>
              <th>Deprecation Date</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>v8.x</td>
              <td>✅ Current</td>
              <td>TBD</td>
              <td>
                Latest recommended version (requires minSdk 23, Kotlin 2.2.0)
              </td>
            </tr>
            <tr>
              <td>v7.x</td>
              <td>✅ Supported</td>
              <td>August 31, 2025</td>
              <td>User Choice Billing support</td>
            </tr>
            <tr>
              <td>v6.x</td>
              <td>✅ Supported</td>
              <td>August 31, 2025</td>
              <td>Alternative Billing support</td>
            </tr>
            <tr>
              <td>v5.x</td>
              <td>❌ Deprecated</td>
              <td>August 31, 2024</td>
              <td>No longer accepted</td>
            </tr>
            <tr>
              <td>v4.x</td>
              <td>❌ Deprecated</td>
              <td>August 2, 2023</td>
              <td>No longer accepted</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>🆕 Recent Updates</h2>

        <h3>
          <a
            href="https://developer.android.com/google/play/billing/release-notes#8-1-0"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Play Billing Library v8.1
          </a>{' '}
          (November 2025)
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Released November 6, 2025
        </p>
        <ul>
          <li>
            <strong>Suspended Subscriptions</strong> -{' '}
            <code>Purchase.isSuspended()</code> to detect payment failures
          </li>
          <li>
            <strong>Pre-order Products</strong> - <code>PreorderDetails</code>{' '}
            for one-time purchase pre-orders
          </li>
          <li>
            <strong>minSdk 23</strong> - Minimum SDK increased to Android 6.0
          </li>
          <li>
            <strong>Kotlin 2.2.0</strong> - Requires Kotlin 2.2.0 or higher
          </li>
          <li>
            <strong>Deprecated API</strong> -{' '}
            <code>setSubscriptionReplacementMode()</code> deprecated in favor of{' '}
            <code>SubscriptionProductReplacementParams</code>
          </li>
        </ul>

        <h3>Google Play Billing Library v7 (May 2024)</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Released at Google I/O 2024
        </p>
        <ul>
          <li>
            <strong>Installment Subscriptions</strong> - New monetization model
            for subscription payments
          </li>
          <li>
            <strong>Enhanced Pending Purchases</strong> - Better handling of
            pending transactions
          </li>
          <li>
            <strong>Improved Error Codes</strong> - More specific error
            responses including NETWORK_ERROR
          </li>
          <li>
            <strong>Subscription Management APIs</strong> - Simplified
            subscription state management
          </li>
          <li>
            <strong>Performance Improvements</strong> - Optimized billing flow
            and reduced latency
          </li>
        </ul>
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            marginTop: '0.5rem',
          }}
        >
          ⚠️ Deadline: All apps must migrate from v5 by November 1, 2024
        </p>

        <h3>iOS StoreKit 2 Evolution</h3>

        <h4>WWDC 2024 - StoreKit 1 Deprecation (iOS 18+)</h4>
        <ul>
          <li>
            <strong>⚠️ StoreKit 1 officially deprecated</strong> - Now called
            "original API"
          </li>
          <li>
            <strong>Promoted purchases API</strong> - New Swift API (iOS 16.4+)
          </li>
          <li>
            <strong>App account token</strong> - Track user accounts across
            transactions
          </li>
          <li>All new features exclusive to StoreKit 2</li>
        </ul>

        <h4>WWDC 2023 Updates (iOS 17+)</h4>
        <ul>
          <li>
            <strong>Storefront fields</strong> - Access to storefront and
            country code
          </li>
          <li>
            <strong>Purchase reason</strong> - Distinguish user-initiated vs
            auto-renewal
          </li>
          <li>
            <strong>nextRenewalDate</strong> - Direct access in RenewalInfo
            model
          </li>
          <li>
            Most features work retroactively with iOS 15+ when using Xcode 15
          </li>
        </ul>

        <h4>WWDC 2022 Updates (iOS 16+)</h4>
        <ul>
          <li>
            <strong>Message API</strong> - App Store notifications to customers
          </li>
          <li>
            <strong>Environment property</strong> - Distinguish
            sandbox/production purchases
          </li>
          <li>
            <strong>recentSubscriptionStartDate</strong> - Track subscription
            continuity
          </li>
          <li>
            <strong>originalPurchaseDate</strong> - Support for
            paid-to-subscription migrations
          </li>
        </ul>

        <h4>WWDC 2021 - Initial Release (iOS 15+)</h4>
        <ul>
          <li>
            <strong>Swift async/await API</strong> - Modern concurrency patterns
          </li>
          <li>
            <strong>One-line purchase flow</strong> - Simplified purchase
            implementation
          </li>
          <li>
            <strong>Built-in receipt validation</strong> - No server-side
            validation required
          </li>
          <li>
            <strong>Transaction history API</strong> - Easy access to purchase
            history
          </li>
        </ul>
      </section>
    </div>
  );
}

export default Notes;
