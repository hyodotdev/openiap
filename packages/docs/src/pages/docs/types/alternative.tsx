import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function TypesAlternative() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Alternative Billing Types"
        description="OpenIAP Alternative Billing type definitions - AlternativeBillingModeAndroid, External Purchase Link types for TypeScript, Swift, Kotlin, Dart."
        path="/docs/types/alternative"
        keywords="IAP types, Alternative Billing, External Purchase, TypeScript, Swift, Kotlin"
      />
      <h1>Alternative Billing Types</h1>
      <p>
        Type definitions for alternative billing systems and external purchase
        links.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <code>AlternativeBillingModeAndroid</code> - NONE, USER_CHOICE,
            ALTERNATIVE_ONLY
          </li>
          <li>
            <code>InitConnectionConfig</code> - Configuration for
            initConnection()
          </li>
          <li>
            External Purchase Link APIs for iOS 15.4+ and 18.2+
          </li>
          <li>
            For Android alternative billing, use the{' '}
            <Link to="/docs/apis/android#alternative-billing-android">
              Android APIs
            </Link>
          </li>
        </ul>
      </TLDRBox>

      <section>
        <AnchorLink id="alternative-billing-types" level="h2">
          Alternative Billing Types
        </AnchorLink>
        <p>
          Types for configuring alternative billing systems, primarily used for
          Android.
        </p>

        <AnchorLink id="alternative-billing-mode-android" level="h3">
          AlternativeBillingModeAndroid
        </AnchorLink>
        <p>
          Enum controlling which billing system is used during{' '}
          <code>initConnection()</code>:
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
          Configuration options for <code>initConnection()</code>:
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
                <code>alternativeBillingModeAndroid</code>
              </td>
              <td>
                (Android only) Which billing mode to use. Defaults to{' '}
                <code>NONE</code>.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="init-connection-example" level="h4">
          Usage Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Initialize with user choice billing
await initConnection({
  alternativeBillingModeAndroid: 'user-choice'
});

// Initialize with alternative billing only
await initConnection({
  alternativeBillingModeAndroid: 'alternative-only'
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
              <CodeBlock language="kotlin">{`// Initialize with user choice billing
openIapStore.initConnection(
    InitConnectionConfig(
        alternativeBillingModeAndroid = AlternativeBillingModeAndroid.UserChoice
    )
)

// Initialize with alternative billing only
openIapStore.initConnection(
    InitConnectionConfig(
        alternativeBillingModeAndroid = AlternativeBillingModeAndroid.AlternativeOnly
    )
)

// Standard billing (default)
openIapStore.initConnection()`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Initialize with user choice billing
await FlutterInappPurchase.instance.initConnection(
  alternativeBillingModeAndroid: AlternativeBillingModeAndroid.UserChoice,
);

// Initialize with alternative billing only
await FlutterInappPurchase.instance.initConnection(
  alternativeBillingModeAndroid: AlternativeBillingModeAndroid.AlternativeOnly,
);

// Standard billing (default)
await FlutterInappPurchase.instance.initConnection();`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="external-purchase-link" level="h2">
          External Purchase Link (iOS)
        </AnchorLink>
        <p>
          iOS-specific feature for redirecting users to an external website for
          payment using Apple&apos;s StoreKit <code>ExternalPurchase</code> API.
          Available from iOS 15.4+ (notice sheet) and iOS 18.2+ (custom links).
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
              <td>iOS 15.4+</td>
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
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Result from presenting external purchase link
interface ExternalPurchaseLinkResultIOS {
  error?: string;
  success: boolean;
}

// Result from presenting notice sheet
interface ExternalPurchaseNoticeResultIOS {
  error?: string;
  result: ExternalPurchaseNoticeAction;
}

// User action on notice sheet
type ExternalPurchaseNoticeAction = 'continue' | 'dismissed';`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Result from presenting external purchase link
struct ExternalPurchaseLinkResultIOS {
    let error: String?
    let success: Bool
}

// Result from presenting notice sheet
struct ExternalPurchaseNoticeResultIOS {
    let error: String?
    let result: ExternalPurchaseNoticeAction
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
    val error: String? = null,
    val success: Boolean
)

// Result from presenting notice sheet
data class ExternalPurchaseNoticeResultIOS(
    val error: String? = null,
    val result: ExternalPurchaseNoticeAction
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
  final String? error;
  final bool success;
}

// Result from presenting notice sheet
class ExternalPurchaseNoticeResultIOS {
  final String? error;
  final ExternalPurchaseNoticeAction result;
}

// User action on notice sheet
enum ExternalPurchaseNoticeAction {
  \`continue\`('continue'),
  dismissed('dismissed');
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
              <td>iOS 15.4+ (notice sheet), iOS 18.2+ (custom links)</td>
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
            <strong>Android alternative:</strong> For Android, use the{' '}
            <Link to="/docs/apis/android#alternative-billing-android">
              alternative billing APIs
            </Link>{' '}
            (<code>checkAlternativeBillingAvailability</code>,{' '}
            <code>showAlternativeBillingDialog</code>,{' '}
            <code>createAlternativeBillingToken</code>) instead.
          </p>
        </blockquote>
      </section>
    </div>
  );
}

export default TypesAlternative;
