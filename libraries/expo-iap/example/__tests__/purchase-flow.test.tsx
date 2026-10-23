import {
  ErrorCode,
  type ExpoPurchaseError,
  type Purchase,
  type PurchaseFlowStatus,
  type UseIAPOptions,
} from '../../src';
import React from 'react';
import {Alert, Platform} from 'react-native';
import {
  act,
  render,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react-native';
import PurchaseFlow from '../app/purchase-flow';
import {requestPurchase, getStorefront} from '../../src';
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

// Mock the useIAP hook
const mockFetchProducts = jest.fn();
const mockGetAvailablePurchases = jest.fn();
let mockOptions: UseIAPOptions | undefined;
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
  getAvailablePurchases: mockGetAvailablePurchases,
};

jest.mock('../../src', () => ({
  ...jest.requireActual('../../src/purchase-flow'),
  ErrorCode: jest.requireActual('../../src/types').ErrorCode,
  createPurchaseFlow: jest.fn(() => ({
    processPurchase: jest.fn(),
    recoverPurchases: jest.fn(() => Promise.resolve([])),
    subscribe: jest.fn(() => jest.fn()),
    dispose: jest.fn(),
  })),
  useIAP: jest.fn((options?: UseIAPOptions) => {
    mockOptions = options;
    return mockUseIAP;
  }),
  requestPurchase: jest.fn(() => Promise.resolve()),
  getAppTransactionIOS: jest.fn(),
  getPendingTransactionsIOS: jest.fn(),
  getStorefront: jest.fn(),
}));

const bulbs: Purchase = {
  id: 'transaction-1',
  productId: 'dev.hyo.martie.10bulbs',
  purchaseToken: 'apple-jws',
  purchaseState: 'purchased',
  quantity: 1,
  isAutoRenewing: false,
  transactionDate: 1,
  store: 'apple',
  storeId: 'apple',
};

async function report(
  purchase: Purchase,
  status: PurchaseFlowStatus,
): Promise<void> {
  await act(async () => {
    mockOptions?.onPurchaseFlowOutcome?.({purchase, status});
  });
}

describe('PurchaseFlow Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShowActionSheetWithOptions.mockReset();
    mockFetchProducts.mockResolvedValue([]);
    mockGetAvailablePurchases.mockResolvedValue([]);
    mockUseIAP.connected = true;
    mockUseIAP.availablePurchases = [];
    mockOptions = undefined;
    (getStorefront as jest.Mock).mockResolvedValue('US');
  });

  it('should render without crashing', async () => {
    const {getByText} = await render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());
    expect(getByText('Pay, verify, finish')).toBeDefined();
    expect(getByText('Available Purchases')).toBeDefined();
  });

  it('should show connected status', async () => {
    const {getByText} = await render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());
    // Look for the text that contains "Connected"
    expect(getByText(/✅ Connected/)).toBeDefined();
  });

  it.each([
    [ErrorCode.UserCancelled, 'Skipped'],
    [ErrorCode.DeferredPayment, 'Waiting'],
    [ErrorCode.NetworkError, 'Needs retry'],
  ])(
    'shows native store callback %s as %s after request dispatch resolves',
    async (code, state) => {
      const screen = await render(<PurchaseFlow />);
      await waitFor(() => expect(getStorefront).toHaveBeenCalled());
      await fireEvent.press(
        screen.getByRole('button', {name: /Show purchase steps/}),
      );
      await fireEvent.press(
        screen.getByRole('button', {name: 'Purchase Test Product'}),
      );
      await act(async () => {
        mockOptions?.onPurchaseError?.(
          Object.assign(new Error('Store response'), {code}),
        );
      });
      expect(
        within(screen.getByTestId('purchase-step-store')).getByText(state),
      ).toBeTruthy();
      expect(
        within(screen.getByTestId('purchase-step-finish')).getByText(
          'Not observed',
        ),
      ).toBeTruthy();
    },
  );

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

  it('leaves out App backend on Vega, whose expo-iap has no purchase flow', async () => {
    const previous = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', {
      get: () => 'kepler',
      configurable: true,
    });
    try {
      mockShowActionSheetWithOptions.mockImplementation(
        (_options: unknown, callback: (index: number) => void) => callback(4),
      );
      const screen = await render(<PurchaseFlow />);

      await fireEvent.press(screen.getByText('Local (IAPKit)'));

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
      expect(
        screen.queryByRole('button', {name: 'Change purchase confirmation'}),
      ).toBeNull();
      expect(screen.getByText('Local (IAPKit)')).toBeTruthy();
    } finally {
      if (previous) Object.defineProperty(Platform, 'OS', previous);
    }
  });

  it('explains confirmation and mounts only its selected purchase path', async () => {
    const screen = await render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());
    const receiptFlow = getReceiptPurchaseFlow();

    expect(screen.getByText('Receipt checks')).toBeTruthy();
    mockShowActionSheetWithOptions.mockImplementation(
      (_options: unknown, callback: (index: number) => void) => callback(1),
    );
    await fireEvent.press(
      screen.getByRole('button', {name: 'Change purchase confirmation'}),
    );

    expect(screen.getByText('Set up your app backend')).toBeTruthy();
    expect(receiptFlow.dispose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Receipt verification')).toBeNull();
    expect(screen.getByText('Your app backend')).toBeTruthy();
    expect(mockShowActionSheetWithOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Purchase confirmation',
        options: ['Receipt checks', 'Your app backend', 'Cancel'],
      }),
      expect.any(Function),
    );
    mockShowActionSheetWithOptions.mockImplementation(
      (_options: unknown, callback: (index: number) => void) => callback(0),
    );
    await fireEvent.press(
      screen.getByRole('button', {name: 'Change purchase confirmation'}),
    );
    expect(screen.queryByText('Set up your app backend')).toBeNull();
    expect(screen.getByText('Receipt verification')).toBeTruthy();
    expect(mockOptions?.purchaseFlow).not.toBe(receiptFlow);
    mockShowActionSheetWithOptions.mockImplementation(
      (_options: unknown, callback: (index: number) => void) => callback(2),
    );
    await fireEvent.press(
      screen.getByRole('button', {name: 'Change purchase confirmation'}),
    );
    expect(screen.getByText('Receipt checks')).toBeTruthy();
  });

  it('hands the shared receipt-check flow to useIAP', async () => {
    await render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());

    expect(mockOptions?.purchaseFlow).toBe(getReceiptPurchaseFlow());
  });

  it('stays processing until the requested product has an outcome', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = await render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());
    await fireEvent.press(
      screen.getByRole('button', {name: /Show purchase steps/}),
    );

    await fireEvent.press(screen.getByText('Purchase'));
    expect(screen.getByText('Processing...')).toBeTruthy();

    await report(
      {...bulbs, id: 'recovered', productId: 'dev.hyo.martie.30bulbs'},
      {status: 'entitled', alreadyGranted: false},
    );
    expect(screen.getByText('Processing...')).toBeTruthy();

    await report(bulbs, {status: 'entitled', alreadyGranted: false});
    expect(screen.queryByText('Processing...')).toBeNull();
    expect(screen.getByText('Purchase verified. Access granted.')).toBeTruthy();
    expect(alertSpy).toHaveBeenCalledWith(
      'Success',
      'Purchase completed successfully!',
    );
    for (const step of ['store', 'confirmation', 'finish']) {
      expect(
        within(screen.getByTestId(`purchase-step-${step}`)).getByText(
          'Completed',
        ),
      ).toBeTruthy();
    }
  });

  it('ignores outcomes for products outside this screen', async () => {
    const screen = await render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());

    await fireEvent.press(screen.getByText('Purchase'));
    await report(
      {...bulbs, productId: 'dev.hyo.martie.premium'},
      {status: 'failed', error: new Error('offline')},
    );

    expect(screen.getByText('Processing purchase...')).toBeTruthy();
    expect(screen.getByText('Processing...')).toBeTruthy();
  });

  it('shows a failed verification and a finish that needs retry', async () => {
    const screen = await render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());

    await report(bulbs, {status: 'failed', error: new Error('offline')});
    expect(
      screen.getByText('Purchase verification failed: offline'),
    ).toBeTruthy();

    await report(bulbs, {
      status: 'entitled',
      alreadyGranted: false,
      finishError: new Error('store busy'),
    });
    expect(
      screen.getByText(
        'Purchase verified. Access granted. finishTransaction failed: store busy',
      ),
    ).toBeTruthy();
  });

  it('retains a receipt in None mode and recovers it after a method is chosen', async () => {
    mockShowActionSheetWithOptions.mockImplementation(
      (_options: unknown, callback: (index: number) => void) => callback(3),
    );
    const screen = await render(<PurchaseFlow />);
    await fireEvent.press(screen.getByText('Local (IAPKit)'));
    expect(getReceiptPurchaseFlow().recoverPurchases).not.toHaveBeenCalled();
    await report(bulbs, {status: 'verified'});
    expect(screen.getByText(/Receipt retained/)).toBeTruthy();

    mockShowActionSheetWithOptions.mockImplementation(
      (_options: unknown, callback: (index: number) => void) => callback(1),
    );
    await fireEvent.press(screen.getByText('None (Skip)'));
    expect(screen.getByText('Local (IAPKit)')).toBeTruthy();
    expect(getReceiptPurchaseFlow().recoverPurchases).toHaveBeenCalledTimes(1);
  });

  it('releases processing when the request itself fails', async () => {
    (requestPurchase as jest.Mock).mockRejectedValueOnce({
      code: ErrorCode.NetworkError,
      message: 'Store unavailable',
    });
    const screen = await render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());

    await fireEvent.press(screen.getByText('Purchase'));

    expect(screen.queryByText('Processing...')).toBeNull();
    expect(screen.getByText(/Purchase failed:/)).toBeTruthy();
  });

  it('releases processing on a purchase error', async () => {
    const screen = await render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());

    await fireEvent.press(screen.getByText('Purchase'));
    await act(async () => {
      mockOptions?.onPurchaseError?.({
        code: ErrorCode.UserCancelled,
        message: 'Cancelled',
      } as ExpoPurchaseError);
    });

    expect(screen.queryByText('Processing...')).toBeNull();
    expect(screen.getByText('Purchase cancelled by user')).toBeTruthy();
  });

  it('keeps the selected method across a remount', async () => {
    mockShowActionSheetWithOptions.mockImplementation(
      (_options: unknown, callback: (index: number) => void) => callback(2),
    );
    const first = await render(<PurchaseFlow />);
    await fireEvent.press(first.getByText('Local (IAPKit)'));
    await first.unmount();

    const second = await render(<PurchaseFlow />);
    expect(second.getByText('IAPKit')).toBeTruthy();
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

  it('opens one purchase when presses arrive before the button rerenders', async () => {
    let rejectPurchase!: (error: unknown) => void;
    (requestPurchase as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectPurchase = reject;
        }),
    );
    const {getByText} = await render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());
    const button = getByText('Purchase');
    let target = button.unstable_fiber;
    while (target && typeof target.memoizedProps?.onPress !== 'function') {
      target = target.return;
    }
    const press = target!.memoizedProps.onPress as () => void;

    await act(async () => {
      press();
      press();
    });

    expect(requestPurchase).toHaveBeenCalledTimes(1);
    await act(async () => {
      rejectPurchase({code: 'user-cancelled', message: 'Cancelled'});
    });
    await fireEvent.press(getByText('Purchase'));
    expect(requestPurchase).toHaveBeenCalledTimes(2);
  });
});
