import { Link } from 'react-router-dom';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function PurchaseErrorListener() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="purchaseErrorListener"
        description="Listener fired when a purchase fails or is cancelled by the user."
        path="/docs/events/purchase-error-listener"
        keywords="purchaseErrorListener, purchase error, error listener, purchase cancelled"
      />
      <h1>purchaseErrorListener</h1>
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
          kmp: (
            <CodeBlock language="kotlin">{`// Flow approach
val purchaseErrors: Flow<PurchaseError>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Stream<PurchaseError> get purchaseErrorStream;`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;
using System;

IObservable<PurchaseError> purchaseErrors = OpenIapClient.Instance.PurchaseError;`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
      <p>Registers a listener for purchase error events.</p>

      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import {
  purchaseErrorListener,
  ErrorCode,
  restorePurchases,
} from 'expo-iap';
// showRetryDialog / showErrorMessage are user-defined UI helpers.

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
          kmp: (
            <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP

val kmpIAP = KmpIAP()

// Using Flow
lifecycleScope.launch {
    kmpIAP.purchaseErrors.collect { error ->
        println("Purchase error: \${error.code} - \${error.message}")

        when (error.code) {
            OpenIapError.UserCancelled -> {
                // User cancelled - no action needed
            }
            OpenIapError.AlreadyOwned -> {
                // Restore purchases instead
                kmpIAP.restorePurchases()
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
kmpIAP.setPurchaseErrorListener { error ->
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
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var subscription = OpenIapClient.Instance.PurchaseError.Subscribe(async error =>
{
    Console.WriteLine($"Purchase error: {error.Code} - {error.Message}");

    switch (error.Code)
    {
        case ErrorCode.UserCancelled:
            // User cancelled - no action needed.
            break;
        case ErrorCode.AlreadyOwned:
            // Restore purchases instead.
            await ((MutationResolver)OpenIapClient.Instance).RestorePurchasesAsync();
            break;
        case ErrorCode.NetworkError:
            ShowRetryDialog();
            break;
        default:
            ShowErrorMessage(error.Message);
            break;
    }
});

// Cleanup when done.
subscription.Dispose();`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h3>Error Payload</h3>
      <p>
        The error event delivers a <Link to="/docs/errors">PurchaseError</Link>{' '}
        object with error details. See{' '}
        <Link to="/docs/errors">Error Codes</Link> for complete reference.
      </p>

      <h3>Error Handling Strategy</h3>
      <p>
        Handle errors based on their <Link to="/docs/errors">error codes</Link>:
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
    </div>
  );
}

export default PurchaseErrorListener;
