import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";

export default function ProductsPage() {
  return (
    <DocsPage
      slug="products"
      title="Products & client payloads"
      description="Sync store catalogs and attach public, app-readable TOML, JSON, or text rules to each product."
    >
      <p>
        The <strong>Products</strong> tab keeps IAPKit&apos;s project-scoped
        view of your App Store Connect and Play Console catalogs. Each product
        can also carry an optional <code>clientPayload</code>: a small public
        rules document your app can fetch from IAPKit without operating another
        metadata service.
      </p>

      <Callout kind="warning" title="Client payloads are public app data">
        <p>
          Anyone who can call your project&apos;s client endpoints may receive
          these values. Never store API secrets, signing keys, credentials, or
          private server-only rules in a client payload. Use your own protected
          backend for secrets.
        </p>
      </Callout>
      <Callout kind="note" title="Ambiguous network failures stay safe">
        <p>
          App Store Connect does not accept an idempotency key when IAPKit
          creates a review submission. If the network closes after Apple may
          have created a draft but before its ID reaches IAPKit, the affected
          products stay Draft and the result asks you to inspect App Store
          Connect. IAPKit never adopts or submits an unidentified existing
          draft.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">
        Submit Apple products for App Review
      </h2>
      <p>
        iOS Push Sync can prepare and submit eligible in-app purchases and
        auto-renewable subscriptions through App Store Connect. In project
        Settings, configure the <strong>App Store Connect API key</strong> and
        upload one <strong>App Review screenshot</strong> (flattened PNG without
        alpha, or JPEG, up to 10 MB). Use a screenshot size supported by the
        app; Apple validates those app-specific dimensions during asset
        processing. The screenshot is private project data: only an
        authenticated organization admin or owner can download it, and IAPKit
        never exposes a public storage URL.
      </p>
      <ol className="my-3 list-decimal space-y-2 pl-6">
        <li>
          Run <strong>Dry-run</strong> first. It lists the product-version,
          screenshot-upload, and review-submission writes without changing App
          Store Connect.
        </li>
        <li>
          Run <strong>Sync with App Store Connect</strong>. IAPKit creates the
          current version metadata, uploads every byte range Apple reserves,
          waits for asset delivery, and then submits the eligible version for
          review.
        </li>
        <li>
          Check the result banner. Upstream errors stay in the failure list;
          Apple requirements that need an operator appear separately as manual
          actions.
        </li>
      </ol>
      <p>
        The upload slot is intentionally project-level: IAPKit reuses the same
        screenshot for every eligible IAPKit-managed iOS product in that
        project. Products imported from App Store Connect remain read-only to
        this review workflow until you edit them into an IAPKit Draft. If
        products need different review screenshots, submit those products
        manually in App Store Connect instead of configuring this slot. Without
        a stored screenshot, Push Sync keeps its previous behavior and stops at
        Ready to Submit; adding the screenshot later makes those IAPKit-managed
        Ready rows resumable. Removing the file in IAPKit only stops future
        reuse; it does not remove copies already uploaded to App Store Connect.
        Manage or delete those ASC copies separately in App Store Connect.
      </p>
      <Callout kind="warning" title="First product types need an app version">
        <p>
          Apple requires the first consumable, first non-consumable, first
          auto-renewable subscription, and first non-renewing subscription to
          travel with a new app version. A new subscription group must also be
          reviewed with a subscription from that group. IAPKit does not treat
          these constraints as sync failures and does not create an app
          submission implicitly; it reports a manual action so an operator can
          finish the combined submission in App Store Connect.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">
        Two ways to request client payloads
      </h2>
      <p>
        The opt-in has the same name in both contexts, but it belongs in a
        different part of each request:
      </p>
      <div className="my-4 overflow-x-auto rounded-lg border border-border">
        <table className="min-w-[42rem] w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Use case
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Opt in here
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Result
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <td className="px-3 py-2 font-medium">Purchase verification</td>
              <td className="px-3 py-2">
                SDK: <code>iapkit.includeClientPayload: true</code>
                <br />
                HTTP JSON: <code>includeClientPayload: true</code>
              </td>
              <td className="px-3 py-2">
                A valid Apple or Google verification may include{` `}
                <code>clientPayload</code> in the same response. SDKs expose it
                as <code>result.iapkit.clientPayload</code>; raw HTTP returns it
                at the top level.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-medium">
                Catalog or app-open read
              </td>
              <td className="px-3 py-2">
                SDK: <code>kitApi.products</code> with{` `}
                <code>includeClientPayload: true</code> and{` `}
                <code>platform</code>
                <br />
                HTTP query: <code>includeClientPayload=true</code> with{` `}
                <code>platform</code>
              </td>
              <td className="px-3 py-2">
                Each product in that catalog page may include its optional{` `}
                <code>clientPayload</code>.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Both opt-ins default to false. The direct endpoint for one known product
        does not use this flag; it returns that product&apos;s payload or HTTP
        404.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">
        Store metadata vs. client payloads
      </h2>
      <p>
        Titles, descriptions, prices, billing periods, and review notes mirror
        store-managed product metadata. Pull/Push Sync can read or write those
        fields. A client payload is IAPKit-only and is keyed by project,
        platform, and product ID, so an iOS product and an Android product with
        the same ID may carry different rules.
      </p>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>Store Sync never sends a client payload to Apple or Google.</li>
        <li>Store pulls never overwrite a client payload.</li>
        <li>
          Reset deletes the local store-catalog cache but retains client
          payloads. Retained payloads are not app-readable while the product is
          absent; the payload appears again when Sync re-pulls the matching
          platform and product ID.
        </li>
      </ul>
      <Callout kind="warning" title="Show store prices, not catalog prices">
        <p>
          The catalog&apos;s <code>priceAmountMicros</code> and{" "}
          <code>currency</code> mirror the store for operations such as sync and
          revenue reporting. They are not localized and can lag a price change.
          Show users the price, currency, trial eligibility, and billing terms
          the SDK returns from the store: <code>fetchProducts</code>,{" "}
          <code>isEligibleForIntroOfferIOS</code>, and the Android offer
          details. Never render them from a client payload or from IAPKit&apos;s
          catalog.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">
        Draft, publish, and roll back
      </h2>
      <p>
        Apps only ever receive the published payload. Edits go to a draft first,
        so you can check them before any app sees them.
      </p>
      <ol className="my-3 list-decimal space-y-2 pl-6">
        <li>
          Open the Products tab and choose <strong>Add payload</strong>, or an
          existing payload&apos;s format and version badge, in the
          product&apos;s row.
        </li>
        <li>
          Pick TOML, JSON, or plain text and edit the body.{" "}
          <strong>Save draft</strong> keeps it without publishing. JSON must be
          an object; TOML and JSON syntax are validated before every save.
        </li>
        <li>
          Check the <strong>Preview</strong> tab: the draft beside the published
          body, a line diff, and the exact HTTP status, headers, ETag, and body
          an app receives now and after publishing. The ETag is computed for the
          project&apos;s newest active publishable key.
        </li>
        <li>
          Choose <strong>Publish</strong>, optionally with a note. The draft
          becomes the next version and the draft is cleared.
        </li>
      </ol>
      <p>
        The <strong>History</strong> tab lists the newest 50 versions per
        product with author, time, note, and size. Rolling back republishes an
        older body as a <em>new</em> version, so history stays append-only and
        apps see a newer ETag. Versions older than the newest 50 are pruned and
        cannot be restored.
      </p>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          Every publish, rollback, and removal increments <code>version</code>.
          A removed payload keeps its revision, so a version number is never
          reused.
        </li>
        <li>
          Organization members can read payloads, drafts, and history. Only
          owners and admins can save, publish, roll back, or remove.
        </li>
        <li>
          Publish checks the published version and the draft revision you
          opened. A stale browser tab gets{" "}
          <code>CLIENT_PAYLOAD_VERSION_CONFLICT</code> or{" "}
          <code>CLIENT_PAYLOAD_DRAFT_CONFLICT</code> instead of overwriting a
          newer edit.
        </li>
      </ul>
      <p>
        CI and catalog automation use the same operations with a secret admin
        key. Publishable mobile keys are rejected with{" "}
        <code>403 INSUFFICIENT_SCOPE</code>.
      </p>
      <Callout kind="note" title="Products created directly in a store">
        <p>
          A matching IAPKit catalog row must exist before its payload can be
          saved. If automation creates the product in App Store Connect or Play
          Console first, run a pull sync and wait for that job to succeed, then
          set the payload. Alternatively, create the matching IAPKit row through
          the secret-authenticated <code>POST /v1/products</code> endpoint.
          Writing too early returns <code>PRODUCT_NOT_FOUND</code>.
        </p>
      </Callout>
      <CodeBlock
        title="Pull a newly created iOS product into IAPKit"
        language="bash"
      >
        {`curl -X POST \\
  "https://kit.openiap.dev/v1/products/sync/ios?direction=pull&dryRun=false" \\
  -H "Authorization: Bearer openiap-kit_sk_<your-secret-key>"

# Poll the returned jobId until status is succeeded.
curl "https://kit.openiap.dev/v1/products/sync/jobs/<jobId>" \\
  -H "Authorization: Bearer openiap-kit_sk_<your-secret-key>"`}
      </CodeBlock>
      <CodeBlock title="Set a payload from CI" language="bash">
        {`curl -X PUT \\
  "https://kit.openiap.dev/v1/products/client-payload/premium_monthly?platform=IOS" \\
  -H "Authorization: Bearer openiap-kit_sk_<your-secret-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "format": "toml",
    "body": "[access]\\nmax_items = 10",
    "expectedVersion": 3
  }'`}
      </CodeBlock>
      <CodeBlock title="Remove a payload from CI" language="bash">
        {`curl -X DELETE \\
  "https://kit.openiap.dev/v1/products/client-payload/premium_monthly?platform=IOS&expectedVersion=4" \\
  -H "Authorization: Bearer openiap-kit_sk_<your-secret-key>"`}
      </CodeBlock>
      <p>
        <code>PUT</code> publishes immediately, as a draft save and publish in
        one step, and records the version in history with the API key as its
        author. It leaves any saved draft in place. <code>expectedVersion</code>{" "}
        is optional for automation. Pass it when you want optimistic concurrency
        protection; omit it for an atomic last-write-wins publish. Read the same
        URL with <code>GET</code> to recover the durable revision after
        deletion.
      </p>
      <p>
        The draft workflow has its own routes under{" "}
        <code>/v1/products/client-payload/&#123;productId&#125;</code>. Each
        takes <code>?platform=IOS|Android</code> and a secret key:
      </p>
      <div className="my-4 overflow-x-auto rounded-lg border border-border">
        <table className="min-w-[36rem] w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Route
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Body or result
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[
              ["GET /draft", "{ expectedDraftRevision, draft? }"],
              [
                "PUT /draft",
                "{ format, body, expectedDraftRevision? } → { changed, revision, baseVersion, updatedAt }",
              ],
              ["DELETE /draft?expectedDraftRevision=N", "{ ok }"],
              [
                "POST /publish",
                "{ expectedVersion?, expectedDraftRevision?, note? }",
              ],
              ["GET /history", "{ versions } newest first, without bodies"],
              ["GET /history/{version}", "{ version } with its body"],
              ["POST /rollback", "{ toVersion, expectedVersion?, note? }"],
            ].map(([route, shape]) => (
              <tr key={route}>
                <td className="px-3 py-2 font-mono text-xs">{route}</td>
                <td className="px-3 py-2 font-mono text-xs">{shape}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Publish and rollback return the same{" "}
        <code>{`{ id, created, changed, version, updatedAt }`}</code> as{" "}
        <code>PUT</code>. A rollback or publish that matches the live body
        returns <code>changed: false</code> and adds no version. The hosted MCP
        server exposes the same operations as{" "}
        <code>iapkit_get_client_payload</code>,{" "}
        <code>iapkit_set_client_payload</code>,{" "}
        <code>iapkit_remove_client_payload</code>,{" "}
        <code>iapkit_get_client_payload_draft</code>,{" "}
        <code>iapkit_set_client_payload_draft</code>,{" "}
        <code>iapkit_publish_client_payload</code>,{" "}
        <code>iapkit_get_client_payload_history</code>, and{" "}
        <code>iapkit_rollback_client_payload</code>.
      </p>
      <CodeBlock title="Draft, publish, and roll back from CI" language="bash">
        {`BASE="https://kit.openiap.dev/v1/products/client-payload/premium_monthly"
AUTH="Authorization: Bearer openiap-kit_sk_<your-secret-key>"

curl -X PUT "$BASE/draft?platform=IOS" -H "$AUTH" \\
  -H "Content-Type: application/json" \\
  -d '{ "format": "json", "body": "{\\"maxItems\\":12}" }'

curl -X POST "$BASE/publish?platform=IOS" -H "$AUTH" \\
  -H "Content-Type: application/json" \\
  -d '{ "expectedVersion": 4, "note": "Raise the limit" }'

curl "$BASE/history?platform=IOS" -H "$AUTH"

curl -X POST "$BASE/rollback?platform=IOS" -H "$AUTH" \\
  -H "Content-Type: application/json" \\
  -d '{ "toVersion": 4, "expectedVersion": 5 }'`}
      </CodeBlock>

      <CodeBlock title="Client payload shape" language="json">
        {`{
  "format": "toml",
  "body": "[access]\\nmax_items = 10",
  "version": 3,
  "updatedAt": 1784160000000
}`}
      </CodeBlock>

      <h2 className="mt-10 text-2xl font-semibold">
        Cache known payloads; paginate explicit catalog refreshes
      </h2>
      <p>
        Include payloads in a platform catalog read by opting in explicitly:
      </p>
      <Callout kind="warning" title="Use only a publishable key in the app">
        <p>
          A publishable key can be extracted, but IAPKit limits it to
          verification and client-safe operations. It cannot change products or
          payloads, inspect project-wide analytics, or run store sync. Never
          substitute the <code>openiap-kit_sk_</code> secret used by MCP or CI.
        </p>
      </Callout>
      <CodeBlock title="List iOS products with payloads" language="bash">
        {`curl "https://kit.openiap.dev/v1/products/openiap-kit_pk_<your-publishable-key>?platform=IOS&includeClientPayload=true&limit=25"`}
      </CodeBlock>
      <CodeBlock title="Catalog response" language="json">
        {`{
  "products": [
    {
      "productId": "premium_monthly",
      "platform": "IOS",
      "type": "Subscription",
      "title": "Premium Monthly",
      "state": "Active",
      "updatedAt": 1784160000000,
      "clientPayload": {
        "format": "toml",
        "body": "[access]\\nmax_items = 10",
        "version": 3,
        "updatedAt": 1784160000000
      }
    }
  ],
  "hasMore": true,
  "nextCursor": "opaque-cursor-from-iapkit"
}`}
      </CodeBlock>
      <p>
        React Native IAP and Expo IAP export the same canonical{" "}
        <code>kitApi</code> helper. Import it from the package your app uses and
        give it an AsyncStorage-compatible cache. Use the direct method for a
        known product, and revalidate once on cold startup or an explicit
        refresh instead of downloading the catalog on every foreground event:
      </p>
      <CodeBlock
        title="React Native / Expo persistent cache"
        language="typescript"
      >
        {`import AsyncStorage from "@react-native-async-storage/async-storage";
import { kitApi } from "react-native-iap"; // Or "expo-iap"

const api = kitApi({
  apiKey: IAPKIT_PUBLISHABLE_KEY,
  clientPayloadCache: AsyncStorage,
});

const { clientPayload } = await api.clientPayload(
  "premium_monthly",
  "IOS",
);

// Sends If-None-Match when a persisted ETag exists. A 304 reuses the body.
const refreshed = await api.clientPayload(
  "premium_monthly",
  "IOS",
  { refresh: true },
);`}
      </CodeBlock>
      <p>
        A refresh that hits a network error, <code>429</code>, or a{" "}
        <code>5xx</code> returns the cached copy with <code>stale: true</code>{" "}
        instead of throwing. A <code>404</code> still clears the cached copy and
        throws, because the payload was removed. With nothing cached, every
        error throws.
      </p>
      <p>
        Every app-facing catalog read uses opaque cursor pagination.{" "}
        <code>limit</code> defaults to 25 and accepts 1-50; pass{" "}
        <code>nextCursor</code> back as <code>cursor</code> while{" "}
        <code>hasMore</code> is true. Payload-inclusive reads additionally
        require <code>platform</code> and perform exact payload lookups only for
        products in that bounded page. The default path performs zero payload
        lookups. If catalog changes invalidate a cursor, IAPKit returns{" "}
        <code>400 INVALID_CURSOR</code>; restart from the first page without a
        cursor.
      </p>
      <p>
        To fetch one known product without downloading the full catalog, use:
      </p>
      <CodeBlock title="Fetch one product payload" language="bash">
        {`curl "https://kit.openiap.dev/v1/products/openiap-kit_pk_<your-publishable-key>/premium_monthly/client-payload?platform=IOS"`}
      </CodeBlock>
      <p>
        The direct endpoint returns <code>{`{ clientPayload: { ... } }`}</code>{" "}
        or <code>404</code> when the matching product is missing, Draft,
        Removed, or has no payload. Catalog reads omit{" "}
        <code>clientPayload</code> unless <code>includeClientPayload=true</code>{" "}
        is present. Direct responses use a key/platform/product/version-scoped{" "}
        <code>ETag</code>; a matching <code>If-None-Match</code> returns{" "}
        <code>304</code> without reading the payload body. Catalog and
        secret-admin responses are not cacheable.
      </p>
      <Callout kind="note" title="Cost protection is applied before Convex">
        <p>
          Public requests use bounded API-key, source-IP, and process-wide token
          buckets with TTL/LRU eviction. Payload catalog pages are weighted by
          requested item count. Rate-limit checks do not write per-request
          counters to Convex; rejected requests return 429, Retry-After, and the
          limiting scope.
        </p>
      </Callout>
      <CodeBlock title="Direct payload response" language="json">
        {`{
  "clientPayload": {
    "format": "toml",
    "body": "[access]\\nmax_items = 10",
    "version": 3,
    "updatedAt": 1784160000000
  }
}`}
      </CodeBlock>

      <h2 className="mt-10 text-2xl font-semibold">Localize payload copy</h2>
      <p>
        IAPKit validates only a payload&apos;s format and size; it never reads
        your keys. To localize app copy, put it in a JSON or TOML body using
        this convention. The keys inside <code>default</code> and each locale
        belong to your app.
      </p>
      <CodeBlock title="Localized JSON payload" language="json">
        {`{
  "schemaVersion": 1,
  "default": { "headline": "Go premium", "cta": "Subscribe" },
  "locales": {
    "ko": { "headline": "프리미엄으로 업그레이드" },
    "en-US": { "headline": "Go Premium" }
  }
}`}
      </CodeBlock>
      <p>
        <code>resolveLocalizedPayload(document, options)</code> picks the first
        match for <code>locale</code> and its shorter prefixes (
        <code>zh-Hant-TW</code>, <code>zh-Hant</code>, <code>zh</code>), then{" "}
        <code>fallbackLocales</code> the same way, and merges it over{" "}
        <code>default</code>. It returns <code>null</code> when{" "}
        <code>schemaVersion</code> is missing or not in{" "}
        <code>supportedSchemaVersions</code> (default <code>[1]</code>), so an
        older app build ignores a shape it does not understand.{" "}
        <code>kitApi.localizedClientPayload</code> fetches and resolves a JSON
        payload in one call and never throws: any failure returns{" "}
        <code>null</code>. For TOML, parse the body yourself and pass the result
        to <code>resolveLocalizedPayload</code>.
      </p>
      <CodeBlock
        title="Read localized copy with a fallback"
        language="typescript"
      >
        {`import { kitApi } from "react-native-iap"; // Or "expo-iap"

const copy = await kitApi({
  apiKey: IAPKIT_PUBLISHABLE_KEY,
  clientPayloadCache: AsyncStorage,
}).localizedClientPayload("premium_monthly", "IOS", {
  locale: "ko-KR",
  fallbackLocales: ["en-US"],
  refresh: true,
});

// null: offline with no cache, removed, unsupported schemaVersion, or not JSON.
const headline = copy?.values.headline ?? BUILT_IN_COPY.headline;`}
      </CodeBlock>
      <Callout kind="note" title="Ship built-in copy">
        <p>
          Bundle every string your app reads from a payload. A first launch
          offline, a removed payload, or a newer <code>schemaVersion</code> all
          resolve to <code>null</code>, and the app should still render. Prices
          and trial terms come from the store, never from this copy.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">
        Return a payload after verification
      </h2>
      <p>
        Apple and Google verification requests may send{" "}
        <code>includeClientPayload: true</code>. IAPKit attaches the payload
        only when the receipt is valid, the store supplies a verified product
        ID, and that exact platform/product is present, not Draft or Removed,
        and has a payload.
      </p>
      <CodeBlock title="Apple opt-in request" language="json">
        {`{
  "store": "apple",
  "jws": "eyJhbGciOi...",
  "expectedProductId": "premium_monthly",
  "includeClientPayload": true
}`}
      </CodeBlock>
      <CodeBlock title="Enriched valid response" language="json">
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
      <p>
        Default requests, invalid receipts, missing, Draft, or Removed catalog
        products, missing payloads, and Horizon or Amazon verification responses
        omit the field. Always make entitlement decisions from{" "}
        <code>isValid</code>, the purchase <code>state</code>, and the
        store-verified <code>productId</code>, require that ID to match the
        product your app expected, and never fall back to a client-supplied ID
        when the verified value is missing.
      </p>

      <Callout kind="note" title="This is retrieval, not a push notification">
        <p>
          IAPKit does not send client payloads through APNs or FCM and does not
          display an OS notification. Your app receives the value when it calls
          a catalog/payload endpoint or opts in during Apple/Google purchase
          verification.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Limits and validation</h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>The body is required and cannot be blank.</li>
        <li>The body is limited to 16 KiB measured as UTF-8 bytes.</li>
        <li>JSON must parse to a non-null, non-array object.</li>
        <li>
          TOML must be syntactically valid; plain text is otherwise opaque.
        </li>
        <li>Drafts are validated by the same rules as published bodies.</li>
        <li>
          Publish and rollback notes are limited to 500 characters; history
          keeps the newest 50 versions per product.
        </li>
      </ul>
      <p>
        General product-management requests use a 64 KiB envelope. Client
        payload writes use a bounded 128 KiB envelope so JSON escaping cannot
        prevent a valid 16 KiB decoded body from reaching validation. Neither
        envelope is per-product custom storage. See{" "}
        <Link to="/docs/operations" className="text-primary underline">
          Operations
        </Link>{" "}
        for all request and field limits, and the{" "}
        <Link to="/docs/api" className="text-primary underline">
          API reference
        </Link>{" "}
        for verification behavior.
      </p>
    </DocsPage>
  );
}
