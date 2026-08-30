import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
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

        <Callout kind="important">
          External purchase bypasses native platform billing. You must implement
          your own payment processing, verification, and entitlement systems.
          Platform-specific callbacks (like <code>onPurchaseUpdated</code>) will
          NOT fire for external purchases.
        </Callout>

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

                <Callout kind="note">
                  The iOS 18.2+ API provides a cleaner flow with dedicated
                  methods for presenting the notice sheet and external purchase
                  link. This is the recommended approach for iOS 18.2 and later.
                </Callout>

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

                <Callout kind="important" title="URL Requirements">
                  URLs must use HTTPS, be valid absolute URLs, contain no query
                  parameters, and be 1,000 or fewer ASCII characters. URLs in
                  Info.plist must match those in your app binary submitted to
                  App Review.
                </Callout>

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

                <Callout kind="important" title="Link Limits">
                  Music streaming apps qualifying for StoreKit External Purchase
                  Link entitlement can provide up to{' '}
                  <strong>5 links per country</strong> (EU + Iceland, Norway).
                  Other apps: <strong>1 link per country</strong>. Total unique
                  links across <code>SKExternalPurchaseMultiLink</code> and{' '}
                  <code>SKExternalPurchaseLink</code> must not exceed the limit.
                </Callout>

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

                <Callout kind="note" title="Apple Documentation Links">
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
                </Callout>

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
                <h4>Billing Programs API (8.2.1+)</h4>
                <p>
                  Google Play Billing Library 8.2.0 introduced the{' '}
                  <strong>Billing Programs API</strong>, which replaces the
                  legacy alternative billing APIs. Use 8.2.1 or later for its
                  availability, reporting-details, and external-link fixes.
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
const connected = await initConnection({ enableBillingProgramAndroid: 'external-offer' });
if (!connected) throw new Error('Store connection failed');

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

check(iapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
    )
)) { "Store connection failed" }

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

check(kmpIAP.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
    )
)) { "Store connection failed" }

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

final connected = await FlutterInappPurchase.instance.initConnection(
  enableBillingProgramAndroid: BillingProgramAndroid.ExternalOffer,
);
if (!connected) throw StateError('Store connection failed');

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
var connected = await mutate.InitConnectionAsync(new InitConnectionConfig
{
    EnableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer,
});
if (!connected) throw new InvalidOperationException("Store connection failed");

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
    var connected = await iap.init_connection(config)
    if not connected:
        push_error("Store connection failed")
        return

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

                <Callout kind="note" title="Availability">
                  The External Payments program is currently only available in
                  Japan. Users in other regions will not see the developer
                  billing option. Check{' '}
                  <code>isBillingProgramAvailable(EXTERNAL_PAYMENTS)</code> to
                  verify availability.
                </Callout>

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

const connected = await initConnection({ enableBillingProgramAndroid: 'external-payments' });
if (!connected) throw new Error('Store connection failed');

// Step 1: Set up listener for when user selects developer billing
async function handleDeveloperBilling(details: DeveloperProvidedBillingDetailsAndroid) {
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

const developerBillingSubscription = developerProvidedBillingListenerAndroid(
  (details) => {
    void handleDeveloperBilling(details);
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

check(iapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalPayments
    )
)) { "Store connection failed" }

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
    try {
        val details = kmpIAP.developerProvidedBillingAndroid()
        yourBackend.handleDeveloperBilling(details)
    } catch (e: Exception) {
        Log.e("IAP", "Developer billing error: \${e.message}")
    }
}

check(kmpIAP.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalPayments
    )
)) { "Store connection failed" }

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
                      <CodeBlock language="dart">{`import 'dart:async';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final connected = await FlutterInappPurchase.instance.initConnection(
  enableBillingProgramAndroid: BillingProgramAndroid.ExternalPayments,
);
if (!connected) throw StateError('Store connection failed');

// Step 1: Set up listener for when user selects developer billing
Future<void> handleDeveloperBilling(DeveloperProvidedBillingDetailsAndroid details) async {
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
}

FlutterInappPurchase.instance.developerProvidedBillingAndroid.listen((details) {
  unawaited(handleDeveloperBilling(details));
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

async Task HandleDeveloperBillingSafelyAsync(DeveloperProvidedBillingDetailsAndroid details)
{
    try
    {
        await YourBackend.HandleDeveloperBillingAsync(details);
    }
    catch (Exception error)
    {
        System.Diagnostics.Debug.WriteLine($"Developer billing error: {error.Message}");
    }
}

using var developerBillingSubscription = iap.DeveloperProvidedBillingAndroid.Subscribe(
    details => _ = HandleDeveloperBillingSafelyAsync(details));

var connected = await mutate.InitConnectionAsync(new InitConnectionConfig
{
    EnableBillingProgramAndroid = BillingProgramAndroid.ExternalPayments,
});
if (!connected) throw new InvalidOperationException("Store connection failed");

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
    var connected = await iap.init_connection(config)
    if not connected:
        push_error("Store connection failed")
        return

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

                <Callout kind="warning" title="Token Reporting Requirement">
                  When a user completes a purchase through developer billing,
                  you <strong>must report the externalTransactionToken</strong>{' '}
                  to Google Play within 24 hours. Failure to report may result
                  in account suspension. Use the Google Play Developer API's{' '}
                  <code>externaltransactions.createexternaltransaction</code>{' '}
                  endpoint to report the token.
                </Callout>

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

// Choose one program for this connection.
const billingProgram = 'external-offer'; // Or 'user-choice-billing'
const connected = await initConnection({
  enableBillingProgramAndroid: billingProgram,
});
if (!connected) throw new Error('Store connection failed');`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`val iapStore = OpenIapStore(applicationContext)

val connected = iapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
        // or BillingProgramAndroid.UserChoiceBilling
    )
)
check(connected) { "Store connection failed" }`}</CodeBlock>
                    ),
                    kmp: (
                      <CodeBlock language="kotlin">{`val kmpIAP = KmpIAP()

val connected = kmpIAP.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
        // or BillingProgramAndroid.UserChoiceBilling
    )
)
check(connected) { "Store connection failed" }`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Choose ExternalOffer or UserChoiceBilling for this connection.
final connected = await FlutterInappPurchase.instance.initConnection(
  enableBillingProgramAndroid: BillingProgramAndroid.ExternalOffer,
);
if (!connected) throw StateError('Store connection failed');`}</CodeBlock>
                    ),
                    csharp: (
                      <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var connected = await ((MutationResolver)OpenIapClient.Instance).InitConnectionAsync(
    new InitConnectionConfig
    {
        EnableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer,
        // or BillingProgramAndroid.UserChoiceBilling
    });
if (!connected) throw new InvalidOperationException("Store connection failed");`}</CodeBlock>
                    ),
                    gdscript: (
                      <CodeBlock language="gdscript">{`# External Offer (recommended)
func _ready_external_offer() -> void:
    var config = InitConnectionConfig.new()
    config.enable_billing_program_android = BillingProgramAndroid.EXTERNAL_OFFER
    var success = await iap.init_connection(config)
    if not success:
        push_error("Store connection failed")

# Or User Choice mode
func _ready_user_choice() -> void:
    var config = InitConnectionConfig.new()
    config.enable_billing_program_android = BillingProgramAndroid.USER_CHOICE_BILLING
    var success = await iap.init_connection(config)
    if not success:
        push_error("Store connection failed")`}</CodeBlock>
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

                <Callout kind="note">
                  The iOS 18.2+ flow with dedicated APIs provides better user
                  experience with Apple's official notice sheet. The entire flow
                  happens within the app - no browser redirect or deep linking
                  required.
                </Callout>
              </>
            ),
            android: (
              <>
                <h3>Billing Programs API (8.2.1+ recommended)</h3>
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
                    - Complete Android implementation with External Offer and
                    Billing Choice programs
                  </li>
                </ul>

                <p>This example demonstrates:</p>
                <ul>
                  <li>Complete UI implementation with state management</li>
                  <li>Program switching (External Offer / Billing Choice)</li>
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
