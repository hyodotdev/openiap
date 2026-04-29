import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";
import { DocsScreenshot } from "../components/DocsScreenshot";

export default function VerificationGooglePage() {
  return (
    <DocsPage
      slug="verification/google"
      title="Google Play setup"
      description="Configure Android Publisher API verification with a Google service account."
    >
      <p>
        Google Play verification uses the Android Publisher API v3. IAPKit
        authenticates with a Google Cloud service account you create once and
        grant narrow permissions to in Google Play Console. The client only
        forwards the opaque <code>purchaseToken</code> from Play Billing — the
        server resolves product vs. subscription automatically using v2
        endpoints.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">What you'll need</h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <strong>Android package name</strong> — the app's package (e.g.{" "}
          <code>com.example.app</code>).
        </li>
        <li>
          <strong>Service account JSON</strong> — created in Google Cloud
          Console, invited into Google Play Console with read-only permissions
          on financial data + order management.
        </li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">Steps</h2>
      <ol className="my-3 list-decimal space-y-2 pl-6">
        <li>
          In the Google Cloud Console for your project, go to{" "}
          <strong>Service Accounts</strong> and click{" "}
          <strong>Create service account</strong>. Name it something like{" "}
          <code>iapkit-verify</code>.
        </li>
        <li>
          Open the new account → <strong>Keys</strong> →{" "}
          <strong>Add key → Create new key → JSON</strong>. Google gives you a
          .json file exactly once. Save it.
        </li>
        <li>
          In the Google Play Console, go to{" "}
          <strong>Users & permissions → Invite new users</strong>. Paste the
          service account's email (it's in the JSON). Grant these app-scoped
          permissions:
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <em>
                View financial data, orders, and cancellation survey responses
              </em>
            </li>
            <li>
              <em>Manage orders and subscriptions</em>
            </li>
          </ul>
        </li>
        <li>
          Click <strong>Invite user</strong>.
        </li>
        <li>
          Back in IAPKit, open your project's <strong>Settings</strong> tab,
          enter the Android package name, and upload the service account JSON.
        </li>
      </ol>

      <h3 className="mt-8 text-lg font-semibold">Visual walkthrough</h3>
      <DocsScreenshot
        src="/guides/%5BAndroid%5D%201.%20Create%20JSON%20Key.png"
        alt="Google Cloud Console — create JSON key for service account"
        caption="1. In the service account's Keys tab, click Add key → Create new key → JSON. Save the file — Google won't let you download it again."
      />
      <DocsScreenshot
        src="/guides/%5BAndroid%5D%203.%20Invite%20Service%20Account.png"
        alt="Google Play Console — invite the service account"
        caption="2. In Google Play Console → Users & permissions, click Invite new users and paste the service account's email (it's in the JSON, under client_email)."
      />
      <DocsScreenshot
        src="/guides/%5BAndroid%5D%202.%20Add%20Permission%20when%20inviting%20service%20account.png"
        alt="Grant least-privilege permissions to the service account"
        caption="3. Grant View financial data, orders, and cancellation survey responses + Manage orders and subscriptions. Nothing else — IAPKit never needs release-management permissions."
      />

      <DocsScreenshot
        src="/docs/screenshots/android-config.png"
        alt="Android Configuration card"
        caption="The service account file's name and size confirm it was uploaded. Delete the row to replace it."
      />

      <Callout kind="warning" title="Least-privilege service accounts">
        <p>
          The two permissions listed above are the minimum for receipt
          verification. Do not grant the service account <em>admin</em> or
          release-management permissions — they aren't needed, and keeping the
          blast radius small is cheap insurance against the JSON leaking.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Verify call</h2>
      <CodeBlock title="POST /v1/purchase/verify" language="bash">
        {`curl -X POST https://kit.openiap.dev/v1/purchase/verify \\
  -H "Authorization: Bearer openiap-kit_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "store": "google",
    "purchaseToken": "ljhjpg..."
  }'`}
      </CodeBlock>

      <p>
        IAPKit first calls{" "}
        <code>purchases.productsv2.getproductpurchasev2</code>. On a 404 ("not a
        product purchase") it falls through to{" "}
        <code>purchases.subscriptionsv2.get</code>. Either way your client just
        sends the opaque token — there's no need to tell IAPKit whether it's a
        one-shot or a subscription.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Transient retries</h2>
      <p>
        Both v2 calls are wrapped in a 3-attempt exponential-backoff retry
        (200ms base, 2s cap, full jitter). The retry fires on HTTP 5xx and Node
        network errors (<code>ECONNRESET</code>, <code>ETIMEDOUT</code>,{" "}
        <code>EAI_AGAIN</code>, …). 4xx responses — including 404 ("not a
        product") and 410 ("token no longer valid") — are <strong>not</strong>{" "}
        retried because re-issuing the call won't help and would only waste
        quota.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Error codes</h2>
      <div className="my-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Code</th>
              <th className="px-3 py-2 text-left font-medium">Cause</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                PLAY_STORE_SERVICE_ACCOUNT_NOT_FOUND
              </td>
              <td className="px-3 py-2">
                No service account JSON is uploaded for this project.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                PLAY_STORE_PURCHASE_NOT_FOUND
              </td>
              <td className="px-3 py-2">
                Token doesn't resolve to a product or subscription — usually a
                replay or a subscription purged after 60 days of inactivity.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                PLAY_STORE_PURCHASE_VERIFICATION_FAILED
              </td>
              <td className="px-3 py-2">
                Auth failure, permission mismatch, or Google returned a shape
                IAPKit couldn't interpret.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                INVALID_SERVICE_ACCOUNT_KEY_FORMAT
              </td>
              <td className="px-3 py-2">
                Uploaded JSON is malformed or missing required fields.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DocsPage>
  );
}
