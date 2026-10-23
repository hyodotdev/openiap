import {
  getAmazonVerificationProductId,
  getSubscriptionProductId,
  getDefaultVerificationMethod,
  isAmazonRvsSandboxEnabled,
  matchesVerifiedPendingPurchase,
  resolveIapkitVerificationBaseUrl,
} from '../src/utils/vegaRuntime';
import type {Purchase} from '../../src/types';

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

describe('Vega runtime example helpers', () => {
  it('local Apple verification binds the exact pending transaction and provider', () => {
    const receipt: Purchase = {
      id: 'unfinished-old',
      productId: 'dev.hyo.martie.10bulbs',
      store: 'apple',
      storeId: 'apple',
      purchaseState: 'purchased',
      transactionDate: 1,
      quantity: 1,
      isAutoRenewing: false,
    };
    expect(
      matchesVerifiedPendingPurchase(receipt, [
        {...receipt, id: 'latest-other'},
      ]),
    ).toBe(false);
    expect(
      matchesVerifiedPendingPurchase(receipt, [
        {...receipt, productId: 'another-sku'},
      ]),
    ).toBe(false);
    expect(
      matchesVerifiedPendingPurchase({...receipt, storeId: 'community-apple'}, [
        receipt,
      ]),
    ).toBe(false);
    expect(
      matchesVerifiedPendingPurchase({...receipt, id: ''}, [
        {...receipt, id: ''},
      ]),
    ).toBe(false);
    expect(matchesVerifiedPendingPurchase(receipt, [{...receipt}])).toBe(true);
    for (const extra of [
      {revocationDateIOS: 1},
      {isUpgradedIOS: true},
      {expirationDateIOS: 1},
    ]) {
      expect(
        matchesVerifiedPendingPurchase(receipt, [{...receipt, ...extra}]),
      ).toBe(false);
    }
    expect(
      matchesVerifiedPendingPurchase({...receipt, environmentIOS: 'Sandbox'}, [
        {...receipt, environmentIOS: 'Production'},
      ]),
    ).toBe(false);
    expect(
      matchesVerifiedPendingPurchase({...receipt, environmentIOS: 'Sandbox'}, [
        receipt,
      ]),
    ).toBe(false);
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
    expect(
      resolveIapkitVerificationBaseUrl('iapkit', 'http://localhost:3100'),
    ).toBeUndefined();
  });

  it('requires an explicit base URL for local IAPKit', () => {
    expect(() =>
      resolveIapkitVerificationBaseUrl('iapkit-localhost', '  '),
    ).toThrow(
      'EXPO_PUBLIC_IAPKIT_BASE_URL not configured for Local (IAPKit) verification',
    );
  });

  it('verifies Amazon subscription terms under the catalog base SKU', () => {
    expect(getAmazonVerificationProductId('dev.hyo.martie.premium')).toBe(
      'dev.hyo.martie.premium.base',
    );
    expect(getAmazonVerificationProductId('dev.hyo.martie.premium_year')).toBe(
      'dev.hyo.martie.premium.base',
    );
    expect(getAmazonVerificationProductId('dev.hyo.martie.10bulbs')).toBe(
      'dev.hyo.martie.10bulbs',
    );
    expect(isAmazonRvsSandboxEnabled()).toBe(true);
  });
});

describe('Amazon restored subscription catalog', () => {
  const base = 'dev.hyo.martie.premium.base';
  it.each(['dev.hyo.martie.premium', 'dev.hyo.martie.premium_year'])(
    'resolves the exact %s term while preserving the raw receipt SKU',
    (term) => {
      expect(getSubscriptionProductId(base, term, 'amazon', 'amazon')).toBe(
        term,
      );
      expect(
        getSubscriptionProductId(base, term, 'unknown', 'amazon_example'),
      ).toBe(term);
      expect(
        getSubscriptionProductId(term, 'play-base-plan', 'google', 'play'),
      ).toBe(term);
    },
  );
  it('never guesses a missing term or maps a foreign provider/catalog', () => {
    expect(getSubscriptionProductId(base, null)).toBeUndefined();
    expect(getSubscriptionProductId(base, 'foreign.term')).toBeUndefined();
    expect(
      getSubscriptionProductId('foreign.base', 'dev.hyo.martie.premium'),
    ).toBeUndefined();
    expect(
      getSubscriptionProductId(
        base,
        'dev.hyo.martie.premium',
        'unknown',
        'foreign',
      ),
    ).toBeUndefined();
  });
});
