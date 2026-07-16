import type {Purchase} from 'react-native-iap';
import {getDefaultVerificationMethod} from '../../src/hooks/useVerificationMethod';
import {
  createIapkitVerificationPayload,
  getDirectVerificationError,
  getIapkitVerificationError,
  rememberCompletedPurchaseKey,
  resolveIapkitVerificationBaseUrl,
} from '../../src/utils/vegaRuntime';

describe('Vega runtime example helpers', () => {
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
      'http://localhost:3100',
    );

    expect(payload).toMatchObject({
      apiKey: 'test-api-key',
      baseUrl: 'http://localhost:3100',
      amazon: {
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
      } as unknown as Purchase,
      'token-1',
      'test-api-key',
    );

    expect(payload).toMatchObject({
      apiKey: 'test-api-key',
      google: {
        purchaseToken: 'token-1',
      },
    });
  });

  it('uses Apple verification when purchase store is Apple', () => {
    const payload = createIapkitVerificationPayload(
      {
        id: 'jws-1',
        productId: 'dev.hyo.martie.monthly',
        purchaseToken: 'jws-1',
        store: 'apple',
      } as unknown as Purchase,
      'jws-1',
      'test-api-key',
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
        } as unknown as Purchase,
        'token-1',
        '  ',
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
            state: 'ready-to-consume',
            store: 'google',
          },
        },
        'dev.hyo.martie.10bulbs',
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
          },
        },
        'dev.hyo.martie.10bulbs',
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
            state: 'ready-to-consume',
            store: 'google',
          },
        },
        'dev.hyo.martie.10bulbs',
      ),
    ).toContain(
      'IAPKit verified dev.hyo.martie.30bulbs, expected dev.hyo.martie.10bulbs',
    );
  });

  it('keeps the completed purchase cache bounded and refreshes recency', () => {
    const completedKeys = new Set(['oldest', 'middle']);

    rememberCompletedPurchaseKey(completedKeys, 'oldest', 2);
    rememberCompletedPurchaseKey(completedKeys, 'newest', 2);

    expect([...completedKeys]).toEqual(['oldest', 'newest']);
  });

  it('rejects explicit invalid results from direct store verification', () => {
    expect(
      getDirectVerificationError({
        isValid: false,
        jwsRepresentation: '',
        receiptData: '',
      }),
    ).toContain('invalid receipt');
    expect(getDirectVerificationError({success: false})).toContain(
      'rejected the entitlement',
    );
  });
});
