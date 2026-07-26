import type { ApiKeyType } from "../apiKeys/helpers";

export function generateApiKey(keyType: ApiKeyType): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  const prefix = keyType === "publishable" ? "pk" : "sk";
  return `openiap-kit_${prefix}_${hex}`;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
