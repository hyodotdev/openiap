import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import APICard from '../../../components/APICard';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

// Redirect map for legacy anchor links
const legacyAnchorRedirects: Record<string, string> = {
  // Connection
  'init-connection': '/docs/apis/connection#init-connection',
  'end-connection': '/docs/apis/connection#end-connection',
  // Products
  'fetch-products': '/docs/apis/products#fetch-products',
  'get-available-purchases': '/docs/apis/products#get-available-purchases',
  // Purchase
  'request-purchase': '/docs/apis/purchase#request-purchase',
  'finish-transaction': '/docs/apis/purchase#finish-transaction',
  'restore-purchases': '/docs/apis/purchase#restore-purchases',
  'get-storefront': '/docs/apis/purchase#get-storefront',
  // Subscription
  'get-active-subscriptions': '/docs/apis/subscription#get-active-subscriptions',
  'has-active-subscriptions': '/docs/apis/subscription#has-active-subscriptions',
  'deep-link-to-subscriptions':
    '/docs/apis/subscription#deep-link-to-subscriptions',
  // Validation
  'verify-purchase': '/docs/apis/validation#verify-purchase',
  'verify-purchase-with-provider':
    '/docs/apis/validation#verify-purchase-with-provider',
  'purchase-identifier-usage': '/docs/apis/validation#purchase-identifiers',
  // iOS APIs
  'clear-transaction-ios': '/docs/apis/ios#clear-transaction-ios',
  'get-storefront-ios': '/docs/apis/ios#get-storefront-ios',
  'get-promoted-product-ios': '/docs/apis/ios#get-promoted-product-ios',
  'request-purchase-on-promoted-product-ios':
    '/docs/apis/ios#request-purchase-on-promoted-product-ios',
  'get-pending-transactions-ios': '/docs/apis/ios#get-pending-transactions-ios',
  'is-eligible-for-intro-offer-ios':
    '/docs/apis/ios#is-eligible-for-intro-offer-ios',
  'subscription-status-ios': '/docs/apis/ios#subscription-status-ios',
  'current-entitlement-ios': '/docs/apis/ios#current-entitlement-ios',
  'latest-transaction-ios': '/docs/apis/ios#latest-transaction-ios',
  'show-manage-subscriptions-ios': '/docs/apis/ios#show-manage-subscriptions-ios',
  'begin-refund-request-ios': '/docs/apis/ios#begin-refund-request-ios',
  'is-transaction-verified-ios': '/docs/apis/ios#is-transaction-verified-ios',
  'get-transaction-jws-ios': '/docs/apis/ios#get-transaction-jws-ios',
  'get-receipt-data-ios': '/docs/apis/ios#get-receipt-data-ios',
  'sync-ios': '/docs/apis/ios#sync-ios',
  'present-code-redemption-sheet-ios':
    '/docs/apis/ios#present-code-redemption-sheet-ios',
  'get-app-transaction-ios': '/docs/apis/ios#get-app-transaction-ios',
  'can-present-external-purchase-notice-ios':
    '/docs/apis/ios#can-present-external-purchase-notice-ios',
  'present-external-purchase-notice-sheet-ios':
    '/docs/apis/ios#present-external-purchase-notice-sheet-ios',
  'present-external-purchase-link-ios':
    '/docs/apis/ios#present-external-purchase-link-ios',
  'validate-receipt-ios': '/docs/apis/ios#validate-receipt-ios',
  // Android APIs
  'acknowledge-purchase-android':
    '/docs/apis/android#acknowledge-purchase-android',
  'consume-purchase-android': '/docs/apis/android#consume-purchase-android',
  'check-alternative-billing-availability-android':
    '/docs/apis/android#check-alternative-billing-availability-android',
  'show-alternative-billing-dialog-android':
    '/docs/apis/android#show-alternative-billing-dialog-android',
  'create-alternative-billing-token-android':
    '/docs/apis/android#create-alternative-billing-token-android',
  // Legacy section anchors
  terminology: '/docs/apis#terminology',
  'request-apis': '/docs/apis#request-apis',
  'connection-management': '/docs/apis/connection',
  'product-management': '/docs/apis/products',
  'purchase-operations': '/docs/apis/purchase',
  'subscription-management': '/docs/apis/subscription',
  validation: '/docs/apis/validation',
  'platform-specific-apis': '/docs/apis/ios',
  'ios-apis': '/docs/apis/ios',
  'android-apis': '/docs/apis/android',
};

function APIsIndex() {
  const location = useLocation();
  const navigate = useNavigate();

  // Redirect legacy anchor links to new paths
  useEffect(() => {
    const hash = location.hash.slice(1); // Remove '#'
    if (hash && legacyAnchorRedirects[hash]) {
      navigate(legacyAnchorRedirects[hash], { replace: true });
    }
  }, [location.hash, navigate]);

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
        Complete API reference for OpenIAP. APIs are organized by functionality
        to help you find what you need quickly.
      </p>

      <TLDRBox title="API Categories">
        <ul>
          <li>
            <Link to="/docs/apis/connection"><strong>Connection</strong></Link>: Initialize and manage store connection
          </li>
          <li>
            <Link to="/docs/apis/products"><strong>Products</strong></Link>: Fetch product information
          </li>
          <li>
            <Link to="/docs/apis/purchase"><strong>Purchase</strong></Link>: Request and complete purchases
          </li>
          <li>
            <Link to="/docs/apis/subscription"><strong>Subscription</strong></Link>: Manage subscriptions
          </li>
          <li>
            <Link to="/docs/apis/validation"><strong>Validation</strong></Link>: Verify purchases server-side
          </li>
          <li>
            <Link to="/docs/apis/ios"><strong>iOS APIs</strong></Link> | <Link to="/docs/apis/android"><strong>Android APIs</strong></Link>
          </li>
          <li>
            <Link to="/docs/apis/debugging"><strong>Debugging</strong></Link>: Error handling and troubleshooting
          </li>
        </ul>
      </TLDRBox>

      <section>
        <h2>Core APIs</h2>
        <p>Essential APIs used in every IAP implementation.</p>
        <div className="api-cards-grid">
          <APICard
            title="Connection"
            description="Initialize and manage the connection to the app store. Required before any other operations."
            href="/docs/apis/connection"
            count={2}
          />
          <APICard
            title="Products"
            description="Fetch product information and available purchases from the store."
            href="/docs/apis/products"
            count={2}
          />
          <APICard
            title="Purchase"
            description="Request purchases, complete transactions, and restore previous purchases."
            href="/docs/apis/purchase"
            count={4}
          />
          <APICard
            title="Subscription"
            description="Manage auto-renewable subscriptions and check subscription status."
            href="/docs/apis/subscription"
            count={3}
          />
        </div>
      </section>

      <section>
        <h2>Advanced APIs</h2>
        <p>Additional APIs for validation and debugging.</p>
        <div className="api-cards-grid">
          <APICard
            title="Validation"
            description="Verify purchases server-side with IAPKit or your own backend."
            href="/docs/apis/validation"
            count={2}
          />
          <APICard
            title="Debugging"
            description="Enable logging and handle common warning messages."
            href="/docs/apis/debugging"
            count={1}
          />
        </div>
      </section>

      <section>
        <h2>Platform-Specific APIs</h2>
        <p>
          APIs available only on specific platforms. Use these for
          platform-specific features.
        </p>
        <div className="api-cards-grid">
          <APICard
            title="iOS APIs"
            description="StoreKit 2 APIs for promoted products, refunds, external purchases, and more."
            href="/docs/apis/ios"
            count={18}
          />
          <APICard
            title="Android APIs"
            description="Google Play Billing APIs for acknowledgment, consumption, and alternative billing."
            href="/docs/apis/android"
            count={5}
          />
        </div>
      </section>

      <section>
        <h2>API Naming Convention</h2>
        <p>OpenIAP follows a consistent naming pattern:</p>
        <ul>
          <li>
            <strong>Cross-platform APIs</strong>: No suffix (e.g.,{' '}
            <code>fetchProducts</code>, <code>requestPurchase</code>)
          </li>
          <li>
            <strong>iOS-only APIs</strong>: End with <code>IOS</code> (e.g.,{' '}
            <code>syncIOS</code>, <code>getStorefrontIOS</code>)
          </li>
          <li>
            <strong>Android-only APIs</strong>: End with <code>Android</code>{' '}
            (e.g., <code>acknowledgePurchaseAndroid</code>)
          </li>
        </ul>
        <p className="type-link">
          See: <Link to="/docs/types">Type Definitions</Link> for complete type
          information.
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
            <code>Purchase</code>
          </li>
        </ul>
        <p>
          OpenIAP normalizes this to <code>Purchase</code> in cross-platform
          APIs for consistency, while platform-specific APIs may use the native
          terminology.
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
