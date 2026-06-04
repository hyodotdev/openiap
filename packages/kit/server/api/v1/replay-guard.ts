import { createMiddleware } from "hono/factory";
import * as crypto from "node:crypto";

import { parsePositiveNumber } from "../../utils/env";

// Per-(apiKey, payload) replay-burst guard. Sits downstream of the
// per-key burst limiter in `rate-limit.ts` — that layer blocks
// "any hammer on this key", this layer blocks the narrower pattern
// "same receipt submitted over and over". A real client legitimately
// re-verifies the same receipt (app launch, subscription renewal
// check, retry after transient 5xx), but sustained same-payload
// traffic is almost always either a buggy retry loop or someone
// replaying one captured receipt to burn our upstream quota.
//
// The bucket is tuned so normal retry patterns don't trip it:
//   - Capacity 30: a debug loop or app-restart storm can hit the
//     same receipt up to 30 times before we care.
//   - Refill 1 / 60s: sustained rate past the burst is capped at
//     ~1/min for a given (key, payload) pair — below anything real
//     subscription polling would do.
// Tune via REPLAY_GUARD_CAPACITY / REPLAY_GUARD_REFILL_PER_SEC if
// the logs show a legitimate pattern getting blocked.
//
// Cross-machine note: same caveat as rate-limit.ts — the bucket is
// per-machine. Fly's min_machines_running=1 makes it effectively
// global today; if the fleet scales out, a determined attacker could
// fan their replay across machines. That's acceptable: the monthly
// cap in Convex is the final backstop, and this layer's job is to
// cheaply drop the common case, not to be bypass-proof.

export interface ReplayBucket {
  tokens: number;
  lastRefillMs: number;
  // Set when the most recent verify call for this (key, payload)
  // returned `isValid: false`. Subsequent
  // requests for the exact same payload are short-circuited with
  // `REPEATED_FAILURE` until the cooldown expires — re-asking
  // Apple / Google / Meta about a receipt they already rejected, or
  // retrying the same failed product-match guard, has no chance of
  // changing the answer in seconds.
  lastFailureMs?: number;
}

export interface ReplayGuardConfig {
  capacity: number;
  refillPerSecond: number;
  maxStoreSize: number;
  /** Cooldown after a failed verification of the same payload. Defaults
   * are tuned for the common case where the store provider's verdict for
   * a given receipt is stable for far longer than this window. */
  failureCooldownMs: number;
  now?: () => number;
  store?: Map<string, ReplayBucket>;
}

export type ReplayRejectReason = "burst" | "repeated_failure";

export interface ReplayConsumeResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  reason?: ReplayRejectReason;
}

/**
 * Hash the request body's store-specific identifier so the bucket map
 * doesn't retain the plaintext JWS / purchaseToken / (userId, sku).
 * SHA-256 prefix matches the approach used by `hashApiKey`.
 */
export function hashPayload(
  body:
    | { store: "apple"; jws: string; expectedProductId?: string }
    | { store: "google"; purchaseToken: string; expectedProductId?: string }
    | { store: "horizon"; userId: string; sku: string },
): string {
  const hasher = crypto.createHash("sha256");
  hasher.update(body.store);
  hasher.update("\0");
  switch (body.store) {
    case "apple":
      hasher.update(body.jws);
      if (body.expectedProductId !== undefined) {
        hasher.update("\0");
        hasher.update(body.expectedProductId);
      }
      break;
    case "google":
      hasher.update(body.purchaseToken);
      if (body.expectedProductId !== undefined) {
        hasher.update("\0");
        hasher.update(body.expectedProductId);
      }
      break;
    case "horizon":
      hasher.update(body.userId);
      hasher.update("\0");
      hasher.update(body.sku);
      break;
  }
  return hasher.digest("hex").slice(0, 16);
}

function evictIfNeeded(
  store: Map<string, ReplayBucket>,
  maxSize: number,
): void {
  while (store.size > maxSize) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) return;
    store.delete(oldest);
  }
}

export function tryConsumeReplay(
  store: Map<string, ReplayBucket>,
  bucketKey: string,
  capacity: number,
  refillPerSecond: number,
  nowMs: number,
  maxStoreSize: number,
  failureCooldownMs: number = 0,
): ReplayConsumeResult {
  const bucket = store.get(bucketKey);

  if (!bucket) {
    store.set(bucketKey, { tokens: capacity - 1, lastRefillMs: nowMs });
    evictIfNeeded(store, maxStoreSize);
    return { allowed: true, remaining: capacity - 1, retryAfterSec: 0 };
  }

  store.delete(bucketKey);
  store.set(bucketKey, bucket);

  // Failure cooldown takes precedence over the token-bucket check —
  // a known-invalid payload should never reach the upstream store
  // while the cooldown is active, even if the bucket happens to have
  // tokens. This is the layer that defeats "captured-then-revoked
  // receipt replay": the attacker has a real-shaped receipt that
  // the store provider said no to, and trying again 200 ms later just
  // burns our upstream quota for the same answer.
  if (failureCooldownMs > 0 && bucket.lastFailureMs !== undefined) {
    const elapsedSinceFailureMs = Math.max(0, nowMs - bucket.lastFailureMs);
    if (elapsedSinceFailureMs < failureCooldownMs) {
      const remainingMs = failureCooldownMs - elapsedSinceFailureMs;
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.max(1, Math.ceil(remainingMs / 1000)),
        reason: "repeated_failure",
      };
    }
  }

  const elapsedSec = Math.max(0, (nowMs - bucket.lastRefillMs) / 1000);
  const refilled = Math.min(
    capacity,
    bucket.tokens + elapsedSec * refillPerSecond,
  );

  if (refilled >= 1) {
    bucket.tokens = refilled - 1;
    bucket.lastRefillMs = nowMs;
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfterSec: 0,
    };
  }

  bucket.tokens = refilled;
  bucket.lastRefillMs = nowMs;
  const missing = 1 - refilled;
  const retryAfterSec = Math.max(1, Math.ceil(missing / refillPerSecond));
  return {
    allowed: false,
    remaining: 0,
    retryAfterSec,
    reason: "burst",
  };
}

/**
 * Mark the (key, payload) bucket as having just observed a failed
 * verification. Called from the middleware's finally block when the
 * handler explicitly set `verifyOutcome.isValid = false` — i.e. the
 * upstream store (Apple / Google / Meta) returned a definitive "this
 * receipt is invalid" verdict. Thrown errors from the handler (network
 * failures, configuration mistakes, project-not-found, etc.) do NOT
 * trigger the cooldown, since those aren't a verdict from the store
 * and a retry might legitimately succeed.
 *
 * Creates the bucket if needed — a payload can fail on its very first
 * call, and we still want subsequent retries of the same payload to
 * hit the cooldown.
 */
export function markPayloadFailure(
  store: Map<string, ReplayBucket>,
  bucketKey: string,
  capacity: number,
  nowMs: number,
  maxStoreSize: number,
): void {
  const existing = store.get(bucketKey);
  if (existing) {
    store.delete(bucketKey);
    existing.lastFailureMs = nowMs;
    store.set(bucketKey, existing);
    return;
  }
  store.set(bucketKey, {
    tokens: capacity,
    lastRefillMs: nowMs,
    lastFailureMs: nowMs,
  });
  evictIfNeeded(store, maxStoreSize);
}

const DEFAULT_CAPACITY = parsePositiveNumber(
  process.env.REPLAY_GUARD_CAPACITY,
  30,
  1,
);
const DEFAULT_REFILL_PER_SEC = parsePositiveNumber(
  process.env.REPLAY_GUARD_REFILL_PER_SEC,
  1 / 60,
  1 / 3600,
);
// 50k (key, payload) pairs ≈ ~2 MB of resident memory. Keyed on the
// hash of both, an attacker would need to churn pairs faster than
// legitimate traffic to blow past LRU eviction. Tunable by env.
const DEFAULT_MAX_STORE_SIZE = parsePositiveNumber(
  process.env.REPLAY_GUARD_MAX_STORE,
  50_000,
  1,
);
// Default failure cooldown: 5 minutes. Long enough that "replay the
// same revoked receipt" attacks see a hard wall well past any
// reasonable client-side retry-on-transient cadence; short enough
// that if the store provider really did re-validate a previously-
// failed receipt (rare but possible during outages), the client
// recovers within one app session.
const DEFAULT_FAILURE_COOLDOWN_MS =
  parsePositiveNumber(process.env.REPLAY_GUARD_FAILURE_COOLDOWN_SEC, 300, 1) *
  1000;

const sharedStore = new Map<string, ReplayBucket>();

type ReplayGuardVars = {
  apiKeyHash?: string;
  verifyOutcome?: { isValid: boolean; state: string };
};

export function replayGuardMiddleware(
  config: Partial<ReplayGuardConfig> = {},
): ReturnType<typeof createMiddleware<{ Variables: ReplayGuardVars }>> {
  const capacity = config.capacity ?? DEFAULT_CAPACITY;
  const refillPerSecond = config.refillPerSecond ?? DEFAULT_REFILL_PER_SEC;
  const maxStoreSize = config.maxStoreSize ?? DEFAULT_MAX_STORE_SIZE;
  const failureCooldownMs =
    config.failureCooldownMs ?? DEFAULT_FAILURE_COOLDOWN_MS;
  const store = config.store ?? sharedStore;
  const clock = config.now ?? (() => Date.now());

  return createMiddleware<{ Variables: ReplayGuardVars }>(async (c, next) => {
    const apiKeyHash = c.var.apiKeyHash;

    // `rateLimitMiddleware` sets `apiKeyHash`. If we ever see an
    // unset hash here, the middleware chain was wired in the wrong
    // order — surface as 500 rather than silently skipping the
    // guard (which would let replay traffic through on a deploy
    // that regressed the order).
    if (!apiKeyHash) {
      return c.json(
        {
          errors: [
            {
              code: "INTERNAL_MISCONFIGURATION",
              message:
                "Replay guard ran before the API key hash was populated.",
            },
          ],
        },
        500,
      );
    }

    // Valid-by-schema by the time this runs — the valibot validator
    // upstream guarantees one of the three discriminated shapes.
    const body = c.req.valid("json" as never) as
      | { store: "apple"; jws: string; expectedProductId?: string }
      | { store: "google"; purchaseToken: string; expectedProductId?: string }
      | { store: "horizon"; userId: string; sku: string };

    const bucketKey = `${apiKeyHash}:${hashPayload(body)}`;
    const result = tryConsumeReplay(
      store,
      bucketKey,
      capacity,
      refillPerSecond,
      clock(),
      maxStoreSize,
      failureCooldownMs,
    );

    if (!result.allowed) {
      c.header("Retry-After", String(result.retryAfterSec));
      const code =
        result.reason === "repeated_failure"
          ? "REPEATED_FAILURE"
          : "DUPLICATE_PAYLOAD";
      const message =
        result.reason === "repeated_failure"
          ? `This receipt payload was just rejected; the same payload won't be re-verified for ${result.retryAfterSec}s. If you believe this is wrong, wait the cooldown then retry — store verdicts and product-match guard results almost never change within seconds.`
          : `Too many verifications for the same payload from this API key. Legitimate clients re-verify a receipt at most a handful of times per minute. Retry after ${result.retryAfterSec}s, or cache the previous result on your side.`;
      return c.json(
        {
          errors: [{ code, message }],
        },
        429,
      );
    }

    try {
      await next();
    } finally {
      // After the handler completes, mark the bucket if the upstream
      // verification returned invalid. Lives in `finally` so an exception
      // bubbling out of the handler doesn't skip the marking step —
      // we only mark on the explicit `isValid: false` signal so
      // configuration / network errors aren't conflated with stable
      // receipt or product-match failures.
      const outcome = c.get("verifyOutcome");
      if (outcome && outcome.isValid === false) {
        markPayloadFailure(store, bucketKey, capacity, clock(), maxStoreSize);
      }
    }
  });
}
