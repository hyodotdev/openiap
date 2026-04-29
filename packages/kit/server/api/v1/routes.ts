import { Hono } from "hono";
import type { Context } from "hono";
import { getConnInfo } from "hono/bun";
import { html } from "hono/html";
import { describeRoute, openAPIRouteHandler, resolver } from "hono-openapi";
import * as crypto from "node:crypto";
import * as util from "node:util";

import { api } from "@/convex";

import { verifyPurchaseInputSchema } from "./route-input-schemas";
import { client, handleConvexError } from "../../convex";
import {
  apiErrorResponseSchema,
  verifyPurchaseSuccessResponseSchema,
} from "./route-response-schemas";
import { apiKeyMiddleware } from "./middleware";
import { rateLimitMiddleware } from "./rate-limit";
import { replayGuardMiddleware } from "./replay-guard";
import { requestLoggerMiddleware } from "./request-logger";
import { validator } from "./validator";

// Variables that the request middleware chain attaches to the Hono
// context. Declaring them here (and passing the generic to `new Hono()`)
// lets handlers access `c.var.apiKey` / `c.set("verifyOutcome", ...)`
// directly with full type safety, instead of the `as unknown` casts
// that earlier flow-control between strongly-typed middleware (each
// declaring its own Variables shape via createMiddleware) and the
// untyped app instance required.
type V1AppVariables = {
  // apiKeyMiddleware
  apiKey: string;
  // rate-limit middleware
  apiKeyHash: string;
  // request-logger middleware
  corrId: string;
  // verify-purchase handler → request-logger
  verifyOutcome: { isValid: boolean; state: string };
};

const app = new Hono<{ Variables: V1AppVariables }>();

const DEV_BASE_URL = "http://localhost:3000";
const PROD_BASE_URL = "https://kit.openiap.dev";

const specUrl =
  process.env.APP_ENV === "development"
    ? `${DEV_BASE_URL}/v1/openapi`
    : `${PROD_BASE_URL}/v1/openapi`;

// These client-IP headers are set by the upstream proxy (Fly.io edge /
// Cloudflare) and would be spoofable if the server were reachable outside the
// proxy. The Fly.io machine only accepts traffic through the Fly edge, so we
// trust these headers here. If the deployment topology changes (e.g. direct
// public ingress without a trusted proxy), these headers MUST NOT be trusted
// and we should fall back to the TCP peer address from `getConnInfo`.
const DIRECT_IP_HEADERS = [
  // `fly-client-ip` is injected by the Fly.io edge proxy and is the
  // most reliable signal on the Fly deployment; check it first.
  "fly-client-ip",
  "cf-connecting-ip",
  "true-client-ip",
  "fastly-client-ip",
  "x-client-ip",
  "x-real-ip",
  "x-cluster-client-ip",
];

function normalizeIp(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const first = value.split(",")[0]?.trim();
  if (!first || first === "unknown") {
    return undefined;
  }

  return first.replace(/^"(.*)"$/, "$1").replace(/^\[(.*)\]$/, "$1");
}

function parseForwardedHeader(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/for=([^;]+)/i);
  if (!match || !match[1]) {
    return undefined;
  }

  return normalizeIp(match[1]);
}

function getRequestIp(c: Context): string | undefined {
  for (const header of DIRECT_IP_HEADERS) {
    const ip = normalizeIp(c.req.header(header));
    if (ip) {
      return ip;
    }
  }

  const forwarded = parseForwardedHeader(c.req.header("forwarded"));
  if (forwarded) {
    return forwarded;
  }

  const xForwardedFor = normalizeIp(c.req.header("x-forwarded-for"));
  if (xForwardedFor) {
    return xForwardedFor;
  }

  return getRemoteAddr(c);
}

function getRemoteAddr(c: Context): string | undefined {
  try {
    return getConnInfo(c).remote?.address;
  } catch {
    return undefined;
  }
}

/**
 * Redoc UI with API documentation.
 */
app.get("", (c) => {
  return c.html(html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>IAPKit</title>
        <style>
          body {
            margin: 0;
            padding: 0;
          }
        </style>
      </head>
      <body>
        <redoc spec-url="${specUrl}"></redoc>
        <script
          type="module"
          src="https://cdn.redoc.ly/redoc/v3.0.0-rc.0/redoc.standalone.js"
        ></script>
      </body>
    </html>
  `);
});

const servers =
  process.env.APP_ENV === "development"
    ? [{ url: `${DEV_BASE_URL}/v1`, description: "Development" }]
    : [{ url: `${PROD_BASE_URL}/v1`, description: "Production" }];

/**
 * Open API specification.
 */
app.get(
  "/openapi",
  openAPIRouteHandler(app, {
    documentation: {
      info: {
        title: "IAPKit",
        version: "1.0.0",
        description: "API for verifying in-app purchases.",
      },
      servers,
      components: {
        securitySchemes: {
          apiKey: {
            description:
              "API key for authentication. Must be provided in the Authorization header in the format 'Bearer api-key'.",
            type: "http",
            scheme: "bearer",
          },
        },
      },
      security: [{ apiKey: [] }],
    },
  }),
);

// Response headers set by every /purchase/verify response. Documented
// here so SDK consumers can see them in the generated OpenAPI spec
// (Redoc at /v1) and wire client-side retry logic without trial and
// error.
const commonResponseHeaders = {
  "X-Correlation-Id": {
    description:
      "Unique identifier for this request. Quote in support tickets so we can locate the matching log line.",
    schema: { type: "string" as const, format: "uuid" },
  },
  "X-RateLimit-Limit": {
    description:
      "Maximum number of requests allowed in the rolling bucket for this API key.",
    schema: { type: "integer" as const },
  },
  "X-RateLimit-Remaining": {
    description:
      "Requests remaining in the current bucket. Reaches 0 just before a 429 is returned.",
    schema: { type: "integer" as const },
  },
};

const verifyPurchaseRouteDescription = describeRoute({
  operationId: "verifyPurchase",
  description:
    "Verify an in-app purchase.\n\n" +
    "Supported request shapes (discriminated on `store`):\n" +
    '  • Apple  — `{ store: "apple",   jws }`\n' +
    '  • Google — `{ store: "google",  purchaseToken }`\n' +
    '  • Horizon — `{ store: "horizon", userId, sku }` (Meta Quest;' +
    " IAPKit holds the App ID + App Secret and composes" +
    " `OC|APP_ID|APP_SECRET` server-side)\n\n" +
    "Rate limit: per API key, 600 req/min sustained with a 600-request " +
    "burst — sized to let legitimate global apps verify at app-launch " +
    "scale without tripping. In addition, per-(API key, payload) " +
    "replay-guard: the same receipt can be submitted at most 30 times " +
    "in a burst and ~1/min sustained — cache the previous result on " +
    "your side. Exceeding either returns HTTP 429 with a `Retry-After` " +
    "header. **Authenticated** responses (2xx, 4xx from validation, " +
    "429) carry `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and " +
    "`X-Correlation-Id`. 401 / 403 responses from the auth layer run " +
    "before the rate-limit middleware and do not include those " +
    "headers.\n\n" +
    "Input size caps: `jws` ≤ 16 KB, `purchaseToken` ≤ 2 KB, " +
    "`userId` ≤ 256 chars, `sku` ≤ 256 chars. Oversized payloads return " +
    "`400 INVALID_INPUT` without hitting the upstream store.",
  security: [{ apiKey: [] }],
  responses: {
    200: {
      description: "Successful verification",
      headers: commonResponseHeaders,
      content: {
        "application/json": {
          schema: resolver(verifyPurchaseSuccessResponseSchema),
        },
      },
    },
    400: {
      description:
        "Verification failed — malformed body, unknown store, or input exceeds size cap (`INVALID_INPUT`).",
      headers: commonResponseHeaders,
      content: {
        "application/json": {
          schema: resolver(apiErrorResponseSchema),
        },
      },
    },
    401: {
      description: "Missing bearer token",
      content: {
        "application/json": {
          schema: resolver(apiErrorResponseSchema),
        },
      },
    },
    403: {
      description: "Invalid bearer token",
      content: {
        "application/json": {
          schema: resolver(apiErrorResponseSchema),
        },
      },
    },
    429: {
      description:
        "Request rejected by a rate limit. Three shapes:\n\n" +
        "  • `RATE_LIMITED` — burst bucket empty (600 req/min sustained " +
        "+ 600 burst per API key). Retry after the seconds in " +
        "`Retry-After`.\n" +
        "  • `DUPLICATE_PAYLOAD` — too many verifications for the exact " +
        "same receipt from this API key (burst 30, sustained ~1/min). " +
        "Cache the previous result on your side or back off per " +
        "`Retry-After`.\n" +
        "  • `REPEATED_FAILURE` — the exact same receipt was just " +
        "rejected as invalid by the upstream store; subsequent " +
        "requests for that payload are short-circuited for a 5-minute " +
        "cooldown. Apple / Google's verdict for a given receipt rarely " +
        "changes within seconds, so the cached negative spares both " +
        "your quota and the upstream API. Retry after `Retry-After`.\n\n" +
        "Response body: `{ errors: [{ code, message, path? }] }`.",
      headers: {
        ...commonResponseHeaders,
        "Retry-After": {
          description:
            "Seconds to wait before retrying. The exact meaning depends on which guard rejected the request: for `RATE_LIMITED` it's when the burst bucket will have a token; for `DUPLICATE_PAYLOAD` it's when the per-(key, payload) bucket refills; for `REPEATED_FAILURE` it's when the 5-minute negative cooldown elapses.",
          schema: { type: "integer" as const, minimum: 1 },
        },
      },
      content: {
        "application/json": {
          schema: resolver(apiErrorResponseSchema),
        },
      },
    },
    500: {
      description: "Unknown error",
      headers: {
        "X-Correlation-Id": commonResponseHeaders["X-Correlation-Id"],
      },
      content: {
        "application/json": {
          schema: resolver(apiErrorResponseSchema),
        },
      },
    },
  },
});

type VerifyPurchaseJson =
  | { store: "apple"; jws: string }
  | { store: "google"; purchaseToken: string }
  | { store: "horizon"; userId: string; sku: string };

// Tell Hono's Context what `c.req.valid("json")` returns for this
// route so we don't need a `"json" as never` cast + `as VerifyPurchaseJson`.
// The `Input` generic on `Context<Env, Path, Input>` is what
// `c.req.valid(target)` narrows against; declaring both `in` and `out`
// keeps middleware composition (validator → handler) type-checked.
type VerifyPurchaseInput = {
  in: { json: VerifyPurchaseJson };
  out: { json: VerifyPurchaseJson };
};

const verifyPurchaseHandler = async (
  c: Context<{ Variables: V1AppVariables }, string, VerifyPurchaseInput>,
) => {
  const json = c.req.valid("json");
  const apiKey = c.var.apiKey;
  const requestIp = getRequestIp(c);

  const setOutcome = (outcome: V1AppVariables["verifyOutcome"]) => {
    c.set("verifyOutcome", outcome);
  };

  try {
    switch (json.store) {
      case "apple": {
        const apple = await client.action(
          api.purchases.ios.verifyAppStoreReceiptInternalV1,
          {
            apiKey,
            jws: json.jws,
            requestIp,
          },
        );

        setOutcome({ isValid: apple.isValid, state: apple.state });
        return c.json({ isValid: apple.isValid, state: apple.state });
      }
      case "google": {
        const google = await client.action(
          api.purchases.android.verifyGooglePlayReceiptInternalV1,
          {
            apiKey,
            purchaseToken: json.purchaseToken,
            requestIp,
          },
        );

        setOutcome({ isValid: google.isValid, state: google.state });
        return c.json({ isValid: google.isValid, state: google.state });
      }
      case "horizon": {
        // Meta Horizon (Quest): the client doesn't hold a
        // server-forgeable receipt, so verification identifies the
        // entitlement by (userId, sku). The Convex action builds an
        // `OC|APP_ID|APP_SECRET` token from the project's stored
        // credentials — the client never sees the secret.
        const horizon = await client.action(
          api.purchases.horizon.verifyMetaHorizonReceiptInternalV1,
          {
            apiKey,
            userId: json.userId,
            sku: json.sku,
            requestIp,
          },
        );

        setOutcome({ isValid: horizon.isValid, state: horizon.state });
        return c.json({ isValid: horizon.isValid, state: horizon.state });
      }
    }
  } catch (error) {
    const convexError = handleConvexError(error);

    if (convexError !== null) {
      return c.json({ errors: [convexError] }, 400);
    }

    const errorId = crypto.randomUUID();
    console.error(
      "Unexpected error (%s) when verifying purchase: %s",
      errorId,
      error,
    );

    return c.json(
      {
        errors: [
          {
            code: "UNKNOWN_ERROR",
            message: util.format("Unknown error: %s", errorId),
          },
        ],
      },
      500,
    );
  }
};

const verifyRateLimit = rateLimitMiddleware();
const verifyRequestLogger = requestLoggerMiddleware();
const verifyReplayGuard = replayGuardMiddleware();

// Middleware order matters:
//   1. apiKeyMiddleware — 401/403 before anything expensive.
//   2. verifyRequestLogger — logs every attempt for audit/debug.
//   3. verifyRateLimit — per-key burst cap; also populates `apiKeyHash`.
//   4. validator — rejects malformed payloads (400) before the guard
//      below hashes the body.
//   5. verifyReplayGuard — per-(key, payload) burst cap + 5-minute
//      negative cooldown after an `isValid: false` from the store.
//   6. verifyPurchaseHandler — the actual Convex call. The verify
//      action increments the per-org monthly counter for telemetry
//      (powers the dashboard usage view + sponsor CTA threshold)
//      but does NOT enforce a monthly cap — abuse is stopped at
//      the edge layers above so legitimate high-volume apps are
//      never blocked by raw success.
//
// Held in a single tuple so `purchase/verify` (canonical) and
// `verify-purchase` (compat alias) can't drift on order or contents
// when guards are added or reshuffled.
const verifyMiddleware = [
  apiKeyMiddleware,
  verifyRequestLogger,
  verifyRateLimit,
  validator(verifyPurchaseInputSchema),
  verifyReplayGuard,
  verifyPurchaseHandler,
] as const;

app.post(
  "/purchase/verify",
  verifyPurchaseRouteDescription,
  ...verifyMiddleware,
);

// Alias kept for compatibility with the path documented in the initial
// PR description / test plan (`POST /v1/verify-purchase`). Not listed
// separately in the OpenAPI output — both paths dispatch to the exact
// same handler with the same middleware stack.
app.post("/verify-purchase", ...verifyMiddleware);

export { app as apiRoutes };
