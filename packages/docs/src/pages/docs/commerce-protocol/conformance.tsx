import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import SEO from '../../../components/SEO';

const SPEC_URL =
  'https://github.com/hyodotdev/openiap/blob/main/specs/openiap/commerce-protocol/SPEC.md';

const RUNNER_SNIPPET = `import Ajv from "ajv/dist/2020.js";
import {
  createRestAdapter,
  createGraphqlAdapter,
  runConformance,
} from "openiap-commerce-protocol/conformance";

const report = await runConformance({
  adapters: [
    createRestAdapter({ baseUrl, fetch, credentials }),
    createGraphqlAdapter({ url: graphqlUrl, fetch, credentials }),
  ],
  Ajv,
  // Required: the same role-to-credential map the adapters use.
  credentials,
  // Required when your capability descriptor declares the events profile.
  eventsAdapter,
});`;

function CommerceConformance() {
  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol Conformance"
        description="The portable conformance runner: certify any provider offline, over REST, GraphQL, or both."
        path="/docs/commerce-protocol/conformance"
        keywords="OpenIAP Commerce Protocol conformance, conformance runner"
      />
      <h1>Conformance</h1>
      <p>
        Conformance is judged per binding — REST-conformant, GraphQL-conformant,
        or dual-binding, which adds cross-binding parity on every deterministic
        case. IAPKit is the dual-binding reference implementation, and the
        runner certifies an independent mock provider that shares no code with
        it, so passing measures the portable surface against the specification,
        not against IAPKit.
      </p>
      <section>
        <AnchorLink id="runner" level="h2">
          Point the runner at your backend
        </AnchorLink>
        <pre>
          <code>{RUNNER_SNIPPET}</code>
        </pre>
        <p>
          It runs offline, talks only through the <code>fetch</code> you give
          it, and judges only against generated schemas and vectors. A provider
          whose capability descriptor declares the <code>events</code> profile
          also supplies an <code>eventsAdapter</code> — the runner drives §9
          signing, verification, the delivery envelope, response semantics, the
          entitlement gate, and the emission rules through it, and a
          signing-only adapter fails.
        </p>
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
