// The portable REST binding plus the GraphQL endpoint, mounted under
// /commerce/v1. Routes are registered from the generated HTTP manifest, so a
// route cannot exist that the contract does not declare; every adapter only
// parses transport, builds the auth context, validates against the generated
// schemas, calls the shared handler, and maps the outcome back.

import { Hono, type Context, type Next } from "hono";
import HTTP_BINDING from "openiap-commerce-protocol/generated/bindings/http-binding.json";

import {
  apiKeyValidationError,
  isPublishableApiKey,
  isSecretApiKey,
} from "../v1/middleware";
import {
  getRequestIp,
  multiAxisRateLimitMiddleware,
  sourceRateLimitMiddleware,
} from "../v1/rate-limit";
import {
  JsonBodyTooLargeError,
  readJsonBodyWithLimit,
} from "../v1/request-body";
import { ProtocolOperationError, protocolErrorStatus } from "./errors";
import { executeCommerceGraphql } from "./graphql";
import * as handlers from "./handlers";
import type { ProtocolContext } from "./handlers";
import { validateOperationInput } from "./validation";

const MAX_COMMERCE_BODY_BYTES = 32 * 1024;
const MOUNT_PREFIX = "/commerce/v1";

type CommerceVariables = {
  apiKey?: string;
  apiKeyHash?: string;
  commerceInput?: unknown;
  verifyCapacityRejected?: boolean;
};
type CommerceContext = Context<{ Variables: CommerceVariables }>;

// verifyPurchase's replay/in-flight admission lives in the shared handler
// (verificationAdmission), so both the REST route and the GraphQL resolver run
// through it — see server/api/commerce/handlers.ts.

const operationHandlers: Record<
  string,
  (context: ProtocolContext, input: never) => unknown
> = {
  providerCapabilities: () => handlers.providerCapabilities(),
  subscriptionStatus: (context, input) =>
    handlers.subscriptionStatus(context, input),
  entitlements: (context, input) => handlers.entitlements(context, input),
  verifyPurchase: (context, input) => handlers.verifyPurchase(context, input),
  bindPurchase: (context, input) => handlers.bindPurchase(context, input),
  eraseUser: (context, input) => handlers.eraseUser(context, input),
};

const GRAPHQL_PATH = `${MOUNT_PREFIX}/graphql`;

// The two bindings wrap the same protocol code in different envelopes
// (SPEC.md 8): REST as `{error:{code,message}}`, GraphQL as
// `{errors:[{message,extensions:{code}}]}`. Transport failures — rate limit,
// oversized body, unparseable body — must use the envelope of the binding
// they hit, or a GraphQL client sees a body with neither data nor errors.
function isGraphqlRequest(c: Context): boolean {
  return c.req.path.endsWith(GRAPHQL_PATH) || c.req.path === "/graphql";
}

function protocolError(
  c: Context,
  code: string,
  message: string,
  status = protocolErrorStatus(code),
  retryAfterSec?: number,
): Response {
  // A retry hint reaches REST as the standard Retry-After header and GraphQL
  // as retryAfterSec in the error extensions, so neither binding drops it.
  if (retryAfterSec !== undefined) {
    c.header("Retry-After", String(retryAfterSec));
  }
  if (isGraphqlRequest(c)) {
    // SPEC.md 7: every operation failure on the GraphQL binding is HTTP 200
    // with the code in errors[].extensions.code. This is the single status
    // policy for the binding — the outer rate limiter and the handler
    // admission both surface RATE_LIMITED at 200, never 429, so the endpoint
    // does not split its own contract.
    return c.json(
      {
        errors: [
          {
            message,
            extensions: {
              code,
              ...(retryAfterSec === undefined ? {} : { retryAfterSec }),
            },
          },
        ],
      },
      200,
    );
  }
  return c.json({ error: { code, message } }, status as 400);
}

function bearerApiKey(c: Context): string | null {
  const header = c.req.header("Authorization");
  if (!header) return null;
  const parts = header.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;
  return apiKeyValidationError(parts[1]) ? null : parts[1];
}

const respondRateLimited = (
  c: Context,
  result: { retryAfterSec: number },
): Response =>
  // Passing retryAfterSec sets the Retry-After header on REST and puts
  // retryAfterSec into the GraphQL error extensions — the outer limiter must
  // carry the same machine-readable hint the per-operation admission does.
  protocolError(
    c,
    "RATE_LIMITED",
    `Too many requests. Retry after ${result.retryAfterSec}s.`,
    429,
    result.retryAfterSec,
  );

const app = new Hono<{ Variables: CommerceVariables }>();

// Unauthenticated requests (capabilities, credential-less GraphQL) still ride
// the bounded source-IP and process buckets.
app.use(
  "*",
  sourceRateLimitMiddleware({ respond: respondRateLimited }) as never,
);

const keyedRateLimit = multiAxisRateLimitMiddleware({
  respond: respondRateLimited,
});
const keyedRateLimitIfAuthed = async (c: CommerceContext, next: Next) =>
  c.var.apiKey ? keyedRateLimit(c as never, next) : next();

function commerceAuth(auth: string) {
  return async (c: CommerceContext, next: Next) => {
    const apiKey = bearerApiKey(c);
    if (auth !== "none") {
      // Fail close in the protocol envelope. The prefix check only
      // fast-fails an explicitly publishable key on a server operation;
      // the stored key classification stays authoritative in Convex, where
      // unknown and legacy formats fail closed as publishable.
      if (apiKey === null) {
        return protocolError(c, "UNAUTHORIZED", "A credential is required");
      }
      if (auth === "server" && isPublishableApiKey(apiKey)) {
        return protocolError(
          c,
          "FORBIDDEN",
          "This operation requires the server role",
        );
      }
    }
    if (apiKey !== null) {
      c.set("apiKey", apiKey);
      if (isSecretApiKey(apiKey)) {
        c.header("Cache-Control", "private, no-store");
      }
    }
    await next();
  };
}

// SPEC.md 5: server-role authorization precedes input validation. Runs after
// the rate limiters (an unauthenticated caller must not buy a Convex round
// trip per request unmetered) and before the body is parsed or validated.
const authoritativeServerAuth = async (c: CommerceContext, next: Next) => {
  try {
    await handlers.assertServerCredential({
      apiKey: c.var.apiKey ?? "",
      requestIp: getRequestIp(c),
    });
  } catch (error) {
    if (error instanceof ProtocolOperationError) {
      return protocolError(
        c,
        error.code,
        error.message,
        protocolErrorStatus(error.code),
        error.retryAfterSec,
      );
    }
    return protocolError(c, "INTERNAL_ERROR", "The operation failed");
  }
  await next();
};

for (const operation of HTTP_BINDING.operations) {
  const path = operation.path.slice(MOUNT_PREFIX.length);
  const run = operationHandlers[operation.name];
  if (!run) throw new Error(`No handler for operation ${operation.name}`);

  // Parse, size-cap, and schema-validate the input, then stash it so the
  // verify guards (which run after this) and the handler read one parsed body.
  const parseInput = async (c: CommerceContext, next: Next) => {
    let input: unknown = null;
    if (operation.input && operation.method === "GET") {
      input = Object.fromEntries(
        Object.entries(c.req.query()).filter(([, value]) => value !== ""),
      );
    } else if (operation.input) {
      try {
        input = await readJsonBodyWithLimit(
          c.req.raw,
          MAX_COMMERCE_BODY_BYTES,
          "Request body is too large",
        );
      } catch (error) {
        if (error instanceof JsonBodyTooLargeError) {
          return protocolError(
            c,
            "INVALID_REQUEST",
            "Request body is too large",
          );
        }
        return protocolError(c, "INVALID_REQUEST", "Body is not JSON");
      }
    }
    if (operation.input) {
      const invalid = validateOperationInput(operation.name, input);
      if (invalid) return protocolError(c, "INVALID_REQUEST", invalid);
    }
    c.set("commerceInput", input);
    await next();
  };

  const handler = async (c: CommerceContext) => {
    try {
      const context: ProtocolContext = {
        apiKey: c.var.apiKey ?? "",
        requestIp: getRequestIp(c),
      };
      const result = await run(context, c.get("commerceInput") as never);
      return c.json(result as object, operation.successStatus as 200);
    } catch (error) {
      if (error instanceof ProtocolOperationError) {
        return protocolError(
          c,
          error.code,
          error.message,
          protocolErrorStatus(error.code),
          error.retryAfterSec,
        );
      }
      console.error(
        "[commerce] %s failed errorClass=%s",
        operation.name,
        error instanceof Error ? error.name : typeof error,
      );
      return protocolError(c, "INTERNAL_ERROR", "The operation failed");
    }
  };

  if (operation.auth === "server") {
    app.on(
      operation.method,
      path,
      commerceAuth(operation.auth),
      keyedRateLimitIfAuthed,
      authoritativeServerAuth,
      parseInput,
      handler,
    );
  } else {
    app.on(
      operation.method,
      path,
      commerceAuth(operation.auth),
      keyedRateLimitIfAuthed,
      parseInput,
      handler,
    );
  }
}

// The GraphQL binding shares the same handlers and the same role rules;
// SPEC.md 7 keeps operation failures inside the GraphQL errors array, so the
// only role decision made here is which credential kind was presented.
app.post(
  "/graphql",
  commerceAuth("none"),
  keyedRateLimitIfAuthed,
  async (c) => {
    let payload: unknown;
    try {
      payload = await readJsonBodyWithLimit(
        c.req.raw,
        MAX_COMMERCE_BODY_BYTES,
        "Request body is too large",
      );
    } catch (error) {
      if (error instanceof JsonBodyTooLargeError) {
        return protocolError(c, "INVALID_REQUEST", "Request body is too large");
      }
      return protocolError(c, "INVALID_REQUEST", "Body is not JSON");
    }

    const apiKey = c.var.apiKey;
    const { status, body } = await executeCommerceGraphql(payload, {
      role:
        apiKey === undefined
          ? null
          : isPublishableApiKey(apiKey)
            ? "verification"
            : "server",
      apiKey,
      requestIp: getRequestIp(c),
    });
    return c.json(body as object, status);
  },
);

// Terminal: an unknown /commerce/v1 path is a protocol 404, never an SPA
// fallthrough.
app.all("*", (c) =>
  c.json({ error: { code: "NOT_FOUND", message: "Unknown operation" } }, 404),
);

export { app as commerceRoutes };
