import {Alert, Platform} from 'react-native';
import * as ExpoIap from 'expo-iap';
import type {
  Purchase,
  PurchaseIOS,
  SdkPurchaseFlowOptions,
  VerifyPurchaseWithProviderResult,
} from 'expo-iap';
import {
  alertPurchaseOutcome,
  describePurchaseOutcome,
  disposeReceiptPurchaseFlow,
  getReceiptPurchaseFlow,
  getVerificationMethod,
  setVerificationMethod,
} from '../src/utils/purchaseFlow';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        amazonRvsSandbox: 'true',
        iapkitApiKey: 'test-api-key',
        iapkitBaseUrl: 'http://localhost:3100',
      },
    },
  },
}));

const verifyPurchaseWithProvider = jest.mocked(
  ExpoIap.verifyPurchaseWithProvider,
);
const createPurchaseFlow = ExpoIap.createPurchaseFlow as jest.Mock;
const originalPlatform = Platform.OS;

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

function setPlatform(os: string): void {
  Object.defineProperty(Platform, 'OS', {get: () => os, configurable: true});
}

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

// The flow options the screens' shared flow was created with.
function flowOptions(): SdkPurchaseFlowOptions {
  getReceiptPurchaseFlow();
  return createPurchaseFlow.mock.calls[0][0];
}

describe('receipt-check purchase flow', () => {
  beforeEach(() => {
    disposeReceiptPurchaseFlow();
    jest.clearAllMocks();
    setPlatform('ios');
  });

  afterAll(() => setPlatform(originalPlatform));

  it('is shared until the app-backend path disposes it', () => {
    const flow = getReceiptPurchaseFlow();

    expect(getReceiptPurchaseFlow()).toBe(flow);
    expect(createPurchaseFlow).toHaveBeenCalledTimes(1);
    expect(flowOptions().isConsumable('dev.hyo.martie.10bulbs')).toBe(true);
    expect(flowOptions().isConsumable('dev.hyo.martie.certified')).toBe(false);

    disposeReceiptPurchaseFlow();
    expect(flow.dispose).toHaveBeenCalledTimes(1);
    expect(getReceiptPurchaseFlow()).not.toBe(flow);
  });

  it('starts with the configured verification method', () => {
    expect(getVerificationMethod()).toBe('iapkit-localhost');
  });

  it('keeps the receipt unfinished in None mode', async () => {
    setVerificationMethod('ignore');

    await expect(
      flowOptions().confirmWithBackend(googleBulbs, {isConsumable: true}),
    ).resolves.toEqual({status: 'verified'});
    expect(verifyPurchaseWithProvider).not.toHaveBeenCalled();
    expect(getReceiptPurchaseFlow().recoverPurchases).not.toHaveBeenCalled();
  });

  it('recovers unfinished receipts once a verification method is chosen', () => {
    setVerificationMethod('iapkit');

    expect(getVerificationMethod()).toBe('iapkit');
    expect(getReceiptPurchaseFlow().recoverPurchases).toHaveBeenCalledTimes(1);
  });

  it('routes Local (IAPKit) through the configured server', async () => {
    setVerificationMethod('iapkit-localhost');
    verifiedAs({});

    await expect(
      flowOptions().confirmWithBackend(googleBulbs, {isConsumable: true}),
    ).resolves.toEqual({status: 'entitled', alreadyGranted: false});
    expect(verifyPurchaseWithProvider).toHaveBeenCalledWith({
      provider: 'iapkit',
      iapkit: {
        baseUrl: 'http://localhost:3100',
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
      flowOptions().confirmWithBackend(appleCertified, {isConsumable: false}),
    ).resolves.toEqual({status: 'entitled', alreadyGranted: false});
    expect(verifyPurchaseWithProvider).toHaveBeenCalledWith({
      provider: 'iapkit',
      iapkit: {apple: {jws: 'apple-jws'}},
    });
  });

  it('rejects an IAPKit answer that cannot grant the purchase', async () => {
    setVerificationMethod('iapkit');
    verifiedAs({isValid: false, state: 'inauthentic'});

    await expect(
      flowOptions().confirmWithBackend(googleBulbs, {isConsumable: true}),
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
        flowOptions().confirmWithBackend(
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
      .mocked(ExpoIap.getPendingTransactionsIOS)
      .mockResolvedValueOnce([appleCertified]);

    await expect(
      flowOptions().confirmWithBackend(appleCertified, {isConsumable: false}),
    ).resolves.toEqual({status: 'entitled', alreadyGranted: false});
    expect(verifyPurchaseWithProvider).not.toHaveBeenCalled();
  });

  it('rejects an unmatched or non-Apple purchase in Local (Device) mode', async () => {
    setVerificationMethod('local');
    jest.mocked(ExpoIap.getPendingTransactionsIOS).mockResolvedValueOnce([]);

    await expect(
      flowOptions().confirmWithBackend(appleCertified, {isConsumable: false}),
    ).rejects.toThrow('did not match this pending transaction');

    setPlatform('android');
    await expect(
      flowOptions().confirmWithBackend(googleBulbs, {isConsumable: true}),
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

    expect(alertSpy.mock.calls).toEqual([
      ['Success', 'Purchase completed successfully!'],
      ['Verification Failed', 'Purchase verification failed: offline'],
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
