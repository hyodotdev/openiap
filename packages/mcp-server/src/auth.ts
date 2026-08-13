export const INSUFFICIENT_API_KEY_SCOPE_MESSAGE =
  "This operation requires an IAPKit secret admin key (openiap-kit_sk_...). Publishable and legacy keys cannot access MCP administrative operations.";

/** MCP administration accepts only explicitly typed secret keys. */
export function isSecretApiKey(apiKey: string | null | undefined): boolean {
  return apiKey?.startsWith("openiap-kit_sk_") === true;
}
