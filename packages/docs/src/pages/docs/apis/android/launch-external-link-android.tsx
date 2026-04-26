import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
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
        Wraps{' '}
        <code>
          BillingClient.launchExternalLink(activity, params, listener)
        </code>{' '}
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
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun launchExternalLinkAndroid(
    params: LaunchExternalLinkParamsAndroid
): Boolean`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`launchExternalLinkAndroid(
  params: LaunchExternalLinkParamsAndroid
): Promise<boolean>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> launchExternalLinkAndroid(
  LaunchExternalLinkParamsAndroid params,
);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func launch_external_link_android(
    params: LaunchExternalLinkParamsAndroid
) -> bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <p>
        Pass a single{' '}
        <Link to="/docs/types/billing-programs#launch-external-link-params-android">
          <code>LaunchExternalLinkParamsAndroid</code>
        </Link>
        :
      </p>
      <ul className="api-params">
        <li>
          <code>billingProgram</code>{' '}
          <em>
            (required,{' '}
            <Link to="/docs/types/billing-programs#billing-program-android">
              <code>BillingProgramAndroid</code>
            </Link>
            )
          </em>{' '}
          — Billing program the link belongs to (e.g.{' '}
          <code>EXTERNAL_CONTENT_LINK</code> or <code>EXTERNAL_OFFER</code>).
        </li>
        <li>
          <code>launchMode</code>{' '}
          <em>
            (required, <code>ExternalLinkLaunchModeAndroid</code>)
          </em>{' '}
          — How the link is presented (in-app browser, system browser, etc.).
        </li>
        <li>
          <code>linkType</code>{' '}
          <em>
            (required, <code>ExternalLinkTypeAndroid</code>)
          </em>{' '}
          — Type of the external link (e.g. offer page).
        </li>
        <li>
          <code>linkUri</code>{' '}
          <em>
            (required, <code>string</code>)
          </em>{' '}
          — External URI to launch after the Play disclosure dialog dismisses.
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> once the Play
        disclosure dialog finished and (optionally) the URL was opened.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`openIapStore.launchExternalLink(
    activity,
    LaunchExternalLinkParamsAndroid(
        billingProgram = BillingProgramAndroid.ExternalOffer,
        launchMode = ExternalLinkLaunchModeAndroid.IN_APP_BROWSER,
        linkType = ExternalLinkTypeAndroid.OFFER,
        linkUri = "https://example.com/offer"
    )
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`// kmp-iap (Android targets only — no-op on iOS)
kmpIAP.launchExternalLinkAndroid(
    LaunchExternalLinkParamsAndroid(
        billingProgram = BillingProgramAndroid.ExternalOffer,
        launchMode = ExternalLinkLaunchModeAndroid.IN_APP_BROWSER,
        linkType = ExternalLinkTypeAndroid.OFFER,
        linkUri = "https://example.com/offer"
    )
)`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { launchExternalLinkAndroid } from 'expo-iap';

if (Platform.OS === 'android') {
  await launchExternalLinkAndroid({
    billingProgram: 'external-offer',
    launchMode: 'in-app-browser',
    linkType: 'offer',
    linkUri: 'https://example.com/offer',
  });
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isAndroid) {
  await FlutterInappPurchase.instance.launchExternalLinkAndroid(
    LaunchExternalLinkParamsAndroid(
      billingProgram: BillingProgramAndroid.externalOffer,
      launchMode: ExternalLinkLaunchModeAndroid.inAppBrowser,
      linkType: ExternalLinkTypeAndroid.offer,
      linkUri: 'https://example.com/offer',
    ),
  );
}`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "Android":
    var params = LaunchExternalLinkParamsAndroid.new()
    params.billing_program = BillingProgramAndroid.EXTERNAL_OFFER
    params.launch_mode = ExternalLinkLaunchModeAndroid.IN_APP_BROWSER
    params.link_type = ExternalLinkTypeAndroid.OFFER
    params.link_uri = "https://example.com/offer"
    await iap.launch_external_link_android(params)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default LaunchExternalLinkAndroid;
