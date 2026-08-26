// Pure helpers for outbound delivery: destination URL safety, retry schedule
// and payload signing. Kept free of Convex types so they unit-test directly.

/** Attempt budget before a delivery becomes dead-letter. */
export const MAX_DELIVERY_ATTEMPTS = 8;

/** Receivers must reject signatures older than this to blunt replay. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export const SIGNATURE_HEADER = "openiap-signature";
export const TIMESTAMP_HEADER = "openiap-timestamp";
export const EVENT_ID_HEADER = "openiap-event-id";
export const DELIVERY_ID_HEADER = "openiap-delivery-id";

/**
 * Exponential backoff with a cap. Attempt 1 retries after ~30s and the last
 * attempt lands a bit over a day out, which covers a receiver's overnight
 * outage without holding rows forever.
 */
export function nextAttemptDelayMs(attempt: number): number {
  const base = 30_000;
  const capped = Math.min(attempt, 12);
  return Math.min(base * 2 ** Math.max(0, capped - 1), 6 * 60 * 60 * 1000);
}

export type UrlRejection =
  | "not-a-url"
  | "scheme-not-https"
  | "host-not-public"
  | "credentials-in-url";

export type UrlCheck =
  | { ok: true; url: URL }
  | { ok: false; reason: UrlRejection };

// Blocks the obvious SSRF shapes. This is a guard, not a substitute for
// network egress policy: DNS can still resolve a public name to a private
// address, so a hardened deployment should also restrict egress.
const PRIVATE_V4 =
  /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

export function checkDestinationUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "not-a-url" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: "scheme-not-https" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "credentials-in-url" };
  }
  const host = url.hostname.toLowerCase();
  const bracketless = host.replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    PRIVATE_V4.test(host) ||
    bracketless === "::1" ||
    bracketless.startsWith("fc") ||
    bracketless.startsWith("fd") ||
    bracketless.startsWith("fe80:")
  ) {
    return { ok: false, reason: "host-not-public" };
  }
  return { ok: true, url };
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * `v1=<hex>` over `"<timestamp>.<body>"`. The timestamp is inside the signed
 * material so a captured body cannot be replayed with a fresh header.
 */
export async function signPayload(
  secret: string,
  timestampSeconds: number,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestampSeconds}.${body}`),
  );
  return `v1=${toHex(signature)}`;
}

/**
 * During rotation a destination signs with both keys so a receiver that has
 * only rolled one side still validates. Receivers accept if any value matches.
 */
export async function signPayloadWithRotation(
  secrets: { current: string; previous?: string },
  timestampSeconds: number,
  body: string,
): Promise<string> {
  const current = await signPayload(secrets.current, timestampSeconds, body);
  if (!secrets.previous) return current;
  const previous = await signPayload(secrets.previous, timestampSeconds, body);
  return `${current},${previous}`;
}

/** HTTP outcomes worth retrying. 4xx other than 408/429 are permanent. */
export function isRetryableStatus(status: number): boolean {
  if (status === 408 || status === 429) return true;
  return status >= 500;
}
