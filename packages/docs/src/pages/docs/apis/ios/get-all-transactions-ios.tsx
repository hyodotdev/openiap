import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function GetAllTransactionsIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getAllTransactionsIOS"
        description="Get the full StoreKit 2 transaction history as PurchaseIOS values. Requires the SK2ConsumableTransactionHistory Info.plist key for finished consumables to be included (iOS 18+)."
        path="/docs/apis/ios/get-all-transactions-ios"
        keywords="getAllTransactionsIOS, StoreKit 2, transaction history"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        getAllTransactionsIOS
      </h1>
      <p>
        Get the full StoreKit 2 transaction history as PurchaseIOS values.
        Requires the SK2ConsumableTransactionHistory Info.plist key for finished
        consumables to be included (iOS 18+).
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func getAllTransactionsIOS() async throws -> [PurchaseIOS]`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default GetAllTransactionsIOS;
