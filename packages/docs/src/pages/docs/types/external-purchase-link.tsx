import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function ExternalPurchaseLink() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="External Purchase Link Types"
        description="External Purchase Link Types type definition and field reference."
        path="/docs/types/external-purchase-link"
        keywords="External Purchase Link Types, OpenIAP types, External  Purchase  Link  Types"
      />
      <h1>External Purchase Link Types</h1>
      <section>
        <AnchorLink id="external-purchase-link" level="h2">
          External Purchase Link (iOS)
        </AnchorLink>
        <p>
          iOS-specific feature for redirecting users to an external website for
          payment using Apple&apos;s StoreKit <code>ExternalPurchase</code> API.
          Available from iOS 17.4+ (notice sheet) and iOS 18.2+ (custom links).
        </p>

        <blockquote className="info-note">
          <p>
            <strong>Important:</strong> External purchase links bypass StoreKit
            completely. No <code>purchaseUpdatedListener</code> will fire. You
            must implement deep links and server-side verification.
          </p>
        </blockquote>

        <AnchorLink id="external-purchase-apis" level="h3">
          External Purchase APIs
        </AnchorLink>

        <table className="doc-table">
          <thead>
            <tr>
              <th>API</th>
              <th>Description</th>
              <th>Availability</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>canPresentExternalPurchaseNoticeIOS</code>
              </td>
              <td>Check if external purchase notice sheet can be presented</td>
              <td>iOS 17.4+</td>
            </tr>
            <tr>
              <td>
                <code>presentExternalPurchaseNoticeSheetIOS</code>
              </td>
              <td>
                Present Apple&apos;s compliance notice sheet (required before
                external purchase)
              </td>
              <td>iOS 17.4+</td>
            </tr>
            <tr>
              <td>
                <code>presentExternalPurchaseLinkIOS</code>
              </td>
              <td>Open external purchase URL in Safari</td>
              <td>iOS 18.2+</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="external-purchase-types" level="h3">
          Types
        </AnchorLink>

        <h4>ExternalPurchaseNoticeResultIOS</h4>
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
                <code>result</code>
              </td>
              <td>
                <code>ExternalPurchaseNoticeAction</code>
              </td>
              <td>
                User action on the notice sheet (<code>continue</code> or{' '}
                <code>dismissed</code>)
              </td>
            </tr>
            <tr>
              <td>
                <code>error</code>
              </td>
              <td>
                <code>string?</code>
              </td>
              <td>Optional error message if presentation failed</td>
            </tr>
            <tr>
              <td>
                <code>externalPurchaseToken</code>
              </td>
              <td>
                <code>string?</code>
              </td>
              <td>
                External purchase token returned when{' '}
                <code>result === 'continue'</code>. Report to Apple's External
                Purchase Server API.
              </td>
            </tr>
          </tbody>
        </table>

        <h4>ExternalPurchaseLinkResultIOS</h4>
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
                <code>success</code>
              </td>
              <td>
                <code>boolean</code>
              </td>
              <td>Whether the user completed the external purchase flow</td>
            </tr>
            <tr>
              <td>
                <code>error</code>
              </td>
              <td>
                <code>string?</code>
              </td>
              <td>Optional error message if presentation failed</td>
            </tr>
          </tbody>
        </table>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Result from presenting external purchase link
interface ExternalPurchaseLinkResultIOS {
  success: boolean;
  error?: string;
}

// Result from presenting notice sheet (iOS 17.4+)
interface ExternalPurchaseNoticeResultIOS {
  result: ExternalPurchaseNoticeAction;
  error?: string;
  // External purchase token returned when result === 'continue'
  // (must be reported to Apple's External Purchase Server API)
  externalPurchaseToken?: string;
}

// User action on notice sheet
type ExternalPurchaseNoticeAction = 'continue' | 'dismissed';`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Result from presenting external purchase link
struct ExternalPurchaseLinkResultIOS {
    let success: Bool
    let error: String?
}

// Result from presenting notice sheet (iOS 17.4+)
struct ExternalPurchaseNoticeResultIOS {
    let result: ExternalPurchaseNoticeAction
    let error: String?
    // External purchase token returned when result == .continue
    let externalPurchaseToken: String?
}

// User action on notice sheet
enum ExternalPurchaseNoticeAction: String {
    case \`continue\` = "continue"
    case dismissed = "dismissed"
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Result from presenting external purchase link (iOS-only via KMP)
data class ExternalPurchaseLinkResultIOS(
    val success: Boolean,
    val error: String? = null
)

// Result from presenting notice sheet (iOS 17.4+)
data class ExternalPurchaseNoticeResultIOS(
    val result: ExternalPurchaseNoticeAction,
    val error: String? = null,
    // External purchase token returned when result == Continue
    val externalPurchaseToken: String? = null
)

// User action on notice sheet
enum class ExternalPurchaseNoticeAction(val rawValue: String) {
    Continue("continue"),
    Dismissed("dismissed")
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Result from presenting external purchase link
class ExternalPurchaseLinkResultIOS {
  final bool success;
  final String? error;
}

// Result from presenting notice sheet (iOS 17.4+)
class ExternalPurchaseNoticeResultIOS {
  final ExternalPurchaseNoticeAction result;
  final String? error;
  // External purchase token returned when result == continue
  final String? externalPurchaseToken;
}

// User action on notice sheet
enum ExternalPurchaseNoticeAction {
  \`continue\`('continue'),
  dismissed('dismissed');
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Result from presenting external purchase link
class_name ExternalPurchaseLinkResultIOS
var success: bool
var error: String  # optional

# Result from presenting notice sheet (iOS 17.4+)
class_name ExternalPurchaseNoticeResultIOS
var result: int  # ExternalPurchaseNoticeAction
var error: String  # optional
var external_purchase_token: String  # optional

# User action on notice sheet
enum ExternalPurchaseNoticeAction {
    CONTINUE,
    DISMISSED
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="external-purchase-flow" level="h3">
          External Purchase Flow
        </AnchorLink>
        <p>The external purchase flow requires 3 steps for Apple compliance:</p>
        <ol>
          <li>
            <strong>Check availability</strong> - Verify the device supports
            external purchase
          </li>
          <li>
            <strong>Present notice sheet</strong> - Show Apple&apos;s required
            disclosure
          </li>
          <li>
            <strong>Open external link</strong> - Redirect to your payment page
          </li>
        </ol>

        <AnchorLink id="external-purchase-example" level="h3">
          Complete Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import {
  canPresentExternalPurchaseNoticeIOS,
  presentExternalPurchaseNoticeSheetIOS,
  presentExternalPurchaseLinkIOS,
} from 'expo-iap';

async function handleExternalPurchase(externalUrl: string) {
  // Step 1: Check if external purchase is available
  const canPresent = await canPresentExternalPurchaseNoticeIOS();
  if (!canPresent) {
    console.log('External purchase not available on this device');
    return;
  }

  // Step 2: Present Apple's compliance notice sheet
  const noticeResult = await presentExternalPurchaseNoticeSheetIOS();
  if (noticeResult.result === 'dismissed') {
    console.log('User dismissed the notice sheet');
    return;
  }

  // Step 3: Open external purchase link
  const linkResult = await presentExternalPurchaseLinkIOS(externalUrl);
  if (linkResult.success) {
    console.log('User redirected to external payment');
    // Implement deep linking to handle return from payment
  } else {
    console.error('Failed:', linkResult.error);
  }
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

@available(iOS 18.2, *)
func handleExternalPurchase(externalUrl: String) async {
    do {
        // Step 1: Check if external purchase is available
        let canPresent = try await OpenIapModule.shared.canPresentExternalPurchaseNoticeIOS()
        guard canPresent else {
            print("External purchase not available on this device")
            return
        }

        // Step 2: Present Apple's compliance notice sheet
        let noticeResult = try await OpenIapModule.shared.presentExternalPurchaseNoticeSheetIOS()
        guard noticeResult.result == .continue else {
            print("User dismissed the notice sheet")
            return
        }

        // Step 3: Open external purchase link
        let linkResult = try await OpenIapModule.shared.presentExternalPurchaseLinkIOS(externalUrl)
        if linkResult.success {
            print("User redirected to external payment")
            // Implement deep linking to handle return from payment
        } else if let error = linkResult.error {
            print("Failed: \\(error)")
        }
    } catch {
        print("External purchase error: \\(error)")
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.kmpIapInstance
import io.github.hyochan.kmpiap.ExternalPurchaseNoticeAction

// External purchase is iOS-only. For iOS targets in KMP:
suspend fun handleExternalPurchase(externalUrl: String) {
    // Step 1: Check if external purchase is available
    val canPresent = kmpIapInstance.canPresentExternalPurchaseNoticeIOS()
    if (!canPresent) {
        println("External purchase not available on this device")
        return
    }

    // Step 2: Present Apple's compliance notice sheet
    val noticeResult = kmpIapInstance.presentExternalPurchaseNoticeSheetIOS()
    if (noticeResult.result == ExternalPurchaseNoticeAction.Dismissed) {
        println("User dismissed the notice sheet")
        return
    }

    // Step 3: Open external purchase link
    val linkResult = kmpIapInstance.presentExternalPurchaseLinkIOS(externalUrl)
    if (linkResult.success) {
        println("User redirected to external payment")
        // Implement deep linking to handle return from payment
    } else {
        println("Failed: \${linkResult.error}")
    }
}

// For Android: Use alternative billing APIs instead
// See: checkAlternativeBillingAvailability, showAlternativeBillingDialog`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

Future<void> handleExternalPurchase(String externalUrl) async {
  final iap = FlutterInappPurchase.instance;

  // Step 1: Check if external purchase is available
  final canPresent = await iap.canPresentExternalPurchaseNoticeIOS();
  if (!canPresent) {
    print('External purchase not available on this device');
    return;
  }

  // Step 2: Present Apple's compliance notice sheet
  final noticeResult = await iap.presentExternalPurchaseNoticeSheetIOS();
  if (noticeResult.result == ExternalPurchaseNoticeAction.dismissed) {
    print('User dismissed the notice sheet');
    return;
  }

  // Step 3: Open external purchase link
  final linkResult = await iap.presentExternalPurchaseLinkIOS(externalUrl);
  if (linkResult.success) {
    print('User redirected to external payment');
    // Implement deep linking to handle return from payment
  } else {
    print('Failed: \${linkResult.error}');
  }
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func handle_external_purchase(external_url: String):
    # Step 1: Check if external purchase is available
    var can_present = await iap.can_present_external_purchase_notice_ios()
    if not can_present:
        print("External purchase not available on this device")
        return

    # Step 2: Present Apple's compliance notice sheet
    var notice_result = await iap.present_external_purchase_notice_sheet_ios()
    if notice_result.result == ExternalPurchaseNoticeAction.DISMISSED:
        print("User dismissed the notice sheet")
        return

    # Step 3: Open external purchase link
    var link_result = await iap.present_external_purchase_link_ios(external_url)
    if link_result.success:
        print("User redirected to external payment")
        # Implement deep linking to handle return from payment
    else:
        print("Failed: %s" % link_result.error)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="external-purchase-requirements" level="h3">
          Requirements
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Requirement</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Platform</td>
              <td>iOS 17.4+ (notice sheet), iOS 18.2+ (custom links)</td>
            </tr>
            <tr>
              <td>Entitlement</td>
              <td>
                App must have StoreKit external purchase entitlement from Apple
              </td>
            </tr>
            <tr>
              <td>Deep Linking</td>
              <td>Implement deep linking for app return flow after payment</td>
            </tr>
            <tr>
              <td>Verification</td>
              <td>
                Handle purchase verification on your backend (no StoreKit
                receipt)
              </td>
            </tr>
          </tbody>
        </table>

        <blockquote className="info-note">
          <p>
            <strong>Android alternative:</strong> For Android, use the
            alternative billing APIs (
            <Link to="/docs/apis/android/check-alternative-billing-availability-android">
              <code>checkAlternativeBillingAvailabilityAndroid</code>
            </Link>
            ,{' '}
            <Link to="/docs/apis/android/show-alternative-billing-dialog-android">
              <code>showAlternativeBillingDialogAndroid</code>
            </Link>
            ,{' '}
            <Link to="/docs/apis/android/create-alternative-billing-token-android">
              <code>createAlternativeBillingTokenAndroid</code>
            </Link>
            ) instead.
          </p>
        </blockquote>
      </section>
    </div>
  );
}

export default ExternalPurchaseLink;
