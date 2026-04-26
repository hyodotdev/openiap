import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function LaunchExternalLinkAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="launchExternalLinkAndroid"
        description="Step 2 of Billing Programs API. Launch external link flow — shows Play Store dialog and optionally launches external URL."
        path="/docs/apis/android/launch-external-link-android"
        keywords="launchExternalLinkAndroid, External Link, External Offer"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        launchExternalLinkAndroid
      </h1>
      <p>
        Step 2 of Billing Programs API. Launch external link flow — shows Play
        Store dialog and optionally launches external URL.
      </p>
      <p>
        Wraps <code>BillingClient.launchExternalLinkFlow(activity, params)</code>{' '}
        — replaces <code>showExternalOfferInformationDialog</code>. Shows the
        Play disclosure dialog and (optionally) launches the URL. Play Billing
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
            <CodeBlock language="kotlin">{`// Returns true if launched successfully
// Throws OpenIapError.NotPrepared if billing client not ready
suspend fun launchExternalLink(
    activity: Activity,
    params: LaunchExternalLinkParamsAndroid
): Boolean

// LaunchExternalLinkParamsAndroid:
// - billingProgram: BillingProgramAndroid
// - launchMode: ExternalLinkLaunchModeAndroid
// - linkType: ExternalLinkTypeAndroid
// - linkUri: String`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default LaunchExternalLinkAndroid;
