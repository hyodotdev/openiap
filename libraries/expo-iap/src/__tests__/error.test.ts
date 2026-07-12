import {
  createPurchaseError,
  createPurchaseErrorFromPlatform,
  createPurchaseErrorFromNativeException,
  ErrorCodeUtils,
  getUserFriendlyErrorMessage,
  isNetworkError,
  isRecoverableError,
  isUserCancelledError,
} from '../utils/errorMapping';
import {ErrorCode} from '../types';

describe('errorMapping utilities', () => {
  it('creates purchase error from platform code string', () => {
    const err = createPurchaseErrorFromPlatform(
      {
        code: 'ALREADY_OWNED',
        message: 'dup',
        responseCode: 7,
        debugMessage: 'native detail',
        productId: 'sku1',
        productIds: ['sku1', 'sku2'],
        productType: 'subs',
        isEmptyProductList: false,
        subResponseCodeAndroid: 'payment-declined-due-to-insufficient-funds',
      },
      'android',
    );
    expect(err.code).toBe(ErrorCode.AlreadyOwned);
    expect(err.platform).toBe('android');
    expect(err.message).toBe('dup');
    expect(err.responseCode).toBe(7);
    expect(err.debugMessage).toBe('native detail');
    expect(err.productId).toBe('sku1');
    expect(err.productIds).toEqual(['sku1', 'sku2']);
    expect(err.productType).toBe('subs');
    expect(err.isEmptyProductList).toBe(false);
    expect(err.subResponseCodeAndroid).toBe(
      'payment-declined-due-to-insufficient-funds',
    );
  });

  it('maps legacy numeric Android billing response codes explicitly', () => {
    const resolved = ErrorCodeUtils.fromPlatformCode(3, 'android');
    expect(resolved).toBe(ErrorCode.BillingUnavailable);
    expect(ErrorCodeUtils.fromPlatformCode(3, 'ios')).toBe(ErrorCode.Unknown);
  });

  it('falls back to unknown for unmapped codes', () => {
    expect(ErrorCodeUtils.fromPlatformCode('E_STRANGE', 'ios')).toBe(
      ErrorCode.Unknown,
    );
  });

  it('normalizes E-prefixed standard error codes', () => {
    expect(ErrorCodeUtils.fromPlatformCode('E_USER_CANCELLED', 'ios')).toBe(
      ErrorCode.UserCancelled,
    );
  });

  it('round-trips canonical codes instead of native message constants', () => {
    const platformCode = ErrorCodeUtils.toPlatformCode(
      ErrorCode.NetworkError,
      'ios',
    );
    expect(platformCode).toBe(ErrorCode.NetworkError);
    expect(ErrorCodeUtils.getNativeErrorCode(ErrorCode.NetworkError)).toBe(
      ErrorCode.NetworkError,
    );
  });

  it('validates every canonical code independently of platform', () => {
    for (const code of Object.values(ErrorCode)) {
      expect(ErrorCodeUtils.isValidForPlatform(code, 'ios')).toBe(true);
      expect(ErrorCodeUtils.isValidForPlatform(code, 'android')).toBe(true);
    }
  });

  it('does not depend on enumerable native ERROR_CODES message proxies', () => {
    const messages = new Proxy<Record<string, string>>(
      {},
      {
        get: (_target, code: string) =>
          code === ErrorCode.NetworkError ? 'Network connection error' : '',
      },
    );

    expect(messages[ErrorCode.NetworkError]).toBe('Network connection error');
    expect(Object.entries(messages)).toEqual([]);
    expect(ErrorCodeUtils.fromPlatformCode('NETWORK_ERROR', 'android')).toBe(
      ErrorCode.NetworkError,
    );
  });

  it('detects specific error categories', () => {
    expect(isUserCancelledError('USER_CANCELLED')).toBe(true);
    expect(isNetworkError({code: 'E_NETWORK_ERROR'})).toBe(true);
    expect(isRecoverableError('E_QUERY_PRODUCT')).toBe(true);
    expect(isNetworkError({code: undefined})).toBe(false);
    expect(isUserCancelledError(null)).toBe(false);
  });

  it('returns friendly messages and defaults', () => {
    expect(getUserFriendlyErrorMessage('USER_CANCELLED')).toMatch(/cancelled/);
    expect(
      getUserFriendlyErrorMessage({code: 'E_UNKNOWN', message: 'custom'}),
    ).toBe('custom');
    expect(getUserFriendlyErrorMessage('E_NOT_IN_MAP')).toBe(
      'An unexpected error occurred',
    );

    const expectations: [ErrorCode, RegExp][] = [
      [ErrorCode.NetworkError, /Network connection error/],
      [ErrorCode.ReceiptFinished, /Receipt already finished/],
      [ErrorCode.ServiceDisconnected, /Billing service disconnected/],
      [ErrorCode.BillingUnavailable, /Billing is unavailable/],
      [ErrorCode.ItemUnavailable, /not available/],
      [ErrorCode.ItemNotOwned, /don't own/],
      [ErrorCode.AlreadyOwned, /already own/],
      [ErrorCode.SkuNotFound, /could not be found/],
      [ErrorCode.SkuOfferMismatch, /Selected offer/],
      [ErrorCode.DeferredPayment, /pending approval/],
      [ErrorCode.NotPrepared, /not ready/],
      [ErrorCode.ServiceError, /Store service error/],
      [ErrorCode.FeatureNotSupported, /not supported/],
      [ErrorCode.TransactionValidationFailed, /could not be verified/],
      [ErrorCode.ReceiptFailed, /Receipt processing failed/],
      [ErrorCode.EmptySkuList, /No product IDs/],
      [ErrorCode.InitConnection, /Failed to initialize billing/],
      [ErrorCode.QueryProduct, /Failed to query products/],
    ];

    for (const [code, matcher] of expectations) {
      expect(getUserFriendlyErrorMessage(code)).toMatch(matcher);
    }
  });

  it('preserves createPurchaseError fields', () => {
    const native = createPurchaseError({
      message: 'fail',
      responseCode: 7,
      debugMessage: 'dbg',
      code: ErrorCode.PurchaseError,
      productId: 'sku1',
      productIds: ['sku1', 'sku2'],
      productType: 'subs',
      isEmptyProductList: false,
      subResponseCodeAndroid: 'user-ineligible',
      platform: 'android',
    });

    expect(native.name).toBe('[expo-iap]: PurchaseError');
    expect(native.responseCode).toBe(7);
    expect(native.debugMessage).toBe('dbg');
    expect(native.code).toBe(ErrorCode.PurchaseError);
    expect(native.productId).toBe('sku1');
    expect(native.productIds).toEqual(['sku1', 'sku2']);
    expect(native.productType).toBe('subs');
    expect(native.isEmptyProductList).toBe(false);
    expect(native.subResponseCodeAndroid).toBe('user-ineligible');
    expect(native.platform).toBe('android');
  });

  it('restores canonical fields from a decorated native JSON envelope', () => {
    const payload = {
      code: 'query-product',
      message: 'Product query failed',
      debugMessage: 'Billing returned {ITEM_UNAVAILABLE}',
      responseCode: 4,
      productId: 'premium_monthly',
      productIds: ['premium_monthly', 'premium_yearly'],
      productType: 'subs',
      isEmptyProductList: false,
      subResponseCodeAndroid: 'user-ineligible',
      platform: 'android',
    };
    const error = new Error(
      `Call to function rejected.\n→ Caused by: OPENIAP_ERROR_JSON:${JSON.stringify(
        payload,
      )}`,
    ) as Error & {code: string};
    error.code = 'query-product';

    const restored = createPurchaseErrorFromNativeException(error, 'android');

    expect(restored).toMatchObject(payload);
    expect(restored.name).toBe('[expo-iap]: PurchaseError');
  });

  it('falls back to direct native fields when no envelope is present', () => {
    const restored = createPurchaseErrorFromNativeException(
      {
        code: 'sku-not-found',
        message: 'Missing product',
        productId: 'missing_sku',
        debugMessage: 'Store lookup returned no match',
      },
      'ios',
    );

    expect(restored).toMatchObject({
      code: ErrorCode.SkuNotFound,
      message: 'Missing product',
      productId: 'missing_sku',
      debugMessage: 'Store lookup returned no match',
      platform: 'ios',
    });
  });
});
