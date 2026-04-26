import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function CreateAlternativeBillingTokenAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="createAlternativeBillingTokenAndroid"
        description="Step 3 of alternative billing flow. Create external transaction token for Google Play reporting."
        path="/docs/apis/android/create-alternative-billing-token-android"
        keywords="createAlternativeBillingTokenAndroid, external transaction token"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        createAlternativeBillingTokenAndroid
      </h1>
      <p>
        Step 3 of alternative billing flow. Create external transaction token
        for Google Play reporting.
      </p>
      <p>
        Wraps{' '}
        <code>
          BillingClient.createAlternativeBillingOnlyReportingDetailsAsync()
        </code>{' '}
        — step 3. Token must be reported to Google within 24h of payment. See
        the{' '}
        <a
          href="https://developer.android.com/google/play/billing/alternative"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Play Billing reference
        </a>
        .
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`// Token must be reported to Google Play backend within 24 hours
// Returns token string, or null if creation failed
suspend fun createAlternativeBillingToken(): String?`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default CreateAlternativeBillingTokenAndroid;
