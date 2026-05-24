import { describe, expect, test } from "vitest";
import { Hono } from "hono";

import { apiKeyMiddleware } from "./middleware";
import {
  requestLoggerMiddleware,
  type VerifyLogLine,
  type VerifyOutcome,
} from "./request-logger";
import { validator } from "./validator";
import { verifyPurchaseInputSchema } from "./route-input-schemas";

// Shape-valid fixtures for the tightened `verifyPurchaseInputSchema`
// (3-segment base64url JWS ≥ 100 chars; base64url-ish purchaseToken
// ≥ 20 chars). These are still obvious test values — the point is only
// to pass the edge-level format gate so the logger tests can exercise
// the downstream handler behavior.
const TEST_APPLE_JWS = `${"a".repeat(42)}.${"b".repeat(42)}.${"c".repeat(42)}`;
const TEST_GOOGLE_TOKEN = "t".repeat(40);
const TEST_HORIZON_USER_ID = "user_123";
const TEST_HORIZON_SKU = "premium.monthly";
const TEST_AMAZON_USER_ID = "amzn1.account.ABC123";
const TEST_AMAZON_RECEIPT_ID = "amzn1.receipt.ABC123456789";

type TestVars = {
  apiKey?: string;
  apiKeyHash?: string;
  corrId: string;
  verifyOutcome?: VerifyOutcome;
};

function buildApp(params: {
  logs: VerifyLogLine[];
  now?: () => number;
  handler?: (c: {
    set: (k: "verifyOutcome", v: VerifyOutcome) => void;
    json: (data: unknown, status?: number) => Response;
  }) => Response | Promise<Response>;
}) {
  const app = new Hono<{ Variables: TestVars }>();
  let tick = 0;
  const defaultNow = () => {
    tick += 17;
    return tick;
  };
  app.post(
    "/verify",
    apiKeyMiddleware,
    requestLoggerMiddleware({
      logger: (line) => params.logs.push(line),
      now: params.now ?? defaultNow,
      newCorrId: () => "corr-fixed",
    }),
    validator(verifyPurchaseInputSchema),
    (c) => {
      if (params.handler) {
        return params.handler(c);
      }
      c.set("verifyOutcome", { isValid: true, state: "ENTITLED" });
      return c.json({ store: "apple", isValid: true, state: "ENTITLED" });
    },
  );
  return app;
}

describe("requestLoggerMiddleware", () => {
  test("emits one structured log per request with correlation id, duration, and hashed key", async () => {
    const logs: VerifyLogLine[] = [];
    let now = 1_000;
    const app = buildApp({ logs, now: () => (now += 5) });

    const res = await app.request("/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer key-abc",
        "content-type": "application/json",
      },
      body: JSON.stringify({ store: "apple", jws: TEST_APPLE_JWS }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Correlation-Id")).toBe("corr-fixed");
    expect(logs).toHaveLength(1);

    const line = logs[0];
    expect(line.kind).toBe("verify_request");
    expect(line.corrId).toBe("corr-fixed");
    expect(line.method).toBe("POST");
    expect(line.path).toBe("/verify");
    expect(line.statusCode).toBe(200);
    expect(line.store).toBe("apple");
    expect(line.isValid).toBe(true);
    expect(line.state).toBe("ENTITLED");
    expect(line.apiKeyHash).toMatch(/^[0-9a-f]{16}$/);
    expect(line.apiKeyHash).not.toContain("key-abc");
    expect(line.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("still logs when the validator rejects the payload (400)", async () => {
    const logs: VerifyLogLine[] = [];
    const app = buildApp({ logs });

    const res = await app.request("/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer key-xyz",
        "content-type": "application/json",
      },
      body: JSON.stringify({ store: "apple", jws: "" }),
    });

    expect(res.status).toBe(400);
    expect(logs).toHaveLength(1);
    expect(logs[0].statusCode).toBe(400);
    // Validator rejected — `store` in the log may be undefined because
    // c.req.valid() wasn't populated. We still got the rest.
    expect(logs[0].isValid).toBeUndefined();
    expect(logs[0].apiKeyHash).toBeDefined();
  });

  test("logs 5xx outcomes when the handler sets a failed verifyOutcome", async () => {
    const logs: VerifyLogLine[] = [];
    const app = buildApp({
      logs,
      handler: (c) => {
        c.set("verifyOutcome", { isValid: false, state: "INAUTHENTIC" });
        return c.json(
          { store: "google", isValid: false, state: "INAUTHENTIC" },
          500,
        );
      },
    });

    const res = await app.request("/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer key-1",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        store: "google",
        purchaseToken: TEST_GOOGLE_TOKEN,
      }),
    });

    expect(res.status).toBe(500);
    expect(logs).toHaveLength(1);
    expect(logs[0].statusCode).toBe(500);
    expect(logs[0].store).toBe("google");
    expect(logs[0].isValid).toBe(false);
    expect(logs[0].state).toBe("INAUTHENTIC");
  });

  test("logs Horizon verification store values", async () => {
    const logs: VerifyLogLine[] = [];
    const app = buildApp({ logs });

    const res = await app.request("/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer key-horizon",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        store: "horizon",
        userId: TEST_HORIZON_USER_ID,
        sku: TEST_HORIZON_SKU,
      }),
    });

    expect(res.status).toBe(200);
    expect(logs).toHaveLength(1);
    expect(logs[0].store).toBe("horizon");
  });

  test("logs Amazon verification store values", async () => {
    const logs: VerifyLogLine[] = [];
    const app = buildApp({ logs });

    const res = await app.request("/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer key-amazon",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        store: "amazon",
        userId: TEST_AMAZON_USER_ID,
        receiptId: TEST_AMAZON_RECEIPT_ID,
        sandbox: true,
      }),
    });

    expect(res.status).toBe(200);
    expect(logs).toHaveLength(1);
    expect(logs[0].store).toBe("amazon");
  });

  test("populates the X-Correlation-Id response header even on validator failure", async () => {
    const logs: VerifyLogLine[] = [];
    const app = buildApp({ logs });
    const res = await app.request("/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer k",
        "content-type": "application/json",
      },
      body: "not-json-at-all",
    });
    // 400 regardless of exact status — validator or JSON parser will reject.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.headers.get("X-Correlation-Id")).toBe("corr-fixed");
  });

  test("reuses c.var.apiKeyHash when a preceding middleware has pre-computed it", async () => {
    const logs: VerifyLogLine[] = [];
    const app = new Hono<{ Variables: TestVars }>();
    // Stand-in for rateLimitMiddleware: sets a known hash on the
    // context so we can assert the logger consumes it verbatim
    // instead of rehashing the plaintext apiKey.
    app.use("*", async (c, next) => {
      c.set("apiKey", "ignored-plaintext");
      c.set("apiKeyHash", "cafebabecafebabe");
      await next();
    });
    app.post(
      "/verify",
      requestLoggerMiddleware({
        logger: (line) => logs.push(line),
        now: () => 0,
        newCorrId: () => "corr-fixed",
      }),
      validator(verifyPurchaseInputSchema),
      (c) => {
        c.set("verifyOutcome", { isValid: true, state: "ENTITLED" });
        return c.json({ store: "apple", isValid: true, state: "ENTITLED" });
      },
    );

    const res = await app.request("/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ store: "apple", jws: TEST_APPLE_JWS }),
    });

    expect(res.status).toBe(200);
    expect(logs).toHaveLength(1);
    // Reused exactly — NOT the sha256 prefix of "ignored-plaintext".
    expect(logs[0].apiKeyHash).toBe("cafebabecafebabe");
  });

  test("still logs when the handler throws (try/finally around next())", async () => {
    const logs: VerifyLogLine[] = [];
    const app = buildApp({
      logs,
      handler: () => {
        throw new Error("boom");
      },
    });

    // Hono surfaces the thrown error as a 500. The log line is what
    // we care about — it should have fired inside the `finally`.
    const res = await app.request("/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer k-throws",
        "content-type": "application/json",
      },
      body: JSON.stringify({ store: "apple", jws: TEST_APPLE_JWS }),
    });

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(logs).toHaveLength(1);
    expect(logs[0].corrId).toBe("corr-fixed");
    expect(logs[0].statusCode).toBe(500);
    expect(logs[0].apiKeyHash).toBeDefined();
    expect(logs[0].store).toBe("apple");
  });
});
