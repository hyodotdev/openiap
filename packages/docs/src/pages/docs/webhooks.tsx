import AnchorLink from '../../components/AnchorLink';
import Callout from '../../components/Callout';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function Webhooks() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Webhooks"
        description="Configure Apple and Google lifecycle webhooks, then deliver signed normalized subscription events from IAPKit to your HTTPS backend."
        path="/docs/webhooks"
        keywords="IAPKit webhooks, outbound webhooks, signed commerce events, App Store Server Notifications v2, Google RTDN, subscription lifecycle"
      />
      <h1>Webhooks</h1>
      <p>
        IAPKit accepts lifecycle notifications sent by Apple and Google,
        verifies them, deduplicates them, and updates its stored purchase and
        subscription state. IAPKit can then forward a signed normalized event to
        a developer-controlled backend:
      </p>
      <pre>
        <code>Apple / Google → IAPKit → developer HTTPS backend</code>
      </pre>
      <Callout kind="important">
        IAPKit does not stream webhook events to mobile SDKs. There is no
        outbound SSE, WebSocket, push, or long-poll API. Apps should verify
        purchases and refresh status or entitlements through the bounded
        request/response APIs. If your own backend protects paid resources, that
        backend remains responsible for its entitlement decision and any app
        push notification.
      </Callout>

      <section>
        <AnchorLink id="outbound" level="h2">
          Deliver normalized events to your backend
        </AnchorLink>
        <p>
          In the project&apos;s <strong>Webhooks</strong> tab, add a public
          HTTPS destination and copy its one-time signing secret. IAPKit
          delivers normalized subscription and entitlement events from a bounded
          Convex worker outside the Fly request path. Failed attempts back off
          and remain as replayable dead letters for project admins.
        </p>
        <p>
          Verify <code>openiap-signature</code> against the timestamp and raw
          body, parse <code>openiap-timestamp</code> as a finite Unix-seconds
          number, and require{' '}
          <code>Math.abs(Date.now() / 1000 - timestamp) &lt;= 300</code> to
          reject both stale and future timestamps. Require the{' '}
          <code>openiap-event-id</code> header to equal the signed body&apos;s{' '}
          <code>eventId</code>, and atomically deduplicate on the body field
          before side effects. The header by itself is not signed.
        </p>
        <p>
          Compute lowercase hex with{' '}
          <code>HMAC_SHA256(secret, timestamp + &quot;.&quot; + rawBody)</code>,
          then prefix it with <code>v1=</code>. During the 24-hour rotation
          window, the header contains the new and previous values
          comma-separated; accept either valid value. Never reserialize JSON
          before verification.
        </p>
        <pre>
          <code>{`{
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
}`}</code>
        </pre>
        <p>
          Optional fields include <code>previousProductId</code>, transaction
          ids, price, and bounded provider extensions. Event types are:
        </p>
        <pre>
          <code>{`subscription.started, subscription.renewed, subscription.recovered,
subscription.entered_grace_period, subscription.entered_billing_retry,
subscription.expired, subscription.canceled, subscription.uncanceled,
subscription.revoked, subscription.refunded, subscription.product_changed,
subscription.price_changed, subscription.deferred, subscription.paused,
subscription.resumed, entitlement.granted, entitlement.revoked`}</code>
        </pre>
        <p>
          Read the{' '}
          <a
            href="https://github.com/hyodotdev/openiap/blob/main/packages/kit/COMMERCE-EVENTS.md"
            target="_blank"
            rel="noreferrer"
          >
            complete receiver contract
          </a>
          .
        </p>
      </section>

      <section>
        <AnchorLink id="setup" level="h2">
          Configure the inbound lifecycle URL
        </AnchorLink>
        <p>
          Open the IAPKit dashboard&apos;s <strong>Webhooks</strong> tab and
          copy the project&apos;s lifecycle URL. The unified endpoint is{' '}
          <code>POST /v1/webhooks/&#123;publishableKey&#125;</code>. It accepts
          store-to-server delivery only; it is not an app-readable endpoint.
        </p>

        <h3>Apple — App Store Server Notifications v2</h3>
        <ol>
          <li>
            In{' '}
            <a
              href="https://appstoreconnect.apple.com"
              target="_blank"
              rel="noreferrer"
            >
              App Store Connect
            </a>
            , open your app and choose <strong>App Information</strong>.
          </li>
          <li>
            Under <strong>App Store Server Notifications</strong>, select{' '}
            <code>Version 2</code> and paste the IAPKit lifecycle URL into the
            production and sandbox server URL fields.
          </li>
          <li>
            Save and use Apple&apos;s <strong>Send Test Notification</strong>{' '}
            action to verify delivery.
          </li>
        </ol>

        <h3>Google — Real-Time Developer Notifications</h3>
        <Callout kind="important">
          Upload the Google Play service-account JSON in IAPKit project
          settings. RTDN omits authoritative expiry and pricing, so every
          non-terminal subscription notification requires Android Publisher API
          enrichment before IAPKit records it. Use that same service account as
          the Pub/Sub push authentication identity; its OIDC email must equal
          the uploaded JSON&apos;s <code>client_email</code> and its audience
          must equal the exact lifecycle URL. Existing subscriptions that use a
          separate push identity must be updated.
        </Callout>
        <ol>
          <li>
            In Google Cloud, create a Pub/Sub topic and a push subscription
            whose endpoint is the IAPKit lifecycle URL.
          </li>
          <li>
            Configure authenticated push delivery with that uploaded service
            account and use the exact lifecycle URL as its OIDC audience.
          </li>
          <li>
            On that account, grant the Pub/Sub service agent{' '}
            <code>
              service-$&#123;PROJECT_NUMBER&#125;@gcp-sa-pubsub.iam.gserviceaccount.com
            </code>{' '}
            <code>roles/iam.serviceAccountTokenCreator</code>. The operator who
            creates or updates the subscription also needs{' '}
            <code>roles/iam.serviceAccountUser</code> on the account.
          </li>
          <li>
            Separately grant{' '}
            <code>
              google-play-developer-notifications@system.gserviceaccount.com
            </code>{' '}
            the Pub/Sub publisher role on the topic.
          </li>
          <li>
            In Google Play Console, open <strong>Monetization setup</strong>,
            enter the topic under{' '}
            <strong>Real-time developer notifications</strong>, and send a test
            notification.
          </li>
        </ol>
        <p className="text-sm text-muted-foreground">
          The lifecycle URL is POST-only. Opening it in a browser may show a
          blank or 404 response; use the store console&apos;s authenticated test
          delivery to validate the integration.
        </p>
      </section>

      <section>
        <AnchorLink id="processing" level="h2">
          What IAPKit does with a notification
        </AnchorLink>
        <ul>
          <li>Verifies the store notification before accepting it.</li>
          <li>
            Deduplicates using the project, store source, and source
            notification identifier.
          </li>
          <li>
            Normalizes the store lifecycle transition for IAPKit&apos;s internal
            subscription state machine.
          </li>
          <li>
            Stores the event and updates the corresponding purchase or
            subscription state.
          </li>
        </ul>
        <p>
          The normalized event record is an IAPKit backend detail, not a public
          native or framework SDK contract.
        </p>
      </section>

      <section>
        <AnchorLink id="app-refresh" level="h2">
          Refreshing an app
        </AnchorLink>
        <p>
          A shipped app uses an <code>openiap-kit_pk_</code> publishable key for
          purchase verification and scoped reads. Refresh on cold start,
          explicit user action, or another bounded lifecycle point appropriate
          for the app. Avoid polling the full product catalog on every
          foreground.
        </p>
        <p>
          For immediate device notifications, your authenticated backend may
          consume IAPKit&apos;s signed outbound event and send APNs or FCM
          messages. IAPKit does not expose a project-wide event feed to mobile
          clients.
        </p>
      </section>
    </div>
  );
}

export default Webhooks;
