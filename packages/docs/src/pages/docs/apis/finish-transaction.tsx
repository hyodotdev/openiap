import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function FinishTransaction() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="finishTransaction"
        description="Complete a purchase transaction. Must be called after verifying the purchase to remove it from the queue."
        path="/docs/apis/finish-transaction"
        keywords="finishTransaction, acknowledge, consume, complete purchase"
      />
      <h1>finishTransaction</h1>
      <p>
        Complete a purchase transaction. Must be called after verifying the
        purchase to remove it from the queue.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`finishTransaction(args: MutationFinishTransactionArgs): Promise<void>

interface MutationFinishTransactionArgs {
  purchase: Purchase;
  isConsumable?: boolean | null;
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func finishTransaction(_ purchase: Purchase, isConsumable: Bool = false) async throws`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun finishTransaction(purchase: Purchase, isConsumable: Boolean = false)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun finishTransaction(purchase: Purchase, isConsumable: Boolean = false)`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<void> finishTransaction(Purchase purchase, {bool isConsumable = false});`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func finish_transaction(purchase: Purchase, is_consumable: bool = false) -> void`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap
import { finishTransaction, purchaseUpdatedListener } from 'expo-iap';
// Same API in react-native-iap:
// import { finishTransaction, purchaseUpdatedListener } from 'react-native-iap';

purchaseUpdatedListener(async (purchase) => {
  const verified = await verifyOnServer(purchase);
  if (!verified) return;

  await grantProduct(purchase.productId);

  const isConsumable = purchase.productId.includes('coins');
  await finishTransaction({ purchase, isConsumable });
});

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
// useIAP wires the purchase listener for you; finish the transaction inside
// the onPurchaseSuccess callback.
import { useIAP } from 'expo-iap';

function PurchaseScreen() {
  const { finishTransaction } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      const verified = await verifyOnServer(purchase);
      if (!verified) return;

      await grantProduct(purchase.productId);
      const isConsumable = purchase.productId.includes('coins');
      await finishTransaction({ purchase, isConsumable });
    },
  });

  return null;
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`try await OpenIapModule.shared.finishTransaction(purchase, isConsumable: false)`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`openIapStore.finishTransaction(purchase, isConsumable = false)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`kmpIAP.finishTransaction(purchase, isConsumable = false)

// --- Or via the DSL API ---
// requestPurchase { } returns a Purchase you pass through
// .toPurchaseInput() into finishTransaction. Use isConsumable = true for
// consumables, false for subscriptions / non-consumables.
val purchase = kmpIAP.requestPurchase {
    ios { sku = "com.app.coins_100" }
    android { skus = listOf("com.app.coins_100") }
}

// After server-side validation:
kmpIAP.finishTransaction(
    purchase = purchase.toPurchaseInput(),
    isConsumable = true
)`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`await FlutterInappPurchase.instance.finishTransaction(purchase);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`await iap.finish_transaction(purchase, false)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <div className="alert-card alert-card--warning">
        <p>
          <strong>Critical:</strong> Android purchases must be acknowledged
          within 3 days or they will be automatically refunded. iOS transactions
          will replay on every app launch if not finished.
        </p>
      </div>
    </div>
  );
}

export default FinishTransaction;
