import { describe, expect, it } from "vitest";

import {
  CLAIM_BATCH_LIMIT,
  LEASE_MS,
  MAX_DELIVERY_ATTEMPTS,
  REQUEST_TIMEOUT_MS,
  checkDestinationUrl,
  isPublicIpAddress,
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

  it.each([
    "https://fcm.googleapis.com/hook",
    "https://fd-hooks.example.com/hook",
  ])("accepts a public hostname beginning with an IPv6 prefix: %s", (url) => {
    expect(checkDestinationUrl(url).ok).toBe(true);
  });

  it("drops a fragment that HTTP can never transmit", () => {
    const result = checkDestinationUrl(
      "https://hooks.example.com/iapkit#local",
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.url.toString()).toBe("https://hooks.example.com/iapkit");
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
    "https://127.1.2.3/hook",
    "https://0.0.0.0/hook",
    "https://192.0.0.1/hook",
    "https://192.88.99.1/hook",
    "https://198.51.100.1/hook",
    "https://224.0.0.1/hook",
    "https://240.0.0.1/hook",
    "https://10.0.0.5/hook",
    "https://192.168.1.10/hook",
    "https://172.16.4.4/hook",
    "https://169.254.169.254/latest/meta-data",
    "https://kube.internal/hook",
    "https://printer.local/hook",
    "https://localhost./hook",
    "https://printer.local./hook",
    "https://service.internal./hook",
    "https://100.64.0.1/hook",
    "https://198.18.0.1/hook",
    "https://192.0.2.1/hook",
    "https://203.0.113.1/hook",
    "https://[::1]/hook",
    "https://[fd00::1]/hook",
    "https://[fe80::1]/hook",
    "https://[2001:1::1]/hook",
    "https://[2001:3::1]/hook",
  ])("rejects non-public target %s", (url) => {
    const result = checkDestinationUrl(url);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("host-not-public");
  });

  // `URL` rewrites these to `[::ffff:7f00:1]` and friends, so a check that only
  // looks at the textual host lets loopback and the cloud metadata endpoint
  // straight through while `fetch` still reaches them.
  it.each([
    "https://[::ffff:127.0.0.1]/hook",
    "https://[::ffff:169.254.169.254]/latest/meta-data",
    "https://[::ffff:10.0.0.5]/hook",
    "https://[::ffff:192.168.1.10]/hook",
    "https://[::ffff:172.16.4.4]/hook",
    "https://[::127.0.0.1]/hook",
  ])("rejects the IPv4-mapped spelling of %s", (url) => {
    const result = checkDestinationUrl(url);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("host-not-public");
  });

  it.each([
    "https://[2606:4700:4700::1111]/hook",
    "https://[::ffff:8.8.8.8]/hook",
    "https://93.184.216.34/hook",
  ])("still accepts public target %s", (url) => {
    expect(checkDestinationUrl(url).ok).toBe(true);
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

  it("does not parse malformed IPv4 octets as numbers", () => {
    expect(isPublicIpAddress("127..0.1")).toBe(false);
    expect(isPublicIpAddress("127. 0.0.1")).toBe(false);
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

  it("keeps retrying through an outage lasting more than a day", () => {
    const timeToFinalAttempt = Array.from(
      { length: MAX_DELIVERY_ATTEMPTS - 1 },
      (_, index) => nextAttemptDelayMs(index + 1),
    ).reduce((total, delay) => total + delay, 0);
    expect(timeToFinalAttempt).toBeGreaterThan(24 * 60 * 60 * 1000);
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

describe("lease sizing", () => {
  it("covers a worst-case request plus persistence overhead", () => {
    expect(LEASE_MS).toBeGreaterThan(REQUEST_TIMEOUT_MS);
    expect(CLAIM_BATCH_LIMIT).toBeGreaterThan(1);
  });
});
