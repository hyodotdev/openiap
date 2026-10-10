import React from 'react';
import {act, fireEvent, render} from '@testing-library/react-native';
import {Alert, Platform} from 'react-native';
import AlternativeBilling from '../app/alternative-billing';
import * as ExpoIap from '../../src';

describe('AlternativeBilling Component', () => {
  const originalPlatform = Platform.OS;
  const mockFetchProducts = jest.fn(() => Promise.resolve([]));
  const mockFinishTransaction = jest.fn(() => Promise.resolve());

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
    (ExpoIap.useIAP as jest.Mock).mockReturnValue({
      connected: true,
      products: [
        {
          id: 'dev.hyo.martie.consumable',
          title: 'Test Consumable',
          description: 'Test consumable description',
          displayPrice: '$0.99',
          type: 'in-app',
        },
      ],
      fetchProducts: mockFetchProducts,
      finishTransaction: mockFinishTransaction,
    });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => originalPlatform),
      configurable: true,
    });
  });

  it.each(['apple', 'community_fixture'] as const)(
    'retains an unverified %s purchase received during billing selection',
    async (storeId) => {
      await render(<AlternativeBilling />);
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
      expect(Alert.alert).toHaveBeenCalledWith(
        'Receipt retained',
        'Open Purchase Flow or Subscription Flow to verify and complete this receipt.',
      );
    },
  );

  it('renders Amazon Vega as unsupported for alternative billing', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'kepler'),
      configurable: true,
    });

    const {getByText} = await render(<AlternativeBilling />);

    expect(getByText('Not supported on Amazon Vega')).toBeDefined();
    expect(
      getByText(/Alternative billing APIs are intentionally unsupported/),
    ).toBeDefined();
    expect(getByText('Current mode: Amazon Vega standard IAP')).toBeDefined();

    await fireEvent.press(getByText('Test Consumable'));

    expect(getByText('Not supported on Amazon Vega')).toBeDefined();
  });
});
