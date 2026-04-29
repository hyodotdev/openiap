import { describe, expect, test, vi } from "vitest";

import {
  extractHttpStatus,
  isTransientHttpError,
  retryOnTransient,
} from "./retry";

function fakeSleep() {
  const calls: number[] = [];
  const sleep = (ms: number) => {
    calls.push(ms);
    return Promise.resolve();
  };
  return { sleep, calls };
}

describe("extractHttpStatus", () => {
  test("reads numeric .code (googleapis / gaxios shape)", () => {
    expect(extractHttpStatus({ code: 503 })).toBe(503);
  });

  test("reads .status when .code is not numeric", () => {
    expect(extractHttpStatus({ status: 500 })).toBe(500);
  });

  test("reads nested .response.status", () => {
    expect(extractHttpStatus({ response: { status: 502 } })).toBe(502);
  });

  test("returns undefined for plain errors", () => {
    expect(extractHttpStatus(new Error("boom"))).toBeUndefined();
    expect(extractHttpStatus("string-error")).toBeUndefined();
    expect(extractHttpStatus(null)).toBeUndefined();
  });
});

describe("isTransientHttpError", () => {
  test("5xx HTTP is transient", () => {
    expect(isTransientHttpError({ code: 500 })).toBe(true);
    expect(isTransientHttpError({ code: 503 })).toBe(true);
    expect(isTransientHttpError({ code: 599 })).toBe(true);
  });

  test("4xx HTTP is NOT transient", () => {
    expect(isTransientHttpError({ code: 400 })).toBe(false);
    expect(isTransientHttpError({ code: 404 })).toBe(false);
    expect(isTransientHttpError({ code: 410 })).toBe(false);
    expect(isTransientHttpError({ code: 429 })).toBe(false);
  });

  test("Node network errors are transient", () => {
    expect(isTransientHttpError({ code: "ECONNRESET" })).toBe(true);
    expect(isTransientHttpError({ code: "ETIMEDOUT" })).toBe(true);
    expect(isTransientHttpError({ code: "EAI_AGAIN" })).toBe(true);
  });

  test("unrecognized errors are NOT transient (fail fast)", () => {
    expect(isTransientHttpError(new Error("random"))).toBe(false);
    expect(isTransientHttpError({ code: "SOMETHING_ELSE" })).toBe(false);
  });
});

describe("retryOnTransient", () => {
  test("returns result on first success without sleeping", async () => {
    const { sleep, calls } = fakeSleep();
    const fn = vi.fn().mockResolvedValue("ok");

    const result = await retryOnTransient(fn, { sleep });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(0);
  });

  test("retries 5xx up to maxAttempts and eventually throws the last error", async () => {
    const { sleep, calls } = fakeSleep();
    const err = Object.assign(new Error("upstream down"), { code: 503 });
    const fn = vi.fn().mockRejectedValue(err);

    await expect(
      retryOnTransient(fn, { sleep, maxAttempts: 3, baseDelayMs: 100 }),
    ).rejects.toBe(err);

    expect(fn).toHaveBeenCalledTimes(3);
    // 2 sleeps between 3 attempts.
    expect(calls).toHaveLength(2);
  });

  test("recovers on retry when the transient error clears", async () => {
    const { sleep } = fakeSleep();
    const err = Object.assign(new Error("transient"), { code: 502 });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce("finally");

    const result = await retryOnTransient(fn, { sleep, maxAttempts: 4 });

    expect(result).toBe("finally");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test("does NOT retry 4xx — fails fast after a single attempt", async () => {
    const { sleep, calls } = fakeSleep();
    const err = Object.assign(new Error("not found"), { code: 404 });
    const fn = vi.fn().mockRejectedValue(err);

    await expect(retryOnTransient(fn, { sleep })).rejects.toBe(err);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(0);
  });

  test("honors a custom shouldRetry predicate", async () => {
    const { sleep } = fakeSleep();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("retry me"))
      .mockResolvedValueOnce("done");

    const result = await retryOnTransient(fn, {
      sleep,
      maxAttempts: 3,
      shouldRetry: () => true,
    });

    expect(result).toBe("done");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("backoff grows exponentially but caps at maxDelayMs", async () => {
    const { sleep, calls } = fakeSleep();
    const err = Object.assign(new Error("transient"), { code: 500 });
    const fn = vi.fn().mockRejectedValue(err);

    await expect(
      retryOnTransient(fn, {
        sleep,
        maxAttempts: 5,
        baseDelayMs: 100,
        maxDelayMs: 300,
      }),
    ).rejects.toBe(err);

    // Expected raw delays: 100, 200, 400, 800 — all capped to 300 except
    // the first two. Jitter is in [0.5, 1.0) so every delay must be
    // within [0.5*cap, cap).
    expect(calls).toHaveLength(4);
    const [d1, d2, d3, d4] = calls;
    expect(d1).toBeGreaterThanOrEqual(50);
    expect(d1).toBeLessThan(100);
    expect(d2).toBeGreaterThanOrEqual(100);
    expect(d2).toBeLessThan(200);
    expect(d3).toBeGreaterThanOrEqual(150);
    expect(d3).toBeLessThan(300);
    expect(d4).toBeGreaterThanOrEqual(150);
    expect(d4).toBeLessThan(300);
  });
});
