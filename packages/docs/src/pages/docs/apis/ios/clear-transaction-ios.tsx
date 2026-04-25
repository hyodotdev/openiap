import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function ClearTransactionIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="clearTransactionIOS"
        description="Clear pending transactions from the StoreKit payment queue."
        path="/docs/apis/ios/clear-transaction-ios"
        keywords="clearTransactionIOS, StoreKit, clear queue"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        clearTransactionIOS
      </h1>
      <p>Clear pending transactions from the StoreKit payment queue.</p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func clearTransactionIOS() async throws -> Bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default ClearTransactionIOS;
