import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import * as crypto from "node:crypto";

import { parsePositiveNumber } from "../../utils/env";

// Per-machine, in-memory token bucket protecting /api/v1/* from abuse
// (stolen-key replay, buggy client retry loops, DoS on the verification
// pipeline). These are fair-use defaults for shared hosted capacity,
// not a promise of unlimited global-app traffic. Large apps must plan
// from peak request rate, contact the maintainers before launch, or
// self-host with limits sized for their own workload.
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
  /** Idle entries older than this are removed opportunistically. */
  ttlMs: number;
  /** Tokens charged by this request. Zero skips this limiter. */
  cost: number | ((c: Context) => number);
  now?: () => number;
  store?: Map<string, Bucket>;
}

export interface MultiAxisRateLimitConfig {
  key?: Partial<RateLimitConfig>;
  ip?: Partial<RateLimitConfig>;
  global?: Partial<RateLimitConfig>;
  now?: () => number;
  getIp?: (c: Context) => string | undefined;
}

type RateLimitResponder = (c: Context, result: ConsumeResult) => Response;

export interface SourceRateLimitConfig {
  ip?: Partial<RateLimitConfig>;
  global?: Partial<RateLimitConfig>;
  now?: () => number;
  getIp?: (c: Context) => string | undefined;
  respond?: RateLimitResponder;
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
function evictIfNeeded(
  store: Map<string, Bucket>,
  maxSize: number,
  nowMs: number,
  ttlMs: number,
): void {
  // Map order is LRU order, so stale entries are contiguous at the head.
  // Removing only that prefix makes cleanup amortized O(1) instead of
  // scanning every key on every mobile request.
  while (store.size > 0) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = store.get(oldestKey);
    if (!oldest || nowMs - oldest.lastRefillMs > ttlMs) {
      store.delete(oldestKey);
      continue;
    }
    break;
  }
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
  ttlMs: number = DEFAULT_STORE_TTL_MS,
  cost: number = 1,
): ConsumeResult {
  evictIfNeeded(store, maxStoreSize, nowMs, ttlMs);
  if (cost <= 0) {
    return { allowed: true, remaining: capacity, retryAfterSec: 0 };
  }
  const bucket = store.get(keyHash);

  if (!bucket) {
    const allowed = cost <= capacity;
    const remaining = allowed ? capacity - cost : capacity;
    store.set(keyHash, { tokens: remaining, lastRefillMs: nowMs });
    evictIfNeeded(store, maxStoreSize, nowMs, ttlMs);
    return {
      allowed,
      remaining: Math.floor(remaining),
      retryAfterSec: allowed
        ? 0
        : Math.max(1, Math.ceil((cost - capacity) / refillPerSecond)),
    };
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

  if (refilled >= cost) {
    bucket.tokens = refilled - cost;
    bucket.lastRefillMs = nowMs;
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfterSec: 0,
    };
  }

  bucket.tokens = refilled;
  bucket.lastRefillMs = nowMs;
  const missing = cost - refilled;
  const retryAfterSec = Math.max(1, Math.ceil(missing / refillPerSecond));
  return { allowed: false, remaining: 0, retryAfterSec };
}

// Defaults tuned for shared hosted traffic:
//   - 600 tokens of burst absorbs push-notification-driven startup
//     storms and retry-after-transient-5xx spikes.
//   - 10 tokens/sec refill = 600/min sustained. One million requests
//     per day already average ~11.6/sec before peak clustering, so an
//     app at that scale must reduce call frequency, contact OpenIAP for
//     shared capacity planning, or self-host and tune via env.
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
const DEFAULT_STORE_TTL_MS =
  parsePositiveNumber(process.env.RATE_LIMIT_STORE_TTL_SEC, 15 * 60, 1) * 1000;

const sharedStore = new Map<string, Bucket>();
const sharedIpStore = new Map<string, Bucket>();
const sharedGlobalStore = new Map<string, Bucket>();
const sharedSourceIpStore = new Map<string, Bucket>();
const sharedSourceGlobalStore = new Map<string, Bucket>();

const DEFAULT_IP_CAPACITY = parsePositiveNumber(
  process.env.RATE_LIMIT_IP_CAPACITY,
  600,
  1,
);
const DEFAULT_IP_REFILL_PER_SEC = parsePositiveNumber(
  process.env.RATE_LIMIT_IP_REFILL_PER_SEC,
  5,
  0.001,
);
const DEFAULT_GLOBAL_CAPACITY = parsePositiveNumber(
  process.env.RATE_LIMIT_GLOBAL_CAPACITY,
  5_000,
  1,
);
const DEFAULT_GLOBAL_REFILL_PER_SEC = parsePositiveNumber(
  process.env.RATE_LIMIT_GLOBAL_REFILL_PER_SEC,
  100,
  0.001,
);
const DEFAULT_IP_MAX_STORE_SIZE = parsePositiveNumber(
  process.env.RATE_LIMIT_IP_MAX_STORE,
  10_000,
  1,
);

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
  const ttlMs = config.ttlMs ?? DEFAULT_STORE_TTL_MS;
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
      ttlMs,
      requestCost(config.cost, c),
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

function requestCost(
  cost: RateLimitConfig["cost"] | undefined,
  c: Context,
): number {
  const resolved = typeof cost === "function" ? cost(c) : (cost ?? 1);
  return Number.isFinite(resolved) && resolved > 0 ? resolved : 0;
}

type AxisRuntime = {
  scope: "global" | "ip" | "key";
  identifier: string;
  capacity: number;
  refillPerSecond: number;
  maxStoreSize: number;
  ttlMs: number;
  cost: number;
  store: Map<string, Bucket>;
};

function resolveAxis(
  scope: AxisRuntime["scope"],
  identifier: string,
  config: Partial<RateLimitConfig> | undefined,
  defaults: {
    capacity: number;
    refillPerSecond: number;
    maxStoreSize: number;
    store: Map<string, Bucket>;
  },
  c: Context,
): AxisRuntime {
  return {
    scope,
    identifier,
    capacity: config?.capacity ?? defaults.capacity,
    refillPerSecond: config?.refillPerSecond ?? defaults.refillPerSecond,
    maxStoreSize: config?.maxStoreSize ?? defaults.maxStoreSize,
    ttlMs: config?.ttlMs ?? DEFAULT_STORE_TTL_MS,
    cost: requestCost(config?.cost, c),
    store: config?.store ?? defaults.store,
  };
}

function rateLimitResponse(c: Context, result: ConsumeResult) {
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

async function applyRateLimitAxes(
  c: Context,
  next: () => Promise<void>,
  axes: AxisRuntime[],
  nowMs: number,
  primaryScope: AxisRuntime["scope"],
  respond: RateLimitResponder = rateLimitResponse,
): Promise<Response | void> {
  if (axes.every((axis) => axis.cost <= 0)) {
    await next();
    return;
  }

  let primaryResult: ConsumeResult | null = null;
  for (const axis of axes) {
    const result = tryConsume(
      axis.store,
      axis.identifier,
      axis.capacity,
      axis.refillPerSecond,
      nowMs,
      axis.maxStoreSize,
      axis.ttlMs,
      axis.cost,
    );
    if (axis.scope === primaryScope) primaryResult = result;
    if (!result.allowed) {
      c.header("X-RateLimit-Limit", String(axis.capacity));
      c.header("X-RateLimit-Remaining", String(result.remaining));
      c.header("X-RateLimit-Scope", axis.scope);
      c.header("Retry-After", String(result.retryAfterSec));
      return respond(c, result);
    }
  }

  const primaryAxis = axes.find((axis) => axis.scope === primaryScope);
  c.header("X-RateLimit-Limit", String(primaryAxis?.capacity ?? 0));
  c.header("X-RateLimit-Remaining", String(primaryResult?.remaining ?? 0));
  await next();
}

/**
 * Cost guard shared by receipt verification and every publishable-key API.
 *
 * Three in-memory axes are intentionally used instead of a Convex counter:
 * key protects a leaked credential, IP bounds random-key churn, and global
 * bounds a distributed spike reaching one Fly process. Every store has TTL
 * cleanup plus an LRU cap, so attacker-controlled identifiers cannot grow
 * memory without bound. With multiple Fly machines the limits multiply by
 * the machine count; deployment usage limits remain the cross-machine brake.
 */
export function multiAxisRateLimitMiddleware(
  config: MultiAxisRateLimitConfig = {},
): ReturnType<typeof createMiddleware<{ Variables: RateLimitVars }>> {
  const clock = config.now ?? (() => Date.now());
  const getIp = config.getIp ?? getRequestIp;

  return createMiddleware<{ Variables: RateLimitVars }>(async (c, next) => {
    const apiKey = c.var.apiKey;
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

    const apiKeyHash = hashApiKey(apiKey);
    const ip = getIp(c) ?? "unknown";
    const nowMs = clock();
    c.set("apiKeyHash", apiKeyHash);

    const axes = [
      resolveAxis(
        "key",
        apiKeyHash,
        config.key,
        {
          capacity: DEFAULT_CAPACITY,
          refillPerSecond: DEFAULT_REFILL_PER_SEC,
          maxStoreSize: DEFAULT_MAX_STORE_SIZE,
          store: sharedStore,
        },
        c,
      ),
      resolveAxis(
        "ip",
        hashApiKey(`ip:${ip}`),
        config.ip,
        {
          capacity: DEFAULT_IP_CAPACITY,
          refillPerSecond: DEFAULT_IP_REFILL_PER_SEC,
          maxStoreSize: DEFAULT_IP_MAX_STORE_SIZE,
          store: sharedIpStore,
        },
        c,
      ),
      resolveAxis(
        "global",
        "process",
        config.global,
        {
          capacity: DEFAULT_GLOBAL_CAPACITY,
          refillPerSecond: DEFAULT_GLOBAL_REFILL_PER_SEC,
          maxStoreSize: 1,
          store: sharedGlobalStore,
        },
        c,
      ),
    ] satisfies AxisRuntime[];

    return applyRateLimitAxes(c, next, axes, nowMs, "key");
  });
}

/** Protects unauthenticated transport surfaces by source IP and process. */
export function sourceRateLimitMiddleware(
  config: SourceRateLimitConfig = {},
): ReturnType<typeof createMiddleware> {
  const clock = config.now ?? (() => Date.now());
  const getIp = config.getIp ?? getRequestIp;

  return createMiddleware(async (c, next) => {
    const ip = getIp(c) ?? "unknown";
    const nowMs = clock();
    const axes = [
      resolveAxis(
        "ip",
        hashApiKey(`source:${ip}`),
        config.ip,
        {
          capacity: DEFAULT_IP_CAPACITY,
          refillPerSecond: DEFAULT_IP_REFILL_PER_SEC,
          maxStoreSize: DEFAULT_IP_MAX_STORE_SIZE,
          store: sharedSourceIpStore,
        },
        c,
      ),
      resolveAxis(
        "global",
        "source-process",
        config.global,
        {
          capacity: DEFAULT_GLOBAL_CAPACITY,
          refillPerSecond: DEFAULT_GLOBAL_REFILL_PER_SEC,
          maxStoreSize: 1,
          store: sharedSourceGlobalStore,
        },
        c,
      ),
    ] satisfies AxisRuntime[];

    return applyRateLimitAxes(
      c,
      next,
      axes,
      nowMs,
      "ip",
      config.respond ?? rateLimitResponse,
    );
  });
}

function normalizeIp(value?: string | null): string | undefined {
  const first = value?.split(",")[0]?.trim();
  if (!first || first === "unknown") return undefined;
  return first.replace(/^"(.*)"$/, "$1").replace(/^\[(.*)\]$/, "$1");
}

export function getRequestIp(c: Context): string | undefined {
  // The current public topology terminates at Fly, which overwrites this
  // platform header. Caller-controlled Forwarded/X-Forwarded-For and
  // CDN-specific headers are intentionally ignored; trusting them on a direct
  // ingress would let an attacker rotate the per-IP bucket. Local/direct
  // requests without Fly's header share the bounded "unknown" bucket.
  return normalizeIp(c.req.header("fly-client-ip"));
}
