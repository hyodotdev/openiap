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
): IapError | null => {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed === 'object' && parsed !== null) {
      const parsedError = parsed as Partial<IapError>;
      return {
        ...parsedError,
        code: parsedError.code || ErrorCode.Unknown,
        message: parsedError.message || fallbackMessage,
      };
    }
  } catch {
    // Native descriptions can contain text around the JSON value.
  }

  return null;
};

const readJsonValue = (
  value: string,
  startIndex: number,
  escapedQuotes = false,
): string | null => {
  const opening = value[startIndex];
  if (opening !== '{' && opening !== '"') {
    return null;
  }

  let json = opening;
  let depth = opening === '{' ? 1 : 0;
  let inString = opening === '"';
  let escaped = false;

  for (let index = startIndex + 1; index < value.length; index += 1) {
    let character = value[index]!;
    // Preserve the quote-only escaping accepted by the legacy NSError adapter.
    if (escapedQuotes && character === '\\' && value[index + 1] === '"') {
      character = '"';
      index += 1;
    }
    json += character;

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
        if (opening === '"') {
          return json;
        }
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return json;
      }
    } else if (character === '\\') {
      return null;
    }
  }

  return null;
};

const skipWhitespace = (value: string, startIndex: number): number => {
  const remaining = value.slice(startIndex);
  return startIndex + remaining.length - remaining.trimStart().length;
};

const parseNativePayloadAt = (
  value: string,
  startIndex: number,
): IapError | null => {
  let start = skipWhitespace(value, startIndex);
  const escapedPresentationQuote =
    value[start] === '\\' && value[start + 1] === '"';
  if (escapedPresentationQuote) {
    start = skipWhitespace(value, start + 2);
  }
  const quoted = value[start] === '"';

  if (quoted) {
    const jsonString = readJsonValue(value, start);
    if (jsonString) {
      try {
        const decoded: unknown = JSON.parse(jsonString);
        if (typeof decoded === 'string') {
          const parsed = parseJsonPayload(decoded, value);
          if (parsed) {
            return parsed;
          }
        }
      } catch {
        // NSError also displays raw JSON inside unescaped presentation quotes.
      }
    }
    start = skipWhitespace(value, start + 1);
  }

  if (value[start] !== '{') {
    return null;
  }
  const keyStart = skipWhitespace(value, start + 1);
  const escapedQuotes =
    escapedPresentationQuote ||
    (!quoted && value[keyStart] === '\\' && value[keyStart + 1] === '"');
  const payload = readJsonValue(value, start, escapedQuotes);
  return payload ? parseJsonPayload(payload, value) : null;
};

const parseNSErrorJsonPayload = (rawString: string): IapError | null => {
  const quotedPayloadMatch = /Code=-?\d+\s+"/.exec(rawString);
  let descriptionStart = 0;

  if (quotedPayloadMatch) {
    const start = quotedPayloadMatch.index + quotedPayloadMatch[0].length - 1;
    const parsed = parseNativePayloadAt(rawString, start);
    if (parsed) {
      return parsed;
    }
    const quotedText = readJsonValue(rawString, start);
    if (quotedText) {
      descriptionStart = start + quotedText.length;
    }
  }

  const userInfoIndex = rawString.indexOf('UserInfo={', descriptionStart);
  if (userInfoIndex < 0) {
    return null;
  }
  const marker = 'NSLocalizedDescription=';
  const descriptionIndex = rawString.indexOf(marker, userInfoIndex);
  return descriptionIndex < 0
    ? null
    : parseNativePayloadAt(rawString, descriptionIndex + marker.length);
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

  // Older Android builds used the standard Java exception prefix (#3075).
  const prefix = 'java.lang.Exception:';
  const start = skipWhitespace(errorString, 0);
  const payloadStart = errorString.startsWith(prefix, start)
    ? start + prefix.length
    : start;
  const leadingPayload = parseNativePayloadAt(errorString, payloadStart);
  if (leadingPayload) {
    return leadingPayload;
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
