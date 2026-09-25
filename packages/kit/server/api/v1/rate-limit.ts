import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import * as crypto from "node:crypto";

import { IAPKIT_MCP_LOOPBACK_HEADER } from "@hyodotdev/openiap-mcp-server/kit-client";

import { parsePositiveNumber } from "../../utils/env";

// Per-machine, in-memory token buckets guarding /api/v1/* against stolen-key
// replay, client retry loops, and DoS on verification. They are fair-use
// defaults for shared capacity, not a promise of unlimited traffic: large
// apps plan from peak rate, contact the maintainers before launch, or
// self-host with their own limits.
//
// This file caps calls per API key (any payload); `replay-guard.ts` caps
// calls for the same payload. An abuser who stays under both is slow enough
// that the stores' own API rate limits are the next defense. A per-project
// backstop in Convex also covers callers that bypass this process.

export interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export interface RateLimitConfig {
  capacity: number;
  refillPerSecond: number;
  /** Store size cap; past it the least-recently-used entry is evicted, so
   * churning random keys can't exhaust memory. */
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
  // The commerce binding wraps 429s in its own error envelope.
  respond?: RateLimitResponder;
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

const API_KEY_PSEUDONYM_KEY = crypto.randomBytes(32);

export function hashApiKey(apiKey: string): string {
  // A process-local HMAC keeps logs and bucket keys useful for correlation
  // without allowing leaked output to serve as an offline API-key oracle.
  return crypto
    .createHmac("sha256", API_KEY_PSEUDONYM_KEY)
    .update(apiKey)
    .digest("hex")
    .slice(0, 16);
}

// Re-exported for the tests that import it from here.
export { parsePositiveNumber };

/**
 * Evicts least-recently-used entries until the store fits `maxSize`. Map
 * iteration order is LRU order because every accepted request re-inserts
 * its key.
 */
function evictIfNeeded(
  store: Map<string, Bucket>,
  maxSize: number,
  nowMs: number,
  ttlMs: number,
): void {
  // Stale entries sit together at the head, so pruning only that prefix is
  // amortized O(1) instead of a scan per request.
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

  // LRU bump: re-insert to move the key to the tail.
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

// A 600-token burst absorbs push-driven startup storms and 5xx retries; a
// 10/sec refill sustains 600/min. One million requests a day already
// averages ~11.6/sec before peaks, so an app at that scale calls less,
// plans capacity with OpenIAP, or self-hosts and tunes via env.
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
// 10k buckets ≈ 1 MB, enough for every real caller. Keys aren't checked
// against the database before this runs (Convex does that later), so without
// the cap random "api keys" could fill the Map until the process OOMs.
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

// `apiKeyHash` is set here so the request logger doesn't re-hash the key on
// the verify hot path.
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

    // apiKeyMiddleware didn't run first: a server defect, so a distinct 500
    // rather than a client's MISSING_API_KEY 401.
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
 * Cost guard for receipt verification and every publishable-key API.
 *
 * Three in-memory axes instead of a Convex counter: key limits a leaked
 * credential, IP limits random-key churn, global limits a distributed spike
 * on one Fly process. Every store has a TTL and an LRU cap. Limits multiply
 * with the machine count; deployment usage limits are the cross-machine brake.
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

    const keyAxis = resolveAxis(
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
    );
    const ipAxis = resolveAxis(
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
    );
    const globalAxis = resolveAxis(
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
    );
    const axes = isTrustedMcpLoopback(c)
      ? [keyAxis, globalAxis]
      : [keyAxis, ipAxis, globalAxis];

    return applyRateLimitAxes(c, next, axes, nowMs, "key", config.respond);
  });
}

function isLoopbackAddress(address: string | undefined): boolean {
  const normalized = address?.replace(/^\[(.*)\]$/, "$1");
  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "::ffff:127.0.0.1"
  );
}

function isTrustedMcpLoopback(c: Context): boolean {
  if (c.req.header(IAPKIT_MCP_LOOPBACK_HEADER) !== "1") return false;
  const environment: unknown = c.env;
  const server =
    typeof environment === "object" &&
    environment !== null &&
    "server" in environment
      ? (environment as { server?: unknown }).server
      : environment;
  if (
    typeof server !== "object" ||
    server === null ||
    !("requestIP" in server) ||
    typeof server.requestIP !== "function"
  ) {
    return false;
  }
  try {
    const info = server.requestIP(c.req.raw) as { address?: string } | null;
    return isLoopbackAddress(info?.address);
  } catch {
    return false;
  }
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
  // Fly overwrites this header at the edge. Forwarded, X-Forwarded-For, and
  // CDN headers are caller-controlled and ignored, or an attacker could
  // rotate the per-IP bucket. Requests without it share the "unknown" bucket.
  return normalizeIp(c.req.header("fly-client-ip"));
}
