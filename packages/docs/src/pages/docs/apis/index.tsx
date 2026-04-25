import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function APIsIndex() {
  useScrollToHash();

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
                  <code>getStorefrontIOS</code>
                </Link>
              </td>
              <td>Get the iOS storefront country code.</td>
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
              <td>Check eligibility for the external purchase notice sheet.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/present-external-purchase-notice-sheet-ios">
                  <code>presentExternalPurchaseNoticeSheetIOS</code>
                </Link>
              </td>
              <td>Present the external purchase notice sheet.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/present-external-purchase-link-ios">
                  <code>presentExternalPurchaseLinkIOS</code>
                </Link>
              </td>
              <td>Present an external purchase link (StoreKit External).</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/ios/validate-receipt-ios">
                  <code>validateReceiptIOS</code>
                </Link>
              </td>
              <td>Validate a receipt against the App Store (legacy path).</td>
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
            <code>purchaseUpdatedListener</code> or{' '}
            <code>purchaseErrorListener</code>.
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
