import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function CanPresentExternalPurchaseNoticeIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="canPresentExternalPurchaseNoticeIOS"
        description="Check if external purchase notice sheet can be presented (iOS 17.4+)."
        path="/docs/apis/ios/can-present-external-purchase-notice-ios"
        keywords="canPresentExternalPurchaseNoticeIOS, external purchase notice"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        canPresentExternalPurchaseNoticeIOS
      </h1>
      <p>
        Check if external purchase notice sheet can be presented (iOS 17.4+).
      </p>
      <p>
        Wraps <code>ExternalPurchase.canPresent</code> — gate before calling{' '}
        <code>presentExternalPurchaseNoticeSheetIOS</code>. iOS 17.4+. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/externalpurchase/canpresent"
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
            <CodeBlock language="swift">{`func canPresentExternalPurchaseNoticeIOS() async throws -> Bool`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun canPresentExternalPurchaseNoticeIOS(): Boolean`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`canPresentExternalPurchaseNoticeIOS(): Promise<boolean>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> canPresentExternalPurchaseNoticeIOS();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<Boolean> CanPresentExternalPurchaseNoticeIOSAsync()`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func can_present_external_purchase_notice_ios() -> bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> if the
        external-purchase notice sheet can be presented (iOS 17.4+).
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let can = try await OpenIapModule.shared.canPresentExternalPurchaseNoticeIOS()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val can = kmpIAP.canPresentExternalPurchaseNoticeIOS()`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { canPresentExternalPurchaseNoticeIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const can = await canPresentExternalPurchaseNoticeIOS();
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  final can = await FlutterInappPurchase.instance
      .canPresentExternalPurchaseNoticeIOS();
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// kmp-iap (iOS targets only — no-op on Android)
var can = await ((QueryResolver)OpenIapClient.Instance).CanPresentExternalPurchaseNoticeIOSAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var can = await iap.can_present_external_purchase_notice_ios()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default CanPresentExternalPurchaseNoticeIOS;
