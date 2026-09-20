import { useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  ChevronRight,
  Database,
  Hourglass,
  LockKeyhole,
  Mail,
  Monitor,
  ReceiptText,
  Send,
  Server,
  Terminal,
  UnlockKeyhole,
  UserRound,
  UserRoundX,
} from 'lucide-react';
import { Link, useNavigationType } from 'react-router-dom';
import CodeBlock from './CodeBlock';
import CommerceImplementationComparison from './CommerceImplementationComparison';
import { COMMERCE_PROTOCOL_LINKS } from '../lib/config';
import {
  COMMERCE_IMPLEMENTATIONS,
  COMMERCE_IMPLEMENTATION_TOPICS,
} from '../lib/commerceImplementations';
import recording from '../../public/commerce-example/run.json';

const RECORDING = '/commerce-example';
const BUILD_STEPS = [
  {
    topic: 'capabilities',
    label: 'Start server',
    icon: Server,
    sourceLine: 89,
    result:
      'The server is running. No purchase has been saved, so Alice has no Premium access.',
  },
  {
    topic: 'verify',
    label: 'Check purchase',
    icon: ReceiptText,
    sourceLine: 110,
    result:
      'The server now knows what was bought. Next, tell it who gets Premium.',
  },
  {
    topic: 'bind',
    label: 'Unlock Premium',
    icon: UnlockKeyhole,
    sourceLine: 143,
    result: 'The same purchase now belongs to Alice. Bob cannot claim it.',
  },
  {
    topic: 'status',
    label: 'Cancel renewal',
    icon: CalendarClock,
    sourceLine: 183,
    result:
      'Alice cancels the next renewal. Premium stays available for the time she already paid for.',
  },
  {
    topic: 'events',
    label: 'Retry delivery',
    icon: Send,
    sourceLine: 207,
    result:
      'A subscription update fails to reach the receiving server. A retry succeeds; sending it again saves no extra copy.',
  },
  {
    topic: 'access',
    label: 'Expire access',
    icon: Hourglass,
    sourceLine: 256,
    result:
      'The paid period ends, so Alice loses Premium. Reopening the database preserves the purchase and notification records.',
  },
  {
    topic: 'erase',
    label: 'Delete account',
    icon: UserRoundX,
    sourceLine: 302,
    result:
      'Alice’s identity is removed from the purchase and saved notifications. Retrying the old binding cannot restore it.',
  },
] as const;

interface ExampleRequest {
  method: 'GET' | 'POST';
  path: string;
  input: Record<string, string>;
  role: 'verification' | 'server';
}

interface ResponseExcerpt {
  label: string;
  operation: string;
  httpStatus?: number;
  fields: string[];
}

interface StepExecution {
  purpose: string;
  context?: string;
  code?: string;
  requests?: ExampleRequest[];
  results: ResponseExcerpt[];
}

const STEP_EXECUTION: Record<number, StepExecution> = {
  2: {
    purpose: 'Check the receipt for monthly Premium and save the purchase.',
    context:
      'fixture and local-purchase-alice identify the example’s fictional store and receipt. No payment is made.',
    requests: [
      {
        method: 'POST',
        path: '/commerce/v1/purchases/verify',
        role: 'verification',
        input: { store: 'fixture', evidence: 'local-purchase-alice' },
      },
    ],
    results: [
      {
        label: 'Receipt accepted',
        operation: 'verifyPurchase',
        httpStatus: 200,
        fields: ['isValid', 'productId'],
      },
    ],
  },
  3: {
    purpose:
      'Assign that purchase to Alice, then ask which products she can use.',
    requests: [
      {
        method: 'POST',
        path: '/commerce/v1/purchases/bind',
        role: 'server',
        input: {
          store: 'fixture',
          evidence: 'local-purchase-alice',
          userId: 'demo_alice',
        },
      },
      {
        method: 'GET',
        path: '/commerce/v1/entitlements',
        role: 'server',
        input: { userId: 'demo_alice' },
      },
    ],
    results: [
      {
        label: 'Purchase assigned',
        operation: 'bindPurchase',
        httpStatus: 200,
        fields: ['bound'],
      },
      {
        label: 'Alice’s products',
        operation: 'entitlements',
        httpStatus: 200,
        fields: ['productIds'],
      },
    ],
  },
  4: {
    purpose:
      'Alice turns off renewal. Record the store’s update and check whether she still has access.',
    context:
      'The example injects a fictional store notification. This code simulates cancellation; it does not cancel a subscription in Apple or Google.',
    code: `runtime.time = FIXTURE.startsAt + 86_400_000;
runtime.provider.observe({
  id: "fixture-cancel",
  kind: "cancel",
  occurredAt: runtime.time,
});`,
    requests: [
      {
        method: 'GET',
        path: '/commerce/v1/subscriptions/status',
        role: 'server',
        input: { userId: 'demo_alice' },
      },
    ],
    results: [
      {
        label: 'Renewal off, access on',
        operation: 'subscriptionStatus',
        httpStatus: 200,
        fields: ['active', 'subscription.willRenew'],
      },
    ],
  },
  5: {
    purpose:
      'Tell your app’s backend that Alice’s subscription changed, even if the first delivery fails.',
    context:
      'deliver reads the saved event queue. The first call simulates a 503 failure; runtime.post then sends signed HTTP requests to the example’s /demo/receiver.',
    code: `await deliver(
  runtime.provider, runtime.secret, runtime.now,
  async () => new Response(null, { status: 503 }),
);

runtime.restart();
runtime.time += 30_000;
await deliver(
  runtime.provider, runtime.secret, runtime.now,
  runtime.post,
);`,
    results: [
      {
        label: '1. Simulated failure',
        operation: 'webhook: receiver unavailable',
        fields: ['httpStatus', 'status'],
      },
      {
        label: '2. Retry after 30 seconds',
        operation: 'webhook: retry after restart',
        fields: ['httpStatus', 'status'],
      },
      {
        label: '3. Send the same event again',
        operation: 'webhook: lost-ack redelivery',
        fields: ['httpStatus', 'status'],
      },
    ],
  },
  6: {
    purpose:
      'The paid month ends. Check that Alice loses Premium even before the expiry notification arrives.',
    context:
      'The example moves its simulated clock to the expiry time, so you can check this without waiting a month.',
    code: `runtime.time = FIXTURE.expiresAt;`,
    requests: [
      {
        method: 'GET',
        path: '/commerce/v1/entitlements',
        role: 'server',
        input: { userId: 'demo_alice' },
      },
    ],
    results: [
      {
        label: 'No paid products remain',
        operation: 'entitlements',
        httpStatus: 200,
        fields: ['productIds'],
      },
    ],
  },
  7: {
    purpose:
      'Alice deletes her account. Erase her data from the app’s receiver and the purchase server.',
    context:
      'The app removes its saved event copies first. The HTTP request then removes Alice’s identity from the purchase server.',
    code: `runtime.receiver.eraseUser(FIXTURE.userId);`,
    requests: [
      {
        method: 'POST',
        path: '/commerce/v1/users/erase',
        role: 'server',
        input: { userId: 'demo_alice' },
      },
    ],
    results: [
      {
        label: 'Erasure completed',
        operation: 'eraseUser',
        httpStatus: 202,
        fields: ['accepted', 'status'],
      },
      {
        label: 'Old binding retry refused',
        operation: 'bindPurchase',
        httpStatus: 200,
        fields: ['bound'],
      },
    ],
  },
};

function requestPath(request: ExampleRequest): string {
  return request.method === 'GET'
    ? `${request.path}?${new URLSearchParams(request.input)}`
    : request.path;
}

function requestCommand(request: ExampleRequest): string {
  const lines = [
    `curl -fsS -X ${request.method}`,
    `  'http://127.0.0.1:5181${requestPath(request)}'`,
    `  -H 'Authorization: Bearer local-demo-${request.role}'`,
  ];
  if (request.method === 'POST')
    lines.push(
      `  -H 'Content-Type: application/json'`,
      `  -d '${JSON.stringify(request.input)}'`
    );
  return lines.join(' \\\n');
}

function responseValue(body: unknown, path: string): string {
  let value = Array.isArray(body) ? body[0] : body;
  for (const key of path.split('.')) {
    value =
      value && typeof value === 'object'
        ? (value as Record<string, unknown>)[key]
        : undefined;
  }
  return JSON.stringify(value) ?? 'Not recorded';
}

interface RecordedPurchase {
  userId: string | null;
  productId: string;
  state: string;
  willRenew: number;
}

interface Milestone {
  step: number;
  title: string;
  built: string;
  result: string;
  screenshot: string;
  access: { productIds: string[] };
  purchases: RecordedPurchase[];
  inboxCount: number;
  checks: string[];
  responses: { operation: string; httpStatus?: number; body: unknown }[];
  build: {
    label: string;
    request: string;
    change: string;
    review: string;
    source: string;
    changes: string;
    report: string;
    passed: number;
  };
}

interface RecordedRun {
  recordedAt: string;
  checks: string[];
  milestones: Milestone[];
  standalone: { version: string; passed: number };
}

const run: RecordedRun = recording;

function CommerceBuildWalkthrough({
  selected,
  onSelect,
  autoScroll = true,
}: {
  selected: number;
  onSelect: (step: number) => void;
  autoScroll?: boolean;
}): React.JSX.Element {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const navigationType = useNavigationType();
  const selectedIndex = run.milestones.findIndex(
    (milestone) => milestone.step === selected
  );
  const resolvedIndex = selectedIndex < 0 ? 0 : selectedIndex;
  const step = run.milestones[resolvedIndex];
  const explanation = BUILD_STEPS[resolvedIndex];
  const previousStepRef = useRef(step?.step);

  useEffect(() => {
    const stepChanged = previousStepRef.current !== step?.step;
    previousStepRef.current = step?.step;
    if (!step || (!autoScroll && !stepChanged)) return;
    const frame = requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true });
      if (!autoScroll) return;
      tabsRef.current?.scrollIntoView({
        block: 'start',
        behavior:
          navigationType === 'POP' ||
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'instant'
            : 'smooth',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [step, navigationType, autoScroll]);

  if (!step) return <p role="status">No recorded checkpoints are available.</p>;
  const hasAccess = step.access.productIds.length > 0;
  const AccessIcon = hasAccess ? UnlockKeyhole : LockKeyhole;
  const nextStep = BUILD_STEPS[resolvedIndex + 1];
  const execution = STEP_EXECUTION[step.step];
  const showPurchaseChange = step.step === 2 || step.step === 3;
  const purchaseSnapshots = showPurchaseChange
    ? [
        { label: 'Before', milestone: run.milestones[resolvedIndex - 1] },
        { label: `After step ${step.step}`, milestone: step },
      ]
    : [];
  const exampleCode =
    COMMERCE_IMPLEMENTATION_TOPICS[explanation?.topic ?? 'checks'].example;
  const exampleCodeLine = 'line' in exampleCode ? `#L${exampleCode.line}` : '';
  const dashboardEvidence = [
    { label: 'Saved purchases', value: String(step.purchases.length) },
    { label: 'Alice’s access', value: hasAccess ? 'Premium' : 'No access' },
    showPurchaseChange
      ? {
          label: 'Purchase storage → User',
          value: step.purchases[0]?.userId ?? 'Unbound',
        }
      : { label: 'Receiver inbox', value: String(step.inboxCount) },
  ];

  return (
    <div className="commerce-walkthrough">
      <p>
        Explore Alice’s subscription in{' '}
        <a href={COMMERCE_PROTOCOL_LINKS.example}>
          openiap-commerce-protocol-example
        </a>
        . Follow the recorded task, code changes, and running result. The
        dashboard’s Run buttons replay the completed implementation; they do not
        build it.
      </p>
      <div className="commerce-story">
        <div ref={tabsRef} className="commerce-story-navigation">
          <span className="commerce-story-eyebrow">
            The subscription journey
          </span>
          <ol
            className="commerce-story-steps"
            aria-label="Recorded build milestones"
          >
            {run.milestones.map((milestone, index) => {
              const chapter = BUILD_STEPS[index];
              const StepIcon = chapter?.icon ?? Server;
              const label = chapter?.label ?? milestone.build.label;
              return (
                <li key={milestone.step}>
                  <button
                    type="button"
                    className="commerce-story-step"
                    aria-label={`${milestone.step}. ${label}`}
                    aria-current={
                      milestone.step === step.step ? 'step' : undefined
                    }
                    aria-controls="commerce-build-result"
                    onClick={() => onSelect(milestone.step)}
                  >
                    <span className="commerce-story-node" aria-hidden="true">
                      <StepIcon size={18} />
                    </span>
                    <span className="commerce-story-step-copy">
                      <small>
                        Step {String(milestone.step).padStart(2, '0')}
                      </small>
                      <strong>{label}</strong>
                    </span>
                    <ChevronRight
                      className="commerce-story-chevron"
                      size={14}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <div
          key={step.step}
          id="commerce-build-result"
          className="commerce-build-result commerce-story-panel"
        >
          <div className="commerce-build-caption" aria-live="polite">
            <div>
              <span className="commerce-story-eyebrow">
                Chapter {String(step.step).padStart(2, '0')} /{' '}
                {run.milestones.length}
              </span>
              <h3 ref={headingRef} id={`build-step-${step.step}`} tabIndex={-1}>
                {explanation?.label ?? step.title}
              </h3>
            </div>
            <div className="commerce-step-controls">
              <button
                className="btn btn-secondary"
                type="button"
                disabled={resolvedIndex === 0}
                onClick={() => onSelect(run.milestones[resolvedIndex - 1].step)}
                aria-label="Previous milestone"
              >
                <ArrowLeft size={16} aria-hidden="true" />
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={resolvedIndex === run.milestones.length - 1}
                onClick={() => onSelect(run.milestones[resolvedIndex + 1].step)}
                aria-label="Next milestone"
              >
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          <section
            className="commerce-build-task"
            aria-label="How this step was implemented"
          >
            <div>
              <span className="commerce-story-eyebrow">
                Recorded build task
              </span>
              <p>{step.build.request}</p>
            </div>
            <div>
              <span className="commerce-story-eyebrow">
                Code added to the example
              </span>
              <p>{step.build.change}</p>
              <a
                href={`${RECORDING}/${step.build.changes}`}
                target="_blank"
                rel="noreferrer"
              >
                View the code changes
              </a>
              {' · '}
              <a href={`${RECORDING}/${step.build.source}`}>
                Source at this checkpoint
              </a>
            </div>
          </section>
          {step.step === 1 ? (
            <div
              className="commerce-startup"
              aria-label="How to start the example"
            >
              <div className="commerce-startup-command">
                <span className="commerce-story-eyebrow">
                  <Terminal size={14} aria-hidden="true" /> 1. Run in the
                  example folder
                </span>
                <p>
                  With Bun installed, extract the{' '}
                  <a href={COMMERCE_PROTOCOL_LINKS.exampleSource}>
                    recorded example
                  </a>
                  .
                </p>
                <CodeBlock language="bash">{'npm ci\nnpm start'}</CodeBlock>
                <span className="commerce-startup-output-label">
                  The terminal prints
                </span>
                <samp className="commerce-startup-output">
                  Commerce Protocol Example: http://127.0.0.1:5181
                </samp>
              </div>
              <div className="commerce-startup-browser">
                <span className="commerce-story-eyebrow">
                  <Monitor size={14} aria-hidden="true" /> 2. Open the dashboard
                </span>
                <p>
                  Open <code>http://127.0.0.1:5181</code>, then click{' '}
                  <strong>Run step 1 →</strong>.
                </p>
              </div>
              <div className="commerce-startup-result">
                <span className="commerce-story-eyebrow">
                  3. Here’s what is running
                </span>
                <div
                  className="commerce-startup-services"
                  aria-label="Startup result"
                >
                  <div>
                    <Server size={22} aria-hidden="true" />
                    <strong>HTTP server</strong>
                    <span>Listening locally</span>
                  </div>
                  <ArrowRight
                    className="commerce-startup-arrow"
                    size={16}
                    aria-hidden="true"
                  />
                  <div>
                    <Database size={22} aria-hidden="true" />
                    <strong>SQLite database</strong>
                    <span>{step.purchases.length} purchases saved</span>
                  </div>
                  <ArrowRight
                    className="commerce-startup-arrow"
                    size={16}
                    aria-hidden="true"
                  />
                  <div aria-label="Alice’s recorded access">
                    <LockKeyhole size={22} aria-hidden="true" />
                    <strong>Alice’s Premium</strong>
                    <span>No purchase → no access</span>
                  </div>
                </div>
                <p>
                  Starting the server does not make a purchase. Next,{' '}
                  <button type="button" onClick={() => onSelect(2)}>
                    check a sample purchase{' '}
                    <ArrowRight size={13} aria-hidden="true" />
                  </button>
                  .
                </p>
              </div>
              <Link to="/commerce-protocol/implementation#local-example">
                Full setup instructions →
              </Link>
              <small className="commerce-startup-note">
                Recorded walkthrough · Run these commands locally to reproduce
                it.
              </small>
            </div>
          ) : (
            <div className="commerce-step-explainer">
              <p className="commerce-step-purpose">{execution.purpose}</p>
              <p className="commerce-step-playback">
                <Monitor size={14} aria-hidden="true" />
                <span>
                  After step {step.step - 1}, click{' '}
                  <strong>Run step {step.step} →</strong> in{' '}
                  <a
                    href="http://127.0.0.1:5181"
                    target="_blank"
                    rel="noreferrer"
                  >
                    your running example
                  </a>
                  . It executes the operations below.
                </span>
              </p>
              <section
                className="commerce-step-execution"
                aria-label="Actual operations in the example"
              >
                <div className="commerce-execution-heading">
                  <span className="commerce-story-eyebrow">
                    {execution.code
                      ? 'Example server code'
                      : 'HTTP requests sent by the example'}
                  </span>
                  <a
                    href={`${COMMERCE_IMPLEMENTATIONS.example.source}/scenario.mjs.html#L${explanation.sourceLine}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open this code
                  </a>
                </div>
                {execution.context && <p>{execution.context}</p>}
                {execution.code && (
                  <>
                    <CodeBlock language="javascript">
                      {execution.code}
                    </CodeBlock>
                    <small>
                      Excerpt from scenario.mjs, executed inside the running
                      example.
                    </small>
                  </>
                )}
                {execution.requests && (
                  <>
                    {execution.code && (
                      <p className="commerce-story-eyebrow">
                        Then the example sends
                      </p>
                    )}
                    <CodeBlock language="text">
                      {execution.requests
                        .map(
                          (request) =>
                            `${request.method} ${requestPath(request)}${request.method === 'POST' ? `\n${JSON.stringify(request.input, null, 2)}` : ''}`
                        )
                        .join('\n\n')}
                    </CodeBlock>
                    <details className="commerce-request-command">
                      <summary>
                        Call{' '}
                        {execution.requests.length === 1
                          ? 'this API'
                          : 'these APIs'}{' '}
                        from a terminal
                      </summary>
                      <p>
                        After running this step in the dashboard, repeat its API
                        calls in a second terminal. These use local test
                        credentials; the dashboard also performs any simulation
                        and checks shown here.
                      </p>
                      <CodeBlock language="bash">
                        {execution.requests.map(requestCommand).join('\n\n')}
                      </CodeBlock>
                    </details>
                  </>
                )}
              </section>
              <section
                className="commerce-operation-results"
                aria-label="Recorded operation results"
              >
                <span className="commerce-story-eyebrow">
                  What came back · recorded response fields
                </span>
                <div className="commerce-response-cards">
                  {execution.results.map((excerpt) => {
                    const response = step.responses.find(
                      (response) =>
                        response.operation === excerpt.operation &&
                        (excerpt.httpStatus === undefined ||
                          response.httpStatus === excerpt.httpStatus)
                    );
                    return (
                      <div
                        className="commerce-response-card"
                        key={excerpt.label}
                      >
                        <strong>{excerpt.label}</strong>
                        <dl>
                          {excerpt.fields.map((field) => (
                            <div key={field}>
                              <dt>{field}</dt>
                              <dd>
                                <code>
                                  {responseValue(response?.body, field)}
                                </code>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    );
                  })}
                </div>
                {step.step === 5 && (
                  <p>
                    Both successful sends keep the same event and delivery IDs.
                    The receiver saves one copy per event.{' '}
                    <a
                      href={`${COMMERCE_IMPLEMENTATIONS.example.source}/scenario.mjs.html#L239`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      See the duplicate-delivery check
                    </a>
                  </p>
                )}
              </section>
              {showPurchaseChange ? (
                <>
                  <div
                    className="commerce-purchase-change"
                    aria-label="Recorded purchase before and after"
                  >
                    {purchaseSnapshots.map(({ label, milestone }) => {
                      const purchase = milestone.purchases[0];
                      const access = milestone.access.productIds.length > 0;
                      const StatusIcon = access ? UnlockKeyhole : LockKeyhole;
                      return (
                        <section
                          className="commerce-purchase-snapshot"
                          key={label}
                          aria-label={label}
                        >
                          <header>
                            <span className="commerce-story-eyebrow">
                              {label}
                            </span>
                            <span>
                              {milestone.purchases.length}{' '}
                              {milestone.purchases.length === 1
                                ? 'purchase'
                                : 'purchases'}
                            </span>
                          </header>
                          {purchase ? (
                            <div className="commerce-purchase-receipt">
                              <ReceiptText size={22} aria-hidden="true" />
                              <strong>Monthly Premium</strong>
                              <code>{purchase.productId}</code>
                              <div className="commerce-purchase-owner">
                                <UserRound size={15} aria-hidden="true" />
                                <span>
                                  Customer{' '}
                                  <strong>
                                    {purchase.userId === 'demo_alice'
                                      ? 'Alice'
                                      : (purchase.userId ?? 'Not assigned')}
                                  </strong>
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="commerce-purchase-empty">
                              <Database size={28} aria-hidden="true" />
                              <span>No purchase saved</span>
                            </div>
                          )}
                          <div
                            className="commerce-purchase-access"
                            data-access={access ? 'on' : 'off'}
                          >
                            <StatusIcon size={16} aria-hidden="true" />
                            <span>
                              Alice’s Premium{' '}
                              <strong>{access ? 'Unlocked' : 'Locked'}</strong>
                            </span>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                  <div
                    className="commerce-purchase-takeaway"
                    aria-label="Alice’s recorded access"
                  >
                    <AccessIcon size={18} aria-hidden="true" />
                    <p>
                      <strong>
                        {step.step === 2
                          ? 'Why is Premium still locked?'
                          : 'Alice can now use Premium.'}
                      </strong>
                      {step.step === 2
                        ? ' The receipt was accepted, but no customer is attached to it yet.'
                        : ' The server finds this purchase when Alice asks for access.'}
                    </p>
                  </div>
                  {step.step === 3 && (
                    <p className="commerce-purchase-next">
                      Bob’s attempt to claim the same purchase is refused.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div
                    className="commerce-access-pass"
                    data-access={hasAccess ? 'on' : 'off'}
                    aria-label="Alice’s recorded access"
                  >
                    <div className="commerce-pass-decision">
                      <span className="commerce-pass-icon" aria-hidden="true">
                        <AccessIcon size={30} strokeWidth={1.5} />
                      </span>
                      <div>
                        <span className="commerce-story-eyebrow">
                          Alice’s access after this step
                        </span>
                        <p>
                          Premium is{' '}
                          <strong>{hasAccess ? 'unlocked' : 'locked'}</strong>
                        </p>
                      </div>
                    </div>
                    <p className="commerce-story-explanation">
                      {explanation?.result ?? step.result}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
          <section
            className="commerce-example-evidence"
            aria-label={`Evidence for step ${step.step}`}
          >
            <div className="commerce-evidence-heading">
              <span className="commerce-story-eyebrow">
                This scene in the example
              </span>
              <a
                href={COMMERCE_PROTOCOL_LINKS.example}
                target="_blank"
                rel="noreferrer"
              >
                Example repository
              </a>
            </div>
            <p className="commerce-evidence-title">
              Step {step.step}: <strong>{step.title}</strong>
            </p>
            <div className="commerce-evidence-content">
              <a
                className="commerce-evidence-screen no-icon"
                href={`${RECORDING}/${step.screenshot}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open full-size capture: ${step.title}`}
              >
                <img
                  src={`${RECORDING}/${step.screenshot}`}
                  alt={`Recorded example dashboard, step ${step.step}: ${step.result}`}
                  loading="lazy"
                />
                <span>Open the original screenshot ↗</span>
              </a>
              <div>
                <p className="commerce-evidence-locate">
                  {step.step === 2
                    ? '“Not assigned” here is “Unbound” under User in the screenshot.'
                    : step.step === 3
                      ? 'Alice here is demo_alice under User in the screenshot.'
                      : 'Find these labels in the screenshot:'}
                </p>
                <dl className="commerce-evidence-values">
                  {dashboardEvidence.map(({ label, value }) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            <div className="commerce-evidence-links">
              <a
                href={`${RECORDING}/${step.build.report}`}
                target="_blank"
                rel="noreferrer"
              >
                Step {step.step} run report
              </a>
              <a
                href={`${COMMERCE_IMPLEMENTATIONS.example.source}/${exampleCode.file}.html${exampleCodeLine}`}
                target="_blank"
                rel="noreferrer"
              >
                Example code
              </a>
              <Link to="/commerce-protocol/implementation#local-example">
                Run the recorded example →
              </Link>
              <Link to={`#build-step-${step.step}`}>Link to this step</Link>
            </div>
            <p className="commerce-evidence-note">
              {step.step === 5
                ? 'This earlier capture has one cancellation event. The current demo also delivers the access-grant event: two events total.'
                : 'The cards summarize this recorded checkpoint. The runnable archive includes later fixes.'}
            </p>
          </section>
          {step.step !== 1 && (
            <button
              className="btn btn-primary commerce-story-continue"
              type="button"
              onClick={() => onSelect(nextStep ? step.step + 1 : 1)}
            >
              {step.step === 2
                ? 'Next: connect this purchase to Alice'
                : nextStep
                  ? `Next: ${nextStep.label}`
                  : 'Back to the start'}
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
          <details className="commerce-story-proof commerce-technical-reference">
            <summary>Technical details (optional)</summary>
            <p className="commerce-technical-intro">
              Source, responses, and checks for developers and coding
              assistants.
            </p>
            <div className="commerce-story-proof-content">
              {step.step !== 1 && (
                <dl
                  className="commerce-story-records"
                  aria-label="Saved records"
                >
                  <div>
                    <Database size={15} aria-hidden="true" />
                    <dt>Purchases saved</dt>
                    <dd>{step.purchases.length}</dd>
                  </div>
                  <div>
                    <Mail size={15} aria-hidden="true" />
                    <dt>Notifications saved</dt>
                    <dd>{step.inboxCount}</dd>
                  </div>
                </dl>
              )}
              <div className="commerce-story-proof-heading">
                <span className="commerce-story-eyebrow">
                  {step.step === 1
                    ? 'Original build evidence'
                    : 'Behind this result'}
                </span>
                <span className="commerce-proof-passed">
                  <Check size={14} aria-hidden="true" />
                  {step.build.passed} build checks passed
                </span>
              </div>
              <details className="commerce-run-details">
                <summary>See the test results and server responses</summary>
                {step.step === 1 && (
                  <p>
                    This is the early build checkpoint. The completed example
                    linked above includes later fixes.
                  </p>
                )}
                <ul>
                  {step.checks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
                <CodeBlock language="json">
                  {JSON.stringify(step.responses, null, 2)}
                </CodeBlock>
                <a href={`${RECORDING}/${step.build.report}`}>
                  Full execution report
                </a>
              </details>
              <CommerceImplementationComparison
                topic={explanation?.topic ?? 'checks'}
                collapsed
              />
              <details className="commerce-run-details">
                <summary>Implementation and review details</summary>
                <p>
                  <strong>Reviewed and rechecked:</strong> {step.build.review}
                </p>
                <p>
                  {step.built}.{' '}
                  <a href={`${RECORDING}/REVIEW.md`}>
                    Review and correction log
                  </a>
                </p>
              </details>
              <p className="commerce-capture-note">
                Recorded {run.recordedAt.slice(0, 10)} · {run.checks.length}{' '}
                checks in the completed example · openiap-commerce-protocol@
                {run.standalone.version}.
              </p>
            </div>
          </details>
        </div>
      </div>
      <p className="commerce-capture-note">
        The example was adapted from an existing prototype in recorded steps.
        Build tasks describe the work; they are not original AI transcripts.
        Purchases and time are simulated; HTTP, SQLite, and signature checks run
        locally.
      </p>
      <p>
        <Link to="/commerce-protocol/implementation#build-brief">
          Build this into your product with AI →
        </Link>
      </p>
    </div>
  );
}

export default CommerceBuildWalkthrough;
