import {
  emitNativeEvent,
  listenerCount,
  nativePlugin,
  nativeRejection,
  resetNativePlugin,
  setPlatform,
} from '../__mocks__/capacitor-core';
import * as IAP from '../index';
import {ErrorCode, type Purchase} from '../types';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const purchase = (overrides: Partial<Purchase> = {}): Purchase =>
  ({
    id: 'transaction-1',
    productId: 'dev.hyo.martie.10bulbs',
    purchaseToken: 'token-1',
    purchaseState: 'purchased',
    isAutoRenewing: false,
    quantity: 1,
    store: 'google',
    storeId: 'play',
    transactionDate: 1_700_000_000_000,
    ...overrides,
  }) as Purchase;

beforeEach(() => {
  setPlatform('android');
  resetNativePlugin();
});

describe('native errors', () => {
  it('rebuilds a PurchaseError from the rejection data', async () => {
    nativePlugin.fetchProducts = jest.fn(async () => {
      throw nativeRejection('query-product', 'Billing unavailable', {
        debugMessage: 'SERVICE_UNAVAILABLE',
        responseCode: 2,
        platform: 'android',
      });
    });

    await expect(
      IAP.fetchProducts({skus: ['dev.hyo.martie.10bulbs']}),
    ).rejects.toMatchObject({
      code: ErrorCode.QueryProduct,
      message: 'Billing unavailable',
      debugMessage: 'SERVICE_UNAVAILABLE',
      responseCode: 2,
      platform: 'android',
      productIds: ['dev.hyo.martie.10bulbs'],
    });
  });

  it('keeps JavaScript errors without a native code as they are', async () => {
    const failure = new TypeError('bridge exploded');
    nativePlugin.getStorefront = jest.fn(async () => {
      throw failure;
    });
    await expect(IAP.getStorefront()).rejects.toBe(failure);
  });

  it('rejects an empty storefront as a service error', async () => {
    nativePlugin.getStorefront = jest.fn(async () => ({value: ' '}));
    await expect(IAP.getStorefront()).rejects.toMatchObject({
      code: ErrorCode.ServiceError,
    });
  });
});

describe('platform guards', () => {
  it('rejects store calls on the web without reaching the bridge', async () => {
    setPlatform('web');
    nativePlugin.initConnection = jest.fn();

    await expect(IAP.initConnection()).rejects.toMatchObject({
      code: ErrorCode.FeatureNotSupported,
    });
    expect(nativePlugin.initConnection).not.toHaveBeenCalled();
  });

  it('answers app ownership as unsupported on the web', async () => {
    setPlatform('web');
    await expect(IAP.verifyAppOwnership()).resolves.toEqual({
      status: 'unknown',
      reason: 'unsupported',
      storeId: 'unknown',
    });
  });

  it('returns inert listeners on the web', () => {
    setPlatform('web');
    const subscription = IAP.purchaseUpdatedListener(jest.fn());
    expect(nativePlugin.addListener).not.toHaveBeenCalled();
    expect(() => subscription.remove()).not.toThrow();
  });

  it('rejects iOS-only APIs on Android', async () => {
    nativePlugin.syncIOS = jest.fn();
    await expect(IAP.syncIOS()).rejects.toMatchObject({
      code: ErrorCode.FeatureNotSupported,
      message: expect.stringContaining('syncIOS is only available on iOS'),
    });
    expect(nativePlugin.syncIOS).not.toHaveBeenCalled();
  });

  it('rejects Android-only APIs on iOS', async () => {
    setPlatform('ios');
    await expect(IAP.acknowledgePurchaseAndroid('token')).rejects.toMatchObject(
      {code: ErrorCode.FeatureNotSupported},
    );
  });
});

describe('requestPurchase', () => {
  it('keys the Apple request by product type', async () => {
    setPlatform('ios');
    nativePlugin.requestPurchase = jest.fn(async () => ({value: null}));

    await IAP.requestPurchase({
      request: {apple: {sku: 'premium', appAccountToken: 'user-1'}},
      type: 'subs',
    });

    expect(nativePlugin.requestPurchase).toHaveBeenCalledWith({
      request: {
        type: 'subs',
        requestSubscription: {
          apple: {sku: 'premium', appAccountToken: 'user-1'},
        },
      },
    });
  });

  it('resolves an empty list for a subscription with no immediate result', async () => {
    setPlatform('ios');
    nativePlugin.requestPurchase = jest.fn(async () => ({value: null}));
    await expect(
      IAP.requestPurchase({request: {apple: {sku: 'premium'}}, type: 'subs'}),
    ).resolves.toEqual([]);
  });

  it('sends only the Google request on Android', async () => {
    nativePlugin.requestPurchase = jest.fn(async () => ({value: []}));

    await IAP.requestPurchase({
      request: {
        apple: {sku: 'coins'},
        google: {skus: ['coins'], obfuscatedAccountId: 'account'},
      },
      type: 'in-app',
    });

    expect(nativePlugin.requestPurchase).toHaveBeenCalledWith({
      request: {
        type: 'in-app',
        requestPurchase: {
          google: {skus: ['coins'], obfuscatedAccountId: 'account'},
        },
      },
    });
  });

  it.each([
    [
      'an empty Google SKU list',
      {google: {skus: []}},
      'in-app',
      ErrorCode.EmptySkuList,
    ],
    [
      'a missing Apple request on iOS',
      {google: {skus: ['coins']}},
      'in-app',
      ErrorCode.EmptySkuList,
    ],
    [
      'subscription options on a one-time purchase',
      {google: {skus: ['coins'], purchaseToken: 'old'}},
      'in-app',
      ErrorCode.DeveloperError,
    ],
    [
      'an offer without a token',
      {
        google: {
          skus: ['premium'],
          subscriptionOffers: [{sku: 'premium', offerToken: ''}],
        },
      },
      'subs',
      ErrorCode.DeveloperError,
    ],
    [
      'the all product type',
      {google: {skus: ['coins']}},
      'all',
      ErrorCode.DeveloperError,
    ],
  ])('rejects %s', async (name, request, type, code) => {
    if (name.includes('iOS')) setPlatform('ios');
    nativePlugin.requestPurchase = jest.fn();

    await expect(
      IAP.requestPurchase({request, type} as Parameters<
        typeof IAP.requestPurchase
      >[0]),
    ).rejects.toMatchObject({code});
    expect(nativePlugin.requestPurchase).not.toHaveBeenCalled();
  });
});

describe('finishTransaction', () => {
  beforeEach(() => {
    nativePlugin.finishTransaction = jest.fn(async () => ({value: true}));
    nativePlugin.acknowledgePurchaseAndroid = jest.fn(async () => ({
      value: true,
    }));
    nativePlugin.consumePurchaseAndroid = jest.fn(async () => ({value: true}));
  });

  it('finishes iOS purchases from the full purchase', async () => {
    setPlatform('ios');
    const iosPurchase = purchase({store: 'apple', storeId: 'apple'});
    await IAP.finishTransaction({purchase: iosPurchase});
    expect(nativePlugin.finishTransaction).toHaveBeenCalledWith({
      purchase: iosPurchase,
      isConsumable: false,
    });
  });

  it('consumes or acknowledges Play purchases by token', async () => {
    await IAP.finishTransaction({purchase: purchase(), isConsumable: true});
    await IAP.finishTransaction({purchase: purchase()});

    expect(nativePlugin.consumePurchaseAndroid).toHaveBeenCalledWith({
      purchaseToken: 'token-1',
    });
    expect(nativePlugin.acknowledgePurchaseAndroid).toHaveBeenCalledWith({
      purchaseToken: 'token-1',
    });
    expect(nativePlugin.finishTransaction).not.toHaveBeenCalled();
  });

  it('lets a community provider finish from the full purchase', async () => {
    const community = purchase({
      store: 'unknown',
      storeId: 'community_fixture',
    });
    await IAP.finishTransaction({purchase: community, isConsumable: true});
    expect(nativePlugin.finishTransaction).toHaveBeenCalledWith({
      purchase: community,
      isConsumable: true,
    });
  });

  it('requires a purchase token on Android', async () => {
    await expect(
      IAP.finishTransaction({purchase: purchase({purchaseToken: null})}),
    ).rejects.toMatchObject({code: ErrorCode.DeveloperError});
  });
});

describe('listeners', () => {
  it('stops delivering to a removed listener', async () => {
    const listener = jest.fn();
    IAP.subscriptionBillingIssueListener(listener).remove();
    await flush();

    emitNativeEvent('subscription-billing-issue', purchase());
    expect(listener).not.toHaveBeenCalled();
    expect(listenerCount('subscription-billing-issue')).toBe(1);
  });

  it('holds a purchase delivered between subscriptions for the next one', async () => {
    // A remount: the first subscription goes away before the purchase arrives.
    IAP.purchaseUpdatedListener(jest.fn()).remove();
    await flush();
    const update = purchase({id: 'held-1'});
    emitNativeEvent('purchase-updated', update);

    const listener = jest.fn();
    const subscription = IAP.purchaseUpdatedListener(listener);
    expect(listener).not.toHaveBeenCalled();
    await flush();
    expect(listener).toHaveBeenCalledWith(update);
    subscription.remove();
  });

  it('keeps a held purchase for the next listener when the first is removed before delivery', async () => {
    IAP.purchaseUpdatedListener(jest.fn()).remove();
    await flush();
    const update = purchase({id: 'held-2'});
    emitNativeEvent('purchase-updated', update);

    const removed = jest.fn();
    IAP.purchaseUpdatedListener(removed).remove();
    const next = jest.fn();
    const subscription = IAP.purchaseUpdatedListener(next);
    await flush();

    expect(removed).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(update);
    subscription.remove();
  });

  it('keeps delivering to other listeners when one throws', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const throwing = IAP.subscriptionBillingIssueListener(() => {
      throw new Error('app bug');
    });
    const listener = jest.fn();
    const subscription = IAP.subscriptionBillingIssueListener(listener);
    await flush();

    emitNativeEvent('subscription-billing-issue', purchase({id: 'issue-1'}));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();
    throwing.remove();
    subscription.remove();
    consoleError.mockRestore();
  });

  it('drops events no one holds when no listener is attached', async () => {
    IAP.purchaseErrorListener(jest.fn()).remove();
    await flush();
    emitNativeEvent('purchase-error', {code: 'user-cancelled', message: 'x'});

    const listener = jest.fn();
    const subscription = IAP.purchaseErrorListener(listener);
    await flush();
    expect(listener).not.toHaveBeenCalled();
    subscription.remove();
  });

  it('delivers purchase errors with canonical codes', async () => {
    const listener = jest.fn();
    const subscription = IAP.purchaseErrorListener(listener);
    await flush();

    emitNativeEvent('purchase-error', {
      code: 'E_USER_CANCELLED',
      message: 'cancelled',
    });
    subscription.remove();
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({code: ErrorCode.UserCancelled}),
    );
  });

  it('delivers an iOS transaction to each listener once', async () => {
    setPlatform('ios');
    const listener = jest.fn();
    const subscription = IAP.purchaseUpdatedListener(listener);
    await flush();

    const update = purchase({id: 'apple-1', store: 'apple'});
    emitNativeEvent('purchase-updated', update);
    emitNativeEvent('purchase-updated', update);
    expect(listener).toHaveBeenCalledTimes(1);
    subscription.remove();
  });

  it('asks native for duplicate iOS updates while an opted-out listener lives', async () => {
    setPlatform('ios');
    const listener = jest.fn();
    const subscription = IAP.purchaseUpdatedListener(listener, {
      dedupeTransactionIOS: false,
    });
    await flush();

    const update = purchase({id: 'apple-2', store: 'apple'});
    emitNativeEvent('purchase-updated', update);
    emitNativeEvent('purchase-updated', update);
    expect(listener).toHaveBeenCalledTimes(2);

    subscription.remove();
    expect(nativePlugin.setPurchaseUpdatedListenerOptions.mock.calls).toEqual([
      [{dedupeTransactionIOS: false}],
      [{dedupeTransactionIOS: true}],
    ]);
  });

  it('does not replay a promoted product after remove', async () => {
    setPlatform('ios');
    nativePlugin.getPromotedProductIOS = jest.fn(async () => ({
      value: {id: 'dev.hyo.martie.premium', platform: 'ios'},
    }));
    const listener = jest.fn();

    IAP.promotedProductListenerIOS(listener).remove();
    await flush();

    expect(listener).not.toHaveBeenCalled();
  });

  it('replays a pending promoted product once', async () => {
    setPlatform('ios');
    const product = {id: 'dev.hyo.martie.premium', platform: 'ios'};
    nativePlugin.getPromotedProductIOS = jest.fn(async () => ({
      value: product,
    }));
    const listener = jest.fn();

    IAP.promotedProductListenerIOS(listener);
    await flush();
    emitNativeEvent('promoted-product-ios', {productId: product.id});
    await flush();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(product);
  });
});

describe('native listener attachment', () => {
  // A fresh SDK and bridge, before any native listener is attached.
  const loadFresh = async () => {
    let sdk!: typeof IAP;
    let core!: typeof import('../__mocks__/capacitor-core');
    await jest.isolateModulesAsync(async () => {
      core = await import('../__mocks__/capacitor-core');
      sdk = await import('../index');
    });
    return {sdk, core};
  };

  it('delivers a purchase native retained before the first listener', async () => {
    const {sdk, core} = await loadFresh();
    const update = purchase({id: 'launch-1'});
    core.emitNativeEvent('purchase-updated', update, {
      retainUntilConsumed: true,
    });

    const listener = jest.fn();
    const subscription = sdk.purchaseUpdatedListener(listener);
    await flush();
    expect(listener).toHaveBeenCalledWith(update);
    subscription.remove();
  });

  it('attaches again after the native listener fails to attach', async () => {
    const {sdk, core} = await loadFresh();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    core.nativePlugin.addListener.mockRejectedValueOnce(new Error('bridge'));
    sdk.subscriptionBillingIssueListener(jest.fn());
    await flush();
    expect(warn).toHaveBeenCalled();

    const listener = jest.fn();
    const subscription = sdk.subscriptionBillingIssueListener(listener);
    await flush();
    core.emitNativeEvent('subscription-billing-issue', purchase());
    expect(listener).toHaveBeenCalledTimes(1);
    subscription.remove();
    warn.mockRestore();
  });
});

describe('results', () => {
  it('fills the IAPKit store id from the legacy store', async () => {
    nativePlugin.verifyPurchaseWithProvider = jest.fn(async () => ({
      value: {
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          state: 'entitled',
          store: 'google',
          clientPayload: null,
        },
      },
    }));

    const result = await IAP.verifyPurchaseWithProvider({
      provider: 'iapkit',
      iapkit: {apiKey: 'key', google: {purchaseToken: 'token'}},
    });
    expect(result.iapkit).toEqual({
      isValid: true,
      state: 'entitled',
      store: 'google',
      storeId: 'play',
    });
  });

  it('accepts both reporting-details call styles', async () => {
    nativePlugin.createBillingProgramReportingDetailsAndroid = jest.fn(
      async () => ({
        value: {
          billingProgram: 'external-offer',
          externalTransactionToken: 'token',
        },
      }),
    );

    await IAP.createBillingProgramReportingDetailsAndroid('external-offer');
    await IAP.createBillingProgramReportingDetailsAndroid({
      program: 'external-payments',
      developerBillingType: 'external-link',
    });
    expect(
      nativePlugin.createBillingProgramReportingDetailsAndroid.mock.calls,
    ).toEqual([
      [{program: 'external-offer', developerBillingType: null}],
      [{program: 'external-payments', developerBillingType: 'external-link'}],
    ]);
  });

  it('fails a restore the store did not complete', async () => {
    nativePlugin.restorePurchases = jest.fn(async () => ({value: false}));
    await expect(IAP.restorePurchases()).rejects.toMatchObject({
      code: ErrorCode.SyncError,
    });
  });
});
