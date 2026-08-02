import { Hono } from "hono";
import { describe, expect, test } from "vitest";

import { inFlightLimitMiddleware, type InFlightState } from "./in-flight-limit";
import { replayGuardMiddleware, type ReplayBucket } from "./replay-guard";
import { verifyPurchaseInputSchema } from "./route-input-schemas";
import { validator } from "./validator";

interface TestVariables {
  apiKeyHash: string;
  verifyCapacityRejected?: boolean;
}

const verifyBody = {
  store: "apple",
  jws: `${"a".repeat(40)}.${"b".repeat(40)}.${"c".repeat(40)}`,
} as const;

function createApp(
  store: Map<string, ReplayBucket>,
  state: InFlightState,
  handlerStatus: 200 | 503 = 200,
): Hono<{ Variables: TestVariables }> {
  const app = new Hono<{ Variables: TestVariables }>();
  app.use("*", async (c, next) => {
    c.set("apiKeyHash", "test-key");
    await next();
  });
  app.post(
    "/verify",
    validator(verifyPurchaseInputSchema),
    replayGuardMiddleware({
      capacity: 1,
      refillPerSecond: 1 / 3_600,
      maxStoreSize: 100,
      failureCooldownMs: 60_000,
      now: () => 1_000,
      store,
    }),
    inFlightLimitMiddleware({
      maxInFlight: 1,
      maxInFlightPerKey: 1,
      maxInFlightPerIp: 1,
      state,
      getIp: () => "203.0.113.1",
    }),
    (c) =>
      handlerStatus === 200
        ? c.json({ ok: true }, 200)
        : c.json({ errors: [{ code: "UPSTREAM_UNAVAILABLE" }] }, 503),
  );
  return app;
}

function verifyRequest(): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(verifyBody),
  };
}

describe("replay guard with verification capacity", () => {
  test("refunds attempts rejected with SERVICE_BUSY", async () => {
    const store = new Map<string, ReplayBucket>();
    const state: InFlightState = {
      active: 1,
      byKey: new Map(),
      byIp: new Map(),
    };
    const app = createApp(store, state);

    const first = await app.request("/verify", verifyRequest());
    const second = await app.request("/verify", verifyRequest());

    expect(first.status).toBe(503);
    expect(second.status).toBe(503);
    expect(await second.json()).toMatchObject({
      errors: [{ code: "SERVICE_BUSY" }],
    });
    expect([...store.values()]).toHaveLength(1);
    expect([...store.values()][0]?.tokens).toBe(1);
  });

  test("keeps the replay charge after successful verification", async () => {
    const store = new Map<string, ReplayBucket>();
    const state: InFlightState = {
      active: 0,
      byKey: new Map(),
      byIp: new Map(),
    };
    const app = createApp(store, state);

    const first = await app.request("/verify", verifyRequest());
    const second = await app.request("/verify", verifyRequest());

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(await second.json()).toMatchObject({
      errors: [{ code: "DUPLICATE_PAYLOAD" }],
    });
  });

  test("does not refund a downstream 503 after capacity was accepted", async () => {
    const store = new Map<string, ReplayBucket>();
    const state: InFlightState = {
      active: 0,
      byKey: new Map(),
      byIp: new Map(),
    };
    const app = createApp(store, state, 503);

    const first = await app.request("/verify", verifyRequest());
    const second = await app.request("/verify", verifyRequest());

    expect(first.status).toBe(503);
    expect(second.status).toBe(429);
    expect(await second.json()).toMatchObject({
      errors: [{ code: "DUPLICATE_PAYLOAD" }],
    });
  });
});
