jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        iapkitApiKey: 'test-api-key',
        iapkitBaseUrl: 'http://localhost:3100',
      },
    },
  },
}));

import {
  createIapkitVerificationPayload,
  getDefaultVerificationMethod,
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

  it('uses configured IAPKit credentials for non-Amazon purchases', () => {
    const payload = createIapkitVerificationPayload(
      {
        id: 'token-1',
        productId: 'dev.hyo.martie.10bulbs',
        purchaseToken: 'token-1',
        store: 'google',
      } as Purchase,
      'token-1',
    );

    expect(payload).toMatchObject({
      apiKey: 'test-api-key',
      baseUrl: 'http://localhost:3100',
      google: {
        purchaseToken: 'token-1',
      },
    });
  });

  it('defaults to IAPKit verification when an API key is configured', () => {
    expect(getDefaultVerificationMethod()).toBe('iapkit');
  });
});
