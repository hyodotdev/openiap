import type {IapPlatform, SubResponseCodeAndroid} from '../types';
import {ErrorCode} from '../types';
import {
  createPurchaseErrorFromPlatform,
  type PurchaseError,
  type PurchaseErrorProps,
} from './errorMapping';

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

// On iOS, Expo appends " (at <file>:<line>)" to a rejected function's message,
// so the envelope is rarely the end of the string. Take the object and stop there.
const sliceEnvelopeObject = (payload: string): string | undefined => {
  const start = payload.indexOf('{');
  if (start < 0) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < payload.length; index += 1) {
    const character = payload[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (character === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return payload.slice(start, index + 1);
    }
  }
  return undefined;
};

const parseNativeErrorEnvelope = (
  message: string,
): UnknownRecord | undefined => {
  const markerIndex = message.indexOf(OPENIAP_ERROR_ENVELOPE_PREFIX);
  if (markerIndex < 0) return undefined;

  const envelope = sliceEnvelopeObject(
    message.slice(markerIndex + OPENIAP_ERROR_ENVELOPE_PREFIX.length),
  );
  if (envelope === undefined) return undefined;

  try {
    return asRecord(JSON.parse(envelope));
  } catch {
    return undefined;
  }
};

/**
 * Rebuild a canonical PurchaseError from an Expo Modules Promise rejection,
 * read from the message envelope (see OPENIAP_ERROR_ENVELOPE_PREFIX). Direct
 * fields are accepted too, for the Vega/Onside adapters and older native builds.
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
        | SubResponseCodeAndroid
        | undefined,
      platform: resolvedPlatform,
    },
    resolvedPlatform,
  );
};

/**
 * Run a native call and rethrow its OpenIAP rejection as a PurchaseError.
 * JavaScript errors without native error fields keep their identity.
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
    const nativeMessage =
      asString(nativeError?.message) ?? asString(error) ?? '';
    const hasCanonicalFields =
      nativeMessage.includes(OPENIAP_ERROR_ENVELOPE_PREFIX) ||
      nativeError?.code !== undefined ||
      nativeError?.responseCode !== undefined ||
      nativeError?.debugMessage !== undefined ||
      nativeError?.productId !== undefined ||
      nativeError?.productIds !== undefined;

    if (!hasCanonicalFields) throw error;
    throw createPurchaseErrorFromNativeException(error, platform, fallback);
  }
};
