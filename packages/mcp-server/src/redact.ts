import { createHash } from "node:crypto";

const OPENIAP_API_KEY_PATTERN = /\bopeniap-kit_[A-Za-z0-9_-]+\b/g;
const AUTHORIZATION_SCHEME_HEADER_PATTERN =
  /\b((?:authorization|proxy-authorization)\s*:\s*[A-Za-z][A-Za-z0-9._-]*\s+)(?!<)([^\s"',;}]+)/gi;
const AUTHORIZATION_VALUE_HEADER_PATTERN =
  /\b((?:authorization|proxy-authorization)\s*:\s*)(?![A-Za-z][A-Za-z0-9._-]*\s+)(?!<)([^\s"',;}]+)/gi;
const COOKIE_HEADER_PATTERN =
  /(^|[\s,{])(cookie\s*:\s*)(?!<)(.*?)(?=\s+(?:authorization|proxy-authorization|set-cookie|x-api-key|x-openiap-api-key)\s*:|$)/gi;
const SENSITIVE_HEADER_PATTERN =
  /\b((?:set-cookie|x-api-key|x-openiap-api-key)\s*:\s*)(?!<)([^\s"',;}]+)/gi;
const SENSITIVE_QUERY_PARAM_PATTERN =
  /([?&](?:access[-_]?token|api[-_]?key|authorization|id[-_]?token|jwt|refresh[-_]?token|token)=)(?!<)[^&#\s"']*/gi;
const KIT_API_KEY_PATH_PATTERN =
  /((?:\/api)?\/v1\/(?:products|subscriptions\/(?:status|entitlements|list|metrics|bind-user)|webhooks(?:\/(?:apple|google|stream))?)\/)(?!<)[^\/?#\s"']+/g;

const SENSITIVE_FIELD_NAMES = new Set([
  "apikey",
  "access_token",
  "accesstoken",
  "appsecret",
  "authorization",
  "cookie",
  "externaltoken",
  "externaltransactiontoken",
  "horizonappsecret",
  "idtoken",
  "jws",
  "jwt",
  "keycontent",
  "password",
  "privatekey",
  "proxyauthorization",
  "purchasetoken",
  "rawmessage",
  "rawsignedpayload",
  "refreshtoken",
  "secret",
  "setcookie",
  "signedpayload",
  "token",
  "xapikey",
  "xopeniapapikey",
]);

export function redactSensitivePayload(value: unknown, key?: string): unknown {
  if (
    key &&
    SENSITIVE_FIELD_NAMES.has(key.replace(/[_-]/g, "").toLowerCase())
  ) {
    return summarizeSecret(value);
  }
  if (typeof value === "string") {
    return redactSensitiveString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitivePayload(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactSensitivePayload(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

function redactSensitiveString(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.stringify(redactSensitivePayload(JSON.parse(value)));
    } catch {
      // Fall through to token-pattern redaction for non-JSON strings.
    }
  }
  return value
    .replace(KIT_API_KEY_PATH_PATTERN, (match, prefix) => {
      return match.includes("<") ? match : `${prefix}<api-key-redacted>`;
    })
    .replace(AUTHORIZATION_SCHEME_HEADER_PATTERN, (_match, prefix, token) => {
      if (String(token).includes("<")) return `${prefix}${token}`;
      return `${prefix}${String(summarizeSecret(token))}`;
    })
    .replace(AUTHORIZATION_VALUE_HEADER_PATTERN, (_match, prefix, token) => {
      if (String(token).includes("<")) return `${prefix}${token}`;
      return `${prefix}${String(summarizeSecret(token))}`;
    })
    .replace(COOKIE_HEADER_PATTERN, (_match, leading, prefix, value) => {
      return `${leading}${prefix}${String(summarizeSecret(value.trim()))}`;
    })
    .replace(SENSITIVE_HEADER_PATTERN, (_match, prefix, value) => {
      return `${prefix}${String(summarizeSecret(value))}`;
    })
    .replace(SENSITIVE_QUERY_PARAM_PATTERN, (_match, prefix) => {
      return `${prefix}<redacted>`;
    })
    .replace(OPENIAP_API_KEY_PATTERN, (match) =>
      String(summarizeSecret(match)),
    );
}

function summarizeSecret(value: unknown): unknown {
  if (typeof value !== "string") return value == null ? value : "<redacted>";
  if (value.length === 0) return "";
  const fingerprint = createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 12);
  return `<redacted len=${value.length} sha256=${fingerprint}>`;
}
