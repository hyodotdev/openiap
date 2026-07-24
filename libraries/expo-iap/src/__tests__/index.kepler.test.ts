import {fetchProducts, openRedeemOfferCodeAndroid} from '../index.kepler';
import {getVegaIapModule} from '../vega';

jest.mock('../vega', () => ({
  getVegaIapModule: jest.fn(),
}));

describe('Amazon Vega public API', () => {
  const fetchProductsNative = jest.fn().mockResolvedValue([]);

  beforeEach(() => {
    jest.clearAllMocks();
    (getVegaIapModule as jest.Mock).mockReturnValue({
      fetchProducts: fetchProductsNative,
    });
  });

  it('returns false when offer-code redemption is unsupported', async () => {
    await expect(openRedeemOfferCodeAndroid()).resolves.toBe(false);
  });

  it("warns when the legacy 'inapp' product type is used", async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await fetchProducts({skus: ['coins'], type: 'inapp'});

    expect(warn).toHaveBeenCalledWith(
      '[Expo-IAP]',
      expect.stringContaining('expo-iap 5.0.0'),
    );
    expect(fetchProductsNative).toHaveBeenCalledWith('in-app', ['coins']);
    warn.mockRestore();
  });
});
