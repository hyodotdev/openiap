/**
 * Error-code helpers shared by react-native-iap and expo-iap.
 * Edit libraries/react-native-iap/src/utils/errorMapping.ts first and copy it to
 * expo-iap; errorMapping.shared.test.ts keeps the copies identical.
 */

import {
  ErrorCode,
  type IapPlatform,
  type SubResponseCodeAndroid,
} from '../types';
import {PACKAGE_NAME} from './packageName';

export interface PurchaseErrorProps {
  message?: string;
  responseCode?: number;
  debugMessage?: string;
  code?: ErrorCode | string | number;
  productId?: string;
  productIds?: string[];
  productType?: string;
  isEmptyProductList?: boolean;
  subResponseCodeAndroid?: SubResponseCodeAndroid;
  platform?: IapPlatform;
}

export interface PurchaseError extends Error {
  responseCode?: number;
  debugMessage?: string;
  code?: ErrorCode;
  productId?: string;
  productIds?: string[];
  productType?: string;
  isEmptyProductList?: boolean;
  subResponseCodeAndroid?: SubResponseCodeAndroid;
  platform?: IapPlatform;
}

/** Error code for duplicate purchase events. */
export const DUPLICATE_PURCHASE_CODE = ErrorCode.DuplicatePurchase;

const OPENIAP_ERROR_CODES: ReadonlySet<string> = new Set(
  Object.values(ErrorCode),
);

// Legacy spellings, keyed in upper snake case without the `E_` prefix.
const ERROR_CODE_ALIASES: Readonly<Partial<Record<string, ErrorCode>>> = {
  USER_CANCELED: ErrorCode.UserCancelled,
  USER_CANCEL: ErrorCode.UserCancelled,
  CANCELED: ErrorCode.UserCancelled,
  CANCELLED: ErrorCode.UserCancelled,
  RECEIPT_FAILED: ErrorCode.PurchaseVerificationFailed,
  RECEIPT_FINISHED: ErrorCode.PurchaseVerificationFinished,
  RECEIPT_FINISHED_FAILED: ErrorCode.PurchaseVerificationFinishFailed,
};

// Google Play BillingResponseCode values that older call sites pass as codes.
const ANDROID_RESPONSE_CODES: ReadonlyMap<number, ErrorCode> = new Map([
  [-3, ErrorCode.ServiceTimeout],
  [-2, ErrorCode.FeatureNotSupported],
  [-1, ErrorCode.ServiceDisconnected],
  [1, ErrorCode.UserCancelled],
  [2, ErrorCode.ServiceError],
  [3, ErrorCode.BillingUnavailable],
  [4, ErrorCode.ItemUnavailable],
  [5, ErrorCode.DeveloperError],
  [6, ErrorCode.ServiceError],
  [7, ErrorCode.AlreadyOwned],
  [8, ErrorCode.ItemNotOwned],
  [12, ErrorCode.NetworkError],
]);

/** Maps any code spelling (`user-cancelled`, `E_USER_CANCELED`, `UserCancelled`) to an ErrorCode. */
export const normalizeErrorCodeFromNative = (code: unknown): ErrorCode => {
  if (typeof code !== 'string') {
    return ErrorCode.Unknown;
  }
  const key = code
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toUpperCase()
    .replace(/^E_/, '');
  const alias = ERROR_CODE_ALIASES[key];
  if (alias) {
    return alias;
  }
  const kebab = key.toLowerCase().replace(/_/g, '-');
  return OPENIAP_ERROR_CODES.has(kebab)
    ? (kebab as ErrorCode)
    : ErrorCode.Unknown;
};

const normalizePlatform = (platform: IapPlatform): 'ios' | 'android' =>
  typeof platform === 'string' && platform.toLowerCase() === 'ios'
    ? 'ios'
    : 'android';

const ERROR_CODE_MAP = Object.fromEntries(
  Object.values(ErrorCode).map((code) => [code, code]),
) as Record<ErrorCode, string>;

export const ErrorCodeMapping = {
  ios: ERROR_CODE_MAP,
  android: ERROR_CODE_MAP,
} as const;

export const ErrorCodeUtils = {
  // OpenIAP native bridges already exchange canonical error-code strings.
  getNativeErrorCode: (errorCode: ErrorCode): string => errorCode,
  fromPlatformCode: (
    platformCode: string | number | null | undefined,
    platform: IapPlatform,
  ): ErrorCode => {
    if (typeof platformCode !== 'number') {
      return normalizeErrorCodeFromNative(platformCode);
    }
    if (normalizePlatform(platform) !== 'android') {
      return ErrorCode.Unknown;
    }
    return ANDROID_RESPONSE_CODES.get(platformCode) ?? ErrorCode.Unknown;
  },
  toPlatformCode: (
    errorCode: ErrorCode,
    _platform: IapPlatform,
  ): string | number => errorCode,
  isValidForPlatform: (errorCode: ErrorCode, _platform: IapPlatform): boolean =>
    OPENIAP_ERROR_CODES.has(errorCode),
};

export const createPurchaseError = (
  props: PurchaseErrorProps,
): PurchaseError => {
  const error = new Error(
    props.message ?? 'Unknown error occurred',
  ) as PurchaseError;
  error.name = `[${PACKAGE_NAME}]: PurchaseError`;
  error.responseCode = props.responseCode;
  error.debugMessage = props.debugMessage;
  error.code = props.code
    ? ErrorCodeUtils.fromPlatformCode(props.code, props.platform ?? 'ios')
    : undefined;
  error.productId = props.productId;
  error.productIds = props.productIds;
  error.productType = props.productType;
  error.isEmptyProductList = props.isEmptyProductList;
  error.subResponseCodeAndroid = props.subResponseCodeAndroid;
  error.platform = props.platform;
  return error;
};

export const createPurchaseErrorFromPlatform = (
  errorData: PurchaseErrorProps,
  platform: IapPlatform,
): PurchaseError =>
  createPurchaseError({
    ...errorData,
    message: errorData.message ?? 'Unknown error occurred',
    code: errorData.code
      ? ErrorCodeUtils.fromPlatformCode(
          errorData.code,
          normalizePlatform(platform),
        )
      : ErrorCode.Unknown,
    platform,
  });

// ---------------------------------------------------------------------------
// Convenience helpers for interpreting error objects
// ---------------------------------------------------------------------------

type ErrorLike = string | {code?: ErrorCode | string; message?: string};

const extractCode = (error: unknown): ErrorCode | undefined => {
  if (typeof error === 'string') {
    return normalizeErrorCodeFromNative(error);
  }
  if (error && typeof error === 'object' && 'code' in error) {
    return normalizeErrorCodeFromNative(error.code);
  }
  return undefined;
};

const NETWORK_ERROR_CODES: ReadonlySet<ErrorCode> = new Set([
  ErrorCode.NetworkError,
  ErrorCode.RemoteError,
  ErrorCode.ServiceError,
  ErrorCode.ServiceDisconnected,
  ErrorCode.BillingUnavailable,
]);

// Codes whose documented action is to retry or reconnect (openiap.dev/docs/errors).
const RECOVERABLE_ERROR_CODES: ReadonlySet<ErrorCode> = new Set([
  ErrorCode.NetworkError,
  ErrorCode.RemoteError,
  ErrorCode.ServiceError,
  ErrorCode.ServiceDisconnected,
  ErrorCode.ServiceTimeout,
  ErrorCode.ConnectionClosed,
  ErrorCode.InitConnection,
  ErrorCode.SyncError,
  ErrorCode.Interrupted,
  ErrorCode.QueryProduct,
]);

export function isUserCancelledError(error: unknown): boolean {
  return extractCode(error) === ErrorCode.UserCancelled;
}

export function isDuplicatePurchaseError(error: unknown): boolean {
  return extractCode(error) === DUPLICATE_PURCHASE_CODE;
}

export function isNetworkError(error: unknown): boolean {
  const code = extractCode(error);
  return code !== undefined && NETWORK_ERROR_CODES.has(code);
}

export function isRecoverableError(error: unknown): boolean {
  const code = extractCode(error);
  return code !== undefined && RECOVERABLE_ERROR_CODES.has(code);
}

/**
 * End-user copy for a known error code, derived from the code by design: the
 * native message can name build configuration a customer must not be shown.
 * Developers get that diagnostic as `error.message`.
 */
export function getUserFriendlyErrorMessage(error: ErrorLike): string {
  switch (extractCode(error)) {
    case ErrorCode.UserCancelled:
      return 'Purchase cancelled';
    case ErrorCode.NetworkError:
      return 'Network connection error. Please check your internet connection and try again.';
    case ErrorCode.ServiceDisconnected:
      return 'Billing service disconnected. Please try again.';
    case ErrorCode.BillingUnavailable:
      return 'Billing is unavailable on this device or account.';
    case ErrorCode.ItemUnavailable:
      return 'This item is not available for purchase';
    case ErrorCode.ItemNotOwned:
      return "You don't own this item";
    case ErrorCode.AlreadyOwned:
      return 'You already own this item';
    case ErrorCode.SkuNotFound:
      return 'Requested product could not be found';
    case ErrorCode.SkuOfferMismatch:
      return 'Selected offer does not match the SKU';
    case ErrorCode.DeferredPayment:
      return 'Payment is pending approval';
    case ErrorCode.DuplicatePurchase:
      return 'This purchase has already been processed. Try restoring purchases.';
    case ErrorCode.NotPrepared:
      return 'In-app purchase is not ready. Please try again later.';
    case ErrorCode.ServiceError:
      return 'Store service error. Please try again later.';
    case ErrorCode.FeatureNotSupported:
      return 'This feature is not supported on this device.';
    case ErrorCode.TransactionValidationFailed:
      return 'Transaction could not be verified';
    case ErrorCode.PurchaseVerificationFailed:
      return 'Purchase verification failed';
    case ErrorCode.PurchaseVerificationFinished:
      return 'Purchase verification already finished';
    case ErrorCode.PurchaseVerificationFinishFailed:
      return 'Failed to complete purchase verification';
    case ErrorCode.EmptySkuList:
      return 'No product IDs provided';
    case ErrorCode.InitConnection:
      return 'Failed to initialize billing connection';
    case ErrorCode.IapNotAvailable:
      return 'In-app purchases are not available on this device';
    case ErrorCode.QueryProduct:
      return 'Failed to query products. Please try again later.';
    default:
      return typeof error === 'object' && error?.message
        ? error.message
        : 'An unexpected error occurred';
  }
}
