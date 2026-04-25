import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function IsEligibleForExternalPurchaseCustomLinkIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="isEligibleForExternalPurchaseCustomLinkIOS"
        description="Check whether the app can use the iOS 18.1+ ExternalPurchaseCustomLink API."
        path="/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios"
        keywords="isEligibleForExternalPurchaseCustomLinkIOS, ExternalPurchaseCustomLink, StoreKit, iOS 18.1"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        isEligibleForExternalPurchaseCustomLinkIOS
      </h1>
      <p>
        Check whether the app is eligible to use the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/iseligible"
          target="_blank"
          rel="noopener noreferrer"
        >
          ExternalPurchaseCustomLink
        </a>{' '}
        API (iOS 18.1+). Returns <code>true</code> when the bundle is approved
        for the corresponding entitlement and music-streaming-app-style flows
        are allowed.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func isEligibleForExternalPurchaseCustomLinkIOS() async throws -> Bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default IsEligibleForExternalPurchaseCustomLinkIOS;
