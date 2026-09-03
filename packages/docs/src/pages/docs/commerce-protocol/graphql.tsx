import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import SEO from '../../../components/SEO';

const SPEC_URL =
  'https://github.com/hyodotdev/openiap/blob/main/specs/commerce-protocol/SPEC.md';

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
        path="/docs/commerce-protocol/graphql"
        keywords="OpenIAP Commerce Protocol GraphQL, commerce GraphQL API"
      />
      <h1>GraphQL binding</h1>
      <p>
        The same six operations at one <code>POST</code> endpoint — IAPKit
        serves <code>/commerce/v1/graphql</code> — executing exactly the
        generated schema projection (
        <code>generated/bindings/operations.graphql</code>). Introspection,
        where enabled, agrees with the projection; the same auth roles apply,
        and business logic never lives in resolvers: both bindings call one
        shared handler per operation.
      </p>
      <section>
        <AnchorLink id="example" level="h2">
          Calling it
        </AnchorLink>
        <pre>
          <code>{EXAMPLE_QUERY}</code>
        </pre>
        <p>
          An operation failure is an HTTP 200 whose{' '}
          <code>errors[*].extensions.code</code> carries the same code space the
          REST binding maps to statuses; a request-level validation failure
          reads as <code>INVALID_REQUEST</code>.
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
