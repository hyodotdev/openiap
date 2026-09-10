import CommerceImplementationComparison from '../../components/CommerceImplementationComparison';
import { COMMERCE_PROTOCOL_LINKS } from '../../lib/config';
import httpBinding from '@hyodotdev/openiap-commerce-protocol/generated/bindings/http-binding.json';
import AnchorLink from '../../components/AnchorLink';
import Callout from '../../components/Callout';
import SEO from '../../components/SEO';
import CodeBlock from '../../components/CodeBlock';
import { Link } from 'react-router-dom';

const SPEC_URL = COMMERCE_PROTOCOL_LINKS.spec;
const ENTITLEMENTS_PATH = httpBinding.operations.find(
  (operation) => operation.name === 'entitlements'
)!.path;

function CommerceRest() {
  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol REST Binding"
        description="The HTTP/JSON binding under /commerce/v1, generated from the GraphQL contract."
        path="/commerce-protocol/rest"
        keywords="OpenIAP Commerce Protocol REST, commerce API, OpenAPI"
      />
      <h1>REST</h1>
      <p>
        REST is one way your backend calls the provider: an HTTP request to a
        named URL, with JSON in the response. A <strong>binding</strong> is the
        protocol’s exact mapping of an operation to that request format.
      </p>
      <p>
        For example, your backend asks for Alice’s entitlements and gets the
        products she may use. Choose REST when it fits your existing stack; it
        has the same purchase and account rules as GraphQL.
      </p>
      <p>
        Every operation lives under <code>/commerce/v1</code>: queries are{' '}
        <code>GET</code> with query parameters, mutations are <code>POST</code>{' '}
        with a JSON body, and credentials travel only in the{' '}
        <code>Authorization</code> header. Use the provider's base URL and check
        its declared profiles before calling an operation.
      </p>
      <CommerceImplementationComparison topic="rest" />
      <section>
        <AnchorLink id="example" level="h2">
          Read current access
        </AnchorLink>
        <p>
          Run this from your authenticated backend. Set the complete
          Authorization header value in <code>COMMERCE_SERVER_AUTH</code> and
          select <code>COMMERCE_USER_ID</code> from the backend's session and
          ownership policy.
        </p>
        <CodeBlock language="bash">{`export COMMERCE_BASE_URL='https://your-provider.example'
curl --fail-with-body --get "$COMMERCE_BASE_URL${ENTITLEMENTS_PATH}" \\
  -H "Authorization: $COMMERCE_SERVER_AUTH" \\
  --data-urlencode "userId=$COMMERCE_USER_ID"`}</CodeBlock>
        <p>
          Read <code>productIds</code> for current access. An empty list grants
          nothing; a failed request must not be treated as a successful access
          decision. Follow{' '}
          <Link to="/commerce-protocol/getting-started#verify-bind-read">
            verify, bind, and read
          </Link>{' '}
          for the complete flow, or run the{' '}
          <a href={COMMERCE_PROTOCOL_LINKS.example}>local example</a> with
          fixture evidence.
        </p>
        <p>
          The package's{' '}
          <code>generated/openapi/commerce-protocol.openapi.json</code> defines
          requests and responses. The{' '}
          <Link to="/commerce-protocol/operations">operation table</Link> lists
          paths, profiles, and required roles from the generated HTTP manifest.
        </p>
      </section>
      <section>
        <AnchorLink id="errors" level="h2">
          Failures
        </AnchorLink>
        <p>
          Every failure is the status the{' '}
          <a href={`${SPEC_URL}#8-portable-errors`}>shared error model</a>{' '}
          assigns, with one envelope:
        </p>
        <pre>
          <code>{`{ "error": { "code": "VERIFICATION_FAILED", "message": "..." } }`}</code>
        </pre>
        <Callout kind="note">
          Unknown input members are ignored, which is what makes a MINOR input
          addition safe — and callers must ignore unknown result members for the
          same reason. Details:{' '}
          <a
            href={`${SPEC_URL}#6-rest-binding`}
            target="_blank"
            rel="noopener noreferrer"
          >
            SPEC.md §6
          </a>{' '}
          and{' '}
          <a
            href={`${SPEC_URL}#8-portable-errors`}
            target="_blank"
            rel="noopener noreferrer"
          >
            §8
          </a>
          .
        </Callout>
        <p>
          {Object.keys(httpBinding.errorStatus).length} error codes share one
          open space across both bindings; the manifest carries the
          code-to-status table.
        </p>
      </section>
    </div>
  );
}

export default CommerceRest;
