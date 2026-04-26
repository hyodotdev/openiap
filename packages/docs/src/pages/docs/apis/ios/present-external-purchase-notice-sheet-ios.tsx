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
        }}
      </LanguageTabs>
    </div>
  );
}

export default PresentExternalPurchaseNoticeSheetIOS;
