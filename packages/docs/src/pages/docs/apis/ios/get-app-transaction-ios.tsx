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

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func getAppTransactionIOS() async throws -> AppTransaction?

struct AppTransaction {
    let bundleId: String
    let appVersion: String
    let originalAppVersion: String
    let originalPurchaseDate: Date
    let environment: String  // "Sandbox" | "Production"
    // iOS 18.4+ properties
    let appTransactionId: String?
    let originalPlatform: String?
}`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default GetAppTransactionIOS;
