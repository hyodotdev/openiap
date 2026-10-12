import {verifyAppOwnership} from '../index';
import type {AppOwnershipVerificationResult} from '../types';
import ExpoIapModule from '../ExpoIapModule';
import {Platform} from 'react-native';

jest.mock('../ExpoIapModule', () =>
  jest.requireActual('../__mocks__/ExpoIapModule'),
);
const mockVerify = jest.mocked(ExpoIapModule.verifyAppOwnership);

const options = {
  google: {cloudProjectNumber: '123456789', requestHash: 'challenge-digest'},
};
const evidence: AppOwnershipVerificationResult = {
  status: 'unknown',
  storeId: 'play',
  reason: 'backend-verification-required',
  integrityTokenAndroid: 'encrypted-token',
};

beforeEach(() => {
  mockVerify.mockReset();
  Object.assign(Platform, {OS: 'android'});
  ExpoIapModule.USING_ONSIDE_SDK = false;
});

test('preserves evidence and request binding without granting a license', async () => {
  mockVerify.mockResolvedValue(evidence);
  expect(await verifyAppOwnership(options)).toEqual(evidence);
  expect(mockVerify).toHaveBeenCalledWith(options);
});

test('accepts omitted options for Apple and preserves a verified result', async () => {
  const licensed: AppOwnershipVerificationResult = {
    status: 'licensed',
    storeId: 'apple',
    signedAppTransactionIOS: 'signed-jws',
  };
  mockVerify.mockResolvedValue(licensed);
  expect(await verifyAppOwnership()).toEqual(licensed);
  expect(mockVerify).toHaveBeenCalledWith({});
});

test('propagates invalid configuration errors', async () => {
  const error = new Error('developer-error: invalid project number');
  mockVerify.mockRejectedValue(error);
  await expect(verifyAppOwnership(options)).rejects.toBe(error);
});

test('returns unsupported for community Apple and web providers', async () => {
  ExpoIapModule.USING_ONSIDE_SDK = true;
  expect(await verifyAppOwnership()).toEqual({
    status: 'unknown',
    reason: 'unsupported',
    storeId: 'onside',
  });
  ExpoIapModule.USING_ONSIDE_SDK = false;
  Object.assign(Platform, {OS: 'web'});
  expect(await verifyAppOwnership()).toEqual({
    status: 'unknown',
    reason: 'unsupported',
    storeId: 'unknown',
  });
  expect(mockVerify).not.toHaveBeenCalled();
});

test('preserves the native developer error code', async () => {
  mockVerify.mockRejectedValue(
    Object.assign(new Error('Invalid project number'), {
      code: 'developer-error',
    }),
  );
  await expect(verifyAppOwnership(options)).rejects.toMatchObject({
    code: 'developer-error',
    message: 'Invalid project number',
  });
});
