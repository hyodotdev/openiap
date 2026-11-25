export const MISSING_API_KEY_MESSAGE =
  "Send Authorization: Bearer <IAPKit secret admin key> (openiap-kit_sk_...).";

export const INSUFFICIENT_API_KEY_SCOPE_MESSAGE =
  "This operation requires an IAPKit secret admin key (openiap-kit_sk_...). Publishable and legacy keys cannot access MCP administrative operations.";

/** IAPKit's OAuth access tokens; any other bearer is checked as an API key. */
export const OAUTH_ACCESS_TOKEN_PREFIX = "iapkit_oat_";

/** MCP administration accepts only explicitly typed secret keys. */
export function isSecretApiKey(apiKey: string | null | undefined): boolean {
  return apiKey?.startsWith("openiap-kit_sk_") === true;
}

export const READ_SCOPE = "iapkit:read";
export const WRITE_SCOPE = "iapkit:write";

export const READ_ONLY_GRANT_MESSAGE =
  "This connection is read-only. Reconnect IAPKit and allow changes to use this tool.";
