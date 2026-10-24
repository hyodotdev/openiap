import {act, fireEvent, render} from '@testing-library/react-native';
import {Alert, Platform} from 'react-native';
import * as RNIap from 'react-native-iap';
import AlternativeBilling from '../../screens/AlternativeBilling';

describe('AlternativeBilling Screen', () => {
  const originalPlatform = Platform.OS;
  const mockFinishTransaction = jest.fn(() => Promise.resolve());

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
    (RNIap.useIAP as jest.Mock).mockReturnValue({
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
      fetchProducts: jest.fn(() => Promise.resolve([])),
      finishTransaction: mockFinishTransaction,
    });
  });

  afterEach(() => {
    Object.assign(Platform, {OS: originalPlatform});
  });

  it("shows the app flow's outcome for a purchase made here", async () => {
    const {getByText} = await render(<AlternativeBilling />);
    const options = jest.mocked(RNIap.useIAP).mock.calls.at(-1)?.[0];
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

  it('switches the billing mode only after native applies its program', async () => {
    Object.assign(Platform, {OS: 'android'});
    jest
      .mocked(RNIap.initConnection)
      .mockRejectedValueOnce(new Error('A purchase is in progress'));
    const {getByText} = await render(<AlternativeBilling />);
    const chooseExternalPayments = async () => {
      await fireEvent.press(getByText('🆕 Billing Programs API (8.2.0+)'));
      await fireEvent.press(getByText('🇯🇵 External Payments (8.3.0+ Japan)'));
    };

    await chooseExternalPayments();

    expect(
      getByText(/Reconnection failed: A purchase is in progress/),
    ).toBeTruthy();
    expect(
      getByText(/Current mode: BILLING_PROGRAMS \(external-offer\)/),
    ).toBeTruthy();

    await chooseExternalPayments();

    expect(RNIap.initConnection).toHaveBeenLastCalledWith({
      enableBillingProgramAndroid: 'external-payments',
    });
    expect(getByText(/Current mode: EXTERNAL_PAYMENTS/)).toBeTruthy();
  });

  it('renders Amazon Vega as unsupported for alternative billing', async () => {
    Object.assign(Platform, {OS: 'kepler'});

    const {getByText} = await render(<AlternativeBilling />);

    expect(getByText('Not supported on Amazon Vega')).toBeTruthy();
    expect(
      getByText(/Alternative billing APIs are intentionally unsupported/),
    ).toBeTruthy();
    expect(getByText('Current mode: Amazon Vega standard IAP')).toBeTruthy();

    await fireEvent.press(getByText('Test Consumable'));

    expect(getByText('Not supported on Amazon Vega')).toBeTruthy();
  });
});
