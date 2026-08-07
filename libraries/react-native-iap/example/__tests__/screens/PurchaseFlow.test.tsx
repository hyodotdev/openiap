import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {ActionSheetIOS, Alert, Platform} from 'react-native';
import PurchaseFlow from '../../screens/PurchaseFlow';
import * as RNIap from 'react-native-iap';
import {PRODUCT_IDS} from '../../src/utils/constants';
import {ErrorCode} from 'react-native-iap';
import type {
  MutationFinishTransactionArgs,
  Purchase,
  VerifyPurchaseWithProviderProps,
  VerifyPurchaseWithProviderResult,
} from 'react-native-iap';

jest.mock(
  '@env',
  () => ({
    IAPKIT_API_KEY: 'test-api-key',
    IAPKIT_BASE_URL: 'http://192.168.0.10:3100',
  }),
  {virtual: true},
);

describe('PurchaseFlow Screen', () => {
  const requestPurchaseMock = RNIap.requestPurchase as jest.Mock;
  const alertSpy = jest.spyOn(Alert, 'alert');

  const sampleProducts = [
    {
      id: 'dev.hyo.martie.10bulbs',
      title: '10 Bulbs',
      description: 'Get 10 bulbs for your garden',
      displayPrice: '$0.99',
      price: 0.99,
      currency: 'USD',
      type: 'in-app',
    },
    {
      id: 'dev.hyo.martie.30bulbs',
      title: '30 Bulbs',
      description: 'Get 30 bulbs for your garden',
      displayPrice: '$2.99',
      price: 2.99,
      currency: 'USD',
      type: 'in-app',
    },
  ];

  // Android product with discount offers (cross-platform)
  const androidProductWithOffers = {
    id: 'dev.hyo.martie.10bulbs',
    title: '10 Bulbs',
    description: 'Get 10 bulbs for your garden',
    displayPrice: '$0.99',
    price: 0.99,
    currency: 'USD',
    type: 'in-app' as const,
    platform: 'android' as const,
    nameAndroid: '10 Bulbs',
    discountOffers: [
      {
        id: 'base-offer',
        displayPrice: '$0.99',
        price: 0.99,
        currency: 'USD',
        type: 'one-time' as const,
        offerTokenAndroid: 'token-base-123',
        offerTagsAndroid: ['bestseller'],
        fullPriceMicrosAndroid: null,
        percentageDiscountAndroid: null,
        formattedDiscountAmountAndroid: null,
        discountAmountMicrosAndroid: null,
        limitedQuantityInfoAndroid: null,
        validTimeWindowAndroid: null,
        preorderDetailsAndroid: null,
        rentalDetailsAndroid: null,
      },
      {
        id: 'discount-offer',
        displayPrice: '$0.79',
        price: 0.79,
        currency: 'USD',
        type: 'one-time' as const,
        offerTokenAndroid: 'token-discount-456',
        offerTagsAndroid: ['sale', 'limited'],
        fullPriceMicrosAndroid: '990000',
        percentageDiscountAndroid: 20,
        formattedDiscountAmountAndroid: '$0.20',
        discountAmountMicrosAndroid: '200000',
        limitedQuantityInfoAndroid: {
          maximumQuantity: 100,
          remainingQuantity: 45,
        },
        validTimeWindowAndroid: {
          startTimeMillis: '1702300800000',
          endTimeMillis: '1702905600000',
        },
        preorderDetailsAndroid: null,
        rentalDetailsAndroid: null,
      },
    ],
  };

  // Android product with preorder details
  const androidProductWithPreorder = {
    id: 'dev.hyo.martie.preorder',
    title: 'Preorder Item',
    description: 'A preorder product',
    displayPrice: '$9.99',
    price: 9.99,
    currency: 'USD',
    type: 'in-app' as const,
    platform: 'android' as const,
    nameAndroid: 'Preorder Item',
    discountOffers: [
      {
        id: null,
        displayPrice: '$9.99',
        price: 9.99,
        currency: 'USD',
        type: 'one-time' as const,
        offerTokenAndroid: 'token-preorder-789',
        offerTagsAndroid: [],
        fullPriceMicrosAndroid: null,
        percentageDiscountAndroid: null,
        formattedDiscountAmountAndroid: null,
        discountAmountMicrosAndroid: null,
        limitedQuantityInfoAndroid: null,
        validTimeWindowAndroid: null,
        preorderDetailsAndroid: {
          preorderReleaseTimeMillis: '1704067200000',
          preorderPresaleEndTimeMillis: '1703980800000',
        },
        rentalDetailsAndroid: null,
      },
    ],
  };

  // Android product with rental details
  const androidProductWithRental = {
    id: 'dev.hyo.martie.rental',
    title: 'Rental Item',
    description: 'A rental product',
    displayPrice: '$4.99',
    price: 4.99,
    currency: 'USD',
    type: 'in-app' as const,
    platform: 'android' as const,
    nameAndroid: 'Rental Item',
    discountOffers: [
      {
        id: null,
        displayPrice: '$4.99',
        price: 4.99,
        currency: 'USD',
        type: 'one-time' as const,
        offerTokenAndroid: 'token-rental-abc',
        offerTagsAndroid: [],
        fullPriceMicrosAndroid: null,
        percentageDiscountAndroid: null,
        formattedDiscountAmountAndroid: null,
        discountAmountMicrosAndroid: null,
        limitedQuantityInfoAndroid: null,
        validTimeWindowAndroid: null,
        preorderDetailsAndroid: null,
        rentalDetailsAndroid: {
          rentalPeriod: 'P7D',
          rentalExpirationPeriod: 'P30D',
        },
      },
    ],
  };

  // Android product with absolute discount (no percentage)
  const androidProductWithAbsoluteDiscount = {
    id: 'dev.hyo.martie.absolute',
    title: 'Absolute Discount Item',
    description: 'A product with absolute discount',
    displayPrice: '$1.99',
    price: 1.99,
    currency: 'USD',
    type: 'in-app' as const,
    platform: 'android' as const,
    nameAndroid: 'Absolute Discount Item',
    discountOffers: [
      {
        id: 'abs-discount',
        displayPrice: '$1.99',
        price: 1.99,
        currency: 'USD',
        type: 'one-time' as const,
        offerTokenAndroid: 'token-abs-xyz',
        offerTagsAndroid: [],
        fullPriceMicrosAndroid: '2990000',
        percentageDiscountAndroid: null,
        formattedDiscountAmountAndroid: '$1.00',
        discountAmountMicrosAndroid: '1000000',
        limitedQuantityInfoAndroid: null,
        validTimeWindowAndroid: null,
        preorderDetailsAndroid: null,
        rentalDetailsAndroid: null,
      },
    ],
  };

  let onPurchaseSuccess: ((purchase: any) => Promise<void> | void) | undefined;
  let onPurchaseError: ((error: any) => void) | undefined;

  const mockIapState = (
    overrides: Partial<ReturnType<typeof RNIap.useIAP>> & {
      connected?: boolean;
    } = {},
  ) => {
    const fetchProducts = jest.fn(() => Promise.resolve());
    const getAvailablePurchases = jest.fn(() => Promise.resolve());
    const finishTransaction = jest.fn(() => Promise.resolve());
    const verifyPurchase = jest.fn(() => Promise.resolve({}));
    const verifyPurchaseWithProvider = jest.fn(() =>
      Promise.resolve({
        iapkit: {
          isValid: true,
          productId: 'dev.hyo.martie.10bulbs',
          state: 'ready-to-consume',
          store: 'google',
        },
      }),
    );

    (RNIap.useIAP as jest.Mock).mockImplementation((options) => {
      onPurchaseSuccess = options?.onPurchaseSuccess;
      onPurchaseError = options?.onPurchaseError;

      return {
        connected: true,
        products: sampleProducts,
        availablePurchases: [],
        activeSubscriptions: [],
        fetchProducts,
        finishTransaction,
        getAvailablePurchases,
        verifyPurchase,
        verifyPurchaseWithProvider,
        ...overrides,
      };
    });

    return {
      fetchProducts,
      getAvailablePurchases,
      finishTransaction,
      verifyPurchase,
      verifyPurchaseWithProvider,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    mockIapState();
  });

  it('renders loading state when not connected', async () => {
    mockIapState({connected: false, products: []});

    const {getByText} = await render(<PurchaseFlow />);

    expect(getByText('Connecting to Store...')).toBeTruthy();
  });

  it('fetches products when connected', async () => {
    const {fetchProducts} = mockIapState();

    await render(<PurchaseFlow />);

    await waitFor(() => {
      expect(fetchProducts).toHaveBeenCalledWith({
        skus: PRODUCT_IDS,
        type: 'in-app',
      });
    });
  });

  it('displays fetched products', async () => {
    const {getByText} = await render(<PurchaseFlow />);

    expect(getByText('10 Bulbs')).toBeTruthy();
    expect(getByText('30 Bulbs')).toBeTruthy();
    expect(getByText('Local (IAPKit)')).toBeTruthy();
  });

  it('initiates purchase when purchase button pressed', async () => {
    const {getAllByText} = await render(<PurchaseFlow />);

    const purchaseButtons = getAllByText('Purchase');
    await fireEvent.press(purchaseButtons[0]!);

    expect(requestPurchaseMock).toHaveBeenCalledWith({
      request: {
        apple: {
          sku: 'dev.hyo.martie.10bulbs',
          quantity: 1,
        },
        google: {
          skus: ['dev.hyo.martie.10bulbs'],
        },
      },
      type: 'in-app',
    });
  });

  it('routes Local (IAPKit) through the configured local server', async () => {
    const {finishTransaction, verifyPurchase, verifyPurchaseWithProvider} =
      mockIapState();

    await render(<PurchaseFlow />);

    await act(async () => {
      await onPurchaseSuccess?.({
        id: 'transaction-1',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'apple-jws',
        store: 'apple',
        transactionDate: Date.now(),
        purchaseState: 'purchased',
      });
    });

    expect(verifyPurchase).not.toHaveBeenCalled();
    expect(verifyPurchaseWithProvider).toHaveBeenCalledWith({
      provider: 'iapkit',
      iapkit: {
        apiKey: 'test-api-key',
        baseUrl: 'http://192.168.0.10:3100',
        apple: {jws: 'apple-jws'},
      },
    });
    expect(verifyPurchaseWithProvider.mock.invocationCallOrder[0]).toBeLessThan(
      finishTransaction.mock.invocationCallOrder[0]!,
    );
  });

  it('verifies and finishes a restored Local IAPKit consumable exactly once without a success callback', async () => {
    Platform.OS = 'android';
    const restoredPurchase: Purchase = {
      id: 'transaction-restored-1',
      isAutoRenewing: false,
      productId: 'dev.hyo.martie.10bulbs',
      purchaseState: 'purchased',
      purchaseToken: 'google-token-restored-1',
      quantity: 1,
      store: 'google',
      transactionDate: Date.now(),
    };
    const verificationResult: VerifyPurchaseWithProviderResult = {
      provider: 'iapkit',
      iapkit: {
        isValid: true,
        productId: restoredPurchase.productId,
        state: 'ready-to-consume',
        store: 'google',
      },
    };
    const finishTransaction = jest.fn(
      (_options: MutationFinishTransactionArgs): Promise<void> =>
        Promise.resolve(),
    );
    const verifyPurchaseWithProvider = jest.fn(
      (
        _options: VerifyPurchaseWithProviderProps,
      ): Promise<VerifyPurchaseWithProviderResult> =>
        Promise.resolve(verificationResult),
    );

    mockIapState({
      availablePurchases: [restoredPurchase],
      finishTransaction,
      verifyPurchaseWithProvider,
    });
    const {rerender} = await render(<PurchaseFlow />);

    await waitFor(() => {
      expect(verifyPurchaseWithProvider).toHaveBeenCalledWith({
        provider: 'iapkit',
        iapkit: {
          apiKey: 'test-api-key',
          baseUrl: 'http://192.168.0.10:3100',
          google: {purchaseToken: 'google-token-restored-1'},
        },
      });
      expect(finishTransaction).toHaveBeenCalledWith({
        purchase: restoredPurchase,
        isConsumable: true,
      });
    });

    mockIapState({
      availablePurchases: [{...restoredPurchase}],
      finishTransaction,
      verifyPurchaseWithProvider,
    });
    await rerender(<PurchaseFlow />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    expect(finishTransaction).toHaveBeenCalledTimes(1);
    expect(verifyPurchaseWithProvider.mock.invocationCallOrder[0]).toBeLessThan(
      finishTransaction.mock.invocationCallOrder[0]!,
    );
  });

  it.each<{
    expectedMessage: string;
    label: string;
    result: VerifyPurchaseWithProviderResult;
  }>([
    {
      expectedMessage:
        'IAPKit rejected the purchase (state: consumed, store: google)',
      label: 'invalid',
      result: {
        provider: 'iapkit',
        iapkit: {
          isValid: false,
          productId: 'dev.hyo.martie.10bulbs',
          state: 'consumed',
          store: 'google',
        },
      },
    },
    {
      expectedMessage:
        'IAPKit verified dev.hyo.martie.30bulbs, expected dev.hyo.martie.10bulbs',
      label: 'for a different product',
      result: {
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          productId: 'dev.hyo.martie.30bulbs',
          state: 'ready-to-consume',
          store: 'google',
        },
      },
    },
  ])(
    'does not finish a restored Local IAPKit consumable when verification is $label',
    async ({expectedMessage, result}) => {
      Platform.OS = 'android';
      const restoredPurchase: Purchase = {
        id: `transaction-restored-${result.iapkit?.productId}`,
        isAutoRenewing: false,
        productId: 'dev.hyo.martie.10bulbs',
        purchaseState: 'purchased',
        purchaseToken: `google-token-restored-${result.iapkit?.productId}`,
        quantity: 1,
        store: 'google',
        transactionDate: Date.now(),
      };
      const finishTransaction = jest.fn(
        (_options: MutationFinishTransactionArgs): Promise<void> =>
          Promise.resolve(),
      );
      const verifyPurchaseWithProvider = jest.fn(
        (
          _options: VerifyPurchaseWithProviderProps,
        ): Promise<VerifyPurchaseWithProviderResult> => Promise.resolve(result),
      );

      mockIapState({
        availablePurchases: [restoredPurchase],
        finishTransaction,
        verifyPurchaseWithProvider,
      });
      const {getByText, queryByText} = await render(<PurchaseFlow />);

      await waitFor(() => {
        expect(
          getByText(`Purchase verification failed: ${expectedMessage}`),
        ).toBeTruthy();
      });

      expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
      expect(finishTransaction).not.toHaveBeenCalled();
      expect(
        queryByText(/Purchase completed and finished successfully/),
      ).toBeNull();
    },
  );

  it('deduplicates reconnect restoration and callback replay while verification is pending', async () => {
    Platform.OS = 'android';
    const purchase: Purchase = {
      id: 'transaction-reconnect-1',
      isAutoRenewing: false,
      productId: 'dev.hyo.martie.10bulbs',
      purchaseState: 'purchased',
      purchaseToken: 'google-token-reconnect-1',
      quantity: 1,
      store: 'google',
      transactionDate: Date.now(),
    };
    const verificationResult: VerifyPurchaseWithProviderResult = {
      provider: 'iapkit',
      iapkit: {
        isValid: true,
        productId: purchase.productId,
        state: 'ready-to-consume',
        store: 'google',
      },
    };
    const finishTransaction = jest.fn(
      (_options: MutationFinishTransactionArgs): Promise<void> =>
        Promise.resolve(),
    );
    let resolveVerification:
      ((value: VerifyPurchaseWithProviderResult) => void) | undefined;
    const verificationPromise = new Promise<VerifyPurchaseWithProviderResult>(
      (resolve) => {
        resolveVerification = resolve;
      },
    );
    const verifyPurchaseWithProvider = jest.fn(
      (
        _options: VerifyPurchaseWithProviderProps,
      ): Promise<VerifyPurchaseWithProviderResult> => verificationPromise,
    );

    mockIapState({
      availablePurchases: [],
      finishTransaction,
      verifyPurchaseWithProvider,
    });
    const {rerender} = await render(<PurchaseFlow />);
    const initialPurchaseSuccessHandler = onPurchaseSuccess;
    if (!initialPurchaseSuccessHandler) {
      throw new Error('Purchase success handler was not registered');
    }

    let initialProcessingPromise: Promise<void> | undefined;
    await act(async () => {
      initialProcessingPromise = Promise.resolve(
        initialPurchaseSuccessHandler(purchase),
      );
      await Promise.resolve();
    });

    expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    expect(finishTransaction).not.toHaveBeenCalled();

    mockIapState({
      connected: false,
      availablePurchases: [purchase],
      finishTransaction,
      verifyPurchaseWithProvider,
    });
    await rerender(<PurchaseFlow />);

    mockIapState({
      connected: true,
      availablePurchases: [{...purchase}],
      finishTransaction,
      verifyPurchaseWithProvider,
    });
    await rerender(<PurchaseFlow />);
    const replayedPurchaseSuccessHandler = onPurchaseSuccess;
    if (!replayedPurchaseSuccessHandler) {
      throw new Error('Purchase success handler was not registered');
    }

    let replayProcessingPromise: Promise<void> | undefined;
    await act(async () => {
      replayProcessingPromise = Promise.resolve(
        replayedPurchaseSuccessHandler({...purchase}),
      );
      await Promise.resolve();
    });

    expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    expect(finishTransaction).not.toHaveBeenCalled();

    if (
      !resolveVerification ||
      !initialProcessingPromise ||
      !replayProcessingPromise
    ) {
      throw new Error('Pending verification was not initialized');
    }
    const settleVerification = resolveVerification;
    const initialPromise = initialProcessingPromise;
    const replayPromise = replayProcessingPromise;

    await act(async () => {
      settleVerification(verificationResult);
      await Promise.all([initialPromise, replayPromise]);
    });

    mockIapState({
      connected: true,
      availablePurchases: [{...purchase}],
      finishTransaction,
      verifyPurchaseWithProvider,
    });
    await rerender(<PurchaseFlow />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    expect(finishTransaction).toHaveBeenCalledTimes(1);
    expect(finishTransaction).toHaveBeenCalledWith({
      purchase,
      isConsumable: true,
    });
    expect(verifyPurchaseWithProvider.mock.invocationCallOrder[0]).toBeLessThan(
      finishTransaction.mock.invocationCallOrder[0]!,
    );
  });

  it('does not finish after unmounting while IAPKit verification is pending', async () => {
    Platform.OS = 'android';
    const purchase: Purchase = {
      id: 'transaction-unmount-1',
      isAutoRenewing: false,
      productId: 'dev.hyo.martie.10bulbs',
      purchaseState: 'purchased',
      purchaseToken: 'google-token-unmount-1',
      quantity: 1,
      store: 'google',
      transactionDate: Date.now(),
    };
    const finishTransaction = jest.fn(
      (_options: MutationFinishTransactionArgs): Promise<void> =>
        Promise.resolve(),
    );
    let resolveVerification:
      ((value: VerifyPurchaseWithProviderResult) => void) | undefined;
    const verificationPromise = new Promise<VerifyPurchaseWithProviderResult>(
      (resolve) => {
        resolveVerification = resolve;
      },
    );
    const verifyPurchaseWithProvider = jest.fn(
      (
        _options: VerifyPurchaseWithProviderProps,
      ): Promise<VerifyPurchaseWithProviderResult> => verificationPromise,
    );

    mockIapState({
      availablePurchases: [],
      finishTransaction,
      verifyPurchaseWithProvider,
    });
    const {unmount} = await render(<PurchaseFlow />);
    const purchaseSuccessHandler = onPurchaseSuccess;
    if (!purchaseSuccessHandler) {
      throw new Error('Purchase success handler was not registered');
    }

    let processingPromise: Promise<void> | undefined;
    await act(async () => {
      processingPromise = Promise.resolve(purchaseSuccessHandler(purchase));
      await Promise.resolve();
    });

    expect(verifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    expect(finishTransaction).not.toHaveBeenCalled();

    await unmount();

    if (!resolveVerification || !processingPromise) {
      throw new Error('Pending verification was not initialized');
    }
    const settleVerification = resolveVerification;
    const pendingProcessing = processingPromise;

    await act(async () => {
      settleVerification({
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          productId: purchase.productId,
          state: 'ready-to-consume',
          store: 'google',
        },
      });
      await pendingProcessing;
    });

    expect(finishTransaction).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalledWith(
      '✅ Local (IAPKit) Verification',
      expect.any(String),
    );
  });

  it('does not duplicate verification or finish across a remount while native finish is pending', async () => {
    Platform.OS = 'android';
    const purchase: Purchase = {
      id: 'transaction-remount-pending-finish-1',
      isAutoRenewing: false,
      productId: 'dev.hyo.martie.10bulbs',
      purchaseState: 'purchased',
      purchaseToken: 'google-token-remount-pending-finish-1',
      quantity: 1,
      store: 'google',
      transactionDate: Date.now(),
    };
    let resolveFinish!: () => void;
    const pendingFinish = new Promise<void>((resolve) => {
      resolveFinish = resolve;
    });
    const finishTransaction = jest.fn(
      (_options: MutationFinishTransactionArgs): Promise<void> => pendingFinish,
    );
    const verifyPurchaseWithProvider = jest.fn(
      (
        _options: VerifyPurchaseWithProviderProps,
      ): Promise<VerifyPurchaseWithProviderResult> =>
        Promise.resolve({
          provider: 'iapkit',
          iapkit: {
            isValid: true,
            productId: purchase.productId,
            state: 'ready-to-consume',
            store: 'google',
          },
        }),
    );

    mockIapState({
      availablePurchases: [],
      finishTransaction,
      verifyPurchaseWithProvider,
    });
    const firstMount = await render(<PurchaseFlow />);
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
      verifyPurchaseWithProvider,
    });
    const secondMount = await render(<PurchaseFlow />);
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
    await secondMount.unmount();
  });

  it('remembers a finished purchase after its unmounted owner task fully settles', async () => {
    Platform.OS = 'android';
    const purchase: Purchase = {
      id: 'transaction-remount-after-owner-finish-1',
      isAutoRenewing: false,
      productId: 'dev.hyo.martie.10bulbs',
      purchaseState: 'purchased',
      purchaseToken: 'google-token-remount-after-owner-finish-1',
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
      (_options: MutationFinishTransactionArgs): Promise<void> => pendingFinish,
    );
    const verifyPurchaseWithProvider = jest.fn(
      (
        _options: VerifyPurchaseWithProviderProps,
      ): Promise<VerifyPurchaseWithProviderResult> =>
        Promise.resolve({
          provider: 'iapkit',
          iapkit: {
            isValid: true,
            productId: purchase.productId,
            state: 'ready-to-consume',
            store: 'google',
          },
        }),
    );
    let firstUnmount: (() => Promise<void>) | undefined;
    let secondUnmount: (() => Promise<void>) | undefined;
    let ownerTask: Promise<void> | undefined;

    try {
      mockIapState({
        availablePurchases: [],
        finishTransaction,
        verifyPurchaseWithProvider,
      });
      const firstMount = await render(<PurchaseFlow />);
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

      mockIapState({
        availablePurchases: [{...purchase}],
        finishTransaction,
        verifyPurchaseWithProvider,
      });
      const secondMount = await render(<PurchaseFlow />);
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
    } finally {
      await firstUnmount?.();
      await secondUnmount?.();
      if (!finishSettled) {
        resolveFinish();
        await ownerTask;
      }
    }
  });

  it('does not consume while IAPKit verification is pending', async () => {
    Platform.OS = 'android';
    const purchase = {
      id: 'transaction-race-1',
      productId: 'dev.hyo.martie.10bulbs',
      purchaseToken: 'google-token-race-1',
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
    const {rerender} = await render(<PurchaseFlow />);
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
    await rerender(<PurchaseFlow />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(finishTransaction).not.toHaveBeenCalled();

    await act(async () => {
      resolveVerification({
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          productId: 'dev.hyo.martie.10bulbs',
          state: 'ready-to-consume',
          store: 'google',
        },
      });
      await purchasePromise;
    });

    expect(finishTransaction).toHaveBeenCalledTimes(1);
    expect(finishTransaction).toHaveBeenCalledWith({
      purchase,
      isConsumable: true,
    });
  });

  it('does not finish or report success when IAPKit rejects a purchase', async () => {
    Platform.OS = 'android';
    const purchase = {
      id: 'transaction-invalid-1',
      productId: 'dev.hyo.martie.10bulbs',
      purchaseToken: 'google-token-invalid-1',
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
            productId: 'dev.hyo.martie.10bulbs',
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
    await render(<PurchaseFlow />);
    const purchaseSuccessHandler = onPurchaseSuccess;
    if (!purchaseSuccessHandler) {
      throw new Error('Purchase success handler was not registered');
    }

    await act(async () => {
      await purchaseSuccessHandler(purchase);
    });

    expect(finishTransaction).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Verification Failed',
      expect.stringContaining('state: consumed'),
    );
    expect(alertSpy).not.toHaveBeenCalledWith(
      'Success',
      'Purchase completed successfully!',
    );
  });

  it('keeps Local (Device) on direct Apple/Google verification', async () => {
    const selectorSpy = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_options, callback) => callback(0));
    const {finishTransaction, verifyPurchase, verifyPurchaseWithProvider} =
      mockIapState();
    const {getByText} = await render(<PurchaseFlow />);

    await fireEvent.press(getByText('Local (IAPKit)'));
    await waitFor(() => {
      expect(getByText('Local (Device)')).toBeTruthy();
    });

    await act(async () => {
      await onPurchaseSuccess?.({
        id: 'transaction-device-1',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'device-apple-jws',
        store: 'apple',
        transactionDate: Date.now(),
        purchaseState: 'purchased',
      });
    });

    expect(verifyPurchase).toHaveBeenCalledWith({
      apple: {sku: 'dev.hyo.martie.10bulbs'},
      google: {
        sku: 'dev.hyo.martie.10bulbs',
        accessToken: 'YOUR_OAUTH_ACCESS_TOKEN',
        packageName: 'dev.hyo.martie',
        purchaseToken: 'device-apple-jws',
        isSub: false,
      },
    });
    expect(verifyPurchaseWithProvider).not.toHaveBeenCalled();
    expect(verifyPurchase.mock.invocationCallOrder[0]).toBeLessThan(
      finishTransaction.mock.invocationCallOrder[0]!,
    );

    selectorSpy.mockRestore();
  });

  it('omits the local base URL when hosted IAPKit is selected', async () => {
    const selectorSpy = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_options, callback) => callback(2));
    const {verifyPurchaseWithProvider} = mockIapState();
    const {getByText} = await render(<PurchaseFlow />);

    await fireEvent.press(getByText('Local (IAPKit)'));
    await waitFor(() => {
      expect(getByText('IAPKit')).toBeTruthy();
    });

    await act(async () => {
      await onPurchaseSuccess?.({
        id: 'transaction-2',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'hosted-apple-jws',
        store: 'apple',
        transactionDate: Date.now(),
        purchaseState: 'purchased',
      });
    });

    expect(verifyPurchaseWithProvider).toHaveBeenCalledWith({
      provider: 'iapkit',
      iapkit: {
        apiKey: 'test-api-key',
        apple: {jws: 'hosted-apple-jws'},
      },
    });

    selectorSpy.mockRestore();
  });

  it('renders Android verification choices together in the requested order', async () => {
    Platform.OS = 'android';
    const {getAllByTestId, getByText} = await render(<PurchaseFlow />);

    await fireEvent.press(getByText('Local (IAPKit)'));

    const options = getAllByTestId('verification-method-option');
    expect(options.map((option) => option.props.accessibilityLabel)).toEqual([
      'Local (Device)',
      'Local (IAPKit)',
      'IAPKit',
      'None (Skip)',
    ]);

    await fireEvent.press(options[3]!);
    await waitFor(() => {
      expect(getByText('None (Skip)')).toBeTruthy();
    });
  });

  it('updates state on purchase success callback', async () => {
    const {finishTransaction} = mockIapState();

    const {getByText, queryByText} = await render(<PurchaseFlow />);

    expect(
      queryByText(/Purchase completed and finished successfully/),
    ).toBeNull();

    await act(async () => {
      await onPurchaseSuccess?.({
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'token-123',
        purchaseState: 'purchased',
        transactionDate: Date.now(),
      });
    });

    await waitFor(() => {
      expect(
        getByText(/Purchase completed and finished successfully/),
      ).toBeTruthy();
    });
    expect(finishTransaction).toHaveBeenCalledWith({
      purchase: expect.objectContaining({
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'token-123',
      }),
      isConsumable: true,
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Success',
      'Purchase completed successfully!',
    );
  });

  it('updates message on purchase error callback', async () => {
    mockIapState();

    const {getByText} = await render(<PurchaseFlow />);

    await act(async () => {
      onPurchaseError?.({
        code: ErrorCode.NetworkError,
        message: 'Something went wrong',
      });
    });

    await waitFor(() => {
      expect(
        getByText(
          `Purchase failed: Something went wrong (code: ${ErrorCode.NetworkError})`,
        ),
      ).toBeTruthy();
    });
  });

  it('handles user cancelled error correctly', async () => {
    mockIapState();

    const {getByText} = await render(<PurchaseFlow />);

    await act(async () => {
      onPurchaseError?.({
        code: ErrorCode.UserCancelled,
        message: 'User cancelled the purchase',
      });
    });

    await waitFor(() => {
      expect(getByText('Purchase cancelled by user')).toBeTruthy();
    });
  });

  // Android discount offers tests (cross-platform)
  describe('Android Discount Offers (Cross-platform)', () => {
    it('displays product details modal with discount offers', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Product Details')).toBeTruthy();
        expect(getByText('Discount Offers (2)')).toBeTruthy();
      });
    });

    it('displays offer with percentage discount', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('20% off')).toBeTruthy();
      });
    });

    it('displays offer with full price when discounted', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Full Price (micros):')).toBeTruthy();
        expect(getByText('990000')).toBeTruthy();
      });
    });

    it('displays limited quantity info', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Limited Quantity:')).toBeTruthy();
        expect(getByText('45 / 100 remaining')).toBeTruthy();
      });
    });

    it('displays valid time window', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Valid Window:')).toBeTruthy();
      });
    });

    it('displays offer tags', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getAllByText('Tags:').length).toBeGreaterThanOrEqual(1);
        expect(getByText('sale, limited')).toBeTruthy();
      });
    });

    it('displays preorder details', async () => {
      mockIapState({products: [androidProductWithPreorder]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Pre-order Release:')).toBeTruthy();
      });
    });

    it('displays rental details', async () => {
      mockIapState({products: [androidProductWithRental]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Rental:')).toBeTruthy();
        expect(getByText('Period: P30D')).toBeTruthy();
      });
    });

    it('displays formatted discount amount', async () => {
      mockIapState({products: [androidProductWithAbsoluteDiscount]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('$1.00')).toBeTruthy();
      });
    });

    it('closes modal when close button pressed', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText, queryByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('Product Details')).toBeTruthy();
      });

      // Close modal
      await fireEvent.press(getByText('Close'));

      await waitFor(() => {
        expect(queryByText('Discount Offers (2)')).toBeNull();
      });
    });

    it('displays offer ID when present', async () => {
      mockIapState({products: [androidProductWithOffers]});

      const {getByText, getAllByText} = await render(<PurchaseFlow />);

      // Open modal
      const detailsButton = getAllByText('Details')[0];
      await fireEvent.press(detailsButton!);

      await waitFor(() => {
        expect(getByText('base-offer')).toBeTruthy();
        expect(getByText('discount-offer')).toBeTruthy();
      });
    });
  });
});
