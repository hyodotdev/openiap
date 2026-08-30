/* eslint-disable @typescript-eslint/no-require-imports */
// Keep mocks static and simple for readability.
// No dynamic imports; mock before importing the module under test.

import {Platform} from 'react-native';
import {ErrorCode} from '../types';
import type {DiscountOfferInputIOS} from '../types';

// Minimal Nitro IAP mock to exercise wrappers
const mockIap: any = {
  // connection
  initConnection: jest.fn(async () => true),
  endConnection: jest.fn(async () => true),

  // products
  fetchProducts: jest.fn(async () => []),

  // purchases
  requestPurchase: jest.fn(async () => undefined),
  getAvailablePurchases: jest.fn(async () => []),
  finishTransaction: jest.fn(async () => true),

  // listeners
  addPurchaseUpdatedListener: jest.fn(),
  removePurchaseUpdatedListener: jest.fn(),
  addPurchaseErrorListener: jest.fn(),
  removePurchaseErrorListener: jest.fn(),
  addPromotedProductListenerIOS: jest.fn(),
  removePromotedProductListenerIOS: jest.fn(),
  addSubscriptionBillingIssueListener: jest.fn(),
  removeSubscriptionBillingIssueListener: jest.fn(),
  addUserChoiceBillingListenerAndroid: jest.fn(),
  removeUserChoiceBillingListenerAndroid: jest.fn(),

  // iOS-only
  getAppTransactionIOS: jest.fn(async () => null),
  getPromotedProductIOS: jest.fn(async () => null),
  presentCodeRedemptionSheetIOS: jest.fn(async () => null),
  getAllTransactionsIOS: jest.fn(async () => []),

  // Unified storefront
  getStorefront: jest.fn(async () => 'USA'),

  // purchase verification (unified API)
  verifyPurchase: jest.fn(async () => ({
    isValid: true,
    receiptData: 'mock-receipt',
    jwsRepresentation: 'mock-jws',
    latestTransaction: null,
  })),

  // Billing Programs API (Android 8.2.0+)
  enableBillingProgramAndroid: jest.fn(),
  isBillingProgramAvailableAndroid: jest.fn(async () => ({
    billingProgram: 'external-offer',
    isAvailable: true,
  })),
  getBillingChoiceInfoAndroid: jest.fn(async () => ({
    playBillingChoiceImageUrl: 'https://play.google.com/billing-choice.png',
    playBillingLoyaltyInfo: null,
  })),
  createBillingProgramReportingDetailsAndroid: jest.fn(async () => ({
    billingProgram: 'external-offer',
    externalTransactionToken: 'mock-token-123',
  })),
  showBillingProgramInformationDialogAndroid: jest.fn(async () => ({
    responseCode: 0,
    debugMessage: null,
    subResponseCode: 'no-applicable-sub-response-code',
  })),
  showInAppMessagesAndroid: jest.fn(async () => ({
    responseCode: 'no-action-needed',
    purchaseToken: null,
  })),
  launchExternalLinkAndroid: jest.fn(async () => true),
  openRedeemOfferCodeAndroid: jest.fn(async () => true),
};

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: jest.fn(() => mockIap),
  },
}));

// Import after mocks using require to ensure init-time mocks apply cleanly
// (explicit require is used here to avoid dynamic import and to cooperate with jest.resetModules)
let IAP: any = require('../index');

describe('Public API (src/index.ts)', () => {
  let originalError: any;
  let originalWarn: any;

  beforeAll(() => {
    originalError = console.error;
    originalWarn = console.warn;
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
    console.warn = originalWarn;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    let purchaseUpdatedToken = 1;
    mockIap.addPurchaseUpdatedListener.mockImplementation(
      () => purchaseUpdatedToken++,
    );
    // Default to iOS in tests; override per-case
    (Platform as any).OS = 'ios';
    // Re-require module to ensure fresh state if needed
    jest.resetModules();
    jest.dontMock('react-native');
    jest.dontMock('../vega');
    // Reinstall the NitroModules mock after reset
    jest.doMock('react-native-nitro-modules', () => ({
      NitroModules: {
        createHybridObject: jest.fn(() => mockIap),
      },
    }));
    mockIap.deepLinkToSubscriptionsIOS = undefined;
    mockIap.requestReceiptRefreshIOS = undefined;
    mockIap.getStorefront = jest.fn(async () => 'USA');
    mockIap.addSubscriptionBillingIssueListener.mockReset();
    mockIap.addSubscriptionBillingIssueListener.mockImplementation(
      () => undefined,
    );
    // Ensure getAvailablePurchases always returns an empty array by default
    mockIap.getAvailablePurchases = jest.fn(async () => []);
    IAP = require('../index');
  });

  describe('platform detection helpers', () => {
    // Note: More comprehensive platform detection tests are in platform-detection.test.ts
    // which properly resets modules for accurate Platform detection testing
    it('isNitroReady returns true when Nitro is initialized', () => {
      expect(IAP.isNitroReady()).toBe(true);
    });

    it('exports platform detection functions', () => {
      expect(typeof IAP.isTVOS).toBe('function');
      expect(typeof IAP.isMacOS).toBe('function');
      expect(typeof IAP.isStandardIOS).toBe('function');
      expect(typeof IAP.isNitroReady).toBe('function');
    });
  });

  describe('listeners', () => {
    it('purchaseUpdatedListener wraps and forwards validated purchases', () => {
      const listener = jest.fn();
      const sub = IAP.purchaseUpdatedListener(listener);
      expect(typeof sub.remove).toBe('function');

      // Emulate native event via singleton handler
      const nitroPurchase = {
        id: 't1',
        transactionId: 't1',
        productId: 'p1',
        transactionDate: Date.now(),
        store: 'apple',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      };
      // Singleton: only one native handler registered
      expect(mockIap.addPurchaseUpdatedListener).toHaveBeenCalledTimes(1);
      const nativeHandler = mockIap.addPurchaseUpdatedListener.mock.calls[0][0];
      nativeHandler(nitroPurchase);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'p1',
          store: 'apple',
        }),
      );

      // remove detaches the JS listener and removes the native token when empty
      sub.remove();
      // Verify listener no longer fires after removal
      listener.mockClear();
      nativeHandler(nitroPurchase);
      expect(listener).not.toHaveBeenCalled();
    });

    it('routes non-deduping purchaseUpdatedListener through opt-in native listener', () => {
      const defaultListener = jest.fn();
      const duplicateListener = jest.fn();
      IAP.purchaseUpdatedListener(defaultListener);
      IAP.purchaseUpdatedListener(duplicateListener, {
        dedupeTransactionIOS: false,
      });

      expect(mockIap.addPurchaseUpdatedListener).toHaveBeenCalledTimes(2);
      expect(mockIap.addPurchaseUpdatedListener.mock.calls[1][1]).toEqual({
        dedupeTransactionIOS: false,
      });

      const nitroPurchase = {
        id: 't1',
        transactionId: 't1',
        productId: 'p1',
        transactionDate: Date.now(),
        store: 'apple',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      };
      mockIap.addPurchaseUpdatedListener.mock.calls[0][0](nitroPurchase);
      expect(defaultListener).toHaveBeenCalledTimes(1);
      expect(duplicateListener).not.toHaveBeenCalled();

      mockIap.addPurchaseUpdatedListener.mock.calls[1][0](nitroPurchase);
      expect(defaultListener).toHaveBeenCalledTimes(1);
      expect(duplicateListener).toHaveBeenCalledTimes(1);
    });

    it('removes iOS purchase updated JS listeners without removing the native listener', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const sub1 = IAP.purchaseUpdatedListener(listener1);
      const sub2 = IAP.purchaseUpdatedListener(listener2);

      expect(mockIap.addPurchaseUpdatedListener).toHaveBeenCalledTimes(1);
      sub1.remove();
      expect(mockIap.removePurchaseUpdatedListener).not.toHaveBeenCalled();

      sub2.remove();
      sub2.remove();
      expect(mockIap.removePurchaseUpdatedListener).not.toHaveBeenCalled();
    });

    it('removes iOS non-deduping purchase updated JS listener without removing the native listener', () => {
      const defaultSub = IAP.purchaseUpdatedListener(jest.fn());
      const duplicateListener = jest.fn();
      const duplicateSub = IAP.purchaseUpdatedListener(duplicateListener, {
        dedupeTransactionIOS: false,
      });

      expect(mockIap.addPurchaseUpdatedListener).toHaveBeenCalledTimes(2);
      const duplicateNativeHandler =
        mockIap.addPurchaseUpdatedListener.mock.calls[1][0];
      const nitroPurchase = {
        id: 't1',
        transactionId: 't1',
        productId: 'p1',
        transactionDate: Date.now(),
        store: 'apple',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      };

      duplicateNativeHandler(nitroPurchase);
      expect(duplicateListener).toHaveBeenCalledTimes(1);

      duplicateSub.remove();
      expect(mockIap.removePurchaseUpdatedListener).not.toHaveBeenCalled();

      duplicateNativeHandler(nitroPurchase);
      expect(duplicateListener).toHaveBeenCalledTimes(1);

      defaultSub.remove();
      expect(mockIap.removePurchaseUpdatedListener).not.toHaveBeenCalled();
    });

    it('reuses the retained iOS native listener when re-subscribing after full removal', () => {
      const first = jest.fn();
      const sub = IAP.purchaseUpdatedListener(first);
      const nativeHandler = mockIap.addPurchaseUpdatedListener.mock.calls[0][0];
      sub.remove();

      const second = jest.fn();
      IAP.purchaseUpdatedListener(second);
      expect(mockIap.addPurchaseUpdatedListener).toHaveBeenCalledTimes(1);

      nativeHandler({
        id: 't1',
        transactionId: 't1',
        productId: 'p1',
        transactionDate: Date.now(),
        store: 'apple',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      });
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });

    it('removes the Android native listener by token and re-attaches on next subscribe', () => {
      (Platform as any).OS = 'android';
      const sub1 = IAP.purchaseUpdatedListener(jest.fn());
      const sub2 = IAP.purchaseUpdatedListener(jest.fn());

      expect(mockIap.addPurchaseUpdatedListener).toHaveBeenCalledTimes(1);
      sub1.remove();
      expect(mockIap.removePurchaseUpdatedListener).not.toHaveBeenCalled();

      sub2.remove();
      expect(mockIap.removePurchaseUpdatedListener).toHaveBeenCalledTimes(1);
      expect(mockIap.removePurchaseUpdatedListener).toHaveBeenCalledWith(1);

      IAP.purchaseUpdatedListener(jest.fn());
      expect(mockIap.addPurchaseUpdatedListener).toHaveBeenCalledTimes(2);
    });

    it('keeps the iOS native purchase error listener attached across removal and re-subscribe', () => {
      const first = jest.fn();
      const sub = IAP.purchaseErrorListener(first);
      expect(mockIap.addPurchaseErrorListener).toHaveBeenCalledTimes(1);
      const nativeHandler = mockIap.addPurchaseErrorListener.mock.calls[0][0];

      sub.remove();
      expect(mockIap.removePurchaseErrorListener).not.toHaveBeenCalled();

      const second = jest.fn();
      IAP.purchaseErrorListener(second);
      expect(mockIap.addPurchaseErrorListener).toHaveBeenCalledTimes(1);

      nativeHandler({code: 'network-error', message: 'offline'});
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });

    it('purchaseErrorListener forwards error objects and supports removal', () => {
      const listener = jest.fn();
      const sub = IAP.purchaseErrorListener(listener);
      expect(typeof sub.remove).toBe('function');

      const err = {
        code: 'query-product',
        message: 'oops',
        responseCode: 12,
        debugMessage: 'billing unavailable',
        productId: 'premium_monthly',
        productIds: ['premium_monthly', 'premium_yearly'],
        productType: 'subs',
        isEmptyProductList: false,
        subResponseCodeAndroid: 'user-ineligible',
      };
      expect(mockIap.addPurchaseErrorListener).toHaveBeenCalledTimes(1);
      const nativeHandler = mockIap.addPurchaseErrorListener.mock.calls[0][0];
      nativeHandler(err);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.QueryProduct,
          message: 'oops',
          responseCode: 12,
          debugMessage: 'billing unavailable',
          productId: 'premium_monthly',
          productIds: ['premium_monthly', 'premium_yearly'],
          productType: 'subs',
          isEmptyProductList: false,
          subResponseCodeAndroid: 'user-ineligible',
        }),
      );

      nativeHandler({
        code: 'network-error',
        message: 'offline',
        responseCode: -1,
      });
      expect(listener).toHaveBeenLastCalledWith(
        expect.objectContaining({
          code: ErrorCode.NetworkError,
          message: 'offline',
          responseCode: undefined,
        }),
      );

      sub.remove();
      // Verify listener no longer fires after removal
      listener.mockClear();
      nativeHandler(err);
      expect(listener).not.toHaveBeenCalled();
    });

    it('promotedProductListenerIOS warns and no-ops on non‑iOS', () => {
      (Platform as any).OS = 'android';
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const sub = IAP.promotedProductListenerIOS(jest.fn());
      expect(typeof sub.remove).toBe('function');
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('promotedProductListenerIOS on iOS converts and forwards product', () => {
      (Platform as any).OS = 'ios';
      (Platform as any).isTV = false;
      (Platform as any).isMacCatalyst = false;
      const nitroProduct = {
        id: 'sku1',
        title: 'Title',
        description: 'Desc',
        type: 'in-app',
        platform: 'ios',
        isAutoRenewing: true,
        displayPrice: '$1',
        currency: 'USD',
      };
      const listener = jest.fn();
      const sub = IAP.promotedProductListenerIOS(listener);
      expect(mockIap.addPromotedProductListenerIOS).toHaveBeenCalledTimes(1);
      const nativeHandler =
        mockIap.addPromotedProductListenerIOS.mock.calls[0][0];
      nativeHandler(nitroProduct);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({id: 'sku1', platform: 'ios'}),
      );
      sub.remove();
      // Verify listener no longer fires after removal
      listener.mockClear();
      nativeHandler(nitroProduct);
      expect(listener).not.toHaveBeenCalled();
    });

    it('purchaseUpdatedListener ignores invalid purchase payload', () => {
      const listener = jest.fn();
      IAP.purchaseUpdatedListener(listener);
      const wrapped = mockIap.addPurchaseUpdatedListener.mock.calls[0][0];
      wrapped({});
      expect(listener).not.toHaveBeenCalled();
    });

    it('multiple purchaseUpdatedListeners all receive events from single native handler', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const sub1 = IAP.purchaseUpdatedListener(listener1);
      const sub2 = IAP.purchaseUpdatedListener(listener2);

      // Singleton: only one native listener registered
      expect(mockIap.addPurchaseUpdatedListener).toHaveBeenCalledTimes(1);

      const nitroPurchase = {
        id: 't1',
        transactionId: 't1',
        productId: 'p1',
        transactionDate: Date.now(),
        store: 'apple',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      };
      // Single native handler dispatches to all JS listeners
      const nativeHandler = mockIap.addPurchaseUpdatedListener.mock.calls[0][0];
      nativeHandler(nitroPurchase);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      sub1.remove();
      sub2.remove();
    });

    it('removing one purchaseUpdatedListener does not affect others', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const sub1 = IAP.purchaseUpdatedListener(listener1);
      IAP.purchaseUpdatedListener(listener2);

      // Remove first listener
      sub1.remove();

      const nativeHandler = mockIap.addPurchaseUpdatedListener.mock.calls[0][0];
      const nitroPurchase = {
        id: 't2',
        transactionId: 't2',
        productId: 'p2',
        transactionDate: Date.now(),
        store: 'apple',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      };
      nativeHandler(nitroPurchase);
      // listener2 still receives events, listener1 does not
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener1).not.toHaveBeenCalled();
    });

    it('multiple purchaseErrorListeners all receive errors from single native handler', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const sub1 = IAP.purchaseErrorListener(listener1);
      const sub2 = IAP.purchaseErrorListener(listener2);

      // Singleton: only one native listener registered
      expect(mockIap.addPurchaseErrorListener).toHaveBeenCalledTimes(1);

      const nativeHandler = mockIap.addPurchaseErrorListener.mock.calls[0][0];
      const err = {code: 'user-cancelled', message: 'User cancelled'};
      nativeHandler(err);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      sub1.remove();
      sub2.remove();
    });

    it('removing one purchaseErrorListener does not affect others', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const sub1 = IAP.purchaseErrorListener(listener1);
      IAP.purchaseErrorListener(listener2);

      sub1.remove();

      const nativeHandler = mockIap.addPurchaseErrorListener.mock.calls[0][0];
      nativeHandler({code: 'network-error', message: 'Network error'});
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener1).not.toHaveBeenCalled();
    });

    it('detaches the Android native error listener after the last JS listener is removed', () => {
      (Platform as any).OS = 'android';
      const sub1 = IAP.purchaseErrorListener(jest.fn());
      const sub2 = IAP.purchaseErrorListener(jest.fn());
      const nativeHandler = mockIap.addPurchaseErrorListener.mock.calls[0][0];

      sub1.remove();
      expect(mockIap.removePurchaseErrorListener).not.toHaveBeenCalled();

      sub2.remove();
      sub2.remove();
      expect(mockIap.removePurchaseErrorListener).toHaveBeenCalledTimes(1);
      expect(mockIap.removePurchaseErrorListener).toHaveBeenCalledWith(
        nativeHandler,
      );

      const sub3 = IAP.purchaseErrorListener(jest.fn());
      expect(mockIap.addPurchaseErrorListener).toHaveBeenCalledTimes(2);
      sub3.remove();
    });
  });

  describe('connection', () => {
    it('initConnection and endConnection delegate to native', async () => {
      await expect(IAP.initConnection()).resolves.toBe(true);
      await expect(IAP.endConnection()).resolves.toBe(true);
      expect(mockIap.initConnection).toHaveBeenCalled();
      expect(mockIap.endConnection).toHaveBeenCalled();
    });

    it('passes developer-rendered Billing Choice config to native', async () => {
      (Platform as any).OS = 'android';
      const config = {
        billingChoiceScreenTypeAndroid: 'developer-rendered',
        enableBillingProgramAndroid: 'billing-choice',
      } as const;

      await IAP.initConnection(config);

      expect(mockIap.initConnection).toHaveBeenCalledWith(config);
    });

    it('listeners work after endConnection → initConnection reconnection', async () => {
      // 1. Initial connection + listener
      await IAP.initConnection();
      const listener1 = jest.fn();
      const sub1 = IAP.purchaseUpdatedListener(listener1);

      // Verify singleton native listener is registered
      expect(mockIap.addPurchaseUpdatedListener).toHaveBeenCalledTimes(1);
      const nativeHandler1 =
        mockIap.addPurchaseUpdatedListener.mock.calls[0][0];

      // Simulate a purchase event — listener should fire
      const nitroPurchase = {
        id: 't1',
        transactionId: 't1',
        productId: 'p1',
        transactionDate: Date.now(),
        store: 'apple',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      };
      nativeHandler1(nitroPurchase);
      expect(listener1).toHaveBeenCalledTimes(1);

      // 2. Disconnect (endConnection resets listener state)
      sub1.remove();
      await IAP.endConnection();

      // 3. Reconnect and register new listener
      jest.clearAllMocks();
      await IAP.initConnection();
      const listener2 = jest.fn();
      const sub2 = IAP.purchaseUpdatedListener(listener2);

      // New singleton native listener should be registered after reset
      expect(mockIap.addPurchaseUpdatedListener).toHaveBeenCalledTimes(1);
      const nativeHandler2 =
        mockIap.addPurchaseUpdatedListener.mock.calls[0][0];

      // Simulate purchase event on new connection — new listener should fire
      nativeHandler2(nitroPurchase);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledWith(
        expect.objectContaining({productId: 'p1'}),
      );

      sub2.remove();
    });

    it('error listeners work after endConnection → initConnection reconnection', async () => {
      await IAP.initConnection();
      const errorListener1 = jest.fn();
      const sub1 = IAP.purchaseErrorListener(errorListener1);
      sub1.remove();
      await IAP.endConnection();

      // Reconnect and register new error listener
      jest.clearAllMocks();
      await IAP.initConnection();
      const errorListener2 = jest.fn();
      const sub2 = IAP.purchaseErrorListener(errorListener2);

      expect(mockIap.addPurchaseErrorListener).toHaveBeenCalledTimes(1);
      const nativeHandler = mockIap.addPurchaseErrorListener.mock.calls[0][0];

      nativeHandler({code: 'user-cancelled', message: 'User cancelled'});
      expect(errorListener2).toHaveBeenCalledTimes(1);
      expect(errorListener2).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.UserCancelled,
          message: 'User cancelled',
        }),
      );

      sub2.remove();
    });

    it('clears pre-init listeners when ending without a native instance', async () => {
      const createHybridObject = jest
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('Nitro runtime not installed');
        })
        .mockImplementation(() => mockIap);
      jest.resetModules();
      jest.doMock('react-native-nitro-modules', () => ({
        NitroModules: {createHybridObject},
      }));
      const freshIAP = require('../index');
      const staleListener = jest.fn();

      freshIAP.purchaseUpdatedListener(staleListener);
      await expect(freshIAP.endConnection()).resolves.toBe(true);
      await freshIAP.initConnection();

      const currentListener = jest.fn();
      freshIAP.purchaseUpdatedListener(currentListener);
      const nativeHandler =
        mockIap.addPurchaseUpdatedListener.mock.calls.at(-1)[0];
      nativeHandler({
        id: 't1',
        transactionId: 't1',
        productId: 'p1',
        transactionDate: Date.now(),
        store: 'apple',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      });

      expect(staleListener).not.toHaveBeenCalled();
      expect(currentListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchProducts', () => {
    it('rejects when no SKUs provided', async () => {
      await expect(IAP.fetchProducts({skus: [] as any} as any)).rejects.toThrow(
        /No SKUs provided/,
      );
    });

    it("emits canonical 'in-app' with no compatibility warning", async () => {
      await IAP.fetchProducts({skus: ['coins'], type: 'in-app'});

      expect(mockIap.fetchProducts).toHaveBeenCalledWith(['coins'], 'in-app');
      expect(console.warn).not.toHaveBeenCalled();
    });

    it.each(['inapp', 'in_app', 'one-time'])(
      'rejects removed or unknown product type %s',
      async (type) => {
        await expect(
          IAP.fetchProducts({
            skus: ['coins'],
            type: type as any,
          }),
        ).rejects.toThrow(/Unsupported product type/);
        expect(mockIap.fetchProducts).not.toHaveBeenCalled();
      },
    );

    it('validates and maps products for a single type', async () => {
      (Platform as any).OS = 'ios';
      mockIap.fetchProducts.mockResolvedValueOnce([
        // valid
        {
          id: 'a',
          title: 'A',
          description: 'desc',
          type: 'in-app',
          platform: 'ios',
          isAutoRenewing: true,
          displayPrice: '$1.00',
          currency: 'USD',
        },
        // invalid (missing title)
        {id: 'b', description: 'x', type: 'in-app', platform: 'ios'},
      ]);
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const products = await IAP.fetchProducts({
        skus: ['a', 'b'],
        type: 'in-app',
      });
      expect((products ?? []).map((p: any) => p.id)).toEqual(['a']);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('fetches both inapp and subs when type = all', async () => {
      (Platform as any).OS = 'android';
      mockIap.fetchProducts.mockResolvedValueOnce([
        {
          id: 'x',
          title: 'X',
          description: 'dx',
          type: 'in-app',
          platform: 'android',
          displayPrice: '$1.00',
          currency: 'USD',
        },
        {
          id: 'y',
          title: 'Y',
          description: 'dy',
          type: 'subs',
          platform: 'android',
          displayPrice: '$2.00',
          currency: 'USD',
          subscriptionOffers: JSON.stringify([
            {
              id: 'base',
              displayPrice: '$2.00',
              price: 2,
              type: 'introductory',
              offerTokenAndroid: 'token',
            },
          ]),
        },
      ]);
      const result = await IAP.fetchProducts({
        skus: ['x', 'y'],
        type: 'all',
      });
      const items = result ?? [];

      // Products should be properly categorized
      expect(items).toHaveLength(2);
      // Check that we have both products
      const productIds = items.map((item: any) => item.id);
      expect(productIds).toContain('x');
      expect(productIds).toContain('y');

      const xProduct = items.find((item: any) => item.id === 'x');
      const yProduct = items.find((item: any) => item.id === 'y');

      // Product x should be an in-app product (no subscription offers)
      expect(xProduct?.type).toBe('in-app');

      // Product y should be a subscription (has subscription offers)
      expect(yProduct?.type).toBe('subs');
      expect(mockIap.fetchProducts).toHaveBeenNthCalledWith(
        1,
        ['x', 'y'],
        'all',
      );
    });
  });

  describe('requestPurchase', () => {
    it('rejects all without dispatching a purchase', async () => {
      (Platform as any).OS = 'android';
      await expect(
        IAP.requestPurchase({
          request: {google: {skus: ['p1']}},
          type: 'all' as any,
        }),
      ).rejects.toMatchObject({
        code: ErrorCode.DeveloperError,
        message: expect.stringMatching(/only supported for product queries/),
      });
      expect(mockIap.requestPurchase).not.toHaveBeenCalled();
    });

    it('requires apple.sku on iOS', async () => {
      (Platform as any).OS = 'ios';
      await expect(
        IAP.requestPurchase({
          request: {apple: {}} as any,
          type: 'in-app',
        }),
      ).rejects.toThrow(/sku/);
    });

    it('requires google.skus on Android', async () => {
      (Platform as any).OS = 'android';
      await expect(
        IAP.requestPurchase({
          request: {google: {}} as any,
          type: 'in-app',
        }),
      ).rejects.toThrow(/skus/);
    });

    it('throws on unsupported platform', async () => {
      (Platform as any).OS = 'web';
      await expect(
        IAP.requestPurchase({
          request: {apple: {sku: 'p1'}} as any,
          type: 'in-app',
        }),
      ).rejects.toThrow(/Unsupported platform: web/);
    });

    it('passes unified request to native', async () => {
      (Platform as any).OS = 'android';
      await IAP.requestPurchase({
        request: {google: {skus: ['p1']}},
        type: 'in-app',
      });
      expect(mockIap.requestPurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          google: expect.objectContaining({skus: ['p1']}),
        }),
      );
    });

    it('iOS subs does not auto-set andDangerouslyFinishTransactionAutomatically when not provided', async () => {
      (Platform as any).OS = 'ios';
      await IAP.requestPurchase({
        request: {apple: {sku: 'sub1'}},
        type: 'subs',
      });
      const passed = mockIap.requestPurchase.mock.calls.pop()?.[0];
      expect(
        passed.apple.andDangerouslyFinishTransactionAutomatically,
      ).toBeUndefined();
    });

    it('iOS passes withOffer through to native', async () => {
      (Platform as any).OS = 'ios';
      const offer = {
        identifier: 'offer-id',
        keyIdentifier: 'key-id',
        nonce: 'nonce-value',
        signature: 'signature-value',
        timestamp: 1720000000,
      } satisfies DiscountOfferInputIOS;
      await IAP.requestPurchase({
        request: {
          apple: {sku: 'p1', withOffer: offer},
        },
        type: 'in-app',
      });
      const passed = mockIap.requestPurchase.mock.calls.pop()?.[0];
      expect(passed.apple.withOffer).toEqual({
        identifier: 'offer-id',
        keyIdentifier: 'key-id',
        nonce: 'nonce-value',
        signature: 'signature-value',
        timestamp: String(1720000000),
      });
    });

    it('Android subs fills empty subscriptionOffers array when missing', async () => {
      (Platform as any).OS = 'android';
      await IAP.requestPurchase({
        request: {google: {skus: ['sub1']}},
        type: 'subs',
      });
      const passed = mockIap.requestPurchase.mock.calls.pop()?.[0];
      expect(passed.google.subscriptionOffers).toEqual([]);
    });

    it('Android subs forwards subscriptionOffers when provided', async () => {
      (Platform as any).OS = 'android';
      await IAP.requestPurchase({
        request: {
          google: {
            skus: ['sub1'],
            subscriptionOffers: [
              {sku: 'sub1', offerToken: 'offer-1'},
              {sku: 'sub1', offerToken: 'offer-2'},
            ],
          },
        },
        type: 'subs',
      });
      const [lastCallArgs] = mockIap.requestPurchase.mock.lastCall;
      expect(lastCallArgs.google.subscriptionOffers).toEqual([
        {sku: 'sub1', offerToken: 'offer-1'},
        {sku: 'sub1', offerToken: 'offer-2'},
      ]);
    });

    it.each([
      [[[null]]],
      [[{sku: 'sub1'}]],
      [[{sku: '', offerToken: 'offer-token'}]],
      [[{sku: 'sub1', offerToken: ''}]],
    ])(
      'Android subs rejects malformed explicit offers without dispatching: %j',
      async (subscriptionOffers) => {
        (Platform as any).OS = 'android';
        await expect(
          IAP.requestPurchase({
            request: {
              google: {
                skus: ['sub1'],
                subscriptionOffers,
              } as any,
            },
            type: 'subs',
          }),
        ).rejects.toThrow(/Every subscription offer/);
        expect(mockIap.requestPurchase).not.toHaveBeenCalled();
      },
    );

    it.each([
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
      'rejects branch-mismatched Android options for %s without dispatching',
      async (type, google) => {
        (Platform as any).OS = 'android';
        await expect(
          IAP.requestPurchase({request: {google} as any, type: type as any}),
        ).rejects.toThrow(/must match the selected product type/);
        expect(mockIap.requestPurchase).not.toHaveBeenCalled();
      },
    );

    it('Android subs forwards subscriptionProductReplacementParams when provided', async () => {
      (Platform as any).OS = 'android';
      await IAP.requestPurchase({
        request: {
          google: {
            skus: ['new_sub'],
            subscriptionOffers: [{sku: 'new_sub', offerToken: 'offer-token'}],
            subscriptionProductReplacementParams: {
              oldProductId: 'old_sub',
              replacementMode: 'with-time-proration',
            },
          },
        },
        type: 'subs',
      });
      const [lastCallArgs] = mockIap.requestPurchase.mock.lastCall;
      expect(lastCallArgs.google.subscriptionProductReplacementParams).toEqual({
        oldProductId: 'old_sub',
        replacementMode: 'with-time-proration',
      });
    });

    it('Android subs does not include subscriptionProductReplacementParams when not provided', async () => {
      (Platform as any).OS = 'android';
      await IAP.requestPurchase({
        request: {
          google: {
            skus: ['sub1'],
            subscriptionOffers: [{sku: 'sub1', offerToken: 'token'}],
          },
        },
        type: 'subs',
      });
      const [lastCallArgs] = mockIap.requestPurchase.mock.lastCall;
      expect(
        lastCallArgs.google.subscriptionProductReplacementParams,
      ).toBeUndefined();
    });

    it('Android forwards minimal in-app Billing Choice options', async () => {
      (Platform as any).OS = 'android';
      await IAP.requestPurchase({
        request: {
          google: {
            skus: ['premium'],
            developerBillingOption: {
              billingProgram: 'billing-choice',
            },
          },
        },
        type: 'in-app',
      });

      const [lastCallArgs] = mockIap.requestPurchase.mock.lastCall;
      expect(lastCallArgs.google.developerBillingOption).toEqual({
        billingProgram: 'billing-choice',
      });
    });

    it('Android forwards Billing Choice subscription replacement fields', async () => {
      (Platform as any).OS = 'android';
      await IAP.requestPurchase({
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

      const [lastCallArgs] = mockIap.requestPurchase.mock.lastCall;
      expect(lastCallArgs.google.originalExternalTransactionId).toBe(
        'original-external-id',
      );
      expect(lastCallArgs.google.developerBillingOption).toEqual({
        billingProgram: 'billing-choice',
        externalTransactionToken: 'pre-generated-token',
        launchMode: 'caller-will-launch-link',
        linkUri: 'https://example.com/checkout',
      });
    });

    it('Android subs supports all replacement modes', async () => {
      (Platform as any).OS = 'android';
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
        await IAP.requestPurchase({
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
        const [lastCallArgs] = mockIap.requestPurchase.mock.lastCall;
        expect(
          lastCallArgs.google.subscriptionProductReplacementParams
            .replacementMode,
        ).toBe(mode);
      }
    });

    // New tests for google/apple field support
    it('supports apple field (recommended) on iOS', async () => {
      (Platform as any).OS = 'ios';
      await IAP.requestPurchase({
        request: {apple: {sku: 'premium_sub'}},
        type: 'in-app',
      });
      const passed = mockIap.requestPurchase.mock.calls.pop()?.[0];
      expect(passed.apple.sku).toBe('premium_sub');
      expect(passed.ios).toBeUndefined();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('supports google field (recommended) on Android', async () => {
      (Platform as any).OS = 'android';
      await IAP.requestPurchase({
        request: {google: {skus: ['premium_sub']}},
        type: 'in-app',
      });
      const passed = mockIap.requestPurchase.mock.calls.pop()?.[0];
      expect(passed.google.skus).toEqual(['premium_sub']);
      expect(passed.android).toBeUndefined();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('iOS passes advancedCommerceData through to native', async () => {
      (Platform as any).OS = 'ios';
      await IAP.requestPurchase({
        request: {
          apple: {
            sku: 'premium_sub',
            advancedCommerceData: 'campaign_summer_2025',
          },
        },
        type: 'in-app',
      });
      const passed = mockIap.requestPurchase.mock.calls.pop()?.[0];
      expect(passed.apple.advancedCommerceData).toBe('campaign_summer_2025');
    });

    it('iOS passes advancedCommerceData with JSON format', async () => {
      (Platform as any).OS = 'ios';
      const advancedData = '{"signatureInfo": {"token": "affiliate_123"}}';
      await IAP.requestPurchase({
        request: {
          apple: {
            sku: 'premium_sub',
            advancedCommerceData: advancedData,
          },
        },
        type: 'subs',
      });
      const passed = mockIap.requestPurchase.mock.calls.pop()?.[0];
      expect(passed.apple.advancedCommerceData).toBe(advancedData);
    });

    it('iOS subs forwards advanced subscription offer fields', async () => {
      (Platform as any).OS = 'ios';
      await IAP.requestPurchase({
        request: {
          apple: {
            sku: 'premium_sub',
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
      const passed = mockIap.requestPurchase.mock.calls.pop()?.[0];
      expect(passed.apple.billingPlanType).toBe('monthly');
      expect(passed.apple.compactJWS).toBe('intro-eligibility-jws');
      expect(passed.apple.promotionalOfferJWS).toEqual({
        offerId: 'promo-offer',
        jws: 'compact-jws',
      });
      expect(passed.apple.winBackOffer).toEqual({
        offerId: 'winback-offer',
      });
    });
  });

  describe('getAvailablePurchases', () => {
    it('iOS path passes deprecation-compatible flags', async () => {
      (Platform as any).OS = 'ios';
      mockIap.getAvailablePurchases.mockImplementationOnce(async () => []);
      await IAP.getAvailablePurchases({
        alsoPublishToEventListenerIOS: true,
        onlyIncludeActiveItemsIOS: false,
      });
      expect(mockIap.getAvailablePurchases).toHaveBeenCalledWith(
        expect.objectContaining({
          ios: expect.objectContaining({
            alsoPublishToEventListenerIOS: true,
            onlyIncludeActiveItemsIOS: false,
            alsoPublishToEventListener: true,
            onlyIncludeActiveItems: false,
          }),
        }),
      );
    });

    it('Android path merges inapp+subs results', async () => {
      (Platform as any).OS = 'android';
      const nitro = (id: string) => ({
        id: `t-${id}`,
        productId: id,
        transactionDate: Date.now(),
        store: 'google',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      });
      mockIap.getAvailablePurchases
        .mockResolvedValueOnce([nitro('p1')])
        .mockResolvedValueOnce([nitro('s1')]);
      const res = await IAP.getAvailablePurchases();
      expect(mockIap.getAvailablePurchases).toHaveBeenNthCalledWith(1, {
        android: {type: 'in-app', includeSuspended: false},
      });
      expect(mockIap.getAvailablePurchases).toHaveBeenNthCalledWith(2, {
        android: {type: 'subs', includeSuspended: false},
      });
      expect(res.map((p: any) => p.productId).sort()).toEqual(['p1', 's1']);
    });

    it('rejects a mixed valid and malformed native purchase list', async () => {
      (Platform as any).OS = 'android';
      const valid = {
        id: 'transaction-valid',
        productId: 'valid',
        transactionDate: Date.now(),
        store: 'google',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      };
      mockIap.getAvailablePurchases
        .mockResolvedValueOnce([valid])
        .mockResolvedValueOnce([{id: 'malformed'}]);

      await expect(IAP.getAvailablePurchases()).rejects.toMatchObject({
        code: 'billing-response-json-parse-error',
      });
    });

    it('rejects a non-array native purchase payload', async () => {
      (Platform as any).OS = 'ios';
      mockIap.getAvailablePurchases.mockResolvedValueOnce(null as any);

      await expect(IAP.getAvailablePurchases()).rejects.toMatchObject({
        code: 'billing-response-json-parse-error',
      });
    });

    it('preserves an authoritative empty native purchase list', async () => {
      (Platform as any).OS = 'ios';
      mockIap.getAvailablePurchases.mockResolvedValueOnce([]);

      await expect(IAP.getAvailablePurchases()).resolves.toEqual([]);
    });

    it('rejects a foreign store in an iOS available-purchase list', async () => {
      (Platform as any).OS = 'ios';
      mockIap.getAvailablePurchases.mockResolvedValueOnce([
        {
          id: 'foreign',
          transactionId: 'foreign',
          productId: 'premium',
          transactionDate: Date.now(),
          store: 'google',
          quantity: 1,
          purchaseState: 'purchased',
          isAutoRenewing: false,
        },
      ]);

      await expect(IAP.getAvailablePurchases()).rejects.toMatchObject({
        code: 'billing-response-json-parse-error',
      });
    });

    it('rejects a foreign store in an Android available-purchase list', async () => {
      (Platform as any).OS = 'android';
      mockIap.getAvailablePurchases
        .mockResolvedValueOnce([
          {
            id: 'foreign',
            productId: 'premium',
            transactionDate: Date.now(),
            store: 'apple',
            quantity: 1,
            purchaseState: 'purchased',
            isAutoRenewing: false,
            transactionId: 'foreign',
          },
        ])
        .mockResolvedValueOnce([]);

      await expect(IAP.getAvailablePurchases()).rejects.toMatchObject({
        code: 'billing-response-json-parse-error',
      });
    });

    it('Vega path queries purchase updates once', async () => {
      jest.resetModules();
      jest.doMock('react-native', () => ({
        Platform: {OS: 'kepler'},
      }));
      jest.doMock('react-native-nitro-modules', () => ({
        NitroModules: {
          createHybridObject: jest.fn(() => mockIap),
        },
      }));
      jest.doMock('../vega', () => ({
        getVegaIapModule: jest.fn(() => mockIap),
        isVegaOS: jest.fn(() => true),
      }));
      IAP = require('../index');

      const nitro = {
        id: 't-vega',
        productId: 'premium_monthly',
        transactionDate: Date.now(),
        store: 'amazon',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: true,
      };
      mockIap.getAvailablePurchases.mockResolvedValueOnce([nitro]);

      const res = await IAP.getAvailablePurchases({
        includeSuspendedAndroid: true,
      });

      expect(mockIap.getAvailablePurchases).toHaveBeenCalledTimes(1);
      expect(mockIap.getAvailablePurchases).toHaveBeenCalledWith({
        android: {includeSuspended: true},
      });
      expect(res).toEqual([
        expect.objectContaining({
          productId: 'premium_monthly',
          store: 'amazon',
        }),
      ]);
    });

    it('throws on unsupported platform', async () => {
      (Platform as any).OS = 'web';
      await expect(IAP.getAvailablePurchases()).rejects.toThrow(
        /Unsupported platform: web/,
      );
    });
  });

  describe('finishTransaction', () => {
    it('iOS requires purchase.id and returns success state', async () => {
      (Platform as any).OS = 'ios';
      await expect(
        IAP.finishTransaction({purchase: {id: ''} as any}),
      ).rejects.toThrow(/required/);

      mockIap.finishTransaction.mockResolvedValueOnce(true);
      await expect(
        IAP.finishTransaction({purchase: {id: 'tid'} as any}),
      ).resolves.toBeUndefined();
    });

    it('Android requires token; maps consume flag', async () => {
      (Platform as any).OS = 'android';
      await expect(
        IAP.finishTransaction({purchase: {productId: 'p'} as any}),
      ).rejects.toThrow(/token/i);

      mockIap.finishTransaction.mockResolvedValueOnce({
        responseCode: 0,
        code: '0',
        message: 'ok',
        purchaseToken: 'tok',
      });
      await IAP.finishTransaction({
        purchase: {productId: 'p', purchaseToken: 'tok'} as any,
        isConsumable: true,
      });
      expect(mockIap.finishTransaction).toHaveBeenCalledWith({
        android: {purchaseToken: 'tok', isConsumable: true},
      });
    });

    it('iOS: treats already-finished error as success', async () => {
      (Platform as any).OS = 'ios';
      mockIap.finishTransaction.mockRejectedValueOnce(
        new Error('Transaction not found'),
      );
      await expect(
        IAP.finishTransaction({purchase: {id: 'tid'} as any}),
      ).resolves.toBeUndefined();
    });

    it('iOS: propagates native finish failures', async () => {
      (Platform as any).OS = 'ios';
      const error = new Error(
        JSON.stringify({
          code: 'service-error',
          message: 'StoreKit network failure',
        }),
      );
      mockIap.finishTransaction.mockRejectedValueOnce(error);

      await expect(
        IAP.finishTransaction({purchase: {id: 'tid'} as any}),
      ).rejects.toBe(error);
    });

    it('throws on unsupported platform', async () => {
      (Platform as any).OS = 'web';
      await expect(
        IAP.finishTransaction({purchase: {id: 'tid'} as any}),
      ).rejects.toThrow(/Unsupported platform: web/);
    });
  });

  describe('storefront helpers', () => {
    it('getStorefront uses unified native method when available on iOS', async () => {
      (Platform as any).OS = 'ios';
      mockIap.getStorefront = jest.fn(async () => 'USA');
      await expect(IAP.getStorefront()).resolves.toBe('USA');
      expect(mockIap.getStorefront).toHaveBeenCalledTimes(1);
    });

    it('getStorefront uses unified method on Android', async () => {
      const expected = 'KOR';
      mockIap.getStorefront = jest.fn(async () => expected);
      (Platform as any).OS = 'android';
      await expect(IAP.getStorefront()).resolves.toBe(expected);
      expect(mockIap.getStorefront).toHaveBeenCalledTimes(1);
    });

    it.each([null, undefined, '', '   '])(
      'getStorefront rejects an empty native value (%p)',
      async (value) => {
        (Platform as any).OS = 'android';
        mockIap.getStorefront = jest.fn(async () => value);

        await expect(IAP.getStorefront()).rejects.toMatchObject({
          code: IAP.ErrorCode.ServiceError,
          message: expect.stringContaining('no country code'),
        });
      },
    );

    it('getStorefront normalizes native exceptions', async () => {
      (Platform as any).OS = 'android';
      mockIap.getStorefront = jest.fn(async () => {
        throw new Error('storefront exploded');
      });

      await expect(IAP.getStorefront()).rejects.toMatchObject({
        code: IAP.ErrorCode.Unknown,
        message: expect.stringContaining('storefront exploded'),
      });
    });

    it('getStorefront rejects unsupported platforms', async () => {
      (Platform as any).OS = 'web';

      await expect(IAP.getStorefront()).rejects.toMatchObject({
        code: IAP.ErrorCode.FeatureNotSupported,
        message: expect.stringContaining('not supported on web'),
      });
    });
  });

  describe('iOS-only helpers', () => {
    it('getAppTransactionIOS returns value on iOS and throws on Android', async () => {
      (Platform as any).OS = 'ios';
      await expect(IAP.getAppTransactionIOS()).resolves.toBeNull();
      (Platform as any).OS = 'android';
      await expect(IAP.getAppTransactionIOS()).rejects.toThrow(
        /only available on iOS/,
      );
    });

    it('getAppTransactionIOS accepts JSON and object bridge results', async () => {
      const value = {
        appId: 1,
        appVersion: '1.0.0',
        appVersionId: 2,
        bundleId: 'dev.hyo.app',
        deviceVerification: 'verification',
        deviceVerificationNonce: 'nonce',
        environment: 'Sandbox',
        originalAppVersion: '1.0.0',
        originalPurchaseDate: 3,
        signedDate: 4,
      };

      mockIap.getAppTransactionIOS
        .mockResolvedValueOnce(JSON.stringify(value))
        .mockResolvedValueOnce(value);

      await expect(IAP.getAppTransactionIOS()).resolves.toMatchObject(value);
      await expect(IAP.getAppTransactionIOS()).resolves.toBe(value);
    });

    it('getAppTransactionIOS rejects malformed and native failures', async () => {
      mockIap.getAppTransactionIOS.mockResolvedValueOnce('{');
      await expect(IAP.getAppTransactionIOS()).rejects.toThrow(
        /Unable to parse app transaction payload/,
      );

      const nativeError = new Error('app transaction failed');
      mockIap.getAppTransactionIOS.mockRejectedValueOnce(nativeError);
      await expect(IAP.getAppTransactionIOS()).rejects.toBe(nativeError);
    });

    it('presentCodeRedemptionSheetIOS returns the verified purchase', async () => {
      (Platform as any).OS = 'ios';
      mockIap.presentCodeRedemptionSheetIOS.mockResolvedValueOnce({
        id: 'redeemed-transaction',
        transactionId: 'redeemed-transaction',
        productId: 'premium',
        transactionDate: 1700000000000,
        store: 'apple',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: true,
      });
      await expect(IAP.presentCodeRedemptionSheetIOS()).resolves.toMatchObject({
        id: 'redeemed-transaction',
        productId: 'premium',
        store: 'apple',
      });
    });

    it('presentCodeRedemptionSheetIOS returns null on non‑iOS', async () => {
      (Platform as any).OS = 'android';
      await expect(IAP.presentCodeRedemptionSheetIOS()).resolves.toBeNull();
    });

    it('getPendingTransactionsIOS maps purchases', async () => {
      (Platform as any).OS = 'ios';
      const nitro = {
        id: 't1',
        transactionId: 't1',
        productId: 'p1',
        transactionDate: Date.now(),
        store: 'apple',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      };
      mockIap.getPendingTransactionsIOS = jest.fn(async () => [nitro]);
      const res = await IAP.getPendingTransactionsIOS();
      expect(res[0].id).toBe('t1');
    });

    it('showManageSubscriptionsIOS maps purchases', async () => {
      (Platform as any).OS = 'ios';
      const nitro = {
        id: 't2',
        transactionId: 't2',
        productId: 'p2',
        transactionDate: Date.now(),
        store: 'apple',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
        currentPlanId: 'premium_monthly',
      };
      mockIap.showManageSubscriptionsIOS = jest.fn(async () => [nitro]);
      const res = await IAP.showManageSubscriptionsIOS();
      expect(res[0].productId).toBe('p2');
      expect(res[0].currentPlanId).toBe('premium_monthly');
    });

    it.each([
      ['getPendingTransactionsIOS', 'getPendingTransactionsIOS'],
      ['getAllTransactionsIOS', 'getAllTransactionsIOS'],
      ['showManageSubscriptionsIOS', 'showManageSubscriptionsIOS'],
    ])(
      '%s rejects a mixed non-Apple batch atomically',
      async (apiName, nativeName) => {
        (Platform as any).OS = 'ios';
        const valid = {
          id: 'apple-transaction',
          transactionId: 'apple-transaction',
          productId: 'premium',
          transactionDate: Date.now(),
          store: 'apple',
          quantity: 1,
          purchaseState: 'purchased',
          isAutoRenewing: false,
        };
        mockIap[nativeName] = jest.fn(async () => [
          valid,
          {...valid, id: 'foreign', store: 'google'},
        ]);

        await expect(IAP[apiName]()).rejects.toMatchObject({
          code: ErrorCode.BillingResponseJsonParseError,
        });
      },
    );

    it('showManageSubscriptionsIOS returns [] on non‑iOS', async () => {
      (Platform as any).OS = 'android';
      await expect(IAP.showManageSubscriptionsIOS()).resolves.toEqual([]);
    });

    it('getPromotedProductIOS maps the native product', async () => {
      (Platform as any).OS = 'ios';
      const nitroProduct = {
        id: 'sku2',
        title: 'Title2',
        description: 'Desc2',
        type: 'in-app',
        platform: 'ios',
        isAutoRenewing: true,
        displayPrice: '$1',
        currency: 'USD',
      };
      mockIap.getPromotedProductIOS = jest.fn(async () => nitroProduct);
      const promoted = await IAP.getPromotedProductIOS();
      expect(promoted?.id).toBe('sku2');
    });

    it('clearTransactionIOS resolves without throwing', async () => {
      (Platform as any).OS = 'ios';
      mockIap.clearTransactionIOS = jest.fn(async () => undefined);
      await expect(IAP.clearTransactionIOS()).resolves.toBe(true);
    });

    it('clearTransactionIOS surfaces native failures', async () => {
      (Platform as any).OS = 'ios';
      mockIap.clearTransactionIOS = jest.fn(async () => {
        throw {code: 'service-error', message: 'Clear failed'};
      });

      await expect(IAP.clearTransactionIOS()).rejects.toMatchObject({
        code: ErrorCode.ServiceError,
        message: 'Clear failed',
      });
    });

    it('beginRefundRequestIOS returns status string', async () => {
      (Platform as any).OS = 'ios';
      mockIap.beginRefundRequestIOS = jest.fn(async () => 'success');
      await expect(IAP.beginRefundRequestIOS('sku')).resolves.toBe('success');
    });

    it('subscriptionStatusIOS converts items', async () => {
      (Platform as any).OS = 'ios';
      mockIap.subscriptionStatusIOS = jest.fn(async () => [
        {
          state: 1,
          platform: 'ios',
          isAutoRenewing: true,
          renewalInfo: {willAutoRenew: true},
        },
      ]);
      const res = await IAP.subscriptionStatusIOS('sku');
      expect(Array.isArray(res)).toBe(true);
      expect(res?.length).toBe(1);
    });

    it('currentEntitlementIOS and latestTransactionIOS map purchases', async () => {
      (Platform as any).OS = 'ios';
      const nitro = {
        id: 't3',
        transactionId: 't3',
        productId: 'p3',
        transactionDate: Date.now(),
        store: 'apple',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      };
      mockIap.currentEntitlementIOS = jest.fn(async () => nitro);

      mockIap.latestTransactionIOS = jest.fn(async () => nitro);
      const e = await IAP.currentEntitlementIOS('p3');
      const t = await IAP.latestTransactionIOS('p3');
      expect(e?.productId).toBe('p3');
      expect(t?.id).toBe('t3');
    });

    it('isEligibleForIntroOfferIOS returns boolean', async () => {
      (Platform as any).OS = 'ios';
      mockIap.isEligibleForIntroOfferIOS = jest.fn(async () => true);
      await expect(IAP.isEligibleForIntroOfferIOS('group')).resolves.toBe(true);
    });

    it('getReceiptDataIOS returns string', async () => {
      (Platform as any).OS = 'ios';
      mockIap.getReceiptDataIOS = jest.fn(async () => 'r');
      await expect(IAP.getReceiptDataIOS()).resolves.toBe('r');
    });

    it('requestReceiptRefreshIOS prefers native method when available', async () => {
      (Platform as any).OS = 'ios';
      mockIap.requestReceiptRefreshIOS = jest.fn(async () => 'refresh');
      await expect(IAP.requestReceiptRefreshIOS()).resolves.toBe('refresh');
      expect(mockIap.requestReceiptRefreshIOS).toHaveBeenCalled();
    });

    it('requestReceiptRefreshIOS falls back to getReceiptDataIOS when missing', async () => {
      (Platform as any).OS = 'ios';
      delete mockIap.requestReceiptRefreshIOS;
      mockIap.getReceiptDataIOS = jest.fn(async () => 'fallback-refresh');
      await expect(IAP.requestReceiptRefreshIOS()).resolves.toBe(
        'fallback-refresh',
      );
      expect(mockIap.getReceiptDataIOS).toHaveBeenCalled();
    });

    it('isTransactionVerifiedIOS returns boolean', async () => {
      (Platform as any).OS = 'ios';
      mockIap.isTransactionVerifiedIOS = jest.fn(async () => true);
      await expect(IAP.isTransactionVerifiedIOS('sku')).resolves.toBe(true);
    });

    it('getTransactionJwsIOS returns string', async () => {
      (Platform as any).OS = 'ios';
      mockIap.getTransactionJwsIOS = jest.fn(async () => 'jws');
      await expect(IAP.getTransactionJwsIOS('sku')).resolves.toBe('jws');
    });

    it('syncIOS calls native sync', async () => {
      (Platform as any).OS = 'ios';
      mockIap.syncIOS = jest.fn(async () => true);
      await expect(IAP.syncIOS()).resolves.toBe(true);
    });

    it('syncIOS preserves Nitro user cancellation without error logging', async () => {
      (Platform as any).OS = 'ios';
      mockIap.syncIOS = jest.fn(async () => {
        throw new Error(
          'Error Domain=com.margelo.nitro.rniap Code=-1 ' +
            '"{\\"message\\":\\"Request Canceled\\",\\"code\\":\\"user-cancelled\\"}" ' +
            'UserInfo={NSLocalizedDescription={\\"message\\":\\"Request Canceled\\",\\"code\\":\\"user-cancelled\\"}}',
        );
      });

      await expect(IAP.syncIOS()).rejects.toMatchObject({
        code: ErrorCode.UserCancelled,
        message: 'Request Canceled',
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    it('restorePurchases on iOS calls syncIOS first', async () => {
      (Platform as any).OS = 'ios';
      mockIap.syncIOS = jest.fn(async () => true);
      await IAP.restorePurchases();
      expect(mockIap.syncIOS).toHaveBeenCalled();
    });

    it('restorePurchases on iOS rejects when syncIOS returns false', async () => {
      (Platform as any).OS = 'ios';
      mockIap.syncIOS = jest.fn(async () => false);

      await expect(IAP.restorePurchases()).rejects.toMatchObject({
        code: ErrorCode.SyncError,
        message: 'App Store purchase sync did not complete',
      });
      expect(mockIap.getAvailablePurchases).not.toHaveBeenCalled();
    });
  });

  describe('Android user choice billing listener', () => {
    it('fans out native events, isolates callbacks, and removes listeners', () => {
      (Platform as any).OS = 'android';
      const first = IAP.userChoiceBillingListenerAndroid(() => {
        throw new Error('consumer failed');
      });
      const listener = jest.fn();
      const second = IAP.userChoiceBillingListenerAndroid(listener);
      const nativeListener =
        mockIap.addUserChoiceBillingListenerAndroid.mock.calls[0][0];
      const details = {
        products: ['premium'],
        externalTransactionToken: 'opaque',
      };

      nativeListener(details);
      first.remove();
      second.remove();

      expect(listener).toHaveBeenCalledWith(details);
      expect(console.error).toHaveBeenCalled();
      expect(mockIap.addUserChoiceBillingListenerAndroid).toHaveBeenCalledTimes(
        1,
      );
      expect(
        mockIap.removeUserChoiceBillingListenerAndroid,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockIap.removeUserChoiceBillingListenerAndroid,
      ).toHaveBeenCalledWith(nativeListener);
    });

    it('returns an inert subscription outside Android', () => {
      (Platform as any).OS = 'ios';
      const subscription = IAP.userChoiceBillingListenerAndroid(jest.fn());
      expect(() => subscription.remove()).not.toThrow();
      expect(
        mockIap.addUserChoiceBillingListenerAndroid,
      ).not.toHaveBeenCalled();
    });

    it('keeps the listener inert while Nitro initializes', () => {
      (Platform as any).OS = 'android';
      mockIap.addUserChoiceBillingListenerAndroid.mockImplementationOnce(() => {
        throw new Error('Nitro runtime not installed');
      });

      expect(() =>
        IAP.userChoiceBillingListenerAndroid(jest.fn()),
      ).not.toThrow();
      expect(console.warn).toHaveBeenCalled();
    });

    it('surfaces unexpected native listener failures', () => {
      (Platform as any).OS = 'android';
      mockIap.addUserChoiceBillingListenerAndroid.mockImplementationOnce(() => {
        throw new Error('native listener failed');
      });

      expect(() => IAP.userChoiceBillingListenerAndroid(jest.fn())).toThrow(
        'native listener failed',
      );
    });
  });

  describe('Android-only wrappers', () => {
    it('acknowledgePurchaseAndroid calls unified finishTransaction', async () => {
      (Platform as any).OS = 'android';
      mockIap.finishTransaction.mockResolvedValueOnce({
        responseCode: 0,
        code: '0',
        message: 'ok',
        purchaseToken: 'tok',
      });
      const res = await IAP.acknowledgePurchaseAndroid('tok');
      expect(res).toBe(true);
      expect(mockIap.finishTransaction).toHaveBeenCalledWith({
        android: {purchaseToken: 'tok', isConsumable: false},
      });
    });

    it('consumePurchaseAndroid calls unified finishTransaction', async () => {
      (Platform as any).OS = 'android';
      mockIap.finishTransaction.mockResolvedValueOnce({
        responseCode: 0,
        code: '0',
        message: 'ok',
        purchaseToken: 'tok',
      });
      const res = await IAP.consumePurchaseAndroid('tok');
      expect(res).toBe(true);
      expect(mockIap.finishTransaction).toHaveBeenCalledWith({
        android: {purchaseToken: 'tok', isConsumable: true},
      });
    });

    it('openRedeemOfferCodeAndroid delegates to the native store handler', async () => {
      (Platform as any).OS = 'android';
      mockIap.openRedeemOfferCodeAndroid.mockResolvedValueOnce(true);
      await expect(IAP.openRedeemOfferCodeAndroid()).resolves.toBe(true);
      expect(mockIap.openRedeemOfferCodeAndroid).toHaveBeenCalledTimes(1);
    });

    it('openRedeemOfferCodeAndroid throws on non-Android', async () => {
      (Platform as any).OS = 'ios';
      await expect(IAP.openRedeemOfferCodeAndroid()).rejects.toThrow(
        'openRedeemOfferCodeAndroid is only supported on Android',
      );
      expect(mockIap.openRedeemOfferCodeAndroid).not.toHaveBeenCalled();
    });

    it('openRedeemOfferCodeAndroid preserves unsupported store results', async () => {
      (Platform as any).OS = 'android';
      mockIap.openRedeemOfferCodeAndroid.mockResolvedValueOnce(false);
      await expect(IAP.openRedeemOfferCodeAndroid()).resolves.toBe(false);
    });
  });

  describe('verifyPurchase', () => {
    it('iOS path maps NitroPurchaseVerificationResultIOS', async () => {
      (Platform as any).OS = 'ios';
      mockIap.verifyPurchase.mockResolvedValueOnce({
        isValid: true,
        receiptData: 'r',
        jwsRepresentation: 'jws',
        latestTransaction: null,
      });
      const res = await IAP.verifyPurchase({
        apple: {sku: 'sku'},
      });
      expect(res).toEqual(
        expect.objectContaining({
          isValid: true,
          receiptData: 'r',
          jwsRepresentation: 'jws',
        }),
      );
    });

    it('Android path maps NitroPurchaseVerificationResultAndroid', async () => {
      (Platform as any).OS = 'android';
      mockIap.verifyPurchase.mockResolvedValueOnce({
        isValid: false,
        autoRenewing: false,
        betaProduct: false,
        cancelDate: null,
        cancelReason: 'none',
        deferredDate: null,
        deferredSku: null,
        freeTrialEndDate: 0,
        gracePeriodEndDate: 0,
        parentProductId: 'parent',
        productId: 'sku',
        productType: 'inapp',
        purchaseDate: 123,
        quantity: 1,
        receiptId: 'rid',
        renewalDate: 0,
        term: 'term',
        termSku: 'termSku',
        testTransaction: false,
      });
      const res = await IAP.verifyPurchase({
        google: {
          sku: 'sku',
          packageName: 'com.app',
          purchaseToken: 'tok',
          accessToken: 'acc',
        },
      });
      expect(res).toEqual(
        expect.objectContaining({
          isValid: false,
          productId: 'sku',
          productType: 'inapp',
        }),
      );
    });

    it('Horizon path forwards options and maps its result variant', async () => {
      (Platform as any).OS = 'android';
      mockIap.verifyPurchase.mockResolvedValueOnce({
        isValid: true,
        grantTime: 1744148687,
        success: true,
      });

      const res = await IAP.verifyPurchase({
        horizon: {
          sku: 'premium',
          userId: 'user-1',
          accessToken: 'secret',
        },
      });

      expect(mockIap.verifyPurchase).toHaveBeenCalledWith({
        apple: null,
        google: null,
        horizon: {
          sku: 'premium',
          userId: 'user-1',
          accessToken: 'secret',
        },
      });
      expect(res).toEqual({
        isValid: true,
        grantTime: 1744148687,
        success: true,
      });
    });

    it('uses the normalized Google variant when Horizon options are empty', async () => {
      (Platform as any).OS = 'android';
      mockIap.verifyPurchase.mockResolvedValueOnce({
        isValid: false,
        productId: 'sku',
        productType: 'inapp',
      });

      const res = await IAP.verifyPurchase({
        google: {
          sku: 'sku',
          packageName: 'com.app',
          purchaseToken: 'tok',
          accessToken: 'acc',
        },
        horizon: {},
      } as any);

      expect(mockIap.verifyPurchase).toHaveBeenCalledWith({
        apple: null,
        google: {
          sku: 'sku',
          packageName: 'com.app',
          purchaseToken: 'tok',
          accessToken: 'acc',
          isSub: undefined,
        },
        horizon: null,
      });
      expect(res).toEqual(
        expect.objectContaining({
          isValid: false,
          productId: 'sku',
          productType: 'inapp',
        }),
      );
      expect(res).not.toHaveProperty('success');
    });
  });

  describe('Non‑iOS branches', () => {
    it('isEligibleForIntroOfferIOS returns false on non‑iOS', async () => {
      (Platform as any).OS = 'android';
      await expect(IAP.isEligibleForIntroOfferIOS('group')).resolves.toBe(
        false,
      );
    });

    it('getReceiptDataIOS throws on non‑iOS', async () => {
      (Platform as any).OS = 'android';
      await expect(IAP.getReceiptDataIOS()).rejects.toThrow(
        /only available on iOS/,
      );
    });

    it('isTransactionVerifiedIOS returns false on non‑iOS', async () => {
      (Platform as any).OS = 'android';
      await expect(IAP.isTransactionVerifiedIOS('sku')).resolves.toBe(false);
    });

    it('getTransactionJwsIOS returns null on non‑iOS', async () => {
      (Platform as any).OS = 'android';
      await expect(IAP.getTransactionJwsIOS('sku')).resolves.toBeNull();
    });

    it('getPendingTransactionsIOS returns [] on non‑iOS', async () => {
      (Platform as any).OS = 'android';
      await expect(IAP.getPendingTransactionsIOS()).resolves.toEqual([]);
    });

    it('currentEntitlementIOS returns null on non‑iOS', async () => {
      (Platform as any).OS = 'android';
      await expect(IAP.currentEntitlementIOS('sku')).resolves.toBeNull();
    });

    it('latestTransactionIOS returns null on non‑iOS', async () => {
      (Platform as any).OS = 'android';
      await expect(IAP.latestTransactionIOS('sku')).resolves.toBeNull();
    });

    it('restorePurchases on Android does not call syncIOS', async () => {
      (Platform as any).OS = 'android';
      mockIap.syncIOS = jest.fn(async () => true);
      await expect(IAP.restorePurchases()).resolves.toBeUndefined();
      expect(mockIap.syncIOS).not.toHaveBeenCalled();
    });
  });

  describe('Cross‑platform helpers', () => {
    it('deepLinkToSubscriptions calls Android native deeplink when on Android', async () => {
      (Platform as any).OS = 'android';
      mockIap.deepLinkToSubscriptionsAndroid = jest.fn(async () => undefined);
      await expect(
        IAP.deepLinkToSubscriptions({
          skuAndroid: 'sub1',
          packageNameAndroid: 'dev.hyo.martie',
        }),
      ).resolves.toBeUndefined();
      expect(mockIap.deepLinkToSubscriptionsAndroid).toHaveBeenCalledWith({
        skuAndroid: 'sub1',
        packageNameAndroid: 'dev.hyo.martie',
      });
    });

    it('deepLinkToSubscriptions uses iOS deeplink when available', async () => {
      (Platform as any).OS = 'ios';
      mockIap.deepLinkToSubscriptionsIOS = jest.fn(async () => true);
      await expect(IAP.deepLinkToSubscriptions()).resolves.toBeUndefined();
      expect(mockIap.deepLinkToSubscriptionsIOS).toHaveBeenCalled();
    });

    it('deepLinkToSubscriptions falls back to manage subscriptions when deeplink missing', async () => {
      (Platform as any).OS = 'ios';
      delete mockIap.deepLinkToSubscriptionsIOS;
      mockIap.showManageSubscriptionsIOS = jest.fn(async () => []);
      await expect(IAP.deepLinkToSubscriptions()).resolves.toBeUndefined();
      expect(mockIap.showManageSubscriptionsIOS).toHaveBeenCalled();
    });

    it('deepLinkToSubscriptions surfaces iOS native failures', async () => {
      (Platform as any).OS = 'ios';
      mockIap.deepLinkToSubscriptionsIOS = jest.fn(async () => {
        throw new Error('scene missing');
      });
      await expect(IAP.deepLinkToSubscriptions()).rejects.toThrow(
        'scene missing',
      );
    });

    it('deepLinkToSubscriptions throws on unsupported platform', async () => {
      (Platform as any).OS = 'web';
      await expect(IAP.deepLinkToSubscriptions()).rejects.toThrow(
        'Unsupported platform: web',
      );
    });

    it('openRedeemOfferCode resolves the synchronously reported purchase on iOS', async () => {
      (Platform as any).OS = 'ios';
      mockIap.presentCodeRedemptionSheetIOS.mockResolvedValueOnce({
        id: 'redeemed-transaction',
        transactionId: 'redeemed-transaction',
        productId: 'premium',
        transactionDate: 1700000000000,
        store: 'apple',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: true,
      });
      await expect(IAP.openRedeemOfferCode()).resolves.toMatchObject({
        id: 'redeemed-transaction',
        productId: 'premium',
        store: 'apple',
      });
      expect(mockIap.presentCodeRedemptionSheetIOS).toHaveBeenCalledTimes(1);
    });

    it('openRedeemOfferCode resolves null when the iOS sheet reports nothing', async () => {
      (Platform as any).OS = 'ios';
      mockIap.presentCodeRedemptionSheetIOS.mockResolvedValueOnce(null);
      await expect(IAP.openRedeemOfferCode()).resolves.toBeNull();
    });

    it('openRedeemOfferCode launches the Play redeem page and resolves null on Android', async () => {
      (Platform as any).OS = 'android';
      mockIap.openRedeemOfferCodeAndroid.mockResolvedValueOnce(true);
      await expect(IAP.openRedeemOfferCode()).resolves.toBeNull();
      expect(mockIap.openRedeemOfferCodeAndroid).toHaveBeenCalledTimes(1);

      mockIap.openRedeemOfferCodeAndroid.mockResolvedValueOnce(false);
      await expect(IAP.openRedeemOfferCode()).resolves.toBeNull();
    });

    it('openRedeemOfferCode resolves null on Vega without launching anything', async () => {
      jest.resetModules();
      jest.doMock('react-native', () => ({
        Platform: {OS: 'kepler'},
      }));
      jest.doMock('react-native-nitro-modules', () => ({
        NitroModules: {
          createHybridObject: jest.fn(() => mockIap),
        },
      }));
      jest.doMock('../vega', () => ({
        getVegaIapModule: jest.fn(() => mockIap),
        isVegaOS: jest.fn(() => true),
      }));
      IAP = require('../index');

      await expect(IAP.openRedeemOfferCode()).resolves.toBeNull();
      expect(mockIap.openRedeemOfferCodeAndroid).not.toHaveBeenCalled();
      expect(mockIap.presentCodeRedemptionSheetIOS).not.toHaveBeenCalled();
    });

    it('openRedeemOfferCode throws on unsupported platform', async () => {
      (Platform as any).OS = 'web';
      await expect(IAP.openRedeemOfferCode()).rejects.toThrow(
        'Unsupported platform: web',
      );
    });
  });

  describe('subscription helpers', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      // Mock getActiveSubscriptions for iOS - returns empty array by default
      mockIap.getActiveSubscriptions = jest.fn(async () => []);
      // Ensure getAvailablePurchases returns empty array by default
      mockIap.getAvailablePurchases = jest.fn(async () => []);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe('getActiveSubscriptions', () => {
      it('iOS: should call native getActiveSubscriptions and map results', async () => {
        (Platform as any).OS = 'ios';

        const mockActiveSubscriptions = [
          {
            productId: 'subscription1',
            isActive: true,
            transactionId: 'trans1',
            purchaseToken: 'token1',
            transactionDate: Date.now(),
            expirationDateIOS: Date.now() + 86400000,
            environmentIOS: 'Production',
            renewalInfoIOS: {
              willAutoRenew: true,
              autoRenewPreference: 'subscription1',
              commitmentInfo: {
                commitmentAutoRenewProductId: 'subscription1',
                commitmentAutoRenewStatus: true,
                commitmentRenewalBillingPlanType: 'monthly',
                commitmentRenewalDate: Date.now() + 86400000,
                commitmentRenewalPrice: 9.99,
              },
              pendingUpgradeProductId: 'subscription2',
              expirationReason: null,
              isInBillingRetry: false,
              gracePeriodExpirationDate: null,
              priceIncreaseStatus: null,
              renewalBillingPlanType: 'monthly',
              renewalOfferType: 'promotional',
              renewalOfferId: 'summer-offer',
              jsonRepresentation: '{"source":"storekit"}',
              renewalDate: Date.now() + 86400000,
            },
          },
        ];

        mockIap.getActiveSubscriptions.mockResolvedValueOnce(
          mockActiveSubscriptions,
        );

        const result = await IAP.getActiveSubscriptions();

        expect(mockIap.getActiveSubscriptions).toHaveBeenCalledWith(undefined);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          expect.objectContaining({
            productId: 'subscription1',
            isActive: true,
            renewalInfoIOS: expect.objectContaining({
              willAutoRenew: true,
              commitmentInfo: expect.objectContaining({
                commitmentAutoRenewProductId: 'subscription1',
              }),
              pendingUpgradeProductId: 'subscription2',
              renewalBillingPlanType: 'monthly',
              renewalOfferType: 'promotional',
              renewalOfferId: 'summer-offer',
              jsonRepresentation: '{"source":"storekit"}',
            }),
          }),
        );
      });

      it('iOS: should pass subscription IDs to native method', async () => {
        (Platform as any).OS = 'ios';

        mockIap.getActiveSubscriptions.mockResolvedValueOnce([]);

        await IAP.getActiveSubscriptions(['sub1', 'sub2']);

        expect(mockIap.getActiveSubscriptions).toHaveBeenCalledWith([
          'sub1',
          'sub2',
        ]);
      });

      it('Android: should call native getActiveSubscriptions with Android fields', async () => {
        (Platform as any).OS = 'android';

        const mockActiveSubscriptions = [
          {
            productId: 'subscription1',
            isActive: true,
            transactionId: 'trans1',
            purchaseToken: 'token1',
            transactionDate: Date.now(),
            autoRenewingAndroid: true,
            basePlanIdAndroid: 'monthly-base',
            currentPlanId: 'monthly-base',
            purchaseTokenAndroid: 'token1',
          },
        ];

        mockIap.getActiveSubscriptions.mockResolvedValueOnce(
          mockActiveSubscriptions,
        );

        const result = await IAP.getActiveSubscriptions();

        expect(mockIap.getActiveSubscriptions).toHaveBeenCalledWith(undefined);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          expect.objectContaining({
            productId: 'subscription1',
            isActive: true,
            autoRenewingAndroid: true,
            basePlanIdAndroid: 'monthly-base',
          }),
        );
      });

      it('should pass subscription IDs for filtering', async () => {
        const mockActiveSubscriptions = [
          {
            productId: 'sub1',
            isActive: true,
            transactionId: 'trans1',
            purchaseToken: 'token1',
            transactionDate: Date.now(),
          },
        ];

        mockIap.getActiveSubscriptions.mockResolvedValueOnce(
          mockActiveSubscriptions,
        );

        const result = await IAP.getActiveSubscriptions(['sub1', 'sub2']);

        expect(mockIap.getActiveSubscriptions).toHaveBeenCalledWith([
          'sub1',
          'sub2',
        ]);
        expect(result).toHaveLength(1);
        expect(result[0]?.productId).toBe('sub1');
      });

      it('should return empty array when no subscriptions available', async () => {
        (Platform as any).OS = 'ios';
        mockIap.getActiveSubscriptions.mockResolvedValueOnce([]);

        const result = await IAP.getActiveSubscriptions();

        expect(result).toEqual([]);
      });

      it('should handle errors and rethrow them', async () => {
        (Platform as any).OS = 'ios';
        const error = new Error('Failed to fetch');
        mockIap.getActiveSubscriptions.mockRejectedValueOnce(error);

        await expect(IAP.getActiveSubscriptions()).rejects.toThrow(
          'Failed to fetch',
        );
      });
    });

    describe('hasActiveSubscriptions', () => {
      it('should return true when there are active subscriptions', async () => {
        (Platform as any).OS = 'ios';
        mockIap.getActiveSubscriptions.mockResolvedValueOnce([
          {productId: 'sub1', isActive: true},
        ]);

        const result = await IAP.hasActiveSubscriptions();

        expect(result).toBe(true);
      });

      it('should return false when there are no active subscriptions', async () => {
        (Platform as any).OS = 'ios';
        mockIap.getActiveSubscriptions.mockResolvedValueOnce([]);

        const result = await IAP.hasActiveSubscriptions();

        expect(result).toBe(false);
      });

      it('should return false on error', async () => {
        (Platform as any).OS = 'ios';
        const error = new Error('Failed to fetch');
        mockIap.getActiveSubscriptions.mockRejectedValueOnce(error);

        const result = await IAP.hasActiveSubscriptions();

        expect(result).toBe(false);
      });
    });
  });

  describe('verifyPurchaseWithProvider', () => {
    beforeEach(() => {
      mockIap.verifyPurchaseWithProvider = jest.fn();
    });

    it('should call native verifyPurchaseWithProvider with correct params', async () => {
      (Platform as any).OS = 'ios';
      const mockResult = {
        provider: 'iapkit',
        iapkit: {
          clientPayload: {
            format: 'toml',
            body: 'tier = "gold"',
            version: 2,
            updatedAt: 1720000000000,
          },
          isValid: true,
          productId: 'premium.monthly',
          state: 'entitled',
          store: 'apple',
        },
      };
      mockIap.verifyPurchaseWithProvider.mockResolvedValueOnce(mockResult);

      const result = await IAP.verifyPurchaseWithProvider({
        provider: 'iapkit',
        iapkit: {
          apiKey: 'test-api-key',
          baseUrl: 'http://127.0.0.1:4174',
          includeClientPayload: true,
          environment: 'sandbox',
          apple: {
            jws: 'test-jws-token',
          },
        },
      });

      expect(mockIap.verifyPurchaseWithProvider).toHaveBeenCalledWith({
        provider: 'iapkit',
        iapkit: {
          apiKey: 'test-api-key',
          baseUrl: 'http://127.0.0.1:4174',
          includeClientPayload: true,
          environment: 'sandbox',
          apple: {
            jws: 'test-jws-token',
          },
        },
      });
      expect(result.provider).toBe('iapkit');
      expect(result.iapkit?.isValid).toBe(true);
      expect(result.iapkit?.productId).toBe('premium.monthly');
      expect(result.iapkit?.clientPayload?.body).toBe('tier = "gold"');
      expect(result.iapkit?.state).toBe('entitled');
      expect(result.iapkit?.store).toBe('apple');
    });

    it('should handle Android verification', async () => {
      (Platform as any).OS = 'android';
      const mockResult = {
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          state: 'entitled',
          store: 'google',
        },
      };
      mockIap.verifyPurchaseWithProvider.mockResolvedValueOnce(mockResult);

      const result = await IAP.verifyPurchaseWithProvider({
        provider: 'iapkit',
        iapkit: {
          apiKey: 'test-api-key',
          google: {
            purchaseToken: 'test-purchase-token',
            packageName: 'com.test.app',
            productId: 'test-product',
          },
        },
      });

      expect(result.iapkit?.store).toBe('google');
    });

    it('should pass Amazon IAPKit payloads through on Android', async () => {
      (Platform as any).OS = 'android';
      const mockResult = {
        provider: 'iapkit',
        iapkit: {
          environment: 'Sandbox',
          isValid: true,
          state: 'ready-to-consume',
          store: 'amazon',
        },
      };
      mockIap.verifyPurchaseWithProvider.mockResolvedValueOnce(mockResult);

      const result = await IAP.verifyPurchaseWithProvider({
        provider: 'iapkit',
        iapkit: {
          apiKey: 'test-api-key',
          amazon: {
            expectedProductId: 'amazon.premium.monthly',
            userId: 'amazon-user',
            receiptId: 'amazon-receipt',
            sandbox: true,
          },
        },
      });

      expect(mockIap.verifyPurchaseWithProvider).toHaveBeenCalledWith({
        provider: 'iapkit',
        iapkit: {
          apiKey: 'test-api-key',
          amazon: {
            expectedProductId: 'amazon.premium.monthly',
            userId: 'amazon-user',
            receiptId: 'amazon-receipt',
            sandbox: true,
          },
        },
      });
      expect(result.iapkit?.environment).toBe('Sandbox');
      expect(result.iapkit?.store).toBe('amazon');
    });

    it('should throw error when provider is not iapkit', async () => {
      (Platform as any).OS = 'ios';
      const mockResult = {
        provider: 'none',
        iapkit: null,
      };
      mockIap.verifyPurchaseWithProvider.mockResolvedValueOnce(mockResult);

      await expect(
        IAP.verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            apiKey: 'test-api-key',
            apple: {jws: 'test-jws'},
          },
        }),
      ).rejects.toThrow(/Unsupported provider/);
    });

    it('should handle verification failure states', async () => {
      (Platform as any).OS = 'ios';
      const mockResult = {
        provider: 'iapkit',
        iapkit: {
          isValid: false,
          state: 'expired',
          store: 'apple',
        },
      };
      mockIap.verifyPurchaseWithProvider.mockResolvedValueOnce(mockResult);

      const result = await IAP.verifyPurchaseWithProvider({
        provider: 'iapkit',
        iapkit: {
          apiKey: 'test-api-key',
          apple: {jws: 'test-jws'},
        },
      });

      expect(result.iapkit?.isValid).toBe(false);
      expect(result.iapkit?.state).toBe('expired');
    });

    it('should handle native errors', async () => {
      (Platform as any).OS = 'ios';
      mockIap.verifyPurchaseWithProvider.mockRejectedValueOnce(
        new Error('Network error'),
      );

      await expect(
        IAP.verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            apiKey: 'test-api-key',
            apple: {jws: 'test-jws'},
          },
        }),
      ).rejects.toThrow();
    });

    it('should handle null iapkit param', async () => {
      (Platform as any).OS = 'ios';
      const mockResult = {
        provider: 'iapkit',
        iapkit: [],
      };
      mockIap.verifyPurchaseWithProvider.mockResolvedValueOnce(mockResult);

      await IAP.verifyPurchaseWithProvider({
        provider: 'iapkit',
      });

      expect(mockIap.verifyPurchaseWithProvider).toHaveBeenCalledWith({
        provider: 'iapkit',
        iapkit: null,
      });
    });

    it('should handle various IAPKit purchase states', async () => {
      (Platform as any).OS = 'ios';
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
        mockIap.verifyPurchaseWithProvider.mockResolvedValueOnce(mockResult);

        const result = await IAP.verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            apiKey: 'key',
            apple: {jws: 'jws'},
          },
        });

        expect(result.iapkit?.state).toBe(state);
      }
    });

    it('should handle inauthentic verification response', async () => {
      (Platform as any).OS = 'ios';
      const mockResult = {
        provider: 'iapkit',
        iapkit: {isValid: false, state: 'inauthentic', store: 'apple'},
      };
      mockIap.verifyPurchaseWithProvider.mockResolvedValueOnce(mockResult);

      const result = await IAP.verifyPurchaseWithProvider({
        provider: 'iapkit',
        iapkit: {
          apiKey: 'key',
          apple: {jws: 'invalid-jws'},
        },
      });

      expect(result.iapkit?.isValid).toBe(false);
      expect(result.iapkit?.state).toBe('inauthentic');
    });

    it('should handle ready-to-consume state for consumables', async () => {
      (Platform as any).OS = 'android';
      const mockResult = {
        provider: 'iapkit',
        iapkit: {isValid: true, state: 'ready-to-consume', store: 'google'},
      };
      mockIap.verifyPurchaseWithProvider.mockResolvedValueOnce(mockResult);

      const result = await IAP.verifyPurchaseWithProvider({
        provider: 'iapkit',
        iapkit: {
          apiKey: 'key',
          google: {
            purchaseToken: 'token',
            packageName: 'com.app',
            productId: 'consumable',
          },
        },
      });

      expect(result.iapkit?.state).toBe('ready-to-consume');
    });

    it('should handle pending-acknowledgment state for subscriptions', async () => {
      (Platform as any).OS = 'android';
      const mockResult = {
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          state: 'pending-acknowledgment',
          store: 'google',
        },
      };
      mockIap.verifyPurchaseWithProvider.mockResolvedValueOnce(mockResult);

      const result = await IAP.verifyPurchaseWithProvider({
        provider: 'iapkit',
        iapkit: {
          apiKey: 'key',
          google: {
            purchaseToken: 'token',
            packageName: 'com.app',
            productId: 'subscription',
          },
        },
      });

      expect(result.iapkit?.state).toBe('pending-acknowledgment');
    });
  });

  describe('developerProvidedBillingListenerAndroid (External Payments 8.3.0+)', () => {
    it('should warn and no-op on non-Android', () => {
      (Platform as any).OS = 'ios';
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const sub = IAP.developerProvidedBillingListenerAndroid(jest.fn());
      expect(typeof sub.remove).toBe('function');
      expect(warn).toHaveBeenCalledWith(
        '[RN-IAP]',
        'developerProvidedBillingListenerAndroid: This listener is only available on Android',
      );
      warn.mockRestore();
    });

    it('should attach listener and forward details on Android', () => {
      (Platform as any).OS = 'android';
      mockIap.addDeveloperProvidedBillingListenerAndroid = jest.fn();
      mockIap.removeDeveloperProvidedBillingListenerAndroid = jest.fn();

      const listener = jest.fn();
      const sub = IAP.developerProvidedBillingListenerAndroid(listener);

      expect(
        mockIap.addDeveloperProvidedBillingListenerAndroid,
      ).toHaveBeenCalled();

      // Simulate native event
      const details = {
        externalTransactionToken: 'external-token-123',
      };
      const wrapped =
        mockIap.addDeveloperProvidedBillingListenerAndroid.mock.calls[0][0];
      wrapped(details);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          externalTransactionToken: 'external-token-123',
        }),
      );

      sub.remove();
      // Singleton pattern: native remove is not called, JS listener is removed from Set
      listener.mockClear();
      wrapped(details);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Billing Programs API (Android 8.2.0+)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('enableBillingProgramAndroid', () => {
      it('should call native method on Android', () => {
        (Platform as any).OS = 'android';
        IAP.enableBillingProgramAndroid('external-offer');
        expect(mockIap.enableBillingProgramAndroid).toHaveBeenCalledWith(
          'external-offer',
        );
      });

      it('should support external-payments program (8.3.0+)', () => {
        (Platform as any).OS = 'android';
        IAP.enableBillingProgramAndroid('external-payments');
        expect(mockIap.enableBillingProgramAndroid).toHaveBeenCalledWith(
          'external-payments',
        );
      });

      it('should support billing-choice program (9.1.0+)', () => {
        (Platform as any).OS = 'android';
        IAP.enableBillingProgramAndroid('billing-choice');
        expect(mockIap.enableBillingProgramAndroid).toHaveBeenCalledWith(
          'billing-choice',
        );
      });

      it('should warn and return early on non-Android', () => {
        (Platform as any).OS = 'ios';
        IAP.enableBillingProgramAndroid('external-offer');
        expect(mockIap.enableBillingProgramAndroid).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith(
          '[RN-IAP]',
          'enableBillingProgramAndroid is only supported on Android',
        );
      });

      it('should handle errors gracefully', () => {
        (Platform as any).OS = 'android';
        mockIap.enableBillingProgramAndroid.mockImplementationOnce(() => {
          throw new Error('Native error');
        });
        // Should not throw, just log error
        expect(() =>
          IAP.enableBillingProgramAndroid('external-offer'),
        ).not.toThrow();
        expect(console.error).toHaveBeenCalled();
      });

      it('should support external-content-link program', () => {
        (Platform as any).OS = 'android';
        IAP.enableBillingProgramAndroid('external-content-link');
        expect(mockIap.enableBillingProgramAndroid).toHaveBeenCalledWith(
          'external-content-link',
        );
      });
    });

    describe('isBillingProgramAvailableAndroid', () => {
      it('should return availability result on Android', async () => {
        (Platform as any).OS = 'android';
        mockIap.isBillingProgramAvailableAndroid.mockResolvedValueOnce({
          billingProgram: 'external-offer',
          isAvailable: true,
        });

        const result =
          await IAP.isBillingProgramAvailableAndroid('external-offer');

        expect(mockIap.isBillingProgramAvailableAndroid).toHaveBeenCalledWith(
          'external-offer',
        );
        expect(result.billingProgram).toBe('external-offer');
        expect(result.isAvailable).toBe(true);
      });

      it('should return false when program not available', async () => {
        (Platform as any).OS = 'android';
        mockIap.isBillingProgramAvailableAndroid.mockResolvedValueOnce({
          billingProgram: 'external-offer',
          isAvailable: false,
        });

        const result =
          await IAP.isBillingProgramAvailableAndroid('external-offer');

        expect(result.isAvailable).toBe(false);
      });

      it('should throw on non-Android', async () => {
        (Platform as any).OS = 'ios';
        await expect(
          IAP.isBillingProgramAvailableAndroid('external-offer'),
        ).rejects.toThrow('Billing Programs API is only supported on Android');
      });

      it('should handle native errors', async () => {
        (Platform as any).OS = 'android';
        mockIap.isBillingProgramAvailableAndroid.mockRejectedValueOnce(
          new Error('Service unavailable'),
        );

        await expect(
          IAP.isBillingProgramAvailableAndroid('external-offer'),
        ).rejects.toThrow('Service unavailable');
      });

      it('should support external-content-link program', async () => {
        (Platform as any).OS = 'android';
        mockIap.isBillingProgramAvailableAndroid.mockResolvedValueOnce({
          billingProgram: 'external-content-link',
          isAvailable: true,
        });

        const result = await IAP.isBillingProgramAvailableAndroid(
          'external-content-link',
        );

        expect(result.billingProgram).toBe('external-content-link');
      });
    });

    describe('getBillingChoiceInfoAndroid', () => {
      it('should request Billing Choice info with defaults on Android', async () => {
        (Platform as any).OS = 'android';
        const result = await IAP.getBillingChoiceInfoAndroid({});

        expect(mockIap.getBillingChoiceInfoAndroid).toHaveBeenCalledWith({
          billingProgram: 'billing-choice',
          playBillingChoiceImageLayout: 'rectangular-four-by-one',
          userLocale: null,
        });
        expect(result.playBillingChoiceImageUrl).toBe(
          'https://play.google.com/billing-choice.png',
        );
      });

      it('should request Billing Choice info with defaults when params are omitted', async () => {
        (Platform as any).OS = 'android';
        const result = await (IAP.getBillingChoiceInfoAndroid as any)();

        expect(mockIap.getBillingChoiceInfoAndroid).toHaveBeenCalledWith({
          billingProgram: 'billing-choice',
          playBillingChoiceImageLayout: 'rectangular-four-by-one',
          userLocale: null,
        });
        expect(result.playBillingChoiceImageUrl).toBe(
          'https://play.google.com/billing-choice.png',
        );
      });

      it('should throw on non-Android', async () => {
        (Platform as any).OS = 'ios';
        await expect(IAP.getBillingChoiceInfoAndroid({})).rejects.toThrow(
          'Billing Choice API is only supported on Android',
        );
      });
    });

    describe('createBillingProgramReportingDetailsAndroid', () => {
      it('should return reporting details with token on Android', async () => {
        (Platform as any).OS = 'android';
        mockIap.createBillingProgramReportingDetailsAndroid.mockResolvedValueOnce(
          {
            billingProgram: 'external-offer',
            externalTransactionToken: 'token-abc-123',
          },
        );

        const result =
          await IAP.createBillingProgramReportingDetailsAndroid(
            'external-offer',
          );

        expect(
          mockIap.createBillingProgramReportingDetailsAndroid,
        ).toHaveBeenCalledWith('external-offer', null);
        expect(result.billingProgram).toBe('external-offer');
        expect(result.externalTransactionToken).toBe('token-abc-123');
      });

      it('should throw on non-Android', async () => {
        (Platform as any).OS = 'ios';
        await expect(
          IAP.createBillingProgramReportingDetailsAndroid('external-offer'),
        ).rejects.toThrow('Billing Programs API is only supported on Android');
        expect(
          mockIap.createBillingProgramReportingDetailsAndroid,
        ).not.toHaveBeenCalled();
      });

      it('should handle native errors', async () => {
        (Platform as any).OS = 'android';
        mockIap.createBillingProgramReportingDetailsAndroid.mockRejectedValueOnce(
          new Error('Token creation failed'),
        );

        await expect(
          IAP.createBillingProgramReportingDetailsAndroid('external-offer'),
        ).rejects.toThrow('Token creation failed');
      });

      it('should support external-content-link program', async () => {
        (Platform as any).OS = 'android';
        mockIap.createBillingProgramReportingDetailsAndroid.mockResolvedValueOnce(
          {
            billingProgram: 'external-content-link',
            externalTransactionToken: 'content-token-456',
          },
        );

        const result = await IAP.createBillingProgramReportingDetailsAndroid(
          'external-content-link',
        );

        expect(result.billingProgram).toBe('external-content-link');
        expect(result.externalTransactionToken).toBe('content-token-456');
      });

      it('should pass developerBillingType for Billing Choice reporting details', async () => {
        (Platform as any).OS = 'android';
        mockIap.createBillingProgramReportingDetailsAndroid.mockResolvedValueOnce(
          {
            billingProgram: 'billing-choice',
            externalTransactionToken: 'choice-token-789',
          },
        );

        const result = await IAP.createBillingProgramReportingDetailsAndroid(
          'billing-choice',
          'external-link',
        );

        expect(
          mockIap.createBillingProgramReportingDetailsAndroid,
        ).toHaveBeenCalledWith('billing-choice', 'external-link');
        expect(result.billingProgram).toBe('billing-choice');
      });
    });

    describe('showBillingProgramInformationDialogAndroid', () => {
      it('should show Billing Choice information dialog with default program', async () => {
        (Platform as any).OS = 'android';
        const result = await IAP.showBillingProgramInformationDialogAndroid({
          externalTransactionToken: 'choice-token-123',
        });

        expect(
          mockIap.showBillingProgramInformationDialogAndroid,
        ).toHaveBeenCalledWith({
          billingProgram: 'billing-choice',
          externalTransactionToken: 'choice-token-123',
        });
        expect(result.responseCode).toBe(0);
        expect(result.subResponseCode).toBe('no-applicable-sub-response-code');
      });

      it('should throw on non-Android', async () => {
        (Platform as any).OS = 'ios';
        await expect(
          IAP.showBillingProgramInformationDialogAndroid({
            externalTransactionToken: 'choice-token-123',
          }),
        ).rejects.toThrow('Billing Choice API is only supported on Android');
        expect(
          mockIap.showBillingProgramInformationDialogAndroid,
        ).not.toHaveBeenCalled();
      });
    });

    describe('showInAppMessagesAndroid', () => {
      it('should delegate to native in-app messages method', async () => {
        (Platform as any).OS = 'android';
        const result = await IAP.showInAppMessagesAndroid({
          categories: ['transactional'],
        });

        expect(mockIap.showInAppMessagesAndroid).toHaveBeenCalledWith({
          categories: ['transactional'],
        });
        expect(result.responseCode).toBe('no-action-needed');
      });

      it('should throw on non-Android', async () => {
        (Platform as any).OS = 'ios';
        await expect(
          IAP.showInAppMessagesAndroid({categories: ['transactional']}),
        ).rejects.toThrow('In-app messages are only supported on Android');
        expect(mockIap.showInAppMessagesAndroid).not.toHaveBeenCalled();
      });
    });

    describe('launchExternalLinkAndroid', () => {
      const defaultParams = {
        billingProgram: 'external-offer' as const,
        launchMode: 'launch-in-external-browser-or-app' as const,
        linkType: 'link-to-digital-content-offer' as const,
        linkUri: 'https://example.com/purchase',
      };

      it('should return true when user accepts on Android', async () => {
        (Platform as any).OS = 'android';
        mockIap.launchExternalLinkAndroid.mockResolvedValueOnce(true);

        const result = await IAP.launchExternalLinkAndroid(defaultParams);

        expect(mockIap.launchExternalLinkAndroid).toHaveBeenCalledWith({
          billingProgram: 'external-offer',
          launchMode: 'launch-in-external-browser-or-app',
          linkType: 'link-to-digital-content-offer',
          linkUri: 'https://example.com/purchase',
        });
        expect(result).toBe(true);
      });

      it('forwards Billing Choice external transaction token', async () => {
        (Platform as any).OS = 'android';
        const params = {
          ...defaultParams,
          billingProgram: 'billing-choice' as const,
          externalTransactionToken: 'external-token',
        };

        await IAP.launchExternalLinkAndroid(params);

        expect(mockIap.launchExternalLinkAndroid).toHaveBeenCalledWith(params);
      });

      it('should return false when user declines', async () => {
        (Platform as any).OS = 'android';
        mockIap.launchExternalLinkAndroid.mockResolvedValueOnce(false);

        const result = await IAP.launchExternalLinkAndroid(defaultParams);

        expect(result).toBe(false);
      });

      it('should throw on non-Android', async () => {
        (Platform as any).OS = 'ios';
        await expect(
          IAP.launchExternalLinkAndroid(defaultParams),
        ).rejects.toThrow('Billing Programs API is only supported on Android');
      });

      it('should handle native errors', async () => {
        (Platform as any).OS = 'android';
        mockIap.launchExternalLinkAndroid.mockRejectedValueOnce(
          new Error('Launch failed'),
        );

        await expect(
          IAP.launchExternalLinkAndroid(defaultParams),
        ).rejects.toThrow('Launch failed');
      });

      it('should support external-content-link program', async () => {
        (Platform as any).OS = 'android';
        mockIap.launchExternalLinkAndroid.mockResolvedValueOnce(true);

        const params = {
          billingProgram: 'external-content-link' as const,
          launchMode: 'launch-in-external-browser-or-app' as const,
          linkType: 'link-to-app-download' as const,
          linkUri: 'https://example.com/download',
        };

        await IAP.launchExternalLinkAndroid(params);

        expect(mockIap.launchExternalLinkAndroid).toHaveBeenCalledWith(params);
      });

      it('should support caller-will-launch-link mode', async () => {
        (Platform as any).OS = 'android';
        mockIap.launchExternalLinkAndroid.mockResolvedValueOnce(true);

        const params = {
          billingProgram: 'external-offer' as const,
          launchMode: 'caller-will-launch-link' as const,
          linkType: 'link-to-digital-content-offer' as const,
          linkUri: 'https://example.com/custom',
        };

        await IAP.launchExternalLinkAndroid(params);

        expect(mockIap.launchExternalLinkAndroid).toHaveBeenCalledWith(params);
      });
    });
  });

  describe('ExternalPurchaseCustomLink APIs (iOS 18.1+)', () => {
    describe('isEligibleForExternalPurchaseCustomLinkIOS', () => {
      it('should return true when eligible on iOS', async () => {
        (Platform as any).OS = 'ios';
        mockIap.isEligibleForExternalPurchaseCustomLinkIOS = jest.fn(
          async () => true,
        );

        const result = await IAP.isEligibleForExternalPurchaseCustomLinkIOS();

        expect(result).toBe(true);
        expect(
          mockIap.isEligibleForExternalPurchaseCustomLinkIOS,
        ).toHaveBeenCalled();
      });

      it('should return false when not eligible on iOS', async () => {
        (Platform as any).OS = 'ios';
        mockIap.isEligibleForExternalPurchaseCustomLinkIOS = jest.fn(
          async () => false,
        );

        const result = await IAP.isEligibleForExternalPurchaseCustomLinkIOS();

        expect(result).toBe(false);
      });

      it('should return false on non-iOS platforms', async () => {
        (Platform as any).OS = 'android';

        const result = await IAP.isEligibleForExternalPurchaseCustomLinkIOS();

        expect(result).toBe(false);
      });

      it('should return false on error', async () => {
        (Platform as any).OS = 'ios';
        mockIap.isEligibleForExternalPurchaseCustomLinkIOS = jest.fn(
          async () => {
            throw new Error('Feature not supported');
          },
        );

        const result = await IAP.isEligibleForExternalPurchaseCustomLinkIOS();

        expect(result).toBe(false);
      });
    });

    describe('getExternalPurchaseCustomLinkTokenIOS', () => {
      it('should return token for acquisition type on iOS', async () => {
        (Platform as any).OS = 'ios';
        const mockResult = {
          token: 'external-purchase-token-123',
          error: null,
        };
        mockIap.getExternalPurchaseCustomLinkTokenIOS = jest.fn(
          async () => mockResult,
        );

        const result =
          await IAP.getExternalPurchaseCustomLinkTokenIOS('acquisition');

        expect(result.token).toBe('external-purchase-token-123');
        expect(result.error).toBeNull();
        expect(
          mockIap.getExternalPurchaseCustomLinkTokenIOS,
        ).toHaveBeenCalledWith('acquisition');
      });

      it('should return token for services type on iOS', async () => {
        (Platform as any).OS = 'ios';
        const mockResult = {
          token: 'services-token-456',
          error: null,
        };
        mockIap.getExternalPurchaseCustomLinkTokenIOS = jest.fn(
          async () => mockResult,
        );

        const result =
          await IAP.getExternalPurchaseCustomLinkTokenIOS('services');

        expect(result.token).toBe('services-token-456');
        expect(
          mockIap.getExternalPurchaseCustomLinkTokenIOS,
        ).toHaveBeenCalledWith('services');
      });

      it('should throw on non-iOS platforms', async () => {
        (Platform as any).OS = 'android';

        await expect(
          IAP.getExternalPurchaseCustomLinkTokenIOS('acquisition'),
        ).rejects.toThrow(
          'External purchase custom link is only supported on iOS 18.1+',
        );
      });

      it('should throw native errors', async () => {
        (Platform as any).OS = 'ios';
        mockIap.getExternalPurchaseCustomLinkTokenIOS = jest.fn(async () => {
          throw new Error('Token generation failed');
        });

        await expect(
          IAP.getExternalPurchaseCustomLinkTokenIOS('acquisition'),
        ).rejects.toThrow('Token generation failed');
      });
    });

    describe('showExternalPurchaseCustomLinkNoticeIOS', () => {
      it('should return continued=true when user agrees on iOS', async () => {
        (Platform as any).OS = 'ios';
        const mockResult = {
          continued: true,
          error: null,
        };
        mockIap.showExternalPurchaseCustomLinkNoticeIOS = jest.fn(
          async () => mockResult,
        );

        const result =
          await IAP.showExternalPurchaseCustomLinkNoticeIOS('browser');

        expect(result.continued).toBe(true);
        expect(result.error).toBeNull();
        expect(
          mockIap.showExternalPurchaseCustomLinkNoticeIOS,
        ).toHaveBeenCalledWith('browser');
      });

      it('should return continued=false when user declines on iOS', async () => {
        (Platform as any).OS = 'ios';
        const mockResult = {
          continued: false,
          error: null,
        };
        mockIap.showExternalPurchaseCustomLinkNoticeIOS = jest.fn(
          async () => mockResult,
        );

        const result =
          await IAP.showExternalPurchaseCustomLinkNoticeIOS('browser');

        expect(result.continued).toBe(false);
      });

      it('should throw on non-iOS platforms', async () => {
        (Platform as any).OS = 'android';

        await expect(
          IAP.showExternalPurchaseCustomLinkNoticeIOS('browser'),
        ).rejects.toThrow(
          'External purchase custom link is only supported on iOS 18.1+',
        );
      });

      it('should throw native errors', async () => {
        (Platform as any).OS = 'ios';
        mockIap.showExternalPurchaseCustomLinkNoticeIOS = jest.fn(async () => {
          throw new Error('Notice display failed');
        });

        await expect(
          IAP.showExternalPurchaseCustomLinkNoticeIOS('browser'),
        ).rejects.toThrow('Notice display failed');
      });

      it('should handle unspecified noticeType gracefully', async () => {
        (Platform as any).OS = 'ios';
        const mockResult = {
          continued: true,
          error: null,
        };
        mockIap.showExternalPurchaseCustomLinkNoticeIOS = jest.fn(
          async () => mockResult,
        );

        // 'unspecified' is a valid TypeScript value due to Nitro constraint workaround
        const result =
          await IAP.showExternalPurchaseCustomLinkNoticeIOS('unspecified');

        expect(result.continued).toBe(true);
        expect(
          mockIap.showExternalPurchaseCustomLinkNoticeIOS,
        ).toHaveBeenCalledWith('unspecified');
      });
    });
  });

  describe('subscriptionBillingIssueListener', () => {
    it('attaches native listener and returns removable subscription', () => {
      const handler = jest.fn();
      const sub = IAP.subscriptionBillingIssueListener(handler);

      expect(mockIap.addSubscriptionBillingIssueListener).toHaveBeenCalled();
      expect(typeof sub.remove).toBe('function');
    });

    it('remove() cleans up the JS-side listener', () => {
      const handler = jest.fn();
      const sub = IAP.subscriptionBillingIssueListener(handler);
      sub.remove();

      // Re-registering should still work after removal
      const handler2 = jest.fn();
      const sub2 = IAP.subscriptionBillingIssueListener(handler2);
      expect(sub2).toBeDefined();
    });

    it('reattaches a pre-init listener after initConnection', async () => {
      mockIap.addSubscriptionBillingIssueListener
        .mockImplementationOnce(() => {
          throw new Error('Nitro runtime not installed');
        })
        .mockImplementation(() => undefined);

      const handler = jest.fn();
      const sub = IAP.subscriptionBillingIssueListener(handler);
      expect(mockIap.addSubscriptionBillingIssueListener).toHaveBeenCalledTimes(
        1,
      );

      await IAP.initConnection();

      expect(mockIap.addSubscriptionBillingIssueListener).toHaveBeenCalledTimes(
        2,
      );
      sub.remove();
    });

    it('cleans up JS listener when native attach throws', () => {
      mockIap.addSubscriptionBillingIssueListener.mockImplementation(() => {
        throw new Error('native failure');
      });

      // Force re-require to reset native-attached state
      jest.resetModules();
      jest.doMock('react-native-nitro-modules', () => ({
        NitroModules: {
          createHybridObject: jest.fn(() => mockIap),
        },
      }));
      const freshIAP = require('../index');

      const handler = jest.fn();
      expect(() => freshIAP.subscriptionBillingIssueListener(handler)).toThrow(
        'native failure',
      );
    });
  });

  describe('native failure normalization', () => {
    const replacedNativeMethods = new Map<string, unknown>();
    const replaceNativeMethod = (name: string, value: unknown) => {
      if (!replacedNativeMethods.has(name)) {
        replacedNativeMethods.set(name, mockIap[name]);
      }
      mockIap[name] = value;
    };

    afterEach(() => {
      for (const [name, value] of replacedNativeMethods) {
        if (value === undefined) delete mockIap[name];
        else mockIap[name] = value;
      }
      replacedNativeMethods.clear();
    });

    const iosFailureCases: {
      name: string;
      nativeMethod: string;
      invoke: () => Promise<unknown>;
    }[] = [
      {
        name: 'get promoted product',
        nativeMethod: 'getPromotedProductIOS',
        invoke: () => IAP.getPromotedProductIOS(),
      },
      {
        name: 'subscription status',
        nativeMethod: 'subscriptionStatusIOS',
        invoke: () => IAP.subscriptionStatusIOS('premium'),
      },
      {
        name: 'current entitlement',
        nativeMethod: 'currentEntitlementIOS',
        invoke: () => IAP.currentEntitlementIOS('premium'),
      },
      {
        name: 'latest transaction',
        nativeMethod: 'latestTransactionIOS',
        invoke: () => IAP.latestTransactionIOS('premium'),
      },
      {
        name: 'pending transactions',
        nativeMethod: 'getPendingTransactionsIOS',
        invoke: () => IAP.getPendingTransactionsIOS(),
      },
      {
        name: 'all transactions',
        nativeMethod: 'getAllTransactionsIOS',
        invoke: () => IAP.getAllTransactionsIOS(),
      },
      {
        name: 'manage subscriptions',
        nativeMethod: 'showManageSubscriptionsIOS',
        invoke: () => IAP.showManageSubscriptionsIOS(),
      },
      {
        name: 'intro offer eligibility',
        nativeMethod: 'isEligibleForIntroOfferIOS',
        invoke: () => IAP.isEligibleForIntroOfferIOS('group'),
      },
      {
        name: 'receipt data',
        nativeMethod: 'getReceiptDataIOS',
        invoke: () => IAP.getReceiptDataIOS(),
      },
      {
        name: 'receipt refresh',
        nativeMethod: 'requestReceiptRefreshIOS',
        invoke: () => IAP.requestReceiptRefreshIOS(),
      },
      {
        name: 'transaction verification',
        nativeMethod: 'isTransactionVerifiedIOS',
        invoke: () => IAP.isTransactionVerifiedIOS('premium'),
      },
      {
        name: 'transaction JWS',
        nativeMethod: 'getTransactionJwsIOS',
        invoke: () => IAP.getTransactionJwsIOS('premium'),
      },
      {
        name: 'StoreKit sync',
        nativeMethod: 'syncIOS',
        invoke: () => IAP.syncIOS(),
      },
      {
        name: 'code redemption sheet',
        nativeMethod: 'presentCodeRedemptionSheetIOS',
        invoke: () => IAP.presentCodeRedemptionSheetIOS(),
      },
      {
        name: 'refund request',
        nativeMethod: 'beginRefundRequestIOS',
        invoke: () => IAP.beginRefundRequestIOS('premium'),
      },
      {
        name: 'iOS subscription deep link',
        nativeMethod: 'deepLinkToSubscriptionsIOS',
        invoke: () => IAP.deepLinkToSubscriptionsIOS(),
      },
    ];

    it.each(iosFailureCases)('normalizes $name failures', async (testCase) => {
      const nativeError = new Error('native failure');
      replaceNativeMethod(
        testCase.nativeMethod,
        jest.fn().mockRejectedValue(nativeError),
      );

      await expect(testCase.invoke()).rejects.toMatchObject({
        message: 'native failure',
      });
    });

    it('normalizes connection lifecycle failures', async () => {
      replaceNativeMethod(
        'initConnection',
        jest.fn().mockRejectedValueOnce(new Error('init failed')),
      );
      await expect(IAP.initConnection()).rejects.toMatchObject({
        message: 'init failed',
      });

      replaceNativeMethod('initConnection', jest.fn().mockResolvedValue(true));
      expect(IAP.isNitroReady()).toBe(true);
      (Platform as any).OS = 'android';
      const staleListener = jest.fn();
      IAP.purchaseUpdatedListener(staleListener);
      replaceNativeMethod(
        'endConnection',
        jest.fn().mockRejectedValueOnce(new Error('end failed')),
      );
      await expect(IAP.endConnection()).rejects.toMatchObject({
        message: 'end failed',
      });

      await IAP.initConnection();
      const currentListener = jest.fn();
      IAP.purchaseUpdatedListener(currentListener);
      expect(mockIap.addPurchaseUpdatedListener).toHaveBeenCalledTimes(2);

      const nativeHandler = mockIap.addPurchaseUpdatedListener.mock.calls[1][0];
      nativeHandler({
        id: 't1',
        transactionId: 't1',
        productId: 'p1',
        transactionDate: Date.now(),
        store: 'google',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      });
      expect(staleListener).not.toHaveBeenCalled();
      expect(currentListener).toHaveBeenCalledTimes(1);
    });

    it.each([
      {
        name: 'Billing Choice info',
        nativeMethod: 'getBillingChoiceInfoAndroid',
        invoke: () => IAP.getBillingChoiceInfoAndroid(),
      },
      {
        name: 'Billing Choice dialog',
        nativeMethod: 'showBillingProgramInformationDialogAndroid',
        invoke: () =>
          IAP.showBillingProgramInformationDialogAndroid({
            externalTransactionToken: 'opaque',
          }),
      },
      {
        name: 'in-app messages',
        nativeMethod: 'showInAppMessagesAndroid',
        invoke: () => IAP.showInAppMessagesAndroid(),
      },
      {
        name: 'external link',
        nativeMethod: 'launchExternalLinkAndroid',
        invoke: () =>
          IAP.launchExternalLinkAndroid({
            billingProgram: 'external-offer',
            launchMode: 'launch-in-external-browser-or-app',
            linkType: 'link-to-digital-content-offer',
            linkUri: 'https://example.test',
          }),
      },
    ])('surfaces Android $name failures', async (testCase) => {
      (Platform as any).OS = 'android';
      const nativeError = new Error('android failure');
      replaceNativeMethod(
        testCase.nativeMethod,
        jest.fn().mockRejectedValue(nativeError),
      );

      await expect(testCase.invoke()).rejects.toBe(nativeError);
    });

    it.each([
      {
        name: 'external notice sheet',
        nativeMethod: 'presentExternalPurchaseNoticeSheetIOS',
        invoke: () => IAP.presentExternalPurchaseNoticeSheetIOS(),
      },
      {
        name: 'external purchase link',
        nativeMethod: 'presentExternalPurchaseLinkIOS',
        invoke: () =>
          IAP.presentExternalPurchaseLinkIOS('https://example.test/purchase'),
      },
    ])('surfaces iOS $name failures', async (testCase) => {
      const nativeError = new Error('external purchase failure');
      replaceNativeMethod(
        testCase.nativeMethod,
        jest.fn().mockRejectedValue(nativeError),
      );

      await expect(testCase.invoke()).rejects.toBe(nativeError);
    });
  });

  describe('listener failure isolation', () => {
    const validPurchase = {
      id: 'transaction',
      transactionId: 'transaction',
      productId: 'premium',
      transactionDate: Date.now(),
      store: 'apple',
      quantity: 1,
      purchaseState: 'purchased',
      isAutoRenewing: false,
    };

    it('isolates throwing purchase update and error listeners', () => {
      IAP.purchaseUpdatedListener(() => {
        throw new Error('consumer update failed');
      });
      mockIap.addPurchaseUpdatedListener.mock.calls[0][0](validPurchase);

      IAP.purchaseErrorListener(() => {
        throw new Error('consumer error failed');
      });
      mockIap.addPurchaseErrorListener.mock.calls[0][0]({
        code: 'network-error',
        message: 'offline',
      });

      expect(console.error).toHaveBeenCalled();
    });

    it('drops invalid native promoted products and isolates callback errors', () => {
      const listener = jest.fn(() => {
        throw new Error('consumer promoted product failed');
      });
      IAP.promotedProductListenerIOS(listener);
      const nativeHandler =
        mockIap.addPromotedProductListenerIOS.mock.calls[0][0];

      nativeHandler({id: null});
      nativeHandler({
        id: 'premium',
        title: 'Premium',
        description: 'Premium access',
        displayName: 'Premium',
        displayPrice: '$1.00',
        currency: 'USD',
        price: 1,
        platform: 'ios',
        type: 'in-app',
      });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('drops malformed billing issue events and isolates callback errors', () => {
      const listener = jest.fn(() => {
        throw new Error('consumer billing issue failed');
      });
      IAP.subscriptionBillingIssueListener(listener);
      const nativeHandler =
        mockIap.addSubscriptionBillingIssueListener.mock.calls[0][0];

      nativeHandler({productId: null});
      nativeHandler(validPurchase);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it.each([
      {
        api: 'purchaseUpdatedListener',
        nativeMethod: 'addPurchaseUpdatedListener',
      },
      {api: 'purchaseErrorListener', nativeMethod: 'addPurchaseErrorListener'},
      {
        api: 'promotedProductListenerIOS',
        nativeMethod: 'addPromotedProductListenerIOS',
      },
    ])('keeps $api inert while Nitro initializes', ({api, nativeMethod}) => {
      mockIap[nativeMethod] = jest.fn(() => {
        throw new Error('Nitro runtime not installed');
      });

      expect(() => IAP[api](jest.fn())).not.toThrow();
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('request payload coverage', () => {
    it('forwards optional Apple purchase fields', async () => {
      await IAP.requestPurchase({
        request: {
          apple: {
            sku: 'premium',
            andDangerouslyFinishTransactionAutomatically: false,
            appAccountToken: '00000000-0000-0000-0000-000000000000',
            quantity: 2,
          },
        },
        type: 'in-app',
      });

      expect(mockIap.requestPurchase).toHaveBeenCalledWith({
        apple: {
          sku: 'premium',
          andDangerouslyFinishTransactionAutomatically: false,
          appAccountToken: '00000000-0000-0000-0000-000000000000',
          quantity: 2,
        },
      });
    });

    it('forwards optional Android purchase fields', async () => {
      (Platform as any).OS = 'android';
      await IAP.requestPurchase({
        request: {
          google: {
            skus: ['coins'],
            obfuscatedAccountId: 'account-alias',
            obfuscatedProfileId: 'profile-alias',
            isOfferPersonalized: false,
            offerToken: 'opaque-offer',
          },
        },
        type: 'in-app',
      });

      expect(mockIap.requestPurchase).toHaveBeenCalledWith({
        google: {
          skus: ['coins'],
          obfuscatedAccountId: 'account-alias',
          obfuscatedProfileId: 'profile-alias',
          isOfferPersonalized: false,
          offerToken: 'opaque-offer',
        },
      });
    });

    it('rejects a missing request and unsupported product type', async () => {
      await expect(
        IAP.requestPurchase({request: undefined, type: 'in-app'}),
      ).rejects.toThrow(/Missing purchase request configuration/);
      await expect(
        IAP.fetchProducts({skus: ['premium'], type: 'legacy'}),
      ).rejects.toThrow(/Unsupported product type/);
    });
  });
});
