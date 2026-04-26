import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
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
      <p>
        Sets <code>enableBillingProgramAndroid</code> on{' '}
        <code>InitConnectionConfig</code>; under the hood it configures{' '}
        <code>BillingClient.Builder.enableBillingPrograms(...)</code> (Play
        Billing 8.2.0+). See the{' '}
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
              <code>billingProgramAndroid</code>
            </td>
            <td>
              <Link to="/docs/types/billing-programs#billing-program-android">
                <code>BillingProgramAndroid</code>
              </Link>
            </td>
            <td>Yes</td>
            <td>
              Note: this is a config field of <code>InitConnectionConfig</code>{' '}
              passed to <code>initConnection()</code>, not a standalone
              mutation.
            </td>
          </tr>
        </tbody>
      </table>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;void&gt;</code> — Resolves once the program is enabled.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap
import { initConnection } from 'expo-iap';
// Same API in react-native-iap:
// import { initConnection } from 'react-native-iap';

await initConnection({
  enableBillingProgramAndroid: 'external-offer',
  // 'user-choice-billing' | 'external-content-link' | 'external-offer' | 'external-payments'
});

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
// useIAP auto-connects on mount and accepts the same enableBillingProgramAndroid
// option directly, so the billing program is wired without an explicit
// initConnection() call.
import { useIAP } from 'expo-iap';

function App() {
  useIAP({ enableBillingProgramAndroid: 'external-offer' });

  return <Root />;
}`}</CodeBlock>
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
