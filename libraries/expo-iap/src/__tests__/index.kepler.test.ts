import {openRedeemOfferCodeAndroid} from '../index.kepler';

describe('Amazon Vega public API', () => {
  it('returns false when offer-code redemption is unsupported', async () => {
    await expect(openRedeemOfferCodeAndroid()).resolves.toBe(false);
  });
});
