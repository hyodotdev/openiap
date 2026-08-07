import {type ReactElement} from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {Alert, Platform} from 'react-native';
import AvailablePurchases from '../../screens/AvailablePurchases';
import * as RNIap from 'react-native-iap';
import {DataModalProvider} from '../../src/contexts/DataModalContext';

// Mock functions for testing
const mockGetAvailablePurchases = jest.fn();
const mockGetActiveSubscriptions = jest.fn();
const mockRequestProducts = jest.fn();
const mockFinishTransaction = jest.fn();

// Override the useIAP hook for this test file
(RNIap.useIAP as jest.Mock).mockReturnValue({
  connected: true,
  subscriptions: [
    {
      type: 'subs',
      id: 'dev.hyo.martie.premium',
      title: 'Premium Subscription',
      description: 'Premium features',
      price: 9.99,
      displayPrice: '$9.99',
      currency: 'USD',
    },
  ],
  availablePurchases: [
    {
      productId: 'dev.hyo.martie.premium',
      transactionDate: Date.now(),
      purchaseToken: 'mock-receipt',
      id: 'trans-123',
      platform: 'ios',
    },
  ],
  activeSubscriptions: ['dev.hyo.martie.premium'],
  getAvailablePurchases: mockGetAvailablePurchases,
  getActiveSubscriptions: mockGetActiveSubscriptions,
  fetchProducts: mockRequestProducts,
  finishTransaction: mockFinishTransaction,
});

jest.spyOn(Alert, 'alert');

// Helper to render with providers
const renderWithProviders = (component: ReactElement) => {
  return render(<DataModalProvider>{component}</DataModalProvider>);
};

describe('AvailablePurchases Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAvailablePurchases.mockResolvedValue([
      {
        productId: 'dev.hyo.martie.premium',
        transactionDate: Date.now(),
      },
    ]);
    mockGetActiveSubscriptions.mockResolvedValue(['dev.hyo.martie.premium']);
    mockRequestProducts.mockResolvedValue([]);
  });

  it('renders the screen header content', async () => {
    // The "Available Purchases" title is owned by the navigator
    // (navigation/index.tsx `options={{title: 'Available Purchases'}}`), so a
    // bare screen render is identified by its own header content instead.
    const {getByText} = await renderWithProviders(<AvailablePurchases />);
    await waitFor(() => {
      expect(getByText('📋 Purchase History')).toBeTruthy();
      expect(
        getByText('Past purchases and subscription transactions'),
      ).toBeTruthy();
    });
  });

  it('shows connection status when connected', async () => {
    const {getByText} = await renderWithProviders(<AvailablePurchases />);
    await waitFor(() => {
      expect(getByText('Store Connection: ✅ Connected')).toBeTruthy();
    });
  });

  it('loads subscription products on mount', async () => {
    await renderWithProviders(<AvailablePurchases />);

    await waitFor(() => {
      expect(mockRequestProducts).toHaveBeenCalled();
    });
  });

  it('refreshes purchases when refresh button is pressed', async () => {
    const {getByText} = await renderWithProviders(<AvailablePurchases />);

    const refreshButton = getByText('🔄 Refresh Purchases');
    await fireEvent.press(refreshButton);

    await waitFor(() => {
      expect(mockGetAvailablePurchases).toHaveBeenCalled();
      expect(mockGetActiveSubscriptions).toHaveBeenCalled();
    });
  });

  it('displays purchase history section', async () => {
    const {getByText} = await renderWithProviders(<AvailablePurchases />);

    expect(getByText('📋 Purchase History')).toBeTruthy();
    expect(getByText('dev.hyo.martie.premium')).toBeTruthy();
  });

  it('displays active subscriptions section', async () => {
    const {getByText} = await renderWithProviders(<AvailablePurchases />);

    expect(getByText('🔄 Active Subscriptions')).toBeTruthy();
  });

  it('shows Vega guidance instead of opening unsupported subscription management deep links', async () => {
    const originalPlatform = Platform.OS;
    (Platform as any).OS = 'kepler';

    try {
      const {getByText} = await renderWithProviders(<AvailablePurchases />);

      await fireEvent.press(getByText('👤 Manage Subscriptions'));

      expect(
        getByText(/Subscription management deep links are not exposed/),
      ).toBeTruthy();
      expect(RNIap.deepLinkToSubscriptions).not.toHaveBeenCalled();
    } finally {
      (Platform as any).OS = originalPlatform;
    }
  });

  it('handles error when fetching purchases fails', async () => {
    const {getByText} = await renderWithProviders(<AvailablePurchases />);

    // The mount effect issues an initial getAvailablePurchases call whose
    // rejection is only logged. Wait for it so the one-shot rejection below is
    // consumed by the refresh button handler, which alerts on failure.
    await waitFor(() => {
      expect(mockGetAvailablePurchases).toHaveBeenCalled();
    });

    mockGetAvailablePurchases.mockRejectedValueOnce(
      new Error('Failed to fetch purchases'),
    );

    const refreshButton = getByText('🔄 Refresh Purchases');
    await fireEvent.press(refreshButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to get available purchases',
      );
    });
  });

  it('displays empty state when no purchases available', async () => {
    // Override mock to return empty purchases
    (RNIap.useIAP as jest.Mock).mockReturnValueOnce({
      connected: true,
      subscriptions: [],
      availablePurchases: [],
      activeSubscriptions: [],
      getAvailablePurchases: mockGetAvailablePurchases,
      getActiveSubscriptions: mockGetActiveSubscriptions,
      fetchProducts: mockRequestProducts,
      finishTransaction: mockFinishTransaction,
    });

    const {getByText} = await renderWithProviders(<AvailablePurchases />);
    await waitFor(() => {
      expect(getByText('No purchase history found')).toBeTruthy();
    });
  });

  it('shows transaction details for purchases', async () => {
    const {getByText} = await renderWithProviders(<AvailablePurchases />);

    // Check if transaction ID is displayed
    await waitFor(() => {
      expect(getByText('trans-123')).toBeTruthy();
    });
  });
});
