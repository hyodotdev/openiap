import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function Storefront() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Storefront (return value of getStorefront)"
        description="Storefront country code returned by getStorefront(), using the store's platform-specific ISO format."
        path="/docs/types/storefront"
        keywords="Storefront, getStorefront, country code, OpenIAP"
      />
      <h1>Storefront</h1>
      <section>
        <AnchorLink id="storefront" level="h2">
          Storefront
        </AnchorLink>
        <p>
          <strong>Note:</strong> <code>Storefront</code> is not a struct in the
          OpenIAP GraphQL schema. The schema defines{' '}
          <code>getStorefront: String!</code>, so the value returned is a plain
          country-code string. Its ISO format is platform-specific. This page
          exists as a conceptual reference for the value returned by{' '}
          <Link to="/docs/apis/get-storefront">
            <code>getStorefront()</code>
          </Link>
          .
        </p>
        <p>
          Country-code shape returned by <code>getStorefront</code>.{' '}
          <strong>iOS:</strong> <code>Storefront.current</code> (
          <a
            href="https://developer.apple.com/documentation/storekit/storefront"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple docs
          </a>
          ). <strong>Android:</strong> <code>BillingConfig.countryCode</code> (
          <a
            href="https://developer.android.com/reference/com/android/billingclient/api/BillingConfig"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google docs
          </a>
          ).
        </p>
        <p className="type-link">
          <strong>Native references:</strong>{' '}
          <a
            href="https://developer.apple.com/documentation/storekit/storefront"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple · StoreKit Storefront
          </a>
          {' · '}
          <a
            href="https://developer.android.com/reference/com/android/billingclient/api/BillingConfig#getCountryCode()"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google · BillingConfig.getCountryCode()
          </a>
        </p>

        <h3>Return shape</h3>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>String!</code>
              </td>
              <td>
                StoreKit returns ISO 3166-1 alpha-3 (for example{' '}
                <code>"USA"</code>, <code>"KOR"</code>); Google Play Billing and
                Horizon return alpha-2 country codes, and Amazon returns its
                alpha-2-like <code>UserData.marketplace</code> value (for
                example <code>"US"</code>, <code>"DE"</code>). If the store
                lookup fails, the API rejects or throws a platform-mapped
                purchase error instead of returning an empty or locale-derived
                value.
              </td>
            </tr>
          </tbody>
        </table>

        <blockquote className="info-note">
          <p>
            iOS sources the value from the active StoreKit storefront. Google
            Play and Horizon query billing configuration; Amazon uses the
            signed-in user&apos;s marketplace. All paths are store-authoritative
            and fail closed when no storefront value is available.
          </p>
        </blockquote>
      </section>
    </div>
  );
}

export default Storefront;
