import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function GetExternalPurchaseCustomLinkTokenIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getExternalPurchaseCustomLinkTokenIOS"
        description="Get the iOS 18.1+ ExternalPurchaseCustomLink token for reporting transactions to Apple."
        path="/docs/apis/ios/get-external-purchase-custom-link-token-ios"
        keywords="getExternalPurchaseCustomLinkTokenIOS, ExternalPurchaseCustomLink token, StoreKit, iOS 18.1"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        getExternalPurchaseCustomLinkTokenIOS
      </h1>
      <p>
        Fetch an external-purchase token for the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)"
          target="_blank"
          rel="noopener noreferrer"
        >
          ExternalPurchaseCustomLink
        </a>{' '}
        API (iOS 18.1+). Pair the returned token with Apple's External Purchase
        Server API to report acquisition or services transactions.
      </p>
      <p>
        Wraps <code>ExternalPurchaseCustomLink.token(for:)</code> — token to
        report transactions to Apple's External Purchase Server. iOS 18.1+. See
        the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)"
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
            <CodeBlock language="swift">{`func getExternalPurchaseCustomLinkTokenIOS(
    tokenType: ExternalPurchaseCustomLinkTokenTypeIOS
) async throws -> ExternalPurchaseCustomLinkTokenResultIOS`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p>
        <code>tokenType</code> is{' '}
        <code>ExternalPurchaseCustomLinkTokenTypeIOS.acquisition</code> for new
        customers or{' '}
        <code>ExternalPurchaseCustomLinkTokenTypeIOS.services</code> for
        existing ones. The result wraps the opaque token plus expiration
        metadata.
      </p>
    </div>
  );
}

export default GetExternalPurchaseCustomLinkTokenIOS;
