import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function StoreSetup() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Store Setup"
        description="Configure OpenIAP store targets for Horizon OS, Amazon Fire OS and Vega OS, and Onside across supported framework libraries."
        path="/docs/setup/store"
        keywords="OpenIAP store setup, Horizon OS, Fire OS, Vega OS, Onside, expo-iap, react-native-iap"
      />
      <h1>Store Setup</h1>
      <p>
        Start with your framework setup, then add the store target your release
        artifact needs. Store setup is intentionally separate from feature
        usage: purchase APIs stay consistent, while build-time and runtime store
        selection differ by framework. Each store guide starts with the exact
        values you need, where to get them, and where each framework reads them.
      </p>

      <section>
        <AnchorLink id="targets" level="h2">
          Store Targets
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Target</th>
              <th>Selection model</th>
              <th>Setup guide</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Horizon OS</td>
              <td>
                Android <code>horizon</code> flavor for Meta Quest builds.
              </td>
              <td>
                <Link to="/docs/setup/store/horizon">Horizon OS Setup</Link>
              </td>
            </tr>
            <tr>
              <td>Amazon Fire OS</td>
              <td>
                Android <code>amazon</code> flavor for Amazon Appstore builds.
              </td>
              <td>
                <Link to="/docs/setup/store/amazon">Amazon Store Setup</Link>
              </td>
            </tr>
            <tr>
              <td>Amazon Vega OS</td>
              <td>
                Kepler runtime adapter for React Native for Vega and compatible
                Expo Vega targets.
              </td>
              <td>
                <Link to="/docs/setup/store/amazon#vega-os">
                  Amazon Store Setup
                </Link>
              </td>
            </tr>
            <tr>
              <td>Onside</td>
              <td>iOS marketplace runtime selected by expo-iap.</td>
              <td>
                <Link to="/docs/setup/store/onside">Onside Setup</Link>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="framework-model" level="h2">
          Framework Model
        </AnchorLink>
        <p>
          Expo can write native configuration during prebuild. Bare React
          Native, Flutter, KMP, MAUI, Godot, and native Android projects own
          their native build files directly.
        </p>
        <ul>
          <li>
            Use <Link to="/docs/setup/store/horizon">Horizon OS Setup</Link> for
            Meta Quest app ids, Android flavor selection, and framework-specific
            build configuration.
          </li>
          <li>
            Use <Link to="/docs/setup/store/amazon">Amazon Store Setup</Link>{' '}
            for Fire OS Android artifacts and Vega OS runtime targets. Fire OS
            and Vega OS are separate artifacts even when both use Amazon receipt
            verification.
          </li>
          <li>
            Use <Link to="/docs/setup/store/onside">Onside Setup</Link> for
            Expo-only iOS alternative marketplace support.
          </li>
        </ul>
      </section>
    </div>
  );
}

export default StoreSetup;
