import { Link } from 'react-router-dom';
import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import LanguageTabs from '../../components/LanguageTabs';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function Events() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Events"
        description="OpenIAP event system - purchaseUpdatedListener, purchaseErrorListener, and event-driven architecture for in-app purchases."
        path="/docs/events"
        keywords="IAP events, purchaseUpdatedListener, purchaseErrorListener"
      />
      <h1>Events</h1>

      <section>
        <h2>Event System Overview</h2>
        <p>
          The IAP library uses an event-driven architecture to handle purchase
          flows asynchronously. You must set up event listeners before
          initiating any purchase to properly handle the results.
        </p>

        <h3>Event Types</h3>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`enum IapEvent {
  PurchaseUpdated = 'purchaseUpdated',
  PurchaseError = 'purchaseError',
  PromotedProductIOS = 'promotedProductIOS',
  UserChoiceBillingAndroid = 'userChoiceBillingAndroid',
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`enum IapEvent {
    case purchaseUpdated
    case purchaseError
    case promotedProductIOS
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`enum class IapEvent {
    PurchaseUpdated,
    PurchaseError,
    UserChoiceBillingAndroid
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`enum IapEvent {
  purchaseUpdated,
  purchaseError,
  promotedProductIOS,
  userChoiceBillingAndroid,
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="purchase-updated-event" level="h2">
          Purchase Updated Event
        </AnchorLink>
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
            dart: (
              <CodeBlock language="dart">{`Stream<Purchase> get purchaseUpdatedStream;`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p>Registers a listener for successful purchase events.</p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { purchaseUpdatedListener } from 'expo-iap';

const subscription = purchaseUpdatedListener(async (purchase) => {
  console.log('Purchase updated:', purchase.productId);

  // Validate the receipt
  const isValid = await validateReceipt(purchase);

  if (isValid) {
    // Deliver content to user
    await deliverProduct(purchase.productId);

    // Finish the transaction
    await finishTransaction(purchase, { isConsumable: false });
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
          }}
        </LanguageTabs>

        <h3>Event Payload</h3>
        <p>
          The purchase event delivers a{' '}
          <Link to="/docs/types#purchase">Purchase</Link> object containing
          transaction details.
        </p>

        <h3>Purchase Update Flow</h3>
        <ol>
          <li>
            Receive <Link to="/docs/types#purchase">Purchase</Link> object via
            listener
          </li>
          <li>Validate receipt with backend service</li>
          <li>Deliver purchased content to user</li>
          <li>
            Acknowledge purchase with platform (iOS: finishTransaction, Android:
            acknowledgePurchase)
          </li>
          <li>Update application state</li>
        </ol>
      </section>

      <section>
        <AnchorLink id="purchase-error-event" level="h2">
          Purchase Error Event
        </AnchorLink>
        <p>Fired when a purchase fails or is cancelled by the user.</p>

        <h3>Listener Setup</h3>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`purchaseErrorListener(
  listener: (error: PurchaseError) => void
): Subscription`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// AsyncSequence approach
var purchaseErrors: AsyncStream<PurchaseError>

// Combine approach
var purchaseErrorPublisher: AnyPublisher<PurchaseError, Never>`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Flow approach
val purchaseErrors: Flow<PurchaseError>`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`Stream<PurchaseError> get purchaseErrorStream;`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p>Registers a listener for purchase error events.</p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { purchaseErrorListener, ErrorCode } from 'expo-iap';

const subscription = purchaseErrorListener((error) => {
  console.log('Purchase error:', error.code, error.message);

  switch (error.code) {
    case ErrorCode.UserCancelled:
      // User cancelled - no action needed
      break;
    case ErrorCode.AlreadyOwned:
      // Restore purchases instead
      restorePurchases();
      break;
    case ErrorCode.NetworkError:
      // Show retry option
      showRetryDialog();
      break;
    default:
      showErrorMessage(error.message);
  }
});

// Cleanup when done
subscription.remove();`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

// Using async/await
Task {
    for await error in OpenIapModule.shared.purchaseErrors {
        print("Purchase error: \\(error.code) - \\(error.message)")

        switch error.code {
        case .userCancelled:
            // User cancelled - no action needed
            break
        case .alreadyOwned:
            // Restore purchases instead
            try await OpenIapModule.shared.restorePurchases()
        case .networkError:
            showRetryDialog()
        default:
            showErrorMessage(error.message)
        }
    }
}

// Or using Combine
OpenIapModule.shared.purchaseErrorPublisher
    .sink { error in
        print("Purchase error: \\(error.code)")
    }
    .store(in: &cancellables)`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.OpenIapError

// Using Flow
lifecycleScope.launch {
    openIapStore.purchaseErrors.collect { error ->
        println("Purchase error: \${error.code} - \${error.message}")

        when (error.code) {
            OpenIapError.UserCancelled -> {
                // User cancelled - no action needed
            }
            OpenIapError.AlreadyOwned -> {
                // Restore purchases instead
                openIapStore.restorePurchases()
            }
            OpenIapError.NetworkError -> {
                showRetryDialog()
            }
            else -> {
                showErrorMessage(error.message)
            }
        }
    }
}

// Or with callback
openIapStore.setPurchaseErrorListener { error ->
    println("Purchase error: \${error.code}")
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final subscription = FlutterInappPurchase.purchaseError.listen((error) {
  print('Purchase error: \${error?.code} - \${error?.message}');

  switch (error?.code) {
    case 'E_USER_CANCELLED':
      // User cancelled - no action needed
      break;
    case 'E_ALREADY_OWNED':
      // Restore purchases instead
      FlutterInappPurchase.instance.restorePurchases();
      break;
    case 'E_NETWORK_ERROR':
      showRetryDialog();
      break;
    default:
      showErrorMessage(error?.message ?? 'Unknown error');
  }
});

// Cleanup when done
subscription.cancel();`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <h3>Error Payload</h3>
        <p>
          The error event delivers a{' '}
          <Link to="/docs/errors">PurchaseError</Link> object with error
          details. See <Link to="/docs/errors">Error Codes</Link> for complete
          reference.
        </p>

        <h3>Error Handling Strategy</h3>
        <p>
          Handle errors based on their{' '}
          <Link to="/docs/errors">error codes</Link>:
        </p>
        <ul>
          <li>
            <code>UserCancelled</code> - No action required
          </li>
          <li>
            <code>ItemUnavailable</code> - Check product availability
          </li>
          <li>
            <code>NetworkError</code> - Retry with backoff
          </li>
          <li>
            <code>AlreadyOwned</code> - Restore purchases
          </li>
          <li>
            <code>ReceiptFailed</code> - Retry validation
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="promoted-product-event-ios" level="h2">
          Promoted Product Event (iOS)
        </AnchorLink>
        <p>
          Fired when a user clicks on a promoted in-app purchase in the App
          Store.
        </p>

        <h3>Listener Setup</h3>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`promotedProductListenerIOS(
  listener: (productId: string) => void
): Subscription`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// AsyncSequence approach
var promotedProducts: AsyncStream<String>

// Combine approach
var promotedProductPublisher: AnyPublisher<String, Never>`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// iOS only - not available on Android`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`Stream<String> get promotedProductStream; // iOS only`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p>Registers a listener for App Store promoted product events.</p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import {
  promotedProductListenerIOS,
  fetchProducts,
  requestPurchaseOnPromotedProductIOS
} from 'expo-iap';

const subscription = promotedProductListenerIOS(async (productId) => {
  console.log('Promoted product tapped:', productId);

  // Fetch product details
  const products = await fetchProducts({
    skus: [productId],
    type: 'in-app'
  });

  if (products.length > 0) {
    // Show product info to user and confirm purchase
    const confirmed = await showPurchaseConfirmation(products[0]);

    if (confirmed) {
      await requestPurchaseOnPromotedProductIOS();
    }
  }
});

// Cleanup when done
subscription.remove();`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

// Using async/await
Task {
    for await productId in OpenIapModule.shared.promotedProducts {
        print("Promoted product tapped: \\(productId)")

        // Fetch product details
        let products = try await OpenIapModule.shared.fetchProducts(
            ProductRequest(skus: [productId], type: .inApp)
        )

        if let product = products.first {
            // Show product info to user and confirm purchase
            if await showPurchaseConfirmation(product) {
                try await OpenIapModule.shared.requestPurchaseOnPromotedProductIOS()
            }
        }
    }
}

// Or using Combine
OpenIapModule.shared.promotedProductPublisher
    .sink { productId in
        print("Promoted product: \\(productId)")
    }
    .store(in: &cancellables)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// iOS only - will not fire on Android
final subscription = FlutterInappPurchase.promotedProductIOS.listen((productId) async {
  print('Promoted product tapped: $productId');

  // Fetch product details
  final products = await FlutterInappPurchase.instance.fetchProducts(
    ProductRequest(skus: [productId!], type: ProductType.inApp),
  );

  if (products.isNotEmpty) {
    // Show product info to user and confirm purchase
    final confirmed = await showPurchaseConfirmation(products.first);

    if (confirmed) {
      await FlutterInappPurchase.instance.requestPurchaseOnPromotedProductIOS();
    }
  }
});

// Cleanup when done
subscription.cancel();`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <h3>Handling Promoted Products</h3>
        <ol>
          <li>Receive product SKU via listener</li>
          <li>
            Fetch product details using{' '}
            <Link to="/docs/apis#fetch-products">fetchProducts</Link>
          </li>
          <li>Display product information to user</li>
          <li>
            Call{' '}
            <Link to="/docs/apis#request-purchase-on-promoted-product-ios">
              requestPurchaseOnPromotedProductIOS
            </Link>{' '}
            if user confirms
          </li>
        </ol>
        <p>
          Also check{' '}
          <Link to="/docs/apis#get-promoted-product-ios">
            getPromotedProductIOS
          </Link>{' '}
          on app launch for pending promoted products.
        </p>
      </section>

      <section>
        <AnchorLink id="user-choice-billing-event-android" level="h2">
          User Choice Billing Event (Android)
        </AnchorLink>
        <p>
          Fired when a user selects alternative billing in the User Choice
          Billing dialog on Android.
        </p>

        <h3>Listener Setup</h3>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`userChoiceBillingListenerAndroid(
  listener: (details: UserChoiceBillingDetails) => void
): Subscription`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Android only - not available on iOS`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Flow approach
val userChoiceBillingEvents: Flow<UserChoiceBillingDetails>`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`Stream<UserChoiceBillingDetails> get userChoiceBillingStream;
// Android only`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p>
          Registers a listener for User Choice Billing events. This listener is
          only triggered when the user selects alternative billing instead of
          Google Play billing.
        </p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { userChoiceBillingListenerAndroid } from 'expo-iap';

const subscription = userChoiceBillingListenerAndroid(async (details) => {
  console.log('User chose alternative billing');
  console.log('Products:', details.products);
  console.log('Token:', details.externalTransactionToken);

  // Process payment with your backend
  const paymentResult = await processPaymentWithBackend({
    products: details.products,
    token: details.externalTransactionToken,
  });

  if (paymentResult.success) {
    // Backend should report token to Google Play within 24 hours
    grantUserAccess(details.products);
  }
});

// Cleanup when done
subscription.remove();`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.UserChoiceBillingDetails

// Using Flow
lifecycleScope.launch {
    openIapStore.userChoiceBillingEvents.collect { details ->
        println("User chose alternative billing")
        println("Products: \${details.products}")
        println("Token: \${details.externalTransactionToken}")

        // Process payment with your backend
        val paymentResult = processPaymentWithBackend(
            products = details.products,
            token = details.externalTransactionToken
        )

        if (paymentResult.success) {
            // Backend should report token to Google Play within 24 hours
            grantUserAccess(details.products)
        }
    }
}

// Or with callback
openIapStore.setUserChoiceBillingListener { details ->
    println("User chose alternative billing for: \${details.products}")
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Android only - will not fire on iOS
final subscription = FlutterInappPurchase.userChoiceBillingAndroid.listen((details) async {
  print('User chose alternative billing');
  print('Products: \${details?.products}');
  print('Token: \${details?.externalTransactionToken}');

  // Process payment with your backend
  final paymentResult = await processPaymentWithBackend(
    products: details!.products,
    token: details.externalTransactionToken,
  );

  if (paymentResult.success) {
    // Backend should report token to Google Play within 24 hours
    grantUserAccess(details.products);
  }
});

// Cleanup when done
subscription.cancel();`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <h3>Event Payload</h3>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`interface UserChoiceBillingDetails {
  externalTransactionToken: string;
  products: string[];
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Android only - not available on iOS`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`data class UserChoiceBillingDetails(
    val externalTransactionToken: String,
    val products: List<String>
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`class UserChoiceBillingDetails {
  final String externalTransactionToken;
  final List<String> products;
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p>
          <strong>externalTransactionToken</strong> - Token that must be
          reported to Google Play within 24 hours
          <br />
          <strong>products</strong> - List of product IDs selected by the user
        </p>

        <h3>Handling User Choice Billing</h3>
        <ol>
          <li>
            Receive <code>UserChoiceBillingDetails</code> via listener
          </li>
          <li>Process payment with your backend payment system</li>
          <li>Send the external transaction token to your backend</li>
          <li>
            Backend reports token to Google Play within 24 hours (required for
            compliance)
          </li>
          <li>Grant user access to purchased content</li>
        </ol>

        <div
          style={{
            background: 'rgba(255, 200, 0, 0.1)',
            border: '1px solid rgba(255, 200, 0, 0.3)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginTop: '1rem',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            <strong>⚠️ Important:</strong> The external transaction token MUST
            be reported to Google Play within 24 hours. Failure to report tokens
            may result in account suspension. It is strongly recommended to
            handle token reporting on your backend server for reliability and
            security.
          </p>
        </div>

        <h3>Flow Comparison</h3>
        <p>
          When using User Choice Billing mode, there are two possible flows
          depending on user selection:
        </p>
        <ul>
          <li>
            <strong>Google Play selected</strong> - Standard{' '}
            <code>PurchaseUpdated</code> event fires (handle normally)
          </li>
          <li>
            <strong>Alternative billing selected</strong> -{' '}
            <code>UserChoiceBillingAndroid</code> event fires (handle with your
            payment system)
          </li>
        </ul>

        <p>
          See{' '}
          <Link to="/docs/features/external-purchase#platform-implementation">
            External Purchase documentation
          </Link>{' '}
          for complete implementation examples.
        </p>
      </section>

      <section>
        <h2>Event Listener Management</h2>

        <h3>Listener Lifecycle</h3>
        <ol>
          <li>Register listeners before initiating purchases</li>
          <li>Keep listeners active throughout purchase flow</li>
          <li>Remove listeners when no longer needed (cleanup)</li>
        </ol>
        <p>
          Each listener returns a Subscription object with a{' '}
          <code>remove()</code> method for cleanup.
        </p>

        <h3>Event Manager Pattern</h3>
        <p>Consider implementing a centralized event manager that:</p>
        <ul>
          <li>Initializes all IAP event listeners</li>
          <li>Routes events to appropriate handlers</li>
          <li>Integrates with analytics and logging</li>
          <li>Manages listener lifecycle</li>
          <li>Provides cleanup methods</li>
        </ul>
      </section>

      <section>
        <h2>Best Practices</h2>
        <ul>
          <li>
            <strong>Always set up listeners before making purchases</strong> -
            Events may be lost if listeners aren't registered
          </li>
          <li>
            <strong>Handle all error cases</strong> - Provide appropriate user
            feedback for each error type
          </li>
          <li>
            <strong>Clean up listeners</strong> - Remove listeners when
            components unmount to prevent memory leaks
          </li>
          <li>
            <strong>Process purchases idempotently</strong> - Same purchase may
            be delivered multiple times
          </li>
          <li>
            <strong>Validate receipts server-side</strong> - Never trust
            client-side validation alone
          </li>
          <li>
            <strong>Finish/acknowledge purchases promptly</strong> - Unfinished
            transactions may cause issues
          </li>
          <li>
            <strong>Log events for debugging</strong> - Track purchase flow for
            troubleshooting
          </li>
        </ul>
      </section>
    </div>
  );
}

export default Events;
