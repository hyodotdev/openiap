import { Link } from 'react-router-dom';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function GetAppTransactionIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getAppTransactionIOS"
        description="Fetch the current app transaction (iOS 16+)."
        path="/docs/apis/ios/get-app-transaction-ios"
        keywords="getAppTransactionIOS, app transaction, StoreKit 2"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        getAppTransactionIOS
      </h1>
      <p>Fetch the current app transaction (iOS 16+).</p>
      <p>
        Wraps <code>AppTransaction.shared</code> — the JWS-verified record of
        how the app was acquired. iOS 16+. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/apptransaction"
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
            <CodeBlock language="swift">{`func getAppTransactionIOS() async throws -> AppTransactionIOS?`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p className="type-link">
        See:{' '}
        <Link to="/docs/types/ios/app-transaction-ios">
          <code>AppTransactionIOS</code>
        </Link>{' '}
        for the full field reference (<code>bundleId</code>,{' '}
        <code>appVersion</code>, <code>originalAppVersion</code>,{' '}
        <code>originalPurchaseDate</code>, <code>environment</code>,{' '}
        <code>deviceVerification</code>, <code>deviceVerificationNonce</code>,{' '}
        <code>signedDate</code>, <code>appId</code>, <code>appVersionId</code>,{' '}
        <code>preorderDate</code>, plus iOS 18.4+ additions like{' '}
        <code>appTransactionId</code> and <code>originalPlatform</code>).
      </p>
    </div>
  );
}

export default GetAppTransactionIOS;
