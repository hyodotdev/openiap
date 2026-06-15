import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function CreateBillingProgramReportingDetailsAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="createBillingProgramReportingDetailsAndroid"
        description="Step 3 of Billing Programs API. Create reporting details with external transaction token after successful payment."
        path="/docs/apis/android/create-billing-program-reporting-details-android"
        keywords="createBillingProgramReportingDetailsAndroid, reporting details"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        createBillingProgramReportingDetailsAndroid
      </h1>
      <p>
        Step 3 of Billing Programs API. Create reporting details with external
        transaction token after successful payment.
      </p>
      <p>
        Wraps{' '}
        <code>
          BillingClient.createBillingProgramReportingDetailsAsync(BillingProgram)
        </code>{' '}
        — returns the external transaction token to report a Developer-Provided
        Billing transaction. Play Billing 8.3.0+. See the{' '}
        <a
          href="https://developer.android.com/google/play/billing/billing-programs"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Play Billing reference
        </a>
        .
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`// Returns BillingProgramReportingDetailsAndroid with externalTransactionToken
// Token must be reported to Google Play backend within 24 hours
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun createBillingProgramReportingDetails(
    program: BillingProgramAndroid
): BillingProgramReportingDetailsAndroid`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun createBillingProgramReportingDetailsAndroid(
    program: BillingProgramAndroid
): BillingProgramReportingDetailsAndroid`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`createBillingProgramReportingDetailsAndroid(
  program: BillingProgramAndroid
): Promise<BillingProgramReportingDetailsAndroid>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<BillingProgramReportingDetailsAndroid>
    createBillingProgramReportingDetailsAndroid(
  BillingProgramAndroid program,
);`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`// Returns BillingProgramReportingDetailsAndroid with externalTransactionToken
// Token must be reported to Google Play backend within 24 hours
// Throws OpenIapError.NotPrepared if billing client not ready
Task<BillingProgramReportingDetailsAndroid> CreateBillingProgramReportingDetailsAndroidAsync(BillingProgramAndroid program);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func create_billing_program_reporting_details_android(
    program: int
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
        <li>
          <code>responseCode</code>{' '}
          <em>
            (<code>number?</code>)
          </em>{' '}
          — Raw Play Billing response code (when Play returned one).
        </li>
        <li>
          <code>debugMessage</code>{' '}
          <em>
            (<code>string?</code>)
          </em>{' '}
          — Optional debug message from Play.
        </li>
      </ul>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`val details = openIapStore.createBillingProgramReportingDetails(
    BillingProgramAndroid.ExternalOffer
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`// kmp-iap (Android targets only — no-op on iOS)
val details = kmpIAP.createBillingProgramReportingDetailsAndroid(
    BillingProgramAndroid.ExternalOffer
)`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { createBillingProgramReportingDetailsAndroid } from 'expo-iap';

if (Platform.OS === 'android') {
  const details = await createBillingProgramReportingDetailsAndroid(
    'external-offer',
  );
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isAndroid) {
  final details = await FlutterInappPurchase.instance
      .createBillingProgramReportingDetailsAndroid(
    BillingProgramAndroid.externalOffer,
  );
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var details = await ((MutationResolver)OpenIapClient.Instance).CreateBillingProgramReportingDetailsAndroidAsync(
    BillingProgramAndroid.ExternalOffer
);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "Android":
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
