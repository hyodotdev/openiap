import { COMMERCE_PROTOCOL_LINKS } from '../../lib/config';
import { Link } from 'react-router-dom';
import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import DataTable, { type DataTableColumn } from '../../components/DataTable';
import PackageInstall from '../../components/PackageInstall';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';

const EXAMPLE = COMMERCE_PROTOCOL_LINKS.example;
const KIT = 'https://github.com/hyodotdev/openiap/tree/main/packages/kit';

interface ComparisonRow {
  part: string;
  example: string;
  kit: string;
  path: string;
}

const COMPARISON: ComparisonRow[] = [
  {
    part: 'API contract',
    example: 'Five REST operations; no full profile claim',
    kit: 'REST and GraphQL over shared handlers',
    path: '/server/api/commerce',
  },
  {
    part: 'Store verification',
    example: 'One fictional fixture purchase',
    kit: 'Delegates to store verification functions',
    path: '/server/api/commerce/handlers.ts',
  },
  {
    part: 'Storage and identity',
    example: 'Local SQLite; a preselected user',
    kit: 'Convex project, subscription, and account records',
    path: '/convex',
  },
  {
    part: 'Events',
    example:
      'Signed loopback delivery, retry, and durable inbox; in-process storage restart',
    kit: 'Registered destinations and delivery worker',
    path: '/convex/commerce/delivery.ts',
  },
  {
    part: 'Evidence from this run',
    example: 'Real local HTTP and persistence; published signature vectors',
    kit: 'Route conformance and commerce helpers with Convex/store I/O mocked',
    path: '/server/api/commerce/conformance.test.ts',
  },
];
const COLUMNS: DataTableColumn<ComparisonRow>[] = [
  { header: 'Part', cell: (row) => row.part },
  { header: 'This local example', cell: (row) => row.example },
  {
    header: 'IAPKit implementation',
    cell: (row) => <a href={`${KIT}${row.path}`}>{row.kit}</a>,
  },
];

function CommerceImplementation(): React.JSX.Element {
  useScrollToHash();
  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol: Build with AI"
        path="/commerce-protocol/implementation"
        description="Give your AI a build brief, run the working local example, and compare its scope with IAPKit. Review actual results at every milestone."
      />
      <h1>Build with AI</h1>
      <p>
        You describe the product. The protocol gives your AI the API, access
        rules, and testable contract. Review a working milestone at a time.
      </p>
      <p>
        Start with the{' '}
        <Link to="/commerce-protocol#build-walkthrough">
          six-step recorded example
        </Link>{' '}
        to see what you will be asking it to build.
      </p>
      <p>
        Already have a backend and only need events?{' '}
        <Link to="/commerce-protocol/getting-started#receive-events">
          Run the ready event receiver
        </Link>
        .
      </p>
      <section>
        <AnchorLink id="build-brief" level="h2">
          1. Install the contract in your project
        </AnchorLink>
        <PackageInstall packageName="openiap-commerce-protocol" />
        <p>
          The package contains the specification, schemas, API bindings, and
          conformance tools. Your AI uses these to build a backend in your own
          project, using your preferred backend stack.
        </p>
        <p>
          <a href="/commerce-example/build-brief.md" download>
            Download the AI build brief ↓
          </a>{' '}
          and attach it to your AI, or paste this starter prompt:
        </p>
        <CodeBlock language="text">{`Locate the installed openiap-commerce-protocol package and read SPEC.md and generated/.
For architecture, use https://openiap.dev/commerce-protocol/whitepaper (DESIGN.md is not included in package 0.1.0).
Follow ${EXAMPLE}/blob/main/BUILD.md to build a purchase-to-access backend in this project.
After each milestone, run it and show the actual API result, database change, and screen capture.
Review the running result. Fix issues and repeat the failed checks before adding the next milestone.
Keep the work uncommitted so I can review it.
My product and stack: [describe your app, backend, and subscription].`}</CodeBlock>
        <p>
          The brief points to the normative spec and generated schemas, then
          sets six build milestones with acceptance checks. It starts with a
          fictional store so you can review the flow before connecting
          credentials.
        </p>
      </section>
      <section>
        <AnchorLink id="local-example" level="h2">
          2. Run the example we built
        </AnchorLink>
        <p>
          Clone the <a href={EXAMPLE}>example repository</a> to get the backend,
          README, receiver guide, and complete build history:
        </p>
        <CodeBlock language="bash">{`git clone ${EXAMPLE}.git
cd openiap-commerce-protocol-example`}</CodeBlock>
        <PackageInstall />
        <p>
          This example uses Bun to run its HTTP server and SQLite databases.
          With Bun installed, test and start it:
        </p>
        <CodeBlock language="bash">{`npm test
npm start
# Or run the same scripts with pnpm, Yarn, or Bun.
# Open http://127.0.0.1:5181 and run each step.`}</CodeBlock>
        <p>
          The example contains the backend code built from the contract: five
          REST operations, a dashboard, and two SQLite databases. The store and
          clock are fixtures. You do not need the OpenIAP or IAPKit monorepo.
        </p>
        <p>
          <a href={`${EXAMPLE}#quick-start`}>README and quick start</a> ·{' '}
          <a href={COMMERCE_PROTOCOL_LINKS.exampleSource} download>
            Download the recorded source only
          </a>{' '}
          ·{' '}
          <a href="/commerce-example/run.json" download>
            Download the actual execution report
          </a>
        </p>
        <p>
          The{' '}
          <Link to="/commerce-protocol#build-walkthrough">
            build walkthrough
          </Link>{' '}
          includes each earlier source version, code changes, and review
          results. Review exposed an invalid discovery workaround in the early
          unfinished snapshots. The revised final backend adds atomic grant
          events and improves failure handling. We also fixed the response
          viewer and repeated the affected checks. Read the{' '}
          <a href="/commerce-example/REVIEW.md">correction log</a> for the
          evidence.
        </p>
      </section>
      <section>
        <AnchorLink id="architecture" level="h2">
          3. Understand what AI built
        </AnchorLink>
        <p>
          HTTP handlers validate the contract and call the purchase domain.
          SQLite owns purchases, bindings, processed observations, and pending
          deliveries. A separate receiver database deduplicates signed events
          before acknowledging them.
        </p>
        <p id="consumer">
          The developer backend still owns login and account authorization. It
          reads current entitlements to decide access; a webhook can trigger a
          refresh. The example selects a fixture user and does not implement
          login.
        </p>
        <p>
          The{' '}
          <Link to="/commerce-protocol/getting-started#purchase-flow">
            sequence diagrams
          </Link>{' '}
          show the app, provider, and receiver calls in order. The{' '}
          <Link to="/commerce-protocol/whitepaper">
            whitepaper’s implementation blueprint
          </Link>{' '}
          explains the storage and transaction boundaries. The{' '}
          <Link to="/commerce-protocol/authentication">authentication</Link> and{' '}
          <Link to="/commerce-protocol/webhooks">webhook references</Link>{' '}
          define the requirements.
        </p>
      </section>
      <section>
        <AnchorLink id="iapkit" level="h2">
          4. Compare the result with IAPKit
        </AnchorLink>
        <DataTable
          rows={COMPARISON}
          columns={COLUMNS}
          rowKey={(row) => row.part}
        />
        <p>
          The example makes the core flow visible. It does not establish real
          purchase validity or reproduce the IAPKit product. The{' '}
          <a href="/commerce-lab/run.json">IAPKit comparison report</a> tests
          the reviewed source archive against IAPKit’s signer and records its
          route tests. No store sandbox purchase was made.
        </p>
      </section>
      <section>
        <AnchorLink id="acceptance" level="h2">
          5. Extend only after the local flow passes
        </AnchorLink>
        <p>
          Choose the real store, authenticated identity source, and deployment.
          Add store validation, erasure, tenant isolation, public HTTPS delivery
          protections, and operational recovery. Complete each selected profile
          before advertising it.
        </p>
        <p>
          Run{' '}
          <Link to="/commerce-protocol/conformance">
            profile and binding conformance
          </Link>
          , then store sandbox and deployment tests. Keep the result report
          beside the implementation so the next reviewer can distinguish
          demonstrated behavior from remaining work.
        </p>
      </section>
    </div>
  );
}

export default CommerceImplementation;
