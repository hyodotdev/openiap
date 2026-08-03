import {
  fetchProducts,
  getAvailablePurchases,
  openRedeemOfferCodeAndroid,
  requestPurchase,
} from '../index.kepler';
import type {RequestPurchaseProps} from '../types';
import {getVegaIapModule} from '../vega';

jest.mock('../hooks/useIAP', () => ({useIAP: jest.fn()}));
jest.mock('../vega', () => ({
  getVegaIapModule: jest.fn(),
}));

describe('Amazon Vega public API', () => {
  const fetchProductsNative = jest.fn().mockResolvedValue([]);
  const requestPurchaseNative = jest.fn().mockResolvedValue([]);
  const getAvailablePurchasesNative = jest.fn().mockResolvedValue([]);

  beforeEach(() => {
    jest.clearAllMocks();
    (getVegaIapModule as jest.Mock).mockReturnValue({
      fetchProducts: fetchProductsNative,
      requestPurchase: requestPurchaseNative,
      getAvailablePurchases: getAvailablePurchasesNative,
    });
  });

  it('returns false when offer-code redemption is unsupported', async () => {
    await expect(openRedeemOfferCodeAndroid()).resolves.toBe(false);
  });

  it("uses the canonical 'in-app' product type", async () => {
    await fetchProducts({skus: ['coins'], type: 'in-app'});

    expect(fetchProductsNative).toHaveBeenCalledWith(['coins'], 'in-app');
  });

  it('rejects removed product type aliases', async () => {
    await expect(
      fetchProducts({skus: ['coins'], type: 'inapp' as any}),
    ).rejects.toThrow(/Unsupported product type/);
    expect(fetchProductsNative).not.toHaveBeenCalled();
  });

  it('forwards the canonical google purchase request', async () => {
    const request: RequestPurchaseProps = {
      request: {google: {skus: ['coins']}},
      type: 'in-app',
    };

    await requestPurchase(request);

    expect(requestPurchaseNative).toHaveBeenLastCalledWith({
      google: {skus: ['coins']},
    });
  });

  it('rejects a malformed purchase result instead of returning partial success', async () => {
    requestPurchaseNative.mockResolvedValueOnce([
      {
        id: 'valid',
        productId: 'coins',
        transactionDate: Date.now(),
        store: 'amazon',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      },
      {id: 'malformed'},
    ]);
    const request: RequestPurchaseProps = {
      request: {google: {skus: ['coins']}},
      type: 'in-app',
    };

    await expect(requestPurchase(request)).rejects.toMatchObject({
      code: 'billing-response-json-parse-error',
    });
  });

  it('rejects a mixed malformed available-purchase list', async () => {
    getAvailablePurchasesNative.mockResolvedValueOnce([
      {
        id: 'valid',
        productId: 'premium',
        transactionDate: Date.now(),
        store: 'amazon',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      },
      {id: 'malformed'},
    ]);

    await expect(getAvailablePurchases()).rejects.toMatchObject({
      code: 'billing-response-json-parse-error',
    });
  });

  it('rejects an Apple purchase returned by the Vega bridge', async () => {
    getAvailablePurchasesNative.mockResolvedValueOnce([
      {
        id: 'foreign',
        transactionId: 'foreign',
        productId: 'premium',
        transactionDate: Date.now(),
        store: 'apple',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      },
    ]);

    await expect(getAvailablePurchases()).rejects.toMatchObject({
      code: 'billing-response-json-parse-error',
    });
  });
});
