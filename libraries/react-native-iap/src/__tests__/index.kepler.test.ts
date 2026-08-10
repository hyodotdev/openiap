import * as IAP from '../index.kepler';
import type {RequestPurchaseProps} from '../types';
import {getVegaIapModule} from '../vega';

jest.mock('../hooks/useIAP', () => ({useIAP: jest.fn()}));
jest.mock('../vega', () => ({
  getVegaIapModule: jest.fn(),
}));

describe('Amazon Vega public API', () => {
  const fetchProductsNative = jest.fn().mockResolvedValue([]);
  const requestPurchaseNative = jest.fn().mockResolvedValue([]);
  const getAvailablePurchasesNative = jest.fn().mockResolvedValue([]);
  const module = {
    initConnection: jest.fn().mockResolvedValue(true),
    endConnection: jest.fn().mockResolvedValue(true),
    fetchProducts: fetchProductsNative,
    requestPurchase: requestPurchaseNative,
    getAvailablePurchases: getAvailablePurchasesNative,
    finishTransaction: jest.fn().mockResolvedValue(undefined),
    restorePurchases: jest.fn().mockResolvedValue(undefined),
    getActiveSubscriptions: jest.fn().mockResolvedValue([]),
    hasActiveSubscriptions: jest.fn().mockResolvedValue(false),
    addPurchaseUpdatedListener: jest.fn().mockReturnValue(7),
    removePurchaseUpdatedListener: jest.fn(),
    addPurchaseErrorListener: jest.fn(),
    removePurchaseErrorListener: jest.fn(),
    getStorefront: jest.fn().mockResolvedValue('US'),
    verifyPurchaseWithProvider: jest.fn().mockResolvedValue({ok: true}),
    acknowledgePurchaseAndroid: jest.fn().mockResolvedValue(true),
    consumePurchaseAndroid: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getVegaIapModule as jest.Mock).mockReturnValue(module);
  });

  it('returns false when offer-code redemption is unsupported', async () => {
    await expect(IAP.openRedeemOfferCodeAndroid()).resolves.toBe(false);
  });

  it("uses the canonical 'in-app' product type", async () => {
    await IAP.fetchProducts({skus: ['coins'], type: 'in-app'});

    expect(fetchProductsNative).toHaveBeenCalledWith(['coins'], 'in-app');
  });

  it('rejects removed product type aliases', async () => {
    await expect(
      IAP.fetchProducts({skus: ['coins'], type: 'inapp' as any}),
    ).rejects.toThrow(/Unsupported product type/);
    expect(fetchProductsNative).not.toHaveBeenCalled();
  });

  it('forwards the canonical google purchase request', async () => {
    const request: RequestPurchaseProps = {
      request: {google: {skus: ['coins']}},
      type: 'in-app',
    };

    await IAP.requestPurchase(request);

    expect(requestPurchaseNative).toHaveBeenLastCalledWith({
      google: {skus: ['coins']},
    });
  });

  it('rejects a malformed purchase result instead of returning partial success', async () => {
    requestPurchaseNative.mockResolvedValueOnce([
      {
        id: 'valid',
        productId: 'coins',
        transactionDate: Date.now(),
        store: 'amazon',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      },
      {id: 'malformed'},
    ]);
    const request: RequestPurchaseProps = {
      request: {google: {skus: ['coins']}},
      type: 'in-app',
    };

    await expect(IAP.requestPurchase(request)).rejects.toMatchObject({
      code: 'billing-response-json-parse-error',
    });
  });

  it('rejects a mixed malformed available-purchase list', async () => {
    getAvailablePurchasesNative.mockResolvedValueOnce([
      {
        id: 'valid',
        productId: 'premium',
        transactionDate: Date.now(),
        store: 'amazon',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      },
      {id: 'malformed'},
    ]);

    await expect(IAP.getAvailablePurchases()).rejects.toMatchObject({
      code: 'billing-response-json-parse-error',
    });
  });

  it('rejects an Apple purchase returned by the Vega bridge', async () => {
    getAvailablePurchasesNative.mockResolvedValueOnce([
      {
        id: 'foreign',
        transactionId: 'foreign',
        productId: 'premium',
        transactionDate: Date.now(),
        store: 'apple',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      },
    ]);

    await expect(IAP.getAvailablePurchases()).rejects.toMatchObject({
      code: 'billing-response-json-parse-error',
    });
  });

  it('reports Vega capabilities and rejects a missing native module', async () => {
    expect(IAP.isNitroReady()).toBe(false);
    expect(IAP.isTVOS()).toBe(false);
    expect(IAP.isMacOS()).toBe(false);
    expect(IAP.isStandardIOS()).toBe(false);

    (getVegaIapModule as jest.Mock).mockReturnValueOnce(undefined);
    await expect(IAP.initConnection()).rejects.toThrow(
      /Amazon Vega IAP module is unavailable/,
    );
  });

  it('forwards connection, subscription, storefront, and provider APIs', async () => {
    await expect(IAP.initConnection()).resolves.toBe(true);
    await expect(IAP.endConnection()).resolves.toBe(true);
    await expect(IAP.getActiveSubscriptions()).resolves.toEqual([]);
    await expect(IAP.hasActiveSubscriptions(['premium'])).resolves.toBe(false);
    await expect(IAP.getStorefront()).resolves.toBe('US');
    await expect(
      IAP.verifyPurchaseWithProvider({
        provider: 'iapkit',
        iapkit: {
          apiKey: 'public-test-key',
          amazon: {receiptId: 'redacted', sandbox: true},
        },
      }),
    ).resolves.toEqual({ok: true});

    expect(module.initConnection).toHaveBeenCalledWith(null);
    expect(module.getActiveSubscriptions).toHaveBeenCalledWith(undefined);
    expect(module.hasActiveSubscriptions).toHaveBeenCalledWith(['premium']);
  });

  it('normalizes product queries and maps subscriptions', async () => {
    fetchProductsNative.mockResolvedValue([
      {
        id: 'premium',
        title: 'Premium',
        description: 'Premium plan',
        type: 'subs',
        displayPrice: '$4.99',
        price: 4.99,
        currency: 'USD',
        platform: 'android',
        subscriptionOfferDetailsAndroid: [],
      },
      {title: 'invalid'},
    ]);

    await expect(
      IAP.fetchProducts({skus: ['premium'], type: 'subs'}),
    ).resolves.toHaveLength(1);
    await IAP.fetchProducts({skus: ['premium'], type: 'all'});
    await IAP.fetchProducts({skus: ['premium']});

    expect(fetchProductsNative.mock.calls.map((call) => call[1])).toEqual([
      'subs',
      'all',
      'in-app',
    ]);
  });

  it('validates purchase and finish requests', async () => {
    await expect(
      IAP.requestPurchase({request: {google: {skus: []}}, type: 'in-app'}),
    ).rejects.toThrow(/must be a non-empty array/);

    requestPurchaseNative.mockResolvedValueOnce(null);
    await expect(
      IAP.requestPurchase({
        request: {google: {skus: ['coins']}},
        type: 'in-app',
      }),
    ).resolves.toBeNull();

    await expect(
      IAP.finishTransaction({purchase: {productId: 'coins'} as any}),
    ).rejects.toThrow(/purchaseToken required/);
    await IAP.finishTransaction({
      purchase: {productId: 'coins', purchaseToken: 'receipt'} as any,
      isConsumable: true,
    });
    expect(module.finishTransaction).toHaveBeenCalledWith({
      android: {purchaseToken: 'receipt', isConsumable: true},
    });
  });

  it('forwards restore and Android completion helpers', async () => {
    await IAP.restorePurchases();
    await expect(IAP.acknowledgePurchaseAndroid('receipt')).resolves.toBe(true);
    await expect(IAP.consumePurchaseAndroid('receipt')).resolves.toBe(true);

    expect(module.restorePurchases).toHaveBeenCalledTimes(1);
    expect(module.acknowledgePurchaseAndroid).toHaveBeenCalledWith('receipt');
    expect(module.consumePurchaseAndroid).toHaveBeenCalledWith('receipt');
  });

  it('adapts purchase listeners and removes native subscriptions', () => {
    const purchaseListener = jest.fn();
    const subscription = IAP.purchaseUpdatedListener(purchaseListener);
    const nativeListener = module.addPurchaseUpdatedListener.mock.calls[0][0];

    nativeListener({
      id: 'purchase',
      productId: 'coins',
      transactionDate: Date.now(),
      store: 'amazon',
      quantity: 1,
      purchaseState: 'purchased',
      isAutoRenewing: false,
      purchaseToken: 'receipt',
    });
    nativeListener({id: 'invalid'});
    subscription.remove();

    expect(purchaseListener).toHaveBeenCalledTimes(1);
    expect(module.removePurchaseUpdatedListener).toHaveBeenCalledWith(7);
  });

  it('normalizes purchase errors and removes the same callback', () => {
    const listener = jest.fn();
    const subscription = IAP.purchaseErrorListener(listener);
    const nativeListener = module.addPurchaseErrorListener.mock.calls[0][0];

    nativeListener({});
    subscription.remove();

    expect(listener).toHaveBeenCalledWith({
      code: 'service-error',
      message: 'Amazon Vega purchase failed',
    });
    expect(module.removePurchaseErrorListener).toHaveBeenCalledWith(
      nativeListener,
    );
  });

  it('returns documented iOS fallbacks and rejects unsupported APIs', async () => {
    await expect(IAP.getAppTransactionIOS()).resolves.toBeNull();
    await expect(IAP.getPromotedProductIOS()).resolves.toBeNull();
    await expect(IAP.showManageSubscriptionsIOS()).resolves.toEqual([]);
    await expect(IAP.presentCodeRedemptionSheetIOS()).resolves.toBeNull();

    for (const call of [
      () => IAP.verifyPurchase({} as any),
      () => IAP.syncIOS(),
      () => IAP.presentExternalPurchaseLinkIOS('https://example.com'),
      () => IAP.deepLinkToSubscriptions({} as any),
      () => IAP.isBillingProgramAvailableAndroid('external-offer' as any),
      () => IAP.getBillingChoiceInfoAndroid({}),
      () =>
        IAP.launchExternalLinkAndroid({
          billingProgram: 'external-offer',
          launchMode: 'launch-in-external-browser-or-app',
          linkType: 'link-to-digital-content-offer',
          linkUri: 'https://example.com',
        }),
      () =>
        IAP.createBillingProgramReportingDetailsAndroid(
          'external-offer' as any,
        ),
      () =>
        IAP.showBillingProgramInformationDialogAndroid('external-offer' as any),
      () => IAP.showInAppMessagesAndroid({} as any),
    ]) {
      await expect(call()).rejects.toThrow(/not supported on Amazon Vega/);
    }

    IAP.promotedProductListenerIOS().remove();
    IAP.userChoiceBillingListenerAndroid().remove();
    IAP.developerProvidedBillingListenerAndroid().remove();
    IAP.subscriptionBillingIssueListener().remove();
  });
});
