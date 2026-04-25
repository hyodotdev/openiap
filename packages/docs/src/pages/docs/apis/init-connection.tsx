import { Link } from 'react-router-dom';
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
          gdscript: (
            <CodeBlock language="gdscript">{`func init_connection(config: InitConnectionConfig = null) -> bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import { initConnection } from 'expo-iap';

// Standard connection
await initConnection();

// Android with a billing program (preferred — see InitConnectionConfig)
await initConnection({
  enableBillingProgramAndroid: 'external-offer',
});`}</CodeBlock>
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
        <code>alternativeBillingModeAndroid</code> [deprecated],{' '}
        <code>enableBillingProgramAndroid</code>).
      </p>
    </div>
  );
}

export default InitConnection;
