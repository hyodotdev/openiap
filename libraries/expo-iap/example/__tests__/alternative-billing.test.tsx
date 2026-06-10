import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {Platform} from 'react-native';
import AlternativeBilling from '../app/alternative-billing';
import * as ExpoIap from '../../src';

describe('AlternativeBilling Component', () => {
  const originalPlatform = Platform.OS;
  const mockFetchProducts = jest.fn(() => Promise.resolve([]));
  const mockFinishTransaction = jest.fn(() => Promise.resolve());

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('renders Amazon Vega as unsupported for alternative billing', () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'kepler'),
      configurable: true,
    });

    const {getByText} = render(<AlternativeBilling />);

    expect(getByText('Not supported on Amazon Vega')).toBeDefined();
    expect(
      getByText(/Alternative billing APIs are intentionally unsupported/),
    ).toBeDefined();
    expect(getByText('Current mode: Amazon Vega standard IAP')).toBeDefined();

    fireEvent.press(getByText('Test Consumable'));

    expect(getByText('Not supported on Vega')).toBeDefined();
  });
});
