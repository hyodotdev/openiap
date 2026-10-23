import React from 'react';
import {act, fireEvent, render} from '@testing-library/react-native';
import {Alert, Platform} from 'react-native';
import AlternativeBilling from '../app/alternative-billing';
import * as ExpoIap from '../../src';

jest.mock('expo-constants', () => ({expoConfig: {extra: {}}}));

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

  it("shows the app flow's outcome for a purchase made here", async () => {
    const {getByText} = await render(<AlternativeBilling />);
    const options = jest.mocked(ExpoIap.useIAP).mock.calls.at(-1)?.[0];
    expect(options?.purchaseFlow).toBeDefined();

    await act(async () => {
      options?.onPurchaseFlowOutcome?.({
        purchase: {
          id: 'consumable',
          productId: 'dev.hyo.martie.10bulbs',
          purchaseToken: 'receipt',
          purchaseState: 'purchased',
          quantity: 1,
          isAutoRenewing: false,
          store: 'apple',
          storeId: 'apple',
          transactionDate: 1,
        },
        status: {status: 'entitled', alreadyGranted: false},
      });
    });

    expect(getByText(/Purchase verified\. Access granted\./)).toBeTruthy();
    expect(mockFinishTransaction).not.toHaveBeenCalled();
  });

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

  it('switches the billing flow only after native applies its program', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: jest.fn(() => 'android'),
      configurable: true,
    });
    jest
      .mocked(ExpoIap.initConnection)
      .mockResolvedValue(true)
      .mockRejectedValueOnce(new Error('A purchase is in progress'));
    const {getByText, getAllByText} = await render(<AlternativeBilling />);
    const chooseUserChoice = async () => {
      await fireEvent.press(getByText('Billing Programs API (8.2.0+)'));
      const options = getAllByText('User Choice Billing (7.0+)');
      await fireEvent.press(options[options.length - 1]);
    };

    await chooseUserChoice();

    expect(
      getByText(/Reconnection failed: A purchase is in progress/),
    ).toBeTruthy();
    // The flow selector still reads Billing Programs.
    expect(getByText('Billing Programs API (8.2.0+)')).toBeTruthy();
    expect(getByText(/Current program: EXTERNAL_OFFER/)).toBeTruthy();

    await chooseUserChoice();

    expect(ExpoIap.initConnection).toHaveBeenLastCalledWith({
      enableBillingProgramAndroid: 'user-choice-billing',
    });
    expect(getByText(/Current program: USER_CHOICE_BILLING/)).toBeTruthy();
    expect(() => getByText('Billing Programs API (8.2.0+)')).toThrow();
  });
});
