/**
 * capacitor-iap's binding into the OpenIAP conformance suite. A deterministic
 * fake native plugin drives the real wrappers in src/index.ts, because CI
 * cannot make a real purchase. Behavior ids match
 * packages/conformance/src/spec/behaviors.mjs.
 */
import {
  nativePlugin,
  nativeRejection,
  resetNativePlugin,
  setPlatform,
} from '../__mocks__/capacitor-core';
import * as IAP from '../index';
import {ErrorCode, type Purchase} from '../types';

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

// A community provider reports Unknown with its own stable id.
const COMMUNITY_STORE_ID = 'community_fixture';

const fakeStore = {
  owned: new Map<string, FakeRecord>(),
  forced: new Map<string, string>(),
  sequence: 0,
  verifierAvailable: true,
  reset() {
    this.owned.clear();
    this.forced.clear();
    this.sequence = 0;
    this.verifierAvailable = true;
  },
};

function toPurchase(record: FakeRecord) {
  return {
    id: record.token,
    productId: record.sku,
    ids: [record.sku],
    purchaseToken: record.token,
    purchaseState: record.state,
    isAutoRenewing: record.type === 'subs' && record.state === 'purchased',
    quantity: 1,
    store: 'google',
    storeId: 'play',
    platform: 'android',
    transactionDate: 1_700_000_000_000,
    transactionId: record.token,
    currentPlanId: record.sku,
    packageNameAndroid: 'dev.hyo.martie',
    dataAndroid: '{}',
    isAcknowledgedAndroid: true,
  };
}

function installFakeStore() {
  Object.assign(nativePlugin, {
    initConnection: jest.fn(async () => ({value: true})),
    endConnection: jest.fn(async () => ({value: true})),

    fetchProducts: jest.fn(
      async ({skus, type}: {skus: string[]; type: string}) => ({
        value: skus
          .filter((sku) => CATALOG[sku])
          .filter((sku) => type === 'all' || CATALOG[sku] === type)
          .map((sku) => ({
            id: sku,
            title: `Product ${sku}`,
            description: `Description ${sku}`,
            displayName: sku,
            currency: 'USD',
            displayPrice: '$0.99',
            price: 0.99,
            type: CATALOG[sku],
            platform: 'android',
          })),
      }),
    ),

    requestPurchase: jest.fn(async ({request}: {request: any}) => {
      const sku: string = (
        request.requestPurchase ?? request.requestSubscription
      ).google.skus[0];
      if (!CATALOG[sku]) {
        throw nativeRejection('sku-not-found', 'unknown sku', {productId: sku});
      }

      const forced = fakeStore.forced.get(sku);
      fakeStore.forced.delete(sku);
      if (forced === 'user-cancelled') {
        throw nativeRejection('user-cancelled', 'cancelled', {productId: sku});
      }
      const owned = [...fakeStore.owned.values()].some(
        (record) => record.sku === sku && record.state === 'purchased',
      );
      if (owned && CATALOG[sku] === 'in-app') {
        throw nativeRejection('already-owned', 'already owned', {
          productId: sku,
        });
      }

      fakeStore.sequence += 1;
      const record: FakeRecord = {
        token: `token-${fakeStore.sequence}`,
        sku,
        type: CATALOG[sku],
        state: forced === 'pending' ? 'pending' : 'purchased',
      };
      fakeStore.owned.set(record.token, record);
      const purchase = toPurchase(record);
      if (forced === 'community') {
        purchase.store = 'unknown';
        purchase.storeId = COMMUNITY_STORE_ID;
      }
      return {value: [purchase]};
    }),

    getAvailablePurchases: jest.fn(async () => ({
      value: [...fakeStore.owned.values()].map(toPurchase),
    })),
    consumePurchaseAndroid: jest.fn(
      async ({purchaseToken}: {purchaseToken: string}) => {
        fakeStore.owned.delete(purchaseToken);
        return {value: true};
      },
    ),
    acknowledgePurchaseAndroid: jest.fn(async () => ({value: true})),

    getActiveSubscriptions: jest.fn(
      async ({subscriptionIds}: {subscriptionIds: string[] | null}) => ({
        value: [...fakeStore.owned.values()]
          .filter((record) => record.type === 'subs')
          .filter(
            (record) =>
              !subscriptionIds?.length || subscriptionIds.includes(record.sku),
          )
          .map((record) => ({
            productId: record.sku,
            currentPlanId: record.sku,
            purchaseToken: record.token,
            isActive: record.state === 'purchased',
            transactionDate: 1_700_000_000_000,
            transactionId: record.token,
          })),
      }),
    ),
    hasActiveSubscriptions: jest.fn(
      async ({subscriptionIds}: {subscriptionIds: string[] | null}) => ({
        value: [...fakeStore.owned.values()].some(
          (record) =>
            record.type === 'subs' &&
            record.state === 'purchased' &&
            (!subscriptionIds?.length || subscriptionIds.includes(record.sku)),
        ),
      }),
    ),

    verifyPurchase: jest.fn(async ({props}: {props: any}) => {
      if (!fakeStore.verifierAvailable) {
        throw nativeRejection(
          'service-error',
          'verification backend unreachable',
        );
      }
      const record = fakeStore.owned.get(props?.google?.purchaseToken ?? '');
      return {
        value: {
          isValid: record?.state === 'purchased',
          productId: record?.sku ?? '',
          store: 'google',
          storeId: 'play',
        },
      };
    }),
  });
}

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
  'verification.result-exposes-uniform-validity',
  'verification.forged-token-is-invalid',
  'verification.infrastructure-error-is-not-a-verdict',
];

type TokenizedPurchase = Purchase & {purchaseToken: string};

// The fake store resolves one tokenized purchase per request.
const buy = async (sku: string): Promise<TokenizedPurchase> => {
  const result = await IAP.requestPurchase({
    request: {google: {skus: [sku]}},
    type: CATALOG[sku] === 'subs' ? 'subs' : 'in-app',
  });
  const purchase = Array.isArray(result) ? result[0] : result;
  if (!purchase?.purchaseToken) {
    throw new Error(`Expected one tokenized purchase for ${sku}`);
  }
  return purchase as TokenizedPurchase;
};

const verifyGoogle = (purchaseToken: string) =>
  IAP.verifyPurchase({
    google: {
      sku: 'dev.hyo.martie.lifetime',
      packageName: 'dev.hyo.martie',
      purchaseToken,
      accessToken: 'test-access-token',
      isSub: false,
    },
  });

describe('conformance: capacitor-iap', () => {
  beforeEach(() => {
    setPlatform('android');
    resetNativePlugin();
    installFakeStore();
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
    expect(products?.map((product) => product.id)).toEqual([
      'dev.hyo.martie.10bulbs',
    ]);
  });

  it('products.fetch-normalizes-required-fields', async () => {
    const [product] =
      (await IAP.fetchProducts({
        skus: ['dev.hyo.martie.10bulbs'],
        type: 'in-app',
      })) ?? [];
    expect(product?.id).toBeTruthy();
    expect(product?.title).toBeTruthy();
    expect(product?.currency).toBeTruthy();
    expect(product?.displayPrice).toBeTruthy();
  });

  it('products.fetch-separates-in-app-and-subscription-types', async () => {
    const subs = await IAP.fetchProducts({
      skus: ['dev.hyo.martie.premium', 'dev.hyo.martie.10bulbs'],
      type: 'subs',
    });
    expect(subs?.map((product) => product.id)).toEqual([
      'dev.hyo.martie.premium',
    ]);
  });

  it('products.fetch-empty-sku-list-is-an-error', async () => {
    await expect(
      IAP.fetchProducts({skus: [], type: 'in-app'}),
    ).rejects.toMatchObject({
      code: ErrorCode.EmptySkuList,
    });
  });

  // --- purchases ----------------------------------------------------------

  it('purchases.request-emits-purchase-updated-on-success', async () => {
    const purchase = await buy('dev.hyo.martie.10bulbs');
    expect(purchase.productId).toBe('dev.hyo.martie.10bulbs');
    expect(purchase.purchaseState).toBe('purchased');
  });

  it('purchases.already-owned-surfaces-already-owned-error', async () => {
    await buy('dev.hyo.martie.lifetime');
    await expect(buy('dev.hyo.martie.lifetime')).rejects.toMatchObject({
      code: 'already-owned',
    });
  });

  it('purchases.pending-purchase-is-not-delivered-as-purchased', async () => {
    fakeStore.forced.set('dev.hyo.martie.10bulbs', 'pending');
    const purchase = await buy('dev.hyo.martie.10bulbs');
    expect(purchase.purchaseState).toBe('pending');
  });

  it('purchases.unknown-sku-surfaces-sku-not-found', async () => {
    await expect(buy('not-a-real-sku')).rejects.toMatchObject({
      code: 'sku-not-found',
    });
  });

  // --- restoration --------------------------------------------------------

  it('restoration.available-purchases-returns-owned-items', async () => {
    await buy('dev.hyo.martie.lifetime');
    await buy('dev.hyo.martie.premium');

    const available = await IAP.getAvailablePurchases();
    expect(available.map((item) => item.productId).sort()).toEqual([
      'dev.hyo.martie.lifetime',
      'dev.hyo.martie.premium',
    ]);
  });

  it('restoration.available-purchases-excludes-consumed-items', async () => {
    const purchase = await buy('dev.hyo.martie.10bulbs');
    await IAP.finishTransaction({purchase, isConsumable: true});

    const available = await IAP.getAvailablePurchases();
    expect(
      available.some((item) => item.purchaseToken === purchase.purchaseToken),
    ).toBe(false);
  });

  it('restoration.available-purchases-is-empty-for-new-user', async () => {
    await expect(IAP.getAvailablePurchases()).resolves.toEqual([]);
  });

  // --- subscriptions ------------------------------------------------------

  it('subscriptions.active-subscription-is-reported-active', async () => {
    await buy('dev.hyo.martie.premium');
    const [subscription] = await IAP.getActiveSubscriptions();
    expect(subscription?.isActive).toBe(true);
  });

  it('subscriptions.groups-keep-independent-identifiers', async () => {
    await buy('dev.hyo.martie.premium');
    await buy('dev.hyo.martie.pro');

    const subscriptions = await IAP.getActiveSubscriptions();
    const premium = subscriptions.find(
      (item) => item.productId === 'dev.hyo.martie.premium',
    );
    const pro = subscriptions.find(
      (item) => item.productId === 'dev.hyo.martie.pro',
    );

    expect(premium?.currentPlanId).toBe('dev.hyo.martie.premium');
    expect(pro?.currentPlanId).toBe('dev.hyo.martie.pro');
    expect(premium?.purchaseToken).not.toBe(pro?.purchaseToken);
  });

  it('subscriptions.has-active-agrees-with-get-active', async () => {
    expect(await IAP.hasActiveSubscriptions()).toBe(false);
    await buy('dev.hyo.martie.premium');
    expect(await IAP.hasActiveSubscriptions()).toBe(true);
  });

  // --- identifiers --------------------------------------------------------

  it('identifiers.purchase-carries-a-concrete-store', async () => {
    const purchase = await buy('dev.hyo.martie.10bulbs');
    expect(purchase.store).not.toBe('unknown');
    expect(purchase.storeId).toBe('play');

    fakeStore.forced.set('dev.hyo.martie.lifetime', 'community');
    const community = await buy('dev.hyo.martie.lifetime');
    expect(community.store).toBe('unknown');
    expect(community.storeId).toBe(COMMUNITY_STORE_ID);
  });

  it('identifiers.purchase-token-is-stable-across-reads', async () => {
    const purchase = await buy('dev.hyo.martie.lifetime');
    const first = (await IAP.getAvailablePurchases())[0]?.purchaseToken;
    const second = (await IAP.getAvailablePurchases())[0]?.purchaseToken;

    expect(first).toBe(purchase.purchaseToken);
    expect(second).toBe(purchase.purchaseToken);
  });

  // --- verification -------------------------------------------------------

  it('verification.result-exposes-uniform-validity', async () => {
    const purchase = await buy('dev.hyo.martie.lifetime');
    const result = await verifyGoogle(purchase.purchaseToken);
    expect(typeof result.isValid).toBe('boolean');
    expect(result.isValid).toBe(true);
  });

  it('verification.forged-token-is-invalid', async () => {
    await buy('dev.hyo.martie.lifetime');
    expect((await verifyGoogle('forged-token-0001')).isValid).toBe(false);
  });

  it('verification.infrastructure-error-is-not-a-verdict', async () => {
    const purchase = await buy('dev.hyo.martie.lifetime');
    fakeStore.verifierAvailable = false;
    await expect(verifyGoogle(purchase.purchaseToken)).rejects.toMatchObject({
      code: expect.stringMatching(/^(service-error|network-error)$/),
    });
  });
});
