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
        <h2 id="installation" className="anchor-heading">
          Installation
          <a href="#installation" className="anchor-link">
            #
          </a>
        </h2>
        <CodeBlock language="kotlin">
          {`// build.gradle.kts
dependencies {
    // Check Maven Central for the latest version
    implementation("io.github.hyochan.kmpiap:library:<latest-version>")
}`}
        </CodeBlock>
        <ul>
          <li>Requires Kotlin 1.9+</li>
          <li>
            iOS: CocoaPods integration with <code>openiap-apple</code>
          </li>
          <li>Android: Google Play Billing via <code>openiap-google</code></li>
        </ul>
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
          <strong>Critical:</strong> Always call <code>finishTransaction</code> after verifying a purchase. On Android, unfinished purchases are automatically refunded after 3 days.
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
        <h3>Products not found</h3>
        <ul>
          <li>Ensure all agreements are signed in App Store Connect / Google Play Console</li>
          <li>Verify banking, legal, and tax information is complete and approved</li>
          <li>Check that bundle ID / package name matches exactly</li>
          <li>Products must be in "Ready to Submit" status (Apple) or "Active" (Google)</li>
          <li>Wait 15-30 minutes after creating products before testing</li>
        </ul>
      </section>
    </div>
  );
}

export default KmpSetup;
