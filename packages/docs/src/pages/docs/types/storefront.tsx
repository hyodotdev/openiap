import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function Storefront() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Storefront"
        description="Storefront type definition and field reference."
        path="/docs/types/storefront"
        keywords="Storefront, OpenIAP types, Storefront"
      />
      <h1>Storefront</h1>
      <section>
        <AnchorLink id="storefront" level="h2">
          Storefront
        </AnchorLink>
        <p>
          Represents the user&apos;s App Store or Play Store region, returned by{' '}
          <Link to="/docs/apis/get-storefront">
            <code>getStorefront()</code>
          </Link>
          .
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
                <code>StorefrontCode</code>
              </td>
              <td>ISO 3166-1 alpha-2 country code (string)</td>
            </tr>
          </tbody>
        </table>
        <p>
          Example values: <code>"US"</code>, <code>"KR"</code>,{' '}
          <code>"JP"</code>. May return an empty string when the storefront
          cannot be determined.
        </p>
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
