import { Hono } from "hono";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { ConvexError, type Value } from "convex/values";
import { api } from "@/convex";
import operations from "../../../../cli/src/kit/operations.json";
import { resolveServerConvexUrl, handleConvexError } from "../../convex";
import { readJsonBodyWithLimit } from "../v1/request-body";
import { sourceRateLimitMiddleware } from "../v1/rate-limit";
import { getRequestIp } from "../v1/rate-limit";
import { withVerificationSource } from "../../../convex/purchases/verificationSource";
import { APP_ERROR_SCOPE, ErrorCode } from "../../../convex/utils/errors";
import { withCliStartSource } from "../../../convex/cli/source";

export const cliRoutes = new Hono();
cliRoutes.use(
  "*",
  sourceRateLimitMiddleware({
    respond: (c, result) =>
      c.json(
        {
          ok: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Retry later.",
            retryAfterSec: result.retryAfterSec,
          },
        },
        429,
      ),
  }),
);
cliRoutes.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  await next();
});

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failure(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

export function prepareArguments(
  operation: (typeof operations)[number],
  input: Record<string, Value>,
  confirmed: boolean,
): Record<string, Value> {
  const args = { ...input };
  const fields = operation.args.value ?? {};
  if (
    operation.effect.includes("destructive") ||
    operation.effect === "publish"
  ) {
    if (!confirmed)
      failure("CONFIRMATION_REQUIRED", "Pass --yes to apply this command.");
  }
  if (operation.effect === "sync") {
    args.dryRun ??= true;
    if (args.dryRun === false && !confirmed)
      failure(
        "CONFIRMATION_REQUIRED",
        "Pass --apply --yes to change the store.",
      );
  }
  if ("apiKey" in fields) {
    if (typeof args.projectId !== "string")
      failure("INVALID_INPUT", "Select a project with --project.");
    if ("projectId" in fields) delete args.apiKey;
    else {
      args.apiKey = `session-project:${args.projectId}`;
      delete args.projectId;
    }
  }
  if ("now" in fields) args.now = Date.now();
  for (const key of Object.keys(args)) {
    if (
      !(key in fields) ||
      ["sourceAuth", "requestIp", "correlationId"].includes(key)
    ) {
      failure("INVALID_INPUT", `Unknown or reserved argument: ${key}`);
    }
  }
  return args;
}

cliRoutes.get("/schema", (c) => c.json({ ok: true, data: operations }));

cliRoutes.post("/auth/:action", async (c) => {
  try {
    const body: unknown = await readJsonBodyWithLimit(c.req.raw, 8 * 1024);
    if (!object(body)) failure("INVALID_INPUT", "Expected a JSON object.");
    const client = new ConvexHttpClient(resolveServerConvexUrl());
    const action = c.req.param("action");
    if (action === "device") {
      const name = typeof body.name === "string" ? body.name : "OpenIAP CLI";
      const scope = body.scope ?? "admin";
      if (scope !== "read" && scope !== "write" && scope !== "admin")
        failure("INVALID_INPUT", "scope must be read, write or admin.");
      const device = await client.mutation(
        api.cli.mutation.start,
        await withCliStartSource({ name, scope }, getRequestIp(c) ?? "unknown"),
      );
      const origin = new URL(
        process.env.IAPKIT_PUBLIC_BASE_URL ?? process.env.SITE_URL ?? c.req.url,
      ).origin;
      return c.json({
        ok: true,
        data: {
          ...device,
          verificationUrl: `${origin}/cli/authorize?user_code=${device.userCode}`,
        },
      });
    }
    if (action === "token") {
      if (typeof body.deviceCode !== "string" && typeof body.token !== "string")
        failure("INVALID_INPUT", "deviceCode or token is required.");
      const params =
        typeof body.token === "string"
          ? { token: body.token }
          : { deviceCode: String(body.deviceCode) };
      const result = await client.action(api.auth.signIn, {
        provider: "cli",
        params,
      });
      if (!result.tokens) {
        if (typeof body.token === "string")
          failure(
            "UNAUTHENTICATED",
            "The automation token is invalid, expired, or revoked.",
          );
        return c.json(
          {
            ok: false,
            error: {
              code: "AUTHORIZATION_PENDING",
              message: "Approve the login in your browser.",
            },
          },
          428,
        );
      }
      return c.json({ ok: true, data: result.tokens });
    }
    if (action === "refresh") {
      if (typeof body.refreshToken !== "string")
        failure("INVALID_INPUT", "refreshToken is required.");
      const result = await client.action(api.auth.signIn, {
        refreshToken: body.refreshToken,
      });
      if (!result.tokens) failure("UNAUTHENTICATED", "Run openiap kit login.");
      return c.json({ ok: true, data: result.tokens });
    }
    failure("NOT_FOUND", "Unknown authentication operation.");
  } catch (error) {
    return errorResponse(c, error);
  }
});

cliRoutes.post("/run", async (c) => {
  try {
    const token = c.req.header("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) failure("UNAUTHENTICATED", "Run openiap kit login.");
    const body: unknown = await readJsonBodyWithLimit(c.req.raw, 512 * 1024);
    if (!object(body) || typeof body.command !== "string" || !object(body.args))
      failure("INVALID_INPUT", "command and args are required.");
    const operation = operations.find(
      (entry) => entry.command === body.command,
    );
    if (!operation)
      failure("UNKNOWN_COMMAND", "Use openiap kit --help to find a command.");
    const args = prepareArguments(
      operation,
      body.args as Record<string, Value>,
      body.confirmed === true,
    );
    if (operation.command.startsWith("purchases verify ")) {
      const store = operation.command.split(" ").at(-1);
      if (
        store === "apple" ||
        store === "google" ||
        store === "amazon" ||
        store === "horizon"
      ) {
        const requestIp = getRequestIp(c);
        if (requestIp) args.requestIp = requestIp;
        const signed = withVerificationSource(store, args);
        args.sourceAuth = {
          issuedAt: signed.sourceAuth.issuedAt,
          mac: signed.sourceAuth.mac,
        };
      }
    }
    // A request owns its authenticated client; the shared SDK client remains anonymous.
    const client = new ConvexHttpClient(resolveServerConvexUrl());
    client.setAuth(token);
    const session = await client.query(api.cli.query.session, {});
    if (
      !session.user ||
      (session.expiresAt !== undefined && session.expiresAt <= Date.now())
    )
      failure("SESSION_EXPIRED", "Run openiap kit login.");
    let data: unknown;
    if (operation.kind === "query")
      data = await client.query(
        makeFunctionReference<"query">(operation.target),
        args,
      );
    else if (operation.kind === "mutation")
      data = await client.mutation(
        makeFunctionReference<"mutation">(operation.target),
        args,
      );
    else
      data = await client.action(
        makeFunctionReference<"action">(operation.target),
        args,
      );
    return c.json({ ok: true, data });
  } catch (error) {
    return errorResponse(c, error);
  }
});

import type { Context } from "hono";
function errorResponse(c: Context, error: unknown): Response {
  if (
    error instanceof ConvexError &&
    object(error.data) &&
    error.data.kind === "RateLimited"
  ) {
    const retryAfterSec =
      typeof error.data.retryAfter === "number"
        ? Math.ceil(error.data.retryAfter / 1000)
        : 5;
    return c.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many login attempts. Retry later.",
          retryAfterSec,
        },
      },
      429,
    );
  }
  let structured = handleConvexError(error);
  if (
    !structured &&
    error instanceof ConvexError &&
    typeof error.data === "string"
  ) {
    if (["Not authenticated", "User not authenticated"].includes(error.data))
      structured = {
        code: "UNAUTHENTICATED",
        message: "Run openiap kit login.",
      };
    else if (error.data.startsWith("Insufficient permissions"))
      structured = {
        code: "INSUFFICIENT_PERMISSIONS",
        message: "Your organization role cannot perform this command.",
      };
    else if (error.data === "Not a member of this organization")
      structured = {
        code: "NOT_ORGANIZATION_MEMBER",
        message: "Your account does not have access to this organization.",
      };
  }
  if (
    error instanceof ConvexError &&
    object(error.data) &&
    error.data.scope === APP_ERROR_SCOPE &&
    typeof error.data.code === "string" &&
    Object.values<string>(ErrorCode).includes(error.data.code) &&
    typeof error.data.message === "string"
  ) {
    structured = { code: error.data.code, message: error.data.message };
  }
  const originalCode =
    structured?.code ??
    (object(error) && typeof error.code === "string"
      ? error.code
      : "REQUEST_FAILED");
  const code =
    originalCode === "NOT_AUTHENTICATED"
      ? "UNAUTHENTICATED"
      : originalCode === "RATE_LIMIT_EXCEEDED"
        ? "RATE_LIMITED"
        : originalCode;
  const message =
    structured?.message ??
    (code === "REQUEST_FAILED"
      ? "The request failed. Check your session and command arguments."
      : error instanceof Error
        ? error.message
        : "Request failed.");
  const status =
    code === "UNAUTHENTICATED" || code === "SESSION_EXPIRED"
      ? 401
      : [
            "INSUFFICIENT_SCOPE",
            "INSUFFICIENT_PERMISSIONS",
            "NOT_ORGANIZATION_MEMBER",
            "NOT_AUTHORIZED",
          ].includes(code)
        ? 403
        : code === "NOT_FOUND" || code.endsWith("_NOT_FOUND")
          ? 404
          : code === "RATE_LIMITED"
            ? 429
            : code === "REQUEST_FAILED"
              ? 500
              : 400;
  return c.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(structured?.retryAfterSec !== undefined
          ? { retryAfterSec: structured.retryAfterSec }
          : {}),
      },
    },
    status,
  );
}
