import { Link } from 'react-router-dom';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function GetReceiptDataIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getReceiptDataIOS"
        description="Get base64-encoded receipt data for legacy validation."
        path="/docs/apis/ios/get-receipt-data-ios"
        keywords="getReceiptDataIOS, receipt, legacy validation"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        getReceiptDataIOS
      </h1>
      <p>Get base64-encoded receipt data for legacy validation.</p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`getReceiptDataIOS(): Promise<string | null>`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func getReceiptDataIOS() async throws -> String?`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun getReceiptDataIOS(): String?`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun getReceiptDataIOS(): String?`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<String?> getReceiptDataIOS();`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap
import { getReceiptDataIOS } from 'expo-iap';
// Same API in react-native-iap:
// import { getReceiptDataIOS } from 'react-native-iap';

const receipt = await getReceiptDataIOS();
// Send the base64-encoded receipt to your server for legacy verifyReceipt.
console.log(receipt?.length ?? 0, 'bytes');

// --- Or alongside the useIAP() hook (also exported from react-native-iap) ---
// getReceiptDataIOS is a module-level helper; useIAP doesn't expose it on the
// hook return, so call the module function from inside your component once
// the hook reports the connection is ready.
import { useIAP } from 'expo-iap';

function ReceiptUploader() {
  const { connected } = useIAP();

  const upload = async () => {
    if (!connected) return;
    const receipt = await getReceiptDataIOS();
    if (!receipt) return;
    await fetch('/api/validate-receipt', {
      method: 'POST',
      body: JSON.stringify({ receipt }),
    });
  };

  return <Button title="Upload receipt" onPress={upload} />;
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`let receipt = try await OpenIapModule.shared.getReceiptDataIOS()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`val receipt = openIapStore.getReceiptDataIOS()`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`val receipt = kmpIAP.getReceiptDataIOS()`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`final receipt = await FlutterInappPurchase.instance.getReceiptDataIOS();`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p>
        iOS receipts contain <strong>all</strong> transactions for the bundle,
        not just the latest one. For per-transaction validation prefer{' '}
        <Link to="/docs/apis/ios/get-transaction-jws-ios">
          <code>getTransactionJwsIOS</code>
        </Link>
        . If the receipt file has not yet been written (e.g. immediately after
        the very first purchase), Apple recommends calling{' '}
        <Link to="/docs/apis/ios/sync-ios">
          <code>syncIOS</code>
        </Link>{' '}
        and retrying.
      </p>
    </div>
  );
}

export default GetReceiptDataIOS;
