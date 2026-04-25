import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function GetPendingTransactionsIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getPendingTransactionsIOS"
        description="Retrieve all pending transactions in the StoreKit queue."
        path="/docs/apis/ios/get-pending-transactions-ios"
        keywords="getPendingTransactionsIOS, StoreKit, pending"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        getPendingTransactionsIOS
      </h1>
      <p>Retrieve all pending transactions in the StoreKit queue.</p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func getPendingTransactionsIOS() async throws -> [Purchase]`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default GetPendingTransactionsIOS;
