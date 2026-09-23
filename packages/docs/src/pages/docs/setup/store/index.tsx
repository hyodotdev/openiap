import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import Callout from '../../../../components/Callout';
import CodeBlock from '../../../../components/CodeBlock';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';
import { OPENIAP_VERSIONS } from '../../../../lib/versioning';

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
          other stores — and let the build pick the store. The Gradle wrappers
          (React Native, Expo, and Flutter) apply the whole rule, first match
          wins, and so does the OpenIAP Gradle plugin in native Android and KMP
          apps. A Godot export applies it with the{' '}
          <code>openiap/android_store</code> export option as the explicit step
          and no Variant step, and a MAUI build the same way with the{' '}
          <code>OpenIapStore</code> MSBuild property:
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
            , or <code>flutter build apk --flavor amazon</code> in a Flutter app
            that declares those flavors. Gradle&apos;s camelCase abbreviations
            are read where they are unambiguous — <code>aHR</code> is{' '}
            <code>assembleHorizonRelease</code> — and where they are not, the
            build fails rather than guess: once the task graph is ready it is
            compared against the store that was linked, so a lower-cased name or
            a prefix match stops the build instead of shipping the wrong SDK.
            Name one store per invocation, and name it <code>play</code>,{' '}
            <code>horizon</code> or <code>amazon</code> — the aliases work in{' '}
            <code>openiapStore</code>, not in a flavor name. An anchor task such
            as <code>assembleDebug</code> or <code>bundleRelease</code> is not a
            second store, and it does not give each flavor its own: the build
            links the one store this rule chose into every flavor the anchor
            produces. To ship a different store per flavor, name one flavor — or
            one pin — per invocation.
          </li>
          <li>
            <strong>Device</strong> — debug builds only (a Godot debug export, a
            MAUI Debug build): the adb device <code>ANDROID_SERIAL</code> names,
            or the single attached one, is a Quest or a Fire device. Release
            builds never look at a device, and several attached devices select
            nothing unless <code>ANDROID_SERIAL</code> picks one.
          </li>
          <li>
            <strong>Play</strong> otherwise.
          </li>
        </ol>
        <p>
          The decision is logged once per build as{' '}
          <code>openiap: store=horizon (source=device; ...)</code>. A store pin
          against a different task flavor, two flavors in one invocation, and a
          pin against a legacy flag each fail the build, so a pinned release
          train cannot quietly ship the wrong billing SDK. The device is a
          fallback rather than a competing signal: a pin or a flavor simply
          outranks it. The device step also works with the configuration cache:
          plugging in a different device reconfigures the build. The aliases{' '}
          <code>google</code>/<code>gplay</code>/<code>googleplay</code>/
          <code>google-play</code>/<code>gms</code>, <code>meta</code>/
          <code>quest</code>, and <code>fire</code>/<code>fireos</code>/
          <code>fire-os</code> normalize to the three store ids.
        </p>
        <Callout
          kind="warning"
          title="MAUI only: shared store libraries in every build"
        >
          Every framework links one store&apos;s SDK per build. A MAUI build
          additionally carries the NuGet libraries any store needs, because
          NuGet fixes a package&apos;s dependencies before the build knows the
          store: Play Services and DataTransport (about 3.1 MB, with their
          manifest entries) and kotlinx-serialization-json (up to 0.9 MB). See{' '}
          <Link to="/docs/setup/maui#android-store">MAUI Setup</Link>.
        </Callout>
        <p>
          Native Android and KMP apps get the rule from the OpenIAP Gradle
          plugin, applied once in <code>settings.gradle.kts</code> with{' '}
          <code>mavenCentral()</code> in the <code>pluginManagement</code>{' '}
          repositories. Depend on <code>openiap-google</code>; the plugin links
          the chosen store&apos;s build in its place, and a store artifact
          declared directly must name the same store or the build stops. A
          module that declares its own <code>platform</code> flavors keeps its
          own setup: kmp-iap matches each flavor, and openiap-google takes a
          per-flavor dependency such as{' '}
          <code>
            horizonImplementation(&quot;...:openiap-google-horizon&quot;)
          </code>
          .
        </p>
        <CodeBlock language="kotlin">{`// settings.gradle.kts
plugins {
    id("io.github.hyochan.openiap") version "${OPENIAP_VERSIONS.google}"
}`}</CodeBlock>
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
