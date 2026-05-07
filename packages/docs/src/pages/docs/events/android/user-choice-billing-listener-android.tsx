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
          kmp: (
            <CodeBlock language="kotlin">{`// Flow approach
val userChoiceBillingEvents: Flow<UserChoiceBillingDetails>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Stream<UserChoiceBillingDetails> get userChoiceBillingStream;
// Android only`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using Hyo.OpenIap;
using OpenIap.Maui;

// Flow approach
var userChoiceBillingEvents: Flow<UserChoiceBillingDetails>`}</CodeBlock>
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
          kmp: (
            <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP

val kmpIAP = KmpIAP()

// Using Flow
lifecycleScope.launch {
    kmpIAP.userChoiceBillingEvents.collect { details ->
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
kmpIAP.setUserChoiceBillingListener { details ->
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
          csharp: (
            <CodeBlock language="csharp">{`using Hyo.OpenIap;
using OpenIap.Maui;

// Using Flow
lifecycleScope.launch {
    openIapStore.userChoiceBillingEvents.collect { details ->
        println("User chose alternative billing")
        println("Products: \${details.products}")
        println("Token: \${details.externalTransactionToken}")

        // Process payment with your backend
        var paymentResult = processPaymentWithBackend(
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
          kmp: (
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
          csharp: (
            <CodeBlock language="csharp">{`using Hyo.OpenIap;
using OpenIap.Maui;

data class UserChoiceBillingDetails(
    var externalTransactionToken: String,
    var products: List<String>
)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
      <p>
        <strong>externalTransactionToken</strong> - Token that must be reported
        to Google Play within 24 hours
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
