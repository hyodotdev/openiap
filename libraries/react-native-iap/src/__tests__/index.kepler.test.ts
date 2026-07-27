import {
  fetchProducts,
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

  beforeEach(() => {
    jest.clearAllMocks();
    (getVegaIapModule as jest.Mock).mockReturnValue({
      fetchProducts: fetchProductsNative,
      requestPurchase: requestPurchaseNative,
    });
  });

  it('returns false when offer-code redemption is unsupported', async () => {
    await expect(openRedeemOfferCodeAndroid()).resolves.toBe(false);
  });

  it("uses the canonical 'in-app' product type", async () => {
    await fetchProducts({skus: ['coins'], type: 'in-app'});

    expect(fetchProductsNative).toHaveBeenCalledWith(['coins'], 'in-app');
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
});
