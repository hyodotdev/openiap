import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import DataTable from '../../../components/DataTable';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

interface FieldRow {
  name: string;
  type: ReactNode;
  summary: ReactNode;
}

interface ValueRow {
  value: string;
  meaning: string;
}

const VERIFY_APP_OWNERSHIP_PROPS_FIELDS: FieldRow[] = [
  {
    name: 'google',
    type: (
      <a href="#play-integrity-params-android">
        <code>PlayIntegrityParamsAndroid?</code>
      </a>
    ),
    summary: 'Required on Google Play. Ignored on Apple platforms.',
  },
];

const PLAY_INTEGRITY_PARAMS_FIELDS: FieldRow[] = [
  {
    name: 'cloudProjectNumber',
    type: <code>string</code>,
    summary:
      "Positive decimal string identifying the app's Google Cloud project. Use the project number, not the project ID or a secret key.",
  },
  {
    name: 'requestHash',
    type: <code>string</code>,
    summary:
      'Nonempty digest of a backend challenge and the request being protected, at most 500 UTF-8 bytes. Hash sensitive inputs; do not include them as plaintext.',
  },
];

const RESULT_FIELDS: FieldRow[] = [
  {
    name: 'status',
    type: (
      <a href="#app-ownership-status">
        <code>AppOwnershipStatus</code>
      </a>
    ),
    summary: 'The verdict. Unknown is inconclusive, never a denial.',
  },
  {
    name: 'storeId',
    type: <code>string</code>,
    summary: 'Store producing the result, such as apple or play.',
  },
  {
    name: 'reason',
    type: (
      <a href="#app-ownership-verification-reason">
        <code>AppOwnershipVerificationReason?</code>
      </a>
    ),
    summary: 'Why the result is unknown.',
  },
  {
    name: 'appTransactionIOS',
    type: (
      <Link to="/docs/types/ios/app-transaction-ios">
        <code>AppTransaction?</code>
      </Link>
    ),
    summary: 'Verified AppTransaction metadata on Apple platforms.',
  },
  {
    name: 'signedAppTransactionIOS',
    type: <code>string?</code>,
    summary:
      'Signed app transaction JWS for backend verification. This is separate from an in-app purchase JWS.',
  },
  {
    name: 'integrityTokenAndroid',
    type: <code>string?</code>,
    summary:
      'Encrypted Play Integrity token. Send it to your backend without decoding or trusting it in the app.',
  },
];

const STATUS_VALUES: ValueRow[] = [
  { value: 'licensed', meaning: 'The store verified the app acquisition.' },
  {
    value: 'unlicensed',
    meaning: 'The store reports no valid acquisition, such as a revoked one.',
  },
  {
    value: 'unknown',
    meaning:
      'No trustworthy decision is available. Never treat it as unlicensed.',
  },
];

const REASON_VALUES: ValueRow[] = [
  {
    value: 'backend-verification-required',
    meaning:
      'Evidence was collected; your backend must verify it. Play always returns this with a token, and Apple returns it from builds that cannot check revocation locally.',
  },
  {
    value: 'verification-failed',
    meaning: 'The store evidence could not be verified on the device.',
  },
  { value: 'network-error', meaning: 'The store could not be reached.' },
  {
    value: 'service-error',
    meaning: 'The store service failed, throttled the request, or timed out.',
  },
  {
    value: 'unsupported',
    meaning: 'This runtime or store cannot verify app ownership.',
  },
];

function FieldTable({ rows }: { rows: FieldRow[] }) {
  return (
    <DataTable
      className="doc-table"
      rows={rows}
      rowKey={(row) => row.name}
      columns={[
        { header: 'Name', cell: (row) => <code>{row.name}</code> },
        { header: 'Type', cell: (row) => row.type },
        { header: 'Summary', cell: (row) => row.summary },
      ]}
    />
  );
}

function ValueTable({ rows }: { rows: ValueRow[] }) {
  return (
    <DataTable
      className="doc-table"
      rows={rows}
      rowKey={(row) => row.value}
      columns={[
        { header: 'Value', cell: (row) => <code>{`'${row.value}'`}</code> },
        { header: 'Meaning', cell: (row) => row.meaning },
      ]}
    />
  );
}

function AppOwnershipVerificationTypes() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="App Ownership Verification Types"
        description="VerifyAppOwnershipProps, PlayIntegrityParamsAndroid, AppOwnershipVerificationResult, AppOwnershipStatus, and AppOwnershipVerificationReason field reference."
        path="/docs/types/app-ownership-verification"
        keywords="AppOwnershipVerificationResult, VerifyAppOwnershipProps, PlayIntegrityParamsAndroid, AppOwnershipStatus, AppOwnershipVerificationReason, verifyAppOwnership"
      />
      <h1>App Ownership Verification Types</h1>
      <p>
        Input and result types for{' '}
        <Link to="/docs/apis/verify-app-ownership">
          <code>verifyAppOwnership</code>
        </Link>
        . Enum values are shown as their wire strings.
      </p>

      <section>
        <AnchorLink id="verify-app-ownership-props" level="h2">
          VerifyAppOwnershipProps
        </AnchorLink>
        <FieldTable rows={VERIFY_APP_OWNERSHIP_PROPS_FIELDS} />
      </section>

      <section>
        <AnchorLink id="play-integrity-params-android" level="h2">
          PlayIntegrityParamsAndroid
        </AnchorLink>
        <p>Standard Play Integrity request bound to a backend challenge.</p>
        <FieldTable rows={PLAY_INTEGRITY_PARAMS_FIELDS} />
      </section>

      <section>
        <AnchorLink id="app-ownership-verification-result" level="h2">
          AppOwnershipVerificationResult
        </AnchorLink>
        <FieldTable rows={RESULT_FIELDS} />
      </section>

      <section>
        <AnchorLink id="app-ownership-status" level="h2">
          AppOwnershipStatus
        </AnchorLink>
        <ValueTable rows={STATUS_VALUES} />
      </section>

      <section>
        <AnchorLink id="app-ownership-verification-reason" level="h2">
          AppOwnershipVerificationReason
        </AnchorLink>
        <ValueTable rows={REASON_VALUES} />
      </section>
    </div>
  );
}

export default AppOwnershipVerificationTypes;
