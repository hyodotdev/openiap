// Pure helpers and shared tuning constants for outbound delivery: destination
// URL safety, retry schedule and payload signing. Kept free of Convex types so
// they unit-test directly, and so the claim mutation and the "use node" HTTP
// action can share one set of numbers.

/** Attempt budget before a delivery becomes dead-letter. */
export const MAX_DELIVERY_ATTEMPTS = 8;

/** Rows one worker pass claims. */
export const CLAIM_BATCH_LIMIT = 25;

/** Per-request ceiling in the HTTP half. */
export const REQUEST_TIMEOUT_MS = 10_000;

/**
 * The worker sends its batch sequentially, so the lease has to cover the whole
 * batch — not one request — or later rows expire mid-flight and the next tick
 * reclaims a delivery that is still running. The margin absorbs mutation
 * round-trips between sends.
 */
export const LEASE_MS = CLAIM_BATCH_LIMIT * REQUEST_TIMEOUT_MS + 60_000;

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

/**
 * `URL` canonicalizes `[::ffff:127.0.0.1]` to `[::ffff:7f00:1]`, so a textual
 * private-IPv4 check never fires on the mapped spelling even though `fetch`
 * still reaches loopback. Recover the embedded IPv4 from the trailing hextets
 * so one policy covers both spellings.
 */
function embeddedIpv4(hostname: string): string | null {
  if (!hostname.includes(":")) return null;
  const groups = hostname.split(":");
  const tail = groups.slice(-2);
  if (tail.length < 2) return null;
  if (tail.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  // Only ::ffff:x:y (mapped) and ::x:y (deprecated compatible) embed IPv4.
  const prefix = groups.slice(0, -2).join(":").toLowerCase().replace(/^:+/, "");
  if (prefix !== "" && prefix !== "ffff") return null;
  const [high, low] = tail.map((group) => parseInt(group, 16));
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
}

function isPrivateHost(rawHostname: string): boolean {
  const host = rawHostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    PRIVATE_V4.test(host)
  ) {
    return true;
  }
  const v6 = host.replace(/^\[|\]$/g, "");
  if (
    v6 === "::1" ||
    v6 === "::" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe80:")
  ) {
    return true;
  }
  const embedded = embeddedIpv4(v6);
  return embedded !== null && PRIVATE_V4.test(embedded);
}

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
  if (isPrivateHost(url.hostname)) {
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
