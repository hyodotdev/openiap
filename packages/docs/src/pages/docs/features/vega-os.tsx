import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function VegaOSRuntime() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Vega OS Runtime"
        description="Configure OpenIAP for Amazon Vega OS in React Native for Vega apps using the Vega JavaScript IAP runtime adapter."
        path="/docs/features/vega-os"
        keywords="Vega OS IAP, React Native for Vega, Amazon Vega SDK, OpenIAP Vega, kepler"
      />
      <h1>Vega OS Runtime</h1>

      <p>
        Vega OS is not Fire OS and it is not an Android flavor. OpenIAP supports
        Vega OS as a runtime-selected JavaScript adapter for React Native for
        Vega apps, using Amazon's Vega IAP JavaScript API.
      </p>
      <p>
        Treat this like the Onside integration layer: the library keeps the
        normal native module path for iOS, Android, Fire OS, and Horizon, then
        switches to the Vega adapter only when the app is running in the{' '}
        <code>kepler</code> runtime.
      </p>

      <section>
        <AnchorLink id="target-matrix" level="h2">
          Target Matrix
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Target</th>
              <th>Library</th>
              <th>Selection</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Vega OS</td>
              <td>
                <code>react-native-iap</code>, <code>expo-iap</code>
              </td>
              <td>
                Runtime adapter selected in the <code>kepler</code> runtime for
                React Native for Vega apps
              </td>
            </tr>
            <tr>
              <td>Fire OS</td>
              <td>
                Android, <code>react-native-iap</code>, <code>expo-iap</code>,{' '}
                <code>flutter_inapp_purchase</code>, <code>kmp-iap</code>,{' '}
                <code>OpenIap.Maui</code>
              </td>
              <td>
                Build-time Android <code>amazon</code> flavor; not the Vega
                runtime path. See{' '}
                <Link to="/docs/fireos-setup">Fire OS Setup</Link>.
              </td>
            </tr>
            <tr>
              <td>Google Play / Horizon OS</td>
              <td>Android and framework wrappers</td>
              <td>
                Default Play artifact or Android <code>horizon</code> flavor
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="requirements" level="h2">
          Requirements
        </AnchorLink>
        <ul>
          <li>
            An app build target compatible with Amazon React Native for Vega.
            The current public Vega docs center on{' '}
            <a
              href="https://developer.amazon.com/docs/react-native-vega/0.72/react_overview.html"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              React Native 0.72 support
            </a>
            .
          </li>
          <li>
            Amazon Vega IAP installed in the Vega app target.{' '}
            <code>react-native-iap</code> and <code>expo-iap</code> declare the
            Amazon IAP package as an optional peer dependency, so non-Vega iOS,
            Android, Fire OS, and Horizon builds do not install it by default:
            <CodeBlock language="bash">{`npm install @amazon-devices/keplerscript-appstore-iap-lib@~2.12.13`}</CodeBlock>
          </li>
          <li>
            Vega IAP service declarations in <code>manifest.toml</code>:
            <CodeBlock language="toml">{`[wants]
[[wants.service]]
id = "com.amazon.iap.core.service"
[[wants.module]]
id = "/com.amazon.iap.core@IIAPCoreUI"

[needs]
[[needs.module]]
id = "/com.amazon.kepler.appstore.iap.purchase.core@IAppstoreIAPPurchaseCoreService"`}</CodeBlock>
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="setup" level="h2">
          Setup
        </AnchorLink>
        <p>
          Do not use <code>fireOsEnabled=true</code> as the Vega OS selector.
          That Gradle property selects the Fire OS Android flavor only. Use{' '}
          <code>amazon.vegaOS</code> for the Amazon Vega runtime target and{' '}
          <code>amazon.fireOS</code> only when the same config should also
          prepare Fire OS Android builds.
        </p>
        <p>
          Vega apps need a Kepler-compatible React Native project, a{' '}
          <code>manifest.toml</code>, and a Vega build target. The{' '}
          <code>expo-iap</code> config plugin can generate that project
          metadata. Plain React Native apps should provide the Vega project
          files directly, as shown in the OpenIAP repository example.
        </p>
        <p>
          Use Amazon's React Native for Vega project setup as the source of
          truth for <code>kepler</code> runtime dependencies. OpenIAP provides
          the IAP adapter and package integration for that Vega target.
        </p>

        <h3 id="react-native-iap" className="anchor-heading">
          react-native-iap
          <a href="#react-native-iap" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          References:{' '}
          <Link to="/docs/setup/react-native">
            OpenIAP React Native setup guide
          </Link>
          ;{' '}
          <a
            href="https://developer.amazon.com/docs/react-native-vega/0.72/react_overview.html"
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
          >
            Amazon React Native for Vega overview
          </a>
        </p>
        <p>
          Install <code>react-native-iap</code> normally. The package includes a
          Vega resolver that loads <code>vega.kepler.ts</code> in the{' '}
          <code>kepler</code> runtime. Non-Vega platforms continue creating the
          Nitro <code>RnIap</code> HybridObject.
        </p>
        <p>
          Vega users install the Amazon IAP package in their Vega app target to
          satisfy the optional peer dependency. Projects that also ship regular
          iOS or Android apps should isolate the Amazon React Native for Vega
          runtime packages in the Vega target, as the repository example build
          script does with a temporary React Native 0.72 app.
        </p>
        <p>
          In <code>react-native-iap</code>, the config plugin can select the
          Fire OS Android flavor with <code>amazon.fireOS</code>, but it does
          not generate Vega project files or automatically sync package.json
          dependencies. A plain React Native Vega target should provide its own{' '}
          <code>manifest.toml</code>, Kepler entry point, Metro/Babel resolver,
          package dependencies, and <code>kepler</code> metadata directly.
        </p>
        <CodeBlock language="bash">{`# In the Vega-only React Native for Vega target
yarn add react-native-iap
yarn add @amazon-devices/keplerscript-appstore-iap-lib@~2.12.13 @amazon-devices/react-native-kepler@^2.0.0
yarn add -D @amazon-devices/kepler-cli-platform@~0.22.0 @react-native-community/cli@11.3.2 @react-native/metro-config@^0.72.6`}</CodeBlock>
        <p>
          A Vega-only package manifest can keep the React Native for Vega
          runtime as a direct dependency because that manifest is not used by
          normal iOS or Android builds:
        </p>
        <CodeBlock language="json">{`{
  "dependencies": {
    "@amazon-devices/keplerscript-appstore-iap-lib": "~2.12.13",
    "@amazon-devices/react-native-kepler": "^2.0.0",
    "react": "18.2.0",
    "react-native": "0.72.0"
  },
  "devDependencies": {
    "@amazon-devices/kepler-cli-platform": "~0.22.0",
    "@react-native-community/cli": "11.3.2",
    "@react-native/metro-config": "^0.72.6"
  },
  "kepler": {
    "projectType": "application",
    "appName": "MyVegaApp",
    "targets": ["tv"],
    "os": ["vega"]
  }
}`}</CodeBlock>
        <p>
          The React Native example includes a Vega build script that creates an
          Amazon-supported React Native 0.72 Vega build target, copies the
          current package source plus the existing example screens into that
          target, and produces an <code>armv7</code> package for Fire TV
          devices. The Vega app opens the same example menu and flows as the
          regular React Native example:
        </p>
        <CodeBlock language="bash">{`cd libraries/react-native-iap/example
yarn build:vega:debug

yarn run:vega:firetv`}</CodeBlock>

        <h3 id="expo-iap" className="anchor-heading">
          expo-iap
          <a href="#expo-iap" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Expo projects can use <code>expo-iap</code> to prepare the Vega
          project files through the config plugin. The app still has to build
          against a React Native for Vega runtime version supported by the
          installed Amazon Vega CLI.
        </p>
        <p>
          Install the Amazon Vega peer dependency only for the Vega build
          target. The regular Expo iOS and Android development build should not
          require <code>@amazon-devices/react-native-kepler</code> unless that
          same package manifest is intentionally building a Vega artifact. Vega
          CI should also install optional dependencies so the React Native for
          Vega runtime is present for <code>build-vega</code>.
        </p>
        <CodeBlock language="typescript">{`[
  'expo-iap',
  {
    amazon: {
      fireOS: true,
      vegaOS: true,
    },
    vega: {
      packageId: 'dev.example.app',
      title: 'Example App',
      icon: './assets/images/icon.png',
    },
  },
]`}</CodeBlock>
        <p>
          When <code>amazon.vegaOS</code> is enabled, the Expo plugin prepares
          the Vega manifest, entry point, generated app metadata, app icon
          assets, Kepler package metadata, and Vega build scripts during
          prebuild. It keeps the Amazon IAP package as a runtime dependency and
          the Kepler CLI/Metro/Babel packages as development dependencies, but
          syncs <code>@amazon-devices/react-native-kepler</code> as an{' '}
          <code>optionalDependency</code> so regular iOS and Android Codegen do
          not scan it as a direct React Native dependency.{' '}
          <code>amazon.fireOS</code> can be enabled in the same config, but Fire
          OS and Vega OS still produce separate build artifacts.
        </p>
        <CodeBlock language="bash">{`EXPO_IAP_VEGA=1 expo prebuild --platform android --no-install
EXPO_IAP_VEGA=1 react-native build-vega --build-type Debug`}</CodeBlock>
        <p>
          The Expo example also includes a Vega build script for testing the
          current local <code>expo-iap</code> source against an Amazon-supported
          React Native 0.72 Vega build target. The script copies the existing
          Expo Router routes and example components into the temporary Vega app,
          then uses lightweight shims only for Expo Router navigation and
          Expo-only helper modules:
        </p>
        <CodeBlock language="bash">{`cd libraries/expo-iap/example
bun run build:vega:debug

bun run run:vega:firetv`}</CodeBlock>
        <p>
          For local IAPKit validation while testing on a physical Fire TV
          device, run the Kit API server on the Mac and build the example with a
          LAN-reachable base URL. A Fire TV device cannot reach the Mac through{' '}
          <code>localhost</code>, so use the Mac's Wi-Fi IP address:
        </p>
        <CodeBlock language="bash">{`# Terminal 1: local Kit API server
cd packages/kit
PORT=3100 bun --env-file=.env.local ./server/server.ts

# Terminal 2: React Native example
cd libraries/react-native-iap
IAPKIT_API_KEY=openiap-kit_<your-key> \\
IAPKIT_BASE_URL=http://<mac-lan-ip>:3100 \\
  yarn workspace rn-iap-example build:vega:debug

# Terminal 2: Expo example
cd libraries/expo-iap/example
EXPO_PUBLIC_IAPKIT_API_KEY=openiap-kit_<your-key> \\
EXPO_PUBLIC_IAPKIT_BASE_URL=http://<mac-lan-ip>:3100 \\
  bun run build:vega:debug`}</CodeBlock>
        <p>
          Include the matching IAPKit API key environment variable when testing
          server verification: <code>IAPKIT_API_KEY</code> for the React Native
          example, or <code>EXPO_PUBLIC_IAPKIT_API_KEY</code> for the Expo
          example.
        </p>
        <p>
          Amazon's Vega run-app documentation uses the interactive component ID
          as the app id. For physical Fire TV devices, replace{' '}
          <code>&lt;device-serial&gt;</code> with the serial shown by{' '}
          <code>vega device list</code>. For Vega Virtual Device (VVD), use the
          architecture-specific package that matches the virtual device.
        </p>
        <CodeBlock language="bash">{`vega device list

vega device -d <device-serial> install-app \\
  --packagePath build/armv7-debug/<example>_armv7.vpkg

vega device -d <device-serial> launch-app \\
  --appName <component-id>`}</CodeBlock>
        <p>
          Some Fire TV devices show a five-digit parental-control PIN prompt
          before the app is foregrounded. If remote number key events do not
          complete the prompt, send the PIN digits through VDA. This example
          enters <code>01234</code>:
        </p>
        <CodeBlock language="bash">{`for key in KEY_0 KEY_1 KEY_2 KEY_3 KEY_4; do
  vega exec vda -s <device-serial> shell inputd-cli button_press "$key"
done`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="app-tester-sandbox" level="h2">
          App Tester Sandbox
        </AnchorLink>
        <p>
          Local Vega IAP testing uses Amazon App Tester in sandbox mode. Keep
          the App Tester catalog file and the app sandbox config file separate:
          App Tester reads <code>amazon.sdktester.json</code>, while the app
          reads <code>amazon.config.json</code>.
        </p>
        <p>
          Amazon's{' '}
          <a
            href="https://developer.amazon.com/docs/vega/0.22/configure-app-tester.html"
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
          >
            App Tester configuration documentation
          </a>{' '}
          requires the tester service and UI module in{' '}
          <code>manifest.toml</code> for sandbox testing:
        </p>
        <CodeBlock language="toml">{`[wants]
[[wants.service]]
id = "com.amazon.iap.tester.service"

[[wants.module]]
id = "/com.amazonappstore.iap.tester@IIAPTesterUI"`}</CodeBlock>
        <p>Push the App Tester catalog to the App Tester scratch directory:</p>
        <CodeBlock language="bash">{`vega exec vda -s <device-serial> shell \\
  mkdir -p /tmp/scratch/com.amazonappstore.iap.tester

vega device copy-to -d <device-serial> \\
  -s amazon.sdktester.json \\
  -o /tmp/scratch/com.amazonappstore.iap.tester`}</CodeBlock>
        <p>
          Enable sandbox mode for the Vega application id with this app-local
          config. Use the id passed to <code>run-app</code> or{' '}
          <code>launch-app</code>, for example the interactive component id in{' '}
          <code>manifest.toml</code>.
        </p>
        <CodeBlock language="json">{`{
  "debug.amazon.sandboxmode": "debug"
}`}</CodeBlock>
        <CodeBlock language="bash">{`vega exec vda -s <device-serial> shell \\
  mkdir -p /tmp/scratch/<application-id>

vega device copy-to -d <device-serial> \\
  -s amazon.config.json \\
  -o /tmp/scratch/<application-id>`}</CodeBlock>
        <p>
          Relaunch App Tester after changing <code>amazon.sdktester.json</code>,
          and relaunch the test app after changing{' '}
          <code>amazon.config.json</code>, following Amazon's{' '}
          <a
            href="https://developer.amazon.com/docs/vega/0.22/use-app-tester.html"
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
          >
            App Tester usage documentation
          </a>
          . In sandbox mode, IAP logs should report the debug sandbox mode and
          App Tester responses instead of production-mode catalog responses.
        </p>
        <CodeBlock language="bash">{`vega exec vda -s <device-serial> shell \\
  vlcm terminate-app --pkg-id com.amazonappstore.iap.tester --force

vega exec vda -s <device-serial> shell \\
  vlcm launch-app pkg://com.amazonappstore.iap.tester.ui

vega device -d <device-serial> terminate-app --appName <component-id>
vega device -d <device-serial> launch-app --appName <component-id>`}</CodeBlock>
        <p>
          OpenIAP's repository examples include matching{' '}
          <code>amazon.sdktester.json</code> and <code>amazon.config.json</code>{' '}
          files for the example product IDs so the <code>All Products</code> and
          purchase-flow screens can be tested against App Tester.
        </p>
        <p>
          If App Tester shows the JSON catalog, the sandbox user is logged in,
          and <code>getProductData</code> or <code>getPurchaseUpdates</code>{' '}
          still returns <code>FAILED</code>, check the installed Amazon Vega IAP
          package/runtime before changing OpenIAP product IDs. A public{' '}
          <a
            href="https://community.amazondeveloper.com/t/using-amazon-devices-keplerscript-appstore-iap-lib-2-12-13-causes-in-app-purchases-to-fail/24746"
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
          >
            Amazon Developer Community report
          </a>{' '}
          tracks this behavior with{' '}
          <code>@amazon-devices/keplerscript-appstore-iap-lib@2.12.13</code>.
          OpenIAP surfaces those responses as product or purchase loading errors
          so the app can stay open while the Amazon-side package/runtime issue
          is investigated.
        </p>
      </section>

      <section>
        <AnchorLink id="usage" level="h2">
          Usage
        </AnchorLink>
        <p>
          App code keeps the standard OpenIAP API shape. The runtime adapter
          maps the calls to Amazon's Vega IAP service.
        </p>
        <CodeBlock language="typescript">{`import {
  fetchProducts,
  finishTransaction,
  initConnection,
  requestPurchase,
  verifyPurchaseWithProvider,
} from 'react-native-iap'; // or 'expo-iap'

await initConnection();

const products = await fetchProducts({
  skus: ['coins_100'],
  type: 'in-app',
});

await requestPurchase({
  request: {
    google: {
      skus: ['coins_100'],
    },
  },
  type: 'in-app',
});

// In the purchase success path:
const verification = await verifyPurchaseWithProvider({
  provider: 'iapkit',
  iapkit: {
    apiKey: '<iapkit-api-key>',
    amazon: {
      receiptId: purchase.purchaseToken ?? '',
      sandbox: __DEV__,
    },
  },
});

if (verification.iapkit?.isValid !== true) {
  throw new Error('IAPKit could not verify the Amazon receipt');
}

await finishTransaction({ purchase, isConsumable: true });`}</CodeBlock>
        <p>
          Vega OS uses the same IAPKit Amazon payload as Fire OS. The Vega
          adapter sends <code>store: 'amazon'</code> to IAPKit and can resolve
          the Amazon user id from Vega user data when <code>amazon.userId</code>{' '}
          is omitted.
        </p>
      </section>

      <section>
        <AnchorLink id="api-mapping" level="h2">
          API Mapping
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>OpenIAP API</th>
              <th>Vega JavaScript IAP API</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>initConnection()</code>
              </td>
              <td>
                Marks the Vega adapter ready without fetching Amazon user data
              </td>
            </tr>
            <tr>
              <td>
                <code>getStorefront()</code>
              </td>
              <td>
                <code>PurchasingService.getUserData</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>fetchProducts()</code>
              </td>
              <td>
                <code>PurchasingService.getProductData</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>requestPurchase()</code>
              </td>
              <td>
                <code>PurchasingService.purchase</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>getAvailablePurchases()</code>,{' '}
                <code>restorePurchases()</code>
              </td>
              <td>Internal Amazon purchase update read</td>
            </tr>
            <tr>
              <td>
                <code>finishTransaction()</code>
              </td>
              <td>
                <code>PurchasingService.notifyFulfillment</code>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="limitations" level="h2">
          Current Limitations
        </AnchorLink>
        <ul>
          <li>
            Vega OS support is limited to React Native for Vega. OpenIAP exposes
            that path through <code>react-native-iap</code> and through{' '}
            <code>expo-iap</code> config/plugin support for compatible Expo
            projects.
          </li>
          <li>
            Vega OS uses Amazon's JavaScript IAP API, not the Fire OS Android
            Appstore SDK.
          </li>
          <li>
            Server-side Amazon Receipt Verification Service integration is not
            embedded in the client package. Use IAPKit's Amazon verification
            path, or run your own server-side RVS integration.
          </li>
          <li>
            The OpenIAP store remains <code>amazon</code> for compatibility,
            while runtime selection remains Vega-specific.
          </li>
          <li>
            Complete <code>build-vega</code> bundling requires a React Native
            version supported by the installed Amazon Vega CLI. If the CLI
            rejects the app's React Native version, <code>amazon.vegaOS</code>{' '}
            can still prepare and validate the Vega project files, but the app
            needs an Amazon-supported React Native for Vega build target.
          </li>
          <li>
            The repository Vega examples intentionally build through temporary
            React Native 0.72 Vega projects so they can test the current OpenIAP
            package source and the existing example UI while staying inside
            Amazon's supported Vega runtime version.
          </li>
        </ul>
      </section>
    </div>
  );
}

export default VegaOSRuntime;
