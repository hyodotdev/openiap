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
        productId: 'dev.hyo.martie.premium',
        state: 'entitled',
        store: 'google',
      },
    }),
  )
  .mockName('verifyPurchaseWithProvider');
let mockOnPurchaseSuccess:
  | ((purchase: Record<string, unknown>) => Promise<void> | void)
  | undefined;

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
        productId: 'dev.hyo.martie.premium',
        state: 'entitled',
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

  it.each([
    {
      label: 'an invalid result',
      result: {
        provider: 'iapkit',
        iapkit: {
          isValid: false,
          productId: 'dev.hyo.martie.premium',
          state: 'expired',
          store: 'google',
        },
      },
    },
    {
      label: 'a mismatched product',
      result: {
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          productId: 'dev.hyo.martie.premium_year',
          state: 'entitled',
          store: 'google',
        },
      },
    },
  ])('does not finish after $label', async ({result}) => {
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      writable: true,
    });
    mockVerifyPurchaseWithProvider.mockResolvedValue(result);
    await renderConnectedSubscriptionFlow();

    await act(async () => {
      await mockOnPurchaseSuccess?.({
        id: 'transaction-rejected-sub-1',
        store: 'google',
        productId: 'dev.hyo.martie.premium',
        purchaseToken: 'rejected-google-token',
        transactionDate: Date.now(),
      });
    });

    expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    expect(mockFinishTransaction).not.toHaveBeenCalled();
  });

  it('verifies a restored subscription and keeps a mismatch unfinished', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      writable: true,
    });
    const restoredPurchase = {
      id: 'restored-subscription-1',
      originalTransactionIdentifierIOS: 'original-subscription-1',
      productId: 'dev.hyo.martie.premium',
      purchaseToken: 'restored-apple-jws',
      store: 'apple',
      transactionDate: Date.now(),
      transactionReasonIOS: 'RENEWAL',
    };
    mockVerifyPurchaseWithProvider.mockResolvedValue({
      iapkit: {
        isValid: true,
        productId: 'dev.hyo.martie.premium_year',
        state: 'entitled',
        store: 'apple',
      },
    });
    mockUseIAP.mockReturnValue({
      connected: true,
      subscriptions: [createMockSubscription()],
      availablePurchases: [restoredPurchase],
      fetchProducts: mockFetchProducts,
      getAvailablePurchases: mockGetAvailablePurchases,
      finishTransaction: mockFinishTransaction,
      getActiveSubscriptions: mockGetActiveSubscriptions,
      activeSubscriptions: [],
      verifyPurchase: mockVerifyPurchase,
      verifyPurchaseWithProvider: mockVerifyPurchaseWithProvider,
    });

    await renderConnectedSubscriptionFlow();

    await waitFor(() => {
      expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    });
    expect(mockFinishTransaction).not.toHaveBeenCalled();
  });

  it('verifies and finishes multiple restored subscriptions sequentially', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      writable: true,
    });
    const restoredSubscriptions = [
      {
        id: 'restored-subscription-monthly',
        originalTransactionIdentifierIOS: 'original-subscription-monthly',
        productId: 'dev.hyo.martie.premium',
        purchaseToken: 'restored-monthly-jws',
        store: 'apple',
        transactionDate: Date.now(),
        transactionReasonIOS: 'RENEWAL',
      },
      {
        id: 'restored-subscription-yearly',
        originalTransactionIdentifierIOS: 'original-subscription-yearly',
        productId: 'dev.hyo.martie.premium_year',
        purchaseToken: 'restored-yearly-jws',
        store: 'apple',
        transactionDate: Date.now() + 1,
        transactionReasonIOS: 'RENEWAL',
      },
    ];
    mockVerifyPurchaseWithProvider.mockImplementation((request) => {
      const token = (request as {iapkit?: {apple?: {jws?: string}}}).iapkit
        ?.apple?.jws;
      return Promise.resolve({
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          productId:
            token === 'restored-yearly-jws'
              ? 'dev.hyo.martie.premium_year'
              : 'dev.hyo.martie.premium',
          state: 'entitled',
          store: 'apple',
        },
      });
    });
    mockUseIAP.mockReturnValue({
      connected: true,
      subscriptions: [createMockSubscription()],
      availablePurchases: restoredSubscriptions,
      fetchProducts: mockFetchProducts,
      getAvailablePurchases: mockGetAvailablePurchases,
      finishTransaction: mockFinishTransaction,
      getActiveSubscriptions: mockGetActiveSubscriptions,
      activeSubscriptions: [],
      verifyPurchase: mockVerifyPurchase,
      verifyPurchaseWithProvider: mockVerifyPurchaseWithProvider,
    });

    await renderConnectedSubscriptionFlow();

    await waitFor(() => {
      expect(mockFinishTransaction).toHaveBeenCalledTimes(2);
    });
    expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(2);
    expect(
      mockVerifyPurchaseWithProvider.mock.invocationCallOrder[0],
    ).toBeLessThan(mockFinishTransaction.mock.invocationCallOrder[0]!);
    expect(mockFinishTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      mockVerifyPurchaseWithProvider.mock.invocationCallOrder[1]!,
    );
    expect(
      mockVerifyPurchaseWithProvider.mock.invocationCallOrder[1],
    ).toBeLessThan(mockFinishTransaction.mock.invocationCallOrder[1]!);
  });

  it('keeps a preclaimed subscription restore queue across a hook rerender', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      writable: true,
    });
    const restoredSubscriptions = [
      {
        id: 'rerender-subscription-monthly',
        originalTransactionIdentifierIOS: 'original-rerender-monthly',
        productId: 'dev.hyo.martie.premium',
        purchaseToken: 'rerender-monthly-jws',
        store: 'apple',
        transactionDate: Date.now(),
        transactionReasonIOS: 'RENEWAL',
      },
      {
        id: 'rerender-subscription-yearly',
        originalTransactionIdentifierIOS: 'original-rerender-yearly',
        productId: 'dev.hyo.martie.premium_year',
        purchaseToken: 'rerender-yearly-jws',
        store: 'apple',
        transactionDate: Date.now() + 1,
        transactionReasonIOS: 'RENEWAL',
      },
    ];
    const firstResult = {
      provider: 'iapkit',
      iapkit: {
        isValid: true,
        productId: 'dev.hyo.martie.premium',
        state: 'entitled',
        store: 'apple',
      },
    };
    let resolveFirst: ((value: typeof firstResult) => void) | undefined;
    const firstVerification = new Promise<typeof firstResult>((resolve) => {
      resolveFirst = resolve;
    });
    mockVerifyPurchaseWithProvider.mockImplementation((request) => {
      const token = (request as {iapkit?: {apple?: {jws?: string}}}).iapkit
        ?.apple?.jws;
      if (token === 'rerender-monthly-jws') return firstVerification;
      return Promise.resolve({
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          productId: 'dev.hyo.martie.premium_year',
          state: 'entitled',
          store: 'apple',
        },
      });
    });
    const hookValue = {
      connected: true,
      subscriptions: [createMockSubscription()],
      availablePurchases: restoredSubscriptions,
      fetchProducts: mockFetchProducts,
      getAvailablePurchases: mockGetAvailablePurchases,
      finishTransaction: mockFinishTransaction,
      getActiveSubscriptions: mockGetActiveSubscriptions,
      activeSubscriptions: [],
      verifyPurchase: mockVerifyPurchase,
      verifyPurchaseWithProvider: mockVerifyPurchaseWithProvider,
    };
    mockUseIAP.mockReturnValue(hookValue);

    const {rerender} = await renderConnectedSubscriptionFlow();
    await waitFor(() => {
      expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    });

    mockUseIAP.mockReturnValue({
      ...hookValue,
      availablePurchases: restoredSubscriptions.map((purchase) => ({
        ...purchase,
      })),
    });
    await rerender(<SubscriptionFlow />);
    expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(1);

    if (!resolveFirst) throw new Error('first verification was not pending');
    await act(async () => {
      resolveFirst?.(firstResult);
    });
    await waitFor(() => {
      expect(mockFinishTransaction).toHaveBeenCalledTimes(2);
    });
    expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(2);
    expect(mockFinishTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      mockVerifyPurchaseWithProvider.mock.invocationCallOrder[1]!,
    );
  });

  it('keeps an in-flight restored subscription deduped across reconnect', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      writable: true,
    });
    const restoredSubscription = {
      id: 'reconnect-subscription-monthly',
      originalTransactionIdentifierIOS: 'original-reconnect-monthly',
      productId: 'dev.hyo.martie.premium',
      purchaseToken: 'reconnect-monthly-jws',
      store: 'apple',
      transactionDate: Date.now(),
      transactionReasonIOS: 'RENEWAL',
    };
    const result = {
      provider: 'iapkit',
      iapkit: {
        isValid: true,
        productId: 'dev.hyo.martie.premium',
        state: 'entitled',
        store: 'apple',
      },
    };
    let resolveVerification: ((value: typeof result) => void) | undefined;
    mockVerifyPurchaseWithProvider.mockImplementation(
      () =>
        new Promise<typeof result>((resolve) => {
          resolveVerification = resolve;
        }),
    );
    const hookValue = {
      connected: true,
      subscriptions: [createMockSubscription()],
      availablePurchases: [restoredSubscription],
      fetchProducts: mockFetchProducts,
      getAvailablePurchases: mockGetAvailablePurchases,
      finishTransaction: mockFinishTransaction,
      getActiveSubscriptions: mockGetActiveSubscriptions,
      activeSubscriptions: [],
      verifyPurchase: mockVerifyPurchase,
      verifyPurchaseWithProvider: mockVerifyPurchaseWithProvider,
    };
    mockUseIAP.mockReturnValue(hookValue);

    const {rerender} = await renderConnectedSubscriptionFlow();
    await waitFor(() => {
      expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    });

    mockUseIAP.mockReturnValue({
      ...hookValue,
      connected: false,
      availablePurchases: [],
    });
    await rerender(<SubscriptionFlow />);
    mockUseIAP.mockReturnValue({
      ...hookValue,
      availablePurchases: [{...restoredSubscription}],
    });
    await rerender(<SubscriptionFlow />);

    if (!resolveVerification) {
      throw new Error('restored subscription verification was not pending');
    }
    await act(async () => {
      resolveVerification?.(result);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => {
      expect(mockFinishTransaction).toHaveBeenCalledTimes(1);
    });
    expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    expect(mockFinishTransaction).toHaveBeenCalledTimes(1);
  });

  it('does not duplicate verification or finish across a remount while finish is pending', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      writable: true,
    });
    const purchase = {
      id: 'remount-subscription-pending-finish',
      originalTransactionIdentifierIOS: 'remount-subscription-original',
      productId: 'dev.hyo.martie.premium',
      purchaseToken: 'remount-subscription-pending-finish-jws',
      store: 'apple',
      transactionDate: Date.now(),
      transactionReasonIOS: 'PURCHASE',
    };
    let resolveFinish: (() => void) | undefined;
    mockFinishTransaction.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFinish = resolve;
        }),
    );
    mockVerifyPurchaseWithProvider.mockResolvedValue({
      iapkit: {
        isValid: true,
        productId: 'dev.hyo.martie.premium',
        state: 'entitled',
        store: 'apple',
      },
    });
    const hookValue = {
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
    };
    mockUseIAP.mockReturnValue(hookValue);

    const firstMount = await render(<SubscriptionFlow />);
    const firstPurchaseSuccessHandler = mockOnPurchaseSuccess;
    if (!firstPurchaseSuccessHandler) {
      throw new Error('purchase success handler was not registered');
    }

    let processingPromise: Promise<void> | undefined;
    await act(async () => {
      processingPromise = Promise.resolve(
        firstPurchaseSuccessHandler(purchase),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    expect(mockFinishTransaction).toHaveBeenCalledTimes(1);
    await firstMount.unmount();

    mockUseIAP.mockReturnValue({
      ...hookValue,
      availablePurchases: [{...purchase}],
    });
    const secondMount = await render(<SubscriptionFlow />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    expect(mockFinishTransaction).toHaveBeenCalledTimes(1);

    if (!resolveFinish || !processingPromise) {
      throw new Error('pending finish was not initialized');
    }
    await act(async () => {
      resolveFinish?.();
      await processingPromise;
      await Promise.resolve();
    });

    const remountedPurchaseSuccessHandler = mockOnPurchaseSuccess;
    if (!remountedPurchaseSuccessHandler) {
      throw new Error('remounted purchase success handler was not registered');
    }
    await act(async () => {
      await remountedPurchaseSuccessHandler({...purchase});
    });

    expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    expect(mockFinishTransaction).toHaveBeenCalledTimes(1);
    await secondMount.unmount();
  });

  it('serializes two overlapping live subscription callbacks', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      writable: true,
    });
    const purchases = [
      {
        id: 'live-subscription-monthly',
        originalTransactionIdentifierIOS: 'live-original-monthly',
        productId: 'dev.hyo.martie.premium',
        purchaseToken: 'live-monthly-jws',
        store: 'apple',
        transactionDate: Date.now(),
        transactionReasonIOS: 'PURCHASE',
      },
      {
        id: 'live-subscription-yearly',
        originalTransactionIdentifierIOS: 'live-original-yearly',
        productId: 'dev.hyo.martie.premium_year',
        purchaseToken: 'live-yearly-jws',
        store: 'apple',
        transactionDate: Date.now() + 1,
        transactionReasonIOS: 'PURCHASE',
      },
    ];
    const firstResult = {
      provider: 'iapkit',
      iapkit: {
        isValid: true,
        productId: 'dev.hyo.martie.premium',
        state: 'entitled',
        store: 'apple',
      },
    };
    let resolveFirst: ((value: typeof firstResult) => void) | undefined;
    const firstVerification = new Promise<typeof firstResult>((resolve) => {
      resolveFirst = resolve;
    });
    mockVerifyPurchaseWithProvider.mockImplementation((request) => {
      const token = (request as {iapkit?: {apple?: {jws?: string}}}).iapkit
        ?.apple?.jws;
      if (token === 'live-monthly-jws') return firstVerification;
      return Promise.resolve({
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          productId: 'dev.hyo.martie.premium_year',
          state: 'entitled',
          store: 'apple',
        },
      });
    });
    await renderConnectedSubscriptionFlow();
    if (!mockOnPurchaseSuccess) {
      throw new Error('purchase success handler was not registered');
    }

    const firstCallback = mockOnPurchaseSuccess(purchases[0]!);
    const secondCallback = mockOnPurchaseSuccess(purchases[1]!);
    await waitFor(() => {
      expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    });
    expect(mockFinishTransaction).not.toHaveBeenCalled();

    if (!resolveFirst) throw new Error('first verification was not pending');
    await act(async () => {
      resolveFirst?.(firstResult);
      await Promise.all([firstCallback, secondCallback]);
    });

    expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(2);
    expect(mockFinishTransaction).toHaveBeenCalledTimes(2);
    expect(mockFinishTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      mockVerifyPurchaseWithProvider.mock.invocationCallOrder[1]!,
    );
  });
});
