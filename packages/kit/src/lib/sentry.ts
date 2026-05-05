import * as Sentry from "@sentry/react";

// Client-side Sentry init for the SPA. Kept separate from the server
// init at `server/sentry.ts` — both point at distinct Sentry projects
// (openiap-kit-node vs openiap-kit-react) so server bugs and UI bugs
// don't cross-contaminate issue triage.
//
// Vite exposes env vars prefixed with `VITE_` to the client at build
// time. If `VITE_KIT_SENTRY_DSN` is unset (local dev without a DSN, or
// a self-hoster who hasn't provisioned Sentry), we skip init entirely
// rather than calling it with an empty DSN — Sentry would otherwise
// log a noisy warning and silently discard events.

const dsn = import.meta.env.VITE_KIT_SENTRY_DSN;
const mode = import.meta.env.MODE;

const parsedSampleRate = Number(
  import.meta.env.VITE_KIT_SENTRY_TRACES_SAMPLE_RATE,
);
const tracesSampleRate =
  Number.isFinite(parsedSampleRate) &&
  parsedSampleRate >= 0 &&
  parsedSampleRate <= 1
    ? parsedSampleRate
    : // Mirror the server default: errors are sampled at 1.0 by Sentry
      // regardless, this only affects success-path traces.
      0.05;

// Origin guard — forks self-hosting IAPKit must not ship their users'
// errors into the OpenIAP-managed Sentry project. A fork that wants
// its own error reporting should swap in its own VITE_KIT_SENTRY_DSN
// AND extend this list.
const ALLOWED_HOSTS = new Set(["kit.openiap.dev", "localhost", "127.0.0.1"]);
const onAllowedHost =
  typeof window !== "undefined" && ALLOWED_HOSTS.has(window.location.hostname);

if (typeof dsn === "string" && dsn.length > 0 && onAllowedHost) {
  Sentry.init({
    dsn,
    sendDefaultPii: true,
    environment: mode,
    tracesSampleRate,
    // The Convex client emits its own promise rejection when the
    // websocket / fetch backing a query/action layer transiently
    // fails (browser sleep, network change, server redeploy). The
    // user-facing path catches these inline (toast, retry), but the
    // internal rejection still surfaces to `window.onunhandledrejection`
    // and floods Sentry as `TypeError: Load failed` noise that drowns
    // out real bugs. Tag those events so triage can filter them out
    // (or downsample) instead of treating each as a fresh signal.
    beforeSend: (event, hint) => {
      const exception = hint?.originalException;
      // Sentry events occasionally arrive with no `originalException`
      // (programmatic captureMessage, late-bound rejections that
      // lost their cause), only an `event.message` /
      // `logentry.message`. Build the classifier input from every
      // available source so reconnect noise gets tagged regardless
      // of where the message lives (CodeRabbit review on PR #127).
      const message = [
        exception instanceof Error
          ? exception.message
          : typeof exception === "string"
            ? exception
            : "",
        event.message ?? "",
        event.logentry?.message ?? "",
      ]
        .filter(Boolean)
        .join(" ");
      const isFetchLoadFailed =
        /Load failed|Failed to fetch|NetworkError/i.test(message);
      const looksConvex = /convex\.cloud|\/api\/(action|query|mutation)/i.test(
        message + " " + (event.request?.url ?? ""),
      );
      if (isFetchLoadFailed && looksConvex) {
        event.tags = { ...(event.tags ?? {}), source: "convex-reconnect" };
        event.fingerprint = ["convex-reconnect-load-failed"];
      }
      return event;
    },
  });
}

export { Sentry };
