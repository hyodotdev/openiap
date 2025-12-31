import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function TypesIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="iOS Types"
        description="OpenIAP iOS-specific type definitions - DiscountOffer, SubscriptionStatusIOS, PaymentMode, AppTransaction for TypeScript, Swift, Kotlin, Dart."
        path="/docs/types/ios"
        keywords="IAP types, DiscountOffer, SubscriptionStatusIOS, PaymentMode, AppTransaction, iOS, StoreKit 2"
      />
      <h1>iOS Types</h1>
      <p>
        Type definitions specific to iOS/StoreKit 2 for discounts, offers,
        subscription status, and app transactions.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <a href="#discount-offer"><strong>Discounts</strong></a>: DiscountOffer (for purchasing), Discount
            (product info)
          </li>
          <li>
            <a href="#subscription-status-ios"><strong>Subscription</strong></a>: SubscriptionStatusIOS,
            SubscriptionPeriodIOS, PaymentMode
          </li>
          <li>
            <a href="#app-transaction"><code>AppTransaction</code></a> - App purchase/installation metadata
          </li>
        </ul>
      </TLDRBox>

      <section>
        <AnchorLink id="discount-offer" level="h2">
          DiscountOffer
        </AnchorLink>
        <p>
          Used when requesting a purchase with a promotional offer. Generate
          signature server-side.
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
                <code>identifier</code>
              </td>
              <td>Discount identifier from App Store Connect</td>
            </tr>
            <tr>
              <td>
                <code>keyIdentifier</code>
              </td>
              <td>Key ID for signature validation</td>
            </tr>
            <tr>
              <td>
                <code>nonce</code>
              </td>
              <td>Cryptographic nonce (UUID)</td>
            </tr>
            <tr>
              <td>
                <code>signature</code>
              </td>
              <td>Server-generated signature</td>
            </tr>
            <tr>
              <td>
                <code>timestamp</code>
              </td>
              <td>Timestamp when signature was generated</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="discount" level="h2">
          Discount
        </AnchorLink>
        <p>Discount info returned as part of product details:</p>
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
                <code>identifier</code>
              </td>
              <td>Discount identifier</td>
            </tr>
            <tr>
              <td>
                <code>type</code>
              </td>
              <td>Discount type (introductory, promotional)</td>
            </tr>
            <tr>
              <td>
                <code>numberOfPeriods</code>
              </td>
              <td>Number of billing periods</td>
            </tr>
            <tr>
              <td>
                <code>price</code>
              </td>
              <td>Formatted price string</td>
            </tr>
            <tr>
              <td>
                <code>priceAmount</code>
              </td>
              <td>Numeric price value</td>
            </tr>
            <tr>
              <td>
                <code>paymentMode</code>
              </td>
              <td>Payment mode (FreeTrial, PayAsYouGo, PayUpFront)</td>
            </tr>
            <tr>
              <td>
                <code>subscriptionPeriod</code>
              </td>
              <td>Period duration string</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="subscription-period-ios" level="h2">
          SubscriptionPeriodIOS
        </AnchorLink>
        <p>Subscription period units:</p>
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
                <code>Day</code>, <code>Week</code>, <code>Month</code>,{' '}
                <code>Year</code>
              </td>
              <td>Available subscription period units</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="payment-mode" level="h2">
          PaymentMode
        </AnchorLink>
        <p>Payment mode for offers:</p>
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
                <code>FreeTrial</code>
              </td>
              <td>Free trial period</td>
            </tr>
            <tr>
              <td>
                <code>PayAsYouGo</code>
              </td>
              <td>Pay each period at reduced price</td>
            </tr>
            <tr>
              <td>
                <code>PayUpFront</code>
              </td>
              <td>Pay full amount upfront</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="subscription-status-ios" level="h2">
          SubscriptionStatusIOS
        </AnchorLink>
        <p>
          Subscription status from StoreKit 2. Use{' '}
          <code>subscriptionStatusIOS(sku)</code> to get detailed subscription
          state.
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
                <code>state</code>
              </td>
              <td>Current renewal state (see values below)</td>
            </tr>
            <tr>
              <td>
                <code>renewalInfo</code>
              </td>
              <td>
                Renewal details. Contains: <code>willAutoRenew</code>,{' '}
                <code>autoRenewPreference</code>
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="subscription-state-values" level="h3">
          Subscription State Values
        </AnchorLink>
        <p>
          The <code>state</code> field indicates the current subscription
          status:
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>State</th>
              <th>Description</th>
              <th>User Access</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>subscribed</code>
              </td>
              <td>Active subscription</td>
              <td>Grant access</td>
            </tr>
            <tr>
              <td>
                <code>expired</code>
              </td>
              <td>Subscription has expired</td>
              <td>Deny access</td>
            </tr>
            <tr>
              <td>
                <code>revoked</code>
              </td>
              <td>Refunded by Apple</td>
              <td>Deny access</td>
            </tr>
            <tr>
              <td>
                <code>inGracePeriod</code>
              </td>
              <td>Billing failed but grace period active</td>
              <td>Grant access (temporary)</td>
            </tr>
            <tr>
              <td>
                <code>inBillingRetryPeriod</code>
              </td>
              <td>Billing retry in progress</td>
              <td>Consider granting access</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="expiration-reasons" level="h3">
          iOS Expiration Reasons
        </AnchorLink>
        <p>
          When <code>willAutoRenew</code> is <code>false</code>, the{' '}
          <code>expirationReason</code> field in <code>renewalInfo</code>{' '}
          indicates why:
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Reason</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>VOLUNTARY</code>
              </td>
              <td>User cancelled the subscription</td>
            </tr>
            <tr>
              <td>
                <code>BILLING_ERROR</code>
              </td>
              <td>Payment failed (card declined, etc.)</td>
            </tr>
            <tr>
              <td>
                <code>DID_NOT_AGREE_TO_PRICE_INCREASE</code>
              </td>
              <td>User declined a price increase</td>
            </tr>
            <tr>
              <td>
                <code>PRODUCT_NOT_AVAILABLE</code>
              </td>
              <td>Product no longer available for purchase</td>
            </tr>
            <tr>
              <td>
                <code>UNKNOWN</code>
              </td>
              <td>Unknown reason</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="app-transaction" level="h2">
          AppTransaction
        </AnchorLink>
        <p>
          Represents the app transaction information returned by{' '}
          <code>getAppTransactionIOS()</code>. Contains metadata about the
          app&apos;s purchase and installation.
        </p>

        <AnchorLink id="app-transaction-fields" level="h3">
          Fields
        </AnchorLink>
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
                <code>bundleId</code>
              </td>
              <td>App bundle identifier</td>
            </tr>
            <tr>
              <td>
                <code>appVersion</code>
              </td>
              <td>Current app version</td>
            </tr>
            <tr>
              <td>
                <code>originalAppVersion</code>
              </td>
              <td>Version when user originally purchased/downloaded</td>
            </tr>
            <tr>
              <td>
                <code>originalPurchaseDate</code>
              </td>
              <td>Original purchase timestamp</td>
            </tr>
            <tr>
              <td>
                <code>deviceVerification</code>
              </td>
              <td>Device verification data</td>
            </tr>
            <tr>
              <td>
                <code>deviceVerificationNonce</code>
              </td>
              <td>Nonce for device verification</td>
            </tr>
            <tr>
              <td>
                <code>environment</code>
              </td>
              <td>
                Environment: &quot;Sandbox&quot; or &quot;Production&quot;
              </td>
            </tr>
            <tr>
              <td>
                <code>signedDate</code>
              </td>
              <td>Date when the transaction was signed</td>
            </tr>
            <tr>
              <td>
                <code>appId</code>
              </td>
              <td>App ID number</td>
            </tr>
            <tr>
              <td>
                <code>appVersionId</code>
              </td>
              <td>App version ID number</td>
            </tr>
            <tr>
              <td>
                <code>preorderDate</code>
              </td>
              <td>Preorder date (optional)</td>
            </tr>
            <tr>
              <td>
                <code>appTransactionId</code>
              </td>
              <td>App transaction ID (iOS 18.4+)</td>
            </tr>
            <tr>
              <td>
                <code>originalPlatform</code>
              </td>
              <td>Original platform (iOS 18.4+)</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="app-transaction-type-definition" level="h3">
          Type Definition
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`interface AppTransaction {
  bundleId: string;
  appVersion: string;
  originalAppVersion: string;
  originalPurchaseDate: number;  // epoch ms
  deviceVerification: string;
  deviceVerificationNonce: string;
  environment: 'Sandbox' | 'Production';
  signedDate: number;  // epoch ms
  appId: number;
  appVersionId: number;
  preorderDate?: number;  // epoch ms
  // iOS 18.4+ properties
  appTransactionId?: string;
  originalPlatform?: string;
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`struct AppTransaction {
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
    let appTransactionId: String?
    let originalPlatform: String?
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`data class AppTransaction(
    val bundleId: String,
    val appVersion: String,
    val originalAppVersion: String,
    val originalPurchaseDate: Long,  // epoch ms
    val deviceVerification: String,
    val deviceVerificationNonce: String,
    val environment: String,  // "Sandbox" | "Production"
    val signedDate: Long,  // epoch ms
    val appId: Long,
    val appVersionId: Long,
    val preorderDate: Long? = null,
    // iOS 18.4+ properties
    val appTransactionId: String? = null,
    val originalPlatform: String? = null
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`class AppTransaction {
  final String bundleId;
  final String appVersion;
  final String originalAppVersion;
  final int originalPurchaseDate;  // epoch ms
  final String deviceVerification;
  final String deviceVerificationNonce;
  final String environment;  // "Sandbox" | "Production"
  final int signedDate;  // epoch ms
  final int appId;
  final int appVersionId;
  final int? preorderDate;
  // iOS 18.4+ properties
  final String? appTransactionId;
  final String? originalPlatform;

  AppTransaction({
    required this.bundleId,
    required this.appVersion,
    required this.originalAppVersion,
    required this.originalPurchaseDate,
    required this.deviceVerification,
    required this.deviceVerificationNonce,
    required this.environment,
    required this.signedDate,
    required this.appId,
    required this.appVersionId,
    this.preorderDate,
    this.appTransactionId,
    this.originalPlatform,
  });
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`class_name AppTransaction

var bundle_id: String
var app_version: String
var original_app_version: String
var original_purchase_date: int  # epoch ms
var device_verification: String
var device_verification_nonce: String
var environment: String  # "Sandbox" | "Production"
var signed_date: int  # epoch ms
var app_id: int
var app_version_id: int
var preorder_date: int  # optional, epoch ms
# iOS 18.4+ properties
var app_transaction_id: String  # optional
var original_platform: String  # optional`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="app-transaction-example" level="h3">
          Usage Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { getAppTransactionIOS } from 'expo-iap';

// Get app transaction (iOS only)
const appTransaction = await getAppTransactionIOS();

if (appTransaction) {
  console.log('Bundle ID:', appTransaction.bundleId);
  console.log('Original version:', appTransaction.originalAppVersion);
  console.log('Environment:', appTransaction.environment);

  // Check if user originally purchased on a different platform (iOS 18.4+)
  if (appTransaction.originalPlatform) {
    console.log('Originally purchased on:', appTransaction.originalPlatform);
  }
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

// Get app transaction (iOS only)
let appTransaction = try await OpenIapModule.shared.getAppTransactionIOS()

if let transaction = appTransaction {
    print("Bundle ID: \\(transaction.bundleId)")
    print("Original version: \\(transaction.originalAppVersion)")
    print("Environment: \\(transaction.environment)")

    // Check if user originally purchased on a different platform (iOS 18.4+)
    if let platform = transaction.originalPlatform {
        print("Originally purchased on: \\(platform)")
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.kmpIapInstance

// Get app transaction (iOS only via KMP)
val appTransaction = kmpIapInstance.getAppTransactionIOS()

appTransaction?.let { transaction ->
    println("Bundle ID: \${transaction.bundleId}")
    println("Original version: \${transaction.originalAppVersion}")
    println("Environment: \${transaction.environment}")

    // Check if user originally purchased on a different platform (iOS 18.4+)
    transaction.originalPlatform?.let { platform ->
        println("Originally purchased on: $platform")
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Get app transaction (iOS only)
final appTransaction = await FlutterInappPurchase.instance.getAppTransactionIOS();

if (appTransaction != null) {
  print('Bundle ID: \${appTransaction.bundleId}');
  print('Original version: \${appTransaction.originalAppVersion}');
  print('Environment: \${appTransaction.environment}');

  // Check if user originally purchased on a different platform (iOS 18.4+)
  if (appTransaction.originalPlatform != null) {
    print('Originally purchased on: \${appTransaction.originalPlatform}');
  }
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Get app transaction (iOS only)
var app_transaction = await iap.get_app_transaction_ios()

if app_transaction != null:
    print("Bundle ID: %s" % app_transaction.bundle_id)
    print("Original version: %s" % app_transaction.original_app_version)
    print("Environment: %s" % app_transaction.environment)

    # Check if user originally purchased on a different platform (iOS 18.4+)
    if app_transaction.original_platform != "":
        print("Originally purchased on: %s" % app_transaction.original_platform)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>
    </div>
  );
}

export default TypesIOS;
