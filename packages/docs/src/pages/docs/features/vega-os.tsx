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
                Runtime adapter selected when the app is running on React Native
                for Vega and <code>Platform.OS</code> is <code>kepler</code>
              </td>
            </tr>
            <tr>
              <td>Fire OS</td>
              <td>Android, React Native, Expo, Flutter</td>
              <td>
                Android <code>amazon</code> flavor. See{' '}
                <Link to="/docs/fireos-setup">Fire OS Setup</Link>.
              </td>
            </tr>
            <tr>
              <td>Flutter, Godot, KMP, MAUI, native Android</td>
              <td>Not Vega targets</td>
              <td>No Vega JavaScript runtime adapter</td>
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
            The current public Vega docs center on React Native 0.72 support.
          </li>
          <li>
            Amazon Vega IAP package installed in the app:
            <CodeBlock language="json">{`{
  "dependencies": {
    "@amazon-devices/keplerscript-appstore-iap-lib": "~2.12.13"
  }
}`}</CodeBlock>
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
          Do not set <code>fireOsEnabled=true</code> for Vega OS. That Gradle
          property selects the Fire OS Android flavor only.
        </p>
        <p>
          In Expo or React Native config plugin options, set{' '}
          <code>modules.vega=true</code>. It does not select an Android flavor;
          the Expo config plugin prepares the Vega manifest and Kepler project
          metadata, then prevents accidental combinations with{' '}
          <code>modules.fireOS</code> or <code>modules.horizon</code>.
        </p>

        <h3 id="react-native-iap" className="anchor-heading">
          react-native-iap
          <a href="#react-native-iap" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Install <code>react-native-iap</code> normally. The package includes a
          Vega resolver that loads <code>vega.kepler.ts</code> in the{' '}
          <code>kepler</code> runtime. Non-Vega platforms continue creating the
          Nitro <code>RnIap</code> HybridObject.
        </p>

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
        <CodeBlock language="typescript">{`[
  'expo-iap',
  {
    modules: {
      vega: true,
    },
    vega: {
      packageId: 'dev.example.app',
      title: 'Example App',
      icon: './assets/images/icon.png',
    },
  },
]`}</CodeBlock>
        <p>
          When <code>modules.vega</code> is enabled, the Expo plugin prepares
          the Vega manifest, entry point, generated app metadata, app icon
          assets, Kepler package metadata, and Vega build scripts during
          prebuild.
        </p>
        <CodeBlock language="bash">{`EXPO_IAP_VEGA=1 expo prebuild --platform android --no-install
EXPO_IAP_VEGA=1 react-native build-vega --build-type Debug`}</CodeBlock>
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
await finishTransaction({ purchase, isConsumable: true });`}</CodeBlock>
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
              <td>
                <code>PurchasingService.getPurchaseUpdates</code>
              </td>
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
            included in the client package.
          </li>
          <li>
            The OpenIAP store remains <code>amazon</code> for compatibility,
            while runtime selection remains Vega-specific.
          </li>
          <li>
            Complete <code>build-vega</code> bundling requires a React Native
            version supported by the installed Amazon Vega CLI. If the CLI
            rejects the app's React Native version, <code>modules.vega</code>{' '}
            can still prepare and validate the Vega project files, but the app
            needs an Amazon-supported React Native for Vega build target.
          </li>
        </ul>
      </section>
    </div>
  );
}

export default VegaOSRuntime;
