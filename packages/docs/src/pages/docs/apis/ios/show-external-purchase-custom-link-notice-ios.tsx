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
        — the user's response (<code>continue</code> / <code>cancelled</code>)
        plus the disclosure type that was shown.
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
          gdscript: (
            <CodeBlock language="gdscript">{`func show_external_purchase_custom_link_notice_ios(notice_type: String) -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let result = try await OpenIapModule.shared.showExternalPurchaseCustomLinkNoticeIOS(
    noticeType: .continue
)`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val result = kmpIAP.showExternalPurchaseCustomLinkNoticeIOS(
    noticeType = ExternalPurchaseCustomLinkNoticeTypeIOS.CONTINUE
)`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { showExternalPurchaseCustomLinkNoticeIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  await showExternalPurchaseCustomLinkNoticeIOS('continue');
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  await FlutterInappPurchase.instance.showExternalPurchaseCustomLinkNoticeIOS(
    ExternalPurchaseCustomLinkNoticeTypeIOS.continue_,
  );
}`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var result = await iap.show_external_purchase_custom_link_notice_ios("continue")`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p>
        <code>noticeType</code> picks the disclosure style required by the flow
        you are entering (e.g. <code>.acquisition</code> for first-time
        payments, <code>.services</code> for ongoing services).
      </p>
    </div>
  );
}

export default ShowExternalPurchaseCustomLinkNoticeIOS;
