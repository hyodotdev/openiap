import Callout from '../../../components/Callout';
import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';
import {
  KMP_ANDROID_SDK,
  KMP_PACKAGE,
  OPENIAP_VERSIONS,
} from '../../../lib/versioning';

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
        Multiplatform projects. iOS uses Swift Package Manager to link the
        OpenIAP StoreKit framework without CocoaPods (see{' '}
        <a href="#ios-config">iOS Configuration</a> below). Requires iOS 15.0+
        and the Android minSdk shown in{' '}
        <a href="#android-config">Android Configuration</a>.
      </p>

      <Callout kind="important" title="Before you start">
        Complete the store configuration before integrating with your framework:{' '}
        <a href="/docs/ios-setup">iOS Setup</a> |{' '}
        <a href="/docs/android-setup">Android Setup</a>
      </Callout>

      <p>
        For an independent store on Apple or Android, follow the{' '}
        <a href="/docs/guides/store-providers">community provider guide</a>.
        Link its native package and select its factory in your app; purchase
        APIs keep the platform's existing shape and preserve the provider's
        store id.
      </p>

      <section>
        <h2 id="prerequisites" className="anchor-heading">
          Prerequisites
          <a href="#prerequisites" className="anchor-link">
            #
          </a>
        </h2>
        <ul>
          <li>
            <strong>Kotlin 2.4.20+</strong>, <strong>Gradle 9.3.0</strong>, and{' '}
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
          Choose kmp-iap 4.0.3 or newer from{' '}
          <a
            href={`https://central.sonatype.com/artifact/${KMP_PACKAGE.coordinate.replace(':', '/')}`}
          >
            Maven Central
          </a>{' '}
          for the SwiftPM setup below. Replace <code>&lt;version&gt;</code> with
          that published version in your shared module&apos;s{' '}
          <code>build.gradle.kts</code>:
        </p>
        <CodeBlock language="kotlin">
          {`val commonMain by getting {
    dependencies {
        implementation("${KMP_PACKAGE.coordinate}:<version>")
    }
}`}
        </CodeBlock>
        <p>Or if using version catalogs:</p>
        <CodeBlock language="toml">
          {`# gradle/libs.versions.toml
[versions]
kmp-iap = "<version>"

[libraries]
kmp-iap = { module = "${KMP_PACKAGE.coordinate}", version.ref = "kmp-iap" }`}
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
          Starting with kmp-iap 4.0.3, Gradle resolves OpenIAP through Swift
          Package Manager. Its native dependency version travels with the Maven
          artifact; you do not add OpenIAP separately in Xcode.
        </p>

        <Callout kind="note" title="Kotlin compatibility">
          Use Kotlin 2.4.20 or newer in the consuming project. Kotlin&apos;s
          SwiftPM import tooling is Alpha and imports Objective-C-compatible
          APIs; kmp-iap uses OpenIAP&apos;s existing Objective-C bridge.
        </Callout>

        <h4>Configure the shared framework</h4>
        <p>Use a static framework for direct Xcode integration:</p>
        <CodeBlock language="kotlin">
          {`// shared/build.gradle.kts
plugins {
    kotlin("multiplatform")
}

kotlin {
    listOf(iosArm64(), iosSimulatorArm64()).forEach { target ->
        target.binaries.framework {
            baseName = "Shared"
            isStatic = true
        }
    }
}`}
        </CodeBlock>
        <p>
          From your project root, connect the shared module and its generated
          Swift package to the iOS app. Replace the project path and{' '}
          <code>:shared</code> with your own names:
        </p>
        <CodeBlock language="bash">
          {`GRADLE_PROJECT_PATH=:shared \\
XCODEPROJ_PATH="$PWD/iosApp/iosApp.xcodeproj" ./gradlew \\
    :shared:integrateEmbedAndSign :shared:integrateLinkagePackage`}
        </CodeBlock>
        <p>
          Commit the updated Xcode project, generated{' '}
          <code>KotlinMultiplatformLinkedPackage</code> directory, and{' '}
          <code>.swiftpm-locks</code> lock files. Open the app&apos;s{' '}
          <code>.xcworkspace</code> if it still uses CocoaPods for other
          dependencies, or its <code>.xcodeproj</code> otherwise. Resolve
          package versions and build.
        </p>
        <p>
          When migrating, remove the shared module&apos;s CocoaPods integration
          and any manual OpenIAP framework search paths or embed scripts. See{' '}
          <a href="https://kotlinlang.org/docs/multiplatform/multiplatform-cocoapods-spm-migration.html">
            Kotlin&apos;s migration guide
          </a>
          .
        </p>

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

        <h4 id="android-store">Pick the Android store</h4>
        <p>
          kmp-iap publishes Play, Horizon, Amazon, and provider builds of its
          Android library, and Gradle stops with{' '}
          <code>
            Cannot choose between the following variants of
            io.github.hyochan:kmp-iap
          </code>{' '}
          until the build names one. Apply the OpenIAP Gradle plugin once in{' '}
          <code>settings.gradle.kts</code>; it reaches every Android module of
          that build, including an app module that sees kmp-iap only through a
          shared module. A build pulled in with <code>includeBuild</code>{' '}
          applies it in its own settings. It links Play by default, the
          connected Quest or Fire device&apos;s store on a debug build, and the
          store <code>openiapStore</code> pins, which is how release builds
          choose.
        </p>
        <CodeBlock language="kotlin">
          {`// settings.gradle.kts — keep mavenCentral() in pluginManagement.repositories
plugins {
    id("io.github.hyochan.openiap") version "${OPENIAP_VERSIONS.google}"
}`}
        </CodeBlock>
        <CodeBlock language="properties">
          {`# gradle.properties — only for a build that must not follow the device
openiapStore=horizon`}
        </CodeBlock>
        <p>
          Without the plugin, name the store in every Android module:{' '}
          <code>missingDimensionStrategy("platform", "play")</code> in the{' '}
          <code>defaultConfig</code> of application and library modules, or{' '}
          <code>
            localDependencySelection {'{'} productFlavorDimension("platform"){' '}
            {'{'} selectFrom.set(listOf("play")) {'}'} {'}'}
          </code>{' '}
          inside the Kotlin Multiplatform Android library block (AGP 8.12 or
          later; AGP 9 removed the older <code>dependencyVariantSelection</code>
          ). A module that declares its own <code>platform</code> flavors keeps
          choosing per flavor. See{' '}
          <a href="/docs/setup/store#selection">How the Store Is Selected</a>{' '}
          for the full rule. At runtime, <code>getStore()</code> reports the
          linked store: <code>Store.HORIZON</code> on a Horizon build,{' '}
          <code>Store.AMAZON</code> on an Amazon build,{' '}
          <code>Store.PLAY_STORE</code> on a Play build,{' '}
          <code>Store.APP_STORE</code> on iOS, and <code>Store.UNKNOWN</code> on
          a community-provider build or when the Apple provider selection fails.
          From 4.0.0, handle <code>UNKNOWN</code> in every exhaustive{' '}
          <code>when</code>; see the{' '}
          <a href="/docs/updates/migration#provider-contract-kmp-store">
            upgrade notes
          </a>
          .
        </p>

        <h4>R8 and ProGuard</h4>
        <p>
          No rules to add. From 3.6.1, kmp-iap and the openiap store artifact
          ship the R8 rules each store needs. Check the{' '}
          <a href="#android-kotlin-metadata">Android toolchain requirements</a>{' '}
          for Kotlin 2.4 before building a minified app.
        </p>
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
          Keep one live client per process. On Meta Horizon a second live client
          kills the process when it queries purchases.
        </p>
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
          Fetch products once the connection is up. Handle purchases on{' '}
          <code>purchaseUpdatedListener</code> and cancellations on{' '}
          <code>purchaseErrorListener</code>. Use the nullable{' '}
          <code>requestPurchase(props)</code> form below for these event-driven
          screens; the DSL form requires a purchase result and throws when none
          is returned. See{' '}
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
        <p>The generated Swift package must be linked to the app target.</p>
        <ul>
          <li>
            Run <code>:shared:integrateLinkagePackage</code> with{' '}
            <code>XCODEPROJ_PATH</code> pointing to the app project.
          </li>
          <li>
            Verify <code>KotlinMultiplatformLinkedPackage</code> appears in{' '}
            <strong>Build Phases &gt; Link Binary with Libraries</strong>
          </li>
          <li>
            Resolve package versions, clean the build folder, and rebuild.
          </li>
        </ul>

        <h3 id="android-kotlin-metadata">
          Android tools report incompatible Kotlin metadata
        </h3>
        <p>
          AGP 8.13 bundles an older Kotlin analyzer. If you use that AGP line,
          set <code>android.experimental.lint.version=9.4.1</code> in your{' '}
          <code>gradle.properties</code> to analyze Kotlin 2.4 artifacts.
        </p>
        <p>
          Kotlin 2.4 also requires R8 9.1.29 or newer for minified apps. If your
          AGP bundles an older R8, add this override inside{' '}
          <code>pluginManagement</code> in <code>settings.gradle.kts</code>:
        </p>
        <CodeBlock language="kotlin">
          {`buildscript {
    repositories { google(); mavenCentral() }
    dependencies { classpath("com.android.tools:r8:9.1.56") }
}`}
        </CodeBlock>
        <p>
          See the{' '}
          <a href="https://developer.android.com/build/kotlin-support">
            Android Kotlin compatibility table
          </a>
          .
        </p>

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
