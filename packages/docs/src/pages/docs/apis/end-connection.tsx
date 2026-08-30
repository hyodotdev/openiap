import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function EndConnection() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="endConnection"
        description="End the OpenIAP connection to the store service when the app-wide IAP session is no longer needed."
        path="/docs/apis/end-connection"
        keywords="endConnection, OpenIAP cleanup, billing client close"
      />
      <h1>endConnection</h1>
      <p>
        End connection to the store service. Call this when the owner of a
        manually managed connection unmounts or when the app-wide IAP session is
        no longer needed. Hook cleanup differs by framework; see the example
        below.
      </p>
      <p>
        <strong>iOS:</strong> Cancels the StoreKit{' '}
        <code>Transaction.updates</code> task and clears in-memory caches.{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/transaction/updates"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple docs
        </a>
        . <strong>Android:</strong> Calls{' '}
        <code>BillingClient.endConnection()</code>; the client cannot be reused
        after this — call <code>initConnection</code> again to reconnect.{' '}
        <a
          href="https://developer.android.com/reference/com/android/billingclient/api/BillingClient#endConnection()"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google docs
        </a>
        .
      </p>
      <p>
        <strong>React Native / Expo:</strong> if native teardown fails, the
        promise rejects without clearing the current connection or listener
        state. Cleanup happens only after a successful teardown, so the app can
        retry without silently losing purchase events.
      </p>

      <h2>Signature</h2>
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
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun endConnection(): Boolean`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> endConnection();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<bool> EndConnectionAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func end_connection() -> bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> when the
        connection was closed cleanly.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import { useEffect } from 'react';
import { Text } from 'react-native';

// expo-iap
import { endConnection, initConnection, useIAP } from 'expo-iap';
// Same API in react-native-iap:
// import { endConnection, initConnection, useIAP } from 'react-native-iap';

function ManualStoreConnection() {
  useEffect(() => {
    void initConnection()
      .then((connected) => {
        if (!connected) throw new Error('Store connection failed');
      })
      .catch((error) => {
        console.warn('Store connection failed:', error);
      });

    return () => {
      void endConnection().catch((error) => {
        console.warn('Store teardown failed:', error);
      });
    };
  }, []);

  return <Text>Manual store connection</Text>;
}

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
// Expo calls endConnection() when the component unmounts. React Native removes
// the hook's listeners but keeps the native connection open across screens;
// call the module-level endConnection() at an app-level teardown boundary such
// as sign-out when the connection should actually close.

function PurchaseScreen() {
  const { connected } = useIAP();

  return <Text>Store ready: {String(connected)}</Text>;
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`try await OpenIapModule.shared.endConnection()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`openIapStore.endConnection()`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`kmpIAP.endConnection()`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`await FlutterInappPurchase.instance.endConnection();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

await ((MutationResolver)OpenIapClient.Instance).EndConnectionAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`# In _exit_tree or cleanup
func _exit_tree():
    await iap.end_connection()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default EndConnection;
