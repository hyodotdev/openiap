import AnchorLink from '../../../components/AnchorLink';
import DataTable from '../../../components/DataTable';
import SEO from '../../../components/SEO';

const SPEC_URL =
  'https://github.com/hyodotdev/openiap/blob/main/specs/openiap/commerce-protocol/SPEC.md';

interface RoleRow {
  role: string;
  holder: string;
  may: string;
}

const ROLE_ROWS: RoleRow[] = [
  {
    role: 'verification',
    holder: 'May ship inside an application',
    may: 'verifyPurchase, providerCapabilities',
  },
  {
    role: 'server',
    holder: "The caller's authenticated backend",
    may: 'Everything: status, entitlements, bind, erase',
  },
];

function CommerceAuthentication() {
  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol Authentication"
        description="Roles and trust rules: verification and server credentials, fail-close auth, no secrets in URLs."
        path="/docs/commerce-protocol/authentication"
        keywords="OpenIAP Commerce Protocol authentication, credential roles"
      />
      <h1>Authentication</h1>
      <p>
        The protocol standardizes roles and rules, not credential formats — how
        a provider issues or names its credentials is its own business.
      </p>
      <section>
        <AnchorLink id="roles" level="h2">
          Two roles
        </AnchorLink>
        <DataTable
          columns={[
            { header: 'Role', cell: (row: RoleRow) => <code>{row.role}</code> },
            { header: 'Holder', cell: (row: RoleRow) => row.holder },
            { header: 'May call', cell: (row: RoleRow) => row.may },
          ]}
          rows={ROLE_ROWS}
          rowKey={(row) => row.role}
        />
        <p>
          One operation needs no credential at all:{' '}
          <a href="/docs/commerce-protocol/operations">
            <code>providerCapabilities</code>
          </a>{' '}
          is a public, commerce-free read (auth role <code>none</code>). Every
          other operation requires one of the two roles above.
        </p>
        <p>
          Credentials travel in the <code>Authorization</code> header and never
          in a URL. Auth fails closed — a credentialled operation with no
          credential is <code>UNAUTHORIZED</code>, the wrong role is{' '}
          <code>FORBIDDEN</code> — and the two roles are distinct credentials,
          which is what blocks a shipped app from walking arbitrary user
          identities. Full rules:{' '}
          <a
            href={`${SPEC_URL}#5-authentication-and-trust`}
            target="_blank"
            rel="noopener noreferrer"
          >
            SPEC.md §5
          </a>
          .
        </p>
      </section>
    </div>
  );
}

export default CommerceAuthentication;
