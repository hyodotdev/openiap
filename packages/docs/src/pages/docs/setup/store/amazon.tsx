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
                Use <code>openiap-google-amazon</code> or select{' '}
                <code>platform=amazon</code>.
              </td>
              <td>Not a Kepler target.</td>
            </tr>
            <tr>
              <td>Expo</td>
              <td>
                <code>modules.amazon.fireOS</code> in the <code>expo-iap</code>{' '}
                config plugin.
              </td>
              <td>
                <code>modules.amazon.vegaOS</code>, with optional{' '}
                <code>android.amazon.vegaOS</code> metadata overrides.
              </td>
            </tr>
            <tr>
              <td>React Native</td>
              <td>
                <code>fireOsEnabled=true</code> in Gradle properties.
              </td>
              <td>
                Separate React Native for Vega target with Kepler dependencies
                and <code>manifest.toml</code>.
              </td>
            </tr>
            <tr>
              <td>Flutter</td>
              <td>
                <code>fireOsEnabled=true</code> and app-level{' '}
                <code>missingDimensionStrategy</code>.
              </td>
              <td>No Vega runtime target.</td>
            </tr>
            <tr>
              <td>KMP</td>
              <td>
                Build/publish the Android <code>amazonRelease</code> variant.
              </td>
              <td>No Vega runtime target.</td>
            </tr>
            <tr>
              <td>MAUI</td>
              <td>
                Build Android with <code>OpenIapAndroidStore=amazon</code>,{' '}
                <code>fire</code>, <code>fireos</code>, or <code>fire-os</code>.
              </td>
              <td>No Vega runtime target.</td>
            </tr>
            <tr>
              <td>Godot</td>
              <td>
                Shared Amazon store and verification types exist; no dedicated
                Fire OS flavor switch yet.
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
          through the Android <code>amazon</code> flavor.
        </p>

        <AnchorLink id="native-android" level="h3">
          Native Android
        </AnchorLink>
        <p>
          Depend on the Amazon artifact and select the <code>amazon</code>{' '}
          flavor in the app's Gradle build:
        </p>
        <CodeBlock language="kotlin">{`dependencies {
    implementation("io.github.hyochan.openiap:openiap-google-amazon:${OPENIAP_VERSIONS.google}")
}

android {
    defaultConfig {
        missingDimensionStrategy("platform", "amazon")
    }
}`}</CodeBlock>

        <AnchorLink id="expo-fire-os" level="h3">
          Expo
        </AnchorLink>
        <p>
          Expo apps use the config plugin. The plugin writes Gradle selection,
          dependency injection, and Fire OS manifest cleanup during prebuild.
        </p>
        <CodeBlock language="typescript">{`plugins: [
  [
    'expo-iap',
    {
      modules: {
        amazon: {
          fireOS: true,
        },
      },
    },
  ],
]`}</CodeBlock>

        <AnchorLink id="react-native-fire-os" level="h3">
          React Native
        </AnchorLink>
        <p>
          Bare React Native selects Fire OS at the Gradle layer; there is no RN
          config plugin for Amazon options. The same switch also drives Horizon
          OS (Meta Quest) builds — see{' '}
          <Link to="/docs/setup/store/horizon">Horizon OS Setup</Link> — so keep{' '}
          <code>horizonEnabled=false</code> in Amazon artifacts.
        </p>
        <CodeBlock language="properties">{`# android/gradle.properties
fireOsEnabled=true
horizonEnabled=false`}</CodeBlock>
        <CodeBlock language="groovy">{`// android/app/build.gradle
android {
    defaultConfig {
        def horizonEnabled = project.findProperty('horizonEnabled')?.toBoolean() ?: false
        def fireOsEnabled = project.findProperty('fireOsEnabled')?.toBoolean() ?: false
        if (horizonEnabled && fireOsEnabled) {
            throw new GradleException("horizonEnabled and fireOsEnabled cannot both be true")
        }
        def flavor = fireOsEnabled ? 'amazon' : (horizonEnabled ? 'horizon' : 'play')
        missingDimensionStrategy "platform", flavor
    }
}`}</CodeBlock>

        <AnchorLink id="flutter-fire-os" level="h3">
          Flutter
        </AnchorLink>
        <p>
          Flutter uses the same Gradle property model as bare React Native — set
          the property, then map it to the plugin flavor in the app module:
        </p>
        <CodeBlock language="properties">{`# android/gradle.properties
fireOsEnabled=true
horizonEnabled=false`}</CodeBlock>
        <CodeBlock language="groovy">{`// android/app/build.gradle
def horizonEnabled = project.findProperty('horizonEnabled')?.toBoolean() ?: false
def fireOsEnabled = project.findProperty('fireOsEnabled')?.toBoolean() ?: false
def flavor = fireOsEnabled ? 'amazon' : (horizonEnabled ? 'horizon' : 'play')

android {
    defaultConfig {
        missingDimensionStrategy 'platform', flavor
    }
}`}</CodeBlock>

        <AnchorLink id="kmp-maui-fire-os" level="h3">
          KMP and MAUI
        </AnchorLink>
        <p>
          KMP exposes the Android <code>amazonRelease</code> variant and sets{' '}
          <code>OPENIAP_STORE="amazon"</code>. MAUI selects the Amazon AAR
          flavor by MSBuild property.
        </p>
        <CodeBlock language="bash">{`./gradlew :library:assembleAmazonRelease
dotnet build -f net10.0-android -p:OpenIapAndroidStore=amazon`}</CodeBlock>
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
          <code>fireOsEnabled</code> selects the Fire OS Android flavor only —
          it is not a Vega selector and has no effect on Vega builds.
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
          Expo can prepare the Vega target from config. <code>fireOS</code> and{' '}
          <code>vegaOS</code> can both be enabled, but they still produce
          separate artifacts; keep both flags in <code>modules.amazon</code>.
        </p>
        <CodeBlock language="typescript">{`plugins: [
  [
    'expo-iap',
    {
      modules: {
        amazon: {
          fireOS: true,
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
