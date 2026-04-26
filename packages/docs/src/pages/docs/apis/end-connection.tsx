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
        description="End the OpenIAP connection to the store service. Call when your app closes or the IAP component unmounts."
        path="/docs/apis/end-connection"
        keywords="endConnection, OpenIAP cleanup, billing client close"
      />
      <h1>endConnection</h1>
      <p>
        End connection to the store service. Call this when your app closes or
        the IAP component unmounts to clean up resources.
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

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> when the
        connection was closed cleanly.
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
          gdscript: (
            <CodeBlock language="gdscript">{`func end_connection() -> bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap
import { endConnection } from 'expo-iap';
// Same API in react-native-iap:
// import { endConnection } from 'react-native-iap';

// In React useEffect cleanup
useEffect(() => {
  void initConnection();

  return () => {
    void endConnection();
  };
}, []);

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
// useIAP automatically calls endConnection() when the component unmounts,
// so you only need the module-level call when you want to tear the
// connection down outside of the hook's lifecycle (e.g. on sign-out).
import { useIAP } from 'expo-iap';

function PurchaseScreen() {
  const { connected } = useIAP();

  // No explicit endConnection() call needed — the hook handles cleanup.
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
