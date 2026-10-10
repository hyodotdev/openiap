import {
  createIapkitVerificationPayload,
  getSubscriptionProductId,
  getDefaultVerificationMethod,
  matchesVerifiedPendingPurchase,
  getIapkitVerificationError,
  rememberCompletedPurchaseKey,
  resolveIapkitVerificationBaseUrl,
} from '../src/utils/vegaRuntime';
import type {Purchase} from '../../src/types';

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

describe('Vega runtime example helpers', () => {
  it('local Apple verification binds the exact pending transaction and provider', () => {
    const receipt: Purchase = {
      id: 'unfinished-old',
      productId: 'dev.hyo.martie.10bulbs',
      store: 'apple',
      storeId: 'apple',
      purchaseState: 'purchased',
      transactionDate: 1,
      quantity: 1,
      isAutoRenewing: false,
    };
    expect(
      matchesVerifiedPendingPurchase(receipt, [
        {...receipt, id: 'latest-other'},
      ]),
    ).toBe(false);
    expect(
      matchesVerifiedPendingPurchase(receipt, [
        {...receipt, productId: 'another-sku'},
      ]),
    ).toBe(false);
    expect(
      matchesVerifiedPendingPurchase({...receipt, storeId: 'community-apple'}, [
        receipt,
      ]),
    ).toBe(false);
    expect(
      matchesVerifiedPendingPurchase({...receipt, id: ''}, [
        {...receipt, id: ''},
      ]),
    ).toBe(false);
    expect(matchesVerifiedPendingPurchase(receipt, [{...receipt}])).toBe(true);
    for (const extra of [
      {revocationDateIOS: 1},
      {isUpgradedIOS: true},
      {expirationDateIOS: 1},
    ]) {
      expect(
        matchesVerifiedPendingPurchase(receipt, [{...receipt, ...extra}]),
      ).toBe(false);
    }
    expect(
      matchesVerifiedPendingPurchase({...receipt, environmentIOS: 'Sandbox'}, [
        {...receipt, environmentIOS: 'Production'},
      ]),
    ).toBe(false);
    expect(
      matchesVerifiedPendingPurchase({...receipt, environmentIOS: 'Sandbox'}, [
        receipt,
      ]),
    ).toBe(false);
  });

  it('known Apple environments must match server verification', () => {
    const verified = {
      provider: 'iapkit' as const,
      iapkit: {
        isValid: true,
        productId: 'dev.hyo.martie.10bulbs',
        state: 'ready-to-consume' as const,
        store: 'apple' as const,
        storeId: 'apple',
        environment: 'Sandbox',
      },
    };
    expect(
      getIapkitVerificationError(
        verified,
        'dev.hyo.martie.10bulbs',
        true,
        'apple',
        'apple',
        'Sandbox',
      ),
    ).toBeNull();
    expect(
      getIapkitVerificationError(
        verified,
        'dev.hyo.martie.10bulbs',
        true,
        'apple',
        'apple',
        'Production',
      ),
    ).not.toBeNull();
    expect(
      getIapkitVerificationError(
        {...verified, iapkit: {...verified.iapkit, environment: undefined}},
        'dev.hyo.martie.10bulbs',
        true,
        'apple',
        'apple',
        'Sandbox',
      ),
    ).not.toBeNull();
  });

  it('uses configured IAPKit credentials for Amazon purchases', () => {
    const payload = createIapkitVerificationPayload(
      {
        id: 'receipt-1',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'receipt-1',
        store: 'amazon',
        storeId: 'amazon',
      } as Purchase,
      'receipt-1',
      'http://localhost:3100',
    );

    expect(payload).toMatchObject({
      apiKey: 'test-api-key',
      baseUrl: 'http://localhost:3100',
      amazon: {
        expectedProductId: 'dev.hyo.martie.10bulbs',
        receiptId: 'receipt-1',
        sandbox: true,
      },
    });
  });

  it('uses configured IAPKit credentials for non-Amazon purchases', () => {
    const payload = createIapkitVerificationPayload(
      {
        id: 'token-1',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'token-1',
        store: 'google',
        storeId: 'play',
      } as Purchase,
      'token-1',
      'http://localhost:3100',
    );

    expect(payload).toMatchObject({
      apiKey: 'test-api-key',
      baseUrl: 'http://localhost:3100',
      google: {
        purchaseToken: 'token-1',
      },
    });
  });

  it('uses Horizon verification without treating the purchase ID as a user ID', () => {
    const payload = createIapkitVerificationPayload(
      {
        id: 'purchase-id-1',
        productId: 'dev.hyo.martie.premium',
        purchaseToken: 'purchase-id-1',
        store: 'horizon',
        storeId: 'horizon',
      } as Purchase,
      'purchase-id-1',
      'http://localhost:3100',
    );

    expect(payload).toMatchObject({
      apiKey: 'test-api-key',
      baseUrl: 'http://localhost:3100',
      horizon: {sku: 'dev.hyo.martie.premium'},
    });
    expect(payload).not.toHaveProperty('google');
  });

  it('defaults to local IAPKit when a key and local URL are configured', () => {
    expect(getDefaultVerificationMethod()).toBe('iapkit-localhost');
  });

  it('defaults to hosted IAPKit when only an API key is configured', () => {
    expect(getDefaultVerificationMethod('test-api-key', '')).toBe('iapkit');
  });

  it('does not enable verification without an API key', () => {
    expect(getDefaultVerificationMethod('', 'http://localhost:3100')).toBe(
      'ignore',
    );
  });

  it('omits the configured local URL for hosted IAPKit', () => {
    const baseUrl = resolveIapkitVerificationBaseUrl(
      'iapkit',
      'http://localhost:3100',
    );
    const payload = createIapkitVerificationPayload(
      {
        id: 'token-1',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'token-1',
        store: 'google',
        storeId: 'play',
      } as Purchase,
      'token-1',
      baseUrl,
    );

    expect(payload).not.toHaveProperty('baseUrl');
  });

  it('requires an explicit base URL for local IAPKit', () => {
    expect(() =>
      resolveIapkitVerificationBaseUrl('iapkit-localhost', '  '),
    ).toThrow(
      'EXPO_PUBLIC_IAPKIT_BASE_URL not configured for Local (IAPKit) verification',
    );
  });

  it('accepts a valid Amazon Sandbox consumable for the expected product', () => {
    expect(
      getIapkitVerificationError(
        {
          provider: 'iapkit',
          iapkit: {
            environment: 'Sandbox',
            isValid: true,
            productId: 'dev.hyo.martie.10bulbs',
            state: 'ready-to-consume',
            store: 'amazon',
            storeId: 'amazon',
          },
        },
        'dev.hyo.martie.10bulbs',
        true,
        'amazon',
      ),
    ).toBeNull();
  });

  it('rejects Amazon verification without a product ID', () => {
    expect(
      getIapkitVerificationError(
        {
          provider: 'iapkit',
          iapkit: {
            environment: 'Sandbox',
            isValid: true,
            state: 'ready-to-consume',
            store: 'amazon',
            storeId: 'amazon',
          },
        },
        'dev.hyo.martie.10bulbs',
        true,
        'amazon',
      ),
    ).toBe('IAPKit did not return a product ID for amazon');
  });

  it('rejects the wrong Amazon environment', () => {
    expect(
      getIapkitVerificationError(
        {
          provider: 'iapkit',
          iapkit: {
            environment: 'Production',
            isValid: true,
            productId: 'dev.hyo.martie.10bulbs',
            state: 'ready-to-consume',
            store: 'amazon',
            storeId: 'amazon',
          },
        },
        'dev.hyo.martie.10bulbs',
        true,
        'amazon',
      ),
    ).toContain('expected Sandbox');
  });

  it('accepts ready-to-consume only for Google consumables', () => {
    expect(
      getIapkitVerificationError(
        {
          provider: 'iapkit',
          iapkit: {
            isValid: true,
            productId: 'dev.hyo.martie.10bulbs',
            state: 'ready-to-consume',
            store: 'google',
            storeId: 'play',
          },
        },
        'dev.hyo.martie.10bulbs',
        true,
        'google',
      ),
    ).toBeNull();

    expect(
      getIapkitVerificationError(
        {
          provider: 'iapkit',
          iapkit: {
            isValid: true,
            productId: 'dev.hyo.martie.10bulbs',
            state: 'ready-to-consume',
            store: 'google',
            storeId: 'play',
          },
        },
        'dev.hyo.martie.10bulbs',
        false,
        'google',
      ),
    ).toContain('cannot fulfill this non-consumable google purchase');

    for (const state of ['entitled', 'pending-acknowledgment'] as const) {
      expect(
        getIapkitVerificationError(
          {
            provider: 'iapkit',
            iapkit: {
              isValid: true,
              productId: 'dev.hyo.martie.10bulbs',
              state,
              store: 'google',
              storeId: 'play',
            },
          },
          'dev.hyo.martie.10bulbs',
          true,
          'google',
        ),
      ).toBeNull();
    }
  });

  it('keeps the completed purchase cache bounded and refreshes recency', () => {
    const completedKeys = new Set(['oldest', 'middle']);

    rememberCompletedPurchaseKey(completedKeys, 'oldest', 2);
    rememberCompletedPurchaseKey(completedKeys, 'newest', 2);

    expect([...completedKeys]).toEqual(['oldest', 'newest']);
  });

  it.each(['dev.hyo.martie.premium', 'dev.hyo.martie.premium_year'])(
    'verifies Amazon term %s against its catalog base without relaxing other stores',
    (productId) => {
      const payload = createIapkitVerificationPayload(
        {
          id: 'receipt',
          productId,
          store: 'amazon',
          storeId: 'amazon',
        } as Purchase,
        'receipt',
      );
      expect(payload.amazon?.expectedProductId).toBe(
        'dev.hyo.martie.premium.base',
      );
      const result = {
        provider: 'iapkit' as const,
        iapkit: {
          isValid: true,
          productId: 'dev.hyo.martie.premium.base',
          environment: 'Sandbox',
          state: 'entitled' as const,
          store: 'amazon' as const,
          storeId: 'amazon',
        },
      };
      expect(
        getIapkitVerificationError(result, productId, false, 'amazon'),
      ).toBeNull();
      expect(
        getIapkitVerificationError(
          {
            ...result,
            iapkit: {...result.iapkit, productId: 'another.base'},
          },
          productId,
          false,
          'amazon',
        ),
      ).toContain('expected dev.hyo.martie.premium.base');
      expect(
        getIapkitVerificationError(
          {
            ...result,
            iapkit: {...result.iapkit, store: 'google', storeId: 'play'},
          },
          productId,
          false,
          'google',
        ),
      ).toContain('expected ' + productId);
      expect(
        getIapkitVerificationError(
          {
            ...result,
            iapkit: {
              ...result.iapkit,
              store: 'google',
              storeId: 'play',
              productId,
            },
          },
          productId,
          false,
          'google',
        ),
      ).toBeNull();
    },
  );

  it('rejects valid same-SKU verification from a different store', () => {
    expect(
      getIapkitVerificationError(
        {
          provider: 'iapkit',
          iapkit: {
            isValid: true,
            productId: 'dev.hyo.martie.premium',
            state: 'entitled',
            store: 'google',
            storeId: 'play',
          },
        },
        'dev.hyo.martie.premium',
        false,
        'apple',
      ),
    ).toContain('expected apple');
  });

  it('routes only the configured community provider to Amazon RVS and preserves identity', () => {
    const purchase = {
      id: 'receipt',
      productId: 'dev.hyo.martie.premium',
      store: 'unknown',
      storeId: 'amazon_example',
    } as Purchase;
    const payload = createIapkitVerificationPayload(purchase, 'receipt');
    expect(payload.amazon?.expectedProductId).toBe(
      'dev.hyo.martie.premium.base',
    );
    expect(payload).not.toHaveProperty('google');
    const result = {
      provider: 'iapkit' as const,
      iapkit: {
        isValid: true,
        productId: 'dev.hyo.martie.premium.base',
        environment: 'Sandbox',
        state: 'entitled' as const,
        store: 'unknown' as const,
        storeId: 'amazon_example',
      },
    };
    expect(
      getIapkitVerificationError(
        result,
        purchase.productId,
        false,
        purchase.store,
        purchase.storeId,
      ),
    ).toBeNull();
    for (const changed of [
      {storeId: 'other_provider'},
      {store: 'amazon' as const},
      {environment: 'Production'},
      {state: 'pending' as const},
      {productId: 'foreign.base'},
    ]) {
      const rejected = {...result, iapkit: {...result.iapkit, ...changed}};
      expect(
        getIapkitVerificationError(
          rejected,
          purchase.productId,
          false,
          purchase.store,
          purchase.storeId,
        ),
      ).not.toBeNull();
    }
    expect(() =>
      createIapkitVerificationPayload(
        {...purchase, storeId: 'other_provider'},
        'receipt',
      ),
    ).toThrow('No verification adapter');
    expect(purchase.store).toBe('unknown');
    expect(purchase.storeId).toBe('amazon_example');
  });
});

describe('Amazon restored subscription catalog', () => {
  const base = 'dev.hyo.martie.premium.base';
  it.each(['dev.hyo.martie.premium', 'dev.hyo.martie.premium_year'])(
    'resolves the exact %s term while preserving the raw receipt SKU',
    (term) => {
      expect(getSubscriptionProductId(base, term, 'amazon', 'amazon')).toBe(
        term,
      );
      expect(
        getSubscriptionProductId(base, term, 'unknown', 'amazon_example'),
      ).toBe(term);
      expect(
        getSubscriptionProductId(term, 'play-base-plan', 'google', 'play'),
      ).toBe(term);
    },
  );
  it('never guesses a missing term or maps a foreign provider/catalog', () => {
    expect(getSubscriptionProductId(base, null)).toBeUndefined();
    expect(getSubscriptionProductId(base, 'foreign.term')).toBeUndefined();
    expect(
      getSubscriptionProductId('foreign.base', 'dev.hyo.martie.premium'),
    ).toBeUndefined();
    expect(
      getSubscriptionProductId(
        base,
        'dev.hyo.martie.premium',
        'unknown',
        'foreign',
      ),
    ).toBeUndefined();
  });
});
