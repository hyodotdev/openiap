export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function hmacSha256Hex(
  keyValue: string,
  value: string,
): Promise<string> {
  const key = await hmacKey(keyValue, "sign");
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function verifyHmacSha256Hex(
  keyValue: string,
  value: string,
  signature: string,
): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  const bytes = Uint8Array.from({ length: 32 }, (_, index) =>
    parseInt(signature.slice(index * 2, index * 2 + 2), 16),
  );
  return crypto.subtle.verify(
    "HMAC",
    await hmacKey(keyValue, "verify"),
    bytes,
    new TextEncoder().encode(value),
  );
}

async function hmacKey(
  value: string,
  usage: "sign" | "verify",
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(value),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}
