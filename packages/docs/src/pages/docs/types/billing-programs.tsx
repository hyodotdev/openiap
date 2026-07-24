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
          content links. Version 8.3.0 adds External Payments for Japan, and
          9.1.0 adds Billing Choice. OpenIAP exposes Billing Choice in Spec
          2.1.0 and <code>openiap-google</code> 2.3.0.
        </p>
        <p>
          Identifiers for Play Billing programs. <strong>Android only</strong> (
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
          {' · '}
          <a
            href="https://developer.android.com/google/play/billing/release-notes#9-1-0"
            target="_blank"
            rel="noopener noreferrer"
          >
            9.1.0 release notes
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
            <tr>
              <td>
                <code>BILLING_CHOICE</code>
              </td>
              <td>
                Present Google Play Billing alongside an alternative in-app
                billing system or external web link
              </td>
              <td>9.1.0+</td>
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
            <tr>
              <td>
                <code>choiceScreenType</code>
              </td>
              <td>
                <Link to="/docs/types/billing-programs#billing-choice-screen-type-android">
                  <code>BillingChoiceScreenTypeAndroid</code>
                </Link>
                <code> | null</code>
              </td>
              <td>
                Billing Choice renderer. Present only for available{' '}
                <code>BILLING_CHOICE</code> checks.
              </td>
            </tr>
            <tr>
              <td>
                <code>isExternalLinkAvailable</code>
              </td>
              <td>
                <code>boolean | null</code>
              </td>
              <td>
                Whether external-link developer billing is available for Billing
                Choice.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="billing-choice-screen-type-android" level="h3">
          BillingChoiceScreenTypeAndroid
        </AnchorLink>
        <p>How the Billing Choice screen should be rendered (9.1.0+):</p>
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
              <td>Unspecified renderer.</td>
            </tr>
            <tr>
              <td>
                <code>DEVELOPER_RENDERED</code>
              </td>
              <td>
                The app renders the Billing Choice screen using{' '}
                <Link to="/docs/apis/android/get-billing-choice-info-android">
                  <code>getBillingChoiceInfoAndroid()</code>
                </Link>
                .
              </td>
            </tr>
            <tr>
              <td>
                <code>GOOGLE_RENDERED</code>
              </td>
              <td>
                Google Play renders the Billing Choice screen and information
                dialog.
              </td>
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

        <AnchorLink id="developer-billing-type-android" level="h3">
          DeveloperBillingTypeAndroid
        </AnchorLink>
        <p>
          Developer billing destination type used when creating Billing Choice
          reporting details (9.1.0+):
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
                <code>DEVELOPER_BILLING_TYPE_UNSPECIFIED</code>
              </td>
              <td>Unspecified type. Do not use.</td>
            </tr>
            <tr>
              <td>
                <code>IN_APP</code>
              </td>
              <td>Developer-provided billing inside the app.</td>
            </tr>
            <tr>
              <td>
                <code>EXTERNAL_LINK</code>
              </td>
              <td>Developer-provided billing via an external link.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="billing-result-android" level="h3">
          BillingResultAndroid
        </AnchorLink>
        <p>Billing operation result returned by Billing Choice dialogs:</p>
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
                <code>responseCode</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>Play Billing response code.</td>
            </tr>
            <tr>
              <td>
                <code>debugMessage</code>
              </td>
              <td>
                <code>string | null</code>
              </td>
              <td>Optional Play Billing debug message.</td>
            </tr>
            <tr>
              <td>
                <code>subResponseCode</code>
              </td>
              <td>
                <code>SubResponseCodeAndroid | null</code>
              </td>
              <td>Optional granular response code.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="billing-choice-image-layout-android" level="h3">
          BillingChoiceImageLayoutAndroid
        </AnchorLink>
        <p>Image layout requested for developer-rendered Billing Choice:</p>
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
                <code>RECTANGULAR_FOUR_BY_ONE</code>
              </td>
              <td>Rectangular image with a 4:1 aspect ratio.</td>
            </tr>
            <tr>
              <td>
                <code>RECTANGULAR_THREE_BY_ONE</code>
              </td>
              <td>Rectangular image with a 3:1 aspect ratio.</td>
            </tr>
            <tr>
              <td>
                <code>RECTANGULAR_TWO_BY_TWO</code>
              </td>
              <td>Rectangular image with a 2:2 aspect ratio.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="get-billing-choice-info-params-android" level="h3">
          GetBillingChoiceInfoParamsAndroid
        </AnchorLink>
        <p>
          Parameters for{' '}
          <Link to="/docs/apis/android/get-billing-choice-info-android">
            <code>getBillingChoiceInfoAndroid()</code>
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
                Billing program. Defaults to <code>BILLING_CHOICE</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>playBillingChoiceImageLayout</code>
              </td>
              <td>
                <Link to="/docs/types/billing-programs#billing-choice-image-layout-android">
                  <code>BillingChoiceImageLayoutAndroid</code>
                </Link>
              </td>
              <td>
                Requested image layout. Defaults to{' '}
                <code>RECTANGULAR_FOUR_BY_ONE</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>userLocale</code>
              </td>
              <td>
                <code>string | null</code>
              </td>
              <td>Optional BCP 47 locale tag.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="billing-choice-info-android" level="h3">
          BillingChoiceInfoAndroid
        </AnchorLink>
        <p>
          Display information for developer-rendered Billing Choice screens:
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
                <code>playBillingChoiceImageUrl</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Play Billing image URL for the requested layout.</td>
            </tr>
            <tr>
              <td>
                <code>playBillingLoyaltyInfo</code>
              </td>
              <td>
                <code>string | null</code>
              </td>
              <td>Optional Play loyalty information for the user.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink
          id="billing-program-information-dialog-params-android"
          level="h3"
        >
          BillingProgramInformationDialogParamsAndroid
        </AnchorLink>
        <p>
          Parameters for{' '}
          <Link to="/docs/apis/android/show-billing-program-information-dialog-android">
            <code>showBillingProgramInformationDialogAndroid()</code>
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
                Billing program. Defaults to <code>BILLING_CHOICE</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>externalTransactionToken</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Billing Choice reporting token.</td>
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
                The billing program (<code>EXTERNAL_CONTENT_LINK</code>,{' '}
                <code>EXTERNAL_OFFER</code>, or <code>BILLING_CHOICE</code>)
              </td>
            </tr>
            <tr>
              <td>
                <code>externalTransactionToken</code>
              </td>
              <td>
                <code>string | null</code>
              </td>
              <td>
                Pre-generated token for a developer-rendered Billing Choice
                external-link flow (9.1.0+)
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
          (8.3.0+; Billing Choice also uses this shape in 9.1.0+):
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
                The billing program (usually <code>EXTERNAL_PAYMENTS</code> or{' '}
                <code>BILLING_CHOICE</code>)
              </td>
            </tr>
            <tr>
              <td>
                <code>linkUri</code>
              </td>
              <td>
                <code>string | null</code>
              </td>
              <td>
                URL for an external-link flow. Omit it for an in-app Billing
                Choice flow.
              </td>
            </tr>
            <tr>
              <td>
                <code>launchMode</code>
              </td>
              <td>
                <Link to="/docs/types/billing-programs#developer-billing-launch-mode">
                  <code>DeveloperBillingLaunchModeAndroid</code>
                </Link>
                <code> | null</code>
              </td>
              <td>
                How to launch an external link. Omit it when no link is used.
              </td>
            </tr>
            <tr>
              <td>
                <code>externalTransactionToken</code>
              </td>
              <td>
                <code>string | null</code>
              </td>
              <td>
                Optional pre-generated token for a Billing Choice external-link
                flow.
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          For an in-app Billing Choice flow, pass only{' '}
          <code>billingProgram: BILLING_CHOICE</code>. Add <code>linkUri</code>,{' '}
          <code>launchMode</code>, and optionally{' '}
          <code>externalTransactionToken</code> only for an external-link flow.
        </p>

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
        <p>
          Details received when a user selects developer billing (8.3.0+;
          expanded in Billing 9.0 and 9.1):
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
                <code>externalTransactionToken</code>
              </td>
              <td>
                <code>string | null</code>
              </td>
              <td>
                Token used for external transaction reporting when one is
                returned for the selected flow.
              </td>
            </tr>
            <tr>
              <td>
                <code>linkUri</code>
              </td>
              <td>
                <code>string | null</code>
              </td>
              <td>Link for a Billing Choice external-link flow.</td>
            </tr>
            <tr>
              <td>
                <code>originalExternalTransactionId</code>
              </td>
              <td>
                <code>string | null</code>
              </td>
              <td>
                Original developer-billed subscription transaction being
                replaced.
              </td>
            </tr>
            <tr>
              <td>
                <code>products</code>
              </td>
              <td>
                <code>DeveloperProvidedBillingProductAndroid[]</code>
              </td>
              <td>Products selected for the developer billing flow.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="developer-provided-billing-product" level="h3">
          DeveloperProvidedBillingProductAndroid
        </AnchorLink>
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
                <code>id</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Google Play product identifier.</td>
            </tr>
            <tr>
              <td>
                <code>type</code>
              </td>
              <td>
                <code>ProductType</code>
              </td>
              <td>
                Normalized product type: <code>IN_APP</code> or{' '}
                <code>SUBS</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>offerToken</code>
              </td>
              <td>
                <code>string | null</code>
              </td>
              <td>Subscription offer token, when applicable.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="in-app-message-category-android" level="h3">
          InAppMessageCategoryAndroid
        </AnchorLink>
        <p>In-app billing message categories:</p>
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
                <code>UNKNOWN_IN_APP_MESSAGE_CATEGORY_ID</code>
              </td>
              <td>Unknown category. Do not use.</td>
            </tr>
            <tr>
              <td>
                <code>TRANSACTIONAL</code>
              </td>
              <td>
                Transactional billing messages, such as subscription status
                changes.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="in-app-message-params-android" level="h3">
          InAppMessageParamsAndroid
        </AnchorLink>
        <p>
          Parameters for{' '}
          <Link to="/docs/apis/android/show-in-app-messages-android">
            <code>showInAppMessagesAndroid()</code>
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
                <code>categories</code>
              </td>
              <td>
                <Link to="/docs/types/billing-programs#in-app-message-category-android">
                  <code>InAppMessageCategoryAndroid[]</code>
                </Link>
                <code> | null</code>
              </td>
              <td>
                Categories to show. Defaults to <code>TRANSACTIONAL</code>.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="in-app-message-response-code-android" level="h3">
          InAppMessageResponseCodeAndroid
        </AnchorLink>
        <p>Result code returned by Play billing in-app messages:</p>
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
                <code>NO_ACTION_NEEDED</code>
              </td>
              <td>Flow finished and no developer action is needed.</td>
            </tr>
            <tr>
              <td>
                <code>SUBSCRIPTION_STATUS_UPDATED</code>
              </td>
              <td>
                Subscription status changed; refresh the purchase referenced by
                the returned token.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="in-app-message-result-android" level="h3">
          InAppMessageResultAndroid
        </AnchorLink>
        <p>Result of showing Play billing in-app messages:</p>
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
                <code>responseCode</code>
              </td>
              <td>
                <Link to="/docs/types/billing-programs#in-app-message-response-code-android">
                  <code>InAppMessageResponseCodeAndroid</code>
                </Link>
              </td>
              <td>Flow result.</td>
            </tr>
            <tr>
              <td>
                <code>purchaseToken</code>
              </td>
              <td>
                <code>string | null</code>
              </td>
              <td>
                Purchase token returned when a subscription status changed.
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
  console.log('External transaction token received; send it to your backend without logging it.');
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
    Log.d("IAP", "External transaction token received; send it to your backend without logging it.")
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
  enableBillingProgramAndroid: BillingProgramAndroid.ExternalPayments,
);

// Listen for developer billing selection
final developerBillingSubscription = FlutterInappPurchase.instance
    .developerProvidedBillingAndroid
    .listen((details) {
  print('External transaction token received; send it to your backend without logging it.');
  // Report token to Google via your backend within 24 hours
});

// Check availability (Japan only)
final result = await FlutterInappPurchase.instance
    .isBillingProgramAvailableAndroid(BillingProgramAndroid.ExternalPayments);
if (result.isAvailable) {
  // Purchase with developer billing option
  await FlutterInappPurchase.instance.requestPurchase(
    RequestPurchaseProps.inApp((
      apple: null,
      google: RequestPurchaseAndroidProps(
        skus: ['product_id'],
        developerBillingOption: DeveloperBillingOptionParamsAndroid(
          billingProgram: BillingProgramAndroid.ExternalPayments,
          linkUri: 'https://your-site.com/checkout',
          launchMode: DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp,
        ),
      ),
      // Compatibility-only placeholder required by the generated 9.x record.
      useAlternativeBilling: null,
    )),
  );
}

await developerBillingSubscription.cancel();`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;
using System;

// Enable External Payments via InitConnectionConfig.
await ((MutationResolver)OpenIapClient.Instance).InitConnectionAsync(new InitConnectionConfig
{
    EnableBillingProgramAndroid = BillingProgramAndroid.ExternalPayments,
});

// Listen for developer billing selection.
using var subscription = OpenIapClient.Instance.DeveloperProvidedBillingAndroid.Subscribe(details =>
{
    Console.WriteLine("External transaction token received; send it to your backend without logging it.");
    // Report token to Google via your backend within 24 hours.
});

// Check availability (Japan only).
var result = await ((MutationResolver)OpenIapClient.Instance)
    .IsBillingProgramAvailableAndroidAsync(BillingProgramAndroid.ExternalPayments);
if (result.IsAvailable)
{
    // Purchase with developer billing option
    var props = new RequestPurchaseProps
    {
        RequestPurchase = new RequestPurchasePropsByPlatforms
        {
            Google = new RequestPurchaseAndroidProps
            {
                Skus = new[] { "product_id" },
                DeveloperBillingOption = new DeveloperBillingOptionParamsAndroid
                {
                    BillingProgram = BillingProgramAndroid.ExternalPayments,
                    LinkUri = "https://your-site.com/checkout",
                    LaunchMode = DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp,
                },
            },
        },
        Type = ProductQueryType.InApp,
    };
    await ((MutationResolver)OpenIapClient.Instance).RequestPurchaseAsync(props);
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Enable External Payments via InitConnectionConfig
var config = InitConnectionConfig.new()
config.enable_billing_program_android = BillingProgramAndroid.EXTERNAL_PAYMENTS
await iap.init_connection(config)

# Listen for developer billing selection
func _on_developer_provided_billing(details: DeveloperProvidedBillingDetailsAndroid):
    print("External transaction token received; send it to your backend without logging it.")
    # Report token to Google via your backend within 24 hours

iap.developer_provided_billing_android.connect(_on_developer_provided_billing)

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

        <div className="alert-card alert-card--warning">
          <p>
            <strong>Flutter 9.x record compatibility:</strong>{' '}
            <code>useAlternativeBilling: null</code> in the Dart example is only
            a required placeholder in the generated positional record. Configure{' '}
            <code>enableBillingProgramAndroid</code> on{' '}
            <code>initConnection</code>; do not use the deprecated field to
            select a program. It is removed in{' '}
            <code>flutter_inapp_purchase 10.0.0</code>. See the{' '}
            <Link to="/docs/updates/deprecations#flutter-10-package-migrations">
              Flutter 10 migration notes
            </Link>
            .
          </p>
        </div>

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
