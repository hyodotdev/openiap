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
            Fire OS: Android app target using the Amazon Appstore SDK via the{' '}
            <code>amazon</code> flavor.
          </li>
          <li>
            Artifact: <code>openiap-google-amazon</code> for native Android
            consumers.
          </li>
          <li>
            Framework flag: <code>fireOsEnabled=true</code> selects the Fire OS
            Android flavor in React Native, Expo, and Flutter builds.
          </li>
          <li>
            Vega OS: not an Android flavor. Do not set{' '}
            <code>fireOsEnabled=true</code> for Vega OS apps.
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
        <h2 id="fire-os-frameworks" className="anchor-heading">
          Fire OS Frameworks
          <a href="#fire-os-frameworks" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          React Native and Expo config plugins write the Fire OS Gradle
          selection during prebuild. Flutter apps should wire the same property
          into the app module's <code>missingDimensionStrategy</code>. Enable
          Fire OS builds in the app's <code>android/gradle.properties</code>:
        </p>
        <CodeBlock language="properties">{`fireOsEnabled=true
# Do not set horizonEnabled=true in the same build.`}</CodeBlock>
        <p>
          Expo and React Native config plugins can write the same Android
          selection during prebuild:
        </p>
        <CodeBlock language="typescript">{`// Expo
plugins: [['expo-iap', { modules: { fireOS: true } }]]

// React Native config plugin
plugins: [['react-native-iap', { modules: { fireOS: true } }]]`}</CodeBlock>
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
            use <code>PurchasingService.getPurchaseUpdates(reset=true)</code>.
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
        <h2 id="limitations" className="anchor-heading">
          Current Limitations
          <a href="#limitations" className="anchor-link">
            #
          </a>
        </h2>
        <ul>
          <li>
            Server-side Amazon Receipt Verification Service integration is not
            included in the Android client package.
          </li>
          <li>
            Sandbox testing still requires Amazon App Tester setup and Amazon's
            sandbox mode, for example{' '}
            <code>adb shell setprop debug.amazon.sandboxmode debug</code>.
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
