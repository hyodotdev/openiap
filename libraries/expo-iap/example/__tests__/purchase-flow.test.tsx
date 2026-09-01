import React from 'react';
import {act, render, fireEvent, waitFor} from '@testing-library/react-native';
import PurchaseFlow from '../app/purchase-flow';
import {
  requestPurchase,
  getPendingTransactionsIOS,
  getStorefront,
} from '../../src';

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

// Mock the useIAP hook
const mockFetchProducts = jest.fn();
const mockGetAvailablePurchases = jest.fn();
const mockFinishTransaction = jest.fn();
const mockVerifyPurchase = jest.fn();
const mockVerifyPurchaseWithProvider = jest.fn();
let mockOnPurchaseSuccess:
  | ((purchase: Record<string, unknown>) => Promise<void> | void)
  | undefined;
const mockUseIAP = {
  connected: true,
  products: [
    {
      id: 'dev.hyo.martie.10bulbs',
      title: 'Test Product',
      description: 'Test Description',
      price: '$0.99',
      displayPrice: '$0.99',
      currency: 'USD',
      platform: 'ios',
    },
  ],
  availablePurchases: [] as Record<string, unknown>[],
  fetchProducts: mockFetchProducts,
  finishTransaction: mockFinishTransaction,
  getAvailablePurchases: mockGetAvailablePurchases,
  verifyPurchase: mockVerifyPurchase,
  verifyPurchaseWithProvider: mockVerifyPurchaseWithProvider,
};

jest.mock('../../src', () => ({
  useIAP: jest.fn(
    (options?: {onPurchaseSuccess?: typeof mockOnPurchaseSuccess}) => {
      mockOnPurchaseSuccess = options?.onPurchaseSuccess;
      return mockUseIAP;
    },
  ),
  requestPurchase: jest.fn(() => Promise.resolve()),
  getAppTransactionIOS: jest.fn(),
  getPendingTransactionsIOS: jest.fn(),
  getStorefront: jest.fn(),
}));

describe('PurchaseFlow Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShowActionSheetWithOptions.mockReset();
    mockFetchProducts.mockResolvedValue([]);
    mockGetAvailablePurchases.mockResolvedValue([]);
    (getPendingTransactionsIOS as jest.Mock).mockResolvedValue([]);
    mockFinishTransaction.mockResolvedValue(undefined);
    mockVerifyPurchase.mockResolvedValue({});
    mockVerifyPurchaseWithProvider.mockResolvedValue({
      iapkit: {
        isValid: true,
        productId: 'dev.hyo.martie.10bulbs',
        state: 'ready-to-consume',
        store: 'apple',
      },
    });
    mockUseIAP.connected = true;
    mockUseIAP.availablePurchases = [];
    mockOnPurchaseSuccess = undefined;
    (getStorefront as jest.Mock).mockResolvedValue('US');
  });

  it('should render without crashing', async () => {
    const {getByText} = await render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());
    expect(getByText('In-App Purchase Flow')).toBeDefined();
    expect(getByText('Available Purchases')).toBeDefined();
  });

  it('should show connected status', async () => {
    const {getByText} = await render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());
    // Look for the text that contains "Connected"
    expect(getByText(/✅ Connected/)).toBeDefined();
  });

  it('should load products on mount', async () => {
    await render(<PurchaseFlow />);
    await waitFor(() => expect(mockFetchProducts).toHaveBeenCalled());
    expect(getStorefront).toHaveBeenCalled();
  });

  it('should display products', async () => {
    const {getByText} = await render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());
    expect(getByText('Test Product')).toBeDefined();
    // The price is rendered by getProductDisplayPrice which returns displayPrice
    expect(getByText('Test Description')).toBeDefined();
    expect(getByText('Local (IAPKit)')).toBeDefined();
  });

  it('shows verification choices in the requested order', async () => {
    const {getByText} = await render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());

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

  it('should fetch and show storefront information', async () => {
    (getStorefront as jest.Mock).mockResolvedValue('KR');
    const {getByText} = await render(<PurchaseFlow />);

    await waitFor(() => expect(getStorefront).toHaveBeenCalled());
    await waitFor(() => expect(getByText('KR')).toBeDefined());
    expect(getByText(/Storefront:/)).toBeDefined();
  });

  it('should handle purchase button click', async () => {
    const {getByText} = await render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());

    const purchaseButton = getByText('Purchase');
    await fireEvent.press(purchaseButton);

    // The actual call includes store-specific request structure
    expect(requestPurchase).toHaveBeenCalledWith({
      request: {
        apple: {sku: 'dev.hyo.martie.10bulbs', quantity: 1},
        google: {skus: ['dev.hyo.martie.10bulbs']},
      },
      type: 'in-app',
    });
  });

  it('routes Local (IAPKit) through the configured local server', async () => {
    await render(<PurchaseFlow />);

    await act(async () => {
      await mockOnPurchaseSuccess?.({
        id: 'transaction-1',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'apple-jws',
        store: 'apple',
        transactionDate: Date.now(),
        purchaseState: 'purchased',
      });
    });

    expect(mockVerifyPurchase).not.toHaveBeenCalled();
    expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledWith({
      provider: 'iapkit',
      iapkit: {
        apiKey: 'test-api-key',
        baseUrl: 'http://192.168.0.10:3100',
        apple: {jws: 'apple-jws'},
      },
    });
    expect(
      mockVerifyPurchaseWithProvider.mock.invocationCallOrder[0],
    ).toBeLessThan(mockFinishTransaction.mock.invocationCallOrder[0]!);
  });

  it('recovers unfinished iOS purchases through the verification queue', async () => {
    (getPendingTransactionsIOS as jest.Mock).mockResolvedValueOnce([
      {
        id: 'pending-transaction-1',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'pending-apple-jws',
        store: 'apple',
        transactionDate: Date.now(),
        purchaseState: 'purchased',
      },
    ]);

    await render(<PurchaseFlow />);

    await waitFor(() =>
      expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledWith({
        provider: 'iapkit',
        iapkit: expect.objectContaining({
          baseUrl: 'http://192.168.0.10:3100',
          apple: {jws: 'pending-apple-jws'},
        }),
      }),
    );
    await waitFor(() => expect(mockFinishTransaction).toHaveBeenCalled());
  });

  it('finishes a ready-to-consume Google consumable after verification', async () => {
    mockVerifyPurchaseWithProvider.mockResolvedValue({
      provider: 'iapkit',
      iapkit: {
        isValid: true,
        productId: 'dev.hyo.martie.10bulbs',
        state: 'ready-to-consume',
        store: 'google',
      },
    });
    const purchase = {
      id: 'google-consumable-1',
      productId: 'dev.hyo.martie.10bulbs',
      purchaseToken: 'google-token-1',
      store: 'google',
      transactionDate: Date.now(),
      purchaseState: 'purchased',
    };

    await render(<PurchaseFlow />);
    await act(async () => {
      await mockOnPurchaseSuccess?.(purchase);
    });

    expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledWith({
      provider: 'iapkit',
      iapkit: {
        apiKey: 'test-api-key',
        baseUrl: 'http://192.168.0.10:3100',
        google: {purchaseToken: 'google-token-1'},
      },
    });
    expect(mockFinishTransaction).toHaveBeenCalledWith({
      purchase,
      isConsumable: true,
    });
  });

  it('does not refresh or re-enqueue after finishing persistently fails', async () => {
    mockFinishTransaction.mockRejectedValue(new Error('finish failed'));
    const purchase = {
      id: 'finish-failure-1',
      productId: 'dev.hyo.martie.10bulbs',
      purchaseToken: 'finish-failure-jws',
      store: 'apple',
      transactionDate: Date.now(),
      purchaseState: 'purchased',
    };

    await render(<PurchaseFlow />);
    await waitFor(() => {
      expect(mockGetAvailablePurchases).toHaveBeenCalledTimes(1);
    });
    mockGetAvailablePurchases.mockClear();

    await act(async () => {
      await mockOnPurchaseSuccess?.(purchase);
    });

    expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    expect(mockFinishTransaction).toHaveBeenCalledTimes(1);
    expect(mockGetAvailablePurchases).not.toHaveBeenCalled();
  });

  it('keeps Local (Device) on direct Apple/Google verification', async () => {
    mockShowActionSheetWithOptions.mockImplementation(
      (_options: unknown, callback: (index?: number) => void) => callback(0),
    );
    const {getByText} = await render(<PurchaseFlow />);

    await fireEvent.press(getByText('Local (IAPKit)'));
    await waitFor(() => {
      expect(getByText('Local (Device)')).toBeDefined();
    });

    await act(async () => {
      await mockOnPurchaseSuccess?.({
        id: 'transaction-device-1',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'device-apple-jws',
        store: 'apple',
        transactionDate: Date.now(),
        purchaseState: 'purchased',
      });
    });

    expect(mockVerifyPurchase).toHaveBeenCalledWith({
      apple: {sku: 'dev.hyo.martie.10bulbs'},
      google: {
        sku: 'dev.hyo.martie.10bulbs',
        packageName: 'dev.hyo.martie',
        purchaseToken: 'device-apple-jws',
        accessToken: '',
      },
    });
    expect(mockVerifyPurchaseWithProvider).not.toHaveBeenCalled();
    expect(mockVerifyPurchase.mock.invocationCallOrder[0]).toBeLessThan(
      mockFinishTransaction.mock.invocationCallOrder[0]!,
    );
  });

  it('omits the local base URL when hosted IAPKit is selected', async () => {
    mockShowActionSheetWithOptions.mockImplementation(
      (_options: unknown, callback: (index?: number) => void) => callback(2),
    );
    const {getByText} = await render(<PurchaseFlow />);

    await fireEvent.press(getByText('Local (IAPKit)'));
    await waitFor(() => {
      expect(getByText('IAPKit')).toBeDefined();
    });

    await act(async () => {
      await mockOnPurchaseSuccess?.({
        id: 'transaction-2',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'hosted-apple-jws',
        store: 'apple',
        transactionDate: Date.now(),
        purchaseState: 'purchased',
      });
    });

    expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledWith({
      provider: 'iapkit',
      iapkit: {
        apiKey: 'test-api-key',
        apple: {jws: 'hosted-apple-jws'},
      },
    });
  });

  it.each([
    {
      label: 'an invalid result',
      result: {
        provider: 'iapkit',
        iapkit: {
          isValid: false,
          productId: 'dev.hyo.martie.10bulbs',
          state: 'consumed',
          store: 'apple',
        },
      },
    },
    {
      label: 'a mismatched product',
      result: {
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          productId: 'dev.hyo.martie.30bulbs',
          state: 'ready-to-consume',
          store: 'apple',
        },
      },
    },
  ])('does not finish after $label', async ({result}) => {
    mockVerifyPurchaseWithProvider.mockResolvedValue(result);
    await render(<PurchaseFlow />);

    await act(async () => {
      await mockOnPurchaseSuccess?.({
        id: 'transaction-rejected-1',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'rejected-apple-jws',
        store: 'apple',
        transactionDate: Date.now(),
        purchaseState: 'purchased',
      });
    });

    expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    expect(mockFinishTransaction).not.toHaveBeenCalled();
  });

  it('verifies a restored purchase and keeps a rejected one unfinished', async () => {
    mockUseIAP.availablePurchases = [
      {
        id: 'restored-transaction-1',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'restored-apple-jws',
        store: 'apple',
        transactionDate: Date.now(),
        purchaseState: 'purchased',
      },
    ];
    mockVerifyPurchaseWithProvider.mockResolvedValue({
      provider: 'iapkit',
      iapkit: {
        isValid: false,
        productId: 'dev.hyo.martie.10bulbs',
        state: 'consumed',
        store: 'apple',
      },
    });

    await render(<PurchaseFlow />);

    await waitFor(() => {
      expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    });
    expect(mockFinishTransaction).not.toHaveBeenCalled();
  });

  it('verifies and finishes multiple restored purchases sequentially', async () => {
    mockUseIAP.availablePurchases = [
      {
        id: 'restored-transaction-10',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'restored-10-jws',
        store: 'apple',
        transactionDate: Date.now(),
        purchaseState: 'purchased',
      },
      {
        id: 'restored-transaction-30',
        productId: 'dev.hyo.martie.30bulbs',
        purchaseToken: 'restored-30-jws',
        store: 'apple',
        transactionDate: Date.now() + 1,
        purchaseState: 'purchased',
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
            token === 'restored-30-jws'
              ? 'dev.hyo.martie.30bulbs'
              : 'dev.hyo.martie.10bulbs',
          state: 'ready-to-consume',
          store: 'apple',
        },
      });
    });

    await render(<PurchaseFlow />);

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

  it('keeps a preclaimed restore queue intact across an available-purchases rerender', async () => {
    const restoredPurchases = [
      {
        id: 'rerender-restored-10',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'rerender-restored-10-jws',
        store: 'apple',
        transactionDate: Date.now(),
        purchaseState: 'purchased',
      },
      {
        id: 'rerender-restored-30',
        productId: 'dev.hyo.martie.30bulbs',
        purchaseToken: 'rerender-restored-30-jws',
        store: 'apple',
        transactionDate: Date.now() + 1,
        purchaseState: 'purchased',
      },
    ];
    const firstResult = {
      provider: 'iapkit',
      iapkit: {
        isValid: true,
        productId: 'dev.hyo.martie.10bulbs',
        state: 'ready-to-consume',
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
      if (token === 'rerender-restored-10-jws') return firstVerification;
      return Promise.resolve({
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          productId: 'dev.hyo.martie.30bulbs',
          state: 'ready-to-consume',
          store: 'apple',
        },
      });
    });
    mockUseIAP.availablePurchases = restoredPurchases;

    const {rerender} = await render(<PurchaseFlow />);
    await waitFor(() => {
      expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    });

    mockUseIAP.availablePurchases = restoredPurchases.map((purchase) => ({
      ...purchase,
    }));
    await rerender(<PurchaseFlow />);
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

  it('keeps an in-flight restored purchase deduped across reconnect', async () => {
    const restoredPurchase = {
      id: 'reconnect-restored-10',
      productId: 'dev.hyo.martie.10bulbs',
      purchaseToken: 'reconnect-restored-10-jws',
      store: 'apple',
      transactionDate: Date.now(),
      purchaseState: 'purchased',
    };
    const result = {
      provider: 'iapkit',
      iapkit: {
        isValid: true,
        productId: 'dev.hyo.martie.10bulbs',
        state: 'ready-to-consume',
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
    mockUseIAP.availablePurchases = [restoredPurchase];

    const {rerender} = await render(<PurchaseFlow />);
    await waitFor(() => {
      expect(mockVerifyPurchaseWithProvider).toHaveBeenCalledTimes(1);
    });

    mockUseIAP.connected = false;
    mockUseIAP.availablePurchases = [];
    await rerender(<PurchaseFlow />);
    mockUseIAP.connected = true;
    mockUseIAP.availablePurchases = [{...restoredPurchase}];
    await rerender(<PurchaseFlow />);

    if (!resolveVerification) {
      throw new Error('restored purchase verification was not pending');
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
    const purchase = {
      id: 'remount-pending-finish-10',
      productId: 'dev.hyo.martie.10bulbs',
      purchaseToken: 'remount-pending-finish-10-jws',
      store: 'apple',
      transactionDate: Date.now(),
      purchaseState: 'purchased',
    };
    let resolveFinish: (() => void) | undefined;
    mockFinishTransaction.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFinish = resolve;
        }),
    );

    const firstMount = await render(<PurchaseFlow />);
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

    mockUseIAP.availablePurchases = [{...purchase}];
    const secondMount = await render(<PurchaseFlow />);
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

  it('serializes two overlapping live purchase callbacks', async () => {
    const purchases = [
      {
        id: 'live-purchase-10',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'live-purchase-10-jws',
        store: 'apple',
        transactionDate: Date.now(),
        purchaseState: 'purchased',
      },
      {
        id: 'live-purchase-30',
        productId: 'dev.hyo.martie.30bulbs',
        purchaseToken: 'live-purchase-30-jws',
        store: 'apple',
        transactionDate: Date.now() + 1,
        purchaseState: 'purchased',
      },
    ];
    const firstResult = {
      provider: 'iapkit',
      iapkit: {
        isValid: true,
        productId: 'dev.hyo.martie.10bulbs',
        state: 'ready-to-consume',
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
      if (token === 'live-purchase-10-jws') return firstVerification;
      return Promise.resolve({
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          productId: 'dev.hyo.martie.30bulbs',
          state: 'ready-to-consume',
          store: 'apple',
        },
      });
    });
    await render(<PurchaseFlow />);
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
