import {
  isUserCancelledError,
  isNetworkError,
  isRecoverableError,
  getUserFriendlyErrorMessage,
  createPurchaseErrorFromNativeException,
  OPENIAP_ERROR_ENVELOPE_PREFIX,
} from '../errorMapping';
import {ErrorCode} from '../../types';

// Expo builds a rejected function's message from the exception's
// debugDescription, which ends with " (at <file>:<line>)" (#463).
const rejectionWithSourceLocation = (envelope: Record<string, unknown>) => ({
  code: envelope.code as string,
  message:
    "Call to function 'ExpoIap.requestPurchase' has been rejected.\n" +
    '→ Caused by: IapException: ' +
    OPENIAP_ERROR_ENVELOPE_PREFIX +
    JSON.stringify(envelope) +
    ' (at ExpoIap/ExpoIapHelper.swift:21)',
});

const FALLBACK = {
  code: ErrorCode.PurchaseError,
  message: 'Failed to request purchase',
};

describe('errorMapping utils', () => {
  it('detects user cancelled errors from string or object', () => {
    expect(isUserCancelledError(ErrorCode.UserCancelled)).toBe(true);
    expect(isUserCancelledError({code: ErrorCode.UserCancelled})).toBe(true);
    expect(isUserCancelledError('other')).toBe(false);
  });

  it('detects network related errors', () => {
    expect(isNetworkError(ErrorCode.NetworkError)).toBe(true);
    expect(isNetworkError({code: ErrorCode.ServiceDisconnected})).toBe(true);
    expect(isNetworkError('random')).toBe(false);
  });

  it('detects recoverable errors', () => {
    expect(isRecoverableError(ErrorCode.QueryProduct)).toBe(true);
    expect(isRecoverableError({code: ErrorCode.InitConnection})).toBe(true);
    expect(isRecoverableError('nonrecoverable')).toBe(false);
  });

  it('returns user friendly messages', () => {
    expect(
      getUserFriendlyErrorMessage({code: ErrorCode.UserCancelled}),
    ).toMatch(/cancelled/i);
    expect(getUserFriendlyErrorMessage({code: ErrorCode.EmptySkuList})).toMatch(
      /No product IDs/i,
    );
    expect(getUserFriendlyErrorMessage({code: 'UNKNOWN'} as any)).toBe(
      'An unexpected error occurred',
    );
  });

  it('keeps the native message when Expo appends a source location', () => {
    const error = createPurchaseErrorFromNativeException(
      rejectionWithSourceLocation({
        code: ErrorCode.UserCancelled,
        message: 'User cancelled the purchase flow',
        platform: 'ios',
      }),
      'ios',
      FALLBACK,
    );

    expect(error.code).toBe(ErrorCode.UserCancelled);
    expect(error.message).toBe('User cancelled the purchase flow');
  });

  it('keeps a debugMessage that itself contains braces', () => {
    const error = createPurchaseErrorFromNativeException(
      rejectionWithSourceLocation({
        code: ErrorCode.PurchaseError,
        message: 'Purchase failed',
        debugMessage: 'StoreKit said {"reason":"declined"}',
        platform: 'ios',
      }),
      'ios',
      FALLBACK,
    );

    expect(error.message).toBe('Purchase failed');
    expect(error.debugMessage).toBe('StoreKit said {"reason":"declined"}');
  });

  it('falls back when the envelope is not parseable', () => {
    const error = createPurchaseErrorFromNativeException(
      {
        code: ErrorCode.PurchaseError,
        message: `${OPENIAP_ERROR_ENVELOPE_PREFIX}{not json (at A.swift:1)`,
      },
      'ios',
      FALLBACK,
    );

    expect(error.message).toBe('Failed to request purchase');
  });
});
