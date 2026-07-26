import { describe, expect, test } from "vitest";
import { Hono } from "hono";

import {
  apiKeyMiddleware,
  apiKeyValidationError,
  isPublishableApiKey,
  secretAdminApiKeyMiddleware,
} from "./middleware";

function buildApp() {
  const app = new Hono();
  app.post("/verify", apiKeyMiddleware, (c) => {
    return c.json({ ok: true, apiKey: c.var.apiKey });
  });
  app.get("/admin", apiKeyMiddleware, secretAdminApiKeyMiddleware, (c) =>
    c.json({ ok: true }),
  );
  return app;
}

describe("apiKeyMiddleware", () => {
  test("accepts a well-formed Bearer header and exposes the key on c.var", async () => {
    const app = buildApp();
    const response = await app.request("/verify", {
      method: "POST",
      headers: { Authorization: "Bearer openiap-kit_abc123" },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, apiKey: "openiap-kit_abc123" });
  });

  test("tolerates multiple spaces between scheme and key", async () => {
    const app = buildApp();
    const response = await app.request("/verify", {
      method: "POST",
      headers: { Authorization: "Bearer   openiap-kit_abc123" },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.apiKey).toBe("openiap-kit_abc123");
  });

  test("tolerates leading / trailing whitespace in the header", async () => {
    const app = buildApp();
    const response = await app.request("/verify", {
      method: "POST",
      headers: { Authorization: "  Bearer openiap-kit_abc123  " },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.apiKey).toBe("openiap-kit_abc123");
  });

  test("is case-insensitive on the Bearer scheme", async () => {
    const app = buildApp();
    const response = await app.request("/verify", {
      method: "POST",
      headers: { Authorization: "bearer openiap-kit_abc123" },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.apiKey).toBe("openiap-kit_abc123");
  });

  test("returns 401 MISSING_API_KEY when no Authorization header is provided", async () => {
    const app = buildApp();
    const response = await app.request("/verify", {
      method: "POST",
    });
    expect(response.status).toBe(401);
    const body = (await response.json()) as {
      errors: Array<{ code: string; message: string }>;
    };
    expect(body.errors[0].code).toBe("MISSING_API_KEY");
  });

  test("returns 403 INVALID_API_KEY when the scheme is not Bearer", async () => {
    const app = buildApp();
    const response = await app.request("/verify", {
      method: "POST",
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as {
      errors: Array<{ code: string }>;
    };
    expect(body.errors[0].code).toBe("INVALID_API_KEY");
  });

  test("returns 403 INVALID_API_KEY when the key is missing", async () => {
    const app = buildApp();
    const response = await app.request("/verify", {
      method: "POST",
      headers: { Authorization: "Bearer" },
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as {
      errors: Array<{ code: string }>;
    };
    expect(body.errors[0].code).toBe("INVALID_API_KEY");
  });

  test("returns 403 INVALID_API_KEY when there are more than two whitespace-separated parts", async () => {
    const app = buildApp();
    const response = await app.request("/verify", {
      method: "POST",
      headers: { Authorization: "Bearer abc extra" },
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as {
      errors: Array<{ code: string }>;
    };
    expect(body.errors[0].code).toBe("INVALID_API_KEY");
  });

  test("returns 403 INVALID_API_KEY when the key is oversized", async () => {
    const app = buildApp();
    const response = await app.request("/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${"a".repeat(129)}` },
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as {
      errors: Array<{ code: string; message: string }>;
    };
    expect(body.errors[0]).toEqual({
      code: "INVALID_API_KEY",
      message: "API key is too long",
    });
  });
});

describe("secretAdminApiKeyMiddleware", () => {
  test("returns 403 before admin handlers for publishable keys", async () => {
    const app = buildApp();
    const response = await app.request("/admin", {
      headers: { Authorization: "Bearer openiap-kit_pk_mobile" },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "INSUFFICIENT_SCOPE",
          message:
            "This operation requires a secret admin key. Publishable mobile keys cannot access administrative operations.",
        },
      ],
    });
  });

  test("lets secret and legacy-looking keys reach authoritative backend checks", async () => {
    const app = buildApp();

    for (const apiKey of ["openiap-kit_sk_admin", "openiap-kit_legacy"]) {
      const response = await app.request("/admin", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      expect(response.status).toBe(200);
    }
  });

  test("recognizes only the publishable prefix as an early-deny signal", () => {
    expect(isPublishableApiKey("openiap-kit_pk_mobile")).toBe(true);
    expect(isPublishableApiKey("openiap-kit_sk_admin")).toBe(false);
    expect(isPublishableApiKey("openiap-kit_legacy")).toBe(false);
  });
});

describe("apiKeyValidationError", () => {
  test("rejects blank, malformed, and oversized keys", () => {
    expect(apiKeyValidationError("  ")).toBe("API key is required");
    expect(apiKeyValidationError("openiap-kit_abc 123")).toBe(
      "API key is malformed",
    );
    expect(apiKeyValidationError("a".repeat(129))).toBe("API key is too long");
    expect(apiKeyValidationError("openiap-kit_abc123")).toBeNull();
  });
});
