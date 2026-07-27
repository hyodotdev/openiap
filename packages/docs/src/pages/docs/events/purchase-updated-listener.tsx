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

      <h3>Duplicate Transaction Replays on iOS</h3>
      <p>
        StoreKit can replay the same unfinished transaction through more than
        one native path during a single connection session. By default, OpenIAP
        delivers one <code>purchaseUpdated</code> event per iOS transaction ID
        to purchase-success listeners, while still keeping distinct transactions
        separate. This prevents entitlement delivery from running twice for the
        same purchase.
      </p>
      <p>
        For diagnostics, register the purchase update listener with{' '}
        <code>dedupeTransactionIOS: false</code>. The flag belongs to the
        purchase update listener only; purchase error listeners do not receive
        successful StoreKit transactions. Android ignores this iOS-only option.
      </p>

      <h3>Listener Setup</h3>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`purchaseUpdatedListener(
  listener: (purchase: Purchase) => void,
  options?: PurchaseUpdatedListenerOptions | null
): Subscription`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`let subscription = OpenIapModule.shared.purchaseUpdatedListener(
    { purchase in
        print("Purchase updated: \\(purchase.productId)")
    },
    options: nil
)`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// Flow approach
val purchaseUpdates: Flow<Purchase>`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`// Flow approach
val purchaseUpdates: Flow<Purchase> = kmpIAP.purchaseUpdatedListener`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Stream<Purchase> get purchaseUpdatedListener;`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;
using System;

IObservable<Purchase> purchaseUpdates = OpenIapClient.Instance.PurchaseUpdated;`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`signal purchase_updated(purchase: Purchase)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
      <p>Registers a listener for successful purchase events.</p>

      <h3>Opt In to iOS StoreKit Replays</h3>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`const subscription = purchaseUpdatedListener(
  (purchase) => {
    console.log('StoreKit replay or first delivery:', purchase.id);
  },
  { dedupeTransactionIOS: false }
);`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`let subscription = OpenIapModule.shared.purchaseUpdatedListener(
    { purchase in
        print("StoreKit replay or first delivery: \\(purchase.id)")
    },
    options: PurchaseUpdatedListenerOptions(
        dedupeTransactionIOS: false
    )
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`val updates = kmpIAP.purchaseUpdatedListener(
    PurchaseUpdatedListenerOptions(
        dedupeTransactionIOS = false
    )
)`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`final updates = FlutterInappPurchase.instance
    .purchaseUpdatedListenerWithOptions(
  const PurchaseUpdatedListenerOptions(
    dedupeTransactionIOS: false,
  ),
);`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`var updates = OpenIapClient.Instance.PurchaseUpdatedWithOptions(
    new PurchaseUpdatedListenerOptions
    {
        DedupeTransactionIOS = false,
    });`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`var options = Types.PurchaseUpdatedListenerOptions.new()
options.dedupe_transaction_ios = false
iap.set_purchase_updated_listener_options(options)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import { finishTransaction, purchaseUpdatedListener } from 'expo-iap';
// Same API in react-native-iap:
// import { finishTransaction, purchaseUpdatedListener } from 'react-native-iap';

const subscription = purchaseUpdatedListener(async (purchase) => {
  console.log('Purchase updated:', purchase.productId);

  // Verify with your backend or IAPKit before granting content.
  const isValid = await verifyPurchaseOnServer(purchase);

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

let subscription = OpenIapModule.shared.purchaseUpdatedListener { purchase in
    Task {
        print("Purchase updated: \\(purchase.productId)")

        // Verify and deliver
        if await verifyPurchaseOnServer(purchase) {
            await deliverProduct(purchase.productId)
            try await OpenIapModule.shared.finishTransaction(
                purchase: purchase,
                isConsumable: false
            )
        }
    }
}

// Cleanup when done
OpenIapModule.shared.removeListener(subscription)`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`import dev.hyo.openiap.store.OpenIapStore

// Using Flow
lifecycleScope.launch {
    openIapStore.currentPurchase.collect { purchase ->
        purchase ?: return@collect
        println("Purchase updated: \${purchase.productId}")

        // Verify and deliver
        if (verifyPurchaseOnServer(purchase)) {
            deliverProduct(purchase.productId)
            openIapStore.finishTransaction(purchase, isConsumable = false)
        }
    }
}`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP

val kmpIAP = KmpIAP()

// Using Flow
lifecycleScope.launch {
    kmpIAP.purchaseUpdatedListener.collect { purchase ->
        println("Purchase updated: \${purchase.productId}")

        // Verify and deliver
        if (verifyPurchaseOnServer(purchase)) {
            deliverProduct(purchase.productId)
            kmpIAP.finishTransaction(purchase, isConsumable = false)
        }
    }
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final subscription = FlutterInappPurchase.instance.purchaseUpdatedListener.listen((purchase) async {
  print('Purchase updated: \${purchase.productId}');

  // Verify with your backend or IAPKit before granting content.
  final isValid = await verifyPurchaseOnServer(purchase);

  if (isValid) {
    // Deliver content to user
    await deliverProduct(purchase.productId);

    // Finish the transaction
    await FlutterInappPurchase.instance.finishTransaction(purchase: purchase);
  }
});

// Cleanup when done
subscription.cancel();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var subscription = OpenIapClient.Instance.PurchaseUpdated.Subscribe(async purchase =>
{
    if (purchase is PurchaseCommon purchaseInfo)
    {
        Console.WriteLine($"Purchase updated: {purchaseInfo.ProductId}");
    }

    // Verify and deliver
    if (await VerifyPurchaseOnServerAsync(purchase))
    {
        if (purchase is PurchaseCommon validPurchase)
        {
            await DeliverProductAsync(validPurchase.ProductId);
        }

        await ((MutationResolver)OpenIapClient.Instance).FinishTransactionAsync(
            new PurchaseInput(purchase),
            isConsumable: false);
    }
});

// Cleanup when done.
subscription.Dispose();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`# Connect to the signal
iap.purchase_updated.connect(_on_purchase_updated)

func _on_purchase_updated(purchase: Purchase):
    print("Purchase updated: %s" % purchase.product_id)

    # Verify with your backend or IAPKit before granting content.
    var is_valid = await verify_purchase_on_server(purchase)

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
