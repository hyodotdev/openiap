import httpBinding from 'openiap-commerce-protocol/generated/bindings/http-binding.json';
import AnchorLink from '../../../components/AnchorLink';
import DataTable from '../../../components/DataTable';
import SEO from '../../../components/SEO';

const SPEC_URL =
  'https://github.com/hyodotdev/openiap/blob/main/specs/openiap-kit/SPEC.md';

type OperationRow = (typeof httpBinding.operations)[number];

function CommerceOperations() {
  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol Operations"
        description="The six portable operations: verify, status, entitlements, bind, erase, and capabilities."
        path="/docs/commerce-protocol/operations"
        keywords="OpenIAP Commerce Protocol operations, verifyPurchase, entitlements, bindPurchase, eraseUser"
      />
      <h1>Operations</h1>
      <p>
        Six operations make the portable surface, served identically over{' '}
        <a href="/docs/commerce-protocol/rest">REST</a> and{' '}
        <a href="/docs/commerce-protocol/graphql">GraphQL</a>. Every operation
        is idempotent, fails closed on partial state, and omits what it cannot
        determine instead of sending placeholders.
      </p>
      <section>
        <AnchorLink id="operation-table" level="h2">
          The surface
        </AnchorLink>
        <DataTable
          columns={[
            {
              header: 'Operation',
              cell: (row: OperationRow) => <code>{row.name}</code>,
            },
            {
              header: 'Profile',
              cell: (row: OperationRow) => <code>{row.profile}</code>,
            },
            {
              header: 'Auth role',
              cell: (row: OperationRow) => <code>{row.auth}</code>,
            },
            {
              header: 'REST',
              cell: (row: OperationRow) => (
                <code>
                  {row.method} {row.path}
                </code>
              ),
            },
          ]}
          rows={httpBinding.operations}
          rowKey={(row) => row.name}
        />
        <p>
          Rendered from the generated binding manifest. Behavioral rules per
          operation — evidence unions, tokenless reads, the anti-enumeration
          binding result, erasure limits — live in{' '}
          <a
            href={`${SPEC_URL}#4-operations`}
            target="_blank"
            rel="noopener noreferrer"
          >
            SPEC.md §4
          </a>
          .
        </p>
      </section>
    </div>
  );
}

export default CommerceOperations;
