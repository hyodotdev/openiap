import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";

export default function VerificationAmazonPage() {
  return (
    <DocsPage
      slug="verification/amazon"
      title="Amazon Appstore setup"
      description="Verify Fire OS and Vega OS purchases with Amazon RVS while keeping the production shared secret server-side."
    >
      <p>
        IAPKit verifies Amazon Appstore receipts through the Receipt
        Verification Service (RVS). Your app sends the Amazon{" "}
        <code>userId</code> (required) and <code>receiptId</code>; IAPKit
        selects the RVS environment and supplies the project&apos;s credential
        without exposing it to the app.
      </p>

      <Callout kind="note" title="Inside the Android Configuration card">
        <p>
          Amazon settings live beside Google Play and Meta Horizon because Fire
          OS apps use the Android project surface. Google Play configuration is
          not required for an Amazon-only project. Vega OS apps send the same
          userId / receiptId payload to the same endpoint and need no separate
          configuration.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Production setup</h2>
      <ol className="my-3 list-decimal space-y-2 pl-6">
        <li>
          Get the RVS shared secret for your app by following the{" "}
          <a
            href="https://developer.amazon.com/docs/in-app-purchasing/iap-rvs-for-android-apps.html"
            className="text-primary underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Amazon RVS documentation
          </a>
          .
        </li>
        <li>
          Open the IAPKit project&apos;s <strong>Settings</strong> tab and
          scroll to <strong>Android Configuration</strong>.
        </li>
        <li>
          Paste the value into <strong>Amazon RVS Shared Secret</strong>, then
          select <strong>Save Amazon config</strong>.
        </li>
      </ol>
      <p>
        The secret is write-only. After saving, the dashboard shows that it is
        configured but never returns the plaintext value. Use Replace to rotate
        it or Remove to disable production Amazon verification.
      </p>

      <Callout kind="warning" title="Sandbox must be enabled explicitly">
        <p>
          Amazon RVS Cloud Sandbox accepts any non-empty secret, so a sandbox
          response is not production evidence. Enable{" "}
          <strong>Allow Amazon App Tester / RVS Cloud Sandbox</strong> only
          while testing App Tester receipts. IAPKit uses its own placeholder for
          those calls and never sends the production shared secret to the
          sandbox URL.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Verify a receipt</h2>
      <CodeBlock title="POST /v1/purchase/verify" language="bash">
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
        Omit <code>sandbox</code> for production. <code>userId</code> is capped
        at 512 characters, <code>receiptId</code> at 4 KiB, and the optional{" "}
        <code>expectedProductId</code> at 256 characters.
      </p>
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
        Grant access only after checking <code>isValid</code> and matching the
        store-verified <code>productId</code>. An <code>expectedProductId</code>{" "}
        mismatch returns <code>INAUTHENTIC</code> without overwriting the
        persisted RVS verdict. See the{" "}
        <Link to="/docs/api" className="text-primary underline">
          API reference
        </Link>{" "}
        for the shared response and error envelope.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Background rechecks</h2>
      <p>
        A valid Amazon purchase becomes due for another RVS check after 48
        hours. The worker claims at most 20 rows every five minutes, starts at
        most five requests per second, and gives each row one 10-second attempt.
        Backlog and retries can extend the interval, so 48 hours is a scheduling
        cadence rather than a completion guarantee.
      </p>
      <p>
        A non-null Amazon <code>cancelDate</code> removes access. A past{" "}
        <code>renewalDate</code> alone is not treated as expiry. Rechecks update
        purchase snapshots only; IAPKit does not create Amazon subscription rows
        or claim webhook-style Amazon lifecycle delivery.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Amazon error codes</h2>
      <div className="my-4 overflow-x-auto rounded-lg border border-border">
        <table className="min-w-[42rem] w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Code</th>
              <th className="px-3 py-2 text-left font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                AMAZON_SHARED_SECRET_NOT_CONFIGURED
              </td>
              <td className="px-3 py-2">
                Save the production RVS shared secret in project settings.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                AMAZON_SANDBOX_NOT_ENABLED
              </td>
              <td className="px-3 py-2">
                Enable the explicit App Tester sandbox option for this project.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                AMAZON_RECEIPT_INVALID
              </td>
              <td className="px-3 py-2">
                Treat the store verdict as invalid or canceled; do not retry as
                a transient failure.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                AMAZON_RECEIPT_VERIFICATION_ERROR
              </td>
              <td className="px-3 py-2">
                Check credentials and RVS availability, then retry with bounded
                backoff.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DocsPage>
  );
}
