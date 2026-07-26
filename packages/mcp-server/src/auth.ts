export const INSUFFICIENT_API_KEY_SCOPE_MESSAGE =
  "This operation requires a secret admin key. Publishable mobile keys cannot access MCP administrative operations.";

/**
 * A publishable prefix is safe to use as an early-deny signal. Successful
 * authorization still belongs to IAPKit's persisted key lookup, so an
 * arbitrary secret-looking or legacy token never gains access from its
 * prefix alone.
 */
export function isPublishableApiKey(apiKey: string | null | undefined) {
  return apiKey?.startsWith("openiap-kit_pk_") === true;
}
