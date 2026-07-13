import React from 'react';
import {act, render, fireEvent, waitFor} from '@testing-library/react-native';
import PurchaseFlow from '../app/purchase-flow';
import {requestPurchase, getStorefront} from '../../src';

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
  availablePurchases: [],
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
  getStorefront: jest.fn(),
}));

describe('PurchaseFlow Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShowActionSheetWithOptions.mockReset();
    mockFetchProducts.mockResolvedValue([]);
    mockGetAvailablePurchases.mockResolvedValue([]);
    mockFinishTransaction.mockResolvedValue(undefined);
    mockVerifyPurchase.mockResolvedValue({});
    mockVerifyPurchaseWithProvider.mockResolvedValue({
      iapkit: {
        isValid: true,
        state: 'purchased',
        store: 'apple',
      },
    });
    mockOnPurchaseSuccess = undefined;
    (getStorefront as jest.Mock).mockResolvedValue('US');
  });

  it('should render without crashing', async () => {
    const {getByText} = render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());
    expect(getByText('In-App Purchase Flow')).toBeDefined();
    expect(getByText('Available Purchases')).toBeDefined();
  });

  it('should show connected status', async () => {
    const {getByText} = render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());
    // Look for the text that contains "Connected"
    expect(getByText(/✅ Connected/)).toBeDefined();
  });

  it('should load products on mount', async () => {
    render(<PurchaseFlow />);
    await waitFor(() => expect(mockFetchProducts).toHaveBeenCalled());
    expect(getStorefront).toHaveBeenCalled();
  });

  it('should display products', async () => {
    const {getByText} = render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());
    expect(getByText('Test Product')).toBeDefined();
    // The price is rendered by getProductDisplayPrice which returns displayPrice
    expect(getByText('Test Description')).toBeDefined();
    expect(getByText('Local (IAPKit)')).toBeDefined();
  });

  it('shows verification choices in the requested order', async () => {
    const {getByText} = render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());

    fireEvent.press(getByText('Local (IAPKit)'));

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
    const {getByText} = render(<PurchaseFlow />);

    await waitFor(() => expect(getStorefront).toHaveBeenCalled());
    await waitFor(() => expect(getByText('KR')).toBeDefined());
    expect(getByText(/Storefront:/)).toBeDefined();
  });

  it('should handle purchase button click', async () => {
    const {getByText} = render(<PurchaseFlow />);
    await waitFor(() => expect(getStorefront).toHaveBeenCalled());

    const purchaseButton = getByText('Purchase');
    fireEvent.press(purchaseButton);

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
    render(<PurchaseFlow />);

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

  it('keeps Local (Device) on direct Apple/Google verification', async () => {
    mockShowActionSheetWithOptions.mockImplementation(
      (_options: unknown, callback: (index?: number) => void) => callback(0),
    );
    const {getByText} = render(<PurchaseFlow />);

    fireEvent.press(getByText('Local (IAPKit)'));
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
    const {getByText} = render(<PurchaseFlow />);

    fireEvent.press(getByText('Local (IAPKit)'));
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
});
