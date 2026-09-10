import { COMMERCE_PROTOCOL_INSTALL } from '../../lib/config';
import CommerceImplementationComparison from '../../components/CommerceImplementationComparison';
import {
  COMMERCE_IMPLEMENTATIONS,
  COMMERCE_STORE_LABELS,
  isCommerceStore,
} from '../../lib/commerceImplementations';
import { COMMERCE_PROTOCOL_LINKS, IAPKIT_URL } from '../../lib/config';
import { Link, useLocation } from 'react-router-dom';
import type { To } from 'react-router-dom';
import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';

const EXAMPLE = COMMERCE_PROTOCOL_LINKS.example;

function CommerceImplementation(): React.JSX.Element {
  useScrollToHash(120);
  const { search } = useLocation();
  const store = new URLSearchParams(search).get('store');
  const recheck = store === 'amazon' || store === 'horizon';
  const journey = (hash = ''): To => ({
    pathname: '/commerce-protocol/getting-started',
    search,
    hash,
  });
  return (
    <div className="doc-page commerce-implementation">
      <SEO
        title="Commerce Protocol: Build and review"
        path="/commerce-protocol/implementation"
        description="Define your product and expected behavior. Give AI the Commerce Protocol contract and working example, then review the running result."
      />
      <h1>Build your purchase flow.</h1>
      <p>
        Choose who runs the purchase backend, describe what your users should
        experience, and review a running app.
      </p>
      <p>
        If the pieces are still unfamiliar,{' '}
        <Link to={journey()}>follow Alice’s purchase first</Link>. You do not
        need to learn the API names to decide what your product should do.
      </p>
      <nav className="commerce-actions" aria-label="Build guide steps">
        <Link to={{ search, hash: '#iapkit' }}>1. Choose your services</Link>
        <span>→</span>
        <Link to={{ search, hash: '#build-brief' }}>2. Give AI the brief</Link>
        <span>→</span>
        <Link to={{ search, hash: '#acceptance' }}>3. Try the result</Link>
      </nav>
      <section>
        <AnchorLink id="iapkit" level="h2">
          1. Choose your services
        </AnchorLink>
        <p>
          For an existing app, keep your login and paywall. Choose who will
          verify purchases and maintain access.
        </p>
        <div className="commerce-role-benefits">
          <article>
            <h3>Use a managed service</h3>
            <p>
              <a href={IAPKIT_URL}>IAPKit</a> runs purchase verification,
              subscription records, and event delivery. Your backend calls it to
              authorize your users.
            </p>
          </article>
          <article>
            <h3>Run your own backend</h3>
            <p>
              Use <a href={EXAMPLE}>openiap-commerce-protocol-example</a> to
              build in your stack. Your team runs the store connections,
              database, and delivery worker.
            </p>
          </article>
        </div>
        <p>
          Building a paywall or data service instead?{' '}
          <Link to="/commerce-protocol/ecosystem">
            Choose the part your business owns
          </Link>
          ; you do not need to build the whole purchase backend.
        </p>
        <CommerceImplementationComparison topic="rest" />
        <p>
          Follow the same{' '}
          <Link to={journey('#purchase-verify')}>verification</Link>,{' '}
          <Link to={journey('#purchase-bind')}>ownership</Link>, and{' '}
          <Link to={journey('#purchase-access')}>access</Link> steps in both
          projects. A provider switch also needs compatible capabilities,
          credentials, store evidence, and a plan for purchase history; the{' '}
          <Link to="/commerce-protocol/ecosystem#composition-proof">
            composition checks
          </Link>{' '}
          show what has been exercised locally.
        </p>
      </section>
      <section>
        <AnchorLink id="build-brief" level="h2">
          2. Give AI the brief
        </AnchorLink>
        <p>
          Open the brief, copy it into your coding agent, and fill in your
          product and service choices. The agent can inspect your existing
          stack. For example: “Add Premium subscriptions to my app. Use IAPKit
          for verification and access; keep my existing login and paywall.”
        </p>
        <details className="commerce-run-details">
          <summary>Open the brief to copy</summary>
          <CodeBlock language="text">{`Integrate OpenIAP Commerce Protocol into this project.
Product and desired behavior: [what users should be able to do].
Store and product type: ${isCommerceStore(store) ? COMMERCE_STORE_LABELS[store] : '[Apple, Google Play, Amazon, or Meta Horizon]'}; [subscription, durable purchase, or consumable].
Services to use or own: [name them, or ask me to choose].

Implementation references:
- Runnable teaching backend: ${EXAMPLE}
- IAPKit service source: ${COMMERCE_IMPLEMENTATIONS.kit.url}
- Step-by-step comparison: https://openiap.dev/commerce-protocol/getting-started${search}
Read ${COMMERCE_PROTOCOL_LINKS.integrationBrief} for my role; follow ${COMMERCE_PROTOCOL_LINKS.buildBrief} for a commerce backend. Compare each responsibility with IAPKit's corresponding handler and tests. The example uses fictional purchases and all six REST operations, including erasure; IAPKit also shows store integrations and GraphQL. Use the contract as the authority, not either implementation's shortcuts.
Check the chosen store and product type before implementing. IAPKit's Apple/Google subscription path uses subscription state and lifecycle events. Its Amazon/Horizon ownership path rechecks saved evidence on entitlements reads; use productIds, not subscription expiry or invented events. Authenticate the store account link on the app backend. Keep consumable quantities in a separate durable fulfillment ledger.
Inspect this project's instructions and stack. Install ${COMMERCE_PROTOCOL_INSTALL}; use its SPEC.md, generated bindings/schemas, and conformance tools as the contract.

Implement the connection using existing project patterns. Start with a runnable local result. For a provider, complete every selected profile, including account erasure and event delivery; advertise only completed profiles and bindings. Run the applicable conformance and product checks. Fix every failure and rerun; a test that expects a known failure does not complete the implementation. Repeat installation, tests, and startup from a clean source-only copy.
Show the running URL and user-visible outcomes, with source and verification commands for future changes. Separate fixture evidence from real store/deployment checks; list remaining work and product decisions.
Keep changes uncommitted for review.`}</CodeBlock>
          <p>
            The reference repository contains a backend, dashboard, database,
            event receiver, and tests. The{' '}
            <a href={COMMERCE_PROTOCOL_LINKS.integrationBrief}>
              integration brief
            </a>{' '}
            scopes the role; the{' '}
            <a href={COMMERCE_PROTOCOL_LINKS.buildBrief}>backend build brief</a>{' '}
            defines seven implementation milestones, including account erasure.
            The running fixture covers all six REST operations. Complete the
            real store, authentication, isolation, and deployment obligations of
            your selected profiles before using it as a production provider.
          </p>
        </details>
      </section>
      <section>
        <AnchorLink id="acceptance" level="h2">
          3. Try it as your customer
        </AnchorLink>
        <p>
          Have AI start the app and give you the URL. Then follow this sequence
          using two test accounts, Alice and Bob:
        </p>
        <ol className="commerce-source-steps">
          <li>
            <strong>Buy as Alice.</strong> Complete a test purchase and open the
            paid feature. Try a pending or canceled purchase too; neither should
            unlock it.
          </li>
          <li>
            <strong>Switch to Bob.</strong> He must not see Alice’s paid content
            or take her purchase by submitting the same receipt.
          </li>
          <li>
            <strong>Recheck Alice’s access.</strong> For Apple/Google
            subscriptions, cancel renewal: paid content stays open until expiry.
            For Amazon/Horizon, return a negative store ownership answer:
            Premium disappears from the allowed products. Simulate a store
            outage too: it must report a failed read, then recover when the
            store is available. Reload at each point.
          </li>
          <li>
            <strong>Repeat and restart.</strong> Retry a purchase, then restart
            the backend. Ownership and access remain correct, with no duplicate
            fulfillment. If your provider emits lifecycle events, retry their
            delivery too. IAPKit currently emits those events for Apple/Google
            subscriptions.
          </li>
          <li>
            <strong>Delete Alice.</strong> Check that her identity is removed
            from the provider’s records and your own stored event copies. Bob’s
            records remain intact.
          </li>
        </ol>
        <p>
          Ask AI to run the same checks automatically and show any failures.
          Keep those checks with the source, so the next change can be reviewed
          against the same behavior.
        </p>
        <p>
          Start with test purchases. Before releasing, repeat the relevant flow
          with your store sandbox, real login, and deployed backend. Passing the{' '}
          <Link to="/commerce-protocol/conformance">contract checks</Link> and
          completing a real store purchase answer different questions; ask for
          both results.
        </p>
        <details className="commerce-run-details">
          <summary>Run the checks in both reference projects</summary>
          <CommerceImplementationComparison topic="checks" />
        </details>
        <details className="commerce-run-details">
          <summary>Additional exercise: AI built a new fixture app</summary>
          <p>
            Field Notes is a subscription app built from the brief alone, in
            Node.js and SQLite, then reinstalled and rechecked in a clean copy.
          </p>
          <p>
            <a href="/commerce-example/ai-reproduction.md">
              Read the reproduction record
            </a>{' '}
            for the prompt, runnable source, checks, and corrections. This
            exercise covers a local fixture app; real stores and production
            integration were not tested.
          </p>
        </details>
      </section>
      <section>
        <AnchorLink id="architecture" level="h2">
          Keep the next change small
        </AnchorLink>
        <p>
          {recheck
            ? 'For Amazon and Horizon, keep the store check and the app’s access policy separate. Both projects recheck linked purchases before returning allowed products. A rejected purchase and an unavailable store are different outcomes.'
            : 'For Apple/Google subscriptions, keep Premium available until the paid period ends. Both projects keep that decision in one function. Your database and event worker can change without rewriting what “has access” means.'}
        </p>
        <div id="access-rule">
          <CommerceImplementationComparison
            topic={recheck ? 'storeAccess' : 'access'}
          />
        </div>
        <p id="consumer">
          For a new store, compare the{' '}
          <Link to={journey('#purchase-verify')}>verification adapters</Link>.
          For a new data service, compare the{' '}
          <Link to="/commerce-protocol/webhooks">sender and receiver</Link>. Ask
          AI to change the part that owns the behavior and rerun its checks.
        </p>
        <details className="commerce-run-details">
          <summary>Account deletion: finish the responsibility</summary>
          <CommerceImplementationComparison topic="erase" />
        </details>
      </section>
      <section>
        <AnchorLink id="local-example" level="h2">
          Run the reference when you need it
        </AnchorLink>
        <p>
          AI can start the example dashboard for you. It runs locally without
          store credentials or environment variables, using Bun for HTTP and
          SQLite. The protocol itself does not require Bun.
        </p>
        <details className="commerce-run-details">
          <summary>Manual setup and runtime details</summary>
          <CodeBlock language="bash">{`git clone ${EXAMPLE}.git
cd openiap-commerce-protocol-example
npm ci
npm test
npm start`}</CodeBlock>
          <p>
            Open <code>http://127.0.0.1:5181</code> and select{' '}
            <strong>Run step 1 →</strong>. HTTP, storage, and signatures are
            real local operations; store evidence and the clock are fixtures.
            Startup creates temporary databases; the recovery step reopens them
            inside the same process. The{' '}
            <a href={`${EXAMPLE}#quick-start`}>README</a> has the full runtime
            and replay instructions.
          </p>
        </details>
      </section>
    </div>
  );
}

export default CommerceImplementation;
