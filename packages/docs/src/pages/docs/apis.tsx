import { Link } from 'react-router-dom';
import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import LanguageTabs from '../../components/LanguageTabs';
import PlatformTabs from '../../components/PlatformTabs';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function APIs() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="APIs"
        description="OpenIAP API reference - initConnection, fetchProducts, requestPurchase, verifyPurchase, finishTransaction, and more for cross-platform in-app purchases."
        path="/docs/apis"
        keywords="IAP API, initConnection, fetchProducts, requestPurchase, finishTransaction, verifyPurchase, validateReceipt, receipt validation"
      />
      <h1>APIs</h1>

      <section>
        <AnchorLink id="terminology" level="h2">
          Terminology
        </AnchorLink>

        <AnchorLink id="request-apis" level="h3">
          Request APIs
        </AnchorLink>
        <blockquote className="terminology-note">
          <p>
            <strong>⚠️ Important:</strong> APIs starting with{' '}
            <code>request</code> are event-based operations, not promise-based.
          </p>
          <p>
            While these APIs return values for various purposes, you should{' '}
            <strong>
              not rely on their return values for actual purchase results
            </strong>
            . Instead, listen for events through{' '}
            <code>purchaseUpdatedListener</code> or{' '}
            <code>purchaseErrorListener</code>.
          </p>
          <p>
            This is because Apple's purchase system is fundamentally
            event-based, not promise-based. For more details, see this{' '}
            <a
              href="https://github.com/hyochan/react-native-iap/issues/307#issuecomment-449208083"
              target="_blank"
              rel="noopener noreferrer"
            >
              issue comment
            </a>
            .
          </p>
          <p>
            The <code>request</code> prefix indicates that these are event
            requests - use the appropriate listeners to handle the actual
            results.
          </p>
        </blockquote>
      </section>
      <section>
        <AnchorLink id="connection-management" level="h2">
          Connection Management
        </AnchorLink>

        <AnchorLink id="init-connection" level="h3">
          initConnection
        </AnchorLink>
        <p>Initialize connection to the store service.</p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Function signature
initConnection(config?: InitConnectionConfig): Promise<boolean>

// InitConnectionConfig type
interface InitConnectionConfig {
  alternativeBillingModeAndroid?: 'user-choice' | 'alternative-only';
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Function signature
func initConnection() async throws -> Bool

// iOS uses standard StoreKit billing
// Alternative billing is Android-only`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Function signature
suspend fun initConnection(config: InitConnectionConfig? = null): Boolean

// InitConnectionConfig type
data class InitConnectionConfig(
    val alternativeBillingModeAndroid: AlternativeBillingModeAndroid? = null
)

enum class AlternativeBillingModeAndroid {
    UserChoice, AlternativeOnly
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Function signature
Future<bool> initConnection({InitConnectionConfig? config});

// InitConnectionConfig type
class InitConnectionConfig {
  final AlternativeBillingModeAndroid? alternativeBillingModeAndroid;
}

enum AlternativeBillingModeAndroid { userChoice, alternativeOnly }`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p>
          Establishes connection with the platform's billing service. Returns
          true if successful. Optionally accepts configuration for alternative
          billing on Android.
        </p>
        <p className="type-link">
          See:{' '}
          <Link to="/docs/types#init-connection-config">
            InitConnectionConfig
          </Link>
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Standard connection
await initConnection();

// Android with user choice billing
await initConnection({
  alternativeBillingModeAndroid: 'user-choice'
});

// Android with alternative billing only
await initConnection({
  alternativeBillingModeAndroid: 'alternative-only'
});`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Standard connection
try await OpenIapModule.shared.initConnection()

// iOS uses standard StoreKit billing
// Alternative billing is Android-only`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Standard connection
openIapStore.initConnection()

// With user choice billing
openIapStore.initConnection(
    InitConnectionConfig(
        alternativeBillingModeAndroid = AlternativeBillingModeAndroid.UserChoice
    )
)

// With alternative billing only
openIapStore.initConnection(
    InitConnectionConfig(
        alternativeBillingModeAndroid = AlternativeBillingModeAndroid.AlternativeOnly
    )
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Standard connection
await FlutterInappPurchase.instance.initConnection();

// With user choice billing
await FlutterInappPurchase.instance.initConnection(
  config: InitConnectionConfig(
    alternativeBillingModeAndroid: AlternativeBillingModeAndroid.userChoice,
  ),
);

// With alternative billing only
await FlutterInappPurchase.instance.initConnection(
  config: InitConnectionConfig(
    alternativeBillingModeAndroid: AlternativeBillingModeAndroid.alternativeOnly,
  ),
);`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="end-connection" level="h3">
          endConnection
        </AnchorLink>
        <p>End connection to the store service.</p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Function signature
endConnection(): Promise<boolean>`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Function signature
func endConnection() async throws -> Bool`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Function signature
suspend fun endConnection(): Boolean`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Function signature
Future<bool> endConnection();`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p>
          Closes the connection and cleans up resources. Returns true if
          successful.
        </p>
      </section>
      <section>
        <AnchorLink id="product-management" level="h2">
          Product Management
        </AnchorLink>

        <AnchorLink id="fetch-products" level="h3">
          fetchProducts
        </AnchorLink>
        <p>Retrieve products or subscriptions from the store.</p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Function signature
fetchProducts(params: ProductRequest): Promise<Product[] | SubscriptionProduct[]>

// ProductRequest type
interface ProductRequest {
  skus: string[];
  type?: 'in-app' | 'subs' | 'all';  // Defaults to 'in-app'
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Function signature
func fetchProducts(_ request: ProductRequest) async throws -> [Product]

// ProductRequest type
struct ProductRequest {
    let skus: [String]
    let type: ProductQueryType?  // .inApp, .subs, .all
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Function signature
suspend fun fetchProducts(request: ProductRequest): List<Product>

// ProductRequest type
data class ProductRequest(
    val skus: List<String>,
    val type: ProductQueryType = ProductQueryType.InApp  // InApp, Subs, All
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Function signature
Future<List<Product>> fetchProducts(ProductRequest request);

// ProductRequest type
class ProductRequest {
  final List<String> skus;
  final ProductQueryType? type;  // ProductQueryType.inApp, .subs, .all
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p className="type-link">
          See: <Link to="/docs/types#product">Product</Link>,{' '}
          <Link to="/docs/types#subscription-product">SubscriptionProduct</Link>
        </p>
        <p>
          Returns a future that completes with an array of products or
          subscriptions matching the provided SKUs. Use{' '}
          <code>type: "in-app"</code> for regular products only,{' '}
          <code>type: "subs"</code> for subscriptions only,{' '}
          <code>type: "all"</code> for both products and subscriptions, or omit
          the type parameter to fall back to the default <code>'in-app'</code>
          behavior.
        </p>

        <AnchorLink id="get-available-purchases" level="h3">
          getAvailablePurchases
        </AnchorLink>
        <p>Get all available purchases for the current user.</p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Function signature
getAvailablePurchases(options?: PurchaseOptions): Promise<Purchase[]>

// PurchaseOptions type
interface PurchaseOptions {
  alsoPublishToEventListenerIOS?: boolean;  // iOS only
  onlyIncludeActiveItemsIOS?: boolean;      // iOS only
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Function signature
func getAvailablePurchases(
    options: PurchaseOptions? = nil
) async throws -> [Purchase]

// PurchaseOptions type
struct PurchaseOptions {
    let alsoPublishToEventListener: Bool?
    let onlyIncludeActiveItems: Bool?
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Function signature
suspend fun getAvailablePurchases(): List<Purchase>

// Android doesn't support additional options`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Function signature
Future<List<Purchase>> getAvailablePurchases({
  PurchaseOptions? options,
});

// PurchaseOptions type
class PurchaseOptions {
  final bool? alsoPublishToEventListenerIOS;  // iOS only
  final bool? onlyIncludeActiveItemsIOS;      // iOS only
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p className="type-link">
          See: <Link to="/docs/types#purchase">Purchase</Link>
        </p>
        <p>
          Returns all purchases that haven't been properly finished/consumed:
        </p>
        <ul>
          <li>
            <strong>Consumables:</strong> Products not yet consumed (not yet
            called <code>finishTransaction</code> with isConsumable=true)
          </li>
          <li>
            <strong>Non-consumables:</strong> Products not yet finished (not yet
            called <code>finishTransaction</code>)
          </li>
          <li>
            <strong>Subscriptions:</strong> Currently active subscriptions
          </li>
        </ul>
        <p>
          <strong>Platform differences:</strong> On iOS, this includes purchase
          history. On Android with Google Play Billing v8+, only active
          purchases are returned.
        </p>
        <blockquote className="warning-note">
          <p>
            <strong>⚠️ Android limitation:</strong> For subscriptions with
            multiple base plans, the <code>currentPlanId</code> field may be
            inaccurate. See{' '}
            <a href="#android-baseplanid-limitation">basePlanId limitation</a>.
          </p>
        </blockquote>
      </section>

      <section>
        <AnchorLink id="purchase-operations" level="h2">
          Purchase Operations
        </AnchorLink>

        <AnchorLink id="request-purchase" level="h3">
          requestPurchase
        </AnchorLink>
        <p>Request a purchase for products or subscriptions.</p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Function signature
requestPurchase(props: RequestPurchaseProps): Promise<Purchase | Purchase[] | void>

// RequestPurchaseProps type (discriminated union)
type RequestPurchaseProps =
  | { params: RequestPurchasePropsByPlatforms; type: 'in-app' }
  | { params: RequestSubscriptionPropsByPlatforms; type: 'subs' }`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Function signature
func requestPurchase(_ props: RequestPurchaseProps) async throws -> Purchase?

// RequestPurchaseProps type
struct RequestPurchaseProps {
    let request: RequestPurchasePropsByPlatforms
    let type: ProductType  // .inApp or .subs
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Function signature
suspend fun requestPurchase(props: RequestPurchaseProps): List<Purchase>

// RequestPurchaseProps type
data class RequestPurchaseProps(
    val request: RequestPurchasePropsByPlatforms,
    val type: ProductType  // ProductType.InApp or ProductType.Subs
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Function signature
Future<Purchase?> requestPurchase(RequestPurchaseProps props);

// RequestPurchaseProps type
class RequestPurchaseProps {
  final RequestPurchasePropsByPlatforms request;
  final ProductType type;  // ProductType.inApp or ProductType.subs
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p className="type-link">
          See:{' '}
          <Link to="/docs/types#request-purchase-props">
            RequestPurchaseProps
          </Link>
          ,{' '}
          <Link to="/docs/types#request-purchase-props-by-platforms">
            RequestPurchasePropsByPlatforms
          </Link>
          ,{' '}
          <Link to="/docs/types#request-subscription-props-by-platforms">
            RequestSubscriptionPropsByPlatforms
          </Link>
          , <Link to="/docs/types#purchase">Purchase</Link>
        </p>
        <p>
          Initiates a purchase flow for any product type. Returns a Purchase
          object (iOS) or array (Android).
        </p>
        <blockquote className="info-note">
          <p>
            <strong>Note:</strong> Use the union shape to keep platforms in
            sync—<code>type: 'in-app'</code> pairs with
            <code>RequestPurchasePropsByPlatforms</code>, and
            <code>type: 'subs'</code> pairs with
            <code>RequestSubscriptionPropsByPlatforms</code>. This ensures both
            Google Play Billing and StoreKit receive the correct payloads.
          </p>
        </blockquote>

        <AnchorLink id="ios-external-purchase-links" level="h4">
          iOS External Purchase Links
        </AnchorLink>
        <p>
          iOS supports external purchase links via Apple&apos;s StoreKit{' '}
          <code>ExternalPurchase</code> API. This requires a 3-step flow for
          Apple compliance:
        </p>
        <ol>
          <li>Check if external purchase is available on the device</li>
          <li>Present Apple&apos;s required compliance notice sheet</li>
          <li>Open the external purchase URL</li>
        </ol>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import {
  canPresentExternalPurchaseNoticeIOS,
  presentExternalPurchaseNoticeSheetIOS,
  presentExternalPurchaseLinkIOS,
} from 'expo-iap';

// Step 1: Check availability
const canPresent = await canPresentExternalPurchaseNoticeIOS();
if (!canPresent) return;

// Step 2: Show Apple's notice sheet
const noticeResult = await presentExternalPurchaseNoticeSheetIOS();
if (noticeResult.result === 'dismissed') return;

// Step 3: Open external purchase link
const result = await presentExternalPurchaseLinkIOS(
  'https://your-payment-site.com/checkout'
);`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

// Step 1: Check availability
let canPresent = try await OpenIapModule.shared.canPresentExternalPurchaseNoticeIOS()
guard canPresent else { return }

// Step 2: Show Apple's notice sheet
let noticeResult = try await OpenIapModule.shared.presentExternalPurchaseNoticeSheetIOS()
guard noticeResult.result == .continue else { return }

// Step 3: Open external purchase link (iOS 18.2+)
let result = try await OpenIapModule.shared.presentExternalPurchaseLinkIOS(
    "https://your-payment-site.com/checkout"
)
if result.success {
    print("External purchase flow completed")
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.kmpIapInstance
import io.github.hyochan.kmpiap.ExternalPurchaseNoticeAction

// External purchase is iOS-only. For iOS targets in KMP:
// Step 1: Check availability
val canPresent = kmpIapInstance.canPresentExternalPurchaseNoticeIOS()
if (!canPresent) return

// Step 2: Show Apple's notice sheet
val noticeResult = kmpIapInstance.presentExternalPurchaseNoticeSheetIOS()
if (noticeResult.result == ExternalPurchaseNoticeAction.Dismissed) return

// Step 3: Open external purchase link
val result = kmpIapInstance.presentExternalPurchaseLinkIOS(
    "https://your-payment-site.com/checkout"
)

// For Android: Use alternative billing APIs instead`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final iap = FlutterInappPurchase.instance;

// Step 1: Check availability
final canPresent = await iap.canPresentExternalPurchaseNoticeIOS();
if (!canPresent) return;

// Step 2: Show Apple's notice sheet
final noticeResult = await iap.presentExternalPurchaseNoticeSheetIOS();
if (noticeResult.result == ExternalPurchaseNoticeAction.dismissed) return;

// Step 3: Open external purchase link
final result = await iap.presentExternalPurchaseLinkIOS(
  'https://your-payment-site.com/checkout',
);`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <blockquote className="info-note">
          <p>
            <strong>Requirements:</strong> iOS 15.4+ for notice sheet, iOS 18.2+
            for custom links. App must have StoreKit external purchase
            entitlement.
          </p>
        </blockquote>
        <blockquote className="info-note">
          <p>
            <strong>Important:</strong> External purchase links redirect users
            to an external website. No StoreKit transaction is created, and{' '}
            <code>purchaseUpdatedListener</code> will <strong>not</strong> be
            triggered. You are responsible for:
          </p>
          <ul>
            <li>
              Implementing deep links or universal links to return users to your
              app after purchase
            </li>
            <li>Verifying purchase completion on your server</li>
            <li>
              Granting entitlements to users (either directly or via StoreKit
              offer codes)
            </li>
          </ul>
        </blockquote>
        <p className="type-link">
          See:{' '}
          <Link to="/docs/types#external-purchase-link">
            External Purchase Types
          </Link>
        </p>

        <AnchorLink id="handling-resubscription" level="h4">
          Handling Resubscription (Cancelled Subscriptions)
        </AnchorLink>
        <p>
          When a user cancels their subscription, it remains active until the
          expiration date. During this period, the user can resubscribe.
          Starting from openiap-apple 1.2.34, the library automatically allows
          resubscription for cancelled subscriptions.
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Check if subscription is cancelled but still active
const subscriptions = await getActiveSubscriptions(['premium_monthly']);
const subscription = subscriptions[0];

if (subscription?.renewalInfoIOS?.willAutoRenew === false) {
  // Subscription is cancelled - user can resubscribe
  console.log('Subscription cancelled, showing resubscribe button');

  try {
    await requestPurchase({
      params: { ios: { sku: 'premium_monthly' } },
      type: 'subs'
    });
  } catch (error) {
    if (error.code === 'already-owned') {
      console.log('Subscription is already active and will renew');
    }
  }
} else if (subscription) {
  console.log('Subscription is active');
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Check if subscription is cancelled but still active
let subscriptions = try await OpenIapModule.shared.getActiveSubscriptions(
    subscriptionIds: ["premium_monthly"]
)

if let subscription = subscriptions.first {
    if subscription.renewalInfoIOS?.willAutoRenew == false {
        // Subscription is cancelled - user can resubscribe
        print("Subscription cancelled, showing resubscribe button")

        try await OpenIapModule.shared.requestPurchase(
            RequestPurchaseProps(
                request: RequestPurchasePropsByPlatforms(
                    ios: RequestPurchaseIosProps(sku: "premium_monthly")
                ),
                type: .subs
            )
        )
    } else {
        print("Subscription is active")
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Check if subscription is cancelled but still active
val subscriptions = openIapStore.getActiveSubscriptions(
    subscriptionIds = listOf("premium_monthly")
)

subscriptions.firstOrNull()?.let { subscription ->
    if (subscription.autoRenewingAndroid == false) {
        // Subscription is cancelled - user can resubscribe
        println("Subscription cancelled, showing resubscribe button")

        openIapStore.requestPurchase(
            RequestPurchaseProps(
                request = RequestPurchasePropsByPlatforms(
                    android = RequestPurchaseAndroidProps(
                        skus = listOf("premium_monthly")
                    )
                ),
                type = ProductType.Subs
            )
        )
    } else {
        println("Subscription is active")
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Check if subscription is cancelled but still active
final subscriptions = await FlutterInappPurchase.instance
    .getActiveSubscriptions(subscriptionIds: ['premium_monthly']);

final subscription = subscriptions.firstOrNull;

if (subscription?.renewalInfoIOS?.willAutoRenew == false) {
  // Subscription is cancelled - user can resubscribe
  print('Subscription cancelled, showing resubscribe button');

  await FlutterInappPurchase.instance.requestPurchase(
    RequestPurchaseProps(
      request: RequestPurchasePropsByPlatforms(
        ios: RequestPurchaseIosProps(sku: 'premium_monthly'),
        android: RequestPurchaseAndroidProps(skus: ['premium_monthly']),
      ),
      type: ProductType.subs,
    ),
  );
} else if (subscription != null) {
  print('Subscription is active');
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <blockquote className="info-note">
          <p>
            <strong>Behavior:</strong> The <code>already-owned</code> error is
            only thrown when a subscription is <strong>both</strong> active and
            will auto-renew. If a user has cancelled their subscription (
            <code>willAutoRenew = false</code>), they can resubscribe
            immediately without waiting for expiration.
          </p>
        </blockquote>

        <AnchorLink id="android-alternative-billing" level="h4">
          Android Alternative Billing
        </AnchorLink>
        <p>
          For Android alternative billing, see the{' '}
          <Link to="/docs/apis#check-alternative-billing-availability-android">
            Android Alternative Billing APIs
          </Link>{' '}
          section in Platform-Specific APIs. Android alternative billing
          requires a three-step flow and configuration during{' '}
          <Link to="/docs/apis#init-connection">
            <code>initConnection</code>
          </Link>
          .
        </p>

        <AnchorLink id="finish-transaction" level="h3">
          finishTransaction
        </AnchorLink>
        <p>
          Complete a purchase transaction. Must be called after successful
          purchase verification for ALL purchase types to properly finish the
          transaction and remove it from the queue.
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Function signature
finishTransaction(purchase: Purchase, isConsumable?: boolean): Promise<void>`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Function signature
func finishTransaction(_ purchase: Purchase) async throws`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Function signature
suspend fun finishTransaction(
    purchase: Purchase,
    isConsumable: Boolean = false
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Function signature
Future<void> finishTransaction(
  Purchase purchase, {
  bool isConsumable = false,
});`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p className="type-link">
          See: <Link to="/docs/types#purchase">Purchase</Link>
        </p>

        <h4>The isConsumable Flag</h4>
        <p>
          The <code>isConsumable</code> flag determines how the transaction is
          completed:
        </p>
        <ul>
          <li>
            <strong>Consumables (isConsumable=true)</strong>: Products that can
            be purchased multiple times (e.g., "20 credits", "100 coins").
            Setting this flag allows repurchase on Android.
          </li>
          <li>
            <strong>Non-consumables (isConsumable=false or omitted)</strong>:
            One-time purchases that provide permanent benefits (e.g., "remove
            ads", "premium features"). Cannot be purchased again.
          </li>
          <li>
            <strong>Subscriptions (isConsumable=false or omitted)</strong>:
            Auto-renewable subscriptions are managed by the platform. Never set
            isConsumable=true for subscriptions as it's logically incorrect and
            may cause issues on Android.
          </li>
        </ul>

        <p>
          <strong>Platform behavior:</strong>
        </p>
        <ul>
          <li>
            <strong>iOS</strong>: The flag doesn't affect behavior as StoreKit
            handles this automatically.
          </li>
          <li>
            <strong>Android</strong>:
            <ul>
              <li>
                When <code>isConsumable=true</code>: Calls{' '}
                <code>consumePurchaseAndroid()</code>
              </li>
              <li>
                When <code>isConsumable=false</code>: Calls{' '}
                <code>acknowledgePurchaseAndroid()</code>
              </li>
            </ul>
          </li>
        </ul>
        <p>
          <strong>Important</strong>: Always call this after validating the
          receipt to avoid losing track of purchases. Android purchases must be
          acknowledged within 3 days or they will be automatically refunded.
        </p>

        <h4>Typical Purchase Flow</h4>
        <ol>
          <li>
            User initiates purchase with <code>requestPurchase</code>
          </li>
          <li>
            Listen for purchase updates via <code>purchaseUpdatedListener</code>
          </li>
          <li>
            Verify the purchase with <code>verifyPurchase</code> (for ALL types)
          </li>
          <li>Grant entitlements to the user</li>
          <li>
            Call <code>finishTransaction</code> with appropriate{' '}
            <code>isConsumable</code> flag
          </li>
        </ol>

        <AnchorLink id="restore-purchases" level="h3">
          restorePurchases
        </AnchorLink>
        <p>Restore completed transactions (cross-platform behavior).</p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Function signature
restorePurchases(): Promise<void>`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Function signature
func restorePurchases() async throws`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Function signature
suspend fun restorePurchases()`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Function signature
Future<void> restorePurchases();`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p>
          iOS: performs a lightweight sync with <code>syncIOS()</code> to
          refresh transactions (sync errors are ignored), then calls{' '}
          <code>getAvailablePurchases()</code> to surface restored items.
        </p>
        <p>
          Android: directly calls <code>getAvailablePurchases()</code> (Google
          Play restoration happens via query).
        </p>
        <blockquote className="info-note">
          <p>
            Implementation note: this function leverages existing APIs (
            <code>syncIOS</code> and <code>getAvailablePurchases</code>) and is
            implemented in each framework library rather than as a separate
            native method.
          </p>
        </blockquote>

        <AnchorLink id="get-storefront" level="h3">
          getStorefront
        </AnchorLink>
        <p>Get storefront metadata for the active user.</p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Function signature
getStorefront(): Promise<string>`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Function signature
func getStorefront() async throws -> String`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Function signature
suspend fun getStorefront(): String`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Function signature
Future<String> getStorefront();`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p>
          Resolves with the ISO 3166-1 alpha-2 country code for the active
          storefront. Returns an empty string when the storefront cannot be
          determined.
        </p>
        <blockquote className="info-note">
          <p>
            iOS uses the active StoreKit storefront. Android queries Google Play
            Billing for the billing config and returns the same country code
            string, falling back to an empty value when the call fails.
          </p>
        </blockquote>
      </section>
      <section>
        <AnchorLink id="subscription-management" level="h2">
          Subscription Management
        </AnchorLink>

        <AnchorLink id="get-active-subscriptions" level="h3">
          getActiveSubscriptions
        </AnchorLink>
        <p>
          Get all active subscriptions with detailed information including
          renewal status.
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Function signature
getActiveSubscriptions(subscriptionIds?: string[]): Promise<ActiveSubscription[]>`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Function signature
func getActiveSubscriptions(
    subscriptionIds: [String]? = nil
) async throws -> [ActiveSubscription]`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Function signature
suspend fun getActiveSubscriptions(
    subscriptionIds: List<String>? = null
): List<ActiveSubscription>`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Function signature
Future<List<ActiveSubscription>> getActiveSubscriptions({
  List<String>? subscriptionIds,
});`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p className="type-link">
          See:{' '}
          <Link to="/docs/types#active-subscription">ActiveSubscription</Link>
        </p>
        <p>
          Returns a future that completes with an array of active subscriptions.
          If <code>subscriptionIds</code> is not provided, returns all active
          subscriptions. Platform-specific fields are populated based on the
          current platform.
        </p>

        <div className="alert-card alert-card--success">
          <p>
            <strong>✨ New in iOS:</strong> Each subscription now includes{' '}
            <code>renewalInfoIOS</code> with renewal status information:
          </p>
          <ul>
            <li>
              <code>willAutoRenew</code> — Whether subscription will auto-renew
            </li>
            <li>
              <code>pendingUpgradeProductId</code> — Product ID of pending
              upgrade/downgrade
            </li>
            <li>
              <code>renewalDate</code> — Next renewal date
            </li>
            <li>
              <code>expirationReason</code> — Why subscription expired (if
              cancelled)
            </li>
          </ul>
        </div>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Example: Detect subscription upgrades
const subscriptions = await getActiveSubscriptions();
for (const sub of subscriptions) {
  if (sub.renewalInfoIOS?.pendingUpgradeProductId) {
    console.log(\`Upgrading from \${sub.productId} to \${sub.renewalInfoIOS.pendingUpgradeProductId}\`);
  }

  if (sub.renewalInfoIOS?.willAutoRenew === false) {
    console.log(\`Subscription \${sub.productId} will not renew\`);
  }
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Example: Detect subscription upgrades
let subscriptions = try await OpenIapModule.shared.getActiveSubscriptions()
for sub in subscriptions {
    if let pendingUpgrade = sub.renewalInfoIOS?.pendingUpgradeProductId {
        print("Upgrading from \\(sub.productId) to \\(pendingUpgrade)")
    }

    if sub.renewalInfoIOS?.willAutoRenew == false {
        print("Subscription \\(sub.productId) will not renew")
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Example: Detect subscription upgrades
val subscriptions = openIapStore.getActiveSubscriptions()
for (sub in subscriptions) {
    // Android uses autoRenewingAndroid instead of renewalInfoIOS
    if (sub.autoRenewingAndroid == false) {
        println("Subscription \${sub.productId} will not renew")
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Example: Detect subscription upgrades
final subscriptions = await FlutterInappPurchase.instance.getActiveSubscriptions();
for (final sub in subscriptions) {
  if (sub.renewalInfoIOS?.pendingUpgradeProductId != null) {
    print('Upgrading from \${sub.productId} to \${sub.renewalInfoIOS!.pendingUpgradeProductId}');
  }

  if (sub.renewalInfoIOS?.willAutoRenew == false) {
    print('Subscription \${sub.productId} will not renew');
  }
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="has-active-subscriptions" level="h3">
          hasActiveSubscriptions
        </AnchorLink>
        <p>Check if the user has any active subscriptions.</p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Function signature
hasActiveSubscriptions(subscriptionIds?: string[]): Promise<boolean>`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Function signature
func hasActiveSubscriptions(
    subscriptionIds: [String]? = nil
) async throws -> Bool`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Function signature
suspend fun hasActiveSubscriptions(
    subscriptionIds: List<String>? = null
): Boolean`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Function signature
Future<bool> hasActiveSubscriptions({
  List<String>? subscriptionIds,
});`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p>
          Returns a future that completes with <code>true</code> if the user has
          at least one active subscription, <code>false</code> otherwise. If{' '}
          <code>subscriptionIds</code> is provided, only checks for those
          specific subscriptions.
        </p>

        <AnchorLink id="deep-link-to-subscriptions" level="h3">
          deepLinkToSubscriptions
        </AnchorLink>
        <p>Open native subscription management interface.</p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Function signature
deepLinkToSubscriptions(options: DeepLinkOptions): Promise<void>

// DeepLinkOptions type
interface DeepLinkOptions {
  skuAndroid?: string;         // Required on Android
  packageNameAndroid?: string; // Required on Android
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Function signature
func deepLinkToSubscriptions() async throws

// iOS opens Settings app subscription management`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Function signature
suspend fun deepLinkToSubscriptions(options: DeepLinkOptions)

// DeepLinkOptions type
data class DeepLinkOptions(
    val skuAndroid: String,         // Required
    val packageNameAndroid: String  // Required
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Function signature
Future<void> deepLinkToSubscriptions({
  String? skuAndroid,         // Required on Android
  String? packageNameAndroid, // Required on Android
});`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p>
          Opens the platform's native subscription management interface where
          users can view and manage their subscriptions.
        </p>
      </section>
      <section>
        <AnchorLink id="validation" level="h2">
          Validation
        </AnchorLink>

        <AnchorLink id="verify-purchase" level="h3">
          verifyPurchase
        </AnchorLink>
        <p>
          Verify a purchase with your server or platform providers.
          <strong>
            All purchase types (consumables, non-consumables, and subscriptions)
            should be validated before granting entitlements.
          </strong>
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Function signature
verifyPurchase(options: ReceiptValidationProps): Promise<ReceiptValidationResult>`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Function signature
func verifyPurchase(
    options: ReceiptValidationProps
) async throws -> ReceiptValidationResult`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Function signature
suspend fun verifyPurchase(
    options: ReceiptValidationProps
): ReceiptValidationResult`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Function signature
Future<ReceiptValidationResult> verifyPurchase(
  ReceiptValidationProps options,
);`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p className="type-link">
          See:{' '}
          <Link to="/docs/types#purchase-verification-types">
            ReceiptValidationProps
          </Link>
          ,{' '}
          <Link to="/docs/types#receipt-validation-result">
            ReceiptValidationResult
          </Link>
        </p>
        <p>Verifies purchases with the appropriate validation service.</p>
        <p>
          The legacy <code>validateReceipt</code> mutation remains available but
          is deprecated; migrate to <code>verifyPurchase</code> for future
          updates.
        </p>
        <p>
          On iOS this routes through the StoreKit-backed validation flow (the
          legacy <code>validateReceipt</code> and{' '}
          <code>validateReceiptIOS</code> endpoints are now deprecated). On
          Android, pass <code>androidOptions</code> with{' '}
          <code>packageName</code>, <code>productToken</code>,{' '}
          <code>accessToken</code>, and optional <code>isSub</code> so the SDK
          can validate against the Google Play developer API.
        </p>

        <AnchorLink id="verify-purchase-with-provider" level="h3">
          verifyPurchaseWithProvider
        </AnchorLink>
        <p>
          Verify a purchase using a specific provider like{' '}
          <a href="https://iapkit.com" target="_blank" rel="noopener noreferrer">
            IAPKit
          </a>
          . This method sends purchase data directly to the provider's API for
          server-side validation.
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Function signature
verifyPurchaseWithProvider(
  props: VerifyPurchaseWithProviderProps
): Promise<VerifyPurchaseWithProviderResult>

// Props
interface VerifyPurchaseWithProviderProps {
  provider: PurchaseVerificationProvider; // Currently: 'iapkit'
  iapkit?: RequestVerifyPurchaseWithIapkitProps;
}

interface RequestVerifyPurchaseWithIapkitProps {
  apiKey?: string;  // API key for Authorization header
  apple?: { jws: string };  // iOS: JWS token from purchase
  google?: { purchaseToken: string };  // Android: purchase token
}

// Result
interface VerifyPurchaseWithProviderResult {
  provider: PurchaseVerificationProvider;
  iapkit: RequestVerifyPurchaseWithIapkitResult[];
}

interface RequestVerifyPurchaseWithIapkitResult {
  isValid: boolean;  // Whether the purchase is valid
  state: IapkitPurchaseState;  // Purchase state
  store: IapkitStore;  // 'apple' | 'google'
}

// IapkitPurchaseState values:
// 'entitled' | 'pending-acknowledgment' | 'pending' | 'canceled' |
// 'expired' | 'ready-to-consume' | 'consumed' | 'unknown' | 'inauthentic'`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Function signature
func verifyPurchaseWithProvider(
    _ props: VerifyPurchaseWithProviderProps
) async throws -> VerifyPurchaseWithProviderResult

// Usage
let props = VerifyPurchaseWithProviderProps(
    iapkit: RequestVerifyPurchaseWithIapkitProps(
        apiKey: "your-iapkit-api-key",
        apple: RequestVerifyPurchaseWithIapkitAppleProps(
            jws: purchase.jwsRepresentationIOS ?? ""
        ),
        google: nil
    ),
    provider: .iapkit
)

let result = try await store.verifyPurchaseWithProvider(props)

for item in result.iapkit {
    if item.isValid && item.state == .entitled {
        // Grant entitlement
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Function signature
suspend fun verifyPurchaseWithProvider(
    props: VerifyPurchaseWithProviderProps
): VerifyPurchaseWithProviderResult

// Usage
val props = VerifyPurchaseWithProviderProps(
    iapkit = RequestVerifyPurchaseWithIapkitProps(
        apiKey = "your-iapkit-api-key",
        apple = null,
        google = RequestVerifyPurchaseWithIapkitGoogleProps(
            purchaseToken = purchase.purchaseToken
        )
    ),
    provider = PurchaseVerificationProvider.Iapkit
)

val result = module.verifyPurchaseWithProvider(props)

result.iapkit.forEach { item ->
    if (item.isValid && item.state == IapkitPurchaseState.Entitled) {
        // Grant entitlement
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Function signature
Future<VerifyPurchaseWithProviderResult> verifyPurchaseWithProvider(
  VerifyPurchaseWithProviderProps props,
);

// Usage
final props = VerifyPurchaseWithProviderProps(
  provider: PurchaseVerificationProvider.iapkit,
  iapkit: RequestVerifyPurchaseWithIapkitProps(
    apiKey: 'your-iapkit-api-key',
    apple: RequestVerifyPurchaseWithIapkitAppleProps(
      jws: purchase.jwsRepresentationIOS ?? '',
    ),
  ),
);

final result = await iap.verifyPurchaseWithProvider(props);

for (final item in result.iapkit) {
  if (item.isValid && item.state == IapkitPurchaseState.entitled) {
    // Grant entitlement
  }
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p className="type-link">
          See:{' '}
          <Link to="/docs/types#verify-purchase-with-provider-props">
            VerifyPurchaseWithProviderProps
          </Link>
          ,{' '}
          <Link to="/docs/types#verify-purchase-with-provider-result">
            VerifyPurchaseWithProviderResult
          </Link>
        </p>
        <p>
          <strong>IAPKit Purchase States:</strong>
        </p>
        <ul>
          <li>
            <code>entitled</code> - User is entitled to the product
          </li>
          <li>
            <code>pending-acknowledgment</code> - Purchase needs acknowledgment
            (Android)
          </li>
          <li>
            <code>pending</code> - Purchase is pending
          </li>
          <li>
            <code>canceled</code> - Purchase was canceled
          </li>
          <li>
            <code>expired</code> - Subscription has expired
          </li>
          <li>
            <code>ready-to-consume</code> - Consumable ready for consumption
          </li>
          <li>
            <code>consumed</code> - Consumable has been consumed
          </li>
          <li>
            <code>unknown</code> - Unknown state
          </li>
          <li>
            <code>inauthentic</code> - Purchase failed authenticity check
          </li>
        </ul>

        <AnchorLink id="purchase-identifier-usage" level="h3">
          Purchase Identifier Usage
        </AnchorLink>
        <p>
          After verifying purchases, use the appropriate identifiers for content
          delivery and purchase tracking:
        </p>

        <h4>iOS Identifiers</h4>
        <table className="identifier-table">
          <thead>
            <tr>
              <th>Product Type</th>
              <th>Primary Identifier</th>
              <th>Usage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Consumable</strong>
              </td>
              <td>
                <code>transactionId</code>
              </td>
              <td>Track each purchase individually for content delivery</td>
            </tr>
            <tr>
              <td>
                <strong>Non-consumable</strong>
              </td>
              <td>
                <code>transactionId</code>
              </td>
              <td>
                Single purchase tracking (equals{' '}
                <code>originalTransactionIdentifierIOS</code>)
              </td>
            </tr>
            <tr>
              <td>
                <strong>Subscription</strong>
              </td>
              <td>
                <code>originalTransactionIdentifierIOS</code>
              </td>
              <td>Track subscription ownership across renewals</td>
            </tr>
          </tbody>
        </table>

        <h4>Android Identifiers</h4>
        <table className="identifier-table">
          <thead>
            <tr>
              <th>Product Type</th>
              <th>Primary Identifier</th>
              <th>Usage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Consumable</strong>
              </td>
              <td>
                <code>purchaseToken</code>
              </td>
              <td>Track each purchase for content delivery</td>
            </tr>
            <tr>
              <td>
                <strong>Non-consumable</strong>
              </td>
              <td>
                <code>purchaseToken</code>
              </td>
              <td>Track ownership status</td>
            </tr>
            <tr>
              <td>
                <strong>Subscription</strong>
              </td>
              <td>
                <code>purchaseToken</code>
              </td>
              <td>
                Track current subscription status (each renewal has same token
                on Android)
              </td>
            </tr>
          </tbody>
        </table>

        <h4>Key Points</h4>
        <ul>
          <li>
            <strong>Idempotency</strong>: Use <code>transactionId</code> (iOS)
            or <code>purchaseToken</code> (Android) to prevent duplicate content
            delivery
          </li>
          <li>
            <strong>iOS Subscriptions</strong>: Each renewal creates a new{' '}
            <code>transactionId</code>, but{' '}
            <code>originalTransactionIdentifier</code> remains constant
          </li>
          <li>
            <strong>Android Subscriptions</strong>: The{' '}
            <code>purchaseToken</code> remains the same across normal renewals
          </li>
        </ul>
      </section>
      <section>
        <AnchorLink id="platform-specific-apis" level="h2">
          Platform-Specific APIs
        </AnchorLink>

        <PlatformTabs>
          {{
            ios: (
              <>
                <h3>iOS APIs</h3>

                <AnchorLink id="clear-transaction-ios" level="h4">
                  clearTransactionIOS
                </AnchorLink>
                <p>Clear pending transactions.</p>
                <CodeBlock language="swift">{`// Function signature
func clearTransactionIOS() async throws -> Bool`}</CodeBlock>
                <p>
                  Removes all pending transactions from the iOS payment queue.
                </p>

                <AnchorLink id="get-storefront-ios" level="h4">
                  getStorefrontIOS
                </AnchorLink>
                <p>
                  <strong>Deprecated.</strong> Use{' '}
                  <Link to="/docs/apis#get-storefront">
                    <code>getStorefront()</code>
                  </Link>{' '}
                  for cross-platform storefront data.
                </p>
                <CodeBlock language="swift">{`// Deprecated: Use getStorefront() instead
@available(*, deprecated, message: "Use getStorefront()")
func getStorefrontIOS() async throws -> String`}</CodeBlock>
                <p>
                  Returns the storefront country code (e.g., "US", "GB", "JP")
                  for the active App Store account.
                </p>
                <blockquote className="info-note">
                  <p>
                    This legacy helper will proxy to{' '}
                    <code>getStorefront()</code> where possible and will be
                    removed in a future release.
                  </p>
                </blockquote>

                <AnchorLink id="get-promoted-product-ios" level="h4">
                  getPromotedProductIOS
                </AnchorLink>
                <p>Get the currently promoted product (iOS 11+).</p>
                <CodeBlock language="swift">{`// Function signature (iOS 11+)
func getPromotedProductIOS() async throws -> Product?`}</CodeBlock>
                <p>
                  Returns the product that was promoted in the App Store, if
                  any. Requires iOS 11 or later.
                </p>

                <AnchorLink
                  id="request-purchase-on-promoted-product-ios"
                  level="h4"
                >
                  requestPurchaseOnPromotedProductIOS
                </AnchorLink>
                <p>Purchase a promoted product (iOS 11+).</p>
                <CodeBlock language="swift">{`// Function signature (iOS 11+)
func requestPurchaseOnPromotedProductIOS() async throws -> Bool`}</CodeBlock>
                <p>
                  Initiates a purchase for the promoted product. The product
                  must have been previously promoted via the App Store.
                </p>

                <AnchorLink id="get-pending-transactions-ios" level="h4">
                  getPendingTransactionsIOS
                </AnchorLink>
                <p>Retrieve all pending transactions in the StoreKit queue.</p>
                <CodeBlock language="swift">{`// Function signature
func getPendingTransactionsIOS() async throws -> [Purchase]`}</CodeBlock>
                <p>
                  Returns all transactions that are pending completion in the
                  StoreKit payment queue as <code>PurchaseIOS</code> objects.
                </p>

                <AnchorLink id="is-eligible-for-intro-offer-ios" level="h4">
                  isEligibleForIntroOfferIOS
                </AnchorLink>
                <p>
                  Check introductory offer eligibility for a subscription group.
                </p>
                <CodeBlock language="swift">{`// Function signature (iOS 12.2+)
func isEligibleForIntroOfferIOS(groupID: String) async throws -> Bool`}</CodeBlock>
                <p>
                  Returns true if the user is eligible for an introductory price
                  within the specified subscription group, false otherwise.
                  Requires iOS 12.2+.
                </p>

                <AnchorLink id="subscription-status-ios" level="h4">
                  subscriptionStatusIOS
                </AnchorLink>
                <p>Get subscription status (iOS 15+).</p>
                <CodeBlock language="swift">{`// Function signature (iOS 15+)
func subscriptionStatusIOS(sku: String) async throws -> [SubscriptionStatus]`}</CodeBlock>
                <p>
                  Returns detailed subscription status information using
                  StoreKit 2. Requires iOS 15+.
                </p>

                <AnchorLink id="current-entitlement-ios" level="h4">
                  currentEntitlementIOS
                </AnchorLink>
                <p>Get current StoreKit 2 entitlements (iOS 15+).</p>
                <CodeBlock language="swift">{`// Function signature (iOS 15+)
func currentEntitlementIOS(sku: String) async throws -> Purchase?`}</CodeBlock>
                <p>
                  Returns the active StoreKit 2 entitlement for the provided
                  product identifier. Requires iOS 15+.
                </p>

                <AnchorLink id="latest-transaction-ios" level="h4">
                  latestTransactionIOS
                </AnchorLink>
                <p>Get latest transaction for a product (iOS 15+).</p>
                <CodeBlock language="swift">{`// Function signature (iOS 15+)
func latestTransactionIOS(sku: String) async throws -> Purchase?`}</CodeBlock>
                <p>
                  Returns the most recent transaction for a specific product
                  using StoreKit 2. Requires iOS 15+.
                </p>

                <AnchorLink id="show-manage-subscriptions-ios" level="h4">
                  showManageSubscriptionsIOS
                </AnchorLink>
                <p>
                  Show subscription management UI and detect status changes (iOS
                  15+).
                </p>
                <CodeBlock language="swift">{`// Function signature (iOS 15+)
func showManageSubscriptionsIOS() async throws -> [Purchase]`}</CodeBlock>
                <p>
                  Opens the native subscription management interface and returns
                  an array of purchases for subscriptions whose auto-renewal
                  status changed. Each returned purchase includes transaction
                  details and renewal information. Returns an empty array if no
                  changes were made. Requires iOS 15+.
                </p>

                <AnchorLink id="begin-refund-request-ios" level="h4">
                  beginRefundRequestIOS
                </AnchorLink>
                <p>Initiate refund request (iOS 15+).</p>
                <CodeBlock language="swift">{`// Function signature (iOS 15+)
func beginRefundRequestIOS(sku: String) async throws -> String?`}</CodeBlock>
                <p>
                  Presents the refund request sheet for a specific product and
                  returns a string token when submission succeeds. Requires iOS
                  15+.
                </p>

                <AnchorLink id="is-transaction-verified-ios" level="h4">
                  isTransactionVerifiedIOS
                </AnchorLink>
                <p>Verify a StoreKit 2 transaction signature.</p>
                <CodeBlock language="swift">{`// Function signature (iOS 15+)
func isTransactionVerifiedIOS(sku: String) async throws -> Bool`}</CodeBlock>
                <p>
                  Verifies the transaction signature using StoreKit 2. Returns
                  true if valid, false otherwise. Requires iOS 15+.
                </p>

                <AnchorLink id="get-transaction-jws-ios" level="h4">
                  getTransactionJwsIOS
                </AnchorLink>
                <p>Get the transaction JWS (StoreKit 2).</p>
                <CodeBlock language="swift">{`// Function signature (iOS 15+)
func getTransactionJwsIOS(sku: String) async throws -> String?`}</CodeBlock>
                <p>
                  Returns the JSON Web Signature for a product's transaction.
                  Use this token for server-side validation. Requires iOS 15+.
                </p>

                <AnchorLink id="get-receipt-data-ios" level="h4">
                  getReceiptDataIOS
                </AnchorLink>
                <p>Get base64-encoded receipt data for validation.</p>
                <CodeBlock language="swift">{`// Function signature
func getReceiptDataIOS() async throws -> String?`}</CodeBlock>
                <p>
                  Returns the base64-encoded receipt data for server validation.
                  When no receipt exists, returns <code>null</code>.
                </p>

                <AnchorLink id="sync-ios" level="h4">
                  syncIOS
                </AnchorLink>
                <p>Force a StoreKit sync for transactions (iOS 15+).</p>
                <CodeBlock language="swift">{`// Function signature (iOS 15+)
func syncIOS() async throws -> Bool`}</CodeBlock>
                <p>
                  Forces a sync with StoreKit to ensure all transactions are up
                  to date. Requires iOS 15+.
                </p>

                <AnchorLink id="present-code-redemption-sheet-ios" level="h4">
                  presentCodeRedemptionSheetIOS
                </AnchorLink>
                <p>Present the App Store code redemption sheet.</p>
                <CodeBlock language="swift">{`// Function signature
func presentCodeRedemptionSheetIOS() async throws -> Bool`}</CodeBlock>
                <p>Presents the sheet for redeeming App Store promo codes.</p>

                <AnchorLink id="get-app-transaction-ios" level="h4">
                  getAppTransactionIOS
                </AnchorLink>
                <p>Fetch the current app transaction (iOS 16+).</p>
                <CodeBlock language="swift">{`// Function signature (iOS 16+)
func getAppTransactionIOS() async throws -> AppTransaction?

// AppTransaction type
struct AppTransaction {
    let bundleId: String
    let appVersion: String
    let originalAppVersion: String
    let originalPurchaseDate: Date
    let deviceVerification: String
    let deviceVerificationNonce: String
    let environment: String  // "Sandbox" | "Production"
    let signedDate: Date
    let appId: Int
    let appVersionId: Int
    let preorderDate: Date?
    // iOS 18.4+ properties
    let appTransactionId: String?  // Requires iOS 18.4+
    let originalPlatform: String?  // Requires iOS 18.4+
}`}</CodeBlock>
                <p>
                  Returns information about the app's original purchase or
                  download. This includes details about when the app was first
                  installed, the version, and verification data. Requires iOS
                  16+. Additional properties are available on iOS 18.4+ when
                  built with Xcode 16.4+.
                </p>

                <AnchorLink
                  id="can-present-external-purchase-notice-ios"
                  level="h4"
                >
                  canPresentExternalPurchaseNoticeIOS
                </AnchorLink>
                <p>
                  Check if external purchase notice sheet can be presented (iOS
                  17.4+).
                </p>
                <CodeBlock language="swift">{`// Function signature (iOS 17.4+)
func canPresentExternalPurchaseNoticeIOS() async throws -> Bool`}</CodeBlock>
                <p>
                  Returns true if the device supports external purchase and the
                  notice sheet can be presented. Use this before calling{' '}
                  <code>presentExternalPurchaseNoticeSheetIOS</code>.
                </p>

                <AnchorLink
                  id="present-external-purchase-notice-sheet-ios"
                  level="h4"
                >
                  presentExternalPurchaseNoticeSheetIOS
                </AnchorLink>
                <p>Present Apple&apos;s compliance notice sheet (iOS 15.4+).</p>
                <CodeBlock language="swift">{`// Function signature (iOS 15.4+)
func presentExternalPurchaseNoticeSheetIOS() async throws -> ExternalPurchaseNoticeResultIOS

// Result type
struct ExternalPurchaseNoticeResultIOS {
    let error: String?
    let result: ExternalPurchaseNoticeAction  // .continue or .dismissed
}`}</CodeBlock>
                <p>
                  Presents Apple&apos;s required disclosure sheet before
                  external purchase. Returns the user&apos;s action (continue or
                  dismissed). Must be called before{' '}
                  <code>presentExternalPurchaseLinkIOS</code>.
                </p>

                <AnchorLink id="present-external-purchase-link-ios" level="h4">
                  presentExternalPurchaseLinkIOS
                </AnchorLink>
                <p>Open external purchase URL in Safari (iOS 18.2+).</p>
                <CodeBlock language="swift">{`// Function signature (iOS 18.2+)
func presentExternalPurchaseLinkIOS(_ url: String) async throws -> ExternalPurchaseLinkResultIOS

// Result type
struct ExternalPurchaseLinkResultIOS {
    let error: String?
    let success: Bool
}`}</CodeBlock>
                <p>
                  Opens the external purchase URL in Safari after the user
                  accepts the notice sheet. Returns success status. Requires iOS
                  18.2+.
                </p>
                <p className="type-link">
                  See:{' '}
                  <Link to="/docs/types#external-purchase-link">
                    External Purchase Types
                  </Link>
                </p>

                <AnchorLink id="validate-receipt-ios" level="h4">
                  validateReceiptIOS
                </AnchorLink>
                <p>
                  <strong>Deprecated:</strong> Use <code>verifyPurchase</code>{' '}
                  instead for both platforms.
                </p>
                <CodeBlock language="swift">{`// Deprecated: Use verifyPurchase() instead
@available(*, deprecated, message: "Use verifyPurchase()")
func validateReceiptIOS(
    options: ReceiptValidationProps
) async throws -> ReceiptValidationResult`}</CodeBlock>
                <p>
                  Validates a receipt payload against the App Store using the
                  provided validation options. Returns the parsed validation
                  result for the product. Requires server credentials matching
                  the configured environment.
                </p>
              </>
            ),
            android: (
              <>
                <h3>Android APIs</h3>

                <AnchorLink id="acknowledge-purchase-android" level="h4">
                  acknowledgePurchaseAndroid
                </AnchorLink>
                <p>Acknowledge a non-consumable purchase or subscription.</p>
                <CodeBlock language="kotlin">{`// Function signature
suspend fun acknowledgePurchase(purchaseToken: String): Boolean`}</CodeBlock>
                <p>
                  Acknowledges the purchase to Google Play. Required within 3
                  days or the purchase will be refunded. Returns
                  <code>true</code> when the acknowledgment succeeds.
                </p>
                <p>
                  <strong>Note:</strong> This is called automatically by{' '}
                  <Link to="/docs/apis#finish-transaction">
                    <code>finishTransaction()</code>
                  </Link>{' '}
                  when <code>isConsumable</code> is <code>false</code>.
                </p>

                <AnchorLink id="consume-purchase-android" level="h4">
                  consumePurchaseAndroid
                </AnchorLink>
                <p>Consume a purchase (for consumable products only).</p>
                <CodeBlock language="kotlin">{`// Function signature
suspend fun consumePurchase(purchaseToken: String): Boolean`}</CodeBlock>
                <p>
                  Marks a consumable product as consumed, allowing repurchase.
                  Automatically acknowledges the purchase. Returns
                  <code>true</code> when the consume request is accepted.
                </p>
                <p>
                  <strong>Note:</strong> This is called automatically by{' '}
                  <Link to="/docs/apis#finish-transaction">
                    <code>finishTransaction()</code>
                  </Link>{' '}
                  when <code>isConsumable</code> is <code>true</code>.
                </p>

                <h3>Android Alternative Billing APIs</h3>
                <p>
                  Three-step flow for implementing alternative billing on
                  Android. These APIs work with Google Play Billing Library
                  6.2+.
                </p>

                <AnchorLink
                  id="check-alternative-billing-availability-android"
                  level="h4"
                >
                  checkAlternativeBillingAvailabilityAndroid
                </AnchorLink>
                <p>
                  Check if alternative billing is available for this
                  user/device. This is <strong>Step 1</strong> of the
                  alternative billing flow.
                </p>
                <CodeBlock language="kotlin">{`// Function signature (Step 1 of alternative billing flow)
// Returns true if available, false otherwise
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun checkAlternativeBillingAvailability(): Boolean`}</CodeBlock>
                <p>
                  Returns <code>true</code> if alternative billing is available,{' '}
                  <code>false</code> otherwise. Throws{' '}
                  <code>OpenIapError.NotPrepared</code> if the billing client is
                  not ready.
                </p>

                <AnchorLink
                  id="show-alternative-billing-dialog-android"
                  level="h4"
                >
                  showAlternativeBillingDialogAndroid
                </AnchorLink>
                <p>
                  Show alternative billing information dialog to the user. This
                  is <strong>Step 2</strong> of the alternative billing flow and
                  must be called <strong>before</strong> processing payment in
                  your payment system.
                </p>
                <CodeBlock language="kotlin">{`// Function signature (Step 2 of alternative billing flow)
// Must be called BEFORE processing payment in your payment system
// Returns true if user accepted, false if user canceled
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun showAlternativeBillingDialog(): Boolean`}</CodeBlock>
                <p>
                  Returns <code>true</code> if the user accepted,{' '}
                  <code>false</code> if the user canceled. Throws{' '}
                  <code>OpenIapError.NotPrepared</code> if the billing client is
                  not ready.
                </p>

                <AnchorLink
                  id="create-alternative-billing-token-android"
                  level="h4"
                >
                  createAlternativeBillingTokenAndroid
                </AnchorLink>
                <p>
                  Create external transaction token for Google Play reporting.
                  This is <strong>Step 3</strong> of the alternative billing
                  flow and must be called <strong>after</strong> successful
                  payment in your payment system.
                </p>
                <CodeBlock language="kotlin">{`// Function signature (Step 3 of alternative billing flow)
// Must be called AFTER successful payment in your payment system
// Token must be reported to Google Play backend within 24 hours
// Returns token string, or null if creation failed
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun createAlternativeBillingToken(): String?`}</CodeBlock>
                <p>
                  Returns a token string that must be reported to Google Play
                  backend within 24 hours, or <code>null</code> if creation
                  failed. Throws <code>OpenIapError.NotPrepared</code> if the
                  billing client is not ready.
                </p>

                <h4>Alternative Billing Flow Example</h4>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`// Step 1: Check availability
const isAvailable = await checkAlternativeBillingAvailabilityAndroid();
if (!isAvailable) {
  // Fall back to standard billing
  return;
}

// Step 2: Show dialog to user
const userAccepted = await showAlternativeBillingDialogAndroid();
if (!userAccepted) {
  // User canceled
  return;
}

// Process payment in your payment system
const paymentSuccess = await processPaymentInYourSystem();

if (paymentSuccess) {
  // Step 3: Create token and report to Google Play
  const token = await createAlternativeBillingTokenAndroid();

  if (token) {
    // Report token to Google Play backend within 24 hours
    await reportTokenToGooglePlay(token);
  }
}`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`// Step 1: Check availability
val isAvailable = openIapStore.checkAlternativeBillingAvailability()
if (!isAvailable) {
    // Fall back to standard billing
    return
}

// Step 2: Show dialog to user
val userAccepted = openIapStore.showAlternativeBillingDialog()
if (!userAccepted) {
    // User canceled
    return
}

// Process payment in your payment system
val paymentSuccess = processPaymentInYourSystem()

if (paymentSuccess) {
    // Step 3: Create token and report to Google Play
    val token = openIapStore.createAlternativeBillingToken()

    token?.let {
        // Report token to Google Play backend within 24 hours
        reportTokenToGooglePlay(it)
    }
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`// Step 1: Check availability
final isAvailable = await FlutterInappPurchase.instance
    .checkAlternativeBillingAvailabilityAndroid();
if (!isAvailable) {
  // Fall back to standard billing
  return;
}

// Step 2: Show dialog to user
final userAccepted = await FlutterInappPurchase.instance
    .showAlternativeBillingDialogAndroid();
if (!userAccepted) {
  // User canceled
  return;
}

// Process payment in your payment system
final paymentSuccess = await processPaymentInYourSystem();

if (paymentSuccess) {
  // Step 3: Create token and report to Google Play
  final token = await FlutterInappPurchase.instance
      .createAlternativeBillingTokenAndroid();

  if (token != null) {
    // Report token to Google Play backend within 24 hours
    await reportTokenToGooglePlay(token);
  }
}`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="debugging-logging" level="h2">
          Debugging & Logging
        </AnchorLink>
        <p>
          Enable verbose logging to see internal operations, warnings, and debug
          information. This is especially useful during development to diagnose
          issues and understand library behavior.
        </p>

        <AnchorLink id="enable-logging" level="h3">
          Enable Logging
        </AnchorLink>
        <p>
          Logging is <strong>disabled by default</strong> in production. Enable
          it only during development to see detailed logs.
        </p>

        <PlatformTabs>
          {{
            ios: (
              <CodeBlock language="swift">{`// Enable logging for debug builds only
#if DEBUG
OpenIapLog.enable(true)
#endif

// Or enable unconditionally
OpenIapLog.enable(true)

// Disable logging
OpenIapLog.enable(false)`}</CodeBlock>
            ),
            android: (
              <CodeBlock language="kotlin">{`// Enable logging for debug builds only
if (BuildConfig.DEBUG) {
    OpenIapLog.enable(true)
}

// Or enable unconditionally
OpenIapLog.enable(true)

// Disable logging
OpenIapLog.enable(false)`}</CodeBlock>
            ),
          }}
        </PlatformTabs>

        <AnchorLink id="common-warnings" level="h3">
          Common Warnings
        </AnchorLink>
        <p>
          When logging is enabled, you may see warnings about specific
          scenarios:
        </p>

        <h4 id="android-baseplanid-limitation">
          Android basePlanId Limitation (Important)
        </h4>
        <blockquote className="warning-note">
          <p>
            <strong>⚠️ Critical Limitation:</strong> On Android, the{' '}
            <code>currentPlanId</code> and <code>basePlanIdAndroid</code> fields
            may return incorrect values for subscription groups with multiple
            base plans.
          </p>
        </blockquote>

        <p>
          <strong>Root Cause:</strong> Google Play Billing API's{' '}
          <code>Purchase</code> object does NOT include <code>basePlanId</code>{' '}
          information. When a subscription group has multiple base plans
          (weekly, monthly, yearly), there is no way to determine which specific
          plan was purchased from the client-side <code>Purchase</code> object.
        </p>

        <blockquote className="info-note">
          <p>
            <strong>Warning log you may see:</strong>{' '}
            <code>
              Multiple offers (3) found for premium_subscription, using first
              basePlanId (may be inaccurate)
            </code>
          </p>
        </blockquote>

        <p>
          <strong>What works correctly:</strong>
        </p>
        <ul>
          <li>
            <code>productId</code> - Subscription group ID ✅
          </li>
          <li>
            <code>purchaseToken</code> - Purchase token ✅
          </li>
          <li>
            <code>isActive</code> - Subscription active status ✅
          </li>
          <li>
            <code>transactionId</code> - Transaction ID ✅
          </li>
        </ul>

        <p>
          <strong>What may be incorrect:</strong>
        </p>
        <ul>
          <li>
            <code>currentPlanId</code> / <code>basePlanIdAndroid</code> - May
            return first plan instead of purchased plan ❌
          </li>
        </ul>

        <p>
          <strong>Solutions:</strong>
        </p>

        <p>
          <strong>1. Client-side tracking (Recommended for most apps):</strong>
        </p>
        <CodeBlock language="typescript">{`// Track basePlanId yourself during the purchase flow

// 1. Store basePlanId BEFORE calling requestPurchase
let purchasedBasePlanId: string | null = null;

const handlePurchase = async (basePlanId: string) => {
  const offers = product.subscriptionOfferDetailsAndroid ?? [];
  const offer = offers.find(o => o.basePlanId === basePlanId && !o.offerId);

  // Store it before purchase
  purchasedBasePlanId = basePlanId;

  await requestPurchase({
    android: {
      skus: [subscriptionGroupId],
      subscriptionOffers: [{ sku: subscriptionGroupId, offerToken: offer.offerToken }],
    },
    type: 'subs',
  });
};

// 2. Use YOUR tracked value in onPurchaseSuccess
onPurchaseSuccess: async (purchase) => {
  // DON'T rely on purchase.currentPlanId - it may be wrong!
  const actualBasePlanId = purchasedBasePlanId;

  // Save to your backend
  await saveToBackend({
    purchaseToken: purchase.purchaseToken,
    basePlanId: actualBasePlanId,  // Use YOUR tracked value
    productId: purchase.productId,
  });
}

// 3. For getActiveSubscriptions after app restart,
//    use your server data instead of relying on currentPlanId`}</CodeBlock>

        <p>
          <strong>2. Backend Validation (Recommended for production):</strong>
        </p>
        <CodeBlock language="kotlin">{`// Use Google Play Developer API for accurate basePlanId
// GET https://androidpublisher.googleapis.com/androidpublisher/v3/
//     applications/{packageName}/purchases/subscriptionsv2/tokens/{token}
//
// Response includes:
// {
//   "lineItems": [{
//     "offerDetails": {
//       "basePlanId": "premium-annual",  // Accurate!
//       "offerId": "intro-offer"
//     }
//   }]
// }`}</CodeBlock>

        <p>
          <strong>3. Single base plan per subscription group:</strong>
        </p>
        <p>
          If your subscription group has only one base plan, the{' '}
          <code>basePlanId</code> will always be accurate. This is the simplest
          solution if your product design allows it.
        </p>

        <blockquote className="info-note">
          <p>
            <strong>Note:</strong> This is a fundamental limitation of Google
            Play Billing API, not a bug in this library. The{' '}
            <code>Purchase</code> object from Google simply does not include{' '}
            <code>basePlanId</code> information.
          </p>
        </blockquote>
      </section>
    </div>
  );
}

export default APIs;
