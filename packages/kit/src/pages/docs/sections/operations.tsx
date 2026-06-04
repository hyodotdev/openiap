import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";

export default function OperationsPage() {
  return (
    <DocsPage
      slug="operations"
      title="Operations"
      description="Rate limits, correlation IDs, /health, structured logs, graceful shutdown."
    >
      <h2 className="mt-8 text-2xl font-semibold">Rate limits</h2>
      <p>
        <code>/v1/purchase/verify</code> is protected by an in-memory
        token-bucket keyed on a SHA-256 hash of the API key. Defaults:
        <strong> 600-request burst, 10 req/sec steady state</strong> —
        equivalently 600 req/min sustained. Self-hosted deployments can tune via{" "}
        <code>RATE_LIMIT_CAPACITY</code> and{" "}
        <code>RATE_LIMIT_REFILL_PER_SEC</code>.
      </p>
      <p>
        When the bucket empties, IAPKit returns <code>429 RATE_LIMITED</code>{" "}
        with a <code>Retry-After</code> header (seconds). The verify endpoint
        also has a per-(API key, payload) replay guard; it returns{" "}
        <code>429 DUPLICATE_PAYLOAD</code> when the same receipt is retried too
        aggressively, or <code>429 REPEATED_FAILURE</code> during the short
        cooldown after the upstream store rejects that exact payload.
      </p>
      <p>
        Authenticated responses after the auth layer — successful responses,
        validation errors, and 429s — carry <code>X-RateLimit-Limit</code> and{" "}
        <code>X-RateLimit-Remaining</code> so your client can back off before
        getting 429'd. 401 / 403 auth failures return before those headers are
        attached.
      </p>

      <Callout kind="tip" title="The bucket store is bounded too">
        <p>
          The bucket Map itself is capped at 10,000 entries (LRU eviction) so a
          caller churning random API keys can't push the Fly machine into an
          OOM. Tune with <code>RATE_LIMIT_MAX_STORE</code>.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Correlation IDs</h2>
      <p>
        Every verify response after the auth-header shape check carries an{" "}
        <code>X-Correlation-Id</code> header — a UUIDv4 IAPKit generates at the
        logger middleware level. The same id appears in the structured log line
        for that request, so support can pivot from a customer report straight
        to the exact log entry. Missing or malformed Authorization headers
        return before the logger runs.
      </p>
      <CodeBlock title="Sample response headers" language="http">
        {`HTTP/1.1 200 OK
Content-Type: application/json
X-Correlation-Id: 6ebb9c9e-2e6e-4f9a-9bf2-4a6a9d5f9d20
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 599`}
      </CodeBlock>

      <h2 className="mt-10 text-2xl font-semibold">Structured logs</h2>
      <p>
        Each verify request that reaches the logger emits one JSON line to
        stdout:
      </p>
      <CodeBlock title="stdout log line" language="json">
        {`{
  "level": "info",
  "kind": "verify_request",
  "corrId": "6ebb9c9e-2e6e-4f9a-9bf2-4a6a9d5f9d20",
  "method": "POST",
  "path": "/v1/purchase/verify",
  "statusCode": 200,
  "durationMs": 187,
  "apiKeyHash": "c3d1f4a2b1e27f0a",
  "store": "google",
  "isValid": true,
  "state": "ENTITLED"
}`}
      </CodeBlock>
      <p>
        The API key is never logged in plaintext — only its 16-hex SHA-256
        prefix (the same value the rate limiter uses as its bucket key). The
        prefix is enough to correlate calls to the same key without creating an
        exfiltration path if the log aggregator leaks.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">/health endpoint</h2>
      <p>
        <code>GET /health</code> returns <code>{`{ "ok": true }`}</code> without
        hitting Convex or any external store. Point Fly.io readiness / liveness
        probes at it; point your own uptime monitors at it too. It's
        intentionally cheap so probe load doesn't inflate trace quota.
      </p>
      <CodeBlock language="bash">
        {`curl -sS https://kit.openiap.dev/health
# → {"ok":true}`}
      </CodeBlock>

      <h2 className="mt-10 text-2xl font-semibold">Graceful shutdown</h2>
      <p>
        The server installs <code>SIGTERM</code> and <code>SIGINT</code>{" "}
        handlers that call <code>Bun.serve().stop()</code> and drain in-flight{" "}
        <code>/v1/*</code> and <code>/api/v1/*</code> requests before the
        process exits. Fly.io sends <code>SIGTERM</code> before stopping a
        machine, so rolling deploys don't cut off requests mid-verify.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Outbound retries</h2>
      <p>
        Calls to Google Play's Android Publisher API and Meta Graph API are
        wrapped in an exponential-backoff retry (max 3 attempts, base 200 ms,
        cap 2 s, full jitter) that fires on HTTP 5xx and Node network errors (
        <code>ECONNRESET</code>, <code>ETIMEDOUT</code>, <code>EAI_AGAIN</code>,
        …). 4xx responses — including 404 and 410, which are deterministic — are{" "}
        <strong>not</strong> retried.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Sentry</h2>
      <p>
        Both the Bun server (<code>@sentry/bun</code>) and the React SPA (
        <code>@sentry/react</code>) report to separate Sentry projects. Default{" "}
        <code>tracesSampleRate</code> is 0.05; errors are sampled at 1.0 (Sentry
        default). <code>/health</code> transactions are dropped via{" "}
        <code>ignoreTransactions</code> so Fly probes don't dominate the trace
        budget.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Input size limits</h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>receipt verification body ≤ 32 KB before JSON parsing</li>
        <li>product management body ≤ 64 KB before JSON parsing</li>
        <li>subscription user-binding body ≤ 32 KB before JSON parsing</li>
        <li>webhook push body ≤ 256 KB before JSON parsing</li>
        <li>
          <code>jws</code> ≤ 16 KB (Apple)
        </li>
        <li>
          <code>purchaseToken</code> ≤ 2 KB for Google tokens, or ≤ 16 KB when
          an Apple JWS is passed to subscription binding
        </li>
        <li>
          <code>userId</code> ≤ 256 chars (Horizon)
        </li>
        <li>
          <code>sku</code> ≤ 256 chars (Horizon)
        </li>
        <li>
          <code>productId</code> ≤ 256 chars (catalog / subscriptions)
        </li>
        <li>
          <code>expectedProductId</code> ≤ 256 chars (optional Apple / Google
          verify match guard)
        </li>
      </ul>
      <p>
        Oversized fields return <code>400 INVALID_INPUT</code>; oversized
        request bodies return <code>413 PAYLOAD_TOO_LARGE</code>. Invalid inputs
        stop before upstream store calls or Convex mutations.
      </p>
    </DocsPage>
  );
}
