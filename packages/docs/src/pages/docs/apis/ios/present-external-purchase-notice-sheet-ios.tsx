import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function PresentExternalPurchaseNoticeSheetIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="presentExternalPurchaseNoticeSheetIOS"
        description="Present Apple's compliance notice sheet (iOS 17.4+)."
        path="/docs/apis/ios/present-external-purchase-notice-sheet-ios"
        keywords="presentExternalPurchaseNoticeSheetIOS, external purchase, compliance"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        presentExternalPurchaseNoticeSheetIOS
      </h1>
      <p>Present Apple's compliance notice sheet (iOS 17.4+).</p>
      <p>
        Wraps <code>ExternalPurchase.presentNoticeSheet()</code> — returns a
        token if the user accepts. iOS 17.4+. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/externalpurchase/presentnoticesheet()"
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
            <CodeBlock language="swift">{`func presentExternalPurchaseNoticeSheetIOS() async throws -> ExternalPurchaseNoticeResultIOS

struct ExternalPurchaseNoticeResultIOS {
    let result: ExternalPurchaseNoticeAction
    let error: String?
    let externalPurchaseToken: String?
}`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun presentExternalPurchaseNoticeSheetIOS(): ExternalPurchaseNoticeResultIOS`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`presentExternalPurchaseNoticeSheetIOS(): Promise<ExternalPurchaseNoticeResultIOS>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<ExternalPurchaseNoticeResultIOS> presentExternalPurchaseNoticeSheetIOS();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<ExternalPurchaseNoticeResultIOS> PresentExternalPurchaseNoticeSheetIOSAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func present_external_purchase_notice_sheet_ios() -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/external-purchase-link#external-purchase-types">
          <code>Promise&lt;ExternalPurchaseNoticeResultIOS&gt;</code>
        </Link>{' '}
        — carries:
      </p>
      <ul className="api-params">
        <li>
          <code>result</code>{' '}
          <em>
            (<code>'continue' | 'dismissed'</code>)
          </em>{' '}
          — User action on the notice sheet — see{' '}
          <code>ExternalPurchaseNoticeAction</code>.
        </li>
        <li>
          <code>externalPurchaseToken</code>{' '}
          <em>
            (<code>string?</code>)
          </em>{' '}
          — Reporting token returned by Apple when the user continues (
          <code>result === 'continue'</code>). Pass to your backend / send to
          Apple's External Purchase Server API.
        </li>
        <li>
          <code>error</code>{' '}
          <em>
            (<code>string?</code>)
          </em>{' '}
          — Populated when the sheet failed to present.
        </li>
      </ul>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let result = try await OpenIapModule.shared.presentExternalPurchaseNoticeSheetIOS()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val result = kmpIAP.presentExternalPurchaseNoticeSheetIOS()`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { presentExternalPurchaseNoticeSheetIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const result = await presentExternalPurchaseNoticeSheetIOS();
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  final result = await FlutterInappPurchase.instance
      .presentExternalPurchaseNoticeSheetIOS();
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// kmp-iap (iOS targets only — no-op on Android)
var result = await ((MutationResolver)Iap.Instance).PresentExternalPurchaseNoticeSheetIOSAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var result = await iap.present_external_purchase_notice_sheet_ios()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default PresentExternalPurchaseNoticeSheetIOS;
