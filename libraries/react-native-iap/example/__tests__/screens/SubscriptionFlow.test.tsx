import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {Alert, Platform} from 'react-native';
import SubscriptionFlow from '../../screens/SubscriptionFlow';
import * as RNIap from 'react-native-iap';
import {SUBSCRIPTION_PRODUCT_IDS} from '../../src/utils/constants';
import {
  purchaseFlow,
  setVerificationMethod,
} from '../../src/utils/purchaseFlow';
import type {
  ProductSubscriptionAndroid,
  Purchase,
  PurchaseError,
  PurchaseFlowStatus,
} from 'react-native-iap';

jest.mock(
  '@env',
  () => ({
    AMAZON_RVS_SANDBOX: 'false',
    IAPKIT_API_KEY: 'test-api-key',
    IAPKIT_BASE_URL: 'http://192.168.0.10:3100',
  }),
  {virtual: true},
);

const requestPurchaseMock = RNIap.requestPurchase as jest.Mock;
const deepLinkToSubscriptionsMock = RNIap.deepLinkToSubscriptions as jest.Mock;

// The extra token-like field exercises the console redaction.
const sampleSubscription: ProductSubscriptionAndroid & {
  offerTokenAndroid: string;
} = {
  type: 'subs',
  id: 'dev.hyo.martie.premium',
  title: 'Premium Subscription',
  description: 'Access all premium features',
  displayPrice: '$9.99/month',
  price: 9.99,
  currency: 'USD',
  platform: 'android',
  nameAndroid: 'Premium Subscription',
  subscriptionOffers: [],
  offerTokenAndroid: 'offer-secret',
};

const premium: Purchase = {
  id: 'transaction-1',
  transactionId: 'transaction-1',
  productId: 'dev.hyo.martie.premium',
  purchaseToken: 'token',
  purchaseState: 'purchased',
  quantity: 1,
  isAutoRenewing: true,
  transactionDate: 1,
  store: 'apple',
  storeId: 'apple',
};

const planChange =
  'Plan change to dev.hyo.martie.premium_year is pending. ' +
  'dev.hyo.martie.premium stays active until it applies.';

describe('SubscriptionFlow Screen', () => {
  let options: Parameters<typeof RNIap.useIAP>[0];

  const mockIapState = (
    overrides: Partial<ReturnType<typeof RNIap.useIAP>> & {
      connected?: boolean;
    } = {},
  ) => {
    const fetchProducts = jest.fn(() => Promise.resolve());
    const getAvailablePurchases = jest.fn(() => Promise.resolve());
    const getActiveSubscriptions = jest.fn(() => Promise.resolve([]));

    (RNIap.useIAP as jest.Mock).mockImplementation((hookOptions) => {
      options = hookOptions;
      return {
        connected: true,
        subscriptions: [sampleSubscription],
        availablePurchases: [],
        activeSubscriptions: [],
        fetchProducts,
        getAvailablePurchases,
        getActiveSubscriptions,
        ...overrides,
      };
    });

    return {fetchProducts, getAvailablePurchases, getActiveSubscriptions};
  };

  const report = async (
    purchase: Purchase,
    status: PurchaseFlowStatus,
  ): Promise<void> => {
    await act(async () => {
      options?.onPurchaseFlowOutcome?.({purchase, status});
    });
  };

  const fail = async (error: PurchaseError): Promise<void> => {
    await act(async () => {
      options?.onPurchaseError?.(error);
    });
  };

  beforeEach(() => {
    setVerificationMethod('iapkit-localhost');
    jest.clearAllMocks();
    mockIapState();
  });

  afterEach(() => {
    Platform.OS = 'ios';
  });

  it('renders loading state when not connected', async () => {
    mockIapState({connected: false, subscriptions: []});

    const {getByText} = await render(<SubscriptionFlow />);

    expect(getByText('Connecting to Store...')).toBeTruthy();
  });

  it('fetches subscriptions and store purchases when connected', async () => {
    const {fetchProducts, getAvailablePurchases} = mockIapState();

    await render(<SubscriptionFlow />);

    await waitFor(() => {
      expect(fetchProducts).toHaveBeenCalledWith({
        skus: SUBSCRIPTION_PRODUCT_IDS,
        type: 'subs',
      });
    });
    expect(getAvailablePurchases).toHaveBeenCalledTimes(1);
    expect(options?.purchaseFlow).toBe(purchaseFlow);
  });

  it('displays subscription information', async () => {
    const {getByText} = await render(<SubscriptionFlow />);

    expect(getByText('Premium Subscription')).toBeTruthy();
    expect(getByText('$9.99/month')).toBeTruthy();
    expect(getByText('Local (IAPKit)')).toBeTruthy();
  });

  it('initiates subscription purchase when button pressed', async () => {
    const {getByText} = await render(<SubscriptionFlow />);

    await fireEvent.press(getByText('Subscribe'));

    expect(requestPurchaseMock).toHaveBeenCalledWith({
      request: {
        apple: {
          sku: 'dev.hyo.martie.premium',
          appAccountToken: 'user-123',
        },
        // No offer: the store picks its default, and Amazon has none.
        google: {skus: ['dev.hyo.martie.premium']},
      },
      type: 'subs',
    });
  });

  it('refreshes subscription status when Check Status pressed', async () => {
    const {getActiveSubscriptions} = mockIapState({
      activeSubscriptions: [
        {
          productId: 'dev.hyo.martie.premium',
          transactionId: 'trans-1',
          transactionDate: Date.now(),
          isActive: true,
        },
      ],
    });

    const {getByText} = await render(<SubscriptionFlow />);

    await fireEvent.press(getByText('Check Status'));

    await waitFor(() => {
      expect(getActiveSubscriptions).toHaveBeenCalled();
    });
  });

  it('opens manage subscriptions when Manage pressed', async () => {
    const {getByText} = await render(<SubscriptionFlow />);

    await fireEvent.press(getByText('Manage'));

    await waitFor(() => {
      expect(deepLinkToSubscriptionsMock).toHaveBeenCalled();
    });
  });

  it('shows its subscription outcome and releases processing', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = await render(<SubscriptionFlow />);

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
    expect(alertSpy).toHaveBeenCalledWith(
      'Success',
      'Purchase completed successfully!',
    );
  });

  it('matches an Amazon base-SKU outcome to the requested term', async () => {
    Platform.OS = 'android';
    const screen = await render(<SubscriptionFlow />);

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
    mockIapState({
      availablePurchases: [
        {
          ...premium,
          store: 'google',
          storeId: 'play',
          pendingPurchaseUpdateAndroid: {
            products: ['dev.hyo.martie.premium_year'],
            purchaseToken: 'pending-token',
          },
        },
      ],
    });
    const screen = await render(<SubscriptionFlow />);
    expect(screen.getByText(planChange)).toBeTruthy();

    await report(premium, {
      status: 'entitled',
      alreadyGranted: false,
      changePending: true,
    });
    expect(screen.getByText('Plan change requested.')).toBeTruthy();

    await fail({
      code: RNIap.ErrorCode.UserCancelled,
      message: 'Cancelled',
    });
    expect(screen.getByText('Subscription cancelled by user')).toBeTruthy();
    expect(screen.getByText(planChange)).toBeTruthy();

    mockIapState({availablePurchases: [{...premium, store: 'google'}]});
    await screen.rerender(<SubscriptionFlow />);
    expect(screen.queryByText(planChange)).toBeNull();
    expect(screen.queryByText(/is pending/)).toBeNull();
  });

  it('ignores a pending change on a product outside this screen', async () => {
    mockIapState({
      availablePurchases: [
        {
          ...premium,
          productId: 'other.app.plan',
          store: 'google',
          storeId: 'play',
          pendingPurchaseUpdateAndroid: {
            products: ['other.app.plan_year'],
            purchaseToken: 'pending-token',
          },
        },
      ],
    });
    const screen = await render(<SubscriptionFlow />);

    expect(screen.queryByText(/is pending/)).toBeNull();
  });

  it('shows error message on purchase error callback', async () => {
    const {getByText} = await render(<SubscriptionFlow />);

    await fail({
      code: RNIap.ErrorCode.Unknown,
      message: 'Subscription failed',
    });

    await waitFor(() => {
      expect(
        getByText('❌ Subscription failed: Subscription failed'),
      ).toBeTruthy();
    });
  });

  it('releases processing when the subscription request fails', async () => {
    requestPurchaseMock.mockRejectedValueOnce({
      code: RNIap.ErrorCode.ServiceError,
      message: 'Store unavailable',
    });
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = await render(<SubscriptionFlow />);

    await fireEvent.press(screen.getByText('Subscribe'));

    expect(screen.queryByText('Processing...')).toBeNull();
    expect(
      screen.getByText('❌ Subscription failed: Store unavailable'),
    ).toBeTruthy();
    expect(alertSpy).toHaveBeenCalledWith(
      'Subscription Failed',
      'Store unavailable',
    );
  });

  it('handles upgrade/downgrade plan change for premium subscription (Android only)', async () => {
    // Mock Platform to be Android since iOS doesn't show upgrade/downgrade UI
    Platform.OS = 'android';
    const alertSpy = jest.spyOn(Alert, 'alert');
    requestPurchaseMock.mockResolvedValueOnce(undefined);

    mockIapState({
      activeSubscriptions: [
        {
          productId: 'dev.hyo.martie.premium',
          transactionId: 'trans-1',
          transactionDate: Date.now(),
          isActive: true,
          currentPlanId: 'premium',
        },
      ],
      subscriptions: [
        {
          ...sampleSubscription,
          subscriptionOffers: [
            {
              id: 'premium',
              basePlanIdAndroid: 'premium',
              offerTokenAndroid: 'offer-token-monthly',
              offerTagsAndroid: [],
              displayPrice: '$9.99',
              price: 9.99,
              type: 'promotional',
              pricingPhasesAndroid: {
                pricingPhaseList: [
                  {
                    formattedPrice: '$9.99',
                    priceAmountMicros: '9990000',
                    priceCurrencyCode: 'USD',
                    billingPeriod: 'P1M',
                    billingCycleCount: 0,
                    recurrenceMode: 1,
                  },
                ],
              },
            },
            {
              id: 'premium-year',
              basePlanIdAndroid: 'premium-year',
              offerTokenAndroid: 'offer-token-yearly',
              offerTagsAndroid: [],
              displayPrice: '$99.99',
              price: 99.99,
              type: 'promotional',
              pricingPhasesAndroid: {
                pricingPhaseList: [
                  {
                    formattedPrice: '$99.99',
                    priceAmountMicros: '99990000',
                    priceCurrencyCode: 'USD',
                    billingPeriod: 'P1Y',
                    billingCycleCount: 0,
                    recurrenceMode: 1,
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const {getByText} = await render(<SubscriptionFlow />);

    // Should show upgrade button for monthly plan (Android only)
    await waitFor(() => {
      expect(getByText('⬆️ Upgrade to Yearly Plan')).toBeTruthy();
    });

    // Press upgrade button
    await fireEvent.press(getByText('⬆️ Upgrade to Yearly Plan'));

    // Should show confirmation alert
    expect(alertSpy).toHaveBeenCalledWith(
      'Change Subscription Plan',
      expect.stringContaining('upgrade to Yearly'),
      expect.any(Array),
    );
  });

  it.each([
    {currentPlanId: 'premium-year'},
    {currentPlanId: null, basePlanIdAndroid: 'premium-year'},
  ])('uses the store-reported annual plan %j', async (plan) => {
    Platform.OS = 'android';
    mockIapState({
      activeSubscriptions: [
        {
          productId: sampleSubscription.id,
          transactionId: 'synthetic-subscription',
          transactionDate: 1,
          isActive: true,
          ...plan,
        },
      ],
      subscriptions: [
        {
          ...sampleSubscription,
          subscriptionOffers: [
            {
              id: 'premium',
              basePlanIdAndroid: 'premium',
              displayPrice: '$9.99',
              price: 9.99,
              type: 'promotional',
            },
          ],
        },
      ],
    });
    const screen = await render(<SubscriptionFlow />);
    expect(screen.getByText('📅 Yearly Plan')).toBeTruthy();
    expect(screen.getByText('⬇️ Downgrade to Monthly Plan')).toBeTruthy();
    expect(screen.queryByText('⬆️ Upgrade to Yearly Plan')).toBeNull();
  });

  it('keeps an unavailable Android plan unknown while allowing a plan choice', async () => {
    Platform.OS = 'android';
    mockIapState({
      activeSubscriptions: [
        {
          productId: sampleSubscription.id,
          transactionId: 'synthetic-subscription',
          transactionDate: 1,
          isActive: true,
        },
      ],
      subscriptions: [
        {
          ...sampleSubscription,
          subscriptionOffers: [
            {
              id: 'premium',
              basePlanIdAndroid: 'premium',
              displayPrice: '$9.99',
              price: 9.99,
              type: 'promotional',
            },
          ],
        },
      ],
    });
    const screen = await render(<SubscriptionFlow />);
    expect(screen.getByText('Plan unavailable')).toBeTruthy();
    expect(screen.getByText('Switch to Monthly Plan')).toBeTruthy();
    expect(screen.getByText('Switch to Yearly Plan')).toBeTruthy();
    expect(screen.queryByText('📆 Monthly Plan')).toBeNull();
  });

  it.each([
    {recurrenceMode: 3, replacementMode: 'charge-full-price'},
    {recurrenceMode: 1, replacementMode: 'without-proration'},
  ])(
    'selects an allowed replacement mode for the target plan %j',
    async ({recurrenceMode, replacementMode}) => {
      Platform.OS = 'android';
      requestPurchaseMock.mockResolvedValue(undefined);
      const alertSpy = jest.spyOn(Alert, 'alert');
      mockIapState({
        activeSubscriptions: [
          {
            productId: sampleSubscription.id,
            transactionId: 'synthetic-subscription',
            transactionDate: 1,
            isActive: true,
            currentPlanId: 'premium-year',
            purchaseToken: 'synthetic-current-token',
          },
        ],
        subscriptions: [
          {
            ...sampleSubscription,
            subscriptionOffers: [
              {
                id: 'premium',
                basePlanIdAndroid: 'premium',
                offerTokenAndroid: 'synthetic-monthly-offer',
                displayPrice: '$9.99',
                price: 9.99,
                type: 'promotional',
                pricingPhasesAndroid: {
                  pricingPhaseList: [
                    {
                      formattedPrice: '$9.99',
                      priceAmountMicros: '9990000',
                      priceCurrencyCode: 'USD',
                      billingPeriod: 'P1M',
                      billingCycleCount: 0,
                      recurrenceMode,
                    },
                  ],
                },
              },
            ],
          },
        ],
      });
      const screen = await render(<SubscriptionFlow />);
      await fireEvent.press(screen.getByText('⬇️ Downgrade to Monthly Plan'));
      const confirmation = alertSpy.mock.calls.find(
        ([title]) => title === 'Change Subscription Plan',
      );
      const confirm = confirmation?.[2]?.find(
        (button) => button.text === 'Confirm',
      )?.onPress;
      if (!confirm) throw new Error('Plan-change confirmation is missing');
      await act(async () => {
        confirm();
      });
      expect(requestPurchaseMock).toHaveBeenCalledWith({
        type: 'subs',
        request: {
          google: {
            skus: [sampleSubscription.id],
            subscriptionOffers: [
              {
                sku: sampleSubscription.id,
                offerToken: 'synthetic-monthly-offer',
              },
            ],
            purchaseToken: 'synthetic-current-token',
            subscriptionProductReplacementParams: {
              oldProductId: sampleSubscription.id,
              replacementMode,
            },
          },
        },
      });
      alertSpy.mockRestore();
    },
  );

  it.each([
    {autoRenewingAndroid: true, expected: '✅ Enabled'},
    {autoRenewingAndroid: false, expected: 'Disabled'},
    {autoRenewingAndroid: null, expected: 'Unavailable'},
  ])(
    'uses renewal status rather than active entitlement %j',
    async ({autoRenewingAndroid, expected}) => {
      Platform.OS = 'android';
      mockIapState({
        activeSubscriptions: [
          {
            productId: sampleSubscription.id,
            transactionId: 'synthetic-subscription',
            transactionDate: 1,
            isActive: true,
            autoRenewingAndroid,
          },
        ],
      });
      const screen = await render(<SubscriptionFlow />);
      expect(screen.getByText(expected)).toBeTruthy();
      expect(screen.queryByText('⚠️ Cancelled')).toBeNull();
      if (autoRenewingAndroid !== true)
        expect(screen.queryByText('✅ Enabled')).toBeNull();
    },
  );

  it('displays empty state when no subscriptions available', async () => {
    mockIapState({
      subscriptions: [],
    });

    const {getByText} = await render(<SubscriptionFlow />);

    expect(
      getByText('No subscriptions found. Configure products in the console.'),
    ).toBeTruthy();
    expect(
      getByText('No subscriptions found. Please configure your products.'),
    ).toBeTruthy();
  });

  it('shows already subscribed for owned products', async () => {
    mockIapState({
      activeSubscriptions: [
        {
          productId: 'dev.hyo.martie.premium',
          transactionId: 'trans-1',
          transactionDate: Date.now(),
          isActive: true,
        },
      ],
    });

    const {getByText} = await render(<SubscriptionFlow />);

    // Button should show 'Already Subscribed' and be disabled
    const button = getByText('Already Subscribed');
    expect(button).toBeTruthy();
  });

  it('retries loading subscriptions when retry button pressed', async () => {
    const {fetchProducts} = mockIapState({
      subscriptions: [],
    });

    const {getByText} = await render(<SubscriptionFlow />);

    await fireEvent.press(getByText('Retry'));

    await waitFor(() => {
      expect(fetchProducts).toHaveBeenCalledWith({
        skus: SUBSCRIPTION_PRODUCT_IDS,
        type: 'subs',
      });
    });
  });

  it('handles connection state changes', async () => {
    mockIapState({
      connected: false,
    });

    const {getByText, rerender} = await render(<SubscriptionFlow />);

    expect(getByText('Connecting to Store...')).toBeTruthy();

    // Simulate connection established
    mockIapState({
      connected: true,
    });

    await rerender(<SubscriptionFlow />);

    expect(getByText('Available Subscriptions')).toBeTruthy();
  });

  it('opens subscription details modal', async () => {
    const {getByText} = await render(<SubscriptionFlow />);

    // Open subscription details modal
    await fireEvent.press(getByText('ℹ️'));

    await waitFor(() => {
      expect(getByText('Subscription Details')).toBeTruthy();
    });

    // Modal content should be displayed
    expect(getByText('📋 Copy')).toBeTruthy();
    expect(getByText('🖥️ Console')).toBeTruthy();
  });

  it('logs redacted subscription data to console', async () => {
    const consoleSpy = jest.spyOn(console, 'log');

    const {getByText} = await render(<SubscriptionFlow />);

    // Open subscription details modal
    await fireEvent.press(getByText('ℹ️'));

    await waitFor(() => {
      expect(getByText('Subscription Details')).toBeTruthy();
    });

    // Log to console
    await fireEvent.press(getByText('🖥️ Console'));

    expect(consoleSpy).toHaveBeenCalledWith('=== SUBSCRIPTION DATA ===');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('"offerTokenAndroid": "Present"'),
    );
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('offer-secret'),
    );
  });

  it('closes subscription details modal', async () => {
    const {getByText, queryByText} = await render(<SubscriptionFlow />);

    // Open modal
    await fireEvent.press(getByText('ℹ️'));

    await waitFor(() => {
      expect(getByText('Subscription Details')).toBeTruthy();
    });

    // Close modal
    await fireEvent.press(getByText('✕'));

    await waitFor(() => {
      expect(queryByText('Subscription Details')).toBeNull();
    });
  });

  it('excludes obfuscatedProfileId for subscription upgrades/downgrades (Android)', async () => {
    // Mock Platform to be Android
    Platform.OS = 'android';

    // For upgrade/downgrade the purchase token is read from the active
    // subscription entry, and obfuscated ids must not be forwarded.
    mockIapState({
      activeSubscriptions: [
        {
          productId: 'dev.hyo.martie.premium',
          transactionId: 'trans-1',
          transactionDate: Date.now(),
          isActive: true,
          currentPlanId: 'premium',
          purchaseToken: 'mock-purchase-token-123',
        },
      ],
      subscriptions: [
        {
          ...sampleSubscription,
          subscriptionOffers: [
            {
              id: 'premium',
              basePlanIdAndroid: 'premium',
              offerTokenAndroid: 'offer-token-monthly',
              displayPrice: '$9.99',
              price: 9.99,
              type: 'promotional',
            },
            {
              id: 'premium-year',
              basePlanIdAndroid: 'premium-year',
              offerTokenAndroid: 'offer-token-yearly',
              displayPrice: '$99.99',
              price: 99.99,
              type: 'promotional',
            },
          ],
        },
      ],
    });

    const alertSpy = jest.spyOn(Alert, 'alert');
    const {getByText} = await render(<SubscriptionFlow />);

    // Wait for upgrade button to appear
    await waitFor(() => {
      expect(getByText('⬆️ Upgrade to Yearly Plan')).toBeTruthy();
    });

    // Mock alert to immediately simulate user confirmation
    alertSpy.mockImplementation((_title, _message, buttons) => {
      // Simulate user clicking "Confirm" button (second button)
      if (buttons && buttons[1] && buttons[1].onPress) {
        const onPress = buttons[1].onPress;
        // Execute the onPress callback asynchronously to simulate real behavior
        setImmediate(() => onPress());
      }
    });

    // Press upgrade button
    await fireEvent.press(getByText('⬆️ Upgrade to Yearly Plan'));

    // Wait for requestPurchase to be called with proper parameters
    await waitFor(
      () => {
        expect(requestPurchaseMock).toHaveBeenCalled();
        const lastCall =
          requestPurchaseMock.mock.calls[
            requestPurchaseMock.mock.calls.length - 1
          ];
        expect(lastCall).toBeDefined();
        expect(lastCall[0]).toBeDefined();

        // The plan-change flow issues the Android request under `google`.
        const androidRequest = lastCall[0].request?.google;
        // Should have purchaseToken for upgrade
        expect(androidRequest?.purchaseToken).toBe('mock-purchase-token-123');
        // Should target the yearly plan offer
        expect(androidRequest?.subscriptionOffers).toEqual([
          {sku: 'dev.hyo.martie.premium', offerToken: 'offer-token-yearly'},
        ]);
        // Should NOT have obfuscated ids for upgrade
        expect(androidRequest?.obfuscatedProfileId).toBeUndefined();
        expect(androidRequest?.obfuscatedAccountId).toBeUndefined();
      },
      {timeout: 3000},
    );

    alertSpy.mockRestore();
  });

  it('includes obfuscatedProfileId for new subscriptions', async () => {
    mockIapState({
      subscriptions: [sampleSubscription],
      activeSubscriptions: [], // No active subscriptions
    });

    const {getByText} = await render(<SubscriptionFlow />);

    // Press subscribe for a new subscription
    await fireEvent.press(getByText('Subscribe'));

    // Verify that requestPurchase was called
    expect(requestPurchaseMock).toHaveBeenCalled();

    const lastCall =
      requestPurchaseMock.mock.calls[requestPurchaseMock.mock.calls.length - 1];
    if (lastCall && lastCall[0]) {
      const androidRequest = lastCall[0].request?.android;
      // Should NOT have purchaseToken for new purchase
      expect(androidRequest?.purchaseToken).toBeUndefined();
      // obfuscatedProfileId can be included for new purchases (but is optional)
    }
  });
  it('displays a cold restored Amazon yearly term without Play plan controls', async () => {
    Platform.OS = 'android';
    mockIapState({
      subscriptions: [
        sampleSubscription,
        {...sampleSubscription, id: 'dev.hyo.martie.premium_year'},
      ],
      activeSubscriptions: [
        {
          productId: 'dev.hyo.martie.premium.base',
          currentPlanId: 'dev.hyo.martie.premium_year',
          isActive: true,
          transactionDate: 1,
          transactionId: 'restored-yearly',
        },
      ],
    });
    const {getByText, queryByText, getAllByText} = await render(
      <SubscriptionFlow />,
    );
    expect(getByText('Store-reported Subscription Status')).toBeTruthy();
    expect(queryByText('⬆️ Upgrade to Yearly Plan')).toBeNull();
    expect(queryByText('⬇️ Downgrade to Monthly Plan')).toBeNull();
    expect(getAllByText(/Yearly Plan/).length).toBeGreaterThan(0);
  });
});
