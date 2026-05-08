import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function AppTransactionIos() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="AppTransactionIOS"
        description="AppTransactionIOS type definition and field reference."
        path="/docs/types/ios/app-transaction-ios"
        keywords="AppTransactionIOS, AppTransaction, OpenIAP types, App Transaction"
      />
      <h1>AppTransactionIOS</h1>
      <section>
        <AnchorLink id="app-transaction" level="h2">
          AppTransaction
        </AnchorLink>
        <p>
          Represents the app transaction information returned by{' '}
          <Link to="/docs/apis/ios/get-app-transaction-ios">
            <code>getAppTransactionIOS()</code>
          </Link>
          . Contains metadata about the app&apos;s purchase and installation.
        </p>
        <p>
          <strong>iOS only.</strong> Mirrors <code>AppTransaction</code> (iOS
          16+) — the JWS-verified record of how the app was acquired (
          <a
            href="https://developer.apple.com/documentation/storekit/apptransaction"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple docs
          </a>
          ).
        </p>
        <p className="type-link">
          <strong>Native reference:</strong>{' '}
          <a
            href="https://developer.apple.com/documentation/storekit/apptransaction"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple · StoreKit AppTransaction
          </a>
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
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;

public sealed record AppTransaction
{
    public required string BundleId { get; init; }
    public required string AppVersion { get; init; }
    public required string OriginalAppVersion { get; init; }
    public required double OriginalPurchaseDate { get; init; } // epoch ms
    public required string DeviceVerification { get; init; }
    public required string DeviceVerificationNonce { get; init; }
    public required string Environment { get; init; } // "Sandbox" | "Production"
    public required double SignedDate { get; init; } // epoch ms
    public required double AppId { get; init; }
    public required double AppVersionId { get; init; }
    public double? PreorderDate { get; init; }
    // iOS 18.4+ properties
    public string? AppTransactionId { get; init; }
    public string? OriginalPlatform { get; init; }
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
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var appTransaction =
    await ((QueryResolver)Iap.Instance).GetAppTransactionIOSAsync();

if (appTransaction is not null)
{
    Console.WriteLine($"Bundle ID: {appTransaction.BundleId}");
    Console.WriteLine($"Original version: {appTransaction.OriginalAppVersion}");
    Console.WriteLine($"Environment: {appTransaction.Environment}");

    if (appTransaction.OriginalPlatform is string platform)
    {
        Console.WriteLine($"Originally purchased on: {platform}");
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

export default AppTransactionIos;
