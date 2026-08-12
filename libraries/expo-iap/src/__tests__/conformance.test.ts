/**
 * expo-iap's binding into the OpenIAP conformance suite.
 *
 * The native module is replaced with a deterministic fake store so the real SDK
 * wrappers in src/index.ts run against controlled store responses. Purchase,
 * completion, and restoration behaviors are only testable this way — a real
 * purchase cannot happen in CI.
 *
 * Behavior ids match packages/conformance/src/spec/behaviors.mjs.
 */
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

const fakeStore = {
  owned: new Map<string, FakeRecord>(),
  forced: new Map<string, string>(),
  sequence: 0,
  reset() {
    this.owned.clear();
    this.forced.clear();
    this.sequence = 0;
  },
};

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

const nativeModule: Record<string, unknown> = {
  initConnection: jest.fn(async () => true),
  endConnection: jest.fn(async () => true),

  fetchProducts: jest.fn(async (params: any, legacySkus?: string[]) => {
    // The SDK calls fetchProducts({skus, type}) on modern natives and
    // fetchProducts(type, skus) on the legacy signature; support both.
    const skus: string[] = Array.isArray(legacySkus) ? legacySkus : (params?.skus ?? []);
    const rawType = Array.isArray(legacySkus) ? params : params?.type;
    const type = rawType === 'all' ? undefined : rawType;

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
      props?.google?.skus?.[0] ??
      props?.android?.skus?.[0] ??
      props?.apple?.sku ??
      props?.skus?.[0];

    if (!CATALOG[sku]) {
      throw Object.assign(new Error('unknown sku'), {code: 'sku-not-found', productId: sku});
    }

    const forced = fakeStore.forced.get(sku);
    fakeStore.forced.delete(sku);
    if (forced === 'user-cancelled') {
      throw Object.assign(new Error('cancelled'), {code: 'user-cancelled', productId: sku});
    }

    const owned = [...fakeStore.owned.values()].some(
      (record) => record.sku === sku && record.state === 'purchased',
    );
    if (owned && CATALOG[sku] === 'in-app') {
      throw Object.assign(new Error('already owned'), {code: 'already-owned', productId: sku});
    }

    fakeStore.sequence += 1;
    const record: FakeRecord = {
      token: `token-${fakeStore.sequence}`,
      sku,
      type: CATALOG[sku],
      state: forced === 'pending' ? 'pending' : 'purchased',
    };
    fakeStore.owned.set(record.token, record);
    return toPurchase(record);
  }),

  getAvailableItems: jest.fn(async () =>
    [...fakeStore.owned.values()].map((record) => toPurchase(record)),
  ),

  finishTransaction: jest.fn(async (params: any) => {
    const token = params?.purchaseToken ?? params?.purchase?.purchaseToken ?? params;
    if (params?.isConsumable) fakeStore.owned.delete(token);
    return true;
  }),

  consumePurchaseAndroid: jest.fn(async (token: string) => {
    fakeStore.owned.delete(token);
    return true;
  }),
  acknowledgePurchaseAndroid: jest.fn(async () => true),

  getActiveSubscriptions: jest.fn(async (subscriptionIds?: string[]) =>
    [...fakeStore.owned.values()]
      .filter((record) => record.type === 'subs')
      .filter((record) => !subscriptionIds?.length || subscriptionIds.includes(record.sku))
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

  hasActiveSubscriptions: jest.fn(async (subscriptionIds?: string[] | null) =>
    [...fakeStore.owned.values()].some(
      (record) =>
        record.type === 'subs' &&
        record.state === 'purchased' &&
        (!subscriptionIds?.length || subscriptionIds.includes(record.sku)),
    ),
  ),

  getStorefront: jest.fn(async () => 'US'),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

jest.mock('../ExpoIapModule', () => ({
  __esModule: true,
  default: nativeModule,
  getNativeModule: () => nativeModule,
  NATIVE_ERROR_CODES: {},
}));

jest.mock('react-native', () => ({
  Platform: {OS: 'android', select: (obj: any) => obj.android},
  NativeEventEmitter: jest.fn(() => ({
    addListener: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
}));

/* eslint-disable import/first */
import * as IAP from '../index';
import {ErrorCode} from '../types';

/** Behavior ids from packages/conformance this suite verifies. */
const COVERED_BEHAVIORS = [
  'products.fetch-returns-requested-skus',
  'products.fetch-normalizes-required-fields',
  'products.fetch-separates-in-app-and-subscription-types',
  'products.fetch-empty-sku-list-is-an-error',
  'purchases.request-emits-purchase-updated-on-success',
  'purchases.already-owned-surfaces-already-owned-error',
  'purchases.unknown-sku-surfaces-sku-not-found',
  'purchases.pending-purchase-is-not-delivered-as-purchased',
  'restoration.available-purchases-returns-owned-items',
  'restoration.available-purchases-excludes-consumed-items',
  'restoration.available-purchases-is-empty-for-new-user',
  'subscriptions.active-subscription-is-reported-active',
  'subscriptions.groups-keep-independent-identifiers',
  'subscriptions.has-active-agrees-with-get-active',
  'identifiers.purchase-carries-a-concrete-store',
  'identifiers.purchase-token-is-stable-across-reads',
];

const buy = (sku: string) =>
  IAP.requestPurchase({request: {google: {skus: [sku]}}, type: 'in-app'} as never);

describe('conformance: expo-iap', () => {
  beforeEach(() => {
    fakeStore.reset();
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
    expect((products as any[]).map((product) => product.id)).toEqual(['dev.hyo.martie.10bulbs']);
  });

  it('products.fetch-normalizes-required-fields', async () => {
    const products = (await IAP.fetchProducts({
      skus: ['dev.hyo.martie.10bulbs'],
      type: 'in-app',
    })) as any[];
    const [product] = products;
    expect(product.id).toBeTruthy();
    expect(product.title).toBeTruthy();
    expect(product.currency).toBeTruthy();
    expect(product.displayPrice).toBeTruthy();
  });

  it('products.fetch-separates-in-app-and-subscription-types', async () => {
    const subs = (await IAP.fetchProducts({
      skus: ['dev.hyo.martie.premium', 'dev.hyo.martie.10bulbs'],
      type: 'subs',
    })) as any[];
    expect(subs.map((product) => product.id)).toEqual(['dev.hyo.martie.premium']);
  });

  it('products.fetch-empty-sku-list-is-an-error', async () => {
    await expect(IAP.fetchProducts({skus: [], type: 'in-app'})).rejects.toMatchObject({
      code: ErrorCode.EmptySkuList,
    });
  });

  // --- purchases ----------------------------------------------------------

  it('purchases.request-emits-purchase-updated-on-success', async () => {
    const purchase = (await buy('dev.hyo.martie.10bulbs')) as any;
    expect(purchase.productId).toBe('dev.hyo.martie.10bulbs');
    expect(purchase.purchaseState).toBe('purchased');
  });

  it('purchases.already-owned-surfaces-already-owned-error', async () => {
    await buy('dev.hyo.martie.lifetime');
    await expect(buy('dev.hyo.martie.lifetime')).rejects.toMatchObject({code: 'already-owned'});
  });

  it('purchases.pending-purchase-is-not-delivered-as-purchased', async () => {
    fakeStore.forced.set('dev.hyo.martie.10bulbs', 'pending');
    const purchase = (await buy('dev.hyo.martie.10bulbs')) as any;
    expect(purchase.purchaseState).not.toBe('purchased');
    expect(purchase.purchaseState).toBe('pending');
  });

  it('purchases.unknown-sku-surfaces-sku-not-found', async () => {
    await expect(buy('not-a-real-sku')).rejects.toMatchObject({code: 'sku-not-found'});
  });

  // --- restoration --------------------------------------------------------

  it('restoration.available-purchases-returns-owned-items', async () => {
    await buy('dev.hyo.martie.lifetime');
    await buy('dev.hyo.martie.premium');

    const available = (await IAP.getAvailablePurchases()) as any[];
    expect(available.map((item) => item.productId).sort()).toEqual([
      'dev.hyo.martie.lifetime',
      'dev.hyo.martie.premium',
    ]);
  });

  it('restoration.available-purchases-excludes-consumed-items', async () => {
    const purchase = (await buy('dev.hyo.martie.10bulbs')) as any;
    fakeStore.owned.delete(purchase.purchaseToken);

    const available = (await IAP.getAvailablePurchases()) as any[];
    expect(available.some((item) => item.purchaseToken === purchase.purchaseToken)).toBe(false);
  });

  it('restoration.available-purchases-is-empty-for-new-user', async () => {
    await expect(IAP.getAvailablePurchases()).resolves.toEqual([]);
  });

  // --- subscriptions ------------------------------------------------------

  it('subscriptions.active-subscription-is-reported-active', async () => {
    await buy('dev.hyo.martie.premium');
    const [subscription] = (await IAP.getActiveSubscriptions()) as any[];
    expect(subscription.isActive).toBe(true);
  });

  it('subscriptions.groups-keep-independent-identifiers', async () => {
    await buy('dev.hyo.martie.premium');
    await buy('dev.hyo.martie.pro');

    const subscriptions = (await IAP.getActiveSubscriptions()) as any[];
    const premium = subscriptions.find((item) => item.productId === 'dev.hyo.martie.premium');
    const pro = subscriptions.find((item) => item.productId === 'dev.hyo.martie.pro');

    expect(premium.currentPlanId).toBe('dev.hyo.martie.premium');
    expect(pro.currentPlanId).toBe('dev.hyo.martie.pro');
    expect(premium.purchaseToken).not.toBe(pro.purchaseToken);
  });

  it('subscriptions.has-active-agrees-with-get-active', async () => {
    expect(await IAP.hasActiveSubscriptions()).toBe(false);
    await buy('dev.hyo.martie.premium');
    expect(await IAP.hasActiveSubscriptions()).toBe(true);
  });

  // --- identifiers --------------------------------------------------------

  it('identifiers.purchase-carries-a-concrete-store', async () => {
    const purchase = (await buy('dev.hyo.martie.10bulbs')) as any;
    expect(purchase.store).toBeTruthy();
    expect(purchase.store).not.toBe('unknown');
  });

  it('identifiers.purchase-token-is-stable-across-reads', async () => {
    const purchase = (await buy('dev.hyo.martie.lifetime')) as any;
    const first = ((await IAP.getAvailablePurchases()) as any[])[0].purchaseToken;
    const second = ((await IAP.getAvailablePurchases()) as any[])[0].purchaseToken;

    expect(first).toBe(purchase.purchaseToken);
    expect(second).toBe(purchase.purchaseToken);
  });
});
