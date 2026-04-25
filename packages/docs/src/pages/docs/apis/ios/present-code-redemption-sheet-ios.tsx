import { Link } from 'react-router-dom';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function PresentCodeRedemptionSheetIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="presentCodeRedemptionSheetIOS"
        description="Present the App Store promo code redemption sheet."
        path="/docs/apis/ios/present-code-redemption-sheet-ios"
        keywords="presentCodeRedemptionSheetIOS, redemption, promo code"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        presentCodeRedemptionSheetIOS
      </h1>
      <p>Present the App Store promo code redemption sheet.</p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func presentCodeRedemptionSheetIOS() async throws -> Bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p className="type-link">
        See:{' '}
        <Link to="/docs/features/offer-code-redemption">
          Offer Code Redemption
        </Link>
      </p>
    </div>
  );
}

export default PresentCodeRedemptionSheetIOS;
