import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import Callout from '../../../../components/Callout';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import StoreConnectionCallout from '../../../../components/StoreConnectionCallout';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function CreateBillingProgramReportingDetailsAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="createBillingProgramReportingDetailsAndroid"
        description="Create fresh Billing Programs reporting details. For External Offer, call immediately before every external-link launch and report the token from your backend after payment."
        path="/docs/apis/android/create-billing-program-reporting-details-android"
        keywords="createBillingProgramReportingDetailsAndroid, reporting details"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        createBillingProgramReportingDetailsAndroid
      </h1>
      <p>
        Creates the reporting details and external transaction token used by a
        Google Play Billing Program. The exact timing depends on the program.
        For External Offer, create fresh details immediately before every
        external-link launch; do not create them after payment or cache them for
        reuse.
      </p>
      <p>
        Wraps{' '}
        <code>
          BillingClient.createBillingProgramReportingDetailsAsync(...)
        </code>{' '}
        — returns the external transaction token used to report a
        Developer-Provided Billing transaction. The Billing Programs surface
        starts in Play Billing 8.2.0, while External Offer integration requires
        Play Billing 8.2.1+. The optional developer billing type parameter is
        available in OpenIAP Spec 2.1.0 and <code>openiap-google</code> 2.3.0
        for Billing Choice, which requires Play Billing 9.1.0+. See the{' '}
        <a
          href="https://developer.android.com/google/play/billing/billing-programs"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Play Billing reference
        </a>
        .
      </p>
      <Callout kind="warning" title="External Offer ordering">
        Check availability, create fresh reporting details immediately before
        the redirect, then call{' '}
        <Link to="/docs/apis/android/launch-external-link-android">
          <code>launchExternalLinkAndroid()</code>
        </Link>
        . After checkout, send that invocation&apos;s token to your backend and
        report the transaction to Google within 24 hours. Never reuse a token
        from an earlier launch attempt. See the complete{' '}
        <Link to="/docs/features/external-purchase">External Offer flow</Link>.
      </Callout>

      <StoreConnectionCallout />

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`// Returns BillingProgramReportingDetailsAndroid with externalTransactionToken
// Token must be reported to Google Play backend within 24 hours
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun createBillingProgramReportingDetails(
    program: BillingProgramAndroid,
    developerBillingType: DeveloperBillingTypeAndroid? = null
): BillingProgramReportingDetailsAndroid`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun createBillingProgramReportingDetailsAndroid(
    program: BillingProgramAndroid,
    developerBillingType: DeveloperBillingTypeAndroid? = null
): BillingProgramReportingDetailsAndroid`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`createBillingProgramReportingDetailsAndroid(
  program: BillingProgramAndroid,
  developerBillingType?: DeveloperBillingTypeAndroid | null
): Promise<BillingProgramReportingDetailsAndroid>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<BillingProgramReportingDetailsAndroid>
    createBillingProgramReportingDetailsAndroid({
  required BillingProgramAndroid program,
  DeveloperBillingTypeAndroid? developerBillingType,
});`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`// Returns BillingProgramReportingDetailsAndroid with externalTransactionToken
// Token must be reported to Google Play backend within 24 hours
// Throws OpenIapError.NotPrepared if billing client not ready
Task<BillingProgramReportingDetailsAndroid> CreateBillingProgramReportingDetailsAndroidAsync(
    BillingProgramAndroid program,
    DeveloperBillingTypeAndroid? developerBillingType = null
);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func create_billing_program_reporting_details_android(
    program: int,
    developer_billing_type = null
) -> BillingProgramReportingDetailsAndroid`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <ul className="api-params">
        <li>
          <code>program</code>{' '}
          <em>
            (required,{' '}
            <Link to="/docs/types/billing-programs#billing-program-android">
              <code>BillingProgramAndroid</code>
            </Link>
            )
          </em>{' '}
          — Billing program identifier.
        </li>
        <li>
          <code>developerBillingType</code>{' '}
          <em>
            (optional,{' '}
            <Link to="/docs/types/billing-programs#developer-billing-type-android">
              <code>DeveloperBillingTypeAndroid</code>
            </Link>
            )
          </em>{' '}
          — Billing Choice reporting destination. Use <code>'in-app'</code> for
          native in-app developer billing, or <code>'external-link'</code> when
          the developer billing option uses a link.
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/billing-programs#billing-program-reporting-details-android">
          <code>Promise&lt;BillingProgramReportingDetailsAndroid&gt;</code>
        </Link>{' '}
        — payload to report a Developer-Provided Billing transaction:
      </p>
      <ul className="api-params">
        <li>
          <code>externalTransactionToken</code>{' '}
          <em>
            (<code>string</code>)
          </em>{' '}
          — Token to send to Google's reporting API. Required for compliance.
        </li>
      </ul>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`// External Offer: create immediately before each launch; never cache.
val details = openIapStore.createBillingProgramReportingDetails(
    BillingProgramAndroid.ExternalOffer
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`// kmp-iap (Android targets only — no-op on iOS)
// External Offer: create immediately before each launch; never cache.
val details = kmpIAP.createBillingProgramReportingDetailsAndroid(
    BillingProgramAndroid.ExternalOffer
)`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { createBillingProgramReportingDetailsAndroid } from 'expo-iap';

if (Platform.OS === 'android') {
  // External Offer: create immediately before each launch; never cache.
  const details = await createBillingProgramReportingDetailsAndroid(
    'external-offer',
  );
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isAndroid) {
  // External Offer: create immediately before each launch; never cache.
  final details = await FlutterInappPurchase.instance
      .createBillingProgramReportingDetailsAndroid(
    program: BillingProgramAndroid.ExternalOffer,
  );
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// External Offer: create immediately before each launch; never cache.
var details = await ((MutationResolver)OpenIapClient.Instance).CreateBillingProgramReportingDetailsAndroidAsync(
    BillingProgramAndroid.ExternalOffer
);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "Android":
    # External Offer: create immediately before each launch; never cache.
    var details = await iap.create_billing_program_reporting_details_android(
        BillingProgramAndroid.EXTERNAL_OFFER
    )`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default CreateBillingProgramReportingDetailsAndroid;
