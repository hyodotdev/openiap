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
        Apple App Store and Google Play need no extra store configuration — your{' '}
        <Link to="/docs/setup">framework setup guide</Link> covers them. This
        section is for additional store targets: Meta Quest (Horizon OS), the
        Amazon Appstore (Fire OS and Vega OS), and the Onside iOS alternative
        marketplace. Finish your framework setup first, then add the store
        target your release artifact needs. The purchase APIs stay identical on
        every store; only build-time and runtime store selection differ. Each
        store guide lists the exact values you need, where to get them, and
        where each framework reads them.
      </p>

      <section>
        <AnchorLink id="targets" level="h2">
          Store Targets
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Target</th>
              <th>How it is selected</th>
              <th>Setup guide</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Horizon OS</td>
              <td>
                Build the Android Gradle <code>horizon</code> product flavor for
                Meta Quest devices.
              </td>
              <td>
                <Link to="/docs/setup/store/horizon">Horizon OS Setup</Link>
              </td>
            </tr>
            <tr>
              <td>Amazon Fire OS</td>
              <td>
                Android <code>amazon</code> flavor for Amazon Appstore builds
                (experimental, RC packages).
              </td>
              <td>
                <Link to="/docs/setup/store/amazon#fire-os">
                  Amazon Store Setup — Fire OS
                </Link>
              </td>
            </tr>
            <tr>
              <td>Amazon Vega OS</td>
              <td>
                Vega devices run apps on Amazon's Kepler JavaScript runtime
                instead of Android; <code>react-native-iap</code> and{' '}
                <code>expo-iap</code> switch to their Kepler adapter at runtime
                (experimental, RC packages).
              </td>
              <td>
                <Link to="/docs/setup/store/amazon#vega-os">
                  Amazon Store Setup — Vega OS
                </Link>
              </td>
            </tr>
            <tr>
              <td>Onside</td>
              <td>
                iOS alternative marketplace; <code>expo-iap</code> selects the
                Onside runtime automatically (Expo only).
              </td>
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
          Every store guide shows two setup paths, so know which one your
          project uses. Expo projects declare store values in the Expo config,
          and a config plugin writes the native files during{' '}
          <code>expo prebuild</code>. Bare React Native, Flutter, KMP, MAUI,
          Godot, and native Android projects edit their native build files
          directly.
        </p>
        <ul>
          <li>
            Fire OS and Vega OS are separate release artifacts even though both
            use Amazon receipt verification — do not reuse one build for the
            other.
          </li>
          <li>
            Onside is currently <code>expo-iap</code> only; other frameworks
            have no Onside build option.
          </li>
        </ul>
      </section>
    </div>
  );
}

export default StoreSetup;
