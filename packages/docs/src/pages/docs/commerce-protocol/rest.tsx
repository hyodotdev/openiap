import httpBinding from 'openiap-commerce-protocol/generated/bindings/http-binding.json';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import SEO from '../../../components/SEO';

const SPEC_URL =
  'https://github.com/hyodotdev/openiap/blob/main/specs/openiap/commerce-protocol/SPEC.md';

function CommerceRest() {
  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol REST Binding"
        description="The HTTP/JSON binding under /commerce/v1, generated from the GraphQL contract."
        path="/docs/commerce-protocol/rest"
        keywords="OpenIAP Commerce Protocol REST, commerce API, OpenAPI"
      />
      <h1>REST binding</h1>
      <p>
        Every operation lives under <code>/commerce/v1</code>: queries are{' '}
        <code>GET</code> with query parameters, mutations are <code>POST</code>{' '}
        with a JSON body, and credentials travel only in the{' '}
        <code>Authorization</code> header. The binding is described end to end
        by two generated artifacts — the HTTP manifest (
        <code>generated/bindings/http-binding.json</code>) and the OpenAPI 3.1
        document — both compiled from the contract, never authored.
      </p>
      <section>
        <AnchorLink id="errors" level="h2">
          Failures
        </AnchorLink>
        <p>
          Every failure is the status the{' '}
          <a href="/docs/commerce-protocol/graphql">shared error model</a>{' '}
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
