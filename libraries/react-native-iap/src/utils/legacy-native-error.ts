import {normalizePurchaseError} from './native-error';

const parseJsonPayload = (payload: string): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>;
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
): Record<string, unknown> | null => {
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
          const parsed = parseJsonPayload(decoded);
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
  return payload ? parseJsonPayload(payload) : null;
};

const parseNSErrorJsonPayload = (
  rawString: string,
): Record<string, unknown> | null => {
  if (!rawString.trimStart().startsWith('Error Domain=')) {
    return null;
  }
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

export function readNativeErrorPayload(errorString: string | Error | unknown): {
  payload: Record<string, unknown>;
  fallbackMessage: string;
} {
  if (
    typeof errorString === 'object' &&
    errorString !== null &&
    'code' in errorString &&
    errorString.code != null
  ) {
    const {code, message, ...extraFields} = errorString as Record<
      string,
      unknown
    >;
    return {
      payload: {
        ...extraFields,
        code: String(code),
        message: typeof message === 'string' ? message : undefined,
      },
      fallbackMessage: 'Unknown error occurred',
    };
  }

  // Parse an Error's message after checking for attached structured fields.
  if (errorString instanceof Error) {
    errorString = errorString.message;
  }

  // Handle non-string inputs
  if (typeof errorString !== 'string') {
    return {payload: {}, fallbackMessage: 'Unknown error occurred'};
  }

  const jsonPayload = parseJsonPayload(errorString);
  if (jsonPayload) {
    return {payload: jsonPayload, fallbackMessage: errorString};
  }

  // Older Android builds used the standard Java exception prefix (#3075).
  const prefix = 'java.lang.Exception:';
  const start = skipWhitespace(errorString, 0);
  const payloadStart = errorString.startsWith(prefix, start)
    ? start + prefix.length
    : start;
  const leadingPayload = parseNativePayloadAt(errorString, payloadStart);
  if (leadingPayload) {
    return {payload: leadingPayload, fallbackMessage: errorString};
  }
  // A broken leading payload must not borrow a code from its message or cause.
  const firstCharacter = errorString[skipWhitespace(errorString, payloadStart)];
  if (firstCharacter === '{' || firstCharacter === '"') {
    return {payload: {}, fallbackMessage: errorString};
  }

  const nsErrorPayload = parseNSErrorJsonPayload(errorString);
  if (nsErrorPayload) {
    return {payload: nsErrorPayload, fallbackMessage: errorString};
  }

  // Try to parse "CODE: message" format
  const colonIndex = errorString.indexOf(':');
  if (colonIndex > 0 && colonIndex < 50) {
    // Reasonable position for error code
    const potentialCode = errorString.substring(0, colonIndex).trim();
    // Check if it looks like an error code (starts with E_ or contains uppercase)
    if (potentialCode.startsWith('E_') || /^[A-Z_]+$/.test(potentialCode)) {
      return {
        payload: {
          code: potentialCode,
          message: errorString.substring(colonIndex + 1).trim(),
        },
        fallbackMessage: errorString,
      };
    }
  }

  // Fallback: treat entire string as message
  return {payload: {}, fallbackMessage: errorString};
}

// Only binaries without RnIapProtocol require decoding exception descriptions.
export const parseNativePurchaseError = (error: unknown) => {
  const {payload, fallbackMessage} = readNativeErrorPayload(error);
  return normalizePurchaseError(payload, fallbackMessage);
};
