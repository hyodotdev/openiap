import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { inFlightLimitMiddleware, type InFlightState } from "./in-flight-limit";

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("inFlightLimitMiddleware", () => {
  it("isolates API keys, enforces the global cap, and releases every slot", async () => {
    const state: InFlightState = {
      active: 0,
      byKey: new Map(),
      byIp: new Map(),
    };
    const gate = deferred();
    const app = new Hono<{ Variables: { apiKeyHash: string } }>();

    app.use("*", async (c, next) => {
      c.set("apiKeyHash", c.req.header("X-Test-Key") ?? "test-key");
      await next();
    });

    app.post(
      "/verify",
      inFlightLimitMiddleware({
        maxInFlight: 2,
        maxInFlightPerKey: 1,
        retryAfterSeconds: 3,
        state,
      }),
      async (c) => {
        await gate.promise;
        return c.json({ ok: true });
      },
    );

    const acceptedA = app.request("/verify", {
      method: "POST",
      headers: { "X-Test-Key": "key-a" },
    });
    await Promise.resolve();
    expect(state.active).toBe(1);

    const rejectedKey = await app.request("/verify", {
      method: "POST",
      headers: { "X-Test-Key": "key-a" },
    });
    expect(rejectedKey.status).toBe(503);
    expect(rejectedKey.headers.get("Retry-After")).toBe("3");
    expect(rejectedKey.headers.get("X-Concurrency-Limit")).toBe("1");
    expect(rejectedKey.headers.get("X-Concurrency-Remaining")).toBe("0");
    expect(rejectedKey.headers.get("X-Concurrency-Scope")).toBe("key");
    expect(await rejectedKey.json()).toMatchObject({
      errors: [{ code: "SERVICE_BUSY" }],
    });
    expect(state.active).toBe(1);

    const acceptedB = app.request("/verify", {
      method: "POST",
      headers: { "X-Test-Key": "key-b" },
    });
    await Promise.resolve();
    expect(state.active).toBe(2);

    const rejectedGlobal = await app.request("/verify", {
      method: "POST",
      headers: { "X-Test-Key": "key-c" },
    });
    expect(rejectedGlobal.status).toBe(503);
    expect(rejectedGlobal.headers.get("X-Concurrency-Limit")).toBe("2");
    expect(rejectedGlobal.headers.get("X-Concurrency-Scope")).toBe("global");
    expect(rejectedGlobal.headers.get("Retry-After")).toBe("3");
    expect(await rejectedGlobal.json()).toMatchObject({
      errors: [{ code: "SERVICE_BUSY" }],
    });

    gate.resolve();
    const [acceptedResponseA, acceptedResponseB] = await Promise.all([
      acceptedA,
      acceptedB,
    ]);
    expect(acceptedResponseA.status).toBe(200);
    expect(acceptedResponseB.status).toBe(200);
    expect(acceptedResponseA.headers.get("X-Concurrency-Scope")).toBe("key");
    expect(state.active).toBe(0);
    expect(state.byKey.size).toBe(0);
    expect(state.byIp.size).toBe(0);
  });

  it("prevents one source from rotating keys to occupy the global pool", async () => {
    const state: InFlightState = {
      active: 0,
      byKey: new Map(),
      byIp: new Map(),
    };
    const gate = deferred();
    const app = new Hono<{ Variables: { apiKeyHash: string } }>();
    app.use("*", async (c, next) => {
      c.set("apiKeyHash", c.req.header("X-Test-Key") ?? "test-key");
      await next();
    });
    app.post(
      "/verify",
      inFlightLimitMiddleware({
        maxInFlight: 4,
        maxInFlightPerKey: 1,
        maxInFlightPerIp: 2,
        getIp: (c) => c.req.header("X-Test-Ip"),
        state,
      }),
      async (c) => {
        await gate.promise;
        return c.json({ ok: true });
      },
    );

    const acceptedA = app.request("/verify", {
      method: "POST",
      headers: { "X-Test-Key": "key-a", "X-Test-Ip": "source-a" },
    });
    const acceptedB = app.request("/verify", {
      method: "POST",
      headers: { "X-Test-Key": "key-b", "X-Test-Ip": "source-a" },
    });
    await Promise.resolve();
    expect(state.active).toBe(2);

    const rotatedKey = await app.request("/verify", {
      method: "POST",
      headers: { "X-Test-Key": "key-c", "X-Test-Ip": "source-a" },
    });
    expect(rotatedKey.status).toBe(503);
    expect(rotatedKey.headers.get("X-Concurrency-Limit")).toBe("2");
    expect(rotatedKey.headers.get("X-Concurrency-Scope")).toBe("ip");
    expect(await rotatedKey.json()).toMatchObject({
      errors: [{ code: "SERVICE_BUSY" }],
    });
    expect(state.active).toBe(2);

    const acceptedOtherSource = app.request("/verify", {
      method: "POST",
      headers: { "X-Test-Key": "key-c", "X-Test-Ip": "source-b" },
    });
    await Promise.resolve();
    expect(state.active).toBe(3);

    gate.resolve();
    const responses = await Promise.all([
      acceptedA,
      acceptedB,
      acceptedOtherSource,
    ]);
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(state.active).toBe(0);
    expect(state.byKey.size).toBe(0);
    expect(state.byIp.size).toBe(0);
  });

  it("releases a slot when downstream throws", async () => {
    const state: InFlightState = {
      active: 0,
      byKey: new Map(),
      byIp: new Map(),
    };
    const app = new Hono<{ Variables: { apiKeyHash: string } }>();
    app.use("*", async (c, next) => {
      c.set("apiKeyHash", "error-key");
      await next();
    });
    app.onError((_error, c) => c.json({ ok: false }, 500));
    app.post(
      "/verify",
      inFlightLimitMiddleware({ maxInFlight: 1, state }),
      () => {
        throw new Error("upstream failed");
      },
    );

    const response = await app.request("/verify", { method: "POST" });

    expect(response.status).toBe(500);
    expect(state.active).toBe(0);
    expect(state.byKey.size).toBe(0);
    expect(state.byIp.size).toBe(0);
  });

  it("fails closed when the API key hash middleware is missing", async () => {
    const app = new Hono();
    app.post("/verify", inFlightLimitMiddleware({ maxInFlight: 4 }), (c) =>
      c.json({ ok: true }),
    );

    const response = await app.request("/verify", { method: "POST" });

    expect(response.status).toBe(500);
    expect(response.headers.get("X-Concurrency-Limit")).toBe("4");
    expect(response.headers.get("X-Concurrency-Remaining")).toBe("0");
    expect(response.headers.get("X-Concurrency-Scope")).toBe("global");
    expect(await response.json()).toEqual({
      errors: [
        {
          code: "INTERNAL_MISCONFIGURATION",
          message:
            "Concurrency guard ran before the API key hash was populated.",
        },
      ],
    });
  });
});
