import { Link } from 'react-router-dom';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function DeveloperProvidedBillingListenerAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="developerProvidedBillingListenerAndroid"
        description="Listener fired when a user selects developer-provided billing in the External Payments flow on Android (8.3.0+)."
        path="/docs/events/android/developer-provided-billing-listener-android"
        keywords="developerProvidedBillingListenerAndroid, developer billing, external payments, Android, Japan"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        developerProvidedBillingListenerAndroid
      </h1>
      <p>
        Fired when a user selects developer-provided billing in the External
        Payments flow on Android. This is different from User Choice Billing -
        it presents a side-by-side choice dialog in the purchase flow itself.
      </p>
      <p>
        <strong>Note:</strong> Currently only available in Japan.
      </p>

      <h3>Listener Setup</h3>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`developerProvidedBillingListenerAndroid(
  listener: (details: DeveloperProvidedBillingDetailsAndroid) => void
): Subscription`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`// Android only - not available on iOS`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// Callback approach
fun addDeveloperProvidedBillingListener(
    listener: OpenIapDeveloperProvidedBillingListener
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`// Callback approach
fun addDeveloperProvidedBillingListener(
    listener: OpenIapDeveloperProvidedBillingListener
)`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Stream<DeveloperProvidedBillingDetailsAndroid> get developerProvidedBillingStream;
// Android only (8.3.0+)`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// Observable callback approach.
IDisposable subscription = OpenIapClient.Instance.DeveloperProvidedBillingAndroid.Subscribe(details =>
{
    Console.WriteLine(details.ExternalTransactionToken);
});`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
      <p>
        Registers a listener for Developer Provided Billing events. This
        listener is only triggered when the user selects the developer's payment
        option (instead of Google Play) in the External Payments flow.
      </p>

      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import { developerProvidedBillingListenerAndroid } from 'expo-iap';

const subscription = developerProvidedBillingListenerAndroid(async (details) => {
  console.log('User selected developer billing');
  console.log('External transaction token received; send it to your backend without logging it.');

  // Process payment with your payment system
  const paymentResult = await processPaymentWithYourGateway({
    token: details.externalTransactionToken,
    // Your payment details
  });

  if (paymentResult.success) {
    // IMPORTANT: Report the token to Google Play within 24 hours
    await reportExternalTransactionToGoogle(details.externalTransactionToken);
    grantUserAccess();
  }
});

// Cleanup when done
subscription.remove();`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`import dev.hyo.openiap.DeveloperProvidedBillingDetailsAndroid

// Using callback
openIapStore.addDeveloperProvidedBillingListener { details ->
    println("User selected developer billing")
    println("External transaction token received; send it to your backend without logging it.")

    lifecycleScope.launch {
        // Process payment with your payment system
        val paymentResult = processPaymentWithYourGateway(
            token = details.externalTransactionToken
        )

        if (paymentResult.success) {
            // IMPORTANT: Report the token to Google Play within 24 hours
            reportExternalTransactionToGoogle(details.externalTransactionToken)
            grantUserAccess()
        }
    }
}`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP

val kmpIAP = KmpIAP()

// Using callback
kmpIAP.addDeveloperProvidedBillingListener { details ->
    println("User selected developer billing")
    println("External transaction token received; send it to your backend without logging it.")

    lifecycleScope.launch {
        // Process payment with your payment system
        val paymentResult = processPaymentWithYourGateway(
            token = details.externalTransactionToken
        )

        if (paymentResult.success) {
            // IMPORTANT: Report the token to Google Play within 24 hours
            reportExternalTransactionToGoogle(details.externalTransactionToken)
            grantUserAccess()
        }
    }
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Android only (8.3.0+) - will not fire on iOS or older Android
final subscription = FlutterInappPurchase.developerProvidedBillingStream
    .listen((details) async {
  print('User selected developer billing');
  print('External transaction token received; send it to your backend without logging it.');

  // Process payment with your payment system
  final paymentResult = await processPaymentWithYourGateway(
    token: details.externalTransactionToken,
  );

  if (paymentResult.success) {
    // IMPORTANT: Report the token to Google Play within 24 hours
    await reportExternalTransactionToGoogle(details.externalTransactionToken);
    grantUserAccess();
  }
});

// Cleanup when done
subscription.cancel();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var subscription = OpenIapClient.Instance.DeveloperProvidedBillingAndroid.Subscribe(async details =>
{
    Console.WriteLine("User selected developer billing");
    Console.WriteLine($"Token: {details.ExternalTransactionToken}");

    var paymentResult = await ProcessPaymentWithYourGatewayAsync(
        details.ExternalTransactionToken);

    if (paymentResult.Success)
    {
        // IMPORTANT: Report the token to Google Play within 24 hours.
        await ReportExternalTransactionToGoogleAsync(details.ExternalTransactionToken);
        await GrantUserAccessAsync();
    }
});

// Cleanup when done.
subscription.Dispose();`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h3>Event Payload</h3>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`interface DeveloperProvidedBillingDetailsAndroid {
  externalTransactionToken: string;
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`// Android only - not available on iOS`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`data class DeveloperProvidedBillingDetailsAndroid(
    val externalTransactionToken: String
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`data class DeveloperProvidedBillingDetailsAndroid(
    val externalTransactionToken: String
)`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`class DeveloperProvidedBillingDetailsAndroid {
  final String externalTransactionToken;
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

public sealed record DeveloperProvidedBillingDetailsAndroid
{
    public required string ExternalTransactionToken { get; init; }
}`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
      <p>
        <strong>externalTransactionToken</strong> - Token that must be reported
        to Google Play within 24 hours after completing the payment
      </p>

      <h3>Comparison: User Choice vs Developer Provided Billing</h3>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Feature</th>
            <th>User Choice Billing</th>
            <th>Developer Provided Billing</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Billing Library</td>
            <td>7.0+</td>
            <td>8.3.0+</td>
          </tr>
          <tr>
            <td>Availability</td>
            <td>Eligible regions</td>
            <td>Japan only</td>
          </tr>
          <tr>
            <td>When presented</td>
            <td>After initConnection()</td>
            <td>During requestPurchase()</td>
          </tr>
          <tr>
            <td>UI</td>
            <td>Separate dialog before purchase</td>
            <td>Side-by-side choice in purchase dialog</td>
          </tr>
          <tr>
            <td>Event</td>
            <td>
              <code>UserChoiceBillingAndroid</code>
            </td>
            <td>
              <code>DeveloperProvidedBillingAndroid</code>
            </td>
          </tr>
          <tr>
            <td>Setup</td>
            <td>
              <code>AlternativeBillingModeAndroid.UserChoice</code>
            </td>
            <td>
              <code>enableBillingProgram(EXTERNAL_PAYMENTS)</code> +{' '}
              <code>developerBillingOption</code> in requestPurchase
            </td>
          </tr>
        </tbody>
      </table>

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
          reported to Google Play within 24 hours using the{' '}
          <code>externaltransactions.createexternaltransaction</code> API.
          Failure to report tokens may result in account suspension.
        </p>
      </div>

      <p>
        See{' '}
        <Link to="/docs/features/external-purchase#external-payments-830---japan-only">
          External Payments documentation
        </Link>{' '}
        for complete implementation examples.
      </p>
    </div>
  );
}

export default DeveloperProvidedBillingListenerAndroid;
