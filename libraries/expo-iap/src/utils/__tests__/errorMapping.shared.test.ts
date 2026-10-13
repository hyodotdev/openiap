import {readFileSync} from 'fs';
import {resolve} from 'path';
import {ErrorCode} from '../../types';
import {
  ErrorCodeUtils,
  getUserFriendlyErrorMessage,
  isRecoverableError,
  isUserCancelledError,
  normalizeErrorCodeFromNative,
} from '../errorMapping';

// react-native-iap and expo-iap ship one errorMapping.ts and this test.
const readFromBothLibraries = (path: string): string[] =>
  ['react-native-iap', 'expo-iap'].map((library) =>
    readFileSync(resolve(__dirname, '../../../..', library, path), 'utf8'),
  );

describe('shared errorMapping', () => {
  it.each([
    'src/utils/errorMapping.ts',
    'src/utils/__tests__/errorMapping.shared.test.ts',
  ])('keeps %s identical in both libraries', (path) => {
    const [reactNative, expo] = readFromBothLibraries(path);
    expect(expo).toBe(reactNative);
  });

  it('maps Play response codes on Android only', () => {
    expect(ErrorCodeUtils.fromPlatformCode(1, 'android')).toBe(
      ErrorCode.UserCancelled,
    );
    expect(ErrorCodeUtils.fromPlatformCode(7, 'android')).toBe(
      ErrorCode.AlreadyOwned,
    );
    expect(ErrorCodeUtils.fromPlatformCode(12, 'android')).toBe(
      ErrorCode.NetworkError,
    );
    expect(ErrorCodeUtils.fromPlatformCode(-1, 'android')).toBe(
      ErrorCode.ServiceDisconnected,
    );
    expect(ErrorCodeUtils.fromPlatformCode(1, 'ios')).toBe(ErrorCode.Unknown);
  });

  it.each([
    'user-cancelled',
    'UserCancelled',
    'E_USER_CANCELLED',
    'E_USER_CANCELED',
    'e_user_cancelled',
    'user-canceled',
    'USER_CANCEL',
    'CANCELED',
  ])('treats %s as a user cancellation', (code) => {
    expect(normalizeErrorCodeFromNative(code)).toBe(ErrorCode.UserCancelled);
    expect(ErrorCodeUtils.fromPlatformCode(code, 'ios')).toBe(
      ErrorCode.UserCancelled,
    );
    expect(isUserCancelledError({code})).toBe(true);
  });

  it('maps codes outside ErrorCode to unknown', () => {
    expect(normalizeErrorCodeFromNative('developer-billing-error')).toBe(
      ErrorCode.Unknown,
    );
    expect(normalizeErrorCodeFromNative(undefined)).toBe(ErrorCode.Unknown);
  });

  it('does not retry billing-unavailable or duplicate purchases', () => {
    expect(isRecoverableError({code: ErrorCode.SyncError})).toBe(true);
    expect(isRecoverableError({code: ErrorCode.ConnectionClosed})).toBe(true);
    expect(isRecoverableError({code: ErrorCode.ServiceTimeout})).toBe(true);
    expect(isRecoverableError({code: ErrorCode.BillingUnavailable})).toBe(
      false,
    );
    expect(isRecoverableError({code: ErrorCode.DuplicatePurchase})).toBe(false);
  });

  it('uses one end-user copy for each code', () => {
    expect(getUserFriendlyErrorMessage(ErrorCode.UserCancelled)).toBe(
      'Purchase cancelled',
    );
    expect(
      getUserFriendlyErrorMessage(ErrorCode.PurchaseVerificationFinished),
    ).toBe('Purchase verification already finished');
    expect(getUserFriendlyErrorMessage(ErrorCode.IapNotAvailable)).toBe(
      'In-app purchases are not available on this device',
    );
    expect(getUserFriendlyErrorMessage({code: 'not-a-code'})).toBe(
      'An unexpected error occurred',
    );
  });
});
