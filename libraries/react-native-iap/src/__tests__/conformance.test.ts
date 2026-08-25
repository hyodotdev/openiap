/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * react-native-iap's binding into the OpenIAP conformance suite.
 *
 * The Nitro module is replaced with a deterministic fake store, so the real
 * SDK wrappers in src/index.ts run against controlled store responses. This is
 * what makes purchase, completion, and restoration behaviors testable at all —
 * a real purchase cannot happen in CI.
 *
 * Behavior ids match packages/conformance/src/spec/behaviors.mjs.
 */

// Marks this file as a module. Without it the top-level declarations below
// land in the global scope and collide with the other suites' fixtures.
export {};

type FakeRecord = {
  token: string;
  sku: string;
  type: 'in-app' | 'subs';
  state: 'purchased' | 'pending';
};

const CATALOG: Record<string, 'in-app' | 'subs'> = {
  'dev.hyo.martie.premium': 'subs',
  'dev.hyo.martie.pro': 'subs',
  'dev.hyo.martie.10bulbs': 'in-app',
  'dev.hyo.martie.lifetime': 'in-app',
};

const store = {
  owned: new Map<string, FakeRecord>(),
  unfinished: new Set<string>(),
  forced: new Map<string, string>(),
  sequence: 0,
  verifierAvailable: true,
  reset() {
    this.owned.clear();
    this.unfinished.clear();
    this.forced.clear();
    this.sequence = 0;
    this.verifierAvailable = true;
  },
};

const purchaseUpdatedListeners: ((purchase: unknown) => void)[] = [];
const purchaseErrorListeners: ((error: unknown) => void)[] = [];

function toPurchase(record: FakeRecord) {
  return {
    id: record.token,
    productId: record.sku,
    ids: [record.sku],
    purchaseToken: record.token,
    purchaseState: record.state === 'purchased' ? 'purchased' : 'pending',
    isAutoRenewing: record.type === 'subs' && record.state === 'purchased',
    quantity: 1,
    store: 'google',
    platform: 'android',
    transactionDate: 1_700_000_000_000,
    transactionId: record.token,
    currentPlanId: record.sku,
    packageNameAndroid: 'dev.hyo.martie',
    dataAndroid: '{}',
    isAcknowledgedAndroid: true,
  };
}

const mockIap: Record<string, unknown> = {
  initConnection: jest.fn(async () => true),
  endConnection: jest.fn(async () => true),

  verifyPurchase: jest.fn(async (params: any) => {
    if (!store.verifierAvailable) {
      // Nitro rejects with structured objects; the SDK must preserve the code.
      throw {
        code: 'service-error',
        message: 'verification backend unreachable',
      };
    }
    const record = store.owned.get(params?.google?.purchaseToken ?? '');
    return {
      isValid: record?.state === 'purchased',
      autoRenewing: false,
      betaProduct: false,
      cancelDate: null,
      cancelReason: '',
      deferredDate: null,
      deferredSku: null,
      freeTrialEndDate: 0,
      gracePeriodEndDate: 0,
      parentProductId: '',
      productId: record?.sku ?? '',
      productType: 'inapp',
      purchaseDate: 0,
      quantity: 1,
      receiptId: '',
      renewalDate: 0,
      term: '',
      termSku: '',
      testTransaction: false,
    };
  }),

  fetchProducts: jest.fn(async (skus: string[], nitroType?: string) => {
    const type = !nitroType || nitroType === 'all' ? undefined : nitroType;
    return skus
      .filter((sku) => CATALOG[sku])
      .filter((sku) => (type ? CATALOG[sku] === type : true))
      .map((sku) => ({
        id: sku,
        title: `Product ${sku}`,
        description: `Description ${sku}`,
        displayName: sku,
        currency: 'USD',
        displayPrice: '$0.99',
        price: 0.99,
        type: CATALOG[sku] === 'subs' ? 'subs' : 'in-app',
        platform: 'android',
      }));
  }),

  requestPurchase: jest.fn(async (props: any) => {
    const sku: string =
      props?.request?.google?.skus?.[0] ??
      props?.request?.apple?.sku ??
      props?.google?.skus?.[0] ??
      props?.skus?.[0];

    if (!CATALOG[sku]) {
      const error = {
        code: 'sku-not-found',
        message: 'unknown sku',
        productId: sku,
      };
      purchaseErrorListeners.forEach((listener) => listener(error));
      throw error;
    }

    const forced = store.forced.get(sku);
    store.forced.delete(sku);

    if (forced === 'user-cancelled') {
      const error = {
        code: 'user-cancelled',
        message: 'cancelled',
        productId: sku,
      };
      purchaseErrorListeners.forEach((listener) => listener(error));
      throw error;
    }

    const owned = [...store.owned.values()].some(
      (record) => record.sku === sku && record.state === 'purchased',
    );
    if (owned && CATALOG[sku] === 'in-app') {
      const error = {
        code: 'already-owned',
        message: 'already owned',
        productId: sku,
      };
      purchaseErrorListeners.forEach((listener) => listener(error));
      throw error;
    }

    store.sequence += 1;
    const record: FakeRecord = {
      token: `token-${store.sequence}`,
      sku,
      type: CATALOG[sku],
      state: forced === 'pending' ? 'pending' : 'purchased',
    };
    store.owned.set(record.token, record);
    store.unfinished.add(record.token);
    const purchase = toPurchase(record);
    purchaseUpdatedListeners.forEach((listener) => listener(purchase));
    return purchase;
  }),

  getAvailablePurchases: jest.fn(async (options?: any) => {
    const type = options?.android?.type;
    return [...store.owned.values()]
      .filter((record) => (type ? record.type === type : true))
      .map((record) => toPurchase(record));
  }),

  finishTransaction: jest.fn(async (params: any) => {
    const android = params?.android;
    if (android?.purchaseToken) store.unfinished.delete(android.purchaseToken);
    if (android?.isConsumable) store.owned.delete(android.purchaseToken);
    return true;
  }),

  addPurchaseUpdatedListener: jest.fn(
    (listener: (purchase: unknown) => void) => {
      purchaseUpdatedListeners.push(listener);
    },
  ),
  removePurchaseUpdatedListener: jest.fn(),
  addPurchaseErrorListener: jest.fn((listener: (error: unknown) => void) => {
    purchaseErrorListeners.push(listener);
  }),
  removePurchaseErrorListener: jest.fn(),
  addPromotedProductListenerIOS: jest.fn(),
  removePromotedProductListenerIOS: jest.fn(),
  addSubscriptionBillingIssueListener: jest.fn(),
  removeSubscriptionBillingIssueListener: jest.fn(),
  addUserChoiceBillingListenerAndroid: jest.fn(),
  removeUserChoiceBillingListenerAndroid: jest.fn(),

  getStorefront: jest.fn(async () => 'USA'),
  getActiveSubscriptions: jest.fn(async (subscriptionIds?: string[]) =>
    [...store.owned.values()]
      .filter((record) => record.type === 'subs')
      .filter(
        (record) =>
          !subscriptionIds?.length || subscriptionIds.includes(record.sku),
      )
      .map((record) => ({
        productId: record.sku,
        currentPlanId: record.sku,
        purchaseToken: record.token,
        purchaseTokenAndroid: record.token,
        isActive: record.state === 'purchased',
        transactionDate: 1_700_000_000_000,
        transactionId: record.token,
      })),
  ),
};

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {createHybridObject: jest.fn(() => mockIap)},
}));

jest.mock('react-native', () => ({
  Platform: {OS: 'android', select: (obj: any) => obj.android},
  NativeEventEmitter: jest.fn(() => ({
    addListener: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
}));

const IAP = require('../index');

/** Behavior ids from packages/conformance this suite verifies. */
const COVERED_BEHAVIORS = [
  'products.fetch-returns-requested-skus',
  'products.fetch-normalizes-required-fields',
  'products.fetch-separates-in-app-and-subscription-types',
  'products.fetch-empty-sku-list-is-an-error',
  'purchases.request-emits-purchase-updated-on-success',
  'purchases.request-emits-error-on-user-cancel',
  'purchases.already-owned-surfaces-already-owned-error',
  'purchases.unknown-sku-surfaces-sku-not-found',
  'purchases.pending-purchase-is-not-delivered-as-purchased',
  'completion.finish-removes-transaction-from-pending',
  'completion.finish-is-idempotent',
  'completion.unfinished-purchase-remains-available',
  'restoration.available-purchases-returns-owned-items',
  'restoration.available-purchases-excludes-consumed-items',
  'restoration.available-purchases-is-empty-for-new-user',
  'subscriptions.active-subscription-is-reported-active',
  'subscriptions.groups-keep-independent-identifiers',
  'subscriptions.has-active-agrees-with-get-active',
  'identifiers.purchase-carries-a-concrete-store',
  'identifiers.purchase-token-is-stable-across-reads',
  'verification.result-exposes-uniform-validity',
  'verification.forged-token-is-invalid',
  'verification.infrastructure-error-is-not-a-verdict',
];

const androidRequest = (sku: string) => ({
  request: {google: {skus: [sku]}},
  type: 'in-app' as const,
});

describe('conformance: react-native-iap', () => {
  beforeEach(async () => {
    store.reset();
    purchaseUpdatedListeners.length = 0;
    purchaseErrorListeners.length = 0;
    await IAP.initConnection();
  });

  it('declares distinct, namespaced behavior ids', () => {
    expect(new Set(COVERED_BEHAVIORS).size).toBe(COVERED_BEHAVIORS.length);
    COVERED_BEHAVIORS.forEach((id) => expect(id).toContain('.'));
  });

  // --- products -----------------------------------------------------------

  it('products.fetch-returns-requested-skus', async () => {
    const products = await IAP.fetchProducts({
      skus: ['dev.hyo.martie.10bulbs', 'not-a-real-sku'],
      type: 'in-app',
    });
    expect(products.map((product: any) => product.id)).toEqual([
      'dev.hyo.martie.10bulbs',
    ]);
  });

  it('products.fetch-normalizes-required-fields', async () => {
    const products = await IAP.fetchProducts({
      skus: ['dev.hyo.martie.10bulbs'],
      type: 'in-app',
    });
    const [product] = products;
    expect(product.id).toBeTruthy();
    expect(product.title).toBeTruthy();
    expect(product.currency).toBeTruthy();
    expect(product.displayPrice).toBeTruthy();
  });

  it('products.fetch-separates-in-app-and-subscription-types', async () => {
    const subs = await IAP.fetchProducts({
      skus: ['dev.hyo.martie.premium', 'dev.hyo.martie.10bulbs'],
      type: 'subs',
    });
    expect(subs.map((product: any) => product.id)).toEqual([
      'dev.hyo.martie.premium',
    ]);
  });

  it('products.fetch-empty-sku-list-is-an-error', async () => {
    await expect(
      IAP.fetchProducts({skus: [], type: 'in-app'}),
    ).rejects.toMatchObject({
      code: 'empty-sku-list',
    });
  });

  // --- purchases ----------------------------------------------------------

  it('purchases.request-emits-purchase-updated-on-success', async () => {
    const received: any[] = [];
    IAP.purchaseUpdatedListener((purchase: any) => received.push(purchase));

    await IAP.requestPurchase(androidRequest('dev.hyo.martie.10bulbs'));

    expect(received).toHaveLength(1);
    expect(received[0].productId).toBe('dev.hyo.martie.10bulbs');
  });

  it('purchases.request-emits-error-on-user-cancel', async () => {
    const purchases: any[] = [];
    const errors: any[] = [];
    IAP.purchaseUpdatedListener((purchase: any) => purchases.push(purchase));
    IAP.purchaseErrorListener((error: any) => errors.push(error));
    store.forced.set('dev.hyo.martie.10bulbs', 'user-cancelled');

    await expect(
      IAP.requestPurchase(androidRequest('dev.hyo.martie.10bulbs')),
    ).rejects.toBeDefined();

    expect(errors[0]?.code).toBe('user-cancelled');
    expect(purchases).toHaveLength(0);
  });

  it('purchases.already-owned-surfaces-already-owned-error', async () => {
    await IAP.requestPurchase(androidRequest('dev.hyo.martie.lifetime'));
    await expect(
      IAP.requestPurchase(androidRequest('dev.hyo.martie.lifetime')),
    ).rejects.toMatchObject({code: 'already-owned'});
  });

  it('purchases.pending-purchase-is-not-delivered-as-purchased', async () => {
    store.forced.set('dev.hyo.martie.10bulbs', 'pending');
    const purchase = await IAP.requestPurchase(
      androidRequest('dev.hyo.martie.10bulbs'),
    );
    expect(purchase.purchaseState).not.toBe('purchased');
    expect(purchase.purchaseState).toBe('pending');
  });

  it('purchases.unknown-sku-surfaces-sku-not-found', async () => {
    await expect(
      IAP.requestPurchase(androidRequest('not-a-real-sku')),
    ).rejects.toMatchObject({
      code: 'sku-not-found',
    });
  });

  // --- completion ---------------------------------------------------------

  it('completion.finish-removes-transaction-from-pending', async () => {
    const purchase = await IAP.requestPurchase(
      androidRequest('dev.hyo.martie.10bulbs'),
    );
    expect(store.unfinished.has(purchase.purchaseToken)).toBe(true);

    await IAP.finishTransaction({purchase, isConsumable: true});
    expect(store.unfinished.has(purchase.purchaseToken)).toBe(false);
  });

  it('completion.finish-is-idempotent', async () => {
    const purchase = await IAP.requestPurchase(
      androidRequest('dev.hyo.martie.10bulbs'),
    );
    await IAP.finishTransaction({purchase, isConsumable: true});
    await expect(
      IAP.finishTransaction({purchase, isConsumable: true}),
    ).resolves.not.toThrow();
  });

  it('completion.unfinished-purchase-remains-available', async () => {
    const purchase = await IAP.requestPurchase(
      androidRequest('dev.hyo.martie.lifetime'),
    );
    const available = await IAP.getAvailablePurchases();
    expect(
      available.some(
        (item: any) => item.purchaseToken === purchase.purchaseToken,
      ),
    ).toBe(true);
  });

  // --- restoration --------------------------------------------------------

  it('restoration.available-purchases-returns-owned-items', async () => {
    await IAP.requestPurchase(androidRequest('dev.hyo.martie.lifetime'));
    await IAP.requestPurchase(androidRequest('dev.hyo.martie.premium'));

    const available = await IAP.getAvailablePurchases();
    expect(available.map((item: any) => item.productId).sort()).toEqual([
      'dev.hyo.martie.lifetime',
      'dev.hyo.martie.premium',
    ]);
  });

  it('restoration.available-purchases-excludes-consumed-items', async () => {
    const purchase = await IAP.requestPurchase(
      androidRequest('dev.hyo.martie.10bulbs'),
    );
    await IAP.finishTransaction({purchase, isConsumable: true});

    const available = await IAP.getAvailablePurchases();
    expect(
      available.some(
        (item: any) => item.purchaseToken === purchase.purchaseToken,
      ),
    ).toBe(false);
  });

  it('restoration.available-purchases-is-empty-for-new-user', async () => {
    await expect(IAP.getAvailablePurchases()).resolves.toEqual([]);
  });

  // --- subscriptions ------------------------------------------------------

  it('subscriptions.active-subscription-is-reported-active', async () => {
    await IAP.requestPurchase(androidRequest('dev.hyo.martie.premium'));
    const [subscription] = await IAP.getActiveSubscriptions();
    expect(subscription.isActive).toBe(true);
  });

  it('subscriptions.groups-keep-independent-identifiers', async () => {
    await IAP.requestPurchase(androidRequest('dev.hyo.martie.premium'));
    await IAP.requestPurchase(androidRequest('dev.hyo.martie.pro'));

    const subscriptions = await IAP.getActiveSubscriptions();
    const premium = subscriptions.find(
      (item: any) => item.productId === 'dev.hyo.martie.premium',
    );
    const pro = subscriptions.find(
      (item: any) => item.productId === 'dev.hyo.martie.pro',
    );

    expect(premium.currentPlanId).toBe('dev.hyo.martie.premium');
    expect(pro.currentPlanId).toBe('dev.hyo.martie.pro');
    expect(premium.purchaseToken).not.toBe(pro.purchaseToken);
  });

  it('subscriptions.has-active-agrees-with-get-active', async () => {
    expect(await IAP.hasActiveSubscriptions()).toBe(false);
    await IAP.requestPurchase(androidRequest('dev.hyo.martie.premium'));
    expect(await IAP.hasActiveSubscriptions()).toBe(true);
  });

  // --- identifiers --------------------------------------------------------

  it('identifiers.purchase-carries-a-concrete-store', async () => {
    const purchase = await IAP.requestPurchase(
      androidRequest('dev.hyo.martie.10bulbs'),
    );
    expect(purchase.store).toBeTruthy();
    expect(purchase.store).not.toBe('unknown');
  });

  it('identifiers.purchase-token-is-stable-across-reads', async () => {
    const purchase = await IAP.requestPurchase(
      androidRequest('dev.hyo.martie.lifetime'),
    );
    const first = (await IAP.getAvailablePurchases())[0].purchaseToken;
    const second = (await IAP.getAvailablePurchases())[0].purchaseToken;

    expect(first).toBe(purchase.purchaseToken);
    expect(second).toBe(purchase.purchaseToken);
  });

  // --- verification -------------------------------------------------------

  it('verification.result-exposes-uniform-validity', async () => {
    const purchase = await IAP.requestPurchase(
      androidRequest('dev.hyo.martie.lifetime'),
    );

    const valid = await IAP.verifyPurchase({
      google: {
        sku: 'dev.hyo.martie.lifetime',
        packageName: 'dev.hyo.martie',
        purchaseToken: purchase.purchaseToken,
        accessToken: 'test-access-token',
        isSub: false,
      },
    });

    expect(typeof valid.isValid).toBe('boolean');
    expect(valid.isValid).toBe(true);
  });

  it('verification.forged-token-is-invalid', async () => {
    await IAP.requestPurchase(androidRequest('dev.hyo.martie.lifetime'));

    const result = await IAP.verifyPurchase({
      google: {
        sku: 'dev.hyo.martie.lifetime',
        packageName: 'dev.hyo.martie',
        purchaseToken: 'forged-token-0001',
        accessToken: 'test-access-token',
        isSub: false,
      },
    });

    expect(result.isValid).toBe(false);
  });

  it('verification.infrastructure-error-is-not-a-verdict', async () => {
    const purchase = await IAP.requestPurchase(
      androidRequest('dev.hyo.martie.lifetime'),
    );
    const token = purchase.purchaseToken;

    store.verifierAvailable = false;
    await expect(
      IAP.verifyPurchase({
        google: {
          sku: 'dev.hyo.martie.lifetime',
          packageName: 'dev.hyo.martie',
          purchaseToken: token,
          accessToken: 'test-access-token',
          isSub: false,
        },
      }),
      // The statement requires a ServiceError/NetworkError surface, not just
      // any rejection.
    ).rejects.toMatchObject({
      code: expect.stringMatching(/^(service-error|network-error)$/),
    });
  });
});
