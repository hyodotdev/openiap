import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import StoreConnectionCallout from '../../../../components/StoreConnectionCallout';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function ShowAlternativeBillingOnlyInformationDialogAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="showAlternativeBillingOnlyInformationDialogAndroid"
        description="Show the Google Play Alternative Billing Only information dialog before each checkout."
        path="/docs/apis/android/show-alternative-billing-only-information-dialog-android"
        keywords="showAlternativeBillingOnlyInformationDialogAndroid, Alternative Billing Only, Play Billing 6.1"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        showAlternativeBillingOnlyInformationDialogAndroid
      </h1>
      <p>
        Shows Google's information dialog for an app that offers only its own
        in-app payment system. Requires Play Billing 6.1+ and a connection
        opened with the <code>alternative-billing-only</code> billing program.
      </p>
      <p>
        Wraps{' '}
        <code>
          BillingClient.showAlternativeBillingOnlyInformationDialog(...)
        </code>
        . Call it before each checkout attempt and continue only when the result
        has <code>responseCode</code> <code>0</code>. The full flow is in{' '}
        <Link to="/docs/features/external-purchase#alternative-billing-only">
          Alternative Billing Only
        </Link>
        .
      </p>

      <StoreConnectionCallout />

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun showAlternativeBillingOnlyInformationDialog(
    activity: Activity
): BillingResultAndroid`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun showAlternativeBillingOnlyInformationDialogAndroid(): BillingResultAndroid`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`showAlternativeBillingOnlyInformationDialogAndroid(): Promise<BillingResultAndroid>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<BillingResultAndroid> showAlternativeBillingOnlyInformationDialogAndroid();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<BillingResultAndroid> ShowAlternativeBillingOnlyInformationDialogAndroidAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func show_alternative_billing_only_information_dialog_android() -> BillingResultAndroid`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

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
      <p>
        When the dialog fails, Godot returns <code>response_code</code> 6 (
        <code>ERROR</code>) with <code>debug_message</code> set and emits{' '}
        <code>purchase_error</code>.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`val result = openIapStore.showAlternativeBillingOnlyInformationDialog(activity)
if (result.responseCode == 0) {
    // Create the reporting token, then open your checkout.
}`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`val result = kmpIAP.showAlternativeBillingOnlyInformationDialogAndroid()
if (result.responseCode == 0) {
    // Create the reporting token, then open your checkout.
}`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`import { showAlternativeBillingOnlyInformationDialogAndroid } from 'expo-iap';

if (Platform.OS === 'android') {
  const result = await showAlternativeBillingOnlyInformationDialogAndroid();
  if (result.responseCode === 0) {
    // Create the reporting token, then open your checkout.
  }
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isAndroid) {
  final result = await FlutterInappPurchase.instance
      .showAlternativeBillingOnlyInformationDialogAndroid();
  if (result.responseCode == 0) {
    // Create the reporting token, then open your checkout.
  }
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`var result = await OpenIapClient.Mutation
    .ShowAlternativeBillingOnlyInformationDialogAndroidAsync();
if (result.ResponseCode == 0)
{
    // Create the reporting token, then open your checkout.
}`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "Android":
    var result = iap.show_alternative_billing_only_information_dialog_android()
    if result.response_code == 0:
        pass # Create the reporting token, then open your checkout.`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default ShowAlternativeBillingOnlyInformationDialogAndroid;
