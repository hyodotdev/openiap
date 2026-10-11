import {Platform} from 'react-native';
import {verifyAppOwnership} from '../index';
import type {AppOwnershipVerificationResult} from '../types';
const mockVerify = jest.fn<Promise<string>, [string]>();
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {createHybridObject: () => ({verifyAppOwnership: mockVerify})},
}));

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
});

test('preserves evidence and request binding without granting a license', async () => {
  mockVerify.mockResolvedValue(JSON.stringify(evidence));
  expect(await verifyAppOwnership(options)).toEqual(evidence);
  expect(mockVerify).toHaveBeenCalledWith(JSON.stringify(options));
});

test('accepts omitted options for Apple and preserves a verified result', async () => {
  const licensed: AppOwnershipVerificationResult = {
    status: 'licensed',
    storeId: 'apple',
    signedAppTransactionIOS: 'signed-jws',
  };
  mockVerify.mockResolvedValue(JSON.stringify(licensed));
  expect(await verifyAppOwnership()).toEqual(licensed);
  expect(mockVerify).toHaveBeenCalledWith('{}');
});

test('propagates invalid configuration errors', async () => {
  const error = Object.assign(new Error('Invalid project number'), {
    code: 'developer-error',
  });
  mockVerify.mockRejectedValue(error);
  await expect(verifyAppOwnership(options)).rejects.toMatchObject({
    code: 'developer-error',
    message: 'Invalid project number',
  });
});

test('unsupported platforms do not attempt a native licensing check', async () => {
  Object.assign(Platform, {OS: 'web'});
  expect(await verifyAppOwnership()).toEqual({
    status: 'unknown',
    reason: 'unsupported',
    storeId: 'unknown',
  });
  expect(mockVerify).not.toHaveBeenCalled();
});
