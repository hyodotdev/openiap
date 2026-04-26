import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function SubscriptionStatusIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="subscriptionStatusIOS"
        description="Get detailed subscription status using StoreKit 2 (iOS 15+)."
        path="/docs/apis/ios/subscription-status-ios"
        keywords="subscriptionStatusIOS, StoreKit 2, subscription state"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        subscriptionStatusIOS
      </h1>
      <p>Get detailed subscription status using StoreKit 2 (iOS 15+).</p>
      <p>
        Wraps <code>Product.SubscriptionInfo.status</code> — returns the array
        of <code>Status</code> objects with <code>transaction</code>,{' '}
        <code>renewalInfo</code>, <code>state</code>. iOS 15+. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/product/subscriptioninfo/status"
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
            <CodeBlock language="swift">{`func subscriptionStatusIOS(sku: String) async throws -> [SubscriptionStatusIOS]`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default SubscriptionStatusIOS;
