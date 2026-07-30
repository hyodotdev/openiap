/**
 * Error mapping utilities for expo-iap.
 * Provides helpers for working with platform-specific error codes
 * and constructing structured purchase errors.
 */

import {
  ErrorCode,
  type IapPlatform,
  type SubResponseCodeAndroid,
} from '../types';

const toKebabCase = (str: string): string => {
  if (str.includes('_')) {
    return str
      .split('_')
      .map((word) => word.toLowerCase())
      .join('-');
  } else {
    return str
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
  }
};

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

/**
 * Prefix shared with the native Expo bridges. Expo Modules only transports an
 * exception code and message for rejected async functions, so native bridges
 * append the canonical PurchaseError payload to the message with this marker.
 */
export const OPENIAP_ERROR_ENVELOPE_PREFIX = 'OPENIAP_ERROR_JSON:';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | undefined =>
  typeof value === 'object' && value !== null
    ? (value as UnknownRecord)
    : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const asStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value.filter(
        (candidate): candidate is string => typeof candidate === 'string',
      )
    : undefined;

const parseNativeErrorEnvelope = (
  message: string,
): UnknownRecord | undefined => {
  const markerIndex = message.indexOf(OPENIAP_ERROR_ENVELOPE_PREFIX);
  if (markerIndex < 0) return undefined;

  try {
    return asRecord(
      JSON.parse(
        message.slice(markerIndex + OPENIAP_ERROR_ENVELOPE_PREFIX.length),
      ),
    );
  } catch {
    return undefined;
  }
};

const normalizePlatform = (platform: IapPlatform): 'ios' | 'android' =>
  typeof platform === 'string' && platform.toLowerCase() === 'ios'
    ? 'ios'
    : 'android';

const COMMON_ERROR_CODE_MAP: Record<ErrorCode, string> = {
  [ErrorCode.Unknown]: ErrorCode.Unknown,
  [ErrorCode.UserCancelled]: ErrorCode.UserCancelled,
  [ErrorCode.UserError]: ErrorCode.UserError,
  [ErrorCode.ItemUnavailable]: ErrorCode.ItemUnavailable,
  [ErrorCode.RemoteError]: ErrorCode.RemoteError,
  [ErrorCode.NetworkError]: ErrorCode.NetworkError,
  [ErrorCode.ServiceError]: ErrorCode.ServiceError,
  [ErrorCode.NotPrepared]: ErrorCode.NotPrepared,
  [ErrorCode.NotEnded]: ErrorCode.NotEnded,
  [ErrorCode.AlreadyOwned]: ErrorCode.AlreadyOwned,
  [ErrorCode.DeveloperError]: ErrorCode.DeveloperError,
  [ErrorCode.BillingResponseJsonParseError]:
    ErrorCode.BillingResponseJsonParseError,
  [ErrorCode.DeferredPayment]: ErrorCode.DeferredPayment,
  [ErrorCode.Interrupted]: ErrorCode.Interrupted,
  [ErrorCode.IapNotAvailable]: ErrorCode.IapNotAvailable,
  [ErrorCode.PurchaseError]: ErrorCode.PurchaseError,
  [ErrorCode.SyncError]: ErrorCode.SyncError,
  [ErrorCode.TransactionValidationFailed]:
    ErrorCode.TransactionValidationFailed,
  [ErrorCode.ActivityUnavailable]: ErrorCode.ActivityUnavailable,
  [ErrorCode.AlreadyPrepared]: ErrorCode.AlreadyPrepared,
  [ErrorCode.Pending]: ErrorCode.Pending,
  [ErrorCode.ConnectionClosed]: ErrorCode.ConnectionClosed,
  [ErrorCode.InitConnection]: ErrorCode.InitConnection,
  [ErrorCode.ServiceDisconnected]: ErrorCode.ServiceDisconnected,
  [ErrorCode.QueryProduct]: ErrorCode.QueryProduct,
  [ErrorCode.SkuNotFound]: ErrorCode.SkuNotFound,
  [ErrorCode.SkuOfferMismatch]: ErrorCode.SkuOfferMismatch,
  [ErrorCode.ItemNotOwned]: ErrorCode.ItemNotOwned,
  [ErrorCode.BillingUnavailable]: ErrorCode.BillingUnavailable,
  [ErrorCode.FeatureNotSupported]: ErrorCode.FeatureNotSupported,
  [ErrorCode.DuplicatePurchase]: ErrorCode.DuplicatePurchase,
  [ErrorCode.ServiceTimeout]: ErrorCode.ServiceTimeout,
  [ErrorCode.EmptySkuList]: ErrorCode.EmptySkuList,
  [ErrorCode.PurchaseVerificationFailed]: ErrorCode.PurchaseVerificationFailed,
  [ErrorCode.PurchaseVerificationFinishFailed]:
    ErrorCode.PurchaseVerificationFinishFailed,
  [ErrorCode.PurchaseVerificationFinished]:
    ErrorCode.PurchaseVerificationFinished,
};

export const ErrorCodeMapping = {
  ios: COMMON_ERROR_CODE_MAP,
  android: COMMON_ERROR_CODE_MAP,
} as const;

const OPENIAP_ERROR_CODE_SET: Set<string> = new Set(Object.values(ErrorCode));

const HISTORICAL_ERROR_CODE_INPUTS: Record<string, ErrorCode> = {
  RECEIPT_FAILED: ErrorCode.PurchaseVerificationFailed,
  E_RECEIPT_FAILED: ErrorCode.PurchaseVerificationFailed,
  RECEIPT_FINISHED: ErrorCode.PurchaseVerificationFinished,
  E_RECEIPT_FINISHED: ErrorCode.PurchaseVerificationFinished,
  RECEIPT_FINISHED_FAILED: ErrorCode.PurchaseVerificationFinishFailed,
  E_RECEIPT_FINISHED_FAILED: ErrorCode.PurchaseVerificationFinishFailed,
};

const historicalErrorCode = (code: string): ErrorCode | undefined =>
  HISTORICAL_ERROR_CODE_INPUTS[
    code
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/-/g, '_')
      .toUpperCase()
  ];

// Legacy Google Play Billing response codes accepted by older JS call sites.
// Native ERROR_CODES constants are code -> message tables, not response-code maps.
const LEGACY_ANDROID_RESPONSE_CODES = new Map<number, ErrorCode>([
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

export const createPurchaseError = (
  props: PurchaseErrorProps,
): PurchaseError => {
  const errorCode = props.code
    ? typeof props.code === 'string' || typeof props.code === 'number'
      ? ErrorCodeUtils.fromPlatformCode(props.code, props.platform || 'ios')
      : props.code
    : undefined;

  const error = new Error(
    props.message ?? 'Unknown error occurred',
  ) as PurchaseError;
  error.name = '[expo-iap]: PurchaseError';
  error.responseCode = props.responseCode;
  error.debugMessage = props.debugMessage;
  error.code = errorCode;
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
): PurchaseError => {
  const normalizedPlatform = normalizePlatform(platform);
  const errorCode = errorData.code
    ? typeof errorData.code === 'string' || typeof errorData.code === 'number'
      ? ErrorCodeUtils.fromPlatformCode(errorData.code, normalizedPlatform)
      : errorData.code
    : ErrorCode.Unknown;

  return createPurchaseError({
    message: errorData.message ?? 'Unknown error occurred',
    responseCode: errorData.responseCode,
    debugMessage: errorData.debugMessage,
    code: errorCode,
    productId: errorData.productId,
    productIds: errorData.productIds,
    productType: errorData.productType,
    isEmptyProductList: errorData.isEmptyProductList,
    subResponseCodeAndroid: errorData.subResponseCodeAndroid,
    platform,
  });
};

/**
 * Rebuild a canonical PurchaseError from an Expo Modules Promise rejection.
 *
 * Native Expo async functions cannot attach arbitrary fields to the rejected
 * JavaScript Error. The iOS and Android bridges therefore place the complete
 * payload in a marked JSON envelope inside the rejection message. This helper
 * also accepts direct fields so the Vega/Onside adapters and older native
 * builds continue to work.
 */
export const createPurchaseErrorFromNativeException = (
  error: unknown,
  platform: IapPlatform,
  fallback: PurchaseErrorProps = {},
): PurchaseError => {
  const direct = asRecord(error) ?? {};
  const nativeMessage =
    asString(direct.message) ??
    (typeof error === 'string' ? error : undefined) ??
    fallback.message ??
    'Unknown error occurred';
  const envelope = parseNativeErrorEnvelope(nativeMessage) ?? {};

  const envelopePlatform = asString(envelope.platform);
  const resolvedPlatform: IapPlatform =
    envelopePlatform === 'ios' || envelopePlatform === 'android'
      ? envelopePlatform
      : platform;
  const subResponseCode =
    asString(envelope.subResponseCodeAndroid) ??
    asString(direct.subResponseCodeAndroid) ??
    fallback.subResponseCodeAndroid;

  return createPurchaseErrorFromPlatform(
    {
      code:
        asString(envelope.code) ??
        asNumber(envelope.code) ??
        asString(direct.code) ??
        asNumber(direct.code) ??
        fallback.code ??
        ErrorCode.Unknown,
      message: asString(envelope.message) ?? fallback.message ?? nativeMessage,
      debugMessage:
        asString(envelope.debugMessage) ??
        asString(direct.debugMessage) ??
        fallback.debugMessage,
      responseCode:
        asNumber(envelope.responseCode) ??
        asNumber(direct.responseCode) ??
        fallback.responseCode,
      productId:
        asString(envelope.productId) ??
        asString(direct.productId) ??
        fallback.productId,
      productIds:
        asStringArray(envelope.productIds) ??
        asStringArray(direct.productIds) ??
        fallback.productIds,
      productType:
        asString(envelope.productType) ??
        asString(direct.productType) ??
        fallback.productType,
      isEmptyProductList:
        asBoolean(envelope.isEmptyProductList) ??
        asBoolean(direct.isEmptyProductList) ??
        fallback.isEmptyProductList,
      subResponseCodeAndroid: subResponseCode as
        SubResponseCodeAndroid | undefined,
      platform: resolvedPlatform,
    },
    resolvedPlatform,
  );
};

export const ErrorCodeUtils = {
  // OpenIAP native bridges already exchange canonical error-code strings.
  getNativeErrorCode: (errorCode: ErrorCode): string => errorCode,
  fromPlatformCode: (
    platformCode: string | number | null | undefined,
    platform: IapPlatform,
  ): ErrorCode => {
    if (platformCode == null) {
      return ErrorCode.Unknown;
    }
    if (typeof platformCode === 'number') {
      return normalizePlatform(platform) === 'android'
        ? (LEGACY_ANDROID_RESPONSE_CODES.get(platformCode) ?? ErrorCode.Unknown)
        : ErrorCode.Unknown;
    }
    const historical = historicalErrorCode(platformCode);
    if (historical) {
      return historical;
    }
    const normalized = toKebabCase(platformCode.replace(/^E_/i, ''));
    return OPENIAP_ERROR_CODE_SET.has(normalized)
      ? (normalized as ErrorCode)
      : ErrorCode.Unknown;
  },
  toPlatformCode: (
    errorCode: ErrorCode,
    _platform: IapPlatform,
  ): string | number => errorCode,
  isValidForPlatform: (errorCode: ErrorCode, _platform: IapPlatform): boolean =>
    OPENIAP_ERROR_CODE_SET.has(errorCode),
};

// ---------------------------------------------------------------------------
// Convenience helpers for interpreting error objects
// ---------------------------------------------------------------------------

type ErrorLike = string | {code?: ErrorCode | string; message?: string};

const ERROR_CODES = new Set<string>(Object.values(ErrorCode));

const normalizeErrorCode = (code?: string | null): string | undefined => {
  if (!code) {
    return undefined;
  }

  if (ERROR_CODES.has(code)) {
    return code;
  }

  const historical = historicalErrorCode(code);
  if (historical) {
    return historical;
  }

  const camelCased = toKebabCase(code);
  if (ERROR_CODES.has(camelCased)) {
    return camelCased;
  }

  if (code.startsWith('E_')) {
    const trimmed = code.substring(2);
    if (ERROR_CODES.has(trimmed)) {
      return trimmed;
    }
    const camelTrimmed = toKebabCase(trimmed);
    if (ERROR_CODES.has(camelTrimmed)) {
      return camelTrimmed;
    }
  }

  return code;
};

function extractCode(error: unknown): string | undefined {
  if (typeof error === 'string') {
    return normalizeErrorCode(error);
  }

  if (error && typeof error === 'object' && 'code' in error) {
    return normalizeErrorCode((error as {code?: string}).code);
  }

  return undefined;
}

export function isUserCancelledError(error: unknown): boolean {
  return extractCode(error) === ErrorCode.UserCancelled;
}

export function isNetworkError(error: unknown): boolean {
  const networkErrors: ErrorCode[] = [
    ErrorCode.NetworkError,
    ErrorCode.RemoteError,
    ErrorCode.ServiceError,
    ErrorCode.ServiceDisconnected,
    ErrorCode.BillingUnavailable,
  ];

  const code = extractCode(error);
  return !!code && (networkErrors as string[]).includes(code);
}

export function isRecoverableError(error: unknown): boolean {
  const recoverableErrors: ErrorCode[] = [
    ErrorCode.NetworkError,
    ErrorCode.RemoteError,
    ErrorCode.ServiceError,
    ErrorCode.Interrupted,
    ErrorCode.ServiceDisconnected,
    ErrorCode.BillingUnavailable,
    ErrorCode.QueryProduct,
    ErrorCode.InitConnection,
  ];

  const code = extractCode(error);
  return !!code && (recoverableErrors as string[]).includes(code);
}

export function getUserFriendlyErrorMessage(error: ErrorLike): string {
  const errorCode = extractCode(error);

  switch (errorCode) {
    case ErrorCode.UserCancelled:
      return 'Purchase was cancelled by user';
    case ErrorCode.NetworkError:
      return 'Network connection error. Please check your internet connection and try again.';
    case ErrorCode.PurchaseVerificationFinished:
      return 'Purchase verification already finished';
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
    case ErrorCode.EmptySkuList:
      return 'No product IDs provided';
    case ErrorCode.InitConnection:
      return 'Failed to initialize billing connection';
    case ErrorCode.QueryProduct:
      return 'Failed to query products. Please try again later.';
    default: {
      if (error && typeof error === 'object' && 'message' in error) {
        return (
          (error as {message?: string}).message ??
          'An unexpected error occurred'
        );
      }
      return 'An unexpected error occurred';
    }
  }
}
