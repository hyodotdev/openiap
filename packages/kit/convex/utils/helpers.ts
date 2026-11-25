import type { ApiKeyType } from "../apiKeys/helpers";

/** Hex of `byteCount` cryptographically random bytes. */
export function randomHex(byteCount = 32): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function generateApiKey(keyType: ApiKeyType): string {
  const prefix = keyType === "publishable" ? "pk" : "sk";
  return `openiap-kit_${prefix}_${randomHex()}`;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export const SESSION_PROJECT_PREFIX = "session-project:";

/** A CLI session's project pointer, which is not a key. */
export function isSessionProjectKey(apiKey: string): boolean {
  return apiKey.startsWith(SESSION_PROJECT_PREFIX);
}

/** Where IAPKit is served, without a trailing slash. */
export function publicBaseUrl(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return (
    env.IAPKIT_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ||
    "https://kit.openiap.dev"
  );
}

/** `IAPKIT_VERIFICATION_SOURCE_SECRET` must be 32 random bytes in hex. */
export function verificationSourceConfigured(
  secret: string | undefined,
): secret is string {
  return Boolean(secret && /^[a-f0-9]{64}$/.test(secret));
}
