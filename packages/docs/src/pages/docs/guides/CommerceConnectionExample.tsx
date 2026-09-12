import { ArrowRight } from 'lucide-react';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import DataTable from '../../../components/DataTable';
import build from '../../../../public/commerce-example/paywall-build.json';

interface Props {
  role: 'experience' | 'commerce' | 'data';
}

interface ConnectionStep {
  title: string;
  action: string;
  result: string;
  file: string;
}

const CONNECTION_STEPS: ConnectionStep[] = [
  {
    title: 'Your paywall',
    action: 'Buy Premium',
    result: 'Your host checks the purchase and opens Premium.',
    file: 'paywall.mjs',
  },
  {
    title: 'Purchase backend',
    action: 'Deliver the update',
    result: 'A signed event reaches your service over HTTP.',
    file: 'delivery.mjs',
  },
  {
    title: 'Your analytics',
    action: 'Read the experiment',
    result:
      'The service joins the purchase to your app’s experiment assignment.',
    file: 'attribution.mjs',
  },
];

interface Outcome {
  action: string;
  result: string;
}

const OUTCOMES: Outcome[] = [
  {
    action: 'Simulate renewal → Deliver events',
    result: 'Onboarding / A: USD 4.99 → USD 9.98.',
  },
  {
    action: 'Cancel renewal → Deliver events → Redeliver saved events',
    result:
      'Premium stays open. Amount and saved event count do not increase on redelivery.',
  },
  {
    action: 'Google fixture → Buy Premium → Deliver events',
    result: 'The same receiver records Onboarding / B with an unknown amount.',
  },
];

export default function CommerceConnectionExample({ role }: Props) {
  const source = `${build.repository}/blob/${build.sourceCommit}`;
  const knownAmount = build.state.report.totals.find(
    (item) => item.variant === 'A'
  );
  return (
    <section className="commerce-connection-example">
      <AnchorLink id="commerce-connection-example" level="h3">
        {role === 'data'
          ? 'See events become experiment data'
          : 'See your paywall and backend connect'}
      </AnchorLink>
      <p>
        AI added a paywall adapter and experiment reporting to the example
        backend. Follow the actual connection and its recorded result.
      </p>
      <ol className="commerce-connection-flow">
        {CONNECTION_STEPS.map((step, index) => (
          <li key={step.file}>
            <span className="commerce-connection-label">
              {index + 1}. {step.title}
            </span>
            <strong>{step.action}</strong>
            <p>{step.result}</p>
            <a href={`${source}/${step.file}`}>
              Code <ArrowRight size={14} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ol>
      <div className="commerce-connection-record">
        <span>
          Recorded after purchase, renewal, cancellation and redelivery
        </span>
        <div>
          <p>
            <strong>
              {knownAmount
                ? `${knownAmount.currency} ${(knownAmount.amountMicros / 1_000_000).toFixed(2)}`
                : 'Unknown'}
            </strong>
            Onboarding / A
          </p>
          <p>
            <strong>{build.state.report.unknownAmounts} unknown</strong>Purchase
            amount · Onboarding / B
          </p>
          <p>
            <strong>{build.state.report.events.length} events</strong>Saved once
            across both store fixtures
          </p>
        </div>
      </div>
      <p className="commerce-connection-note">
        Fictional Apple and Google purchases; real local HTTP, signatures and
        SQLite. These are sample purchase amounts, not net revenue or MRR.
      </p>
      <p>
        <a href="/commerce-example/paywall-verification.md">
          Run and verify this connection
        </a>{' '}
        · <a href={`${source}/paywall.test.mjs`}>Acceptance tests</a> ·{' '}
        <a href="/commerce-example/paywall-harness.json">
          {build.verification.tests} tests + {build.harness.checks} replay
          checks
        </a>
      </p>
      <details>
        <summary>Try it: commands, clicks and expected results</summary>
        <p>
          With Bun and Node.js/npm installed, run in a new folder’s parent
          directory:
        </p>
        <CodeBlock language="bash">{`git clone --branch ${build.branch} --single-branch ${build.repository}.git
cd openiap-commerce-protocol-example
git checkout ${build.sourceCommit}
npm ci
npm run verify
PORT=5198 npm start`}</CodeBlock>
        <p>
          Verification starts an isolated server, exercises the connection,
          restarts it, and saves the actual results to{' '}
          <code>.runtime/verification.json</code>. A failed check exits with an
          error.
        </p>
        <p>
          Open{' '}
          <a href="http://127.0.0.1:5198/paywall">
            your local example dashboard
          </a>
          . Start with <strong>Buy Premium → Deliver events</strong>, then try:
        </p>
        <DataTable
          rows={OUTCOMES}
          rowKey={(row) => row.action}
          columns={[
            { header: 'What to do', cell: (row) => row.action },
            { header: 'What to check', cell: (row) => row.result },
          ]}
        />
        <p>
          The screen shows each request’s destination and response. Restarting
          preserves events and their experiment assignments.{' '}
          <a href="/commerce-example/paywall-source.tar.gz">
            Download the verified source
          </a>
          .
        </p>
        <p>
          <a href="/commerce-example/paywall-harness.json">
            Verified again from a fresh GitHub clone, including server restart
          </a>
        </p>
      </details>
      <details>
        <summary>Verified with a second backend: IAPKit</summary>
        <p>
          The same paywall handler and receiver run against IAPKit’s local
          server. Changing the provider URL, credentials and trusted account
          mapping connects its purchase and renewal events to Onboarding / A.
        </p>
        <p>
          Two fictional USD 5.00 observations produce USD 10.00. Cancellation
          keeps paid access, and redelivery adds nothing. Google events omit
          transaction references here; the explicit account/product mapping
          supplies the experiment association.
        </p>
        <p>
          <a href="/commerce-example/paywall-provider-run.json">
            {build.providerVerification.checks} connection checks and actual
            signed events
          </a>{' '}
          · <a href={`${source}/verify-provider.mjs`}>Executable checks</a> ·{' '}
          <a href="/commerce-example/paywall-provider-reproduction.md">
            Reproduce this provider run
          </a>
        </p>
        <p className="commerce-connection-note">
          HTTP routes, Convex state and signing execute locally. Store and
          identity responses are fixtures. This does not migrate purchases or
          verify real store checkout.
        </p>
      </details>
      <details>
        <summary>View the actual run screen</summary>
        <figure>
          <a href="/commerce-example/paywall-screen.jpg">
            <img
              src="/commerce-example/paywall-screen.jpg"
              alt="Recorded paywall example: Premium is open, experiment A has USD 9.98, and experiment B has one unknown amount, with six events saved."
              loading="lazy"
            />
          </a>
          <figcaption>
            Recorded connection UI.{' '}
            <a href="/commerce-example/paywall-browser-replay.json">
              Latest browser replay
            </a>{' '}
            · <a href="/commerce-example/paywall-mobile.jpg">Mobile screen</a>
          </figcaption>
        </figure>
      </details>
      <details>
        <summary>What your AI implements and what the evidence proves</summary>
        <p>
          Your app owns the paywall and experiment assignment. Commerce Protocol
          supplies purchase/access requests and lifecycle events. Your service
          joins those events to its own experiment records; the protocol adds no
          experiment or revenue-reporting API.
        </p>
        <p>
          AI must preserve unknown amounts, keep currencies separate, and
          deduplicate deliveries by event ID within the authenticated
          emitter/project scope. Refunds need reconciliation; a lifecycle
          event’s price is not the refund amount.
        </p>
        <p>
          <a href={`${source}/evidence/harness-input.md`}>
            Implementation input
          </a>{' '}
          →{' '}
          <a href={`${build.repository}/commit/${build.implementationCommit}`}>
            Code changes
          </a>{' '}
          →{' '}
          <a href="/commerce-example/paywall-harness.json">
            {build.verification.tests} passing tests, including{' '}
            {build.verification.portableCases} REST conformance cases
          </a>
          . This extends an existing example with AI and prior conversation
          context. It does not prove one-prompt success, real store checkout or
          an external product integration.
        </p>
        <p>
          Inspect IAPKit’s{' '}
          <a href="https://github.com/hyodotdev/openiap/blob/main/packages/kit/convex/commerce/deliveryState.ts">
            event builder
          </a>{' '}
          and{' '}
          <a href="https://github.com/hyodotdev/openiap/blob/main/packages/kit/convex/commerce/spec.conformance.test.ts">
            contract checks
          </a>
          . The separate provider run above exercises its local implementation
          with fixture store responses.{' '}
          <a href="/commerce-example/paywall-verification.md">
            Full implementation and verification instructions for AI
          </a>
          .
        </p>
      </details>
    </section>
  );
}
