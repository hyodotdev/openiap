import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import Callout from '../../../../components/Callout';
import CodeBlock from '../../../../components/CodeBlock';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';
import { OPENIAP_VERSIONS } from '../../../../lib/versioning';

function AmazonStoreSetup() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Amazon Store Setup"
        description="Configure OpenIAP for Amazon Fire OS and Vega OS targets across Expo, React Native, Flutter, KMP, MAUI, Godot, and native Android."
        path="/docs/setup/store/amazon"
        keywords="Amazon Fire OS IAP, Vega OS IAP, openiap-google-amazon, expo-iap amazon, react-native-iap Vega, Amazon Appstore SDK"
      />
      <h1>Amazon Store Setup</h1>
      <Callout kind="note" title="Stable support">
        Fire OS and Vega OS support ships in the stable releases:{' '}
        <code>react-native-iap</code> 15.4.0+, <code>expo-iap</code> 4.4.0+, and
        the <code>openiap-google-amazon</code> artifact on Maven Central.
      </Callout>
      <p>
        Amazon distributes apps to two different device families, and OpenIAP
        treats them as two separate targets. Fire OS is Amazon's Android-based
        OS (Fire TV, Fire tablets): an Amazon Appstore build is a regular
        Android build that selects the <code>amazon</code> Gradle flavor. Vega
        OS is Amazon's newer, non-Android OS: its apps run on the Kepler
        JavaScript runtime and are built with React Native for Vega (or a
        compatible Expo Vega build), so Vega is a separate project target rather
        than an Android flavor.
      </p>

      <section>
        <AnchorLink id="target-model" level="h2">
          Target Model
        </AnchorLink>
        <p>
          OpenIAP selects each Amazon target through a different mechanism — a
          Gradle flavor for Fire OS, a runtime-selected adapter for Vega OS:
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Target</th>
              <th>Runtime</th>
              <th>OpenIAP selection</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Fire OS</td>
              <td>Android / Amazon Appstore SDK</td>
              <td>
                Android <code>amazon</code> flavor and{' '}
                <code>openiap-google-amazon</code>.
              </td>
            </tr>
            <tr>
              <td>Vega OS</td>
              <td>Amazon Kepler JavaScript runtime</td>
              <td>
                Runtime-selected <code>kepler</code> adapter in{' '}
                <code>expo-iap</code> or <code>react-native-iap</code>.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="required-values" level="h2">
          Required Values
        </AnchorLink>
        <p>
          Fire OS and Vega OS both validate through Amazon receipts, but their
          app metadata is configured in different places. App Tester refers to
          Amazon App Tester, Amazon's sideloaded sandbox app for exercising test
          purchases on device.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Value</th>
              <th>Fire OS</th>
              <th>Vega OS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>App identity</td>
              <td>
                Android <code>applicationId</code>. This should match the
                package registered in Amazon Developer Console.
              </td>
              <td>
                Vega <code>manifest.toml</code> <code>[package].id</code> and
                interactive component id.
              </td>
            </tr>
            <tr>
              <td>Display metadata</td>
              <td>
                Normal Android app label and icon from the app manifest and
                resources.
              </td>
              <td>
                Vega <code>title</code>, <code>appName</code>, and{' '}
                <code>icon</code>. In Expo these default from the Expo config
                unless optional <code>android.amazon.vegaOS</code> overrides are
                provided.
              </td>
            </tr>
            <tr>
              <td>Products</td>
              <td>
                Amazon Developer Console product ids and Amazon App Tester
                catalog entries. Keep them identical to app SKUs.
              </td>
              <td>
                Amazon Vega product ids and App Tester data. Keep the same SKU
                strings used by <code>fetchProducts</code> and{' '}
                <code>requestPurchase</code>.
              </td>
            </tr>
            <tr>
              <td>Amazon public key</td>
              <td>
                Required by Amazon Appstore SDK integrations. Put the public key
                where the Android app's Amazon setup expects it, usually under
                app assets for Fire OS builds.
              </td>
              <td>
                Not an Android asset path. Vega uses Kepler runtime services and
                the Vega app manifest/module declarations.
              </td>
            </tr>
            <tr>
              <td>Verification payload</td>
              <td>
                <code>iapkit.amazon.receiptId</code>; optional{' '}
                <code>userId</code> and <code>expectedProductId</code>; plus{' '}
                <code>sandbox</code> for App Tester.
              </td>
              <td>
                Same <code>iapkit.amazon</code> payload. The Vega adapter can
                resolve Amazon user data when the runtime returns it.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="framework-setup" level="h2">
          Framework Setup
        </AnchorLink>
        <p>
          The table below summarizes how each framework selects an Amazon
          target; the <a href="#fire-os">Fire OS</a> and{' '}
          <a href="#vega-os">Vega OS</a> sections that follow contain the full
          configuration.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Framework</th>
              <th>Fire OS</th>
              <th>Vega OS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Native Android</td>
              <td>
                The OpenIAP Gradle plugin: a connected Fire device on a debug
                build; <code>openiapStore=amazon</code> or{' '}
                <code>fireOsEnabled=true</code> pins it.
              </td>
              <td>Not a Kepler target.</td>
            </tr>
            <tr>
              <td>Expo</td>
              <td>
                A debug build follows the connected Fire device.{' '}
                <code>modules.amazon.fireOS</code> declares Fire OS, and{' '}
                <code>ORG_GRADLE_PROJECT_openiapStore=amazon</code> pins it;
                either wins over the device.{' '}
                <code>android.amazon.appstoreKey</code> supplies the public key.
              </td>
              <td>
                Auto-detected from the <code>manifest.toml</code> Vega target
                marker unless <code>modules.amazon.fireOS</code> declares Fire
                OS; <code>modules.amazon.vegaOS</code> forces it on or off, with
                optional <code>android.amazon.vegaOS</code> metadata overrides.
              </td>
            </tr>
            <tr>
              <td>React Native</td>
              <td>
                Resolved at build time by the shared Gradle resolver;{' '}
                <code>openiapStore=amazon</code> or{' '}
                <code>fireOsEnabled=true</code> pins it.
              </td>
              <td>
                Separate React Native for Vega target with Kepler dependencies
                and <code>manifest.toml</code>.
              </td>
            </tr>
            <tr>
              <td>Flutter</td>
              <td>
                Resolved at build time by the shared Gradle resolver;{' '}
                <code>openiapStore=amazon</code> or{' '}
                <code>fireOsEnabled=true</code> pins it.
              </td>
              <td>No Vega runtime target.</td>
            </tr>
            <tr>
              <td>KMP</td>
              <td>The OpenIAP Gradle plugin, as for native Android.</td>
              <td>No Vega runtime target.</td>
            </tr>
            <tr>
              <td>MAUI</td>
              <td>
                A connected Fire device on a Debug build;{' '}
                <code>OpenIapStore=amazon</code> pins it.
              </td>
              <td>No Vega runtime target.</td>
            </tr>
            <tr>
              <td>Godot</td>
              <td>
                Left at <code>auto</code>, a debug export follows a connected
                Fire device; for release, set <code>openiap/android_store</code>{' '}
                to <code>amazon</code>.
              </td>
              <td>No Vega runtime target.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="fire-os" level="h2">
          Fire OS
        </AnchorLink>
        <p>
          Fire OS artifacts link the Amazon Appstore SDK and resolve purchases
          through the Android <code>amazon</code> flavor. Every Fire OS build
          also needs the Amazon public key: download{' '}
          <code>AppstoreAuthenticationKey.pem</code> for the app from the Amazon
          Developer Console and ship it in{' '}
          <code>android/app/src/main/assets</code>. The SDK verifies receipts
          with it, and it is inert on every other store, so it stays in the
          project permanently.
        </p>

        <AnchorLink id="native-android" level="h3">
          Native Android
        </AnchorLink>
        <p>
          Depend on <code>openiap-google</code> and apply the OpenIAP Gradle
          plugin; it links <code>openiap-google-amazon</code> instead when a
          debug build finds a Fire device, or when{' '}
          <code>openiapStore=amazon</code> or <code>fireOsEnabled=true</code>{' '}
          pins a release.
        </p>
        <CodeBlock language="kotlin">{`// settings.gradle.kts — keep mavenCentral() in pluginManagement.repositories
plugins {
    id("io.github.hyochan.openiap") version "${OPENIAP_VERSIONS.google}"
}

// app/build.gradle.kts
dependencies {
    implementation("io.github.hyochan.openiap:openiap-google:${OPENIAP_VERSIONS.google}")
}`}</CodeBlock>

        <AnchorLink id="expo-fire-os" level="h3">
          Expo
        </AnchorLink>
        <p>
          Expo apps keep the Amazon public key in the config plugin; the plugin
          copies it into <code>android/app/src/main/assets</code> on every
          prebuild. A local debug build follows the connected Fire device. An
          EAS build has no device to follow and a release build never looks, so
          pin every EAS profile that builds for Fire OS with{' '}
          <code>ORG_GRADLE_PROJECT_openiapStore=amazon</code> in its{' '}
          <code>env</code>, or set <code>modules.amazon.fireOS: true</code> in
          the plugin config. Either wins over the connected device.
        </p>
        <CodeBlock language="json">{`{
  "build": {
    "fire": {
      "env": { "ORG_GRADLE_PROJECT_openiapStore": "amazon" }
    }
  }
}`}</CodeBlock>
        <CodeBlock language="typescript">{`plugins: [
  [
    'expo-iap',
    {
      android: {
        amazon: {
          appstoreKey: './AppstoreAuthenticationKey.pem',
        },
      },
    },
  ],
]`}</CodeBlock>
        <p>
          <code>modules.amazon.fireOS</code> also turns off{' '}
          <a href="#expo-vega-os">Vega auto-detection</a>. A static{' '}
          <code>true</code> would skip the Vega files for the Vega build too, so
          a root that builds both sets it from the Fire profile&apos;s pin in{' '}
          <code>app.config.ts</code>.
        </p>
        <CodeBlock language="typescript">{`plugins: [
  [
    'expo-iap',
    {
      modules: {
        amazon: {
          fireOS: process.env.ORG_GRADLE_PROJECT_openiapStore === 'amazon',
        },
      },
    },
  ],
]`}</CodeBlock>

        <AnchorLink id="react-native-fire-os" level="h3">
          React Native
        </AnchorLink>
        <p>
          <code>react-native-iap</code> picks the store itself when Gradle runs,
          so the app only needs the key: place{' '}
          <code>AppstoreAuthenticationKey.pem</code> in{' '}
          <code>android/app/src/main/assets</code>. A connected Fire device on a
          debug build, an <code>amazon</code> flavor,{' '}
          <code>-PopeniapStore=amazon</code>, or{' '}
          <code>-PfireOsEnabled=true</code> then selects Amazon, exactly as for{' '}
          <Link to="/docs/setup/store/horizon">Horizon OS</Link>.
        </p>

        <AnchorLink id="flutter-fire-os" level="h3">
          Flutter
        </AnchorLink>
        <p>
          <code>flutter_inapp_purchase</code> picks the store itself, so the app
          only needs the key in <code>android/app/src/main/assets</code>; pin a
          release build with{' '}
          <code>ORG_GRADLE_PROJECT_openiapStore=amazon flutter build apk</code>,
          or with <code>fireOsEnabled=true</code>.
        </p>

        <AnchorLink id="kmp-maui-fire-os" level="h3">
          KMP and MAUI
        </AnchorLink>
        <p>
          KMP apps apply the same plugin in <code>settings.gradle.kts</code>,
          which links kmp-iap&apos;s Amazon build. A MAUI Debug build follows a
          connected Fire device; pin a release with the MSBuild property. Every
          MAUI build also carries the libraries the other stores need (
          <Link to="/docs/setup/maui#android-store">MAUI Setup</Link>). The
          public key goes in the Android app&apos;s assets: a KMP app&apos;s{' '}
          <code>src/androidMain/assets</code>, or a MAUI app&apos;s{' '}
          <code>Platforms/Android/Assets</code>.
        </p>
        <CodeBlock language="bash">{`dotnet publish -f net10.0-android -c Release -p:OpenIapStore=amazon`}</CodeBlock>
        <p>
          A Godot export picks Amazon from a connected Fire device on a debug
          export, or from <code>openiap/android_store=amazon</code>. Put{' '}
          <code>AppstoreAuthenticationKey.pem</code> at the project root and add
          it to the Android preset&apos;s filter for non-resource files; the
          export packs it into the APK&apos;s assets, where the SDK reads it.
        </p>

        <Callout
          kind="warning"
          title="App Tester does not prove the live store"
        >
          App Tester answers over its own service intents, so a purchase can
          succeed in the sandbox and show no dialog at all once the app is
          installed from the Appstore. Confirm every Fire OS release through
          Live App Testing or an Appstore install before you ship. If the dialog
          never appears and the request times out, check{' '}
          <code>adb logcat -s Kiwi</code>: {'"'}No UI visible to execute task
          {'"'}
          means the Appstore already answered and the SDK is holding the
          purchase Intent (
          <a
            href="https://github.com/hyodotdev/openiap/issues/460"
            target="_blank"
            rel="noreferrer"
          >
            #460
          </a>
          ).
        </Callout>
      </section>

      <section>
        <AnchorLink id="vega-os" level="h2">
          Vega OS
        </AnchorLink>
        <p>
          Vega OS is not an Android flavor. Keep Vega dependencies isolated in a
          Vega target so regular iOS, Android, Fire OS, and{' '}
          <Link to="/docs/setup/store/horizon">Horizon</Link> builds do not
          install Amazon Kepler packages.
        </p>
        <p>
          The Android store resolver (<code>openiapStore</code>, flavors,
          connected devices) picks the Fire OS Android flavor only — it is not a
          Vega selector and has no effect on Vega builds.
        </p>
        <p>
          Check the{' '}
          <a
            href="https://developer.amazon.com/docs/vega/0.24/vega-release-notes.html"
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
          >
            Vega SDK release notes
          </a>{' '}
          for the current supported React Native for Vega version before
          choosing Kepler package versions.
        </p>

        <AnchorLink id="expo-vega-os" level="h3">
          Expo
        </AnchorLink>
        <p>
          Expo recognizes a Vega target on its own: a root{' '}
          <code>manifest.toml</code> turns Vega file generation on, so a fresh
          checkout with a committed manifest needs no flag. Generation also
          writes a root <code>index.js</code>, so when the same root builds
          Android, keep a <code>main</code> in <code>package.json</code>;
          without one, that file becomes the Android entry.{' '}
          <a href="#expo-fire-os">
            <code>modules.amazon.fireOS</code>
          </a>{' '}
          turns detection off. Set <code>modules.amazon.vegaOS</code> explicitly
          only to force generation on for a first run or off for every build.
          The Fire OS build is a separate artifact that the Android build picks
          like any other store.
        </p>
        <CodeBlock language="typescript">{`plugins: [
  [
    'expo-iap',
    {
      modules: {
        amazon: {
          vegaOS: true,
        },
      },
    },
  ],
]`}</CodeBlock>
        <p>
          Vega metadata is automatic by default. <code>packageId</code> defaults
          from the Android package or iOS bundle id, <code>title</code> defaults
          from the Expo app name, <code>appName</code> defaults from the title,
          and <code>icon</code> defaults from the Expo icon. Only set optional{' '}
          <code>android.amazon.vegaOS</code> overrides when the Vega package
          metadata needs to differ from the normal Expo app metadata.
        </p>

        <AnchorLink id="react-native-vega-os" level="h3">
          React Native
        </AnchorLink>
        <p>
          Bare React Native uses a separate React Native for Vega project. The
          target owns the Amazon dependencies, Kepler metadata, and{' '}
          <code>manifest.toml</code>.
        </p>
        <CodeBlock language="bash">{`# In the Vega-only React Native target
yarn add react-native-iap
yarn add @amazon-devices/keplerscript-appstore-iap-lib@~2.13.0 @amazon-devices/react-native-kepler@^2.0.0
yarn add -D @amazon-devices/kepler-cli-platform@~0.22.0 @react-native-community/cli@<vega-cli-compatible-version> @react-native/metro-config@<matching-react-native-version>`}</CodeBlock>
        <CodeBlock language="toml">{`schema-version = 1

[package]
id = "dev.your.app"
title = "Your App"
version = "1.0.0"

[components]
[[components.interactive]]
id = "dev.your.app.main"
runtime-module = "/com.amazon.kepler.keplerscript.runtime.loader_2@IKeplerScript_2_0"
launch-type = "singleton"
categories = ["com.amazon.category.main"]

[needs]
[[needs.module]]
id = "/com.amazon.kepler.appstore.iap.purchase.core@IAppstoreIAPPurchaseCoreService"

[[needs.module]]
id = "/com.amazon.vega.os@IVega_1_2"

[os.version]
target = "1.2"
min = "1.2"`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="verification" level="h2">
          Verification
        </AnchorLink>
        <p>
          Receipt verification is a server-side responsibility for both Fire OS
          and Vega OS. If you use IAPKit as that implementation, follow its{' '}
          <a
            href="https://kit.openiap.dev/docs/verification/amazon"
            target="_blank"
            rel="noreferrer"
          >
            Amazon verification guide
          </a>
          . Other backends should validate the Amazon user and receipt evidence
          with Amazon RVS before granting access.
        </p>
        <Callout kind="note">
          Publishable keys, App Tester sandbox switches, request payloads, and
          response checks are implementation-specific. Keep those instructions
          in the verification provider&apos;s documentation rather than treating
          them as part of the OpenIAP client contract.
        </Callout>
        <p>
          See <Link to="/docs/features/validation">Validation</Link> for the
          cross-store verification model.
        </p>
      </section>
    </div>
  );
}

export default AmazonStoreSetup;
