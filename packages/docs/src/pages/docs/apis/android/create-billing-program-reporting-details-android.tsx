import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function CreateBillingProgramReportingDetailsAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="createBillingProgramReportingDetailsAndroid"
        description="Step 3 of Billing Programs API. Create reporting details with external transaction token after successful payment."
        path="/docs/apis/android/create-billing-program-reporting-details-android"
        keywords="createBillingProgramReportingDetailsAndroid, reporting details"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        createBillingProgramReportingDetailsAndroid
      </h1>
      <p>
        Step 3 of Billing Programs API. Create reporting details with external
        transaction token after successful payment.
      </p>
      <p>
        Wraps{' '}
        <code>
          BillingClient.createBillingProgramReportingDetailsAsync(BillingProgram)
        </code>{' '}
        — returns the external transaction token to report a Developer-Provided
        Billing transaction. Play Billing 8.3.0+. See the{' '}
        <a
          href="https://developer.android.com/google/play/billing/billing-programs"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Play Billing reference
        </a>
        .
      </p>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>program</code>
            </td>
            <td>
              <Link to="/docs/types/billing-programs#billing-program-android">
                <code>BillingProgramAndroid</code>
              </Link>
            </td>
            <td>Yes</td>
            <td>Billing program identifier.</td>
          </tr>
        </tbody>
      </table>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/billing-programs#billing-program-reporting-details-android">
          <code>Promise&lt;BillingProgramReportingDetailsAndroid&gt;</code>
        </Link>{' '}
        — payload to report a Developer-Provided Billing transaction:
      </p>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>externalTransactionToken</code>
            </td>
            <td>
              <code>string</code>
            </td>
            <td>
              Token to send to Google's reporting API. Required for compliance.
            </td>
          </tr>
          <tr>
            <td>
              <code>responseCode</code>
            </td>
            <td>
              <code>number?</code>
            </td>
            <td>Raw Play Billing response code (when Play returned one).</td>
          </tr>
          <tr>
            <td>
              <code>debugMessage</code>
            </td>
            <td>
              <code>string?</code>
            </td>
            <td>Optional debug message from Play.</td>
          </tr>
        </tbody>
      </table>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`// Returns BillingProgramReportingDetailsAndroid with externalTransactionToken
// Token must be reported to Google Play backend within 24 hours
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun createBillingProgramReportingDetails(
    program: BillingProgramAndroid
): BillingProgramReportingDetailsAndroid`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default CreateBillingProgramReportingDetailsAndroid;
