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

import {
  createIapkitVerificationPayload,
  getDefaultVerificationMethod,
  getDirectVerificationError,
  getIapkitVerificationError,
  rememberCompletedPurchaseKey,
  resolveIapkitVerificationBaseUrl,
} from '../src/utils/vegaRuntime';
import type {Purchase} from '../../src/types';

describe('Vega runtime example helpers', () => {
  it('uses configured IAPKit credentials for Amazon purchases', () => {
    const payload = createIapkitVerificationPayload(
      {
        id: 'receipt-1',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'receipt-1',
        store: 'amazon',
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
          },
        },
        'dev.hyo.martie.10bulbs',
        true,
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
          },
        },
        'dev.hyo.martie.10bulbs',
        true,
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
          },
        },
        'dev.hyo.martie.10bulbs',
        true,
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
          },
        },
        'dev.hyo.martie.10bulbs',
        true,
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
          },
        },
        'dev.hyo.martie.10bulbs',
        false,
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
            },
          },
          'dev.hyo.martie.10bulbs',
          true,
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

  it('rejects explicit invalid direct-store results', () => {
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
