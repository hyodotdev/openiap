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
    category: 'Connection Management',
    description: 'Initialize connection to the store service',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis#init-connection',
  },
  {
    id: 'end-connection',
    title: 'endConnection',
    category: 'Connection Management',
    description: 'End connection to the store service',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis#end-connection',
  },

  // Subscription Management
  {
    id: 'get-active-subscriptions',
    title: 'getActiveSubscriptions',
    category: 'Subscription Management',
    description: 'Get all active subscriptions with detailed information',
    parameters: 'subscriptionIds: [String]?',
    returns: '[ActiveSubscription!]!',
    path: '/docs/apis#get-active-subscriptions',
  },
  {
    id: 'has-active-subscriptions',
    title: 'hasActiveSubscriptions',
    category: 'Subscription Management',
    description: 'Check if the user has any active subscriptions',
    parameters: 'subscriptionIds: [String]?',
    returns: 'Boolean!',
    path: '/docs/apis#has-active-subscriptions',
  },
  {
    id: 'deep-link-to-subscriptions',
    title: 'deepLinkToSubscriptions',
    category: 'Subscription Management',
    description: 'Open native subscription management interface',
    parameters: 'DeepLinkOptions',
    returns: 'Void',
    path: '/docs/apis#deep-link-to-subscriptions',
  },

  // Product Management
  {
    id: 'fetch-products',
    title: 'fetchProducts',
    category: 'Product Management',
    description: 'Retrieve products or subscriptions from the store',
    parameters: 'ProductRequest',
    returns: '[Product!]!',
    path: '/docs/apis#fetch-products',
  },
  {
    id: 'get-available-purchases',
    title: 'getAvailablePurchases',
    category: 'Product Management',
    description: 'Get all available purchases for the current user',
    parameters: 'PurchaseOptions?',
    returns: '[Purchase!]!',
    path: '/docs/apis#get-available-purchases',
  },
  // Purchase Operations
  {
    id: 'request-purchase',
    title: 'requestPurchase',
    category: 'Purchase Operations',
    description: 'Request a purchase (one-time or subscription)',
    parameters: 'RequestPurchaseProps',
    returns: 'Purchase!',
    path: '/docs/apis#request-purchase',
  },
  {
    id: 'ios-external-purchase-links',
    title: 'iOS External Purchase Links',
    category: 'Purchase Operations',
    description: 'Redirect users to external website for purchase (iOS only)',
    parameters: 'externalPurchaseUrlOnIOS',
    returns: '',
    path: '/docs/apis#ios-external-purchase-links',
  },
  {
    id: 'android-alternative-billing',
    title: 'Android Alternative Billing',
    category: 'Purchase Operations',
    description: 'Google Play alternative billing flow (Android only)',
    parameters: '',
    returns: '',
    path: '/docs/apis#android-alternative-billing',
  },
  {
    id: 'finish-transaction',
    title: 'finishTransaction',
    category: 'Purchase Operations',
    description:
      'Complete a purchase transaction. Must be called after successful verification',
    parameters: 'Purchase!, isConsumable: Boolean?',
    returns: 'Void',
    path: '/docs/apis#finish-transaction',
  },

  // Validation
  {
    id: 'validate-receipt',
    title: 'validateReceipt',
    category: 'Receipt Validation',
    description: 'Validate a receipt with your server or platform servers',
    parameters: 'ReceiptValidationProps!',
    returns: 'ReceiptValidationResult!',
    path: '/docs/apis#validate-receipt',
  },
  // iOS APIs
  {
    id: 'clear-transaction-ios',
    title: 'clearTransactionIOS',
    category: 'iOS APIs',
    description: 'Clear pending transactions',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis#clear-transaction-ios',
  },
  {
    id: 'get-storefront-ios',
    title: 'getStorefrontIOS',
    category: 'iOS APIs',
    description: 'Deprecated. Use getStorefront for cross-platform data',
    parameters: '',
    returns: 'String!',
    path: '/docs/apis#get-storefront-ios',
  },
  {
    id: 'get-promoted-product-ios',
    title: 'getPromotedProductIOS',
    category: 'iOS APIs',
    description: 'Get the currently promoted product (iOS 11+)',
    parameters: '',
    returns: 'ProductIOS',
    path: '/docs/apis#get-promoted-product-ios',
  },
  {
    id: 'request-purchase-on-promoted-product-ios',
    title: 'requestPurchaseOnPromotedProductIOS',
    category: 'iOS APIs',
    description: 'Purchase a promoted product (iOS 11+)',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis#request-purchase-on-promoted-product-ios',
  },
  {
    id: 'get-pending-transactions-ios',
    title: 'getPendingTransactionsIOS',
    category: 'iOS APIs',
    description: 'Retrieve pending StoreKit transactions',
    parameters: '',
    returns: '[PurchaseIOS!]!',
    path: '/docs/apis#get-pending-transactions-ios',
  },
  {
    id: 'is-eligible-for-intro-offer-ios',
    title: 'isEligibleForIntroOfferIOS',
    category: 'iOS APIs',
    description: 'Check introductory offer eligibility',
    parameters: 'groupID: String!',
    returns: 'Boolean!',
    path: '/docs/apis#is-eligible-for-intro-offer-ios',
  },
  {
    id: 'subscription-status-ios',
    title: 'subscriptionStatusIOS',
    category: 'iOS APIs',
    description: 'Get StoreKit 2 subscription status (iOS 15+)',
    parameters: 'sku: String!',
    returns: '[SubscriptionStatusIOS!]!',
    path: '/docs/apis#subscription-status-ios',
  },
  {
    id: 'restore-purchases',
    title: 'restorePurchases',
    category: 'Purchase Operations',
    description: 'Restore completed transactions (cross-platform)',
    parameters: '',
    returns: 'Void',
    path: '/docs/apis#restore-purchases',
  },
  // Storefront
  {
    id: 'get-storefront',
    title: 'getStorefront',
    category: 'Storefront',
    description: 'Get storefront country code for the active user',
    parameters: '',
    returns: 'String!',
    path: '/docs/apis#get-storefront',
  },
  {
    id: 'current-entitlement-ios',
    title: 'currentEntitlementIOS',
    category: 'iOS APIs',
    description: 'Get current StoreKit 2 entitlement (iOS 15+)',
    parameters: 'sku: String!',
    returns: 'PurchaseIOS',
    path: '/docs/apis#current-entitlement-ios',
  },
  {
    id: 'latest-transaction-ios',
    title: 'latestTransactionIOS',
    category: 'iOS APIs',
    description: 'Get latest StoreKit 2 transaction (iOS 15+)',
    parameters: 'sku: String!',
    returns: 'PurchaseIOS',
    path: '/docs/apis#latest-transaction-ios',
  },
  {
    id: 'show-manage-subscriptions-ios',
    title: 'showManageSubscriptionsIOS',
    category: 'iOS APIs',
    description: 'Open subscription management UI and return changes (iOS 15+)',
    parameters: '',
    returns: '[PurchaseIOS!]!',
    path: '/docs/apis#show-manage-subscriptions-ios',
  },
  {
    id: 'begin-refund-request-ios',
    title: 'beginRefundRequestIOS',
    category: 'iOS APIs',
    description: 'Initiate refund request (iOS 15+)',
    parameters: 'sku: String!',
    returns: 'String',
    path: '/docs/apis#begin-refund-request-ios',
  },
  {
    id: 'is-transaction-verified-ios',
    title: 'isTransactionVerifiedIOS',
    category: 'iOS APIs',
    description: 'Verify StoreKit 2 transaction signature',
    parameters: 'sku: String!',
    returns: 'Boolean!',
    path: '/docs/apis#is-transaction-verified-ios',
  },
  {
    id: 'get-transaction-jws-ios',
    title: 'getTransactionJwsIOS',
    category: 'iOS APIs',
    description: 'Get the transaction JWS (StoreKit 2)',
    parameters: 'sku: String!',
    returns: 'String',
    path: '/docs/apis#get-transaction-jws-ios',
  },
  {
    id: 'get-receipt-data-ios',
    title: 'getReceiptDataIOS',
    category: 'iOS APIs',
    description: 'Get base64-encoded receipt data for validation',
    parameters: '',
    returns: 'String',
    path: '/docs/apis#get-receipt-data-ios',
  },
  {
    id: 'sync-ios',
    title: 'syncIOS',
    category: 'iOS APIs',
    description: 'Force StoreKit transaction sync (iOS 15+)',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis#sync-ios',
  },
  {
    id: 'present-code-redemption-sheet-ios',
    title: 'presentCodeRedemptionSheetIOS',
    category: 'iOS APIs',
    description: 'Present the App Store code redemption sheet',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis#present-code-redemption-sheet-ios',
  },
  {
    id: 'get-app-transaction-ios',
    title: 'getAppTransactionIOS',
    category: 'iOS APIs',
    description: 'Fetch the current app transaction (iOS 16+)',
    parameters: '',
    returns: 'AppTransaction',
    path: '/docs/apis#get-app-transaction-ios',
  },
  {
    id: 'validate-receipt-ios',
    title: 'validateReceiptIOS',
    category: 'iOS APIs',
    description: 'Validate a receipt for a specific product',
    parameters: 'options: ReceiptValidationProps!',
    returns: 'ReceiptValidationResultIOS!',
    path: '/docs/apis#validate-receipt-ios',
  },

  // Android APIs
  {
    id: 'acknowledge-purchase-android',
    title: 'acknowledgePurchaseAndroid',
    category: 'Android APIs',
    description: 'Acknowledge a non-consumable purchase or subscription',
    parameters: 'purchaseToken: String!',
    returns: 'Boolean!',
    path: '/docs/apis#acknowledge-purchase-android',
  },
  {
    id: 'consume-purchase-android',
    title: 'consumePurchaseAndroid',
    category: 'Android APIs',
    description: 'Consume a purchase (for consumable products only)',
    parameters: 'purchaseToken: String!',
    returns: 'Boolean!',
    path: '/docs/apis#consume-purchase-android',
  },
  {
    id: 'check-alternative-billing-availability-android',
    title: 'checkAlternativeBillingAvailabilityAndroid',
    category: 'Android APIs',
    description:
      'Check if alternative billing is available (Step 1 of alternative billing)',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis#check-alternative-billing-availability-android',
  },
  {
    id: 'show-alternative-billing-dialog-android',
    title: 'showAlternativeBillingDialogAndroid',
    category: 'Android APIs',
    description:
      'Show alternative billing dialog to user (Step 2 of alternative billing)',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis#show-alternative-billing-dialog-android',
  },
  {
    id: 'create-alternative-billing-token-android',
    title: 'createAlternativeBillingTokenAndroid',
    category: 'Android APIs',
    description:
      'Create external transaction token for Google Play (Step 3 of alternative billing)',
    parameters: '',
    returns: 'String',
    path: '/docs/apis#create-alternative-billing-token-android',
  },

  // Documentation Pages
  {
    id: 'external-purchase-page',
    title: 'External Purchase',
    category: 'Documentation',
    description:
      'External purchase links for iOS - redirect users to external payment websites (iOS 16.0+)',
    path: '/docs/external-purchase',
  },
  {
    id: 'types-page',
    title: 'Types',
    category: 'Documentation',
    description: 'Type definitions and data structures',
    path: '/docs/types',
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

  // Debugging & Logging
  {
    id: 'debugging-logging',
    title: 'Debugging & Logging',
    category: 'Debugging',
    description: 'Enable verbose logging for development',
    parameters: '',
    returns: '',
    path: '/docs/apis#debugging-logging',
  },
  {
    id: 'enable-logging',
    title: 'Enable Logging',
    category: 'Debugging',
    description: 'Enable or disable debug logs',
    parameters: 'Boolean',
    returns: '',
    path: '/docs/apis#enable-logging',
  },
  {
    id: 'multiple-offers-warning',
    title: 'Multiple Subscription Offers',
    category: 'Debugging',
    description: 'Understanding basePlanId limitations with multiple offers',
    parameters: '',
    returns: '',
    path: '/docs/apis#common-warnings',
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
