import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import CodeBlock from '../../../components/CodeBlock';
import Pagination from '../../../components/Pagination';

const noteCardStyle = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: '0.5rem',
  padding: '1rem',
  marginBottom: '1.5rem',
};

const noteTitleStyle = { marginTop: 0, color: 'var(--text-primary)' };

interface Note {
  id: string;
  date: Date;
  element: React.ReactNode;
}

function Notes() {
  useScrollToHash();

  const allNotes: Note[] = [
    // External Payments 8.3.0 Support - Dec 27, 2025
    {
      id: 'external-payments-830',
      date: new Date('2025-12-27'),
      element: (
        <div key="external-payments-830" style={noteCardStyle}>
          <h4 style={noteTitleStyle}>
            📅 openiap-google v1.3.17 -{' '}
            <a
              href="https://developer.android.com/google/play/billing/release-notes#8-3-0"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Play Billing 8.3.0 External Payments
            </a>
          </h4>
          <p>
            <strong>New External Payments Program (Japan Only):</strong>
          </p>
          <p>
            Google Play Billing Library 8.3.0 introduces the External Payments
            program, which presents a side-by-side choice between Google Play
            Billing and the developer's external payment option directly in the
            purchase flow.
          </p>
          <p>
            <strong>New APIs:</strong>
          </p>
          <ul>
            <li>
              <strong>
                <code>BillingProgramAndroid.EXTERNAL_PAYMENTS</code>
              </strong>{' '}
              - New billing program type for external payments
            </li>
            <li>
              <strong>
                <code>DeveloperBillingOptionParamsAndroid</code>
              </strong>{' '}
              - Configure external payment option in purchase flow
            </li>
            <li>
              <strong>
                <code>DeveloperBillingLaunchModeAndroid</code>
              </strong>{' '}
              - How to launch the external payment link
            </li>
            <li>
              <strong>
                <code>DeveloperProvidedBillingDetailsAndroid</code>
              </strong>{' '}
              - Contains externalTransactionToken when user selects developer billing
            </li>
            <li>
              <strong>
                <code>addDeveloperProvidedBillingListener()</code>
              </strong>{' '}
              - New listener for when user selects developer billing
            </li>
            <li>
              <strong>
                <code>developerBillingOption</code>
              </strong>{' '}
              - New field in RequestPurchaseAndroidProps and RequestSubscriptionAndroidProps
            </li>
          </ul>
          <p>
            <strong>New Event:</strong>
          </p>
          <ul>
            <li>
              <strong>
                <code>IapEvent.DeveloperProvidedBillingAndroid</code>
              </strong>{' '}
              - Fired when user selects developer billing in External Payments flow
            </li>
          </ul>
          <p>
            <strong>Key Differences from User Choice Billing:</strong>
          </p>
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
          <p>
            <strong>References:</strong>
          </p>
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
          <h4 style={noteTitleStyle}>
            📅 openiap-google v1.3.16 -{' '}
            <a
              href="https://developer.android.com/google/play/billing/release-notes#8-2-1"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Play Billing 8.2.1
            </a>
          </h4>
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
          <h4 style={noteTitleStyle}>📅 openiap-gql v1.3.8</h4>
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
          <h4 style={noteTitleStyle}>
            📅 openiap-gql v1.3.7 / openiap-apple v1.3.7 / openiap-google
            v1.3.15
          </h4>
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
          <h4 style={noteTitleStyle}>
            📅 openiap-gql v1.3.5 / openiap-apple v1.3.5 - GitHub Release Tag
            Management Update
          </h4>
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
          <h4 style={noteTitleStyle}>
            📅 openiap-gql v1.3.4 / openiap-google v1.3.14 / openiap-apple
            v1.3.2 - Platform-Specific Verification Options
          </h4>
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
          <h4 style={noteTitleStyle}>
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
          <h4 style={noteTitleStyle}>
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
          <h4 style={noteTitleStyle}>
            📅 openiap v1.3.0 - Platform Props & Store Field Updates
          </h4>
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
          <h4 style={noteTitleStyle}>
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
          <h4 style={noteTitleStyle}>
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
      ),
    },

    // openiap-gql 1.0.12 - External Purchase Support - Aug 25, 2025
    {
      id: 'gql-1.0.12-external',
      date: new Date('2025-08-25'),
      element: (
        <div key="gql-1.0.12-external" style={noteCardStyle}>
          <h4 style={noteTitleStyle}>
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
          <h4 style={noteTitleStyle}>
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
        </div>
      ),
    },

    // Billing Library v5 Deprecated - Aug 31, 2024
    {
      id: 'billing-v5-deprecated',
      date: new Date('2024-08-31'),
      element: (
        <div key="billing-v5-deprecated" style={noteCardStyle}>
          <h4 style={noteTitleStyle}>
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
      ),
    },
  ];

  // Sort by date (newest first)
  const sortedNotes = [...allNotes].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

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

      <Pagination itemsPerPage={5}>
        {sortedNotes.map((note) => (
          <section key={note.id} id={note.id}>
            {note.element}
          </section>
        ))}
      </Pagination>
    </div>
  );
}

export default Notes;
