import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function EnableBillingProgramAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="enableBillingProgramAndroid"
        description="Step 0 of Billing Programs API. Enable a billing program before initConnection() (Billing Library 8.2.0+)."
        path="/docs/apis/android/enable-billing-program-android"
        keywords="enableBillingProgramAndroid, Billing Programs API, External Offer"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        enableBillingProgramAndroid
      </h1>
      <p>
        Step 0 of Billing Programs API. Enable a billing program before
        initConnection() (Billing Library 8.2.0+).
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`// Call BEFORE initConnection()
// program: BillingProgramAndroid.ExternalOffer or BillingProgramAndroid.ExternalContentLink
fun enableBillingProgram(program: BillingProgramAndroid)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default EnableBillingProgramAndroid;
