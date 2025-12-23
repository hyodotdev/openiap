import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ApiItem {
  id: string;
  title: string;
  category: string;
  description?: string;
  parameters?: string;
  returns?: string;
  path: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const apiData: ApiItem[] = [
  // Connection Management
  {
    id: 'init-connection',
    title: 'initConnection',
    category: 'Connection',
    description: 'Initialize connection to the store service',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/connection#init-connection',
  },
  {
    id: 'end-connection',
    title: 'endConnection',
    category: 'Connection',
    description: 'End connection to the store service',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/connection#end-connection',
  },

  // Product Management
  {
    id: 'fetch-products',
    title: 'fetchProducts',
    category: 'Products',
    description: 'Retrieve products or subscriptions from the store',
    parameters: 'ProductRequest',
    returns: '[Product!]!',
    path: '/docs/apis/products#fetch-products',
  },
  {
    id: 'get-available-purchases',
    title: 'getAvailablePurchases',
    category: 'Products',
    description: 'Get all available purchases for the current user',
    parameters: 'PurchaseOptions?',
    returns: '[Purchase!]!',
    path: '/docs/apis/products#get-available-purchases',
  },

  // Purchase Operations
  {
    id: 'request-purchase',
    title: 'requestPurchase',
    category: 'Purchase',
    description: 'Request a purchase (one-time or subscription)',
    parameters: 'RequestPurchaseProps',
    returns: 'Purchase!',
    path: '/docs/apis/purchase#request-purchase',
  },
  {
    id: 'finish-transaction',
    title: 'finishTransaction',
    category: 'Purchase',
    description:
      'Complete a purchase transaction. Must be called after successful verification',
    parameters: 'Purchase!, isConsumable: Boolean?',
    returns: 'Void',
    path: '/docs/apis/purchase#finish-transaction',
  },
  {
    id: 'restore-purchases',
    title: 'restorePurchases',
    category: 'Purchase',
    description: 'Restore completed transactions (cross-platform)',
    parameters: '',
    returns: 'Void',
    path: '/docs/apis/purchase#restore-purchases',
  },
  {
    id: 'get-storefront',
    title: 'getStorefront',
    category: 'Purchase',
    description: 'Get storefront country code for the active user',
    parameters: '',
    returns: 'String!',
    path: '/docs/apis/purchase#get-storefront',
  },

  // Subscription Management
  {
    id: 'get-active-subscriptions',
    title: 'getActiveSubscriptions',
    category: 'Subscription',
    description: 'Get all active subscriptions with detailed information',
    parameters: 'subscriptionIds: [String]?',
    returns: '[ActiveSubscription!]!',
    path: '/docs/apis/subscription#get-active-subscriptions',
  },
  {
    id: 'has-active-subscriptions',
    title: 'hasActiveSubscriptions',
    category: 'Subscription',
    description: 'Check if the user has any active subscriptions',
    parameters: 'subscriptionIds: [String]?',
    returns: 'Boolean!',
    path: '/docs/apis/subscription#has-active-subscriptions',
  },
  {
    id: 'deep-link-to-subscriptions',
    title: 'deepLinkToSubscriptions',
    category: 'Subscription',
    description: 'Open native subscription management interface',
    parameters: 'DeepLinkOptions',
    returns: 'Void',
    path: '/docs/apis/subscription#deep-link-to-subscriptions',
  },

  // Verification
  {
    id: 'verify-purchase',
    title: 'verifyPurchase',
    category: 'Validation',
    description: 'Verify purchases with your server or platform providers',
    parameters: 'PurchaseVerificationProps!',
    returns: 'PurchaseVerificationResult!',
    path: '/docs/apis/validation#verify-purchase',
  },
  {
    id: 'verify-purchase-with-provider',
    title: 'verifyPurchaseWithProvider',
    category: 'Validation',
    description: 'Verify purchases using IAPKit or other providers',
    parameters: 'VerifyPurchaseWithProviderProps!',
    returns: 'VerifyPurchaseWithProviderResult!',
    path: '/docs/apis/validation#verify-purchase-with-provider',
  },

  // iOS APIs
  {
    id: 'clear-transaction-ios',
    title: 'clearTransactionIOS',
    category: 'iOS APIs',
    description: 'Clear pending transactions',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/ios#clear-transaction-ios',
  },
  {
    id: 'sync-ios',
    title: 'syncIOS',
    category: 'iOS APIs',
    description: 'Force StoreKit transaction sync (iOS 15+)',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/ios#sync-ios',
  },
  {
    id: 'get-promoted-product-ios',
    title: 'getPromotedProductIOS',
    category: 'iOS APIs',
    description: 'Get the currently promoted product (iOS 11+)',
    parameters: '',
    returns: 'ProductIOS',
    path: '/docs/apis/ios#get-promoted-product-ios',
  },
  {
    id: 'request-purchase-on-promoted-product-ios',
    title: 'requestPurchaseOnPromotedProductIOS',
    category: 'iOS APIs',
    description: 'Purchase a promoted product (iOS 11+)',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/ios#request-purchase-on-promoted-product-ios',
  },
  {
    id: 'get-pending-transactions-ios',
    title: 'getPendingTransactionsIOS',
    category: 'iOS APIs',
    description: 'Retrieve pending StoreKit transactions',
    parameters: '',
    returns: '[PurchaseIOS!]!',
    path: '/docs/apis/ios#get-pending-transactions-ios',
  },
  {
    id: 'is-eligible-for-intro-offer-ios',
    title: 'isEligibleForIntroOfferIOS',
    category: 'iOS APIs',
    description: 'Check introductory offer eligibility',
    parameters: 'groupID: String!',
    returns: 'Boolean!',
    path: '/docs/apis/ios#is-eligible-for-intro-offer-ios',
  },
  {
    id: 'subscription-status-ios',
    title: 'subscriptionStatusIOS',
    category: 'iOS APIs',
    description: 'Get StoreKit 2 subscription status (iOS 15+)',
    parameters: 'sku: String!',
    returns: '[SubscriptionStatusIOS!]!',
    path: '/docs/apis/ios#subscription-status-ios',
  },
  {
    id: 'current-entitlement-ios',
    title: 'currentEntitlementIOS',
    category: 'iOS APIs',
    description: 'Get current StoreKit 2 entitlement (iOS 15+)',
    parameters: 'sku: String!',
    returns: 'PurchaseIOS',
    path: '/docs/apis/ios#current-entitlement-ios',
  },
  {
    id: 'latest-transaction-ios',
    title: 'latestTransactionIOS',
    category: 'iOS APIs',
    description: 'Get latest StoreKit 2 transaction (iOS 15+)',
    parameters: 'sku: String!',
    returns: 'PurchaseIOS',
    path: '/docs/apis/ios#latest-transaction-ios',
  },
  {
    id: 'show-manage-subscriptions-ios',
    title: 'showManageSubscriptionsIOS',
    category: 'iOS APIs',
    description: 'Open subscription management UI and return changes (iOS 15+)',
    parameters: '',
    returns: '[PurchaseIOS!]!',
    path: '/docs/apis/ios#show-manage-subscriptions-ios',
  },
  {
    id: 'begin-refund-request-ios',
    title: 'beginRefundRequestIOS',
    category: 'iOS APIs',
    description: 'Initiate refund request (iOS 15+)',
    parameters: 'sku: String!',
    returns: 'String',
    path: '/docs/apis/ios#begin-refund-request-ios',
  },
  {
    id: 'is-transaction-verified-ios',
    title: 'isTransactionVerifiedIOS',
    category: 'iOS APIs',
    description: 'Verify StoreKit 2 transaction signature',
    parameters: 'sku: String!',
    returns: 'Boolean!',
    path: '/docs/apis/ios#is-transaction-verified-ios',
  },
  {
    id: 'get-transaction-jws-ios',
    title: 'getTransactionJwsIOS',
    category: 'iOS APIs',
    description: 'Get the transaction JWS (StoreKit 2)',
    parameters: 'sku: String!',
    returns: 'String',
    path: '/docs/apis/ios#get-transaction-jws-ios',
  },
  {
    id: 'get-receipt-data-ios',
    title: 'getReceiptDataIOS',
    category: 'iOS APIs',
    description: 'Get base64-encoded receipt data for validation',
    parameters: '',
    returns: 'String',
    path: '/docs/apis/ios#get-receipt-data-ios',
  },
  {
    id: 'present-code-redemption-sheet-ios',
    title: 'presentCodeRedemptionSheetIOS',
    category: 'iOS APIs',
    description: 'Present the App Store code redemption sheet',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/ios#present-code-redemption-sheet-ios',
  },
  {
    id: 'get-app-transaction-ios',
    title: 'getAppTransactionIOS',
    category: 'iOS APIs',
    description: 'Fetch the current app transaction (iOS 16+)',
    parameters: '',
    returns: 'AppTransaction',
    path: '/docs/apis/ios#get-app-transaction-ios',
  },
  {
    id: 'external-purchase-ios',
    title: 'iOS External Purchase',
    category: 'iOS APIs',
    description: 'External purchase flow for iOS 17.4+',
    parameters: '',
    returns: '',
    path: '/docs/apis/ios#external-purchase',
  },

  // Android APIs
  {
    id: 'acknowledge-purchase-android',
    title: 'acknowledgePurchaseAndroid',
    category: 'Android APIs',
    description: 'Acknowledge a non-consumable purchase or subscription',
    parameters: 'purchaseToken: String!',
    returns: 'Boolean!',
    path: '/docs/apis/android#acknowledge-purchase-android',
  },
  {
    id: 'consume-purchase-android',
    title: 'consumePurchaseAndroid',
    category: 'Android APIs',
    description: 'Consume a purchase (for consumable products only)',
    parameters: 'purchaseToken: String!',
    returns: 'Boolean!',
    path: '/docs/apis/android#consume-purchase-android',
  },
  {
    id: 'check-alternative-billing-availability-android',
    title: 'checkAlternativeBillingAvailabilityAndroid',
    category: 'Android APIs',
    description:
      'Check if alternative billing is available (Step 1 of alternative billing)',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/android#check-alternative-billing-availability-android',
  },
  {
    id: 'show-alternative-billing-dialog-android',
    title: 'showAlternativeBillingDialogAndroid',
    category: 'Android APIs',
    description:
      'Show alternative billing dialog to user (Step 2 of alternative billing)',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis/android#show-alternative-billing-dialog-android',
  },
  {
    id: 'create-alternative-billing-token-android',
    title: 'createAlternativeBillingTokenAndroid',
    category: 'Android APIs',
    description:
      'Create external transaction token for Google Play (Step 3 of alternative billing)',
    parameters: '',
    returns: 'String',
    path: '/docs/apis/android#create-alternative-billing-token-android',
  },

  // Debugging & Logging
  {
    id: 'debugging-logging',
    title: 'Debugging & Logging',
    category: 'Debugging',
    description: 'Enable verbose logging for development',
    parameters: '',
    returns: '',
    path: '/docs/apis/debugging',
  },
  {
    id: 'enable-logging',
    title: 'Enable Logging',
    category: 'Debugging',
    description: 'Enable or disable debug logs',
    parameters: 'Boolean',
    returns: '',
    path: '/docs/apis/debugging#enable-logging',
  },
  {
    id: 'baseplanid-limitation',
    title: 'Android basePlanId Limitation',
    category: 'Debugging',
    description: 'Understanding basePlanId limitations with multiple offers',
    parameters: '',
    returns: '',
    path: '/docs/apis/debugging#android-baseplanid-limitation',
  },

  // Documentation Pages
  {
    id: 'external-purchase-page',
    title: 'External Purchase',
    category: 'Documentation',
    description:
      'External purchase links for iOS - redirect users to external payment websites (iOS 16.0+)',
    path: '/docs/features/external-purchase',
  },
  {
    id: 'types-page',
    title: 'Types',
    category: 'Documentation',
    description: 'Type definitions and data structures',
    path: '/docs/types',
  },
  {
    id: 'types-product',
    title: 'Product Types',
    category: 'Types',
    description: 'Product, SubscriptionProduct, Unified Platform Types, Storefront',
    path: '/docs/types/product',
  },
  {
    id: 'product',
    title: 'Product',
    category: 'Types',
    description: 'Base product type: id, title, description, price, currency, type',
    path: '/docs/types/product#product',
  },
  {
    id: 'subscription-product',
    title: 'SubscriptionProduct',
    category: 'Types',
    description: 'Subscription product with pricing phases, intro offers, billing periods',
    path: '/docs/types/product#product-subscription',
  },
  {
    id: 'storefront',
    title: 'Storefront',
    category: 'Types',
    description: 'Store region info: countryCode returned by getStorefront()',
    path: '/docs/types/product#storefront',
  },
  {
    id: 'types-purchase',
    title: 'Purchase Types',
    category: 'Types',
    description: 'Purchase, PurchaseState, ActiveSubscription, RenewalInfoIOS',
    path: '/docs/types/purchase',
  },
  {
    id: 'purchase',
    title: 'Purchase',
    category: 'Types',
    description: 'Purchase transaction: id, productId, transactionDate, transactionReceipt',
    path: '/docs/types/purchase#purchase',
  },
  {
    id: 'purchase-state',
    title: 'PurchaseState',
    category: 'Types',
    description: 'Purchase state enum: purchased, pending, failed, restored, deferred',
    path: '/docs/types/purchase#purchase-state',
  },
  {
    id: 'active-subscription',
    title: 'ActiveSubscription',
    category: 'Types',
    description: 'Active subscription: id, productId, isActive from getActiveSubscriptions()',
    path: '/docs/types/purchase#active-subscription',
  },
  {
    id: 'types-request',
    title: 'Request Types',
    category: 'Types',
    description: 'ProductRequest, RequestPurchaseProps, platform-specific request types',
    path: '/docs/types/request',
  },
  {
    id: 'types-verification',
    title: 'Verification Types',
    category: 'Types',
    description: 'VerifyPurchaseProps, IAPKit integration, purchase verification',
    path: '/docs/types/verification',
  },
  {
    id: 'types-ios',
    title: 'iOS Types',
    category: 'Types',
    description: 'DiscountOffer, SubscriptionStatusIOS, PaymentMode, AppTransaction',
    path: '/docs/types/ios',
  },
  {
    id: 'types-android',
    title: 'Android Types',
    category: 'Types',
    description: 'SubscriptionOffer, PricingPhase, PricingPhasesAndroid',
    path: '/docs/types/android',
  },
  {
    id: 'types-alternative',
    title: 'Alternative Billing Types',
    category: 'Types',
    description: 'AlternativeBillingModeAndroid, InitConnectionConfig, External Purchase Link',
    path: '/docs/types/alternative',
  },

  // iOS-Specific Types (from types/ios.tsx)
  {
    id: 'discount-offer',
    title: 'DiscountOffer',
    category: 'Types (iOS)',
    description: 'iOS promotional offer for purchase: identifier, keyIdentifier, nonce, signature, timestamp',
    path: '/docs/types/ios#discount-offer',
  },
  {
    id: 'discount',
    title: 'Discount',
    category: 'Types (iOS)',
    description: 'iOS discount info: identifier, type, numberOfPeriods, price, paymentMode, subscriptionPeriod',
    path: '/docs/types/ios#discount',
  },
  {
    id: 'subscription-period-ios',
    title: 'SubscriptionPeriodIOS',
    category: 'Types (iOS)',
    description: 'iOS subscription period units: Day, Week, Month, Year',
    path: '/docs/types/ios#subscription-period-ios',
  },
  {
    id: 'payment-mode',
    title: 'PaymentMode',
    category: 'Types (iOS)',
    description: 'iOS payment mode for offers: FreeTrial, PayAsYouGo, PayUpFront',
    path: '/docs/types/ios#payment-mode',
  },
  {
    id: 'subscription-status-ios',
    title: 'SubscriptionStatusIOS',
    category: 'Types (iOS)',
    description: 'iOS subscription status from StoreKit 2: state, renewalInfo',
    path: '/docs/types/ios#subscription-status-ios',
  },
  {
    id: 'app-transaction',
    title: 'AppTransaction',
    category: 'Types (iOS)',
    description: 'iOS app transaction info: bundleId, appVersion, originalAppVersion, environment',
    path: '/docs/types/ios#app-transaction',
  },

  // Android-Specific Types (from types/android.tsx)
  {
    id: 'subscription-offer',
    title: 'SubscriptionOffer',
    category: 'Types (Android)',
    description: 'Android subscription offer: sku, offerToken for Play Billing purchases',
    path: '/docs/types/android#subscription-offer',
  },
  {
    id: 'pricing-phase',
    title: 'PricingPhase',
    category: 'Types (Android)',
    description: 'Android pricing phase: billingPeriod, formattedPrice, priceAmountMicros, recurrenceMode',
    path: '/docs/types/android#pricing-phase',
  },
  {
    id: 'pricing-phases-android',
    title: 'PricingPhasesAndroid',
    category: 'Types (Android)',
    description: 'Android pricing phases container: pricingPhaseList array',
    path: '/docs/types/android#pricing-phases-android',
  },

  // Alternative Billing Types (from types/alternative.tsx)
  {
    id: 'alternative-billing-mode-android',
    title: 'AlternativeBillingModeAndroid',
    category: 'Types (Android)',
    description: 'Android billing mode: NONE, USER_CHOICE, ALTERNATIVE_ONLY',
    path: '/docs/types/alternative#alternative-billing-mode-android',
  },
  {
    id: 'init-connection-config',
    title: 'InitConnectionConfig',
    category: 'Types',
    description: 'Configuration for initConnection: alternativeBillingModeAndroid',
    path: '/docs/types/alternative#init-connection-config',
  },
  {
    id: 'external-purchase-link-ios',
    title: 'External Purchase Link (iOS)',
    category: 'Types (iOS)',
    description: 'iOS external purchase APIs: canPresent, presentNoticeSheet, presentLink (iOS 15.4+)',
    path: '/docs/types/alternative#external-purchase-link',
  },

  // Platform-Specific Request Types
  {
    id: 'request-purchase-ios-props',
    title: 'RequestPurchaseIosProps',
    category: 'Types (iOS)',
    description: 'iOS purchase request parameters: sku, appAccountToken, quantity, withOffer',
    path: '/docs/types/request#request-purchase-ios-props',
  },
  {
    id: 'request-purchase-android-props',
    title: 'RequestPurchaseAndroidProps',
    category: 'Types (Android)',
    description: 'Android purchase request parameters: skus, obfuscatedAccountId, isOfferPersonalized',
    path: '/docs/types/request#request-purchase-android-props',
  },
  {
    id: 'request-subscription-ios-props',
    title: 'RequestSubscriptionIosProps',
    category: 'Types (iOS)',
    description: 'iOS subscription request parameters (same as RequestPurchaseIosProps)',
    path: '/docs/types/request#request-subscription-ios-props',
  },
  {
    id: 'request-subscription-android-props',
    title: 'RequestSubscriptionAndroidProps',
    category: 'Types (Android)',
    description: 'Android subscription request: purchaseToken, replacementMode, subscriptionOffers',
    path: '/docs/types/request#request-subscription-android-props',
  },

  // Platform-Specific Product Types
  {
    id: 'product-ios',
    title: 'ProductIOS',
    category: 'Types (iOS)',
    description: 'iOS product fields: typeIOS, isFamilyShareableIOS, subscriptionInfoIOS',
    path: '/docs/types/product#product-ios',
  },
  {
    id: 'product-android',
    title: 'ProductAndroid',
    category: 'Types (Android)',
    description: 'Android product fields: nameAndroid, oneTimePurchaseOfferDetailsAndroid, subscriptionOfferDetailsAndroid',
    path: '/docs/types/product#product-android',
  },
  {
    id: 'subscription-product-ios',
    title: 'SubscriptionProductIOS',
    category: 'Types (iOS)',
    description: 'iOS subscription fields: discountsIOS, introductoryPriceIOS, subscriptionPeriodUnitIOS',
    path: '/docs/types/product#subscription-product-ios',
  },
  {
    id: 'subscription-product-android',
    title: 'SubscriptionProductAndroid',
    category: 'Types (Android)',
    description: 'Android subscription fields: subscriptionOfferDetailsAndroid',
    path: '/docs/types/product#subscription-product-android',
  },

  // Platform-Specific Purchase Types
  {
    id: 'purchase-ios',
    title: 'PurchaseIOS',
    category: 'Types (iOS)',
    description: 'iOS purchase fields: originalTransactionDateIOS, expirationDateIOS, renewalInfoIOS',
    path: '/docs/types/purchase#purchase-ios',
  },
  {
    id: 'purchase-android',
    title: 'PurchaseAndroid',
    category: 'Types (Android)',
    description: 'Android purchase fields: dataAndroid, signatureAndroid, isAcknowledgedAndroid',
    path: '/docs/types/purchase#purchase-android',
  },
  {
    id: 'renewal-info-ios',
    title: 'RenewalInfoIOS',
    category: 'Types (iOS)',
    description: 'iOS subscription renewal info: willAutoRenew, expirationReason, gracePeriodExpirationDate',
    path: '/docs/types/purchase#renewal-info-ios',
  },
  {
    id: 'active-subscription-ios',
    title: 'ActiveSubscriptionIOS',
    category: 'Types (iOS)',
    description: 'iOS active subscription: expirationDateIOS, environmentIOS, daysUntilExpirationIOS',
    path: '/docs/types/purchase#active-subscription-ios',
  },
  {
    id: 'active-subscription-android',
    title: 'ActiveSubscriptionAndroid',
    category: 'Types (Android)',
    description: 'Android active subscription: autoRenewingAndroid, basePlanIdAndroid, purchaseTokenAndroid',
    path: '/docs/types/purchase#active-subscription-android',
  },

  // Platform-Specific Verification Types
  {
    id: 'verify-purchase-result-ios',
    title: 'VerifyPurchaseResultIOS',
    category: 'Types (iOS)',
    description: 'iOS verification result: isValid, receiptData, jwsRepresentation, latestTransaction',
    path: '/docs/types/verification#verify-purchase-result-ios',
  },
  {
    id: 'verify-purchase-result-android',
    title: 'VerifyPurchaseResultAndroid',
    category: 'Types (Android)',
    description: 'Android verification result: autoRenewing, cancelDate, renewalDate, transactionId',
    path: '/docs/types/verification#verify-purchase-result-android',
  },
  {
    id: 'verify-purchase-result-horizon',
    title: 'VerifyPurchaseResultHorizon',
    category: 'Types (Horizon)',
    description: 'Meta Quest verification result: success, grantTime',
    path: '/docs/types/verification#verify-purchase-result-horizon',
  },

  {
    id: 'apis-page',
    title: 'APIs',
    category: 'Documentation',
    description: 'API reference and function signatures',
    path: '/docs/apis',
  },
  {
    id: 'events-page',
    title: 'Events',
    category: 'Documentation',
    description: 'Event listeners and callbacks',
    path: '/docs/events',
  },
  {
    id: 'errors-page',
    title: 'Errors',
    category: 'Documentation',
    description: 'Error codes and error handling',
    path: '/docs/errors',
  },
];

function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const filteredApis = useMemo(() => {
    if (!searchQuery) return [];

    const query = searchQuery.toLowerCase();
    return apiData.filter(
      (api) =>
        api.title.toLowerCase().includes(query) ||
        api.description?.toLowerCase().includes(query) ||
        api.parameters?.toLowerCase().includes(query) ||
        api.returns?.toLowerCase().includes(query) ||
        api.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredApis.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter' && filteredApis.length > 0) {
        e.preventDefault();
        const selectedApi = filteredApis[selectedIndex];
        if (selectedApi) {
          navigate(selectedApi.path);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredApis, selectedIndex, navigate, onClose]);

  const handleApiClick = (api: ApiItem) => {
    navigate(api.path);
    onClose();
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="search-highlight">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <div
        className="search-modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="search-modal-container">
        <div className="search-modal">
          <div className="search-modal-header">
            <Search className="search-modal-icon" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search APIs..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedIndex(0);
              }}
              className="search-modal-input"
            />
            <button onClick={onClose} className="search-modal-close">
              <X />
            </button>
          </div>

          {searchQuery && (
            <div className="search-modal-results">
              {filteredApis.length > 0 ? (
                <>
                  <div className="search-result-count">
                    {filteredApis.length} result
                    {filteredApis.length !== 1 ? 's' : ''}
                  </div>
                  <div className="search-result-list">
                    {filteredApis.map((api, index) => (
                      <button
                        key={api.id}
                        onClick={() => handleApiClick(api)}
                        className={`search-result-item ${
                          index === selectedIndex ? 'selected' : ''
                        }`}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <div className="search-result-content">
                          <div className="search-result-header">
                            <span className="search-result-title">
                              {highlightMatch(api.title, searchQuery)}
                            </span>
                            <span className="search-result-category">
                              {api.category}
                            </span>
                          </div>
                          {api.description && (
                            <p className="search-result-description">
                              {highlightMatch(api.description, searchQuery)}
                            </p>
                          )}
                          <div className="search-result-meta">
                            {api.parameters && (
                              <span className="search-result-params">
                                {highlightMatch(api.parameters, searchQuery)}
                              </span>
                            )}
                            {api.returns && (
                              <span className="search-result-returns">
                                → {highlightMatch(api.returns, searchQuery)}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="search-no-results">
                  No results found for "{searchQuery}"
                </div>
              )}
            </div>
          )}

          <div className="search-modal-footer">
            <div className="search-shortcuts">
              <span className="search-shortcut">
                <kbd>↑↓</kbd> Navigate
              </span>
              <span className="search-shortcut">
                <kbd>Enter</kbd> Select
              </span>
              <span className="search-shortcut">
                <kbd>Esc</kbd> Close
              </span>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

export default SearchModal;
