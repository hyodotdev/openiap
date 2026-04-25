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

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func canPresentExternalPurchaseNoticeIOS() async throws -> Bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default CanPresentExternalPurchaseNoticeIOS;
