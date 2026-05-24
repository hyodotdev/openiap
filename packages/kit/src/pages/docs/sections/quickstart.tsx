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
        Sign in with GitHub or email OTP on{" "}
        <a
          href="https://kit.openiap.dev"
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          kit.openiap.dev
        </a>
        . Your first organization is created for you; you'll choose a plan
        (Developer is free and gives you 250 verifications / month).
      </p>
      <DocsScreenshot
        src="/docs/screenshots/signup.webp"
        alt="IAPKit sign-in page"
        caption="Sign in with GitHub or email OTP. New accounts land in the onboarding flow."
      />

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
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">4. Issue an API key</h2>
      <p>
        The <strong>API Keys</strong> tab lists the project's keys. A default
        production key is auto-created and shown once when the project is
        created; you can rotate it or add separate keys for app builds, CI, and
        staging.
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
      <DocsScreenshot
        src="/docs/screenshots/api-keys.webp"
        alt="API Keys tab"
        caption="Issued keys start with openiap-kit_. Anyone holding one can call project-scoped endpoints against your quota and subscription state."
      />

      <Callout kind="warning" title="Project keys are production-sensitive">
        <p>
          The project key lets your app call IAPKit's managed validation service
          directly. Do not commit it to a public repo or log it. Assume embedded
          keys can be extracted and use separate keys for each app build or
          environment so you can rotate one from the dashboard if it leaks or is
          abused. If your own backend calls IAPKit instead of the app calling
          directly, keep that server-side copy in a secret manager.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">
        5. Verify your first receipt
      </h2>
      <p>
        From your app, send the receipt to IAPKit. Here's the raw HTTP shape for
        each of the three stores:
      </p>

      <CodeBlock title="Apple App Store" language="bash">
        {`curl -X POST https://kit.openiap.dev/v1/purchase/verify \\
  -H "Authorization: Bearer openiap-kit_<your-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "store": "apple",
    "jws": "eyJhbGciOi...",
    "expectedProductId": "premium_monthly"
  }'`}
      </CodeBlock>

      <CodeBlock title="Google Play" language="bash">
        {`curl -X POST https://kit.openiap.dev/v1/purchase/verify \\
  -H "Authorization: Bearer openiap-kit_<your-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "store": "google",
    "purchaseToken": "ljhjpg...",
    "expectedProductId": "premium_monthly"
  }'`}
      </CodeBlock>

      <CodeBlock title="Meta Horizon (Quest)" language="bash">
        {`curl -X POST https://kit.openiap.dev/v1/purchase/verify \\
  -H "Authorization: Bearer openiap-kit_<your-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "store": "horizon",
    "userId": "1234567890",
    "sku": "coin_pack_100"
  }'`}
      </CodeBlock>

      <CodeBlock title="Amazon Appstore" language="bash">
        {`curl -X POST https://kit.openiap.dev/v1/purchase/verify \\
  -H "Authorization: Bearer openiap-kit_<your-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "store": "amazon",
    "userId": "amzn1.account.ABC123",
    "receiptId": "amzn1.receipt.ABC123456789",
    "sandbox": true
  }'`}
      </CodeBlock>

      <p>Expected response:</p>
      <CodeBlock title="200 OK" language="json">
        {`{
  "isValid": true,
  "state": "ENTITLED",
  "productId": "premium_monthly"
}`}
      </CodeBlock>

      <p>
        <code>isValid</code> is the short-circuit answer your app can unlock
        content on; <code>state</code> is the harmonized lifecycle position if
        you need more granularity, and <code>productId</code> is the product id
        verified by the store. See the{" "}
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
    </DocsPage>
  );
}
