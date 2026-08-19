import { Link } from "react-router-dom";

import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";
import { DocsPage } from "../components/DocsPage";

export default function WebhooksPage() {
  return (
    <DocsPage
      slug="webhooks"
      title="Store webhooks"
      description="Send Apple App Store Server Notifications v2 and Google Play RTDN into IAPKit."
    >
      <p>
        IAPKit accepts store lifecycle notifications, verifies and deduplicates
        them, then updates purchase, subscription, and analytics state. The
        supported direction is store to IAPKit:
      </p>
      <CodeBlock language="text">Apple / Google → IAPKit</CodeBlock>

      <Callout kind="warning" title="No outbound mobile event stream">
        <p>
          IAPKit does not relay events to apps through SSE, WebSockets, push, or
          long polling. Apps use bounded verification and user-scoped status or
          entitlement reads. If a device needs an immediate APNs or FCM message,
          the developer&apos;s authenticated backend owns that delivery.
        </p>
      </Callout>

      <h2 className="mt-10 text-2xl font-semibold">Lifecycle URL</h2>
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
          authenticated delivery.
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
          state and feeds the analytics rollup.
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
        The{" "}
        <a
          href="https://openiap.dev/docs/webhooks"
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          canonical OpenIAP webhook policy
        </a>{" "}
        covers the same boundary across the SDK ecosystem.
      </p>
    </DocsPage>
  );
}
