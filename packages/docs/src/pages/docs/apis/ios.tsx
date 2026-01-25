import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function IOSAPIs() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="iOS APIs"
        description="OpenIAP iOS-specific APIs - StoreKit 2 APIs for promoted products, refunds, external purchases, and more."
        path="/docs/apis/ios"
        keywords="iOS API, StoreKit 2, clearTransactionIOS, syncIOS, external purchase"
      />
      <h1>iOS APIs</h1>
      <p>
        iOS-specific APIs using StoreKit 2. These APIs are only available on
        iOS/macOS and end with the <code>IOS</code> suffix.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <a href="#transaction-management"><strong>Transaction Management</strong></a>: clearTransactionIOS,
            getPendingTransactionsIOS
          </li>
          <li>
            <a href="#subscription-management"><strong>Subscription</strong></a>: subscriptionStatusIOS,
            showManageSubscriptionsIOS
          </li>
          <li>
            <a href="#external-purchase-ios"><strong>External Purchase</strong></a>: iOS 17.4+ external purchase flow
          </li>
          <li>
            <a href="#verification-ios"><strong>Verification</strong></a>: isTransactionVerifiedIOS,
            getTransactionJwsIOS
          </li>
        </ul>
      </TLDRBox>

      <section>
        <AnchorLink id="transaction-management" level="h2">
          Transaction Management
        </AnchorLink>

        <AnchorLink id="clear-transaction-ios" level="h3">
          clearTransactionIOS
        </AnchorLink>
        <p>Clear pending transactions from the StoreKit payment queue.</p>
        <CodeBlock language="swift">{`func clearTransactionIOS() async throws -> Bool`}</CodeBlock>

        <AnchorLink id="get-pending-transactions-ios" level="h3">
          getPendingTransactionsIOS
        </AnchorLink>
        <p>Retrieve all pending transactions in the StoreKit queue.</p>
        <CodeBlock language="swift">{`func getPendingTransactionsIOS() async throws -> [Purchase]`}</CodeBlock>

        <AnchorLink id="sync-ios" level="h3">
          syncIOS
        </AnchorLink>
        <p>Force a StoreKit sync for transactions (iOS 15+).</p>
        <CodeBlock language="swift">{`func syncIOS() async throws -> Bool`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="storefront-products" level="h2">
          Storefront & Products
        </AnchorLink>

        <AnchorLink id="get-storefront-ios" level="h3">
          <span style={{ textDecoration: 'line-through' }}>
            getStorefrontIOS
          </span>{' '}
          <span style={{ color: 'var(--text-warning)', fontSize: '0.8em' }}>
            (deprecated)
          </span>
        </AnchorLink>
        <p>
          <strong>Deprecated.</strong> Use{' '}
          <Link to="/docs/apis/purchase#get-storefront">getStorefront()</Link>{' '}
          instead.
        </p>
        <CodeBlock language="swift">{`@available(*, deprecated, message: "Use getStorefront()")
func getStorefrontIOS() async throws -> String`}</CodeBlock>

        <AnchorLink id="get-promoted-product-ios" level="h3">
          getPromotedProductIOS
        </AnchorLink>
        <p>Get the currently promoted product from App Store (iOS 11+).</p>
        <CodeBlock language="swift">{`func getPromotedProductIOS() async throws -> Product?`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="subscription-apis" level="h2">
          Subscription APIs
        </AnchorLink>

        <AnchorLink id="is-eligible-for-intro-offer-ios" level="h3">
          isEligibleForIntroOfferIOS
        </AnchorLink>
        <p>
          Check introductory offer eligibility for a subscription group (iOS
          12.2+).
        </p>
        <CodeBlock language="swift">{`func isEligibleForIntroOfferIOS(groupID: String) async throws -> Bool`}</CodeBlock>

        <AnchorLink id="subscription-status-ios" level="h3">
          subscriptionStatusIOS
        </AnchorLink>
        <p>Get detailed subscription status using StoreKit 2 (iOS 15+).</p>
        <CodeBlock language="swift">{`func subscriptionStatusIOS(sku: String) async throws -> [SubscriptionStatus]`}</CodeBlock>

        <AnchorLink id="current-entitlement-ios" level="h3">
          currentEntitlementIOS
        </AnchorLink>
        <p>Get current StoreKit 2 entitlement for a product (iOS 15+).</p>
        <CodeBlock language="swift">{`func currentEntitlementIOS(sku: String) async throws -> Purchase?`}</CodeBlock>

        <AnchorLink id="latest-transaction-ios" level="h3">
          latestTransactionIOS
        </AnchorLink>
        <p>Get the most recent transaction for a product (iOS 15+).</p>
        <CodeBlock language="swift">{`func latestTransactionIOS(sku: String) async throws -> Purchase?`}</CodeBlock>

        <AnchorLink id="show-manage-subscriptions-ios" level="h3">
          showManageSubscriptionsIOS
        </AnchorLink>
        <p>
          Show in-app subscription management UI and detect status changes (iOS
          15+).
        </p>
        <CodeBlock language="swift">{`func showManageSubscriptionsIOS() async throws -> [Purchase]`}</CodeBlock>
        <p>
          Returns purchases for subscriptions whose auto-renewal status changed.
        </p>
      </section>

      <section>
        <AnchorLink id="verification" level="h2">
          Verification
        </AnchorLink>

        <AnchorLink id="is-transaction-verified-ios" level="h3">
          isTransactionVerifiedIOS
        </AnchorLink>
        <p>Verify a StoreKit 2 transaction signature (iOS 15+).</p>
        <CodeBlock language="swift">{`func isTransactionVerifiedIOS(sku: String) async throws -> Bool`}</CodeBlock>

        <AnchorLink id="get-transaction-jws-ios" level="h3">
          getTransactionJwsIOS
        </AnchorLink>
        <p>
          Get the transaction JWS for server-side validation (iOS 15+).
        </p>
        <CodeBlock language="swift">{`func getTransactionJwsIOS(sku: String) async throws -> String?`}</CodeBlock>

        <AnchorLink id="get-receipt-data-ios" level="h3">
          getReceiptDataIOS
        </AnchorLink>
        <p>Get base64-encoded receipt data for legacy validation.</p>
        <CodeBlock language="swift">{`func getReceiptDataIOS() async throws -> String?`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="refunds-redemption" level="h2">
          Refunds & Redemption
        </AnchorLink>

        <AnchorLink id="begin-refund-request-ios" level="h3">
          beginRefundRequestIOS
        </AnchorLink>
        <p>Initiate a refund request for a product (iOS 15+).</p>
        <CodeBlock language="swift">{`func beginRefundRequestIOS(sku: String) async throws -> String?`}</CodeBlock>

        <AnchorLink id="present-code-redemption-sheet-ios" level="h3">
          presentCodeRedemptionSheetIOS
        </AnchorLink>
        <p>Present the App Store promo code redemption sheet.</p>
        <CodeBlock language="swift">{`func presentCodeRedemptionSheetIOS() async throws -> Bool`}</CodeBlock>

        <AnchorLink id="get-app-transaction-ios" level="h3">
          getAppTransactionIOS
        </AnchorLink>
        <p>Fetch the current app transaction (iOS 16+).</p>
        <CodeBlock language="swift">{`func getAppTransactionIOS() async throws -> AppTransaction?

struct AppTransaction {
    let bundleId: String
    let appVersion: String
    let originalAppVersion: String
    let originalPurchaseDate: Date
    let environment: String  // "Sandbox" | "Production"
    // iOS 18.4+ properties
    let appTransactionId: String?
    let originalPlatform: String?
}`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="external-purchase" level="h2">
          External Purchase (iOS 17.4+)
        </AnchorLink>
        <p>
          iOS supports external purchase links via Apple's{' '}
          <code>ExternalPurchase</code> API. This requires a 3-step flow for
          Apple compliance.
        </p>

        <AnchorLink id="can-present-external-purchase-notice-ios" level="h3">
          canPresentExternalPurchaseNoticeIOS
        </AnchorLink>
        <p>
          Check if external purchase notice sheet can be presented (iOS 17.4+).
        </p>
        <CodeBlock language="swift">{`func canPresentExternalPurchaseNoticeIOS() async throws -> Bool`}</CodeBlock>

        <AnchorLink id="present-external-purchase-notice-sheet-ios" level="h3">
          presentExternalPurchaseNoticeSheetIOS
        </AnchorLink>
        <p>Present Apple's compliance notice sheet (iOS 17.4+).</p>
        <CodeBlock language="swift">{`func presentExternalPurchaseNoticeSheetIOS() async throws -> ExternalPurchaseNoticeResultIOS

struct ExternalPurchaseNoticeResultIOS {
    let error: String?
    let result: ExternalPurchaseNoticeAction  // .continue or .dismissed
}`}</CodeBlock>

        <AnchorLink id="present-external-purchase-link-ios" level="h3">
          presentExternalPurchaseLinkIOS
        </AnchorLink>
        <p>Open external purchase URL in Safari (iOS 18.2+).</p>
        <CodeBlock language="swift">{`func presentExternalPurchaseLinkIOS(_ url: String) async throws -> ExternalPurchaseLinkResultIOS

struct ExternalPurchaseLinkResultIOS {
    let error: String?
    let success: Bool
}`}</CodeBlock>

        <h4>External Purchase Flow Example</h4>
        <CodeBlock language="swift">{`// Step 1: Check availability
let canPresent = try await OpenIapModule.shared.canPresentExternalPurchaseNoticeIOS()
guard canPresent else { return }

// Step 2: Show Apple's notice sheet
let noticeResult = try await OpenIapModule.shared.presentExternalPurchaseNoticeSheetIOS()
guard noticeResult.result == .continue else { return }

// Step 3: Open external purchase link (iOS 18.2+)
let result = try await OpenIapModule.shared.presentExternalPurchaseLinkIOS(
    "https://your-payment-site.com/checkout"
)`}</CodeBlock>

        <div className="alert-card alert-card--info">
          <p>
            <strong>Requirements:</strong> iOS 17.4+ for notice sheet, iOS 18.2+
            for custom links. App must have StoreKit external purchase
            entitlement.
          </p>
        </div>
      </section>

      <section>
        <AnchorLink id="deprecated" level="h2">
          Deprecated APIs
        </AnchorLink>

        <AnchorLink id="request-purchase-on-promoted-product-ios" level="h3">
          <span style={{ textDecoration: 'line-through' }}>
            requestPurchaseOnPromotedProductIOS
          </span>{' '}
          <span style={{ color: 'var(--text-warning)', fontSize: '0.8em' }}>
            (deprecated)
          </span>
        </AnchorLink>
        <p>
          <strong>Deprecated.</strong> Use{' '}
          <Link to="/docs/events#promoted-product-event-ios">
            promotedProductListenerIOS
          </Link>{' '}
          to receive the product ID, then call{' '}
          <Link to="/docs/apis/purchase#request-purchase">requestPurchase</Link>{' '}
          with that SKU instead.
        </p>
        <CodeBlock language="swift">{`@available(*, deprecated, message: "Use promotedProductListenerIOS + requestPurchase instead")
func requestPurchaseOnPromotedProductIOS() async throws -> Bool`}</CodeBlock>
        <p>
          In StoreKit 2, promoted products can be purchased directly via the
          standard purchase flow. When a user taps a promoted product in the App
          Store, the <code>promotedProductListenerIOS</code> event fires with the
          product ID. Use this ID to call <code>requestPurchase()</code> directly.
        </p>
        <CodeBlock language="swift">{`// Recommended approach
let subscription = promotedProductListenerIOS { productId in
    // Call requestPurchase with the received productId
    try await requestPurchase(RequestPurchaseProps(
        request: .purchase(RequestPurchasePropsByPlatforms(
            apple: RequestPurchaseIosProps(sku: productId)
        )),
        type: .inApp
    ))
}`}</CodeBlock>

        <AnchorLink id="validate-receipt-ios" level="h3">
          <span style={{ textDecoration: 'line-through' }}>
            validateReceiptIOS
          </span>{' '}
          <span style={{ color: 'var(--text-warning)', fontSize: '0.8em' }}>
            (deprecated)
          </span>
        </AnchorLink>
        <p>
          <strong>Deprecated.</strong> Use{' '}
          <Link to="/docs/apis/validation#verify-purchase">verifyPurchase</Link>{' '}
          instead.
        </p>
        <CodeBlock language="swift">{`@available(*, deprecated, message: "Use verifyPurchase()")
func validateReceiptIOS(options: PurchaseVerificationProps) async throws -> PurchaseVerificationResult`}</CodeBlock>
      </section>
    </div>
  );
}

export default IOSAPIs;
