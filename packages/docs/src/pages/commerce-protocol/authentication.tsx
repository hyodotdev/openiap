import CommerceImplementationComparison from '../../components/CommerceImplementationComparison';
import { COMMERCE_PROTOCOL_LINKS } from '../../lib/config';
import AnchorLink from '../../components/AnchorLink';
import DataTable from '../../components/DataTable';
import SEO from '../../components/SEO';
import httpBinding from '@hyodotdev/openiap-commerce-protocol/generated/bindings/http-binding.json';

const SPEC_URL = COMMERCE_PROTOCOL_LINKS.spec;

interface RoleRow {
  role: string;
  holder: string;
  may: string;
}

const ROLE_ROWS: RoleRow[] = [
  {
    role: 'verification',
    holder: 'May ship inside an application',
    may: httpBinding.operations
      .filter((operation) => operation.auth !== 'server')
      .map((operation) => operation.name)
      .join(', '),
  },
  {
    role: 'server',
    holder: "The caller's authenticated backend",
    may: httpBinding.operations.map((operation) => operation.name).join(', '),
  },
];

function CommerceAuthentication() {
  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol Authentication"
        description="Roles and trust rules: verification and server credentials, fail-close auth, no secrets in URLs."
        path="/commerce-protocol/authentication"
        keywords="OpenIAP Commerce Protocol authentication, credential roles"
      />
      <h1>Authentication</h1>
      <p>
        Authentication answers{' '}
        <strong>“who is making this request, and what may they do?”</strong>{' '}
        There are two separate relationships: Alice signs in to your app; your
        backend authenticates itself to the commerce provider.
      </p>
      <div className="commerce-role-benefits">
        <article>
          <h2>Alice → your backend</h2>
          <p>
            Your existing login identifies Alice. Your backend selects her user
            ID and checks whether she may claim this purchase.
          </p>
        </article>
        <article>
          <h2>Your backend → provider</h2>
          <p>
            A server credential allows account reads and changes. Keep it on
            your backend; Alice’s app must never receive it.
          </p>
        </article>
      </div>
      <p>
        A receipt proves neither relationship. Bob holding Alice’s receipt must
        not be enough to move the purchase to Bob.
      </p>
      <CommerceImplementationComparison topic="auth" />
      <section>
        <AnchorLink id="roles" level="h2">
          Choose the credential for the job
        </AnchorLink>
        <p>
          A <strong>verification</strong> credential can check purchase
          evidence. A <strong>server</strong> credential can also read access,
          bind purchases, and request erasure. These must be different
          credentials.
        </p>
        <details>
          <summary>Credential roles and allowed operations</summary>
          <DataTable
            columns={[
              {
                header: 'Role',
                cell: (row: RoleRow) => <code>{row.role}</code>,
              },
              { header: 'Holder', cell: (row: RoleRow) => row.holder },
              { header: 'May call', cell: (row: RoleRow) => row.may },
            ]}
            rows={ROLE_ROWS}
            rowKey={(row) => row.role}
          />
        </details>
        <p>
          One operation needs no credential at all:{' '}
          <a href="/commerce-protocol/operations">
            <code>providerCapabilities</code>
          </a>{' '}
          is a public read with no customer purchase data (auth role{' '}
          <code>none</code>). Every other operation requires one of the two
          roles above.
        </p>
        <p>
          Providers issue their own credentials; the protocol does not impose a
          key format. Credentials travel in the <code>Authorization</code>{' '}
          header and never in a URL. A protected request without a credential
          returns <code>UNAUTHORIZED</code>; a credential with the wrong role
          returns <code>FORBIDDEN</code>. Separate credentials keep a shipped
          app from looking up or changing other users’ accounts. Full rules:{' '}
          <a
            href={`${SPEC_URL}#5-authentication-and-trust`}
            target="_blank"
            rel="noopener noreferrer"
          >
            SPEC.md §5
          </a>
          .
        </p>
        <p>
          Authenticate server-role operations before validating their input. In
          GraphQL this includes authorization before variable coercion, not only
          inside a resolver. The app backend selects the user from its session
          and ownership policy; neither a client-supplied user ID nor possession
          of a receipt authorizes binding by itself.
        </p>
      </section>
    </div>
  );
}

export default CommerceAuthentication;
