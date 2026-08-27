// Pure helpers and shared tuning constants for outbound delivery: destination
// URL safety, retry schedule and payload signing. Kept free of Convex types so
// they unit-test directly, and so the claim mutation and the "use node" HTTP
// action can share one set of numbers.

/** Attempt budget before a delivery becomes dead-letter. */
export const MAX_DELIVERY_ATTEMPTS = 14;
export const COMMERCE_EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Rows one worker pass claims. */
export const CLAIM_BATCH_LIMIT = 25;

/** Per-request ceiling in the HTTP half. */
export const REQUEST_TIMEOUT_MS = 10_000;

/**
 * The worker claims one row immediately before each send. The margin absorbs
 * DNS, TLS and result-recording round trips around the request timeout.
 */
export const LEASE_MS = REQUEST_TIMEOUT_MS + 60_000;

/** Receivers reject older signatures, then dedupe `openiap-event-id`. */
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

function ipv4Number(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map(Number);
  if (
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }
  return (
    ((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3]
  );
}

function inIpv4Range(value: number, base: number, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (base & mask);
}

/** True only for globally routable IPv4/IPv6 literals. */
export function isPublicIpAddress(rawAddress: string): boolean {
  const address = rawAddress.toLowerCase().replace(/^\[|\]$/g, "");
  const embedded = embeddedIpv4(address);
  if (embedded) return isPublicIpAddress(embedded);

  const v4 = ipv4Number(address);
  if (v4 !== null) {
    const blocked: Array<[string, number]> = [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.88.99.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ];
    return !blocked.some(([base, bits]) =>
      inIpv4Range(v4, ipv4Number(base)!, bits),
    );
  }

  if (!address.includes(":")) return false;
  const groups = address.split(":");
  const first = Number.parseInt(groups[0] || "0", 16);
  if (first < 0x2000 || first > 0x3fff) return false;
  const second = Number.parseInt(groups[1] || "0", 16);
  if (first === 0x2001 && (second <= 0x1ff || second === 0xdb8)) {
    return false;
  }
  if (first === 0x2002) return false;
  if (first === 0x3fff && second < 0x1000) return false;
  return true;
}

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
  const host = rawHostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
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
  if (ipv4Number(host) !== null || host.includes(":")) {
    return !isPublicIpAddress(v6);
  }
  return false;
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
  if (url.hostname.endsWith(".")) {
    url.hostname = url.hostname.slice(0, -1);
  }
  // Fragments are never part of an HTTP request target; do not store a value
  // that the worker will silently send differently.
  url.hash = "";
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
