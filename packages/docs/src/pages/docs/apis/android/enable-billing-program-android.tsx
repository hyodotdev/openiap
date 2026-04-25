import { Link } from 'react-router-dom';
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
        Enables a billing program for Android (Billing Library 8.2.0+). Pass it
        as the{' '}
        <Link to="/docs/types/billing-programs#billing-program-android">
          <code>enableBillingProgramAndroid</code>
        </Link>{' '}
        field of{' '}
        <Link to="/docs/types/alternative-billing-types#init-connection-config">
          <code>InitConnectionConfig</code>
        </Link>{' '}
        when calling <code>initConnection()</code> — there is no separate
        top-level call.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`await initConnection({
  enableBillingProgramAndroid: 'external-offer',
  // 'user-choice-billing' | 'external-content-link' | 'external-offer' | 'external-payments'
});`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`openIapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
    )
)`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`await FlutterInappPurchase.instance.initConnection(
  config: InitConnectionConfig(
    enableBillingProgramAndroid: BillingProgramAndroid.externalOffer,
  ),
);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`var config = InitConnectionConfig.new()
config.enable_billing_program_android = BillingProgramAndroid.EXTERNAL_OFFER
await iap.init_connection(config)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default EnableBillingProgramAndroid;
