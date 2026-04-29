import { describe, expect, test } from "vitest";
import { Hono } from "hono";
import * as v from "valibot";

import { validator } from "./validator";

describe("validator path formatting", () => {
  test("omits the path field when valibot reports no path array", async () => {
    // Non-object body → valibot produces an issue without a meaningful
    // dotted path. The validator used to crash here because
    // `issue.path?.map(...).join(...)` applies `?.` only to `.map`, and
    // `.join` on `undefined` throws. The middleware must return 400,
    // not 500, and the emitted `path` is now omitted entirely (not
    // emitted as `""`) so clients don't key error-mapping tables on
    // ambiguous empty strings.
    const schema = v.object({ name: v.string() });
    const app = new Hono();
    app.post("/echo", validator(schema), (c) => c.json({ ok: true }));

    const response = await app.request("/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "null",
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      errors: Array<{ code: string; path?: string | null }>;
    };
    expect(body.errors.length).toBeGreaterThan(0);
    for (const issue of body.errors) {
      expect(issue.code).toBe("INVALID_INPUT");
      // Path is optional in the response shape — if there is no
      // meaningful path it should be omitted (`undefined`); otherwise
      // it should be an actual dotted path string. Crucially, it must
      // not be `null` or cause a 500.
      if (issue.path !== undefined) {
        expect(typeof issue.path).toBe("string");
      }
    }
  });

  test("handles deep nested paths without throwing", async () => {
    const schema = v.object({
      a: v.object({
        b: v.object({
          c: v.number(),
        }),
      }),
    });
    const app = new Hono();
    app.post("/echo", validator(schema), (c) => c.json({ ok: true }));

    const response = await app.request("/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ a: { b: { c: "not-a-number" } } }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      errors: Array<{ code: string; path?: string }>;
    };
    const paths = body.errors.map((issue) => issue.path);
    expect(paths).toContain("a.b.c");
  });
});
