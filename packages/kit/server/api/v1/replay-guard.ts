import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import * as crypto from "node:crypto";

import { parsePositiveNumber } from "../../utils/env";

// Per-(apiKey, payload) replay guard, behind the per-key limiter in
// `rate-limit.ts`. Clients re-verify a receipt now and then (launch, renewal
// check, retry after a 5xx); sustained same-payload traffic is a retry loop
// or a captured receipt replayed to burn upstream quota.
//
// Defaults allow a burst of 30, then ~1 per minute per (key, payload), below
// any real subscription polling. Tune REPLAY_GUARD_CAPACITY and
// REPLAY_GUARD_REFILL_PER_SEC if logs show legitimate traffic blocked.
//
// Buckets are per machine, effectively global while Fly runs one machine.
// Replay fanned across machines is acceptable: the Convex monthly cap is the
// backstop, and this layer only needs to drop the common case cheaply.

export interface ReplayBucket {
  tokens: number;
  lastRefillMs: number;
  // Set when the last verify of this (key, payload) was a stable rejection,
  // including a failed product-match guard. Until the cooldown ends the same
  // payload gets `REPEATED_FAILURE` without asking the store again, so a
  // replayed revoked receipt can't burn quota by pacing under the burst cap.
  lastFailureMs?: number;
}

export interface ReplayGuardConfig {
  capacity: number;
  refillPerSecond: number;
  maxStoreSize: number;
  /** Cooldown after a stable rejection of the same payload. */
  failureCooldownMs: number;
  now?: () => number;
  store?: Map<string, ReplayBucket>;
  /**
   * Supplies the payload to key the bucket on. Defaults to the valibot
   * validator's parsed body (`c.req.valid("json")`); the commerce binding,
   * which parses and validates its own body, injects it here instead.
   */
  getPayload?: (c: Context) => ReplayPayload;
  /** Renders the 429 body; defaults to the /v1 error envelope. */
  respond?: (
    c: Context,
    info: { reason: ReplayRejectReason; retryAfterSec: number },
  ) => Response;
}

export type ReplayRejectReason = "burst" | "repeated_failure";

// Settled store verdicts. Anything else stays retryable unless the verifier
// marks it stable: Google's UNKNOWN covers both an unrecognized state and the
// explicit 410 revoked-token response, and only the latter is settled.
const STABLE_REJECTION_STATES = new Set([
  "INAUTHENTIC",
  "CANCELED",
  "EXPIRED",
  "CONSUMED",
]);

/**
 * Whether a rejected verification arms the failure cooldown. Settled verdicts
 * (INAUTHENTIC, CANCELED, EXPIRED) don't change in seconds; others can.
 */
export function isStableRejection(
  state: string,
  explicitStableRejection = false,
): boolean {
  return (
    explicitStableRejection || STABLE_REJECTION_STATES.has(state.toUpperCase())
  );
}

export interface ReplayConsumeResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  reason?: ReplayRejectReason;
}

export type ReplayPayload =
  | { store: "apple"; jws: string; expectedProductId?: string }
  | { store: "google"; purchaseToken: string; expectedProductId?: string }
  | { store: "horizon"; userId: string; sku: string }
  | {
      store: "amazon";
      userId: string;
      receiptId: string;
      sandbox?: boolean;
      expectedProductId?: string;
    };

/**
 * Hashed so the bucket map never holds a plaintext JWS, purchase token, or
 * (userId, sku). A SHA-256 prefix, like `hashApiKey`.
 */
export function hashPayload(body: ReplayPayload): string {
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
    case "amazon":
      hasher.update(body.userId);
      hasher.update("\0");
      hasher.update(body.receiptId);
      hasher.update("\0");
      hasher.update(body.sandbox === true ? "sandbox" : "production");
      if (body.expectedProductId !== undefined) {
        hasher.update("\0");
        hasher.update(body.expectedProductId);
      }
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

  // The cooldown applies even when the bucket has tokens: a rejected payload
  // must not reach the store again until it ends.
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
 * Starts the failure cooldown after the store definitively rejects a payload.
 * Thrown handler errors (network, config, missing project) never get here:
 * they aren't a store verdict, and a retry may succeed. Creates the bucket,
 * since a payload can fail on its first call.
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
// 50k (key, payload) pairs ≈ 2 MB, LRU-evicted; pushing real buckets out
// takes churning new pairs faster than legitimate traffic arrives.
const DEFAULT_MAX_STORE_SIZE = parsePositiveNumber(
  process.env.REPLAY_GUARD_MAX_STORE,
  50_000,
  1,
);
// 5 minutes: longer than any sane retry cadence, short enough that a receipt
// the store re-validates (rare, during outages) recovers within one session.
const DEFAULT_FAILURE_COOLDOWN_MS =
  parsePositiveNumber(process.env.REPLAY_GUARD_FAILURE_COOLDOWN_SEC, 300, 1) *
  1000;

const sharedStore = new Map<string, ReplayBucket>();

/**
 * The process-wide store and defaults, shared with the commerce verification
 * admission so a receipt spends one bucket whichever binding it came through.
 */
export const REPLAY_GUARD = Object.freeze({
  store: sharedStore,
  capacity: DEFAULT_CAPACITY,
  refillPerSecond: DEFAULT_REFILL_PER_SEC,
  maxStoreSize: DEFAULT_MAX_STORE_SIZE,
  failureCooldownMs: DEFAULT_FAILURE_COOLDOWN_MS,
});

type ReplayGuardVars = {
  apiKeyHash?: string;
  verifyOutcome?: {
    isValid: boolean;
    state: string;
    stableRejection?: boolean;
  };
  verifyCapacityRejected?: boolean;
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
  const getPayload = config.getPayload ?? ((c) => c.req.valid("json" as never));

  function refundCapacityRejectedAttempt(bucketKey: string): void {
    const bucket = store.get(bucketKey);
    if (!bucket) {
      // LRU churn can evict an in-flight request's bucket. Its absence already
      // gives the next request a fresh bucket, so recreating it is unnecessary.
      return;
    }
    store.delete(bucketKey);
    bucket.tokens = Math.min(capacity, bucket.tokens + 1);
    store.set(bucketKey, bucket);
  }

  return createMiddleware<{ Variables: ReplayGuardVars }>(async (c, next) => {
    const apiKeyHash = c.var.apiKeyHash;

    // `rateLimitMiddleware` sets this. Missing means the chain is misordered;
    // a 500 beats silently letting replay traffic through.
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

    // Already schema-validated (valibot for /v1, JSON Schema for commerce).
    const body = getPayload(c);

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
      if (config.respond && result.reason) {
        return config.respond(c, {
          reason: result.reason,
          retryAfterSec: result.retryAfterSec,
        });
      }
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
      if (c.get("verifyCapacityRejected") === true) {
        // SERVICE_BUSY returns before the store is called; charging it would
        // turn honest backoff retries into DUPLICATE_PAYLOAD.
        refundCapacityRejectedAttempt(bucketKey);
      } else {
        // In `finally` so a handler exception can't skip marking a stable
        // rejection. Horizon is exempt: it checks current ownership of
        // (userId, sku), and the user can buy right after `success: false`.
        // The token bucket still limits Horizon bursts.
        const outcome = c.get("verifyOutcome");
        if (
          body.store !== "horizon" &&
          outcome &&
          outcome.isValid === false &&
          isStableRejection(outcome.state, outcome.stableRejection === true)
        ) {
          markPayloadFailure(store, bucketKey, capacity, clock(), maxStoreSize);
        }
      }
    }
  });
}
