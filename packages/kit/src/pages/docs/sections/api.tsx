import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";

export default function ApiReferencePage() {
  return (
    <DocsPage
      slug="api"
      title="API reference"
      description="Purchase verification and user-scoped subscription snapshots — requests, responses, errors, headers."
    >
      <p>
        IAPKit exposes one core purchase-verification endpoint for your app:{" "}
        <code> POST /v1/purchase/verify</code>. Webhooks, subscription state,
        and{" "}
        <Link to="/docs/products" className="text-primary underline">
          product-catalog operations
        </Link>{" "}
        live on separate project-scoped surfaces. The full OpenAPI spec is also
        served at{" "}
        <a
          href="/v1"
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          /v1
        </a>{" "}
        (Redoc UI on this deployment) and{" "}
        <a
          href="/v1/openapi"
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          /v1/openapi
        </a>{" "}
        (raw JSON).
      </p>

      <h2 className="mt-8 text-2xl font-semibold">Authentication</h2>
      <p>
        Every purchase-verification request must include a publishable Bearer
        API key:
      </p>
      <CodeBlock title="Authorization header" language="http">
        {`Authorization: Bearer openiap-kit_pk_<your-publishable-key>`}
      </CodeBlock>
      <p>
        Missing header → <code>401 MISSING_API_KEY</code>. Wrong scheme or
        malformed key → <code>403 INVALID_API_KEY</code>.
      </p>
      <p>
        In the default mobile-direct flow, your app sends the restricted
        publishable key to IAPKit as the managed validation service. A secret
        key is unnecessary for verification and must never be embedded in a
        mobile app. If you proxy calls through your own backend, that backend
        can still use a publishable key unless it also performs administrative
        operations.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">
        POST <span className="font-mono">/v1/purchase/verify</span>
      </h2>
      <p>
        The body is a tagged union discriminated on <code>store</code>. IAPKit
        dispatches to the matching verification pipeline based on that tag.
      </p>

      <h3 className="mt-6 text-lg font-semibold">Apple variant</h3>
      {/* These blocks use `language="javascript"` because the // line
          notes (size caps) aren't legal JSON — Prism's JSON lexer
          chokes on them. JavaScript happily parses the same tokens
          and still highlights strings / numbers / keywords. */}
      <CodeBlock language="javascript">
        {`{
  "store": "apple",
  "jws": "eyJhbGciOi...",      // JWS token from StoreKit 2 (≤ 16 KB)
  "expectedProductId": "premium_monthly" // optional match guard
}`}
      </CodeBlock>

      <h3 className="mt-6 text-lg font-semibold">Google variant</h3>
      <CodeBlock language="javascript">
        {`{
  "store": "google",
  "purchaseToken": "ljhjpg...", // Play purchase token (≤ 2 KB)
  "expectedProductId": "premium_monthly" // optional match guard
}`}
      </CodeBlock>

      <h3 className="mt-6 text-lg font-semibold">Meta Horizon variant</h3>
      <CodeBlock language="javascript">
        {`{
  "store": "horizon",
  "userId": "1234567890",       // Oculus user id  (≤ 256 chars)
  "sku": "coin_pack_100"        // add-on SKU      (≤ 256 chars)
}`}
      </CodeBlock>

      <h3 className="mt-6 text-lg font-semibold">Amazon Appstore variant</h3>
      <CodeBlock language="javascript">
        {`{
  "store": "amazon",
  "userId": "amzn1.account.ABC123",        // Amazon user id   (≤ 512 chars)
  "receiptId": "amzn1.receipt.ABC123",     // Amazon receipt id (≤ 4 KB)
  "sandbox": true                          // App Tester / RVS sandbox
}`}
      </CodeBlock>

      <Callout kind="note" title="Malformed inputs stop at the edge">
        <p>
          The JSON body is capped at 32 KB before parsing. Every string field is
          then validated server-side for non-empty + per-field length bounds.
          Oversized fields return <code>400 INVALID_INPUT</code>; oversized
          request bodies return <code>413 PAYLOAD_TOO_LARGE</code>. Neither path
          calls Apple / Google / Horizon / Amazon, so malformed clients don't
          burn your upstream quota.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Success response</h2>
      <CodeBlock title="200 OK" language="json">
        {`{
  "store": "amazon",
  "isValid": true,
  "state": "ENTITLED",
  "productId": "premium_monthly"
}`}
      </CodeBlock>

      <p>
        Grant or fulfill only when <code>isValid === true</code>, the harmonized
        <code>state</code> permits that operation, and the store-verified
        <code>productId</code> is present and matches the product your app
        expected. For Meta Horizon, <code>productId</code> is the SKU IAPKit
        checked.
      </p>
      <p>
        Apple and Google requests that explicitly send{" "}
        <code>includeClientPayload: true</code> may also receive a top-level{" "}
        <code>clientPayload</code>. IAPKit adds it only when the receipt is
        valid, the store returns a verified product ID, and that exact
        platform/product has a payload. Default requests, invalid responses,
        missing payloads, Horizon, and Amazon omit the field.
      </p>
      <CodeBlock title="Optional Apple payload request" language="json">
        {`{
  "store": "apple",
  "jws": "eyJhbGciOi...",
  "includeClientPayload": true
}`}
      </CodeBlock>
      <CodeBlock title="Opt-in enriched response" language="json">
        {`{
  "store": "apple",
  "isValid": true,
  "state": "ENTITLED",
  "productId": "premium_monthly",
  "clientPayload": {
    "format": "toml",
    "body": "[access]\\nmax_items = 10",
    "version": 3,
    "updatedAt": 1784160000000
  }
}`}
      </CodeBlock>
      <Callout kind="warning" title="Payloads are not secrets or entitlements">
        <p>
          Client payloads are public app-readable data. Never place credentials
          or server-only rules in them, and never grant access from payload
          contents alone. Check <code>isValid</code>, the purchase{" "}
          <code>state</code>, and the store-verified <code>productId</code>, and
          require that ID to match the product your app expected.
        </p>
      </Callout>
      <Callout kind="note" title="Purchase rows are verification snapshots">
        <p>
          Calling <code>finishTransaction</code> updates the app and store; it
          does not mutate an earlier IAPKit response. On Android, verify first,
          finish the valid purchase, then verify the token again if the
          Purchases log must reflect <code>ENTITLED</code> instead of{" "}
          <code>PENDING_ACKNOWLEDGMENT</code>. Use subscription status,
          entitlements, and store webhooks for current subscription lifecycle
          state. Periodically reverify purchases when their latest store state
          matters.
        </p>
      </Callout>
      <p>
        If your own backend keeps an entitlement ledger, do not trust a
        client-provided product id. Send <code>expectedProductId</code> with the
        Apple or Google request. IAPKit compares it against the store-verified{" "}
        <code>productId</code> and returns <code>isValid: false</code> with{" "}
        <code>state: "INAUTHENTIC"</code> on mismatch.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">
        Refresh access without SSE
      </h2>
      <p>
        Apple and Google lifecycle webhooks update IAPKit&apos;s canonical
        subscription snapshot. IAPKit does not relay those events, expose a raw
        event feed, or keep a mobile SSE, WebSocket, or long-poll connection
        open. Apps read only their user-scoped snapshot:
      </p>
      <p>
        Webhook event rows are bounded operational history for deduplication and
        retention. Polling reads the canonical snapshot, not an event cursor, so
        pruning old event rows does not erase the user&apos;s latest state and
        apps do not have to consume every event in order.
      </p>
      <ol className="list-decimal space-y-1 pl-6">
        <li>
          For a purchase started in this app session, update the UI from the SDK
          purchase callback and verified result. Bind its stable token to an
          opaque user ID.
        </li>
        <li>Render immediately from the last persisted snapshot.</li>
        <li>
          Refresh on cold start, when the cached value is stale after
          foregrounding, or after an explicit user action. Use one refresh
          coordinator so concurrent screens share the same in-flight request.
          Define a maximum stale age for offline or rate-limited fallback and
          fail closed after that app-specific window.
        </li>
        <li>
          Persist the response body and <code>ETag</code>, then send the tag as{" "}
          <code>If-None-Match</code> on the next request.
        </li>
        <li>
          Reuse the cached body on <code>304</code>, replace it on{" "}
          <code>200</code>, and respect <code>429</code> or{" "}
          <code>503 Retry-After</code>.
        </li>
        <li>
          Key local storage by IAPKit project and opaque user ID, and clear it
          on sign-out. Never render one user&apos;s snapshot for another.
        </li>
      </ol>
      <p>
        This example uses raw HTTP so it can retain response headers. The
        current <code>kitApi.status()</code> and{" "}
        <code>kitApi.entitlements()</code> convenience methods perform
        unconditional reads and return only the decoded body; use raw{" "}
        <code>fetch</code> or an app wrapper for conditional revalidation.
      </p>
      <CodeBlock title="Conditional entitlement refresh" language="typescript">
        {`type CachedEntitlements = {
  cacheScope: string; // App-defined IAPKit project/environment identifier.
  etag: string | null;
  checkedAt: number;
  snapshot: {
    userId: string;
    productIds: string[];
    subscriptions: Array<{
      productId: string;
      state: string;
      expiresAt?: number;
      renewsAt?: number;
      willRenew?: boolean;
    }>;
  };
};

async function refreshEntitlements(
  iapkitCacheScope: string,
  userId: string,
  cached: CachedEntitlements | null,
  maxStaleMs: number,
  iapkitPublishableKey: string,
) {
  const cachedForScope =
    cached?.cacheScope === iapkitCacheScope &&
    cached.snapshot.userId === userId
      ? cached
      : null;
  const canUseCachedSnapshot = () => {
    if (
      cachedForScope === null ||
      !Number.isFinite(cachedForScope.checkedAt) ||
      !Number.isFinite(maxStaleMs) ||
      maxStaleMs < 0
    ) {
      return false;
    }
    const cacheAgeMs = Date.now() - cachedForScope.checkedAt;
    return cacheAgeMs >= 0 && cacheAgeMs <= maxStaleMs;
  };
  let response: Response;
  try {
    response = await fetch(
      \`https://kit.openiap.dev/v1/subscriptions/entitlements?userId=\${encodeURIComponent(userId)}\`,
      {
        headers: {
          Authorization: \`Bearer \${iapkitPublishableKey}\`,
          ...(cachedForScope?.etag
            ? { "If-None-Match": cachedForScope.etag }
            : {}),
        },
      },
    );
  } catch (error) {
    if (cachedForScope && canUseCachedSnapshot()) {
      return cachedForScope.snapshot;
    }
    throw error;
  }

  if (response.status === 304 && cachedForScope) {
    const refreshed = { ...cachedForScope, checkedAt: Date.now() };
    await persistSnapshot(refreshed);
    return refreshed.snapshot;
  }
  if (response.status === 429 || response.status === 503) {
    scheduleRetry(response.headers.get("Retry-After"));
    if (cachedForScope && canUseCachedSnapshot()) {
      return cachedForScope.snapshot;
    }
    throw new Error("Entitlement refresh is rate limited");
  }
  if (!response.ok) throw new Error("Entitlement refresh failed");

  const wireSnapshot = (await response.json()) as {
    userId: string;
    productIds: string[];
    subscriptions: Array<{
      productId: string;
      state: string;
      expiresAt?: number;
      renewsAt?: number;
      willRenew?: boolean;
    }>;
  };
  const snapshot = {
    userId: wireSnapshot.userId,
    productIds: wireSnapshot.productIds,
    subscriptions: wireSnapshot.subscriptions.map(
      ({ productId, state, expiresAt, renewsAt, willRenew }) => ({
        productId,
        state,
        expiresAt,
        renewsAt,
        willRenew,
      }),
    ),
  };
  await persistSnapshot({
    cacheScope: iapkitCacheScope,
    snapshot,
    etag: response.headers.get("ETag"),
    checkedAt: Date.now(),
  });
  return snapshot;
}`}
      </CodeBlock>
      <Callout kind="note" title="A 304 is conditional, not free">
        <p>
          IAPKit still performs one Convex query invocation before returning{" "}
          <code>304</code>. Convex returns a time-independent row snapshot and
          invalidates its cached result when a dependent row changes. Fly then
          evaluates expiry against its own current clock on every HTTP request.
          Cached query results and caller-controlled timestamps therefore cannot
          preserve expired access, and a time-only transition is detected on the
          next refresh. Conditional requests save response bandwidth and
          app-side state work; they do not justify a continuous timer. A normal
          client refreshes only at lifecycle boundaries and uses jittered
          backoff after failures.
        </p>
        <p>
          A user snapshot supports up to 200 subscription rows. IAPKit reads one
          additional indexed row only to detect overflow and returns{" "}
          <code>400 ENTITLEMENT_SNAPSHOT_TOO_LARGE</code> instead of exposing a
          partial entitlement set.
        </p>
      </Callout>
      <Callout
        kind="warning"
        title="Backend-protected content stays server-authoritative"
      >
        <p>
          A mobile snapshot is suitable for app UI and local feature gating. If
          paid content or an API is protected by your own backend, authenticate
          the user there and let that backend make the entitlement decision. A
          developer-owned backend also owns any optional APNs or FCM push.
        </p>
        <p>
          Persist only the fields the UI needs. Avoid retaining purchase tokens
          in general-purpose local storage when product IDs, states, and expiry
          times are sufficient.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">
        Subscription identity fields
      </h2>
      <p>
        Subscription state endpoints such as{" "}
        <code>GET /v1/subscriptions/list</code> keep the legacy{" "}
        <code>purchaseToken</code> field for the stable store identity. On
        Google this is the Play purchase token. On iOS this is the StoreKit{" "}
        <code>originalTransactionId</code> (falling back to{" "}
        <code>transactionId</code>), not the raw JWS. iOS rows also expose{" "}
        <code>originalTransactionId</code> explicitly.
      </p>
      <p>
        Administrative subscription endpoints use{" "}
        <code>Authorization: Bearer openiap-kit_sk_...</code>. Compatibility
        routes with a key in the path remain available, but new server-side and
        MCP integrations should keep secret keys out of URLs.
      </p>
      <CodeBlock title="iOS subscription row" language="json">
        {`{
  "platform": "IOS",
  "purchaseToken": "2000001177054625",
  "originalTransactionId": "2000001177054625"
}`}
      </CodeBlock>
      <p>
        Send the raw StoreKit JWS only to verification or user-binding endpoints
        that explicitly ask for a JWS. Do not log or publish JWS values.
      </p>

      <div className="my-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">State</th>
              <th className="px-3 py-2 text-left font-medium">Meaning</th>
              <th className="px-3 py-2 text-center font-medium">isValid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            <tr>
              <td className="px-3 py-2 font-mono text-xs">ENTITLED</td>
              <td className="px-3 py-2">Paid, not refunded, access granted.</td>
              <td className="px-3 py-2 text-center">true</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                PENDING_ACKNOWLEDGMENT
              </td>
              <td className="px-3 py-2">
                Valid Google Play purchase still awaiting acknowledgment or
                consumption.
              </td>
              <td className="px-3 py-2 text-center">true</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">READY_TO_CONSUME</td>
              <td className="px-3 py-2">
                Apple, Amazon, or catalog-known Google consumable ready for
                durable fulfillment.
              </td>
              <td className="px-3 py-2 text-center">true</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">PENDING</td>
              <td className="px-3 py-2">
                In progress or awaiting confirmation.
              </td>
              <td className="px-3 py-2 text-center">false</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">CONSUMED</td>
              <td className="px-3 py-2">
                Consumable already fulfilled (Google Play).
              </td>
              <td className="px-3 py-2 text-center">false</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">CANCELED</td>
              <td className="px-3 py-2">Refunded, revoked, or cancelled.</td>
              <td className="px-3 py-2 text-center">false</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">EXPIRED</td>
              <td className="px-3 py-2">Subscription past its expiry date.</td>
              <td className="px-3 py-2 text-center">false</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">INAUTHENTIC</td>
              <td className="px-3 py-2">
                Receipt not recognized by the store.
              </td>
              <td className="px-3 py-2 text-center">false</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">UNKNOWN</td>
              <td className="px-3 py-2">State could not be determined.</td>
              <td className="px-3 py-2 text-center">false</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-2xl font-semibold">Response headers</h2>
      <p>
        Every authenticated response after the auth layer carries the
        correlation and rate-limit headers below:
      </p>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <code>X-Correlation-Id</code> — UUID for this request. Quote it in
          support tickets so we can locate the matching server log line.
        </li>
        <li>
          <code>X-RateLimit-Limit</code> — bucket size for this API key.
        </li>
        <li>
          <code>X-RateLimit-Remaining</code> — tokens left in the bucket.
          Reaches 0 just before a 429.
        </li>
      </ul>
      <p>
        Verification responses that pass body validation also carry{" "}
        <code>X-Concurrency-Limit</code> and{" "}
        <code>X-Concurrency-Remaining</code>. <code>X-Concurrency-Scope</code>{" "}
        identifies the reported API-key, trusted source-IP, or process-global
        axis. A 429 or application-generated 503 response carries{" "}
        <code>Retry-After</code> in seconds.
      </p>
      <p>
        401 / 403 responses from the auth layer run before the rate-limit
        middleware and <em>don't</em> carry these headers.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Status codes</h2>
      <div className="my-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Code</th>
              <th className="px-3 py-2 text-left font-medium">Body</th>
              <th className="px-3 py-2 text-left font-medium">Meaning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            <tr>
              <td className="px-3 py-2 font-mono text-xs">200</td>
              <td className="px-3 py-2">
                <code>{`{ store, isValid, state, productId?, clientPayload? }`}</code>
              </td>
              <td className="px-3 py-2">Verification completed.</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">400</td>
              <td className="px-3 py-2 font-mono text-xs">INVALID_INPUT</td>
              <td className="px-3 py-2">
                Malformed body / unknown store / oversized field.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">400</td>
              <td className="px-3 py-2 font-mono text-xs">INVALID_API_KEY</td>
              <td className="px-3 py-2">
                Well-formed key that fails project lookup (unknown or rotated).
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">413</td>
              <td className="px-3 py-2 font-mono text-xs">PAYLOAD_TOO_LARGE</td>
              <td className="px-3 py-2">
                Request body exceeds the 32 KB edge cap.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">401</td>
              <td className="px-3 py-2 font-mono text-xs">MISSING_API_KEY</td>
              <td className="px-3 py-2">No Authorization header.</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">403</td>
              <td className="px-3 py-2 font-mono text-xs">
                INSUFFICIENT_SCOPE
              </td>
              <td className="px-3 py-2">
                Publishable key used for an administrative operation.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">403</td>
              <td className="px-3 py-2 font-mono text-xs">INVALID_API_KEY</td>
              <td className="px-3 py-2">
                Wrong scheme or malformed key (format check only).
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">429</td>
              <td className="px-3 py-2 font-mono text-xs">
                RATE_LIMITED
                <br />
                DUPLICATE_PAYLOAD
                <br />
                REPEATED_FAILURE
              </td>
              <td className="px-3 py-2">
                Per-key or per-payload guard rejected the request; check
                Retry-After.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">503</td>
              <td className="px-3 py-2 font-mono text-xs">SERVICE_BUSY</td>
              <td className="px-3 py-2">
                The API-key, trusted source-IP, or process share has no
                verification slot available; inspect X-Concurrency-Scope and
                retry with jittered backoff after Retry-After.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">500</td>
              <td className="px-3 py-2 font-mono text-xs">UNKNOWN_ERROR</td>
              <td className="px-3 py-2">
                Something went wrong on the server; include the correlation id
                in support tickets.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-2xl font-semibold">Error body shape</h2>
      <CodeBlock title="Error response" language="json">
        {`{
  "errors": [
    {
      "code": "META_HORIZON_APP_SECRET_NOT_CONFIGURED",
      "message": "Meta Horizon App Secret is not set for this project.",
      "path": "horizon.appSecret"
    }
  ]
}`}
      </CodeBlock>

      <p>
        <code>path</code> is present on validation errors (400) and points at
        the offending field. Store-specific failure codes carry details in the
        message — see the per-store pages for the full list.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">See also</h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <Link to="/docs/products" className="text-primary underline">
            Products & client payloads
          </Link>{" "}
          — catalog sync, public payload editing, and retrieval contracts.
        </li>
        <li>
          <Link to="/docs/operations" className="text-primary underline">
            Operations
          </Link>{" "}
          — rate limit tuning, correlation ids, structured logs.
        </li>
        <li>
          <Link
            to="/docs/verification/apple"
            className="text-primary underline"
          >
            Apple
          </Link>
          ,{" "}
          <Link
            to="/docs/verification/google"
            className="text-primary underline"
          >
            Google
          </Link>
          ,{" "}
          <Link
            to="/docs/verification/horizon"
            className="text-primary underline"
          >
            Horizon
          </Link>{" "}
          — per-store error codes and edge cases.
        </li>
      </ul>
    </DocsPage>
  );
}
