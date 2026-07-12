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
            <CodeBlock language="dart">{`Stream<PurchaseError> get purchaseErrorListener;`}</CodeBlock>
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

let subscription = OpenIapModule.shared.purchaseErrorListener { error in
    Task {
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

// Cleanup when done
OpenIapModule.shared.removeListener(subscription)`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// OpenIapStore exposes the latest typed error through status.
lifecycleScope.launch {
    openIapStore.status.collect { status ->
        val error = status.lastError ?: return@collect
        println("Purchase error: \${error.code} - \${error.message}")

        when (error.code) {
            "user-cancelled" -> {
                // User cancelled - no action needed
            }
            "already-owned" -> {
                // Restore purchases instead
                openIapStore.restorePurchases()
            }
            "network-error" -> {
                showRetryDialog()
            }
            else -> {
                showErrorMessage(error.message)
            }
        }
    }
}`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP
import io.github.hyochan.kmpiap.openiap.ErrorCode

val kmpIAP = KmpIAP()

// Using Flow
lifecycleScope.launch {
    kmpIAP.purchaseErrorListener.collect { error ->
        println("Purchase error: \${error.code} - \${error.message}")

        when (error.code) {
            ErrorCode.UserCancelled -> {
                // User cancelled - no action needed
            }
            ErrorCode.AlreadyOwned -> {
                // Restore purchases instead
                kmpIAP.restorePurchases()
            }
            ErrorCode.NetworkError -> {
                showRetryDialog()
            }
            else -> {
                showErrorMessage(error.message)
            }
        }
    }
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final subscription = FlutterInappPurchase.instance.purchaseErrorListener.listen((error) {
  print('Purchase error: \${error.code} - \${error.message}');

  switch (error.code) {
    case ErrorCode.UserCancelled:
      // User cancelled - no action needed
      break;
    case ErrorCode.AlreadyOwned:
      // Restore purchases instead
      FlutterInappPurchase.instance.restorePurchases();
      break;
    case ErrorCode.NetworkError:
      showRetryDialog();
      break;
    default:
      showErrorMessage(error.message);
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
