/* eslint-env jest */

// React Native Testing Library includes its Jest matchers.

// Mock expo modules
jest.mock('expo-font', () => ({
  loadAsync: jest.fn(),
  isLoaded: jest.fn(() => true),
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

// Stub Animated.timing to avoid TouchableOpacity animation errors.
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');

  RN.Animated.timing = () => ({
    start: (callback) => callback && callback({finished: true}),
    stop: jest.fn(),
    reset: jest.fn(),
  });

  return RN;
});

// Mock expo-modules-core
jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn(() => ({})),
  EventEmitter: jest.fn(),
}));

// Mock the expo-iap module
jest.mock('expo-iap', () => {
  // Create stable mock functions inside the factory
  const mockFetchProducts = jest.fn();
  const mockGetAvailablePurchases = jest.fn();
  const mockFinishTransaction = jest.fn();
  const mockGetActiveSubscriptions = jest.fn();
  const mockRequestPurchase = jest.fn(() => Promise.resolve());

  return {
    getUserFriendlyErrorMessage: jest.requireActual('../src/utils/errorMapping')
      .getUserFriendlyErrorMessage,
    // Core functions
    initConnection: jest.fn(),
    endConnection: jest.fn(),
    fetchProducts: mockFetchProducts,

    requestPurchase: mockRequestPurchase,
    finishTransaction: mockFinishTransaction,

    getAvailablePurchases: mockGetAvailablePurchases,
    verifyPurchase: jest.fn(() => Promise.resolve({})),
    verifyPurchaseWithProvider: jest.fn(() =>
      Promise.resolve({
        iapkit: {
          isValid: true,
          state: 'purchased',
          store: 'amazon',
        },
      }),
    ),

    // iOS functions with IOS suffix
    syncIOS: jest.fn(),
    isEligibleForIntroOfferIOS: jest.fn(),
    subscriptionStatusIOS: jest.fn(),
    currentEntitlementIOS: jest.fn(),
    latestTransactionIOS: jest.fn(),
    beginRefundRequestIOS: jest.fn(),
    showManageSubscriptionsIOS: jest.fn(),
    getReceiptDataIOS: jest.fn(),
    isTransactionVerifiedIOS: jest.fn(),
    getTransactionJwsIOS: jest.fn(),
    presentExternalPurchaseLinkIOS: jest.fn(() =>
      Promise.resolve({success: true}),
    ),
    getAppTransactionIOS: jest.fn(),

    // Cross-platform storefront helper
    getStorefront: jest.fn(),
    deepLinkToSubscriptions: jest.fn(() => Promise.resolve(true)),
    openRedeemOfferCode: jest.fn(() => Promise.resolve(null)),

    // Android functions
    deepLinkToSubscriptionsAndroid: jest.fn(),
    acknowledgePurchaseAndroid: jest.fn(),
    isBillingProgramAvailableAndroid: jest.fn(),
    launchExternalLinkAndroid: jest.fn(),
    createBillingProgramReportingDetailsAndroid: jest.fn(),

    // Event listeners
    purchaseUpdatedListener: jest.fn(),
    purchaseErrorListener: jest.fn(),

    // Hook
    useIAP: jest.fn(() => ({
      connected: false,
      products: [],
      subscriptions: [],
      availablePurchases: [],
      activeSubscriptions: [],
      currentPurchase: null,
      currentPurchaseError: null,
      fetchProducts: mockFetchProducts,

      requestPurchase: mockRequestPurchase,
      getAvailablePurchases: mockGetAvailablePurchases,
      finishTransaction: mockFinishTransaction,
      getActiveSubscriptions: mockGetActiveSubscriptions,
      verifyPurchase: jest.fn(() => Promise.resolve({})),
      verifyPurchaseWithProvider: jest.fn(() =>
        Promise.resolve({
          iapkit: {
            isValid: true,
            state: 'purchased',
            store: 'amazon',
          },
        }),
      ),
    })),

    // Enums
    OpenIapEvent: {
      PurchaseUpdated: 'purchase-updated',
      PurchaseError: 'purchase-error',
    },
    ErrorCode: jest.requireActual('../src/types').ErrorCode,

    // Type guards
    isProductIOS: jest.fn(),
    isProductAndroid: jest.fn(),

    // Mock types
    AppTransaction: {},

    // Debug utility
    ExpoIapConsole: {
      log: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  };
});
