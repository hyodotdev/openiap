import type { Context } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const convexMock = vi.hoisted(() => ({ mutation: vi.fn() }));
vi.mock("./convex", () => ({ client: { mutation: convexMock.mutation } }));
const source = vi.hoisted(() => ({ limited: false }));
vi.mock("./api/v1/rate-limit", () => ({
  sourceRateLimitMiddleware:
    (options: {
      respond: (ctx: Context, result: { retryAfterSec: number }) => Response;
    }) =>
    async (ctx: Context, next: () => Promise<void>) =>
      source.limited ? options.respond(ctx, { retryAfterSec: 3 }) : next(),
}));

const { oauthRoutes, readOnlyGrantGuard } = await import("./oauth");
const { Hono } = await import("hono");

const TOKENS = {
  access_token: "iapkit_oat_a",
  token_type: "Bearer",
  expires_in: 3600,
  refresh_token: "iapkit_ort_r",
  scope: "iapkit:read",
};

function form(path: string, fields: Record<string, string>) {
  return oauthRoutes.request(path, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

describe("OAuth endpoints for connectors", () => {
  beforeEach(() => {
    vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "a".repeat(64));
    convexMock.mutation.mockReset();
    convexMock.mutation.mockResolvedValue(TOKENS);
    source.limited = false;
  });
  afterEach(() => vi.unstubAllEnvs());

  const signed = { issuedAt: expect.any(Number), mac: expect.any(String) };

  it("describes the MCP resource at both discovery paths", async () => {
    for (const path of [
      "/.well-known/oauth-protected-resource/mcp",
      "/.well-known/oauth-protected-resource",
    ]) {
      const response = await oauthRoutes.request(path);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        resource: "https://kit.openiap.dev/mcp",
        authorization_servers: ["https://kit.openiap.dev"],
        scopes_supported: ["iapkit:read", "iapkit:write"],
      });
    }
  });

  it("advertises what Claude and ChatGPT need to pick CIMD with PKCE", async () => {
    const response = await oauthRoutes.request(
      "/.well-known/oauth-authorization-server",
    );
    await expect(response.json()).resolves.toMatchObject({
      issuer: "https://kit.openiap.dev",
      authorization_endpoint: "https://kit.openiap.dev/oauth/authorize",
      token_endpoint: "https://kit.openiap.dev/oauth/token",
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
    });
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("answers unknown discovery and OAuth paths with a JSON 404", async () => {
    for (const [method, path] of [
      ["GET", "/.well-known/openid-configuration"],
      ["GET", "/oauth/token"],
      ["POST", "/oauth/authorize"],
      ["GET", "/oauth/register"],
    ]) {
      const response = await oauthRoutes.request(path, { method });
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("json");
    }
  });

  it("leaves the consent page to the SPA", async () => {
    const response = await oauthRoutes.request("/oauth/authorize?client_id=x");
    expect(response.headers.get("content-type") ?? "").not.toContain("json");
  });

  it("exchanges a code and never caches the tokens", async () => {
    const response = await form("/oauth/token", {
      grant_type: "authorization_code",
      code: "c",
      code_verifier: "v",
      client_id: "https://claude.ai/oauth/x",
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      resource: "https://kit.openiap.dev/mcp",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual(TOKENS);
    expect(convexMock.mutation).toHaveBeenCalledWith(expect.anything(), {
      server: signed,
      code: "c",
      codeVerifier: "v",
      clientId: "https://claude.ai/oauth/x",
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
      resource: "https://kit.openiap.dev/mcp",
    });
  });

  it("slows a flooding source down before Convex", async () => {
    source.limited = true;
    const response = await form("/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: "r",
      client_id: "https://claude.ai/oauth/x",
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("3");
    await expect(response.json()).resolves.toEqual({
      error: "slow_down",
      error_description: "Too many requests.",
    });
    expect(convexMock.mutation).not.toHaveBeenCalled();
  });

  it("refreshes, and reports a dead grant as invalid_grant", async () => {
    await form("/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: "r",
    });
    expect(convexMock.mutation).toHaveBeenCalledWith(expect.anything(), {
      server: signed,
      refreshToken: "r",
      clientId: undefined,
    });

    convexMock.mutation.mockResolvedValue(null);
    const response = await form("/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: "r",
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_grant" });
  });

  it("rejects other grants, missing fields and JSON bodies before Convex", async () => {
    const cases: [Record<string, string>, string][] = [
      [{ grant_type: "client_credentials" }, "unsupported_grant_type"],
      [{ grant_type: "authorization_code", code: "c" }, "invalid_request"],
      [{ grant_type: "refresh_token" }, "invalid_request"],
    ];
    for (const [fields, error] of cases) {
      const response = await form("/oauth/token", fields);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error });
    }
    const json = await oauthRoutes.request("/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grant_type: "refresh_token", refresh_token: "r" }),
    });
    expect(json.status).toBe(400);
    expect(convexMock.mutation).not.toHaveBeenCalled();
  });

  it("stops reading a body over 8 KiB, declared or streamed", async () => {
    const big = `grant_type=refresh_token&refresh_token=${"r".repeat(9000)}`;
    const declared = await form("/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: "r".repeat(9000),
    });
    expect(declared.status).toBe(413);
    expect(declared.headers.get("cache-control")).toBe("no-store");

    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 100) controller.close();
        else controller.enqueue(new TextEncoder().encode(big));
      },
    });
    const init: RequestInit & { duplex: "half" } = {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: stream,
      duplex: "half",
    };
    const streamed = await oauthRoutes.request("/oauth/revoke", init);
    expect(streamed.status).toBe(413);
    expect(pulled).toBeLessThan(5);
    expect(convexMock.mutation).not.toHaveBeenCalled();
  });

  it("lets a read-only connector's credential only read, anywhere", async () => {
    const app = new Hono();
    app.use("*", readOnlyGrantGuard);
    app.all("*", (c) => c.text("reached"));
    const credential = (scope: "r" | "w") =>
      `openiap-kit_sk_oauth_abc123_${scope}_${"a".repeat(64)}`;
    const send = (method: string, path: string, bearer?: string) =>
      app.request(path, {
        method,
        headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
      });

    for (const [method, path] of [
      ["POST", "/v1/subscriptions/resync"],
      ["PUT", "/v1/products/client-payload/pro"],
      ["DELETE", "/v1/products/client-payload/pro"],
      ["POST", "/mcp"],
    ])
      expect((await send(method, path, credential("r"))).status).toBe(403);
    expect(
      (
        await send(
          "POST",
          `/v1/products/${encodeURIComponent(credential("r"))}`,
        )
      ).status,
    ).toBe(403);
    expect((await send("GET", "/v1/products", credential("r"))).status).toBe(
      200,
    );
    expect((await send("POST", "/v1/products", credential("w"))).status).toBe(
      200,
    );
    expect(
      (await send("POST", "/v1/products", "openiap-kit_sk_plainkey")).status,
    ).toBe(200);

    // Reads outside /v1 can change state (store rechecks), so they are refused.
    for (const path of ["/commerce/v1/entitlements", "/mcp", "/cli/v1/me"])
      expect((await send("GET", path, credential("r"))).status).toBe(403);
    expect(
      (await send("GET", "/v2/subscriptions/status", credential("r"))).status,
    ).toBe(200);
    expect(
      (await send("GET", "/api/v1/products", credential("r"))).status,
    ).toBe(200);
    // Odd whitespace that another parser would trim cannot hide it.
    for (const header of [
      `Bearer ${credential("r")}\u00A0`,
      `Bearer\t${credential("r")}`,
      `bearer  ${credential("r")} `,
    ]) {
      const response = await app.request("/v1/products", {
        method: "POST",
        headers: { authorization: header },
      });
      expect(response.status).toBe(403);
    }
    expect(
      (
        await send(
          "POST",
          `/v1/products/${encodeURIComponent(`${credential("r")}\u00A0`)}`,
        )
      ).status,
    ).toBe(403);
  });

  it("revokes a token with an empty 200", async () => {
    const response = await form("/oauth/revoke", { token: "iapkit_ort_r" });
    expect(response.status).toBe(200);
    expect(convexMock.mutation).toHaveBeenCalledWith(expect.anything(), {
      server: signed,
      token: "iapkit_ort_r",
    });
  });

  it("answers 503 without the server secret, before Convex", async () => {
    vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "");
    const response = await form("/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: "r",
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(convexMock.mutation).not.toHaveBeenCalled();
  });

  it("answers 503 when Convex refuses the server", async () => {
    convexMock.mutation.mockRejectedValue(new Error("UNAUTHENTICATED"));
    const requests: Record<string, string>[] = [
      {
        grant_type: "authorization_code",
        code: "c",
        code_verifier: "v",
        client_id: "https://claude.ai/oauth/x",
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      },
      { grant_type: "refresh_token", refresh_token: "r" },
    ];
    for (const fields of requests) {
      const response = await form("/oauth/token", fields);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        error: "temporarily_unavailable",
      });
    }
    expect((await form("/oauth/revoke", { token: "r" })).status).toBe(503);
  });
});
