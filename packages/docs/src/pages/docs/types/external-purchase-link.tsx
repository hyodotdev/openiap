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
          Available from iOS 17.4+ (notice sheet) and iOS 18.1+ (custom links).
        </p>
        <p>
          Link out with{' '}
          <Link to="/docs/apis/open-external-purchase-link">
            <code>openExternalPurchaseLink</code>
          </Link>
          . It shows Apple&apos;s disclosure, opens the URL only if the user
          continues, and returns the report token. The step-by-step iOS calls
          below are deprecated and keep working until client protocol 2.0.0.
        </p>
        <p className="type-link">
          <strong>Native references:</strong>{' '}
          <a
            href="https://developer.apple.com/documentation/storekit/externalpurchase"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple · StoreKit ExternalPurchase
          </a>
          {' · '}
          <a
            href="https://developer.apple.com/support/storekit-external-entitlement/"
            target="_blank"
            rel="noopener noreferrer"
          >
            External purchase entitlement
          </a>
        </p>

        <blockquote className="info-note">
          <p>
            <strong>Important:</strong> External purchase links bypass StoreKit
            completely. No{' '}
            <Link to="/docs/events/purchase-updated-listener">
              <code>purchaseUpdatedListener</code>
            </Link>{' '}
            will fire. You must implement deep links and server-side
            verification.
          </p>
        </blockquote>

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

        <AnchorLink
          id="external-purchase-custom-link-token-result-ios"
          level="h4"
        >
          ExternalPurchaseCustomLinkTokenResultIOS
        </AnchorLink>
        <p>
          Returned by{' '}
          <Link to="/docs/apis/ios/get-external-purchase-custom-link-token-ios">
            <code>getExternalPurchaseCustomLinkTokenIOS</code>
          </Link>{' '}
          (iOS 18.1+).
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
                <code>token</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>
                Token to send to Apple's External Purchase Server reporting API.
              </td>
            </tr>
            <tr>
              <td>
                <code>error</code>
              </td>
              <td>
                <code>string?</code>
              </td>
              <td>Populated when token creation fails.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink
          id="external-purchase-custom-link-notice-result-ios"
          level="h4"
        >
          ExternalPurchaseCustomLinkNoticeResultIOS
        </AnchorLink>
        <p>
          Returned by{' '}
          <Link to="/docs/apis/ios/show-external-purchase-custom-link-notice-ios">
            <code>showExternalPurchaseCustomLinkNoticeIOS</code>
          </Link>{' '}
          (iOS 18.1+).
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
                <code>continued</code>
              </td>
              <td>
                <code>boolean</code>
              </td>
              <td>
                Whether the user chose to continue to the external purchase.
              </td>
            </tr>
            <tr>
              <td>
                <code>error</code>
              </td>
              <td>
                <code>string?</code>
              </td>
              <td>Populated when the sheet failed to present.</td>
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
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;

public sealed record ExternalPurchaseLinkResultIOS
{
    public required bool Success { get; init; }
    public string? Error { get; init; }
}

public sealed record ExternalPurchaseNoticeResultIOS
{
    public required ExternalPurchaseNoticeAction Result { get; init; }
    public string? Error { get; init; }
    // External purchase token returned when Result == Continue.
    public string? ExternalPurchaseToken { get; init; }
}

public enum ExternalPurchaseNoticeAction
{
    Continue,
    Dismissed,
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
              <td>iOS 17.4+ (notice sheet), iOS 18.1+ (custom links)</td>
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
            <strong>Android alternative:</strong> For Android, use{' '}
            <Link to="/docs/apis/android/is-billing-program-available-android">
              <code>isBillingProgramAvailableAndroid</code>
            </Link>
            ,{' '}
            <Link to="/docs/apis/android/launch-external-link-android">
              <code>launchExternalLinkAndroid</code>
            </Link>
            , and{' '}
            <Link to="/docs/apis/android/create-billing-program-reporting-details-android">
              <code>createBillingProgramReportingDetailsAndroid</code>
            </Link>
            .
          </p>
        </blockquote>
      </section>
    </div>
  );
}

export default ExternalPurchaseLink;
