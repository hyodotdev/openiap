// Mock native module and RN
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('../ExpoIapModule', () => require('../__mocks__/ExpoIapModule'));
jest.mock('react-native', () => ({
  Platform: {OS: 'ios', select: jest.fn((obj) => obj.ios)},
  NativeEventEmitter: jest.fn(() => ({
    addListener: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
}));

/* eslint-disable import/first */
import ExpoIapModule from '../ExpoIapModule';
import {
  purchaseUpdatedListener,
  purchaseErrorListener,
  OpenIapEvent,
  fetchProducts,
  requestPurchase,
  initConnection,
  endConnection,
  finishTransaction,
  getStorefront,
  deepLinkToSubscriptions,
  getAvailablePurchases,
  restorePurchases,
  promotedProductListenerIOS,
  subscriptionBillingIssueListener,
  userChoiceBillingListenerAndroid,
  developerProvidedBillingListenerAndroid,
  type ProductType,
  type PurchaseInput,
  type RequestPurchaseAndroidProps,
  type RequestSubscriptionAndroidProps,
  getActiveSubscriptions,
  hasActiveSubscriptions,
  openRedeemOfferCode,
  verifyPurchase,
  verifyPurchaseWithProvider,
  ErrorCode,
} from '../index';
import * as iosMod from '../modules/ios';
import * as androidMod from '../modules/android';
import {Platform} from 'react-native';
/* eslint-enable import/first */

const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

const nativePurchase = (
  id: string,
  overrides: Record<string, unknown> = {},
) => ({
  id,
  productId: `product.${id}`,
  transactionDate: 1720000000000,
  store: 'google',
  quantity: 1,
  purchaseState: 'purchased',
  isAutoRenewing: false,
  ...overrides,
});

const registeredListener = (index: number): ((payload: unknown) => void) => {
  const call = jest.mocked(ExpoIapModule.addListener).mock.calls[index];
  if (!call) {
    throw new Error(`addListener call ${index} was not recorded`);
  }
  return call[1];
};

const purchaseUpdatedOptionsMock = () => {
  const setOptions = ExpoIapModule.setPurchaseUpdatedListenerOptions;
  if (!setOptions) {
    throw new Error(
      'The native mock defines setPurchaseUpdatedListenerOptions',
    );
  }
  return jest.mocked(setOptions);
};

afterEach(() => {
  consoleLogSpy.mockClear();
});

afterAll(() => {
  consoleLogSpy.mockRestore();
});

describe('Public API (index.ts)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(Platform, {OS: 'ios'});
    (ExpoIapModule.getPromotedProductIOS as jest.Mock).mockResolvedValue(null);
  });

  describe('listeners', () => {
    it('registers purchase updated listener', () => {
      const addListener = jest.mocked(ExpoIapModule.addListener);
      const fn = jest.fn();
      const subscription = purchaseUpdatedListener(fn);
      expect(addListener).toHaveBeenCalledWith(
        OpenIapEvent.PurchaseUpdated,
        expect.any(Function),
      );
      const passed = registeredListener(0);
      const event = {id: 't', productId: 'p', store: 'apple'};
      passed(event);
      expect(fn).toHaveBeenCalledWith(event);
      expect(typeof subscription.remove).toBe('function');
    });

    it('registers non-deduping purchase updated listener on iOS', () => {
      const addListener = jest.mocked(ExpoIapModule.addListener);
      const setOptions = purchaseUpdatedOptionsMock();
      const fn = jest.fn();
      const subscription = purchaseUpdatedListener(fn, {
        dedupeTransactionIOS: false,
      });
      expect(setOptions).toHaveBeenCalledWith({
        dedupeTransactionIOS: false,
      });
      expect(addListener).toHaveBeenCalledWith(
        OpenIapEvent.PurchaseUpdated,
        expect.any(Function),
      );
      subscription.remove();
    });

    it('removes listener through native subscription when available', () => {
      const addListener = jest.mocked(ExpoIapModule.addListener);
      const nativeRemove = jest.fn();
      addListener.mockReturnValueOnce({remove: nativeRemove});

      const subscription = purchaseUpdatedListener(jest.fn());
      subscription.remove();
      subscription.remove();

      expect(nativeRemove).toHaveBeenCalledTimes(1);
    });

    it('falls back to native removeListener when addListener returns void', () => {
      const addListener = jest.mocked(ExpoIapModule.addListener);
      const removeListener = ExpoIapModule.removeListener;
      addListener.mockReturnValueOnce(undefined);

      const subscription = purchaseUpdatedListener(jest.fn());
      const nativeListener = registeredListener(0);
      subscription.remove();
      subscription.remove();

      expect(removeListener).toHaveBeenCalledTimes(1);
      expect(removeListener).toHaveBeenCalledWith(
        OpenIapEvent.PurchaseUpdated,
        nativeListener,
      );
    });

    it('filters duplicate replay events for default listeners when a non-deduping listener is active', () => {
      const defaultListener = jest.fn();
      const nonDedupingListener = jest.fn();

      purchaseUpdatedListener(defaultListener);
      const nonDedupingSubscription = purchaseUpdatedListener(
        nonDedupingListener,
        {
          dedupeTransactionIOS: false,
        },
      );

      const defaultHandler = registeredListener(0);
      const nonDedupingHandler = registeredListener(1);
      const event = {
        id: 'expo-dedupe-replay',
        productId: 'p',
        platform: 'IOS',
      };

      defaultHandler(event);
      nonDedupingHandler(event);
      defaultHandler(event);
      nonDedupingHandler(event);

      expect(defaultListener).toHaveBeenCalledTimes(1);
      expect(nonDedupingListener).toHaveBeenCalledTimes(2);
      nonDedupingSubscription.remove();
    });

    it('resets default listener duplicate history after endConnection', async () => {
      (ExpoIapModule.endConnection as jest.Mock).mockResolvedValue(true);
      const listener = jest.fn();

      purchaseUpdatedListener(listener);
      const handler = registeredListener(0);
      const event = {
        id: 'expo-dedupe-after-reconnect',
        productId: 'p',
        platform: 'IOS',
      };

      handler(event);
      handler(event);
      expect(listener).toHaveBeenCalledTimes(1);

      await endConnection();
      handler(event);

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('reapplies non-deduping purchase updated option after reconnect', async () => {
      Object.assign(Platform, {OS: 'ios'});
      (ExpoIapModule.initConnection as jest.Mock).mockResolvedValue(true);
      (ExpoIapModule.endConnection as jest.Mock).mockResolvedValue(true);
      const setOptions = purchaseUpdatedOptionsMock();

      const subscription = purchaseUpdatedListener(jest.fn(), {
        dedupeTransactionIOS: false,
      });
      expect(setOptions).toHaveBeenLastCalledWith({
        dedupeTransactionIOS: false,
      });

      setOptions.mockClear();
      await endConnection();
      await initConnection();

      expect(setOptions).toHaveBeenCalledTimes(1);
      expect(setOptions).toHaveBeenCalledWith({
        dedupeTransactionIOS: false,
      });
      subscription.remove();
    });

    it('removes non-deduping purchase updated listeners idempotently', () => {
      const setOptions = purchaseUpdatedOptionsMock();

      const firstSubscription = purchaseUpdatedListener(jest.fn(), {
        dedupeTransactionIOS: false,
      });
      const secondSubscription = purchaseUpdatedListener(jest.fn(), {
        dedupeTransactionIOS: false,
      });

      firstSubscription.remove();
      firstSubscription.remove();
      secondSubscription.remove();

      expect(setOptions.mock.calls).toEqual([
        [{dedupeTransactionIOS: false}],
        [{dedupeTransactionIOS: false}],
        [{dedupeTransactionIOS: false}],
        [{dedupeTransactionIOS: true}],
      ]);
    });

    it('registers purchase error listener', () => {
      const addListener = jest.mocked(ExpoIapModule.addListener);
      const fn = jest.fn();
      purchaseErrorListener(fn);
      expect(addListener).toHaveBeenCalledWith(
        OpenIapEvent.PurchaseError,
        expect.any(Function),
      );
      const passed = registeredListener(0);
      const err = {
        message: 'm',
        code: 'query-product',
        responseCode: 7,
        debugMessage: 'query failed',
        productId: 'sku1',
        productIds: ['sku1', 'sku2'],
        productType: 'subs',
        isEmptyProductList: false,
        subResponseCodeAndroid: 'user-ineligible',
      };
      passed(err);
      expect(fn).toHaveBeenCalledWith(err);
    });

    it('promotedProductListenerIOS warns on non‑iOS, adds on iOS', () => {
      Object.assign(Platform, {OS: 'android'});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const sub = promotedProductListenerIOS(jest.fn());
      expect(typeof sub.remove).toBe('function');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();

      Object.assign(Platform, {OS: 'ios'});
      const addListener = jest.mocked(ExpoIapModule.addListener);
      promotedProductListenerIOS(jest.fn());
      expect(addListener).toHaveBeenCalledWith(
        'promoted-product-ios',
        expect.any(Function),
      );
    });

    it('promotedProductListenerIOS replays pending promoted product on iOS', async () => {
      Object.assign(Platform, {OS: 'ios'});
      const product = {id: 'promoted-product', platform: 'ios'};
      (ExpoIapModule.getPromotedProductIOS as jest.Mock).mockResolvedValue(
        product,
      );
      const listener = jest.fn();

      promotedProductListenerIOS(listener);
      await Promise.resolve();

      expect(ExpoIapModule.getPromotedProductIOS).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(product);
    });

    it('promotedProductListenerIOS dedupes replayed promoted product', async () => {
      Object.assign(Platform, {OS: 'ios'});
      const product = {id: 'promoted-product', platform: 'ios'};
      (ExpoIapModule.getPromotedProductIOS as jest.Mock).mockResolvedValue(
        product,
      );
      const listener = jest.fn();

      promotedProductListenerIOS(listener);
      const nativeListener = registeredListener(0);
      nativeListener('promoted-product');
      await Promise.resolve();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('promotedProductListenerIOS resolves native SKU payloads', async () => {
      Object.assign(Platform, {OS: 'ios'});
      const product = {id: 'promoted-product', platform: 'ios'};
      (ExpoIapModule.getPromotedProductIOS as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(product);
      const listener = jest.fn();

      promotedProductListenerIOS(listener);
      const nativeListener = registeredListener(0);
      nativeListener('promoted-product');
      await Promise.resolve();

      expect(listener).toHaveBeenCalledWith(product);
      expect(listener).not.toHaveBeenCalledWith('promoted-product');
    });

    it('userChoiceBillingListenerAndroid warns on non‑Android, adds on Android', () => {
      Object.assign(Platform, {OS: 'ios'});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const sub = userChoiceBillingListenerAndroid(jest.fn());
      expect(typeof sub.remove).toBe('function');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();

      Object.assign(Platform, {OS: 'android'});
      const addListener = jest.mocked(ExpoIapModule.addListener);
      userChoiceBillingListenerAndroid(jest.fn());
      expect(addListener).toHaveBeenCalledWith(
        OpenIapEvent.UserChoiceBillingAndroid,
        expect.any(Function),
      );
    });

    it('developerProvidedBillingListenerAndroid warns on non‑Android, adds on Android', () => {
      Object.assign(Platform, {OS: 'ios'});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const sub = developerProvidedBillingListenerAndroid(jest.fn());
      expect(typeof sub.remove).toBe('function');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();

      Object.assign(Platform, {OS: 'android'});
      const addListener = jest.mocked(ExpoIapModule.addListener);
      const fn = jest.fn();
      developerProvidedBillingListenerAndroid(fn);
      expect(addListener).toHaveBeenCalledWith(
        OpenIapEvent.DeveloperProvidedBillingAndroid,
        expect.any(Function),
      );
    });

    it('developerProvidedBillingListenerAndroid receives correct event data', () => {
      Object.assign(Platform, {OS: 'android'});
      const addListener = jest.mocked(ExpoIapModule.addListener);
      const fn = jest.fn();
      developerProvidedBillingListenerAndroid(fn);

      // Get the callback that was registered
      const registeredCallback = addListener.mock.calls.find(
        ([eventName]) =>
          eventName === OpenIapEvent.DeveloperProvidedBillingAndroid,
      )?.[1];

      // Simulate event with external transaction token
      const mockDetails = {
        externalTransactionToken: 'ext-txn-token-12345',
      };
      registeredCallback?.(mockDetails);

      expect(fn).toHaveBeenCalledWith(mockDetails);
      expect(fn.mock.calls[0][0].externalTransactionToken).toBe(
        'ext-txn-token-12345',
      );
    });

    it('subscriptionBillingIssueListener forwards the canonical purchase', () => {
      const addListener = jest.mocked(ExpoIapModule.addListener);
      const fn = jest.fn();
      subscriptionBillingIssueListener(fn);

      expect(addListener).toHaveBeenCalledWith(
        OpenIapEvent.SubscriptionBillingIssue,
        expect.any(Function),
      );

      const registeredCallback = addListener.mock.calls.find(
        ([eventName]) => eventName === OpenIapEvent.SubscriptionBillingIssue,
      )?.[1];
      const purchase = {
        id: 'billing-issue',
        productId: 'sub.monthly',
        store: 'apple',
      };
      registeredCallback?.(purchase);

      expect(fn).toHaveBeenCalledWith(purchase);
    });
  });

  describe('connection', () => {
    it('initConnection and endConnection delegate to native', async () => {
      (ExpoIapModule.initConnection as jest.Mock) = jest
        .fn()
        .mockResolvedValue(true);
      (ExpoIapModule.endConnection as jest.Mock) = jest
        .fn()
        .mockResolvedValue(true);
      await expect(initConnection()).resolves.toBe(true);
      await expect(endConnection()).resolves.toBe(true);
      expect(ExpoIapModule.initConnection).toHaveBeenCalled();
      expect(ExpoIapModule.endConnection).toHaveBeenCalled();
    });

    it('forwards developer-rendered Billing Choice connection config', async () => {
      (ExpoIapModule.initConnection as jest.Mock) = jest
        .fn()
        .mockResolvedValue(true);

      await expect(
        initConnection({
          enableBillingProgramAndroid: 'billing-choice',
          billingChoiceScreenTypeAndroid: 'developer-rendered',
        }),
      ).resolves.toBe(true);

      expect(ExpoIapModule.initConnection).toHaveBeenCalledWith({
        enableBillingProgramAndroid: 'billing-choice',
        billingChoiceScreenTypeAndroid: 'developer-rendered',
      });
    });
  });

  describe('fetchProducts', () => {
    it('filters iOS products by skus', async () => {
      Object.assign(Platform, {OS: 'ios'});
      (ExpoIapModule.fetchProducts as jest.Mock) = jest.fn().mockResolvedValue([
        {platform: 'ios', id: 'a'},
        {platform: 'ios', id: 'b'},
        {platform: 'android', id: 'a'},
      ]);
      const res = await fetchProducts({skus: ['b', 'c'], type: 'in-app'});
      expect(res).toEqual([{platform: 'ios', id: 'b'}]);
    });

    it('filters Android products by skus', async () => {
      Object.assign(Platform, {OS: 'android'});
      (ExpoIapModule.fetchProducts as jest.Mock) = jest.fn().mockResolvedValue([
        {platform: 'android', id: 'sub1'},
        {platform: 'android', id: 'sub2'},
        {platform: 'ios', id: 'sub1'},
      ]);
      const res = await fetchProducts({skus: ['sub2'], type: 'subs'});
      expect(ExpoIapModule.fetchProducts).toHaveBeenCalledWith('subs', [
        'sub2',
      ]);
      expect(res).toEqual([{platform: 'android', id: 'sub2'}]);
    });

    it('fetchProducts rejects on empty skus', async () => {
      await expect(
        fetchProducts({skus: [], type: 'in-app'}),
      ).rejects.toMatchObject({
        code: 'empty-sku-list',
      });
    });

    it('fetchProducts default path throws unsupported platform', async () => {
      Object.assign(Platform, {OS: 'windows'});
      await expect(fetchProducts({skus: ['a']})).rejects.toThrow(
        /Unsupported platform/,
      );
    });

    it('rejects the removed inapp type alias', async () => {
      Object.assign(Platform, {OS: 'ios'});
      (ExpoIapModule.fetchProducts as jest.Mock) = jest
        .fn()
        .mockResolvedValue([{platform: 'ios', id: 'legacy'}]);

      await expect(
        // @ts-expect-error the removed alias reaches the runtime check
        fetchProducts({skus: ['legacy'], type: 'inapp'}),
      ).rejects.toThrow(/Unsupported product type/);
      expect(ExpoIapModule.fetchProducts).not.toHaveBeenCalled();
    });

    it('returns results unchanged when querying all product types', async () => {
      Object.assign(Platform, {OS: 'ios'});
      (ExpoIapModule.fetchProducts as jest.Mock) = jest.fn().mockResolvedValue([
        {platform: 'ios', id: 'a'},
        {platform: 'ios', id: 'b'},
      ]);

      const res = await fetchProducts({skus: ['a', 'b'], type: 'all'});

      expect(res).toEqual([
        {platform: 'ios', id: 'a'},
        {platform: 'ios', id: 'b'},
      ]);
    });

    it('restores Android query diagnostics from the native error envelope', async () => {
      Object.assign(Platform, {OS: 'android'});
      const payload = {
        code: 'query-product',
        message: 'Failed to query products',
        debugMessage: 'Item unavailable',
        responseCode: 4,
        productIds: ['missing'],
        productType: 'subs',
        isEmptyProductList: false,
        platform: 'android',
      };
      (ExpoIapModule.fetchProducts as jest.Mock) = jest
        .fn()
        .mockRejectedValue(
          new Error(`OPENIAP_ERROR_JSON:${JSON.stringify(payload)}`),
        );

      await expect(
        fetchProducts({skus: ['missing'], type: 'subs'}),
      ).rejects.toMatchObject(payload);
    });
  });

  describe('requestPurchase', () => {
    it('passes through iOS purchase params', async () => {
      Object.assign(Platform, {OS: 'ios'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue({id: 'x'});
      const res = await requestPurchase({
        request: {
          apple: {
            sku: 'sku1',
            andDangerouslyFinishTransactionAutomatically: true,
          },
        },
        type: 'in-app',
      });
      expect(ExpoIapModule.requestPurchase).toHaveBeenCalledWith({
        type: 'in-app',
        request: {
          apple: {
            sku: 'sku1',
            andDangerouslyFinishTransactionAutomatically: true,
          },
        },
      });
      expect(res).toEqual({id: 'x'});
    });

    it('rejects query-only all on iOS', async () => {
      Object.assign(Platform, {OS: 'ios'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest.fn();
      await expect(
        requestPurchase({
          request: {apple: {sku: 'skuX'}},
          // @ts-expect-error query-only type reaches the runtime check
          type: 'all',
        }),
      ).rejects.toThrow(/only supported for product queries/);
      expect(ExpoIapModule.requestPurchase).not.toHaveBeenCalled();
    });

    it('returns canonical iOS array purchases', async () => {
      Object.assign(Platform, {OS: 'ios'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue([{id: 'a', store: 'apple'}]);

      const res = await requestPurchase({
        request: {apple: {sku: 'skuSub'}},
        type: 'subs',
      });

      expect(res).toEqual([{id: 'a', store: 'apple'}]);
    });

    it('restores iOS purchase diagnostics from the native error envelope', async () => {
      Object.assign(Platform, {OS: 'ios'});
      const payload = {
        code: 'sku-not-found',
        message: 'Product not found',
        debugMessage: 'StoreKit returned no product',
        productId: 'missing_sku',
        platform: 'ios',
      };
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockRejectedValue(
          new Error(
            `Call rejected.\n→ Caused by: OPENIAP_ERROR_JSON:${JSON.stringify(
              payload,
            )} (at ExpoIap/ExpoIapHelper.swift:21)`,
          ),
        );

      await expect(
        requestPurchase({
          request: {apple: {sku: 'missing_sku'}},
          type: 'in-app',
        }),
      ).rejects.toMatchObject({
        ...payload,
        productIds: ['missing_sku'],
        productType: 'in-app',
      });
    });

    it('returns empty array when iOS subs resolves null', async () => {
      Object.assign(Platform, {OS: 'ios'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue(null);

      const res = await requestPurchase({
        request: {apple: {sku: 'skuSub'}},
        type: 'subs',
      });

      expect(res).toEqual([]);
    });

    it('maps Android in-app request properly', async () => {
      Object.assign(Platform, {OS: 'android'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue([]);
      await requestPurchase({
        request: {google: {skus: ['p1']}},
        type: 'in-app',
      });
      expect(ExpoIapModule.requestPurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'in-app',
          skus: ['p1'],
        }),
      );
    });

    it('maps Android subs request using subscriptionOffers', async () => {
      Object.assign(Platform, {OS: 'android'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue([]);
      await requestPurchase({
        request: {
          google: {
            skus: ['sub1'],
            subscriptionOffers: [{sku: 'sub1', offerToken: 'token-123'}],
          },
        },
        type: 'subs',
      });
      expect(ExpoIapModule.requestPurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'subs',
          skus: ['sub1'],
          subscriptionOffers: [{sku: 'sub1', offerToken: 'token-123'}],
        }),
      );
    });

    it.each<
      [
        ProductType,
        RequestPurchaseAndroidProps & RequestSubscriptionAndroidProps,
      ]
    >([
      ['in-app', {skus: ['coins'], subscriptionOffers: []}],
      [
        'in-app',
        {
          skus: ['coins'],
          subscriptionProductReplacementParams: {
            oldProductId: 'old',
            replacementMode: 'without-proration',
          },
        },
      ],
      ['subs', {skus: ['premium'], offerToken: 'one-time-token'}],
    ])(
      'rejects branch-mismatched Android options for %s without native dispatch',
      async (type, google) => {
        Object.assign(Platform, {OS: 'android'});
        (ExpoIapModule.requestPurchase as jest.Mock) = jest.fn();

        await expect(
          requestPurchase({request: {google}, type}),
        ).rejects.toThrow(/must match the selected product type/);
        expect(ExpoIapModule.requestPurchase).not.toHaveBeenCalled();
      },
    );

    it('iOS rejects when sku missing', async () => {
      Object.assign(Platform, {OS: 'ios'});
      await expect(
        // @ts-expect-error a missing sku reaches the runtime check
        requestPurchase({request: {apple: {}}, type: 'in-app'}),
      ).rejects.toMatchObject({code: ErrorCode.EmptySkuList});
    });

    it('Android rejects when skus missing', async () => {
      Object.assign(Platform, {OS: 'android'});
      await expect(
        // @ts-expect-error missing skus reach the runtime check
        requestPurchase({request: {google: {}}, type: 'in-app'}),
      ).rejects.toThrow(/skus/);
    });

    it('Android invalid type throws', async () => {
      Object.assign(Platform, {OS: 'android'});
      await expect(
        requestPurchase({
          request: {google: {skus: ['x']}},
          // @ts-expect-error an unknown type reaches the runtime check
          type: 'other',
        }),
      ).rejects.toThrow(/Unsupported product type/);
    });

    it('Android rejects purchase requests for all product types', async () => {
      Object.assign(Platform, {OS: 'android'});
      await expect(
        requestPurchase({
          request: {google: {skus: ['x']}},
          // @ts-expect-error query-only type reaches the runtime check
          type: 'all',
        }),
      ).rejects.toMatchObject({
        code: ErrorCode.DeveloperError,
        message: expect.stringMatching(/only supported for product queries/),
      });
    });

    it('Android subscription requests require skus array', async () => {
      Object.assign(Platform, {OS: 'android'});
      await expect(
        requestPurchase({
          // @ts-expect-error missing skus reach the runtime check
          request: {google: {}},
          type: 'subs',
        }),
      ).rejects.toThrow(/The `skus` property is required/);
    });

    it('Android subscription passes subscriptionProductReplacementParams to native module', async () => {
      Object.assign(Platform, {OS: 'android'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue([]);

      await requestPurchase({
        request: {
          google: {
            skus: ['new_subscription'],
            subscriptionOffers: [
              {sku: 'new_subscription', offerToken: 'token'},
            ],
            subscriptionProductReplacementParams: {
              oldProductId: 'old_subscription',
              replacementMode: 'with-time-proration',
            },
          },
        },
        type: 'subs',
      });

      expect(ExpoIapModule.requestPurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'subs',
          skus: ['new_subscription'],
          subscriptionProductReplacementParams: {
            oldProductId: 'old_subscription',
            replacementMode: 'with-time-proration',
          },
        }),
      );
    });

    it('Android subscription passes subscriptionProductReplacementParams with all replacement modes', async () => {
      Object.assign(Platform, {OS: 'android'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue([]);

      const replacementModes = [
        'unknown-replacement-mode',
        'with-time-proration',
        'charge-prorated-price',
        'charge-full-price',
        'without-proration',
        'deferred',
        'keep-existing',
      ] as const;

      for (const mode of replacementModes) {
        await requestPurchase({
          request: {
            google: {
              skus: ['new_sub'],
              subscriptionOffers: [{sku: 'new_sub', offerToken: 'token'}],
              subscriptionProductReplacementParams: {
                oldProductId: 'old_sub',
                replacementMode: mode,
              },
            },
          },
          type: 'subs',
        });

        expect(ExpoIapModule.requestPurchase).toHaveBeenLastCalledWith(
          expect.objectContaining({
            subscriptionProductReplacementParams: {
              oldProductId: 'old_sub',
              replacementMode: mode,
            },
          }),
        );
      }
    });

    it('Android subscription works without subscriptionProductReplacementParams (optional)', async () => {
      Object.assign(Platform, {OS: 'android'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue([]);

      await requestPurchase({
        request: {
          google: {
            skus: ['subscription'],
            subscriptionOffers: [{sku: 'subscription', offerToken: 'token'}],
          },
        },
        type: 'subs',
      });

      expect(ExpoIapModule.requestPurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'subs',
          skus: ['subscription'],
          subscriptionProductReplacementParams: undefined,
        }),
      );
    });

    it('Android forwards minimal in-app Billing Choice options', async () => {
      Object.assign(Platform, {OS: 'android'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue([]);

      await requestPurchase({
        request: {
          google: {
            skus: ['premium'],
            developerBillingOption: {billingProgram: 'billing-choice'},
          },
        },
        type: 'in-app',
      });

      expect(ExpoIapModule.requestPurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          developerBillingOption: {billingProgram: 'billing-choice'},
        }),
      );
    });

    it('Android forwards Billing Choice subscription replacement fields', async () => {
      Object.assign(Platform, {OS: 'android'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue([]);

      await requestPurchase({
        request: {
          google: {
            skus: ['premium_monthly'],
            originalExternalTransactionId: 'original-external-id',
            developerBillingOption: {
              billingProgram: 'billing-choice',
              externalTransactionToken: 'pre-generated-token',
              launchMode: 'caller-will-launch-link',
              linkUri: 'https://example.com/checkout',
            },
          },
        },
        type: 'subs',
      });

      expect(ExpoIapModule.requestPurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          originalExternalTransactionId: 'original-external-id',
          developerBillingOption: {
            billingProgram: 'billing-choice',
            externalTransactionToken: 'pre-generated-token',
            launchMode: 'caller-will-launch-link',
            linkUri: 'https://example.com/checkout',
          },
        }),
      );
    });

    it('Android subscription passes canonical replacement parameters', async () => {
      Object.assign(Platform, {OS: 'android'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue([]);

      await requestPurchase({
        request: {
          google: {
            skus: ['new_subscription'],
            subscriptionOffers: [
              {sku: 'new_subscription', offerToken: 'token'},
            ],
            purchaseToken: 'old-purchase-token',
            subscriptionProductReplacementParams: {
              oldProductId: 'old_subscription',
              replacementMode: 'charge-prorated-price',
            },
          },
        },
        type: 'subs',
      });

      expect(ExpoIapModule.requestPurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'subs',
          skus: ['new_subscription'],
          purchaseToken: 'old-purchase-token',
          subscriptionProductReplacementParams: {
            oldProductId: 'old_subscription',
            replacementMode: 'charge-prorated-price',
          },
        }),
      );
    });

    it('iOS maps withOffer through offerToRecordIOS', async () => {
      Object.assign(Platform, {OS: 'ios'});
      const offer = {
        identifier: 'id',
        keyIdentifier: 'key',
        nonce: 'nonce',
        signature: 'sig',
        timestamp: 1234567890,
      };
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue({id: 'x'});
      await requestPurchase({
        request: {apple: {sku: 'sku1', withOffer: offer}},
        type: 'in-app',
      });
      expect(ExpoIapModule.requestPurchase).toHaveBeenCalledWith({
        type: 'in-app',
        request: {
          apple: {
            sku: 'sku1',
            withOffer: offer,
          },
        },
      });
    });

    it('iOS passes advancedCommerceData for attribution tracking', async () => {
      Object.assign(Platform, {OS: 'ios'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue({id: 'purchase-123'});

      const res = await requestPurchase({
        request: {
          apple: {
            sku: 'com.example.premium',
            advancedCommerceData: 'campaign_summer_2025',
          },
        },
        type: 'in-app',
      });

      expect(ExpoIapModule.requestPurchase).toHaveBeenCalledWith({
        type: 'in-app',
        request: {
          apple: {
            sku: 'com.example.premium',
            advancedCommerceData: 'campaign_summer_2025',
          },
        },
      });
      expect(res).toEqual({id: 'purchase-123'});
    });

    it('iOS passes advancedCommerceData for subscription purchase', async () => {
      Object.assign(Platform, {OS: 'ios'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue([{id: 'sub-123', platform: 'ios'}]);

      const res = await requestPurchase({
        request: {
          apple: {
            sku: 'com.example.subscription.monthly',
            advancedCommerceData: 'affiliate_partner_123',
            appAccountToken: 'user-uuid-456',
          },
        },
        type: 'subs',
      });

      expect(ExpoIapModule.requestPurchase).toHaveBeenCalledWith({
        type: 'subs',
        request: {
          apple: {
            sku: 'com.example.subscription.monthly',
            advancedCommerceData: 'affiliate_partner_123',
            appAccountToken: 'user-uuid-456',
          },
        },
      });
      expect(res).toEqual([{id: 'sub-123', platform: 'ios'}]);
    });

    it('iOS subscription passes advanced offer fields through', async () => {
      Object.assign(Platform, {OS: 'ios'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue([{id: 'sub-advanced', platform: 'ios'}]);

      await requestPurchase({
        request: {
          apple: {
            sku: 'com.example.subscription.monthly',
            billingPlanType: 'monthly',
            compactJWS: 'intro-eligibility-jws',
            promotionalOfferJWS: {
              offerId: 'promo-offer',
              jws: 'compact-jws',
            },
            winBackOffer: {
              offerId: 'winback-offer',
            },
          },
        },
        type: 'subs',
      });

      expect(ExpoIapModule.requestPurchase).toHaveBeenCalledWith({
        type: 'subs',
        request: {
          apple: {
            sku: 'com.example.subscription.monthly',
            billingPlanType: 'monthly',
            compactJWS: 'intro-eligibility-jws',
            promotionalOfferJWS: {
              offerId: 'promo-offer',
              jws: 'compact-jws',
            },
            winBackOffer: {
              offerId: 'winback-offer',
            },
          },
        },
      });
    });

    it('iOS works without advancedCommerceData (optional field)', async () => {
      Object.assign(Platform, {OS: 'ios'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue({id: 'purchase-no-acd'});

      const res = await requestPurchase({
        request: {
          apple: {
            sku: 'com.example.product',
          },
        },
        type: 'in-app',
      });

      expect(ExpoIapModule.requestPurchase).toHaveBeenCalledWith({
        type: 'in-app',
        request: {
          apple: {
            sku: 'com.example.product',
          },
        },
      });
      expect(res).toEqual({id: 'purchase-no-acd'});
    });

    it('uses canonical apple without a compatibility warning', async () => {
      Object.assign(Platform, {OS: 'ios'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue({id: 'canonical'});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await requestPurchase({
        request: {apple: {sku: 'canonical-apple'}},
        type: 'in-app',
      });

      expect(warnSpy).not.toHaveBeenCalled();
      expect(ExpoIapModule.requestPurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          request: {apple: {sku: 'canonical-apple'}},
        }),
      );
      warnSpy.mockRestore();
    });

    it('rejects the removed ios request alias', async () => {
      Object.assign(Platform, {OS: 'ios'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue({id: 'legacy'});
      const request = {
        request: {ios: {sku: 'legacy-ios'}},
        type: 'in-app',
      };

      // @ts-expect-error the removed alias reaches the runtime check
      await expect(requestPurchase(request)).rejects.toThrow(/sku/);
      expect(ExpoIapModule.requestPurchase).not.toHaveBeenCalled();
    });

    it('rejects the removed android request alias', async () => {
      Object.assign(Platform, {OS: 'android'});
      (ExpoIapModule.requestPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue([]);
      const request = {
        request: {android: {skus: ['legacy-android']}},
        type: 'in-app',
      };

      // @ts-expect-error the removed alias reaches the runtime check
      await expect(requestPurchase(request)).rejects.toThrow(/skus/);
      expect(ExpoIapModule.requestPurchase).not.toHaveBeenCalled();
    });

    it('does not revive legacy ios when canonical apple is explicitly null', async () => {
      Object.assign(Platform, {OS: 'ios'});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(
        requestPurchase({
          request: {
            apple: null,
            // @ts-expect-error the removed alias reaches the runtime check
            ios: {sku: 'legacy-ios'},
          },
          type: 'in-app',
        }),
      ).rejects.toThrow(/sku/);

      expect(ExpoIapModule.requestPurchase).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('does not revive legacy android when canonical google is explicitly null', async () => {
      Object.assign(Platform, {OS: 'android'});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(
        requestPurchase({
          request: {
            google: null,
            // @ts-expect-error the removed alias reaches the runtime check
            android: {skus: ['legacy-android']},
          },
          type: 'in-app',
        }),
      ).rejects.toThrow(/skus/);

      expect(ExpoIapModule.requestPurchase).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('legacy wrappers and getters', () => {
    it('getAvailablePurchases: iOS and Android paths', async () => {
      // iOS path
      Object.assign(Platform, {OS: 'ios'});
      (ExpoIapModule.getAvailableItems as jest.Mock) = jest
        .fn()
        .mockResolvedValue([]);
      await getAvailablePurchases({
        alsoPublishToEventListenerIOS: true,
        onlyIncludeActiveItemsIOS: false,
      });
      expect(ExpoIapModule.getAvailableItems).toHaveBeenCalledWith(true, false);

      // Android path (unified getAvailableItems with options)
      Object.assign(Platform, {OS: 'android'});
      (ExpoIapModule.getAvailableItems as jest.Mock) = jest
        .fn()
        .mockResolvedValueOnce([
          nativePurchase('p1', {transactionId: 'txn-1'}),
          nativePurchase('s1', {transactionId: 'txn-2'}),
        ]);
      const res = await getAvailablePurchases();
      expect(ExpoIapModule.getAvailableItems).toHaveBeenCalledWith({
        alsoPublishToEventListenerIOS: false,
        onlyIncludeActiveItemsIOS: true,
        includeSuspendedAndroid: false,
      });
      expect(res).toHaveLength(2);
      expect(res.map((p) => p.id)).toEqual(['p1', 's1']);
    });

    it('getAvailablePurchases passes includeSuspendedAndroid option on Android', async () => {
      Object.assign(Platform, {OS: 'android'});
      (ExpoIapModule.getAvailableItems as jest.Mock) = jest
        .fn()
        .mockResolvedValueOnce([
          nativePurchase('active-sub', {transactionId: 'txn-1'}),
          nativePurchase('suspended-sub', {
            transactionId: 'txn-2',
            isSuspendedAndroid: true,
          }),
        ]);
      const res = await getAvailablePurchases({includeSuspendedAndroid: true});
      expect(ExpoIapModule.getAvailableItems).toHaveBeenCalledWith({
        alsoPublishToEventListenerIOS: false,
        onlyIncludeActiveItemsIOS: true,
        includeSuspendedAndroid: true,
      });
      expect(res).toHaveLength(2);
    });

    it('restorePurchases performs iOS sync then fetches purchases', async () => {
      Object.assign(Platform, {OS: 'ios'});
      const syncSpy = jest.spyOn(iosMod, 'syncIOS').mockResolvedValue(true);
      (ExpoIapModule.getAvailableItems as jest.Mock) = jest
        .fn()
        .mockResolvedValue([
          nativePurchase('legacy', {
            store: 'apple',
            transactionId: 'txn-restore',
          }),
        ]);
      await restorePurchases();
      expect(syncSpy).toHaveBeenCalledTimes(1);
      expect(ExpoIapModule.getAvailableItems).toHaveBeenCalledWith(false, true);
    });

    it('restorePurchases uses native Onside restore when active', async () => {
      Object.assign(Platform, {OS: 'ios'});
      const syncSpy = jest.spyOn(iosMod, 'syncIOS').mockResolvedValue(true);
      Object.defineProperty(ExpoIapModule, 'USING_ONSIDE_SDK', {
        configurable: true,
        value: true,
      });
      (ExpoIapModule.restorePurchases as jest.Mock) = jest
        .fn()
        .mockResolvedValue(true);
      (ExpoIapModule.getAvailableItems as jest.Mock) = jest
        .fn()
        .mockResolvedValue([
          nativePurchase('onside', {
            store: 'apple',
            transactionId: 'txn-onside',
          }),
        ]);

      try {
        await restorePurchases();

        expect(ExpoIapModule.restorePurchases).toHaveBeenCalledTimes(1);
        expect(syncSpy).not.toHaveBeenCalled();
        expect(ExpoIapModule.getAvailableItems).toHaveBeenCalledWith(
          false,
          true,
        );
      } finally {
        Reflect.deleteProperty(ExpoIapModule, 'USING_ONSIDE_SDK');
      }
    });

    it('getAvailablePurchases rejects mixed malformed results atomically', async () => {
      Object.assign(Platform, {OS: 'android'});
      (ExpoIapModule.getAvailableItems as jest.Mock) = jest
        .fn()
        .mockResolvedValue([nativePurchase('valid'), {id: 'malformed'}]);

      await expect(getAvailablePurchases()).rejects.toMatchObject({
        code: ErrorCode.BillingResponseJsonParseError,
      });
    });

    it('getAvailablePurchases rejects a foreign store on iOS', async () => {
      Object.assign(Platform, {OS: 'ios'});
      (ExpoIapModule.getAvailableItems as jest.Mock) = jest
        .fn()
        .mockResolvedValue([
          nativePurchase('foreign', {
            store: 'google',
            transactionId: 'foreign',
          }),
        ]);

      await expect(getAvailablePurchases()).rejects.toMatchObject({
        code: ErrorCode.BillingResponseJsonParseError,
      });
    });

    it('getAvailablePurchases rejects a foreign store on Android', async () => {
      Object.assign(Platform, {OS: 'android'});
      (ExpoIapModule.getAvailableItems as jest.Mock) = jest
        .fn()
        .mockResolvedValue([
          nativePurchase('foreign', {
            store: 'apple',
            transactionId: 'foreign',
          }),
        ]);

      await expect(getAvailablePurchases()).rejects.toMatchObject({
        code: ErrorCode.BillingResponseJsonParseError,
      });
    });

    it('restorePurchases propagates iOS sync failure without querying', async () => {
      Object.assign(Platform, {OS: 'ios'});
      const syncError = new Error('sync failed');
      jest.spyOn(iosMod, 'syncIOS').mockRejectedValue(syncError);
      (ExpoIapModule.getAvailableItems as jest.Mock) = jest.fn();

      await expect(restorePurchases()).rejects.toBe(syncError);
      expect(ExpoIapModule.getAvailableItems).not.toHaveBeenCalled();
    });

    it('restorePurchases rejects a false iOS sync result', async () => {
      Object.assign(Platform, {OS: 'ios'});
      jest.spyOn(iosMod, 'syncIOS').mockResolvedValue(false);
      (ExpoIapModule.getAvailableItems as jest.Mock) = jest.fn();

      await expect(restorePurchases()).rejects.toMatchObject({
        code: ErrorCode.SyncError,
      });
      expect(ExpoIapModule.getAvailableItems).not.toHaveBeenCalled();
    });
  });

  describe('finishTransaction', () => {
    it('iOS forwards purchase payload to native finishTransaction', async () => {
      Object.assign(Platform, {OS: 'ios'});
      const basePurchase: PurchaseInput = {
        store: 'apple',
        productId: 'prod.ios',
        isAutoRenewing: false,
        purchaseState: 'purchased',
        purchaseToken: 'jws-token',
        quantity: 1,
        transactionDate: Date.now(),
        id: 'transaction-identifier',
        transactionId: 'transaction-identifier',
      };
      (ExpoIapModule.finishTransaction as jest.Mock) = jest
        .fn()
        .mockResolvedValue(true);
      await expect(
        finishTransaction({purchase: basePurchase}),
      ).resolves.toBeUndefined();
      expect(ExpoIapModule.finishTransaction).toHaveBeenCalledWith(
        basePurchase,
        false,
      );

      await finishTransaction({
        purchase: basePurchase,
        isConsumable: true,
      });
      expect(ExpoIapModule.finishTransaction).toHaveBeenLastCalledWith(
        basePurchase,
        true,
      );
    });

    it('Android consume vs acknowledge flows', async () => {
      Object.assign(Platform, {OS: 'android'});
      (ExpoIapModule.consumePurchaseAndroid as jest.Mock) = jest
        .fn()
        .mockResolvedValue({responseCode: 0});
      (ExpoIapModule.acknowledgePurchaseAndroid as jest.Mock) = jest
        .fn()
        .mockResolvedValue({responseCode: 0});

      const basePurchase: PurchaseInput = {
        store: 'google',
        productId: 'p',
        isAutoRenewing: false,
        purchaseState: 'purchased',
        purchaseToken: 't',
        quantity: 1,
        transactionDate: Date.now(),
        id: 'txn-android',
      };

      await finishTransaction({
        purchase: basePurchase,
        isConsumable: true,
      });
      expect(ExpoIapModule.consumePurchaseAndroid).toHaveBeenCalledWith('t');

      await finishTransaction({
        purchase: basePurchase,
        isConsumable: false,
      });
      expect(ExpoIapModule.acknowledgePurchaseAndroid).toHaveBeenCalledWith(
        't',
      );

      // Reset call counts for negative-path assertion
      (ExpoIapModule.consumePurchaseAndroid as jest.Mock).mockClear();
      (ExpoIapModule.acknowledgePurchaseAndroid as jest.Mock).mockClear();
      const p = finishTransaction({
        purchase: {
          store: 'google',
          productId: 'p',
          isAutoRenewing: false,
          purchaseState: 'purchased',
          quantity: 1,
          transactionDate: Date.now(),
          id: 'txn-missing-token',
        },
      });
      await expect(p).rejects.toMatchObject({
        message: expect.stringMatching(/Purchase token/i),
      });
      expect(ExpoIapModule.consumePurchaseAndroid).not.toHaveBeenCalled();
      expect(ExpoIapModule.acknowledgePurchaseAndroid).not.toHaveBeenCalled();
    });

    it('finishTransaction rejects on unsupported platform', async () => {
      const originalOs = Platform.OS;
      Object.assign(Platform, {OS: 'web'});
      await expect(
        finishTransaction({
          purchase: {
            id: 'tid',
            store: 'unknown',
            productId: 'prod.web',
            isAutoRenewing: false,
            purchaseState: 'purchased',
            purchaseToken: 'token',
            quantity: 1,
            transactionDate: Date.now(),
          },
        }),
      ).rejects.toThrow(/Unsupported platform/);
      Object.assign(Platform, {OS: originalOs});
    });
  });

  describe('storefront', () => {
    it('getStorefront delegates to native getStorefront method', async () => {
      const nativeSpy = jest.fn().mockResolvedValue('US');
      ExpoIapModule.getStorefront = nativeSpy;

      const res = await getStorefront();

      expect(nativeSpy).toHaveBeenCalledTimes(1);
      expect(res).toBe('US');

      delete ExpoIapModule.getStorefront;
    });

    it('getStorefront supports synchronous native responses', async () => {
      const nativeSpy = jest.fn().mockReturnValue('CA');
      ExpoIapModule.getStorefront = nativeSpy;

      const res = await getStorefront();

      expect(nativeSpy).toHaveBeenCalledTimes(1);
      expect(res).toBe('CA');

      delete ExpoIapModule.getStorefront;
    });

    it.each([null, undefined, '', '   '])(
      'getStorefront rejects an empty native value (%p)',
      async (value) => {
        // @ts-expect-error empty native values reach the runtime validation
        ExpoIapModule.getStorefront = jest.fn(() => value);

        await expect(getStorefront()).rejects.toMatchObject({
          code: ErrorCode.ServiceError,
          message: expect.stringContaining('no country code'),
        });

        delete ExpoIapModule.getStorefront;
      },
    );

    it('getStorefront rejects when the native method is missing', async () => {
      delete ExpoIapModule.getStorefront;

      await expect(getStorefront()).rejects.toMatchObject({
        code: ErrorCode.FeatureNotSupported,
        message: expect.stringContaining('not available on this build'),
      });
    });

    it('getStorefront normalizes native exceptions', async () => {
      ExpoIapModule.getStorefront = jest.fn(() => {
        throw new Error('storefront exploded');
      });

      await expect(getStorefront()).rejects.toMatchObject({
        code: ErrorCode.ServiceError,
        debugMessage: 'storefront exploded',
      });

      delete ExpoIapModule.getStorefront;
    });

    it('getStorefront rejects unsupported platforms', async () => {
      Object.assign(Platform, {OS: 'web'});

      await expect(getStorefront()).rejects.toMatchObject({
        code: ErrorCode.FeatureNotSupported,
        message: expect.stringContaining('not supported on web'),
      });
    });
  });

  describe('deep link', () => {
    it('deepLinkToSubscriptions iOS delegates, Android validates', async () => {
      Object.assign(Platform, {OS: 'ios'});
      const iosSpy = jest
        .spyOn(iosMod, 'deepLinkToSubscriptionsIOS')
        .mockResolvedValue(undefined);
      await deepLinkToSubscriptions({});
      expect(iosSpy).toHaveBeenCalled();
      iosSpy.mockRestore();

      Object.assign(Platform, {OS: 'android'});
      await expect(deepLinkToSubscriptions({})).rejects.toThrow(
        'packageName is required',
      );
      await expect(deepLinkToSubscriptions({skuAndroid: 's'})).rejects.toThrow(
        'packageName is required',
      );
      const andSpy = jest
        .spyOn(androidMod, 'deepLinkToSubscriptionsAndroid')
        .mockResolvedValue(undefined);
      await deepLinkToSubscriptions({
        skuAndroid: 's',
        packageNameAndroid: 'com.app',
      });
      expect(andSpy).toHaveBeenCalledWith({
        skuAndroid: 's',
        packageNameAndroid: 'com.app',
      });
      andSpy.mockRestore();
    });

    it('deepLinkToSubscriptions rejects on unsupported platform', async () => {
      Object.assign(Platform, {OS: 'web'});
      await expect(
        deepLinkToSubscriptions({
          skuAndroid: 's',
          packageNameAndroid: 'com.app',
        }),
      ).rejects.toThrow(/Unsupported platform: web/);
    });

    it('openRedeemOfferCode resolves the iOS redemption result', async () => {
      Object.assign(Platform, {OS: 'ios'});
      const purchase = nativePurchase('redeemed', {store: 'apple'});
      (
        ExpoIapModule.presentCodeRedemptionSheetIOS as jest.Mock
      ).mockResolvedValueOnce(purchase);
      await expect(openRedeemOfferCode()).resolves.toBe(purchase);

      (
        ExpoIapModule.presentCodeRedemptionSheetIOS as jest.Mock
      ).mockResolvedValueOnce(null);
      await expect(openRedeemOfferCode()).resolves.toBeNull();
    });

    it('openRedeemOfferCode maps the Android launch result to null', async () => {
      Object.assign(Platform, {OS: 'android'});
      (
        ExpoIapModule.openRedeemOfferCodeAndroid as jest.Mock
      ).mockResolvedValueOnce(true);
      await expect(openRedeemOfferCode()).resolves.toBeNull();
      expect(ExpoIapModule.openRedeemOfferCodeAndroid).toHaveBeenCalledTimes(1);
    });

    it('openRedeemOfferCode resolves null on Vega without launching', async () => {
      Object.assign(Platform, {OS: 'kepler'});
      await expect(openRedeemOfferCode()).resolves.toBeNull();
      expect(ExpoIapModule.openRedeemOfferCodeAndroid).not.toHaveBeenCalled();
    });

    it('openRedeemOfferCode rejects on unsupported platform', async () => {
      Object.assign(Platform, {OS: 'web'});
      await expect(openRedeemOfferCode()).rejects.toThrow(
        /Unsupported platform: web/,
      );
    });

    it('requestPurchase rejects on unsupported platform', async () => {
      Object.assign(Platform, {OS: 'web'});
      await expect(
        requestPurchase({request: {}, type: 'in-app'}),
      ).rejects.toThrow(/Unsupported platform/);
    });
  });

  describe('getAvailablePurchases platform support', () => {
    it('rejects on unsupported platform', async () => {
      Object.assign(Platform, {OS: 'web'});

      await expect(getAvailablePurchases()).rejects.toThrow(
        /Unsupported platform: web/,
      );
    });
  });

  describe('getActiveSubscriptions', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('calls native module and returns active subscriptions', async () => {
      const mockSubscriptions = [
        {
          productId: 'premium_monthly',
          isActive: true,
          transactionId: 'txn-123',
          purchaseToken: 'token-abc',
          transactionDate: 1234567890,
          autoRenewingAndroid: true,
        },
        {
          productId: 'premium_yearly',
          isActive: true,
          transactionId: 'txn-456',
          purchaseToken: 'token-def',
          transactionDate: 1234567891,
          renewalInfoIOS: {
            pendingUpgradeProductId: 'premium_lifetime',
            willAutoRenew: true,
            autoRenewPreference: 'premium_lifetime',
          },
        },
      ];

      (ExpoIapModule.getActiveSubscriptions as jest.Mock) = jest
        .fn()
        .mockResolvedValue(mockSubscriptions);

      const result = await getActiveSubscriptions();

      expect(ExpoIapModule.getActiveSubscriptions).toHaveBeenCalledWith(null);
      expect(result).toEqual(mockSubscriptions);
    });

    it('filters by subscription IDs when provided', async () => {
      const mockSubscriptions = [
        {
          productId: 'premium_monthly',
          isActive: true,
          transactionId: 'txn-123',
          purchaseToken: 'token-abc',
          transactionDate: 1234567890,
        },
      ];

      (ExpoIapModule.getActiveSubscriptions as jest.Mock) = jest
        .fn()
        .mockResolvedValue(mockSubscriptions);

      const subscriptionIds = ['premium_monthly', 'premium_yearly'];
      const result = await getActiveSubscriptions(subscriptionIds);

      expect(ExpoIapModule.getActiveSubscriptions).toHaveBeenCalledWith(
        subscriptionIds,
      );
      expect(result).toEqual(mockSubscriptions);
    });

    it('returns empty array when native module returns null', async () => {
      (ExpoIapModule.getActiveSubscriptions as jest.Mock) = jest
        .fn()
        .mockResolvedValue(null);

      const result = await getActiveSubscriptions();

      expect(result).toEqual([]);
    });

    it('returns empty array when native module returns undefined', async () => {
      (ExpoIapModule.getActiveSubscriptions as jest.Mock) = jest
        .fn()
        .mockResolvedValue(undefined);

      const result = await getActiveSubscriptions();

      expect(result).toEqual([]);
    });

    it('handles iOS subscriptions with renewalInfoIOS', async () => {
      const mockIOSSubscription = [
        {
          productId: 'premium_monthly',
          isActive: true,
          transactionId: 'txn-ios-123',
          purchaseToken: 'ios-token',
          transactionDate: 1234567890,
          renewalInfoIOS: {
            pendingUpgradeProductId: 'premium_yearly',
            willAutoRenew: true,
            autoRenewPreference: 'premium_yearly',
          },
        },
      ];

      (ExpoIapModule.getActiveSubscriptions as jest.Mock) = jest
        .fn()
        .mockResolvedValue(mockIOSSubscription);

      const result = await getActiveSubscriptions(['premium_monthly']);

      expect(result).toEqual(mockIOSSubscription);
      expect(result[0]?.renewalInfoIOS?.pendingUpgradeProductId).toBe(
        'premium_yearly',
      );
    });

    it('handles Android subscriptions with autoRenewingAndroid', async () => {
      Object.assign(Platform, {OS: 'android'});
      const mockAndroidSubscription = [
        {
          productId: 'premium_monthly',
          isActive: true,
          transactionId: 'txn-android-123',
          purchaseToken: 'android-token',
          transactionDate: 1234567890,
          autoRenewingAndroid: false,
        },
      ];

      (ExpoIapModule.getActiveSubscriptions as jest.Mock) = jest
        .fn()
        .mockResolvedValue(mockAndroidSubscription);

      const result = await getActiveSubscriptions();

      expect(result).toEqual(mockAndroidSubscription);
      expect(result[0]?.autoRenewingAndroid).toBe(false);
    });

    it('rejects on unsupported platform', async () => {
      Object.assign(Platform, {OS: 'web'});

      await expect(getActiveSubscriptions()).rejects.toThrow(
        /Unsupported platform: web/,
      );
    });
  });

  describe('hasActiveSubscriptions', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns true when user has active subscriptions', async () => {
      (ExpoIapModule.hasActiveSubscriptions as jest.Mock) = jest
        .fn()
        .mockResolvedValue(true);

      const result = await hasActiveSubscriptions();

      expect(ExpoIapModule.hasActiveSubscriptions).toHaveBeenCalledWith(null);
      expect(result).toBe(true);
    });

    it('returns false when user has no active subscriptions', async () => {
      (ExpoIapModule.hasActiveSubscriptions as jest.Mock) = jest
        .fn()
        .mockResolvedValue(false);

      const result = await hasActiveSubscriptions();

      expect(result).toBe(false);
    });

    it('filters by subscription IDs when provided', async () => {
      (ExpoIapModule.hasActiveSubscriptions as jest.Mock) = jest
        .fn()
        .mockResolvedValue(true);

      const subscriptionIds = ['premium_monthly', 'premium_yearly'];
      const result = await hasActiveSubscriptions(subscriptionIds);

      expect(ExpoIapModule.hasActiveSubscriptions).toHaveBeenCalledWith(
        subscriptionIds,
      );
      expect(result).toBe(true);
    });

    it('returns false when native module returns null', async () => {
      (ExpoIapModule.hasActiveSubscriptions as jest.Mock) = jest
        .fn()
        .mockResolvedValue(null);

      const result = await hasActiveSubscriptions();

      expect(result).toBe(false);
    });

    it('returns false when native module returns undefined', async () => {
      (ExpoIapModule.hasActiveSubscriptions as jest.Mock) = jest
        .fn()
        .mockResolvedValue(undefined);

      const result = await hasActiveSubscriptions();

      expect(result).toBe(false);
    });

    it('handles checking specific premium subscription', async () => {
      (ExpoIapModule.hasActiveSubscriptions as jest.Mock) = jest
        .fn()
        .mockResolvedValue(false);

      const result = await hasActiveSubscriptions(['premium_lifetime']);

      expect(ExpoIapModule.hasActiveSubscriptions).toHaveBeenCalledWith([
        'premium_lifetime',
      ]);
      expect(result).toBe(false);
    });

    it('coerces truthy values correctly', async () => {
      // Test that the !! coercion works
      (ExpoIapModule.hasActiveSubscriptions as jest.Mock) = jest
        .fn()
        .mockResolvedValue(1); // Truthy non-boolean

      const result = await hasActiveSubscriptions();

      expect(result).toBe(true);
    });

    it('coerces falsy values correctly', async () => {
      // Test that the !! coercion works
      (ExpoIapModule.hasActiveSubscriptions as jest.Mock) = jest
        .fn()
        .mockResolvedValue(0); // Falsy non-boolean

      const result = await hasActiveSubscriptions();

      expect(result).toBe(false);
    });

    it('rejects on unsupported platform', async () => {
      Object.assign(Platform, {OS: 'web'});

      await expect(hasActiveSubscriptions()).rejects.toThrow(
        /Unsupported platform: web/,
      );
    });
  });

  describe('verifyPurchase', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('calls native module on iOS', async () => {
      Object.assign(Platform, {OS: 'ios'});
      const mockResult = {isValid: true, receiptData: 'data'};
      (ExpoIapModule.verifyPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue(mockResult);

      const result = await verifyPurchase({
        apple: {sku: 'com.example.product'},
      });

      expect(ExpoIapModule.verifyPurchase).toHaveBeenCalledWith({
        apple: {sku: 'com.example.product'},
      });
      expect(result).toEqual(mockResult);
    });

    it('calls native module on Android', async () => {
      Object.assign(Platform, {OS: 'android'});
      const mockResult = {isValid: true};
      (ExpoIapModule.verifyPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue(mockResult);

      const result = await verifyPurchase({
        google: {
          sku: 'com.example.product',
          packageName: 'com.example',
          purchaseToken: 'token',
          accessToken: 'access',
        },
      });

      expect(ExpoIapModule.verifyPurchase).toHaveBeenCalledWith({
        google: {
          sku: 'com.example.product',
          packageName: 'com.example',
          purchaseToken: 'token',
          accessToken: 'access',
        },
      });
      expect(result).toEqual(mockResult);
    });

    it('forwards Horizon verification options to the native module', async () => {
      Object.assign(Platform, {OS: 'android'});
      const mockResult = {isValid: true, success: true};
      (ExpoIapModule.verifyPurchase as jest.Mock) = jest
        .fn()
        .mockResolvedValue(mockResult);
      const options = {
        horizon: {
          sku: 'premium',
          userId: 'user-1',
          accessToken: 'secret',
        },
      };

      const result = await verifyPurchase(options);

      expect(ExpoIapModule.verifyPurchase).toHaveBeenCalledWith(options);
      expect(result).toEqual(mockResult);
    });

    it('throws on unsupported platform', async () => {
      Object.assign(Platform, {OS: 'web'});

      await expect(
        verifyPurchase({apple: {sku: 'com.example.product'}}),
      ).rejects.toThrow(/Unsupported platform/);
    });
  });

  describe('verifyPurchaseWithProvider', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('calls native module with IAPKit provider on iOS', async () => {
      Object.assign(Platform, {OS: 'ios'});
      const mockResult = {
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          state: 'entitled',
          store: 'apple',
          productId: 'premium.monthly',
          clientPayload: {
            format: 'toml',
            body: 'tier = "gold"',
            version: 2,
            updatedAt: 1720000000000,
          },
        },
      };
      (ExpoIapModule.verifyPurchaseWithProvider as jest.Mock) = jest
        .fn()
        .mockResolvedValue(mockResult);

      const request = {
        provider: 'iapkit' as const,
        iapkit: {
          apiKey: 'test-api-key',
          includeClientPayload: true,
          apple: {jws: 'jws-token'},
          google: {purchaseToken: 'purchase-token'},
        },
      };

      const result = await verifyPurchaseWithProvider(request);

      expect(ExpoIapModule.verifyPurchaseWithProvider).toHaveBeenCalledWith(
        request,
      );
      expect(result).toEqual(mockResult);
      expect(result.iapkit?.isValid).toBe(true);
      expect(result.iapkit?.productId).toBe('premium.monthly');
      expect(result.iapkit?.clientPayload?.body).toBe('tier = "gold"');
      expect(result.iapkit?.state).toBe('entitled');
    });

    it('calls native module on Android', async () => {
      Object.assign(Platform, {OS: 'android'});
      const mockResult = {
        provider: 'iapkit',
        iapkit: {
          clientPayload: null,
          environment: 'Sandbox',
          futureProviderField: 'preserved',
          isValid: true,
          productId: null,
          state: 'ready-to-consume',
          store: 'amazon',
        },
      };
      (ExpoIapModule.verifyPurchaseWithProvider as jest.Mock) = jest
        .fn()
        .mockResolvedValue(mockResult);

      const request = {
        provider: 'iapkit' as const,
        iapkit: {
          apiKey: 'test-api-key',
          amazon: {
            expectedProductId: 'amazon.premium.monthly',
            receiptId: 'amazon-receipt',
            sandbox: true,
            userId: 'amazon-user',
          },
        },
      };

      const result = await verifyPurchaseWithProvider(request);

      expect(ExpoIapModule.verifyPurchaseWithProvider).toHaveBeenCalledWith(
        request,
      );
      expect(result.iapkit).toEqual({
        environment: 'Sandbox',
        futureProviderField: 'preserved',
        isValid: true,
        state: 'ready-to-consume',
        store: 'amazon',
      });
      expect(result.iapkit?.store).toBe('amazon');
    });

    it('throws on unsupported platform', async () => {
      Object.assign(Platform, {OS: 'web'});

      await expect(
        verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            apiKey: 'key',
            apple: {jws: 'jws'},
            google: {purchaseToken: 'token'},
          },
        }),
      ).rejects.toThrow(/Unsupported platform/);
    });

    it('handles verification failure response', async () => {
      Object.assign(Platform, {OS: 'ios'});
      const mockResult = {
        provider: 'iapkit',
        iapkit: {isValid: false, state: 'inauthentic', store: 'apple'},
      };
      (ExpoIapModule.verifyPurchaseWithProvider as jest.Mock) = jest
        .fn()
        .mockResolvedValue(mockResult);

      const result = await verifyPurchaseWithProvider({
        provider: 'iapkit',
        iapkit: {
          apiKey: 'key',
          apple: {jws: 'invalid-jws'},
          google: {purchaseToken: 'token'},
        },
      });

      expect(result.iapkit?.isValid).toBe(false);
      expect(result.iapkit?.state).toBe('inauthentic');
    });

    it('handles various IAPKit purchase states', async () => {
      Object.assign(Platform, {OS: 'ios'});
      const states = [
        'entitled',
        'pending-acknowledgment',
        'pending',
        'canceled',
        'expired',
        'ready-to-consume',
        'consumed',
        'unknown',
        'inauthentic',
      ];

      for (const state of states) {
        const mockResult = {
          provider: 'iapkit',
          iapkit: {isValid: state !== 'inauthentic', state, store: 'apple'},
        };
        (ExpoIapModule.verifyPurchaseWithProvider as jest.Mock) = jest
          .fn()
          .mockResolvedValue(mockResult);

        const result = await verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            apiKey: 'key',
            apple: {jws: 'jws'},
            google: {purchaseToken: 'token'},
          },
        });

        expect(result.iapkit?.state).toBe(state);
      }
    });
  });
});
