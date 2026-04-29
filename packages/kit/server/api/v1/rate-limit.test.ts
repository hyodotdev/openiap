import { describe, expect, test } from "vitest";
import { Hono } from "hono";

import { apiKeyMiddleware } from "./middleware";
import {
  hashApiKey,
  parsePositiveNumber,
  rateLimitMiddleware,
  tryConsume,
  type Bucket,
} from "./rate-limit";

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
});

describe("parsePositiveNumber", () => {
  test("returns fallback for undefined / empty strings", () => {
    expect(parsePositiveNumber(undefined, 60, 1)).toBe(60);
    expect(parsePositiveNumber("", 60, 1)).toBe(60);
  });

  test("returns fallback for NaN, Infinity, non-numeric strings", () => {
    expect(parsePositiveNumber("pineapple", 60, 1)).toBe(60);
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
