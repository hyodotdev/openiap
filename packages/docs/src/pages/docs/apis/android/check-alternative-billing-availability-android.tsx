import AnchorLink from '../../../../components/AnchorLink';
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
      <p>
        Wraps{' '}
        <code>BillingClient.isAlternativeBillingOnlyAvailableAsync()</code> —
        step 1 of the alternative billing flow. Returns whether the user/device
        is eligible. See the{' '}
        <a
          href="https://developer.android.com/google/play/billing/alternative"
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
      <p>None.</p>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — Whether alternative billing is
        available for this user/device (step 1 of 3).
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
