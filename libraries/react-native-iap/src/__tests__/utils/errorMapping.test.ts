import {
  getUserFriendlyErrorMessage,
  isRecoverableError,
  isUserCancelledError,
  isDuplicatePurchaseError,
  DUPLICATE_PURCHASE_CODE,
  ErrorCodeUtils,
  createPurchaseErrorFromPlatform,
  isNetworkError,
  normalizeErrorCodeFromNative,
} from '../../utils/errorMapping';
import {ErrorCode} from '../../types';

describe('utils/errorMapping', () => {
  test('isUserCancelledError matches both cancel codes', () => {
    expect(
      isUserCancelledError({
        code: ErrorCode.UserCancelled,
        message: 'x',
      } as any),
    ).toBe(true);
    expect(
      isUserCancelledError({code: 'E_USER_CANCELED', message: 'x'} as any),
    ).toBe(true);
    expect(
      isUserCancelledError({
        code: ErrorCode.NetworkError,
        message: 'x',
      } as any),
    ).toBe(false);
  });

  test('isRecoverableError covers network/service family', () => {
    const recoverables = [
      ErrorCode.NetworkError,
      ErrorCode.ServiceError,
      ErrorCode.RemoteError,
      ErrorCode.ConnectionClosed,
      ErrorCode.ServiceDisconnected,
      ErrorCode.InitConnection,
      ErrorCode.SyncError,
    ];
    for (const code of recoverables) {
      expect(isRecoverableError({code, message: 'x'} as any)).toBe(true);
    }
    expect(
      isRecoverableError({
        code: ErrorCode.UserCancelled,
        message: 'x',
      } as any),
    ).toBe(false);
  });

  test('isDuplicatePurchaseError detects duplicate purchase errors', () => {
    expect(
      isDuplicatePurchaseError({
        code: DUPLICATE_PURCHASE_CODE,
        message: 'x',
      } as any),
    ).toBe(true);
    expect(
      isDuplicatePurchaseError({
        code: 'duplicate-purchase',
        message: 'x',
      } as any),
    ).toBe(true);
    expect(
      isDuplicatePurchaseError({
        code: ErrorCode.UserCancelled,
        message: 'x',
      } as any),
    ).toBe(false);
  });

  test('isRecoverableError includes duplicate-purchase', () => {
    expect(
      isRecoverableError({
        code: DUPLICATE_PURCHASE_CODE,
        message: 'x',
      } as any),
    ).toBe(true);
  });

  test('getUserFriendlyErrorMessage returns message for duplicate-purchase', () => {
    expect(
      getUserFriendlyErrorMessage({
        code: DUPLICATE_PURCHASE_CODE,
        message: 'ignored',
      } as any),
    ).toBe(
      'This purchase has already been processed. Try restoring purchases.',
    );
  });

  test('getUserFriendlyErrorMessage maps known codes and falls back to message', () => {
    expect(
      getUserFriendlyErrorMessage({
        code: ErrorCode.UserCancelled,
        message: 'ignored',
      } as any),
    ).toBe('Purchase cancelled');
    expect(
      getUserFriendlyErrorMessage({
        code: ErrorCode.NetworkError,
        message: 'ignored',
      } as any),
    ).toBe(
      'Network connection error. Please check your internet connection and try again.',
    );
    expect(
      getUserFriendlyErrorMessage({
        code: ErrorCode.IapNotAvailable,
        message: 'ignored',
      } as any),
    ).toBe('In-app purchases are not available on this device');

    // default fallback
    expect(
      getUserFriendlyErrorMessage({
        code: 'E_UNKNOWN_CUSTOM' as any,
        message: 'custom',
      } as any),
    ).toBe('custom');
  });

  test.each([
    ['receipt-failed', ErrorCode.PurchaseVerificationFailed],
    ['ReceiptFailed', ErrorCode.PurchaseVerificationFailed],
    ['E_RECEIPT_FINISHED', ErrorCode.PurchaseVerificationFinished],
    ['RECEIPT_FINISHED_FAILED', ErrorCode.PurchaseVerificationFinishFailed],
  ])('normalizes historical error input %s', (input, expected) => {
    expect(ErrorCodeUtils.fromPlatformCode(input, 'ios')).toBe(expected);
    expect(
      getUserFriendlyErrorMessage({code: input, message: 'ignored'}),
    ).not.toBe('ignored');
  });

  test.each([
    [ErrorCode.ServiceDisconnected, 'Billing service disconnected'],
    [ErrorCode.BillingUnavailable, 'Billing is unavailable'],
    [ErrorCode.ItemUnavailable, 'not available for purchase'],
    [ErrorCode.ItemNotOwned, "don't own"],
    [ErrorCode.AlreadyOwned, 'already own'],
    [ErrorCode.SkuNotFound, 'could not be found'],
    [ErrorCode.SkuOfferMismatch, 'does not match'],
    [ErrorCode.DeferredPayment, 'pending approval'],
    [ErrorCode.NotPrepared, 'not ready'],
    [ErrorCode.ServiceError, 'Store service error'],
    [ErrorCode.FeatureNotSupported, 'not supported'],
    [ErrorCode.TransactionValidationFailed, 'could not be verified'],
    [ErrorCode.PurchaseVerificationFailed, 'verification failed'],
    [ErrorCode.PurchaseVerificationFinished, 'verification completed'],
    [ErrorCode.PurchaseVerificationFinishFailed, 'complete purchase'],
    [ErrorCode.EmptySkuList, 'No product IDs'],
    [ErrorCode.InitConnection, 'initialize billing'],
    [ErrorCode.QueryProduct, 'query products'],
  ])('provides a useful message for %s', (code, expectedText) => {
    expect(getUserFriendlyErrorMessage({code, message: 'ignored'})).toContain(
      expectedText,
    );
  });

  test('falls back safely when an unknown error has no message', () => {
    expect(getUserFriendlyErrorMessage('unknown')).toBe(
      'An unexpected error occurred',
    );
    expect(
      getUserFriendlyErrorMessage({code: 'unknown', message: undefined}),
    ).toBe('An unexpected error occurred');
  });

  test.each([
    [ErrorCode.NetworkError, true],
    [ErrorCode.RemoteError, true],
    [ErrorCode.ServiceError, true],
    [ErrorCode.ServiceDisconnected, true],
    [ErrorCode.BillingUnavailable, true],
    [ErrorCode.UserCancelled, false],
  ])('classifies network error %s', (code, expected) => {
    expect(isNetworkError({code})).toBe(expected);
  });

  test('treats missing error codes and objects as non-network errors', () => {
    expect(isNetworkError({code: undefined})).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });

  test.each([
    ['USER_CANCEL', ErrorCode.UserCancelled],
    ['E_NETWORK_ERROR', ErrorCode.NetworkError],
    ['service_disconnected', ErrorCode.ServiceDisconnected],
    ['already-owned', ErrorCode.AlreadyOwned],
    ['NETWORK-ERROR', ErrorCode.NetworkError],
    ['not-a-real-code', ErrorCode.Unknown],
    [42, ErrorCode.Unknown],
  ])('normalizes native error code %s', (input, expected) => {
    expect(normalizeErrorCodeFromNative(input)).toBe(expected);
  });

  test('converts platform error data and preserves diagnostics', () => {
    const error = createPurchaseErrorFromPlatform(
      {
        code: 'E_NETWORK_ERROR',
        message: 'offline',
        responseCode: 7,
        debugMessage: 'retry',
        productId: 'premium',
      },
      'android',
    );

    expect(error).toMatchObject({
      code: ErrorCode.NetworkError,
      message: 'offline',
      responseCode: 7,
      debugMessage: 'retry',
      productId: 'premium',
    });
    expect(ErrorCodeUtils.getNativeErrorCode(ErrorCode.NetworkError)).toBe(
      ErrorCode.NetworkError,
    );
    expect(ErrorCodeUtils.toPlatformCode(ErrorCode.NetworkError, 'ios')).toBe(
      ErrorCode.NetworkError,
    );
    expect(
      ErrorCodeUtils.isValidForPlatform(ErrorCode.NetworkError, 'ios'),
    ).toBe(true);
  });
});
