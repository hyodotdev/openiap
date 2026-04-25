import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function GetReceiptDataIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getReceiptDataIOS"
        description="Get base64-encoded receipt data for legacy validation."
        path="/docs/apis/ios/get-receipt-data-ios"
        keywords="getReceiptDataIOS, receipt, legacy validation"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        getReceiptDataIOS
      </h1>
      <p>Get base64-encoded receipt data for legacy validation.</p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func getReceiptDataIOS() async throws -> String?`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default GetReceiptDataIOS;
