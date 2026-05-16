import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";
import { DocsScreenshot } from "../components/DocsScreenshot";

export default function VerificationHorizonPage() {
  return (
    <DocsPage
      slug="verification/horizon"
      title="Meta Horizon setup"
      description="Verify Quest entitlements via Meta's Graph API — App Secret stays server-side."
    >
      <p>
        Meta Horizon (Quest / Meta VR) uses a billing SDK that's{" "}
        <em>source-compatible</em> with Google Play Billing, but server-side
        verification goes through the Meta Graph API, not Google. IAPKit holds
        your Meta <strong>App ID</strong> + <strong>App Secret</strong> per
        project and composes the <code>OC|APP_ID|APP_SECRET</code> access token
        per request, so the Quest device never carries a credential.
      </p>

      <Callout kind="note" title="Inside the Android Configuration card">
        <p>
          Because the client SDK is Billing-compatible, the dashboard tucks
          Horizon into the existing Android Configuration card as a
          checkbox-gated sub-section. Android-only projects aren't cluttered
          with Horizon fields.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">What you'll need</h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          <strong>App ID</strong> — the numeric Meta app identifier from the
          Meta Developer Dashboard (typically 15–16 digits).
        </li>
        <li>
          <strong>App Secret</strong> — an opaque string from the same
          dashboard; IAPKit combines it with the App ID per verify call and
          never returns it to the browser.
        </li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">Steps</h2>
      <ol className="my-3 list-decimal space-y-2 pl-6">
        <li>
          Go to{" "}
          <a
            href="https://developers.meta.com/horizon/develop"
            className="text-primary underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            developers.meta.com/horizon/develop
          </a>{" "}
          and open your app.
        </li>
        <li>
          In <strong>API setup</strong>, copy the <strong>App ID</strong> and{" "}
          <strong>App Secret</strong>.
        </li>
        <li>
          In IAPKit's project Settings, scroll to Android Configuration, check{" "}
          <strong>Enable Meta Horizon</strong>, paste both values, then{" "}
          <strong>Save Horizon config</strong>.
        </li>
      </ol>

      <DocsScreenshot
        src="/docs/screenshots/horizon-config.webp"
        alt="Meta Horizon sub-section inside Android Configuration"
        caption="Once saved, the App Secret is shown as 'Configured ✓' — IAPKit never echoes the plaintext back to the dashboard. Use Replace to rotate."
      />

      <Callout kind="warning" title="The secret is write-only on the wire">
        <p>
          After the initial save, the browser never sees the App Secret again.
          If you need to rotate, click Replace and paste a new value. Turning
          off Enable Meta Horizon clears both credentials server-side so stale
          secrets can't linger.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Verify call</h2>
      <CodeBlock title="POST /v1/purchase/verify" language="bash">
        {`curl -X POST https://kit.openiap.dev/v1/purchase/verify \\
  -H "Authorization: Bearer openiap-kit_<your-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "store": "horizon",
    "userId": "1234567890",
    "sku": "coin_pack_100"
  }'`}
      </CodeBlock>

      <p>
        Unlike Apple's JWS or Google's purchase token, Horizon doesn't hand the
        client an opaque receipt. Meta's model is: "call us with (appId, userId,
        sku) and we'll tell you if that entitlement is granted." IAPKit builds
        the request for you — the client only supplies the Oculus user id and
        the SKU.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">
        What IAPKit does behind the scenes
      </h2>
      <pre className="my-4 overflow-x-auto rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs leading-relaxed">
        <code>{`POST https://graph.oculus.com/{APP_ID}/verify_entitlement
Content-Type: application/x-www-form-urlencoded

access_token=OC%7C{APP_ID}%7C{APP_SECRET}&user_id={userId}&sku={sku}

→ { "success": true, "grant_time": 1744148687 }
`}</code>
      </pre>
      <p>
        IAPKit multiplies <code>grant_time</code> by 1000 before persisting so
        it stays in milliseconds (the same unit Apple and Google store).{" "}
        <code>success: true</code> maps to <code>ENTITLED</code>,{" "}
        <code>false</code> to <code>INAUTHENTIC</code>.
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
                META_HORIZON_NOT_ENABLED
              </td>
              <td className="px-3 py-2">
                Horizon isn't enabled for this project. Toggle it on in
                Settings.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                META_HORIZON_APP_ID_NOT_CONFIGURED
              </td>
              <td className="px-3 py-2">
                App ID missing from project settings.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                META_HORIZON_APP_SECRET_NOT_CONFIGURED
              </td>
              <td className="px-3 py-2">
                App Secret missing from project settings.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono text-xs">
                META_HORIZON_VERIFICATION_ERROR
              </td>
              <td className="px-3 py-2">
                Meta Graph API returned an error or the response didn't parse.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DocsPage>
  );
}
