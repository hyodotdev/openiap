import AnchorLink from '../../../../components/AnchorLink';
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
      <p>
        Iterates <code>Transaction.all</code>. iOS 18+ requires{' '}
        <code>SK2ConsumableTransactionHistory</code> Info.plist key for finished
        consumables to appear. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/transaction/all"
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
        <code>Promise&lt;PurchaseIOS[]&gt;</code> — Every StoreKit transaction
        (finished + unfinished).
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
