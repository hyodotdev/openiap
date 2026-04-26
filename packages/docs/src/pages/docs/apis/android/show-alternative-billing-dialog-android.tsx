import AnchorLink from '../../../../components/AnchorLink';
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
      <p>
        Wraps{' '}
        <code>
          BillingClient.showAlternativeBillingOnlyInformationDialog(activity,
          listener)
        </code>{' '}
        — step 2. Required disclosure sheet before charging via your own payment
        system. See the{' '}
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
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> if the user
        accepts the disclosure dialog, <code>false</code> if they cancel (step 2
        of 3).
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
