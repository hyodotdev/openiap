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
  // Product Management
  {
    id: 'requestproducts',
    title: 'requestProducts',
    category: 'Product Management',
    description: 'Retrieve products or subscriptions from the store',
    parameters: 'ProductRequest',
    returns: '[Product!]!',
    path: '/docs/apis#request-products',
  },
  {
    id: 'getavailablepurchases',
    title: 'getAvailablePurchases',
    category: 'Product Management',
    description: 'Get all available purchases for the current user',
    parameters: 'PurchaseOptions?',
    returns: '[Purchase!]!',
    path: '/docs/apis#get-available-purchases',
  },
  {
    id: 'getpurchasehistories',
    title: 'getPurchaseHistories',
    category: 'Product Management',
    description: 'Get purchase history (iOS only)',
    parameters: 'PurchaseOptions?',
    returns: '[Purchase!]!',
    path: '/docs/apis#get-purchase-histories',
  },

  // Purchase Operations
  {
    id: 'requestpurchase',
    title: 'requestPurchase',
    category: 'Purchase Operations',
    description: 'Request a purchase (one-time or subscription)',
    parameters: 'RequestPurchaseProps | RequestSubscriptionProps',
    returns: 'Purchase!',
    path: '/docs/apis#request-purchase',
  },
  {
    id: 'finishtransaction',
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
    id: 'validatereceipt',
    title: 'validateReceipt',
    category: 'Validation',
    description: 'Validate a receipt with your server or platform servers',
    parameters: 'ValidationOptions!',
    returns: 'ValidationResult!',
    path: '/docs/apis#validate-receipt',
  },

  // iOS APIs
  {
    id: 'finishtransactionios',
    title: 'finishTransactionIOS',
    category: 'iOS APIs',
    description: 'iOS-specific transaction completion',
    parameters: 'transactionId: String!',
    returns: 'Void',
    path: '/docs/apis#finish-transaction-ios',
  },
  {
    id: 'cleartransactionios',
    title: 'clearTransactionIOS',
    category: 'iOS APIs',
    description: 'Clear pending transactions',
    parameters: '',
    returns: 'Void',
    path: '/docs/apis#clear-transaction-ios',
  },
  {
    id: 'clearproductsios',
    title: 'clearProductsIOS',
    category: 'iOS APIs',
    description: 'Clear the products cache',
    parameters: '',
    returns: 'Void',
    path: '/docs/apis#clear-products-ios',
  },
  {
    id: 'getstorefrontios',
    title: 'getStorefrontIOS',
    category: 'iOS APIs',
    description: 'Get the current App Store storefront country code',
    parameters: '',
    returns: 'String!',
    path: '/docs/apis#get-storefront-ios',
  },

  // Android APIs
  {
    id: 'acknowledgepurchaseandroid',
    title: 'acknowledgePurchaseAndroid',
    category: 'Android APIs',
    description: 'Acknowledge a non-consumable purchase or subscription',
    parameters: 'purchaseToken: String!',
    returns: 'Void',
    path: '/docs/apis#acknowledge-purchase-android',
  },
  {
    id: 'consumepurchaseandroid',
    title: 'consumePurchaseAndroid',
    category: 'Android APIs',
    description: 'Consume a purchase (for consumable products only)',
    parameters: 'purchaseToken: String!',
    returns: 'Void',
    path: '/docs/apis#consume-purchase-android',
  },

  // Connection Management
  {
    id: 'initconnection',
    title: 'initConnection',
    category: 'Connection Management',
    description: 'Initialize connection to the store service',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis#init-connection',
  },
  {
    id: 'endconnection',
    title: 'endConnection',
    category: 'Connection Management',
    description: 'End connection to the store service',
    parameters: '',
    returns: 'Boolean!',
    path: '/docs/apis#end-connection',
  },

  // Subscription Management
  {
    id: 'getactivesubscriptions',
    title: 'getActiveSubscriptions',
    category: 'Subscription Management',
    description: 'Get all active subscriptions with detailed information',
    parameters: 'subscriptionIds: [String]?',
    returns: '[ActiveSubscription!]!',
    path: '/docs/apis#get-active-subscriptions',
  },
  {
    id: 'hasactivesubscriptions',
    title: 'hasActiveSubscriptions',
    category: 'Subscription Management',
    description: 'Check if the user has any active subscriptions',
    parameters: 'subscriptionIds: [String]?',
    returns: 'Boolean!',
    path: '/docs/apis#has-active-subscriptions',
  },
  {
    id: 'deeplinktosubscriptions',
    title: 'deepLinkToSubscriptions',
    category: 'Subscription Management',
    description: 'Open native subscription management interface',
    parameters: 'DeepLinkOptions',
    returns: 'Void',
    path: '/docs/apis#deeplink-to-subscriptions',
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
