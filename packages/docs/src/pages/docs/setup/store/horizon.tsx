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
        Horizon OS is Meta's operating system for Quest headsets, and OpenIAP
        treats it as an Android build target. Select the <code>horizon</code>{' '}
        platform flavor, provide the Horizon app id from Meta Horizon Developer
        Hub, and ship a Quest artifact that is separate from your Google Play or{' '}
        <Link to="/docs/setup/store/amazon">Amazon Fire OS</Link> artifacts.
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
                reads a Gradle property named <code>horizonAppId</code>; Flutter
                reads <code>HORIZON_APP_ID</code> from{' '}
                <code>android/local.properties</code>; Godot reads the{' '}
                <code>openiap/horizon_app_id</code> export option. Each writes
                Android manifest meta-data{' '}
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
              <td>
                Your backend or{' '}
                <a
                  href="https://kit.openiap.dev/docs/verification/horizon"
                  target="_blank"
                  rel="noreferrer"
                >
                  IAPKit
                </a>{' '}
                project configuration.
              </td>
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
        <p>
          Complete these once per app in Meta Horizon Developer Hub before
          configuring any framework:
        </p>
        <ol>
          <li>Register the app in Meta Horizon Developer Hub.</li>
          <li>
            Create your products and subscriptions with stable SKUs — the same
            strings you will pass to <code>fetchProducts</code> and{' '}
            <code>requestPurchase</code>.
          </li>
          <li>
            Copy the Horizon app id so the Android manifest can read it at build
            time.
          </li>
          <li>
            Prepare a Meta Quest device signed into an account that has access
            to the app, such as a release-channel member or registered test
            user.
          </li>
        </ol>
      </section>

      <section>
        <AnchorLink id="framework-setup" level="h2">
          Framework Setup
        </AnchorLink>
        <p>
          Every framework ships Quest support through the same Horizon build of{' '}
          <code>openiap-google</code>; only the switch location differs. Find
          your framework here, then follow the matching section below for full
          snippets.
        </p>
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
                The OpenIAP Gradle plugin: a connected Quest on a debug build;{' '}
                <code>openiapStore=horizon</code> pins it.
              </td>
              <td>Android manifest meta-data.</td>
            </tr>
            <tr>
              <td>Expo</td>
              <td>
                Resolved at build time; an EAS profile pins a release with{' '}
                <code>ORG_GRADLE_PROJECT_openiapStore=horizon</code>.
              </td>
              <td>
                <code>android.horizon.appId</code>; the config plugin writes
                manifest meta-data.
              </td>
            </tr>
            <tr>
              <td>React Native</td>
              <td>
                Resolved at build time by the shared Gradle resolver;{' '}
                <code>openiapStore=horizon</code> pins it.
              </td>
              <td>The app writes Android manifest meta-data directly.</td>
            </tr>
            <tr>
              <td>Flutter</td>
              <td>
                Resolved at build time by the shared Gradle resolver;{' '}
                <code>openiapStore=horizon</code> pins it.
              </td>
              <td>
                Gradle manifest placeholder, usually from local properties.
              </td>
            </tr>
            <tr>
              <td>KMP</td>
              <td>The OpenIAP Gradle plugin, as for native Android.</td>
              <td>The Android host app owns manifest meta-data.</td>
            </tr>
            <tr>
              <td>MAUI</td>
              <td>
                A connected Quest on a Debug build;{' '}
                <code>OpenIapStore=horizon</code> pins it.
              </td>
              <td>The Android manifest in the MAUI app owns the app id.</td>
            </tr>
            <tr>
              <td>Godot</td>
              <td>
                Left at <code>auto</code>, a debug export follows a connected
                Quest; for release, set <code>openiap/android_store</code> to{' '}
                <code>horizon</code>.
              </td>
              <td>
                The <code>openiap/horizon_app_id</code> export option.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="native-android" level="h2">
          Native Android
        </AnchorLink>
        <p>
          Depend on <code>openiap-google</code> and apply the OpenIAP Gradle
          plugin; it links <code>openiap-google-horizon</code> instead when a
          debug build finds a Quest, or when <code>openiapStore=horizon</code>{' '}
          pins a release.
        </p>
        <CodeBlock language="kotlin">{`// settings.gradle.kts
plugins {
    id("io.github.hyodotdev.openiap") version "${OPENIAP_VERSIONS.google}"
}

// app/build.gradle.kts
dependencies {
    implementation("io.github.hyodotdev.openiap:openiap-google:${OPENIAP_VERSIONS.google}")
}`}</CodeBlock>
        <p>Provide the app id in the Android manifest:</p>
        <CodeBlock language="xml">{`<meta-data
    android:name="com.meta.horizon.platform.HORIZON_APP_ID"
    android:value="YOUR_HORIZON_APP_ID" />`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="expo" level="h2">
          Expo
        </AnchorLink>
        <p>
          Keep the app id in the config plugin; the plugin writes the manifest
          meta-data on every prebuild and the Gradle build picks the store. An
          EAS build has no Quest to follow and a release build never looks, so
          pin every EAS profile that must target Horizon in its <code>env</code>
          .
        </p>
        <CodeBlock language="json">{`{
  "build": {
    "quest": {
      "env": { "ORG_GRADLE_PROJECT_openiapStore": "horizon" }
    }
  }
}`}</CodeBlock>
        <CodeBlock language="typescript">{`plugins: [
  [
    'expo-iap',
    {
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
          <code>react-native-iap</code> has no Expo config plugin, so the app
          applies the same resolver script the library uses and writes the app
          id into the manifest itself. Nothing below changes between Play and
          Quest builds: a <code>horizon</code> flavor, a connected Quest on a
          debug build, or <code>-PopeniapStore=horizon</code> picks the store.
        </p>
        <CodeBlock language="properties">{`# android/gradle.properties
horizonAppId=YOUR_HORIZON_APP_ID`}</CodeBlock>
        <CodeBlock language="groovy">{`// android/app/build.gradle
apply from: new File(project(':react-native-iap').projectDir, 'openiap-store.gradle')

android {
    defaultConfig {
        missingDimensionStrategy "platform", openIapResolveStore('app').store

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
          Flutter uses the same resolver as bare React Native. The app module
          applies it from the plugin project and injects the app id through a
          manifest placeholder; <code>localProperties</code> is the loader the
          Flutter Android template already defines in{' '}
          <code>android/app/build.gradle</code>. Pin a release build with{' '}
          <code>ORG_GRADLE_PROJECT_openiapStore=horizon flutter build apk</code>
          .
        </p>
        <CodeBlock language="properties">{`# android/local.properties
HORIZON_APP_ID=YOUR_HORIZON_APP_ID`}</CodeBlock>
        <CodeBlock language="groovy">{`apply from: new File(project(':flutter_inapp_purchase').projectDir, 'openiap-store.gradle')
def openIapStore = openIapResolveStore('app', [allowNone: true]).store

android {
    defaultConfig {
        missingDimensionStrategy 'platform', openIapStore == 'none' ? 'play' : openIapStore
        manifestPlaceholders = [
            HORIZON_APP_ID: localProperties.getProperty("HORIZON_APP_ID") ?: ""
        ]
    }
}`}</CodeBlock>
        <p>Reference the placeholder in the Android manifest:</p>
        <CodeBlock language="xml">{`<meta-data
    android:name="com.meta.horizon.platform.HORIZON_APP_ID"
    android:value="\${HORIZON_APP_ID}" />`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="kmp-maui" level="h2">
          KMP and MAUI
        </AnchorLink>
        <p>
          KMP apps apply the same plugin in <code>settings.gradle.kts</code>,
          which links kmp-iap&apos;s Horizon build, and keep the app id in the
          Android host app&apos;s manifest exactly as in the Native Android
          section above.
        </p>
        <p>
          A MAUI Debug build follows a connected Quest; pin a release with the
          MSBuild property. Unlike the other frameworks, every MAUI build also
          carries the libraries the other stores need (
          <Link to="/docs/setup/maui#android-store">MAUI Setup</Link>).
        </p>
        <CodeBlock language="bash">{`dotnet publish -f net10.0-android -c Release -p:OpenIapStore=horizon`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="godot" level="h2">
          Godot
        </AnchorLink>
        <p>
          Left at <code>auto</code>, the <code>openiap/android_store</code>{' '}
          export option exports the Horizon artifact for a debug export when one
          Quest is connected, or the one <code>ANDROID_SERIAL</code> names. A
          release export ignores the device, so set the option to{' '}
          <code>horizon</code> for release. Put the app id in the{' '}
          <code>openiap/horizon_app_id</code> export option; the plugin writes
          the manifest meta-data.
        </p>
        <CodeBlock language="text">{`[preset.1.options]
openiap/android_store="horizon"
openiap/horizon_app_id="YOUR_HORIZON_APP_ID"`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="verification" level="h2">
          Verification
        </AnchorLink>
        <p>
          Client purchase calls stay the same on Quest —{' '}
          <code>fetchProducts</code> and <code>requestPurchase</code> work
          unchanged. For server validation, pass the Horizon receipt context to{' '}
          <Link to="/docs/features/validation">Validation</Link> or to{' '}
          <a
            href="https://kit.openiap.dev/docs/verification/horizon"
            target="_blank"
            rel="noreferrer"
          >
            IAPKit
          </a>
          , OpenIAP's hosted verification backend, using the{' '}
          <code>horizon</code> payload:
        </p>
        <CodeBlock language="typescript">{`await verifyPurchase({
  horizon: {
    sku: purchase.productId,
    userId: metaUserId,
    accessToken: horizonAccessToken, // Meta app credential
  },
});`}</CodeBlock>
        <p>
          The access token is a Meta app credential. Keep Horizon verification
          on trusted infrastructure — your backend or IAPKit — rather than
          embedding the token in the shipped app.
        </p>
      </section>
    </div>
  );
}

export default HorizonStoreSetup;
