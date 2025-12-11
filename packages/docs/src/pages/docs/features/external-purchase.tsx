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
              <td>iOS 15.4+ (Notice Sheet), iOS 18.2+ (New APIs)</td>
              <td>StoreKit 2</td>
            </tr>
            <tr>
              <td>Android</td>
              <td>Alternative Billing / Billing Programs</td>
              <td>Android 6.0+ (API 23)</td>
              <td>Google Play Billing 6.2+ (legacy), 8.2.0+ (recommended)</td>
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

    if (noticeResult.result == ExternalPurchaseNoticeAction.continueAction) {
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
                    <strong>iOS 15.4+</strong> - Minimum version for External
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
                        Requires iOS 15.4+ (notice sheet), iOS 18.2+ (new APIs)
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

                <h4>Mode 1: Alternative Billing Only</h4>
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
  alternativeBillingModeAndroid: 'alternativeOnly',
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
    console.log(\`Token created: \${token?.slice(0, 20)}...\`);

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
        Log.d("IAP", "Token created: \${token?.take(20)}...")

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
  alternativeBillingModeAndroid: AlternativeBillingModeAndroid.alternativeOnly,
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
    print('Token created: \${token?.substring(0, 20)}...');

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
  userChoiceBillingListener,
  type UserChoiceBillingDetails,
  type Purchase,
} from 'expo-iap';

// Initialize with User Choice mode
await initConnection({
  alternativeBillingModeAndroid: 'userChoice',
});

// Set user choice billing listener (for alternative billing selection)
const userChoiceSubscription = userChoiceBillingListener(
  async (details: UserChoiceBillingDetails) => {
    console.log('User selected alternative billing');
    console.log('Token:', details.externalTransactionToken);
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
      google: { skus: [productId] },
    });

    // If user selects Google Play → purchaseUpdatedListener callback
    // If user selects alternative → userChoiceBillingListener callback
  } catch (error) {
    console.error('Purchase error:', error);
  }
}

// Clean up listeners when done
// userChoiceSubscription.remove();
// purchaseSubscription.remove();`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.AlternativeBillingMode
import dev.hyo.openiap.AlternativeBillingModeAndroid
import dev.hyo.openiap.InitConnectionConfig
import dev.hyo.openiap.RequestPurchaseProps
import dev.hyo.openiap.ProductQueryType

// Initialize with User Choice mode
val iapStore = OpenIapStore(
    context = applicationContext,
    alternativeBillingMode = AlternativeBillingMode.USER_CHOICE
)

// Set user choice billing listener (for alternative billing selection)
iapStore.setUserChoiceBillingListener { details ->
    Log.d("IAP", "User selected alternative billing")
    Log.d("IAP", "Token: \${details.externalTransactionToken}")
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

// Set purchase success listener (for Google Play)
iapStore.onPurchaseSuccess = { purchase ->
    Log.d("IAP", "Google Play purchase: \${purchase.productId}")
    // Handle Google Play purchase
}

// Initialize connection
val config = InitConnectionConfig(
    alternativeBillingModeAndroid = AlternativeBillingModeAndroid.UserChoice
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
                    dart: (
                      <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Initialize with User Choice mode
await FlutterInappPurchase.instance.initConnection(
  alternativeBillingModeAndroid: AlternativeBillingModeAndroid.userChoice,
);

// Set user choice billing listener (for alternative billing selection)
FlutterInappPurchase.userChoiceBillingStream.listen((details) async {
  print('User selected alternative billing');
  print('Token: \${details.externalTransactionToken}');
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
FlutterInappPurchase.purchaseUpdatedStream.listen((purchase) {
  print('Google Play purchase: \${purchase.productId}');
  // Handle Google Play purchase
});

// Purchase flow - Google shows selection dialog automatically
Future<void> handleUserChoicePurchase(String productId) async {
  try {
    await FlutterInappPurchase.instance.requestPurchase(
      productId,
    );

    // If user selects Google Play → purchaseUpdatedStream callback
    // If user selects alternative → userChoiceBillingStream callback
  } catch (e) {
    print('Purchase error: $e');
  }
}`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <div className="alert-card alert-card--warning">
                  <p>
                    <strong>⚠️ Deprecated APIs:</strong> The above APIs (
                    <code>checkAlternativeBillingAvailability</code>,{' '}
                    <code>showAlternativeBillingInformationDialog</code>,{' '}
                    <code>createAlternativeBillingReportingToken</code>) are
                    deprecated in Google Play Billing Library 8.2.0+. For new
                    implementations, use the <strong>Billing Programs API</strong>{' '}
                    described below.
                  </p>
                </div>

                <h4>Billing Programs API (8.2.0+)</h4>
                <p>
                  Google Play Billing Library 8.2.0 introduces the new{' '}
                  <strong>Billing Programs API</strong> which replaces the legacy
                  alternative billing APIs. This provides better support for
                  External Content Links and External Offers.
                </p>

                <h5>Program Types</h5>
                <ul>
                  <li>
                    <strong>ExternalContentLink</strong> - For apps that link to
                    external content (e.g., reader apps, music streaming)
                  </li>
                  <li>
                    <strong>ExternalOffer</strong> - For apps offering alternative
                    payment options
                  </li>
                </ul>

                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`import {
  initConnection,
  enableBillingProgramAndroid,
  isBillingProgramAvailableAndroid,
  createBillingProgramReportingDetailsAndroid,
  launchExternalLinkAndroid,
} from 'expo-iap';

// Step 0: Enable billing program BEFORE initConnection
enableBillingProgramAndroid('EXTERNAL_OFFER');
// or enableBillingProgramAndroid('EXTERNAL_CONTENT_LINK');

await initConnection();

// Purchase flow with Billing Programs API (8.2.0+)
async function handleExternalPurchaseWithBillingPrograms(productId: string) {
  try {
    // Step 1: Check if billing program is available
    const result = await isBillingProgramAvailableAndroid('EXTERNAL_OFFER');
    if (!result.isAvailable) {
      console.log('External offer program not available');
      return;
    }

    // Step 2: Launch external link (replaces showAlternativeBillingDialog)
    const launched = await launchExternalLinkAndroid({
      billingProgram: 'EXTERNAL_OFFER',
      launchMode: 'LAUNCH_IN_EXTERNAL_BROWSER_OR_APP',
      linkType: 'LINK_TO_DIGITAL_CONTENT_OFFER',
      linkUri: 'https://your-payment-site.com/checkout',
    });

    if (!launched) {
      console.log('Failed to launch external link');
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

    // Step 4: Create reporting details (replaces createAlternativeBillingToken)
    const reportingDetails = await createBillingProgramReportingDetailsAndroid('EXTERNAL_OFFER');
    console.log(\`Token created: \${reportingDetails.externalTransactionToken.slice(0, 20)}...\`);

    // Step 5: Send token to your backend server
    await yourBackend.reportToken({
      token: reportingDetails.externalTransactionToken,
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
import dev.hyo.openiap.BillingProgramAndroid
import dev.hyo.openiap.LaunchExternalLinkParamsAndroid
import dev.hyo.openiap.ExternalLinkLaunchModeAndroid
import dev.hyo.openiap.ExternalLinkTypeAndroid

// Initialize store
val iapStore = OpenIapStore(context = applicationContext)

// Step 0: Enable billing program BEFORE initConnection
iapStore.enableBillingProgram(BillingProgramAndroid.ExternalOffer)
// or BillingProgramAndroid.ExternalContentLink

iapStore.initConnection(null)

// Purchase flow with Billing Programs API (8.2.0+)
suspend fun handleExternalPurchaseWithBillingPrograms(productId: String) {
    try {
        // Step 1: Check if billing program is available
        val result = iapStore.isBillingProgramAvailable(BillingProgramAndroid.ExternalOffer)
        if (!result.isAvailable) {
            Log.e("IAP", "External offer program not available")
            return
        }

        // Step 2: Launch external link (replaces showAlternativeBillingDialog)
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

        // Step 4: Create reporting details (replaces createAlternativeBillingToken)
        val reportingDetails = iapStore.createBillingProgramReportingDetails(
            BillingProgramAndroid.ExternalOffer
        )
        Log.d("IAP", "Token created: \${reportingDetails.externalTransactionToken.take(20)}...")

        // Step 5: Send token to your backend server
        yourBackend.reportToken(
            token = reportingDetails.externalTransactionToken,
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

// Step 0: Enable billing program BEFORE initConnection
FlutterInappPurchase.instance.enableBillingProgramAndroid(
  BillingProgramAndroid.externalOffer,
);
// or BillingProgramAndroid.externalContentLink

await FlutterInappPurchase.instance.initConnection();

// Purchase flow with Billing Programs API (8.2.0+)
Future<void> handleExternalPurchaseWithBillingPrograms(String productId) async {
  try {
    // Step 1: Check if billing program is available
    final result = await FlutterInappPurchase.instance
        .isBillingProgramAvailableAndroid(BillingProgramAndroid.externalOffer);
    if (!result.isAvailable) {
      print('External offer program not available');
      return;
    }

    // Step 2: Launch external link (replaces showAlternativeBillingDialog)
    final launched = await FlutterInappPurchase.instance.launchExternalLinkAndroid(
      LaunchExternalLinkParamsAndroid(
        billingProgram: BillingProgramAndroid.externalOffer,
        launchMode: ExternalLinkLaunchModeAndroid.launchInExternalBrowserOrApp,
        linkType: ExternalLinkTypeAndroid.linkToDigitalContentOffer,
        linkUri: 'https://your-payment-site.com/checkout',
      ),
    );

    if (!launched) {
      print('Failed to launch external link');
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

    // Step 4: Create reporting details (replaces createAlternativeBillingToken)
    final reportingDetails = await FlutterInappPurchase.instance
        .createBillingProgramReportingDetailsAndroid(BillingProgramAndroid.externalOffer);
    print('Token created: \${reportingDetails.externalTransactionToken.substring(0, 20)}...');

    // Step 5: Send token to your backend server
    await yourBackend.reportToken(
      token: reportingDetails.externalTransactionToken,
      orderId: paymentResult.orderId,
      productId: productId,
    );

    print('Purchase completed!');
  } catch (e) {
    print('Purchase error: $e');
  }
}`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <h5>API Migration Guide</h5>
                <table className="error-table">
                  <thead>
                    <tr>
                      <th>Legacy API (6.2+)</th>
                      <th>New API (8.2.0+)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>checkAlternativeBillingAvailability()</code></td>
                      <td><code>isBillingProgramAvailable(program)</code></td>
                    </tr>
                    <tr>
                      <td><code>showAlternativeBillingInformationDialog()</code></td>
                      <td><code>launchExternalLink(activity, params)</code></td>
                    </tr>
                    <tr>
                      <td><code>createAlternativeBillingReportingToken()</code></td>
                      <td><code>createBillingProgramReportingDetails(program)</code></td>
                    </tr>
                    <tr>
                      <td><code>enableAlternativeBillingOnly()</code></td>
                      <td><code>enableBillingProgram(program)</code></td>
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
                    <strong>Google Play Billing 8.2.0+</strong> - For Billing
                    Programs API (recommended)
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

// Alternative Billing Only mode
await initConnection({
  alternativeBillingModeAndroid: 'alternativeOnly',
});

// Or User Choice mode
await initConnection({
  alternativeBillingModeAndroid: 'userChoice',
});`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`// Method 1: Set mode during initialization
val iapStore = OpenIapStore(
    context = applicationContext,
    alternativeBillingMode = AlternativeBillingMode.ALTERNATIVE_ONLY
    // or AlternativeBillingMode.USER_CHOICE
)

// Method 2: Set mode when initializing connection
val config = InitConnectionConfig(
    alternativeBillingModeAndroid = AlternativeBillingModeAndroid.AlternativeOnly
    // or AlternativeBillingModeAndroid.UserChoice
)
iapStore.initConnection(config)`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Alternative Billing Only mode
await FlutterInappPurchase.instance.initConnection(
  alternativeBillingModeAndroid: AlternativeBillingModeAndroid.alternativeOnly,
);

// Or User Choice mode
await FlutterInappPurchase.instance.initConnection(
  alternativeBillingModeAndroid: AlternativeBillingModeAndroid.userChoice,
);`}</CodeBlock>
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
                        <code>canPresentExternalPurchaseNoticeIOS()</code>
                      </td>
                      <td>
                        Check if device supports external purchase notice sheet
                      </td>
                    </tr>
                    <tr>
                      <td>2</td>
                      <td>
                        <code>presentExternalPurchaseNoticeSheetIOS()</code>
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
                <h3>Billing Programs API (8.2.0+ Recommended)</h3>
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
                      <td>
                        Enable billing program BEFORE initConnection
                      </td>
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
                        Launch external link (browser or app) with configured params
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
                        <code>createBillingProgramReportingDetails(program)</code>
                      </td>
                      <td>After successful payment, create reporting details with token</td>
                    </tr>
                    <tr>
                      <td>5</td>
                      <td>Token Reporting</td>
                      <td>
                        Send externalTransactionToken to Google Play backend within 24 hours
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

                <h3>Alternative Billing Only (Legacy 6.2+)</h3>
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
                      href="https://github.com/hyochan/expo-iap/blob/main/example/ios/OpenIapExample/Screens/AlternativeBillingScreen.swift"
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
                      href="https://github.com/hyochan/expo-iap/blob/main/example/android/app/src/main/java/dev/hyo/martie/screens/AlternativeBillingScreen.kt"
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
            <Link to="/docs/types#external-purchase-link">
              External Purchase Types
            </Link>{' '}
            - Type definitions and parameters
          </li>
          <li>
            <Link to="/docs/examples/alternative-billing">
              Alternative Billing Example
            </Link>{' '}
            - Complete React Native example
          </li>
          <li>
            <Link to="/docs/guides/alternative-billing">
              Alternative Billing Guide
            </Link>{' '}
            - Setup and configuration guide
          </li>
          <li>
            <Link to="/docs/apis#request-purchase">Request Purchase API</Link> -
            API reference for requestPurchase
          </li>
          <li>
            <Link to="/docs/errors">Error Codes</Link> - Error handling
            reference
          </li>
        </ul>
      </section>
    </div>
  );
}

export default ExternalPurchase;
