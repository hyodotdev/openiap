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
          csharp: (
            <CodeBlock language="csharp">{`using Hyo.OpenIap;
using Hyo.OpenIap.Maui;

// Config field on InitConnectionConfig — wired via initConnection()
data class InitConnectionConfig(
    var enableBillingProgramAndroid = null,
    // ...other fields
)`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`# InitConnectionConfig.enable_billing_program_android: BillingProgramAndroid
func init_connection(config: InitConnectionConfig) -> bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="config-field" level="h2">
        Config field
      </AnchorLink>
      <p>
        <code>enableBillingProgramAndroid</code> on{' '}
        <Link to="/docs/types/alternative-billing-types#init-connection-config">
          <code>InitConnectionConfig</code>
        </Link>
        : optional{' '}
        <Link to="/docs/types/billing-programs#billing-program-android">
          <code>BillingProgramAndroid</code>
        </Link>
        . Pass the program identifier you want to enable (e.g.{' '}
        <code>'external-offer'</code>) as part of the config you hand to{' '}
        <Link to="/docs/apis/init-connection">
          <code>initConnection()</code>
        </Link>
        ; the connection succeeds with the program enabled, and{' '}
        <code>initConnection()</code>'s own <code>Promise&lt;boolean&gt;</code>{' '}
        return value indicates the overall connection result. There is no
        separate <code>enableBillingProgramAndroid()</code> call.
      </p>

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
          csharp: (
            <CodeBlock language="csharp">{`using Hyo.OpenIap;
using Hyo.OpenIap.Maui;

await ((QueryResolver)OpenIap.Instance).InitConnectionAsync(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
    )
)`}</CodeBlock>
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
