import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import LanguageTabs from '../../components/LanguageTabs';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function Webhooks() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Webhooks"
        description="OpenIAP lifecycle webhooks normalize Apple App Store Server Notifications v2 and Google Play Real-Time Developer Notifications into a single cross-store event stream delivered straight to your client SDK — no user-side server required."
        path="/docs/webhooks"
        keywords="OpenIAP webhooks, App Store Server Notifications v2, Google RTDN, subscription lifecycle events, no server"
      />
      <h1>Webhooks</h1>
      <p>
        OpenIAP normalizes Apple{' '}
        <a
          href="https://developer.apple.com/documentation/appstoreservernotifications"
          target="_blank"
          rel="noreferrer"
        >
          App Store Server Notifications v2
        </a>{' '}
        and Google{' '}
        <a
          href="https://developer.android.com/google/play/billing/rtdn-reference"
          target="_blank"
          rel="noreferrer"
        >
          Real-Time Developer Notifications
        </a>{' '}
        into a single cross-store event stream and pushes them straight to your
        client SDK over Server-Sent Events. Apps can react to renewals,
        billing-retry, refunds, and revokes without operating any backend of
        their own.
      </p>

      <section>
        <AnchorLink id="architecture" level="h2">
          Architecture
        </AnchorLink>
        <p>
          The kit service hosted at <code>https://kit.openiap.dev</code> is
          registered as the webhook endpoint with Apple and Google. It verifies
          each notification's signature, normalizes the payload into the spec's{' '}
          <code>WebhookEvent</code> shape, dedups on the source notification id,
          and stores the result for at least 30 days. Authenticated SDK clients
          connect to <code>GET /v1/webhooks/stream/&#123;apiKey&#125;</code> and
          receive new events as Server-Sent Events along with reconnect support
          via the <code>Last-Event-ID</code> header.
        </p>
      </section>

      <section>
        <AnchorLink id="setup" level="h2">
          Setup — wiring the lifecycle webhook URL
        </AnchorLink>
        <p>
          Open the kit dashboard's <strong>Webhooks</strong> tab and copy the
          single <code>POST /v1/webhooks/&#123;apiKey&#125;</code> URL. Paste it
          into both store consoles below — kit auto-detects the payload shape
          (Apple ASN v2 vs Google Pub/Sub) and dispatches to the right verifier,
          so one URL covers both stores.
        </p>
        <h3>Apple — App Store Server Notifications v2</h3>
        <ol>
          <li>
            Sign in to{' '}
            <a
              href="https://appstoreconnect.apple.com"
              target="_blank"
              rel="noreferrer"
            >
              App Store Connect
            </a>{' '}
            → <strong>My Apps</strong> → your app.
          </li>
          <li>
            Sidebar → <strong>App Information</strong>. Scroll to{' '}
            <strong>App Store Server Notifications</strong>.
          </li>
          <li>
            Set <strong>Version</strong> to <code>Version 2</code>. Paste the
            kit URL into both <strong>Production Server URL</strong> and{' '}
            <strong>Sandbox Server URL</strong>.
          </li>
          <li>
            Save, then click <strong>Send Test Notification</strong>. A{' '}
            <code>TestNotification</code> event should appear in the Webhooks
            tab within seconds.
          </li>
        </ol>
        <h3>Google — Real-Time Developer Notifications</h3>
        <ol>
          <li>
            <a
              href="https://console.cloud.google.com"
              target="_blank"
              rel="noreferrer"
            >
              Google Cloud Console
            </a>{' '}
            → select the project linked to your Play Console app →{' '}
            <strong>Pub/Sub → Topics → Create topic</strong> (e.g.{' '}
            <code>play-rtdn</code>).
          </li>
          <li>
            On that topic → <strong>Subscriptions → Create subscription</strong>
            . Delivery type <strong>Push</strong>; <strong>Endpoint URL</strong>{' '}
            = the kit URL. Enable <strong>Authentication</strong> with a service
            account that has the{' '}
            <code>roles/iam.serviceAccountTokenCreator</code> role on itself,
            and set the OIDC <strong>Audience</strong> to your kit deployment
            origin.
          </li>
          <li>
            Grant <code>roles/pubsub.publisher</code> on the topic to{' '}
            <code>
              google-play-developer-notifications@system.gserviceaccount.com
            </code>
            .
          </li>
          <li>
            <a
              href="https://play.google.com/console"
              target="_blank"
              rel="noreferrer"
            >
              Play Console
            </a>{' '}
            → your app → <strong>Monetization setup</strong> →{' '}
            <strong>Real-time developer notifications</strong>. Paste the topic
            name (<code>projects/&lt;gcp-project&gt;/topics/play-rtdn</code>) →{' '}
            <strong>Send test notification</strong>.
          </li>
        </ol>
        <p className="text-sm text-muted-foreground" style={{ marginTop: 12 }}>
          <strong>Tip:</strong> the lifecycle webhook URL is{' '}
          <strong>POST-only</strong>. Opening it in a browser shows a blank /
          404 page — that's expected. Use App Store Connect / Pub/Sub's
          authenticated "Send test notification" buttons to verify production
          wiring; unauthenticated curl smoke tests are only for local/dev
          receivers that explicitly allow them.
        </p>
      </section>

      <section>
        <AnchorLink id="consume-stream" level="h2">
          Consuming the SSE stream
        </AnchorLink>
        <p>
          The second URL —{' '}
          <code>GET /v1/webhooks/stream/&#123;apiKey&#125;</code> — is a
          long-lived <code>text/event-stream</code> response, not an HTML page.
          Open it in a browser and you'll see a blank tab; that's correct
          behavior because the response never closes and only emits
          comment-style keepalive frames (<code>:keepalive\n\n</code>) until a
          real <code>WebhookEvent</code> arrives. To actually consume it use one
          of the SDK helpers below or call it directly with{' '}
          <code>EventSource</code> / <code>curl -N</code>.
        </p>
      </section>

      <section>
        <AnchorLink id="event-shape" level="h2">
          Event shape
        </AnchorLink>
        <p>
          Each event delivered over the SSE stream conforms to the GraphQL{' '}
          <code>WebhookEvent</code> type defined in{' '}
          <code>packages/gql/src/webhook.graphql</code>. The unified event types
          are:
        </p>
        <ul>
          <li>
            <code>SubscriptionStarted</code>, <code>SubscriptionRenewed</code>,
            <code>SubscriptionExpired</code>
          </li>
          <li>
            <code>SubscriptionInGracePeriod</code>,{' '}
            <code>SubscriptionInBillingRetry</code>,{' '}
            <code>SubscriptionRecovered</code>
          </li>
          <li>
            <code>SubscriptionCanceled</code>,{' '}
            <code>SubscriptionUncanceled</code>,{' '}
            <code>SubscriptionRevoked</code>
          </li>
          <li>
            <code>SubscriptionPriceChange</code>,{' '}
            <code>SubscriptionProductChanged</code>,{' '}
            <code>SubscriptionPaused</code>, <code>SubscriptionResumed</code>
          </li>
          <li>
            <code>PurchaseRefunded</code>,{' '}
            <code>PurchaseConsumptionRequest</code>,{' '}
            <code>TestNotification</code>
          </li>
        </ul>
        <p>
          The <code>id</code> field is the stable per-notification identifier (
          <code>notificationUUID</code> on Apple, <code>messageId</code> on
          Google) — use it for application-level idempotency. The full source ↔
          openiap mapping table lives at{' '}
          <code>knowledge/external/webhook-mapping.md</code>.
        </p>
      </section>

      <section>
        <AnchorLink id="usage" level="h2">
          Usage
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// react-native-iap (and expo-iap) ship a useWebhookEvents hook.
import { useWebhookEvents } from 'react-native-iap';
// React Native does not ship a global EventSource; pass one in.
import EventSource from 'react-native-sse';

const { events, lastError, isConnected } = useWebhookEvents({
  apiKey: process.env.OPENIAP_API_KEY!,
  // baseUrl defaults to https://kit.openiap.dev
  eventSourceFactory: (url) => new EventSource(url),
  onEvent: (event) => {
    if (event.type === 'SubscriptionRenewed') {
      grantEntitlement(event.purchaseToken);
    }
  },
});`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/webhook_client.dart';

final listener = connectWebhookStream(apiKey: 'openiap-kit_<your-key>');
listener.events.listen((event) {
  if (event.type == WebhookEventType.SubscriptionRenewed) {
    grantEntitlement(event.purchaseToken);
  }
});`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// Pure parser + types live in commonMain. Wire your platform's HTTP
// client to webhookStreamUrl(apiKey = "...") and feed each SSE
// data frame to WebhookEventParser.parse().
var event = WebhookEventParser.parse(rawJson) ?: return
when (event.type) {
    WebhookEventType.SubscriptionRenewed -> grantEntitlement(event.purchaseToken)
    else -> Unit
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.openiap.WebhookEventParser
import io.github.hyochan.kmpiap.openiap.webhookStreamUrl

// Pure parser + types live in commonMain. Wire your platform's HTTP
// client to webhookStreamUrl(apiKey = "...") and feed each SSE
// data frame to WebhookEventParser.parse().
val event = WebhookEventParser.parse(rawJson) ?: return
when (event.type) {
    WebhookEventType.SubscriptionRenewed -> grantEntitlement(event.purchaseToken)
    else -> Unit
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`extends Node

@onready var webhook := preload("res://addons/godot-iap/webhook_client.gd").new()

func _ready() -> void:
    webhook.api_key = "openiap-kit_<your-key>"
    webhook.event_received.connect(_on_event)
    add_child(webhook)
    webhook.connect_stream()

func _on_event(event: Dictionary) -> void:
    if event["type"] == "SubscriptionRenewed":
        grant_entitlement(event["purchaseToken"])`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="reconnect-and-replay" level="h2">
          Reconnect and replay
        </AnchorLink>
        <p>
          The SSE stream auto-reconnects on transport errors. The standard{' '}
          <code>Last-Event-ID</code> header is honored — kit looks up the named
          event's <code>receivedAt</code> and resumes from there, so events that
          fired while the connection was closed are delivered in order on the
          next connect.
        </p>
        <p>
          For long-offline reconciliation, call the{' '}
          <code>webhookEventsSince</code> Convex query directly with a
          checkpoint timestamp; it returns up to 500 events at a time, capped at
          the 30-day retention window.
        </p>
      </section>
    </div>
  );
}

export default Webhooks;
