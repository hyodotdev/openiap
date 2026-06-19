import { Link } from 'react-router-dom';
import CodeBlock from '../../components/CodeBlock';
import SEO from '../../components/SEO';

function FireOSSetup() {
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
        Appstore. OpenIAP supports it through the Android package's{' '}
        <code>amazon</code> flavor, backed by the Amazon Appstore SDK.
      </p>
      <p>
        Vega OS is a separate JavaScript runtime target for{' '}
        <code>react-native-iap</code> and <code>expo-iap</code>. It does not use
        this Android flavor. See the{' '}
        <Link to="/docs/features/vega-os">Vega OS Runtime</Link> guide for that
        setup.
      </p>

      <section>
        <h2 id="platform-boundary" className="anchor-heading">
          Platform Boundary
          <a href="#platform-boundary" className="anchor-link">
            #
          </a>
        </h2>
        <ul>
          <li>
            Fire OS flavor: Android app target for Fire OS devices using the
            Amazon Appstore SDK. In Gradle and package names, OpenIAP exposes
            this as the <code>amazon</code> flavor and{' '}
            <code>openiap-google-amazon</code> artifact.
          </li>
          <li>
            Config plugin option: <code>amazon.fireOS=true</code> selects the
            Fire OS Android flavor during prebuild in <code>expo-iap</code> and{' '}
            <code>react-native-iap</code>.
          </li>
          <li>
            Gradle/runtime flag: <code>fireOsEnabled=true</code> selects the
            Fire OS Android flavor in React Native and Flutter builds.
          </li>
          <li>
            Vega OS: not an Android flavor. Use <code>amazon.vegaOS=true</code>{' '}
            to mark the Amazon Vega runtime target; Expo projects can also
            generate Vega metadata from that option.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="fire-os" className="anchor-heading">
          Fire OS
          <a href="#fire-os" className="anchor-link">
            #
          </a>
        </h2>
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
        <p>Fire OS apps also need the usual Amazon Appstore setup:</p>
        <ul>
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
        <h2 id="catalog-identity" className="anchor-heading">
          Catalog Identity
          <a href="#catalog-identity" className="anchor-link">
            #
          </a>
        </h2>
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
      </section>

      <section>
        <h2 id="fire-os-frameworks" className="anchor-heading">
          Fire OS Frameworks
          <a href="#fire-os-frameworks" className="anchor-link">
            #
          </a>
        </h2>
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
      </section>

      <section>
        <h2 id="fire-os-flows" className="anchor-heading">
          Fire OS Flows
          <a href="#fire-os-flows" className="anchor-link">
            #
          </a>
        </h2>
        <ul>
          <li>
            <Link to="/docs/apis/init-connection">
              <code>initConnection</code>
            </Link>{' '}
            registers the Amazon IAP listener and requests Amazon user data.
          </li>
          <li>
            <Link to="/docs/apis/fetch-products">
              <code>fetchProducts</code>
            </Link>{' '}
            calls <code>PurchasingService.getProductData</code> and maps
            consumables, entitlements, and subscriptions into OpenIAP Android
            product types.
          </li>
          <li>
            <Link to="/docs/apis/request-purchase">
              <code>requestPurchase</code>
            </Link>{' '}
            launches Amazon's purchase flow. Amazon accepts one SKU per purchase
            request.
          </li>
          <li>
            <Link to="/docs/apis/get-available-purchases">
              <code>getAvailablePurchases</code>
            </Link>{' '}
            and{' '}
            <Link to="/docs/apis/restore-purchases">
              <code>restorePurchases</code>
            </Link>{' '}
            stay on the OpenIAP surface while the Amazon adapter internally
            reads purchase updates from the Amazon Appstore SDK.
          </li>
          <li>
            <Link to="/docs/apis/finish-transaction">
              <code>finishTransaction</code>
            </Link>
            ,{' '}
            <Link to="/docs/apis/android/acknowledge-purchase-android">
              <code>acknowledgePurchaseAndroid</code>
            </Link>
            , and{' '}
            <Link to="/docs/apis/android/consume-purchase-android">
              <code>consumePurchaseAndroid</code>
            </Link>{' '}
            call Amazon fulfillment with the receipt ID.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="iapkit-verification" className="anchor-heading">
          IAPKit Verification
          <a href="#iapkit-verification" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          Fire OS purchases can use IAPKit's Amazon verification path instead of
          app-owned receipt-verification infrastructure. Pass the Amazon receipt
          id through <code>iapkit.amazon.receiptId</code>; the Amazon Android
          flavor can resolve <code>userId</code> from Amazon user data when it
          is omitted. Use <code>sandbox: true</code> for Amazon App Tester
          receipts.
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
        <h2 id="limitations" className="anchor-heading">
          Current Limitations
          <a href="#limitations" className="anchor-link">
            #
          </a>
        </h2>
        <ul>
          <li>
            Server-side Amazon Receipt Verification Service integration is not
            embedded in the Android client package. Use IAPKit's Amazon
            verification path, or run your own server-side RVS integration.
          </li>
          <li>
            Fire OS sandbox testing still requires Amazon App Tester setup and
            the Android sandbox property, for example{' '}
            <code>adb shell setprop debug.amazon.sandboxmode debug</code>. Vega
            OS sandbox testing uses the app-local{' '}
            <code>amazon.config.json</code> flow documented in the{' '}
            <Link to="/docs/features/vega-os">Vega OS Runtime</Link> guide.
          </li>
          <li>
            Vega OS is intentionally not included in the Fire OS Android flavor.
            Use the <Link to="/docs/features/vega-os">Vega OS Runtime</Link>{' '}
            guide for React Native and Expo Vega apps.
          </li>
          <li>
            Godot, KMP, and MAUI currently receive the shared Amazon store enum
            and type documentation, but their Android wrappers do not yet expose
            an Amazon flavor switch.
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
