/**
 * Error utilities for parsing platform-specific error responses
 */

import {ErrorCode} from '../types';
import {readNativeErrorPayload} from './legacy-native-error';
import {isUserCancelledError as isUserCancelledCode} from './errorMapping';

export interface IapError {
  code: string;
  message: string;
  responseCode?: number;
  debugMessage?: string;
  productId?: string;
  productIds?: string[];
  productType?: string;
  isEmptyProductList?: boolean;
  [key: string]: any; // Allow additional platform-specific fields
}

/**
 * Parses error string from native modules into a structured error object
 *
 * Native modules return errors in different formats:
 * - Android: JSON string like '{"code":"E_USER_CANCELLED","message":"User cancelled the purchase","responseCode":1}'
 * - iOS: JSON string, Nitro NSError string with embedded JSON, or plain message
 * - Legacy: "CODE: message" format
 *
 * @param errorString - The error string from native module
 * @returns Parsed error object with code and message
 */
export function parseErrorStringToJsonObj(
  errorString: string | Error | unknown,
): IapError {
  const {payload, fallbackMessage} = readNativeErrorPayload(errorString);
  const parsedError = payload as Partial<IapError>;
  return {
    ...parsedError,
    code:
      typeof parsedError.code === 'string' && parsedError.code
        ? parsedError.code
        : ErrorCode.Unknown,
    message:
      typeof parsedError.message === 'string' && parsedError.message
        ? parsedError.message
        : fallbackMessage,
  };
}

/**
 * Checks if an error code indicates user cancellation
 * @param error - Error object or string
 * @returns true if the error is a user cancellation
 */
export function isUserCancelledError(
  error: IapError | string | Error | unknown,
): boolean {
  const errorObj =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as IapError)
      : parseErrorStringToJsonObj(error);

  // responseCode 1 is Android BillingResponseCode.USER_CANCELED.
  return isUserCancelledCode(errorObj) || errorObj.responseCode === 1;
}

// Re-export from errorMapping for public API convenience
export {
  isDuplicatePurchaseError,
  DUPLICATE_PURCHASE_CODE,
} from './errorMapping';
