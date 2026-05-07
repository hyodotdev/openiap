import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function ShowExternalPurchaseCustomLinkNoticeIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="showExternalPurchaseCustomLinkNoticeIOS"
        description="Show the iOS 18.1+ ExternalPurchaseCustomLink notice sheet before linking out to external purchases."
        path="/docs/apis/ios/show-external-purchase-custom-link-notice-ios"
        keywords="showExternalPurchaseCustomLinkNoticeIOS, ExternalPurchaseCustomLink notice, StoreKit, iOS 18.1"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        showExternalPurchaseCustomLinkNoticeIOS
      </h1>
      <p>
        Display the system disclosure notice for{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/shownotice(type:)"
          target="_blank"
          rel="noopener noreferrer"
        >
          ExternalPurchaseCustomLink
        </a>{' '}
        (iOS 18.1+). Apple requires this sheet to be presented after a
        deliberate customer interaction, before you can route the user to an
        external purchase URL.
      </p>
      <p>
        Wraps <code>ExternalPurchaseCustomLink.showNotice(type:)</code> —
        required disclosure sheet before linking out. iOS 18.1+. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/shownotice(type:)"
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
            <CodeBlock language="swift">{`func showExternalPurchaseCustomLinkNoticeIOS(
    noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS
) async throws -> ExternalPurchaseCustomLinkNoticeResultIOS`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun showExternalPurchaseCustomLinkNoticeIOS(
    noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS
): ExternalPurchaseCustomLinkNoticeResultIOS`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`showExternalPurchaseCustomLinkNoticeIOS(
  noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS,
): Promise<ExternalPurchaseCustomLinkNoticeResultIOS>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<ExternalPurchaseCustomLinkNoticeResultIOS>
    showExternalPurchaseCustomLinkNoticeIOS(
  ExternalPurchaseCustomLinkNoticeTypeIOS noticeType,
);`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<ExternalPurchaseCustomLinkNoticeResultIOS> ShowExternalPurchaseCustomLinkNoticeIOSAsync(ExternalPurchaseCustomLinkNoticeTypeIOS NoticeType)`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func show_external_purchase_custom_link_notice_ios(notice_type: String) -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <ul className="api-params">
        <li>
          <code>noticeType</code>{' '}
          <em>
            (required, <code>ExternalPurchaseCustomLinkNoticeTypeIOS</code>)
          </em>{' '}
          — Disclosure style.
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/external-purchase-link#external-purchase-custom-link-notice-result-ios">
          <code>Promise&lt;ExternalPurchaseCustomLinkNoticeResultIOS&gt;</code>
        </Link>{' '}
        — carries:
      </p>
      <ul className="api-params">
        <li>
          <code>continued</code>{' '}
          <em>
            (<code>boolean</code>)
          </em>{' '}
          — Whether the user chose to continue to the external purchase.
        </li>
        <li>
          <code>error</code>{' '}
          <em>
            (<code>string?</code>)
          </em>{' '}
          — Populated when the sheet fails to present.
        </li>
      </ul>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let result = try await OpenIapModule.shared.showExternalPurchaseCustomLinkNoticeIOS(
    noticeType: .browser
)`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val result = kmpIAP.showExternalPurchaseCustomLinkNoticeIOS(
    noticeType = ExternalPurchaseCustomLinkNoticeTypeIOS.Browser
)`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { Platform } from 'react-native';
import { showExternalPurchaseCustomLinkNoticeIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  await showExternalPurchaseCustomLinkNoticeIOS('browser');
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  await FlutterInappPurchase.instance.showExternalPurchaseCustomLinkNoticeIOS(
    ExternalPurchaseCustomLinkNoticeTypeIOS.Browser,
  );
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// kmp-iap (iOS targets only — no-op on Android)
var result = await ((QueryResolver)Iap.Instance).ShowExternalPurchaseCustomLinkNoticeIOSAsync(
    noticeType = ExternalPurchaseCustomLinkNoticeTypeIOS.Browser
)`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var result = await iap.show_external_purchase_custom_link_notice_ios("browser")`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p>
        <code>ExternalPurchaseCustomLinkNoticeTypeIOS</code> currently has a
        single value: <code>'browser'</code> (case-sensitive — Swift / Kotlin /
        Dart spell it as <code>.browser</code> / <code>.Browser</code>).
      </p>
    </div>
  );
}

export default ShowExternalPurchaseCustomLinkNoticeIOS;
