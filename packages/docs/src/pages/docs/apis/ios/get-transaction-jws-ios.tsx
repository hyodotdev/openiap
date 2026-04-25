import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function GetTransactionJwsIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getTransactionJwsIOS"
        description="Get the transaction JWS for server-side validation (iOS 15+)."
        path="/docs/apis/ios/get-transaction-jws-ios"
        keywords="getTransactionJwsIOS, JWS, server validation"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        getTransactionJwsIOS
      </h1>
      <p>Get the transaction JWS for server-side validation (iOS 15+).</p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func getTransactionJwsIOS(sku: String) async throws -> String?`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default GetTransactionJwsIOS;
