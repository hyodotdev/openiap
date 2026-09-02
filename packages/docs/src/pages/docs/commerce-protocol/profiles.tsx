import httpBinding from 'openiap-commerce-protocol/generated/bindings/http-binding.json';
import AnchorLink from '../../../components/AnchorLink';
import DataTable from '../../../components/DataTable';
import SEO from '../../../components/SEO';

const SPEC_URL =
  'https://github.com/hyodotdev/openiap/blob/main/specs/openiap-kit/SPEC.md';

interface ProfileRow {
  name: string;
  version: string;
  operations: string;
  covers: string;
}

const PROFILE_COVERAGE: Record<string, string> = {
  verification: 'Verifying store purchase evidence without touching accounts',
  entitlements: 'Tokenless server reads of status and access decisions',
  events: 'Normalized lifecycle events over signed webhooks',
  accountLifecycle: 'Binding purchases to your users and erasing them',
};

const PROFILE_ROWS: ProfileRow[] = Object.entries(httpBinding.profiles).map(
  ([name, version]) => ({
    name,
    version,
    operations:
      httpBinding.operations
        .filter((operation) => operation.profile === name)
        .map((operation) => operation.name)
        .join(', ') || '— (webhook contract)',
    covers: PROFILE_COVERAGE[name] ?? '',
  })
);

function CommerceProfiles() {
  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol Profiles"
        description="The Commerce Protocol's operation profiles: verification, entitlements, events, and account lifecycle."
        path="/docs/commerce-protocol/profiles"
        keywords="OpenIAP Commerce Protocol profiles, verification, entitlements, account lifecycle"
      />
      <h1>Profiles</h1>
      <p>
        The protocol is a small core plus named profiles. A provider implements
        a profile completely or not at all, and declares what it serves in its{' '}
        <a href="/docs/commerce-protocol/capabilities">capability descriptor</a>{' '}
        — so a caller branches on declarations, never on guesses.
      </p>
      <section>
        <AnchorLink id="profile-table" level="h2">
          The four profiles
        </AnchorLink>
        <DataTable
          columns={[
            {
              header: 'Profile',
              cell: (row: ProfileRow) => <code>{row.name}</code>,
            },
            { header: 'Version', cell: (row: ProfileRow) => row.version },
            {
              header: 'Operations',
              cell: (row: ProfileRow) => <code>{row.operations}</code>,
            },
            { header: 'Covers', cell: (row: ProfileRow) => row.covers },
          ]}
          rows={PROFILE_ROWS}
          rowKey={(row) => row.name}
        />
        <p>
          The table is rendered from the generated binding manifest, so it
          cannot drift from the contract. Full obligations:{' '}
          <a
            href={`${SPEC_URL}#3-profiles`}
            target="_blank"
            rel="noopener noreferrer"
          >
            SPEC.md §3
          </a>
          .
        </p>
      </section>
    </div>
  );
}

export default CommerceProfiles;
