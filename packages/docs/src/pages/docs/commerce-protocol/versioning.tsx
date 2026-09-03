import AnchorLink from '../../../components/AnchorLink';
import DataTable from '../../../components/DataTable';
import SEO from '../../../components/SEO';

const SPEC_URL =
  'https://github.com/hyodotdev/openiap/blob/main/specs/commerce-protocol/SPEC.md';

interface ChangeRow {
  change: string;
  impact: string;
}

const CHANGE_ROWS: ChangeRow[] = [
  {
    change:
      'New optional member on an open object, event type, operation, or error code',
    impact: 'MINOR',
  },
  {
    change: 'New value in an open space (store, environment, eventType…)',
    impact: 'MINOR',
  },
  {
    change: 'Member removed, renamed, retyped, or made required',
    impact: 'MAJOR',
  },
  {
    change: 'Member added to a closed object or closed enumeration',
    impact: 'MAJOR',
  },
  {
    change: 'Operation removed, or its path, method, or auth role changed',
    impact: 'MAJOR',
  },
];

function CommerceVersioning() {
  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol Versioning"
        description="MAJOR.MINOR rules for the protocol, its profiles, and its bindings — and what consumers pin on."
        path="/docs/commerce-protocol/versioning"
        keywords="OpenIAP Commerce Protocol versioning"
      />
      <h1>Versioning</h1>
      <p>
        The protocol, each profile, and each binding version independently as
        MAJOR.MINOR, and callers pin on the major. Open value spaces and open
        objects are what make MINOR additions safe: a consumer ignores what it
        does not recognise instead of failing.
      </p>
      <section>
        <AnchorLink id="impact" level="h2">
          What changes what
        </AnchorLink>
        <DataTable
          columns={[
            { header: 'Change', cell: (row: ChangeRow) => row.change },
            {
              header: 'Impact',
              cell: (row: ChangeRow) => <code>{row.impact}</code>,
            },
          ]}
          rows={CHANGE_ROWS}
          rowKey={(row) => row.change}
        />
        <p>
          The REST path&apos;s <code>v1</code> segment is the protocol major, so
          two majors can be served side by side during a migration. The full
          decision table is{' '}
          <a
            href={`${SPEC_URL}#12-versioning`}
            target="_blank"
            rel="noopener noreferrer"
          >
            SPEC.md §12
          </a>
          .
        </p>
      </section>
    </div>
  );
}

export default CommerceVersioning;
