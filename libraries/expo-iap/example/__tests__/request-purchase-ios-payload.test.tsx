import * as ExpoIap from '../../src';

describe('canonical requestPurchase payload structure', () => {
  it('exports requestPurchase', () => {
    expect(ExpoIap.requestPurchase).toBeDefined();
    expect(typeof ExpoIap.requestPurchase).toBe('function');
  });

  it('accepts canonical Apple and Google in-app requests', () => {
    const request: Parameters<typeof ExpoIap.requestPurchase>[0] = {
      request: {
        apple: {
          sku: 'com.test.product',
          quantity: 2,
          appAccountToken: 'user-123',
          andDangerouslyFinishTransactionAutomatically: false,
          withOffer: {
            identifier: 'offer-id',
            keyIdentifier: 'key-id',
            nonce: 'nonce-value',
            signature: 'signature-value',
            timestamp: 123456789,
          },
        },
        google: {
          skus: ['com.test.product'],
        },
      },
      type: 'in-app',
    };

    expect(request.request.apple?.sku).toBe('com.test.product');
    expect(request.request.google?.skus).toEqual(['com.test.product']);
  });

  it('accepts canonical Apple and Google subscription requests', () => {
    const request: Parameters<typeof ExpoIap.requestPurchase>[0] = {
      request: {
        apple: {
          sku: 'com.test.subscription',
          appAccountToken: 'test-token',
        },
        google: {
          skus: ['com.test.subscription'],
          subscriptionOffers: [
            {sku: 'com.test.subscription', offerToken: 'offer-token'},
          ],
        },
      },
      type: 'subs',
    };

    expect(request.request.apple?.sku).toBe('com.test.subscription');
    expect(request.request.google?.subscriptionOffers).toHaveLength(1);
  });

  it('accepts an Apple-only request', () => {
    const request: Parameters<typeof ExpoIap.requestPurchase>[0] = {
      request: {
        apple: {
          sku: 'com.test.product',
        },
      },
      type: 'in-app',
    };

    expect(request.request.apple?.sku).toBe('com.test.product');
  });
});
