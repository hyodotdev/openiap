import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import {
  ANDROID_SDK,
  CAPACITOR_PACKAGE,
  GOOGLE_PLAY_BILLING,
} from '../../../lib/versioning';

function CapacitorSetup() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Capacitor Setup"
        description="Install and configure capacitor-iap for in-app purchases in Capacitor apps on iOS and Android."
        path="/docs/setup/capacitor"
        keywords="capacitor-iap, Capacitor IAP, Ionic in-app purchase, Capacitor in-app purchase, StoreKit 2, Play Billing"
      />
      <h1>Capacitor Setup</h1>
      <p>
        <code>capacitor-iap</code> adds in-app purchases to Capacitor 8 apps on
        iOS and Android, whatever web framework renders the app. Its API matches{' '}
        <Link to="/docs/setup/expo">expo-iap</Link> and{' '}
        <Link to="/docs/setup/react-native">react-native-iap</Link> without the
        React hooks, so the TypeScript examples in the{' '}
        <Link to="/docs/apis">API reference</Link> apply as written.
      </p>

      <Callout kind="important" title="Before you start">
        Complete the store configuration before integrating with your framework:{' '}
        <Link to="/docs/ios-setup">iOS Setup</Link> |{' '}
        <Link to="/docs/android-setup">Android Setup</Link>
      </Callout>

      <section>
        <AnchorLink id="prerequisites" level="h2">
          Prerequisites
        </AnchorLink>
        <table>
          <thead>
            <tr>
              <th>Requirement</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Capacitor</td>
              <td>8.x</td>
            </tr>
            <tr>
              <td>iOS</td>
              <td>15.0+, Xcode 26</td>
            </tr>
            <tr>
              <td>Android</td>
              <td>
                API 24+, compile SDK {ANDROID_SDK.compileSdk}, Play Billing{' '}
                {GOOGLE_PLAY_BILLING.version}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="installation" level="h2">
          Installation
        </AnchorLink>
        <CodeBlock language="bash">{`npm install capacitor-iap@${CAPACITOR_PACKAGE.version}
npx cap sync`}</CodeBlock>
        <p>
          On iOS, enable the <strong>In-App Purchase</strong> capability in
          Xcode. The plugin supports Swift Package Manager, the Capacitor 8
          default; migrate a CocoaPods project with{' '}
          <code>npx cap spm-migration-assistant</code>.
        </p>
        <p>
          On Android the plugin links Google Play Billing. To build for Meta
          Horizon or the Amazon Appstore, set the store in{' '}
          <code>android/gradle.properties</code>; see{' '}
          <Link to="/docs/setup/store">Store selection</Link>.
        </p>
        <CodeBlock language="properties">{`openiapStore=horizon`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="quick-start" level="h2">
          Quick start
        </AnchorLink>
        <p>
          Connect once, create the purchase flow for the signed-in account, then
          request purchases. The flow confirms, finishes, and recovers every
          purchase the store delivers.
        </p>
        <CodeBlock language="typescript">{`import {
  confirmWithIapkit,
  createPurchaseFlow,
  fetchProducts,
  initConnection,
  requestPurchase,
} from 'capacitor-iap';

if (!(await initConnection())) throw new Error('Store connection failed');

const purchaseFlow = createPurchaseFlow({
  isConsumable: (productId) => productId === 'coins_100',
  // Or your backend call, or confirmOnDeviceIOS() for App Store apps without one.
  confirmWithBackend: confirmWithIapkit({ apiKey: 'your-iapkit-key' }),
});
purchaseFlow.subscribe(({ purchase, status }) => {
  console.log(purchase.productId, status.status);
});
await purchaseFlow.recoverPurchases();

const products = await fetchProducts({ skus: ['coins_100'], type: 'in-app' });

await requestPurchase({
  request: {
    apple: { sku: 'coins_100' },
    google: { skus: ['coins_100'] },
  },
  type: 'in-app',
});`}</CodeBlock>
        <p>
          Dispose the flow with <code>purchaseFlow.dispose()</code> when the
          account changes, then create the next account&apos;s flow.
        </p>
      </section>

      <section>
        <AnchorLink id="events" level="h2">
          Events
        </AnchorLink>
        <p>
          Listeners such as <code>purchaseUpdatedListener</code> and{' '}
          <code>purchaseErrorListener</code> return a subscription; call{' '}
          <code>remove()</code> when the screen goes away. A purchase delivered
          before the app listens, such as an unfinished transaction at launch,
          waits for the first <code>purchaseUpdatedListener</code>, and an App
          Store promotion waits for the first{' '}
          <code>promotedProductListenerIOS</code>. Other events reach only
          current listeners.
        </p>
      </section>

      <section>
        <AnchorLink id="web" level="h2">
          Web
        </AnchorLink>
        <p>
          Stores exist only on iOS and Android. On the web every store call
          rejects with <code>feature-not-supported</code>, listeners never fire,
          and <code>verifyAppOwnership</code> answers <code>unknown</code>.
        </p>
      </section>

      <section>
        <AnchorLink id="example" level="h2">
          Example app
        </AnchorLink>
        <p>
          The{' '}
          <a href="https://github.com/hyodotdev/openiap/tree/main/libraries/capacitor-iap/example">
            example app
          </a>{' '}
          shows the same catalog, purchase, subscription, restore, offer code,
          alternative billing, and app ownership screens as the other OpenIAP
          examples.
        </p>
      </section>
    </div>
  );
}

export default CapacitorSetup;
