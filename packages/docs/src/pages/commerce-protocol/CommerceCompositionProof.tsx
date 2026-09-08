import { useState } from 'react';
import { Link } from 'react-router-dom';
import CodeBlock from '../../components/CodeBlock';
import report from '../../../public/commerce-composition/iapkit-run.json';

const STAGES = [
  {
    id: 'before',
    label: '1. Before purchase',
    meaning: 'Alice has no Premium access in either provider.',
  },
  {
    id: 'bound',
    label: '2. Connect the purchase',
    meaning:
      'The same app verifies the same fixture evidence, connects it to Alice’s session, and reads Premium access.',
  },
  {
    id: 'canceled',
    label: '3. Cancel renewal',
    meaning:
      'Both providers stop renewal and preserve the paid period. Their signed cancellation events reach the same receiver, including after a 503 and server restart.',
  },
  {
    id: 'expired',
    label: '4. Reach expiry',
    meaning:
      'Both providers close access at the paid deadline. The subsequent store notification produces an expiry event and one access revocation.',
  },
  {
    id: 'erased',
    label: '5. Delete the account',
    meaning:
      'The app disables Alice’s session, erases its event copies, and completes erasure in both providers. Late signed deliveries cannot restore her identity.',
  },
] as const;
type Stage = (typeof STAGES)[number]['id'];
interface Result {
  productIds?: string[];
  active?: boolean;
  subscription?: { willRenew?: boolean };
}

export default function CommerceCompositionProof(): React.JSX.Element {
  const [stage, setStage] = useState<Stage>('bound');
  return (
    <div className="commerce-composition-proof">
      <p>
        <strong>
          One app backend. One event receiver. Two commerce providers.
        </strong>{' '}
        We kept the app running and changed its provider setting from the
        example to IAPKit, then back again. The consumer code changed in{' '}
        <strong>0 files</strong>.
      </p>
      <p>
        Follow Alice’s subscription below. These are recorded results from
        IAPKit’s real server and Convex storage alongside the original SQLite
        example. Google responses and app sessions are local fixtures; no real
        payment was made.
      </p>
      <div
        className="language-tabs-header"
        role="group"
        aria-label="Compare recorded access results"
      >
        {STAGES.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`language-tab ${stage === item.id ? 'active' : ''}`}
            aria-pressed={stage === item.id}
            onClick={() => setStage(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        key={stage}
        className="commerce-composition-results commerce-build-result"
        aria-live="polite"
      >
        <p style={{ gridColumn: '1 / -1' }}>
          {STAGES.find((item) => item.id === stage)?.meaning}
        </p>
        {Object.entries(report.results).map(([id, provider]) => {
          const result: Result = provider[stage];
          const active = result.productIds
            ? result.productIds.length > 0
            : result.active === true;
          return (
            <div key={id}>
              <h3>{provider.label}</h3>
              <p>
                <strong>
                  {stage === 'erased'
                    ? 'Account identity removed'
                    : active
                      ? 'Premium available'
                      : 'No Premium access'}
                </strong>
              </p>
              {result.subscription?.willRenew !== undefined && (
                <p>
                  Automatic renewal:{' '}
                  {result.subscription.willRenew ? 'on' : 'off'}
                </p>
              )}
              {stage === 'erased' && (
                <p>Erasure job: {provider.erasure.status}</p>
              )}
              <details className="commerce-run-details">
                <summary>Inspect the recorded response</summary>
                <CodeBlock language="json">
                  {JSON.stringify(
                    stage === 'erased'
                      ? { erasure: provider.erasure, access: result }
                      : result,
                    null,
                    2
                  )}
                </CodeBlock>
              </details>
            </div>
          );
        })}
      </div>
      <h3>Choose the store your app will use</h3>
      <p>
        The same verification, ownership, access, and erasure path also runs for
        Apple, Amazon, and Meta Horizon. Amazon and Horizon are checked again on
        access reads, including rejection and upstream failure; their results
        contain no invented subscription lifecycle records.
      </p>
      <div className="commerce-implementation-pair-grid">
        {(['apple', 'google', 'amazon', 'horizon'] as const).map((store) => (
          <Link
            key={store}
            to={`/commerce-protocol/getting-started?store=${store}#purchase-buy`}
          >
            {
              {
                apple: 'Follow Apple',
                google: 'Follow Google Play',
                amazon: 'Follow Amazon',
                horizon: 'Follow Meta Horizon',
              }[store]
            }{' '}
            →
          </Link>
        ))}
      </div>
      <p>
        Store responses, Apple signature verification, and account sessions are
        fixtures in this run. It does not establish device checkout or Nami SDK
        compatibility. Read the{' '}
        <a href="/commerce-source/kit/scripts/docs/commerce-store-coverage.mjs.html">
          store comparison code
        </a>
        .
      </p>
      <h3>What your team changes</h3>
      <p>
        Choose the provider URL and server credential, register the event
        receiver, and agree on product IDs and account ownership. Your
        purchase-to-access code and receiver keep the same contract. A provider
        switch also needs a plan for existing purchase records: this test sets
        up the same fixture purchase in each provider; it does not migrate a
        customer database.
      </p>
      <p>
        AI can wire those settings and run this check. Your team reviews whether
        the access, cancellation, and deletion results match your product’s
        policy.
      </p>
      <details className="commerce-run-details">
        <summary>Read the app, provider, and receiver code</summary>
        <p>
          <a href="/commerce-source/example/composition/app-backend.mjs.html">
            App backend
          </a>{' '}
          authenticates the session, calls the selected provider, and keeps
          deletion requests until every provider completes them.{' '}
          <a href="/commerce-source/example/composition/commerce-client.mjs.html">
            Commerce client
          </a>{' '}
          gets its routes and validators from the installed contract.
        </p>
        <p>
          <a href="/commerce-source/example/provider.mjs.html">
            Example provider
          </a>{' '}
          runs the flow in SQLite.{' '}
          <a href="/commerce-source/kit/server/api/commerce/handlers.ts.html">
            IAPKit handlers
          </a>{' '}
          connect the same operations to store verification and Convex.{' '}
          <a href="/commerce-source/example/webhooks.mjs.html">
            The shared receiver
          </a>{' '}
          checks signatures, deduplicates events, and discards erased
          identities.
        </p>
        <p>
          The event timing differs: the example emits a grant when Alice is
          bound. IAPKit combines binding with a store notification. Both produce
          the same access decision and a correlated grant in this run.
        </p>
      </details>
      <details className="commerce-run-details">
        <summary>Run the same replacement check</summary>
        <p>
          Install dependencies in both checkouts with Bun 1.3.13 and Node.js 24
          available. From the OpenIAP repository:
        </p>
        <CodeBlock language="bash">{`bun install --frozen-lockfile
(cd ../openiap-commerce-protocol-example && npm ci --ignore-scripts)
bun --conditions=openiap-source packages/kit/scripts/docs/run-commerce-interop.mjs \\
  ../openiap-commerce-protocol-example`}</CodeBlock>
        <p>
          The command creates an isolated local Convex deployment, seeds
          fictional data, and exits nonzero on a failed assertion. It needs an
          initial download of the pinned Convex backend. No store credentials,
          IAPKit account, or cloud deployment variables are needed.
        </p>
        <p>
          <a href="/commerce-source/kit/scripts/docs/run-commerce-interop.mjs.html">
            Read the test runner
          </a>{' '}
          ·{' '}
          <a href="/commerce-composition/iapkit-run.json">
            Inspect the executed report
          </a>
        </p>
      </details>
      <details className="commerce-run-details">
        <summary>What the evidence covers</summary>
        <p>
          {report.checkCount} checks passed on {report.recordedAt.slice(0, 10)}.
          The run restarted the actual local Convex process with an event retry
          pending, reopened SQLite, replayed acknowledged events, and checked
          provider and recipient erasure.
        </p>
        <p>
          IAPKit’s route handlers, all four store verification action bodies,
          Google notification handling, database functions, deletion scheduler,
          and signing worker execute. External store responses and Apple
          signature verification are fixtures; the worker’s existing transport
          hook sends to localhost. Real store purchases and public HTTPS DNS/TLS
          are separate deployment checks.
        </p>
        <p>
          The first run exposed a missing IAPKit revocation after the clock
          passed expiry. The corrected handler and two regression cases now pass
          alongside this full replay.
        </p>
        <p>
          The earlier{' '}
          <a href="/commerce-composition/run.json">
            SQLite and memory comparison
          </a>{' '}
          remains a separate storage-adapter experiment.
        </p>
      </details>
      <p>
        <Link to="/commerce-protocol/implementation#build-brief">
          Use this acceptance flow in your AI brief →
        </Link>
      </p>
    </div>
  );
}
