import {parseAppTransactionPayload} from '../../utils';

const requiredPayload = {
  appId: 123,
  appVersion: '2.0.0',
  appVersionId: 456,
  bundleId: 'dev.hyo.martie',
  deviceVerification: 'verification',
  deviceVerificationNonce: 'nonce',
  environment: 'Sandbox',
  originalAppVersion: '1.0.0',
  originalPurchaseDate: 1000,
  signedDate: 2000,
};

describe('parseAppTransactionPayload', () => {
  it('preserves Xcode 27 app acquisition metadata', () => {
    const result = parseAppTransactionPayload(
      JSON.stringify({
        ...requiredPayload,
        revocationDate: 3000,
        storeType: 'consumer',
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        revocationDate: 3000,
        storeType: 'consumer',
      }),
    );
  });

  it('normalizes malformed optional acquisition metadata to null', () => {
    const result = parseAppTransactionPayload(
      JSON.stringify({
        ...requiredPayload,
        revocationDate: 'not-a-date',
        storeType: 42,
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        revocationDate: null,
        storeType: null,
      }),
    );
  });
});
