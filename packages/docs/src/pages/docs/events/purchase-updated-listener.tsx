import { Link } from 'react-router-dom';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function PurchaseUpdatedListener() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="purchaseUpdatedListener"
        description="Listener fired when a purchase is successful or when a pending purchase is completed."
        path="/docs/events/purchase-updated-listener"
        keywords="purchaseUpdatedListener, purchase event, purchase updated, transaction listener"
      />
      <h1>purchaseUpdatedListener</h1>
      <p>
        Fired when a purchase is successful or when a pending purchase is
        completed.
      </p>

      <h3>Listener Setup</h3>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`purchaseUpdatedListener(
  listener: (purchase: Purchase) => void
): Subscription`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`// AsyncSequence approach
var purchaseUpdates: AsyncStream<Purchase>

// Combine approach
var purchaseUpdatedPublisher: AnyPublisher<Purchase, Never>`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// Flow approach
val purchaseUpdates: Flow<Purchase>`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`// Flow approach
val purchaseUpdates: Flow<Purchase>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Stream<Purchase> get purchaseUpdatedStream;`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// Flow approach
var purchaseUpdates: Flow<Purchase>`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`signal purchase_updated(purchase: Purchase)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
      <p>Registers a listener for successful purchase events.</p>

      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import { finishTransaction, purchaseUpdatedListener } from 'expo-iap';
// Same API in react-native-iap:
// import { finishTransaction, purchaseUpdatedListener } from 'react-native-iap';

const subscription = purchaseUpdatedListener(async (purchase) => {
  console.log('Purchase updated:', purchase.productId);

  // Validate the receipt
  const isValid = await validateReceipt(purchase);

  if (isValid) {
    // Deliver content to user
    await deliverProduct(purchase.productId);

    // Finish the transaction
    await finishTransaction({ purchase, isConsumable: false });
  }
});

// Cleanup when done
subscription.remove();`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`import OpenIap

// Using async/await
Task {
    for await purchase in OpenIapModule.shared.purchaseUpdates {
        print("Purchase updated: \\(purchase.productId)")

        // Validate and deliver
        if await validateReceipt(purchase) {
            await deliverProduct(purchase.productId)
            try await OpenIapModule.shared.finishTransaction(purchase)
        }
    }
}

// Or using Combine
OpenIapModule.shared.purchaseUpdatedPublisher
    .sink { purchase in
        print("Purchase updated: \\(purchase.productId)")
    }
    .store(in: &cancellables)`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`import dev.hyo.openiap.OpenIapStore

// Using Flow
lifecycleScope.launch {
    openIapStore.purchaseUpdates.collect { purchase ->
        println("Purchase updated: \${purchase.productId}")

        // Validate and deliver
        if (validateReceipt(purchase)) {
            deliverProduct(purchase.productId)
            openIapStore.finishTransaction(purchase, isConsumable = false)
        }
    }
}

// Or with callback
openIapStore.setPurchaseUpdatedListener { purchase ->
    println("Purchase updated: \${purchase.productId}")
}`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP

val kmpIAP = KmpIAP()

// Using Flow
lifecycleScope.launch {
    kmpIAP.purchaseUpdates.collect { purchase ->
        println("Purchase updated: \${purchase.productId}")

        // Validate and deliver
        if (validateReceipt(purchase)) {
            deliverProduct(purchase.productId)
            kmpIAP.finishTransaction(purchase, isConsumable = false)
        }
    }
}

// Or with callback
kmpIAP.setPurchaseUpdatedListener { purchase ->
    println("Purchase updated: \${purchase.productId}")
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final subscription = FlutterInappPurchase.purchaseUpdated.listen((purchase) async {
  print('Purchase updated: \${purchase?.productId}');

  // Validate the receipt
  final isValid = await validateReceipt(purchase);

  if (isValid) {
    // Deliver content to user
    await deliverProduct(purchase!.productId);

    // Finish the transaction
    await FlutterInappPurchase.instance.finishTransaction(purchase);
  }
});

// Cleanup when done
subscription.cancel();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// Using Flow
lifecycleScope.launch {
    openIapStore.purchaseUpdates.collect { purchase ->
        println("Purchase updated: \${purchase.productId}")

        // Validate and deliver
        if (validateReceipt(purchase)) {
            deliverProduct(purchase.productId)
            await ((QueryResolver)OpenIap.Instance).FinishTransactionAsync(purchase, isConsumable = false)
        }
    }
}

// Or with callback
openIapStore.setPurchaseUpdatedListener { purchase ->
    println("Purchase updated: \${purchase.productId}")
}`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`# Connect to the signal
iap.purchase_updated.connect(_on_purchase_updated)

func _on_purchase_updated(purchase: Purchase):
    print("Purchase updated: %s" % purchase.product_id)

    # Validate the receipt
    var is_valid = await validate_receipt(purchase)

    if is_valid:
        # Deliver content to user
        await deliver_product(purchase.product_id)

        # Finish the transaction
        await iap.finish_transaction(purchase, false)

# Cleanup when done
func _exit_tree():
    iap.purchase_updated.disconnect(_on_purchase_updated)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h3>Event Payload</h3>
      <p>
        The purchase event delivers a{' '}
        <Link to="/docs/types/purchase">Purchase</Link> object containing
        transaction details.
      </p>

      <h3>Purchase Update Flow</h3>
      <ol>
        <li>
          Receive <Link to="/docs/types/purchase">Purchase</Link> object via
          listener
        </li>
        <li>Validate receipt with backend service</li>
        <li>Deliver purchased content to user</li>
        <li>
          Finish transaction with{' '}
          <Link to="/docs/apis/finish-transaction">finishTransaction</Link>{' '}
          (handles acknowledgment on both platforms)
        </li>
        <li>Update application state</li>
      </ol>
    </div>
  );
}

export default PurchaseUpdatedListener;
