import { describe, expect, test } from "vitest";
import { Hono } from "hono";
import * as v from "valibot";

import { validator } from "./validator";

const schema = v.object({
  name: v.string("Must provide a string"),
  nested: v.object({
    count: v.number("Must provide a number"),
  }),
});

function buildApp() {
  const app = new Hono();
  app.post("/echo", validator(schema), (c) => {
    const json = c.req.valid("json" as never);
    return c.json({ ok: true, echo: json });
  });
  return app;
}

describe("validator", () => {
  test("passes valid payloads through to the handler", async () => {
    const app = buildApp();

    const response = await app.request("/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "hello", nested: { count: 1 } }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      ok: true,
      echo: { name: "hello", nested: { count: 1 } },
    });
  });

  test("parses JSON content types case-insensitively", async () => {
    const app = buildApp();

    const response = await app.request("/echo", {
      method: "POST",
      headers: { "content-type": "Application/JSON; Charset=UTF-8" },
      body: JSON.stringify({ name: "hello", nested: { count: 1 } }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      echo: { name: "hello", nested: { count: 1 } },
    });
  });

  test("parses JSON suffix content types with parameter whitespace", async () => {
    const app = buildApp();

    const response = await app.request("/echo", {
      method: "POST",
      headers: {
        "content-type": "Application/VND.OPENIAP+JSON ; Charset=UTF-8",
      },
      body: JSON.stringify({ name: "hello", nested: { count: 1 } }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      echo: { name: "hello", nested: { count: 1 } },
    });
  });

  test("returns 400 with INVALID_INPUT errors for invalid payloads", async () => {
    const app = buildApp();

    const response = await app.request("/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: 42, nested: { count: "oops" } }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      errors: Array<{ code: string; message: string; path: string }>;
    };

    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors.length).toBeGreaterThan(0);
    for (const issue of body.errors) {
      expect(issue.code).toBe("INVALID_INPUT");
      expect(typeof issue.message).toBe("string");
      expect(typeof issue.path).toBe("string");
    }

    const paths = body.errors.map((e) => e.path);
    expect(paths).toContain("name");
    expect(paths).toContain("nested.count");
  });

  test("returns 413 before validation for oversized JSON bodies", async () => {
    const app = buildApp();

    const response = await app.request("/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "hello",
        nested: { count: 1 },
        padding: "x".repeat(32 * 1024),
      }),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      errors: [
        { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large" },
      ],
    });
  });

  test("returns 413 before reading oversized content-length", async () => {
    const app = buildApp();

    const response = await app.request("/echo", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(32 * 1024 + 1),
      },
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      errors: [
        { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large" },
      ],
    });
  });
});
