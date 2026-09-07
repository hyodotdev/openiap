import { COMMERCE_PROTOCOL_LINKS } from '../../lib/config';
import AnchorLink from '../../components/AnchorLink';
import Callout from '../../components/Callout';
import SEO from '../../components/SEO';
import CodeBlock from '../../components/CodeBlock';
import { Link } from 'react-router-dom';

const SPEC_URL = COMMERCE_PROTOCOL_LINKS.spec;

const EXAMPLE_QUERY = `query SubscriptionStatus($input: SubscriptionStatusInput!) {
  subscriptionStatus(input: $input) {
    active
    subscription { productId state active expiresAt }
  }
}`;

function CommerceGraphql() {
  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol GraphQL Binding"
        description="The executable GraphQL binding: one endpoint, the generated schema projection, the same semantics as REST."
        path="/commerce-protocol/graphql"
        keywords="OpenIAP Commerce Protocol GraphQL, commerce GraphQL API"
      />
      <h1>GraphQL binding</h1>
      <p>
        The same six operations at one <code>POST</code> endpoint, whose path
        each provider documents, executing exactly the generated schema
        projection (<code>generated/bindings/operations.graphql</code>). The
        same authentication and account rules apply to both bindings.
      </p>
      <section>
        <AnchorLink id="example" level="h2">
          Calling it
        </AnchorLink>
        <CodeBlock language="graphql">{EXAMPLE_QUERY}</CodeBlock>
        <p>
          Save this request as <code>request.json</code>. Replace the sample
          user ID with the identity selected by your authenticated backend:
        </p>
        <CodeBlock language="json">
          {JSON.stringify(
            {
              query: EXAMPLE_QUERY,
              operationName: 'SubscriptionStatus',
              variables: { input: { userId: 'backend-selected-user' } },
            },
            null,
            2
          )}
        </CodeBlock>
        <CodeBlock language="bash">{`# Use your provider's GraphQL URL and complete server Authorization header.
curl --fail-with-body "$COMMERCE_GRAPHQL_URL" \\
  -H "Authorization: $COMMERCE_SERVER_AUTH" \\
  -H 'Content-Type: application/json' \\
  --data-binary @request.json`}</CodeBlock>
        <p>
          Check <code>errors</code> before using{' '}
          <code>data.subscriptionStatus</code>. A protocol-coded error uses HTTP
          200, so HTTP success alone does not mean the operation succeeded. A
          codeless request-validation error may use HTTP 400; treat either
          request-validation form as <code>INVALID_REQUEST</code>.
        </p>
        <p>
          Providers advertising both bindings must return equivalent results.
          The <a href={COMMERCE_PROTOCOL_LINKS.example}>local example</a>{' '}
          implements REST only; use your GraphQL provider and the{' '}
          <Link to="/commerce-protocol/conformance">conformance runner</Link> to
          verify this binding.
        </p>
        <Callout kind="important">
          There is no Subscription root, ever: the operation surface is bounded
          request/response, and the compiler rejects a stream a shipped app
          could hold open. See{' '}
          <a
            href={`${SPEC_URL}#7-graphql-binding`}
            target="_blank"
            rel="noopener noreferrer"
          >
            SPEC.md §7
          </a>
          .
        </Callout>
      </section>
    </div>
  );
}

export default CommerceGraphql;
