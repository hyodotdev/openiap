import React from 'react';
import {act, render, fireEvent, waitFor} from '@testing-library/react-native';
import {Alert, Platform} from 'react-native';

const mockShowActionSheetWithOptions = jest.fn();

jest.mock('@expo/react-native-action-sheet', () => ({
  useActionSheet: () => ({
    showActionSheetWithOptions: mockShowActionSheetWithOptions,
  }),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      iapkitApiKey: 'test-api-key',
      iapkitBaseUrl: 'http://192.168.0.10:3100',
    },
  },
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

// Mock the functions
const mockInitConnection = jest.fn().mockResolvedValue(true);
const mockFetchProducts = jest.fn();
const mockRequestPurchase = jest.fn().mockResolvedValue(undefined);
const mockFinishTransaction = jest.fn();
const mockGetActiveSubscriptions = jest.fn();
const mockGetAvailablePurchases = jest.fn().mockResolvedValue([]);
const mockVerifyPurchase = jest.fn().mockResolvedValue({});
const mockVerifyPurchaseWithProvider = jest
  .fn((_request: unknown) =>
    Promise.resolve({
      iapkit: {
        isValid: true,
        state: 'purchased',
        store: 'google',
      },
    }),
  )
  .mockName('verifyPurchaseWithProvider');
let mockOnPurchaseSuccess:
  ((purchase: Record<string, unknown>) => Promise<void> | void) | undefined;

const createMockSubscription = (overrides = {}) => ({
  id: 'dev.hyo.martie.premium',
  title: 'Test Subscription',
  description: 'Test Description',
  price: '$9.99',
  displayPrice: '$9.99',
  currency: 'USD',
  type: 'subs',
  platform: 'ios',
  subscriptionOffers: [
    {
      id: 'intro',
      paymentMode: 'free-trial',
      periodCount: 7,
      period: {value: 1, unit: 'day'},
      displayPrice: 'Free',
      price: 0,
      currency: 'USD',
      type: 'introductory',
    },
  ],
  ...overrides,
});

const createMockAndroidSubscription = () => ({
  id: 'dev.hyo.martie.premium',
  title: 'Android Subscription',
  description: 'Android Test Description',
  displayPrice: '$4.99',
  type: 'subs',
  platform: 'android',
  subscriptionOffers: [
    {
      id: 'base-plan',
      displayPrice: '$4.99',
      price: 4.99,
      currency: 'USD',
      type: 'introductory',
      paymentMode: 'pay-as-you-go',
      offerTokenAndroid: 'offer123',
      pricingPhasesAndroid: {
        pricingPhaseList: [
          {
            formattedPrice: '$4.99',
            billingPeriod: 'P1M',
          },
        ],
      },
    },
  ],
});

const mockUseIAP = jest.fn();
jest.mock('../../src', () => ({
  initConnection: mockInitConnection,
  requestPurchase: mockRequestPurchase,
  useIAP: (options?: {onPurchaseSuccess?: typeof mockOnPurchaseSuccess}) => {
    mockOnPurchaseSuccess = options?.onPurchaseSuccess;
    return mockUseIAP();
  },
}));

const SubscriptionFlow = require('../app/subscription-flow').default;

async function renderConnectedSubscriptionFlow() {
  const result = await render(<SubscriptionFlow />);
  await waitFor(() => expect(mockGetActiveSubscriptions).toHaveBeenCalled());
  return result;
}

describe('SubscriptionFlow Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShowActionSheetWithOptions.mockReset();
    mockFetchProducts.mockResolvedValue([createMockSubscription()]);
    mockGetActiveSubscriptions.mockResolvedValue([]);
    mockFinishTransaction.mockResolvedValue(undefined);
    mockGetAvailablePurchases.mockResolvedValue([]);
    mockVerifyPurchase.mockResolvedValue({});
    mockVerifyPurchaseWithProvider.mockResolvedValue({
      iapkit: {
        isValid: true,
        state: 'purchased',
        store: 'google',
      },
    });
    mockOnPurchaseSuccess = undefined;

    // Default mock implementation
    mockUseIAP.mockReturnValue({
      connected: true,
      subscriptions: [createMockSubscription()],
      availablePurchases: [],
      fetchProducts: mockFetchProducts,
      getAvailablePurchases: mockGetAvailablePurchases,
      finishTransaction: mockFinishTransaction,
      getActiveSubscriptions: mockGetActiveSubscriptions,
      activeSubscriptions: [],
      verifyPurchase: mockVerifyPurchase,
      verifyPurchaseWithProvider: mockVerifyPurchaseWithProvider,
    });
  });

  it('should render without crashing', async () => {
    const {getByText} = await renderConnectedSubscriptionFlow();
    expect(getByText('Subscription Flow')).toBeDefined();
    expect(getByText('Local (IAPKit)')).toBeDefined();
  });

  it('shows verification choices in the requested order', async () => {
    const {getByText} = await renderConnectedSubscriptionFlow();

    await fireEvent.press(getByText('Local (IAPKit)'));

    expect(mockShowActionSheetWithOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
          'Local (Device)',
          'Local (IAPKit)',
          'IAPKit',
          'None (Skip)',
          'Cancel',
        ],
        cancelButtonIndex: 4,
      }),
      expect.any(Function),
    );
  });

  it('should show connected status', async () => {
    const {getByText} = await renderConnectedSubscriptionFlow();
    // Look for the text that contains "Connected"
    expect(getByText(/✅ Connected/)).toBeDefined();
  });

  it('should display subscriptions', async () => {
    const {getByText} = await renderConnectedSubscriptionFlow();
    expect(getByText('Test Subscription')).toBeDefined();
    // The subscription might show different price format
    expect(getByText('Test Description')).toBeDefined();
  });

  it('should handle subscribe button click', async () => {
    const {getByText} = await renderConnectedSubscriptionFlow();
    const subscribeButton = getByText('Subscribe');

    await fireEvent.press(subscribeButton);

    // The actual implementation triggers product fetch on mount
    expect(mockFetchProducts).toHaveBeenCalled();
  });

  it('should call fetchProducts on mount', async () => {
    await renderConnectedSubscriptionFlow();
    expect(mockFetchProducts).toHaveBeenCalled();
  });

  it('should display active subscriptions when available', async () => {
    const activeSubscription = {
      productId: 'dev.hyo.martie.premium',
      isActive: true,
      expirationDateIOS: new Date(Date.now() + 86400000),
      environmentIOS: 'Production',
      daysUntilExpirationIOS: 1,
    };

    mockUseIAP.mockReturnValue({
      connected: true,
      subscriptions: [createMockSubscription()],
      availablePurchases: [],
      fetchProducts: mockFetchProducts,
      getAvailablePurchases: mockGetAvailablePurchases,
      finishTransaction: mockFinishTransaction,
      getActiveSubscriptions: mockGetActiveSubscriptions,
      activeSubscriptions: [activeSubscription],
    });

    const {getByText} = await renderConnectedSubscriptionFlow();
    expect(getByText('Current Subscription Status')).toBeDefined();
    expect(getByText('✅ Active')).toBeDefined();
    expect(getByText('dev.hyo.martie.premium')).toBeDefined();
  });

  it('should show expiration warning for soon-to-expire subscriptions', async () => {
    const expiringSubscription = {
      productId: 'dev.hyo.martie.premium',
      isActive: true,
      expirationDateIOS: new Date(Date.now() + 86400000),
      daysUntilExpirationIOS: 3,
    };

    mockUseIAP.mockReturnValue({
      connected: true,
      subscriptions: [createMockSubscription()],
      availablePurchases: [],
      fetchProducts: mockFetchProducts,
      getAvailablePurchases: mockGetAvailablePurchases,
      finishTransaction: mockFinishTransaction,
      getActiveSubscriptions: mockGetActiveSubscriptions,
      activeSubscriptions: [expiringSubscription],
    });

    const {getByText} = await renderConnectedSubscriptionFlow();
    expect(getByText(/Your subscription will expire soon/)).toBeDefined();
    expect(getByText(/3 days remaining/)).toBeDefined();
  });

  it('should handle Android subscriptions correctly', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      writable: true,
    });

    const androidActiveSubscription = {
      productId: 'dev.hyo.martie.premium',
      isActive: true,
      autoRenewingAndroid: false,
    };

    mockUseIAP.mockReturnValue({
      connected: true,
      subscriptions: [createMockAndroidSubscription()],
      availablePurchases: [],
      fetchProducts: mockFetchProducts,
      getAvailablePurchases: mockGetAvailablePurchases,
      finishTransaction: mockFinishTransaction,
      getActiveSubscriptions: mockGetActiveSubscriptions,
      activeSubscriptions: [androidActiveSubscription],
    });

    const {getByText} = await renderConnectedSubscriptionFlow();
    expect(getByText('⚠️ Cancelled')).toBeDefined();
    expect(getByText(/Your subscription will not auto-renew/)).toBeDefined();
  });

  it('should show active subscription status section', async () => {
    mockUseIAP.mockReturnValue({
      connected: true,
      subscriptions: [createMockSubscription()],
      availablePurchases: [],
      fetchProducts: mockFetchProducts,
      getAvailablePurchases: mockGetAvailablePurchases,
      finishTransaction: mockFinishTransaction,
      getActiveSubscriptions: mockGetActiveSubscriptions,
      activeSubscriptions: [
        {
          productId: 'dev.hyo.martie.premium',
          isActive: true,
          expirationDateIOS: new Date(Date.now() + 86400000),
        },
      ],
    });

    const {getByText} = await renderConnectedSubscriptionFlow();
    // The status section should be present when there are active subscriptions
    expect(getByText('Current Subscription Status')).toBeDefined();
    expect(getByText('✅ Active')).toBeDefined();
  });

  it('should show no subscriptions message when empty', async () => {
    mockUseIAP.mockReturnValue({
      connected: true,
      subscriptions: [],
      availablePurchases: [],
      fetchProducts: mockFetchProducts,
      getAvailablePurchases: mockGetAvailablePurchases,
      finishTransaction: mockFinishTransaction,
      getActiveSubscriptions: mockGetActiveSubscriptions,
      activeSubscriptions: [],
    });

    const {getByText} = await render(<SubscriptionFlow />);
    expect(getByText(/No subscriptions found/)).toBeDefined();
    expect(getByText('Retry')).toBeDefined();
  });

  it('should handle retry button click', async () => {
    mockUseIAP.mockReturnValue({
      connected: true,
      subscriptions: [],
      availablePurchases: [],
      fetchProducts: mockFetchProducts,
      getAvailablePurchases: mockGetAvailablePurchases,
      finishTransaction: mockFinishTransaction,
      getActiveSubscriptions: mockGetActiveSubscriptions,
      activeSubscriptions: [],
    });

    const {getByText} = await render(<SubscriptionFlow />);
    const retryButton = getByText('Retry');

    await fireEvent.press(retryButton);
    expect(mockFetchProducts).toHaveBeenCalledWith({
      skus: ['dev.hyo.martie.premium', 'dev.hyo.martie.premium_year'],
      type: 'subs',
    });
  });

  it('should show disconnected status when not connected', async () => {
    mockUseIAP.mockReturnValue({
      connected: false,
      subscriptions: [],
      availablePurchases: [],
      fetchProducts: mockFetchProducts,
      getAvailablePurchases: mockGetAvailablePurchases,
      finishTransaction: mockFinishTransaction,
      getActiveSubscriptions: mockGetActiveSubscriptions,
      activeSubscriptions: [],
    });

    const {getByText} = await render(<SubscriptionFlow />);
    // Check for disconnected in the status text
    expect(getByText(/Disconnected/)).toBeDefined();
    expect(getByText('Connecting to store...')).toBeDefined();
  });

  it('should display introductory offer for iOS', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      writable: true,
    });
    const {getByText} = await renderConnectedSubscriptionFlow();
    expect(getByText('7 day(s) free trial')).toBeDefined();
  });

  it('should have subscribe button for each subscription', async () => {
    mockUseIAP.mockReturnValue({
      connected: true,
      subscriptions: [createMockSubscription()],
      availablePurchases: [],
      fetchProducts: mockFetchProducts,
      getAvailablePurchases: mockGetAvailablePurchases,
      finishTransaction: mockFinishTransaction,
      getActiveSubscriptions: mockGetActiveSubscriptions,
      activeSubscriptions: [],
    });

    const {getByText} = await renderConnectedSubscriptionFlow();
    const subscribeButton = getByText('Subscribe');

    // Test that the button exists
    expect(subscribeButton).toBeDefined();
  });

  it('should show check status link when no active subscriptions', async () => {
    mockUseIAP.mockReturnValue({
      connected: true,
      subscriptions: [createMockSubscription()],
      availablePurchases: [],
      fetchProducts: mockFetchProducts,
      getAvailablePurchases: mockGetAvailablePurchases,
      finishTransaction: mockFinishTransaction,
      getActiveSubscriptions: mockGetActiveSubscriptions,
      activeSubscriptions: [],
    });

    const {getByText} = await renderConnectedSubscriptionFlow();

    // When there are no active subscriptions but connected, show check status link
    expect(getByText('Check Status')).toBeDefined();
  });

  it('re-verifies the Android IAPKit snapshot after finishing', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      writable: true,
    });

    await renderConnectedSubscriptionFlow();

    await act(async () => {
      await mockOnPurchaseSuccess?.({
        id: 'transaction-android-1',
        store: 'google',
        productId: 'dev.hyo.martie.premium',
        purchaseToken: 'android-token',
        transactionDate: Date.now(),
      });
    });

    expect(mockFinishTransaction).toHaveBeenCalledTimes(1);
    expect(mockVerifyPurchase).not.toHaveBeenCalled();
    expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(2);
    expect(mockVerifyPurchaseWithProvider.mock.calls[0]?.[0]).toEqual({
      provider: 'iapkit',
      iapkit: {
        apiKey: 'test-api-key',
        baseUrl: 'http://192.168.0.10:3100',
        google: {purchaseToken: 'android-token'},
      },
    });
    expect(mockVerifyPurchaseWithProvider.mock.calls[1]?.[0]).toEqual(
      mockVerifyPurchaseWithProvider.mock.calls[0]?.[0],
    );
    expect(
      mockVerifyPurchaseWithProvider.mock.invocationCallOrder[0],
    ).toBeLessThan(mockFinishTransaction.mock.invocationCallOrder[0]!);
    expect(mockFinishTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      mockVerifyPurchaseWithProvider.mock.invocationCallOrder[1]!,
    );
  });

  it('keeps Local (Device) subscription verification direct', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      writable: true,
    });
    mockShowActionSheetWithOptions.mockImplementation(
      (_options: unknown, callback: (index?: number) => void) => callback(0),
    );
    const {getByText} = await renderConnectedSubscriptionFlow();

    await fireEvent.press(getByText('Local (IAPKit)'));
    await waitFor(() => {
      expect(getByText('Local (Device)')).toBeDefined();
    });

    await act(async () => {
      await mockOnPurchaseSuccess?.({
        id: 'transaction-device-sub-1',
        store: 'apple',
        productId: 'dev.hyo.martie.premium',
        purchaseToken: 'device-sub-jws',
        transactionDate: Date.now(),
      });
    });

    expect(mockVerifyPurchase).toHaveBeenCalledWith({
      apple: {sku: 'dev.hyo.martie.premium'},
      google: {
        sku: 'dev.hyo.martie.premium',
        packageName: 'dev.hyo.martie',
        purchaseToken: 'device-sub-jws',
        accessToken: '',
        isSub: true,
      },
    });
    expect(mockVerifyPurchaseWithProvider).not.toHaveBeenCalled();
    expect(mockVerifyPurchase.mock.invocationCallOrder[0]).toBeLessThan(
      mockFinishTransaction.mock.invocationCallOrder[0]!,
    );
  });
});
