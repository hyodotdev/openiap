import {Alert, Platform} from 'react-native';
import * as RNIap from 'react-native-iap';
import type {
  Purchase,
  PurchaseIOS,
  SdkPurchaseFlowOptions,
  VerifyPurchaseWithProviderResult,
} from 'react-native-iap';
import {
  alertPurchaseOutcome,
  describePurchaseOutcome,
  getDefaultVerificationMethod,
  getVerificationMethod,
  purchaseFlow,
  setVerificationMethod,
} from '../../src/utils/purchaseFlow';

jest.mock(
  '@env',
  () => ({
    AMAZON_RVS_SANDBOX: 'true',
    IAPKIT_API_KEY: 'test-api-key',
    IAPKIT_BASE_URL: 'http://192.168.0.10:3100',
  }),
  {virtual: true},
);

// The module creates its flow once, at import.
const flowOptions: SdkPurchaseFlowOptions = (
  RNIap.createPurchaseFlow as jest.Mock
).mock.calls[0][0];
const verifyPurchaseWithProvider = jest.mocked(
  RNIap.verifyPurchaseWithProvider,
);

const googleBulbs: Purchase = {
  id: 'GPA.1',
  productId: 'dev.hyo.martie.10bulbs',
  purchaseToken: 'play-token',
  purchaseState: 'purchased',
  quantity: 1,
  isAutoRenewing: false,
  transactionDate: 1,
  store: 'google',
  storeId: 'play',
};

const appleCertified: PurchaseIOS = {
  id: 'apple-tx',
  transactionId: 'apple-tx',
  productId: 'dev.hyo.martie.certified',
  purchaseToken: 'apple-jws',
  purchaseState: 'purchased',
  quantity: 1,
  isAutoRenewing: false,
  transactionDate: 1,
  store: 'apple',
  storeId: 'apple',
};

function verifiedAs(
  iapkit: Partial<NonNullable<VerifyPurchaseWithProviderResult['iapkit']>>,
): void {
  verifyPurchaseWithProvider.mockResolvedValueOnce({
    provider: 'iapkit',
    iapkit: {
      isValid: true,
      productId: 'dev.hyo.martie.10bulbs',
      state: 'ready-to-consume',
      store: 'google',
      storeId: 'play',
      ...iapkit,
    },
  });
}

describe('app purchase flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
  });

  it('is created once with the app catalog', () => {
    expect(flowOptions.isConsumable('dev.hyo.martie.10bulbs')).toBe(true);
    expect(flowOptions.isConsumable('dev.hyo.martie.certified')).toBe(false);
    expect(getVerificationMethod()).toBe('iapkit-localhost');
  });

  it('defaults to IAPKit only when a key is configured', () => {
    expect(getDefaultVerificationMethod('key', 'http://localhost:3100')).toBe(
      'iapkit-localhost',
    );
    expect(getDefaultVerificationMethod('key', '  ')).toBe('iapkit');
    expect(getDefaultVerificationMethod(' ', 'http://localhost:3100')).toBe(
      'ignore',
    );
  });

  it('keeps the receipt unfinished in None mode', async () => {
    setVerificationMethod('ignore');

    await expect(
      flowOptions.confirmWithBackend(googleBulbs, {isConsumable: true}),
    ).resolves.toEqual({status: 'verified'});
    expect(verifyPurchaseWithProvider).not.toHaveBeenCalled();
    expect(purchaseFlow.recoverPurchases).not.toHaveBeenCalled();
  });

  it('recovers unfinished receipts once a verification method is chosen', () => {
    setVerificationMethod('iapkit');

    expect(getVerificationMethod()).toBe('iapkit');
    expect(purchaseFlow.recoverPurchases).toHaveBeenCalledTimes(1);
  });

  it('routes Local (IAPKit) through the configured server', async () => {
    setVerificationMethod('iapkit-localhost');
    verifiedAs({});

    await expect(
      flowOptions.confirmWithBackend(googleBulbs, {isConsumable: true}),
    ).resolves.toEqual({status: 'entitled', alreadyGranted: false});
    expect(verifyPurchaseWithProvider).toHaveBeenCalledWith({
      provider: 'iapkit',
      iapkit: {
        apiKey: 'test-api-key',
        baseUrl: 'http://192.168.0.10:3100',
        google: {purchaseToken: 'play-token'},
      },
    });
  });

  it('verifies hosted IAPKit without the local base URL', async () => {
    setVerificationMethod('iapkit');
    verifiedAs({
      productId: 'dev.hyo.martie.certified',
      state: 'entitled',
      store: 'apple',
      storeId: 'apple',
    });

    await expect(
      flowOptions.confirmWithBackend(appleCertified, {isConsumable: false}),
    ).resolves.toEqual({status: 'entitled', alreadyGranted: false});
    expect(verifyPurchaseWithProvider).toHaveBeenCalledWith({
      provider: 'iapkit',
      iapkit: {apiKey: 'test-api-key', apple: {jws: 'apple-jws'}},
    });
  });

  it('rejects an IAPKit answer that cannot grant the purchase', async () => {
    setVerificationMethod('iapkit');
    verifiedAs({isValid: false, state: 'inauthentic'});

    await expect(
      flowOptions.confirmWithBackend(googleBulbs, {isConsumable: true}),
    ).rejects.toThrow('IAPKit rejected the purchase: inauthentic');
  });

  it.each([
    {store: 'amazon', storeId: 'amazon'},
    {store: 'unknown', storeId: 'amazon_example'},
  ] as const)(
    'verifies $storeId subscriptions with Amazon RVS under the catalog base SKU',
    async ({store, storeId}) => {
      setVerificationMethod('iapkit');
      verifiedAs({
        productId: 'dev.hyo.martie.premium.base',
        state: 'entitled',
        environment: 'Sandbox',
        store,
        storeId,
      });

      await expect(
        flowOptions.confirmWithBackend(
          {
            ...googleBulbs,
            productId: 'dev.hyo.martie.premium_year',
            purchaseToken: 'amazon-receipt',
            store,
            storeId,
          },
          {isConsumable: false},
        ),
      ).resolves.toEqual({status: 'entitled', alreadyGranted: false});
      expect(verifyPurchaseWithProvider).toHaveBeenCalledWith({
        provider: 'iapkit',
        iapkit: {
          apiKey: 'test-api-key',
          amazon: {
            receiptId: 'amazon-receipt',
            expectedProductId: 'dev.hyo.martie.premium.base',
            sandbox: true,
          },
        },
      });
    },
  );

  it('confirms a matching unfinished StoreKit transaction on the device', async () => {
    setVerificationMethod('local');
    jest
      .mocked(RNIap.getPendingTransactionsIOS)
      .mockResolvedValueOnce([appleCertified]);

    await expect(
      flowOptions.confirmWithBackend(appleCertified, {isConsumable: false}),
    ).resolves.toEqual({status: 'entitled', alreadyGranted: false});
    expect(verifyPurchaseWithProvider).not.toHaveBeenCalled();
  });

  it('rejects an unmatched or non-Apple purchase in Local (Device) mode', async () => {
    setVerificationMethod('local');
    jest.mocked(RNIap.getPendingTransactionsIOS).mockResolvedValueOnce([]);

    await expect(
      flowOptions.confirmWithBackend(appleCertified, {isConsumable: false}),
    ).rejects.toThrow('did not match this pending transaction');

    Platform.OS = 'android';
    await expect(
      flowOptions.confirmWithBackend(googleBulbs, {isConsumable: true}),
    ).rejects.toThrow('available only for Apple purchases');
  });

  it('describes and alerts each outcome', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    alertPurchaseOutcome({status: 'entitled', alreadyGranted: false});
    alertPurchaseOutcome({
      status: 'entitled',
      alreadyGranted: false,
      changePending: true,
    });
    alertPurchaseOutcome({status: 'failed', error: new Error('offline')});
    alertPurchaseOutcome({
      status: 'entitled',
      alreadyGranted: false,
      finishError: new Error('store busy'),
    });

    expect(alertSpy.mock.calls).toEqual([
      ['Success', 'Purchase completed successfully!'],
      ['Verification Failed', 'Purchase verification failed: offline'],
      ['Finish Transaction Failed', 'store busy'],
    ]);
    expect(describePurchaseOutcome({status: 'verified'})).toMatch(
      /Receipt retained/,
    );
    expect(
      describePurchaseOutcome({
        status: 'entitled',
        alreadyGranted: false,
        finishError: new Error('store busy'),
      }),
    ).toBe(
      'Purchase verified. Access granted. finishTransaction failed: store busy',
    );
  });
});
