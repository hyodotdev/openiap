import type {PurchaseError, SubResponseCodeAndroid} from '../types';
import {
  normalizeErrorCodeFromNative,
  type PurchaseErrorProps,
} from './errorMapping';

const SUB_RESPONSE_CODES = {
  'no-applicable-sub-response-code': true,
  'payment-declined-due-to-insufficient-funds': true,
  'user-ineligible': true,
} satisfies Record<SubResponseCodeAndroid, true>;

// Validate the schema independently of the public parser's legacy defaults.
export const normalizePurchaseError = (
  error: unknown,
  fallbackMessage = 'Unknown error occurred',
): PurchaseErrorProps & Pick<PurchaseError, 'code' | 'message'> => {
  const payload: Record<string, unknown> =
    typeof error === 'object' && error !== null
      ? (error as Record<string, unknown>)
      : {};
  if (typeof payload.message === 'string') {
    fallbackMessage = payload.message;
  } else if (typeof error === 'string') {
    fallbackMessage = error;
  }
  const subResponseCode = payload.subResponseCodeAndroid;
  const productIds = Array.isArray(payload.productIds)
    ? Array.from(payload.productIds)
    : undefined;

  return {
    code: normalizeErrorCodeFromNative(payload.code),
    message:
      typeof payload.message === 'string' ? payload.message : fallbackMessage,
    productId:
      typeof payload.productId === 'string' ? payload.productId : undefined,
    debugMessage:
      typeof payload.debugMessage === 'string'
        ? payload.debugMessage
        : undefined,
    responseCode:
      typeof payload.responseCode === 'number' &&
      Number.isInteger(payload.responseCode) &&
      payload.responseCode >= -2147483648 &&
      payload.responseCode <= 2147483647
        ? payload.responseCode
        : undefined,
    productIds: productIds?.every((id: unknown) => typeof id === 'string')
      ? productIds
      : undefined,
    productType:
      typeof payload.productType === 'string' ? payload.productType : undefined,
    isEmptyProductList:
      typeof payload.isEmptyProductList === 'boolean'
        ? payload.isEmptyProductList
        : undefined,
    subResponseCodeAndroid:
      typeof subResponseCode === 'string' &&
      Object.prototype.hasOwnProperty.call(SUB_RESPONSE_CODES, subResponseCode)
        ? (subResponseCode as SubResponseCodeAndroid)
        : undefined,
    platform:
      payload.platform === 'ios' || payload.platform === 'android'
        ? payload.platform
        : undefined,
  };
};
