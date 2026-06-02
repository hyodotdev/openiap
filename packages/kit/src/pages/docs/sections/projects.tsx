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
        owns one or more <strong>API keys</strong> that your app uses to
        authenticate against <code>/v1/purchase/verify</code>.
      </p>
      <pre className="my-4 overflow-x-auto rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs leading-relaxed">
        <code>{`Organization (members, usage)
  └── Project (one mobile app)
        ├── Store credentials (Apple, Google, Horizon)
        └── API keys ── used by your app
`}</code>
      </pre>
      <p>
        The split matters because quotas and plan limits are{" "}
        <em>per organization</em>, not per project — so a single Pro plan covers
        all apps you manage under the same organization.
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
      <p>Each project's Settings tab has three configuration cards:</p>
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
          — Google Play service account JSON + optional Meta Horizon
          credentials.
        </li>
      </ul>
      <p>
        Credentials are scoped to the project, so a rotated .p8 or service
        account in one project doesn't affect another.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">API keys</h2>
      <p>
        When a project is created, IAPKit issues a default production key named{" "}
        <em>Default Production Key</em>. You can issue additional keys on the{" "}
        <strong>API Keys</strong> tab for rotation, separate app builds, CI, or
        staging callers.
      </p>
      <p>
        Extra keys are not separate environments. Every key on the same project
        reads and writes the same purchase log, subscription state, user
        bindings, and entitlement results. If staging and production need
        isolated state, create separate projects and use the matching project
        keys consistently from each app for verify, webhooks, bind-user, status,
        and entitlement calls.
      </p>
      <DocsScreenshot
        src="/docs/screenshots/api-keys.webp"
        alt="API Keys tab"
        caption="Each row shows last-used timestamp and total call count, so stale keys stand out before you revoke."
      />

      <p>All keys are:</p>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          Sent as a bearer token for <code>/v1/purchase/verify</code>, e.g.{" "}
          <code>Authorization: Bearer openiap-kit_&lt;your-key&gt;</code> on
          purchase verification requests.
        </li>
        <li>
          Used as a path segment by webhook, subscription, product, and SDK
          helper endpoints that need to work without custom bearer-header
          plumbing.
        </li>
        <li>
          Hashed before logging — the server only retains the SHA-256 prefix in
          structured logs, never the plaintext.
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
  -H "Authorization: Bearer openiap-kit_<your-key>" \\
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
