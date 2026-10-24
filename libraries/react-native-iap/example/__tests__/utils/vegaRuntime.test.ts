import {
  getAmazonVerificationProductId,
  getSubscriptionProductId,
  resolveIapkitVerificationBaseUrl,
} from '../../src/utils/vegaRuntime';

describe('Vega runtime example helpers', () => {
  it('keeps hosted IAPKit free of a configured local base URL', () => {
    expect(
      resolveIapkitVerificationBaseUrl('iapkit', 'http://192.168.0.10:3100'),
    ).toBeUndefined();
  });

  it('requires an explicit base URL for local IAPKit', () => {
    expect(() =>
      resolveIapkitVerificationBaseUrl('iapkit-localhost', '  '),
    ).toThrow('IAPKIT_BASE_URL not configured for Local (IAPKit) verification');
  });

  it('verifies an Amazon subscription term under its catalog base SKU', () => {
    expect(getAmazonVerificationProductId('dev.hyo.martie.premium')).toBe(
      'dev.hyo.martie.premium.base',
    );
    expect(getAmazonVerificationProductId('dev.hyo.martie.premium_year')).toBe(
      'dev.hyo.martie.premium.base',
    );
    expect(getAmazonVerificationProductId('dev.hyo.martie.10bulbs')).toBe(
      'dev.hyo.martie.10bulbs',
    );
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
