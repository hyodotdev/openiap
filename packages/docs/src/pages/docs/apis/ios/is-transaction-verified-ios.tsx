import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function IsTransactionVerifiedIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="isTransactionVerifiedIOS"
        description="Verify a StoreKit 2 transaction signature (iOS 15+)."
        path="/docs/apis/ios/is-transaction-verified-ios"
        keywords="isTransactionVerifiedIOS, JWS verification, StoreKit 2"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        isTransactionVerifiedIOS
      </h1>
      <p>Verify a StoreKit 2 transaction signature (iOS 15+).</p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func isTransactionVerifiedIOS(sku: String) async throws -> Bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default IsTransactionVerifiedIOS;
