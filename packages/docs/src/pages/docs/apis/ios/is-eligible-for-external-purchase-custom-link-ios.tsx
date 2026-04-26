import AnchorLink from '../../../../components/AnchorLink';
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
      <p>
        Wraps <code>ExternalPurchaseCustomLink.isEligible</code> — iOS 18.1+.
        See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/iseligible"
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
        <code>Promise&lt;boolean&gt;</code> — Whether the app can use
        ExternalPurchaseCustomLink (iOS 18.1+).
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
