import type {Purchase} from 'react-native-iap';
import {getDefaultVerificationMethod} from '../../src/hooks/useVerificationMethod';
import {
  createIapkitVerificationPayload,
  getSubscriptionProductId,
  getSubscriptionQueryIds,
  matchesVerifiedPendingPurchase,
  getIapkitVerificationError,
  rememberCompletedPurchaseKey,
  resolveIapkitVerificationBaseUrl,
} from '../../src/utils/vegaRuntime';

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
        false,
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
        false,
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
        false,
        'apple',
        'apple',
        'Sandbox',
      ),
    ).not.toBeNull();
  });

  it('uses Amazon receipt verification when purchase store is Amazon', () => {
    const payload = createIapkitVerificationPayload(
      {
        id: 'receipt-1',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'receipt-1',
        store: 'Amazon',
      } as unknown as Purchase,
      'receipt-1',
      'test-api-key',
      true,
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

  it('uses Google verification when purchase store is Google', () => {
    const payload = createIapkitVerificationPayload(
      {
        id: 'token-1',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'token-1',
        store: 'google',
        storeId: 'play',
      } as unknown as Purchase,
      'token-1',
      'test-api-key',
      false,
    );

    expect(payload).toMatchObject({
      apiKey: 'test-api-key',
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
      } as unknown as Purchase,
      'purchase-id-1',
      'test-api-key',
      false,
      'http://localhost:3100',
    );

    expect(payload).toMatchObject({
      apiKey: 'test-api-key',
      baseUrl: 'http://localhost:3100',
      horizon: {sku: 'dev.hyo.martie.premium'},
    });
    expect(payload).not.toHaveProperty('google');
  });

  it('uses Apple verification when purchase store is Apple', () => {
    const payload = createIapkitVerificationPayload(
      {
        id: 'jws-1',
        productId: 'dev.hyo.martie.monthly',
        purchaseToken: 'jws-1',
        store: 'apple',
        storeId: 'apple',
      } as unknown as Purchase,
      'jws-1',
      'test-api-key',
      false,
    );

    expect(payload).toMatchObject({
      apiKey: 'test-api-key',
      apple: {
        jws: 'jws-1',
      },
    });
  });

  it('selects local IAPKit by default only when key and URL are configured', () => {
    expect(
      getDefaultVerificationMethod('test-api-key', 'http://192.168.0.10:3100'),
    ).toBe('iapkit-localhost');
    expect(getDefaultVerificationMethod('test-api-key', '')).toBe('iapkit');
    expect(getDefaultVerificationMethod('', 'http://192.168.0.10:3100')).toBe(
      'ignore',
    );
  });

  it('keeps hosted IAPKit free of a configured local base URL', () => {
    expect(
      resolveIapkitVerificationBaseUrl('iapkit', 'http://192.168.0.10:3100'),
    ).toBeUndefined();
  });

  it('requires an explicit base URL for local IAPKit', () => {
    expect(() =>
      resolveIapkitVerificationBaseUrl('iapkit-localhost', '  '),
    ).toThrow('IAPKIT_BASE_URL not configured for Local (IAPKit) verification');
  });

  it('requires an API key for every IAPKit verification', () => {
    expect(() =>
      createIapkitVerificationPayload(
        {
          id: 'token-1',
          productId: 'dev.hyo.martie.10bulbs',
          purchaseToken: 'token-1',
          store: 'google',
          storeId: 'play',
        } as unknown as Purchase,
        'token-1',
        '  ',
        false,
      ),
    ).toThrow('IAPKIT_API_KEY not configured');
  });

  it('accepts a valid store result for the expected product', () => {
    expect(
      getIapkitVerificationError(
        {
          provider: 'iapkit',
          iapkit: {
            isValid: true,
            productId: 'dev.hyo.martie.10bulbs',
            state: 'entitled',
            store: 'google',
            storeId: 'play',
          },
        },
        'dev.hyo.martie.10bulbs',
        true,
        false,
        'google',
      ),
    ).toBeNull();
  });

  it('rejects an invalid IAPKit state before transaction cleanup', () => {
    expect(
      getIapkitVerificationError(
        {
          provider: 'iapkit',
          iapkit: {
            isValid: false,
            productId: 'dev.hyo.martie.10bulbs',
            state: 'consumed',
            store: 'google',
            storeId: 'play',
          },
        },
        'dev.hyo.martie.10bulbs',
        true,
        false,
        'google',
      ),
    ).toContain('state: consumed');
  });

  it('rejects a valid receipt for a different product', () => {
    expect(
      getIapkitVerificationError(
        {
          provider: 'iapkit',
          iapkit: {
            isValid: true,
            productId: 'dev.hyo.martie.30bulbs',
            state: 'entitled',
            store: 'google',
            storeId: 'play',
          },
        },
        'dev.hyo.martie.10bulbs',
        true,
        false,
        'google',
      ),
    ).toContain(
      'IAPKit verified dev.hyo.martie.30bulbs, expected dev.hyo.martie.10bulbs',
    );
  });

  it('requires an Amazon product ID before fulfillment', () => {
    expect(
      getIapkitVerificationError(
        {
          provider: 'iapkit',
          iapkit: {
            environment: 'Production',
            isValid: true,
            state: 'ready-to-consume',
            store: 'amazon',
            storeId: 'amazon',
          },
        },
        'dev.hyo.martie.10bulbs',
        true,
        false,
        'amazon',
      ),
    ).toBe('IAPKit did not return a product ID for amazon');
  });

  it('requires the configured Amazon environment', () => {
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
        false,
        'amazon',
      ),
    ).toContain('expected Production');
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
        false,
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
          false,
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
        'test-api-key',
        true,
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
        getIapkitVerificationError(result, productId, false, true, 'amazon'),
      ).toBeNull();
      expect(
        getIapkitVerificationError(
          {
            ...result,
            iapkit: {...result.iapkit, productId: 'another.base'},
          },
          productId,
          false,
          true,
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
          true,
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
          true,
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
    const payload = createIapkitVerificationPayload(
      purchase,
      'receipt',
      'test-api-key',
      true,
    );
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
        true,
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
          true,
          purchase.store,
          purchase.storeId,
        ),
      ).not.toBeNull();
    }
    expect(() =>
      createIapkitVerificationPayload(
        {...purchase, storeId: 'other_provider'},
        'receipt',
        'test-api-key',
        true,
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
  it('queries the receipt base once alongside both subscription terms', () => {
    expect(
      getSubscriptionQueryIds([
        'dev.hyo.martie.premium',
        'dev.hyo.martie.premium_year',
      ]),
    ).toEqual([
      'dev.hyo.martie.premium',
      'dev.hyo.martie.premium.base',
      'dev.hyo.martie.premium_year',
    ]);
  });
});
