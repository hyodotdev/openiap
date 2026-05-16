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
        Android package name, the store credentials, and the API keys your
        backend will authenticate with.
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
        production key is auto-created; you can rotate it or add scoped keys for
        CI environments.
      </p>
      <DocsScreenshot
        src="/docs/screenshots/api-keys.webp"
        alt="API Keys tab"
        caption="Issued keys start with openiap-kit_. Store them as secrets — anyone with the key can hit /v1/purchase/verify against your project's quota."
      />

      <Callout kind="warning" title="API keys are production-sensitive">
        <p>
          Treat the key like a password. IAPKit request logs include only a hash
          prefix, but any backend that calls the API still needs the plaintext
          secret at request time. Put it in a secret manager, not in a
          Git-tracked config file.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">
        5. Verify your first receipt
      </h2>
      <p>
        From your backend, POST the receipt to IAPKit. Here's the shape for each
        of the three stores:
      </p>

      <CodeBlock title="Apple App Store" language="bash">
        {`curl -X POST https://kit.openiap.dev/v1/purchase/verify \\
  -H "Authorization: Bearer openiap-kit_<your-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "store": "apple",
    "jws": "eyJhbGciOi..."
  }'`}
      </CodeBlock>

      <CodeBlock title="Google Play" language="bash">
        {`curl -X POST https://kit.openiap.dev/v1/purchase/verify \\
  -H "Authorization: Bearer openiap-kit_<your-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "store": "google",
    "purchaseToken": "ljhjpg..."
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

      <p>Expected response:</p>
      <CodeBlock title="200 OK" language="json">
        {`{
  "isValid": true,
  "state": "ENTITLED"
}`}
      </CodeBlock>

      <p>
        <code>isValid</code> is the short-circuit answer you'll grant
        entitlements on; <code>state</code> is the harmonized lifecycle position
        if you need more granularity. See the{" "}
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
