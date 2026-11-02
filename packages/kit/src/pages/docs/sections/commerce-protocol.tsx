import HTTP_BINDING from "@hyodotdev/openiap-commerce-protocol/generated/bindings/http-binding.json";
import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";

const BASE_URL = "https://kit.openiap.dev";

// Which IAPKit key carries each protocol role (server/api/commerce/routes.ts).
const KEY_FOR_ROLE: Record<string, string> = {
  none: "No key",
  verification: "Publishable or secret key",
  server: "Secret key",
};

export default function CommerceProtocolPage() {
  return (
    <DocsPage
      slug="commerce-protocol"
      title="Commerce Protocol endpoint"
      description="IAPKit serves the OpenIAP Commerce Protocol, so a backend written against the protocol works with IAPKit and with any other conforming provider."
    >
      <p>
        IAPKit implements the{" "}
        <a
          href="https://openiap.dev/commerce-protocol"
          className="text-primary underline"
        >
          OpenIAP Commerce Protocol
        </a>
        . A backend that calls the protocol works with IAPKit and with other
        conforming providers. A provider that serves the same profiles,
        bindings, and stores (compare capability descriptors) takes only a new
        base URL and credential; moving existing purchase history is separate
        work.
      </p>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          Base URL: <code>{BASE_URL}</code>. REST paths start at{" "}
          <code>/commerce/v1</code>; the GraphQL binding is{" "}
          <code>POST /commerce/v1/graphql</code>.
        </li>
        <li>
          Credentials: your project&apos;s API keys, sent as{" "}
          <code>Authorization: Bearer</code>. A publishable key has the
          protocol&apos;s verification role; a secret key has the server role.
        </li>
        <li>
          What IAPKit supports per store is in its live capability descriptor:{" "}
          <a
            href={`${BASE_URL}/commerce/v1/capabilities`}
            className="text-primary underline"
          >
            <code>GET /commerce/v1/capabilities</code>
          </a>
          .
        </li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">Operations</h2>
      <div className="my-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-3 py-2">Operation</th>
              <th className="px-3 py-2">Request</th>
              <th className="px-3 py-2">Key</th>
            </tr>
          </thead>
          <tbody>
            {HTTP_BINDING.operations.map((operation) => (
              <tr key={operation.name} className="border-b border-border">
                <td className="px-3 py-2">
                  <code>{operation.name}</code>
                </td>
                <td className="px-3 py-2">
                  <code>
                    {operation.method} {operation.path}
                  </code>
                </td>
                <td className="px-3 py-2">
                  {KEY_FOR_ROLE[operation.auth] ?? operation.auth}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Request and result fields are in the protocol&apos;s{" "}
        <a
          href="https://openiap.dev/commerce-protocol/operations"
          className="text-primary underline"
        >
          operation reference
        </a>
        .
      </p>

      <CodeBlock title="Verify a Google Play purchase" language="bash">
        {`curl -X POST ${BASE_URL}/commerce/v1/purchases/verify \\
  -H "Authorization: Bearer openiap-kit_pk_<your-publishable-key>" \\
  -H "Content-Type: application/json" \\
  -d '{ "store": "google", "google": { "purchaseToken": "<purchaseToken>" } }'`}
      </CodeBlock>

      <h2 className="mt-10 text-2xl font-semibold">
        Protocol endpoint or IAPKit&apos;s own API
      </h2>
      <p>
        Both run on the same project, keys, and purchase records. Pick by what
        you need:
      </p>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <strong>Protocol endpoint</strong> for a backend you may move to
          another provider, and to link Amazon and Meta Horizon purchases to
          your users: <code>bindPurchase</code> accepts their receipts, which{" "}
          <code>/v1/subscriptions/bind-user</code> cannot resolve.
        </li>
        <li>
          <strong>
            IAPKit&apos;s{" "}
            <Link to="/docs/api" className="text-primary underline">
              REST API
            </Link>
          </strong>{" "}
          for IAPKit-only features: product client payloads, queued verification
          jobs, and the calls the OpenIAP SDKs make for you (
          <code>confirmWithIapkit</code> and{" "}
          <code>verifyPurchaseWithProvider</code> call <code>/v1</code>).
        </li>
      </ul>

      <Callout kind="note" title="Limits are shared">
        <p>
          Protocol calls share the same rate-limit budget as <code>/v1</code>:
          per key, per IP, and per server. See{" "}
          <Link to="/docs/operations" className="text-primary underline">
            Operations
          </Link>
          .
        </p>
      </Callout>
    </DocsPage>
  );
}
