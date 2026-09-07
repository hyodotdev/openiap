import { useState } from 'react';
import { COMMERCE_PROTOCOL_LINKS } from '../../lib/config';
import { Link } from 'react-router-dom';
import httpBinding from 'openiap-commerce-protocol/generated/bindings/http-binding.json';
import evidence from 'openiap-commerce-protocol/examples/verify-purchase-request.json';
import AnchorLink from '../../components/AnchorLink';
import Callout from '../../components/Callout';
import CodeBlock from '../../components/CodeBlock';
import PackageInstall from '../../components/PackageInstall';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';

interface PurchaseSequenceStage {
  id: string;
  title: string;
  summary: string;
}

const PURCHASE_SEQUENCE: readonly PurchaseSequenceStage[] = [
  {
    id: 'app-purchase',
    title: '1. Purchase in the app',
    summary:
      'The app connects the Paywall Service to OpenIAP. Product selection starts the store purchase; the app receives the result and evidence.',
  },
  {
    id: 'purchase-access',
    title: '2. Verify and grant access',
    summary:
      'The app backend selects the user, calls the Commerce Provider, and records fulfillment. The app finishes the transaction after durable handling.',
  },
  {
    id: 'lifecycle-delivery',
    title: '3. Receive lifecycle events',
    summary:
      'Store notifications update provider state. The provider delivers signed events to an app backend or external event consumer, which persists and deduplicates before acknowledging.',
  },
];

function CommerceGettingStarted(): React.JSX.Element {
  useScrollToHash();
  const [selectedSequence, setSelectedSequence] = useState(0);
  const sequence = PURCHASE_SEQUENCE[selectedSequence];
  const diagramPath = `/commerce-diagrams/${sequence.id}`;
  const pathOf = (name: string): string =>
    httpBinding.operations.find((operation) => operation.name === name)!.path;

  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol: Use a Provider"
        path="/commerce-protocol/getting-started"
        description="Connect your backend to a provider: verify a purchase, bind it to a user, and read access."
      />
      <h1>Use a provider</h1>
      <p>
        Connect your backend to a commerce provider in three steps: verify store
        evidence, bind the purchase to an authenticated user, then read that
        user’s access. The requests below use your provider’s endpoint and
        credentials.
      </p>
      <p>
        Building the provider itself? Follow the{' '}
        <Link to="/commerce-protocol/implementation">implementation guide</Link>{' '}
        for storage, store adapters, lifecycle processing, and delivery workers.
      </p>

      <section>
        <AnchorLink id="purchase-flow" level="h2">
          What configuring a provider does
        </AnchorLink>
        <p>
          Your app backend uses the provider’s URL and credentials for
          verification, ownership, and access reads. Your app team connects the
          paywall callbacks and the authenticated app-to-backend API. Installing
          the protocol package or setting a provider name does not create those
          connections.
        </p>
        <p>
          Follow one subscription through the three stages below. A{' '}
          <strong>Paywall Service</strong> and{' '}
          <strong>Commerce Provider</strong> can be one business or separate
          services. Callback labels are illustrative; each client library has
          its own API names.
        </p>
        <div
          className="language-tabs-header commerce-sequence-tabs"
          role="group"
          aria-label="Purchase flow stages"
        >
          {PURCHASE_SEQUENCE.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              className={`language-tab ${selectedSequence === index ? 'active' : ''}`}
              aria-pressed={selectedSequence === index}
              aria-controls="purchase-sequence"
              onClick={() => setSelectedSequence(index)}
            >
              {entry.title}
            </button>
          ))}
        </div>
        <figure id="purchase-sequence" className="commerce-sequence">
          <figcaption aria-live="polite">
            <p>{sequence.summary}</p>
            <p>
              <a href={`${diagramPath}.svg`} target="_blank" rel="noreferrer">
                Open full-size diagram
              </a>{' '}
              ·{' '}
              <a href={`${diagramPath}.mmd`} download>
                Download Mermaid source ↓
              </a>
            </p>
          </figcaption>
          <div
            className="commerce-sequence-scroll"
            role="region"
            aria-label={`${sequence.title} sequence diagram; scroll to explore`}
            tabIndex={0}
          >
            <img
              src={`${diagramPath}.svg`}
              alt={`${sequence.title}. ${sequence.summary}`}
            />
          </div>
        </figure>
        <p>
          Rejected evidence or a failed binding stops that attempt. An empty
          entitlement result grants no access. An operation outage is not a
          revocation: keep your existing access and retry policy. These diagrams
          describe the integration contract; the{' '}
          <Link to="/commerce-protocol/implementation#iapkit">
            example’s verification scope
          </Link>{' '}
          is documented separately.
        </p>
      </section>

      <section>
        <AnchorLink id="receive-events" level="h2">
          Receive events — ready to run
        </AnchorLink>
        <p>
          Connect an existing backend with the ready receiver. It verifies the
          signature, validates the event, and saves it once in SQLite. You do
          not need to build a commerce provider or a store adapter.
        </p>
        <p>
          If your service only consumes events, start here. The purchase and
          access operations below belong to the app backend and its chosen
          provider; your service can keep its existing backend.
        </p>
        <p>
          <a
            className="btn btn-primary"
            href={COMMERCE_PROTOCOL_LINKS.exampleSource}
            download
          >
            Download the receiver example ↓
          </a>
        </p>
        <p>
          Extract it, then install dependencies with your favorite package
          manager. For the full build history and setup guides, clone the{' '}
          <a href={COMMERCE_PROTOCOL_LINKS.example}>example repository</a>:
        </p>
        <PackageInstall />
        <CodeBlock language="bash">{`npm run demo:consumer
# Or pnpm run demo:consumer, yarn demo:consumer, bun run demo:consumer`}</CodeBlock>
        <p>
          With Bun installed, this sends a signed purchase lifecycle over local
          HTTP, repeats each delivery, rejects tampering, and checks the saved
          inbox after reopening SQLite. No credentials or external services are
          needed for this check.{' '}
          <a href="/commerce-example/consumer-run.json">
            See the actual results and payloads
          </a>
          .
        </p>
        <details>
          <summary>Connect the receiver to your provider</summary>
          <p>
            Set <code>COMMERCE_WEBHOOK_SECRET</code> to your provider’s signing
            secret, then run <code>npm run consumer</code>. The ready endpoint
            is
            <code> http://127.0.0.1:5182/webhooks/commerce</code>. Put it behind
            your HTTPS reverse proxy, forwarding the exact body bytes to that
            local address, and register the HTTPS URL with your provider. The
            receiver accepts the public Host header forwarded by the proxy; its
            signature check authenticates the sender.
          </p>
          <p>
            Use one emitter/project and signing key per receiver database.
            <code> consumer.sqlite</code> is the durable inbox; set
            <code> COMMERCE_INBOX_PATH</code> for your persistent storage path.
            To embed the same Fetch-compatible handler in your server, use
            <code> createReceiver</code> from <code>webhooks.mjs</code>.
          </p>
          <p>
            The inbox preserves the signed event for your existing processing
            pipeline. Transaction and price fields are optional; a missing price
            is unknown. Each lifecycle event is not necessarily a new charge.
            Keep financial calculations in your business logic.
          </p>
        </details>
      </section>

      <section>
        <AnchorLink id="install-contract" level="h2">
          1. Install the contract
        </AnchorLink>
        <PackageInstall packageName="openiap-commerce-protocol" />
        <p>
          The package gives your backend the contract, schemas, and conformance
          tools. Obtain a compatible provider endpoint and credentials
          separately.
        </p>
        <p>
          To explore first, open the{' '}
          <Link to="/commerce-protocol#build-walkthrough">
            recorded purchase flow
          </Link>
          , or{' '}
          <Link to="/commerce-protocol/implementation#local-example">
            download the standalone example
          </Link>
          . To implement your own provider, give your AI the{' '}
          <Link to="/commerce-protocol/implementation#build-brief">
            build brief
          </Link>
          .
        </p>
      </section>

      <section>
        <AnchorLink id="connect" level="h2">
          2. Connect to a provider
        </AnchorLink>
        <p>
          Obtain the base URL, supported store configuration, and Authorization
          header values from your provider. A provider issues its own
          credentials; OpenIAP has no registration service. Keep the server
          credential in your backend. These shell examples assume{' '}
          <code>curl</code> and <code>jq</code>.
        </p>
        <CodeBlock language="bash">{`export COMMERCE_BASE_URL='https://your-provider.example'
# Set these through your local secret manager or environment.
# COMMERCE_VERIFY_AUTH: complete Authorization header value for verification
# COMMERCE_SERVER_AUTH: complete Authorization header value for the server role

curl --fail-with-body "$COMMERCE_BASE_URL${pathOf('providerCapabilities')}"`}</CodeBlock>
        <p>
          Inspect <code>profiles</code>, <code>bindings</code>, and the selected
          store’s <code>implementation</code> support. This flow needs{' '}
          <code>verification</code>, <code>accountLifecycle</code>,{' '}
          <code>entitlements</code>, and <code>rest</code> at compatible major
          versions. An events-only descriptor does not establish operation
          support. See{' '}
          <Link to="/commerce-protocol/capabilities">capabilities</Link> for the
          full descriptor.
        </p>
      </section>

      <section>
        <AnchorLink id="verify-bind-read" level="h2">
          3. Verify, bind, and read access
        </AnchorLink>
        <p>
          Save the following shape as <code>evidence.json</code>. Replace its
          illustrative JWS with a real StoreKit transaction JWS from the app.
          For Google, use{' '}
          <code>
            {'{ "store": "google", "google": { "purchaseToken": "…" } }'}
          </code>
          . Your provider must be configured for that app and store environment.
        </p>
        <CodeBlock language="json">
          {JSON.stringify(evidence, null, 2)}
        </CodeBlock>
        <CodeBlock language="bash">{`curl --fail-with-body "$COMMERCE_BASE_URL${pathOf('verifyPurchase')}" \\
  -H "Authorization: $COMMERCE_VERIFY_AUTH" \\
  -H 'Content-Type: application/json' \\
  --data-binary @evidence.json`}</CodeBlock>
        <p>
          A successful response carries <code>isValid</code>. A store rejection
          is still a successful operation with <code>isValid: false</code>.
          <code> VERIFICATION_FAILED</code> means no verdict was obtained; retry
          according to your failure policy. Neither a verdict nor its advisory
          <code> state</code> identifies the app user or answers their current
          access.
        </p>
        <p>
          Your backend authenticates the user and checks that it may associate
          this purchase with them. Select <code>COMMERCE_USER_ID</code> from
          that session and ownership policy. A user ID submitted by the app and
          possession of a receipt are not sufficient authorization.
        </p>
        <CodeBlock language="bash">{`# Run on your backend; COMMERCE_USER_ID is selected by your authenticated handler.
jq --arg userId "$COMMERCE_USER_ID" '. + {userId: $userId}' \\
  evidence.json > binding.json

curl --fail-with-body "$COMMERCE_BASE_URL${pathOf('bindPurchase')}" \\
  -H "Authorization: $COMMERCE_SERVER_AUTH" \\
  -H 'Content-Type: application/json' \\
  --data-binary @binding.json`}</CodeBlock>
        <p>
          Continue after <code>bound: true</code>. A <code>bound: false</code>
          result intentionally does not distinguish unknown evidence from a
          purchase belonging to someone else. Do not transfer the binding or
          grant access on that result; use your provider’s recovery process. The
          association can remain bound even when the subscription is expired.
        </p>
        <CodeBlock language="bash">{`curl --fail-with-body --get "$COMMERCE_BASE_URL${pathOf('entitlements')}" \\
  -H "Authorization: $COMMERCE_SERVER_AUTH" \\
  --data-urlencode "userId=$COMMERCE_USER_ID"`}</CodeBlock>
        <p>
          Gate product-specific features on membership in{' '}
          <code>productIds</code>. An empty list is a complete answer with no
          current access. An operation error is not an empty list. The{' '}
          <code>subscriptions</code> array contains the tokenless records
          supporting that answer. For a simple “any active subscription?” check,
          use <code>subscriptionStatus.active</code>.
        </p>
        <Callout title="Keep an access decision current">
          This is a decision at provider read time. When caching a supporting
          record, respect its <code>expiresAt</code> and your freshness policy;
          re-read before relying on a stale result. An absent expiry is not a
          promise of permanent access. Never turn a failed refresh into a
          successful grant.
        </Callout>
      </section>

      <section>
        <AnchorLink id="ongoing-access" level="h2">
          4. Handle changes after purchase
        </AnchorLink>
        <p>
          If the provider declares <code>events</code>, register an HTTPS
          backend destination using its management interface and exchange a
          webhook secret. Destination registration is provider-specific. Follow
          the{' '}
          <Link to="/commerce-protocol/implementation#consumer">
            backend architecture
          </Link>{' '}
          to authenticate and persist each delivery before acknowledging it.
        </p>
        <p>
          Use events to trigger an authoritative entitlement refresh when you
          cannot safely correlate purchases, especially across multiple
          subscriptions or product changes. A cancellation disables renewal; it
          does not automatically remove the remaining paid access. Without
          events, use bounded server reads at the points your application needs
          a current answer.
        </p>
        <p>
          When an authenticated user deletes their account, call{' '}
          <Link to="/commerce-protocol/operations#eraseUser">
            <code>eraseUser</code>
          </Link>{' '}
          from your backend. The provider erases its own identity records;
          arrange erasure separately for copies already delivered to your
          backend and connected services.
        </p>
        <p>
          Continue with the{' '}
          <Link to="/commerce-protocol/operations">operation reference</Link>,{' '}
          <Link to="/commerce-protocol/graphql">GraphQL binding</Link>, or{' '}
          <Link to="/commerce-protocol/implementation">
            provider implementation guide
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

export default CommerceGettingStarted;
