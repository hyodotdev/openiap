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
        live on separate project-scoped surfaces. The v1 OpenAPI spec is served
        at{" "}
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
        (raw JSON). The secret-only, tokenless account API is documented at{" "}
        <a
          href="/v2/openapi"
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          /v2/openapi
        </a>
        .
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
      <p>
        Account-level status, entitlement, and erasure operations live under
        <code> /v2/subscriptions/*</code>. They require a secret admin key and
        must be called by your authenticated backend, never by a mobile app.
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
  "sandbox": true,                         // requires project opt-in
  "expectedProductId": "premium_monthly"  // optional match guard
}`}
      </CodeBlock>

      <Callout kind="warning" title="Amazon sandbox is an explicit opt-in">
        <p>
          Enable <strong>Allow Amazon App Tester / RVS Cloud Sandbox</strong> in
          project settings before sending <code>sandbox: true</code>. Amazon
          accepts any non-empty shared secret in Cloud Sandbox, so IAPKit keeps
          it disabled by default and never sends your production shared secret
          to the sandbox endpoint.
        </p>
      </Callout>

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
  "productId": "premium_monthly",
  "environment": "Sandbox"
}`}
      </CodeBlock>

      <p>
        Grant or fulfill only when <code>isValid === true</code>, the harmonized{" "}
        <code>state</code> permits that operation, and the store-verified{" "}
        <code>productId</code> is present and matches the product your app
        expected. For Meta Horizon, <code>productId</code> is the SKU IAPKit
        checked. Amazon responses also identify the server-selected{" "}
        <code>environment</code> as <code>Sandbox</code> or{" "}
        <code>Production</code>. A caller-supplied Amazon{" "}
        <code>expectedProductId</code> mismatch returns <code>INAUTHENTIC</code>{" "}
        without changing the persisted RVS verdict.
      </p>
      <p>
        Active Amazon purchase rows become due for another RVS check after 48
        hours. This is a scheduling cadence, not a completion guarantee: the
        worker handles at most 20 rows per five-minute tick (5,760/day, or
        17,280 over 72 hours before failures), and backlog or retries add delay.
        Request starts remain below Amazon&apos;s 10 TPS polling ceiling. A
        non-null <code>cancelDate</code> is authoritative loss of access; a past{" "}
        <code>renewalDate</code> alone is not treated as expiry. These checks
        refresh purchase snapshots only and do not create Amazon subscription
        rows.
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
        Apple, Google, or Amazon request. IAPKit compares it against the
        store-verified <code>productId</code> and returns{" "}
        <code>isValid: false</code> with <code>state: "INAUTHENTIC"</code> on
        mismatch.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">
        Read account access through your backend
      </h2>
      <p>
        Apple and Google lifecycle webhooks update IAPKit&apos;s canonical
        subscription snapshot. IAPKit does not relay project events or keep a
        mobile SSE, WebSocket, or long-poll connection open. Your authenticated
        backend reads the tokenless v2 snapshot when the app needs an access
        decision.
      </p>
      <ol className="list-decimal space-y-1 pl-6">
        <li>Authenticate the app user on your backend.</li>
        <li>
          Resolve the opaque IAPKit <code>userId</code> from that session. Do
          not trust a user ID supplied independently by the client.
        </li>
        <li>
          Call <code>GET /v2/subscriptions/entitlements</code> with a secret key
          stored only on the backend.
        </li>
        <li>
          Return only the access decision or tokenless fields the app needs.
          Coalesce concurrent reads and use a bounded, project-and-user-scoped
          cache if necessary.
        </li>
      </ol>
      <CodeBlock
        title="Authenticated backend entitlement read"
        language="typescript"
      >
        {`async function entitlementsForSession(sessionToken: string) {
  const user = await authenticateSession(sessionToken);
  if (!user) throw new Error("Unauthenticated");

  const response = await fetch(
    \`https://kit.openiap.dev/v2/subscriptions/entitlements?userId=\${encodeURIComponent(user.iapkitUserId)}\`,
    {
      headers: {
        Authorization: \`Bearer \${process.env.IAPKIT_SECRET_KEY}\`,
      },
    },
  );
  if (!response.ok) throw new Error("Entitlement lookup failed");

  const snapshot = await response.json();
  return {
    productIds: snapshot.productIds,
    subscriptions: snapshot.subscriptions.map(
      ({ productId, state, expiresAt }: {
        productId: string;
        state: string;
        expiresAt?: number;
      }) => ({ productId, state, expiresAt }),
    ),
  };
}`}
      </CodeBlock>
      <Callout kind="note" title="v1 remains a compatibility surface">
        <p>
          Existing v1 status and entitlement routes remain available for shipped
          SDK compatibility. New integrations should use v2 through an
          authenticated backend. v2 omits <code>purchaseToken</code> and{" "}
          <code>originalTransactionId</code> and rejects publishable keys.
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
          Authenticate the user before selecting the IAPKit user ID. Paid
          content and APIs should use the backend&apos;s entitlement decision,
          and the developer-owned backend also owns any optional APNs or FCM
          push.
        </p>
        <p>
          Persist only the tokenless fields the UI needs. Never forward the
          IAPKit secret key or an unrestricted account lookup to the app.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">
        Subscription identity fields
      </h2>
      <p>
        Subscription state endpoints under v1 keep the legacy{" "}
        <code>purchaseToken</code> field for the stable store identity. On
        Google this is the Play purchase token. On iOS this is the StoreKit{" "}
        <code>originalTransactionId</code> (falling back to{" "}
        <code>transactionId</code>), not the raw JWS. iOS rows also expose{" "}
        <code>originalTransactionId</code> explicitly.
      </p>
      <p>
        The v2 status and entitlement responses omit both store-identity fields.
        Use v1 administrative listings only for store reconciliation that
        actually requires a token.
      </p>
      <p>
        Administrative subscription endpoints require{" "}
        <code>Authorization: Bearer openiap-kit_sk_...</code>. IAPKit never
        accepts a secret key in a URL — a secret key in a path returns{" "}
        <code>410 SECRET_API_KEY_IN_URL</code>. The compatibility routes that
        keep a key in the path accept publishable keys only, for SDK runtimes
        that strip request headers.
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

      <p>
        <code>state</code> has two distinct vocabularies. The table below is the
        verification vocabulary returned by <code>/v1/purchase/verify</code>.
        The subscription snapshot endpoints use a lifecycle vocabulary instead —{" "}
        <code>Active</code>, <code>InGracePeriod</code>,{" "}
        <code>InBillingRetry</code>, <code>Expired</code>, <code>Revoked</code>,{" "}
        <code>Refunded</code>, <code>Paused</code>, <code>Unknown</code> — so
        gating a snapshot on <code>state === &quot;ENTITLED&quot;</code> never
        matches.
      </p>

      <div className="my-4 overflow-x-auto rounded-lg border border-border">
        <table className="min-w-[42rem] w-full text-sm">
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

      <h2 className="mt-10 text-2xl font-semibold">Subscription endpoints</h2>
      <p>
        Bind first, then read. <code>POST /v1/subscriptions/bind-user</code>{" "}
        associates a store transaction with your own user id; until a purchase
        is bound, the read endpoints resolve <code>userId</code> against rows
        that were never linked and return an empty snapshot. The v2 reads must
        run on the authenticated developer backend.
      </p>
      <div className="my-4 overflow-x-auto rounded-lg border border-border">
        <table className="min-w-[42rem] w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Endpoint</th>
              <th className="px-3 py-2 text-left font-medium">Key</th>
              <th className="px-3 py-2 text-left font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                POST /v1/subscriptions/bind-user
              </td>
              <td className="px-3 py-2">Publishable</td>
              <td className="px-3 py-2">
                Links a purchase to your user id. Body up to 32 KB.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                GET /v2/subscriptions/status
              </td>
              <td className="px-3 py-2">Secret</td>
              <td className="px-3 py-2">
                Tokenless current snapshot for one authenticated backend user
                mapping (<code>userId</code> ≤256 chars).
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                GET /v2/subscriptions/entitlements
              </td>
              <td className="px-3 py-2">Secret</td>
              <td className="px-3 py-2">
                Tokenless entitled product ids for one backend-authenticated
                user. Already filtered to non-expired rows.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                POST /v2/subscriptions/user-erasure
              </td>
              <td className="px-3 py-2">Secret</td>
              <td className="px-3 py-2">
                Schedules durable removal of an app user id from subscription
                and commerce-event rows. Poll the returned job id. Your backend
                must separately erase any event copies it already received.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                GET /v1/subscriptions/list
              </td>
              <td className="px-3 py-2">Secret</td>
              <td className="px-3 py-2">
                Project-wide administrative listing. <code>limit</code> capped
                at 200.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-2xl font-semibold">Response headers</h2>
      <p>
        Verification requests that pass bearer-token shape validation carry a
        correlation ID. Requests that reach the multi-axis rate limiter also
        carry its limit and remaining-token headers:
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
        Verification responses that reach the in-flight guard also carry{" "}
        <code>X-Concurrency-Limit</code> and{" "}
        <code>X-Concurrency-Remaining</code>. <code>X-Concurrency-Scope</code>{" "}
        identifies the reported API-key, trusted source-IP, or process-global
        axis. A <code>RATE_LIMITED</code> response names its key, IP, or process
        bucket in <code>X-RateLimit-Scope</code>. A 429 or application-generated
        503 response carries <code>Retry-After</code> in seconds.
      </p>
      <p>
        401 / 403 responses from the auth layer run before the rate-limit
        middleware and <em>don't</em> carry these headers.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Status codes</h2>
      <div className="my-4 overflow-x-auto rounded-lg border border-border">
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
                <code>{`{ store, isValid, state, productId?, environment?, clientPayload? }`}</code>
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
                RATE_LIMITED names the rejecting API-key, source-IP, or process
                bucket in X-RateLimit-Scope. DUPLICATE_PAYLOAD and
                REPEATED_FAILURE are per-(key, payload) replay guards. Check
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
          </Link>
          ,{" "}
          <Link
            to="/docs/verification/amazon"
            className="text-primary underline"
          >
            Amazon
          </Link>{" "}
          — per-store error codes and edge cases.
        </li>
      </ul>
    </DocsPage>
  );
}
