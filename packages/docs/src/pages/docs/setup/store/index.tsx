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
        <AnchorLink id="selection" level="h2">
          How the Store Is Selected
        </AnchorLink>
        <p>
          Keep every store credential in the project — the Horizon app id and
          the Amazon <code>AppstoreAuthenticationKey.pem</code> are inert on the
          other stores — and let the build pick the store. Every OpenIAP build
          system applies the same rule; the first match wins:
        </p>
        <ol>
          <li>
            <strong>Explicit</strong> —{' '}
            <code>openiapStore=play|horizon|amazon</code> as a Gradle property:{' '}
            <code>-PopeniapStore=horizon</code>,{' '}
            <code>ORG_GRADLE_PROJECT_openiapStore=horizon</code> in an EAS
            profile, or <code>gradle.properties</code>. The legacy{' '}
            <code>horizonEnabled</code>, <code>fireOsEnabled</code>, and{' '}
            <code>openiapPlatform=none</code> still work with a deprecation
            warning.
          </li>
          <li>
            <strong>Variant</strong> — the requested task names a store flavor:{' '}
            <code>assembleHorizonRelease</code>, <code>installAmazonDebug</code>
            , <code>flutter build apk --flavor amazon</code>.
          </li>
          <li>
            <strong>Device</strong> — debug tasks only: the adb device{' '}
            <code>ANDROID_SERIAL</code> names, or the single attached one, is a
            Quest or a Fire device. Release builds never look at a device, and
            several attached devices select nothing unless{' '}
            <code>ANDROID_SERIAL</code> picks one.
          </li>
          <li>
            <strong>Play</strong> otherwise.
          </li>
        </ol>
        <p>
          Gradle logs the decision once per build as{' '}
          <code>openiap: store=horizon (source=device; ...)</code>. A pin
          against a different task flavor, two flavors in one invocation, and a
          pin against a legacy flag each fail the build, so a pinned release
          train cannot quietly ship the wrong billing SDK. The device is a
          fallback rather than a competing signal: a pin or a flavor simply
          outranks it. The configuration cache turns the device step off,
          because a cached answer outlives the device that produced it. The
          aliases <code>google</code>, <code>meta</code>/<code>quest</code>, and{' '}
          <code>fire</code>/<code>fireos</code> normalize to the three store
          ids. KMP apps declare a <code>platform</code> flavor dimension and get
          the matching library variant automatically; MAUI passes{' '}
          <code>-p:OpenIapStore=horizon</code>; Godot sets the{' '}
          <code>openiap/android_store</code> export option.
        </p>
      </section>
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
                Resolved at build time: an <code>openiapStore=horizon</code>{' '}
                pin, a <code>horizon</code> flavor, or a connected Quest on a
                debug build.
              </td>
              <td>
                <Link to="/docs/setup/store/horizon">Horizon OS Setup</Link>
              </td>
            </tr>
            <tr>
              <td>Amazon Fire OS</td>
              <td>
                Resolved at build time: an <code>openiapStore=amazon</code> pin,
                an <code>amazon</code> flavor, or a connected Fire device on a
                debug build.
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
                <code>expo-iap</code> switch to their Kepler adapter at runtime.
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
