import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function IsEligibleForExternalPurchaseCustomLinkIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="isEligibleForExternalPurchaseCustomLinkIOS"
        description="Check whether the app can use the iOS 18.1+ ExternalPurchaseCustomLink API."
        path="/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios"
        keywords="isEligibleForExternalPurchaseCustomLinkIOS, ExternalPurchaseCustomLink, StoreKit, iOS 18.1"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        isEligibleForExternalPurchaseCustomLinkIOS
      </h1>
      <p>
        Check whether the app is eligible to use the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/iseligible"
          target="_blank"
          rel="noopener noreferrer"
        >
          ExternalPurchaseCustomLink
        </a>{' '}
        API (iOS 18.1+). Returns <code>true</code> when the bundle is approved
        for the corresponding entitlement and music-streaming-app-style flows
        are allowed.
      </p>
      <p>
        Wraps <code>ExternalPurchaseCustomLink.isEligible</code> — iOS 18.1+.
        See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/iseligible"
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
            <CodeBlock language="swift">{`func isEligibleForExternalPurchaseCustomLinkIOS() async throws -> Bool`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun isEligibleForExternalPurchaseCustomLinkIOS(): Boolean`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`isEligibleForExternalPurchaseCustomLinkIOS(): Promise<boolean>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> isEligibleForExternalPurchaseCustomLinkIOS();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func is_eligible_for_external_purchase_custom_link_ios() -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — Whether the app can use
        ExternalPurchaseCustomLink (iOS 18.1+).
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let ok = try await OpenIapModule.shared.isEligibleForExternalPurchaseCustomLinkIOS()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val ok = kmpIAP.isEligibleForExternalPurchaseCustomLinkIOS()`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { isEligibleForExternalPurchaseCustomLinkIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const ok = await isEligibleForExternalPurchaseCustomLinkIOS();
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  final ok = await FlutterInappPurchase.instance
      .isEligibleForExternalPurchaseCustomLinkIOS();
}`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var ok = await iap.is_eligible_for_external_purchase_custom_link_ios()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default IsEligibleForExternalPurchaseCustomLinkIOS;
