import React from 'react';
import {
  act,
  render,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react-native';
import {ErrorCode} from '../../src/types';
import type {
  ExpoPurchaseError,
  Purchase,
  PurchaseFlowStatus,
  UseIAPOptions,
} from '../../src';
import {Alert, Platform} from 'react-native';
import {getReceiptPurchaseFlow} from '../src/utils/purchaseFlow';

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
const mockFetchProducts = jest.fn();
const mockRequestPurchase = jest.fn().mockResolvedValue(undefined);
const mockGetActiveSubscriptions = jest.fn();
const mockGetAvailablePurchases = jest.fn().mockResolvedValue([]);
let mockOptions: UseIAPOptions | undefined;

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
  ...jest.requireActual('../../src/purchase-flow'),
  ErrorCode: jest.requireActual('../../src/types').ErrorCode,
  createPurchaseFlow: jest.fn(() => ({
    processPurchase: jest.fn(),
    recoverPurchases: jest.fn(() => Promise.resolve([])),
    subscribe: jest.fn(() => jest.fn()),
    dispose: jest.fn(),
  })),
  // The module loads at import, before these mocks are initialized.
  requestPurchase: (...args: unknown[]) => mockRequestPurchase(...args),
  useIAP: (options?: UseIAPOptions) => {
    mockOptions = options;
    return mockUseIAP();
  },
}));

const SubscriptionFlow = jest.requireActual<
  typeof import('../app/subscription-flow')
>('../app/subscription-flow').default;

const premium: Purchase = {
  id: 'transaction-1',
  productId: 'dev.hyo.martie.premium',
  purchaseToken: 'token',
  purchaseState: 'purchased',
  quantity: 1,
  isAutoRenewing: true,
  transactionDate: 1,
  store: 'google',
  storeId: 'play',
};

const planChange =
  'Plan change to dev.hyo.martie.premium_year is pending. ' +
  'dev.hyo.martie.premium stays active until it applies.';

async function renderConnectedSubscriptionFlow() {
  const result = await render(<SubscriptionFlow />);
  await waitFor(() => expect(mockGetActiveSubscriptions).toHaveBeenCalled());
  return result;
}

async function report(
  purchase: Purchase,
  status: PurchaseFlowStatus,
): Promise<void> {
  await act(async () => {
    mockOptions?.onPurchaseFlowOutcome?.({purchase, status});
  });
}

describe('SubscriptionFlow Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShowActionSheetWithOptions.mockReset();
    mockFetchProducts.mockResolvedValue([createMockSubscription()]);
    mockGetActiveSubscriptions.mockResolvedValue([]);
    mockGetAvailablePurchases.mockResolvedValue([]);
    mockOptions = undefined;

    // Default mock implementation
    mockUseIAP.mockReturnValue({
      connected: true,
      subscriptions: [createMockSubscription()],
      availablePurchases: [],
      fetchProducts: mockFetchProducts,
      getAvailablePurchases: mockGetAvailablePurchases,
      getActiveSubscriptions: mockGetActiveSubscriptions,
      activeSubscriptions: [],
    });
  });

  it('offers the same backend confirmation path for subscription products', async () => {
    process.env.EXPO_PUBLIC_APP_BACKEND_URL = 'https://backend.example';
    try {
      const screen = await renderConnectedSubscriptionFlow();
      await fireEvent.press(
        screen.getByRole('button', {name: 'Change purchase confirmation'}),
      );
      const callback = mockShowActionSheetWithOptions.mock.calls.at(-1)?.[1];
      await act(() => callback(1));
      expect(await screen.findByText('Restore purchases')).toBeDefined();
      expect(screen.getByText('Subscriptions')).toBeDefined();
      expect(screen.queryByText('Products')).toBeNull();
      expect(screen.queryByText('Subscription Flow')).toBeNull();
      expect(mockFetchProducts).toHaveBeenLastCalledWith({
        skus: ['dev.hyo.martie.premium', 'dev.hyo.martie.premium_year'],
        type: 'subs',
      });
    } finally {
      delete process.env.EXPO_PUBLIC_APP_BACKEND_URL;
    }
  });

  it.each(['listener', 'promise'] as const)(
    'keeps a deferred subscription pending from the %s path',
    async (path) => {
      const error: ExpoPurchaseError = {
        name: 'PurchaseError',
        code: ErrorCode.DeferredPayment,
        message: 'Awaiting approval',
        productId: 'dev.hyo.martie.premium',
      };
      if (path === 'promise') mockRequestPurchase.mockRejectedValueOnce(error);
      const screen = await renderConnectedSubscriptionFlow();
      await fireEvent.press(
        screen.getByRole('button', {name: 'Show purchase steps'}),
      );
      await fireEvent.press(screen.getByText('Subscribe'));
      if (path === 'listener')
        await act(() => mockOptions?.onPurchaseError?.(error));
      expect(
        (await screen.findAllByText('Payment is pending at the store.')).length,
      ).toBeGreaterThan(0);
      expect(
        within(screen.getByTestId('purchase-step-store')).getByText('Waiting'),
      ).toBeDefined();
      expect(screen.queryByText(/Subscription failed:/)).toBeNull();
    },
  );

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

  it.each([0, 1, 2, undefined])(
    'submits only the selected Google plan, or cancels (%s)',
    async (selection) => {
      const subscription = createMockAndroidSubscription();
      const offers = [
        {
          ...subscription.subscriptionOffers[0],
          basePlanIdAndroid: 'prepaid',
          offerTokenAndroid: 'prepaid-token',
          pricingPhasesAndroid: {
            pricingPhaseList: [
              {
                formattedPrice: '$4.99',
                billingPeriod: 'P1M',
                recurrenceMode: 3,
              },
            ],
          },
        },
        {
          ...subscription.subscriptionOffers[0],
          basePlanIdAndroid: 'monthly',
          offerTokenAndroid: 'renewing-token',
          pricingPhasesAndroid: {
            pricingPhaseList: [
              {
                formattedPrice: '$5.99',
                billingPeriod: 'P1M',
                recurrenceMode: 1,
              },
            ],
          },
        },
      ];
      mockUseIAP.mockReturnValue({
        ...mockUseIAP(),
        subscriptions: [{...subscription, subscriptionOffers: offers}],
      });
      const {getByText} = await renderConnectedSubscriptionFlow();
      await fireEvent.press(getByText('Subscribe'));
      expect(mockRequestPurchase).not.toHaveBeenCalled();
      expect(mockShowActionSheetWithOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          options: [
            'prepaid · Prepaid · $4.99 / P1M',
            'monthly · Auto-renewing · $5.99 / P1M',
            'Cancel',
          ],
          cancelButtonIndex: 2,
        }),
        expect.any(Function),
      );
      await act(async () => {
        mockShowActionSheetWithOptions.mock.calls[0][1](selection);
      });
      if (selection === 0 || selection === 1) {
        expect(mockRequestPurchase).toHaveBeenCalledTimes(1);
        expect(mockRequestPurchase).toHaveBeenCalledWith({
          type: 'subs',
          request: {
            apple: {sku: subscription.id},
            google: {
              skus: [subscription.id],
              subscriptionOffers: [
                {
                  sku: subscription.id,
                  offerToken: offers[selection].offerTokenAndroid,
                },
              ],
            },
          },
        });
      } else {
        expect(mockRequestPurchase).not.toHaveBeenCalled();
        expect(
          getByText('Subscription plan selection canceled.'),
        ).toBeDefined();
        expect(getByText('Subscribe')).toBeDefined();
      }
    },
  );

  it('shows the iOS base price and billing period instead of a discount', async () => {
    mockUseIAP.mockReturnValue({
      ...mockUseIAP(),
      subscriptions: [
        createMockSubscription({
          displayPrice: '$99.99',
          subscriptionPeriodNumberIOS: '1',
          subscriptionPeriodUnitIOS: 'year',
        }),
      ],
    });
    const {getByText, queryByText} = await renderConnectedSubscriptionFlow();
    expect(getByText('$99.99')).toBeDefined();
    expect(getByText('per 1 year')).toBeDefined();
    expect(queryByText('Free')).toBeNull();
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
      getActiveSubscriptions: mockGetActiveSubscriptions,
      activeSubscriptions: [activeSubscription],
    });

    const {getByText} = await renderConnectedSubscriptionFlow();
    expect(getByText('Store-reported Subscription Status')).toBeDefined();
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
    expect(getByText('Store-reported Subscription Status')).toBeDefined();
    expect(getByText('✅ Active')).toBeDefined();
  });

  it('displays a restored Amazon yearly term without inventing renewal or completing it', async () => {
    Platform.OS = 'android';
    mockUseIAP.mockReturnValue({
      ...mockUseIAP(),
      activeSubscriptions: [
        {
          productId: 'dev.hyo.martie.premium.base',
          currentPlanId: 'dev.hyo.martie.premium_year',
          isActive: true,
          autoRenewingAndroid: null,
        },
      ],
    });

    const {getByText, queryByText} = await renderConnectedSubscriptionFlow();
    expect(getByText('dev.hyo.martie.premium_year')).toBeDefined();
    expect(getByText('Unknown; check your backend')).toBeDefined();
    expect(queryByText('⚠️ Cancelled')).toBeNull();
  });

  it('should show no subscriptions message when empty', async () => {
    mockUseIAP.mockReturnValue({
      connected: true,
      subscriptions: [],
      availablePurchases: [],
      fetchProducts: mockFetchProducts,
      getAvailablePurchases: mockGetAvailablePurchases,
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
      getActiveSubscriptions: mockGetActiveSubscriptions,
      activeSubscriptions: [],
    });

    const {getByText} = await renderConnectedSubscriptionFlow();

    // When there are no active subscriptions but connected, show check status link
    expect(getByText('Check Status')).toBeDefined();
  });
  it('hands the shared receipt-check flow to useIAP', async () => {
    await renderConnectedSubscriptionFlow();

    expect(mockOptions?.purchaseFlow).toBe(getReceiptPurchaseFlow());
    expect(mockGetAvailablePurchases).toHaveBeenCalledTimes(1);
  });

  it('shows its subscription outcome and releases processing', async () => {
    const screen = await renderConnectedSubscriptionFlow();

    await fireEvent.press(screen.getByText('Subscribe'));
    expect(screen.getByText('Processing...')).toBeTruthy();

    await report(
      {...premium, productId: 'dev.hyo.martie.10bulbs'},
      {status: 'entitled', alreadyGranted: false},
    );
    expect(screen.getByText('Processing...')).toBeTruthy();

    await report(premium, {status: 'entitled', alreadyGranted: false});
    expect(screen.queryByText('Processing...')).toBeNull();
    expect(screen.getByText('Purchase verified. Access granted.')).toBeTruthy();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      'Purchase completed successfully!',
    );
  });

  it('matches an Amazon base-SKU outcome to the requested term', async () => {
    const screen = await renderConnectedSubscriptionFlow();

    await fireEvent.press(screen.getByText('Subscribe'));
    await report(
      {
        ...premium,
        productId: 'dev.hyo.martie.premium.base',
        currentPlanId: 'dev.hyo.martie.premium',
        store: 'amazon',
        storeId: 'amazon',
      },
      {status: 'failed', error: new Error('RVS unavailable')},
    );

    expect(screen.queryByText('Processing...')).toBeNull();
    expect(
      screen.getByText('Purchase verification failed: RVS unavailable'),
    ).toBeTruthy();
  });

  it('shows a pending plan change beside, never instead of, the latest result', async () => {
    mockUseIAP.mockReturnValue({
      ...mockUseIAP(),
      availablePurchases: [
        {
          ...premium,
          pendingPurchaseUpdateAndroid: {
            products: ['dev.hyo.martie.premium_year'],
            purchaseToken: 'pending-token',
          },
        },
      ],
    });
    const screen = await renderConnectedSubscriptionFlow();
    expect(screen.getByText(planChange)).toBeTruthy();

    await report(premium, {
      status: 'entitled',
      alreadyGranted: false,
      changePending: true,
    });
    expect(screen.getByText('Plan change requested.')).toBeTruthy();

    await act(async () => {
      mockOptions?.onPurchaseError?.({
        code: ErrorCode.UserCancelled,
        message: 'Cancelled',
      } as ExpoPurchaseError);
    });
    expect(screen.getByText('Subscription cancelled by user')).toBeTruthy();
    expect(screen.getByText(planChange)).toBeTruthy();

    mockUseIAP.mockReturnValue({
      ...mockUseIAP(),
      availablePurchases: [premium],
    });
    await screen.rerender(<SubscriptionFlow />);
    expect(screen.queryByText(/is pending/)).toBeNull();
  });

  it('ignores a pending change on a product outside this screen', async () => {
    mockUseIAP.mockReturnValue({
      ...mockUseIAP(),
      availablePurchases: [
        {
          ...premium,
          productId: 'other.app.plan',
          pendingPurchaseUpdateAndroid: {
            products: ['other.app.plan_year'],
            purchaseToken: 'pending-token',
          },
        },
      ],
    });
    const screen = await renderConnectedSubscriptionFlow();

    expect(screen.queryByText(/is pending/)).toBeNull();
  });

  it('recovers retained receipts after a verification method is chosen', async () => {
    mockShowActionSheetWithOptions.mockImplementation(
      (_options: unknown, callback: (index: number) => void) => callback(2),
    );
    const screen = await renderConnectedSubscriptionFlow();

    await fireEvent.press(screen.getByText('Local (IAPKit)'));

    expect(screen.getByText('IAPKit')).toBeTruthy();
    expect(getReceiptPurchaseFlow().recoverPurchases).toHaveBeenCalledTimes(1);
  });
});
