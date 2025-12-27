import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function TypesAlternative() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Alternative Billing Types"
        description="OpenIAP Alternative Billing type definitions - AlternativeBillingModeAndroid, External Purchase Link types for TypeScript, Swift, Kotlin, Dart."
        path="/docs/types/alternative"
        keywords="IAP types, Alternative Billing, External Purchase, TypeScript, Swift, Kotlin"
      />
      <h1>Alternative Billing Types</h1>
      <p>
        Type definitions for alternative billing systems and external purchase
        links.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <code>AlternativeBillingModeAndroid</code> - NONE, USER_CHOICE,
            ALTERNATIVE_ONLY
          </li>
          <li>
            <code>BillingProgramAndroid</code> - EXTERNAL_CONTENT_LINK,
            EXTERNAL_OFFER, EXTERNAL_PAYMENTS (8.2.0+, 8.3.0+)
          </li>
          <li>
            <code>DeveloperBillingOptionParamsAndroid</code> - Configure
            external payments in purchase flow (8.3.0+)
          </li>
          <li>
            <code>InitConnectionConfig</code> - Configuration for
            initConnection()
          </li>
          <li>
            External Purchase Link APIs for iOS 15.4+ and 18.2+
          </li>
          <li>
            For Android alternative billing, use the{' '}
            <Link to="/docs/apis/android#alternative-billing-android">
              Android APIs
            </Link>
          </li>
        </ul>
      </TLDRBox>

      <section>
        <AnchorLink id="alternative-billing-types" level="h2">
          Alternative Billing Types
        </AnchorLink>
        <p>
          Types for configuring alternative billing systems, primarily used for
          Android.
        </p>

        <AnchorLink id="alternative-billing-mode-android" level="h3">
          AlternativeBillingModeAndroid
        </AnchorLink>
        <p>
          Enum controlling which billing system is used during{' '}
          <code>initConnection()</code>:
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>NONE</code>
              </td>
              <td>Standard Google Play billing (default)</td>
            </tr>
            <tr>
              <td>
                <code>USER_CHOICE</code>
              </td>
              <td>
                User can select between Google Play or alternative billing
                (requires Billing Library 7.0+)
              </td>
            </tr>
            <tr>
              <td>
                <code>ALTERNATIVE_ONLY</code>
              </td>
              <td>
                Alternative billing only, no Google Play option (requires
                Billing Library 6.2+)
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="init-connection-config" level="h3">
          InitConnectionConfig
        </AnchorLink>
        <p>
          Configuration options for <code>initConnection()</code>:
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>alternativeBillingModeAndroid</code>
              </td>
              <td>
                (Android only) Which billing mode to use. Defaults to{' '}
                <code>NONE</code>.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="init-connection-example" level="h4">
          Basic Usage
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Initialize with user choice billing
await initConnection({
  alternativeBillingModeAndroid: 'user-choice'
});

// Initialize with alternative billing only
await initConnection({
  alternativeBillingModeAndroid: 'alternative-only'
});

// Standard billing (default)
await initConnection();`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// iOS uses standard StoreKit billing
// Alternative billing is Android-only
try await OpenIapModule.shared.initConnection()

// Check connection status
let isConnected = try await OpenIapModule.shared.initConnection()`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Initialize with user choice billing
openIapStore.initConnection(
    InitConnectionConfig(
        alternativeBillingModeAndroid = AlternativeBillingModeAndroid.UserChoice
    )
)

// Initialize with alternative billing only
openIapStore.initConnection(
    InitConnectionConfig(
        alternativeBillingModeAndroid = AlternativeBillingModeAndroid.AlternativeOnly
    )
)

// Standard billing (default)
openIapStore.initConnection()`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Initialize with user choice billing
await FlutterInappPurchase.instance.initConnection(
  alternativeBillingModeAndroid: AlternativeBillingModeAndroid.UserChoice,
);

// Initialize with alternative billing only
await FlutterInappPurchase.instance.initConnection(
  alternativeBillingModeAndroid: AlternativeBillingModeAndroid.AlternativeOnly,
);

// Standard billing (default)
await FlutterInappPurchase.instance.initConnection();`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="user-choice-billing-example" level="h4">
          User Choice Billing Complete Example
        </AnchorLink>
        <p>
          With User Choice Billing (7.0+), users see a dialog to choose between
          Google Play or your alternative payment. Handle both paths:
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import {
  initConnection,
  userChoiceBillingListenerAndroid,
  fetchProducts,
  requestPurchase,
  createAlternativeBillingToken,
} from 'expo-iap';

// Step 1: Set up listener for when user selects alternative billing
const userChoiceSubscription = userChoiceBillingListenerAndroid(async (details) => {
  console.log('User chose alternative billing');
  console.log('Products:', details.products.map(p => p.productId));
  console.log('External Transaction Token:', details.externalTransactionToken);

  // Process payment with your backend using the token
  const paymentResult = await yourBackend.processPayment({
    products: details.products,
    token: details.externalTransactionToken,
  });

  if (paymentResult.success) {
    grantUserAccess();
  }
});

// Step 2: Initialize with user choice billing
await initConnection({
  alternativeBillingModeAndroid: 'user-choice',
});

// Step 3: Fetch products and purchase as normal
const products = await fetchProducts({
  request: { skus: ['premium_subscription'] },
  type: 'subs',
});

// Step 4: Request purchase - dialog will show both options
await requestPurchase({
  request: {
    google: { skus: ['premium_subscription'] },
  },
  type: 'subs',
});

// If user selects Google Play → purchaseUpdatedListener fires
// If user selects alternative → userChoiceBillingListenerAndroid fires

// Cleanup
userChoiceSubscription.remove();`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.InitConnectionConfig
import dev.hyo.openiap.AlternativeBillingModeAndroid
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener

val iapStore = OpenIapStore(context)

// Step 1: Set up listener for when user selects alternative billing
iapStore.addUserChoiceBillingListener(object : OpenIapUserChoiceBillingListener {
    override fun onUserChoiceBilling(details: UserChoiceBillingDetails) {
        Log.d("IAP", "User chose alternative billing")
        Log.d("IAP", "Products: \${details.products.map { it.productId }}")
        Log.d("IAP", "Token: \${details.externalTransactionToken}")

        // Process payment with your backend using the token
        lifecycleScope.launch {
            val paymentResult = yourBackend.processPayment(
                products = details.products,
                token = details.externalTransactionToken
            )

            if (paymentResult.success) {
                grantUserAccess()
            }
        }
    }
})

// Step 2: Initialize with user choice billing
iapStore.initConnection(
    InitConnectionConfig(
        alternativeBillingModeAndroid = AlternativeBillingModeAndroid.UserChoice
    )
)

// Step 3: Fetch products and purchase as normal
val products = iapStore.fetchProducts(
    skus = listOf("premium_subscription"),
    type = ProductQueryType.Subs
)

// Step 4: Request purchase - dialog will show both options
iapStore.setActivity(activity)
iapStore.requestPurchase(
    RequestPurchaseProps(
        request = RequestPurchaseProps.Request.Subscription(
            RequestSubscriptionPropsByPlatforms(
                google = RequestSubscriptionAndroidProps(
                    skus = listOf("premium_subscription")
                )
            )
        ),
        type = ProductQueryType.Subs
    )
)

// If user selects Google Play → onPurchaseSuccess fires
// If user selects alternative → OpenIapUserChoiceBillingListener fires`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Step 1: Set up listener for when user selects alternative billing
final userChoiceSubscription = FlutterInappPurchase.userChoiceBillingStream
    .listen((details) async {
  print('User chose alternative billing');
  print('Products: \${details.products.map((p) => p.productId).toList()}');
  print('Token: \${details.externalTransactionToken}');

  // Process payment with your backend using the token
  final paymentResult = await yourBackend.processPayment(
    products: details.products,
    token: details.externalTransactionToken,
  );

  if (paymentResult.success) {
    grantUserAccess();
  }
});

// Step 2: Initialize with user choice billing
await FlutterInappPurchase.instance.initConnection(
  alternativeBillingModeAndroid: AlternativeBillingModeAndroid.UserChoice,
);

// Step 3: Fetch products and purchase as normal
final products = await FlutterInappPurchase.instance.getSubscriptions(
  ['premium_subscription'],
);

// Step 4: Request purchase - dialog will show both options
await FlutterInappPurchase.instance.requestSubscription(
  sku: 'premium_subscription',
);

// If user selects Google Play → purchaseUpdatedStream fires
// If user selects alternative → userChoiceBillingStream fires

// Cleanup
userChoiceSubscription.cancel();`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="alternative-only-example" level="h4">
          Alternative Billing Only Complete Example
        </AnchorLink>
        <p>
          With Alternative Only mode (6.2+), all purchases go through your
          alternative payment system. Google Play is not shown:
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import {
  initConnection,
  fetchProducts,
  checkAlternativeBillingAvailability,
  showAlternativeBillingDialog,
  createAlternativeBillingToken,
} from 'expo-iap';

// Step 1: Initialize with alternative billing only
await initConnection({
  alternativeBillingModeAndroid: 'alternative-only',
});

// Step 2: Check if alternative billing is available
const availability = await checkAlternativeBillingAvailability();
if (!availability.isAvailable) {
  console.log('Alternative billing not available in this region');
  // Fall back to standard Google Play billing
  return;
}

// Step 3: Fetch products (still needed to show prices)
const products = await fetchProducts({
  request: { skus: ['premium_subscription'] },
  type: 'subs',
});

// Step 4: Show required Google Play disclosure dialog
const dialogResult = await showAlternativeBillingDialog();
if (dialogResult.responseCode !== 0) {
  console.log('User did not accept alternative billing');
  return;
}

// Step 5: Create token for this transaction
const token = await createAlternativeBillingToken(products[0].id);

// Step 6: Process purchase with your backend
const paymentResult = await yourBackend.processAlternativePurchase({
  productId: products[0].id,
  price: products[0].price,
  token: token,
  userId: currentUserId,
});

if (paymentResult.success) {
  // Report transaction to Google (required)
  await yourBackend.reportExternalTransaction(token, paymentResult.orderId);
  grantUserAccess();
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.InitConnectionConfig
import dev.hyo.openiap.AlternativeBillingModeAndroid

val iapStore = OpenIapStore(context)

// Step 1: Initialize with alternative billing only
iapStore.initConnection(
    InitConnectionConfig(
        alternativeBillingModeAndroid = AlternativeBillingModeAndroid.AlternativeOnly
    )
)

// Step 2: Check if alternative billing is available
val availability = iapStore.checkAlternativeBillingAvailability()
if (!availability.isAvailable) {
    Log.w("IAP", "Alternative billing not available in this region")
    // Fall back to standard Google Play billing
    return
}

// Step 3: Fetch products (still needed to show prices)
val products = iapStore.fetchProducts(
    skus = listOf("premium_subscription"),
    type = ProductQueryType.Subs
)

// Step 4: Show required Google Play disclosure dialog
iapStore.setActivity(activity)
val dialogResult = iapStore.showAlternativeBillingDialog()
if (dialogResult.responseCode != 0) {
    Log.d("IAP", "User did not accept alternative billing")
    return
}

// Step 5: Create token for this transaction
val token = iapStore.createAlternativeBillingToken(products.first().id)

// Step 6: Process purchase with your backend
lifecycleScope.launch {
    val paymentResult = yourBackend.processAlternativePurchase(
        productId = products.first().id,
        price = products.first().price,
        token = token,
        userId = currentUserId
    )

    if (paymentResult.success) {
        // Report transaction to Google (required)
        yourBackend.reportExternalTransaction(token, paymentResult.orderId)
        grantUserAccess()
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final iap = FlutterInappPurchase.instance;

// Step 1: Initialize with alternative billing only
await iap.initConnection(
  alternativeBillingModeAndroid: AlternativeBillingModeAndroid.AlternativeOnly,
);

// Step 2: Check if alternative billing is available
final availability = await iap.checkAlternativeBillingAvailability();
if (!availability.isAvailable) {
  print('Alternative billing not available in this region');
  // Fall back to standard Google Play billing
  return;
}

// Step 3: Fetch products (still needed to show prices)
final products = await iap.getSubscriptions(['premium_subscription']);

// Step 4: Show required Google Play disclosure dialog
final dialogResult = await iap.showAlternativeBillingDialog();
if (dialogResult.responseCode != 0) {
  print('User did not accept alternative billing');
  return;
}

// Step 5: Create token for this transaction
final token = await iap.createAlternativeBillingToken(products.first.productId);

// Step 6: Process purchase with your backend
final paymentResult = await yourBackend.processAlternativePurchase(
  productId: products.first.productId,
  price: products.first.price,
  token: token,
  userId: currentUserId,
);

if (paymentResult.success) {
  // Report transaction to Google (required)
  await yourBackend.reportExternalTransaction(token, paymentResult.orderId);
  grantUserAccess();
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <div className="warning-box">
          <strong>Reporting Requirement:</strong>
          <p>
            For both User Choice and Alternative Only modes, you must report
            completed transactions to Google Play within 24 hours using the
            Google Play Developer API. Failure to report may result in account
            suspension.
          </p>
        </div>
      </section>

      <section>
        <AnchorLink id="billing-programs" level="h2">
          Billing Programs (Android 8.2.0+)
        </AnchorLink>
        <p>
          Google Play Billing Library 8.2.0+ introduces the Billing Programs API,
          which provides a more structured approach to external offers and
          content links. Version 8.3.0 adds External Payments for Japan.
        </p>

        <AnchorLink id="billing-program-android" level="h3">
          BillingProgramAndroid
        </AnchorLink>
        <p>
          Enum for different billing program types:
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Summary</th>
              <th>Version</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>EXTERNAL_CONTENT_LINK</code>
              </td>
              <td>
                For apps that link to external content (reader apps, music streaming)
              </td>
              <td>8.2.0+</td>
            </tr>
            <tr>
              <td>
                <code>EXTERNAL_OFFER</code>
              </td>
              <td>
                For apps offering alternative payment options
              </td>
              <td>8.2.0+</td>
            </tr>
            <tr>
              <td>
                <code>EXTERNAL_PAYMENTS</code>
              </td>
              <td>
                Side-by-side choice between Google Play and developer billing (Japan only)
              </td>
              <td>8.3.0+</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="developer-billing-option-params" level="h3">
          DeveloperBillingOptionParamsAndroid
        </AnchorLink>
        <p>
          Parameters for configuring developer billing option in purchase flow (8.3.0+):
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>billingProgram</code>
              </td>
              <td>
                <code>BillingProgramAndroid</code>
              </td>
              <td>
                The billing program (usually <code>EXTERNAL_PAYMENTS</code>)
              </td>
            </tr>
            <tr>
              <td>
                <code>linkUri</code>
              </td>
              <td>
                <code>String</code>
              </td>
              <td>
                URL where the external payment will be processed
              </td>
            </tr>
            <tr>
              <td>
                <code>launchMode</code>
              </td>
              <td>
                <code>DeveloperBillingLaunchModeAndroid</code>
              </td>
              <td>
                How to launch the external payment link
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="developer-billing-launch-mode" level="h3">
          DeveloperBillingLaunchModeAndroid
        </AnchorLink>
        <p>
          How the external payment URL is launched:
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>LAUNCH_IN_EXTERNAL_BROWSER_OR_APP</code>
              </td>
              <td>
                Google Play launches the link in a browser or eligible app
              </td>
            </tr>
            <tr>
              <td>
                <code>CALLER_WILL_LAUNCH_LINK</code>
              </td>
              <td>
                Your app handles launching the link after Play returns control
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="developer-provided-billing-details" level="h3">
          DeveloperProvidedBillingDetailsAndroid
        </AnchorLink>
        <p>
          Details received when user selects developer billing (8.3.0+):
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>externalTransactionToken</code>
              </td>
              <td>
                <code>String</code>
              </td>
              <td>
                Token to report external transaction to Google (must report within 24 hours)
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="billing-programs-example" level="h3">
          Usage Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import {
  enableBillingProgramAndroid,
  isBillingProgramAvailableAndroid,
  requestPurchase,
  developerProvidedBillingListener,
} from 'expo-iap';

// Enable External Payments before initConnection
enableBillingProgramAndroid('EXTERNAL_PAYMENTS');

await initConnection();

// Listen for developer billing selection
developerProvidedBillingListener((details) => {
  console.log('Token:', details.externalTransactionToken);
  // Report token to Google via your backend within 24 hours
});

// Check availability (Japan only)
const result = await isBillingProgramAvailableAndroid('EXTERNAL_PAYMENTS');
if (result.isAvailable) {
  // Purchase with developer billing option
  await requestPurchase({
    google: {
      skus: ['product_id'],
      developerBillingOption: {
        billingProgram: 'EXTERNAL_PAYMENTS',
        linkUri: 'https://your-site.com/checkout',
        launchMode: 'LAUNCH_IN_EXTERNAL_BROWSER_OR_APP',
      },
    },
  });
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.*

val iapStore = OpenIapStore(context)

// Enable External Payments before initConnection
iapStore.enableBillingProgram(BillingProgramAndroid.ExternalPayments)

iapStore.initConnection(null)

// Listen for developer billing selection
iapStore.addDeveloperProvidedBillingListener { details ->
    Log.d("IAP", "Token: \${details.externalTransactionToken}")
    // Report token to Google via your backend within 24 hours
}

// Check availability (Japan only)
val result = iapStore.isBillingProgramAvailable(
    BillingProgramAndroid.ExternalPayments
)
if (result.isAvailable) {
    // Purchase with developer billing option
    val props = RequestPurchaseProps(
        request = RequestPurchaseProps.Request.Purchase(
            RequestPurchasePropsByPlatforms(
                google = RequestPurchaseAndroidProps(
                    skus = listOf("product_id"),
                    developerBillingOption = DeveloperBillingOptionParamsAndroid(
                        billingProgram = BillingProgramAndroid.ExternalPayments,
                        linkUri = "https://your-site.com/checkout",
                        launchMode = DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp
                    )
                )
            )
        ),
        type = ProductQueryType.InApp
    )
    iapStore.requestPurchase(props)
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Enable External Payments before initConnection
FlutterInappPurchase.instance.enableBillingProgramAndroid(
  BillingProgramAndroid.externalPayments,
);

await FlutterInappPurchase.instance.initConnection();

// Listen for developer billing selection
FlutterInappPurchase.developerProvidedBillingStream.listen((details) {
  print('Token: \${details.externalTransactionToken}');
  // Report token to Google via your backend within 24 hours
});

// Check availability (Japan only)
final result = await FlutterInappPurchase.instance
    .isBillingProgramAvailableAndroid(BillingProgramAndroid.externalPayments);
if (result.isAvailable) {
  // Purchase with developer billing option
  await FlutterInappPurchase.instance.requestPurchase(
    'product_id',
    developerBillingOption: DeveloperBillingOptionParamsAndroid(
      billingProgram: BillingProgramAndroid.externalPayments,
      linkUri: 'https://your-site.com/checkout',
      launchMode: DeveloperBillingLaunchModeAndroid.launchInExternalBrowserOrApp,
    ),
  );
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <blockquote className="info-note">
          <p>
            <strong>Token Reporting:</strong> When a user completes a purchase
            through developer billing, you must report the{' '}
            <code>externalTransactionToken</code> to Google Play within 24 hours.
            See{' '}
            <Link to="/docs/features/external-purchase#external-payments-830---japan-only">
              External Payments documentation
            </Link>{' '}
            for complete implementation details.
          </p>
        </blockquote>
      </section>

      <section>
        <AnchorLink id="external-purchase-link" level="h2">
          External Purchase Link (iOS)
        </AnchorLink>
        <p>
          iOS-specific feature for redirecting users to an external website for
          payment using Apple&apos;s StoreKit <code>ExternalPurchase</code> API.
          Available from iOS 15.4+ (notice sheet) and iOS 18.2+ (custom links).
        </p>

        <blockquote className="info-note">
          <p>
            <strong>Important:</strong> External purchase links bypass StoreKit
            completely. No <code>purchaseUpdatedListener</code> will fire. You
            must implement deep links and server-side verification.
          </p>
        </blockquote>

        <AnchorLink id="external-purchase-apis" level="h3">
          External Purchase APIs
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>API</th>
              <th>Description</th>
              <th>Availability</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>canPresentExternalPurchaseNoticeIOS</code>
              </td>
              <td>Check if external purchase notice sheet can be presented</td>
              <td>iOS 17.4+</td>
            </tr>
            <tr>
              <td>
                <code>presentExternalPurchaseNoticeSheetIOS</code>
              </td>
              <td>
                Present Apple&apos;s compliance notice sheet (required before
                external purchase)
              </td>
              <td>iOS 15.4+</td>
            </tr>
            <tr>
              <td>
                <code>presentExternalPurchaseLinkIOS</code>
              </td>
              <td>Open external purchase URL in Safari</td>
              <td>iOS 18.2+</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="external-purchase-types" level="h3">
          Types
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Result from presenting external purchase link
interface ExternalPurchaseLinkResultIOS {
  error?: string;
  success: boolean;
}

// Result from presenting notice sheet
interface ExternalPurchaseNoticeResultIOS {
  error?: string;
  result: ExternalPurchaseNoticeAction;
}

// User action on notice sheet
type ExternalPurchaseNoticeAction = 'continue' | 'dismissed';`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Result from presenting external purchase link
struct ExternalPurchaseLinkResultIOS {
    let error: String?
    let success: Bool
}

// Result from presenting notice sheet
struct ExternalPurchaseNoticeResultIOS {
    let error: String?
    let result: ExternalPurchaseNoticeAction
}

// User action on notice sheet
enum ExternalPurchaseNoticeAction: String {
    case \`continue\` = "continue"
    case dismissed = "dismissed"
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Result from presenting external purchase link (iOS-only via KMP)
data class ExternalPurchaseLinkResultIOS(
    val error: String? = null,
    val success: Boolean
)

// Result from presenting notice sheet
data class ExternalPurchaseNoticeResultIOS(
    val error: String? = null,
    val result: ExternalPurchaseNoticeAction
)

// User action on notice sheet
enum class ExternalPurchaseNoticeAction(val rawValue: String) {
    Continue("continue"),
    Dismissed("dismissed")
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Result from presenting external purchase link
class ExternalPurchaseLinkResultIOS {
  final String? error;
  final bool success;
}

// Result from presenting notice sheet
class ExternalPurchaseNoticeResultIOS {
  final String? error;
  final ExternalPurchaseNoticeAction result;
}

// User action on notice sheet
enum ExternalPurchaseNoticeAction {
  \`continue\`('continue'),
  dismissed('dismissed');
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="external-purchase-flow" level="h3">
          External Purchase Flow
        </AnchorLink>
        <p>The external purchase flow requires 3 steps for Apple compliance:</p>
        <ol>
          <li>
            <strong>Check availability</strong> - Verify the device supports
            external purchase
          </li>
          <li>
            <strong>Present notice sheet</strong> - Show Apple&apos;s required
            disclosure
          </li>
          <li>
            <strong>Open external link</strong> - Redirect to your payment page
          </li>
        </ol>

        <AnchorLink id="external-purchase-example" level="h3">
          Complete Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import {
  canPresentExternalPurchaseNoticeIOS,
  presentExternalPurchaseNoticeSheetIOS,
  presentExternalPurchaseLinkIOS,
} from 'expo-iap';

async function handleExternalPurchase(externalUrl: string) {
  // Step 1: Check if external purchase is available
  const canPresent = await canPresentExternalPurchaseNoticeIOS();
  if (!canPresent) {
    console.log('External purchase not available on this device');
    return;
  }

  // Step 2: Present Apple's compliance notice sheet
  const noticeResult = await presentExternalPurchaseNoticeSheetIOS();
  if (noticeResult.result === 'dismissed') {
    console.log('User dismissed the notice sheet');
    return;
  }

  // Step 3: Open external purchase link
  const linkResult = await presentExternalPurchaseLinkIOS(externalUrl);
  if (linkResult.success) {
    console.log('User redirected to external payment');
    // Implement deep linking to handle return from payment
  } else {
    console.error('Failed:', linkResult.error);
  }
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

@available(iOS 18.2, *)
func handleExternalPurchase(externalUrl: String) async {
    do {
        // Step 1: Check if external purchase is available
        let canPresent = try await OpenIapModule.shared.canPresentExternalPurchaseNoticeIOS()
        guard canPresent else {
            print("External purchase not available on this device")
            return
        }

        // Step 2: Present Apple's compliance notice sheet
        let noticeResult = try await OpenIapModule.shared.presentExternalPurchaseNoticeSheetIOS()
        guard noticeResult.result == .continue else {
            print("User dismissed the notice sheet")
            return
        }

        // Step 3: Open external purchase link
        let linkResult = try await OpenIapModule.shared.presentExternalPurchaseLinkIOS(externalUrl)
        if linkResult.success {
            print("User redirected to external payment")
            // Implement deep linking to handle return from payment
        } else if let error = linkResult.error {
            print("Failed: \\(error)")
        }
    } catch {
        print("External purchase error: \\(error)")
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.kmpIapInstance
import io.github.hyochan.kmpiap.ExternalPurchaseNoticeAction

// External purchase is iOS-only. For iOS targets in KMP:
suspend fun handleExternalPurchase(externalUrl: String) {
    // Step 1: Check if external purchase is available
    val canPresent = kmpIapInstance.canPresentExternalPurchaseNoticeIOS()
    if (!canPresent) {
        println("External purchase not available on this device")
        return
    }

    // Step 2: Present Apple's compliance notice sheet
    val noticeResult = kmpIapInstance.presentExternalPurchaseNoticeSheetIOS()
    if (noticeResult.result == ExternalPurchaseNoticeAction.Dismissed) {
        println("User dismissed the notice sheet")
        return
    }

    // Step 3: Open external purchase link
    val linkResult = kmpIapInstance.presentExternalPurchaseLinkIOS(externalUrl)
    if (linkResult.success) {
        println("User redirected to external payment")
        // Implement deep linking to handle return from payment
    } else {
        println("Failed: \${linkResult.error}")
    }
}

// For Android: Use alternative billing APIs instead
// See: checkAlternativeBillingAvailability, showAlternativeBillingDialog`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

Future<void> handleExternalPurchase(String externalUrl) async {
  final iap = FlutterInappPurchase.instance;

  // Step 1: Check if external purchase is available
  final canPresent = await iap.canPresentExternalPurchaseNoticeIOS();
  if (!canPresent) {
    print('External purchase not available on this device');
    return;
  }

  // Step 2: Present Apple's compliance notice sheet
  final noticeResult = await iap.presentExternalPurchaseNoticeSheetIOS();
  if (noticeResult.result == ExternalPurchaseNoticeAction.dismissed) {
    print('User dismissed the notice sheet');
    return;
  }

  // Step 3: Open external purchase link
  final linkResult = await iap.presentExternalPurchaseLinkIOS(externalUrl);
  if (linkResult.success) {
    print('User redirected to external payment');
    // Implement deep linking to handle return from payment
  } else {
    print('Failed: \${linkResult.error}');
  }
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="external-purchase-requirements" level="h3">
          Requirements
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Requirement</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Platform</td>
              <td>iOS 15.4+ (notice sheet), iOS 18.2+ (custom links)</td>
            </tr>
            <tr>
              <td>Entitlement</td>
              <td>
                App must have StoreKit external purchase entitlement from Apple
              </td>
            </tr>
            <tr>
              <td>Deep Linking</td>
              <td>Implement deep linking for app return flow after payment</td>
            </tr>
            <tr>
              <td>Verification</td>
              <td>
                Handle purchase verification on your backend (no StoreKit
                receipt)
              </td>
            </tr>
          </tbody>
        </table>

        <blockquote className="info-note">
          <p>
            <strong>Android alternative:</strong> For Android, use the{' '}
            <Link to="/docs/apis/android#alternative-billing-android">
              alternative billing APIs
            </Link>{' '}
            (<code>checkAlternativeBillingAvailability</code>,{' '}
            <code>showAlternativeBillingDialog</code>,{' '}
            <code>createAlternativeBillingToken</code>) instead.
          </p>
        </blockquote>
      </section>
    </div>
  );
}

export default TypesAlternative;
