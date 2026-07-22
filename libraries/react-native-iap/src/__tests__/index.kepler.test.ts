import {openRedeemOfferCodeAndroid} from '../index.kepler';

jest.mock('../hooks/useIAP', () => ({useIAP: jest.fn()}));

describe('Amazon Vega public API', () => {
  it('returns false when offer-code redemption is unsupported', async () => {
    await expect(openRedeemOfferCodeAndroid()).resolves.toBe(false);
  });
});
