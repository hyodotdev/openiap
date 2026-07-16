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

      <h2 className="mt-10 text-2xl font-semibold">Add or edit a payload</h2>
      <ol className="my-3 list-decimal space-y-2 pl-6">
        <li>Open a project and choose the Products tab.</li>
        <li>
          Add or sync the store product, then choose{" "}
          <strong>Add payload</strong> in its row.
        </li>
        <li>
          Select TOML, JSON, or plain text, enter the body, and save. JSON must
          contain an object rather than an array or scalar; TOML syntax is
          validated before the write.
        </li>
      </ol>
      <p>
        Updating a payload increments its server-managed <code>version</code>.
        Apps can cache the body together with that version and replace the
        cached value when a later response reports a newer version. Dashboard
        writes also check the version they opened, so an older browser tab is
        rejected instead of silently overwriting a newer edit.
      </p>

      <CodeBlock title="Client payload shape" language="json">
        {`{
  "format": "toml",
  "body": "[access]\\nmax_items = 10",
  "version": 3,
  "updatedAt": 1784160000000
}`}
      </CodeBlock>

      <h2 className="mt-10 text-2xl font-semibold">
        Fetch payloads when the app opens
      </h2>
      <p>
        Include payloads in a platform catalog read by opting in explicitly:
      </p>
      <Callout kind="warning" title="Treat project keys as app credentials">
        <p>
          A key embedded in an app can be extracted. IAPKit project keys scope
          requests and quota to a project, and existing project endpoints may
          grant more access than this read. Use a separate key for each app
          build or environment, avoid committing or logging it, and rotate it
          from the dashboard if it is exposed. Keep the call on your own backend
          when your threat model requires a server-held secret.
        </p>
      </Callout>
      <CodeBlock title="List iOS products with payloads" language="bash">
        {`curl "https://kit.openiap.dev/v1/products/<project-api-key>?platform=IOS&includeClientPayload=true&limit=25"`}
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
        call it during app startup or whenever you refresh public rules:
      </p>
      <CodeBlock
        title="React Native / Expo app-open fetch"
        language="typescript"
      >
        {`import { kitApi } from "react-native-iap"; // Or "expo-iap"

const api = kitApi({ apiKey: IAPKIT_API_KEY });
const firstPage = await api.products({
  platform: "IOS",
  includeClientPayload: true,
  limit: 25,
});

if (firstPage.hasMore && firstPage.nextCursor) {
  const secondPage = await api.products({
    platform: "IOS",
    includeClientPayload: true,
    limit: 25,
    cursor: firstPage.nextCursor,
  });
  // Consume secondPage.products and continue while hasMore is true.
}

const { clientPayload } = await api.clientPayload(
  "premium_monthly",
  "IOS",
);`}
      </CodeBlock>
      <p>
        Payload-inclusive catalog reads require <code>platform</code> and use
        opaque cursor pagination. <code>limit</code> defaults to 25 and accepts
        1-50; pass <code>nextCursor</code> back as <code>cursor</code> while
        <code>hasMore</code> is true. The service performs payload lookups only
        for products in that page. For backwards compatibility,{" "}
        <code>limit</code>
        and <code>cursor</code> are ignored on the default non-payload catalog
        path. If catalog changes invalidate a cursor, IAPKit returns
        <code>400 INVALID_CURSOR</code>; restart from the first page without a
        cursor.
      </p>
      <p>
        To fetch one known product without downloading the full catalog, use:
      </p>
      <CodeBlock title="Fetch one product payload" language="bash">
        {`curl "https://kit.openiap.dev/v1/products/<project-api-key>/premium_monthly/client-payload?platform=IOS"`}
      </CodeBlock>
      <p>
        The direct endpoint returns <code>{`{ clientPayload: { ... } }`}</code>{" "}
        or <code>404</code> when the matching product is missing, Removed, or
        has no payload. Catalog reads omit <code>clientPayload</code> unless{" "}
        <code>includeClientPayload=true</code> is present, preserving the
        existing response for current clients.
      </p>
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

      <h2 className="mt-10 text-2xl font-semibold">
        Return a payload after verification
      </h2>
      <p>
        Apple and Google verification requests may send{" "}
        <code>includeClientPayload: true</code>. IAPKit attaches the payload
        only when the receipt is valid, the store supplies a verified product
        ID, and that exact platform/product is present, not Removed, and has a
        payload.
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
        Default requests, invalid receipts, missing or Removed catalog products,
        missing payloads, and Horizon or Amazon verification responses omit the
        field. Always make entitlement decisions from <code>isValid</code>, the
        purchase <code>state</code>, and the store-verified{" "}
        <code>productId</code>, require that ID to match the product your app
        expected, and never fall back to a client-supplied ID when the verified
        value is missing.
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
      </ul>
      <p>
        The separate 64 KiB product-management limit is the maximum size of an
        entire HTTP request before JSON parsing. It is not per-product custom
        storage. See{" "}
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
