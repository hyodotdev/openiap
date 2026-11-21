import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";

import { api } from "@/convex";
import {
  OAUTH_SCOPES,
  oauthIssuer,
  oauthResource,
} from "../convex/oauth/clients";
import {
  isReadOnlyGrantApiKey,
  oauthServerProof,
} from "../convex/oauth/grants";
import { sourceRateLimitMiddleware } from "./api/v1/rate-limit";

const MAX_FORM_BYTES = 8 * 1024;

/** Where an MCP client learns which authorization server guards `/mcp`. */
export function oauthResourceMetadataUrl(): string {
  return `${oauthIssuer()}/.well-known/oauth-protected-resource/mcp`;
}

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// The `/v1` and `/v2` GET handlers only run Convex queries; commerce GETs
// can recheck stores and write.
const READ_ONLY_PATHS = /^\/(?:api\/)?v[12]\//;

/**
 * A read-only connector's credential only reads `/v1` and `/v2` with GET, as
 * its tools do; any other use is refused. Every whitespace-separated piece of the
 * Authorization header and of each path segment is checked, so no parser
 * downstream can find a credential this one missed.
 */
export const readOnlyGrantGuard = createMiddleware(async (c, next) => {
  const pieces = [
    c.req.header("authorization") ?? "",
    ...c.req.path.split("/"),
  ].flatMap((piece) => piece.split(/\s+/));
  if (
    !pieces.some(isReadOnlyGrantApiKey) ||
    (READ_METHODS.has(c.req.method) && READ_ONLY_PATHS.test(c.req.path))
  )
    return next();
  return c.json(
    {
      errors: [
        {
          code: "INSUFFICIENT_SCOPE",
          message: "This connection is read-only.",
        },
      ],
    },
    403,
  );
});

/**
 * OAuth 2.1 for connectors (Claude, ChatGPT): discovery documents and the
 * token endpoints. The consent page, `/oauth/authorize`, is part of the SPA.
 */
export const oauthRoutes = new Hono();

oauthRoutes.use("/.well-known/*", cors({ origin: "*" }));
for (const path of ["/oauth/token", "/oauth/revoke"]) {
  oauthRoutes.use(path, cors({ origin: "*" }));
  // Before the limits, so their 413 and 429 are not cached either.
  oauthRoutes.use(path, async (c, next) => {
    c.header("Cache-Control", "no-store");
    await next();
  });
}

function protectedResource() {
  return {
    resource: oauthResource(),
    authorization_servers: [oauthIssuer()],
    scopes_supported: OAUTH_SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "IAPKit",
    resource_documentation: `${oauthIssuer()}/docs/ai-assistants`,
  };
}

// Clients probe the path-suffixed form first, then the bare one.
oauthRoutes.get("/.well-known/oauth-protected-resource/mcp", (c) =>
  c.json(protectedResource()),
);
oauthRoutes.get("/.well-known/oauth-protected-resource", (c) =>
  c.json(protectedResource()),
);

oauthRoutes.get("/.well-known/oauth-authorization-server", (c) => {
  const issuer = oauthIssuer();
  return c.json({
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: OAUTH_SCOPES,
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  });
});

const tokenRateLimit = sourceRateLimitMiddleware({
  respond: (c, result) =>
    c.json(
      { error: "slow_down", error_description: "Too many requests." },
      429,
      { "Retry-After": String(result.retryAfterSec) },
    ),
});

// Stops reading an oversized body instead of buffering it first.
const formLimit = bodyLimit({
  maxSize: MAX_FORM_BYTES,
  onError: (c) =>
    c.json(
      { error: "invalid_request", error_description: "Body is too large." },
      413,
    ),
});

async function readForm(request: Request): Promise<URLSearchParams | null> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/x-www-form-urlencoded")
  )
    return null;
  return new URLSearchParams(await request.text());
}

const unavailable = (c: Context) =>
  c.json(
    {
      error: "temporarily_unavailable",
      error_description: "Connectors are not configured on this server.",
    },
    503,
  );

oauthRoutes.post("/oauth/token", tokenRateLimit, formLimit, async (c) => {
  const form = await readForm(c.req.raw);
  if (!form)
    return c.json(
      {
        error: "invalid_request",
        error_description: "Send application/x-www-form-urlencoded.",
      },
      400,
    );
  const server = await oauthServerProof();
  if (!server) return unavailable(c);
  const { client } = await import("./convex");
  const field = (name: string) => form.get(name) ?? undefined;
  const grantType = field("grant_type");
  let tokens;
  if (grantType === "authorization_code") {
    const code = field("code");
    const codeVerifier = field("code_verifier");
    const clientId = field("client_id");
    const redirectUri = field("redirect_uri");
    if (!code || !codeVerifier || !clientId || !redirectUri)
      return c.json(
        {
          error: "invalid_request",
          error_description:
            "code, code_verifier, client_id and redirect_uri are required.",
        },
        400,
      );
    tokens = await client.mutation(api.oauth.mutation.exchange, {
      server,
      code,
      codeVerifier,
      clientId,
      redirectUri,
      resource: field("resource"),
    });
  } else if (grantType === "refresh_token") {
    const refreshToken = field("refresh_token");
    if (!refreshToken)
      return c.json(
        {
          error: "invalid_request",
          error_description: "refresh_token is required.",
        },
        400,
      );
    tokens = await client.mutation(api.oauth.mutation.refresh, {
      server,
      refreshToken,
      clientId: field("client_id"),
    });
  } else {
    return c.json({ error: "unsupported_grant_type" }, 400);
  }
  return tokens ? c.json(tokens) : c.json({ error: "invalid_grant" }, 400);
});

oauthRoutes.post("/oauth/revoke", tokenRateLimit, formLimit, async (c) => {
  const token = (await readForm(c.req.raw))?.get("token");
  if (!token) return c.json({ error: "invalid_request" }, 400);
  const server = await oauthServerProof();
  if (!server) return unavailable(c);
  const { client } = await import("./convex");
  await client.mutation(api.oauth.mutation.revoke, { server, token });
  return c.body(null, 200);
});

// The consent page is the SPA's; everything else here is a real 404.
oauthRoutes.all("/.well-known/*", (c) => c.json({ error: "not_found" }, 404));
oauthRoutes.all("/oauth/*", (c, next) =>
  c.req.method === "GET" && c.req.path === "/oauth/authorize"
    ? next()
    : c.json({ error: "not_found" }, 404),
);
