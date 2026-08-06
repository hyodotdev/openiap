import { describe, expect, it, test } from "vitest";

import {
  hashPayload,
  isStableRejection,
  markPayloadFailure,
  replayGuardMiddleware,
  tryConsumeReplay,
  type ReplayBucket,
} from "./replay-guard";

describe("hashPayload", () => {
  test("produces the same hash for equivalent payloads", () => {
    const a = hashPayload({ store: "apple", jws: "sample.jws.value" });
    const b = hashPayload({ store: "apple", jws: "sample.jws.value" });
    expect(a).toBe(b);
  });

  test("distinguishes different stores even when fields collide", () => {
    // Purely defensive: if the hash ever forgot to include the store
    // tag, a Google `purchaseToken` that happened to match an Apple
    // `jws` string would share a bucket. Including `store\0` in the
    // hash input is what stops that.
    const apple = hashPayload({ store: "apple", jws: "same-string" });
    const google = hashPayload({
      store: "google",
      purchaseToken: "same-string",
    });
    expect(apple).not.toBe(google);
  });

  test("distinguishes product match guards for the same store token", () => {
    const left = hashPayload({
      store: "google",
      purchaseToken: "same-token",
      expectedProductId: "premium_monthly",
    });
    const right = hashPayload({
      store: "google",
      purchaseToken: "same-token",
      expectedProductId: "coins_100",
    });
    expect(left).not.toBe(right);
  });

  test("distinguishes Horizon (userId, sku) pairs with a separator", () => {
    // Without the `\0` separator between userId and sku,
    // ("ab", "c") and ("a", "bc") would hash to the same input.
    const left = hashPayload({
      store: "horizon",
      userId: "ab",
      sku: "c",
    });
    const right = hashPayload({
      store: "horizon",
      userId: "a",
      sku: "bc",
    });
    expect(left).not.toBe(right);
  });

  test("distinguishes Amazon receipt tuples and sandbox mode", () => {
    const tupleLeft = hashPayload({
      store: "amazon",
      userId: "ab",
      receiptId: "c",
      sandbox: true,
    });
    const tupleRight = hashPayload({
      store: "amazon",
      userId: "a",
      receiptId: "bc",
      sandbox: true,
    });
    const production = hashPayload({
      store: "amazon",
      userId: "ab",
      receiptId: "c",
      sandbox: false,
    });

    expect(tupleLeft).not.toBe(tupleRight);
    expect(tupleLeft).not.toBe(production);
  });
});

describe("tryConsumeReplay", () => {
  test("allows up to capacity bursts then blocks until refill", () => {
    const store = new Map<string, ReplayBucket>();
    let now = 1_000;

    // Capacity 3, refill 0.5 / sec (2 sec per token).
    const consume = () =>
      tryConsumeReplay(store, "key:payload", 3, 0.5, now, 100);

    expect(consume().allowed).toBe(true); // 1
    expect(consume().allowed).toBe(true); // 2
    expect(consume().allowed).toBe(true); // 3 — bucket drained
    const blocked = consume();
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);

    // Advance 2 seconds — refill should yield exactly 1 token.
    now += 2_000;
    expect(consume().allowed).toBe(true);
    expect(consume().allowed).toBe(false);
  });

  test("isolates buckets across different keys", () => {
    const store = new Map<string, ReplayBucket>();
    const now = 1_000;

    expect(tryConsumeReplay(store, "k1:p", 1, 1, now, 100).allowed).toBe(true);
    // k1's bucket is empty…
    expect(tryConsumeReplay(store, "k1:p", 1, 1, now, 100).allowed).toBe(false);
    // …but k2's is not.
    expect(tryConsumeReplay(store, "k2:p", 1, 1, now, 100).allowed).toBe(true);
  });

  test("evicts the LRU entry when the store size cap is hit", () => {
    const store = new Map<string, ReplayBucket>();
    const now = 1_000;

    tryConsumeReplay(store, "a", 1, 1, now, 2);
    tryConsumeReplay(store, "b", 1, 1, now, 2);
    // Adding "c" should push "a" out.
    tryConsumeReplay(store, "c", 1, 1, now, 2);
    expect(store.has("a")).toBe(false);
    expect(store.has("b")).toBe(true);
    expect(store.has("c")).toBe(true);
  });
});

describe("markPayloadFailure + tryConsumeReplay cooldown", () => {
  test("rejects with reason='repeated_failure' inside the cooldown window", () => {
    const store = new Map<string, ReplayBucket>();
    let now = 1_000;
    const cooldownMs = 60_000;

    // Cold-start the bucket via a normal allowed call, then mark the
    // payload as failed.
    tryConsumeReplay(store, "k:p", 30, 1, now, 100, cooldownMs);
    markPayloadFailure(store, "k:p", 30, now, 100);

    // Same payload, a second later — must be blocked by the failure
    // cooldown even though the token bucket still has 28 tokens.
    now += 1_000;
    const blocked = tryConsumeReplay(store, "k:p", 30, 1, now, 100, cooldownMs);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("repeated_failure");
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(58);
  });

  test("does not extend cooldown retry-after when the clock moves backward", () => {
    const store = new Map<string, ReplayBucket>();
    const now = 10_000;
    const cooldownMs = 60_000;

    markPayloadFailure(store, "k:p", 30, now, 100);
    const blocked = tryConsumeReplay(
      store,
      "k:p",
      30,
      1,
      now - 5_000,
      100,
      cooldownMs,
    );

    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("repeated_failure");
    expect(blocked.retryAfterSec).toBe(60);
  });

  test("allows the same payload again after the cooldown elapses", () => {
    const store = new Map<string, ReplayBucket>();
    let now = 1_000;
    const cooldownMs = 60_000;

    tryConsumeReplay(store, "k:p", 30, 1, now, 100, cooldownMs);
    markPayloadFailure(store, "k:p", 30, now, 100);

    // Just past the cooldown — back to the regular token-bucket path.
    now += cooldownMs + 1_000;
    const after = tryConsumeReplay(store, "k:p", 30, 1, now, 100, cooldownMs);
    expect(after.allowed).toBe(true);
    expect(after.reason).toBeUndefined();
  });

  test("failure on key A does not affect key B (cooldown is per-bucket)", () => {
    const store = new Map<string, ReplayBucket>();
    const now = 1_000;
    const cooldownMs = 60_000;

    tryConsumeReplay(store, "k:a", 30, 1, now, 100, cooldownMs);
    markPayloadFailure(store, "k:a", 30, now, 100);

    const otherKey = tryConsumeReplay(
      store,
      "k:b",
      30,
      1,
      now,
      100,
      cooldownMs,
    );
    expect(otherKey.allowed).toBe(true);
  });

  test("markPayloadFailure can prime a fresh bucket on first failure", () => {
    const store = new Map<string, ReplayBucket>();
    const now = 1_000;

    // Skip the consume step — markPayloadFailure should still create
    // the bucket so subsequent calls hit the cooldown.
    markPayloadFailure(store, "k:p", 30, now, 100);
    const blocked = tryConsumeReplay(
      store,
      "k:p",
      30,
      1,
      now + 100,
      100,
      60_000,
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("repeated_failure");
  });

  test("failure cooldown short-circuits before the token-bucket check", () => {
    const store = new Map<string, ReplayBucket>();
    const now = 1_000;

    // Bucket has full capacity but is in cooldown — must reject with
    // 'repeated_failure', NOT 'burst', so the client knows the cause.
    markPayloadFailure(store, "k:p", 30, now, 100);
    const blocked = tryConsumeReplay(
      store,
      "k:p",
      30,
      1,
      now + 100,
      100,
      60_000,
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("repeated_failure");
  });
});

// Issue #289: the negative cooldown defaults to 300s, which almost
// exactly spans Google's ~301s window for voiding an unacknowledged
// purchase. Arming it on a non-terminal rejection meant one blip made
// the purchase permanently unverifiable — and therefore un-acknowledgeable
// — before Google voided it.
describe("isStableRejection", () => {
  it("arms the cooldown for settled store verdicts", () => {
    for (const state of ["INAUTHENTIC", "CANCELED", "EXPIRED", "CONSUMED"]) {
      expect(isStableRejection(state)).toBe(true);
    }
  });

  it("does not arm the cooldown for a state a retry can change", () => {
    // PENDING resolves when the user finishes a deferred payment. UNKNOWN
    // can be a successfully fetched future Play state or Amazon product type.
    for (const state of ["PENDING", "UNKNOWN", "FUTURE_STORE_STATE"]) {
      expect(isStableRejection(state)).toBe(false);
    }
  });

  it("arms ambiguous UNKNOWN only with explicit revoked-token provenance", () => {
    expect(isStableRejection("UNKNOWN")).toBe(false);
    expect(isStableRejection("UNKNOWN", true)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isStableRejection("pending")).toBe(false);
    expect(isStableRejection("Unknown")).toBe(false);
    expect(isStableRejection("inauthentic")).toBe(true);
  });
});

// The predicate above is pure; this exercises the wiring that actually
// fixes issue #289 — the middleware only arming the cooldown for a
// settled verdict. Without this, `isStableRejection` could be dropped
// from the `finally` block and every test would still pass.
describe("replayGuardMiddleware cooldown wiring", () => {
  const capacity = 30;

  function runMiddleware(options: {
    store: Map<string, ReplayBucket>;
    outcome?: {
      isValid: boolean;
      state: string;
      stableRejection?: boolean;
    };
    now: number;
  }) {
    const middleware = replayGuardMiddleware({
      capacity,
      refillPerSecond: 1 / 60,
      maxStoreSize: 1000,
      failureCooldownMs: 300_000,
      store: options.store,
      now: () => options.now,
    });
    const vars: Record<string, unknown> = { apiKeyHash: "hash" };
    const body = { store: "google" as const, purchaseToken: "tok" };
    let status = 200;
    let payload: unknown;
    const ctx = {
      var: vars,
      get: (k: string) => vars[k],
      set: (k: string, v: unknown) => {
        vars[k] = v;
      },
      req: { valid: () => body },
      header: () => undefined,
      json: (b: unknown, s?: number) => {
        payload = b;
        status = s ?? 200;
        return { status: s ?? 200 };
      },
    };
    const next = async () => {
      if (options.outcome) vars.verifyOutcome = options.outcome;
    };
    return middleware(ctx as never, next as never).then(() => ({
      status,
      payload,
    }));
  }

  it("arms the cooldown for a settled rejection", async () => {
    const store = new Map<string, ReplayBucket>();
    await runMiddleware({
      store,
      outcome: { isValid: false, state: "INAUTHENTIC" },
      now: 1_000,
    });
    const second = await runMiddleware({ store, now: 2_000 });
    expect(second.status).toBe(429);
    expect(second.payload).toMatchObject({
      errors: [{ code: "REPEATED_FAILURE" }],
    });
  });

  it("does not arm it for a state a retry can change", async () => {
    for (const state of ["PENDING", "UNKNOWN", "FUTURE_STORE_STATE"]) {
      const store = new Map<string, ReplayBucket>();
      await runMiddleware({
        store,
        outcome: { isValid: false, state },
        now: 1_000,
      });
      // Still inside the 300s window that spans Google's ~301s void
      // deadline — the retry has to get through.
      const second = await runMiddleware({ store, now: 2_000 });
      expect(second.status).toBe(200);
    }
  });

  it("arms UNKNOWN when the verifier reports a revoked token", async () => {
    const store = new Map<string, ReplayBucket>();
    await runMiddleware({
      store,
      outcome: {
        isValid: false,
        state: "UNKNOWN",
        stableRejection: true,
      },
      now: 1_000,
    });

    const second = await runMiddleware({ store, now: 2_000 });
    expect(second.status).toBe(429);
    expect(second.payload).toMatchObject({
      errors: [{ code: "REPEATED_FAILURE" }],
    });
  });

  it("does not arm it for a successful verification", async () => {
    const store = new Map<string, ReplayBucket>();
    await runMiddleware({
      store,
      outcome: { isValid: true, state: "ENTITLED" },
      now: 1_000,
    });
    expect((await runMiddleware({ store, now: 2_000 })).status).toBe(200);
  });
});
