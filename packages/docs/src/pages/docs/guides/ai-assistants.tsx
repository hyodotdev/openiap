import { useState } from 'react';
import { Check } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import CommerceBuildWalkthrough from '../../../components/CommerceBuildWalkthrough';
import CommerceFreshBuild from '../../../components/CommerceFreshBuild';
import CommerceConnectionExample from './CommerceConnectionExample';
import StaticExamples from '../../../components/StaticExamples';
import { COMMERCE_ROLES } from '../../../lib/commerceEcosystem';
import { COMMERCE_PROTOCOL_LINKS } from '../../../lib/config';
import compositionReport from '../../../../public/commerce-composition/iapkit-run.json';
import freshBuild from '../../../../public/commerce-example/fresh-build.json';
import paywallBuild from '../../../../public/commerce-example/paywall-build.json';
import '../../../styles/commerce-protocol.css';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

const REFERENCES = [
  {
    id: 'quick-reference',
    name: 'llms.txt — start here',
    url: 'https://openiap.dev/llms.txt',
    description:
      'SDK installation, purchase APIs, types, and links to the implementation guides.',
  },
  {
    id: 'full-reference',
    name: 'llms-full.txt — detailed reference',
    url: 'https://openiap.dev/llms-full.txt',
    description:
      'Complete API and specification details when your task needs more context.',
  },
] as const;

type CommerceRole = (typeof COMMERCE_ROLES)[number]['id'];

const AI_TASKS = {
  experience: {
    label: 'Connect my paywall',
    detail: 'Keep my UI and experiments',
    request: `Connect this paywall to the host app's existing OpenIAP purchase flow.
Keep our UI, targeting, and experiments. Use the host's store-fetched products and purchase callback.
Show pending, canceled, failed, and fulfilled results without treating a click as a purchase.
Only report fulfillment and finish the purchase after the backend grants the selected product.`,
    result:
      'Choose a product in your paywall and see the host app’s purchase result.',
    code: 'The paywall adapter and host app connection.',
    check: 'Pending, canceled, and failed purchases never show as fulfilled.',
    checks: [
      {
        action: 'Pending, canceled, or failed purchase',
        expected: 'Show that result. Do not fulfill or finish it.',
      },
      {
        action: 'Backend denies access',
        expected: 'Show failure; do not finish the purchase.',
      },
      {
        action: 'Backend grants the selected product',
        expected: 'Show Premium, then finish through the host app.',
      },
    ],
  },
  commerce: {
    label: 'Build a purchase backend',
    detail: 'Verify purchases and manage access',
    request: `Build a local backend for monthly Premium subscriptions.
Use this project's stack and fictional purchases for the first demo.
Alice gets Premium after her verified purchase is connected to her.
Canceling renewal keeps access until expiry. Bob cannot claim Alice's purchase.`,
    result: 'Open the app and try Alice’s Premium.',
    code: 'Purchase verification, ownership, access, and their tests.',
    check: 'Purchase unlocks it; canceling renewal keeps it; expiry locks it.',
    checks: [
      {
        action: 'Alice binds her verified purchase',
        expected: 'Alice gets Premium. Bob cannot claim it.',
      },
      {
        action: 'Alice cancels renewal',
        expected: 'Keep access for the paid period.',
      },
      {
        action: 'The paid period ends',
        expected: 'Access closes, including after reopening storage.',
      },
    ],
  },
  data: {
    label: 'Receive subscription events',
    detail: 'Connect my analytics or automation',
    request: `Connect this service to subscription events from a compatible commerce backend.
Keep our existing analytics and experiment model. Ask me to choose the backend and account mapping.
Verify signatures and save each event once, including after a retry or restart.
Join events to our existing customer and experiment records using authenticated purchase associations.
Show purchase, renewal, cancellation and redelivery for two store fixtures through the same receiver.
Deduplicate by event ID within the authenticated emitter/project scope. Keep unknown amounts unknown and currencies separate.
Keep attribution policy in our service; flag refunds and recoveries for reconciliation instead of inventing revenue.`,
    result: 'Trigger a subscription change and see it arrive in your service.',
    code: 'A signed event receiver connected to your existing data model.',
    check: 'Retries save one copy; tampered events are rejected.',
    checks: [
      {
        action: 'A purchase or renewal reaches your service',
        expected:
          'Join the existing experiment assignment. Preserve unknown amounts and separate currencies.',
      },
      {
        action: 'A signed cancellation arrives',
        expected: 'Save it for the correct customer.',
      },
      {
        action: 'The same event is delivered again',
        expected: 'Keep one copy, including after reopening storage.',
      },
      {
        action: 'Someone changes the body or signature',
        expected: 'Reject it; save no event.',
      },
    ],
  },
} satisfies Record<
  CommerceRole,
  {
    label: string;
    detail: string;
    request: string;
    result: string;
    code: string;
    check: string;
    checks: { action: string; expected: string }[];
  }
>;

function roleRequest(role: CommerceRole): string {
  const origin =
    typeof window === 'undefined'
      ? 'https://openiap.dev'
      : window.location.origin;
  return `Use the following as the Desired outcome for the brief above.
Read ${origin}/commerce-example/integration-brief.md and follow its linked guides and example code for my role.

${AI_TASKS[role].request}

Implement this in my project. Use fictional data first.
For verification, read ${origin}/commerce-example/${role === 'commerce' ? 'from-scratch.md' : 'paywall-verification.md'}.
Download and extract ${`${origin}/commerce-example/${role === 'commerce' ? 'fresh' : 'paywall'}-source.tar.gz`} into a separate temporary folder, then run npm ci and ${role === 'commerce' ? 'npm test' : 'npm run verify'} there (Bun is required).
Use the example's checks as a reference, then run equivalent checks against MY implementation for this role.
Fix failures and rerun. Show the changed files, commands, actual results, and anything not tested.
Show my running app or service. Passing the example alone does not verify my project.`;
}

export default function AIAssistants() {
  useScrollToHash();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const stepMatch = /^#build-step-([1-7])$/.exec(hash);
  const exampleStep = stepMatch ? Number(stepMatch[1]) : 3;
  const [role, setRole] = useState<CommerceRole>('experience');
  const task = AI_TASKS[role];

  return (
    <div className="doc-page ai-assistants">
      <SEO
        title="Build In-App Purchases with AI"
        description="Choose the OpenIAP SDK for your app, give your coding assistant the matching references, and verify purchases, restore, and access before shipping."
        path="/docs/guides/ai-assistants"
      />
      <h1>Build in-app purchases with AI</h1>
      <p>
        Describe what customers should be able to buy. Let AI read the
        implementation details, then review the working purchase flow.
      </p>

      <section>
        <AnchorLink id="ai-optimized-documentation" level="h2">
          Start with llms.txt
        </AnchorLink>
        <p>
          Open your existing project in a coding assistant such as Codex or
          Claude Code. Paste this into its chat input and send it. Change the
          app and product to match yours:
        </p>
        <CodeBlock language="text">{`Read ${REFERENCES[0].url} and its reading instructions. Follow the detailed reference and the setup guide for this app before coding.
Add Premium subscriptions to this Expo app.
Keep our existing login and paywall, and reuse any purchase integration already present.
Ask me to choose any missing store, product, or backend. Show the working flow and actual test results.`}</CodeBlock>
        <details>
          <summary>References the AI should read</summary>
          <ul id="documentation-contents">
            {REFERENCES.map((reference) => (
              <li key={reference.id} id={reference.id}>
                <a href={reference.url}>{reference.name}</a> —{' '}
                {reference.description}
              </li>
            ))}
          </ul>
          <p>
            If the assistant cannot open a reference, provide its contents.
            These files supply context for the task; they do not train the AI.
            No CLI command is required.
          </p>
        </details>
      </section>

      <section>
        <AnchorLink id="choose-sdk" level="h2">
          Review the changes in your app
        </AnchorLink>
        <p>
          You choose the store, product, and what it unlocks. AI follows your{' '}
          <Link to="/docs/setup">framework’s setup guide</Link> and implements
          the flow. Review the running app and test purchases before shipping.
        </p>
        <details>
          <summary>Before shipping: sandbox checks</summary>
          <AnchorLink id="acceptance" level="h3">
            Test the purchase flow
          </AnchorLink>
          <p>
            Keep your framework and package manager. Ask AI to install and run
            from clean source, report the commands and results, then test in
            your store’s sandbox:
          </p>
          <ul>
            <li>A successful purchase grants the intended access.</li>
            <li>Canceled or pending purchases grant no new access.</li>
            <li>Restore and repeated callbacks do not grant benefits twice.</li>
            <li>
              Canceling renewal keeps access until the paid period expires.
            </li>
            <li>Switching accounts follows your purchase ownership policy.</li>
          </ul>
          <p>
            Use the <Link to="/docs/guides/testing">testing guide</Link> for
            store setup and device testing.
          </p>
        </details>
      </section>

      <section>
        <p>
          For SDK integration, the request above is enough. Continue below when
          you also want AI to connect services with Commerce Protocol.
        </p>
        <AnchorLink id="integration" level="h2">
          <Link to="/commerce-protocol">Commerce Protocol</Link>: build with AI
        </AnchorLink>
        <p>
          Keep your paywall, experiments, or analytics. Connect them to a
          compatible purchase backend using shared purchase, access, and event
          rules. You choose what your product does; AI reads the rules and
          implements your connection.
        </p>
        <p>
          Choose the part you own. A paywall connects to a purchase backend;
          choosing it does not mean building that backend or an analytics
          service.
        </p>
        <div
          className="commerce-ai-workflow"
          role="region"
          aria-labelledby="commerce-ai-brief"
        >
          <header className="commerce-ai-workflow-header">
            <AnchorLink id="commerce-ai-brief" level="h3">
              Choose your part
            </AnchorLink>
            <div
              className="commerce-ai-role-options"
              role="group"
              aria-label="Choose what AI will build"
            >
              {COMMERCE_ROLES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={role === item.id}
                  onClick={() => setRole(item.id)}
                >
                  <span className="commerce-ai-role-title">
                    <strong>{AI_TASKS[item.id].label}</strong>
                    <span className="commerce-ai-role-check" aria-hidden="true">
                      {role === item.id && (
                        <Check size={14} strokeWidth={2.5} />
                      )}
                    </span>
                  </span>
                  <span className="commerce-ai-role-detail">
                    {AI_TASKS[item.id].detail}
                  </span>
                </button>
              ))}
            </div>
          </header>
          <div className="commerce-ai-workflow-content">
            <p className="commerce-ai-selection" aria-live="polite">
              <span>Your workflow</span>
              <strong>{task.label}</strong>
            </p>
            <ol
              className="commerce-ai-handoff"
              aria-label="Steps for your selected role"
            >
              {[
                ['commerce-ai-terminal', 'Terminal', 'Get the brief'],
                ['commerce-ai-request', 'AI chat', 'Send your request'],
                ['commerce-ai-result', 'Your project', 'AI implements it'],
                ['commerce-ai-evidence', 'Verification', 'Review the results'],
              ].map(([id, title, description], index) => (
                <li key={id}>
                  <Link to={`#${id}`}>
                    <span
                      className="commerce-ai-step-number"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    <span className="commerce-ai-step-label">
                      <strong>{title}</strong>
                      <span>{description}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            <section className="commerce-ai-step commerce-ai-terminal">
              <AnchorLink id="commerce-ai-terminal" level="h3">
                1. Run in your project’s terminal
              </AnchorLink>
              <p>
                Open a terminal in the existing project you want AI to change.
                With Node.js 20 or later installed, run:
              </p>
              <CodeBlock language="bash">
                {`npx @hyodotdev/openiap init --role ${role}`}
              </CodeBlock>
              <p>
                <strong>The terminal prints instructions for the AI.</strong>{' '}
                The output begins:
              </p>
              <pre
                className="commerce-ai-terminal-output"
                aria-label="Beginning of the CLI output"
              >{`# OpenIAP implementation brief

Paste this into your coding assistant in the project below.`}</pre>
              <p>
                <strong>Copy that entire printed document.</strong> The command
                then exits. Your project files are unchanged; no AI or server
                has started.
              </p>
            </section>
            <section className="commerce-ai-step">
              <AnchorLink id="commerce-ai-request" level="h3">
                2. Paste into the AI’s chat input and send
              </AnchorLink>
              <p>
                Open <strong>the same project folder</strong> in Codex, Claude
                Code, or another coding assistant that can edit its files. In
                the assistant’s <strong>chat input</strong>, compose one
                message:
              </p>
              <details className="commerce-ai-message">
                <summary>AI prompt · {task.label}</summary>
                <div className="commerce-ai-message-content">
                  <div className="commerce-ai-paste-slot">
                    <strong>First: paste the full terminal output</strong>
                    <span>
                      From “# OpenIAP implementation brief” through the final
                      paragraph.
                    </span>
                  </div>
                  <p>
                    <strong>Then: append this request below it</strong> and
                    adjust it for your product.
                  </p>
                  <CodeBlock language="text">{roleRequest(role)}</CodeBlock>
                </div>
              </details>
              <p>
                <strong>Send that message to the AI.</strong> Paste it in the AI
                conversation, not at the shell prompt where you ran{' '}
                <code>npx</code>. Keep the CLI output as printed; the appended
                request supplies its <code>Desired outcome</code>.
              </p>
            </section>
            <section className="commerce-ai-step">
              <AnchorLink id="commerce-ai-result" level="h3">
                3. AI implements the connection in your project
              </AnchorLink>
              <p>
                AI reads your code and the protocol guides, then connects the
                parts for your role. Keep your existing product; review these
                changes:
              </p>
              <ol className="commerce-ai-deliverables">
                <li>
                  <strong>Use it</strong>
                  <span>{task.result}</span>
                </li>
                <li>
                  <strong>Review the code</strong>
                  <span>{task.code}</span>
                </li>
                <li>
                  <strong>Check the result</strong>
                  <span>{task.check}</span>
                </li>
              </ol>
              <p>
                A product can fill several roles. For example, keep your paywall
                and add an event receiver to feed your experiments. You can
                choose IAPKit, another compatible service, or your own backend.
              </p>
            </section>
            <section className="commerce-ai-step">
              <AnchorLink id="commerce-ai-evidence" level="h3">
                4. Review both test results
              </AnchorLink>
              <p>
                <a
                  href={
                    role === 'commerce'
                      ? `${freshBuild.repository}/tree/${freshBuild.sourceCommit}`
                      : `${paywallBuild.repository}/tree/${paywallBuild.sourceCommit}`
                  }
                >
                  openiap-commerce-protocol-example
                </a>{' '}
                is the reference AI uses for verification. It must report two
                results: the example’s tests, then tests against{' '}
                <strong>your changed project</strong>. Selected task:{' '}
                <strong>{task.label}</strong>. Check these outcomes:
              </p>
              <table className="commerce-outcome-table">
                <thead>
                  <tr>
                    <th>In your implementation</th>
                    <th>Evidence to ask AI for</th>
                  </tr>
                </thead>
                <tbody>
                  {task.checks.map((check) => (
                    <tr key={check.action}>
                      <td>{check.action}</td>
                      <td>{check.expected}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Open <strong>your app or service</strong> and try the relevant
                actions. If AI only shows the example’s dashboard, ask it to
                show your implementation and its test results too.
              </p>
              <p>
                <a href="https://github.com/hyodotdev/openiap/blob/main/packages/docs/public/commerce-example/store-sandbox-verification.md">
                  Real-store evidence: Apple lifecycle and Apple/Google
                  purchases
                </a>
                . The report identifies the remaining unverified paths.
              </p>
            </section>
          </div>
        </div>
        <StaticExamples>
          {COMMERCE_ROLES.filter((item) => item.id !== role).map((item) => (
            <details key={item.id}>
              <summary>{AI_TASKS[item.id].label}: AI instructions</summary>
              <CodeBlock language="bash">{`npx @hyodotdev/openiap init --role ${item.id}`}</CodeBlock>
              <CodeBlock language="text">{roleRequest(item.id)}</CodeBlock>
              <p>
                {AI_TASKS[item.id].result} {AI_TASKS[item.id].check}
              </p>
              <ul>
                {AI_TASKS[item.id].checks.map((check) => (
                  <li key={check.action}>
                    {check.action}: {check.expected}
                  </li>
                ))}
              </ul>
              <Link to={item.start}>Read the {item.title} guide</Link>
            </details>
          ))}
        </StaticExamples>
        {role === 'commerce' ? (
          <>
            <CommerceFreshBuild />
            <details>
              <summary>
                Connect a paywall and experiment reporting to this backend
              </summary>
              <CommerceConnectionExample role={role} />
            </details>
          </>
        ) : (
          <>
            <CommerceConnectionExample role={role} />
            <details open={hash === '#fresh-commerce-build'}>
              <summary>
                How AI built the purchase backend: initial commit + seven steps
              </summary>
              <CommerceFreshBuild />
            </details>
          </>
        )}
        <details>
          <summary>Earlier paywall integration verification</summary>
          <p className="commerce-ai-build-record">
            <strong>Followed in a separate app:</strong> the same instructions
            connected an existing fixture paywall while preserving its UI and
            host callbacks. Both the reference and the app’s own tests passed.{' '}
            <a href="/commerce-example/reader-followup.md">
              Steps, changed files, and observed results
            </a>
            .
          </p>
          <div className="commerce-ai-build-record">
            <p>
              <strong>Verified in the example:</strong> these paths were run
              together over local HTTP. A bug that reported success without
              backend access was reproduced, fixed, and covered by a regression
              test.
            </p>
            <p>
              <a href="/commerce-example/experience-verification.md">
                Commands, results, and the fix
              </a>{' '}
              ·{' '}
              <a href="/commerce-example/experience-source.tar.gz">
                Verified source
              </a>
            </p>
            <details>
              <summary>Run the reference checks and inspect the screen</summary>
              <p>
                Install Bun, download and extract the verified source above,
                then run these commands in its folder:
              </p>
              <CodeBlock language="bash">{`npm ci
npm test
npm run demo:experience`}</CodeBlock>
              <p>
                Open <code>http://127.0.0.1:5184</code>. Choose a store result
                and click <strong>Buy Premium</strong>, then try cancellation,
                redelivery, and expiry. This runs the example’s existing code.
                Store responses and login are fictional; HTTP, storage, and
                signatures execute locally.
              </p>
              <a href="/commerce-example/experience-verified.png">
                <img
                  src="/commerce-example/experience-verified.png"
                  alt="Verified example: Premium remains open after cancellation and the receiver keeps two events after redelivery."
                  loading="lazy"
                  style={{ width: '100%', height: 'auto' }}
                />
              </a>
            </details>
          </div>
        </details>
        <details>
          <summary>Earlier implementation and compatibility records</summary>
          <p>
            <strong>One app and event receiver, two backends.</strong> The
            recorded run switched from the example to IAPKit and back:{' '}
            <strong>
              {compositionReport.changedConsumerFiles.length} consumer files
              changed
            </strong>
            , {compositionReport.checkCount} checks passed. Both kept paid
            access after cancellation and sent updates to the same receiver.
          </p>
          <p>
            <Link to="/commerce-protocol/ecosystem#composition-proof">
              Compare the results and run the code
            </Link>{' '}
            ·{' '}
            <a href="/commerce-composition/iapkit-run.json">Executed report</a>.{' '}
            Real local servers and storage; store responses were simulated.
          </p>
        </details>
        <details>
          <summary>Role boundaries and using AI without the CLI</summary>
          <p>
            You can give AI the integration instructions and your request
            directly. The CLI packages the starting context for your project; it
            does not launch AI or generate a server. For a mobile app, use{' '}
            <code>init --role app</code> and the llms.txt workflow above.
          </p>
          <p>
            Your paywall connects through the host app’s purchase callback;
            Commerce Protocol does not define its UI or experiments. An event
            receiver supplies lifecycle data; paywall attribution and revenue
            reports still need your product’s data and rules. Server credentials
            and authenticated customer identity stay on the backend.
          </p>
          <p>
            Read the <Link to="/commerce-protocol/ecosystem">role guide</Link>{' '}
            or give AI the{' '}
            <a href={COMMERCE_PROTOCOL_LINKS.buildBrief}>backend build guide</a>{' '}
            when implementing a commerce service.
          </p>
        </details>
        <details>
          <summary>Implementation steps and expected results</summary>
          <AnchorLink id="apply-commerce-protocol" level="h3">
            How to use it in your existing app
          </AnchorLink>
          <ol>
            <li>
              <strong>Choose a backend.</strong> Use IAPKit or your own server.
              Keep your existing login and purchase screen.
            </li>
            <li>
              <strong>Connect the app.</strong> Give AI your store and product.
              Have it send purchase results to the server and use the returned
              access decision to unlock the paid feature. Your server identifies
              the customer; server secret keys stay out of the app.
            </li>
            <li>
              <strong>Check the result.</strong> Run the cases below. For your
              own backend, AI should also follow the{' '}
              <Link to="/commerce-protocol/implementation#build-brief">
                backend build instructions
              </Link>
              .
            </li>
          </ol>
          <AnchorLink id="expected-commerce-result" level="h3">
            What should the customer experience?
          </AnchorLink>
          <table className="commerce-outcome-table">
            <thead>
              <tr>
                <th>Try this</th>
                <th>Expected result</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  Alice buys Premium and the server connects it to her account.
                </td>
                <td>Alice can open the paid feature.</td>
              </tr>
              <tr>
                <td>Another customer, Bob, tries to claim Alice’s purchase.</td>
                <td>Bob gets no access; the purchase stays with Alice.</td>
              </tr>
              <tr>
                <td>Alice cancels the next renewal.</td>
                <td>
                  Premium stays available for the time she already paid for.
                </td>
              </tr>
              <tr>
                <td>The paid period ends without a renewal.</td>
                <td>
                  Premium is no longer available, even after a server restart.
                </td>
              </tr>
            </tbody>
          </table>
        </details>
      </section>

      <section className="ai-integration-example">
        <AnchorLink id="existing-project-example" level="h3">
          Earlier prototype walkthrough
        </AnchorLink>
        <details open={stepMatch ? true : undefined}>
          <summary>
            Inspect the earlier prototype and its recorded screens
          </summary>
          <p>
            These seven steps explain the earlier reference backend. Each links
            a recorded task to its code changes and running result. For a
            paywall or analytics service, AI uses the{' '}
            <Link to="/commerce-protocol/ecosystem#composition-proof">
              app connection and event receiver
            </Link>{' '}
            around this backend.
          </p>
          <CommerceBuildWalkthrough
            selected={exampleStep}
            onSelect={(step) =>
              void navigate(`#build-step-${step}`, {
                state: { commerceKeepScroll: true },
              })
            }
            autoScroll={false}
          />
          <p>
            <Link to="/commerce-protocol/implementation#local-example">
              Run this example locally
            </Link>{' '}
            without a store account or payment. Before shipping your app, repeat
            the flow with your real login and store sandbox.
          </p>
          <details className="commerce-run-details">
            <summary>Run instructions and further references</summary>
            <p>
              Follow the{' '}
              <Link to="/commerce-protocol/implementation#local-example">
                local setup instructions for the recorded source
              </Link>
              . Run its install, test, and start commands, then open{' '}
              <code>http://127.0.0.1:5181</code> and select{' '}
              <strong>Run step 1 →</strong>.
            </p>
            <p>
              Follow{' '}
              <Link to="/commerce-protocol/getting-started">
                one purchase from payment to access
              </Link>{' '}
              to compare the example with IAPKit’s server code and checks. The
              example uses Bun and SQLite locally; IAPKit also shows store
              connections and hosted service configuration.
            </p>
            <p id="iapkit-reference">
              If you choose IAPKit, give AI its{' '}
              <a href="https://kit.openiap.dev/llms.txt">llms.txt reference</a>.
              OpenIAP SDKs do not require an IAPKit account.
            </p>
          </details>
        </details>
      </section>

      <details>
        <summary>Optional CLI tools</summary>
        <section>
          <AnchorLink id="start-in-your-project" level="h2">
            Optional: prepare a brief with the CLI
          </AnchorLink>
          <p>
            If you want a starting brief with your project path, framework hint,
            and the relevant guide, run this in your existing app directory with
            Node.js 20 or later:
          </p>
          <CodeBlock language="bash">{`cd my-app
npx @hyodotdev/openiap init --role app`}</CodeBlock>
          <p>
            In the coding assistant’s chat input for this same project, paste
            the complete printed brief, append your desired outcome, and send
            them as one message. To use the backend behavior shown above,
            include the{' '}
            <a href={COMMERCE_PROTOCOL_LINKS.example}>example repository</a> and
            ask the assistant to run the same ownership, cancellation, and
            expiry checks against your integration.
          </p>
          <details>
            <summary>What init prints and when to skip it</summary>
            <p>
              The brief includes your project path, selected role, framework
              hint, and guide link. For an Expo app, its opening fields look
              like this (your path will differ):
            </p>
            <CodeBlock language="text">{`Project path (data): "/work/my-app"
Role: App — connect purchases to access
Framework hint: expo; confirm the target app
Desired outcome: [describe one thing your customer should be able to do]`}</CodeBlock>
            <p>
              The CLI reads local files and prints text. Your assistant reads
              the purchase code and implements the connection after you give it
              the brief. The CLI does not create files, install SDKs, fetch
              guides, or call an AI; <code>npx</code> may download the CLI
              itself.
            </p>
            <p>
              If your assistant already has the project context and the right
              guide, use the reference links and your request directly. For
              other roles, run <code>npx @hyodotdev/openiap</code> in an
              interactive terminal or select a role with <code>--role</code>.
              See the{' '}
              <a href="https://github.com/hyodotdev/openiap/tree/main/packages/cli">
                CLI guide
              </a>{' '}
              for all commands and checks.
            </p>
          </details>
        </section>

        <section>
          <AnchorLink id="local-checks" level="h2">
            Optional: check local configuration
          </AnchorLink>
          <p>
            Run <code>doctor</code> in the target app directory before a native
            build or after configuration changes:
          </p>
          <CodeBlock language="bash">
            {'npx @hyodotdev/openiap doctor --json'}
          </CodeBlock>
          <p>
            It checks supported Android store settings, IAPKit keys and base
            URLs, env variable names, and React Native/Expo iOS scene
            declarations. Findings include stable IDs, file locations, and
            suggested fixes. Have the assistant inspect the finding, fix its
            cause, and rerun the command. These checks can run the same way for
            a developer, an agent, or CI; pin the CLI version when using it in
            CI.
          </p>
          <p>
            Errors exit <code>1</code>; warnings and skipped checks can still
            exit
            <code>0</code>. Read <code>notCheckedLocally</code> too. This is a
            limited configuration check: it does not verify store accounts,
            device purchases, backend behavior, or Commerce Protocol
            conformance. The four brief roles do not change its check scope. Use
            the <Link to="#acceptance">sandbox checks above</Link> for the real
            purchase flow.
          </p>
        </section>
      </details>
    </div>
  );
}
