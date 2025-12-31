import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function ConnectionAPIs() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Connection APIs"
        description="OpenIAP connection management APIs - initConnection and endConnection for establishing and closing store connections."
        path="/docs/apis/connection"
        keywords="initConnection, endConnection, store connection, billing client"
      />
      <h1>Connection APIs</h1>
      <p>
        Manage the connection to the platform's billing service. These APIs must
        be called before any other IAP operations.
      </p>

      <TLDRBox>
        <ul>
          <li>
            Call <a href="#init-connection"><code>initConnection()</code></a> on app start
          </li>
          <li>
            Call <a href="#end-connection"><code>endConnection()</code></a> on app close or unmount
          </li>
          <li>Android supports alternative billing configuration</li>
        </ul>
      </TLDRBox>

      <section>
        <AnchorLink id="init-connection" level="h2">
          initConnection
        </AnchorLink>
        <p>
          Initialize connection to the store service. Must be called before any
          other IAP operations.
        </p>

        <h4>Signature</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`initConnection(config?: InitConnectionConfig): Promise<boolean>

interface InitConnectionConfig {
  alternativeBillingModeAndroid?: 'user-choice' | 'alternative-only';
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`func initConnection() async throws -> Bool`}</CodeBlock>
            ),
            kotlin: (
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

        <h4>Example</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { initConnection } from 'expo-iap';

// Standard connection
await initConnection();

// Android with user choice billing
await initConnection({
  alternativeBillingModeAndroid: 'user-choice'
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
          See:{' '}
          <Link to="/docs/types#init-connection-config">
            InitConnectionConfig
          </Link>
        </p>
      </section>

      <section>
        <AnchorLink id="end-connection" level="h2">
          endConnection
        </AnchorLink>
        <p>
          End connection to the store service. Call this when your app closes or
          the IAP component unmounts to clean up resources.
        </p>

        <h4>Signature</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`endConnection(): Promise<boolean>`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`func endConnection() async throws -> Bool`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`suspend fun endConnection(): Boolean`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`Future<bool> endConnection();`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func end_connection() -> bool`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <h4>Example</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { endConnection } from 'expo-iap';

// In React useEffect cleanup
useEffect(() => {
  void initConnection();

  return () => {
    void endConnection();
  };
}, []);`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`try await OpenIapModule.shared.endConnection()`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`openIapStore.endConnection()`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`await FlutterInappPurchase.instance.endConnection();`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# In _exit_tree or cleanup
func _exit_tree():
    await iap.end_connection()`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>
    </div>
  );
}

export default ConnectionAPIs;
