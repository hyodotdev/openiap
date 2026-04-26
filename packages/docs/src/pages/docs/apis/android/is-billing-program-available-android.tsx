import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function IsBillingProgramAvailableAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="isBillingProgramAvailableAndroid"
        description="Step 1 of Billing Programs API. Check if a billing program is available for the current user."
        path="/docs/apis/android/is-billing-program-available-android"
        keywords="isBillingProgramAvailableAndroid, Billing Programs API, availability"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        isBillingProgramAvailableAndroid
      </h1>
      <p>
        Step 1 of Billing Programs API. Check if a billing program is available
        for the current user.
      </p>
      <p>
        Wraps{' '}
        <code>
          BillingClient.isBillingProgramAvailableAsync(BillingProgram)
        </code>{' '}
        — replaces <code>isExternalOfferAvailableAsync</code>. Play Billing
        8.2.0+. See the{' '}
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
            <CodeBlock language="kotlin">{`// Returns BillingProgramAvailabilityResultAndroid with isAvailable flag
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun isBillingProgramAvailable(
    program: BillingProgramAndroid
): BillingProgramAvailabilityResultAndroid`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun isBillingProgramAvailableAndroid(
    program: BillingProgramAndroid
): BillingProgramAvailabilityResultAndroid`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`isBillingProgramAvailableAndroid(
  program: BillingProgramAndroid
): Promise<BillingProgramAvailabilityResultAndroid>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<BillingProgramAvailabilityResultAndroid>
    isBillingProgramAvailableAndroid(BillingProgramAndroid program);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func is_billing_program_available_android(
    program: int
) -> BillingProgramAvailabilityResultAndroid`}</CodeBlock>
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
        <Link to="/docs/types/billing-programs#billing-program-availability-result-android">
          <code>Promise&lt;BillingProgramAvailabilityResultAndroid&gt;</code>
        </Link>{' '}
        — carries:
      </p>
      <ul className="api-params">
        <li>
          <code>isAvailable</code>{' '}
          <em>
            (<code>boolean</code>)
          </em>{' '}
          — Whether the billing program is available for this user/device.
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
            <CodeBlock language="kotlin">{`val result = openIapStore.isBillingProgramAvailable(
    BillingProgramAndroid.ExternalOffer
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`// kmp-iap (Android targets only — no-op on iOS)
val result = kmpIAP.isBillingProgramAvailableAndroid(
    BillingProgramAndroid.ExternalOffer
)`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { isBillingProgramAvailableAndroid } from 'expo-iap';

if (Platform.OS === 'android') {
  const result = await isBillingProgramAvailableAndroid('external-offer');
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isAndroid) {
  final result = await FlutterInappPurchase.instance
      .isBillingProgramAvailableAndroid(BillingProgramAndroid.externalOffer);
}`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "Android":
    var result = await iap.is_billing_program_available_android(
        BillingProgramAndroid.EXTERNAL_OFFER
    )`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default IsBillingProgramAvailableAndroid;
