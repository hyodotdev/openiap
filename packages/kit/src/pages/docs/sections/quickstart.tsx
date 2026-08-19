import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";
import { DocsScreenshot } from "../components/DocsScreenshot";

export default function QuickstartPage() {
  return (
    <DocsPage
      slug="quickstart"
      title="Quickstart"
      description="From signup to your first verified purchase in five minutes."
    >
      <h2 className="mt-8 text-2xl font-semibold">1. Create your account</h2>
      <p>
        Sign in with GitHub on{" "}
        <a
          href="https://kit.openiap.dev"
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          kit.openiap.dev
        </a>
        . New accounts are created through GitHub. Accounts created before April
        2026 can still sign in with an email one-time code until{" "}
        <strong>2026-09-30 (UTC)</strong>; after that IAPKit supports GitHub
        sign-in only. Signing in with GitHub using the same email address
        carries an existing account over. The onboarding flow asks you to name
        your first organization before opening its dashboard. The hosted service
        is free under fair-use safeguards on shared community infrastructure; no
        plan or credit card is required.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">2. Create a project</h2>
      <p>
        Projects group a single mobile app's configuration: its iOS bundle id,
        Android package name, the store credentials, and the API keys your app
        will authenticate with.
      </p>
      <DocsScreenshot
        src="/docs/screenshots/project-new.webp"
        alt="Create project dialog"
        caption="The Projects tab in each organization holds one row per app. Each row has its own API keys, store credentials, and purchase log."
      />

      <h2 className="mt-10 text-2xl font-semibold">3. Configure your stores</h2>
      <p>
        Open <strong>Settings</strong> on your new project:
      </p>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <Link
            to="/docs/verification/apple"
            className="text-primary underline"
          >
            Apple
          </Link>{" "}
          — bundle id, App Apple ID, App Store Connect Issuer ID + Key ID, .p8
          upload.
        </li>
        <li>
          <Link
            to="/docs/verification/google"
            className="text-primary underline"
          >
            Google
          </Link>{" "}
          — Android package name + Google service account JSON.
        </li>
        <li>
          <Link
            to="/docs/verification/horizon"
            className="text-primary underline"
          >
            Meta Horizon
          </Link>{" "}
          — App ID + App Secret (inside the Android card).
        </li>
        <li>
          <Link
            to="/docs/verification/amazon"
            className="text-primary underline"
          >
            Amazon Appstore
          </Link>{" "}
          — RVS shared secret for production, or explicit App Tester / Cloud
          Sandbox opt-in (inside the Android card).
        </li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">4. Issue an API key</h2>
      <p>
        The <strong>API Keys</strong> tab lists the project&apos;s keys. A
        default <code>openiap-kit_pk_</code> publishable key is auto-created and
        shown once when the project is created. Use it in the mobile app for
        verification and client-safe reads.
      </p>
      <p>
        Create a separate <code>openiap-kit_sk_</code> secret key for MCP, CI,
        catalog or payload writes, analytics, and store sync. Keep secret keys
        in a secret manager and never include one in an app build.
      </p>
      <p>
        Keys are credentials for the same project, not separate entitlement
        environments. For isolated staging and production state, create separate
        projects and keep each app on a key from the matching project.
      </p>
      <p>
        Use keys from the same project when verifying a purchase and when
        binding or checking subscription status. <code>bind-user</code>,{" "}
        <code>status</code>, and <code>entitlements</code> look up subscription
        state inside the key's project; state from another project will not be
        found.
      </p>
      <p>
        When clients call status or entitlements directly, use opaque app-scoped
        user IDs rather than public identifiers like email addresses.
      </p>
      <p>
        IAPKit does not stream store events back to apps. Cache the latest
        user-scoped status or entitlement response and conditionally refresh it
        on cold start, when it is stale after foregrounding, or after an
        explicit user action. Coalesce concurrent refreshes through one
        coordinator. Send its <code>ETag</code> as <code>If-None-Match</code>;{" "}
        <code>304</code> reuses the cached snapshot, while <code>200</code>{" "}
        replaces it. Define a maximum stale age for offline fallback and avoid
        continuous polling.
      </p>
      <Callout kind="warning" title="Publishable does not mean private">
        <p>
          A publishable key lets your app call IAPKit&apos;s restricted managed
          validation surface directly, but it can still be extracted and used
          against shared rate and capacity limits. Avoid logging it, use
          separate keys for independent builds or environments, and rotate an
          abused key. Secret keys provide administrative access and must remain
          server-side.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">
        5. Verify your first receipt
      </h2>
      <p>
        From your app, send the receipt to IAPKit. Here's the raw HTTP shape for
        each supported store:
      </p>

      <CodeBlock title="Apple App Store" language="bash">
        {`curl -X POST https://kit.openiap.dev/v1/purchase/verify \\
  -H "Authorization: Bearer openiap-kit_pk_<your-publishable-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "store": "apple",
    "jws": "eyJhbGciOi...",
    "expectedProductId": "premium_monthly"
  }'`}
      </CodeBlock>

      <CodeBlock title="Google Play" language="bash">
        {`curl -X POST https://kit.openiap.dev/v1/purchase/verify \\
  -H "Authorization: Bearer openiap-kit_pk_<your-publishable-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "store": "google",
    "purchaseToken": "ljhjpg...",
    "expectedProductId": "premium_monthly"
  }'`}
      </CodeBlock>

      <CodeBlock title="Meta Horizon (Quest)" language="bash">
        {`curl -X POST https://kit.openiap.dev/v1/purchase/verify \\
  -H "Authorization: Bearer openiap-kit_pk_<your-publishable-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "store": "horizon",
    "userId": "1234567890",
    "sku": "coin_pack_100"
  }'`}
      </CodeBlock>

      <CodeBlock title="Amazon Appstore" language="bash">
        {`curl -X POST https://kit.openiap.dev/v1/purchase/verify \\
  -H "Authorization: Bearer openiap-kit_pk_<your-publishable-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "store": "amazon",
    "userId": "amzn1.account.ABC123",
    "receiptId": "amzn1.receipt.ABC123456789",
    "sandbox": true,
    "expectedProductId": "premium_monthly"
  }'`}
      </CodeBlock>

      <p>
        Sandbox requests are rejected until you explicitly enable Amazon App
        Tester / RVS Cloud Sandbox in project settings. Leave{" "}
        <code>sandbox</code> unset for production, which requires the stored
        Amazon RVS shared secret.
      </p>

      <p>
        React Native IAP and Expo IAP ship a <code>kitApi</code> helper so you
        do not have to build these requests by hand — see the sample on{" "}
        <Link to="/docs/products" className="text-primary underline">
          Products
        </Link>{" "}
        and the SDK matrix on{" "}
        <Link to="/docs/compatibility" className="text-primary underline">
          Compatibility
        </Link>
        .
      </p>

      <p>Expected response:</p>
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
        Never unlock or deliver from <code>isValid</code> alone. Also require an
        exact match with the store-verified <code>productId</code>, then use the
        platform and your app-owned product type to select the allowed{" "}
        <code>state</code> and finish path. See the{" "}
        <Link to="/docs/api" className="text-primary underline">
          API reference
        </Link>{" "}
        for every state and error code.
      </p>

      <Callout kind="tip" title="Seeing the call in the dashboard">
        <p>
          Head back to your project's <strong>Purchases</strong> tab. Your test
          verification shows up with the store, state, and verification latency.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">
        Optional: return app-readable product rules
      </h2>
      <p>
        In the project&apos;s <strong>Products</strong> tab, attach a public
        TOML, JSON, or text <code>clientPayload</code> to a synced Apple or
        Google product. Then add <code>includeClientPayload: true</code> to that
        store&apos;s verification request. A valid response may include the
        payload as a top-level sibling of <code>productId</code> when the
        matching visible product has one. Payload omission does not invalidate
        verification, and existing requests stay unchanged.
      </p>
      <p>
        Payloads are retrieved when your app calls IAPKit—they are not APNs or
        FCM notifications—and must never contain secrets. See{" "}
        <Link to="/docs/products" className="text-primary underline">
          Products & client payloads
        </Link>{" "}
        for editor, catalog-fetch, caching, and validation details.
      </p>
    </DocsPage>
  );
}
