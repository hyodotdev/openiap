import { describe, expect, it } from "vitest";

import {
  MAX_DELIVERY_ATTEMPTS,
  checkDestinationUrl,
  isRetryableStatus,
  nextAttemptDelayMs,
  signPayload,
  signPayloadWithRotation,
} from "./signing";

describe("checkDestinationUrl", () => {
  it("accepts a public https endpoint", () => {
    const result = checkDestinationUrl("https://hooks.example.com/iapkit");
    expect(result.ok).toBe(true);
  });

  it("rejects plaintext http", () => {
    expect(checkDestinationUrl("http://hooks.example.com")).toEqual({
      ok: false,
      reason: "scheme-not-https",
    });
  });

  it.each([
    "https://localhost/hook",
    "https://127.0.0.1/hook",
    "https://10.0.0.5/hook",
    "https://192.168.1.10/hook",
    "https://172.16.4.4/hook",
    "https://169.254.169.254/latest/meta-data",
    "https://kube.internal/hook",
    "https://printer.local/hook",
    "https://[::1]/hook",
  ])("rejects private or link-local target %s", (url) => {
    const result = checkDestinationUrl(url);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("host-not-public");
  });

  it("rejects embedded credentials", () => {
    expect(checkDestinationUrl("https://user:pw@example.com/hook")).toEqual({
      ok: false,
      reason: "credentials-in-url",
    });
  });

  it("rejects a malformed url", () => {
    expect(checkDestinationUrl("not a url")).toEqual({
      ok: false,
      reason: "not-a-url",
    });
  });
});

describe("nextAttemptDelayMs", () => {
  it("grows monotonically across the attempt budget", () => {
    let previous = 0;
    for (let attempt = 1; attempt <= MAX_DELIVERY_ATTEMPTS; attempt += 1) {
      const delay = nextAttemptDelayMs(attempt);
      expect(delay).toBeGreaterThanOrEqual(previous);
      previous = delay;
    }
  });

  it("starts at 30s and never exceeds the six-hour cap", () => {
    expect(nextAttemptDelayMs(1)).toBe(30_000);
    expect(nextAttemptDelayMs(100)).toBe(6 * 60 * 60 * 1000);
  });
});

describe("isRetryableStatus", () => {
  it("retries throttling, timeout and server errors", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(408)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });

  it("does not retry a permanent client error", () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });

  it("treats 2xx as non-retryable", () => {
    expect(isRetryableStatus(200)).toBe(false);
  });
});

describe("signPayload", () => {
  const body = JSON.stringify({ eventType: "subscription.renewed" });

  it("is deterministic for the same secret, timestamp and body", async () => {
    const a = await signPayload("shh", 1_700_000_000, body);
    const b = await signPayload("shh", 1_700_000_000, body);
    expect(a).toBe(b);
    expect(a.startsWith("v1=")).toBe(true);
  });

  it("changes when the timestamp changes, so a body cannot be replayed", async () => {
    const a = await signPayload("shh", 1_700_000_000, body);
    const b = await signPayload("shh", 1_700_000_060, body);
    expect(a).not.toBe(b);
  });

  it("changes when the secret changes", async () => {
    const a = await signPayload("shh", 1_700_000_000, body);
    const b = await signPayload("other", 1_700_000_000, body);
    expect(a).not.toBe(b);
  });

  it("emits both signatures during rotation", async () => {
    const rotated = await signPayloadWithRotation(
      { current: "new", previous: "old" },
      1_700_000_000,
      body,
    );
    const current = await signPayload("new", 1_700_000_000, body);
    const previous = await signPayload("old", 1_700_000_000, body);
    expect(rotated).toBe(`${current},${previous}`);
  });

  it("emits a single signature when no previous secret is set", async () => {
    const single = await signPayloadWithRotation(
      { current: "new" },
      1_700_000_000,
      body,
    );
    expect(single.split(",")).toHaveLength(1);
  });
});
