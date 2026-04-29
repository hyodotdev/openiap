// Retry helper for transient failures against external purchase APIs
// (Google Play Android Publisher, in practice — but the contract is
// provider-agnostic). Retries ONLY on network/5xx errors so that 4xx
// responses, which are deterministic user/config errors, fail fast and
// aren't silently re-attempted.
//
// Why a custom helper and not, say, `p-retry`:
// - Convex actions run in Node.js ("use node") with a hard execution
//   budget. Our retry policy is intentionally conservative (max 3
//   attempts, sub-second backoff) to stay inside that budget.
// - Injectable `sleep` lets tests run synchronously.

export interface RetryOptions {
  /** Total attempts, including the initial call. Default: 3. */
  maxAttempts?: number;
  /** Base backoff in ms between attempts. Default: 200. */
  baseDelayMs?: number;
  /** Upper bound on any single backoff delay. Default: 2000. */
  maxDelayMs?: number;
  /** Injectable sleep used for tests; defaults to real setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /** Override the default retry predicate. Default retries on 5xx / network errors. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 200;
const DEFAULT_MAX_DELAY_MS = 2_000;

const TRANSIENT_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EPIPE",
]);

function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract an HTTP status from the various shapes googleapis / gaxios
 * errors arrive in. Returns `undefined` when this is not an HTTP-
 * flavored error (e.g. a thrown Error from our own code).
 */
export function extractHttpStatus(error: unknown): number | undefined {
  if (error === null || typeof error !== "object") {
    return undefined;
  }

  const asRecord = error as {
    code?: unknown;
    status?: unknown;
    response?: { status?: unknown } | undefined;
  };

  // gaxios puts the numeric HTTP status on `.code` — this is what the
  // Google Play client throws.
  if (typeof asRecord.code === "number") {
    return asRecord.code;
  }

  // Some libraries use `.status` directly.
  if (typeof asRecord.status === "number") {
    return asRecord.status;
  }

  // Fall back to nested response object.
  if (
    asRecord.response &&
    typeof asRecord.response === "object" &&
    typeof asRecord.response.status === "number"
  ) {
    return asRecord.response.status;
  }

  return undefined;
}

function hasNetworkErrorCode(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && TRANSIENT_NETWORK_CODES.has(code);
}

/**
 * Default predicate: retry on HTTP 5xx and on Node-style transient
 * network errors. Never retry on 4xx — those are deterministic (bad
 * input, missing auth, not found, etc.) and re-issuing the call wastes
 * quota.
 */
export function isTransientHttpError(error: unknown): boolean {
  const status = extractHttpStatus(error);
  if (typeof status === "number" && status >= 500 && status < 600) {
    return true;
  }
  return hasNetworkErrorCode(error);
}

/**
 * Execute `fn`, retrying with exponential backoff + light jitter when
 * `shouldRetry` returns true. Jitter prevents a thundering herd if many
 * Convex actions hit Google Play at once during an outage.
 */
export async function retryOnTransient<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = opts.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const sleep = opts.sleep ?? realSleep;
  const shouldRetry = opts.shouldRetry ?? isTransientHttpError;

  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      return await fn();
    } catch (error) {
      if (attempt >= maxAttempts || !shouldRetry(error, attempt)) {
        throw error;
      }
      const exponent = attempt - 1;
      const raw = baseDelayMs * Math.pow(2, exponent);
      const capped = Math.min(raw, maxDelayMs);
      // Full jitter in [0.5, 1.0) of the capped delay — smooths retry
      // bursts without extending worst-case wait beyond the cap.
      const jittered = capped * (0.5 + Math.random() * 0.5);
      await sleep(jittered);
    }
  }
}
