import AnchorLink from '../../../../components/AnchorLink';
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
      <p>
        Iterates <code>Transaction.unfinished</code> and calls{' '}
        <code>.finish()</code> on each — sandbox/dev helper, do NOT ship in
        production paths. See the{' '}
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
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> once unfinished
        transactions in the queue have been cleared.
      </p>

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
