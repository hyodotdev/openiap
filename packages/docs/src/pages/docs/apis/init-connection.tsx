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
        description="Initialize the OpenIAP connection before store operations and wait for a successful result."
        path="/docs/apis/init-connection"
        keywords="initConnection, OpenIAP init, billing client, store connection"
      />
      <h1>initConnection</h1>
      <p>
        Initialize the store connection and wait for a successful result before
        starting store operations.
      </p>
      <p>
        <strong>iOS:</strong> Verifies <code>AppStore.canMakePayments</code>,
        receives promoted IAPs through <code>PurchaseIntent.intents</code> on
        iOS 16.4+ (and <code>SKPaymentQueue</code> only on iOS 15–16.3), and
        starts a <code>Transaction.updates</code> listener that drives the
        purchase event stream. Safe to call repeatedly.{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/transaction/updates"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple docs
        </a>
        . React Native and Expo can connect on demand on iOS, but an explicit
        call keeps listener setup and cross-platform gating predictable.{' '}
        <strong>Android:</strong> Starts <code>BillingClient</code> and waits
        for <code>onBillingSetupFinished</code>. React Native and Expo do not
        open it implicitly; wait for <code>true</code> or the hook&apos;s{' '}
        <code>connected</code> flag before another Play Billing call. Meta
        Horizon additionally requires a current foreground <code>Activity</code>
        ; initialization fails with <code>MissingCurrentActivity</code> instead
        of falling back to an application context.{' '}
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
            <CodeBlock language="dart">{`Future<bool> initConnection({
  BillingChoiceScreenTypeAndroid? billingChoiceScreenTypeAndroid,
  BillingProgramAndroid? enableBillingProgramAndroid,
});`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<bool> InitConnectionAsync(InitConnectionConfig? config = null);`}</CodeBlock>
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
          <code>enableBillingProgramAndroid</code>{' '}
          <em>
            (optional,{' '}
            <Link to="/docs/types/billing-programs#billing-program-android">
              <code>BillingProgramAndroid</code>
            </Link>
            )
          </em>{' '}
          — <strong>Android.</strong> Enable a Play Billing program at
          connection time. <code>EXTERNAL_CONTENT_LINK</code> and{' '}
          <code>EXTERNAL_OFFER</code> require Billing 8.2.0+;{' '}
          <code>EXTERNAL_PAYMENTS</code> requires Billing 8.3.0+ (Japan only);
          <code>BILLING_CHOICE</code> is available in OpenIAP Spec 2.1.0 /{' '}
          <code>openiap-google</code> 2.3.0 and requires Billing 9.1.0+.
        </li>
        <li>
          <code>billingChoiceScreenTypeAndroid</code>{' '}
          <em>
            (optional,{' '}
            <Link to="/docs/types/billing-programs#billing-choice-screen-type-android">
              <code>BillingChoiceScreenTypeAndroid</code>
            </Link>
            )
          </em>{' '}
          — <strong>OpenIAP Spec 2.1.0 / openiap-google 2.3.0.</strong> Requires
          Play Billing 9.1.0+ and must match the Billing Choice renderer
          configured in Play Console. Defaults to <code>GOOGLE_RENDERED</code>;
          set <code>DEVELOPER_RENDERED</code> when your app owns the choice
          screen.
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
const connected = await initConnection();
if (!connected) throw new Error('Store connection failed');

// Android with a billing program (preferred — see InitConnectionConfig)
const externalOfferConnected = await initConnection({
  enableBillingProgramAndroid: 'external-offer',
});
if (!externalOfferConnected) throw new Error('Store connection failed');

// Developer-rendered Billing Choice (must match Play Console)
const billingChoiceConnected = await initConnection({
  enableBillingProgramAndroid: 'billing-choice',
  billingChoiceScreenTypeAndroid: 'developer-rendered',
});
if (!billingChoiceConnected) throw new Error('Store connection failed');

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

// Developer-rendered Billing Choice
openIapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.BillingChoice,
        billingChoiceScreenTypeAndroid = BillingChoiceScreenTypeAndroid.DeveloperRendered
    )
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP

val kmpIAP = KmpIAP()

// Standard connection
kmpIAP.initConnection()

// Developer-rendered Billing Choice
kmpIAP.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.BillingChoice,
        billingChoiceScreenTypeAndroid = BillingChoiceScreenTypeAndroid.DeveloperRendered
    )
)`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`await FlutterInappPurchase.instance.initConnection(
  enableBillingProgramAndroid: BillingProgramAndroid.BillingChoice,
  billingChoiceScreenTypeAndroid:
      BillingChoiceScreenTypeAndroid.DeveloperRendered,
);`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// Standard connection
await ((MutationResolver)OpenIapClient.Instance).InitConnectionAsync();

// Developer-rendered Billing Choice
await ((MutationResolver)OpenIapClient.Instance).InitConnectionAsync(
    new InitConnectionConfig
    {
        EnableBillingProgramAndroid = BillingProgramAndroid.BillingChoice,
        BillingChoiceScreenTypeAndroid = BillingChoiceScreenTypeAndroid.DeveloperRendered,
    });`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`# Standard connection
var success = await iap.init_connection()

# Developer-rendered Billing Choice (Android)
var config = InitConnectionConfig.new()
config.enable_billing_program_android = BillingProgramAndroid.BILLING_CHOICE
config.billing_choice_screen_type_android = BillingChoiceScreenTypeAndroid.DEVELOPER_RENDERED
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
        <Link to="/docs/types/billing-programs#billing-program-android">
          <code>enableBillingProgramAndroid</code>
        </Link>
        , and{' '}
        <Link to="/docs/types/billing-programs#billing-choice-screen-type-android">
          <code>billingChoiceScreenTypeAndroid</code>
        </Link>
        ).
      </p>
    </div>
  );
}

export default InitConnection;
