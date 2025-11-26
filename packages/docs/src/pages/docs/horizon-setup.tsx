import CodeBlock from '../../components/CodeBlock';
import SEO from '../../components/SEO';

function HorizonSetup() {
  return (
    <div className="doc-page">
      <SEO
        title="Horizon OS Setup"
        description="Setting up in-app purchases for Meta Horizon OS (Quest devices) using OpenIAP's unified Android SDK."
        path="/docs/horizon-setup"
        keywords="Meta Quest IAP, Horizon OS, VR in-app purchase"
      />
      <h1>Horizon OS Setup Guide</h1>
      <p>
        Setting up in-app purchases for Meta Horizon OS (Quest devices) using
        OpenIAP's unified Android SDK.
      </p>

      <section>
        <h2 id="prerequisites" className="anchor-heading">
          Prerequisites
          <a href="#prerequisites" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          Before implementing in-app purchases for Horizon OS, ensure you have:
        </p>
        <ul>
          <li>
            A{' '}
            <a
              href="https://developer.meta.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              Meta Developer Account
            </a>
          </li>
          <li>
            Your app registered in the{' '}
            <a
              href="https://developer.meta.com/horizon/"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              Horizon Developer Hub
            </a>
          </li>
          <li>
            <code>openiap-google@1.3.2</code> or later installed (Horizon flavor support added in 1.3.2)
          </li>
          <li>A Meta Quest device for testing (Quest 2, Quest 3, Quest Pro)</li>
        </ul>

        <div
          style={{
            padding: '1rem',
            background: 'rgba(33, 150, 243, 0.1)',
            borderLeft: '4px solid #2196F3',
            borderRadius: '0.5rem',
            margin: '1rem 0',
          }}
        >
          <strong>ℹ️ Note:</strong> OpenIAP uses the same Android SDK for both
          Google Play and Horizon OS. The build flavor determines which billing
          implementation is compiled into your APK. If no flavor is specified,
          it defaults to Play (Google Play Billing).
        </div>
      </section>

      <section>
        <h2 id="horizon-console" className="anchor-heading">
          Meta Horizon Developer Hub Configuration
          <a href="#horizon-console" className="anchor-link">
            #
          </a>
        </h2>

        <h3 id="create-app" className="anchor-heading">
          1. Create Your App
          <a href="#create-app" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>
            Sign in to{' '}
            <a
              href="https://developer.meta.com/horizon/"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              Meta Horizon Developer Hub
            </a>
          </li>
          <li>Click "Create New App"</li>
          <li>Select "Horizon OS" as the platform</li>
          <li>Fill in your app details (name, description, category)</li>
          <li>Note your App ID - you'll need this for configuration</li>
        </ul>

        <h3 id="iap-products" className="anchor-heading">
          2. Configure In-App Products
          <a href="#iap-products" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>Navigate to "Monetization" → "In-App Purchases"</li>
          <li>Click "Create Product"</li>
          <li>
            Select product type:
            <ul>
              <li>
                <strong>Consumable</strong> - Can be purchased multiple times
                (e.g., coins, power-ups)
              </li>
              <li>
                <strong>Non-consumable</strong> - One-time purchase (e.g., level
                packs, features)
              </li>
              <li>
                <strong>Subscription</strong> - Recurring purchases (e.g.,
                premium membership)
              </li>
            </ul>
          </li>
          <li>
            Set the Product ID (SKU) - This must match your code exactly
          </li>
          <li>Configure pricing and availability</li>
          <li>Save and activate the product</li>
        </ul>

        <div
          style={{
            padding: '1rem',
            background: 'rgba(220, 104, 67, 0.1)',
            borderLeft: '4px solid var(--accent-color)',
            borderRadius: '0.5rem',
            margin: '1rem 0',
          }}
        >
          <strong>⚠️ Important:</strong> Product IDs (SKUs) are case-sensitive
          and cannot be changed after creation. Use a consistent naming
          convention like <code>com.yourapp.product_name</code>.
        </div>
      </section>

      <section>
        <h2 id="android-manifest" className="anchor-heading">
          AndroidManifest Configuration
          <a href="#android-manifest" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          Add your Horizon App ID to <code>AndroidManifest.xml</code>:
        </p>
        <CodeBlock language="xml">
{`<manifest>
  <application>
    <!-- Add this meta-data inside <application> -->
    <meta-data
      android:name="com.meta.horizon.platform.ovr.OCULUS_APP_ID"
      android:value="YOUR_HORIZON_APP_ID" />
  </application>
</manifest>`}
        </CodeBlock>

        <div
          style={{
            padding: '1rem',
            background: 'rgba(33, 150, 243, 0.1)',
            borderLeft: '4px solid #2196F3',
            borderRadius: '0.5rem',
            margin: '1rem 0',
          }}
        >
          <strong>💡 Tip:</strong> For apps that support both Google Play and
          Horizon OS, you can manage the App ID via build flavors or Gradle
          properties. See the{' '}
          <a href="/docs/android-setup" className="external-link">
            Android Setup Guide
          </a>{' '}
          for flavor configuration examples.
        </div>
      </section>

      <section>
        <h2 id="code-setup" className="anchor-heading">
          Code Implementation
          <a href="#code-setup" className="anchor-link">
            #
          </a>
        </h2>

        <h3 id="default-detection" className="anchor-heading">
          Option 1: Default Constructor (Recommended)
          <a href="#default-detection" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          The simplest approach - the build flavor you select determines which billing SDK is compiled into your APK:
        </p>
        <CodeBlock language="kotlin">
{`// Kotlin - Default constructor
val store = OpenIapStore(context)

// Build with horizonDebug/horizonRelease:
// - APK includes Horizon Billing SDK
// - Reads OCULUS_APP_ID from AndroidManifest

// Build with playDebug/playRelease (default):
// - APK includes Google Play Billing SDK`}
        </CodeBlock>

        <h3 id="explicit-horizon" className="anchor-heading">
          Option 2: Explicit Horizon Configuration
          <a href="#explicit-horizon" className="anchor-link">
            #
          </a>
        </h3>
        <p>Force Horizon billing even on non-Quest devices (for testing):</p>
        <CodeBlock language="kotlin">
{`// Kotlin
val store = OpenIapStore(
    context,
    store = "horizon",
    appId = "YOUR_HORIZON_APP_ID"
)

// Or use other aliases: "meta", "quest"`}
        </CodeBlock>

        <h3 id="usage-example" className="anchor-heading">
          Usage Example
          <a href="#usage-example" className="anchor-link">
            #
          </a>
        </h3>
        <CodeBlock language="kotlin">
{`// Initialize store (uses build flavor)
val store = OpenIapStore(context)

// Connect to billing
lifecycleScope.launch {
    val connected = store.initConnection()
    if (!connected) {
        Log.e("IAP", "Failed to connect")
        return@launch
    }

    // Fetch products
    val result = store.fetchProducts(
        ProductRequest(
            skus = listOf("premium_upgrade", "coins_pack_100"),
            type = ProductQueryType.InApp
        )
    )

    // Request purchase
    store.requestPurchase(
        RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(
                    android = RequestPurchaseAndroidProps(
                        skus = listOf("coins_pack_100")
                    )
                )
            )
        )
    )
}`}
        </CodeBlock>
      </section>

      <section>
        <h2 id="testing" className="anchor-heading">
          Testing on Quest Devices
          <a href="#testing" className="anchor-link">
            #
          </a>
        </h2>

        <h3 id="sideloading" className="anchor-heading">
          1. Enable Developer Mode
          <a href="#sideloading" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>Open the Meta Quest mobile app</li>
          <li>Go to Menu → Devices → Your Quest Device</li>
          <li>Tap Developer Mode and toggle it on</li>
          <li>You may need to create a developer organization first</li>
        </ul>

        <h3 id="install-test" className="anchor-heading">
          2. Install and Test
          <a href="#install-test" className="anchor-link">
            #
          </a>
        </h3>
        <CodeBlock language="javascript">
{`# Connect Quest via USB
adb devices

# Install your APK
adb install -r app-horizon-debug.apk

# Check logs
adb logcat | grep OpenIap`}
        </CodeBlock>

        <h3 id="test-users" className="anchor-heading">
          3. Add Test Users
          <a href="#test-users" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>In Horizon Developer Hub, go to "Testing" → "Test Users"</li>
          <li>Add Meta accounts for testing</li>
          <li>Test users can make purchases without being charged</li>
          <li>Products must be in "Available" state for test users</li>
        </ul>
      </section>

      <section>
        <h2 id="build-flavors" className="anchor-heading">
          Multi-Platform Build Configuration
          <a href="#build-flavors" className="anchor-link">
            #
          </a>
        </h2>

        <h3 id="local-properties" className="anchor-heading">
          1. Configure local.properties
          <a href="#local-properties" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Create or update <code>local.properties</code> in your project root with your Horizon App ID:
        </p>
        <CodeBlock language="javascript">
{`# local.properties
sdk.dir=/path/to/Android/sdk

# Add your Horizon OS App ID
horizon.app.id=YOUR_HORIZON_APP_ID`}
        </CodeBlock>

        <h3 id="gradle-config" className="anchor-heading">
          2. Setup Build Flavors
          <a href="#gradle-config" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Configure Android build flavors to support both Google Play and Horizon OS:
        </p>
        <CodeBlock language="kotlin">
{`// build.gradle.kts
val localProperties = Properties().apply {
    val localPropertiesFile = rootProject.file("local.properties")
    if (localPropertiesFile.exists()) {
        localPropertiesFile.inputStream().use { load(it) }
    }
}

val horizonAppId = localProperties.getProperty("horizon.app.id") ?: ""

android {
    flavorDimensions += "platform"

    productFlavors {
        create("play") {
            dimension = "platform"
            // Google Play configuration
        }

        create("horizon") {
            dimension = "platform"
            // Horizon OS configuration
            buildConfigField("String", "HORIZON_APP_ID", "\\"$horizonAppId\\"")
            manifestPlaceholders["OCULUS_APP_ID"] = horizonAppId
        }
    }
}`}
        </CodeBlock>

        <h3 id="android-studio-run" className="anchor-heading">
          3. Run in Android Studio
          <a href="#android-studio-run" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Android Studio provides build variants for each flavor. Select the variant from the Build Variants panel:
        </p>
        <ul>
          <li>
            <strong>horizonDebug</strong> - Horizon OS billing (for Quest devices)
          </li>
          <li>
            <strong>playDebug</strong> - Google Play billing (for phones/tablets)
          </li>
        </ul>
        <p>
          Build separate APKs for each platform: horizonDebug/horizonRelease for Quest devices,
          playDebug/playRelease for Android phones/tablets.
        </p>

        <div
          style={{
            padding: '1rem',
            background: 'rgba(33, 150, 243, 0.1)',
            borderLeft: '4px solid #2196F3',
            borderRadius: '0.5rem',
            margin: '1rem 0',
          }}
        >
          <strong>💡 Tip:</strong> To change build variant in Android Studio:
          <ol style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            <li>Open "Build Variants" panel (View → Tool Windows → Build Variants)</li>
            <li>Select your desired variant (e.g., "horizonDebug" or "playDebug")</li>
            <li>Click the "Run" button to build and install</li>
          </ol>
        </div>

        <h3 id="command-line-build" className="anchor-heading">
          4. Command Line Build
          <a href="#command-line-build" className="anchor-link">
            #
          </a>
        </h3>
        <p>Alternatively, build from command line:</p>
        <CodeBlock language="javascript">
{`# Build for Horizon OS (Meta Quest devices)
./gradlew assembleHorizonDebug

# Build for Google Play (Android phones/tablets)
./gradlew assemblePlayDebug

# Install directly to connected device
./gradlew installHorizonDebug
./gradlew installPlayDebug`}
        </CodeBlock>
      </section>

      <section>
        <h2 id="troubleshooting" className="anchor-heading">
          Troubleshooting
          <a href="#troubleshooting" className="anchor-link">
            #
          </a>
        </h2>

        <h3>Connection Failed</h3>
        <ul>
          <li>
            Verify <code>OCULUS_APP_ID</code> is correct in AndroidManifest
          </li>
          <li>Check that your app is registered in Horizon Developer Hub</li>
          <li>Ensure the device is connected to internet</li>
          <li>Check logs: <code>adb logcat | grep OpenIap</code></li>
        </ul>

        <h3>Products Not Found</h3>
        <ul>
          <li>Verify products are created and activated in Developer Hub</li>
          <li>Check that SKU/Product IDs match exactly (case-sensitive)</li>
          <li>Ensure your test account has access to the products</li>
          <li>Wait a few minutes after creating products for them to propagate</li>
        </ul>

        <h3>Purchase Flow Not Starting</h3>
        <ul>
          <li>Ensure you're logged into a Meta account on the device</li>
          <li>Verify the test user has permission to test purchases</li>
          <li>Check that the activity context is valid when calling requestPurchase</li>
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
            <a href="/docs/lifecycle" className="external-link">
              Learn about the IAP Lifecycle
            </a>
          </li>
          <li>
            <a href="/docs/apis" className="external-link">
              Explore the complete API reference
            </a>
          </li>
          <li>
            <a href="/docs/events" className="external-link">
              Set up purchase event listeners
            </a>
          </li>
          <li>
            <a href="/docs/errors" className="external-link">
              Handle errors gracefully
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default HorizonSetup;
