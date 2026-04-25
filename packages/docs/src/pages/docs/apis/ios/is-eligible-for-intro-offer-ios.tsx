import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function IsEligibleForIntroOfferIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="isEligibleForIntroOfferIOS"
        description="Check introductory offer eligibility for a subscription group (iOS 12.2+)."
        path="/docs/apis/ios/is-eligible-for-intro-offer-ios"
        keywords="isEligibleForIntroOfferIOS, intro offer, eligibility"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        isEligibleForIntroOfferIOS
      </h1>
      <p>
        Check introductory offer eligibility for a subscription group (iOS
        12.2+).
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func isEligibleForIntroOfferIOS(groupID: String) async throws -> Bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default IsEligibleForIntroOfferIOS;
