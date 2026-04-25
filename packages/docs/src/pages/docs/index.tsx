import { useState, useEffect } from 'react';
import { Route, Routes, Navigate, NavLink } from 'react-router-dom';
import { MenuDropdown } from '../../components/MenuDropdown';
import GettingStarted from './getting-started';
import Ecosystem from './ecosystem';
import LifeCycle from './lifecycle';
import Subscription from './lifecycle/subscription';
import TypesIndex from './types/index';
import TypesProduct from './types/product';
import TypesSubscriptionProduct from './types/subscription-product';
import TypesStorefront from './types/storefront';
import TypesPurchase from './types/purchase';
import TypesActiveSubscription from './types/active-subscription';
import TypesProductRequest from './types/product-request';
import TypesRequestPurchaseProps from './types/request-purchase-props';
import TypesAlternativeBillingTypes from './types/alternative-billing-types';
import TypesBillingPrograms from './types/billing-programs';
import TypesExternalPurchaseLink from './types/external-purchase-link';
import TypesVerifyPurchase from './types/verify-purchase';
import TypesVerifyPurchaseWithProviderProps from './types/verify-purchase-with-provider-props';
import TypesVerifyPurchaseWithProviderResult from './types/verify-purchase-with-provider-result';
import TypesDiscountOfferIOS from './types/ios/discount-offer-ios';
import TypesDiscountIOS from './types/ios/discount-ios';
import TypesSubscriptionPeriodIOS from './types/ios/subscription-period-ios';
import TypesPaymentModeIOS from './types/ios/payment-mode-ios';
import TypesSubscriptionStatusIOS from './types/ios/subscription-status-ios';
import TypesAppTransactionIOS from './types/ios/app-transaction-ios';
import TypesRenewalInfoIOS from './types/ios/renewal-info-ios';
import TypesOneTimePurchaseOfferDetailAndroid from './types/android/one-time-purchase-offer-detail-android';
import TypesSubscriptionOfferAndroid from './types/android/subscription-offer-android';
import TypesPricingPhaseAndroid from './types/android/pricing-phase-android';
import TypesDiscountOffer from './types/discount-offer';
import TypesSubscriptionOffer from './types/subscription-offer';
import APIsIndex from './apis/index';
import APIsInitConnection from './apis/init-connection';
import APIsEndConnection from './apis/end-connection';
import APIsFetchProducts from './apis/fetch-products';
import APIsGetAvailablePurchases from './apis/get-available-purchases';
import APIsRequestPurchase from './apis/request-purchase';
import APIsFinishTransaction from './apis/finish-transaction';
import APIsRestorePurchases from './apis/restore-purchases';
import APIsGetStorefront from './apis/get-storefront';
import APIsGetActiveSubscriptions from './apis/get-active-subscriptions';
import APIsHasActiveSubscriptions from './apis/has-active-subscriptions';
import APIsDeepLinkToSubscriptions from './apis/deep-link-to-subscriptions';
import APIsClearTransactionIOS from './apis/ios/clear-transaction-ios';
import APIsGetPendingTransactionsIOS from './apis/ios/get-pending-transactions-ios';
import APIsGetAllTransactionsIOS from './apis/ios/get-all-transactions-ios';
import APIsSyncIOS from './apis/ios/sync-ios';
import APIsGetStorefrontIOS from './apis/ios/get-storefront-ios';
import APIsGetPromotedProductIOS from './apis/ios/get-promoted-product-ios';
import APIsIsEligibleForIntroOfferIOS from './apis/ios/is-eligible-for-intro-offer-ios';
import APIsSubscriptionStatusIOS from './apis/ios/subscription-status-ios';
import APIsCurrentEntitlementIOS from './apis/ios/current-entitlement-ios';
import APIsLatestTransactionIOS from './apis/ios/latest-transaction-ios';
import APIsShowManageSubscriptionsIOS from './apis/ios/show-manage-subscriptions-ios';
import APIsIsTransactionVerifiedIOS from './apis/ios/is-transaction-verified-ios';
import APIsGetTransactionJwsIOS from './apis/ios/get-transaction-jws-ios';
import APIsGetReceiptDataIOS from './apis/ios/get-receipt-data-ios';
import APIsBeginRefundRequestIOS from './apis/ios/begin-refund-request-ios';
import APIsPresentCodeRedemptionSheetIOS from './apis/ios/present-code-redemption-sheet-ios';
import APIsGetAppTransactionIOS from './apis/ios/get-app-transaction-ios';
import APIsCanPresentExternalPurchaseNoticeIOS from './apis/ios/can-present-external-purchase-notice-ios';
import APIsPresentExternalPurchaseNoticeSheetIOS from './apis/ios/present-external-purchase-notice-sheet-ios';
import APIsPresentExternalPurchaseLinkIOS from './apis/ios/present-external-purchase-link-ios';
import APIsRequestPurchaseOnPromotedProductIOS from './apis/ios/request-purchase-on-promoted-product-ios';
import APIsValidateReceiptIOS from './apis/ios/validate-receipt-ios';
import APIsAcknowledgePurchaseAndroid from './apis/android/acknowledge-purchase-android';
import APIsConsumePurchaseAndroid from './apis/android/consume-purchase-android';
import APIsCheckAlternativeBillingAvailabilityAndroid from './apis/android/check-alternative-billing-availability-android';
import APIsShowAlternativeBillingDialogAndroid from './apis/android/show-alternative-billing-dialog-android';
import APIsCreateAlternativeBillingTokenAndroid from './apis/android/create-alternative-billing-token-android';
import APIsEnableBillingProgramAndroid from './apis/android/enable-billing-program-android';
import APIsIsBillingProgramAvailableAndroid from './apis/android/is-billing-program-available-android';
import APIsLaunchExternalLinkAndroid from './apis/android/launch-external-link-android';
import APIsCreateBillingProgramReportingDetailsAndroid from './apis/android/create-billing-program-reporting-details-android';
import Events from './events';
import Errors from './errors';
import Purchase from './features/purchase';
import SubscriptionFeature from './features/subscription/index';
import SubscriptionUpgradeDowngrade from './features/subscription/upgrade-downgrade';
import Discount from './features/discount';
import OfferCodeRedemption from './features/offer-code-redemption';
import ExternalPurchase from './features/external-purchase';
import SubscriptionBillingIssue from './features/subscription-billing-issue';
import Refund from './features/refund';
import Validation from './features/validation';
import Debugging from './features/debugging';
import AlternativeMarketplace from './features/alternative-marketplace/index';
import AlternativeMarketplaceOnside from './features/alternative-marketplace/onside';
import IOSSetup from './ios-setup';
import AndroidSetup from './android-setup';
import HorizonSetup from './horizon-setup';
import SetupIndex from './setup/index';
import ReactNativeSetup from './setup/react-native';
import ExpoSetup from './setup/expo';
import FlutterSetup from './setup/flutter';
import GodotSetup from './setup/godot';
import KmpSetup from './setup/kmp';
import Example from './example';
import Announcements from './updates/announcements';
import Releases from './updates/releases';
import Versions from './updates/versions';
import AIAssistants from './guides/ai-assistants';
import Testing from './guides/testing';
import FoundationGovernance from './foundation/governance';
import FoundationOnePager from './foundation/one-pager';
import FoundationSponsorship from './foundation/sponsorship';
import FoundationRoadmapBudget from './foundation/roadmap-budget';
import FoundationFoundingSupporters from './foundation/founding-supporters';
import NotFound from '../404';

function Docs() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const closeSidebar = () => setIsSidebarOpen(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="docs-container">
      <button
        className={`docs-sidebar-toggle ${isSidebarOpen ? 'hidden' : ''} ${isScrolled ? 'scrolled' : ''}`}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        aria-label="Toggle sidebar"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 5h14M3 10h14M3 15h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span>Menu</span>
      </button>

      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar}></div>
      )}

      <aside className={`docs-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <nav className="docs-nav">
          <h3>Documentation</h3>
          <ul>
            <li>
              <NavLink
                to="/docs/getting-started"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Getting Started
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/ecosystem"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Ecosystem
              </NavLink>
            </li>
            <MenuDropdown
              title="Life Cycle"
              titleTo="/docs/lifecycle"
              items={[
                { to: '/docs/lifecycle/subscription', label: 'Subscription' },
              ]}
              onItemClick={closeSidebar}
            />
            <MenuDropdown
              title="Types"
              titleTo="/docs/types"
              items={[
                { to: '/docs/types/product', label: 'Product' },
                {
                  to: '/docs/types/subscription-product',
                  label: 'ProductSubscription',
                },
                { to: '/docs/types/storefront', label: 'Storefront' },
                { to: '/docs/types/purchase', label: 'Purchase' },
                {
                  to: '/docs/types/active-subscription',
                  label: 'ActiveSubscription',
                },
                {
                  to: '/docs/types/product-request',
                  label: 'ProductRequest',
                },
                {
                  to: '/docs/types/request-purchase-props',
                  label: 'RequestPurchaseProps',
                },
                {
                  to: '/docs/types/discount-offer',
                  label: 'DiscountOffer',
                },
                {
                  to: '/docs/types/subscription-offer',
                  label: 'SubscriptionOffer',
                },
                {
                  to: '/docs/types/verify-purchase',
                  label: 'VerifyPurchase',
                },
                {
                  to: '/docs/types/verify-purchase-with-provider-props',
                  label: 'VerifyPurchaseWithProviderProps',
                },
                {
                  to: '/docs/types/verify-purchase-with-provider-result',
                  label: 'VerifyPurchaseWithProviderResult',
                },
                {
                  to: '/docs/types/alternative-billing-types',
                  label: 'AlternativeBilling',
                },
                {
                  to: '/docs/types/billing-programs',
                  label: 'BillingPrograms',
                },
                {
                  to: '/docs/types/external-purchase-link',
                  label: 'ExternalPurchaseLink',
                },
                {
                  label: 'iOS Specific',
                  items: [
                    {
                      to: '/docs/types/ios/discount-offer-ios',
                      label: 'DiscountOfferIOS',
                    },
                    {
                      to: '/docs/types/ios/discount-ios',
                      label: 'DiscountIOS',
                    },
                    {
                      to: '/docs/types/ios/subscription-period-ios',
                      label: 'SubscriptionPeriodIOS',
                    },
                    {
                      to: '/docs/types/ios/payment-mode-ios',
                      label: 'PaymentModeIOS',
                    },
                    {
                      to: '/docs/types/ios/subscription-status-ios',
                      label: 'SubscriptionStatusIOS',
                    },
                    {
                      to: '/docs/types/ios/app-transaction-ios',
                      label: 'AppTransactionIOS',
                    },
                    {
                      to: '/docs/types/ios/renewal-info-ios',
                      label: 'RenewalInfoIOS',
                    },
                  ],
                },
                {
                  label: 'Android Specific',
                  items: [
                    {
                      to: '/docs/types/android/one-time-purchase-offer-detail-android',
                      label: 'ProductAndroidOneTimePurchaseOfferDetail',
                    },
                    {
                      to: '/docs/types/android/subscription-offer-android',
                      label: 'ProductSubscriptionAndroidOfferDetails',
                    },
                    {
                      to: '/docs/types/android/pricing-phase-android',
                      label: 'PricingPhaseAndroid',
                    },
                  ],
                },
              ]}
              onItemClick={closeSidebar}
            />
            <MenuDropdown
              title="APIs"
              titleTo="/docs/apis"
              items={[
                {
                  to: '/docs/apis/init-connection',
                  label: 'initConnection',
                },
                {
                  to: '/docs/apis/end-connection',
                  label: 'endConnection',
                },
                {
                  to: '/docs/apis/fetch-products',
                  label: 'fetchProducts',
                },
                {
                  to: '/docs/apis/get-available-purchases',
                  label: 'getAvailablePurchases',
                },
                {
                  to: '/docs/apis/request-purchase',
                  label: 'requestPurchase',
                },
                {
                  to: '/docs/apis/finish-transaction',
                  label: 'finishTransaction',
                },
                {
                  to: '/docs/apis/restore-purchases',
                  label: 'restorePurchases',
                },
                {
                  to: '/docs/apis/get-storefront',
                  label: 'getStorefront',
                },
                {
                  to: '/docs/apis/get-active-subscriptions',
                  label: 'getActiveSubscriptions',
                },
                {
                  to: '/docs/apis/has-active-subscriptions',
                  label: 'hasActiveSubscriptions',
                },
                {
                  to: '/docs/apis/deep-link-to-subscriptions',
                  label: 'deepLinkToSubscriptions',
                },
                {
                  label: 'iOS Specific',
                  items: [
                    { to: '/docs/apis/ios/sync-ios', label: 'syncIOS' },
                    {
                      to: '/docs/apis/ios/get-storefront-ios',
                      label: 'getStorefrontIOS',
                    },
                    {
                      to: '/docs/apis/ios/clear-transaction-ios',
                      label: 'clearTransactionIOS',
                    },
                    {
                      to: '/docs/apis/ios/get-pending-transactions-ios',
                      label: 'getPendingTransactionsIOS',
                    },
                    {
                      to: '/docs/apis/ios/get-all-transactions-ios',
                      label: 'getAllTransactionsIOS',
                    },
                    {
                      to: '/docs/apis/ios/get-promoted-product-ios',
                      label: 'getPromotedProductIOS',
                    },
                    {
                      to: '/docs/apis/ios/is-eligible-for-intro-offer-ios',
                      label: 'isEligibleForIntroOfferIOS',
                    },
                    {
                      to: '/docs/apis/ios/subscription-status-ios',
                      label: 'subscriptionStatusIOS',
                    },
                    {
                      to: '/docs/apis/ios/current-entitlement-ios',
                      label: 'currentEntitlementIOS',
                    },
                    {
                      to: '/docs/apis/ios/latest-transaction-ios',
                      label: 'latestTransactionIOS',
                    },
                    {
                      to: '/docs/apis/ios/show-manage-subscriptions-ios',
                      label: 'showManageSubscriptionsIOS',
                    },
                    {
                      to: '/docs/apis/ios/is-transaction-verified-ios',
                      label: 'isTransactionVerifiedIOS',
                    },
                    {
                      to: '/docs/apis/ios/get-transaction-jws-ios',
                      label: 'getTransactionJwsIOS',
                    },
                    {
                      to: '/docs/apis/ios/get-receipt-data-ios',
                      label: 'getReceiptDataIOS',
                    },
                    {
                      to: '/docs/apis/ios/begin-refund-request-ios',
                      label: 'beginRefundRequestIOS',
                    },
                    {
                      to: '/docs/apis/ios/present-code-redemption-sheet-ios',
                      label: 'presentCodeRedemptionSheetIOS',
                    },
                    {
                      to: '/docs/apis/ios/get-app-transaction-ios',
                      label: 'getAppTransactionIOS',
                    },
                    {
                      to: '/docs/apis/ios/can-present-external-purchase-notice-ios',
                      label: 'canPresentExternalPurchaseNoticeIOS',
                    },
                    {
                      to: '/docs/apis/ios/present-external-purchase-notice-sheet-ios',
                      label: 'presentExternalPurchaseNoticeSheetIOS',
                    },
                    {
                      to: '/docs/apis/ios/present-external-purchase-link-ios',
                      label: 'presentExternalPurchaseLinkIOS',
                    },
                    {
                      to: '/docs/apis/ios/request-purchase-on-promoted-product-ios',
                      label: 'requestPurchaseOnPromotedProductIOS',
                    },
                    {
                      to: '/docs/apis/ios/validate-receipt-ios',
                      label: 'validateReceiptIOS',
                    },
                  ],
                },
                {
                  label: 'Android Specific',
                  items: [
                    {
                      to: '/docs/apis/android/acknowledge-purchase-android',
                      label: 'acknowledgePurchaseAndroid',
                    },
                    {
                      to: '/docs/apis/android/consume-purchase-android',
                      label: 'consumePurchaseAndroid',
                    },
                    {
                      to: '/docs/apis/android/check-alternative-billing-availability-android',
                      label: 'checkAlternativeBillingAvailabilityAndroid',
                    },
                    {
                      to: '/docs/apis/android/show-alternative-billing-dialog-android',
                      label: 'showAlternativeBillingDialogAndroid',
                    },
                    {
                      to: '/docs/apis/android/create-alternative-billing-token-android',
                      label: 'createAlternativeBillingTokenAndroid',
                    },
                    {
                      to: '/docs/apis/android/enable-billing-program-android',
                      label: 'enableBillingProgramAndroid',
                    },
                    {
                      to: '/docs/apis/android/is-billing-program-available-android',
                      label: 'isBillingProgramAvailableAndroid',
                    },
                    {
                      to: '/docs/apis/android/launch-external-link-android',
                      label: 'launchExternalLinkAndroid',
                    },
                    {
                      to: '/docs/apis/android/create-billing-program-reporting-details-android',
                      label: 'createBillingProgramReportingDetailsAndroid',
                    },
                  ],
                },
              ]}
              onItemClick={closeSidebar}
            />
            <li>
              <NavLink
                to="/docs/events"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Events
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/errors"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Errors
              </NavLink>
            </li>
          </ul>
          <h3 style={{ marginTop: '2rem' }}>Setup Guide</h3>
          <ul>
            <li>
              <NavLink
                to="/docs/ios-setup"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                iOS Setup
              </NavLink>
            </li>
            <MenuDropdown
              title="Android Setup"
              titleTo="/docs/android-setup"
              items={[{ to: '/docs/horizon-setup', label: 'Horizon OS' }]}
              onItemClick={closeSidebar}
            />
            <MenuDropdown
              title="Framework Setup"
              titleTo="/docs/setup"
              items={[
                { to: '/docs/setup/react-native', label: 'React Native' },
                { to: '/docs/setup/expo', label: 'Expo' },
                { to: '/docs/setup/flutter', label: 'Flutter' },
                { to: '/docs/setup/godot', label: 'Godot' },
                { to: '/docs/setup/kmp', label: 'Kotlin Multiplatform' },
              ]}
              onItemClick={closeSidebar}
            />
            <li>
              <NavLink
                to="/docs/guides/ai-assistants"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                AI Assistants
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/guides/testing"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Testing & Sandbox
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/example"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Example
              </NavLink>
            </li>
          </ul>
          <h3 style={{ marginTop: '2rem' }}>Features</h3>
          <ul>
            <li>
              <NavLink
                to="/docs/features/purchase"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Purchase
              </NavLink>
            </li>
            <MenuDropdown
              title="Subscription"
              titleTo="/docs/features/subscription"
              items={[
                {
                  to: '/docs/features/subscription/upgrade-downgrade',
                  label: 'Upgrade/Downgrade',
                },
              ]}
              onItemClick={closeSidebar}
            />
            <li>
              <NavLink
                to="/docs/features/validation"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Validation
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/features/refund"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Refund
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/features/offer-code-redemption"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Offer Code Redemption
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/features/external-purchase"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                External Purchase
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/features/subscription-billing-issue"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Subscription Billing Issue
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/features/debugging"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Debugging
              </NavLink>
            </li>
            <MenuDropdown
              title="Alternative Marketplace"
              titleTo="/docs/features/alternative-marketplace"
              items={[
                {
                  to: '/docs/features/alternative-marketplace/onside',
                  label: 'Onside',
                },
              ]}
              onItemClick={closeSidebar}
            />
            <li>
              <NavLink
                to="/docs/features/discount"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Discounts (Android)
              </NavLink>
            </li>
          </ul>
          <h3 style={{ marginTop: '2rem' }}>Foundation</h3>
          <ul>
            <MenuDropdown
              title="About"
              titleTo="/docs/foundation/about"
              items={[
                { to: '/docs/foundation/governance', label: 'Governance' },
                { to: '/docs/foundation/sponsorship', label: 'Sponsorship' },
                {
                  to: '/docs/foundation/roadmap-budget',
                  label: 'Roadmap & Budget',
                },
                {
                  to: '/docs/foundation/founding-supporters',
                  label: 'Founding Supporters',
                },
              ]}
              onItemClick={closeSidebar}
            />
          </ul>
          <h3 style={{ marginTop: '2rem' }}>Updates</h3>
          <ul>
            <li>
              <NavLink
                to="/docs/updates/announcements"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Announcements
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/updates/releases"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Releases
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/updates/versions"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Versions
              </NavLink>
            </li>
          </ul>
        </nav>
      </aside>
      <main className="docs-content">
        <Routes>
          <Route
            index
            element={<Navigate to="/docs/getting-started" replace />}
          />
          <Route path="getting-started" element={<GettingStarted />} />
          <Route path="ecosystem" element={<Ecosystem />} />
          <Route path="lifecycle" element={<LifeCycle />} />
          <Route path="lifecycle/subscription" element={<Subscription />} />
          <Route path="types" element={<TypesIndex />} />
          <Route path="types/product" element={<TypesProduct />} />
          <Route
            path="types/subscription-product"
            element={<TypesSubscriptionProduct />}
          />
          <Route path="types/storefront" element={<TypesStorefront />} />
          <Route path="types/purchase" element={<TypesPurchase />} />
          <Route
            path="types/active-subscription"
            element={<TypesActiveSubscription />}
          />
          <Route
            path="types/product-request"
            element={<TypesProductRequest />}
          />
          <Route
            path="types/request-purchase-props"
            element={<TypesRequestPurchaseProps />}
          />
          <Route
            path="types/alternative-billing-types"
            element={<TypesAlternativeBillingTypes />}
          />
          <Route
            path="types/billing-programs"
            element={<TypesBillingPrograms />}
          />
          <Route
            path="types/external-purchase-link"
            element={<TypesExternalPurchaseLink />}
          />
          <Route
            path="types/verify-purchase"
            element={<TypesVerifyPurchase />}
          />
          <Route
            path="types/verify-purchase-with-provider-props"
            element={<TypesVerifyPurchaseWithProviderProps />}
          />
          <Route
            path="types/verify-purchase-with-provider-result"
            element={<TypesVerifyPurchaseWithProviderResult />}
          />
          <Route
            path="types/ios/discount-offer-ios"
            element={<TypesDiscountOfferIOS />}
          />
          <Route path="types/ios/discount-ios" element={<TypesDiscountIOS />} />
          <Route
            path="types/ios/subscription-period-ios"
            element={<TypesSubscriptionPeriodIOS />}
          />
          <Route
            path="types/ios/payment-mode-ios"
            element={<TypesPaymentModeIOS />}
          />
          <Route
            path="types/ios/subscription-status-ios"
            element={<TypesSubscriptionStatusIOS />}
          />
          <Route
            path="types/ios/app-transaction-ios"
            element={<TypesAppTransactionIOS />}
          />
          <Route
            path="types/ios/renewal-info-ios"
            element={<TypesRenewalInfoIOS />}
          />
          <Route
            path="types/android/one-time-purchase-offer-detail-android"
            element={<TypesOneTimePurchaseOfferDetailAndroid />}
          />
          <Route
            path="types/android/subscription-offer-android"
            element={<TypesSubscriptionOfferAndroid />}
          />
          <Route
            path="types/android/pricing-phase-android"
            element={<TypesPricingPhaseAndroid />}
          />
          <Route path="types/discount-offer" element={<TypesDiscountOffer />} />
          <Route
            path="types/subscription-offer"
            element={<TypesSubscriptionOffer />}
          />
          <Route
            path="types/request"
            element={<Navigate to="/docs/types" replace />}
          />
          <Route
            path="types/alternative"
            element={<Navigate to="/docs/types" replace />}
          />
          <Route
            path="types/verification"
            element={<Navigate to="/docs/types" replace />}
          />
          <Route
            path="types/ios"
            element={<Navigate to="/docs/types" replace />}
          />
          <Route
            path="types/android"
            element={<Navigate to="/docs/types" replace />}
          />
          <Route
            path="types/offer"
            element={<Navigate to="/docs/types" replace />}
          />
          <Route path="apis" element={<APIsIndex />} />
          <Route path="apis/init-connection" element={<APIsInitConnection />} />
          <Route path="apis/end-connection" element={<APIsEndConnection />} />
          <Route path="apis/fetch-products" element={<APIsFetchProducts />} />
          <Route
            path="apis/get-available-purchases"
            element={<APIsGetAvailablePurchases />}
          />
          <Route
            path="apis/request-purchase"
            element={<APIsRequestPurchase />}
          />
          <Route
            path="apis/finish-transaction"
            element={<APIsFinishTransaction />}
          />
          <Route
            path="apis/restore-purchases"
            element={<APIsRestorePurchases />}
          />
          <Route path="apis/get-storefront" element={<APIsGetStorefront />} />
          <Route
            path="apis/get-active-subscriptions"
            element={<APIsGetActiveSubscriptions />}
          />
          <Route
            path="apis/has-active-subscriptions"
            element={<APIsHasActiveSubscriptions />}
          />
          <Route
            path="apis/deep-link-to-subscriptions"
            element={<APIsDeepLinkToSubscriptions />}
          />
          <Route
            path="apis/ios/clear-transaction-ios"
            element={<APIsClearTransactionIOS />}
          />
          <Route
            path="apis/ios/get-pending-transactions-ios"
            element={<APIsGetPendingTransactionsIOS />}
          />
          <Route
            path="apis/ios/get-all-transactions-ios"
            element={<APIsGetAllTransactionsIOS />}
          />
          <Route path="apis/ios/sync-ios" element={<APIsSyncIOS />} />
          <Route
            path="apis/ios/get-storefront-ios"
            element={<APIsGetStorefrontIOS />}
          />
          <Route
            path="apis/ios/get-promoted-product-ios"
            element={<APIsGetPromotedProductIOS />}
          />
          <Route
            path="apis/ios/is-eligible-for-intro-offer-ios"
            element={<APIsIsEligibleForIntroOfferIOS />}
          />
          <Route
            path="apis/ios/subscription-status-ios"
            element={<APIsSubscriptionStatusIOS />}
          />
          <Route
            path="apis/ios/current-entitlement-ios"
            element={<APIsCurrentEntitlementIOS />}
          />
          <Route
            path="apis/ios/latest-transaction-ios"
            element={<APIsLatestTransactionIOS />}
          />
          <Route
            path="apis/ios/show-manage-subscriptions-ios"
            element={<APIsShowManageSubscriptionsIOS />}
          />
          <Route
            path="apis/ios/is-transaction-verified-ios"
            element={<APIsIsTransactionVerifiedIOS />}
          />
          <Route
            path="apis/ios/get-transaction-jws-ios"
            element={<APIsGetTransactionJwsIOS />}
          />
          <Route
            path="apis/ios/get-receipt-data-ios"
            element={<APIsGetReceiptDataIOS />}
          />
          <Route
            path="apis/ios/begin-refund-request-ios"
            element={<APIsBeginRefundRequestIOS />}
          />
          <Route
            path="apis/ios/present-code-redemption-sheet-ios"
            element={<APIsPresentCodeRedemptionSheetIOS />}
          />
          <Route
            path="apis/ios/get-app-transaction-ios"
            element={<APIsGetAppTransactionIOS />}
          />
          <Route
            path="apis/ios/can-present-external-purchase-notice-ios"
            element={<APIsCanPresentExternalPurchaseNoticeIOS />}
          />
          <Route
            path="apis/ios/present-external-purchase-notice-sheet-ios"
            element={<APIsPresentExternalPurchaseNoticeSheetIOS />}
          />
          <Route
            path="apis/ios/present-external-purchase-link-ios"
            element={<APIsPresentExternalPurchaseLinkIOS />}
          />
          <Route
            path="apis/ios/request-purchase-on-promoted-product-ios"
            element={<APIsRequestPurchaseOnPromotedProductIOS />}
          />
          <Route
            path="apis/ios/validate-receipt-ios"
            element={<APIsValidateReceiptIOS />}
          />
          <Route
            path="apis/android/acknowledge-purchase-android"
            element={<APIsAcknowledgePurchaseAndroid />}
          />
          <Route
            path="apis/android/consume-purchase-android"
            element={<APIsConsumePurchaseAndroid />}
          />
          <Route
            path="apis/android/check-alternative-billing-availability-android"
            element={<APIsCheckAlternativeBillingAvailabilityAndroid />}
          />
          <Route
            path="apis/android/show-alternative-billing-dialog-android"
            element={<APIsShowAlternativeBillingDialogAndroid />}
          />
          <Route
            path="apis/android/create-alternative-billing-token-android"
            element={<APIsCreateAlternativeBillingTokenAndroid />}
          />
          <Route
            path="apis/android/enable-billing-program-android"
            element={<APIsEnableBillingProgramAndroid />}
          />
          <Route
            path="apis/android/is-billing-program-available-android"
            element={<APIsIsBillingProgramAvailableAndroid />}
          />
          <Route
            path="apis/android/launch-external-link-android"
            element={<APIsLaunchExternalLinkAndroid />}
          />
          <Route
            path="apis/android/create-billing-program-reporting-details-android"
            element={<APIsCreateBillingProgramReportingDetailsAndroid />}
          />
          <Route
            path="apis/connection"
            element={<Navigate to="/docs/apis" replace />}
          />
          <Route
            path="apis/products"
            element={<Navigate to="/docs/apis" replace />}
          />
          <Route
            path="apis/purchase"
            element={<Navigate to="/docs/apis" replace />}
          />
          <Route
            path="apis/subscription"
            element={<Navigate to="/docs/apis" replace />}
          />
          <Route
            path="apis/ios"
            element={<Navigate to="/docs/apis" replace />}
          />
          <Route
            path="apis/android"
            element={<Navigate to="/docs/apis" replace />}
          />
          <Route
            path="apis/validation"
            element={<Navigate to="/docs/features/validation" replace />}
          />
          <Route
            path="apis/debugging"
            element={<Navigate to="/docs/features/debugging" replace />}
          />
          <Route path="events" element={<Events />} />
          <Route path="errors" element={<Errors />} />
          <Route path="features/purchase" element={<Purchase />} />
          <Route
            path="features/subscription"
            element={<SubscriptionFeature />}
          />
          <Route
            path="features/subscription/upgrade-downgrade"
            element={<SubscriptionUpgradeDowngrade />}
          />
          <Route path="features/discount" element={<Discount />} />
          <Route
            path="features/offer-code-redemption"
            element={<OfferCodeRedemption />}
          />
          <Route
            path="features/external-purchase"
            element={<ExternalPurchase />}
          />
          <Route
            path="features/subscription-billing-issue"
            element={<SubscriptionBillingIssue />}
          />
          <Route path="features/refund" element={<Refund />} />
          <Route path="features/validation" element={<Validation />} />
          <Route path="features/debugging" element={<Debugging />} />
          <Route
            path="features/alternative-marketplace"
            element={<AlternativeMarketplace />}
          />
          <Route
            path="features/alternative-marketplace/onside"
            element={<AlternativeMarketplaceOnside />}
          />
          <Route path="ios-setup" element={<IOSSetup />} />
          <Route path="android-setup" element={<AndroidSetup />} />
          <Route path="horizon-setup" element={<HorizonSetup />} />
          <Route path="setup" element={<SetupIndex />} />
          <Route path="setup/react-native" element={<ReactNativeSetup />} />
          <Route path="setup/expo" element={<ExpoSetup />} />
          <Route path="setup/flutter" element={<FlutterSetup />} />
          <Route path="setup/godot" element={<GodotSetup />} />
          <Route path="setup/kmp" element={<KmpSetup />} />
          <Route path="example" element={<Example />} />
          <Route path="guides/ai-assistants" element={<AIAssistants />} />
          <Route path="guides/testing" element={<Testing />} />
          <Route path="foundation/about" element={<FoundationOnePager />} />
          <Route
            path="foundation/governance"
            element={<FoundationGovernance />}
          />
          <Route
            path="foundation/sponsorship"
            element={<FoundationSponsorship />}
          />
          <Route
            path="foundation/roadmap-budget"
            element={<FoundationRoadmapBudget />}
          />
          <Route
            path="foundation/founding-supporters"
            element={<FoundationFoundingSupporters />}
          />
          <Route path="updates/announcements" element={<Announcements />} />
          <Route
            path="updates/notes"
            element={<Navigate to="/docs/updates/releases" replace />}
          />
          <Route path="updates/releases" element={<Releases />} />
          <Route path="updates/versions" element={<Versions />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

export default Docs;
