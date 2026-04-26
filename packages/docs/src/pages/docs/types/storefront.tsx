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
        description="Storefront country code returned by getStorefront() — a plain ISO 3166-1 alpha-2 string."
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
          ISO 3166-1 alpha-2 country-code string. This page exists as a
          conceptual reference for the value returned by{' '}
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
                ISO 3166-1 alpha-2 country code (e.g. <code>"US"</code>,{' '}
                <code>"KR"</code>, <code>"JP"</code>). Empty string when the
                storefront cannot be determined.
              </td>
            </tr>
          </tbody>
        </table>

        <blockquote className="info-note">
          <p>
            iOS sources the value from the active StoreKit storefront. Android
            queries Google Play Billing configuration and returns the same
            country code string when available.
          </p>
        </blockquote>
      </section>
    </div>
  );
}

export default Storefront;
