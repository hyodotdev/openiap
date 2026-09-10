import { COMMERCE_PROTOCOL_INSTALL } from '../../lib/config';
import { COMMERCE_PROTOCOL_LINKS } from '../../lib/config';
import { Link, useLocation } from 'react-router-dom';
import httpBinding from '@hyodotdev/openiap-commerce-protocol/generated/bindings/http-binding.json';
import evidence from '@hyodotdev/openiap-commerce-protocol/examples/verify-purchase-request.json';
import AnchorLink from '../../components/AnchorLink';
import Callout from '../../components/Callout';
import CodeBlock from '../../components/CodeBlock';
import PackageInstall from '../../components/PackageInstall';
import SEO from '../../components/SEO';
import CommercePurchaseJourney from '../../components/CommercePurchaseJourney';
import { COMMERCE_IMPLEMENTATIONS } from '../../lib/commerceImplementations';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function CommerceGettingStarted(): React.JSX.Element {
  useScrollToHash();
  const { search } = useLocation();
  const pathOf = (name: string): string =>
    httpBinding.operations.find((operation) => operation.name === name)!.path;

  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol: Follow a Purchase"
        path="/commerce-protocol/getting-started"
        description="Connect your backend to a provider: verify a purchase, bind it to a user, and read access."
      />
      <h1>Follow one purchase.</h1>
      <p>
        Alice buys Premium in your app. Follow her purchase from the store’s
        payment screen to the moment she can open paid content.
      </p>
      <p>
        At each step, compare two implementations:{' '}
        <a href={COMMERCE_IMPLEMENTATIONS.example.url}>
          openiap-commerce-protocol-example
        </a>{' '}
        makes the flow visible with a local dashboard and fictional purchases;{' '}
        <a href={COMMERCE_IMPLEMENTATIONS.kit.url}>IAPKit</a> connects the same
        contract to store services. Follow the behavior first, then open either
        implementation’s code when you need it.
      </p>
      <p>
        Apple and Google subscription changes arrive through store
        notifications. Amazon and Horizon access is rechecked with the store
        when your backend requests it. Choose your store below to follow the
        matching path.
      </p>
      <div id="purchase-flow">
        <CommercePurchaseJourney />
      </div>
      <p className="commerce-guide-next">
        <Link to="/commerce-protocol/ecosystem#composition-proof">
          See the same app switch between the example and IAPKit →
        </Link>
      </p>
      <p className="commerce-guide-next">
        Ready to build?{' '}
        <Link to={{ pathname: '/commerce-protocol/implementation', search }}>
          Choose your services and build it →
        </Link>
      </p>
      <details className="commerce-run-details commerce-technical-reference">
        <summary>Implementation reference: requests and receiver setup</summary>
        <p>
          Use these details when wiring a backend or checking your AI’s code.
        </p>
        <section>
          <AnchorLink id="receive-events" level="h2">
            Receive subscription changes
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
            The <a href={COMMERCE_PROTOCOL_LINKS.example}>example repository</a>{' '}
            includes the receiver and executable checks. AI can reuse it to
            demonstrate signed delivery, retries, tamper rejection, and
            preserved inbox entries after reopening storage.
          </p>
          <details>
            <summary>Run the receiver example locally</summary>
            <p>
              Clone the repository, install Bun for its runtime, then install
              dependencies and run the demo. This fixture check requires no
              credentials or external services.
            </p>
            <PackageInstall />
            <CodeBlock language="bash">{`npm run demo:consumer`}</CodeBlock>
            <p>
              <a href="/commerce-example/consumer-run.json">
                Recorded results and payloads
              </a>
            </p>
          </details>
          <details>
            <summary>Connect the receiver to your provider</summary>
            <p>
              Set <code>COMMERCE_WEBHOOK_SECRET</code> to your provider’s
              signing secret, then run <code>npm run consumer</code>. The ready
              endpoint is
              <code> http://127.0.0.1:5182/webhooks/commerce</code>. Put it
              behind your HTTPS reverse proxy, forwarding the exact body bytes
              to that local address, and register the HTTPS URL with your
              provider. The receiver accepts the public Host header forwarded by
              the proxy; its signature check authenticates the sender.
            </p>
            <p>
              Use one emitter/project and signing key per receiver database.
              <code> consumer.sqlite</code> is the durable inbox; set
              <code> COMMERCE_INBOX_PATH</code> for your persistent storage
              path. To embed the same Fetch-compatible handler in your server,
              use
              <code> createReceiver</code> from <code>webhooks.mjs</code>.
            </p>
            <p>
              The inbox preserves the signed event for your existing processing
              pipeline. Transaction and price fields are optional; a missing
              price is unknown. Each lifecycle event is not necessarily a new
              charge. Keep financial calculations in your business logic.
            </p>
          </details>
        </section>

        <section>
          <AnchorLink id="install-contract" level="h2">
            1. Install the contract
          </AnchorLink>
          <p>
            The first usable scoped release is being prepared. This alias
            installs the published 0.1.0 contract under its new import name.
          </p>
          <PackageInstall packageName={COMMERCE_PROTOCOL_INSTALL} />
          <p>
            The package gives your backend the contract, schemas, and
            conformance tools. Obtain a compatible provider endpoint and
            credentials separately.
          </p>
          <p>
            To explore first, open the{' '}
            <Link to="/commerce-protocol#build-walkthrough">
              recorded purchase flow
            </Link>
            , or{' '}
            <Link
              to={{
                pathname: '/commerce-protocol/implementation',
                search,
                hash: '#local-example',
              }}
            >
              run the reference dashboard
            </Link>
            . To implement your own provider, give your AI the{' '}
            <Link
              to={{
                pathname: '/commerce-protocol/implementation',
                search,
                hash: '#build-brief',
              }}
            >
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
            Obtain the base URL, supported store configuration, and
            Authorization header values from your provider. A provider issues
            its own credentials; OpenIAP has no registration service. Keep the
            server credential in your backend. These shell examples assume{' '}
            <code>curl</code> and <code>jq</code>.
          </p>
          <CodeBlock language="bash">{`export COMMERCE_BASE_URL='https://your-provider.example'
# Set these through your local secret manager or environment.
# COMMERCE_VERIFY_AUTH: complete Authorization header value for verification
# COMMERCE_SERVER_AUTH: complete Authorization header value for the server role

curl --fail-with-body "$COMMERCE_BASE_URL${pathOf('providerCapabilities')}"`}</CodeBlock>
          <p>
            Inspect <code>profiles</code>, <code>bindings</code>, and the
            selected store’s <code>implementation</code> support. This flow
            needs <code>verification</code>, <code>accountLifecycle</code>,{' '}
            <code>entitlements</code>, and <code>rest</code> at compatible major
            versions. An events-only descriptor does not establish operation
            support. See{' '}
            <Link to="/commerce-protocol/capabilities">capabilities</Link> for
            the full descriptor.
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
            . Your provider must be configured for that app and store
            environment.
          </p>
          <CodeBlock language="json">
            {JSON.stringify(evidence, null, 2)}
          </CodeBlock>
          <CodeBlock language="bash">{`curl --fail-with-body "$COMMERCE_BASE_URL${pathOf('verifyPurchase')}" \\
  -H "Authorization: $COMMERCE_VERIFY_AUTH" \\
  -H 'Content-Type: application/json' \\
  --data-binary @evidence.json`}</CodeBlock>
          <p>
            A successful response carries <code>isValid</code>. A store
            rejection is still a successful operation with{' '}
            <code>isValid: false</code>.<code> VERIFICATION_FAILED</code> means
            no verdict was obtained; retry according to your failure policy.
            Neither a verdict nor its advisory
            <code> state</code> identifies the app user or answers their current
            access.
          </p>
          <p>
            Your backend authenticates the user and checks that it may associate
            this purchase with them. Select <code>COMMERCE_USER_ID</code> from
            that session and ownership policy. A user ID submitted by the app
            and possession of a receipt are not sufficient authorization.
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
            grant access on that result; use your provider’s recovery process.
            The association can remain bound even when the subscription is
            expired.
          </p>
          <CodeBlock language="bash">{`curl --fail-with-body --get "$COMMERCE_BASE_URL${pathOf('entitlements')}" \\
  -H "Authorization: $COMMERCE_SERVER_AUTH" \\
  --data-urlencode "userId=$COMMERCE_USER_ID"`}</CodeBlock>
          <p>
            Gate product-specific features on membership in{' '}
            <code>productIds</code>. An empty list is a complete answer with no
            current access. An operation error is not an empty list. The{' '}
            <code>subscriptions</code> array contains the tokenless records
            supporting that answer. For a simple “any active subscription?”
            check, use <code>subscriptionStatus.active</code>.
          </p>
          <Callout title="Keep an access decision current">
            This is a decision at provider read time. When caching a supporting
            record, respect its <code>expiresAt</code> and your freshness
            policy; re-read before relying on a stale result. An absent expiry
            is not a promise of permanent access. Never turn a failed refresh
            into a successful grant.
          </Callout>
        </section>

        <section>
          <AnchorLink id="ongoing-access" level="h2">
            4. Handle changes after purchase
          </AnchorLink>
          <p>
            If the provider declares <code>events</code>, register an HTTPS
            backend destination using its management interface and exchange a
            webhook secret. Destination registration is provider-specific.
            Follow the{' '}
            <Link to="/commerce-protocol/implementation#consumer">
              backend architecture
            </Link>{' '}
            to authenticate and persist each delivery before acknowledging it.
          </p>
          <p>
            Use events to trigger an authoritative entitlement refresh when you
            cannot safely correlate purchases, especially across multiple
            subscriptions or product changes. A cancellation disables renewal;
            it does not automatically remove the remaining paid access. Without
            events, use bounded server reads at the points your application
            needs a current answer.
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
      </details>
    </div>
  );
}

export default CommerceGettingStarted;
