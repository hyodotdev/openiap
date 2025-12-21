import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import APICard from '../../../components/APICard';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';

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

  return (
    <div className="doc-page">
      <SEO
        title="APIs"
        description="OpenIAP API reference - comprehensive documentation for all in-app purchase APIs across iOS and Android platforms."
        path="/docs/apis"
        keywords="IAP API, initConnection, fetchProducts, requestPurchase, finishTransaction, verifyPurchase"
      />
      <h1>APIs</h1>
      <p>
        Complete API reference for OpenIAP. APIs are organized by functionality
        to help you find what you need quickly.
      </p>

      <TLDRBox title="API Categories">
        <ul>
          <li>
            <strong>Connection</strong>: Initialize and manage store connection
          </li>
          <li>
            <strong>Products</strong>: Fetch product information
          </li>
          <li>
            <strong>Purchase</strong>: Request and complete purchases
          </li>
          <li>
            <strong>Subscription</strong>: Manage subscriptions
          </li>
          <li>
            <strong>Validation</strong>: Verify purchases server-side
          </li>
          <li>
            <strong>Platform-Specific</strong>: iOS and Android only APIs
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
    </div>
  );
}

export default APIsIndex;
