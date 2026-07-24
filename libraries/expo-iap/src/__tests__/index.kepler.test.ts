import {
  fetchProducts,
  openRedeemOfferCodeAndroid,
  requestPurchase,
} from '../index.kepler';
import type {RequestPurchaseProps} from '../types';
import {getVegaIapModule} from '../vega';
import {resetLegacyWarningsForTesting} from '../utils/deprecation';

jest.mock('../vega', () => ({
  getVegaIapModule: jest.fn(),
}));

describe('Amazon Vega public API', () => {
  const fetchProductsNative = jest.fn().mockResolvedValue([]);
  const requestPurchaseNative = jest.fn().mockResolvedValue([]);

  beforeEach(() => {
    jest.clearAllMocks();
    resetLegacyWarningsForTesting();
    (getVegaIapModule as jest.Mock).mockReturnValue({
      fetchProducts: fetchProductsNative,
      requestPurchase: requestPurchaseNative,
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

  it('uses canonical product type without a compatibility warning', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await fetchProducts({skus: ['coins'], type: 'in-app'});

    expect(warn).not.toHaveBeenCalled();
    expect(fetchProductsNative).toHaveBeenCalledWith('in-app', ['coins']);
    warn.mockRestore();
  });

  it('warns once when the legacy android request alias is selected', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const request: RequestPurchaseProps = {
      request: {android: {skus: ['coins']}},
      type: 'in-app',
    };

    await requestPurchase(request);
    await requestPurchase(request);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[Expo-IAP]',
      expect.stringContaining('`request.android` is deprecated'),
    );
    expect(requestPurchaseNative).toHaveBeenLastCalledWith({
      skuArr: ['coins'],
      type: 'in-app',
    });
    warn.mockRestore();
  });
});
