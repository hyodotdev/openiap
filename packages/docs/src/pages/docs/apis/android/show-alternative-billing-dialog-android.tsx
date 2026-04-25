import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function ShowAlternativeBillingDialogAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="showAlternativeBillingDialogAndroid"
        description="Step 2 of alternative billing flow. Show alternative billing information dialog before processing payment."
        path="/docs/apis/android/show-alternative-billing-dialog-android"
        keywords="showAlternativeBillingDialogAndroid, alternative billing dialog"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        showAlternativeBillingDialogAndroid
      </h1>
      <p>
        Step 2 of alternative billing flow. Show alternative billing information
        dialog before processing payment.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`// Returns true if user accepted, false if user canceled
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun showAlternativeBillingDialog(): Boolean`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default ShowAlternativeBillingDialogAndroid;
