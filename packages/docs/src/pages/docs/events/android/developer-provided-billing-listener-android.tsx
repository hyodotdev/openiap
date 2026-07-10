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
        description="Listener fired when a user selects developer-provided billing in an External Payments or Billing Choice flow on Android."
        path="/docs/events/android/developer-provided-billing-listener-android"
        keywords="developerProvidedBillingListenerAndroid, developer billing, billing choice, external payments, Android"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        developerProvidedBillingListenerAndroid
      </h1>
      <p>
        Fired when a user selects developer-provided billing in an External
        Payments or Billing Choice purchase flow. Billing Choice payload fields
        are available in OpenIAP Spec 2.1.0 and <code>openiap-google</code>{' '}
        2.3.0, and require Play Billing 9.1.0+. Unlike User Choice Billing, this
        event is tied to the developer billing option configured for the
        purchase itself.
      </p>
      <p>
        <strong>Eligibility:</strong> Availability depends on the enabled Google
        Play billing program and market. External Payments launched in Japan;
        Billing Choice has its own program eligibility.
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
    Console.WriteLine($"Developer billing selected for {details.Products.Count} product(s).");
});`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
      <p>
        Registers a listener for Developer Provided Billing events. This
        listener is triggered when the user selects the developer's payment
        option instead of Google Play in an enabled developer billing program.
      </p>
      <p>
        React Native and Expo hook users can pass the same callback through{' '}
        <code>onDeveloperProvidedBillingAndroid</code>. The hook also accepts{' '}
        <code>billingChoiceScreenTypeAndroid</code> and returns the Billing
        Choice Android APIs.
      </p>
      <CodeBlock language="typescript">{`const {
  getBillingChoiceInfoAndroid,
  showInAppMessagesAndroid,
} = useIAP({
  enableBillingProgramAndroid: 'billing-choice',
  billingChoiceScreenTypeAndroid: 'google-rendered',
  onDeveloperProvidedBillingAndroid: async (details) => {
    await processDeveloperBilling(details);
  },
});`}</CodeBlock>

      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import { developerProvidedBillingListenerAndroid } from 'expo-iap';

const subscription = developerProvidedBillingListenerAndroid(async (details) => {
  // Use products and linkUri to choose your in-app or external-link checkout.
  const paymentResult = await processPaymentWithYourGateway({
    products: details.products,
    linkUri: details.linkUri,
  });

  if (paymentResult.success) {
    if (details.externalTransactionToken) {
      await reportExternalTransactionToGoogle(
        details.externalTransactionToken,
      );
    }
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
    lifecycleScope.launch {
        val paymentResult = processPaymentWithYourGateway(
            products = details.products,
            linkUri = details.linkUri
        )

        if (paymentResult.success) {
            details.externalTransactionToken?.let { token ->
                reportExternalTransactionToGoogle(token)
            }
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
    lifecycleScope.launch {
        val paymentResult = processPaymentWithYourGateway(
            products = details.products,
            linkUri = details.linkUri
        )

        if (paymentResult.success) {
            details.externalTransactionToken?.let { token ->
                reportExternalTransactionToGoogle(token)
            }
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
  final paymentResult = await processPaymentWithYourGateway(
    products: details.products,
    linkUri: details.linkUri,
  );

  if (paymentResult.success) {
    final token = details.externalTransactionToken;
    if (token != null) {
      await reportExternalTransactionToGoogle(token);
    }
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
    var paymentResult = await ProcessPaymentWithYourGatewayAsync(
        details.Products,
        details.LinkUri);

    if (paymentResult.Success)
    {
        if (details.ExternalTransactionToken is { Length: > 0 } token)
        {
            await ReportExternalTransactionToGoogleAsync(token);
        }
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
  externalTransactionToken?: string | null;
  linkUri?: string | null;
  originalExternalTransactionId?: string | null;
  products: DeveloperProvidedBillingProductAndroid[];
}

interface DeveloperProvidedBillingProductAndroid {
  id: string;
  type: 'in-app' | 'subs';
  offerToken?: string | null;
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`// Android only - not available on iOS`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`data class DeveloperProvidedBillingDetailsAndroid(
    val externalTransactionToken: String?,
    val linkUri: String?,
    val originalExternalTransactionId: String?,
    val products: List<DeveloperProvidedBillingProductAndroid>
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`data class DeveloperProvidedBillingDetailsAndroid(
    val externalTransactionToken: String?,
    val linkUri: String?,
    val originalExternalTransactionId: String?,
    val products: List<DeveloperProvidedBillingProductAndroid>
)`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`class DeveloperProvidedBillingDetailsAndroid {
  final String? externalTransactionToken;
  final String? linkUri;
  final String? originalExternalTransactionId;
  final List<DeveloperProvidedBillingProductAndroid> products;
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

public sealed record DeveloperProvidedBillingDetailsAndroid
{
    public string? ExternalTransactionToken { get; init; }
    public string? LinkUri { get; init; }
    public string? OriginalExternalTransactionId { get; init; }
    public required IReadOnlyList<DeveloperProvidedBillingProductAndroid> Products { get; init; }
}`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
      <p>
        <code>externalTransactionToken</code>, <code>linkUri</code>, and{' '}
        <code>originalExternalTransactionId</code> are nullable. The callback
        always includes <code>products</code>; each item has an <code>id</code>,{' '}
        <code>type</code>, and optional subscription <code>offerToken</code>.
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
            <td>
              Program and market eligibility; External Payments launched in
              Japan, while Billing Choice uses separate eligibility.
            </td>
          </tr>
          <tr>
            <td>When presented</td>
            <td>After initConnection()</td>
            <td>During requestPurchase()</td>
          </tr>
          <tr>
            <td>UI</td>
            <td>Separate dialog before purchase</td>
            <td>Program-specific in-app or external-link choice flow</td>
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
              <code>enableBillingProgram(EXTERNAL_PAYMENTS)</code> or{' '}
              <code>enableBillingProgram(BILLING_CHOICE)</code> +{' '}
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
          <strong>Important:</strong> When Google Play returns an external
          transaction token, send it to your backend and report the completed
          external transaction within the applicable program deadline. Do not
          log or expose the token.
        </p>
      </div>

      <p>
        See{' '}
        <Link to="/docs/types/billing-programs#developer-billing-option-params">
          Billing Programs types
        </Link>{' '}
        and the{' '}
        <Link to="/docs/features/external-purchase">
          external purchase guide
        </Link>{' '}
        for setup and purchase examples.
      </p>
    </div>
  );
}

export default DeveloperProvidedBillingListenerAndroid;
