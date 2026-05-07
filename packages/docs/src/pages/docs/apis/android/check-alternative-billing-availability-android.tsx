import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function CheckAlternativeBillingAvailabilityAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="checkAlternativeBillingAvailabilityAndroid"
        description="Step 1 of alternative billing flow. Check if alternative billing is available for this user/device."
        path="/docs/apis/android/check-alternative-billing-availability-android"
        keywords="checkAlternativeBillingAvailabilityAndroid, alternative billing"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        checkAlternativeBillingAvailabilityAndroid
      </h1>
      <p>
        Step 1 of alternative billing flow. Check if alternative billing is
        available for this user/device.
      </p>
      <p>
        Wraps{' '}
        <code>BillingClient.isAlternativeBillingOnlyAvailableAsync()</code> —
        step 1 of the alternative billing flow. Returns whether the user/device
        is eligible. See the{' '}
        <a
          href="https://developer.android.com/google/play/billing/alternative"
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
            <CodeBlock language="kotlin">{`// Returns true if available, false otherwise
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun checkAlternativeBillingAvailability(): Boolean`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun checkAlternativeBillingAvailabilityAndroid(): Boolean`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`checkAlternativeBillingAvailabilityAndroid(): Promise<boolean>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> checkAlternativeBillingAvailabilityAndroid();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`// Returns true if available, false otherwise
// Throws OpenIapError.NotPrepared if billing client not ready
Task<Boolean> CheckAlternativeBillingAvailabilityAsync()`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func check_alternative_billing_availability_android() -> bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — Whether alternative billing is
        available for this user/device (step 1 of 3).
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`val ok = openIapStore.checkAlternativeBillingAvailability()`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`// kmp-iap (Android targets only — no-op on iOS)
val ok = kmpIAP.checkAlternativeBillingAvailabilityAndroid()`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { checkAlternativeBillingAvailabilityAndroid } from 'expo-iap';

if (Platform.OS === 'android') {
  const ok = await checkAlternativeBillingAvailabilityAndroid();
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isAndroid) {
  final ok = await FlutterInappPurchase.instance
      .checkAlternativeBillingAvailabilityAndroid();
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var ok = await ((QueryResolver)Iap.Instance).CheckAlternativeBillingAvailabilityAsync()`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "Android":
    var ok: bool = await iap.check_alternative_billing_availability_android()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default CheckAlternativeBillingAvailabilityAndroid;
