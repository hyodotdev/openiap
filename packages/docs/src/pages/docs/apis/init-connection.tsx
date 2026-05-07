import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function InitConnection() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="initConnection"
        description="Initialize the OpenIAP connection to the store service. Must be called before any other IAP operations."
        path="/docs/apis/init-connection"
        keywords="initConnection, OpenIAP init, billing client, store connection"
      />
      <h1>initConnection</h1>
      <p>
        Initialize connection to the store service. Must be called before any
        other IAP operations.
      </p>
      <p>
        <strong>iOS:</strong> Verifies <code>AppStore.canMakePayments</code>,
        registers the <code>SKPaymentQueue</code> observer for promoted IAPs,
        and starts a <code>Transaction.updates</code> listener that drives the
        purchase event stream. Safe to call repeatedly.{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/transaction/updates"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple docs
        </a>
        . <strong>Android:</strong> Starts <code>BillingClient</code> and waits
        for <code>onBillingSetupFinished</code>. Required before any other Play
        Billing call.{' '}
        <a
          href="https://developer.android.com/reference/com/android/billingclient/api/BillingClient#startConnection(com.android.billingclient.api.BillingClientStateListener)"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google docs
        </a>
        .
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`initConnection(config?: InitConnectionConfig): Promise<boolean>`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func initConnection() async throws -> Bool`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun initConnection(config: InitConnectionConfig? = null): Boolean`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun initConnection(config: InitConnectionConfig? = null): Boolean`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> initConnection({InitConnectionConfig? config});`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<Boolean> InitConnectionAsync(InitConnectionConfig? Config = null)`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func init_connection(config: InitConnectionConfig = null) -> bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <p>
        Pass an optional{' '}
        <Link to="/docs/types/alternative-billing-types#init-connection-config">
          <code>InitConnectionConfig</code>
        </Link>{' '}
        — Android billing program flags. iOS ignores Android-specific fields.
      </p>
      <ul className="api-params">
        <li>
          <code>alternativeBillingModeAndroid</code>{' '}
          <em>
            (optional,{' '}
            <Link to="/docs/types/alternative-billing-types#alternative-billing-mode-android">
              <code>AlternativeBillingModeAndroid</code>
            </Link>
            )
          </em>{' '}
          — <strong>Android · deprecated.</strong> Opt into Google's user-choice
          billing flow. Prefer <code>enableBillingProgramAndroid</code>.
        </li>
        <li>
          <code>enableBillingProgramAndroid</code>{' '}
          <em>
            (optional,{' '}
            <Link to="/docs/types/billing-programs#billing-program-android">
              <code>BillingProgramAndroid</code>
            </Link>
            )
          </em>{' '}
          — <strong>Android.</strong> Enable a Play Billing 8.2.0+ program (
          <code>EXTERNAL_CONTENT_LINK</code> / <code>EXTERNAL_OFFER</code>) at
          connection time. <code>EXTERNAL_PAYMENTS</code> is gated to Billing
          8.3.0+ (Japan only).
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> once the
        platform billing client is connected.
      </p>

      <AnchorLink id="throws" level="h2">
        Throws
      </AnchorLink>
      <p>When the platform billing client fails to initialize.</p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap
import { initConnection } from 'expo-iap';
// Same API in react-native-iap:
// import { initConnection } from 'react-native-iap';

// Standard connection
await initConnection();

// Android with a billing program (preferred — see InitConnectionConfig)
await initConnection({
  enableBillingProgramAndroid: 'external-offer',
});

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
// useIAP auto-connects on mount and disconnects on unmount, so you almost
// never need to call initConnection() yourself. Pass connection options
// (e.g. enableBillingProgramAndroid) to the hook directly, and read the
// reactive "connected" flag from its return value.
import { useIAP } from 'expo-iap';

function PurchaseScreen() {
  const { connected } = useIAP({
    enableBillingProgramAndroid: 'external-offer',
  });

  return <Text>Store ready: {String(connected)}</Text>;
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`import OpenIap

try await OpenIapModule.shared.initConnection()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// Standard connection
openIapStore.initConnection()

// With alternative billing
openIapStore.initConnection(
    InitConnectionConfig(
        alternativeBillingModeAndroid = AlternativeBillingModeAndroid.UserChoice
    )
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP

val kmpIAP = KmpIAP()

// Standard connection
kmpIAP.initConnection()

// With alternative billing
kmpIAP.initConnection(
    InitConnectionConfig(
        alternativeBillingModeAndroid = AlternativeBillingModeAndroid.UserChoice
    )
)`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`await FlutterInappPurchase.instance.initConnection();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using Hyo.OpenIap;
using Hyo.OpenIap.Maui;

// Standard connection
await ((QueryResolver)OpenIap.Instance).InitConnectionAsync()

// With alternative billing
await ((QueryResolver)OpenIap.Instance).InitConnectionAsync(
    InitConnectionConfig(
        alternativeBillingModeAndroid = AlternativeBillingModeAndroid.UserChoice
    )
)`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`# Standard connection
var success = await iap.init_connection()

# With alternative billing (Android)
var config = InitConnectionConfig.new()
config.alternative_billing_mode_android = AlternativeBillingModeAndroid.USER_CHOICE
var success = await iap.init_connection(config)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p className="type-link">
        See{' '}
        <Link to="/docs/types/alternative-billing-types">
          InitConnectionConfig
        </Link>{' '}
        for the full list of supported config fields (
        <Link to="/docs/types/alternative-billing-types#alternative-billing-mode-android">
          <code>alternativeBillingModeAndroid</code>
        </Link>{' '}
        [deprecated],{' '}
        <Link to="/docs/types/billing-programs#billing-program-android">
          <code>enableBillingProgramAndroid</code>
        </Link>
        ).
      </p>
    </div>
  );
}

export default InitConnection;
