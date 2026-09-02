import {getUserFriendlyErrorMessage} from '../../../src/utils/errorMapping';

/**
 * Extract error message from various error formats
 * Handles standard Error objects and IAPKit-style error responses
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'string' ||
    typeof error === 'number' ||
    typeof error === 'boolean'
  ) {
    return String(error);
  }

  if (
    error &&
    typeof error === 'object' &&
    'errors' in error &&
    Array.isArray((error as {errors: unknown[]}).errors)
  ) {
    const errors = (error as {errors: {message?: string}[]}).errors;
    return errors[0]?.message || JSON.stringify(errors[0]) || 'Unknown error';
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as {message: unknown}).message);
  }

  return String(error ?? 'Unknown error');
}

function isErrorCode(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function extractErrorCode(error: unknown, fallbackCode: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    isErrorCode((error as {code: unknown}).code)
  ) {
    return (error as {code: string}).code;
  }

  const message = extractErrorMessage(error);
  const envelopeIndex = message.indexOf('OPENIAP_ERROR_JSON:');
  if (envelopeIndex >= 0) {
    const match = message
      .slice(envelopeIndex)
      .match(/"code"\s*:\s*"([a-z0-9]+(?:-[a-z0-9]+)*)"/);
    if (match?.[1]) {
      return match[1];
    }
  }

  return fallbackCode;
}

export function formatErrorForDisplay(
  error: unknown,
  fallbackCode: string,
  includeDebugDetails: boolean = __DEV__,
): string {
  if (includeDebugDetails) {
    return extractErrorMessage(error);
  }

  const code = extractErrorCode(error, fallbackCode);
  const message = getUserFriendlyErrorMessage({code});
  return `${message} (Error code: ${code})`;
}
