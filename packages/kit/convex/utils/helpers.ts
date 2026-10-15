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
