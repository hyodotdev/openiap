import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function OnsideStoreSetup() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Onside Store Setup"
        description="Configure Onside alternative marketplace support for expo-iap on iOS."
        path="/docs/setup/store/onside"
        keywords="Onside setup, alternative marketplace, expo-iap, iOS MarketplaceKit, DMA"
      />
      <h1>Onside Store Setup</h1>
      <p>
        <a href="https://onside.io" target="_blank" rel="noopener noreferrer">
          Onside
        </a>{' '}
        support is currently available in <strong>expo-iap</strong>. It is an
        iOS runtime integration for apps distributed through the Onside
        marketplace, not a React Native, Flutter, KMP, MAUI, or Godot build
        option.
      </p>

      <section>
        <AnchorLink id="required-values" level="h2">
          Required Values
        </AnchorLink>
        <p>
          Onside does not use an Android-style app id. The critical values are
          the iOS bundle identity and the Expo config flag that decides whether
          the Onside native module is compiled.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Value</th>
              <th>Where to get it</th>
              <th>Where it is used</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>ios.bundleIdentifier</code>
              </td>
              <td>Your Apple/Expo app configuration and Onside app record.</td>
              <td>
                iOS app identity. It must stay stable across the Onside
                registration and the app binary you distribute.
              </td>
            </tr>
            <tr>
              <td>
                <code>modules.onside</code>
              </td>
              <td>Your Expo config.</td>
              <td>
                Enables the <code>expo-iap</code> Onside module during Expo
                prebuild and pod installation.
              </td>
            </tr>
            <tr>
              <td>Onside app registration</td>
              <td>
                <a
                  href="https://developer.onside.io"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  developer.onside.io
                </a>
                .
              </td>
              <td>
                The installed app is recognized as an Onside-distributed app at
                runtime. App Store installs fall back to Apple StoreKit.
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
          <li>
            Register the app at{' '}
            <a
              href="https://developer.onside.io"
              target="_blank"
              rel="noopener noreferrer"
            >
              developer.onside.io
            </a>
            .
          </li>
          <li>Use an iOS app target with a stable bundle identifier.</li>
          <li>Test on a real iPhone with the Onside Store installed.</li>
          <li>
            Keep standard Apple IAP configured as the fallback for App Store
            installs.
          </li>
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
              <th>Status</th>
              <th>Setup path</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Expo</td>
              <td>Supported</td>
              <td>
                Enable <code>modules.onside</code> in the <code>expo-iap</code>{' '}
                config plugin.
              </td>
            </tr>
            <tr>
              <td>React Native</td>
              <td>Not supported</td>
              <td>No Onside native module or config plugin path.</td>
            </tr>
            <tr>
              <td>Flutter</td>
              <td>Not supported</td>
              <td>No Onside runtime selector.</td>
            </tr>
            <tr>
              <td>KMP</td>
              <td>Not supported</td>
              <td>No Onside runtime selector.</td>
            </tr>
            <tr>
              <td>MAUI</td>
              <td>Not supported</td>
              <td>No Onside runtime selector.</td>
            </tr>
            <tr>
              <td>Godot</td>
              <td>Not supported</td>
              <td>No Onside runtime selector.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="expo" level="h2">
          Expo
        </AnchorLink>
        <p>
          Enable Onside in the config plugin. The plugin updates the Expo module
          autolinking configuration and Podfile environment so the Onside native
          module is compiled only when requested.
        </p>
        <CodeBlock language="typescript">{`plugins: [
  [
    'expo-iap',
    {
      modules: {
        onside: true,
      },
    },
  ],
]`}</CodeBlock>
        <p>
          Run prebuild after changing this option so native autolinking and pods
          are regenerated:
        </p>
        <CodeBlock language="bash">{`npx expo prebuild --clean
cd ios && pod install`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="runtime-selection" level="h2">
          Runtime Selection
        </AnchorLink>
        <p>
          Onside is selected at runtime based on the install source. Block IAP
          UI until the installation check finishes so the app does not default
          to Apple before the Onside check completes.
        </p>
        <CodeBlock language="typescript">{`import { useOnside } from 'expo-iap';

export default function App() {
  const { isOnsideLoading } = useOnside();

  if (isOnsideLoading) return <SplashScreen />;

  return <MainApp />;
}`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="purchase-code" level="h2">
          Purchase Code
        </AnchorLink>
        <p>
          Purchase calls stay on the normal <code>expo-iap</code> API. The
          runtime chooses Onside or Apple under the hood:
        </p>
        <CodeBlock language="typescript">{`import { finishTransaction, useIAP } from 'expo-iap';

function StoreScreen() {
  const { products, fetchProducts, requestPurchase } = useIAP({
    onPurchaseSuccess: (purchase) => {
      void finishTransaction({ purchase, isConsumable: false }).catch((error) => {
        reportPurchaseError(error);
      });
    },
    onPurchaseError: (error) => {
      reportPurchaseError(error);
    },
  });

  return <ProductList products={products} onBuy={requestPurchase} />;
}`}</CodeBlock>
        <p>
          See <Link to="/docs/setup/expo">Expo Setup</Link> for the full config
          plugin context.
        </p>
      </section>
    </div>
  );
}

export default OnsideStoreSetup;
