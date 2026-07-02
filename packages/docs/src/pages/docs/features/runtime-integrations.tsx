import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function RuntimeIntegrations() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Runtime Integrations"
        description="Runtime-selected OpenIAP integrations such as Onside and Vega OS that switch store behavior without changing app purchase code."
        path="/docs/features/runtime-integrations"
        keywords="OpenIAP runtime integrations, Onside, Vega OS, expo-iap, react-native-iap"
      />
      <h1>Runtime Integrations</h1>

      <p>
        Runtime integrations are selected by the SDK after the app starts,
        rather than by choosing a different Android flavor or changing purchase
        code in screens. Onside and Vega OS live at this layer.
      </p>

      <section>
        <AnchorLink id="supported-runtimes" level="h2">
          Supported Runtimes
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Runtime</th>
              <th>Scope</th>
              <th>Libraries</th>
            </tr>
          </thead>
          <tbody>
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
        <AnchorLink id="not-android-flavors" level="h2">
          Not Android Flavors
        </AnchorLink>
        <p>
          Android store flavors remain in the setup guides: Google Play is the
          default, Horizon uses the <code>horizon</code> flavor, and Fire OS
          uses the <code>amazon</code> flavor. Vega OS is separate because it
          runs through Amazon's JavaScript IAP service in the{' '}
          <code>kepler</code> runtime.
        </p>
        <p>
          For Fire OS Android builds, use{' '}
          <Link to="/docs/fireos-setup">Fire OS Setup</Link>. For Vega OS apps,
          use the <Link to="/docs/features/vega-os">Vega OS Runtime</Link>{' '}
          guide.
        </p>
      </section>
    </div>
  );
}

export default RuntimeIntegrations;
