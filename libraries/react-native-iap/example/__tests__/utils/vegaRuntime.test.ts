import type {Purchase} from 'react-native-iap';
import {createIapkitVerificationPayload} from '../../src/utils/vegaRuntime';

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
});
