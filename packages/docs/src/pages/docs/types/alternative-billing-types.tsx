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
          instead.
          <ul style={{ marginBottom: 0 }}>
            <li>
              <code>USER_CHOICE</code> →{' '}
              <code>BillingProgramAndroid.USER_CHOICE_BILLING</code>
            </li>
            <li>
              <code>ALTERNATIVE_ONLY</code> →{' '}
              <code>BillingProgramAndroid.EXTERNAL_OFFER</code>
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
                (8.3.0+).
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
              <CodeBlock language="typescript">{`// Initialize with user choice billing (7.0+)
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
              <CodeBlock language="kotlin">{`// Initialize with user choice billing (7.0+)
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

// Standard billing (default)
openIapStore.initConnection()`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Initialize with user choice billing (7.0+)
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

// Standard billing (default)
await FlutterInappPurchase.instance.initConnection();`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// Initialize with user choice billing (7.0+)
await ((QueryResolver)OpenIap.Instance).InitConnectionAsync(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.UserChoiceBilling
    )
)

// Initialize with external offer (alternative only)
await ((QueryResolver)OpenIap.Instance).InitConnectionAsync(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
    )
)

// Initialize with external payments (Japan only, 8.3.0+)
await ((QueryResolver)OpenIap.Instance).InitConnectionAsync(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalPayments
    )
)

// Standard billing (default)
await ((QueryResolver)OpenIap.Instance).InitConnectionAsync()`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Initialize with user choice billing (7.0+)
var config = InitConnectionConfig.new()
config.enable_billing_program_android = BillingProgramAndroid.USER_CHOICE_BILLING
await iap.init_connection(config)

# Initialize with external offer (alternative only)
config.enable_billing_program_android = BillingProgramAndroid.EXTERNAL_OFFER
await iap.init_connection(config)

# Initialize with external payments (Japan only, 8.3.0+)
config.enable_billing_program_android = BillingProgramAndroid.EXTERNAL_PAYMENTS
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

// Step 2: Initialize with user choice billing (recommended)
await initConnection({
  enableBillingProgramAndroid: 'user-choice-billing',
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
import dev.hyo.openiap.BillingProgramAndroid
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

// Step 2: Initialize with user choice billing (recommended)
iapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.UserChoiceBilling
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

// Step 2: Initialize with user choice billing (recommended)
await FlutterInappPurchase.instance.initConnection(
  enableBillingProgramAndroid: BillingProgramAndroid.UserChoiceBilling,
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
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var iapStore = OpenIapStore(context)

// Step 1: Set up listener for when user selects alternative billing
iapStore.addUserChoiceBillingListener(object : OpenIapUserChoiceBillingListener {
    override fun onUserChoiceBilling(details: UserChoiceBillingDetails) {
        Log.d("IAP", "User chose alternative billing")
        Log.d("IAP", "Products: \${details.products.map { it.productId }}")
        Log.d("IAP", "Token: \${details.externalTransactionToken}")

        // Process payment with your backend using the token
        lifecycleScope.launch {
            var paymentResult = yourBackend.processPayment(
                products = details.products,
                token = details.externalTransactionToken
            )

            if (paymentResult.success) {
                grantUserAccess()
            }
        }
    }
})

// Step 2: Initialize with user choice billing (recommended)
iapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.UserChoiceBilling
    )
)

// Step 3: Fetch products and purchase as normal
var products = iapStore.fetchProducts(
    skus = new[] { "premium_subscription" },
    type = ProductQueryType.Subs
)

// Step 4: Request purchase - dialog will show both options
iapStore.setActivity(activity)
iapStore.requestPurchase(
    RequestPurchaseProps(
        request = RequestPurchaseProps.Request.Subscription(
            RequestSubscriptionPropsByPlatforms(
                google = RequestSubscriptionAndroidProps(
                    skus = new[] { "premium_subscription" }
                )
            )
        ),
        type = ProductQueryType.Subs
    )
)

// If user selects Google Play → onPurchaseSuccess fires
// If user selects alternative → OpenIapUserChoiceBillingListener fires`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Step 1: Set up listener for when user selects alternative billing
func _on_user_choice_billing(details: UserChoiceBillingDetails):
    print("User chose alternative billing")
    var product_ids = []
    for p in details.products:
        product_ids.append(p.product_id)
    print("Products: %s" % str(product_ids))
    print("Token: %s" % details.external_transaction_token)

    # Process payment with your backend using the token
    var payment_result = await your_backend.process_payment(
        details.products,
        details.external_transaction_token
    )

    if payment_result.success:
        grant_user_access()

iap.user_choice_billing.connect(_on_user_choice_billing)

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
props.request = RequestSubscriptionPropsByPlatforms.new()
props.request.google = RequestSubscriptionAndroidProps.new()
props.request.google.skus = ["premium_subscription"]
props.type = ProductType.SUBS
await iap.request_purchase(props)

# If user selects Google Play → purchase_updated signal fires
# If user selects alternative → user_choice_billing signal fires`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="alternative-only-example" level="h4">
          Alternative Billing Only Complete Example
        </AnchorLink>
        <p>
          With External Offer mode (replaces Alternative Only), all purchases go
          through your alternative payment system. Google Play is not shown:
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import {
  initConnection,
  fetchProducts,
  checkAlternativeBillingAvailabilityAndroid,
  showAlternativeBillingDialogAndroid,
  createAlternativeBillingTokenAndroid,
} from 'expo-iap';

// Step 1: Initialize with external offer (recommended)
await initConnection({
  enableBillingProgramAndroid: 'external-offer',
});

// Step 2: Check if alternative billing is available
const isAvailable = await checkAlternativeBillingAvailabilityAndroid();
if (!isAvailable) {
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
const accepted = await showAlternativeBillingDialogAndroid();
if (!accepted) {
  console.log('User did not accept alternative billing');
  return;
}

// Step 5: Create token for this transaction
const token = await createAlternativeBillingTokenAndroid(products[0].id);

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
import dev.hyo.openiap.BillingProgramAndroid

val iapStore = OpenIapStore(context)

// Step 1: Initialize with external offer (recommended)
iapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
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

// Step 1: Initialize with external offer (recommended)
await iap.initConnection(
  enableBillingProgramAndroid: BillingProgramAndroid.ExternalOffer,
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
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var iapStore = OpenIapStore(context)

// Step 1: Initialize with external offer (recommended)
iapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
    )
)

// Step 2: Check if alternative billing is available
var availability = iapStore.checkAlternativeBillingAvailability()
if (!availability.isAvailable) {
    Log.w("IAP", "Alternative billing not available in this region")
    // Fall back to standard Google Play billing
    return
}

// Step 3: Fetch products (still needed to show prices)
var products = iapStore.fetchProducts(
    skus = new[] { "premium_subscription" },
    type = ProductQueryType.Subs
)

// Step 4: Show required Google Play disclosure dialog
iapStore.setActivity(activity)
var dialogResult = iapStore.showAlternativeBillingDialog()
if (dialogResult.responseCode != 0) {
    Log.d("IAP", "User did not accept alternative billing")
    return
}

// Step 5: Create token for this transaction
var token = iapStore.createAlternativeBillingToken(products.first().id)

// Step 6: Process purchase with your backend
lifecycleScope.launch {
    var paymentResult = yourBackend.processAlternativePurchase(
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
            gdscript: (
              <CodeBlock language="gdscript">{`# Step 1: Initialize with external offer (recommended)
var config = InitConnectionConfig.new()
config.enable_billing_program_android = BillingProgramAndroid.EXTERNAL_OFFER
await iap.init_connection(config)

# Step 2: Check if alternative billing is available
var availability = await iap.check_alternative_billing_availability()
if not availability.is_available:
    print("Alternative billing not available in this region")
    # Fall back to standard Google Play billing
    return

# Step 3: Fetch products (still needed to show prices)
var request = ProductRequest.new()
request.skus = ["premium_subscription"]
request.type = ProductQueryType.SUBS
var products = await iap.fetch_products(request)

# Step 4: Show required Google Play disclosure dialog
var dialog_result = await iap.show_alternative_billing_dialog()
if dialog_result.response_code != 0:
    print("User did not accept alternative billing")
    return

# Step 5: Create token for this transaction
var token = await iap.create_alternative_billing_token(products[0].id)

# Step 6: Process purchase with your backend
var payment_result = await your_backend.process_alternative_purchase(
    products[0].id,
    products[0].price,
    token,
    current_user_id
)

if payment_result.success:
    # Report transaction to Google (required)
    await your_backend.report_external_transaction(token, payment_result.order_id)
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
