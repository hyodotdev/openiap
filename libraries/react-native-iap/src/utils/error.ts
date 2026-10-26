/**
 * Error utilities for parsing platform-specific error responses
 */

import {ErrorCode} from '../types';
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

const parseJsonPayload = (
  payload: string,
  fallbackMessage: string,
  stringEncoded = false,
): IapError | null => {
  const trimmed = payload.trim();
  const candidates = [trimmed];

  if (/^\{\s*\\"/.test(trimmed)) {
    if (stringEncoded) {
      try {
        const decoded: unknown = JSON.parse(`"${trimmed}"`);
        if (typeof decoded === 'string') {
          candidates.push(decoded);
        }
      } catch {
        // Try the other NSError fields when the quoted payload is malformed.
      }
    } else {
      candidates.push(trimmed.replace(/\\"/g, '"'));
    }
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed === 'object' && parsed !== null) {
        const parsedError = parsed as Partial<IapError>;
        return {
          ...parsedError,
          code: parsedError.code || ErrorCode.Unknown,
          message: parsedError.message || fallbackMessage,
        };
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
};

const extractBalancedJsonObject = (
  value: string,
  startIndex: number,
  stringEncoded = false,
): string | null => {
  for (let index = startIndex; index < value.length; index += 1) {
    if (value[index] !== '}') {
      continue;
    }

    const candidate = value.substring(startIndex, index + 1);
    if (parseJsonPayload(candidate, value, stringEncoded)) {
      return candidate;
    }
  }

  return null;
};

const parseNSErrorJsonPayload = (rawString: string): IapError | null => {
  const payloads: {value: string; stringEncoded: boolean}[] = [];
  const quotedPayloadMatch = /Code=-?\d+\s+"/.exec(rawString);

  if (quotedPayloadMatch?.index !== undefined) {
    const contentStart =
      quotedPayloadMatch.index + quotedPayloadMatch[0].length;
    const userInfoIndex = rawString.indexOf('UserInfo=', contentStart);
    const contentEnd =
      userInfoIndex > contentStart
        ? rawString.lastIndexOf('"', userInfoIndex)
        : rawString.lastIndexOf('"');

    if (contentEnd > contentStart) {
      payloads.push({
        value: rawString.substring(contentStart, contentEnd),
        stringEncoded: true,
      });
    }
  }

  const localizedDescription = 'NSLocalizedDescription=';
  const descriptionIndex = rawString.indexOf(localizedDescription);

  if (descriptionIndex >= 0) {
    let valueStart = descriptionIndex + localizedDescription.length;
    while (/\s/.test(rawString[valueStart] ?? '')) {
      valueStart += 1;
    }

    const firstBraceIndex = rawString.indexOf('{', valueStart);
    if (firstBraceIndex >= 0 && firstBraceIndex <= valueStart + 2) {
      const stringEncoded = rawString[valueStart] === '"';
      const payload = extractBalancedJsonObject(
        rawString,
        firstBraceIndex,
        stringEncoded,
      );
      if (payload) {
        payloads.push({value: payload, stringEncoded});
      }
    }
  }

  for (const {value, stringEncoded} of payloads) {
    const parsed = parseJsonPayload(value, rawString, stringEncoded);
    if (parsed?.code && parsed.code !== ErrorCode.Unknown) {
      return parsed;
    }
  }

  return null;
};

const parseStructuredError = (error: object): IapError | null => {
  const errorWithCode = error as {code?: unknown; message?: unknown} & Record<
    string,
    unknown
  >;

  if (errorWithCode.code != null) {
    const {code, message, ...extraFields} = errorWithCode;
    const normalizedCode = String(code);

    return {
      ...extraFields,
      code: normalizedCode || ErrorCode.Unknown,
      message:
        typeof message === 'string' && message
          ? message
          : 'Unknown error occurred',
    };
  }

  return null;
};

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
  // Nitro can reject with either Error instances or plain structured objects.
  if (typeof errorString === 'object' && errorString !== null) {
    const structuredError = parseStructuredError(errorString);
    if (structuredError) {
      return structuredError;
    }
  }

  // Parse an Error's message after checking for attached structured fields.
  if (errorString instanceof Error) {
    errorString = errorString.message;
  }

  // Handle non-string inputs
  if (typeof errorString !== 'string') {
    return {
      code: ErrorCode.Unknown,
      message: 'Unknown error occurred',
    };
  }

  const jsonPayload = parseJsonPayload(errorString, errorString);
  if (jsonPayload) {
    return jsonPayload;
  }

  // fbjni appends cause stacks after the Android error JSON.
  const trimmedError = errorString.trimStart();
  if (trimmedError.startsWith('{')) {
    const payload = extractBalancedJsonObject(trimmedError, 0);
    const parsed = payload && parseJsonPayload(payload, errorString);
    if (parsed) {
      return parsed;
    }
  }

  const nsErrorPayload = parseNSErrorJsonPayload(errorString);
  if (nsErrorPayload) {
    return nsErrorPayload;
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

  // responseCode 1 is Android BillingResponseCode.USER_CANCELED.
  return isUserCancelledCode(errorObj) || errorObj.responseCode === 1;
}

// Re-export from errorMapping for public API convenience
export {
  isDuplicatePurchaseError,
  DUPLICATE_PURCHASE_CODE,
} from './errorMapping';
