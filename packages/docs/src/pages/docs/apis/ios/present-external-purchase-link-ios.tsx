import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function PresentExternalPurchaseLinkIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="presentExternalPurchaseLinkIOS"
        description="Open external purchase URL in Safari (iOS 18.2+)."
        path="/docs/apis/ios/present-external-purchase-link-ios"
        keywords="presentExternalPurchaseLinkIOS, external link, external purchase"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        presentExternalPurchaseLinkIOS
      </h1>
      <p>Open external purchase URL in Safari (iOS 18.2+).</p>
      <p>
        Wraps <code>ExternalPurchaseLink.open(url:)</code> — StoreKit External,
        iOS 16+ (EU app store). See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/externalpurchaselink"
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
            <CodeBlock language="swift">{`func presentExternalPurchaseLinkIOS(_ url: String) async throws -> ExternalPurchaseLinkResultIOS

struct ExternalPurchaseLinkResultIOS {
    let error: String?
    let success: Bool
}`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default PresentExternalPurchaseLinkIOS;
