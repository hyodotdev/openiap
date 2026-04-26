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

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <p>None.</p>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> if the
        external-purchase notice sheet can be presented (iOS 17.4+).
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
