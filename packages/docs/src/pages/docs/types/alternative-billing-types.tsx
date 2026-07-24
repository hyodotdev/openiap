import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function AlternativeBillingTypes() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Alternative Billing Types"
        description="Alternative Billing Types type definition and field reference."
        path="/docs/types/alternative-billing-types"
        keywords="Alternative Billing Types, OpenIAP types, Alternative Billing"
      />
      <h1>Alternative Billing Types</h1>
      <section>
        <AnchorLink id="alternative-billing-types" level="h2">
          Alternative Billing Types
        </AnchorLink>
        <p>
          Types for configuring alternative billing systems, primarily used for
          Android.
        </p>
        <p>
          Modes for opting into Google&apos;s alternative-billing programs.{' '}
          <strong>Android only</strong> — passed via{' '}
          <code>InitConnectionConfig.alternativeBillingModeAndroid</code>{' '}
          (deprecated; prefer <code>enableBillingProgramAndroid</code>) (
          <a
            href="https://developer.android.com/google/play/billing/alternative"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google docs
          </a>
          ).
        </p>
        <p className="type-link">
          <strong>Native references:</strong>{' '}
          <a
            href="https://developer.android.com/google/play/billing/alternative"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google · Alternative billing
          </a>
          {' · '}
          <a
            href="https://support.google.com/googleplay/android-developer/answer/13821247"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google · User Choice Billing
          </a>
        </p>

        <AnchorLink id="alternative-billing-mode-android" level="h3">
          AlternativeBillingModeAndroid{' '}
          <span style={{ color: 'var(--text-warning)', fontSize: '0.875rem' }}>
            (Deprecated)
          </span>
        </AnchorLink>
        <div className="warning-box" style={{ marginBottom: '1rem' }}>
          <strong>Deprecated:</strong> Use{' '}
          <Link to="#init-connection-config">
            <code>enableBillingProgramAndroid</code>
          </Link>{' '}
          with{' '}
          <Link to="/docs/types/billing-programs#billing-program-android">
            <code>BillingProgramAndroid</code>
          </Link>{' '}
          instead. The schema/native type is scheduled for removal in OpenIAP
          3.0; generated framework copies remain through their package-specific
          majors in the{' '}
          <Link to="/docs/updates/deprecations#removal-schedule">
            deprecation schedule
          </Link>
          .
          <ul style={{ marginBottom: 0 }}>
            <li>
              <code>user-choice</code> → <code>user-choice-billing</code>
            </li>
            <li>
              <code>alternative-only</code> → <code>external-offer</code>
            </li>
          </ul>
        </div>
        <p>
          Enum controlling which billing system is used during{' '}
          <Link to="/docs/apis/init-connection">
            <code>initConnection()</code>
          </Link>
          :
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
          Configuration options for{' '}
          <Link to="/docs/apis/init-connection">
            <code>initConnection()</code>
          </Link>
          :
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
                <Link to="/docs/types/billing-programs#billing-program-android">
                  <code>enableBillingProgramAndroid</code>
                </Link>
              </td>
              <td>
                <strong>(Recommended)</strong> Enable a specific billing program
                during connection. Use <code>USER_CHOICE_BILLING</code> for user
                choice, <code>EXTERNAL_OFFER</code> for alternative only, or{' '}
                <code>EXTERNAL_PAYMENTS</code> for Japan external payments
                (8.3.0+). Use <code>BILLING_CHOICE</code> for Billing Choice
                (OpenIAP Spec 2.1.0 / openiap-google 2.3.0; Play Billing
                9.1.0+).
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/types/billing-programs#billing-choice-screen-type-android">
                  <code>billingChoiceScreenTypeAndroid</code>
                </Link>
              </td>
              <td>
                Billing Choice renderer in OpenIAP Spec 2.1.0 / openiap-google
                2.3.0 (Play Billing 9.1.0+). Defaults to{' '}
                <code>GOOGLE_RENDERED</code>. Set{' '}
                <code>DEVELOPER_RENDERED</code> when your app renders the choice
                screen; this controls whether OpenIAP registers Play&apos;s
                developer-provided billing listener.
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/types/alternative-billing-types#alternative-billing-mode-android">
                  <code>alternativeBillingModeAndroid</code>
                </Link>
              </td>
              <td>
                <span style={{ color: 'var(--text-warning)' }}>
                  (Deprecated)
                </span>{' '}
                Use{' '}
                <Link to="/docs/types/billing-programs#billing-program-android">
                  <code>enableBillingProgramAndroid</code>
                </Link>{' '}
                instead.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="init-connection-example" level="h4">
          Basic Usage (Recommended)
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Choose one configuration. End the current connection before changing programs.

// Initialize with user choice billing (7.0+)
await initConnection({
  enableBillingProgramAndroid: 'user-choice-billing'
});

// Initialize with external offer (alternative only)
await initConnection({
  enableBillingProgramAndroid: 'external-offer'
});

// Initialize with external payments (Japan only, 8.3.0+)
await initConnection({
  enableBillingProgramAndroid: 'external-payments'
});

// Developer-rendered Billing Choice (must match Play Console, 9.1.0+)
await initConnection({
  enableBillingProgramAndroid: 'billing-choice',
  billingChoiceScreenTypeAndroid: 'developer-rendered'
});

// Standard billing (default)
await initConnection();`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// iOS uses standard StoreKit billing
// Alternative billing is Android-only
let isConnected = try await OpenIapModule.shared.initConnection()`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Choose one configuration. End the current connection before changing programs.

// Initialize with user choice billing (7.0+)
openIapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.UserChoiceBilling
    )
)

// Initialize with external offer (alternative only)
openIapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
    )
)

// Initialize with external payments (Japan only, 8.3.0+)
openIapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalPayments
    )
)

// Developer-rendered Billing Choice (must match Play Console, 9.1.0+)
openIapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.BillingChoice,
        billingChoiceScreenTypeAndroid = BillingChoiceScreenTypeAndroid.DeveloperRendered
    )
)

// Standard billing (default)
openIapStore.initConnection()`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Choose one configuration. End the current connection before changing programs.

// Initialize with user choice billing (7.0+)
await FlutterInappPurchase.instance.initConnection(
  enableBillingProgramAndroid: BillingProgramAndroid.UserChoiceBilling,
);

// Initialize with external offer (alternative only)
await FlutterInappPurchase.instance.initConnection(
  enableBillingProgramAndroid: BillingProgramAndroid.ExternalOffer,
);

// Initialize with external payments (Japan only, 8.3.0+)
await FlutterInappPurchase.instance.initConnection(
  enableBillingProgramAndroid: BillingProgramAndroid.ExternalPayments,
);

// Developer-rendered Billing Choice (must match Play Console, 9.1.0+)
await FlutterInappPurchase.instance.initConnection(
  enableBillingProgramAndroid: BillingProgramAndroid.BillingChoice,
  billingChoiceScreenTypeAndroid:
      BillingChoiceScreenTypeAndroid.DeveloperRendered,
);

// Standard billing (default)
await FlutterInappPurchase.instance.initConnection();`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// Choose one configuration. End the current connection before changing programs.

// Initialize with user choice billing (7.0+)
await ((MutationResolver)OpenIapClient.Instance).InitConnectionAsync(
    new InitConnectionConfig
    {
        EnableBillingProgramAndroid = BillingProgramAndroid.UserChoiceBilling,
    });

// Initialize with external offer (alternative only)
await ((MutationResolver)OpenIapClient.Instance).InitConnectionAsync(
    new InitConnectionConfig
    {
        EnableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer,
    });

// Initialize with external payments (Japan only, 8.3.0+)
await ((MutationResolver)OpenIapClient.Instance).InitConnectionAsync(
    new InitConnectionConfig
    {
        EnableBillingProgramAndroid = BillingProgramAndroid.ExternalPayments,
    });

// Developer-rendered Billing Choice (must match Play Console, 9.1.0+)
await ((MutationResolver)OpenIapClient.Instance).InitConnectionAsync(
    new InitConnectionConfig
    {
        EnableBillingProgramAndroid = BillingProgramAndroid.BillingChoice,
        BillingChoiceScreenTypeAndroid = BillingChoiceScreenTypeAndroid.DeveloperRendered,
    });

// Standard billing (default)
await ((MutationResolver)OpenIapClient.Instance).InitConnectionAsync();`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Choose one configuration. End the current connection before changing programs.

# Initialize with user choice billing (7.0+)
var config = InitConnectionConfig.new()
config.enable_billing_program_android = BillingProgramAndroid.USER_CHOICE_BILLING
await iap.init_connection(config)

# Initialize with external offer (alternative only)
config.enable_billing_program_android = BillingProgramAndroid.EXTERNAL_OFFER
await iap.init_connection(config)

# Initialize with external payments (Japan only, 8.3.0+)
config.enable_billing_program_android = BillingProgramAndroid.EXTERNAL_PAYMENTS
await iap.init_connection(config)

# Developer-rendered Billing Choice (must match Play Console, 9.1.0+)
config.enable_billing_program_android = BillingProgramAndroid.BILLING_CHOICE
config.billing_choice_screen_type_android = BillingChoiceScreenTypeAndroid.DEVELOPER_RENDERED
await iap.init_connection(config)

# Standard billing (default)
await iap.init_connection()`}</CodeBlock>
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
} from 'expo-iap';

// Step 1: Set up listener for when user selects alternative billing
const userChoiceSubscription = userChoiceBillingListenerAndroid(async (details) => {
  console.log('User chose alternative billing');
  const products = details.products ?? [];
  for (const productId of products) {
    console.log('Product:', productId);
  }
  console.log('External transaction token received; send it to your backend without logging it.');

  // Process payment with your backend using the token
  const paymentResult = await yourBackend.processPayment({
    products,
    token: details.externalTransactionToken,
  });

  if (paymentResult.success) {
    grantUserAccess();
  }
});

// Step 2: Initialize with user choice billing (recommended)
await initConnection({
  enableBillingProgramAndroid: 'user-choice-billing',
});

// Step 3: Fetch products and purchase as normal
const products = await fetchProducts({
  skus: ['premium_subscription'],
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

// Call from your screen/component cleanup hook.
const disposeUserChoiceListener = () => userChoiceSubscription.remove();`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.*
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import dev.hyo.openiap.store.OpenIapStore

val iapStore = OpenIapStore(context)

// Step 1: Set up listener for when user selects alternative billing
val userChoiceListener = object : OpenIapUserChoiceBillingListener {
    override fun onUserChoiceBilling(details: UserChoiceBillingDetails) {
        Log.d("IAP", "User chose alternative billing")
        for (productId in details.products) {
            Log.d("IAP", "Product: \$productId")
        }
        Log.d("IAP", "External transaction token received; send it to your backend without logging it.")

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
}
iapStore.addUserChoiceBillingListener(userChoiceListener)

// Step 2: Initialize with user choice billing (recommended)
iapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.UserChoiceBilling
    )
)

// Step 3: Fetch products and purchase as normal
val products = iapStore.fetchProducts(
    ProductRequest(
        skus = listOf("premium_subscription"),
        type = ProductQueryType.Subs
    )
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
// If user selects alternative → OpenIapUserChoiceBillingListener fires

// Call when the owning lifecycle ends.
fun disposeUserChoiceListener() {
    iapStore.removeUserChoiceBillingListener(userChoiceListener)
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Step 1: Set up listener for when user selects alternative billing
final userChoiceSubscription = FlutterInappPurchase.instance.userChoiceBillingAndroid
    .listen((details) async {
  print('User chose alternative billing');
  for (final productId in details.products) {
    print('Product: \$productId');
  }
  print('External transaction token received; send it to your backend without logging it.');

  // Process payment with your backend using the token
  final paymentResult = await yourBackend.processPayment(
    products: details.products,
    token: details.externalTransactionToken,
  );

  if (paymentResult.success) {
    grantUserAccess();
  }
});

// Step 2: Initialize with user choice billing (recommended)
await FlutterInappPurchase.instance.initConnection(
  enableBillingProgramAndroid: BillingProgramAndroid.UserChoiceBilling,
);

// Step 3: Fetch products and purchase as normal
final products = await FlutterInappPurchase.instance
    .fetchProducts<ProductSubscription>(
  skus: ['premium_subscription'],
  type: ProductQueryType.Subs,
);

// Step 4: Request purchase - dialog will show both options
await FlutterInappPurchase.instance.requestPurchase(
  RequestPurchaseProps.subs((
    apple: null,
    google: RequestSubscriptionAndroidProps(
      skus: ['premium_subscription'],
    ),
    // Compatibility-only placeholder required by the generated 9.x record.
    useAlternativeBilling: null,
  )),
);

// If user selects Google Play → purchaseUpdatedListener fires
// If user selects alternative → userChoiceBillingAndroid fires

// Call from your State.dispose() method.
Future<void> disposeUserChoiceListener() => userChoiceSubscription.cancel();`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// Step 1: Set up listener for when user selects alternative billing.
var userChoiceSubscription = OpenIapClient.Instance.UserChoiceBillingAndroid.Subscribe(async details =>
{
    Console.WriteLine("User chose alternative billing");
    Console.WriteLine($"Products: {string.Join(", ", details.Products)}");
    Console.WriteLine("External transaction token received; send it to your backend without logging it.");

    var paymentResult = await ProcessPaymentWithBackendAsync(
        products: details.Products,
        token: details.ExternalTransactionToken);

    if (paymentResult.Success)
    {
        await GrantUserAccessAsync();
    }
});

// Step 2: Initialize with user choice billing (recommended).
await ((MutationResolver)OpenIapClient.Instance).InitConnectionAsync(new InitConnectionConfig
{
    EnableBillingProgramAndroid = BillingProgramAndroid.UserChoiceBilling,
});

// Step 3: Fetch products and purchase as normal.
await ((QueryResolver)OpenIapClient.Instance).FetchProductsAsync(new ProductRequest
{
    Skus = new[] { "premium_subscription" },
    Type = ProductQueryType.Subs,
});

// Step 4: Request purchase - dialog will show both options.
await ((MutationResolver)OpenIapClient.Instance).RequestPurchaseAsync(new RequestPurchaseProps
{
    Type = ProductQueryType.Subs,
    RequestSubscription = new RequestSubscriptionPropsByPlatforms
    {
        Google = new RequestSubscriptionAndroidProps
        {
            Skus = new[] { "premium_subscription" },
        },
    },
});

// If user selects Google Play, purchase updated fires.
// If user selects alternative, UserChoiceBillingAndroid fires.

// Call when the owning lifecycle ends.
void DisposeUserChoiceListener() => userChoiceSubscription.Dispose();`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Step 1: Set up listener for when user selects alternative billing
func _on_user_choice_billing(details: UserChoiceBillingDetails):
    print("User chose alternative billing")
    print("Products: %s" % str(details.products))
    print("External transaction token received; send it to your backend without logging it.")

    # Process payment with your backend using the token
    var payment_result = await your_backend.process_payment(
        details.products,
        details.external_transaction_token
    )

    if payment_result.success:
        grant_user_access()

iap.user_choice_billing_android.connect(_on_user_choice_billing)

# Step 2: Initialize with user choice billing (recommended)
var config = InitConnectionConfig.new()
config.enable_billing_program_android = BillingProgramAndroid.USER_CHOICE_BILLING
await iap.init_connection(config)

# Step 3: Fetch products and purchase as normal
var request = ProductRequest.new()
request.skus = ["premium_subscription"]
request.type = ProductQueryType.SUBS
var products = await iap.fetch_products(request)

# Step 4: Request purchase - dialog will show both options
var props = RequestPurchaseProps.new()
props.request_subscription = RequestSubscriptionPropsByPlatforms.new()
props.request_subscription.google = RequestSubscriptionAndroidProps.new()
props.request_subscription.google.skus = ["premium_subscription"]
props.type = ProductQueryType.SUBS
await iap.request_purchase(props)

# If user selects Google Play → purchase_updated signal fires
# If user selects alternative → user_choice_billing_android signal fires

# Cleanup when the owning node exits
func _exit_tree() -> void:
    if iap.user_choice_billing_android.is_connected(_on_user_choice_billing):
        iap.user_choice_billing_android.disconnect(_on_user_choice_billing)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <div className="alert-card alert-card--warning">
          <p>
            <strong>Flutter 9.x record compatibility:</strong>{' '}
            <code>useAlternativeBilling: null</code> in the Dart example is only
            a required placeholder in the generated positional record. Configure{' '}
            <code>enableBillingProgramAndroid</code> on{' '}
            <code>initConnection</code> instead. The deprecated field is removed
            in <code>flutter_inapp_purchase 10.0.0</code>; see the{' '}
            <Link to="/docs/updates/deprecations#flutter-10-package-migrations">
              Flutter 10 migration notes
            </Link>
            .
          </p>
        </div>

        <AnchorLink id="alternative-only-example" level="h4">
          Alternative Billing Only Complete Example
        </AnchorLink>
        <p>
          With External Offer mode (replaces Alternative Only), all purchases go
          through your alternative payment system. Use the Billing Programs API
          available with Play Billing 8.2.1+:
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import {
  initConnection,
  fetchProducts,
  isBillingProgramAvailableAndroid,
  createBillingProgramReportingDetailsAndroid,
  launchExternalLinkAndroid,
} from 'expo-iap';

// Step 1: Initialize with external offer (recommended)
await initConnection({
  enableBillingProgramAndroid: 'external-offer',
});

// Step 2: Check if alternative billing is available
const availability = await isBillingProgramAvailableAndroid('external-offer');
if (!availability.isAvailable) {
  console.log('External Offer is not available in this region');
  return;
}

// Step 3: Fetch products (still needed to show prices)
const products = await fetchProducts({
  skus: ['premium_subscription'],
  type: 'subs',
});

// Step 4: Create reporting details immediately before redirecting.
const reportingDetails =
  await createBillingProgramReportingDetailsAndroid('external-offer');

// Step 5: Play shows the disclosure and launches the checkout URL.
const launched = await launchExternalLinkAndroid({
  billingProgram: 'external-offer',
  launchMode: 'launch-in-external-browser-or-app',
  linkType: 'link-to-digital-content-offer',
  linkUri: 'https://your-payment-site.com/checkout',
});
if (!launched) return;

// Step 6: This helper must wait for and verify checkout completion; a true
// launch result alone is not proof of purchase. Then report within 24 hours.
const paymentResult = await yourBackend.completeAndReportExternalPurchase({
  productId: products[0].id,
  externalTransactionToken: reportingDetails.externalTransactionToken,
  userId: currentUserId,
});

if (paymentResult.success) {
  grantUserAccess();
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.*
import dev.hyo.openiap.store.OpenIapStore

val iapStore = OpenIapStore(context)

// Step 1: Initialize with external offer (recommended)
iapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
    )
)

// Step 2: Check whether External Offer is available for this user.
val availability = iapStore.isBillingProgramAvailable(
    BillingProgramAndroid.ExternalOffer
)
if (!availability.isAvailable) {
    Log.w("IAP", "External Offer is not available in this region")
    return
}

// Step 3: Fetch products (still needed to show prices)
val products = iapStore.fetchProducts(
    ProductRequest(
        skus = listOf("premium_subscription"),
        type = ProductQueryType.Subs
    )
)
val product = (products as? FetchProductsResultSubscriptions)
    ?.value
    ?.firstOrNull()
    ?: return

// Step 4: Create reporting details immediately before redirecting.
val reportingDetails = iapStore.createBillingProgramReportingDetails(
    BillingProgramAndroid.ExternalOffer
)

// Step 5: Play shows the disclosure and launches the checkout URL.
val launched = iapStore.launchExternalLink(
    activity,
    LaunchExternalLinkParamsAndroid(
        billingProgram = BillingProgramAndroid.ExternalOffer,
        launchMode = ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
        linkType = ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
        linkUri = "https://your-payment-site.com/checkout"
    )
)
if (!launched) return

// Step 6: This helper must wait for and verify checkout completion; a true
// launch result alone is not proof of purchase. Then report from your backend.
lifecycleScope.launch {
    val paymentResult = yourBackend.completeAndReportExternalPurchase(
        productId = product.id,
        externalTransactionToken = reportingDetails.externalTransactionToken,
        userId = currentUserId
    )

    if (paymentResult.success) {
        grantUserAccess()
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final iap = FlutterInappPurchase.instance;

// Step 1: Initialize with external offer (recommended)
await iap.initConnection(
  enableBillingProgramAndroid: BillingProgramAndroid.ExternalOffer,
);

// Step 2: Check whether External Offer is available for this user.
final availability = await iap.isBillingProgramAvailableAndroid(
  BillingProgramAndroid.ExternalOffer,
);
if (!availability.isAvailable) {
  print('External Offer is not available in this region');
  return;
}

// Step 3: Fetch products (still needed to show prices)
final products = await iap.fetchProducts<ProductSubscription>(
  skus: ['premium_subscription'],
  type: ProductQueryType.Subs,
);

// Step 4: Create reporting details immediately before redirecting.
final reportingDetails = await iap.createBillingProgramReportingDetailsAndroid(
  program: BillingProgramAndroid.ExternalOffer,
);

// Step 5: Play shows the disclosure and launches the checkout URL.
final launched = await iap.launchExternalLinkAndroid(
  billingProgram: BillingProgramAndroid.ExternalOffer,
  launchMode: ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
  linkType: ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
  linkUri: 'https://your-payment-site.com/checkout',
);
if (!launched) return;

// Step 6: This helper must wait for and verify checkout completion; a true
// launch result alone is not proof of purchase. Then report from your backend.
final paymentResult = await yourBackend.completeAndReportExternalPurchase(
  productId: products.first.id,
  externalTransactionToken: reportingDetails.externalTransactionToken,
  userId: currentUserId,
);

if (paymentResult.success) {
  grantUserAccess();
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;
using System.Linq;

// Step 1: Initialize with external offer (recommended).
await ((MutationResolver)OpenIapClient.Instance).InitConnectionAsync(new InitConnectionConfig
{
    EnableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer,
});

var mutate = (MutationResolver)OpenIapClient.Instance;

// Step 2: Check whether External Offer is available for this user.
var availability = await mutate.IsBillingProgramAvailableAndroidAsync(
    BillingProgramAndroid.ExternalOffer);
if (!availability.IsAvailable)
{
    Console.WriteLine("External Offer is not available in this region");
    return;
}

// Step 3: Fetch products (still needed to show prices).
var result = await ((QueryResolver)OpenIapClient.Instance).FetchProductsAsync(new ProductRequest
{
    Skus = new[] { "premium_subscription" },
    Type = ProductQueryType.Subs,
});
var product = result is FetchProductsResultSubscriptions subscriptions
    ? subscriptions.Value?.OfType<ProductSubscriptionAndroid>()?.FirstOrDefault()
    : null;

if (product is null) return;

// Step 4: Create reporting details immediately before redirecting.
var reportingDetails = await mutate.CreateBillingProgramReportingDetailsAndroidAsync(
    BillingProgramAndroid.ExternalOffer);

// Step 5: Play shows the disclosure and launches the checkout URL.
var launched = await mutate.LaunchExternalLinkAndroidAsync(
    new LaunchExternalLinkParamsAndroid
    {
        BillingProgram = BillingProgramAndroid.ExternalOffer,
        LaunchMode = ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
        LinkType = ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
        LinkUri = "https://your-payment-site.com/checkout",
    });
if (!launched) return;

// Step 6: This helper must wait for and verify checkout completion; a true
// launch result alone is not proof of purchase. Then report from your backend.
var paymentResult = await CompleteAndReportExternalPurchaseAsync(
    productId: product.Id,
    externalTransactionToken: reportingDetails.ExternalTransactionToken,
    userId: currentUserId);

if (paymentResult.Success)
{
    await GrantUserAccessAsync();
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Step 1: Initialize with external offer (recommended)
var config = InitConnectionConfig.new()
config.enable_billing_program_android = BillingProgramAndroid.EXTERNAL_OFFER
await iap.init_connection(config)

# Step 2: Check whether External Offer is available for this user.
var availability = await iap.is_billing_program_available_android(
    BillingProgramAndroid.EXTERNAL_OFFER
)
if not availability.is_available:
    print("External Offer is not available in this region")
    return

# Step 3: Fetch products (still needed to show prices)
var request = ProductRequest.new()
request.skus = ["premium_subscription"]
request.type = ProductQueryType.SUBS
var products = await iap.fetch_products(request)

# Step 4: Create reporting details immediately before redirecting.
var reporting_details = await iap.create_billing_program_reporting_details_android(
    BillingProgramAndroid.EXTERNAL_OFFER
)

# Step 5: Play shows the disclosure and launches the checkout URL.
var params = LaunchExternalLinkParamsAndroid.new()
params.billing_program = BillingProgramAndroid.EXTERNAL_OFFER
params.launch_mode = ExternalLinkLaunchModeAndroid.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP
params.link_type = ExternalLinkTypeAndroid.LINK_TO_DIGITAL_CONTENT_OFFER
params.link_uri = "https://your-payment-site.com/checkout"
var launched = await iap.launch_external_link_android(params)
if not launched:
    return

# Step 6: This helper must wait for and verify checkout completion; a true
# launch result alone is not proof of purchase. Then report from your backend.
var payment_result = await your_backend.complete_and_report_external_purchase(
    products[0].id,
    reporting_details.external_transaction_token,
    current_user_id
)

if payment_result.success:
    grant_user_access()`}</CodeBlock>
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
    </div>
  );
}

export default AlternativeBillingTypes;
