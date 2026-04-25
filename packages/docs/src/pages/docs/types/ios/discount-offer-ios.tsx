import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function DiscountOfferIos() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="DiscountOfferIOS"
        description="DiscountOfferIOS type definition and field reference."
        path="/docs/types/ios/discount-offer-ios"
        keywords="DiscountOfferIOS, OpenIAP types, Discount Offer I O S"
      />
      <h1>DiscountOfferIOS</h1>
      <section>
        <AnchorLink id="discount-offer-ios" level="h2">
          DiscountOfferIOS <span className="deprecated-badge">Deprecated</span>
        </AnchorLink>
        <p>
          <strong>Deprecated:</strong> Use{' '}
          <Link to="/docs/types/subscription-offer">SubscriptionOffer</Link>{' '}
          instead.
        </p>
        <p>
          Used when requesting a purchase with a promotional offer. Generate
          signature server-side.
        </p>
        <p className="type-link">
          <strong>Native reference:</strong>{' '}
          <a
            href="https://developer.apple.com/documentation/storekit/product/purchaseoption/promotionaloffer(offerid:keyid:nonce:signature:timestamp:)"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple · Product.PurchaseOption.promotionalOffer
          </a>
        </p>

        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>identifier</code>
              </td>
              <td>Discount identifier from App Store Connect</td>
            </tr>
            <tr>
              <td>
                <code>keyIdentifier</code>
              </td>
              <td>Key ID for signature validation</td>
            </tr>
            <tr>
              <td>
                <code>nonce</code>
              </td>
              <td>Cryptographic nonce (UUID)</td>
            </tr>
            <tr>
              <td>
                <code>signature</code>
              </td>
              <td>Server-generated signature</td>
            </tr>
            <tr>
              <td>
                <code>timestamp</code>
              </td>
              <td>Timestamp when signature was generated</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default DiscountOfferIos;
