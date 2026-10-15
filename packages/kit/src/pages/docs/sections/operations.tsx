import { PURCHASE_ISSUE_CAUSES } from "@/lib/purchaseIssues";
import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";

export default function OperationsPage() {
  return (
    <DocsPage
      slug="operations"
      title="Operations"
      description="Fair use, capacity, rate limits, purchase issues, store re-sync, the operator API, correlation IDs, /health, structured logs, and graceful shutdown."
    >
      <h2 className="mt-8 text-2xl font-semibold">Rate limits</h2>
      <p>
        Publishable-key routes are protected by bounded, in-memory token
        buckets. Defaults are <strong>600 burst / 10 req/sec</strong> per API
        key, <strong>600 burst / 5 req/sec</strong> per source IP, and{" "}
        <strong>5,000 burst / 100 req/sec</strong> for the whole process.
        Self-hosted deployments can tune the <code>RATE_LIMIT_*</code>{" "}
        environment variables.
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

      <h2 className="mt-10 text-2xl font-semibold">
        Concurrent verification capacity
      </h2>
      <p>
        Arrival rate and work already in progress are different limits. A slow
        Apple, Google, Amazon, Meta, or Convex response can make accepted
        verifications overlap, so each API key may occupy at most{" "}
        <strong>8</strong> verification handlers, each trusted source IP at most{" "}
        <strong>16</strong>, and each process at most <strong>32</strong> by
        default. The key and source shares make simple credential rotation
        insufficient to monopolize the process from one network source. Excess
        work is not queued in memory; it returns <code>503 SERVICE_BUSY</code>{" "}
        with <code>Retry-After</code>, <code>X-Concurrency-Limit</code>,{" "}
        <code>X-Concurrency-Remaining</code>, and{" "}
        <code>X-Concurrency-Scope</code>. Capacity-rejected attempts never reach
        an upstream verification store and do not consume the per-payload replay
        budget, so repeated backoff retries remain <code>SERVICE_BUSY</code>{" "}
        instead of turning into <code>DUPLICATE_PAYLOAD</code>.
      </p>
      <p>
        Self-hosters can tune <code>VERIFY_MAX_IN_FLIGHT</code>,{" "}
        <code>VERIFY_MAX_IN_FLIGHT_PER_KEY</code>, and{" "}
        <code>VERIFY_MAX_IN_FLIGHT_PER_IP</code>. Fly Proxy also uses request
        concurrency limits for the whole HTTP service (80 soft, 120 hard per
        machine) so static, read, and verification traffic cannot create an
        unbounded number of requests inside one 512 MB machine.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">
        Hosted fair use and high-volume apps
      </h2>
      <p>
        Hosted IAPKit is open-source infrastructure shared by the OpenIAP
        community. It is free without a request billing meter, best-effort, and
        protected by fair-use safeguards; it is not unlimited capacity and does
        not include dedicated resources or an SLA.
      </p>
      <Callout kind="warning" title="Plan from requests and peaks, not DAU">
        <p>
          One million users making one request per day average about 11.6
          requests per second, already above the hosted default per-key steady
          rate before launch-time or notification-driven peaks. Cache stable
          data, coalesce refreshes, verify only after purchase or restore, and
          honor the <code>Retry-After</code> header on <code>429</code> and{" "}
          <code>503</code> with jittered backoff.
        </p>
      </Callout>
      <p>
        If your organization expects sustained high volume or a meaningful share
        of hosted capacity, contact{" "}
        <a className="text-primary underline" href="mailto:hyo@hyo.dev">
          hyo@hyo.dev
        </a>{" "}
        before launch. If an app&apos;s load strains the shared servers, it may
        be removed from the shared pool. To keep using the hosted service at
        that volume, sponsorship may be required through{" "}
        <a
          className="text-primary underline"
          href="https://github.com/sponsors/hyodotdev"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub Sponsors
        </a>{" "}
        or{" "}
        <a
          className="text-primary underline"
          href="https://opencollective.com/openiap"
          target="_blank"
          rel="noopener noreferrer"
        >
          OpenCollective
        </a>
        ; otherwise, self-host the MIT-licensed server, which also gives
        predictable scaling. Sponsorship does not reserve capacity or create an
        SLA.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Correlation IDs</h2>
      <p>
        Verify and bind-user responses carry an <code>X-Correlation-Id</code>{" "}
        header — a UUIDv4 IAPKit generates for the request. The same id appears
        in the verify log line, on the purchase row the request wrote, and on
        any purchase issue it recorded, so support can pivot from a customer
        report straight to the exact entry. A request rejected before it is
        handled — a missing or malformed Authorization header, or a bind-user
        rate limit — carries none.
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
        <code>GET /health</code> returns public service, API contract version,
        deployment revision, environment, and a response timestamp without
        hitting Convex or any external store. Point Fly.io readiness / liveness
        probes at it; point your own uptime monitors at it too. The response
        uses <code>Cache-Control: no-store</code> and remains intentionally
        cheap so probe load doesn't inflate database or trace quota.
      </p>
      <CodeBlock language="json">
        {`{
  "ok": true,
  "status": "healthy",
  "service": "iapkit",
  "apiVersion": "v1",
  "revision": "a1b2c3d4e5f6",
  "environment": "production",
  "timestamp": "2026-07-30T12:34:56.000Z"
}`}
      </CodeBlock>
      <p>
        <code>apiVersion</code> identifies the public HTTP contract rather than
        private workspace package metadata. Hosted IAPKit is a revisioned
        service, not an installable semantic-versioned package. Production
        deploys expose the first 12 characters of their public Git revision;
        local builds return <code>null</code> when no valid revision is
        injected. No machine identifier, credential, or private environment
        value is exposed.
      </p>

      <h2 id="purchase-issues" className="mt-10 text-2xl font-semibold">
        Purchase issues
      </h2>
      <p>
        IAPKit records why a verification failed or returned a pending,
        unrecognized, or mismatched purchase, and why a secret-key bind-user
        call found another owner or the link limit. Find them under Purchases →
        Purchase issues, on a user&apos;s timeline, through the API, or through
        MCP. Any organization member can read them.
      </p>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          A repeat of the same failure raises its <code>count</code> and{" "}
          <code>lastSeenAt</code> instead of adding a row. Causes about the
          project rather than one purchase, such as credentials, rate limits,
          and outages, share one row per store and cause, rewritten at most once
          a minute, so their <code>count</code> is a lower bound.
        </li>
        <li>
          A row holds a <code>fingerprint</code> of the purchase evidence, keyed
          with a per-project secret so short identifiers cannot be guessed back,
          never the token, JWS, or receipt. The purchase detail page shows the
          same value. Its <code>correlationId</code> is the latest failing
          request&apos;s <code>X-Correlation-Id</code>.
        </li>
        <li>
          <code>productId</code> is store-verified;{" "}
          <code>claimedProductId</code> is what the app asserted and is not
          verified.
        </li>
        <li>
          Rows are kept for 30 days, up to 1,024 per project; the least recently
          seen go first.
        </li>
      </ul>
      <div className="my-4 overflow-x-auto rounded-lg border border-border">
        <table className="min-w-[42rem] w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">cause</th>
              <th className="px-3 py-2 text-left font-medium">Meaning</th>
              <th className="px-3 py-2 text-left font-medium">Next step</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Object.entries(PURCHASE_ISSUE_CAUSES).map(
              ([cause, { meaning, nextStep }]) => (
                <tr key={cause}>
                  <td className="px-3 py-2 font-mono text-xs">{cause}</td>
                  <td className="px-3 py-2">{meaning}</td>
                  <td className="px-3 py-2">{nextStep}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <h2 id="store-resync" className="mt-10 text-2xl font-semibold">
        Re-sync from store
      </h2>
      <p>
        Owners and admins can re-read one Apple or Google purchase or
        subscription from the store, from its detail page, the Subscriptions
        tab, the API, or MCP. Use it when a store notification never arrived.
      </p>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          Apple reads the App Store Server API subscription status or
          transaction; Google reads the Play Developer API. Each re-sync draws
          one token from the project&apos;s entitlement recheck bucket, though
          it may make several store calls.
        </li>
        <li>
          The purchase row is saved through the verification path. A changed
          subscription is recorded as a <code>StoreResync</code> inbound
          notification and applied in one transaction.
        </li>
        <li>
          A re-sync sees current state, not the events in between, so it emits{" "}
          <code>entitlement.granted</code> or <code>entitlement.revoked</code>{" "}
          only when access flips. It never invents a lifecycle event.
        </li>
        <li>
          Repeating it is a no-op until the store changes. It never binds,
          unbinds, or moves a purchase or subscription owner. A store
          notification signed after the read still applies; one signed before it
          still emits its lifecycle event but keeps the re-synced state.
        </li>
        <li>
          Amazon is rechecked automatically through RVS; Horizon has no
          lifecycle API.
        </li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">Operator API</h2>
      <p>
        These routes take a secret admin key in{" "}
        <code>Authorization: Bearer</code>; publishable keys get{" "}
        <code>403 INSUFFICIENT_SCOPE</code>. Lists return{" "}
        <code>{"{ …, hasMore, nextCursor }"}</code> pages of up to 100 rows. The
        same operations are MCP tools.
      </p>
      <CodeBlock language="text">{`GET  /v1/webhooks/deliveries?status=&eventType=&destinationId=&eventId=&limit=&cursor=
POST /v1/webhooks/deliveries/{deliveryId}/resend      → 202
GET  /v1/webhooks/notifications?limit=&cursor=
GET  /v1/purchase/issues?cause=&store=&productId=&appUserId=&from=&to=&limit=&cursor=
POST /v1/subscriptions/resync  {"purchaseId"} or {"subscriptionId"}
GET  /v1/subscriptions/timeline?userId=`}</CodeBlock>
      <p>
        Purchase issues come most recently seen first. <code>from</code> and{" "}
        <code>to</code> are epoch milliseconds that bound{" "}
        <code>lastSeenAt</code>; <code>productId</code> matches the verified or
        the claimed product.
      </p>
      <p>
        The timeline returns one app user&apos;s purchases, subscriptions,
        commerce events, and purchase issues, newest first, capped at 50 of each
        kind. It carries no receipt evidence, purchase token, or request IP.
      </p>

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
        Calls to Apple's App Store Server API, Google Play's Android Publisher
        API, Amazon RVS, and the Meta Graph API are wrapped in an
        exponential-backoff retry (max 3 attempts, base 200 ms, cap 2 s,
        jittered to 50–100% of the capped delay) that fires on HTTP 5xx and Node
        network errors (<code>ECONNRESET</code>, <code>ETIMEDOUT</code>,{" "}
        <code>EAI_AGAIN</code>, …). 4xx responses — including 404 and 410, which
        are deterministic — are <strong>not</strong> retried.
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
        <li>
          <code>clientPayload.body</code> ≤ 16 KiB measured as UTF-8 bytes,
          drafts included
        </li>
        <li>client payload publish or rollback note ≤ 500 chars</li>
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
          <code>expectedProductId</code> ≤ 256 chars (optional Apple / Google /
          Amazon verify match guard)
        </li>
      </ul>
      <p>
        Oversized fields return <code>400 INVALID_INPUT</code>; oversized
        request bodies return <code>413 PAYLOAD_TOO_LARGE</code>. Invalid inputs
        stop before upstream store calls or Convex mutations.
      </p>
      <p>
        The general 64 KB product-management limit applies to the entire HTTP
        request, including JSON field names and every supplied value. Client
        payload writes use a bounded 128 KiB envelope so a fully JSON-escaped
        body can still reach its separate 16 KiB decoded UTF-8 limit.
      </p>
    </DocsPage>
  );
}
