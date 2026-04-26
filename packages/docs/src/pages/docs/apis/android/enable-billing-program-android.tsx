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
      <ul className="api-params">
        <li>
          <code>billingProgramAndroid</code>{' '}
          <em>
            (required,{' '}
            <Link to="/docs/types/billing-programs#billing-program-android">
              <code>BillingProgramAndroid</code>
            </Link>
            )
          </em>{' '}
          — Note: this is a config field of <code>InitConnectionConfig</code>{' '}
          passed to <code>initConnection()</code>, not a standalone mutation.
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;void&gt;</code> — Resolves once the program is enabled.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`// Config field on InitConnectionConfig — wired via initConnection()
data class InitConnectionConfig(
    val enableBillingProgramAndroid: BillingProgramAndroid? = null,
    // ...other fields
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`// Config field on InitConnectionConfig (kmp-iap)
data class InitConnectionConfig(
    val enableBillingProgramAndroid: BillingProgramAndroid? = null,
    // ...other fields
)`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`initConnection(config?: {
  enableBillingProgramAndroid?: BillingProgramAndroid;
  // ...other fields
}): Promise<boolean>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> initConnection({InitConnectionConfig? config});

class InitConnectionConfig {
  final BillingProgramAndroid? enableBillingProgramAndroid;
  // ...other fields
}`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`# InitConnectionConfig.enable_billing_program_android: BillingProgramAndroid
func init_connection(config: InitConnectionConfig) -> bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`openIapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
    )
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`// kmp-iap (Android targets only)
kmpIAP.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
    )
)`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { initConnection } from 'expo-iap';

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
          dart: (
            <CodeBlock language="dart">{`if (Platform.isAndroid) {
  await FlutterInappPurchase.instance.initConnection(
    config: InitConnectionConfig(
      enableBillingProgramAndroid: BillingProgramAndroid.externalOffer,
    ),
  );
}`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "Android":
    var config = InitConnectionConfig.new()
    config.enable_billing_program_android = BillingProgramAndroid.EXTERNAL_OFFER
    await iap.init_connection(config)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default EnableBillingProgramAndroid;
