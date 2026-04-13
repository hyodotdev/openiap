import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';

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
        <code>kmp-iap</code> provides in-app purchase support for Kotlin
        Multiplatform projects. It supports Android natively and iOS via
        CocoaPods integration.
      </p>

      <div
        style={{
          padding: '1rem',
          background: 'rgba(220, 104, 67, 0.1)',
          borderLeft: '4px solid var(--accent-color)',
          borderRadius: '0.5rem',
          margin: '1rem 0',
        }}
      >
        <strong>Before you start:</strong> Complete the store configuration
        before integrating with your framework:{' '}
        <a href="/docs/ios-setup">iOS Setup</a> |{' '}
        <a href="/docs/android-setup">Android Setup</a>
      </div>

      <section>
        <h2 id="prerequisites" className="anchor-heading">
          Prerequisites
          <a href="#prerequisites" className="anchor-link">
            #
          </a>
        </h2>
        <ul>
          <li>
            <strong>Kotlin 2.1.10+</strong> and <strong>Gradle 8.0+</strong>
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
        // Check Maven Central for the latest version
        implementation("io.github.hyochan:kmp-iap:<latest-version>")
    }
}`}
        </CodeBlock>
        <p>Or if using version catalogs:</p>
        <CodeBlock language="toml">
          {`# gradle/libs.versions.toml
[versions]
kmp-iap = "<latest-version>"

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

        <div
          style={{
            padding: '1rem',
            background: 'rgba(164, 116, 101, 0.1)',
            borderLeft: '4px solid var(--primary-color)',
            borderRadius: '0.5rem',
            margin: '1rem 0',
          }}
        >
          <strong>Quick decision:</strong> Use <strong>CocoaPods</strong> if you
          want automatic dependency management through Gradle. Use{' '}
          <strong>SPM</strong> if you prefer modern iOS tooling and want to
          avoid CocoaPods.
        </div>

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

        <div
          style={{
            padding: '1rem',
            background: 'rgba(164, 116, 101, 0.1)',
            borderLeft: '4px solid var(--primary-color)',
            borderRadius: '0.5rem',
            margin: '1rem 0',
          }}
        >
          <strong>Note:</strong> With SPM, don't use the CocoaPods plugin.
          You'll need to manually update OpenIAP when kmp-iap updates.
        </div>

        <h4>Enable In-App Purchase Capability</h4>
        <p>
          In Xcode: Target &gt; <strong>Signing &amp; Capabilities</strong> &gt;{' '}
          <strong>+ Capability</strong> &gt; <strong>In-App Purchase</strong>
        </p>

        <h4>Configure Info.plist (iOS 14+)</h4>
        <p>
          Add to your <code>iosApp/Info.plist</code>:
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
    compileSdk = 34

    defaultConfig {
        minSdk = 24  // Required minimum
        targetSdk = 34
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

        <h3 id="instance" className="anchor-heading">
          Creating an Instance
          <a href="#instance" className="anchor-link">
            #
          </a>
        </h3>
        <p>Two patterns are supported:</p>
        <CodeBlock language="kotlin">
          {`// Option 1: Global instance (convenient)
import io.github.hyochan.kmpiap.kmpIapInstance
kmpIapInstance.initConnection()

// Option 2: Constructor (for DI / testing)
import io.github.hyochan.kmpiap.KmpIAP
val kmpIAP = KmpIAP()
kmpIAP.initConnection()`}
        </CodeBlock>

        <h3 id="flow-based" className="anchor-heading">
          Flow-Based Architecture
          <a href="#flow-based" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          KMP IAP uses Kotlin <strong>Flow</strong> for purchase events:
        </p>
        <CodeBlock language="kotlin">
          {`import io.github.hyochan.kmpiap.KmpIAP
import kotlinx.coroutines.*

val kmpIAP = KmpIAP()
val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

kmpIAP.initConnection()

// Collect in separate coroutines (collect is suspending and never returns)
scope.launch {
    kmpIAP.purchaseUpdatedListener.collect { purchase ->
        // Validate receipt on your server
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

        <div
          style={{
            padding: '1rem',
            background: 'rgba(220, 104, 67, 0.1)',
            borderLeft: '4px solid var(--accent-color)',
            borderRadius: '0.5rem',
            margin: '1rem 0',
          }}
        >
          <strong>Critical:</strong> Always call <code>finishTransaction</code>{' '}
          after verifying a purchase. On Android, unfinished purchases are
          automatically refunded after 3 days.
        </div>

        <h3 id="products-purchase" className="anchor-heading">
          Products and Purchase
          <a href="#products-purchase" className="anchor-link">
            #
          </a>
        </h3>
        <CodeBlock language="kotlin">
          {`// Fetch products
val products = kmpIAP.fetchProducts(
    skus = listOf("premium", "coins_100")
)

// Purchase
kmpIAP.requestPurchase(sku = "premium")

// Cleanup
kmpIAP.endConnection()`}
        </CodeBlock>

        <div
          style={{
            padding: '1rem',
            background: 'rgba(220, 104, 67, 0.1)',
            borderLeft: '4px solid var(--accent-color)',
            borderRadius: '0.5rem',
            margin: '1rem 0',
          }}
        >
          <strong>Note:</strong> KMP IAP uses Kotlin Flow (not callbacks or
          listeners). Collect purchase and error flows in a coroutine scope. The
          flows are hot and emit events as they occur.
        </div>
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
            <a
              href="https://central.sonatype.com/artifact/io.github.hyochan.kmpiap/library"
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
    </div>
  );
}

export default KmpSetup;
