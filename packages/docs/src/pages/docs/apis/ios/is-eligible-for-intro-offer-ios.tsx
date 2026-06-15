import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function IsEligibleForIntroOfferIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="isEligibleForIntroOfferIOS"
        description="Check introductory offer eligibility for a subscription group (iOS 12.2+)."
        path="/docs/apis/ios/is-eligible-for-intro-offer-ios"
        keywords="isEligibleForIntroOfferIOS, intro offer, eligibility"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        isEligibleForIntroOfferIOS
      </h1>
      <p>
        Check introductory offer eligibility for a subscription group (iOS
        12.2+).
      </p>
      <p>
        Wraps{' '}
        <code>Product.SubscriptionInfo.isEligibleForIntroOffer(for:)</code> —
        checks subscription-group level eligibility. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/product/subscriptioninfo/iseligibleforintrooffer(for:)"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple StoreKit reference
        </a>
        .
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func isEligibleForIntroOfferIOS(groupID: String) async throws -> Bool`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun isEligibleForIntroOfferIOS(groupID: String): Boolean`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`isEligibleForIntroOfferIOS(groupId: string): Promise<boolean>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> isEligibleForIntroOfferIOS(String groupID);`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<Boolean> IsEligibleForIntroOfferIOSAsync(String GroupID)`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func is_eligible_for_intro_offer_ios(group_id: String) -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <ul className="api-params">
        <li>
          <code>groupId</code>{' '}
          <em>
            (required, <code>string</code>)
          </em>{' '}
          — Subscription group identifier. (Native Swift / Kotlin signatures
          spell it <code>groupID</code>; the JavaScript / Dart wrappers expose
          it as <code>groupId</code>.)
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> if the user is
        eligible for the group's introductory offer.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let ok = try await OpenIapModule.shared.isEligibleForIntroOfferIOS(groupID: "com.app.subgroup")`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val ok = kmpIAP.isEligibleForIntroOfferIOS(groupID = "com.app.subgroup")`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { isEligibleForIntroOfferIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const ok = await isEligibleForIntroOfferIOS('com.app.subgroup');
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  final ok = await FlutterInappPurchase.instance
      .isEligibleForIntroOfferIOS('com.app.subgroup');
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// kmp-iap (iOS targets only — no-op on Android)
var ok = await ((QueryResolver)OpenIapClient.Instance).IsEligibleForIntroOfferIOSAsync(groupId: "com.app.subgroup");`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var ok = await iap.is_eligible_for_intro_offer_ios("com.app.subgroup")`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default IsEligibleForIntroOfferIOS;
