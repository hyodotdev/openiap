import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function IsBillingProgramAvailableAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="isBillingProgramAvailableAndroid"
        description="Step 1 of Billing Programs API. Check if a billing program is available for the current user."
        path="/docs/apis/android/is-billing-program-available-android"
        keywords="isBillingProgramAvailableAndroid, Billing Programs API, availability"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        isBillingProgramAvailableAndroid
      </h1>
      <p>
        Step 1 of Billing Programs API. Check if a billing program is available
        for the current user.
      </p>
      <p>
        Wraps{' '}
        <code>
          BillingClient.isBillingProgramAvailableAsync(BillingProgram)
        </code>{' '}
        — replaces <code>isExternalOfferAvailableAsync</code>. Play Billing
        8.2.0+. See the{' '}
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
        <code>Promise&lt;BillingProgramAvailabilityResultAndroid&gt;</code> —
        Availability result with <code>isAvailable</code> flag. See{' '}
        <Link to="/docs/types/billing-programs#billing-program-availability-result-android">
          <code>BillingProgramAvailabilityResultAndroid</code>
        </Link>
        .
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`// Returns BillingProgramAvailabilityResultAndroid with isAvailable flag
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun isBillingProgramAvailable(
    program: BillingProgramAndroid
): BillingProgramAvailabilityResultAndroid`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default IsBillingProgramAvailableAndroid;
