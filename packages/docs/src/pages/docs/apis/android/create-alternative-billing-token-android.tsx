import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function CreateAlternativeBillingTokenAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="createAlternativeBillingTokenAndroid"
        description="Step 3 of alternative billing flow. Create external transaction token for Google Play reporting."
        path="/docs/apis/android/create-alternative-billing-token-android"
        keywords="createAlternativeBillingTokenAndroid, external transaction token"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        createAlternativeBillingTokenAndroid
      </h1>
      <p>
        Step 3 of alternative billing flow. Create external transaction token
        for Google Play reporting.
      </p>
      <p>
        Wraps{' '}
        <code>
          BillingClient.createAlternativeBillingOnlyReportingDetailsAsync()
        </code>{' '}
        — step 3. Token must be reported to Google within 24h of payment. See
        the{' '}
        <a
          href="https://developer.android.com/google/play/billing/alternative"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Play Billing reference
        </a>
        .
      </p>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;string | null&gt;</code> — Reporting token to send to
        Google within 24h, or <code>null</code> if creation failed (step 3 of
        3).
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`// Token must be reported to Google Play backend within 24 hours
// Returns token string, or null if creation failed
suspend fun createAlternativeBillingToken(): String?`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun createAlternativeBillingTokenAndroid(): String?`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`createAlternativeBillingTokenAndroid(): Promise<string | null>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<String?> createAlternativeBillingTokenAndroid();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func create_alternative_billing_token_android() -> String`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`val token = openIapStore.createAlternativeBillingToken()`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`// kmp-iap (Android targets only — no-op on iOS)
val token = kmpIAP.createAlternativeBillingTokenAndroid()`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { createAlternativeBillingTokenAndroid } from 'expo-iap';

if (Platform.OS === 'android') {
  const token = await createAlternativeBillingTokenAndroid();
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isAndroid) {
  final token = await FlutterInappPurchase.instance
      .createAlternativeBillingTokenAndroid();
}`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "Android":
    var token: String = await iap.create_alternative_billing_token_android()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default CreateAlternativeBillingTokenAndroid;
