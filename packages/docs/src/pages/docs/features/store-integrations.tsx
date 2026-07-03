import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function StoreIntegrations() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Store Integrations"
        description="Store and runtime OpenIAP integrations for Horizon OS, Fire OS, Vega OS, and alternative marketplaces without changing app purchase code."
        path="/docs/features/store-integrations"
        keywords="OpenIAP store integrations, Horizon OS, Fire OS, Vega OS, Onside, expo-iap, react-native-iap"
      />
      <h1>Store Integrations</h1>

      <p>
        Store integrations let the same OpenIAP purchase calls run against a
        store-specific adapter. Some targets are selected at build time as
        Android flavors, while others are selected by runtime store context.
      </p>

      <section>
        <AnchorLink id="supported-integrations" level="h2">
          Supported Integrations
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Integration</th>
              <th>Scope</th>
              <th>Libraries</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Link to="/docs/features/horizon-os">Horizon OS</Link>
              </td>
              <td>Meta Quest Android flavor</td>
              <td>Android and framework wrappers</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/features/fire-os">Fire OS</Link>
              </td>
              <td>Amazon Appstore Android flavor</td>
              <td>Android and framework wrappers</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/features/alternative-marketplace/onside">
                  Onside
                </Link>
              </td>
              <td>iOS alternative marketplace runtime</td>
              <td>
                <code>expo-iap</code>
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/features/vega-os">Vega OS</Link>
              </td>
              <td>Amazon Vega JavaScript IAP runtime</td>
              <td>
                <code>react-native-iap</code>, <code>expo-iap</code>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="selection-models" level="h2">
          Selection Models
        </AnchorLink>
        <p>
          Google Play is the default Android artifact. Horizon OS uses the{' '}
          <code>horizon</code> flavor, and Fire OS uses the <code>amazon</code>{' '}
          flavor. Vega OS is not an Android flavor; it runs through Amazon's
          JavaScript IAP service in the <code>kepler</code> runtime.
        </p>
        <p>
          Use the platform pages in this section for store-specific setup:
          <Link to="/docs/features/horizon-os"> Horizon OS</Link>,{' '}
          <Link to="/docs/features/fire-os">Fire OS</Link>, and{' '}
          <Link to="/docs/features/vega-os">Vega OS</Link>.
        </p>
      </section>
    </div>
  );
}

export default StoreIntegrations;
