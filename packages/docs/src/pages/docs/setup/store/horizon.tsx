import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';
import { OPENIAP_VERSIONS } from '../../../../lib/versioning';

function HorizonStoreSetup() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Horizon OS Store Setup"
        description="Configure Horizon OS in-app purchase support for Meta Quest builds across OpenIAP framework libraries."
        path="/docs/setup/store/horizon"
        keywords="Horizon OS setup, Meta Quest IAP, openiap-google-horizon, expo-iap horizon, react-native-iap horizon"
      />
      <h1>Horizon OS Store Setup</h1>
      <p>
        Horizon OS support is an Android build target for Meta Quest devices.
        Select the <code>horizon</code> platform flavor, provide the Horizon app
        id from Meta Horizon Developer Hub, and ship a separate Quest artifact
        from your Play or Fire OS artifacts.
      </p>

      <section>
        <AnchorLink id="required-values" level="h2">
          Required Values
        </AnchorLink>
        <p>
          Horizon setup has one OpenIAP-specific configuration value. It is the
          Meta app id for the Horizon app record, not the Android package name.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Value</th>
              <th>Where to get it</th>
              <th>Where OpenIAP reads it</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Horizon app id</td>
              <td>
                Meta Horizon Developer Hub app record. Gradle projects commonly
                expose it through a placeholder named{' '}
                <code>HORIZON_APP_ID</code>.
              </td>
              <td>
                Expo uses <code>android.horizon.appId</code>. Bare React Native
                and Flutter examples below use a Gradle property named{' '}
                <code>horizonAppId</code> and write Android manifest meta-data{' '}
                <code>com.meta.horizon.platform.HORIZON_APP_ID</code>.
              </td>
            </tr>
            <tr>
              <td>Product SKUs</td>
              <td>Meta Horizon Developer Hub monetization products.</td>
              <td>
                The SKU values passed to <code>fetchProducts</code>,{' '}
                <code>requestPurchase</code>, and Horizon verification.
              </td>
            </tr>
            <tr>
              <td>Verification credentials</td>
              <td>Your backend or IAPKit project configuration.</td>
              <td>
                Runtime verification payloads use <code>horizon.sku</code>,{' '}
                <code>horizon.userId</code>, and{' '}
                <code>horizon.accessToken</code> when verifying Horizon
                receipts.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="store-prerequisites" level="h2">
          Store Prerequisites
        </AnchorLink>
        <ul>
          <li>Register the app in Meta Horizon Developer Hub.</li>
          <li>Configure products and subscriptions with stable SKUs.</li>
          <li>
            Keep the Horizon app id available to the Android manifest at build
            time.
          </li>
          <li>Test on a Meta Quest device signed into an entitled account.</li>
        </ul>
      </section>

      <section>
        <AnchorLink id="framework-setup" level="h2">
          Framework Setup
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Framework</th>
              <th>How Horizon is selected</th>
              <th>App id location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Native Android</td>
              <td>
                Depend on <code>openiap-google-horizon</code> or select{' '}
                <code>platform=horizon</code>.
              </td>
              <td>Android manifest meta-data.</td>
            </tr>
            <tr>
              <td>Expo</td>
              <td>
                <code>modules.horizon</code> plus{' '}
                <code>android.horizon.appId</code> in the <code>expo-iap</code>{' '}
                config plugin.
              </td>
              <td>The config plugin writes manifest meta-data.</td>
            </tr>
            <tr>
              <td>React Native</td>
              <td>
                <code>horizonEnabled=true</code> in Gradle properties.
              </td>
              <td>The app writes Android manifest meta-data directly.</td>
            </tr>
            <tr>
              <td>Flutter</td>
              <td>
                <code>horizonEnabled=true</code> and app-level{' '}
                <code>missingDimensionStrategy</code>.
              </td>
              <td>
                Gradle manifest placeholder, usually from local properties.
              </td>
            </tr>
            <tr>
              <td>KMP</td>
              <td>
                Build/publish the Android <code>horizonRelease</code> variant.
              </td>
              <td>The Android host app owns manifest meta-data.</td>
            </tr>
            <tr>
              <td>MAUI</td>
              <td>
                Build Android with <code>OpenIapAndroidStore=horizon</code>,{' '}
                <code>meta</code>, or <code>quest</code>.
              </td>
              <td>The Android manifest in the MAUI app owns the app id.</td>
            </tr>
            <tr>
              <td>Godot</td>
              <td>No dedicated Horizon flavor switch yet.</td>
              <td>Not applicable.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="native-android" level="h2">
          Native Android
        </AnchorLink>
        <p>
          Use the Horizon artifact directly, or select the local Gradle flavor
          when building from source:
        </p>
        <CodeBlock language="kotlin">{`dependencies {
    implementation("io.github.hyochan.openiap:openiap-google-horizon:${OPENIAP_VERSIONS.google}")
}

android {
    defaultConfig {
        missingDimensionStrategy("platform", "horizon")
    }
}`}</CodeBlock>
        <p>Provide the app id in the Android manifest:</p>
        <CodeBlock language="xml">{`<meta-data
    android:name="com.meta.horizon.platform.HORIZON_APP_ID"
    android:value="YOUR_HORIZON_APP_ID" />`}</CodeBlock>
        <p>
          OpenIAP still reads the older <code>...ovr.OCULUS_APP_ID</code>,{' '}
          <code>...ovr.HORIZON_APP_ID</code>, and{' '}
          <code>com.oculus.vr.APP_ID</code> keys for migration. New setup should
          use the Horizon 2.x canonical key above.
        </p>
      </section>

      <section>
        <AnchorLink id="expo" level="h2">
          Expo
        </AnchorLink>
        <p>
          Expo apps should let the <code>expo-iap</code> config plugin write the
          Gradle flavor, dependency, and manifest app id during prebuild:
        </p>
        <CodeBlock language="typescript">{`plugins: [
  [
    'expo-iap',
    {
      modules: {
        horizon: true,
      },
      android: {
        horizon: {
          appId: 'YOUR_HORIZON_APP_ID',
        },
      },
    },
  ],
]`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="react-native" level="h2">
          React Native
        </AnchorLink>
        <p>
          <code>react-native-iap</code> has no Expo config plugin. Select the
          Horizon flavor in the app Gradle build and write the app id in the
          manifest yourself:
        </p>
        <CodeBlock language="properties">{`# android/gradle.properties
horizonEnabled=true
fireOsEnabled=false
horizonAppId=YOUR_HORIZON_APP_ID`}</CodeBlock>
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

        manifestPlaceholders = [
            HORIZON_APP_ID: project.findProperty('horizonAppId') ?: ''
        ]
    }
}`}</CodeBlock>
        <CodeBlock language="xml">{`<meta-data
    android:name="com.meta.horizon.platform.HORIZON_APP_ID"
    android:value="\${HORIZON_APP_ID}" />`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="flutter" level="h2">
          Flutter
        </AnchorLink>
        <p>
          Flutter uses the same Gradle property model as bare React Native. The
          app module maps the property into the plugin flavor and injects the
          app id through a manifest placeholder:
        </p>
        <CodeBlock language="properties">{`# android/gradle.properties
horizonEnabled=true
fireOsEnabled=false`}</CodeBlock>
        <CodeBlock language="groovy">{`def horizonEnabled = project.findProperty('horizonEnabled')?.toBoolean() ?: false
def fireOsEnabled = project.findProperty('fireOsEnabled')?.toBoolean() ?: false
def flavor = fireOsEnabled ? 'amazon' : (horizonEnabled ? 'horizon' : 'play')

android {
    defaultConfig {
        missingDimensionStrategy 'platform', flavor
        manifestPlaceholders = [
            HORIZON_APP_ID: localProperties.getProperty("HORIZON_APP_ID") ?: ""
        ]
    }
}`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="kmp-maui" level="h2">
          KMP and MAUI
        </AnchorLink>
        <p>
          KMP publishes a dedicated Android <code>horizonRelease</code> variant.
          Build that variant for Quest distribution and keep the app id in the
          Android host manifest.
        </p>
        <CodeBlock language="bash">{`./gradlew :library:assembleHorizonRelease`}</CodeBlock>
        <p>MAUI selects the Horizon AAR flavor with an MSBuild property:</p>
        <CodeBlock language="bash">{`dotnet build -f net9.0-android -p:OpenIapAndroidStore=horizon`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="verification" level="h2">
          Verification
        </AnchorLink>
        <p>
          Client purchase calls stay the same. For server validation, pass the
          Horizon receipt context to{' '}
          <Link to="/docs/features/validation">Validation</Link> or IAPKit using
          the <code>horizon</code> verification payload.
        </p>
      </section>
    </div>
  );
}

export default HorizonStoreSetup;
