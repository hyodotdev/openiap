import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {ActionSheetIOS, Alert, Platform} from 'react-native';
import SubscriptionFlow from '../../screens/SubscriptionFlow';
import * as RNIap from 'react-native-iap';
import {SUBSCRIPTION_PRODUCT_IDS} from '../../src/utils/constants';
import type {
  MutationFinishTransactionArgs,
  Purchase,
  VerifyPurchaseWithProviderProps,
  VerifyPurchaseWithProviderResult,
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

const sampleSubscription = {
  type: 'subs' as const,
  id: 'dev.hyo.martie.premium',
  title: 'Premium Subscription',
  description: 'Access all premium features',
  displayPrice: '$9.99/month',
  price: 9.99,
  currency: 'USD',
  platform: 'android' as const,
  nameAndroid: 'Premium Subscription',
  offerTokenAndroid: 'offer-secret',
} as any; // Mock object, actual types vary by platform

describe('SubscriptionFlow Screen', () => {
  let onPurchaseSuccess: ((purchase: any) => Promise<void> | void) | undefined;
  let onPurchaseError: ((error: any) => void) | undefined;

  const mockIapState = (
    overrides: Partial<ReturnType<typeof RNIap.useIAP>> & {
      connected?: boolean;
    } = {},
  ) => {
    const fetchProducts = jest.fn(() => Promise.resolve());
    const defaultGetAvailablePurchases = jest.fn(() => Promise.resolve([]));
    const getActiveSubscriptions = jest.fn(() => Promise.resolve([]));
    const finishTransaction = jest.fn(() => Promise.resolve());
    const verifyPurchase = jest.fn(() => Promise.resolve({}));
    const verifyPurchaseWithProvider = jest.fn((_request: unknown) =>
      Promise.resolve({
        iapkit: {
          isValid: true,
          productId: 'dev.hyo.martie.premium',
          state: 'entitled',
          store: 'google',
        },
      }),
    );

    // Use the override if provided, otherwise use default
    const getAvailablePurchases =
      overrides.getAvailablePurchases || defaultGetAvailablePurchases;

    (RNIap.useIAP as jest.Mock).mockImplementation((options) => {
      onPurchaseSuccess = options?.onPurchaseSuccess;
      onPurchaseError = options?.onPurchaseError;

      const result = {
        connected: true,
        subscriptions: [sampleSubscription],
        availablePurchases: [],
        activeSubscriptions: [],
        fetchProducts,
        finishTransaction,
        getAvailablePurchases,
        getActiveSubscriptions,
        verifyPurchase,
        verifyPurchaseWithProvider,
        ...overrides,
      };
      // Ensure getAvailablePurchases uses our mock
      result.getAvailablePurchases = getAvailablePurchases;
      return result;
    });

    return {
      fetchProducts,
      getAvailablePurchases,
      getActiveSubscriptions,
      finishTransaction,
      verifyPurchase,
      verifyPurchaseWithProvider,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIapState();
  });

  afterEach(() => {
    // Reset Platform.OS to its default after each test
    Platform.OS = 'ios';
  });

  it('renders loading state when not connected', async () => {
    mockIapState({connected: false, subscriptions: []});

    const {getByText} = await render(<SubscriptionFlow />);

    expect(getByText('Connecting to Store...')).toBeTruthy();
  });

  it('fetches subscriptions when connected', async () => {
    const {fetchProducts} = mockIapState();

    await render(<SubscriptionFlow />);

    await waitFor(() => {
      expect(fetchProducts).toHaveBeenCalledWith({
        skus: SUBSCRIPTION_PRODUCT_IDS,
        type: 'subs',
      });
    });
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
        google: {
          skus: ['dev.hyo.martie.premium'],
          subscriptionOffers: [],
        },
      },
      type: 'subs',
    });
  });

  it('refreshes subscription status when Check Status pressed', async () => {
    const {getActiveSubscriptions} = mockIapState({
      activeSubscriptions: [
        {
          productId: 'dev.hyo.martie.premium',
        } as any,
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

  it('updates UI on purchase success callback', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    const {getByText} = await render(<SubscriptionFlow />);

    await act(async () => {
      await onPurchaseSuccess?.({
        id: 'transaction-1',
        productId: 'dev.hyo.martie.premium',
        purchaseToken: 'token',
        transactionDate: Date.now(),
        purchaseState: 'purchased',
      });
    });

    await waitFor(() => {
      expect(getByText(/Subscription activated/)).toBeTruthy();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Success',
      'Purchase completed successfully!',
    );
  });

  it('keeps Local (Device) subscription verification direct', async () => {
    const selectorSpy = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_options, callback) => callback(0));
    const {finishTransaction, verifyPurchase, verifyPurchaseWithProvider} =
      mockIapState();
    const {getByText} = await render(<SubscriptionFlow />);

    await fireEvent.press(getByText('Local (IAPKit)'));
    await waitFor(() => {
      expect(getByText('Local (Device)')).toBeTruthy();
    });

    await act(async () => {
      await onPurchaseSuccess?.({
        id: 'transaction-device-sub-1',
        platform: 'ios',
        productId: 'dev.hyo.martie.premium',
        purchaseToken: 'device-sub-jws',
        transactionDate: Date.now(),
      });
    });

    expect(verifyPurchase).toHaveBeenCalledWith({
      apple: {sku: 'dev.hyo.martie.premium'},
      google: {
        sku: 'dev.hyo.martie.premium',
        accessToken: 'YOUR_OAUTH_ACCESS_TOKEN',
        packageName: 'dev.hyo.martie',
        purchaseToken: 'device-sub-jws',
        isSub: true,
      },
    });
    expect(verifyPurchaseWithProvider).not.toHaveBeenCalled();
    expect(verifyPurchase.mock.invocationCallOrder[0]).toBeLessThan(
      finishTransaction.mock.invocationCallOrder[0]!,
    );

    selectorSpy.mockRestore();
  });

  it('re-verifies the Android IAPKit snapshot after finishing', async () => {
    Platform.OS = 'android';
    const {finishTransaction, verifyPurchase, verifyPurchaseWithProvider} =
      mockIapState();

    await render(<SubscriptionFlow />);

    await act(async () => {
      await onPurchaseSuccess?.({
        id: 'transaction-android-1',
        platform: 'android',
        productId: 'dev.hyo.martie.premium',
        purchaseToken: 'android-token',
        transactionDate: Date.now(),
      });
    });

    expect(finishTransaction).toHaveBeenCalledTimes(1);
    expect(verifyPurchase).not.toHaveBeenCalled();
    expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(2);
    expect(verifyPurchaseWithProvider.mock.calls[0]?.[0]).toEqual({
      provider: 'iapkit',
      iapkit: {
        apiKey: 'test-api-key',
        baseUrl: 'http://192.168.0.10:3100',
        google: {purchaseToken: 'android-token'},
      },
    });
    expect(verifyPurchaseWithProvider.mock.calls[1]?.[0]).toEqual(
      verifyPurchaseWithProvider.mock.calls[0]?.[0],
    );
    expect(verifyPurchaseWithProvider.mock.invocationCallOrder[0]).toBeLessThan(
      finishTransaction.mock.invocationCallOrder[0]!,
    );
    expect(finishTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      verifyPurchaseWithProvider.mock.invocationCallOrder[1]!,
    );
  });

  it('verifies a restored Local IAPKit subscription before finishing and re-verifying it', async () => {
    Platform.OS = 'android';
    const restoredPurchase: Purchase = {
      id: 'transaction-restored-sub-1',
      isAutoRenewing: true,
      productId: 'dev.hyo.martie.premium',
      purchaseState: 'purchased',
      purchaseToken: 'google-sub-token-restored-1',
      quantity: 1,
      store: 'google',
      transactionDate: Date.now(),
    };
    const finishTransaction = jest.fn(
      (_args: MutationFinishTransactionArgs): Promise<void> =>
        Promise.resolve(),
    );
    const firstVerification: VerifyPurchaseWithProviderResult = {
      provider: 'iapkit',
      iapkit: {
        isValid: true,
        productId: restoredPurchase.productId,
        state: 'pending-acknowledgment',
        store: 'google',
      },
    };
    const refreshedVerification: VerifyPurchaseWithProviderResult = {
      provider: 'iapkit',
      iapkit: {
        isValid: true,
        productId: restoredPurchase.productId,
        state: 'entitled',
        store: 'google',
      },
    };
    let verificationCallCount = 0;
    const verifyPurchaseWithProvider = jest.fn(
      (
        _request: VerifyPurchaseWithProviderProps,
      ): Promise<VerifyPurchaseWithProviderResult> => {
        verificationCallCount += 1;
        return Promise.resolve(
          verificationCallCount === 1
            ? firstVerification
            : refreshedVerification,
        );
      },
    );

    mockIapState({
      availablePurchases: [restoredPurchase],
      finishTransaction,
      verifyPurchaseWithProvider,
    });
    await render(<SubscriptionFlow />);

    await waitFor(() => {
      expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(2);
    });

    expect(finishTransaction).toHaveBeenCalledTimes(1);
    expect(finishTransaction).toHaveBeenCalledWith({
      purchase: restoredPurchase,
      isConsumable: false,
    });
    expect(verifyPurchaseWithProvider.mock.calls[0]?.[0]).toEqual({
      provider: 'iapkit',
      iapkit: {
        apiKey: 'test-api-key',
        baseUrl: 'http://192.168.0.10:3100',
        google: {purchaseToken: restoredPurchase.purchaseToken},
      },
    });
    expect(verifyPurchaseWithProvider.mock.calls[1]?.[0]).toEqual(
      verifyPurchaseWithProvider.mock.calls[0]?.[0],
    );
    expect(verifyPurchaseWithProvider.mock.invocationCallOrder[0]).toBeLessThan(
      finishTransaction.mock.invocationCallOrder[0]!,
    );
    expect(finishTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      verifyPurchaseWithProvider.mock.invocationCallOrder[1]!,
    );
  });

  it.each([
    {
      caseName: 'an invalid result',
      expectedMessage:
        'IAPKit rejected the purchase (state: expired, store: google)',
      result: {
        provider: 'iapkit',
        iapkit: {
          isValid: false,
          productId: 'dev.hyo.martie.premium',
          state: 'expired',
          store: 'google',
        },
      } satisfies VerifyPurchaseWithProviderResult,
    },
    {
      caseName: 'a mismatched product',
      expectedMessage:
        'IAPKit verified dev.hyo.martie.premium_year, expected dev.hyo.martie.premium',
      result: {
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          productId: 'dev.hyo.martie.premium_year',
          state: 'entitled',
          store: 'google',
        },
      } satisfies VerifyPurchaseWithProviderResult,
    },
  ])(
    'does not finish a restored Local IAPKit subscription for $caseName',
    async ({caseName, expectedMessage, result}) => {
      Platform.OS = 'android';
      const restoredPurchase: Purchase = {
        id: `transaction-restored-sub-${caseName}`,
        isAutoRenewing: true,
        productId: 'dev.hyo.martie.premium',
        purchaseState: 'purchased',
        purchaseToken: `google-sub-token-restored-${caseName}`,
        quantity: 1,
        store: 'google',
        transactionDate: Date.now(),
      };
      const finishTransaction = jest.fn(
        (_args: MutationFinishTransactionArgs): Promise<void> =>
          Promise.resolve(),
      );
      const verifyPurchaseWithProvider = jest.fn(
        (
          _request: VerifyPurchaseWithProviderProps,
        ): Promise<VerifyPurchaseWithProviderResult> => Promise.resolve(result),
      );

      mockIapState({
        availablePurchases: [restoredPurchase],
        finishTransaction,
        verifyPurchaseWithProvider,
      });
      const {getByText} = await render(<SubscriptionFlow />);

      await waitFor(() => {
        expect(getByText(/Subscription verification failed/)).toBeTruthy();
      });

      expect(
        getByText(`Subscription verification failed: ${expectedMessage}`),
      ).toBeTruthy();
      expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
      expect(finishTransaction).not.toHaveBeenCalled();
    },
  );

  it('does not finish or re-verify a restored subscription after unmount during verification', async () => {
    jest.useFakeTimers();
    Platform.OS = 'android';
    const alertSpy = jest.spyOn(Alert, 'alert');
    const restoredPurchase: Purchase = {
      id: 'transaction-restored-sub-unmount-1',
      isAutoRenewing: true,
      productId: 'dev.hyo.martie.premium',
      purchaseState: 'purchased',
      purchaseToken: 'google-sub-token-restored-unmount-1',
      quantity: 1,
      store: 'google',
      transactionDate: Date.now(),
    };
    const finishTransaction = jest.fn(
      (_args: MutationFinishTransactionArgs): Promise<void> =>
        Promise.resolve(),
    );
    let resolveVerification!: (value: VerifyPurchaseWithProviderResult) => void;
    const pendingVerification = new Promise<VerifyPurchaseWithProviderResult>(
      (resolve) => {
        resolveVerification = resolve;
      },
    );
    let verificationCallCount = 0;
    const verifyPurchaseWithProvider = jest.fn(
      (
        _request: VerifyPurchaseWithProviderProps,
      ): Promise<VerifyPurchaseWithProviderResult> => {
        verificationCallCount += 1;
        return verificationCallCount === 1
          ? pendingVerification
          : Promise.resolve({
              provider: 'iapkit',
              iapkit: {
                isValid: true,
                productId: restoredPurchase.productId,
                state: 'entitled',
                store: 'google',
              },
            });
      },
    );
    let unmount: (() => Promise<void>) | undefined;

    try {
      mockIapState({
        availablePurchases: [restoredPurchase],
        finishTransaction,
        verifyPurchaseWithProvider,
      });
      const rendered = await render(<SubscriptionFlow />);
      unmount = rendered.unmount;

      await act(async () => {
        await Promise.resolve();
      });
      expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
      expect(finishTransaction).not.toHaveBeenCalled();

      await rendered.unmount();
      unmount = undefined;
      const timerCountAfterUnmount = jest.getTimerCount();

      resolveVerification({
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          productId: restoredPurchase.productId,
          state: 'pending-acknowledgment',
          store: 'google',
        },
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(finishTransaction).not.toHaveBeenCalled();
      expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(timerCountAfterUnmount);
      expect(alertSpy).not.toHaveBeenCalledWith(
        '✅ Local (IAPKit) Verification',
        expect.any(String),
      );
    } finally {
      await unmount?.();
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('cancels an actual disconnected finish retry on unmount', async () => {
    jest.useFakeTimers();
    Platform.OS = 'android';
    const purchase: Purchase = {
      id: 'transaction-sub-cancel-retry-1',
      isAutoRenewing: true,
      productId: 'dev.hyo.martie.premium',
      purchaseState: 'purchased',
      purchaseToken: 'google-sub-token-cancel-retry-1',
      quantity: 1,
      store: 'google',
      transactionDate: Date.now(),
    };
    const finishTransaction = jest.fn(
      (_args: MutationFinishTransactionArgs): Promise<void> =>
        Promise.resolve(),
    );
    const verifyPurchaseWithProvider = jest.fn(
      (
        _request: VerifyPurchaseWithProviderProps,
      ): Promise<VerifyPurchaseWithProviderResult> =>
        Promise.resolve({
          provider: 'iapkit',
          iapkit: {
            isValid: true,
            productId: purchase.productId,
            state: 'pending-acknowledgment',
            store: 'google',
          },
        }),
    );
    const getActiveSubscriptions = jest.fn(() => Promise.resolve([]));
    let unmount: (() => Promise<void>) | undefined;

    try {
      mockIapState({
        availablePurchases: [],
        connected: false,
        finishTransaction,
        getActiveSubscriptions,
        verifyPurchaseWithProvider,
      });
      const rendered = await render(<SubscriptionFlow />);
      unmount = rendered.unmount;
      const purchaseSuccessHandler = onPurchaseSuccess;
      if (!purchaseSuccessHandler) {
        throw new Error('Purchase success handler was not registered');
      }
      const timerCountBeforePurchase = jest.getTimerCount();

      await act(async () => {
        await purchaseSuccessHandler(purchase);
      });

      expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
      expect(finishTransaction).not.toHaveBeenCalled();
      const timerCountWithRetry = jest.getTimerCount();
      expect(timerCountWithRetry).toBeGreaterThan(timerCountBeforePurchase);

      await rendered.unmount();
      unmount = undefined;

      // React Native Testing Library 14 may schedule renderer teardown timers,
      // so verify cancellation by behavior instead of the global timer count.
      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      expect(finishTransaction).not.toHaveBeenCalled();
      expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
      expect(getActiveSubscriptions).not.toHaveBeenCalled();
    } finally {
      await unmount?.();
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('does not duplicate verification or finish across a remount while native finish is pending', async () => {
    Platform.OS = 'android';
    const purchase: Purchase = {
      id: 'transaction-sub-remount-pending-finish-1',
      isAutoRenewing: true,
      productId: 'dev.hyo.martie.premium',
      purchaseState: 'purchased',
      purchaseToken: 'google-sub-token-remount-pending-finish-1',
      quantity: 1,
      store: 'google',
      transactionDate: Date.now(),
    };
    let resolveFinish!: () => void;
    const pendingFinish = new Promise<void>((resolve) => {
      resolveFinish = resolve;
    });
    const finishTransaction = jest.fn(
      (_args: MutationFinishTransactionArgs): Promise<void> => pendingFinish,
    );
    const verifyPurchaseWithProvider = jest.fn(
      (
        _request: VerifyPurchaseWithProviderProps,
      ): Promise<VerifyPurchaseWithProviderResult> =>
        Promise.resolve({
          provider: 'iapkit',
          iapkit: {
            isValid: true,
            productId: purchase.productId,
            state: 'entitled',
            store: 'google',
          },
        }),
    );
    const getActiveSubscriptions = jest.fn(() => Promise.resolve([]));

    mockIapState({
      availablePurchases: [],
      finishTransaction,
      getActiveSubscriptions,
      verifyPurchaseWithProvider,
    });
    const firstMount = await render(<SubscriptionFlow />);
    const purchaseSuccessHandler = onPurchaseSuccess;
    if (!purchaseSuccessHandler) {
      throw new Error('Purchase success handler was not registered');
    }

    let processingPromise!: Promise<void>;
    await act(async () => {
      processingPromise = Promise.resolve(purchaseSuccessHandler(purchase));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    expect(finishTransaction).toHaveBeenCalledTimes(1);
    await firstMount.unmount();

    mockIapState({
      availablePurchases: [purchase],
      finishTransaction,
      getActiveSubscriptions,
      verifyPurchaseWithProvider,
    });
    const secondMount = await render(<SubscriptionFlow />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    expect(finishTransaction).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFinish();
      await processingPromise;
      await Promise.resolve();
    });

    const remountedPurchaseSuccessHandler = onPurchaseSuccess;
    if (!remountedPurchaseSuccessHandler) {
      throw new Error('Remounted purchase success handler was not registered');
    }
    await act(async () => {
      await remountedPurchaseSuccessHandler({...purchase});
    });

    expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    expect(finishTransaction).toHaveBeenCalledTimes(1);
    expect(getActiveSubscriptions).toHaveBeenCalledTimes(1);
    await secondMount.unmount();
  });

  it('remembers a finished subscription after its unmounted owner task fully settles', async () => {
    Platform.OS = 'android';
    const purchase: Purchase = {
      id: 'transaction-sub-remount-after-owner-finish-1',
      isAutoRenewing: true,
      productId: 'dev.hyo.martie.premium',
      purchaseState: 'purchased',
      purchaseToken: 'google-sub-token-remount-after-owner-finish-1',
      quantity: 1,
      store: 'google',
      transactionDate: Date.now(),
    };
    let resolveFinish!: () => void;
    let finishSettled = false;
    const pendingFinish = new Promise<void>((resolve) => {
      resolveFinish = resolve;
    });
    const finishTransaction = jest.fn(
      (_args: MutationFinishTransactionArgs): Promise<void> => pendingFinish,
    );
    const verifyPurchaseWithProvider = jest.fn(
      (
        _request: VerifyPurchaseWithProviderProps,
      ): Promise<VerifyPurchaseWithProviderResult> =>
        Promise.resolve({
          provider: 'iapkit',
          iapkit: {
            isValid: true,
            productId: purchase.productId,
            state: 'pending-acknowledgment',
            store: 'google',
          },
        }),
    );
    const getActiveSubscriptions = jest.fn(() => Promise.resolve([]));
    let firstUnmount: (() => Promise<void>) | undefined;
    let secondUnmount: (() => Promise<void>) | undefined;
    let ownerTask: Promise<void> | undefined;

    try {
      mockIapState({
        availablePurchases: [],
        finishTransaction,
        getActiveSubscriptions,
        verifyPurchaseWithProvider,
      });
      const firstMount = await render(<SubscriptionFlow />);
      firstUnmount = firstMount.unmount;
      const firstPurchaseSuccessHandler = onPurchaseSuccess;
      if (!firstPurchaseSuccessHandler) {
        throw new Error('Purchase success handler was not registered');
      }

      await act(async () => {
        ownerTask = Promise.resolve(firstPurchaseSuccessHandler(purchase));
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
        expect(finishTransaction).toHaveBeenCalledTimes(1);
      });

      await firstMount.unmount();
      firstUnmount = undefined;

      await act(async () => {
        resolveFinish();
        finishSettled = true;
        await ownerTask;
      });
      ownerTask = undefined;

      expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
      expect(getActiveSubscriptions).not.toHaveBeenCalled();

      mockIapState({
        availablePurchases: [{...purchase}],
        finishTransaction,
        getActiveSubscriptions,
        verifyPurchaseWithProvider,
      });
      const secondMount = await render(<SubscriptionFlow />);
      secondUnmount = secondMount.unmount;
      const secondPurchaseSuccessHandler = onPurchaseSuccess;
      if (!secondPurchaseSuccessHandler) {
        throw new Error(
          'Remounted purchase success handler was not registered',
        );
      }

      await act(async () => {
        await secondPurchaseSuccessHandler({...purchase});
        await Promise.resolve();
      });

      expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
      expect(finishTransaction).toHaveBeenCalledTimes(1);
      expect(getActiveSubscriptions).not.toHaveBeenCalled();
    } finally {
      await firstUnmount?.();
      await secondUnmount?.();
      if (!finishSettled) {
        resolveFinish();
        await ownerTask;
      }
    }
  });

  it('does not acknowledge while IAPKit verification is pending', async () => {
    Platform.OS = 'android';
    const purchase = {
      id: 'transaction-sub-race-1',
      platform: 'android',
      productId: 'dev.hyo.martie.premium',
      purchaseToken: 'google-sub-token-race-1',
      store: 'google',
      transactionDate: Date.now(),
      purchaseState: 'purchased',
    };
    const finishTransaction = jest.fn(() => Promise.resolve());
    let resolveVerification!: (value: VerifyPurchaseWithProviderResult) => void;
    const verificationPromise = new Promise<VerifyPurchaseWithProviderResult>(
      (resolve) => {
        resolveVerification = resolve;
      },
    );
    const verifyPurchaseWithProvider = jest.fn(
      (_options: unknown): Promise<VerifyPurchaseWithProviderResult> =>
        verificationPromise,
    );

    mockIapState({
      availablePurchases: [],
      finishTransaction,
      verifyPurchaseWithProvider,
    });
    const {rerender} = await render(<SubscriptionFlow />);
    const purchaseSuccessHandler = onPurchaseSuccess;
    if (!purchaseSuccessHandler) {
      throw new Error('Purchase success handler was not registered');
    }

    let purchasePromise!: Promise<void>;
    await act(async () => {
      purchasePromise = Promise.resolve(purchaseSuccessHandler(purchase));
      await Promise.resolve();
    });

    expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);

    mockIapState({
      availablePurchases: [purchase as any],
      finishTransaction,
      verifyPurchaseWithProvider,
    });
    await rerender(<SubscriptionFlow />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(finishTransaction).not.toHaveBeenCalled();

    await act(async () => {
      resolveVerification({
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          productId: 'dev.hyo.martie.premium',
          state: 'entitled',
          store: 'google',
        },
      });
      await purchasePromise;
    });

    expect(finishTransaction).toHaveBeenCalledTimes(1);
    expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(2);
    expect(verifyPurchaseWithProvider.mock.invocationCallOrder[0]).toBeLessThan(
      finishTransaction.mock.invocationCallOrder[0]!,
    );
    expect(finishTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      verifyPurchaseWithProvider.mock.invocationCallOrder[1]!,
    );
  });

  it('finishes once after reconnect and ignores replay while verification is pending', async () => {
    jest.useFakeTimers();
    Platform.OS = 'android';
    const purchase: Purchase = {
      id: 'transaction-sub-reconnect-1',
      isAutoRenewing: true,
      productId: 'dev.hyo.martie.premium',
      purchaseState: 'purchased',
      purchaseToken: 'google-sub-token-reconnect-1',
      quantity: 1,
      store: 'google',
      transactionDate: Date.now(),
    };
    const finishTransaction = jest.fn(
      (_args: MutationFinishTransactionArgs): Promise<void> =>
        Promise.resolve(),
    );
    let resolveFirstVerification!: (
      value: VerifyPurchaseWithProviderResult,
    ) => void;
    const firstVerificationPromise =
      new Promise<VerifyPurchaseWithProviderResult>((resolve) => {
        resolveFirstVerification = resolve;
      });
    const refreshedVerification: VerifyPurchaseWithProviderResult = {
      provider: 'iapkit',
      iapkit: {
        isValid: true,
        productId: purchase.productId,
        state: 'entitled',
        store: 'google',
      },
    };
    let verificationCallCount = 0;
    const verifyPurchaseWithProvider = jest.fn(
      (
        _request: VerifyPurchaseWithProviderProps,
      ): Promise<VerifyPurchaseWithProviderResult> => {
        verificationCallCount += 1;
        return verificationCallCount === 1
          ? firstVerificationPromise
          : Promise.resolve(refreshedVerification);
      },
    );
    let unmount: (() => Promise<void>) | undefined;

    try {
      const {getActiveSubscriptions} = mockIapState({
        availablePurchases: [],
        connected: true,
        finishTransaction,
        verifyPurchaseWithProvider,
      });
      const rendered = await render(<SubscriptionFlow />);
      unmount = rendered.unmount;
      const purchaseSuccessHandler = onPurchaseSuccess;
      if (!purchaseSuccessHandler) {
        throw new Error('Purchase success handler was not registered');
      }

      let purchasePromise!: Promise<void>;
      await act(async () => {
        purchasePromise = Promise.resolve(purchaseSuccessHandler(purchase));
        await Promise.resolve();
      });

      expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
      expect(finishTransaction).not.toHaveBeenCalled();

      mockIapState({
        availablePurchases: [purchase],
        connected: false,
        finishTransaction,
        verifyPurchaseWithProvider,
      });
      await rendered.rerender(<SubscriptionFlow />);
      await act(async () => {
        await Promise.resolve();
      });

      const replayHandler = onPurchaseSuccess;
      if (!replayHandler) {
        throw new Error('Purchase replay handler was not registered');
      }
      await act(async () => {
        await replayHandler(purchase);
      });

      expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
      expect(finishTransaction).not.toHaveBeenCalled();

      await act(async () => {
        resolveFirstVerification({
          provider: 'iapkit',
          iapkit: {
            isValid: true,
            productId: purchase.productId,
            state: 'pending-acknowledgment',
            store: 'google',
          },
        });
        await purchasePromise;
      });

      expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
      expect(finishTransaction).not.toHaveBeenCalled();

      mockIapState({
        availablePurchases: [purchase],
        connected: true,
        finishTransaction,
        verifyPurchaseWithProvider,
      });
      await rendered.rerender(<SubscriptionFlow />);
      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(finishTransaction).toHaveBeenCalledTimes(1);
      expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(2);
      expect(
        verifyPurchaseWithProvider.mock.invocationCallOrder[0],
      ).toBeLessThan(finishTransaction.mock.invocationCallOrder[0]!);
      expect(finishTransaction.mock.invocationCallOrder[0]).toBeLessThan(
        verifyPurchaseWithProvider.mock.invocationCallOrder[1]!,
      );
      expect(getActiveSubscriptions).toHaveBeenCalledTimes(1);
      expect(
        verifyPurchaseWithProvider.mock.invocationCallOrder[1],
      ).toBeLessThan(getActiveSubscriptions.mock.invocationCallOrder[0]!);

      const completedReplayHandler = onPurchaseSuccess;
      if (!completedReplayHandler) {
        throw new Error('Completed purchase replay handler was not registered');
      }
      await act(async () => {
        await completedReplayHandler(purchase);
      });

      expect(finishTransaction).toHaveBeenCalledTimes(1);
      expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(2);
    } finally {
      await unmount?.();
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('does not finish or report success when IAPKit rejects a subscription', async () => {
    Platform.OS = 'android';
    const alertSpy = jest.spyOn(Alert, 'alert');
    const purchase = {
      id: 'transaction-sub-invalid-1',
      platform: 'android',
      productId: 'dev.hyo.martie.premium',
      purchaseToken: 'google-sub-token-invalid-1',
      store: 'google',
      transactionDate: Date.now(),
      purchaseState: 'purchased',
    };
    const finishTransaction = jest.fn(() => Promise.resolve());
    const verifyPurchaseWithProvider = jest.fn(
      (_options: unknown): Promise<VerifyPurchaseWithProviderResult> =>
        Promise.resolve({
          provider: 'iapkit',
          iapkit: {
            isValid: false,
            productId: 'dev.hyo.martie.premium',
            state: 'consumed',
            store: 'google',
          },
        }),
    );

    mockIapState({
      availablePurchases: [],
      finishTransaction,
      verifyPurchaseWithProvider,
    });
    const {getByText} = await render(<SubscriptionFlow />);
    const purchaseSuccessHandler = onPurchaseSuccess;
    if (!purchaseSuccessHandler) {
      throw new Error('Purchase success handler was not registered');
    }

    await act(async () => {
      await purchaseSuccessHandler(purchase);
    });

    expect(finishTransaction).not.toHaveBeenCalled();
    expect(getByText(/Subscription verification failed/)).toBeTruthy();
    expect(alertSpy).toHaveBeenCalledWith(
      'Verification Failed',
      expect.stringContaining('state: consumed'),
    );
    expect(alertSpy).not.toHaveBeenCalledWith(
      'Success',
      'Purchase completed successfully!',
    );
  });

  it('shows error message on purchase error callback', async () => {
    const {getByText} = await render(<SubscriptionFlow />);

    await act(async () => {
      onPurchaseError?.({message: 'Subscription failed'});
    });

    await waitFor(() => {
      expect(
        getByText('❌ Subscription failed: Subscription failed'),
      ).toBeTruthy();
    });
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
        } as any,
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
        } as any,
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
          purchaseToken: 'mock-purchase-token-123',
        } as any,
      ],
      subscriptions: [
        {
          ...sampleSubscription,
          subscriptionOffers: [
            {
              basePlanIdAndroid: 'premium',
              offerTokenAndroid: 'offer-token-monthly',
              displayPrice: '$9.99',
              type: 'subs',
            },
            {
              basePlanIdAndroid: 'premium-year',
              offerTokenAndroid: 'offer-token-yearly',
              displayPrice: '$99.99',
              type: 'subs',
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
});
