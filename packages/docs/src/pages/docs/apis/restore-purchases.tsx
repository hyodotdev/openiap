import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function RestorePurchases() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="restorePurchases"
        description="Restore completed transactions. Use this to implement a Restore Purchases button for users who reinstall the app."
        path="/docs/apis/restore-purchases"
        keywords="restorePurchases, restore, transaction history"
      />
      <h1>restorePurchases</h1>
      <p>
        Restore completed transactions. Use this to implement a "Restore
        Purchases" button for users who reinstall the app.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`restorePurchases(): Promise<void>`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func restorePurchases() async throws`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun restorePurchases()`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun restorePurchases()`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<void> restorePurchases();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func restore_purchases() -> void`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import {
  restorePurchases,
  getAvailablePurchases,
  verifyPurchase,
  finishTransaction,
} from 'expo-iap';

const handleRestore = async () => {
  await restorePurchases();
  const purchases = await getAvailablePurchases();

  for (const purchase of purchases) {
    // Always verify before granting — restored purchases can include
    // refunded or revoked transactions that must not re-grant entitlement.
    const result = await verifyPurchase({
      purchase,
      serverUrl: 'https://your-server.com/api/verify',
    });
    if (!result.isValid) continue;

    await grantProduct(purchase.productId);
    await finishTransaction(purchase, false);
  }
};`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`try await OpenIapModule.shared.restorePurchases()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`openIapStore.restorePurchases()`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`kmpIAP.restorePurchases()`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`await FlutterInappPurchase.instance.restorePurchases();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`await iap.restore_purchases()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default RestorePurchases;
