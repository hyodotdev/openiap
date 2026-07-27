import {
  fetchProducts,
  openRedeemOfferCodeAndroid,
  requestPurchase,
} from '../index.kepler';
import {getVegaIapModule} from '../vega';

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

  it("rejects the removed 'inapp' product type", async () => {
    await expect(
      fetchProducts({skus: ['coins'], type: 'inapp'} as any),
    ).rejects.toThrow(/Unsupported product type/);
    expect(fetchProductsNative).not.toHaveBeenCalled();
  });

  it('uses canonical product type without a compatibility warning', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await fetchProducts({skus: ['coins'], type: 'in-app'});

    expect(warn).not.toHaveBeenCalled();
    expect(fetchProductsNative).toHaveBeenCalledWith('in-app', ['coins']);
    warn.mockRestore();
  });

  it('rejects the removed android request alias', async () => {
    const request = {
      request: {android: {skus: ['coins']}},
      type: 'in-app',
    } as any;

    await expect(requestPurchase(request)).rejects.toThrow(
      /request\.google\.skus/,
    );
    expect(requestPurchaseNative).not.toHaveBeenCalled();
  });

  it('does not revive legacy android when canonical google is explicitly null', async () => {
    await expect(
      requestPurchase({
        request: {
          google: null,
          android: {skus: ['legacy-coins']},
        },
        type: 'in-app',
      } as any),
    ).rejects.toThrow(/request\.google\.skus/);

    expect(requestPurchaseNative).not.toHaveBeenCalled();
  });
});
