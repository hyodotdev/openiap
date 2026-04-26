import AnchorLink from '../../../../components/AnchorLink';
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
      <p>
        Wraps{' '}
        <code>Product.SubscriptionInfo.isEligibleForIntroOffer(for:)</code> —
        checks subscription-group level eligibility. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/product/subscriptioninfo/iseligibleforintrooffer(for:)"
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
      <table className="doc-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>groupID</code>
            </td>
            <td>
              <code>string</code>
            </td>
            <td>Yes</td>
            <td>Subscription group identifier.</td>
          </tr>
        </tbody>
      </table>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> if the user is
        eligible for the group's introductory offer.
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
