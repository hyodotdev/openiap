import {
  fetchProducts,
  openRedeemOfferCodeAndroid,
  requestPurchase,
} from '../index.kepler';
import type {RequestPurchaseProps} from '../types';
import {getVegaIapModule} from '../vega';
import {resetLegacyWarningsForTesting} from '../utils/deprecation';

jest.mock('../hooks/useIAP', () => ({useIAP: jest.fn()}));
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
      '[RN-IAP]',
      expect.stringContaining('react-native-iap 16.0.0'),
    );
    expect(fetchProductsNative).toHaveBeenCalledWith(['coins'], 'in-app');
    warn.mockRestore();
  });

  it("uses canonical 'in-app' without a compatibility warning", async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await fetchProducts({skus: ['coins'], type: 'in-app'});

    expect(warn).not.toHaveBeenCalled();
    expect(fetchProductsNative).toHaveBeenCalledWith(['coins'], 'in-app');
    warn.mockRestore();
  });

  it('emits only google and warns once for the legacy android alias', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const request: RequestPurchaseProps = {
      request: {android: {skus: ['coins']}},
      type: 'in-app',
    };

    await requestPurchase(request);
    await requestPurchase(request);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[RN-IAP]',
      expect.stringContaining('`request.android` is deprecated'),
    );
    expect(requestPurchaseNative).toHaveBeenLastCalledWith({
      google: {skus: ['coins']},
    });
    warn.mockRestore();
  });

  it('does not fall back to android when google is explicitly null', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const request: RequestPurchaseProps = {
      request: {
        google: null,
        android: {skus: ['legacy-coins']},
      },
      type: 'in-app',
    };

    await expect(requestPurchase(request)).rejects.toThrow(
      /request\.google\.skus/,
    );

    expect(warn).not.toHaveBeenCalled();
    expect(requestPurchaseNative).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
