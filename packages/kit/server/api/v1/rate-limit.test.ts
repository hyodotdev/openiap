import { describe, expect, test } from "vitest";
import { Hono } from "hono";

import { apiKeyMiddleware } from "./middleware";
import {
  getRequestIp,
  hashApiKey,
  multiAxisRateLimitMiddleware,
  parsePositiveNumber,
  rateLimitMiddleware,
  tryConsume,
  type Bucket,
} from "./rate-limit";

describe("getRequestIp", () => {
  test("trusts Fly's ingress header over caller-controlled forwarding headers", async () => {
    const app = new Hono();
    app.get("/", (c) => c.text(getRequestIp(c) ?? "unknown"));

    const response = await app.request("/", {
      headers: {
        "fly-client-ip": "203.0.113.10",
        forwarded: "for=198.51.100.1",
        "x-forwarded-for": "198.51.100.2",
        "cf-connecting-ip": "198.51.100.3",
      },
    });

    expect(await response.text()).toBe("203.0.113.10");
  });

  test("ignores spoofable forwarding headers without Fly ingress", async () => {
    const app = new Hono();
    app.get("/", (c) => c.text(getRequestIp(c) ?? "unknown"));

    const response = await app.request("/", {
      headers: {
        forwarded: "for=198.51.100.1",
        "x-forwarded-for": "198.51.100.2",
        "cf-connecting-ip": "198.51.100.3",
        "x-real-ip": "198.51.100.4",
      },
    });

    expect(await response.text()).toBe("unknown");
  });
});

describe("tryConsume (token bucket)", () => {
  test("first request creates a bucket and consumes one token", () => {
    const store = new Map<string, Bucket>();
    const result = tryConsume(store, "k", 5, 1, 1_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.retryAfterSec).toBe(0);
    expect(store.get("k")).toEqual({ tokens: 4, lastRefillMs: 1_000 });
  });

  test("burst: capacity requests in the same instant all succeed", () => {
    const store = new Map<string, Bucket>();
    for (let i = 0; i < 5; i++) {
      const r = tryConsume(store, "k", 5, 1, 1_000);
      expect(r.allowed).toBe(true);
    }
    const denied = tryConsume(store, "k", 5, 1, 1_000);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterSec).toBe(1);
  });

  test("refill restores tokens at the configured rate", () => {
    const store = new Map<string, Bucket>();
    for (let i = 0; i < 5; i++) tryConsume(store, "k", 5, 1, 1_000);
    // 1s later, 1 token back.
    const r = tryConsume(store, "k", 5, 1, 2_000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(0);
  });

  test("refill caps at capacity and doesn't grow unbounded", () => {
    const store = new Map<string, Bucket>();
    tryConsume(store, "k", 5, 1, 1_000);
    // A long idle period — tokens should clamp to capacity, not go to 1000.
    const r = tryConsume(store, "k", 5, 1, 10_000_000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });

  test("negative clock drift doesn't award extra tokens", () => {
    const store = new Map<string, Bucket>();
    tryConsume(store, "k", 5, 1, 10_000);
    // Clock went backwards (NTP skew, monotonic fallback, etc.).
    const r = tryConsume(store, "k", 5, 1, 5_000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(3);
  });

  test("retryAfterSec rounds up to at least 1s when denied", () => {
    const store = new Map<string, Bucket>();
    // capacity 1, refill 10/s — after spending the token, we need 0.1s.
    tryConsume(store, "k", 1, 10, 1_000);
    const r = tryConsume(store, "k", 1, 10, 1_000);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSec).toBe(1);
  });

  test("separate keys have independent buckets", () => {
    const store = new Map<string, Bucket>();
    for (let i = 0; i < 5; i++) tryConsume(store, "a", 5, 1, 1_000);
    const rA = tryConsume(store, "a", 5, 1, 1_000);
    const rB = tryConsume(store, "b", 5, 1, 1_000);
    expect(rA.allowed).toBe(false);
    expect(rB.allowed).toBe(true);
  });

  test("charges a bounded weighted cost", () => {
    const store = new Map<string, Bucket>();
    expect(tryConsume(store, "k", 10, 1, 1_000, 10, 60_000, 7)).toMatchObject({
      allowed: true,
      remaining: 3,
    });
    expect(tryConsume(store, "k", 10, 1, 1_000, 10, 60_000, 4)).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSec: 1,
    });
  });
});

describe("tryConsume store bounds", () => {
  test("caps the store at maxStoreSize, evicting the least-recently-used key", () => {
    const store = new Map<string, Bucket>();
    tryConsume(store, "a", 5, 1, 1_000, 2);
    tryConsume(store, "b", 5, 1, 1_000, 2);
    // Third key "c" should push out "a" (oldest). Note: we pass
    // maxStoreSize=2 so the store never holds more than two buckets.
    tryConsume(store, "c", 5, 1, 1_000, 2);
    expect(store.size).toBe(2);
    expect(store.has("a")).toBe(false);
    expect(store.has("b")).toBe(true);
    expect(store.has("c")).toBe(true);
  });

  test("LRU bump keeps recently-used keys alive across eviction", () => {
    const store = new Map<string, Bucket>();
    tryConsume(store, "a", 5, 1, 1_000, 2);
    tryConsume(store, "b", 5, 1, 1_000, 2);
    // Touch "a" — this should move it to the tail, so "b" becomes
    // oldest.
    tryConsume(store, "a", 5, 1, 1_000, 2);
    tryConsume(store, "c", 5, 1, 1_000, 2);
    expect(store.has("a")).toBe(true);
    expect(store.has("b")).toBe(false);
    expect(store.has("c")).toBe(true);
  });

  test("expires idle buckets opportunistically", () => {
    const store = new Map<string, Bucket>();
    tryConsume(store, "stale", 5, 1, 1_000, 10, 1_000);
    tryConsume(store, "fresh", 5, 1, 2_001, 10, 1_000);
    expect(store.has("stale")).toBe(false);
    expect(store.has("fresh")).toBe(true);
  });
});

describe("parsePositiveNumber", () => {
  test("returns fallback for undefined / empty strings", () => {
    expect(parsePositiveNumber(undefined, 60, 1)).toBe(60);
    expect(parsePositiveNumber("", 60, 1)).toBe(60);
  });

  test("returns fallback for NaN, Infinity, non-numeric strings", () => {
    expect(parsePositiveNumber("pineapple", 60, 1)).toBe(60);
    expect(parsePositiveNumber("120rps", 60, 1)).toBe(60);
    expect(parsePositiveNumber("0x10", 60, 1)).toBe(60);
    expect(parsePositiveNumber("1e2", 60, 1)).toBe(60);
    expect(parsePositiveNumber("+1", 60, 1)).toBe(60);
    expect(parsePositiveNumber("NaN", 60, 1)).toBe(60);
    expect(parsePositiveNumber("Infinity", 60, 1)).toBe(60);
  });

  test("returns fallback for values below the minimum", () => {
    expect(parsePositiveNumber("0", 60, 1)).toBe(60);
    expect(parsePositiveNumber("-5", 60, 1)).toBe(60);
    // 0.5 fails a min of 1 but passes a min of 0.001.
    expect(parsePositiveNumber("0.5", 60, 1)).toBe(60);
    expect(parsePositiveNumber("0.5", 60, 0.001)).toBe(0.5);
  });

  test("returns the parsed value when it is finite and above min", () => {
    expect(parsePositiveNumber("120", 60, 1)).toBe(120);
    expect(parsePositiveNumber(" 120 ", 60, 1)).toBe(120);
    expect(parsePositiveNumber("0.25", 1, 0.001)).toBe(0.25);
  });
});

describe("hashApiKey", () => {
  test("is deterministic and does not echo the plaintext", () => {
    const h1 = hashApiKey("openiap-kit_secret_abc");
    const h2 = hashApiKey("openiap-kit_secret_abc");
    expect(h1).toBe(h2);
    expect(h1).not.toContain("secret");
    expect(h1).toMatch(/^[0-9a-f]{16}$/);
  });

  test("different keys produce different hashes", () => {
    expect(hashApiKey("key-a")).not.toBe(hashApiKey("key-b"));
  });
});

function buildApp(config: {
  capacity: number;
  refillPerSecond: number;
  now: () => number;
  store?: Map<string, Bucket>;
}) {
  const app = new Hono();
  app.post("/verify", apiKeyMiddleware, rateLimitMiddleware(config), (c) =>
    c.json({ ok: true }),
  );
  return app;
}

describe("rateLimitMiddleware", () => {
  test("returns 500 INTERNAL_MISCONFIGURATION when it runs without apiKeyMiddleware first", async () => {
    const app = new Hono();
    // Wire the rate limiter WITHOUT apiKeyMiddleware so c.var.apiKey
    // is undefined. This is the "middleware chain in the wrong order"
    // defect — must surface as 500, not as a client-facing 401.
    app.post(
      "/verify",
      rateLimitMiddleware({
        capacity: 5,
        refillPerSecond: 1,
        now: () => 1_000,
      }),
      (c) => c.json({ ok: true }),
    );
    const res = await app.request("/verify", { method: "POST" });
    expect(res.status).toBe(500);
    const body = (await res.json()) as {
      errors: Array<{ code: string; message: string }>;
    };
    expect(body.errors[0].code).toBe("INTERNAL_MISCONFIGURATION");
  });

  test("stashes apiKeyHash on the context for downstream middleware", async () => {
    const app = new Hono<{
      Variables: { apiKey: string; apiKeyHash?: string };
    }>();
    let seen: string | undefined;
    app.post(
      "/verify",
      apiKeyMiddleware,
      rateLimitMiddleware({
        capacity: 5,
        refillPerSecond: 1,
        now: () => 1_000,
      }),
      (c) => {
        seen = c.var.apiKeyHash;
        return c.json({ ok: true });
      },
    );
    await app.request("/verify", {
      method: "POST",
      headers: { Authorization: "Bearer key-stash" },
    });
    expect(seen).toBeDefined();
    expect(seen).toMatch(/^[0-9a-f]{16}$/);
    expect(seen).toBe(hashApiKey("key-stash"));
  });

  test("allows requests under the limit and emits rate-limit headers", async () => {
    const app = buildApp({ capacity: 3, refillPerSecond: 1, now: () => 1_000 });
    const res = await app.request("/verify", {
      method: "POST",
      headers: { Authorization: "Bearer k1" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("3");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("2");
  });

  test("returns 429 RATE_LIMITED with Retry-After once the bucket empties", async () => {
    const store = new Map<string, Bucket>();
    const app = buildApp({
      capacity: 2,
      refillPerSecond: 1,
      now: () => 1_000,
      store,
    });

    const first = await app.request("/verify", {
      method: "POST",
      headers: { Authorization: "Bearer k2" },
    });
    expect(first.status).toBe(200);

    const second = await app.request("/verify", {
      method: "POST",
      headers: { Authorization: "Bearer k2" },
    });
    expect(second.status).toBe(200);

    const third = await app.request("/verify", {
      method: "POST",
      headers: { Authorization: "Bearer k2" },
    });
    expect(third.status).toBe(429);
    expect(third.headers.get("Retry-After")).toBe("1");
    const body = (await third.json()) as {
      errors: Array<{ code: string; message: string }>;
    };
    expect(body.errors[0].code).toBe("RATE_LIMITED");
  });

  test("separate API keys are tracked independently", async () => {
    const store = new Map<string, Bucket>();
    const app = buildApp({
      capacity: 1,
      refillPerSecond: 1,
      now: () => 1_000,
      store,
    });

    const keyA1 = await app.request("/verify", {
      method: "POST",
      headers: { Authorization: "Bearer A" },
    });
    expect(keyA1.status).toBe(200);

    const keyA2 = await app.request("/verify", {
      method: "POST",
      headers: { Authorization: "Bearer A" },
    });
    expect(keyA2.status).toBe(429);

    const keyB1 = await app.request("/verify", {
      method: "POST",
      headers: { Authorization: "Bearer B" },
    });
    expect(keyB1.status).toBe(200);
  });
});

describe("multiAxisRateLimitMiddleware", () => {
  function buildMultiAxisApp(options?: {
    keyCapacity?: number;
    ipCapacity?: number;
    globalCapacity?: number;
    keyMaxStoreSize?: number;
  }) {
    const keyStore = new Map<string, Bucket>();
    const ipStore = new Map<string, Bucket>();
    const globalStore = new Map<string, Bucket>();
    const app = new Hono();
    app.get(
      "/public",
      apiKeyMiddleware,
      multiAxisRateLimitMiddleware({
        now: () => 1_000,
        getIp: (c) => c.req.header("x-test-ip"),
        key: {
          capacity: options?.keyCapacity ?? 10,
          refillPerSecond: 1,
          maxStoreSize: options?.keyMaxStoreSize ?? 10,
          store: keyStore,
        },
        ip: {
          capacity: options?.ipCapacity ?? 10,
          refillPerSecond: 1,
          maxStoreSize: 10,
          store: ipStore,
        },
        global: {
          capacity: options?.globalCapacity ?? 10,
          refillPerSecond: 1,
          maxStoreSize: 1,
          store: globalStore,
        },
      }),
      (c) => c.json({ ok: true }),
    );
    return { app, keyStore, ipStore, globalStore };
  }

  test("enforces key, IP, and process limits with consistent headers", async () => {
    const keyLimited = buildMultiAxisApp({ keyCapacity: 1 });
    const request = (app: Hono, key: string, ip: string) =>
      app.request("/public", {
        headers: { authorization: `Bearer ${key}`, "x-test-ip": ip },
      });
    expect((await request(keyLimited.app, "key-a", "ip-a")).status).toBe(200);
    const keyDenied = await request(keyLimited.app, "key-a", "ip-a");
    expect(keyDenied.status).toBe(429);
    expect(keyDenied.headers.get("x-ratelimit-scope")).toBe("key");
    expect(keyDenied.headers.get("retry-after")).toBe("1");

    const ipLimited = buildMultiAxisApp({ ipCapacity: 2 });
    expect((await request(ipLimited.app, "key-a", "ip-a")).status).toBe(200);
    expect((await request(ipLimited.app, "key-b", "ip-a")).status).toBe(200);
    const ipDenied = await request(ipLimited.app, "key-c", "ip-a");
    expect(ipDenied.status).toBe(429);
    expect(ipDenied.headers.get("x-ratelimit-scope")).toBe("ip");

    const globalLimited = buildMultiAxisApp({ globalCapacity: 2 });
    expect((await request(globalLimited.app, "key-a", "ip-a")).status).toBe(
      200,
    );
    expect((await request(globalLimited.app, "key-b", "ip-b")).status).toBe(
      200,
    );
    const globalDenied = await request(globalLimited.app, "key-c", "ip-c");
    expect(globalDenied.status).toBe(429);
    expect(globalDenied.headers.get("x-ratelimit-scope")).toBe("global");
  });

  test("bounds random-key churn with LRU eviction", async () => {
    const { app, keyStore } = buildMultiAxisApp({
      keyCapacity: 1,
      ipCapacity: 100,
      globalCapacity: 100,
      keyMaxStoreSize: 3,
    });
    for (let index = 0; index < 20; index += 1) {
      const response = await app.request("/public", {
        headers: {
          authorization: `Bearer random-${index}`,
          "x-test-ip": "same-ip",
        },
      });
      expect(response.status).toBe(200);
    }
    expect(keyStore.size).toBe(3);
  });
});
