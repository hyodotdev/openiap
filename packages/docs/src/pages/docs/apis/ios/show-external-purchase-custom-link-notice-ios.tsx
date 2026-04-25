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

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func showExternalPurchaseCustomLinkNoticeIOS(
    noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS
) async throws -> ExternalPurchaseCustomLinkNoticeResultIOS`}</CodeBlock>
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
