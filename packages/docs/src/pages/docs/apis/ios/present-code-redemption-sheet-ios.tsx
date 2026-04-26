import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
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
      <p>
        Calls <code>SKPaymentQueue.default().presentCodeRedemptionSheet()</code>{' '}
        (the StoreKit 1 API — the StoreKit 2 equivalent{' '}
        <code>AppStore.presentOfferCodeRedeemSheet(in:)</code> is not currently
        wired through this wrapper). See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/skpaymentqueue/presentcoderedemptionsheet()"
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
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> once the
        redemption sheet has been presented.
      </p>

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
