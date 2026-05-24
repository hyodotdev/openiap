import { createMiddleware } from "hono/factory";
import * as crypto from "node:crypto";

import { hashApiKey } from "./rate-limit";

// Structured per-request log for the verify endpoints. Emits a single
// JSON line to stdout so Fly.io's log shipper and any downstream
// aggregator (Sentry, Loki, BetterStack…) can parse without regex. We
// never log the plaintext API key — only the SHA-256 prefix the rate
// limiter already uses — so log leaks don't become credential leaks.

export type VerifyStore = "apple" | "google" | "horizon" | "amazon";

export interface VerifyOutcome {
  isValid: boolean;
  state?: string;
}

export interface VerifyLogLine {
  kind: "verify_request";
  corrId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  apiKeyHash?: string;
  store?: VerifyStore;
  isValid?: boolean;
  state?: string;
}

export type VerifyLogger = (line: VerifyLogLine) => void;

export const defaultVerifyLogger: VerifyLogger = (line) => {
  // One JSON line, `kind` up front so log queries can filter cheaply.
  // Level kept as a top-level string for sinks that key on it.
  console.log(JSON.stringify({ level: "info", ...line }));
};

function describeErrorForLog(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

export interface RequestLoggerConfig {
  logger?: VerifyLogger;
  now?: () => number;
  newCorrId?: () => string;
}

type LoggerVars = {
  apiKey?: string;
  // Pre-hashed key produced by rateLimitMiddleware; if present we
  // reuse it so the hot path of every verify doesn't pay for a
  // redundant SHA-256 pass. See server/api/v1/rate-limit.ts.
  apiKeyHash?: string;
  corrId: string;
  verifyOutcome?: VerifyOutcome;
};

export function requestLoggerMiddleware(
  config: RequestLoggerConfig = {},
): ReturnType<typeof createMiddleware<{ Variables: LoggerVars }>> {
  const log = config.logger ?? defaultVerifyLogger;
  const clock = config.now ?? (() => Date.now());
  const newCorrId = config.newCorrId ?? (() => crypto.randomUUID());

  return createMiddleware<{ Variables: LoggerVars }>(async (c, next) => {
    const corrId = newCorrId();
    c.set("corrId", corrId);
    c.header("X-Correlation-Id", corrId);

    const start = clock();
    // try/finally so a thrown handler or downstream middleware doesn't
    // swallow the log line — the 5xx paths are exactly when we most
    // want structured context, and the error itself will re-throw after
    // the finally runs.
    let nextError: unknown;
    try {
      await next();
    } catch (error) {
      nextError = error;
      throw error;
    } finally {
      const durationMs = clock() - start;

      let store: VerifyStore | undefined;
      try {
        const body = c.req.valid("json" as never) as
          | { store?: VerifyStore }
          | undefined;
        store = body?.store;
      } catch {
        // Validator rejected or never ran — body may be malformed.
        // That's fine; we still log the request shape we know.
      }

      const apiKey = c.var.apiKey;
      const outcome = c.var.verifyOutcome;
      // Prefer the hash already computed by rateLimitMiddleware; only
      // rehash if this middleware is running standalone (e.g. in unit
      // tests that don't mount the rate limiter).
      const apiKeyHash =
        c.var.apiKeyHash ?? (apiKey ? hashApiKey(apiKey) : undefined);

      // Swallow logger-side throws — a broken sink should never take
      // down a request whose real work already succeeded (or already
      // failed and is mid-throw). Fall back to stderr so the incident
      // is still visible.
      try {
        log({
          kind: "verify_request",
          corrId,
          method: c.req.method,
          path: c.req.path,
          statusCode: nextError && c.res.status < 400 ? 500 : c.res.status,
          durationMs,
          apiKeyHash,
          store,
          isValid: outcome?.isValid,
          state: outcome?.state,
        });
      } catch (loggerError) {
        console.error(
          "request-logger failed:",
          describeErrorForLog(loggerError),
        );
      }
    }
  });
}
