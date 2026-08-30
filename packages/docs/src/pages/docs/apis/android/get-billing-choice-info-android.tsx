import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import StoreConnectionCallout from '../../../../components/StoreConnectionCallout';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function GetBillingChoiceInfoAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getBillingChoiceInfoAndroid"
        description="Fetch Play Billing Choice display assets for developer-rendered Billing Choice screens."
        path="/docs/apis/android/get-billing-choice-info-android"
        keywords="getBillingChoiceInfoAndroid, Billing Choice, Play Billing 9.1.0"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        getBillingChoiceInfoAndroid
      </h1>
      <p>
        Fetches Google Play Billing Choice display information for
        developer-rendered choice screens. Available in OpenIAP Spec 2.1.0 and{' '}
        <code>openiap-google</code> 2.3.0; requires Play Billing 9.1.0+.
      </p>
      <p>
        Wraps <code>BillingClient.getBillingChoiceInfoAsync(...)</code>. Call
        this when{' '}
        <Link to="/docs/apis/android/is-billing-program-available-android">
          <code>isBillingProgramAvailableAndroid('billing-choice')</code>
        </Link>{' '}
        returns <code>choiceScreenType: 'developer-rendered'</code>.
      </p>

      <StoreConnectionCallout />

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun getBillingChoiceInfo(
    params: GetBillingChoiceInfoParamsAndroid
): BillingChoiceInfoAndroid`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun getBillingChoiceInfoAndroid(
    params: GetBillingChoiceInfoParamsAndroid
): BillingChoiceInfoAndroid`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`getBillingChoiceInfoAndroid(
  params: GetBillingChoiceInfoParamsAndroid
): Promise<BillingChoiceInfoAndroid>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<BillingChoiceInfoAndroid> getBillingChoiceInfoAndroid({
  required BillingProgramAndroid billingProgram,
  required BillingChoiceImageLayoutAndroid playBillingChoiceImageLayout,
  String? userLocale,
});`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<BillingChoiceInfoAndroid> GetBillingChoiceInfoAndroidAsync(
    GetBillingChoiceInfoParamsAndroid @params
);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func get_billing_choice_info_android(
    params: GetBillingChoiceInfoParamsAndroid
) -> BillingChoiceInfoAndroid`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <p>
        Pass one{' '}
        <Link to="/docs/types/billing-programs#get-billing-choice-info-params-android">
          <code>GetBillingChoiceInfoParamsAndroid</code>
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
          <code>playBillingChoiceImageLayout</code>{' '}
          <em>
            (optional,{' '}
            <Link to="/docs/types/billing-programs#billing-choice-image-layout-android">
              <code>BillingChoiceImageLayoutAndroid</code>
            </Link>
            )
          </em>{' '}
          - defaults to <code>'rectangular-four-by-one'</code>.
        </li>
        <li>
          <code>userLocale</code>{' '}
          <em>
            (optional, <code>string | null</code>)
          </em>{' '}
          - BCP 47 locale tag. Omit it to use the user's default locale.
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/billing-programs#billing-choice-info-android">
          <code>Promise&lt;BillingChoiceInfoAndroid&gt;</code>
        </Link>{' '}
        with:
      </p>
      <ul className="api-params">
        <li>
          <code>playBillingChoiceImageUrl</code>{' '}
          <em>
            (<code>string</code>)
          </em>{' '}
          - Google Play image URL for the requested layout.
        </li>
        <li>
          <code>playBillingLoyaltyInfo</code>{' '}
          <em>
            (<code>string | null</code>)
          </em>{' '}
          - Optional Play loyalty text for the user.
        </li>
      </ul>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`val info = openIapStore.getBillingChoiceInfo(
    GetBillingChoiceInfoParamsAndroid(
        billingProgram = BillingProgramAndroid.BillingChoice,
        playBillingChoiceImageLayout = BillingChoiceImageLayoutAndroid.RectangularFourByOne
    )
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`val info = kmpIAP.getBillingChoiceInfoAndroid(
    GetBillingChoiceInfoParamsAndroid(
        billingProgram = BillingProgramAndroid.BillingChoice,
        playBillingChoiceImageLayout = BillingChoiceImageLayoutAndroid.RectangularFourByOne
    )
)`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`import { getBillingChoiceInfoAndroid } from 'expo-iap';

if (Platform.OS === 'android') {
  const info = await getBillingChoiceInfoAndroid({
    billingProgram: 'billing-choice',
    playBillingChoiceImageLayout: 'rectangular-four-by-one',
  });
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isAndroid) {
  final info = await FlutterInappPurchase.instance.getBillingChoiceInfoAndroid(
    billingProgram: BillingProgramAndroid.BillingChoice,
    playBillingChoiceImageLayout:
        BillingChoiceImageLayoutAndroid.RectangularFourByOne,
  );
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`var info = await ((QueryResolver)OpenIapClient.Instance).GetBillingChoiceInfoAndroidAsync(
    new GetBillingChoiceInfoParamsAndroid
    {
        BillingProgram = BillingProgramAndroid.BillingChoice,
        PlayBillingChoiceImageLayout = BillingChoiceImageLayoutAndroid.RectangularFourByOne,
    });`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "Android":
    var params = GetBillingChoiceInfoParamsAndroid.new()
    params.billing_program = BillingProgramAndroid.BILLING_CHOICE
    params.play_billing_choice_image_layout = BillingChoiceImageLayoutAndroid.RECTANGULAR_FOUR_BY_ONE
    var info = await iap.get_billing_choice_info_android(params)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default GetBillingChoiceInfoAndroid;
