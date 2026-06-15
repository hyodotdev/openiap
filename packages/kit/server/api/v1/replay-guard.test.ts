import { describe, expect, test } from "vitest";

import {
  hashPayload,
  markPayloadFailure,
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
