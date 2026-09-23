import {
  fetchProducts,
  getAvailablePurchases,
  openRedeemOfferCode,
  openRedeemOfferCodeAndroid,
  requestPurchase,
} from '../index.kepler';
import * as Kepler from '../index.kepler';
import {ErrorCode, type PurchaseAndroid} from '../types';
import {getVegaIapModule} from '../vega';

jest.mock('../vega', () => ({
  getVegaIapModule: jest.fn(),
}));

const vegaPurchase = (
  overrides: Partial<PurchaseAndroid> = {},
): PurchaseAndroid => ({
  id: 'transaction',
  productId: 'premium',
  isAutoRenewing: false,
  purchaseState: 'purchased',
  quantity: 1,
  store: 'amazon',
  transactionDate: 1720000000000,
  ...overrides,
});

describe('Amazon Vega public API', () => {
  const fetchProductsNative = jest.fn().mockResolvedValue([]);
  const getAvailablePurchasesNative = jest.fn().mockResolvedValue([]);
  const requestPurchaseNative = jest.fn().mockResolvedValue([]);

  beforeEach(() => {
    jest.clearAllMocks();
    (getVegaIapModule as jest.Mock).mockReturnValue({
      fetchProducts: fetchProductsNative,
      getAvailableItems: getAvailablePurchasesNative,
      requestPurchase: requestPurchaseNative,
    });
  });

  it('resolves null for openRedeemOfferCode without launching anything', async () => {
    await expect(openRedeemOfferCode()).resolves.toBeNull();
  });

  it('returns false when offer-code redemption is unsupported', async () => {
    await expect(openRedeemOfferCodeAndroid()).resolves.toBe(false);
  });

  it("rejects the removed 'inapp' product type", async () => {
    await expect(
      // @ts-expect-error the removed alias reaches the runtime check
      fetchProducts({skus: ['coins'], type: 'inapp'}),
    ).rejects.toThrow(/Unsupported product type/);
    expect(fetchProductsNative).not.toHaveBeenCalled();
  });

  it('uses canonical product type without a compatibility warning', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await fetchProducts({skus: ['coins'], type: 'in-app'});

    expect(warn).not.toHaveBeenCalled();
    expect(fetchProductsNative).toHaveBeenCalledWith('in-app', ['coins']);
    warn.mockRestore();
  });

  it('rejects the removed android request alias', async () => {
    const request = {
      request: {android: {skus: ['coins']}},
      type: 'in-app',
    };

    // @ts-expect-error the removed alias reaches the runtime check
    await expect(requestPurchase(request)).rejects.toThrow(
      /request\.google\.skus/,
    );
    expect(requestPurchaseNative).not.toHaveBeenCalled();
  });

  it('does not revive legacy android when canonical google is explicitly null', async () => {
    await expect(
      requestPurchase({
        request: {
          google: null,
          // @ts-expect-error the removed alias reaches the runtime check
          android: {skus: ['legacy-coins']},
        },
        type: 'in-app',
      }),
    ).rejects.toThrow(/request\.google\.skus/);

    expect(requestPurchaseNative).not.toHaveBeenCalled();
  });

  it('rejects all without dispatching a purchase', async () => {
    await expect(
      requestPurchase({
        request: {google: {skus: ['coins']}},
        // @ts-expect-error query-only type reaches the runtime check
        type: 'all',
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.DeveloperError,
      message: expect.stringMatching(/only supported for product queries/),
    });
    expect(requestPurchaseNative).not.toHaveBeenCalled();
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

    await expect(getAvailablePurchases()).rejects.toMatchObject({
      code: 'billing-response-json-parse-error',
    });
  });

  it('reports a missing Vega native module', async () => {
    (getVegaIapModule as jest.Mock).mockReturnValue(null);

    await expect(Kepler.initConnection()).rejects.toThrow(
      'Amazon Vega IAP module is unavailable',
    );
  });

  it('delegates listeners and connection lifecycle calls', async () => {
    const subscription = {remove: jest.fn()};
    const module = {
      addListener: jest.fn().mockReturnValue(subscription),
      removeListener: jest.fn(),
      initConnection: jest.fn().mockResolvedValue(true),
      endConnection: jest.fn().mockResolvedValue(true),
    };
    (getVegaIapModule as jest.Mock).mockReturnValue(module);
    const listener = jest.fn();

    expect(
      Kepler.emitter.addListener(Kepler.OpenIapEvent.PurchaseUpdated, listener),
    ).toBe(subscription);
    Kepler.emitter.removeListener(
      Kepler.OpenIapEvent.PurchaseUpdated,
      listener,
    );
    expect(module.removeListener).toHaveBeenCalledWith(
      Kepler.OpenIapEvent.PurchaseUpdated,
      listener,
    );
    const purchaseSub = Kepler.purchaseUpdatedListener(listener);
    const purchaseHandler = module.addListener.mock.lastCall?.[1];
    const errorSub = Kepler.purchaseErrorListener(listener);
    const errorHandler = module.addListener.mock.lastCall?.[1];
    expect(purchaseSub).toBe(subscription);
    expect(errorSub).toBe(subscription);
    purchaseHandler?.({productId: 'premium'});
    errorHandler?.({code: 'network-error'});
    expect(listener).toHaveBeenCalledTimes(2);

    await expect(Kepler.initConnection()).resolves.toBe(true);
    await expect(Kepler.endConnection()).resolves.toBe(true);
    expect(module.initConnection).toHaveBeenCalledWith(null);
  });

  it('delegates purchase completion and catalog helpers', async () => {
    const module = {
      requestPurchase: jest.fn().mockResolvedValue([]),
      getAvailableItems: jest.fn().mockResolvedValue([]),
      consumePurchaseAndroid: jest.fn().mockResolvedValue(undefined),
      acknowledgePurchaseAndroid: jest.fn().mockResolvedValue(undefined),
      getActiveSubscriptions: jest.fn().mockResolvedValue([]),
      hasActiveSubscriptions: jest.fn().mockResolvedValue(false),
      getStorefront: jest.fn().mockResolvedValue('USA'),
      verifyPurchaseWithProvider: jest.fn().mockResolvedValue({isValid: true}),
    };
    (getVegaIapModule as jest.Mock).mockReturnValue(module);
    const purchase = vegaPurchase({purchaseToken: 'opaque-token'});

    await expect(
      Kepler.requestPurchase({
        request: {google: {skus: ['premium']}},
        type: 'subs',
      }),
    ).resolves.toEqual([]);
    await Kepler.finishTransaction({purchase, isConsumable: true});
    await Kepler.finishTransaction({purchase, isConsumable: false});
    await expect(Kepler.acknowledgePurchaseAndroid('opaque')).resolves.toBe(
      true,
    );
    await expect(Kepler.consumePurchaseAndroid('opaque')).resolves.toBe(true);
    await Kepler.restorePurchases();
    await expect(Kepler.getActiveSubscriptions()).resolves.toEqual([]);
    await expect(Kepler.hasActiveSubscriptions()).resolves.toBe(false);
    await expect(Kepler.getStorefront()).resolves.toBe('USA');
    await expect(
      Kepler.verifyPurchaseWithProvider({
        provider: 'iapkit',
        iapkit: {
          apiKey: 'public-test-key',
          amazon: {receiptId: 'redacted', sandbox: true},
        },
      }),
    ).resolves.toEqual({isValid: true});

    expect(module.consumePurchaseAndroid).toHaveBeenCalledWith('opaque-token');
    expect(module.acknowledgePurchaseAndroid).toHaveBeenCalledWith(
      'opaque-token',
    );
  });

  it('rejects transaction completion without a purchase token', async () => {
    await expect(
      Kepler.finishTransaction({
        purchase: vegaPurchase(),
        isConsumable: false,
      }),
    ).rejects.toMatchObject({
      code: 'developer-error',
      productId: 'premium',
    });
  });

  it.each<[string, () => Promise<unknown>]>([
    ['verifyPurchase', () => Kepler.verifyPurchase({apple: {sku: 'premium'}})],
    ['syncIOS', () => Kepler.syncIOS()],
    [
      'presentExternalPurchaseLinkIOS',
      () => Kepler.presentExternalPurchaseLinkIOS('https://example.com'),
    ],
    ['deepLinkToSubscriptions', () => Kepler.deepLinkToSubscriptions()],
    [
      'isBillingProgramAvailableAndroid',
      () => Kepler.isBillingProgramAvailableAndroid('external-offer'),
    ],
    [
      'getBillingChoiceInfoAndroid',
      () => Kepler.getBillingChoiceInfoAndroid({}),
    ],
    [
      'launchExternalLinkAndroid',
      () =>
        Kepler.launchExternalLinkAndroid({
          billingProgram: 'external-offer',
          launchMode: 'launch-in-external-browser-or-app',
          linkType: 'link-to-digital-content-offer',
          linkUri: 'https://example.com',
        }),
    ],
    [
      'createBillingProgramReportingDetailsAndroid',
      () =>
        Kepler.createBillingProgramReportingDetailsAndroid({
          program: 'external-offer',
        }),
    ],
    [
      'showBillingProgramInformationDialogAndroid',
      () =>
        Kepler.showBillingProgramInformationDialogAndroid({
          externalTransactionToken: 'token',
        }),
    ],
    ['showInAppMessagesAndroid', () => Kepler.showInAppMessagesAndroid()],
  ])('rejects unsupported %s calls', async (_api, call) => {
    await expect(call()).rejects.toThrow('not supported on Amazon Vega');
  });

  it('returns inert subscriptions for unavailable listener APIs', () => {
    expect(typeof Kepler.promotedProductListenerIOS().remove).toBe('function');
    expect(typeof Kepler.userChoiceBillingListenerAndroid().remove).toBe(
      'function',
    );
    expect(typeof Kepler.developerProvidedBillingListenerAndroid().remove).toBe(
      'function',
    );
    expect(typeof Kepler.subscriptionBillingIssueListener().remove).toBe(
      'function',
    );
  });
});
