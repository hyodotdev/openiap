import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function AndroidAPIs() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Android APIs"
        description="OpenIAP Android-specific APIs - Google Play Billing APIs for acknowledgment, consumption, and alternative billing."
        path="/docs/apis/android"
        keywords="Android API, Google Play Billing, acknowledgePurchaseAndroid, alternative billing"
      />
      <h1>Android APIs</h1>
      <p>
        Android-specific APIs using Google Play Billing Library. These APIs are
        only available on Android and end with the <code>Android</code> suffix.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <a href="#acknowledge-purchase-android"><code>acknowledgePurchaseAndroid</code></a>: Acknowledge non-consumable
            purchases
          </li>
          <li>
            <a href="#consume-purchase-android"><code>consumePurchaseAndroid</code></a>: Consume consumable purchases
          </li>
          <li>
            <a href="#alternative-billing-android"><strong>Alternative Billing</strong></a>: 3-step flow for external
            payment processing
          </li>
        </ul>
      </TLDRBox>

      <section>
        <AnchorLink id="purchase-completion" level="h2">
          Purchase Completion
        </AnchorLink>

        <AnchorLink id="acknowledge-purchase-android" level="h3">
          acknowledgePurchaseAndroid
        </AnchorLink>
        <p>
          Acknowledge a non-consumable purchase or subscription. Required within
          3 days or the purchase will be refunded.
        </p>
        <CodeBlock language="kotlin">{`suspend fun acknowledgePurchase(purchaseToken: String): Boolean`}</CodeBlock>
        <p>
          <strong>Note:</strong> This is called automatically by{' '}
          <Link to="/docs/apis/purchase#finish-transaction">
            finishTransaction()
          </Link>{' '}
          when <code>isConsumable</code> is <code>false</code>.
        </p>

        <AnchorLink id="consume-purchase-android" level="h3">
          consumePurchaseAndroid
        </AnchorLink>
        <p>
          Consume a consumable purchase, allowing repurchase. Automatically
          acknowledges the purchase.
        </p>
        <CodeBlock language="kotlin">{`suspend fun consumePurchase(purchaseToken: String): Boolean`}</CodeBlock>
        <p>
          <strong>Note:</strong> This is called automatically by{' '}
          <Link to="/docs/apis/purchase#finish-transaction">
            finishTransaction()
          </Link>{' '}
          when <code>isConsumable</code> is <code>true</code>.
        </p>
      </section>

      <section>
        <AnchorLink id="alternative-billing" level="h2">
          Alternative Billing APIs
        </AnchorLink>
        <p>
          Three-step flow for implementing alternative billing on Android. These
          APIs work with Google Play Billing Library 6.2+.
        </p>

        <div className="alert-card alert-card--info">
          <p>
            <strong>Configuration:</strong> Enable alternative billing mode
            during{' '}
            <Link to="/docs/apis/connection#init-connection">
              initConnection()
            </Link>{' '}
            with <code>alternativeBillingModeAndroid</code>.
          </p>
        </div>

        <AnchorLink id="check-alternative-billing-availability-android" level="h3">
          checkAlternativeBillingAvailabilityAndroid
        </AnchorLink>
        <p>
          <strong>Step 1:</strong> Check if alternative billing is available for
          this user/device.
        </p>
        <CodeBlock language="kotlin">{`// Returns true if available, false otherwise
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun checkAlternativeBillingAvailability(): Boolean`}</CodeBlock>

        <AnchorLink id="show-alternative-billing-dialog-android" level="h3">
          showAlternativeBillingDialogAndroid
        </AnchorLink>
        <p>
          <strong>Step 2:</strong> Show alternative billing information dialog
          to the user. Must be called <strong>before</strong> processing payment
          in your payment system.
        </p>
        <CodeBlock language="kotlin">{`// Returns true if user accepted, false if user canceled
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun showAlternativeBillingDialog(): Boolean`}</CodeBlock>

        <AnchorLink id="create-alternative-billing-token-android" level="h3">
          createAlternativeBillingTokenAndroid
        </AnchorLink>
        <p>
          <strong>Step 3:</strong> Create external transaction token for Google
          Play reporting. Must be called <strong>after</strong> successful
          payment in your payment system.
        </p>
        <CodeBlock language="kotlin">{`// Token must be reported to Google Play backend within 24 hours
// Returns token string, or null if creation failed
suspend fun createAlternativeBillingToken(): String?`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="alternative-billing-example" level="h2">
          Alternative Billing Flow Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import {
  checkAlternativeBillingAvailabilityAndroid,
  showAlternativeBillingDialogAndroid,
  createAlternativeBillingTokenAndroid,
} from 'expo-iap';

async function handleAlternativePurchase() {
  // Step 1: Check availability
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
  return; // Fall back to standard billing
}

// Step 2: Show dialog to user
final userAccepted = await FlutterInappPurchase.instance
    .showAlternativeBillingDialogAndroid();
if (!userAccepted) {
  return; // User canceled
}

// Process payment in your payment system
final paymentSuccess = await processPaymentInYourSystem();

if (paymentSuccess) {
  // Step 3: Create token and report to Google Play
  final token = await FlutterInappPurchase.instance
      .createAlternativeBillingTokenAndroid();

  if (token != null) {
    await reportTokenToGooglePlay(token);
  }
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func handle_alternative_purchase():
    # Step 1: Check availability
    var is_available = await iap.check_alternative_billing_availability_android()
    if not is_available:
        # Fall back to standard billing
        return

    # Step 2: Show dialog to user
    var user_accepted = await iap.show_alternative_billing_dialog_android()
    if not user_accepted:
        # User canceled
        return

    # Process payment in your payment system
    var payment_success = await process_payment_in_your_system()

    if payment_success:
        # Step 3: Create token and report to Google Play
        var token = await iap.create_alternative_billing_token_android()

        if token:
            # Report token to Google Play backend within 24 hours
            await report_token_to_google_play(token)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <div className="alert-card alert-card--warning">
          <p>
            <strong>Important:</strong> The token from Step 3 must be reported
            to Google Play backend within 24 hours. See{' '}
            <a
              href="https://developer.android.com/google/play/billing/alternative"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google's Alternative Billing documentation
            </a>{' '}
            for backend integration details.
          </p>
        </div>

        <div className="alert-card alert-card--warning">
          <p>
            <strong>Deprecated:</strong> The above APIs are deprecated in Google
            Play Billing Library 8.2.0+. For new implementations, use the{' '}
            <a href="#billing-programs-api">Billing Programs API</a> below.
          </p>
        </div>
      </section>

      <section>
        <AnchorLink id="billing-programs-api" level="h2">
          Billing Programs API (8.2.0+)
        </AnchorLink>
        <p>
          Google Play Billing Library 8.2.0 introduces the new Billing Programs
          API which replaces the legacy alternative billing APIs. This provides
          better support for External Content Links and External Offers.
        </p>

        <div className="alert-card alert-card--info">
          <p>
            <strong>Recommended:</strong> Use Billing Library 8.2.1+ as version
            8.2.0 had bugs in <code>isBillingProgramAvailableAsync</code> and{' '}
            <code>createBillingProgramReportingDetailsAsync</code>.
          </p>
        </div>

        <AnchorLink id="enable-billing-program-android" level="h3">
          enableBillingProgramAndroid
        </AnchorLink>
        <p>
          <strong>Step 0:</strong> Enable a billing program before calling{' '}
          <code>initConnection()</code>. Must be called during BillingClient
          setup.
        </p>
        <CodeBlock language="kotlin">{`// Call BEFORE initConnection()
// program: BillingProgramAndroid.ExternalOffer or BillingProgramAndroid.ExternalContentLink
fun enableBillingProgram(program: BillingProgramAndroid)`}</CodeBlock>

        <AnchorLink id="is-billing-program-available-android" level="h3">
          isBillingProgramAvailableAndroid
        </AnchorLink>
        <p>
          <strong>Step 1:</strong> Check if a billing program is available for
          the current user.
        </p>
        <CodeBlock language="kotlin">{`// Returns BillingProgramAvailabilityResultAndroid with isAvailable flag
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun isBillingProgramAvailable(
    program: BillingProgramAndroid
): BillingProgramAvailabilityResultAndroid`}</CodeBlock>

        <AnchorLink id="launch-external-link-android" level="h3">
          launchExternalLinkAndroid
        </AnchorLink>
        <p>
          <strong>Step 2:</strong> Launch external link flow. Shows Play Store
          dialog and optionally launches external URL.
        </p>
        <CodeBlock language="kotlin">{`// Returns true if launched successfully
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun launchExternalLink(
    activity: Activity,
    params: LaunchExternalLinkParamsAndroid
): Boolean

// LaunchExternalLinkParamsAndroid:
// - billingProgram: BillingProgramAndroid (ExternalOffer or ExternalContentLink)
// - launchMode: ExternalLinkLaunchModeAndroid
// - linkType: ExternalLinkTypeAndroid
// - linkUri: String (your external URL)`}</CodeBlock>

        <AnchorLink id="create-billing-program-reporting-details-android" level="h3">
          createBillingProgramReportingDetailsAndroid
        </AnchorLink>
        <p>
          <strong>Step 3:</strong> Create reporting details after successful
          payment. Returns external transaction token for reporting.
        </p>
        <CodeBlock language="kotlin">{`// Returns BillingProgramReportingDetailsAndroid with externalTransactionToken
// Token must be reported to Google Play backend within 24 hours
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun createBillingProgramReportingDetails(
    program: BillingProgramAndroid
): BillingProgramReportingDetailsAndroid`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="billing-programs-example" level="h2">
          Billing Programs Flow Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import {
  enableBillingProgramAndroid,
  isBillingProgramAvailableAndroid,
  launchExternalLinkAndroid,
  createBillingProgramReportingDetailsAndroid,
  initConnection,
} from 'expo-iap';

// Step 0: Enable billing program BEFORE initConnection
enableBillingProgramAndroid('EXTERNAL_OFFER');

await initConnection();

async function handleExternalPurchase() {
  // Step 1: Check availability
  const result = await isBillingProgramAvailableAndroid('EXTERNAL_OFFER');
  if (!result.isAvailable) {
    return; // Not available for this user
  }

  // Step 2: Launch external link
  const launched = await launchExternalLinkAndroid({
    billingProgram: 'EXTERNAL_OFFER',
    launchMode: 'LAUNCH_IN_EXTERNAL_BROWSER_OR_APP',
    linkType: 'LINK_TO_DIGITAL_CONTENT_OFFER',
    linkUri: 'https://your-payment-site.com/checkout',
  });

  if (!launched) {
    return; // Failed to launch
  }

  // Process payment in your payment system
  const paymentSuccess = await processPaymentInYourSystem();

  if (paymentSuccess) {
    // Step 3: Create reporting details
    const details = await createBillingProgramReportingDetailsAndroid('EXTERNAL_OFFER');

    // Report token to Google Play backend within 24 hours
    await reportTokenToGooglePlay(details.externalTransactionToken);
  }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Step 0: Enable billing program BEFORE initConnection
openIapStore.enableBillingProgram(BillingProgramAndroid.ExternalOffer)

openIapStore.initConnection(null)

suspend fun handleExternalPurchase() {
    // Step 1: Check availability
    val result = openIapStore.isBillingProgramAvailable(
        BillingProgramAndroid.ExternalOffer
    )
    if (!result.isAvailable) {
        return // Not available for this user
    }

    // Step 2: Launch external link
    val launched = openIapStore.launchExternalLink(
        activity,
        LaunchExternalLinkParamsAndroid(
            billingProgram = BillingProgramAndroid.ExternalOffer,
            launchMode = ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
            linkType = ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
            linkUri = "https://your-payment-site.com/checkout"
        )
    )

    if (!launched) {
        return // Failed to launch
    }

    // Process payment in your payment system
    val paymentSuccess = processPaymentInYourSystem()

    if (paymentSuccess) {
        // Step 3: Create reporting details
        val details = openIapStore.createBillingProgramReportingDetails(
            BillingProgramAndroid.ExternalOffer
        )

        // Report token to Google Play backend within 24 hours
        reportTokenToGooglePlay(details.externalTransactionToken)
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Step 0: Enable billing program BEFORE initConnection
FlutterInappPurchase.instance.enableBillingProgramAndroid(
  BillingProgramAndroid.externalOffer,
);

await FlutterInappPurchase.instance.initConnection();

Future<void> handleExternalPurchase() async {
  // Step 1: Check availability
  final result = await FlutterInappPurchase.instance
      .isBillingProgramAvailableAndroid(BillingProgramAndroid.externalOffer);
  if (!result.isAvailable) {
    return; // Not available for this user
  }

  // Step 2: Launch external link
  final launched = await FlutterInappPurchase.instance.launchExternalLinkAndroid(
    LaunchExternalLinkParamsAndroid(
      billingProgram: BillingProgramAndroid.externalOffer,
      launchMode: ExternalLinkLaunchModeAndroid.launchInExternalBrowserOrApp,
      linkType: ExternalLinkTypeAndroid.linkToDigitalContentOffer,
      linkUri: 'https://your-payment-site.com/checkout',
    ),
  );

  if (!launched) {
    return; // Failed to launch
  }

  // Process payment in your payment system
  final paymentSuccess = await processPaymentInYourSystem();

  if (paymentSuccess) {
    // Step 3: Create reporting details
    final details = await FlutterInappPurchase.instance
        .createBillingProgramReportingDetailsAndroid(
          BillingProgramAndroid.externalOffer,
        );

    // Report token to Google Play backend within 24 hours
    await reportTokenToGooglePlay(details.externalTransactionToken);
  }
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Step 0: Enable billing program BEFORE initConnection
func _ready() -> void:
    iap.enable_billing_program_android(BillingProgramAndroid.EXTERNAL_OFFER)
    await iap.init_connection()

func handle_external_purchase():
    # Step 1: Check availability
    var result = await iap.is_billing_program_available_android(
        BillingProgramAndroid.EXTERNAL_OFFER
    )
    if not result.is_available:
        return  # Not available for this user

    # Step 2: Launch external link
    var params = LaunchExternalLinkParamsAndroid.new()
    params.billing_program = BillingProgramAndroid.EXTERNAL_OFFER
    params.launch_mode = ExternalLinkLaunchModeAndroid.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP
    params.link_type = ExternalLinkTypeAndroid.LINK_TO_DIGITAL_CONTENT_OFFER
    params.link_uri = "https://your-payment-site.com/checkout"

    var launched = await iap.launch_external_link_android(params)

    if not launched:
        return  # Failed to launch

    # Process payment in your payment system
    var payment_success = await process_payment_in_your_system()

    if payment_success:
        # Step 3: Create reporting details
        var details = await iap.create_billing_program_reporting_details_android(
            BillingProgramAndroid.EXTERNAL_OFFER
        )

        # Report token to Google Play backend within 24 hours
        await report_token_to_google_play(details.external_transaction_token)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="api-migration" level="h2">
          API Migration Guide
        </AnchorLink>
        <p>
          Migrate from legacy Alternative Billing APIs to Billing Programs API:
        </p>
        <table className="error-table">
          <thead>
            <tr>
              <th>Legacy API (6.2+)</th>
              <th>New API (8.2.0+)</th>
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
                <code>createBillingProgramReportingDetails(program)</code>
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

        <div className="alert-card alert-card--info">
          <p>
            <strong>See Also:</strong>{' '}
            <Link to="/docs/features/external-purchase">
              External Purchase Guide
            </Link>{' '}
            for complete implementation details and examples.
          </p>
        </div>
      </section>
    </div>
  );
}

export default AndroidAPIs;
