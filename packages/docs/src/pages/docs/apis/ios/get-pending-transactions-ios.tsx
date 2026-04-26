import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
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
      <p>
        Iterates <code>Transaction.unfinished</code> to surface transactions
        still awaiting <code>finish()</code>. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/transaction/unfinished"
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
        <Link to="/docs/types/purchase">
          <code>Promise&lt;PurchaseIOS[]&gt;</code>
        </Link>{' '}
        — array of StoreKit transactions in the iOS-specific shape. See{' '}
        <Link to="/docs/types/purchase">
          <code>Purchase</code>
        </Link>{' '}
        for the full field reference.
      </p>

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
