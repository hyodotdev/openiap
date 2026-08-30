import { Link } from 'react-router-dom';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function UserChoiceBillingListenerAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="userChoiceBillingListenerAndroid"
        description="Listener fired when a user selects alternative billing in the User Choice Billing dialog on Android."
        path="/docs/events/android/user-choice-billing-listener-android"
        keywords="userChoiceBillingListenerAndroid, user choice billing, alternative billing, Android"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        userChoiceBillingListenerAndroid
      </h1>
      <p>
        Fired when a user selects alternative billing in the User Choice Billing
        dialog on Android.
      </p>
      <p>
        <code>originalExternalTransactionId</code> and{' '}
        <code>productDetailsAndroid</code> are available in OpenIAP Spec 2.3.0 /{' '}
        <code>openiap-google</code> 2.3.1 (requires Play Billing 9.1+). Legacy
        payloads may omit structured product details; use <code>products</code>{' '}
        as the product-ID fallback.
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
            <CodeBlock language="kotlin">{`fun addUserChoiceBillingListener(
    listener: OpenIapUserChoiceBillingListener
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun userChoiceBillingAndroid(): UserChoiceBillingDetails`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Stream<UserChoiceBillingDetails> get userChoiceBillingAndroid;
// Android only`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

IObservable<UserChoiceBillingDetails> UserChoiceBillingAndroid { get; }`}</CodeBlock>
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
            <CodeBlock language="typescript">{`import {
  userChoiceBillingListenerAndroid,
  type UserChoiceBillingDetails,
} from 'expo-iap';

async function handleUserChoiceBilling(details: UserChoiceBillingDetails) {
  console.log('User chose alternative billing');
  console.log('Products:', details.products);
  console.log('External transaction token received; send it to your backend without logging it.');

  // Process payment with your backend
  const paymentResult = await processPaymentWithBackend({
    products: details.products,
    token: details.externalTransactionToken,
  });

  if (paymentResult.success) {
    // Backend should report token to Google Play within 24 hours
    grantUserAccess(details.products);
  }
}

const subscription = userChoiceBillingListenerAndroid((details) => {
  void handleUserChoiceBilling(details).catch((error) => {
    console.error('Alternative billing failed', error);
  });
});

// Cleanup when done
subscription.remove();`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener

val userChoiceListener = OpenIapUserChoiceBillingListener { details ->
    lifecycleScope.launch {
        println("User chose alternative billing")
        println("Products: \${details.products}")
        println("External transaction token received; send it to your backend without logging it.")

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

openIapStore.addUserChoiceBillingListener(userChoiceListener)

// Cleanup when done
openIapStore.removeUserChoiceBillingListener(userChoiceListener)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP

val kmpIAP = KmpIAP()

// Start this before requestPurchase; it suspends until the next selection.
lifecycleScope.launch {
    val details = kmpIAP.userChoiceBillingAndroid()
    println("User chose alternative billing")
    println("Products: \${details.products}")
    println("External transaction token received; send it to your backend without logging it.")

    val paymentResult = processPaymentWithBackend(
        products = details.products,
        token = details.externalTransactionToken
    )

    if (paymentResult.success) {
        // Backend should report token to Google Play within 24 hours
        grantUserAccess(details.products)
    }
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`import 'dart:async';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Android only - will not fire on iOS
Future<void> handleUserChoiceBilling(UserChoiceBillingDetails details) async {
  print('User chose alternative billing');
  print('Products: \${details.products}');
  print('External transaction token received; send it to your backend without logging it.');

  // Process payment with your backend
  final paymentResult = await processPaymentWithBackend(
    products: details.products,
    token: details.externalTransactionToken,
  );

  if (paymentResult.success) {
    // Backend should report token to Google Play within 24 hours
    grantUserAccess(details.products);
  }
}

final subscription = FlutterInappPurchase.instance.userChoiceBillingAndroid.listen((details) {
  unawaited(handleUserChoiceBilling(details).catchError(
    (Object error) => print('Alternative billing failed: $error'),
  ));
});

// Cleanup when done
subscription.cancel();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;
using System;

async Task ProcessUserChoiceBillingSafelyAsync(UserChoiceBillingDetails details)
{
    try
    {
        await ProcessUserChoiceBillingAsync(details);
    }
    catch (Exception error)
    {
        Console.WriteLine($"Alternative billing failed: {error.Message}");
    }
}

using var subscription = OpenIapClient.Instance.UserChoiceBillingAndroid.Subscribe(details =>
{
    Console.WriteLine("User chose alternative billing");
    Console.WriteLine($"Products: {string.Join(", ", details.Products)}");
    Console.WriteLine("External transaction token received; send it to your backend without logging it.");

    // Process payment with your backend.
    _ = ProcessUserChoiceBillingSafelyAsync(details);
});`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h3>Event Payload</h3>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`interface UserChoiceBillingDetails {
  externalTransactionToken: string;
  originalExternalTransactionId?: string | null;
  productDetailsAndroid?: DeveloperProvidedBillingProductAndroid[] | null;
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
) {
    var originalExternalTransactionId: String? = null
        private set
    var productDetailsAndroid: List<DeveloperProvidedBillingProductAndroid>? = null
        private set
}`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`data class UserChoiceBillingDetails(
    val externalTransactionToken: String,
    val products: List<String>
) {
    var originalExternalTransactionId: String? = null
        private set
    var productDetailsAndroid: List<DeveloperProvidedBillingProductAndroid>? = null
        private set
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`class UserChoiceBillingDetails {
  final String externalTransactionToken;
  final String? originalExternalTransactionId;
  final List<DeveloperProvidedBillingProductAndroid>? productDetailsAndroid;
  final List<String> products;
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;
using System.Collections.Generic;

public sealed record UserChoiceBillingDetails
{
    public required string ExternalTransactionToken { get; init; }
    public string? OriginalExternalTransactionId { get; init; }
    public IReadOnlyList<DeveloperProvidedBillingProductAndroid>? ProductDetailsAndroid { get; init; }
    public required IReadOnlyList<string> Products { get; init; }
}`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
      <p>
        <strong>externalTransactionToken</strong> - Token that must be reported
        to Google Play within 24 hours
        <br />
        <strong>originalExternalTransactionId</strong> - Originating external
        subscription transaction ID for developer-billed replacements (Play
        Billing 9.1+)
        <br />
        <strong>productDetailsAndroid</strong> - Selected product IDs, product
        types, and offer tokens as optional structured Play Billing 9.1+ data;
        use <code>products</code> when it is absent
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
          <strong>⚠️ Important:</strong> The external transaction token MUST be
          reported to Google Play within 24 hours. Failure to report tokens may
          result in account suspension. It is strongly recommended to handle
          token reporting on your backend server for reliability and security.
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
    </div>
  );
}

export default UserChoiceBillingListenerAndroid;
