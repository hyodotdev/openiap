/**
 * Error utilities for parsing platform-specific error responses
 */

import {ErrorCode} from '../types';

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
 * - iOS: JSON string or plain message
 * - Legacy: "CODE: message" format
 *
 * @param errorString - The error string from native module
 * @returns Parsed error object with code and message
 */
export function parseErrorStringToJsonObj(
  errorString: string | Error | unknown,
): IapError {
  // Handle Error objects
  if (errorString instanceof Error) {
    const errorWithFields = errorString as Error & Partial<IapError>;
    if (
      errorWithFields.code != null ||
      errorWithFields.responseCode != null ||
      errorWithFields.debugMessage != null ||
      errorWithFields.productId != null
    ) {
      const parsed: IapError = {
        code: String(errorWithFields.code ?? ErrorCode.Unknown),
        message: errorString.message,
      };
      if (errorWithFields.responseCode !== undefined) {
        parsed.responseCode = errorWithFields.responseCode;
      }
      if (errorWithFields.debugMessage !== undefined) {
        parsed.debugMessage = errorWithFields.debugMessage;
      }
      if (errorWithFields.productId !== undefined) {
        parsed.productId = errorWithFields.productId;
      }
      if (errorWithFields.productIds !== undefined) {
        parsed.productIds = errorWithFields.productIds;
      }
      if (errorWithFields.productType !== undefined) {
        parsed.productType = errorWithFields.productType;
      }
      if (errorWithFields.isEmptyProductList !== undefined) {
        parsed.isEmptyProductList = errorWithFields.isEmptyProductList;
      }
      return parsed;
    }
    errorString = errorString.message;
  }

  // Handle non-string inputs
  if (typeof errorString !== 'string') {
    return {
      code: ErrorCode.Unknown,
      message: 'Unknown error occurred',
    };
  }

  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(errorString);
    if (typeof parsed === 'object' && parsed !== null) {
      // Ensure it has at least code and message
      return {
        code: parsed.code || ErrorCode.Unknown,
        message: parsed.message || errorString,
        ...parsed,
      };
    }
  } catch {
    // Not JSON, continue with other formats
  }

  // Try to parse "CODE: message" format
  const colonIndex = errorString.indexOf(':');
  if (colonIndex > 0 && colonIndex < 50) {
    // Reasonable position for error code
    const potentialCode = errorString.substring(0, colonIndex).trim();
    // Check if it looks like an error code (starts with E_ or contains uppercase)
    if (potentialCode.startsWith('E_') || /^[A-Z_]+$/.test(potentialCode)) {
      return {
        code: potentialCode,
        message: errorString.substring(colonIndex + 1).trim(),
      };
    }
  }

  // Fallback: treat entire string as message
  return {
    code: ErrorCode.Unknown,
    message: errorString,
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

  return (
    errorObj.code === ErrorCode.UserCancelled ||
    errorObj.code === 'E_USER_CANCELED' || // Alternative spelling
    errorObj.responseCode === 1
  ); // Android BillingClient.BillingResponseCode.USER_CANCELED
}

// Re-export from errorMapping for public API convenience
export {
  isDuplicatePurchaseError,
  DUPLICATE_PURCHASE_CODE,
} from './errorMapping';
