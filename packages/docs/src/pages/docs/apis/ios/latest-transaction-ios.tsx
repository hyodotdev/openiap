import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function LatestTransactionIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="latestTransactionIOS"
        description="Get the most recent transaction for a product (iOS 15+)."
        path="/docs/apis/ios/latest-transaction-ios"
        keywords="latestTransactionIOS, latest transaction"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        latestTransactionIOS
      </h1>
      <p>Get the most recent transaction for a product (iOS 15+).</p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func latestTransactionIOS(sku: String) async throws -> Purchase?`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default LatestTransactionIOS;
