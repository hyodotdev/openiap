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
