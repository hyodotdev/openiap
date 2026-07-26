import AnchorLink from '../../components/AnchorLink';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function Webhooks() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Webhooks"
        description="Configure Apple App Store Server Notifications v2 and Google Play Real-Time Developer Notifications as inbound IAPKit lifecycle webhooks."
        path="/docs/webhooks"
        keywords="IAPKit webhooks, App Store Server Notifications v2, Google RTDN, subscription lifecycle"
      />
      <h1>Webhooks</h1>
      <p>
        IAPKit accepts lifecycle notifications sent by Apple and Google,
        verifies them, deduplicates them, and updates its stored purchase and
        subscription state. This is the only webhook direction supported by
        IAPKit:
      </p>
      <pre>
        <code>Apple / Google → IAPKit</code>
      </pre>
      <div className="alert-card alert-card--warning">
        <p>
          IAPKit does not stream webhook events to mobile SDKs. There is no
          outbound SSE, WebSocket, push, or long-poll API. Apps should verify
          purchases and refresh status or entitlements through the bounded
          request/response APIs. If your own backend protects paid resources,
          that backend remains responsible for its entitlement decision and any
          app push notification.
        </p>
      </div>

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
        <ol>
          <li>
            In Google Cloud, create a Pub/Sub topic and a push subscription
            whose endpoint is the IAPKit lifecycle URL.
          </li>
          <li>
            Configure authenticated push delivery and grant{' '}
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
          consume its own store lifecycle data and send APNs or FCM messages.
          IAPKit does not expose a project-wide event feed to mobile clients.
        </p>
      </section>
    </div>
  );
}

export default Webhooks;
