import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import PlatformTabs from '../../../components/PlatformTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function ExternalPurchase() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="External Purchase"
        description="Implement external purchase and alternative billing for iOS and Android - bypass platform billing with your own payment system."
        path="/docs/features/external-purchase"
        keywords="external purchase, alternative billing, third-party payment"
      />
      <h1>External Purchase</h1>

      <section>
        <h2>Overview</h2>
        <p>
          External purchase allows you to redirect users to external payment
          systems instead of using platform-native billing (StoreKit on iOS,
          Google Play Billing on Android). This enables alternative payment
          methods and can reduce platform fees.
        </p>

        <div className="alert-card alert-card--info">
          <p>
            <strong>ℹ️ Important:</strong> External purchase bypasses native
            platform billing. You must implement your own payment processing,
            verification, and entitlement systems. Platform-specific callbacks
            (like <code>onPurchaseUpdated</code>) will NOT fire for external
            purchases.
          </p>
        </div>

        <h3>Platform Support</h3>
        <table className="error-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Feature Name</th>
              <th>Minimum OS Version</th>
              <th>Native Framework</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>iOS</td>
              <td>External Purchase URL</td>
              <td>
                iOS 17.4+ (Notice Sheet)
                <br />
                iOS 18.2+ (New APIs)
              </td>
              <td>StoreKit 2</td>
            </tr>
            <tr>
              <td>Android</td>
              <td>Alternative Billing / Billing Programs</td>
              <td>Android 6.0+ (API 23)</td>
              <td>
                Google Play Billing 6.2+ (legacy), 8.2.0+ (External Content
                Links), 8.2.1+ (External Offers), 8.3.0+ (External Payments)
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="common-requirements" level="h2">
          Common Requirements
        </AnchorLink>
        <p>
          Both platforms require the following infrastructure to support
          external purchases:
        </p>

        <h3>Backend Verification System</h3>
        <ul>
          <li>Payment gateway integration</li>
          <li>Purchase verification endpoint</li>
          <li>Entitlement management system</li>
          <li>Transaction logging and auditing</li>
        </ul>
      </section>

      <section>
        <AnchorLink id="platform-implementation" level="h2">
          Platform-Specific Implementation
        </AnchorLink>

        <PlatformTabs>
          {{
            ios: (
              <>
                <h3>iOS - External Purchase</h3>
                <p>
                  iOS supports external purchase through StoreKit's External
                  Purchase API. The notice sheet presents within the app and
                  returns results immediately - no browser redirect required.
                </p>

                <h4>Basic Usage (iOS 18.2+)</h4>
                <p>
                  iOS 18.2+ provides dedicated APIs for external purchase flow
                  with notice sheet and link presentation:
                </p>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`import {
  canPresentExternalPurchaseNoticeIOS,
  presentExternalPurchaseNoticeSheetIOS,
  presentExternalPurchaseLinkIOS
} from 'expo-iap';

async function handleExternalPurchaseFlow() {
  const externalUrl = 'https://your-payment-site.com/checkout';

  try {
    // Step 1: Check if notice sheet can be presented
    const canPresent = await canPresentExternalPurchaseNoticeIOS();

    if (!canPresent) {
      console.log('External purchase notice sheet not available');
      return;
    }

    // Step 2: Present notice sheet (Apple's info sheet)
    const noticeResult = await presentExternalPurchaseNoticeSheetIOS();

    if (noticeResult.result === 'continue') {
      // Step 3: Present external purchase link
      const linkResult = await presentExternalPurchaseLinkIOS(externalUrl);

      if (linkResult.success) {
        console.log('User acknowledged external purchase');
        // User approved external purchase
        // Call your backend API to initiate purchase
        // await yourBackend.createPurchase(productId, userId);
      } else {
        console.log(\`External purchase link failed: \${linkResult.error ?? ''}\`);
      }
    } else {
      console.log('User dismissed notice sheet');
    }
  } catch (error) {
    console.error('External purchase error:', error);
  }
}`}</CodeBlock>
                    ),
                    swift: (
                      <CodeBlock language="swift">{`import OpenIAP

@available(iOS 18.2, *)
func handleExternalPurchaseFlow() async {
    let externalUrl = "https://your-payment-site.com/checkout"

    do {
        // Step 1: Check if notice sheet can be presented
        let canPresent = try await OpenIapModule.shared
            .canPresentExternalPurchaseNoticeIOS()

        guard canPresent else {
            print("External purchase notice sheet not available")
            return
        }

        // Step 2: Present notice sheet (Apple's info sheet)
        let noticeResult = try await OpenIapModule.shared
            .presentExternalPurchaseNoticeSheetIOS()

        if noticeResult.result == .continue {
            // Step 3: Present external purchase link
            let linkResult = try await OpenIapModule.shared
                .presentExternalPurchaseLinkIOS(externalUrl)

            if linkResult.success {
                print("User acknowledged external purchase")
                // User approved external purchase
                // Call your backend API to initiate purchase
                // await yourBackend.createPurchase(productId, userId)
            } else {
                print("External purchase link failed: \\(linkResult.error ?? "")")
            }
        } else {
            print("User dismissed notice sheet")
        }
    } catch {
        print("External purchase error: \\(error)")
    }
}`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`import dev.openiap.OpenIap
import dev.openiap.ExternalPurchaseNoticeAction

// iOS 18.2+ External Purchase Flow (from Kotlin Multiplatform)
suspend fun handleExternalPurchaseFlow() {
    val externalUrl = "https://your-payment-site.com/checkout"

    try {
        // Step 1: Check if notice sheet can be presented
        val canPresent = OpenIap.canPresentExternalPurchaseNoticeIOS()

        if (!canPresent) {
            println("External purchase notice sheet not available")
            return
        }

        // Step 2: Present notice sheet (Apple's info sheet)
        val noticeResult = OpenIap.presentExternalPurchaseNoticeSheetIOS()

        if (noticeResult.result == ExternalPurchaseNoticeAction.Continue) {
            // Step 3: Present external purchase link
            val linkResult = OpenIap.presentExternalPurchaseLinkIOS(externalUrl)

            if (linkResult.success) {
                println("User acknowledged external purchase")
                // User approved external purchase
                // Call your backend API to initiate purchase
                // yourBackend.createPurchase(productId, userId)
            } else {
                println("External purchase link failed: \${linkResult.error ?: ""}")
            }
        } else {
            println("User dismissed notice sheet")
        }
    } catch (e: Exception) {
        println("External purchase error: \${e.message}")
    }
}`}</CodeBlock>
                    ),
                    kmp: (
                      <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP
import io.github.hyochan.kmpiap.ExternalPurchaseNoticeAction

// iOS 18.2+ External Purchase Flow (from Kotlin Multiplatform)
suspend fun handleExternalPurchaseFlow() {
    val kmpIAP = KmpIAP()
    val externalUrl = "https://your-payment-site.com/checkout"

    try {
        // Step 1: Check if notice sheet can be presented
        val canPresent = kmpIAP.canPresentExternalPurchaseNoticeIOS()

        if (!canPresent) {
            println("External purchase notice sheet not available")
            return
        }

        // Step 2: Present notice sheet (Apple's info sheet)
        val noticeResult = kmpIAP.presentExternalPurchaseNoticeSheetIOS()

        if (noticeResult.result == ExternalPurchaseNoticeAction.Continue) {
            // Step 3: Present external purchase link
            val linkResult = kmpIAP.presentExternalPurchaseLinkIOS(externalUrl)

            if (linkResult.success) {
                println("User acknowledged external purchase")
                // User approved external purchase
                // Call your backend API to initiate purchase
                // yourBackend.createPurchase(productId, userId)
            } else {
                println("External purchase link failed: \${linkResult.error ?: ""}")
            }
        } else {
            println("User dismissed notice sheet")
        }
    } catch (e: Exception) {
        println("External purchase error: \${e.message}")
    }
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// iOS 18.2+ External Purchase Flow
Future<void> handleExternalPurchaseFlow() async {
  const externalUrl = 'https://your-payment-site.com/checkout';

  try {
    // Step 1: Check if notice sheet can be presented
    final canPresent = await FlutterInappPurchase.instance
        .canPresentExternalPurchaseNoticeIOS();

    if (!canPresent) {
      print('External purchase notice sheet not available');
      return;
    }

    // Step 2: Present notice sheet (Apple's info sheet)
    final noticeResult = await FlutterInappPurchase.instance
        .presentExternalPurchaseNoticeSheetIOS();

    if (noticeResult.result == ExternalPurchaseNoticeAction.Continue) {
      // Step 3: Present external purchase link
      final linkResult = await FlutterInappPurchase.instance
          .presentExternalPurchaseLinkIOS(externalUrl);

      if (linkResult.success) {
        print('User acknowledged external purchase');
        // User approved external purchase
        // Call your backend API to initiate purchase
        // await yourBackend.createPurchase(productId, userId);
      } else {
        print('External purchase link failed: \${linkResult.error ?? ""}');
      }
    } else {
      print('User dismissed notice sheet');
    }
  } catch (e) {
    print('External purchase error: $e');
  }
}`}</CodeBlock>
                    ),
                    csharp: (
                      <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

async Task HandleExternalPurchaseFlowAsync()
{
    var mutate = (MutationResolver)OpenIapClient.Instance;
    if (!await mutate.CanPresentExternalPurchaseNoticeIOSAsync()) return;

    var notice = await mutate.PresentExternalPurchaseNoticeSheetIOSAsync();
    if (notice.Result != ExternalPurchaseNoticeAction.Continue) return;

    var link = await mutate.PresentExternalPurchaseLinkIOSAsync(
        "https://your-payment-site.com/checkout");
    if (!link.Success)
    {
        Console.WriteLine($"External purchase link failed: {link.Error}");
    }
}`}</CodeBlock>
                    ),
                    gdscript: (
                      <CodeBlock language="gdscript">{`# iOS 18.2+ External Purchase Flow
func handle_external_purchase_flow() -> void:
    var external_url = "https://your-payment-site.com/checkout"

    # Step 1: Check if notice sheet can be presented
    var can_present = await iap.can_present_external_purchase_notice_ios()

    if not can_present:
        print("External purchase notice sheet not available")
        return

    # Step 2: Present notice sheet (Apple's info sheet)
    var notice_result = await iap.present_external_purchase_notice_sheet_ios()

    if notice_result.result == ExternalPurchaseNoticeAction.CONTINUE:
        # Step 3: Present external purchase link
        var link_result = await iap.present_external_purchase_link_ios(external_url)

        if link_result.success:
            print("User acknowledged external purchase")
            # User approved external purchase
            # Call your backend API to initiate purchase
            # await your_backend.create_purchase(product_id, user_id)
        else:
            print("External purchase link failed: %s" % (link_result.error if link_result.error else ""))
    else:
        print("User dismissed notice sheet")`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <div className="alert-card alert-card--info">
                  <p>
                    <strong>ℹ️ Note:</strong> The iOS 18.2+ API provides a
                    cleaner flow with dedicated methods for presenting the
                    notice sheet and external purchase link. This is the
                    recommended approach for iOS 18.2 and later.
                  </p>
                </div>

                <h4>Requirements</h4>
                <ul>
                  <li>
                    <strong>iOS 17.4+</strong> - Minimum version for External
                    Purchase API
                  </li>
                  <li>
                    <strong>iOS 18.2+</strong> - Recommended for dedicated
                    external purchase APIs (
                    <code>canPresentExternalPurchaseNoticeIOS</code>,{' '}
                    <code>presentExternalPurchaseNoticeSheetIOS</code>,{' '}
                    <code>presentExternalPurchaseLinkIOS</code>)
                  </li>
                  <li>
                    <strong>StoreKit 2</strong> - Uses StoreKit 2 framework
                  </li>
                  <li>
                    <strong>Entitlement required</strong> -{' '}
                    <code>com.apple.developer.storekit.external-purchase</code>{' '}
                    entitlement must be configured in App Store Connect
                  </li>
                  <li>
                    <strong>Country code configuration</strong> - Must specify
                    supported country codes in <code>SKExternalPurchase</code>{' '}
                    array in Info.plist. Only available in EU countries and
                    South Korea.{' '}
                    <a
                      href="https://developer.apple.com/documentation/bundleresources/information-property-list/skexternalpurchase"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      See Apple Documentation
                    </a>
                  </li>
                  <li>
                    <strong>No deep linking required</strong> - Notice sheet
                    presents within the app and returns results immediately
                  </li>
                </ul>

                <h4>Configuration (iOS)</h4>
                <p>
                  Add entitlement and country codes in Info.plist. Use lowercase
                  ISO 3166-1 alpha-2 country codes:
                </p>

                <h5>1. SKExternalPurchase (Required)</h5>
                <p>
                  Specify countries where your app supports external purchases:
                </p>
                <CodeBlock language="xml">{`<key>SKExternalPurchase</key>
<array>
  <!-- South Korea -->
  <string>kr</string>

  <!-- Netherlands -->
  <string>nl</string>

  <!-- EU Countries (examples) -->
  <string>de</string>  <!-- Germany -->
  <string>fr</string>  <!-- France -->
  <string>it</string>  <!-- Italy -->
  <string>es</string>  <!-- Spain -->
  <!-- Add other EU country codes as needed -->
</array>

<!-- Entitlement required -->
<!-- com.apple.developer.storekit.external-purchase: true -->`}</CodeBlock>

                <h5>2. SKExternalPurchaseLink (Optional - iOS 15.4+)</h5>
                <p>
                  Provide destination URLs for each country. Required if using{' '}
                  <code>
                    com.apple.developer.storekit.external-purchase-link
                  </code>{' '}
                  entitlement:
                </p>
                <CodeBlock language="xml">{`<key>SKExternalPurchaseLink</key>
<dict>
  <key>nl</key>
  <string>https://your-site.com/checkout</string>

  <key>de</key>
  <string>https://your-site.com/de/checkout</string>

  <key>kr</key>
  <string>https://your-site.com/kr/checkout</string>
</dict>`}</CodeBlock>

                <div className="alert-card alert-card--warning">
                  <p>
                    <strong>⚠️ URL Requirements:</strong> URLs must use HTTPS,
                    be valid absolute URLs, contain no query parameters, and be
                    1,000 or fewer ASCII characters. URLs in Info.plist must
                    match those in your app binary submitted to App Review.
                  </p>
                </div>

                <h5>3. SKExternalPurchaseMultiLink (iOS 17.5+)</h5>
                <p>
                  Provide multiple URLs (up to 5) for each country. Use this
                  instead of <code>SKExternalPurchaseLink</code> for iOS 17.5+:
                </p>
                <CodeBlock language="xml">{`<key>SKExternalPurchaseMultiLink</key>
<dict>
  <key>es</key>
  <array>
    <string>https://your-site.com/es1</string>
    <string>https://your-site.com/new-user-es</string>
    <string>https://your-site.com/seasonal-sale-es</string>
  </array>

  <key>fr</key>
  <array>
    <string>https://your-site.com/fr</string>
    <string>https://your-site.com/global-sale</string>
  </array>

  <key>it</key>
  <array>
    <string>https://your-site.com/global-sale</string>
  </array>
</dict>`}</CodeBlock>

                <div className="alert-card alert-card--warning">
                  <p>
                    <strong>⚠️ Link Limits:</strong> Music streaming apps
                    qualifying for StoreKit External Purchase Link entitlement
                    can provide up to <strong>5 links per country</strong> (EU +
                    Iceland, Norway). Other apps:{' '}
                    <strong>1 link per country</strong>. Total unique links
                    across <code>SKExternalPurchaseMultiLink</code> and{' '}
                    <code>SKExternalPurchaseLink</code> must not exceed the
                    limit.
                  </p>
                </div>

                <h5>4. SKExternalPurchaseCustomLinkRegions (iOS 18.1+)</h5>
                <p>
                  For custom links to communicate and promote offers. Required
                  if using{' '}
                  <code>
                    com.apple.developer.storekit.external-purchase-link
                  </code>{' '}
                  entitlement and <code>ExternalPurchaseCustomLink</code> API:
                </p>
                <CodeBlock language="xml">{`<key>SKExternalPurchaseCustomLinkRegions</key>
<array>
  <string>de</string>  <!-- Germany -->
  <string>fr</string>  <!-- France -->
  <string>nl</string>  <!-- Netherlands -->
  <!-- Add other EU country codes -->
</array>`}</CodeBlock>

                <h5>5. SKExternalPurchaseLinkStreamingRegions (iOS 18.2+)</h5>
                <p>
                  For music streaming apps only. Required if using{' '}
                  <code>
                    com.apple.developer.storekit.external-purchase-link-streaming
                  </code>{' '}
                  entitlement:
                </p>
                <CodeBlock language="xml">{`<key>SKExternalPurchaseLinkStreamingRegions</key>
<array>
  <string>at</string>  <!-- Austria -->
  <string>de</string>  <!-- Germany -->
  <string>fr</string>  <!-- France -->
  <string>nl</string>  <!-- Netherlands -->
  <string>is</string>  <!-- Iceland -->
  <string>no</string>  <!-- Norway -->
  <!-- Add other EU country codes -->
</array>`}</CodeBlock>

                <div className="alert-card alert-card--info">
                  <p>
                    <strong>ℹ️ Apple Documentation Links:</strong>
                  </p>
                  <ul>
                    <li>
                      <a
                        href="https://developer.apple.com/documentation/bundleresources/information-property-list/skexternalpurchase"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        SKExternalPurchase
                      </a>{' '}
                      - Country codes (required)
                    </li>
                    <li>
                      <a
                        href="https://developer.apple.com/documentation/bundleresources/information-property-list/skexternalpurchaselink"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        SKExternalPurchaseLink
                      </a>{' '}
                      - Single URL per country (iOS 15.4+, pre-17.5)
                    </li>
                    <li>
                      <a
                        href="https://developer.apple.com/documentation/bundleresources/information-property-list/skexternalpurchasemultilink"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        SKExternalPurchaseMultiLink
                      </a>{' '}
                      - Multiple URLs per country (iOS 17.5+, recommended)
                    </li>
                    <li>
                      <a
                        href="https://developer.apple.com/documentation/bundleresources/information-property-list/skexternalpurchasecustomlinkregions"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        SKExternalPurchaseCustomLinkRegions
                      </a>{' '}
                      - Custom links for offers (iOS 18.1+)
                    </li>
                    <li>
                      <a
                        href="https://developer.apple.com/documentation/bundleresources/information-property-list/skexternalpurchaselinkstreamingregions"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        SKExternalPurchaseLinkStreamingRegions
                      </a>{' '}
                      - Music streaming apps only (iOS 18.2+)
                    </li>
                  </ul>
                </div>

                <h4>Common Issues (iOS)</h4>
                <table className="error-table">
                  <thead>
                    <tr>
                      <th>Issue</th>
                      <th>Cause</th>
                      <th>Solution</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Notice Sheet Not Showing</td>
                      <td>Missing entitlement or country code</td>
                      <td>
                        Add{' '}
                        <code>
                          com.apple.developer.storekit.external-purchase
                        </code>{' '}
                        entitlement and configure{' '}
                        <code>SKExternalPurchase</code> array
                      </td>
                    </tr>
                    <tr>
                      <td>canPresent Returns False</td>
                      <td>Device region not supported</td>
                      <td>Check device is in supported country (EU, NL, KR)</td>
                    </tr>
                    <tr>
                      <td>FeatureNotSupported Error</td>
                      <td>iOS version too old</td>
                      <td>
                        Requires iOS 17.4+ (notice sheet), iOS 18.2+ (new APIs)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
            android: (
              <>
                <h3>Android - Alternative Billing</h3>
                <p>
                  Android supports alternative billing through Google Play
                  Billing Library 6.2+. There are two modes: Alternative Billing
                  Only and User Choice Billing.
                </p>

                <div className="alert-card alert-card--warning">
                  <p>
                    <strong>
                      Deprecated legacy flow — migration reference only.
                    </strong>{' '}
                    Do not start a new integration with{' '}
                    <code>checkAlternativeBillingAvailabilityAndroid</code>,{' '}
                    <code>showAlternativeBillingDialogAndroid</code>,{' '}
                    <code>createAlternativeBillingTokenAndroid</code>, or{' '}
                    <code>alternativeBillingModeAndroid</code>. Use{' '}
                    <Link to="/docs/apis/android/is-billing-program-available-android">
                      <code>isBillingProgramAvailableAndroid</code>
                    </Link>
                    ,{' '}
                    <Link to="/docs/apis/android/launch-external-link-android">
                      <code>launchExternalLinkAndroid</code>
                    </Link>
                    ,{' '}
                    <Link to="/docs/apis/android/create-billing-program-reporting-details-android">
                      <code>createBillingProgramReportingDetailsAndroid</code>
                    </Link>
                    , and <code>enableBillingProgramAndroid</code>. The
                    schema/native operations are scheduled for removal in
                    OpenIAP 3.0; framework copies remain only through the
                    package-specific majors in the{' '}
                    <Link to="/docs/updates/deprecations#removal-schedule">
                      deprecation schedule
                    </Link>
                    .
                  </p>
                </div>

                <h4>
                  Mode 1: Alternative Billing Only (legacy migration reference)
                </h4>
                <p>
                  Completely bypass Google Play Billing. Requires manual 3-step
                  flow:
                </p>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`import {
  initConnection,
  checkAlternativeBillingAvailabilityAndroid,
  showAlternativeBillingDialogAndroid,
  createAlternativeBillingTokenAndroid,
} from 'expo-iap';

// Initialize with Alternative Billing Only mode
await initConnection({
  alternativeBillingModeAndroid: 'alternative-only',
});

// Purchase flow
async function handleAlternativeBillingPurchase(productId: string) {
  try {
    // Step 1: Check availability
    const isAvailable = await checkAlternativeBillingAvailabilityAndroid();
    if (!isAvailable) {
      console.log('Alternative billing not available');
      return;
    }

    // Step 2: Show Google's information dialog
    const dialogAccepted = await showAlternativeBillingDialogAndroid();
    if (!dialogAccepted) {
      console.log('User canceled');
      return;
    }

    // Step 3: Process payment with your backend API
    const paymentResult = await yourBackend.createPayment({
      productId,
      userId,
      amount: productPrice,
    });

    if (!paymentResult.success) {
      console.log(\`Payment failed: \${paymentResult.error}\`);
      return;
    }

    // Step 4: Create reporting token (after successful payment)
    const token = await createAlternativeBillingTokenAndroid();
    console.log('Token created; send it to your backend without logging it.');

    // Step 5: Send token to your backend server
    // Backend will report token to Google Play within 24 hours
    await yourBackend.reportToken({
      token,
      orderId: paymentResult.orderId,
      productId,
    });

    console.log('Purchase completed!');
  } catch (error) {
    console.error('Purchase error:', error);
  }
}`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.AlternativeBillingMode
import dev.hyo.openiap.AlternativeBillingModeAndroid
import dev.hyo.openiap.InitConnectionConfig

// Initialize with Alternative Billing Only mode
val iapStore = OpenIapStore(
    context = applicationContext,
    alternativeBillingMode = AlternativeBillingMode.ALTERNATIVE_ONLY
)

// Initialize connection
val config = InitConnectionConfig(
    alternativeBillingModeAndroid = AlternativeBillingModeAndroid.AlternativeOnly
)
iapStore.initConnection(config)

// Purchase flow
suspend fun handleAlternativeBillingPurchase(productId: String) {
    try {
        // Step 1: Check availability
        val isAvailable = iapStore.checkAlternativeBillingAvailability()
        if (!isAvailable) {
            Log.e("IAP", "Alternative billing not available")
            return
        }

        // Step 2: Show Google's information dialog
        val dialogAccepted = iapStore.showAlternativeBillingInformationDialog(activity)
        if (!dialogAccepted) {
            Log.d("IAP", "User canceled")
            return
        }

        // Step 3: Process payment with your backend API
        val paymentResult = yourBackend.createPayment(
            productId = productId,
            userId = userId,
            amount = productPrice
        )

        if (!paymentResult.success) {
            Log.e("IAP", "Payment failed: \${paymentResult.error}")
            return
        }

        // Step 4: Create reporting token (after successful payment)
        val token = iapStore.createAlternativeBillingReportingToken()
        Log.d("IAP", "Token created; send it to your backend without logging it.")

        // Step 5: Send token to your backend server
        // Backend will report token to Google Play within 24 hours
        yourBackend.reportToken(
            token = token,
            orderId = paymentResult.orderId,
            productId = productId
        )

        Log.d("IAP", "Purchase completed!")
    } catch (e: Exception) {
        Log.e("IAP", "Purchase error: \${e.message}")
    }
}`}</CodeBlock>
                    ),
                    kmp: (
                      <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP
import io.github.hyochan.kmpiap.openiap.AlternativeBillingModeAndroid
import io.github.hyochan.kmpiap.openiap.InitConnectionConfig

// Initialize with Alternative Billing Only mode
val kmpIAP = KmpIAP()

// Initialize connection
val config = InitConnectionConfig(
    alternativeBillingModeAndroid = AlternativeBillingModeAndroid.AlternativeOnly
)
kmpIAP.initConnection(config)

// Purchase flow
suspend fun handleAlternativeBillingPurchase(productId: String) {
    try {
        // Step 1: Check availability
        val isAvailable = kmpIAP.checkAlternativeBillingAvailabilityAndroid()
        if (!isAvailable) {
            Log.e("IAP", "Alternative billing not available")
            return
        }

        // Step 2: Show Google's information dialog
        val dialogAccepted = kmpIAP.showAlternativeBillingDialogAndroid()
        if (!dialogAccepted) {
            Log.d("IAP", "User canceled")
            return
        }

        // Step 3: Process payment with your backend API
        val paymentResult = yourBackend.createPayment(
            productId = productId,
            userId = userId,
            amount = productPrice
        )

        if (!paymentResult.success) {
            Log.e("IAP", "Payment failed: \${paymentResult.error}")
            return
        }

        // Step 4: Create reporting token (after successful payment)
        val token = kmpIAP.createAlternativeBillingTokenAndroid()
        Log.d("IAP", "Token created; send it to your backend without logging it.")

        // Step 5: Send token to your backend server
        // Backend will report token to Google Play within 24 hours
        yourBackend.reportToken(
            token = token,
            orderId = paymentResult.orderId,
            productId = productId
        )

        Log.d("IAP", "Purchase completed!")
    } catch (e: Exception) {
        Log.e("IAP", "Purchase error: \${e.message}")
    }
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Initialize with Alternative Billing Only mode
await FlutterInappPurchase.instance.initConnection(
  alternativeBillingModeAndroid: AlternativeBillingModeAndroid.AlternativeOnly,
);

// Purchase flow
Future<void> handleAlternativeBillingPurchase(String productId) async {
  try {
    // Step 1: Check availability
    final isAvailable = await FlutterInappPurchase.instance
        .checkAlternativeBillingAvailabilityAndroid();
    if (!isAvailable) {
      print('Alternative billing not available');
      return;
    }

    // Step 2: Show Google's information dialog
    final dialogAccepted = await FlutterInappPurchase.instance
        .showAlternativeBillingDialogAndroid();
    if (!dialogAccepted) {
      print('User canceled');
      return;
    }

    // Step 3: Process payment with your backend API
    final paymentResult = await yourBackend.createPayment(
      productId: productId,
      userId: userId,
      amount: productPrice,
    );

    if (!paymentResult.success) {
      print('Payment failed: \${paymentResult.error}');
      return;
    }

    // Step 4: Create reporting token (after successful payment)
    final token = await FlutterInappPurchase.instance
        .createAlternativeBillingTokenAndroid();
    print('Token created; send it to your backend without logging it.');

    // Step 5: Send token to your backend server
    // Backend will report token to Google Play within 24 hours
    await yourBackend.reportToken(
      token: token,
      orderId: paymentResult.orderId,
      productId: productId,
    );

    print('Purchase completed!');
  } catch (e) {
    print('Purchase error: $e');
  }
}`}</CodeBlock>
                    ),
                    csharp: (
                      <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var mutate = (MutationResolver)OpenIapClient.Instance;
await mutate.InitConnectionAsync(new InitConnectionConfig
{
    AlternativeBillingModeAndroid = AlternativeBillingModeAndroid.AlternativeOnly,
});

// Legacy Alternative Billing Only flow. Prefer External Offer for new apps.
async Task HandleAlternativeBillingPurchaseAsync(string productId)
{
    if (!await mutate.CheckAlternativeBillingAvailabilityAndroidAsync()) return;
    if (!await mutate.ShowAlternativeBillingDialogAndroidAsync()) return;

    var payment = await YourBackend.CreatePaymentAsync(productId);
    if (!payment.Success) return;

    var token = await mutate.CreateAlternativeBillingTokenAndroidAsync();
    if (token is null) return;
    await YourBackend.ReportExternalTransactionAsync(token, payment.OrderId);
}`}</CodeBlock>
                    ),
                    gdscript: (
                      <CodeBlock language="gdscript">{`# Initialize with Alternative Billing Only mode
func _ready() -> void:
    var config = InitConnectionConfig.new()
    config.alternative_billing_mode_android = AlternativeBillingModeAndroid.ALTERNATIVE_ONLY
    await iap.init_connection(config)

# Purchase flow
func handle_alternative_billing_purchase(product_id: String) -> void:
    # Step 1: Check availability
    var is_available = await iap.check_alternative_billing_availability_android()
    if not is_available:
        print("Alternative billing not available")
        return

    # Step 2: Show Google's information dialog
    var dialog_accepted = await iap.show_alternative_billing_dialog_android()
    if not dialog_accepted:
        print("User canceled")
        return

    # Step 3: Process payment with your backend API
    var payment_result = await your_backend.create_payment(
        product_id,
        user_id,
        product_price
    )

    if not payment_result.success:
        print("Payment failed: %s" % payment_result.error)
        return

    # Step 4: Create reporting token (after successful payment)
    var token = await iap.create_alternative_billing_token_android()
    if token:
        print("Token created; send it to your backend without logging it.")

        # Step 5: Send token to your backend server
        # Backend will report token to Google Play within 24 hours
        await your_backend.report_token(token, payment_result.order_id, product_id)

    print("Purchase completed!")`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <div className="alert-card alert-card--info">
                  <p>
                    <strong>ℹ️ Backend Integration:</strong> Process payment
                    directly through your backend API. Your backend handles
                    payment gateway integration (Stripe, PayPal, etc.) and
                    returns the result. After successful payment, create the
                    token and send it to your backend.{' '}
                    <strong>
                      Backend should report the token to Google Play within 24
                      hours
                    </strong>{' '}
                    - this is recommended for security and reliability.
                  </p>
                </div>

                <h4>Mode 2: User Choice Billing</h4>
                <p>
                  Let users choose between Google Play and alternative billing:
                </p>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`import {
  initConnection,
  requestPurchase,
  purchaseUpdatedListener,
  userChoiceBillingListenerAndroid,
  type UserChoiceBillingDetails,
  type Purchase,
} from 'expo-iap';

// Initialize with User Choice mode
await initConnection({
  enableBillingProgramAndroid: 'user-choice-billing',
});

// Set user choice billing listener (for alternative billing selection)
const userChoiceSubscription = userChoiceBillingListenerAndroid(
  async (details: UserChoiceBillingDetails) => {
    console.log('User selected alternative billing');
    console.log('External transaction token received; send it to your backend without logging it.');
    console.log('Products:', details.products);

    try {
      const paymentResult = await yourBackend.createPayment({
        productId: details.products[0],
        userId,
        amount: productPrice,
      });

      if (paymentResult.success) {
        // Report token to backend (backend will send to Google Play)
        await yourBackend.reportToken({
          token: details.externalTransactionToken,
          orderId: paymentResult.orderId,
          productId: details.products[0],
        });
        console.log('Alternative billing purchase completed');
      }
    } catch (error) {
      console.error('Alternative billing payment error:', error);
    }
  }
);

// Set purchase success listener (for Google Play)
const purchaseSubscription = purchaseUpdatedListener(
  (purchase: Purchase) => {
    console.log('Google Play purchase:', purchase.productId);
    // Handle Google Play purchase
  }
);

// Purchase flow - Google shows selection dialog automatically
async function handleUserChoicePurchase(productId: string) {
  try {
    await requestPurchase({
      request: { google: { skus: [productId] } },
      type: 'in-app',
    });

    // If user selects Google Play → purchaseUpdatedListener callback
    // If user selects alternative → userChoiceBillingListenerAndroid callback
  } catch (error) {
    console.error('Purchase error:', error);
  }
}

// Clean up listeners when done
// userChoiceSubscription.remove();
// purchaseSubscription.remove();`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`import dev.hyo.openiap.*
import dev.hyo.openiap.store.OpenIapStore

// Initialize with User Choice mode
val iapStore = OpenIapStore(applicationContext)

// Set user choice billing listener (for alternative billing selection)
iapStore.setUserChoiceBillingListener { details ->
    Log.d("IAP", "User selected alternative billing")
    Log.d("IAP", "External transaction token received; send it to your backend without logging it.")
    Log.d("IAP", "Products: \${details.products}")

    // Process payment with your backend API
    lifecycleScope.launch {
        try {
            val paymentResult = yourBackend.createPayment(
                productId = details.products.first(),
                userId = userId,
                amount = productPrice
            )

            if (paymentResult.success) {
                // Report token to backend (backend will send to Google Play)
                yourBackend.reportToken(
                    token = details.externalTransactionToken,
                    orderId = paymentResult.orderId,
                    productId = details.products.first()
                )
                Log.d("IAP", "Alternative billing purchase completed")
            }
        } catch (e: Exception) {
            Log.e("IAP", "Alternative billing payment error: \${e.message}")
        }
    }
}

// Collect Google Play purchases.
lifecycleScope.launch {
    iapStore.currentPurchase.collect { purchase ->
        purchase ?: return@collect
        handleGooglePlayPurchase(purchase)
    }
}

// Initialize connection
val config = InitConnectionConfig(
    enableBillingProgramAndroid = BillingProgramAndroid.UserChoiceBilling
)
iapStore.initConnection(config)

// Purchase flow - Google shows selection dialog automatically
suspend fun handleUserChoicePurchase(productId: String) {
    try {
        iapStore.setActivity(activity)

        val props = RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(
                    google = RequestPurchaseAndroidProps(
                        skus = listOf(productId)
                    )
                )
            ),
            type = ProductQueryType.InApp
        )

        iapStore.requestPurchase(props)

        // If user selects Google Play → onPurchaseSuccess callback
        // If user selects alternative → UserChoiceBillingListener callback
    } catch (e: Exception) {
        Log.e("IAP", "Purchase error: \${e.message}")
    }
}`}</CodeBlock>
                    ),
                    kmp: (
                      <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP
import io.github.hyochan.kmpiap.openiap.*

val kmpIAP = KmpIAP()

// Start both one-shot subscription handlers before requesting a purchase.
scope.launch {
    val details = kmpIAP.userChoiceBillingAndroid()
    yourBackend.handleAlternativeBilling(
        productId = details.products.first(),
        externalTransactionToken = details.externalTransactionToken
    )
}
scope.launch {
    kmpIAP.purchaseUpdatedListener.collect { purchase ->
        handleGooglePlayPurchase(purchase)
    }
}

kmpIAP.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.UserChoiceBilling
    )
)

suspend fun handleUserChoicePurchase(productId: String) {
    kmpIAP.requestPurchase(
        RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(
                    google = RequestPurchaseAndroidProps(skus = listOf(productId))
                )
            ),
            type = ProductQueryType.InApp
        )
    )
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Initialize with User Choice mode
await FlutterInappPurchase.instance.initConnection(
  enableBillingProgramAndroid: BillingProgramAndroid.UserChoiceBilling,
);

// Set user choice billing listener (for alternative billing selection)
FlutterInappPurchase.instance.userChoiceBillingAndroid.listen((details) async {
  print('User selected alternative billing');
  print('External transaction token received; send it to your backend without logging it.');
  print('Products: \${details.products}');

  try {
    final paymentResult = await yourBackend.createPayment(
      productId: details.products.first,
      userId: userId,
      amount: productPrice,
    );

    if (paymentResult.success) {
      // Report token to backend (backend will send to Google Play)
      await yourBackend.reportToken(
        token: details.externalTransactionToken,
        orderId: paymentResult.orderId,
        productId: details.products.first,
      );
      print('Alternative billing purchase completed');
    }
  } catch (e) {
    print('Alternative billing payment error: $e');
  }
});

// Set purchase success listener (for Google Play)
FlutterInappPurchase.instance.purchaseUpdatedListener.listen((purchase) {
  print('Google Play purchase: \${purchase.productId}');
  // Handle Google Play purchase
});

// Purchase flow - Google shows selection dialog automatically
Future<void> handleUserChoicePurchase(String productId) async {
  try {
    await FlutterInappPurchase.instance.requestPurchase(
      RequestPurchaseProps.inApp((
        apple: null,
        google: RequestPurchaseAndroidProps(skus: [productId]),
        // Compatibility-only: generated Flutter 9.x records require this
        // deprecated null placeholder. It is removed in Flutter 10.
        useAlternativeBilling: null,
      )),
    );

    // If user selects Google Play → purchaseUpdatedListener callback
    // If user selects alternative → userChoiceBillingAndroid callback
  } catch (e) {
    print('Purchase error: $e');
  }
}`}</CodeBlock>
                    ),
                    csharp: (
                      <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var iap = OpenIapClient.Instance;
var mutate = (MutationResolver)iap;

using var userChoiceSubscription = iap.UserChoiceBillingAndroid.Subscribe(
    details => _ = YourBackend.HandleUserChoiceAsync(details));
using var purchaseSubscription = iap.PurchaseUpdated.Subscribe(
    purchase => HandleGooglePlayPurchase(purchase));

await mutate.InitConnectionAsync(new InitConnectionConfig
{
    EnableBillingProgramAndroid = BillingProgramAndroid.UserChoiceBilling,
});

await mutate.RequestPurchaseAsync(new RequestPurchaseProps
{
    RequestPurchase = new RequestPurchasePropsByPlatforms
    {
        Google = new RequestPurchaseAndroidProps
        {
            Skus = new[] { "premium" },
        },
    },
    Type = ProductQueryType.InApp,
});`}</CodeBlock>
                    ),
                    gdscript: (
                      <CodeBlock language="gdscript">{`# Initialize with User Choice mode
func _ready() -> void:
    var config = InitConnectionConfig.new()
    config.alternative_billing_mode_android = AlternativeBillingModeAndroid.USER_CHOICE
    await iap.init_connection(config)

    # Set user choice billing listener (for alternative billing selection)
    iap.user_choice_billing_android.connect(_on_user_choice_billing)
    iap.purchase_updated.connect(_on_purchase_updated)

func _on_user_choice_billing(details: UserChoiceBillingDetails) -> void:
    print("User selected alternative billing")
    print("External transaction token received; send it to your backend without logging it.")
    print("Products: %s" % details.products)

    var payment_result = await your_backend.create_payment(
        details.products[0],
        user_id,
        product_price
    )

    if payment_result.success:
        # Report token to backend (backend will send to Google Play)
        await your_backend.report_token(
            details.external_transaction_token,
            payment_result.order_id,
            details.products[0]
        )
        print("Alternative billing purchase completed")

func _on_purchase_updated(purchase: Purchase) -> void:
    print("Google Play purchase: %s" % purchase.product_id)
    # Handle Google Play purchase

# Purchase flow - Google shows selection dialog automatically
func handle_user_choice_purchase(product_id: String) -> void:
    var props = RequestPurchaseProps.new()
    props.request = RequestPurchasePropsByPlatforms.new()
    props.request.google = RequestPurchaseAndroidProps.new()
    props.request.google.skus = [product_id]
    props.type = ProductQueryType.IN_APP

    await iap.request_purchase(props)

    # If user selects Google Play -> purchase_updated signal
    # If user selects alternative -> user_choice_billing_android signal`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <div className="alert-card alert-card--warning">
                  <p>
                    <strong>Flutter 9.x compatibility:</strong>{' '}
                    <code>useAlternativeBilling: null</code> in the Dart
                    snippets above is only a required placeholder in the current
                    generated positional record. It does not enable alternative
                    billing. Configure <code>enableBillingProgramAndroid</code>{' '}
                    on <code>initConnection</code> instead. The deprecated
                    record field is removed in{' '}
                    <code>flutter_inapp_purchase 10.0.0</code>; see the{' '}
                    <Link to="/docs/updates/deprecations#flutter-10-package-migrations">
                      Flutter 10 migration notes
                    </Link>
                    .
                  </p>
                </div>

                <h4>Billing Programs API (8.2.1+)</h4>
                <p>
                  Google Play Billing Library 8.2.1 introduces the new{' '}
                  <strong>Billing Programs API</strong> which replaces the
                  legacy alternative billing APIs. This provides better support
                  for External Content Links and External Offers.
                </p>

                <h5>Program Types</h5>
                <ul>
                  <li>
                    <strong>ExternalContentLink</strong> - For apps that link to
                    external content (e.g., reader apps, music streaming)
                  </li>
                  <li>
                    <strong>ExternalOffer</strong> - For apps offering
                    alternative payment options
                  </li>
                </ul>

                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`import {
  initConnection,
  isBillingProgramAvailableAndroid,
  createBillingProgramReportingDetailsAndroid,
  launchExternalLinkAndroid,
} from 'expo-iap';

// Step 0: Enable billing program BEFORE initConnection
await initConnection({ enableBillingProgramAndroid: 'external-offer' });

// External Offer flow with Billing Programs API (8.2.1+)
async function handleExternalPurchaseWithBillingPrograms(productId: string) {
  try {
    // Step 1: Check if billing program is available
    const result = await isBillingProgramAvailableAndroid('external-offer');
    if (!result.isAvailable) {
      console.log('External offer program not available');
      return;
    }

    // Step 2: Create reporting details immediately before redirecting.
    const reportingDetails =
      await createBillingProgramReportingDetailsAndroid('external-offer');

    // Step 3: Let Google Play disclose and launch the external destination.
    const launched = await launchExternalLinkAndroid({
      billingProgram: 'external-offer',
      launchMode: 'launch-in-external-browser-or-app',
      linkType: 'link-to-digital-content-offer',
      linkUri: 'https://your-payment-site.com/checkout',
    });

    if (!launched) {
      console.log('Failed to launch external link');
      return;
    }

    // Step 4: launch=true is not purchase completion. Wait for a verified
    // checkout return/deep-link/backend confirmation before reporting.
    const checkout = await yourBackend.waitForVerifiedCheckoutCompletion({ productId });
    if (!checkout.success) return;

    // Report the external transaction to Google within 24 hours.
    await yourBackend.reportExternalTransaction({
      externalTransactionToken: reportingDetails.externalTransactionToken,
      productId,
    });

    console.log('Purchase completed!');
  } catch (error) {
    console.error('Purchase error:', error);
  }
}`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.*

// Initialize store
val iapStore = OpenIapStore(context = applicationContext)

iapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
    )
)

// External Offer flow with Billing Programs API (8.2.1+)
suspend fun handleExternalPurchaseWithBillingPrograms(productId: String) {
    try {
        // Step 1: Check if billing program is available
        val result = iapStore.isBillingProgramAvailable(BillingProgramAndroid.ExternalOffer)
        if (!result.isAvailable) {
            Log.e("IAP", "External offer program not available")
            return
        }

        // Step 2: Create reporting details immediately before redirecting.
        val reportingDetails = iapStore.createBillingProgramReportingDetails(
            BillingProgramAndroid.ExternalOffer
        )

        // Step 3: Let Google Play disclose and launch the external destination.
        val launched = iapStore.launchExternalLink(
            activity,
            LaunchExternalLinkParamsAndroid(
                billingProgram = BillingProgramAndroid.ExternalOffer,
                launchMode = ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
                linkType = ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
                linkUri = "https://your-payment-site.com/checkout"
            )
        )

        if (!launched) {
            Log.e("IAP", "Failed to launch external link")
            return
        }

        // Step 4: launch=true is not purchase completion. Wait for a verified
        // checkout return/deep-link/backend confirmation before reporting.
        val checkout = yourBackend.waitForVerifiedCheckoutCompletion(productId)
        if (!checkout.success) return

        // Report the external transaction from your backend within 24 hours.
        yourBackend.reportExternalTransaction(
            externalTransactionToken = reportingDetails.externalTransactionToken,
            productId = productId
        )

        Log.d("IAP", "Purchase completed!")
    } catch (e: Exception) {
        Log.e("IAP", "Purchase error: \${e.message}")
    }
}`}</CodeBlock>
                    ),
                    kmp: (
                      <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP
import io.github.hyochan.kmpiap.openiap.*

// Initialize store
val kmpIAP = KmpIAP()

kmpIAP.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
    )
)

// External Offer flow with Billing Programs API (8.2.1+)
suspend fun handleExternalPurchaseWithBillingPrograms(productId: String) {
    try {
        // Step 1: Check if billing program is available
        val result = kmpIAP.isBillingProgramAvailableAndroid(BillingProgramAndroid.ExternalOffer)
        if (!result.isAvailable) {
            Log.e("IAP", "External offer program not available")
            return
        }

        // Step 2: Create reporting details immediately before redirecting.
        val reportingDetails = kmpIAP.createBillingProgramReportingDetailsAndroid(
            BillingProgramAndroid.ExternalOffer
        )

        // Step 3: Let Google Play disclose and launch the external destination.
        val launched = kmpIAP.launchExternalLinkAndroid(
            LaunchExternalLinkParamsAndroid(
                billingProgram = BillingProgramAndroid.ExternalOffer,
                launchMode = ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
                linkType = ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
                linkUri = "https://your-payment-site.com/checkout"
            )
        )

        if (!launched) {
            Log.e("IAP", "Failed to launch external link")
            return
        }

        // Step 4: launch=true is not purchase completion. Wait for a verified
        // checkout return/deep-link/backend confirmation before reporting.
        val checkout = yourBackend.waitForVerifiedCheckoutCompletion(productId)
        if (!checkout.success) return

        // Report the external transaction from your backend within 24 hours.
        yourBackend.reportExternalTransaction(
            externalTransactionToken = reportingDetails.externalTransactionToken,
            productId = productId
        )

        Log.d("IAP", "Purchase completed!")
    } catch (e: Exception) {
        Log.e("IAP", "Purchase error: \${e.message}")
    }
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

await FlutterInappPurchase.instance.initConnection(
  enableBillingProgramAndroid: BillingProgramAndroid.ExternalOffer,
);

// External Offer flow with Billing Programs API (8.2.1+)
Future<void> handleExternalPurchaseWithBillingPrograms(String productId) async {
  try {
    // Step 1: Check if billing program is available
    final result = await FlutterInappPurchase.instance
        .isBillingProgramAvailableAndroid(BillingProgramAndroid.ExternalOffer);
    if (!result.isAvailable) {
      print('External offer program not available');
      return;
    }

    // Step 2: Create reporting details immediately before redirecting.
    final reportingDetails = await FlutterInappPurchase.instance
        .createBillingProgramReportingDetailsAndroid(
          program: BillingProgramAndroid.ExternalOffer,
        );

    // Step 3: Let Google Play disclose and launch the external destination.
    final launched = await FlutterInappPurchase.instance.launchExternalLinkAndroid(
      billingProgram: BillingProgramAndroid.ExternalOffer,
      launchMode: ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
      linkType: ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
      linkUri: 'https://your-payment-site.com/checkout',
    );

    if (!launched) {
      print('Failed to launch external link');
      return;
    }

    // Step 4: launch=true is not purchase completion. Wait for a verified
    // checkout return/deep-link/backend confirmation before reporting.
    final checkout = await yourBackend.waitForVerifiedCheckoutCompletion(productId);
    if (!checkout.success) return;

    // Report the external transaction from your backend within 24 hours.
    await yourBackend.reportExternalTransaction(
      externalTransactionToken: reportingDetails.externalTransactionToken,
      productId: productId,
    );

    print('Purchase completed!');
  } catch (e) {
    print('Purchase error: $e');
  }
}`}</CodeBlock>
                    ),
                    csharp: (
                      <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var mutate = (MutationResolver)OpenIapClient.Instance;
await mutate.InitConnectionAsync(new InitConnectionConfig
{
    EnableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer,
});

async Task HandleExternalPurchaseWithBillingProgramsAsync(string productId)
{
    // Step 1: Check program availability.
    var availability = await mutate.IsBillingProgramAvailableAndroidAsync(
        BillingProgramAndroid.ExternalOffer);
    if (!availability.IsAvailable) return;

    // Step 2: Create reporting details immediately before redirecting.
    var reportingDetails = await mutate.CreateBillingProgramReportingDetailsAndroidAsync(
        BillingProgramAndroid.ExternalOffer);

    // Step 3: Let Google Play disclose and launch the external destination.
    var launched = await mutate.LaunchExternalLinkAndroidAsync(
        new LaunchExternalLinkParamsAndroid
        {
            BillingProgram = BillingProgramAndroid.ExternalOffer,
            LaunchMode = ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
            LinkType = ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
            LinkUri = "https://your-payment-site.com/checkout",
        });
    if (!launched) return;

    // Step 4: launch=true is not purchase completion. Wait for a verified
    // checkout return/deep-link/backend confirmation before reporting.
    var checkout = await YourBackend.WaitForVerifiedCheckoutCompletionAsync(productId);
    if (!checkout.Success) return;

    // Report from your backend to Google within 24 hours.
    await YourBackend.ReportExternalTransactionAsync(
        reportingDetails.ExternalTransactionToken,
        productId);
}`}</CodeBlock>
                    ),
                    gdscript: (
                      <CodeBlock language="gdscript">{`# Enable the program while constructing the BillingClient.
func _ready() -> void:
    var config = InitConnectionConfig.new()
    config.enable_billing_program_android = BillingProgramAndroid.EXTERNAL_OFFER
    await iap.init_connection(config)

# External Offer flow with Billing Programs API (8.2.1+)
func handle_external_purchase_with_billing_programs(product_id: String) -> void:
    # Step 1: Check if billing program is available
    var result = await iap.is_billing_program_available_android(
        BillingProgramAndroid.EXTERNAL_OFFER
    )
    if not result.is_available:
        print("External offer program not available")
        return

    # Step 2: Create reporting details immediately before redirecting.
    var reporting_details = await iap.create_billing_program_reporting_details_android(
        BillingProgramAndroid.EXTERNAL_OFFER
    )

    # Step 3: Let Google Play disclose and launch the external destination.
    var params = LaunchExternalLinkParamsAndroid.new()
    params.billing_program = BillingProgramAndroid.EXTERNAL_OFFER
    params.launch_mode = ExternalLinkLaunchModeAndroid.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP
    params.link_type = ExternalLinkTypeAndroid.LINK_TO_DIGITAL_CONTENT_OFFER
    params.link_uri = "https://your-payment-site.com/checkout"

    var launched = await iap.launch_external_link_android(params)

    if not launched:
        print("Failed to launch external link")
        return

    # Step 4: launch=true is not purchase completion. Wait for a verified
    # checkout return/deep-link/backend confirmation before reporting.
    var checkout = await your_backend.wait_for_verified_checkout_completion(product_id)
    if not checkout.success:
        return

    # Report from your backend to Google within 24 hours.
    if reporting_details and reporting_details.external_transaction_token:
        await your_backend.report_external_transaction(
            reporting_details.external_transaction_token,
            product_id
        )

        print("Purchase completed!")`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <h5>API Migration Guide</h5>
                <p>
                  The left column is documentation for existing integrations
                  only. The legacy schema/native operations are scheduled for
                  removal in OpenIAP 3.0, while framework copies follow their
                  own package majors in the{' '}
                  <Link to="/docs/updates/deprecations#removal-schedule">
                    deprecation schedule
                  </Link>
                  .
                </p>
                <table className="error-table">
                  <thead>
                    <tr>
                      <th>Legacy API (migration only; OpenIAP 3.0 removal)</th>
                      <th>External Offer API (8.2.1+)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>checkAlternativeBillingAvailability()</code>
                      </td>
                      <td>
                        <code>isBillingProgramAvailable(program)</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>showAlternativeBillingInformationDialog()</code>
                      </td>
                      <td>
                        <code>launchExternalLink(activity, params)</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>createAlternativeBillingReportingToken()</code>
                      </td>
                      <td>
                        <code>
                          createBillingProgramReportingDetails(program)
                        </code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>enableAlternativeBillingOnly()</code>
                      </td>
                      <td>
                        <code>enableBillingProgram(program)</code>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <h4 id="external-payments-830---japan-only">
                  External Payments (8.3.0+ - Japan Only)
                </h4>
                <p>
                  Google Play Billing Library 8.3.0 introduces the{' '}
                  <strong>External Payments</strong> program, currently
                  available only in Japan. This presents a side-by-side choice
                  between Google Play Billing and the developer's external
                  payment option directly in the purchase flow.
                </p>

                <div className="alert-card alert-card--info">
                  <p>
                    <strong>ℹ️ Availability:</strong> The External Payments
                    program is currently only available in Japan. Users in other
                    regions will not see the developer billing option. Check{' '}
                    <code>isBillingProgramAvailable(EXTERNAL_PAYMENTS)</code> to
                    verify availability.
                  </p>
                </div>

                <h5>Key Differences from Other Programs</h5>
                <ul>
                  <li>
                    <strong>Side-by-side choice:</strong> User sees both Google
                    Play and developer payment options in the same purchase
                    dialog
                  </li>
                  <li>
                    <strong>DeveloperProvidedBillingListener:</strong> New
                    callback when user selects developer billing (different from
                    UserChoiceBillingListener)
                  </li>
                  <li>
                    <strong>DeveloperBillingOptionParams:</strong> Configure the
                    developer billing option in BillingFlowParams
                  </li>
                  <li>
                    <strong>EnableBillingProgramParams:</strong> Required to
                    enable EXTERNAL_PAYMENTS with
                    DeveloperProvidedBillingListener
                  </li>
                </ul>

                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`import {
  initConnection,
  isBillingProgramAvailableAndroid,
  requestPurchase,
  developerProvidedBillingListenerAndroid,
  type DeveloperProvidedBillingDetailsAndroid,
} from 'expo-iap';

await initConnection({ enableBillingProgramAndroid: 'external-payments' });

// Step 1: Set up listener for when user selects developer billing
const developerBillingSubscription = developerProvidedBillingListenerAndroid(
  async (details: DeveloperProvidedBillingDetailsAndroid) => {
    console.log('User selected developer billing');
    console.log('External transaction token received; send it to your backend without logging it.');

    try {
      // Step 2: Process payment with your backend
      const paymentResult = await yourBackend.createPayment({
        productId: currentProductId,
        userId,
        amount: productPrice,
      });

      if (paymentResult.success) {
        // Step 3: Report the external transaction token to Google
        // This must be done within 24 hours
        await yourBackend.reportExternalTransaction({
          token: details.externalTransactionToken,
          orderId: paymentResult.orderId,
          productId: currentProductId,
        });

        console.log('External payment completed and reported!');
      }
    } catch (error) {
      console.error('External payment error:', error);
    }
  }
);

// Purchase flow with External Payments
async function handlePurchaseWithExternalPayments(productId: string) {
  try {
    // Check if External Payments is available (Japan only)
    const result = await isBillingProgramAvailableAndroid('external-payments');
    if (!result.isAvailable) {
      console.log('External Payments not available (not in Japan)');
      // Fall back to standard Google Play purchase
      return;
    }

    // Launch purchase with developer billing option
    // User will see side-by-side choice dialog
    await requestPurchase({
      request: {
        google: {
          skus: [productId],
          developerBillingOption: {
            billingProgram: 'external-payments',
            linkUri: 'https://your-payment-site.com/checkout',
            launchMode: 'launch-in-external-browser-or-app',
          },
        },
      },
      type: 'in-app',
    });

    // If user selects Google Play → purchaseUpdatedListener callback
    // If user selects developer billing → developerProvidedBillingListenerAndroid callback
  } catch (error) {
    console.error('Purchase error:', error);
  }
}

// Clean up when done
// developerBillingSubscription.remove();`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.*

// Initialize store
val iapStore = OpenIapStore(context = applicationContext)

iapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalPayments
    )
)

// Step 1: Set up listener for when user selects developer billing
iapStore.addDeveloperProvidedBillingListener { details ->
    Log.d("IAP", "User selected developer billing")
    Log.d("IAP", "External transaction token received; send it to your backend without logging it.")

    // Step 2: Process payment with your backend
    lifecycleScope.launch {
        try {
            val paymentResult = yourBackend.createPayment(
                productId = currentProductId,
                userId = userId,
                amount = productPrice
            )

            if (paymentResult.success) {
                // Step 3: Report the external transaction token to Google
                // This must be done within 24 hours
                yourBackend.reportExternalTransaction(
                    token = details.externalTransactionToken,
                    orderId = paymentResult.orderId,
                    productId = currentProductId
                )

                Log.d("IAP", "External payment completed and reported!")
            }
        } catch (e: Exception) {
            Log.e("IAP", "External payment error: \${e.message}")
        }
    }
}

// Purchase flow with External Payments
suspend fun handlePurchaseWithExternalPayments(productId: String) {
    try {
        // Check if External Payments is available (Japan only)
        val result = iapStore.isBillingProgramAvailable(
            BillingProgramAndroid.ExternalPayments
        )
        if (!result.isAvailable) {
            Log.w("IAP", "External Payments not available (not in Japan)")
            // Fall back to standard Google Play purchase
            return
        }

        iapStore.setActivity(activity)

        // Launch purchase with developer billing option
        // User will see side-by-side choice dialog
        val props = RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(
                    google = RequestPurchaseAndroidProps(
                        skus = listOf(productId),
                        developerBillingOption = DeveloperBillingOptionParamsAndroid(
                            billingProgram = BillingProgramAndroid.ExternalPayments,
                            linkUri = "https://your-payment-site.com/checkout",
                            launchMode = DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp
                        )
                    )
                )
            ),
            type = ProductQueryType.InApp
        )

        iapStore.requestPurchase(props)

        // If user selects Google Play → onPurchaseSuccess callback
        // If user selects developer billing → DeveloperProvidedBillingListener callback
    } catch (e: Exception) {
        Log.e("IAP", "Purchase error: \${e.message}")
    }
}`}</CodeBlock>
                    ),
                    kmp: (
                      <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP
import io.github.hyochan.kmpiap.openiap.*

val kmpIAP = KmpIAP()

scope.launch {
    val details = kmpIAP.developerProvidedBillingAndroid()
    yourBackend.handleDeveloperBilling(details)
}

kmpIAP.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalPayments
    )
)

suspend fun handlePurchaseWithExternalPayments(productId: String) {
    val availability = kmpIAP.isBillingProgramAvailableAndroid(
        BillingProgramAndroid.ExternalPayments
    )
    if (!availability.isAvailable) return

    kmpIAP.requestPurchase(
        RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(
                    google = RequestPurchaseAndroidProps(
                        skus = listOf(productId),
                        developerBillingOption = DeveloperBillingOptionParamsAndroid(
                            billingProgram = BillingProgramAndroid.ExternalPayments,
                            linkUri = "https://your-payment-site.com/checkout",
                            launchMode = DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp
                        )
                    )
                )
            ),
            type = ProductQueryType.InApp
        )
    )
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

await FlutterInappPurchase.instance.initConnection(
  enableBillingProgramAndroid: BillingProgramAndroid.ExternalPayments,
);

// Step 1: Set up listener for when user selects developer billing
FlutterInappPurchase.instance.developerProvidedBillingAndroid.listen((details) async {
  print('User selected developer billing');
  print('External transaction token received; send it to your backend without logging it.');

  try {
    // Step 2: Process payment with your backend
    final paymentResult = await yourBackend.createPayment(
      productId: currentProductId,
      userId: userId,
      amount: productPrice,
    );

    if (paymentResult.success) {
      // Step 3: Report the external transaction token to Google
      // This must be done within 24 hours
      await yourBackend.reportExternalTransaction(
        token: details.externalTransactionToken,
        orderId: paymentResult.orderId,
        productId: currentProductId,
      );

      print('External payment completed and reported!');
    }
  } catch (e) {
    print('External payment error: \$e');
  }
});

// Purchase flow with External Payments
Future<void> handlePurchaseWithExternalPayments(String productId) async {
  try {
    // Check if External Payments is available (Japan only)
    final result = await FlutterInappPurchase.instance
        .isBillingProgramAvailableAndroid(BillingProgramAndroid.ExternalPayments);
    if (!result.isAvailable) {
      print('External Payments not available (not in Japan)');
      // Fall back to standard Google Play purchase
      return;
    }

    // Launch purchase with developer billing option
    // User will see side-by-side choice dialog
    await FlutterInappPurchase.instance.requestPurchase(
      RequestPurchaseProps.inApp((
        apple: null,
        google: RequestPurchaseAndroidProps(
          skus: [productId],
          developerBillingOption: DeveloperBillingOptionParamsAndroid(
            billingProgram: BillingProgramAndroid.ExternalPayments,
            linkUri: 'https://your-payment-site.com/checkout',
            launchMode: DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp,
          ),
        ),
        // Compatibility-only: generated Flutter 9.x records require this
        // deprecated null placeholder. It is removed in Flutter 10.
        useAlternativeBilling: null,
      )),
    );

    // If user selects Google Play → purchaseUpdatedListener callback
    // If user selects developer billing → developerProvidedBillingAndroid callback
  } catch (e) {
    print('Purchase error: \$e');
  }
}`}</CodeBlock>
                    ),
                    csharp: (
                      <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var iap = OpenIapClient.Instance;
var mutate = (MutationResolver)iap;
using var developerBillingSubscription = iap.DeveloperProvidedBillingAndroid.Subscribe(
    details => _ = YourBackend.HandleDeveloperBillingAsync(details));

await mutate.InitConnectionAsync(new InitConnectionConfig
{
    EnableBillingProgramAndroid = BillingProgramAndroid.ExternalPayments,
});

var availability = await mutate.IsBillingProgramAvailableAndroidAsync(
    BillingProgramAndroid.ExternalPayments);
if (availability.IsAvailable)
{
    await mutate.RequestPurchaseAsync(new RequestPurchaseProps
    {
        RequestPurchase = new RequestPurchasePropsByPlatforms
        {
            Google = new RequestPurchaseAndroidProps
            {
                Skus = new[] { "premium" },
                DeveloperBillingOption = new DeveloperBillingOptionParamsAndroid
                {
                    BillingProgram = BillingProgramAndroid.ExternalPayments,
                    LinkUri = "https://your-payment-site.com/checkout",
                    LaunchMode = DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp,
                },
            },
        },
        Type = ProductQueryType.InApp,
    });
}`}</CodeBlock>
                    ),
                    gdscript: (
                      <CodeBlock language="gdscript">{`# Enable External Payments while constructing the BillingClient.
func _ready() -> void:
    var config = InitConnectionConfig.new()
    config.enable_billing_program_android = BillingProgramAndroid.EXTERNAL_PAYMENTS
    await iap.init_connection(config)

    # Step 1: Set up listener for when user selects developer billing
    iap.developer_provided_billing_android.connect(_on_developer_provided_billing)
    iap.purchase_updated.connect(_on_purchase_updated)

func _on_developer_provided_billing(details: DeveloperProvidedBillingDetailsAndroid) -> void:
    print("User selected developer billing")
    print("External transaction token received; send it to your backend without logging it.")

    # Step 2: Process payment with your backend
    var payment_result = await your_backend.create_payment(
        current_product_id,
        user_id,
        product_price
    )

    if payment_result.success:
        # Step 3: Report the external transaction token to Google
        # This must be done within 24 hours
        await your_backend.report_external_transaction(
            details.external_transaction_token,
            payment_result.order_id,
            current_product_id
        )
        print("External payment completed and reported!")

# Purchase flow with External Payments
func handle_purchase_with_external_payments(product_id: String) -> void:
    # Check if External Payments is available (Japan only)
    var result = await iap.is_billing_program_available_android(
        BillingProgramAndroid.EXTERNAL_PAYMENTS
    )
    if not result.is_available:
        print("External Payments not available (not in Japan)")
        # Fall back to standard Google Play purchase
        return

    # Launch purchase with developer billing option
    # User will see side-by-side choice dialog
    var props = RequestPurchaseProps.new()
    props.request = RequestPurchasePropsByPlatforms.new()
    props.request.google = RequestPurchaseAndroidProps.new()
    props.request.google.skus = [product_id]
    props.request.google.developer_billing_option = DeveloperBillingOptionParamsAndroid.new()
    props.request.google.developer_billing_option.billing_program = BillingProgramAndroid.EXTERNAL_PAYMENTS
    props.request.google.developer_billing_option.link_uri = "https://your-payment-site.com/checkout"
    props.request.google.developer_billing_option.launch_mode = DeveloperBillingLaunchModeAndroid.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP
    props.type = ProductQueryType.IN_APP

    await iap.request_purchase(props)

    # If user selects Google Play -> purchase_updated signal
    # If user selects developer billing -> developer_provided_billing_android signal`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <h5>External Payments Flow Diagram</h5>
                <table className="error-table">
                  <thead>
                    <tr>
                      <th>Step</th>
                      <th>API / Action</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>0</td>
                      <td>
                        <code>initConnection(enableBillingProgramAndroid)</code>
                      </td>
                      <td>
                        Enable External Payments program BEFORE initConnection
                      </td>
                    </tr>
                    <tr>
                      <td>1</td>
                      <td>
                        <code>addDeveloperProvidedBillingListener()</code>
                      </td>
                      <td>
                        Register callback for when user selects developer
                        billing
                      </td>
                    </tr>
                    <tr>
                      <td>2</td>
                      <td>
                        <code>
                          isBillingProgramAvailable(EXTERNAL_PAYMENTS)
                        </code>
                      </td>
                      <td>Check if available (Japan only)</td>
                    </tr>
                    <tr>
                      <td>3</td>
                      <td>
                        <code>
                          requestPurchase(developerBillingOption: ...)
                        </code>
                      </td>
                      <td>
                        Launch purchase with developer billing option configured
                      </td>
                    </tr>
                    <tr>
                      <td>4</td>
                      <td>User Choice Dialog</td>
                      <td>
                        User sees side-by-side choice: Google Play or Developer
                        Billing
                      </td>
                    </tr>
                    <tr>
                      <td>5a</td>
                      <td>
                        If Google Play: <code>onPurchaseSuccess</code>
                      </td>
                      <td>Normal Google Play purchase flow</td>
                    </tr>
                    <tr>
                      <td>5b</td>
                      <td>
                        If Developer:{' '}
                        <code>DeveloperProvidedBillingListener</code>
                      </td>
                      <td>Callback receives externalTransactionToken</td>
                    </tr>
                    <tr>
                      <td>6</td>
                      <td>Process Payment</td>
                      <td>Process payment with your payment gateway</td>
                    </tr>
                    <tr>
                      <td>7</td>
                      <td>Report Token</td>
                      <td>
                        Report externalTransactionToken to Google within 24
                        hours
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="alert-card alert-card--warning">
                  <p>
                    <strong>⚠️ Token Reporting Requirement:</strong> When a user
                    completes a purchase through developer billing, you{' '}
                    <strong>must report the externalTransactionToken</strong> to
                    Google Play within 24 hours. Failure to report may result in
                    account suspension. Use the Google Play Developer API's{' '}
                    <code>externaltransactions.createexternaltransaction</code>{' '}
                    endpoint to report the token.
                  </p>
                </div>

                <h5>DeveloperBillingLaunchMode Options</h5>
                <table className="error-table">
                  <thead>
                    <tr>
                      <th>Mode</th>
                      <th>Behavior</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>LAUNCH_IN_EXTERNAL_BROWSER_OR_APP</code>
                      </td>
                      <td>
                        Google Play will launch the linkUri in an external
                        browser or eligible app. Use this for web-based payment
                        flows.
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>CALLER_WILL_LAUNCH_LINK</code>
                      </td>
                      <td>
                        Google Play returns control to your app without
                        launching. Your app handles launching the payment flow.
                        Use this for in-app payment experiences.
                      </td>
                    </tr>
                  </tbody>
                </table>

                <h4>Requirements</h4>
                <ul>
                  <li>
                    <strong>Google Play Billing 6.2+</strong> - For alternative
                    billing only mode (legacy)
                  </li>
                  <li>
                    <strong>Google Play Billing 7.0+</strong> - For user choice
                    mode
                  </li>
                  <li>
                    <strong>Google Play Billing 8.2.0+</strong> - For External
                    Content Links; <strong>8.2.1+</strong> for External Offers
                  </li>
                  <li>
                    <strong>Play Console Setup</strong> - Configure alternative
                    billing in console
                  </li>
                  <li>
                    <strong>Token Reporting</strong> - Must report token within
                    24 hours
                  </li>
                </ul>

                <h4>Configuration</h4>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`import { initConnection } from 'expo-iap';

// External Offer (recommended replacement for Alternative Billing Only)
await initConnection({
  enableBillingProgramAndroid: 'external-offer',
});

// Or User Choice mode
await initConnection({
  enableBillingProgramAndroid: 'user-choice-billing',
});`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`val iapStore = OpenIapStore(applicationContext)

iapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
        // or BillingProgramAndroid.UserChoiceBilling
    )
)`}</CodeBlock>
                    ),
                    kmp: (
                      <CodeBlock language="kotlin">{`val kmpIAP = KmpIAP()

kmpIAP.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
        // or BillingProgramAndroid.UserChoiceBilling
    )
)`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// External Offer (recommended replacement for Alternative Billing Only)
await FlutterInappPurchase.instance.initConnection(
  enableBillingProgramAndroid: BillingProgramAndroid.ExternalOffer,
);

// Or User Choice mode
await FlutterInappPurchase.instance.initConnection(
  enableBillingProgramAndroid: BillingProgramAndroid.UserChoiceBilling,
);`}</CodeBlock>
                    ),
                    csharp: (
                      <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

await ((MutationResolver)OpenIapClient.Instance).InitConnectionAsync(
    new InitConnectionConfig
    {
        EnableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer,
        // or BillingProgramAndroid.UserChoiceBilling
    });`}</CodeBlock>
                    ),
                    gdscript: (
                      <CodeBlock language="gdscript">{`# External Offer (recommended)
func _ready_external_offer() -> void:
    var config = InitConnectionConfig.new()
    config.enable_billing_program_android = BillingProgramAndroid.EXTERNAL_OFFER
    await iap.init_connection(config)

# Or User Choice mode
func _ready_user_choice() -> void:
    var config = InitConnectionConfig.new()
    config.enable_billing_program_android = BillingProgramAndroid.USER_CHOICE_BILLING
    await iap.init_connection(config)`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <h4>Common Issues (Android)</h4>
                <table className="error-table">
                  <thead>
                    <tr>
                      <th>Issue</th>
                      <th>Cause</th>
                      <th>Solution</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Not Available Error</td>
                      <td>Not configured in Play Console</td>
                      <td>Enable alternative billing in console</td>
                    </tr>
                    <tr>
                      <td>Token Creation Failed</td>
                      <td>Invalid product ID or state</td>
                      <td>Verify product ID and payment status</td>
                    </tr>
                    <tr>
                      <td>User Choice Not Showing</td>
                      <td>Wrong billing library version</td>
                      <td>Update to Billing Library 7.0+</td>
                    </tr>
                  </tbody>
                </table>

                <h4>Testing (Android)</h4>
                <ul>
                  <li>Configure alternative billing in Google Play Console</li>
                  <li>Use internal testing track for testing</li>
                  <li>Test with licensed test accounts</li>
                  <li>Verify token generation and reporting</li>
                </ul>
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="implementation-flow" level="h2">
          Implementation Flow
        </AnchorLink>
        <p>
          The complete external purchase flow involves coordination between your
          app, external website, and backend. The flow differs between iOS and
          Android:
        </p>

        <PlatformTabs>
          {{
            ios: (
              <>
                <h3>iOS Flow (iOS 18.2+)</h3>
                <table className="error-table">
                  <thead>
                    <tr>
                      <th>Step</th>
                      <th>API / Action</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td>
                        <Link to="/docs/apis/ios/can-present-external-purchase-notice-ios">
                          <code>canPresentExternalPurchaseNoticeIOS()</code>
                        </Link>
                      </td>
                      <td>
                        Check if device supports external purchase notice sheet
                      </td>
                    </tr>
                    <tr>
                      <td>2</td>
                      <td>
                        <Link to="/docs/apis/ios/present-external-purchase-notice-sheet-ios">
                          <code>presentExternalPurchaseNoticeSheetIOS()</code>
                        </Link>
                      </td>
                      <td>
                        Show Apple's notice sheet informing user about external
                        purchase
                      </td>
                    </tr>
                    <tr>
                      <td>3</td>
                      <td>User Action</td>
                      <td>
                        User taps "Continue" or dismisses the notice sheet
                      </td>
                    </tr>
                    <tr>
                      <td>4</td>
                      <td>
                        <code>presentExternalPurchaseLinkIOS(url)</code>
                      </td>
                      <td>
                        If user continued, present external purchase link (user
                        acknowledges external purchase)
                      </td>
                    </tr>
                    <tr>
                      <td>5</td>
                      <td>Backend Payment Processing</td>
                      <td>
                        App calls backend API to process payment with payment
                        gateway (Stripe, PayPal, etc.) and grant entitlements
                      </td>
                    </tr>
                    <tr>
                      <td>6</td>
                      <td>Unlock Content</td>
                      <td>
                        App unlocks purchased content after backend confirmation
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="alert-card alert-card--info">
                  <p>
                    <strong>ℹ️ Note:</strong> The iOS 18.2+ flow with dedicated
                    APIs provides better user experience with Apple's official
                    notice sheet. The entire flow happens within the app - no
                    browser redirect or deep linking required.
                  </p>
                </div>
              </>
            ),
            android: (
              <>
                <h3>Billing Programs API (8.2.0+; External Offers 8.2.1+)</h3>
                <table className="error-table">
                  <thead>
                    <tr>
                      <th>Step</th>
                      <th>API / Action</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>0</td>
                      <td>
                        <code>enableBillingProgram(program)</code>
                      </td>
                      <td>Enable billing program BEFORE initConnection</td>
                    </tr>
                    <tr>
                      <td>1</td>
                      <td>
                        <code>isBillingProgramAvailable(program)</code>
                      </td>
                      <td>
                        Check if billing program is available for this user
                      </td>
                    </tr>
                    <tr>
                      <td>2</td>
                      <td>
                        <code>launchExternalLink(activity, params)</code>
                      </td>
                      <td>
                        Launch external link (browser or app) with configured
                        params
                      </td>
                    </tr>
                    <tr>
                      <td>3</td>
                      <td>Backend API Call</td>
                      <td>
                        Call backend API to process payment with payment gateway
                        (Stripe, PayPal, etc.)
                      </td>
                    </tr>
                    <tr>
                      <td>4</td>
                      <td>
                        <code>
                          createBillingProgramReportingDetails(program)
                        </code>
                      </td>
                      <td>
                        After successful payment, create reporting details with
                        token
                      </td>
                    </tr>
                    <tr>
                      <td>5</td>
                      <td>Token Reporting</td>
                      <td>
                        Send externalTransactionToken to Google Play backend
                        within 24 hours
                      </td>
                    </tr>
                    <tr>
                      <td>6</td>
                      <td>Unlock Content</td>
                      <td>
                        Backend grants entitlements and app unlocks content
                      </td>
                    </tr>
                  </tbody>
                </table>

                <h3>
                  Alternative Billing Only (legacy migration reference, 6.2+)
                </h3>
                <p>
                  This sequence is retained only to help existing integrations
                  migrate. Use the Billing Programs replacements in the{' '}
                  <Link to="/docs/features/external-purchase#platform-implementation">
                    Android implementation guide
                  </Link>
                  . The legacy schema/native operations are scheduled for
                  removal in OpenIAP 3.0; framework copies follow the majors in
                  the{' '}
                  <Link to="/docs/updates/deprecations#removal-schedule">
                    deprecation schedule
                  </Link>
                  .
                </p>
                <table className="error-table">
                  <thead>
                    <tr>
                      <th>Step</th>
                      <th>API / Action</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td>
                        <code>checkAlternativeBillingAvailability()</code>
                      </td>
                      <td>
                        Check if alternative billing is available on device
                      </td>
                    </tr>
                    <tr>
                      <td>2</td>
                      <td>
                        <code>showAlternativeBillingInformationDialog()</code>
                      </td>
                      <td>
                        Show Google's information dialog about alternative
                        billing
                      </td>
                    </tr>
                    <tr>
                      <td>3</td>
                      <td>User Action</td>
                      <td>User accepts or declines the dialog</td>
                    </tr>
                    <tr>
                      <td>4</td>
                      <td>Backend API Call</td>
                      <td>
                        Call backend API to process payment with payment gateway
                        (Stripe, PayPal, etc.)
                      </td>
                    </tr>
                    <tr>
                      <td>5</td>
                      <td>
                        <code>createAlternativeBillingReportingToken()</code>
                      </td>
                      <td>After successful payment, create reporting token</td>
                    </tr>
                    <tr>
                      <td>6</td>
                      <td>Token Reporting</td>
                      <td>
                        Send token to Google Play backend within 24 hours (via
                        your backend server)
                      </td>
                    </tr>
                    <tr>
                      <td>7</td>
                      <td>Unlock Content</td>
                      <td>
                        Backend grants entitlements and app unlocks content
                      </td>
                    </tr>
                  </tbody>
                </table>

                <h3>User Choice Billing</h3>
                <table className="error-table">
                  <thead>
                    <tr>
                      <th>Step</th>
                      <th>API / Action</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td>
                        <code>setUserChoiceBillingListener()</code>
                      </td>
                      <td>
                        Set listener to handle alternative billing selection
                        (before purchase)
                      </td>
                    </tr>
                    <tr>
                      <td>2</td>
                      <td>
                        <code>
                          requestPurchase(useAlternativeBilling: true)
                        </code>
                      </td>
                      <td>Initiate purchase request</td>
                    </tr>
                    <tr>
                      <td>3</td>
                      <td>User Selection</td>
                      <td>
                        Google shows dialog: choose Google Play or Alternative
                        Billing
                      </td>
                    </tr>
                    <tr>
                      <td>4a</td>
                      <td>
                        If Google Play: <code>onPurchaseSuccess</code> callback
                      </td>
                      <td>
                        Normal Google Play flow - handle purchase in success
                        callback
                      </td>
                    </tr>
                    <tr>
                      <td>4b</td>
                      <td>
                        If Alternative: <code>UserChoiceBillingListener</code>{' '}
                        callback
                      </td>
                      <td>Process payment with your payment system</td>
                    </tr>
                    <tr>
                      <td>5</td>
                      <td>Token Handling</td>
                      <td>
                        Alternative billing: Create and report token to Google
                        (within 24h)
                      </td>
                    </tr>
                    <tr>
                      <td>6</td>
                      <td>Unlock Content</td>
                      <td>Grant access to purchased content</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="complete-examples" level="h2">
          Complete Examples
        </AnchorLink>
        <p>
          For complete, production-ready examples with full UI implementation,
          please refer to the native example apps:
        </p>

        <PlatformTabs>
          {{
            ios: (
              <>
                <h3>iOS (SwiftUI)</h3>
                <ul>
                  <li>
                    <a
                      href="https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap/example/ios/OpenIapExample/Screens/AlternativeBillingScreen.swift"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      AlternativeBillingScreen.swift
                    </a>{' '}
                    - Complete iOS 18.2+ implementation with notice sheet and
                    external purchase link presentation
                  </li>
                </ul>

                <p>This example demonstrates:</p>
                <ul>
                  <li>Complete UI implementation with state management</li>
                  <li>Notice sheet presentation (iOS 18.2+)</li>
                  <li>Deep link handling and verification flow</li>
                  <li>Error handling and user feedback</li>
                  <li>Production-ready code patterns</li>
                </ul>
              </>
            ),
            android: (
              <>
                <h3>Android (Jetpack Compose)</h3>
                <ul>
                  <li>
                    <a
                      href="https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap/example/android/app/src/main/java/dev/hyo/martie/screens/AlternativeBillingScreen.kt"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      AlternativeBillingScreen.kt
                    </a>{' '}
                    - Complete Android implementation with both Alternative
                    Billing Only and User Choice Billing modes
                  </li>
                </ul>

                <p>This example demonstrates:</p>
                <ul>
                  <li>Complete UI implementation with state management</li>
                  <li>
                    Mode switching (Alternative Billing Only / User Choice
                    Billing)
                  </li>
                  <li>Token generation and reporting</li>
                  <li>Deep link handling and verification flow</li>
                  <li>Error handling and user feedback</li>
                  <li>Production-ready code patterns</li>
                </ul>
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="related-docs" level="h2">
          Related Documentation
        </AnchorLink>
        <ul>
          <li>
            <Link to="/docs/types/external-purchase-link">
              External Purchase Types
            </Link>{' '}
            - Type definitions and parameters
          </li>
          <li>
            <Link to="/docs/setup/store/onside">Onside Store Setup</Link> -
            alternative marketplace flow for <code>expo-iap</code>
          </li>
          <li>
            <Link to="/docs/types/alternative-billing-types">
              Alternative Billing Types
            </Link>{' '}
            - Type definitions and config
          </li>
          <li>
            <Link to="/docs/apis/request-purchase">Request Purchase API</Link> -
            API reference for requestPurchase
          </li>
          <li>
            <Link to="/docs/errors">Error Codes</Link> - Error handling
            reference
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="native-references" level="h2">
          Native References
        </AnchorLink>
        <ul>
          <li>
            Apple ·{' '}
            <a
              href="https://developer.apple.com/support/storekit-external-entitlement/"
              target="_blank"
              rel="noopener noreferrer"
            >
              StoreKit External Purchase entitlement
            </a>
          </li>
          <li>
            Apple ·{' '}
            <a
              href="https://developer.apple.com/documentation/storekit/externalpurchase"
              target="_blank"
              rel="noopener noreferrer"
            >
              StoreKit ExternalPurchase
            </a>{' '}
            — notice sheet and link APIs
          </li>
          <li>
            Google ·{' '}
            <a
              href="https://support.google.com/googleplay/android-developer/answer/13821247"
              target="_blank"
              rel="noopener noreferrer"
            >
              User Choice Billing
            </a>
          </li>
          <li>
            Google ·{' '}
            <a
              href="https://developer.android.com/google/play/billing/alternative"
              target="_blank"
              rel="noopener noreferrer"
            >
              Alternative billing in Play Billing Library
            </a>
          </li>
          <li>
            Google ·{' '}
            <a
              href="https://developer.android.com/google/play/billing/release-notes#8-3-0"
              target="_blank"
              rel="noopener noreferrer"
            >
              Play Billing 8.3.0 — External Payments (Japan)
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default ExternalPurchase;
