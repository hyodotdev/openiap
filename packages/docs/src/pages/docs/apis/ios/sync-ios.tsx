import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function SyncIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="syncIOS"
        description="Force a StoreKit sync for transactions (iOS 15+)."
        path="/docs/apis/ios/sync-ios"
        keywords="syncIOS, StoreKit sync"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span> syncIOS
      </h1>
      <p>Force a StoreKit sync for transactions (iOS 15+).</p>
      <p>
        Wraps <code>AppStore.sync()</code> — forces StoreKit to refresh
        transactions and entitlements, prompts the user to authenticate. iOS
        15+. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/appstore/sync()"
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
            <CodeBlock language="swift">{`func syncIOS() async throws -> Bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default SyncIOS;
