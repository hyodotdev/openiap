import type {IapPlatform, SubResponseCodeAndroid} from '../types';
import {ErrorCode} from '../types';
import {
  createPurchaseErrorFromPlatform,
  type PurchaseError,
  type PurchaseErrorProps,
} from './errorMapping';

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

/**
 * Rebuild a canonical PurchaseError from a Capacitor plugin rejection. The
 * native plugins reject with the OpenIAP error code and put the full
 * PurchaseError payload in the rejection's `data`.
 */
export const createPurchaseErrorFromNativeException = (
  error: unknown,
  platform: IapPlatform,
  fallback: PurchaseErrorProps = {},
): PurchaseError => {
  const direct = asRecord(error) ?? {};
  const payload = asRecord(direct.data) ?? {};
  const nativeMessage =
    asString(direct.message) ??
    (typeof error === 'string' ? error : undefined) ??
    fallback.message ??
    'Unknown error occurred';

  const payloadPlatform = asString(payload.platform);
  const resolvedPlatform: IapPlatform =
    payloadPlatform === 'ios' || payloadPlatform === 'android'
      ? payloadPlatform
      : platform;

  return createPurchaseErrorFromPlatform(
    {
      code:
        asString(payload.code) ??
        asNumber(payload.code) ??
        asString(direct.code) ??
        fallback.code ??
        ErrorCode.Unknown,
      message: asString(payload.message) ?? nativeMessage,
      debugMessage: asString(payload.debugMessage) ?? fallback.debugMessage,
      responseCode: asNumber(payload.responseCode) ?? fallback.responseCode,
      productId: asString(payload.productId) ?? fallback.productId,
      productIds: asStringArray(payload.productIds) ?? fallback.productIds,
      productType: asString(payload.productType) ?? fallback.productType,
      isEmptyProductList:
        asBoolean(payload.isEmptyProductList) ?? fallback.isEmptyProductList,
      subResponseCodeAndroid: (asString(payload.subResponseCodeAndroid) ??
        fallback.subResponseCodeAndroid) as SubResponseCodeAndroid | undefined,
      platform: resolvedPlatform,
    },
    resolvedPlatform,
  );
};

/**
 * Run a native call and rethrow its rejection as a PurchaseError. JavaScript
 * errors without a native code keep their identity.
 */
export const invokeNativeWithPurchaseError = async <T>(
  operation: () => Promise<T>,
  platform: IapPlatform,
  fallback: PurchaseErrorProps = {},
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    const nativeError = asRecord(error);
    if (nativeError?.code === undefined && nativeError?.data === undefined) {
      throw error;
    }
    throw createPurchaseErrorFromNativeException(error, platform, fallback);
  }
};
