import { Link } from 'react-router-dom';
import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function FireOSSetup() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Fire OS Setup"
        description="Fire OS in-app purchase setup guide for OpenIAP using the Android amazon flavor and Amazon Appstore SDK."
        path="/docs/fireos-setup"
        keywords="Fire OS IAP, Amazon Appstore SDK, Amazon App Tester, OpenIAP Amazon, fireOsEnabled, openiap-google-amazon"
      />
      <h1>Fire OS Setup Guide</h1>
      <p>
        Fire OS support targets Android apps distributed through the Amazon
        Appstore. OpenIAP supports it through the Fire OS flavor: the Android{' '}
        <code>amazon</code> flavor and <code>openiap-google-amazon</code>{' '}
        artifact, backed by the Amazon Appstore SDK.
      </p>
      <p>
        Vega OS is a separate JavaScript runtime target for{' '}
        <code>react-native-iap</code> and <code>expo-iap</code>. It does not use
        this Android flavor. See the{' '}
        <Link to="/docs/features/vega-os">Vega OS Runtime</Link> guide for that
        setup.
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
              <td>Fire OS</td>
              <td>
                Android, <code>react-native-iap</code>, <code>expo-iap</code>,{' '}
                <code>flutter_inapp_purchase</code>, <code>kmp-iap</code>,{' '}
                <code>OpenIap.Maui</code>
              </td>
              <td>
                Build-time Android <code>amazon</code> flavor; native artifact{' '}
                <code>openiap-google-amazon</code>
              </td>
            </tr>
            <tr>
              <td>Vega OS</td>
              <td>
                <code>react-native-iap</code>, <code>expo-iap</code>
              </td>
              <td>
                Runtime adapter selected in the <code>kepler</code> runtime. It
                is not this Android flavor. See{' '}
                <Link to="/docs/features/vega-os">Vega OS Runtime</Link>.
              </td>
            </tr>
            <tr>
              <td>Google Play / Horizon OS</td>
              <td>Android and framework wrappers</td>
              <td>
                Default Play artifact or Android <code>horizon</code> flavor,
                not the Amazon Appstore SDK
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
            Fire OS flavor: Android app target for Fire OS devices using the
            Amazon Appstore SDK. In Gradle and package names, OpenIAP exposes
            this as the <code>amazon</code> flavor and the{' '}
            <code>openiap-google-amazon</code> artifact.
          </li>
          <li>
            An Amazon Developer account with an Amazon Appstore app record.
          </li>
          <li>
            In-app items configured in the Amazon Developer Console. OpenIAP
            maps Amazon consumables and entitlements to <code>in-app</code>, and
            subscriptions to <code>subs</code>.
          </li>
          <li>
            Product IDs in Amazon Appstore and Amazon App Tester should match
            the SKUs your app passes to <code>fetchProducts</code> and{' '}
            <code>requestPurchase</code>. For subscriptions, keep each Amazon
            subscription group or term aligned with the same app-facing SKU you
            use on Apple, Google, Horizon OS, and Kit entitlement checks.
          </li>
          <li>
            Amazon App Tester installed on a Fire OS or compatible Android test
            device for sandbox testing.
          </li>
          <li>
            Amazon Appstore public key copied into the Android app's{' '}
            <code>src/main/assets</code> directory.
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="setup" level="h2">
          Setup
        </AnchorLink>
        <p>
          Use the Amazon artifact when consuming the native Android package
          directly for Fire OS:
        </p>
        <CodeBlock language="kotlin">{`dependencies {
    implementation("io.github.hyochan.openiap:openiap-google-amazon:$version")
}`}</CodeBlock>
        <p>
          In the monorepo or a local Gradle composite build, select the Amazon
          flavor:
        </p>
        <CodeBlock language="kotlin">{`android {
    defaultConfig {
        missingDimensionStrategy("platform", "amazon")
    }
}`}</CodeBlock>

        <AnchorLink id="framework-setup" level="h3">
          Framework Setup
        </AnchorLink>
        <p>
          Expo and React Native config plugins use <code>amazon.fireOS</code>.
          Flutter builds, or React Native builds that do not run a config
          plugin, can select the same Android flavor through the{' '}
          <code>fireOsEnabled</code> Gradle property and the app module's{' '}
          <code>missingDimensionStrategy</code>:
        </p>
        <CodeBlock language="properties">{`fireOsEnabled=true
# Do not set horizonEnabled=true in the same build.`}</CodeBlock>
        <p>
          Expo and React Native config plugins can write the same Android
          selection during prebuild:
        </p>
        <CodeBlock language="typescript">{`// Expo
plugins: [['expo-iap', { amazon: { fireOS: true } }]]

// React Native config plugin
plugins: [['react-native-iap', { amazon: { fireOS: true } }]]`}</CodeBlock>
        <p>
          For Flutter, read the property from{' '}
          <code>android/gradle.properties</code> in{' '}
          <code>android/app/build.gradle</code> and select the plugin flavor:
        </p>
        <CodeBlock language="groovy">{`android {
    defaultConfig {
        def horizonEnabled = project.findProperty('horizonEnabled')?.toBoolean() ?: false
        def fireOsEnabled = project.findProperty('fireOsEnabled')?.toBoolean() ?: false
        if (horizonEnabled && fireOsEnabled) {
            throw new GradleException("horizonEnabled and fireOsEnabled cannot both be true")
        }
        def flavor = fireOsEnabled ? 'amazon' : (horizonEnabled ? 'horizon' : 'play')

        missingDimensionStrategy 'platform', flavor
    }
}`}</CodeBlock>
        <p>
          KMP builds publish the Android <code>amazonRelease</code> variant,
          which sets <code>OPENIAP_STORE</code> to <code>amazon</code> and pulls
          <code>openiap-google-amazon</code>. MAUI Android builds can select the
          same path with <code>OpenIapAndroidStore=amazon</code> or{' '}
          <code>fireOsEnabled=true</code>; the binding includes the matching
          Amazon Appstore SDK dependency for that store selection.
        </p>
      </section>

      <section>
        <AnchorLink id="app-tester-sandbox" level="h2">
          App Tester Sandbox
        </AnchorLink>
        <p>
          Fire OS sandbox testing uses Amazon App Tester with the Android
          sandbox property. Install Amazon App Tester on the Fire OS or
          compatible Android test device, keep its JSON catalog aligned with the
          Amazon Developer Console product IDs, and enable sandbox mode before
          launching the app:
        </p>
        <CodeBlock language="bash">{`adb shell setprop debug.amazon.sandboxmode debug`}</CodeBlock>
        <p>
          Relaunch the app after changing the tester catalog or sandbox
          property. The app-facing SKUs in App Tester should match the values
          used by <code>fetchProducts</code>, <code>requestPurchase</code>, and
          Kit verification.
        </p>
      </section>

      <section>
        <AnchorLink id="usage" level="h2">
          Usage
        </AnchorLink>
        <p>
          App code keeps the standard OpenIAP API shape. The Fire OS Android
          flavor maps those calls to the Amazon Appstore SDK.
        </p>

        <AnchorLink id="catalog-identity" level="h3">
          Catalog Identity
        </AnchorLink>
        <p>
          Treat the SKU that your app requests as the canonical entitlement
          identity. Apple, Google Play, Horizon OS, and Amazon all have store
          console concepts for grouping subscription products or terms, but the
          app should still receive one stable OpenIAP <code>productId</code> for
          the item it requested.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Store setup</th>
              <th>OpenIAP app identity</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Apple subscription group</td>
              <td>
                Use the App Store product ID as the SKU passed to OpenIAP.
              </td>
            </tr>
            <tr>
              <td>Google subscription with base plans or offers</td>
              <td>
                Use the subscription product ID as <code>productId</code>, then
                read plan details from subscription offers.
              </td>
            </tr>
            <tr>
              <td>Amazon subscription group or term</td>
              <td>
                Use the Amazon SKU that appears in product data and purchase
                requests as the OpenIAP <code>productId</code>. Do not rely on a
                separate test-catalog alias for entitlement checks.
              </td>
            </tr>
          </tbody>
        </table>
        <blockquote className="info-note">
          If Amazon App Tester or the Amazon catalog returns a receipt SKU that
          differs from the SKU your app requested, immediate client-side
          purchase updates can keep the requested SKU for the in-flight
          response, but restore and server verification flows still depend on
          the store catalog identity. Keep Amazon product IDs, tester JSON, and
          IAPKit product mappings aligned, then check subscription state through{' '}
          <code>getActiveSubscriptions</code>,{' '}
          <code>getAvailablePurchases</code>, or Kit entitlement APIs.
        </blockquote>
        <p>
          With that catalog identity in place, Fire OS subscription checks use
          the same OpenIAP calls as the other stores. Apps call{' '}
          <code>getActiveSubscriptions</code> with their subscription SKUs and
          read <code>productId</code>, <code>currentPlanId</code>, and{' '}
          <code>isActive</code> from the returned{' '}
          <code>ActiveSubscription</code>
          records instead of writing Amazon-specific receipt mapping code.
        </p>

        <AnchorLink id="framework-api-usage" level="h3">
          Framework API Usage
        </AnchorLink>
        <p>
          The framework code continues to call the normal cross-platform APIs:
        </p>
        <CodeBlock language="typescript">{`await initConnection();

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
});`}</CodeBlock>

        <AnchorLink id="iapkit-verification" level="h3">
          IAPKit Verification
        </AnchorLink>
        <p>
          Fire OS and Vega OS use the same IAPKit Amazon verification shape.
          Pass the Amazon receipt ID through{' '}
          <code>iapkit.amazon.receiptId</code>; the runtime can resolve{' '}
          <code>userId</code> when it is available. Use{' '}
          <code>sandbox: true</code> for Amazon App Tester receipts.
        </p>
        <CodeBlock language="typescript">{`const result = await verifyPurchaseWithProvider({
  provider: 'iapkit',
  iapkit: {
    apiKey: '<iapkit-api-key>',
    amazon: {
      receiptId: purchase.purchaseToken ?? '',
      sandbox: __DEV__,
    },
  },
});`}</CodeBlock>
        <p>
          See the <Link to="/docs/kit-backend">IAPKit backend guide</Link> for
          the shared Fire OS and Vega OS Amazon verification flow.
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
              <th>Amazon Appstore SDK mapping</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Link to="/docs/apis/init-connection">
                  <code>initConnection()</code>
                </Link>
              </td>
              <td>Register the Amazon IAP listener and request user data</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/fetch-products">
                  <code>fetchProducts()</code>
                </Link>
              </td>
              <td>
                <code>PurchasingService.getProductData</code>
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/request-purchase">
                  <code>requestPurchase()</code>
                </Link>
              </td>
              <td>
                <code>PurchasingService.purchase</code>; Amazon accepts one SKU
                per purchase request
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/get-available-purchases">
                  <code>getAvailablePurchases()</code>
                </Link>
                ,{' '}
                <Link to="/docs/apis/restore-purchases">
                  <code>restorePurchases()</code>
                </Link>
              </td>
              <td>Read Amazon purchase updates internally</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/apis/finish-transaction">
                  <code>finishTransaction()</code>
                </Link>
                ,{' '}
                <Link to="/docs/apis/android/acknowledge-purchase-android">
                  <code>acknowledgePurchaseAndroid()</code>
                </Link>
                ,{' '}
                <Link to="/docs/apis/android/consume-purchase-android">
                  <code>consumePurchaseAndroid()</code>
                </Link>
              </td>
              <td>Notify Amazon fulfillment with the receipt ID</td>
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
            Server-side Amazon Receipt Verification Service integration is not
            embedded in the Android client package. Use IAPKit's Amazon
            verification path, or run your own server-side RVS integration.
          </li>
          <li>
            Vega OS is intentionally not included in the Fire OS Android flavor.
            Use the <Link to="/docs/features/vega-os">Vega OS Runtime</Link>{' '}
            guide for React Native and Expo Vega apps.
          </li>
          <li>
            Godot currently receives the shared Amazon store enum and API
            payload types, but its Android wrapper does not yet expose a
            separate Fire OS flavor switch. KMP and MAUI expose Fire OS
            prerelease build paths through their Android Amazon variants.
          </li>
          <li>
            Google Play billing programs, alternative billing, and subscription
            billing issue events are Play-only and return unsupported or no-op
            results on Fire OS.
          </li>
          <li>
            Amazon reports both user-cancelled purchases and some generic
            purchase failures with <code>FAILED</code>. OpenIAP maps that status
            to a cancellation-style purchase error because Amazon does not
            expose a more specific client-side code.
          </li>
        </ul>
      </section>
    </div>
  );
}

export default FireOSSetup;
