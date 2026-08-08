import Callout from '../../../components/Callout';
import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';
import { LIBRARIES } from '../../../lib/images';
import { KMP_ANDROID_SDK } from '../../../lib/versioning';

const KMP_INSTALL_COMMAND =
  LIBRARIES.find(({ name }) => name === 'kmp-iap')?.installCommand ??
  'implementation("io.github.hyochan:kmp-iap")';
const KMP_VERSION =
  KMP_INSTALL_COMMAND.match(/kmp-iap:([^")]+)/)?.[1] ?? 'x.y.z';

function KmpSetup() {
  return (
    <div className="doc-page">
      <SEO
        title="Kotlin Multiplatform Setup"
        description="Install and configure kmp-iap for in-app purchases in Kotlin Multiplatform projects."
        path="/docs/setup/kmp"
        keywords="kmp-iap, Kotlin Multiplatform, KMP, in-app purchase, Maven Central, Compose Multiplatform"
      />
      <h1>Kotlin Multiplatform Setup</h1>
      <p>
        <code>kmp-iap</code> brings OpenIAP-compliant in-app purchases to Kotlin
        Multiplatform projects. Android talks to Google Play Billing directly;
        iOS links the OpenIAP StoreKit framework, added with either CocoaPods or
        Swift Package Manager (see <a href="#ios-config">iOS Configuration</a>{' '}
        below). Requires iOS 15.0+ and the Android minSdk shown in{' '}
        <a href="#android-config">Android Configuration</a>.
      </p>

      <Callout kind="important" title="Before you start">
        Complete the store configuration before integrating with your framework:{' '}
        <a href="/docs/ios-setup">iOS Setup</a> |{' '}
        <a href="/docs/android-setup">Android Setup</a>
      </Callout>

      <section>
        <h2 id="prerequisites" className="anchor-heading">
          Prerequisites
          <a href="#prerequisites" className="anchor-link">
            #
          </a>
        </h2>
        <ul>
          <li>
            <strong>Kotlin 2.4.10</strong>, <strong>Gradle 9.3.0</strong>, and{' '}
            <strong>JDK 17+</strong>
          </li>
          <li>Active Apple Developer account (for iOS)</li>
          <li>Active Google Play Developer account (for Android)</li>
          <li>
            Physical device for testing (simulators have limited IAP support)
          </li>
        </ul>
      </section>

      <section>
        <h2 id="installation" className="anchor-heading">
          Installation
          <a href="#installation" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          Add kmp-iap to your shared module's <code>build.gradle.kts</code>:
        </p>
        <CodeBlock language="kotlin">
          {`val commonMain by getting {
    dependencies {
        ${KMP_INSTALL_COMMAND}
    }
}`}
        </CodeBlock>
        <p>Or if using version catalogs:</p>
        <CodeBlock language="toml">
          {`# gradle/libs.versions.toml
[versions]
kmp-iap = "${KMP_VERSION}"

[libraries]
kmp-iap = { module = "io.github.hyochan:kmp-iap", version.ref = "kmp-iap" }`}
        </CodeBlock>
        <CodeBlock language="kotlin">
          {`// build.gradle.kts
dependencies {
    implementation(libs.kmp.iap)
}`}
        </CodeBlock>
      </section>

      <section>
        <h2 id="platform-config" className="anchor-heading">
          Platform Configuration
          <a href="#platform-config" className="anchor-link">
            #
          </a>
        </h2>

        <h3 id="ios-config" className="anchor-heading">
          iOS Configuration
          <a href="#ios-config" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          kmp-iap uses the OpenIAP framework on iOS. Choose{' '}
          <strong>CocoaPods</strong> or <strong>Swift Package Manager</strong>:
        </p>

        <Callout kind="tip" title="Quick decision">
          Use <strong>CocoaPods</strong> if you want automatic dependency
          management through Gradle. Use <strong>SPM</strong> if you prefer
          modern iOS tooling and want to avoid CocoaPods.
        </Callout>

        <h4>Option A: CocoaPods (Recommended)</h4>
        <p>Ensure your shared module has the CocoaPods plugin:</p>
        <CodeBlock language="kotlin">
          {`// shared/build.gradle.kts
plugins {
    kotlin("multiplatform")
    kotlin("native.cocoapods")
}

kotlin {
    cocoapods {
        version = "1.0"
        ios.deploymentTarget = "15.0"
        framework {
            baseName = "ComposeApp" // or "shared"
            isStatic = true
        }
    }
}`}
        </CodeBlock>
        <p>
          Then run <code>cd iosApp &amp;&amp; pod install</code> and always open{' '}
          <code>.xcworkspace</code> (not <code>.xcodeproj</code>).
        </p>
        <h4>Option B: Swift Package Manager</h4>
        <ol>
          <li>
            In Xcode: <strong>File &gt; Add Package Dependencies</strong>
          </li>
          <li>
            Enter URL: <code>https://github.com/hyodotdev/openiap.git</code>
          </li>
          <li>Select "Up to Next Major" version</li>
          <li>Add to your iOS app target</li>
          <li>
            Verify in{' '}
            <strong>Build Phases &gt; Link Binary with Libraries</strong>
          </li>
        </ol>

        <Callout kind="note">
          With SPM, don't use the CocoaPods plugin. You'll need to manually
          update OpenIAP when kmp-iap updates.
        </Callout>

        <h4>Enable In-App Purchase Capability</h4>
        <p>
          In Xcode: Target &gt; <strong>Signing &amp; Capabilities</strong> &gt;{' '}
          <strong>+ Capability</strong> &gt; <strong>In-App Purchase</strong>
        </p>

        <h4>Configure Info.plist (optional)</h4>
        <p>
          Declaring <code>itms-apps</code> in <code>iosApp/Info.plist</code> is
          only needed when your own code checks App Store links before opening
          them — kmp-iap itself does not require it:
        </p>
        <CodeBlock language="xml">
          {`<key>LSApplicationQueriesSchemes</key>
<array>
    <string>itms-apps</string>
</array>`}
        </CodeBlock>

        <h3 id="android-config" className="anchor-heading">
          Android Configuration
          <a href="#android-config" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Update your <code>androidApp/build.gradle.kts</code>:
        </p>
        <CodeBlock language="kotlin">
          {`android {
    compileSdk = ${KMP_ANDROID_SDK.compileSdk}

    defaultConfig {
        minSdk = ${KMP_ANDROID_SDK.minSdk}  // Required minimum
        targetSdk = ${KMP_ANDROID_SDK.targetSdk}
    }
}`}
        </CodeBlock>

        <h4>ProGuard Rules (if using ProGuard)</h4>
        <CodeBlock language="text">
          {`# In-App Purchase
-keep class com.android.billingclient.** { *; }
-keep class io.github.hyochan.kmpiap.** { *; }
-keepattributes *Annotation*`}
        </CodeBlock>
      </section>

      <section>
        <h2 id="usage" className="anchor-heading">
          Usage
          <a href="#usage" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          Results stream through Kotlin Flows: initialize the connection (
          <a href="/docs/apis/init-connection">
            <code>initConnection</code>
          </a>
          ), attach the purchase and error flows (
          <a href="/docs/events/purchase-updated-listener">
            <code>purchaseUpdatedListener</code>
          </a>{' '}
          and{' '}
          <a href="/docs/events/purchase-error-listener">
            <code>purchaseErrorListener</code>
          </a>
          ), then fetch and purchase (
          <a href="/docs/apis/fetch-products">
            <code>fetchProducts</code>
          </a>
          ,{' '}
          <a href="/docs/apis/request-purchase">
            <code>requestPurchase</code>
          </a>
          ,{' '}
          <a href="/docs/apis/finish-transaction">
            <code>finishTransaction</code>
          </a>
          ). A successful <code>initConnection()</code> followed by a non-empty{' '}
          <code>fetchProducts()</code> result is the quickest way to confirm the
          platform setup above is working. For the full flow, see the{' '}
          <a href="/docs/features/purchase">Purchase Guide</a>.
        </p>

        <h3 id="instance" className="anchor-heading">
          Creating an Instance
          <a href="#instance" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Two patterns are supported. The connection, fetch, and purchase APIs
          are suspend functions — call them from a coroutine scope:
        </p>
        <CodeBlock language="kotlin">
          {`// Option 1: Global instance (convenient)
import io.github.hyochan.kmpiap.kmpIapInstance
scope.launch { kmpIapInstance.initConnection() }

// Option 2: Constructor (for DI / testing)
import io.github.hyochan.kmpiap.KmpIAP
val kmpIAP = KmpIAP()
scope.launch { kmpIAP.initConnection() }`}
        </CodeBlock>
        <p>
          See{' '}
          <a href="/docs/apis/init-connection">
            <code>initConnection</code>
          </a>{' '}
          for parameters and per-store behavior.
        </p>

        <h3 id="flow-based" className="anchor-heading">
          Flow-Based Architecture
          <a href="#flow-based" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          KMP IAP delivers purchase results through hot Kotlin{' '}
          <strong>Flows</strong> — despite the names,{' '}
          <a href="/docs/events/purchase-updated-listener">
            <code>purchaseUpdatedListener</code>
          </a>{' '}
          and{' '}
          <a href="/docs/events/purchase-error-listener">
            <code>purchaseErrorListener</code>
          </a>{' '}
          are Flows, not one-shot callbacks. Collect both in a long-lived
          coroutine scope before requesting a purchase; events are emitted as
          they occur.
        </p>
        <CodeBlock language="kotlin">
          {`import io.github.hyochan.kmpiap.KmpIAP
import kotlinx.coroutines.*

val kmpIAP = KmpIAP()
val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

scope.launch { kmpIAP.initConnection() }

// Collect in separate coroutines (collect is suspending and never returns)
scope.launch {
    kmpIAP.purchaseUpdatedListener.collect { purchase ->
        // Validate receipt with your backend or IAPKit
        // CRITICAL: Android auto-refunds after 3 days if not called!
        kmpIAP.finishTransaction(purchase = purchase, isConsumable = true)
    }
}

scope.launch {
    kmpIAP.purchaseErrorListener.collect { error ->
        println("Error: \${error.code} - \${error.message}")
    }
}`}
        </CodeBlock>
        <p>
          For the possible <code>error.code</code> values, see{' '}
          <a href="/docs/errors">Error Codes</a>.
        </p>

        <Callout kind="warning" title="Critical">
          Always call{' '}
          <a href="/docs/apis/finish-transaction">
            <code>finishTransaction</code>
          </a>{' '}
          after verifying a purchase. On Android, unfinished purchases are
          automatically refunded after 3 days.
        </Callout>

        <h3 id="products-purchase" className="anchor-heading">
          Products and Purchase
          <a href="#products-purchase" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Fetch products once the connection is up, then request a purchase —
          the result arrives on <code>purchaseUpdatedListener</code>, not as a
          return value. See{' '}
          <a href="/docs/apis/fetch-products">
            <code>fetchProducts</code>
          </a>{' '}
          and{' '}
          <a href="/docs/apis/request-purchase">
            <code>requestPurchase</code>
          </a>{' '}
          for parameters and per-store behavior.
        </p>
        <CodeBlock language="kotlin">
          {`import io.github.hyochan.kmpiap.openiap.*

scope.launch {
    // Fetch products
    val products = kmpIAP.fetchProducts(
        ProductRequest(
            skus = listOf("premium", "coins_100"),
            type = ProductQueryType.InApp
        )
    )

    // Purchase — the result arrives on purchaseUpdatedListener
    kmpIAP.requestPurchase(
        RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(
                    apple = RequestPurchaseIosProps(
                        sku = "premium"
                    ),
                    google = RequestPurchaseAndroidProps(
                        skus = listOf("premium")
                    )
                )
            ),
            type = ProductQueryType.InApp
        )
    )
}`}
        </CodeBlock>
        <p>
          Call{' '}
          <a href="/docs/apis/end-connection">
            <code>endConnection()</code>
          </a>{' '}
          when the owning screen or scope is disposed — not right after{' '}
          <code>requestPurchase</code>, or the connection may close before the
          purchase result arrives.
        </p>
      </section>

      <section>
        <h2 id="troubleshooting" className="anchor-heading">
          Troubleshooting
          <a href="#troubleshooting" className="anchor-link">
            #
          </a>
        </h2>

        <h3>Linking error: Undefined symbol OpenIapModule (iOS)</h3>
        <p>This means the OpenIAP framework isn't linked.</p>
        <ul>
          <li>
            <strong>CocoaPods:</strong> Run{' '}
            <code>cd iosApp &amp;&amp; pod install</code> and open{' '}
            <code>.xcworkspace</code> (not <code>.xcodeproj</code>)
          </li>
          <li>
            <strong>SPM:</strong> Verify OpenIAP appears in{' '}
            <strong>Build Phases &gt; Link Binary with Libraries</strong>
          </li>
          <li>Clean build folder and rebuild</li>
        </ul>

        <h3>Products not found</h3>
        <ul>
          <li>
            Ensure all agreements are signed in App Store Connect / Google Play
            Console
          </li>
          <li>
            Verify banking, legal, and tax information is complete and approved
          </li>
          <li>Check that bundle ID / package name matches exactly</li>
          <li>
            Products must be in "Ready to Submit" status (Apple) or "Active"
            (Google)
          </li>
          <li>Wait 15-30 minutes after creating products before testing</li>
        </ul>

        <h3>Billing unavailable (Android)</h3>
        <ul>
          <li>Test on a real device, not an emulator</li>
          <li>Ensure Google Play Store is installed and updated</li>
          <li>
            App must be signed with the same certificate uploaded to Play
            Console
          </li>
        </ul>
      </section>

      <section>
        <h2 id="next-steps" className="anchor-heading">
          Next Steps
          <a href="#next-steps" className="anchor-link">
            #
          </a>
        </h2>
        <ul>
          <li>
            <a href="/docs/features/purchase">Purchase Guide</a> — Complete
            purchase flow with validation and receipt verification
          </li>
          <li>
            <a href="/docs/features/subscription">Subscription Guide</a> —
            Subscription offers, renewal, and management
          </li>
          <li>
            <a href="/docs/errors">Error Codes</a> — Full error reference and
            handling strategies
          </li>
          <li>
            <a href="/docs/apis">API Reference</a> — All available APIs with
            multi-language examples
          </li>
          <li>
            <a href="/docs/setup/store">Store Setup</a> — support boundaries and
            build configuration for alternative store targets: Meta Quest (
            <a href="/docs/setup/store/horizon">Horizon OS</a>) and Amazon
            devices (<a href="/docs/setup/store/amazon">Fire OS and Vega OS</a>)
          </li>
          <li>
            <a
              href="https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap"
              target="_blank"
              rel="noopener noreferrer"
            >
              Maven Central: kmp-iap
            </a>
            {' | '}
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub Source
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default KmpSetup;
