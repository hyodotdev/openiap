import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";
import { DocsScreenshot } from "../components/DocsScreenshot";

export default function ProjectsPage() {
  return (
    <DocsPage
      slug="projects"
      title="Projects & API keys"
      description="How organizations, projects, and API keys fit together."
    >
      <h2 className="mt-8 text-2xl font-semibold">Hierarchy</h2>
      <p>
        An <strong>organization</strong> groups team members and usage data.
        Inside it, every distinct app is a <strong>project</strong>: bundle id,
        package name, store credentials, and its own purchase log. Each project
        owns one or more <strong>API keys</strong>: publishable keys for apps
        and secret keys for administrative automation.
      </p>
      <pre className="my-4 overflow-x-auto rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs leading-relaxed">
        <code>{`Organization (members, usage)
  └── Project (one mobile app)
        ├── Store credentials (Apple, Google, Horizon, Amazon)
        └── API keys
              ├── Publishable (mobile verification + client reads)
              └── Secret (MCP, CI, catalog writes + store sync)
`}</code>
      </pre>
      <p>
        Organization-level usage telemetry helps operators coordinate fair use
        across all apps. Projects remain the security and data boundary: each
        one has its own store credentials, keys, purchase history, and
        entitlement state.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Creating a project</h2>
      <p>
        From the organization dashboard, open the <strong>Projects</strong> tab
        and click <strong>New project</strong>. You supply a display name and
        pick the client platform (React Native, Flutter, Kotlin Multiplatform,
        native iOS / Android, web, …). The platform tag is informational — it
        drives which setup guides the dashboard highlights; it doesn't affect
        the verify API itself.
      </p>
      <DocsScreenshot
        src="/docs/screenshots/project-create.webp"
        alt="New project dialog"
        caption="Slugs are generated from the project name and have to be unique within the organization. They appear in dashboard URLs (/:orgSlug/project/:projectSlug) and in log lines."
      />

      <h2 className="mt-10 text-2xl font-semibold">Store credentials</h2>
      <p>Each project's Settings tab has two store configuration cards:</p>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <Link
            to="/docs/verification/apple"
            className="text-primary underline"
          >
            iOS Configuration
          </Link>{" "}
          — Apple identifiers + .p8 key file.
        </li>
        <li>
          <Link
            to="/docs/verification/google"
            className="text-primary underline"
          >
            Android Configuration
          </Link>{" "}
          — Google Play service account JSON, optional{" "}
          <Link
            to="/docs/verification/horizon"
            className="text-primary underline"
          >
            Meta Horizon
          </Link>{" "}
          credentials, and{" "}
          <Link
            to="/docs/verification/amazon"
            className="text-primary underline"
          >
            Amazon RVS
          </Link>{" "}
          settings.
        </li>
      </ul>
      <p>
        Credentials are scoped to the project, so a rotated .p8 or service
        account in one project doesn't affect another.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">API keys</h2>
      <p>
        When a project is created, IAPKit issues a default publishable key named{" "}
        <em>Default Production Key</em>. Publishable keys start with{" "}
        <code>openiap-kit_pk_</code> and may be embedded in a mobile app for
        purchase verification, user-scoped entitlement helpers, and public
        product or client-payload reads.
      </p>
      <p>
        Administrative automation uses a secret key beginning with{" "}
        <code>openiap-kit_sk_</code>. Create one from the{" "}
        <strong>API Keys</strong> tab before configuring MCP, CI, catalog
        writes, subscription analytics, or store sync. Never ship a secret key
        in an app.
      </p>
      <p>
        The full value is shown only when the project or key is created, or when
        a key is regenerated; after that the dashboard shows only a preview.
        Regeneration preserves the key type.
      </p>
      <p>
        Extra keys are not separate environments. Every key on the same project
        reads and writes the same purchase log, subscription state, user
        bindings, and entitlement results. If staging and production need
        isolated state, create separate projects and use the matching project
        keys consistently from each app for verify, webhooks, bind-user, status,
        and entitlement calls.
      </p>
      <div className="my-4 overflow-x-auto rounded-lg border border-border">
        <table className="min-w-[46rem] w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Key type</th>
              <th className="px-3 py-2 text-left font-medium">
                Where it lives
              </th>
              <th className="px-3 py-2 text-left font-medium">Allowed use</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <td className="px-3 py-2 font-mono text-xs">openiap-kit_pk_…</td>
              <td className="px-3 py-2">Mobile app or public client</td>
              <td className="px-3 py-2">
                Purchase verification, bind/status/entitlements, and public
                product or client-payload reads
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">openiap-kit_sk_…</td>
              <td className="px-3 py-2">Secret manager, CI, or MCP</td>
              <td className="px-3 py-2">
                Everything above plus catalog and payload writes, analytics, and
                store sync
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <DocsScreenshot
        src="/docs/screenshots/api-keys.webp"
        alt="IAPKit API Keys tab showing publishable and secret key types with masked previews"
        caption="The dashboard shows each key's scope and a safe preview. The full value appears only at creation or regeneration."
      />

      <Callout kind="note" title="Existing keys migrate safely">
        <p>
          Keys created before this split are treated as publishable because
          older documentation allowed them inside apps. Existing mobile builds
          keep verifying purchases, while administrative callers must switch to
          a newly created secret key.
        </p>
      </Callout>

      <p>All keys are:</p>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          Accepted as a bearer token for <code>/v1/purchase/verify</code>.
          Mobile apps should send a publishable key.
        </li>
        <li>
          Sent as a Bearer token for administrative endpoints. App-facing SDK
          helpers and inbound store webhooks retain publishable key path
          segments where their transport requires it. Never place a secret key
          in a URL.
        </li>
        <li>
          Hashed before logging — the server only retains the SHA-256 prefix in
          structured logs, never the plaintext.
        </li>
        <li>
          Regenerable if the one-time full value was missed or leaked. The old
          key stops working immediately after regeneration.
        </li>
        <li>
          Scoped to a single project — one key can't verify another project's
          receipts.
        </li>
      </ul>

      <Callout kind="warning" title="Rotation hygiene">
        <p>
          When rotating a key in production, add the new key first, cut traffic
          over, then revoke the old one — the rate-limit bucket is per key so a
          staggered cutover avoids forcing old and new callers through the same
          short-lived bucket.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Example request</h2>
      <CodeBlock title="/v1/purchase/verify" language="bash">
        {`curl -X POST https://kit.openiap.dev/v1/purchase/verify \\
  -H "Authorization: Bearer openiap-kit_pk_<your-publishable-key>" \\
  -H "Content-Type: application/json" \\
  -d '{ "store": "google", "purchaseToken": "..." }'`}
      </CodeBlock>

      <p>
        See the{" "}
        <Link to="/docs/api" className="text-primary underline">
          API reference
        </Link>{" "}
        for the full contract, or jump to{" "}
        <Link to="/docs/operations" className="text-primary underline">
          Operations
        </Link>{" "}
        for rate limits and correlation headers.
      </p>
    </DocsPage>
  );
}
