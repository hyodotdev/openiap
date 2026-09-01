import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";

export default function WebhooksPage() {
  return (
    <DocsPage
      slug="webhooks"
      title="Store webhooks"
      description="Receive store lifecycle notifications and forward signed normalized events to your backend."
    >
      <p>
        IAPKit accepts store lifecycle notifications, verifies and deduplicates
        them, then updates purchase, subscription, and analytics state. The
        supported server-to-server path is:
      </p>
      <CodeBlock language="text">
        Apple / Google → IAPKit → your HTTPS backend
      </CodeBlock>

      <Callout kind="warning" title="No outbound mobile event stream">
        <p>
          IAPKit does not relay events to apps through SSE, WebSockets, push, or
          long polling. Apps use bounded verification and user-scoped status or
          entitlement reads. If a device needs an immediate APNs or FCM message,
          the developer&apos;s authenticated backend owns that delivery.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">
        Developer backend destination
      </h2>
      <ol className="my-3 list-decimal space-y-2 pl-6">
        <li>Open the project&apos;s Webhooks tab.</li>
        <li>Enter a public HTTPS endpoint and create the destination.</li>
        <li>
          Copy the signing secret immediately; IAPKit never shows it again.
        </li>
        <li>
          Verify <code>openiap-signature</code> over the raw body, require the
          event-id header to match the signed body&apos;s <code>eventId</code>,
          and deduplicate on that body field before applying an effect.
        </li>
      </ol>
      <p>
        Delivery runs in a bounded Convex worker outside the Fly request path.
        Retries use exponential backoff, permanent failures remain visible as
        dead letters, and project admins can replay them from the same tab.
      </p>
      <CodeBlock language="text">{`openiap-signature: v1=<hmac-sha256>
openiap-timestamp: <unix-seconds>
openiap-event-id: <must equal body.eventId>`}</CodeBlock>
      <p>
        Compute lowercase hex with{" "}
        <code>HMAC_SHA256(secret, timestamp + &quot;.&quot; + rawBody)</code>,
        then prefix it with <code>v1=</code>. During the 24-hour rotation
        window, the header contains the new and previous values comma-separated;
        accept either valid value. Parse the timestamp as a finite Unix-seconds
        number and require{" "}
        <code>Math.abs(Date.now() / 1000 - timestamp) &lt;= 300</code> to reject
        both stale and future values. Never reserialize JSON before
        verification.
      </p>
      <CodeBlock language="json">{`{
  "eventId": "commerceEvents_...",
  "eventType": "subscription.renewed",
  "eventVersion": "1.0",
  "occurredAt": 1787788800000,
  "processedAt": 1787788800123,
  "store": "google",
  "environment": "production",
  "projectId": "projects_...",
  "applicationId": "dev.example.app",
  "userId": "account_123",
  "productId": "premium.monthly",
  "subscription": { "state": "Active", "productId": "premium.monthly", "active": true }
}`}</CodeBlock>
      <p>
        Optional fields include <code>previousProductId</code>, transaction ids,
        price, and bounded provider extensions. Supported event types are:
      </p>
      <CodeBlock language="text">{`subscription.started, subscription.renewed, subscription.recovered,
subscription.entered_grace_period, subscription.entered_billing_retry,
subscription.expired, subscription.canceled, subscription.uncanceled,
subscription.revoked, subscription.refunded, subscription.product_changed,
subscription.price_changed, subscription.deferred, subscription.paused,
subscription.resumed, entitlement.granted, entitlement.revoked`}</CodeBlock>
      <p>
        See the{" "}
        <a
          href="https://github.com/hyodotdev/openiap/blob/main/packages/kit/COMMERCE-EVENTS.md"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          complete receiver contract
        </a>
        .
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Lifecycle URL</h2>
      <Callout kind="note" title="Google subscription enrichment required">
        <p>
          Upload the Google Play service-account JSON in project settings. RTDN
          omits authoritative expiry and pricing, so IAPKit enriches every
          non-terminal subscription notification with the Android Publisher API
          before recording it. Use that same service account as the Pub/Sub push
          authentication identity; IAPKit requires its OIDC email to equal the
          uploaded JSON&apos;s <code>client_email</code> and its audience to
          equal the exact lifecycle URL. Existing subscriptions that use a
          separate push identity must be updated.
        </p>
      </Callout>
      <p>
        Open the project&apos;s <strong>Webhooks</strong> tab and copy its
        unified lifecycle URL:
      </p>
      <CodeBlock language="text">
        https://kit.openiap.dev/v1/webhooks/openiap-kit_pk_&lt;publishable-key&gt;
      </CodeBlock>
      <p>
        This is a POST-only store receiver. Opening it in a browser may return
        404; validate it with the store console&apos;s test-delivery action.
        Secret keys are rejected in webhook URLs.
      </p>

      <h2 className="mt-10 text-2xl font-semibold">Apple ASN v2</h2>
      <ol className="my-3 list-decimal space-y-2 pl-6">
        <li>
          In App Store Connect, open the app and select{" "}
          <strong>App Information</strong>.
        </li>
        <li>
          Under <strong>App Store Server Notifications</strong>, choose Version
          2 and paste the IAPKit lifecycle URL into both Production and Sandbox.
        </li>
        <li>Save, then use Send Test Notification to confirm delivery.</li>
      </ol>

      <h2 className="mt-10 text-2xl font-semibold">Google RTDN</h2>
      <ol className="my-3 list-decimal space-y-2 pl-6">
        <li>Create a Google Cloud Pub/Sub topic and push subscription.</li>
        <li>
          Use the IAPKit lifecycle URL as the push endpoint and configure
          authenticated delivery with the same service account whose JSON is
          uploaded in IAPKit project settings. Keep the OIDC audience equal to
          that exact lifecycle URL.
        </li>
        <li>
          On that account, grant the Pub/Sub service agent{" "}
          <code>
            service-$&#123;PROJECT_NUMBER&#125;@gcp-sa-pubsub.iam.gserviceaccount.com
          </code>{" "}
          <code>roles/iam.serviceAccountTokenCreator</code>. The operator who
          creates or updates the subscription also needs{" "}
          <code>roles/iam.serviceAccountUser</code> on the account.
        </li>
        <li>
          Grant{" "}
          <code>
            google-play-developer-notifications@system.gserviceaccount.com
          </code>{" "}
          the Pub/Sub publisher role on the topic.
        </li>
        <li>
          In Play Console → Monetization setup, select the topic for Real-time
          developer notifications and send a test notification.
        </li>
      </ol>

      <h2 className="mt-10 text-2xl font-semibold">After delivery</h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>IAPKit verifies the store notification before accepting it.</li>
        <li>
          Project, store source, and source notification ID form the
          deduplication boundary.
        </li>
        <li>
          The normalized transition updates stored purchase or subscription
          state, feeds the analytics rollup, and fans out a signed normalized
          event to enabled backend destinations.
        </li>
      </ul>
      <p>
        Use the store console&apos;s test-delivery result to confirm that the
        endpoint accepts the notification, then see{" "}
        <Link to="/docs/analytics" className="text-primary underline">
          Analytics
        </Link>{" "}
        for rollup timing and metric definitions.
      </p>
      <p>
        The vendor-neutral{" "}
        <a
          href="https://openiap.dev/docs/webhooks"
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Commerce Protocol webhook contract
        </a>{" "}
        defines the signed outbound boundary independently of IAPKit. This page
        remains the canonical source for IAPKit&apos;s inbound store setup and
        dashboard workflow.
      </p>
    </DocsPage>
  );
}
