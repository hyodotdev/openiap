import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function CheckAlternativeBillingAvailabilityAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="checkAlternativeBillingAvailabilityAndroid"
        description="Step 1 of alternative billing flow. Check if alternative billing is available for this user/device."
        path="/docs/apis/android/check-alternative-billing-availability-android"
        keywords="checkAlternativeBillingAvailabilityAndroid, alternative billing"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        checkAlternativeBillingAvailabilityAndroid
      </h1>
      <p>
        Step 1 of alternative billing flow. Check if alternative billing is
        available for this user/device.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`// Returns true if available, false otherwise
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun checkAlternativeBillingAvailability(): Boolean`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default CheckAlternativeBillingAvailabilityAndroid;
