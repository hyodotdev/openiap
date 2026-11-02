import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";

export default function WebhooksPage() {
  return (
    <DocsPage
      slug="webhooks"
      title="Webhooks"
      description="Turn on store notifications, then receive signed lifecycle events at your own backend."
    >
      <p>
        Webhooks run in two directions, both server to server. Stores notify
        IAPKit of renewals, refunds, and expirations; IAPKit updates its state
        and sends signed, normalized events to backends you register.
      </p>
      <CodeBlock language="text">
        Apple / Google / Amazon → IAPKit → your HTTPS backend
      </CodeBlock>

      <Callout kind="warning" title="No outbound mobile event stream">
        <p>
          IAPKit does not relay events to apps through SSE, WebSockets, push, or
          long polling. Apps use bounded verification and user-scoped status or
          entitlement reads. If a device needs an immediate APNs or FCM message,
          the developer&apos;s authenticated backend owns that delivery.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Before you start</h2>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          Turn on each store&apos;s notifications at your project&apos;s{" "}
          <a href="#lifecycle-url" className="text-primary underline">
            lifecycle URL
          </a>
          . Without them IAPKit learns of no Apple or Google renewal or refund
          and sends no event for it; Amazon receipts are also re-checked on a
          schedule.
        </li>
        <li>
          Link purchases to your users. Subscription events arrive for every
          purchase, but only purchases your backend has bound to a user carry{" "}
          <code>userId</code> and produce <code>entitlement.granted</code> and{" "}
          <code>entitlement.revoked</code> (see{" "}
          <Link to="/docs/purchase-flow" className="text-primary underline">
            Purchase flow
          </Link>
          ).
        </li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">
        Send events to your backend
      </h2>
      <ol className="my-3 list-decimal space-y-2 pl-6">
        <li>
          Open the project&apos;s Webhooks tab. Only owners and admins can
          manage destinations.
        </li>
        <li>
          Enter a public HTTPS endpoint, choose the event types it receives, and
          create the destination.
        </li>
        <li>
          Copy the signing secret immediately; IAPKit never shows it again.
        </li>
        <li>
          Verify <code>openiap-signature</code> over the raw body, require the
          event-id header to match the signed body&apos;s <code>eventId</code>,
          and deduplicate on that body field before applying an effect.
        </li>
      </ol>
      <h3 className="mt-6 text-xl font-semibold">What your endpoint returns</h3>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          Return any <code>2xx</code> within 10 seconds, after you have stored
          the event.
        </li>
        <li>
          <code>408</code>, <code>429</code>, <code>5xx</code>, a timeout, or a
          connection error is retried with backoff from 30 seconds up to 6
          hours, for at most 14 attempts. Any other status, redirects included,
          fails permanently.
        </li>
        <li>
          After 20 failures in a row the destination is paused for review.
          Failed deliveries stay visible and can be re-sent; see{" "}
          <a href="#delivery-history" className="text-primary underline">
            Delivery history and re-send
          </a>
          .
        </li>
      </ul>
      <CodeBlock language="text">{`content-type: application/json
openiap-signature: v1=<hmac-sha256>
openiap-timestamp: <unix-seconds>
openiap-event-id: <must equal body.eventId>
openiap-delivery-id: <stable across retries of one attempt chain>`}</CodeBlock>
      <p>
        To verify a delivery, compute lowercase hex with{" "}
        <code>HMAC_SHA256(secret, timestamp + &quot;.&quot; + rawBody)</code>,
        then prefix it with <code>v1=</code>. During the 24-hour rotation
        window, the header contains the new and previous values comma-separated;
        accept either valid value. Parse the timestamp as a finite Unix-seconds
        number and require{" "}
        <code>Math.abs(Date.now() / 1000 - timestamp) &lt;= 300</code> to reject
        both stale and future values. Never reserialize JSON before
        verification. The Commerce Protocol&apos;s{" "}
        <a
          href="https://openiap.dev/commerce-protocol/webhooks#receiver"
          className="text-primary underline"
        >
          receiver example
        </a>{" "}
        does all of this in TypeScript.
      </p>
      <p>
        To rotate the secret, use <strong>Rotate</strong> on the destination.
        For 24 hours both secrets sign each delivery, and another rotation is
        blocked. If a secret leaked, run the CLI&apos;s{" "}
        <code>kit webhooks rotate-secret</code> with <code>revokePrevious</code>
        : it issues a new secret and stops both old ones at once, so deploy the
        new secret to your receiver immediately or deliveries fail verification.
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
      <h3 className="mt-6 text-xl font-semibold">What events cover</h3>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          Subscriptions only. A refunded or revoked one-time purchase,
          consumable or not, sends no event.
        </li>
        <li>
          Meta Horizon sends IAPKit no notifications, so Horizon purchases
          produce no events.
        </li>
        <li>
          Amazon events are in beta. Apple and Google have no scheduled
          re-check, so a notification the store gives up delivering is not
          recovered.
        </li>
      </ul>
      <p>
        IAPKit&apos;s live{" "}
        <a
          href="https://kit.openiap.dev/commerce/v1/capabilities"
          className="text-primary underline"
        >
          capability descriptor
        </a>{" "}
        lists what it observes per store. The protocol&apos;s{" "}
        <a
          href="https://openiap.dev/commerce-protocol/webhooks"
          className="text-primary underline"
        >
          event and webhook reference
        </a>{" "}
        defines every field.
      </p>

      <h2 id="delivery-history" className="mt-10 text-2xl font-semibold">
        Delivery history and re-send
      </h2>
      <p>
        <strong>Webhooks → Delivery history</strong> lists every delivery,
        newest first, filtered by status, event type, destination, or event.
        Each row keeps its last 20 attempts: time, outcome, HTTP status,
        latency, and an error class such as <code>timeout</code> or{" "}
        <code>tls</code>. Response bodies and secrets are never stored. Members
        can read it and see only each destination&apos;s host. Destination
        descriptions and the last error text, which can name hosts and
        addresses, reach only owners, admins and secret keys.
      </p>
      <ul className="my-3 list-disc space-y-1 pl-6">
        <li>
          Owners and admins can re-send a delivered or failed delivery. The
          request reuses its <code>eventId</code> and delivery id, so a receiver
          that deduplicates on <code>eventId</code> treats it as a duplicate.
        </li>
        <li>
          A project can re-send 30 deliveries per minute, and the same delivery
          once per minute. Excess calls return <code>RATE_LIMITED</code> with a
          retry delay.
        </li>
        <li>
          Delivered rows and their events are kept for 30 days. After that,
          re-send returns <code>NOT_FOUND</code>; a missing event returns{" "}
          <code>EVENT_PRUNED</code>.
        </li>
      </ul>

      <h2 id="lifecycle-url" className="mt-10 text-2xl font-semibold">
        Lifecycle URL
      </h2>
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

      <h2 className="mt-10 text-2xl font-semibold">Amazon RTN (beta)</h2>
      <p>
        Configure the RVS shared secret and SNS topic ARN in project settings,
        then subscribe this lifecycle URL to the topic with raw delivery off.
        IAPKit verifies the SNS signature and refreshes RVS before changing
        subscription or entitlement state. Follow the{" "}
        <Link to="/docs/verification/amazon" className="text-primary underline">
          Amazon beta setup guide
        </Link>{" "}
        for topic permissions, subscription confirmation and testing limits.
        Amazon revenue requires separate verified price evidence.
      </p>

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
        <strong>Webhooks → Inbound notifications</strong> lists what IAPKit
        accepted in the last 30 days, newest first: store, type, environment,
        product, bound app user, received and applied times, and a SHA-256
        fingerprint of the signed payload. The payload itself is never shown,
        and store transaction ids, which bind accepts as a purchase token, reach
        only owners, admins and secret keys. A store retry shares the first
        row&apos;s deduplication key, so it never adds a row. Rejected requests
        are not recorded.
      </p>
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
          href="https://openiap.dev/commerce-protocol/webhooks"
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
