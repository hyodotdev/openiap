import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

// Old bookmarks pointed at /docs/apis#<symbol>; map those to the flat
// per-symbol routes introduced in this PR so existing external links
// keep working. The slug → route mapping mirrors the routes in
// pages/docs/index.tsx; iOS / Android symbols redirect into their
// platform subfolders.
const LEGACY_ANCHOR_REDIRECTS: Record<string, string> = {
  'init-connection': '/docs/apis/init-connection',
  'end-connection': '/docs/apis/end-connection',
  'fetch-products': '/docs/apis/fetch-products',
  'get-available-purchases': '/docs/apis/get-available-purchases',
  'request-purchase': '/docs/apis/request-purchase',
  'finish-transaction': '/docs/apis/finish-transaction',
  'restore-purchases': '/docs/apis/restore-purchases',
  'get-storefront': '/docs/apis/get-storefront',
  'get-active-subscriptions': '/docs/apis/get-active-subscriptions',
  'has-active-subscriptions': '/docs/apis/has-active-subscriptions',
  'deep-link-to-subscriptions': '/docs/apis/deep-link-to-subscriptions',
  // iOS-specific
  'clear-transaction-ios': '/docs/apis/ios/clear-transaction-ios',
  'get-storefront-ios': '/docs/apis/ios/get-storefront-ios',
  'get-promoted-product-ios': '/docs/apis/ios/get-promoted-product-ios',
  'request-purchase-on-promoted-product-ios':
    '/docs/apis/ios/request-purchase-on-promoted-product-ios',
  'get-pending-transactions-ios': '/docs/apis/ios/get-pending-transactions-ios',
  'get-all-transactions-ios': '/docs/apis/ios/get-all-transactions-ios',
  'is-eligible-for-intro-offer-ios':
    '/docs/apis/ios/is-eligible-for-intro-offer-ios',
  'subscription-status-ios': '/docs/apis/ios/subscription-status-ios',
  'current-entitlement-ios': '/docs/apis/ios/current-entitlement-ios',
  'latest-transaction-ios': '/docs/apis/ios/latest-transaction-ios',
  'show-manage-subscriptions-ios':
    '/docs/apis/ios/show-manage-subscriptions-ios',
  'is-transaction-verified-ios': '/docs/apis/ios/is-transaction-verified-ios',
  'get-transaction-jws-ios': '/docs/apis/ios/get-transaction-jws-ios',
  'get-receipt-data-ios': '/docs/apis/ios/get-receipt-data-ios',
  'begin-refund-request-ios': '/docs/apis/ios/begin-refund-request-ios',
  'present-code-redemption-sheet-ios':
    '/docs/apis/ios/present-code-redemption-sheet-ios',
  'get-app-transaction-ios': '/docs/apis/ios/get-app-transaction-ios',
  'can-present-external-purchase-notice-ios':
    '/docs/apis/ios/can-present-external-purchase-notice-ios',
  'present-external-purchase-notice-sheet-ios':
    '/docs/apis/ios/present-external-purchase-notice-sheet-ios',
  'present-external-purchase-link-ios':
    '/docs/apis/ios/present-external-purchase-link-ios',
  'is-eligible-for-external-purchase-custom-link-ios':
    '/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios',
  'get-external-purchase-custom-link-token-ios':
    '/docs/apis/ios/get-external-purchase-custom-link-token-ios',
  'show-external-purchase-custom-link-notice-ios':
    '/docs/apis/ios/show-external-purchase-custom-link-notice-ios',
  'sync-ios': '/docs/apis/ios/sync-ios',
  'validate-receipt-ios': '/docs/apis/ios/validate-receipt-ios',
  // Android-specific
  'acknowledge-purchase-android':
    '/docs/apis/android/acknowledge-purchase-android',
  'consume-purchase-android': '/docs/apis/android/consume-purchase-android',
  'check-alternative-billing-availability-android':
    '/docs/apis/android/check-alternative-billing-availability-android',
  'show-alternative-billing-dialog-android':
    '/docs/apis/android/show-alternative-billing-dialog-android',
  'create-alternative-billing-token-android':
    '/docs/apis/android/create-alternative-billing-token-android',
  'enable-billing-program-android':
    '/docs/apis/android/enable-billing-program-android',
  'is-billing-program-available-android':
    '/docs/apis/android/is-billing-program-available-android',
  'launch-external-link-android':
    '/docs/apis/android/launch-external-link-android',
  'create-billing-program-reporting-details-android':
    '/docs/apis/android/create-billing-program-reporting-details-android',
  // Validation/Refund/Debugging moved to Features
  'verify-purchase': '/docs/features/validation#verify-purchase',
  'verify-purchase-with-provider':
    '/docs/features/validation#verify-purchase-with-provider',
  'validate-receipt': '/docs/features/validation#verify-purchase',
  validation: '/docs/features/validation',
  refund: '/docs/features/refund',
  debugging: '/docs/features/debugging',
  'debugging-logging': '/docs/features/debugging',
  // Section-level anchors that pointed at the old combined page
  'platform-specific-apis': '/docs/apis#ios-functions',
  'ios-apis': '/docs/apis#ios-functions',
  'android-apis': '/docs/apis#android-functions',
  terminology: '/docs/apis#terminology',
  'request-apis': '/docs/apis/fetch-products#request-apis',
  'transaction-vs-purchase': '/docs/apis#transaction-vs-purchase',
  'naming-convention': '/docs/apis#naming-convention',
};

function APIsIndex() {
  useScrollToHash();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!location.hash) return;
    const anchor = location.hash.slice(1);
    const redirect = LEGACY_ANCHOR_REDIRECTS[anchor];
    if (!redirect) return;
    // Skip the navigate when the redirect target already matches the
    // current pathname + hash. Same-page anchors (`terminology`, etc.)
    // would otherwise re-fire this effect and infinite-loop, and even
    // cross-page redirects would push a duplicate history entry on
    // re-renders if the URL is already correct.
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
        title="APIs"
        description="OpenIAP API reference for iOS StoreKit 2 and Android Play Billing. initConnection, fetchProducts, requestPurchase, finishTransaction, and platform-specific methods."
        path="/docs/apis"
        keywords="OpenIAP API, IAP API reference, initConnection, fetchProducts, requestPurchase, finishTransaction, verifyPurchase, StoreKit 2 API, Play Billing API"
      />
      <h1>APIs</h1>
      <p>
        Complete function reference for OpenIAP. Every public function is listed
        below with a one-line description and a link to its full signature. For
        higher-level guides see{' '}
        <Link to="/docs/features/purchase">Features</Link>.
      </p>

      <section>
        <AnchorLink id="connection" level="h2">
          Connection
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Function</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Link to="/docs/apis/init-connection">
                  <code>initConnection</code>
                </Link>
              </td>
              <td>Initialize the store connection. Call before any IAP API.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/end-connection">
                  <code>endConnection</code>
                </Link>
              </td>
              <td>Close the store connection and release resources.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="products" level="h2">
          Products
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Function</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Link to="/docs/apis/fetch-products">
                  <code>fetchProducts</code>
                </Link>
              </td>
              <td>Fetch products or subscriptions from the store.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/get-available-purchases">
                  <code>getAvailablePurchases</code>
                </Link>
              </td>
              <td>List active purchases for the current user.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="purchase" level="h2">
          Purchase
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Function</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Link to="/docs/apis/request-purchase">
                  <code>requestPurchase</code>
                </Link>
              </td>
              <td>Initiate a purchase or subscription flow.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/finish-transaction">
                  <code>finishTransaction</code>
                </Link>
              </td>
              <td>
                Complete a transaction after server-side verification. Required
                on Android within 3 days.
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/restore-purchases">
                  <code>restorePurchases</code>
                </Link>
              </td>
              <td>Restore non-consumable and active subscription purchases.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/get-storefront">
                  <code>getStorefront</code>
                </Link>
              </td>
              <td>Return the user's storefront country code.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="subscription" level="h2">
          Subscription
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Function</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Link to="/docs/apis/get-active-subscriptions">
                  <code>getActiveSubscriptions</code>
                </Link>
              </td>
              <td>Get details of all currently active subscriptions.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/has-active-subscriptions">
                  <code>hasActiveSubscriptions</code>
                </Link>
              </td>
              <td>Check whether the user has any active subscription.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/deep-link-to-subscriptions">
                  <code>deepLinkToSubscriptions</code>
                </Link>
              </td>
              <td>Open the platform's subscription management UI.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="validation" level="h2">
          Validation
        </AnchorLink>
        <p>
          Server-side verification helpers. Full walkthrough lives on{' '}
          <Link to="/docs/features/validation">Features → Validation</Link> —
          these signatures are listed here for completeness.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Function</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Link to="/docs/features/validation#verify-purchase">
                  <code>verifyPurchase</code>
                </Link>
              </td>
              <td>
                Verify a purchase against your own backend (returns{' '}
                <code>isValid</code> + raw store metadata).
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/features/validation#verify-purchase-with-provider">
                  <code>verifyPurchaseWithProvider</code>
                </Link>
              </td>
              <td>
                Verify via a managed provider (IAPKit, Apple, Google, Horizon)
                without standing up your own server.
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/validate-receipt">
                  <code style={{ textDecoration: 'line-through' }}>
                    validateReceipt
                  </code>
                </Link>
              </td>
              <td>
                <strong>Deprecated.</strong> Use{' '}
                <Link to="/docs/features/validation#verify-purchase">
                  <code>verifyPurchase</code>
                </Link>{' '}
                instead — same input/output shape.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="ios-functions" level="h2">
          iOS Functions
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Function</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Link to="/docs/apis/ios/sync-ios">
                  <code>syncIOS</code>
                </Link>
              </td>
              <td>Force sync transactions with the App Store.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/get-storefront-ios">
                  <code style={{ textDecoration: 'line-through' }}>
                    getStorefrontIOS
                  </code>
                </Link>
              </td>
              <td>
                <strong>Deprecated.</strong> Use cross-platform{' '}
                <Link to="/docs/apis/get-storefront">
                  <code>getStorefront</code>
                </Link>{' '}
                instead.
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/clear-transaction-ios">
                  <code>clearTransactionIOS</code>
                </Link>
              </td>
              <td>Clear pending transactions in the queue (sandbox helper).</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/get-promoted-product-ios">
                  <code>getPromotedProductIOS</code>
                </Link>
              </td>
              <td>Read the App Store-promoted product, if any.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/request-purchase-on-promoted-product-ios">
                  <code>requestPurchaseOnPromotedProductIOS</code>
                </Link>
              </td>
              <td>Buy the currently promoted product.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/get-pending-transactions-ios">
                  <code>getPendingTransactionsIOS</code>
                </Link>
              </td>
              <td>List unfinished StoreKit transactions.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/get-all-transactions-ios">
                  <code>getAllTransactionsIOS</code>
                </Link>
              </td>
              <td>
                List every StoreKit transaction (finished + unfinished) for the
                current user.
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/is-eligible-for-intro-offer-ios">
                  <code>isEligibleForIntroOfferIOS</code>
                </Link>
              </td>
              <td>Check intro-offer eligibility for a subscription group.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/subscription-status-ios">
                  <code>subscriptionStatusIOS</code>
                </Link>
              </td>
              <td>Get subscription status objects from StoreKit 2.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/current-entitlement-ios">
                  <code>currentEntitlementIOS</code>
                </Link>
              </td>
              <td>Get the user's current entitlement for a product.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/latest-transaction-ios">
                  <code>latestTransactionIOS</code>
                </Link>
              </td>
              <td>Get the latest verified transaction for a product.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/show-manage-subscriptions-ios">
                  <code>showManageSubscriptionsIOS</code>
                </Link>
              </td>
              <td>Present the manage-subscriptions sheet.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/begin-refund-request-ios">
                  <code>beginRefundRequestIOS</code>
                </Link>
              </td>
              <td>
                Present the refund request sheet (iOS 15+). See{' '}
                <Link to="/docs/features/refund">Refund</Link>.
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/is-transaction-verified-ios">
                  <code>isTransactionVerifiedIOS</code>
                </Link>
              </td>
              <td>Check whether a transaction's JWS verification passed.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/get-transaction-jws-ios">
                  <code>getTransactionJwsIOS</code>
                </Link>
              </td>
              <td>Return the JWS string for a transaction.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/get-receipt-data-ios">
                  <code>getReceiptDataIOS</code>
                </Link>
              </td>
              <td>Get base64 receipt data (legacy validation).</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/present-code-redemption-sheet-ios">
                  <code>presentCodeRedemptionSheetIOS</code>
                </Link>
              </td>
              <td>
                Show the App Store offer code redemption sheet. See{' '}
                <Link to="/docs/features/offer-code-redemption">
                  Offer Code Redemption
                </Link>
                .
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/get-app-transaction-ios">
                  <code>getAppTransactionIOS</code>
                </Link>
              </td>
              <td>Fetch the app transaction (iOS 16+).</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/can-present-external-purchase-notice-ios">
                  <code>canPresentExternalPurchaseNoticeIOS</code>
                </Link>
              </td>
              <td>
                Check eligibility for the external purchase notice sheet (iOS
                17.4+).
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/present-external-purchase-notice-sheet-ios">
                  <code>presentExternalPurchaseNoticeSheetIOS</code>
                </Link>
              </td>
              <td>Present the external purchase notice sheet (iOS 17.4+).</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/present-external-purchase-link-ios">
                  <code>presentExternalPurchaseLinkIOS</code>
                </Link>
              </td>
              <td>
                Present an external purchase link, StoreKit External (iOS 16+).
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios">
                  <code>isEligibleForExternalPurchaseCustomLinkIOS</code>
                </Link>
              </td>
              <td>
                Check eligibility for the custom-link variant of external
                purchase (iOS 18.1+).
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/get-external-purchase-custom-link-token-ios">
                  <code>getExternalPurchaseCustomLinkTokenIOS</code>
                </Link>
              </td>
              <td>
                Fetch a token for Apple's External Purchase Server reporting API
                (iOS 18.1+).
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/show-external-purchase-custom-link-notice-ios">
                  <code>showExternalPurchaseCustomLinkNoticeIOS</code>
                </Link>
              </td>
              <td>
                Present the disclosure sheet required before linking out via
                ExternalPurchaseCustomLink (iOS 18.1+).
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/validate-receipt-ios">
                  <code style={{ textDecoration: 'line-through' }}>
                    validateReceiptIOS
                  </code>
                </Link>
              </td>
              <td>
                <strong>Deprecated.</strong> Legacy App Store receipt
                validation. Use{' '}
                <Link to="/docs/features/validation#verify-purchase">
                  <code>verifyPurchase</code>
                </Link>{' '}
                instead.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="android-functions" level="h2">
          Android Functions
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Function</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Link to="/docs/apis/android/acknowledge-purchase-android">
                  <code>acknowledgePurchaseAndroid</code>
                </Link>
              </td>
              <td>
                Acknowledge a non-consumable purchase. Required within 3 days or
                Google auto-refunds.
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/android/consume-purchase-android">
                  <code>consumePurchaseAndroid</code>
                </Link>
              </td>
              <td>Consume a consumable purchase so it can be re-bought.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/android/check-alternative-billing-availability-android">
                  <code>checkAlternativeBillingAvailabilityAndroid</code>
                </Link>
              </td>
              <td>
                Check whether alternative billing is available for the user.
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/android/show-alternative-billing-dialog-android">
                  <code>showAlternativeBillingDialogAndroid</code>
                </Link>
              </td>
              <td>Display Google's alternative billing information dialog.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/android/create-alternative-billing-token-android">
                  <code>createAlternativeBillingTokenAndroid</code>
                </Link>
              </td>
              <td>Create a reporting token for an alternative billing flow.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/android/enable-billing-program-android">
                  <code>enableBillingProgramAndroid</code>
                </Link>
              </td>
              <td>
                Enable a Play Billing Program (Play Billing 8.2.0+). Note: this
                is a config field of{' '}
                <Link to="/docs/types/alternative-billing-types#init-connection-config">
                  <code>InitConnectionConfig</code>
                </Link>{' '}
                passed to <code>initConnection()</code>, not a standalone
                mutation; the page documents the config-flow shape.
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/android/is-billing-program-available-android">
                  <code>isBillingProgramAvailableAndroid</code>
                </Link>
              </td>
              <td>
                Check whether a billing program (e.g., External Payments) is
                available for the current user.
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/android/launch-external-link-android">
                  <code>launchExternalLinkAndroid</code>
                </Link>
              </td>
              <td>
                Launch an external content / offer link from inside the Billing
                Programs flow (Play Billing 8.2.0+).
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/android/create-billing-program-reporting-details-android">
                  <code>createBillingProgramReportingDetailsAndroid</code>
                </Link>
              </td>
              <td>
                Create the reporting payload Google requires after a
                Developer-Provided Billing transaction (Play Billing 8.3.0+).
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="naming-convention" level="h2">
          Naming Convention
        </AnchorLink>
        <ul>
          <li>
            <strong>Cross-platform</strong>: no suffix (e.g.,{' '}
            <code>fetchProducts</code>, <code>requestPurchase</code>).
          </li>
          <li>
            <strong>iOS-only</strong>: ends with <code>IOS</code> (e.g.,{' '}
            <code>syncIOS</code>).
          </li>
          <li>
            <strong>Android-only</strong>: ends with <code>Android</code> (e.g.,{' '}
            <code>acknowledgePurchaseAndroid</code>).
          </li>
        </ul>
        <p className="type-link">
          See: <Link to="/docs/types">Type Definitions</Link>.
        </p>
      </section>

      <section>
        <AnchorLink id="terminology" level="h2">
          Terminology
        </AnchorLink>
        <AnchorLink id="request-apis" level="h3">
          Request APIs
        </AnchorLink>
        <div className="alert-card alert-card--warning">
          <p>
            <strong>Important:</strong> APIs starting with <code>request</code>{' '}
            are event-based operations, not promise-based.
          </p>
          <p>
            While these APIs return values for various purposes, you should{' '}
            <strong>
              not rely on their return values for actual purchase results
            </strong>
            . Instead, listen for events through{' '}
            <Link to="/docs/events/purchase-updated-listener">
              <code>purchaseUpdatedListener</code>
            </Link>{' '}
            or{' '}
            <Link to="/docs/events/purchase-error-listener">
              <code>purchaseErrorListener</code>
            </Link>
            .
          </p>
          <p>
            This is because Apple's purchase system is fundamentally
            event-based, not promise-based. For more details, see this{' '}
            <a
              href="https://github.com/hyochan/react-native-iap/issues/307#issuecomment-449208083"
              target="_blank"
              rel="noopener noreferrer"
            >
              issue comment
            </a>
            .
          </p>
          <p>
            The <code>request</code> prefix indicates that these are event
            requests - use the appropriate listeners to handle the actual
            results.
          </p>
        </div>
        <p className="type-link">
          See: <Link to="/docs/events">Events</Link> for setting up purchase
          listeners.
        </p>

        <AnchorLink id="transaction-vs-purchase" level="h3">
          Transaction vs Purchase
        </AnchorLink>
        <p>
          These terms refer to the same concept - a completed or pending payment
          record from the store. The terminology differs by platform:
        </p>
        <ul>
          <li>
            <strong>iOS (StoreKit)</strong>: Uses <code>Transaction</code>
          </li>
          <li>
            <strong>Android (Google Play Billing)</strong>: Uses{' '}
            <Link to="/docs/types/purchase">
              <code>Purchase</code>
            </Link>
          </li>
        </ul>
        <p>
          OpenIAP normalizes this to{' '}
          <Link to="/docs/types/purchase">
            <code>Purchase</code>
          </Link>{' '}
          in cross-platform APIs for consistency, while platform-specific APIs
          may use the native terminology.
        </p>

        <AnchorLink id="receipt-vs-verify-purchase" level="h3">
          Receipt vs Verify Purchase
        </AnchorLink>
        <p>
          <code>Receipt</code> is a legacy term from Apple's original StoreKit
          API, where purchase validation involved fetching and verifying a
          "receipt" blob. Modern StoreKit 2 and Google Play Billing have moved
          away from this pattern.
        </p>
        <p>
          OpenIAP uses <code>verifyPurchase</code> instead of "receipt
          validation" to reflect the modern approach: validating individual
          purchase transactions rather than parsing monolithic receipt data.
        </p>
      </section>
    </div>
  );
}

export default APIsIndex;
