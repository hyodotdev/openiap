import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";

export default function ApiReferencePage() {
  return (
    <DocsPage
      slug="api"
      title="API reference"
      description="POST /v1/purchase/verify — request shapes, responses, errors, headers."
    >
      <p>
        IAPKit exposes one core purchase-verification endpoint for your app:{" "}
        <code> POST /v1/purchase/verify</code>. Webhooks, subscription state,
        and product-catalog operations live on separate project-scoped surfaces.
        The full OpenAPI spec is also served at{" "}
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
      <p>Every purchase-verification request must include a Bearer API key:</p>
      <CodeBlock title="Authorization header" language="http">
        {`Authorization: Bearer openiap-kit_<your-key>`}
      </CodeBlock>
      <p>
        Missing header → <code>401 MISSING_API_KEY</code>. Wrong scheme or
        malformed key → <code>403 INVALID_API_KEY</code>.
      </p>
      <p>
        In the default mobile-direct flow, your app sends this key to IAPKit as
        the managed validation service. If you proxy calls through your own
        backend instead, keep the key server-side and call the same endpoint
        from there.
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

      <Callout kind="note" title="Malformed inputs stop at the edge">
        <p>
          The JSON body is capped at 32 KB before parsing. Every string field is
          then validated server-side for non-empty + per-field length bounds.
          Oversized fields return <code>400 INVALID_INPUT</code>; oversized
          request bodies return <code>413 PAYLOAD_TOO_LARGE</code>. Neither path
          calls Apple / Google / Meta, so malformed clients don't burn your
          upstream quota.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Success response</h2>
      <CodeBlock title="200 OK" language="json">
        {`{
  "isValid": true,
  "state": "ENTITLED",
  "productId": "premium_monthly"
}`}
      </CodeBlock>

      <p>
        Your app can unlock premium state when <code>isValid === true</code>.{" "}
        <code>state</code> carries the harmonized lifecycle position across all
        three stores, and <code>productId</code> is the product id verified by
        the upstream store. For Meta Horizon, <code>productId</code> is the SKU
        IAPKit checked.
      </p>
      <p>
        If your own backend keeps an entitlement ledger, do not trust a
        client-provided product id. Send <code>expectedProductId</code> with the
        Apple or Google request. IAPKit compares it against the store-verified{" "}
        <code>productId</code> and returns <code>isValid: false</code> with{" "}
        <code>state: "INAUTHENTIC"</code> on mismatch.
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
                Valid but still needs acknowledgement (Android).
              </td>
              <td className="px-3 py-2 text-center">true</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">READY_TO_CONSUME</td>
              <td className="px-3 py-2">
                Consumable marked ready to be fulfilled (iOS).
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
      <p>Every authenticated response (2xx, validation 4xx, 429) carries:</p>
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
        On 429 the response also carries <code>Retry-After</code> in seconds.
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
                <code>{`{ isValid, state, productId? }`}</code>
              </td>
              <td className="px-3 py-2">Verification completed.</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">400</td>
              <td className="px-3 py-2 font-mono text-xs">INVALID_INPUT</td>
              <td className="px-3 py-2">
                Malformed body / unknown store / input exceeds size cap.
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
              <td className="px-3 py-2 font-mono text-xs">INVALID_API_KEY</td>
              <td className="px-3 py-2">
                Wrong scheme, malformed key, or key not recognized.
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
