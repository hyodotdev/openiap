import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function BillingPrograms() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Billing Programs"
        description="Billing Programs type definitions and field reference."
        path="/docs/types/billing-programs"
        keywords="BillingProgramAndroid, OpenIAP types, Billing Programs, External Payments"
      />
      <h1>Billing Programs</h1>
      <section>
        <AnchorLink id="billing-programs" level="h2">
          Billing Programs (Android 8.2.0+)
        </AnchorLink>
        <p>
          Google Play Billing Library 8.2.0+ introduces the Billing Programs
          API, which provides a more structured approach to external offers and
          content links. Version 8.3.0 adds External Payments for Japan.
        </p>
        <p>
          Identifiers for Play Billing 8.2.0+ programs (External Payments,
          etc.). <strong>Android only</strong> (
          <a
            href="https://developer.android.com/google/play/billing/billing-programs"
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
            href="https://developer.android.com/google/play/billing/release-notes#8-2-0"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google · Play Billing 8.2.0 release notes
          </a>
          {' · '}
          <a
            href="https://developer.android.com/google/play/billing/release-notes#8-3-0"
            target="_blank"
            rel="noopener noreferrer"
          >
            8.3.0 release notes
          </a>
        </p>

        <AnchorLink id="billing-program-android" level="h3">
          BillingProgramAndroid
        </AnchorLink>
        <p>
          Enum for different billing program types. Use with{' '}
          <Link to="/docs/apis/android/enable-billing-program-android">
            <code>enableBillingProgramAndroid</code>
          </Link>{' '}
          in{' '}
          <Link to="/docs/types/alternative-billing-types#init-connection-config">
            <code>InitConnectionConfig</code>
          </Link>
          :
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
                <code>USER_CHOICE_BILLING</code>
              </td>
              <td>
                User can select between Google Play or alternative billing
              </td>
              <td>7.0+</td>
            </tr>
            <tr>
              <td>
                <code>EXTERNAL_CONTENT_LINK</code>
              </td>
              <td>
                For apps that link to external content (reader apps, music
                streaming)
              </td>
              <td>8.2.0+</td>
            </tr>
            <tr>
              <td>
                <code>EXTERNAL_OFFER</code>
              </td>
              <td>
                For apps offering alternative payment options (replaces
                ALTERNATIVE_ONLY)
              </td>
              <td>8.2.0+</td>
            </tr>
            <tr>
              <td>
                <code>EXTERNAL_PAYMENTS</code>
              </td>
              <td>
                Side-by-side choice between Google Play and developer billing
                (Japan only)
              </td>
              <td>8.3.0+</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="billing-program-availability-result-android" level="h3">
          BillingProgramAvailabilityResultAndroid
        </AnchorLink>
        <p>
          Result of{' '}
          <Link to="/docs/apis/android/is-billing-program-available-android">
            <code>isBillingProgramAvailableAndroid()</code>
          </Link>
          :
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
                <code>isAvailable</code>
              </td>
              <td>
                <code>boolean</code>
              </td>
              <td>Whether the billing program is available for the user</td>
            </tr>
            <tr>
              <td>
                <code>billingProgram</code>
              </td>
              <td>
                <Link to="/docs/types/billing-programs#billing-program-android">
                  <code>BillingProgramAndroid</code>
                </Link>
              </td>
              <td>The billing program that was checked</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="billing-program-reporting-details-android" level="h3">
          BillingProgramReportingDetailsAndroid
        </AnchorLink>
        <p>
          Result of{' '}
          <Link to="/docs/apis/android/create-billing-program-reporting-details-android">
            <code>createBillingProgramReportingDetailsAndroid()</code>
          </Link>
          :
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
                <Link to="/docs/types/billing-programs#billing-program-android">
                  <code>BillingProgramAndroid</code>
                </Link>
              </td>
              <td>The billing program associated with these details</td>
            </tr>
            <tr>
              <td>
                <code>externalTransactionToken</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>
                Token to report external transactions to Google (must report
                within 24 hours)
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="launch-external-link-params-android" level="h3">
          LaunchExternalLinkParamsAndroid
        </AnchorLink>
        <p>
          Parameters for{' '}
          <Link to="/docs/apis/android/launch-external-link-android">
            <code>launchExternalLinkAndroid()</code>
          </Link>
          :
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
                <Link to="/docs/types/billing-programs#billing-program-android">
                  <code>BillingProgramAndroid</code>
                </Link>
              </td>
              <td>
                The billing program (<code>EXTERNAL_CONTENT_LINK</code> or{' '}
                <code>EXTERNAL_OFFER</code>)
              </td>
            </tr>
            <tr>
              <td>
                <code>launchMode</code>
              </td>
              <td>
                <Link to="/docs/types/billing-programs#external-link-launch-mode">
                  <code>ExternalLinkLaunchModeAndroid</code>
                </Link>
              </td>
              <td>How the external link is launched</td>
            </tr>
            <tr>
              <td>
                <code>linkType</code>
              </td>
              <td>
                <Link to="/docs/types/billing-programs#external-link-type">
                  <code>ExternalLinkTypeAndroid</code>
                </Link>
              </td>
              <td>The type of the external link</td>
            </tr>
            <tr>
              <td>
                <code>linkUri</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>The URI where the external content will be accessed</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="external-link-launch-mode" level="h3">
          ExternalLinkLaunchModeAndroid
        </AnchorLink>
        <p>How the external URL is launched (Play Billing Library 8.2.0+):</p>
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
                <code>UNSPECIFIED</code>
              </td>
              <td>Unspecified launch mode. Do not use.</td>
            </tr>
            <tr>
              <td>
                <code>LAUNCH_IN_EXTERNAL_BROWSER_OR_APP</code>
              </td>
              <td>
                Play launches the URL in an external browser or eligible app.
              </td>
            </tr>
            <tr>
              <td>
                <code>CALLER_WILL_LAUNCH_LINK</code>
              </td>
              <td>
                Play does not launch the URL — the app handles launching the URL
                after Play returns control.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="external-link-type" level="h3">
          ExternalLinkTypeAndroid
        </AnchorLink>
        <p>Type of external link destination (Play Billing Library 8.2.0+):</p>
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
                <code>UNSPECIFIED</code>
              </td>
              <td>Unspecified link type. Do not use.</td>
            </tr>
            <tr>
              <td>
                <code>LINK_TO_DIGITAL_CONTENT_OFFER</code>
              </td>
              <td>The link directs users to a digital content offer.</td>
            </tr>
            <tr>
              <td>
                <code>LINK_TO_APP_DOWNLOAD</code>
              </td>
              <td>The link directs users to download an app.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="developer-billing-option-params" level="h3">
          DeveloperBillingOptionParamsAndroid
        </AnchorLink>
        <p>
          Parameters for configuring developer billing option in purchase flow
          (8.3.0+):
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
                <Link to="/docs/types/billing-programs#billing-program-android">
                  <code>BillingProgramAndroid</code>
                </Link>
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
                <code>string</code>
              </td>
              <td>URL where the external payment will be processed</td>
            </tr>
            <tr>
              <td>
                <code>launchMode</code>
              </td>
              <td>
                <Link to="/docs/types/billing-programs#developer-billing-launch-mode">
                  <code>DeveloperBillingLaunchModeAndroid</code>
                </Link>
              </td>
              <td>How to launch the external payment link</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="developer-billing-launch-mode" level="h3">
          DeveloperBillingLaunchModeAndroid
        </AnchorLink>
        <p>How the external payment URL is launched:</p>
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
        <p>Details received when user selects developer billing (8.3.0+):</p>
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
                <code>string</code>
              </td>
              <td>
                Token to report external transaction to Google (must report
                within 24 hours)
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
  initConnection,
  isBillingProgramAvailableAndroid,
  requestPurchase,
  developerProvidedBillingListenerAndroid,
} from 'expo-iap';

// Enable External Payments via InitConnectionConfig
await initConnection({
  enableBillingProgramAndroid: 'external-payments',
});

// Listen for developer billing selection
developerProvidedBillingListenerAndroid((details) => {
  console.log('Token:', details.externalTransactionToken);
  // Report token to Google via your backend within 24 hours
});

// Check availability (Japan only)
const result = await isBillingProgramAvailableAndroid('external-payments');
if (result.isAvailable) {
  // Purchase with developer billing option
  await requestPurchase({
    request: {
      google: {
        skus: ['product_id'],
        developerBillingOption: {
          billingProgram: 'external-payments',
          linkUri: 'https://your-site.com/checkout',
          launchMode: 'launch-in-external-browser-or-app',
        },
      },
    },
    type: 'in-app',
  });
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.*

val iapStore = OpenIapStore(context)

// Enable External Payments via InitConnectionConfig
iapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalPayments
    )
)

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

// Enable External Payments via InitConnectionConfig
await FlutterInappPurchase.instance.initConnection(
  config: InitConnectionConfig(
    enableBillingProgramAndroid: BillingProgramAndroid.externalPayments,
  ),
);

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
            csharp: (
              <CodeBlock language="csharp">{`using Hyo.OpenIap;
using Hyo.OpenIap.Maui;

var iapStore = OpenIapStore(context)

// Enable External Payments via InitConnectionConfig
iapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalPayments
    )
)

// Listen for developer billing selection
iapStore.addDeveloperProvidedBillingListener { details ->
    Log.d("IAP", "Token: \${details.externalTransactionToken}")
    // Report token to Google via your backend within 24 hours
}

// Check availability (Japan only)
var result = iapStore.isBillingProgramAvailable(
    BillingProgramAndroid.ExternalPayments
)
if (result.isAvailable) {
    // Purchase with developer billing option
    var props = RequestPurchaseProps(
        request = RequestPurchaseProps.Request.Purchase(
            RequestPurchasePropsByPlatforms(
                google = RequestPurchaseAndroidProps(
                    skus = new[] { "product_id" },
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
            gdscript: (
              <CodeBlock language="gdscript">{`# Enable External Payments via InitConnectionConfig
var config = InitConnectionConfig.new()
config.enable_billing_program_android = BillingProgramAndroid.EXTERNAL_PAYMENTS
await iap.init_connection(config)

# Listen for developer billing selection
func _on_developer_provided_billing(details: DeveloperProvidedBillingDetailsAndroid):
    print("Token: %s" % details.external_transaction_token)
    # Report token to Google via your backend within 24 hours

iap.developer_provided_billing.connect(_on_developer_provided_billing)

# Check availability (Japan only)
var result = await iap.is_billing_program_available_android(
    BillingProgramAndroid.EXTERNAL_PAYMENTS
)
if result.is_available:
    # Purchase with developer billing option
    var props = RequestPurchaseProps.new()
    props.request = RequestPurchasePropsByPlatforms.new()
    props.request.google = RequestPurchaseAndroidProps.new()
    props.request.google.skus = ["product_id"]
    props.request.google.developer_billing_option = DeveloperBillingOptionParamsAndroid.new()
    props.request.google.developer_billing_option.billing_program = BillingProgramAndroid.EXTERNAL_PAYMENTS
    props.request.google.developer_billing_option.link_uri = "https://your-site.com/checkout"
    props.request.google.developer_billing_option.launch_mode = DeveloperBillingLaunchModeAndroid.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP
    props.type = ProductQueryType.IN_APP
    await iap.request_purchase(props)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <blockquote className="info-note">
          <p>
            <strong>Token Reporting:</strong> When a user completes a purchase
            through developer billing, you must report the{' '}
            <code>externalTransactionToken</code> to Google Play within 24
            hours. See{' '}
            <Link to="/docs/features/external-purchase#external-payments-830---japan-only">
              External Payments documentation
            </Link>{' '}
            for complete implementation details.
          </p>
        </blockquote>
      </section>
    </div>
  );
}

export default BillingPrograms;
