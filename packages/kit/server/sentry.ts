import * as Sentry from "@sentry/bun";

import { redactApiKeysInPath } from "./api/v1/request-logger";

const dsn = process.env.SENTRY_DSN;

function scrubSpanData(data: Record<string, unknown> | undefined): void {
  if (!data) return;
  for (const name of Object.keys(data)) {
    const normalized = name.toLowerCase();
    if (
      ["url.query", "http.query", "http.request.query"].includes(normalized) ||
      normalized === "url.fragment" ||
      normalized.startsWith("url.path.parameter.") ||
      /(?:^|[._-])(authorization|cookie|set-cookie|proxy-authorization|x-api-key|body)(?:$|[._-])/iu.test(
        normalized,
      )
    ) {
      delete data[name];
      continue;
    }
    if (
      typeof data[name] === "string" &&
      ["url", "url.full", "url.path", "http.url", "http.target"].includes(
        normalized,
      )
    ) {
      data[name] = redactApiKeysInPath(data[name].split("?")[0]);
    }
  }
}

/**
 * App-facing routes carry the project key in the URL path and account reads
 * carry `userId` in the query, so nothing URL-shaped may leave for Sentry
 * unscrubbed. Exported for tests.
 */
export function scrubSentryEvent<
  T extends {
    request?: {
      url?: string;
      query_string?: unknown;
      data?: unknown;
      cookies?: unknown;
      headers?: Record<string, unknown>;
    };
    transaction?: string;
    contexts?: { trace?: { data?: Record<string, unknown> } };
    spans?: Array<{
      data?: Record<string, unknown>;
      description?: string;
    }>;
  },
>(event: T): T {
  if (event.request?.url) {
    event.request.url = redactApiKeysInPath(event.request.url.split("?")[0]);
  }
  if (event.request && "query_string" in event.request) {
    delete event.request.query_string;
  }
  if (event.request && "data" in event.request) {
    delete event.request.data;
  }
  if (event.request && "cookies" in event.request) {
    delete event.request.cookies;
  }
  if (event.request?.headers) {
    for (const name of Object.keys(event.request.headers)) {
      if (
        [
          "authorization",
          "cookie",
          "set-cookie",
          "proxy-authorization",
          "x-api-key",
        ].includes(name.toLowerCase())
      ) {
        delete event.request.headers[name];
      }
    }
  }
  if (event.transaction) {
    event.transaction = redactApiKeysInPath(event.transaction);
  }
  scrubSpanData(event.contexts?.trace?.data);
  for (const span of event.spans ?? []) {
    scrubSpanData(span.data);
    if (span.description) {
      span.description = redactApiKeysInPath(span.description.split("?")[0]);
    }
  }
  return event;
}
const sendDefaultPii = process.env.SENTRY_SEND_DEFAULT_PII === "true";
const enableLogs = process.env.SENTRY_ENABLE_LOGS !== "false";

// Sentry accepts tracesSampleRate in [0, 1]. A misconfigured env var
// (e.g. `-1` or `5`) would otherwise surface as silent Sentry warnings
// and unpredictable sampling — clamp + fall back to the default.
//
// Default lowered from 0.10 → 0.05: the verify endpoint can do tens of
// thousands of requests/day, and ERROR events are already sent at
// sampleRate=1.0 by default (independent of tracesSampleRate), so this
// only affects success-path traces. Errors + their breadcrumb context
// still arrive unsampled. Override via `SENTRY_TRACES_SAMPLE_RATE` env
// if you need richer tracing (e.g. during an incident).
const DEFAULT_TRACES_SAMPLE_RATE = 0.05;
const parsedSampleRate = Number(
  process.env.SENTRY_TRACES_SAMPLE_RATE ?? DEFAULT_TRACES_SAMPLE_RATE,
);
const tracesSampleRate =
  Number.isFinite(parsedSampleRate) &&
  parsedSampleRate >= 0 &&
  parsedSampleRate <= 1
    ? parsedSampleRate
    : DEFAULT_TRACES_SAMPLE_RATE;

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii,
    tracesSampleRate,
    enableLogs,
    // Fly.io's health checker hits `/health` every few seconds. Those
    // transactions carry no signal but dominate the trace budget. Drop
    // them at the SDK level so they never count against quota.
    ignoreTransactions: ["GET /health", "HEAD /health", /^GET \/health(\?|$)/],
    beforeSend: (event) => scrubSentryEvent(event),
    beforeSendTransaction: (event) => scrubSentryEvent(event),
  });
}
