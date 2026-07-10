import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function ShowBillingProgramInformationDialogAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="showBillingProgramInformationDialogAndroid"
        description="Show the mandatory Play information dialog before a developer-rendered in-app Billing Choice screen."
        path="/docs/apis/android/show-billing-program-information-dialog-android"
        keywords="showBillingProgramInformationDialogAndroid, Billing Choice, Play Billing 9.1.0"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        showBillingProgramInformationDialogAndroid
      </h1>
      <p>
        Shows Google's billing program information dialog for Billing Choice.
        Available in OpenIAP Spec 2.1.0 and <code>openiap-google</code> 2.3.0;
        requires Play Billing 9.1.0+.
      </p>
      <p>
        Wraps{' '}
        <code>BillingClient.showBillingProgramInformationDialog(...)</code>. For
        a developer-rendered, in-app flow, call this after creating an{' '}
        <code>IN_APP</code> reporting token and before showing your choice
        screen. Google-rendered and external-link flows do not use this step.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun showBillingProgramInformationDialog(
    activity: Activity,
    params: BillingProgramInformationDialogParamsAndroid
): BillingResultAndroid`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun showBillingProgramInformationDialogAndroid(
    params: BillingProgramInformationDialogParamsAndroid
): BillingResultAndroid`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`showBillingProgramInformationDialogAndroid(
  params: BillingProgramInformationDialogParamsAndroid
): Promise<BillingResultAndroid>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<BillingResultAndroid> showBillingProgramInformationDialogAndroid(
  BillingProgramInformationDialogParamsAndroid params,
);`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<BillingResultAndroid> ShowBillingProgramInformationDialogAndroidAsync(
    BillingProgramInformationDialogParamsAndroid @params
);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func show_billing_program_information_dialog_android(
    params: BillingProgramInformationDialogParamsAndroid
) -> BillingResultAndroid`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <p>
        Pass one{' '}
        <Link to="/docs/types/billing-programs#billing-program-information-dialog-params-android">
          <code>BillingProgramInformationDialogParamsAndroid</code>
        </Link>
        :
      </p>
      <ul className="api-params">
        <li>
          <code>billingProgram</code>{' '}
          <em>
            (optional,{' '}
            <Link to="/docs/types/billing-programs#billing-program-android">
              <code>BillingProgramAndroid</code>
            </Link>
            )
          </em>{' '}
          - defaults to <code>'billing-choice'</code>.
        </li>
        <li>
          <code>externalTransactionToken</code>{' '}
          <em>
            (required, <code>string</code>)
          </em>{' '}
          - token from{' '}
          <Link to="/docs/apis/android/create-billing-program-reporting-details-android">
            <code>createBillingProgramReportingDetailsAndroid()</code>
          </Link>
          .
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/billing-programs#billing-result-android">
          <code>Promise&lt;BillingResultAndroid&gt;</code>
        </Link>{' '}
        with <code>responseCode</code>, optional <code>debugMessage</code>, and
        optional <code>subResponseCode</code>.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`val result = openIapStore.showBillingProgramInformationDialog(
    activity,
    BillingProgramInformationDialogParamsAndroid(
        billingProgram = BillingProgramAndroid.BillingChoice,
        externalTransactionToken = reportingDetails.externalTransactionToken
    )
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`val result = kmpIAP.showBillingProgramInformationDialogAndroid(
    BillingProgramInformationDialogParamsAndroid(
        billingProgram = BillingProgramAndroid.BillingChoice,
        externalTransactionToken = reportingDetails.externalTransactionToken
    )
)`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`import { showBillingProgramInformationDialogAndroid } from 'expo-iap';

if (Platform.OS === 'android') {
  const result = await showBillingProgramInformationDialogAndroid({
    billingProgram: 'billing-choice',
    externalTransactionToken: reportingDetails.externalTransactionToken,
  });
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isAndroid) {
  final result = await FlutterInappPurchase.instance
      .showBillingProgramInformationDialogAndroid(
    BillingProgramInformationDialogParamsAndroid(
      billingProgram: BillingProgramAndroid.BillingChoice,
      externalTransactionToken: reportingDetails.externalTransactionToken,
    ),
  );
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`var result = await ((MutationResolver)OpenIapClient.Instance)
    .ShowBillingProgramInformationDialogAndroidAsync(
        new BillingProgramInformationDialogParamsAndroid
        {
            BillingProgram = BillingProgramAndroid.BillingChoice,
            ExternalTransactionToken = reportingDetails.ExternalTransactionToken,
        });`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "Android":
    var params = BillingProgramInformationDialogParamsAndroid.new()
    params.billing_program = BillingProgramAndroid.BILLING_CHOICE
    params.external_transaction_token = reporting_details.external_transaction_token
    var result = await iap.show_billing_program_information_dialog_android(params)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default ShowBillingProgramInformationDialogAndroid;
