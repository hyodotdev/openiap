import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";
import { DocsScreenshot } from "../components/DocsScreenshot";

export default function VerificationApplePage() {
  return (
    <DocsPage
      slug="verification/apple"
      title="Apple App Store setup"
      description="Configure StoreKit 2 JWS verification with App Store Server API."
    >
      <p>
        Apple verification uses a signed JWS transaction produced by StoreKit 2
        on the device. IAPKit verifies the signature against Apple's root CA,
        then calls the App Store Server API with your project's <code>.p8</code>{" "}
        key to pull the transaction's current state (refund, revocation, grace
        period). Both steps are required to catch refunds issued after the
        purchase.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">What you'll need</h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <strong>Bundle ID</strong> — the app's bundle identifier (e.g.{" "}
          <code>com.example.app</code>). Found in App Store Connect → App
          Information.
        </li>
        <li>
          <strong>App Apple ID</strong> — the numeric ID Apple assigns to the
          app (e.g. <code>1234567890</code>). Required for production
          environment verifications.
        </li>
        <li>
          <strong>Issuer ID</strong> — a UUID found in App Store Connect → Users
          and Access → Integrations → App Store Connect API.
        </li>
        <li>
          <strong>Key ID</strong> — a 10-character uppercase alphanumeric id,
          shown next to your generated In-App Purchase key.
        </li>
        <li>
          <strong>.p8 private key file</strong> — downloaded once when the key
          is created. Apple never lets you re-download it; store it somewhere
          safe before uploading to IAPKit.
        </li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">Steps</h2>
      <ol className="my-3 list-decimal space-y-2 pl-6">
        <li>
          In App Store Connect go to{" "}
          <strong>Users and Access → Integrations → In-App Purchase</strong>.
        </li>
        <li>
          Click <strong>Generate In-App Purchase Key</strong> (or the{" "}
          <strong>+</strong> button). Give the key a descriptive name — it can't
          be renamed later.
        </li>
        <li>Download the .p8 file. You can only download it once.</li>
        <li>
          Back in IAPKit, open your project's <strong>Settings</strong> tab,
          fill in Bundle ID / App Apple ID / Issuer ID / Key ID, then upload the
          .p8 file.
        </li>
      </ol>

      <h3 className="mt-8 text-lg font-semibold">Visual walkthrough</h3>
      <DocsScreenshot
        src="/guides/%5BIOS%5D%201.%20In-App%20Purchase%20Key.webp"
        alt="App Store Connect — Users and Access → Integrations → In-App Purchase"
        caption="1. In App Store Connect: Users and Access → Integrations → In-App Purchase. Keys created here are scoped specifically to in-app purchase verification."
      />
      <DocsScreenshot
        src="/guides/%5BIOS%5D%202.%20Download%20In-App%20Purchase%20Key.webp"
        alt="Download the newly generated .p8 key"
        caption="2. Generate the key, give it a descriptive name, then download the .p8. Apple only lets you download once — if you lose the file, revoke the key and generate a new one."
      />

      <DocsScreenshot
        src="/docs/screenshots/ios-config.webp"
        alt="iOS Configuration card"
        caption="The iOS Configuration card shows the .p8 file status — filename and size once uploaded, an upload dropzone when empty."
      />

      <Callout kind="tip" title="Sandbox vs. production">
        <p>
          IAPKit reads the JWS <code>environment</code> field off the decoded
          payload, so the same project can verify both sandbox and production
          receipts without a toggle. Just make sure the App Apple ID is set
          before you go to production — the JWS signature is bound to it for
          production-environment receipts.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Verify call</h2>
      <CodeBlock title="POST /v1/purchase/verify" language="bash">
        {`curl -X POST https://kit.openiap.dev/v1/purchase/verify \\
  -H "Authorization: Bearer openiap-kit_<your-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "store": "apple",
    "jws": "eyJhbGciOi..."
  }'`}
      </CodeBlock>

      <p>
        The <code>jws</code> field accepts up to 16 KB — Apple's real payloads
        run ~1–2 KB, so the cap is room-to-grow, not a tight bound.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">How refunds are detected</h2>
      <p>
        After verifying the JWS signature, IAPKit calls the App Store Server
        API's <code>getTransactionInfo</code> endpoint to fetch the current
        state of that transaction — signature-valid means "the purchase once
        happened"; <code>getTransactionInfo</code> tells you if it's still valid
        right now. No extra flag on the request is required.
      </p>

      <p>For an active transaction, the decoded JWS payload looks like:</p>
      <CodeBlock
        title="Active transaction (decoded JWSTransaction)"
        language="json"
      >
        {`{
  "transactionId": "2000000123456789",
  "originalTransactionId": "2000000123456789",
  "bundleId": "dev.openiap.testapp",
  "productId": "premium_monthly",
  "purchaseDate": 1724659200000,
  "type": "Auto-Renewable Subscription",
  "environment": "Production"
  // no revocationDate / revocationReason present
}`}
      </CodeBlock>

      <p>
        After a refund or revocation, the same endpoint returns the same
        transaction with extra fields:
      </p>
      <CodeBlock title="Refunded transaction" language="json">
        {`{
  "transactionId": "2000000123456789",
  "originalTransactionId": "2000000123456789",
  "bundleId": "dev.openiap.testapp",
  "productId": "premium_monthly",
  "purchaseDate": 1724659200000,
  "type": "Auto-Renewable Subscription",
  "environment": "Production",
  "revocationDate": 1724832000000,   // ← refund / revoke timestamp (ms)
  "revocationReason": 1              // ← Apple's enum; any non-undefined value here means "no longer valid"
}`}
      </CodeBlock>

      <p>
        IAPKit's harmonized state mapping for the Apple path therefore looks
        like:
      </p>
      <CodeBlock title="convex/purchases/shared.ts (excerpt)" language="ts">
        {`// Any non-undefined revocationDate → CANCELED, regardless of
// revocationReason value. isValid follows from the state (only
// ENTITLED / PENDING_ACKNOWLEDGMENT / READY_TO_CONSUME count as
// valid).
if (revocationDate !== undefined) {
  return HarmonizedPurchaseState.CANCELED;
}`}
      </CodeBlock>

      <p>
        The response you get back from <code>/v1/purchase/verify</code> then
        reflects the revoked state immediately — no client-side polling or
        webhook wiring required:
      </p>
      <CodeBlock
        title="POST /v1/purchase/verify — refunded response"
        language="json"
      >
        {`{
  "isValid": false,
  "state": "CANCELED"
}`}
      </CodeBlock>

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
                APP_STORE_INVALID_JWS_FORMAT
              </td>
              <td className="px-3 py-2">
                JWS is malformed or the payload couldn't be decoded.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                APP_STORE_BUNDLE_ID_MISMATCH
              </td>
              <td className="px-3 py-2">
                The JWS bundle id doesn't match the project's configured bundle
                id.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                APP_STORE_SERVER_CREDENTIALS_MISSING
              </td>
              <td className="px-3 py-2">
                One or more of issuer id, key id, or .p8 file is not configured.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                APP_STORE_TRANSACTION_VERIFICATION_FAILED
              </td>
              <td className="px-3 py-2">
                Signature verification failed or the Server API returned an
                error.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DocsPage>
  );
}
