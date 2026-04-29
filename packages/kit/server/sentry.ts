import * as Sentry from "@sentry/bun";

const dsn = process.env.SENTRY_DSN;
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
  });
}
