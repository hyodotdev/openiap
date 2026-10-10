import React from 'react';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import {Platform} from 'react-native';
import AvailablePurchases from '../app/available-purchases';
import * as ExpoIap from '../../src';

describe('AvailablePurchases Component', () => {
  const originalPlatform = Platform.OS;
  const mockFetchProducts = jest.fn(() => Promise.resolve([]));
  const mockGetAvailablePurchases = jest.fn(() => Promise.resolve([]));
  const mockGetActiveSubscriptions = jest.fn(() => Promise.resolve([]));
  const mockFinishTransaction = jest.fn(() => Promise.resolve());

  beforeEach(() => {
    jest.clearAllMocks();
    (ExpoIap.useIAP as jest.Mock).mockReturnValue({
      connected: true,
      subscriptions: [
        {
          id: 'dev.hyo.martie.premium',
          title: 'Premium Subscription',
          description: 'Premium features',
          displayPrice: '$9.99',
          type: 'subs',
        },
      ],
      availablePurchases: [
        {
          productId: 'dev.hyo.martie.premium',
          id: 'transaction-1',
          transactionDate: Date.now(),
          platform: 'android',
        },
      ],
      activeSubscriptions: [
        {
          productId: 'dev.hyo.martie.premium',
          transactionId: 'transaction-1',
          purchaseToken: 'token-1',
          isActive: true,
          transactionDate: Date.now(),
        },
      ],
      fetchProducts: mockFetchProducts,
      getAvailablePurchases: mockGetAvailablePurchases,
      getActiveSubscriptions: mockGetActiveSubscriptions,
      finishTransaction: mockFinishTransaction,
    });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => originalPlatform),
      configurable: true,
    });
  });

  it('loads and renders purchase status', async () => {
    const {getByText} = await render(<AvailablePurchases />);

    expect(getByText('Store Connection: ✅ Connected')).toBeDefined();
    expect(getByText('🔄 Active Subscriptions')).toBeDefined();
    expect(getByText('💰 Available Purchases')).toBeDefined();
    await waitFor(() => {
      expect(mockFetchProducts).toHaveBeenCalled();
      expect(mockGetAvailablePurchases).toHaveBeenCalled();
      expect(mockGetActiveSubscriptions).toHaveBeenCalled();
    });
  });

  it('shows purchase-token presence without rendering its value', async () => {
    const {getByText, queryByText} = await render(<AvailablePurchases />);

    await fireEvent.press(getByText('✅ Active'));

    expect(getByText('Present')).toBeDefined();
    expect(queryByText('token-1')).toBeNull();
  });

  it.each(['apple', 'community_fixture'] as const)(
    'retains an unverified %s purchase received while viewing ownership',
    async (storeId) => {
      await render(<AvailablePurchases />);
      await waitFor(() =>
        expect(mockGetActiveSubscriptions).toHaveBeenCalled(),
      );
      const options = jest.mocked(ExpoIap.useIAP).mock.calls.at(-1)?.[0];
      expect(options?.onPurchaseSuccess).toBeDefined();
      await act(async () => {
        await options?.onPurchaseSuccess?.({
          id: 'unfinished-consumable',
          transactionId: 'unfinished-consumable',
          productId: 'dev.hyo.martie.10bulbs',
          purchaseToken: 'unverified-receipt',
          purchaseState: 'purchased',
          quantity: 1,
          isAutoRenewing: false,
          store: storeId === 'apple' ? 'apple' : 'unknown',
          storeId,
          transactionDate: 1,
        });
      });
      expect(mockFinishTransaction).not.toHaveBeenCalled();
      expect(ExpoIap.finishTransaction).not.toHaveBeenCalled();
    },
  );

  it('shows Vega guidance instead of opening unsupported subscription management deep links', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'kepler'),
      configurable: true,
    });

    const {getByText} = await render(<AvailablePurchases />);

    await waitFor(() => {
      expect(mockGetActiveSubscriptions).toHaveBeenCalled();
    });

    await fireEvent.press(getByText('🔗 Manage Subscriptions'));

    expect(
      getByText(/Subscription management deep links are not exposed/),
    ).toBeDefined();
    expect(ExpoIap.deepLinkToSubscriptions).not.toHaveBeenCalled();
  });
});
