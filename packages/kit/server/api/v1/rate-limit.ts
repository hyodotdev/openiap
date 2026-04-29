import { createMiddleware } from "hono/factory";
import * as crypto from "node:crypto";

import { parsePositiveNumber } from "../../utils/env";

// Per-machine, in-memory token bucket protecting /api/v1/* from abuse
// (stolen-key replay, buggy client retry loops, DoS on the verification
// pipeline). Sized for legitimate global-app traffic — the ceiling
// needs to be comfortably above what a real app with ~millions of
// DAU would generate so "you went viral" is never blocked, while
// still catching the obvious abuse patterns that the replay-guard and
// format gates miss.
//
// Pairs with the per-(key, payload) replay-guard in `replay-guard.ts`:
//   - This file: "how many verify calls /sec from one API key?" (any payload)
//   - replay-guard: "how many verify calls /sec for the *same* payload?"
// A determined abuser needs valid-looking payloads to evade replay-guard,
// and staying under this file's rate to evade the burst cap — which
// limits their reach enough that Apple / Google's own API rate limits
// become the next line of defense.
//
// Cross-machine note: Fly.io currently runs min_machines_running=1 for
// this app, so the bucket is effectively global. If the fleet scales
// out, each machine enforces its own bucket — limits become per-machine
// rather than per-key globally. That's an accepted tradeoff: the
// alternative (Convex-backed counter) adds a mutation to every verify
// call and a hot-row contention point. Revisit if we ever run >~3
// machines.

export interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export interface RateLimitConfig {
  capacity: number;
  refillPerSecond: number;
  /** Upper bound on the bucket store — protects against memory exhaustion
   * when a malicious/ignorant client churns random keys. When exceeded,
   * the least-recently-used entry is evicted. */
  maxStoreSize: number;
  now?: () => number;
  store?: Map<string, Bucket>;
}

export interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function hashApiKey(apiKey: string): string {
  // 64-bit prefix of SHA-256 — enough to avoid collisions in-process
  // without retaining the plaintext key in the bucket map (so a memory
  // scan of the server doesn't leak customer keys from this layer;
  // note: other layers may still hold the plaintext for the duration
  // of the request).
  return crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
}

// parsePositiveNumber was extracted to ../../utils/env so server.ts
// and this file share one defensive-parse implementation. Re-export
// keeps the existing `import { parsePositiveNumber } from "./rate-limit"`
// in the test file working without requiring a churn commit.
export { parsePositiveNumber };

/**
 * Evict least-recently-used entries until the store fits within
 * `maxSize`. Relies on Map's insertion-order iteration: every accepted
 * request deletes-and-reinserts its bucket so the key moves to the
 * tail, leaving the oldest untouched at the head.
 */
function evictIfNeeded(store: Map<string, Bucket>, maxSize: number): void {
  while (store.size > maxSize) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) return;
    store.delete(oldest);
  }
}

export function tryConsume(
  store: Map<string, Bucket>,
  keyHash: string,
  capacity: number,
  refillPerSecond: number,
  nowMs: number,
  maxStoreSize: number = DEFAULT_MAX_STORE_SIZE,
): ConsumeResult {
  const bucket = store.get(keyHash);

  if (!bucket) {
    store.set(keyHash, { tokens: capacity - 1, lastRefillMs: nowMs });
    evictIfNeeded(store, maxStoreSize);
    return { allowed: true, remaining: capacity - 1, retryAfterSec: 0 };
  }

  // LRU bump: delete + re-set so this key moves to the tail of the
  // Map's insertion order. Cheap (O(1)) and keeps eviction honest.
  store.delete(keyHash);
  store.set(keyHash, bucket);

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
  return { allowed: false, remaining: 0, retryAfterSec };
}

// Defaults tuned for legitimate global-app traffic:
//   - 600 tokens of burst absorbs push-notification-driven startup
//     storms and retry-after-transient-5xx spikes.
//   - 10 tokens/sec refill = 600/min sustained, enough for an app
//     with ~millions of DAU doing app-launch entitlement checks.
// An app larger than this should already be in direct contact with
// the maintainer (sponsor candidate at that scale); tune via env.
const DEFAULT_CAPACITY = parsePositiveNumber(
  process.env.RATE_LIMIT_CAPACITY,
  600,
  1,
);
const DEFAULT_REFILL_PER_SEC = parsePositiveNumber(
  process.env.RATE_LIMIT_REFILL_PER_SEC,
  10,
  0.001,
);
// 10k buckets ≈ 10k × (16-hex key + two numbers) ≈ ~1 MB of resident
// memory — far below the Fly machine's 512 MB budget, but large enough
// to hold every legitimate caller's state for the machine's lifetime.
// `apiKeyMiddleware` does not validate keys against the database before
// this middleware runs (the Convex-side verify action does), so without
// this cap an attacker could fill the Map with arbitrary random
// "api keys" until the process OOMs. LRU eviction under the cap keeps
// the window sized for real traffic.
const DEFAULT_MAX_STORE_SIZE = parsePositiveNumber(
  process.env.RATE_LIMIT_MAX_STORE,
  10_000,
  1,
);

const sharedStore = new Map<string, Bucket>();

// Variables exposed to downstream middleware. `apiKeyHash` is set
// here so the request-logger doesn't re-hash the key on every request
// (cheap individually, but this is on the hot path of every verify).
type RateLimitVars = {
  apiKey: string;
  apiKeyHash?: string;
};

export function rateLimitMiddleware(
  config: Partial<RateLimitConfig> = {},
): ReturnType<typeof createMiddleware<{ Variables: RateLimitVars }>> {
  const capacity = config.capacity ?? DEFAULT_CAPACITY;
  const refillPerSecond = config.refillPerSecond ?? DEFAULT_REFILL_PER_SEC;
  const maxStoreSize = config.maxStoreSize ?? DEFAULT_MAX_STORE_SIZE;
  const store = config.store ?? sharedStore;
  const clock = config.now ?? (() => Date.now());

  return createMiddleware<{ Variables: RateLimitVars }>(async (c, next) => {
    const apiKey = c.var.apiKey;

    // apiKeyMiddleware must run first. Reaching this branch means the
    // middleware chain was wired in the wrong order — a server-side
    // defect, not a client auth problem. Return 500 with a distinct
    // code so dashboards don't bucket this under legitimate
    // MISSING_API_KEY 401s from unauthenticated clients.
    if (!apiKey) {
      return c.json(
        {
          errors: [
            {
              code: "INTERNAL_MISCONFIGURATION",
              message: "Rate limiter ran before API key was extracted.",
            },
          ],
        },
        500,
      );
    }

    const keyHash = hashApiKey(apiKey);
    // Stash for downstream (request-logger reads `c.var.apiKeyHash`
    // to avoid re-hashing).
    c.set("apiKeyHash", keyHash);
    const result = tryConsume(
      store,
      keyHash,
      capacity,
      refillPerSecond,
      clock(),
      maxStoreSize,
    );

    c.header("X-RateLimit-Limit", String(capacity));
    c.header("X-RateLimit-Remaining", String(result.remaining));

    if (!result.allowed) {
      c.header("Retry-After", String(result.retryAfterSec));
      return c.json(
        {
          errors: [
            {
              code: "RATE_LIMITED",
              message: `Too many requests. Retry after ${result.retryAfterSec}s.`,
            },
          ],
        },
        429,
      );
    }

    await next();
  });
}
