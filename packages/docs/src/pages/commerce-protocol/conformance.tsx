import CommerceImplementationComparison from '../../components/CommerceImplementationComparison';
import { COMMERCE_PROTOCOL_LINKS } from '../../lib/config';
import AnchorLink from '../../components/AnchorLink';
import Callout from '../../components/Callout';
import SEO from '../../components/SEO';
import { Link } from 'react-router-dom';

const SPEC_URL = COMMERCE_PROTOCOL_LINKS.spec;

function CommerceConformance() {
  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol Conformance"
        description="Check a provider against the portable contract over REST, GraphQL, or both, without a hosted certification service."
        path="/commerce-protocol/conformance"
        keywords="OpenIAP Commerce Protocol conformance, conformance runner"
      />
      <h1>Conformance</h1>
      <p>
        <strong>
          Conformance checks test whether a provider keeps the contract it
          advertises.
        </strong>{' '}
        If it promises to connect purchases to users, for example, a
        verification-only credential must not be able to change an owner.
      </p>
      <p>
        Use this when reviewing your implementation or comparing providers. Ask
        for a passing report tied to the source and configuration you will run.
        An API response with the right field names is only part of that
        evidence.
      </p>
      <ol>
        <li>
          Choose the responsibilities and REST or GraphQL format the provider
          supports.
        </li>
        <li>
          Run the checks against an isolated instance with disposable users.
        </li>
        <li>
          Fix failures, rerun, and keep the result with the implementation.
        </li>
      </ol>
      <CommerceImplementationComparison topic="checks" />
      <section>
        <AnchorLink id="runner" level="h2">
          Run and read the checks
        </AnchorLink>
        <details>
          <summary>Runner setup and implementation requirements</summary>
          <p>
            First run the{' '}
            <Link to="/commerce-protocol/implementation#local-example">
              runnable local example
            </Link>{' '}
            to explore the purchase flow. It does not claim full profile
            conformance. To test your own implementation, use an isolated test
            instance with disposable identities: the operation vectors call
            binding and erasure as well as reads. Supply credentials from that
            instance.
          </p>
          <p>
            Follow the{' '}
            <Link to="/commerce-protocol/getting-started#install-contract">
              contract installation guide
            </Link>{' '}
            and add <code>ajv</code> with your package manager. Save the script
            in{' '}
            <a
              href={`${SPEC_URL}#112-the-portable-runner`}
              target="_blank"
              rel="noopener noreferrer"
            >
              SPEC.md §11.2
            </a>{' '}
            as <code>check-conformance.mjs</code> and run it with Node.js or
            Bun. Set <code>COMMERCE_BASE_URL</code>,{' '}
            <code>COMMERCE_VERIFICATION_TOKEN</code>, and{' '}
            <code>COMMERCE_SERVER_TOKEN</code> as in{' '}
            <Link to="/commerce-protocol/getting-started#connect">
              Connect to a provider
            </Link>
            , and <code>COMMERCE_GRAPHQL_URL</code> only when testing that
            binding. The adapters send each credential as a Bearer token.
          </p>
          <p>
            The runner talks only through the <code>fetch</code> you give it;
            the URL may point to a local test provider. A provider whose
            capability descriptor declares the <code>events</code> profile also
            supplies an <code>eventsAdapter</code> — the runner drives §9
            signing, verification, the delivery envelope, response semantics,
            the entitlement gate, and the emission rules through it, and a
            signing-only adapter fails.
          </p>
          <p>
            Implement the <code>EventsAdapter</code> interface in the installed
            <code> conformance/index.d.ts</code> against your own emitter. An
            advertised events profile without this adapter fails the run. Read
            <code> report.results</code> and <code>report.parityFailures</code>
            for failures; the script exits nonzero when <code>
              report.ok
            </code>{' '}
            is false.
          </p>
        </details>
        <Callout kind="warning">
          Conformance is a floor, not a production audit. The vectors use fake,
          well-formed evidence and do not certify real store validation, the
          event document schema, retry scheduling and dead-lettering,
          destination safety, or store-event mapping. Cover those behaviors in
          implementation-owned tests — see{' '}
          <a
            href={`${SPEC_URL}#11-conformance`}
            target="_blank"
            rel="noopener noreferrer"
          >
            SPEC.md §11
          </a>
          .
        </Callout>
      </section>
    </div>
  );
}

export default CommerceConformance;
