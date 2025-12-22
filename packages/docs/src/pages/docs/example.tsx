import PlatformTabs from '../../components/PlatformTabs';
import SEO from '../../components/SEO';
import { IAPKIT_URL, trackIapKitClick } from '../../lib/config';

function Example() {
  return (
    <div className="doc-page">
      <SEO
        title="Example"
        description="How to run OpenIAP iOS and Android example app"
        path="/docs/example"
        keywords="OpenIAP example, iOS example app, Android example app, IAP testing"
      />
      <h1>Example</h1>
      <p>
        OpenIAP provides example applications for both iOS and Android that
        demonstrate the complete in-app purchase lifecycle.
      </p>

      <section>
        <h2 id="features" className="anchor-heading">
          Features
          <a href="#features" className="anchor-link">
            #
          </a>
        </h2>
        <ul>
          <li>
            <strong>Purchase Flow</strong> - Buy consumable and non-consumable
            products with verification options
          </li>
          <li>
            <strong>Subscription Flow</strong> - Subscribe to auto-renewable
            subscriptions with upgrade/downgrade support
          </li>
          <li>
            <strong>My Purchases</strong> - View and restore previously
            purchased items
          </li>
          <li>
            <strong>Offer Code</strong> - Redeem promotional offer codes (iOS
            only)
          </li>
          <li>
            <strong>Alternative Billing</strong> - Test user-choice billing flow
            (Android only)
          </li>
        </ul>
      </section>

      <PlatformTabs>
        {{
          ios: (
            <>
              <section>
                <h2 id="ios-overview" className="anchor-heading">
                  Overview
                  <a href="#ios-overview" className="anchor-link">
                    #
                  </a>
                </h2>
                <div className="screenshot-card">
                  <img
                    src="/examples/1. [IOS] Example.png"
                    alt="iOS Example App Main Screen"
                  />
                  <div className="screenshot-card-content">
                    <h4>Main Screen</h4>
                    <p>
                      The home screen provides navigation to all example
                      features including Purchase Flow, Subscription Flow, My
                      Purchases, and platform-specific options like Offer Code
                      redemption.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 id="ios-location" className="anchor-heading">
                  Location
                  <a href="#ios-location" className="anchor-link">
                    #
                  </a>
                </h2>
                <pre className="code-block">packages/apple/Example/</pre>
              </section>

              <section>
                <h2 id="ios-build" className="anchor-heading">
                  Build and Run
                  <a href="#ios-build" className="anchor-link">
                    #
                  </a>
                </h2>

                <h3>Using Xcode (Recommended)</h3>
                <ol>
                  <li>
                    Open <code>packages/apple/Example/Martie.xcodeproj</code> in
                    Xcode
                  </li>
                  <li>
                    Select your development team in Signing & Capabilities
                  </li>
                  <li>
                    Select your target device (real device recommended for IAP
                    testing)
                  </li>
                  <li>Click Run (⌘R)</li>
                </ol>

                <h3>Using Command Line</h3>
                <pre className="code-block">{`# Build the Swift package first
cd packages/apple
swift build

# Build and run on simulator
cd Example
xcodebuild -project Martie.xcodeproj \\
  -scheme OpenIapExample \\
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \\
  build

# Or build for a real device (replace with your device ID)
xcodebuild -project Martie.xcodeproj \\
  -scheme OpenIapExample \\
  -destination 'id=YOUR_DEVICE_UDID' \\
  build`}</pre>

                <div
                  style={{
                    padding: '1rem',
                    background: 'rgba(220, 104, 67, 0.1)',
                    borderLeft: '4px solid var(--accent-color)',
                    borderRadius: '0.5rem',
                    margin: '1rem 0',
                  }}
                >
                  <strong>⚠️ Important:</strong> For actual in-app purchase
                  testing, you must run on a real device. The iOS simulator has
                  limited StoreKit functionality.
                </div>
              </section>

              <section>
                <h2 id="ios-testing" className="anchor-heading">
                  Testing Purchases
                  <a href="#ios-testing" className="anchor-link">
                    #
                  </a>
                </h2>
                <div className="screenshot-card">
                  <img
                    src="/examples/2. [IOS] Purchase Flow.png"
                    alt="iOS Purchase Flow Screen"
                  />
                  <div className="screenshot-card-content">
                    <h4>Purchase Flow</h4>
                    <p>
                      Test purchasing consumable and non-consumable products.
                      Select from three verification methods: IAPKit
                      (server-side), Local (StoreKit verification), or None
                      (skip verification).
                    </p>
                  </div>
                </div>
                <ol>
                  <li>
                    Sign in with a sandbox Apple ID at{' '}
                    <strong>
                      Settings → Developer → Sandbox Apple Account
                    </strong>
                  </li>
                  <li>Launch the example app</li>
                  <li>
                    Navigate to "Purchase Flow" or "Subscription Flow" screen
                  </li>
                  <li>Select a verification method (IAPKit, Local, or None)</li>
                  <li>Tap on a product to initiate a purchase</li>
                </ol>
              </section>

              <section>
                <h2 id="ios-verification" className="anchor-heading">
                  Purchase Verification
                  <a href="#ios-verification" className="anchor-link">
                    #
                  </a>
                </h2>
                <p>The example app supports three verification methods:</p>

                <h3>IAPKit (Server-Side)</h3>
                <ul>
                  <li>Sends purchase data to IAPKit API for verification</li>
                  <li>
                    Returns <code>isValid: true/false</code> and purchase state
                  </li>
                  <li>Recommended for production apps</li>
                </ul>

                <div
                  style={{
                    padding: '1rem',
                    background: 'rgba(164, 116, 101, 0.1)',
                    borderLeft: '4px solid var(--primary-color)',
                    borderRadius: '0.5rem',
                    margin: '1rem 0',
                  }}
                >
                  <strong>Note:</strong> To use IAPKit verification, get your
                  API key from{' '}
                  <a
                    href={IAPKIT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link"
                    onClick={trackIapKitClick}
                  >
                    iapkit.com
                  </a>{' '}
                  and configure it in <code>Info.plist</code>:
                  <pre
                    className="code-block"
                    style={{ marginTop: '0.5rem', marginBottom: 0 }}
                  >{`# Copy the template
cp OpenIapExample/Info.plist.example OpenIapExample/Info.plist

# Edit Info.plist with your API key
<key>IAPKIT_API_KEY</key>
<string>iapkit_your_api_key_here</string>`}</pre>
                </div>

                <h3>Local</h3>
                <ul>
                  <li>Verifies purchase locally using StoreKit APIs</li>
                  <li>Checks transaction verification status</li>
                  <li>Good for development and testing</li>
                </ul>

                <h3>None</h3>
                <ul>
                  <li>Skips verification entirely</li>
                  <li>Immediately finishes the transaction</li>
                  <li>Only for testing purchase flow UI</li>
                </ul>
              </section>

              <section>
                <h2 id="ios-gitignore" className="anchor-heading">
                  Git Security
                  <a href="#ios-gitignore" className="anchor-link">
                    #
                  </a>
                </h2>
                <p>
                  The <code>Info.plist</code> file is automatically excluded
                  from git to protect your API key. Only the{' '}
                  <code>Info.plist.example</code> template is committed.
                </p>
              </section>

              <section>
                <h2 id="ios-troubleshooting" className="anchor-heading">
                  Troubleshooting
                  <a href="#ios-troubleshooting" className="anchor-link">
                    #
                  </a>
                </h2>

                <h3>"IAPKIT_API_KEY not configured"</h3>
                <ul>
                  <li>
                    Ensure <code>Info.plist</code> exists in{' '}
                    <code>OpenIapExample/</code> directory
                  </li>
                  <li>
                    Verify the file contains the <code>IAPKIT_API_KEY</code> key
                  </li>
                  <li>Clean build folder (⇧⌘K) and rebuild</li>
                </ul>

                <h3>Products Not Loading</h3>
                <p>
                  See{' '}
                  <a href="/docs/ios-setup#common-issues">
                    iOS Setup - Common Issues
                  </a>
                </p>
              </section>

              <section>
                <h2 id="ios-subscription" className="anchor-heading">
                  Subscription Upgrade
                  <a href="#ios-subscription" className="anchor-link">
                    #
                  </a>
                </h2>
                <div className="screenshot-card">
                  <img
                    src="/examples/3. [IOS] Subscription Flow Upgrade.png"
                    alt="iOS Subscription Flow Upgrade Screen"
                  />
                  <div className="screenshot-card-content">
                    <h4>Subscription Flow</h4>
                    <p>
                      Manage auto-renewable subscriptions with upgrade/downgrade
                      support. When upgrading, select proration mode to control
                      how the billing transition is handled.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 id="ios-purchases" className="anchor-heading">
                  My Purchases
                  <a href="#ios-purchases" className="anchor-link">
                    #
                  </a>
                </h2>
                <div className="screenshot-card">
                  <img
                    src="/examples/4. [IOS] Available Purchases.png"
                    alt="iOS Available Purchases Screen"
                  />
                  <div className="screenshot-card-content">
                    <h4>Available Purchases</h4>
                    <p>
                      View all previously purchased items and active
                      subscriptions. Restore purchases to recover entitlements
                      after reinstalling the app or switching devices.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 id="ios-offer-code" className="anchor-heading">
                  Offer Code
                  <a href="#ios-offer-code" className="anchor-link">
                    #
                  </a>
                </h2>
                <div className="screenshot-card">
                  <img
                    src="/examples/5. [IOS] Offer Code.png"
                    alt="iOS Offer Code Screen"
                  />
                  <div className="screenshot-card-content">
                    <h4>Offer Code Redemption</h4>
                    <p>
                      Present the iOS offer code redemption sheet to let users
                      redeem promotional codes for subscriptions or products.
                      This feature uses the native StoreKit redemption UI.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 id="ios-external" className="anchor-heading">
                  External Purchase
                  <a href="#ios-external" className="anchor-link">
                    #
                  </a>
                </h2>
                <div className="screenshot-card">
                  <img
                    src="/examples/6. [IOS] Alternative Billing.png"
                    alt="iOS Alternative Billing Screen"
                  />
                  <div className="screenshot-card-content">
                    <h4>Alternative Billing</h4>
                    <p>
                      Test external purchase links that redirect users to
                      complete purchases outside of the App Store. This
                      demonstrates compliance with alternative payment
                      requirements in supported regions.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 id="ios-source" className="anchor-heading">
                  Source Code
                  <a href="#ios-source" className="anchor-link">
                    #
                  </a>
                </h2>
                <p>
                  <a
                    href="https://github.com/hyodotdev/openiap/tree/main/packages/apple/Example"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link"
                  >
                    View iOS Example on GitHub (Swift)
                  </a>
                </p>
              </section>
            </>
          ),
          android: (
            <>
              <section>
                <h2 id="android-overview" className="anchor-heading">
                  Overview
                  <a href="#android-overview" className="anchor-link">
                    #
                  </a>
                </h2>
                <div className="screenshot-card">
                  <img
                    src="/examples/1. [Android] Example.png"
                    alt="Android Example App Main Screen"
                  />
                  <div className="screenshot-card-content">
                    <h4>Main Screen</h4>
                    <p>
                      The Android version offers all core features with an
                      additional Alternative Billing option for testing Google
                      Play's user-choice billing flow.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 id="android-location" className="anchor-heading">
                  Location
                  <a href="#android-location" className="anchor-link">
                    #
                  </a>
                </h2>
                <pre className="code-block">packages/google/Example/</pre>
              </section>

              <section>
                <h2 id="android-build" className="anchor-heading">
                  Build and Run
                  <a href="#android-build" className="anchor-link">
                    #
                  </a>
                </h2>

                <h3>Using Android Studio (Recommended)</h3>
                <ol>
                  <li>
                    Open <code>packages/google</code> directory in Android
                    Studio
                  </li>
                  <li>Wait for Gradle sync to complete</li>
                  <li>Select "Example" from the run configurations dropdown</li>
                  <li>
                    Select your target device (real device required for IAP
                    testing)
                  </li>
                  <li>Click Run (▶️)</li>
                </ol>

                <h3>Using Command Line</h3>
                <pre className="code-block">{`# Navigate to the google package
cd packages/google

# Build the example app
./gradlew :Example:assembleDebug

# Install on connected device
./gradlew :Example:installDebug

# Or use adb directly
adb install Example/build/outputs/apk/debug/Example-debug.apk`}</pre>

                <div
                  style={{
                    padding: '1rem',
                    background: 'rgba(220, 104, 67, 0.1)',
                    borderLeft: '4px solid var(--accent-color)',
                    borderRadius: '0.5rem',
                    margin: '1rem 0',
                  }}
                >
                  <strong>⚠️ Important:</strong> For actual in-app purchase
                  testing, the app must be:
                  <ul style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                    <li>
                      Installed from Google Play (internal/closed/open testing
                      track)
                    </li>
                    <li>
                      Signed with the same key as uploaded to Play Console
                    </li>
                    <li>Tested with a license tester account</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 id="android-testing" className="anchor-heading">
                  Testing Purchases
                  <a href="#android-testing" className="anchor-link">
                    #
                  </a>
                </h2>
                <div className="screenshot-card">
                  <img
                    src="/examples/2. [Android] Purchase Flow.png"
                    alt="Android Purchase Flow Screen"
                  />
                  <div className="screenshot-card-content">
                    <h4>Purchase Flow</h4>
                    <p>
                      Purchase products using Google Play Billing. The
                      verification dropdown lets you choose between IAPKit
                      server verification, local validation, or skipping
                      verification entirely.
                    </p>
                  </div>
                </div>
                <ol>
                  <li>
                    Add your Google account as a license tester in{' '}
                    <strong>Play Console → Setup → License testing</strong>
                  </li>
                  <li>Download the app from the Play Store test track</li>
                  <li>
                    Launch the app and go to "Purchase Flow" or "Subscription
                    Flow"
                  </li>
                  <li>Select a verification method (IAPKit, Local, or None)</li>
                  <li>Tap on a product to initiate a purchase</li>
                </ol>
              </section>

              <section>
                <h2 id="android-verification" className="anchor-heading">
                  Purchase Verification
                  <a href="#android-verification" className="anchor-link">
                    #
                  </a>
                </h2>
                <p>The example app supports three verification methods:</p>

                <h3>IAPKit (Server-Side)</h3>
                <ul>
                  <li>Sends purchase data to IAPKit API for verification</li>
                  <li>
                    Returns <code>isValid: true/false</code> and purchase state
                  </li>
                  <li>Recommended for production apps</li>
                </ul>

                <div
                  style={{
                    padding: '1rem',
                    background: 'rgba(164, 116, 101, 0.1)',
                    borderLeft: '4px solid var(--primary-color)',
                    borderRadius: '0.5rem',
                    margin: '1rem 0',
                  }}
                >
                  <strong>Note:</strong> To use IAPKit verification, get your
                  API key from{' '}
                  <a
                    href={IAPKIT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link"
                    onClick={trackIapKitClick}
                  >
                    iapkit.com
                  </a>{' '}
                  and configure it in <code>local.properties</code>:
                  <pre
                    className="code-block"
                    style={{ marginTop: '0.5rem', marginBottom: 0 }}
                  >{`# Copy the template
cp local.properties.example local.properties

# Add your API key
iapkit.api.key=iapkit_your_api_key_here`}</pre>
                </div>

                <h3>Local</h3>
                <ul>
                  <li>
                    Verifies purchase locally using Google Play Billing APIs
                  </li>
                  <li>Checks purchase state</li>
                  <li>Good for development and testing</li>
                </ul>

                <h3>None</h3>
                <ul>
                  <li>Skips verification entirely</li>
                  <li>Immediately finishes the transaction</li>
                  <li>Only for testing purchase flow UI</li>
                </ul>
              </section>

              <section>
                <h2 id="android-buildconfig" className="anchor-heading">
                  How API Key is Loaded
                  <a href="#android-buildconfig" className="anchor-link">
                    #
                  </a>
                </h2>
                <p>
                  The API key from <code>local.properties</code> is injected
                  into the app via <code>BuildConfig</code> during the build
                  process. The Example app's <code>build.gradle.kts</code>{' '}
                  includes:
                </p>
                <pre className="code-block">{`// In Example/build.gradle.kts
val localProperties = Properties()
val localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localProperties.load(localPropertiesFile.inputStream())
}

android {
    defaultConfig {
        buildConfigField(
            "String",
            "IAPKIT_API_KEY",
            ""${'$'}{localProperties.getProperty("iapkit.api.key", "")}""
        )
    }
}`}</pre>
              </section>

              <section>
                <h2 id="android-gitignore" className="anchor-heading">
                  Git Security
                  <a href="#android-gitignore" className="anchor-link">
                    #
                  </a>
                </h2>
                <p>
                  The <code>local.properties</code> file is automatically
                  excluded from git (standard Android convention). Only the{' '}
                  <code>local.properties.example</code> template is committed.
                </p>
              </section>

              <section>
                <h2 id="android-troubleshooting" className="anchor-heading">
                  Troubleshooting
                  <a href="#android-troubleshooting" className="anchor-link">
                    #
                  </a>
                </h2>

                <h3>"IAPKit API Key not configured"</h3>
                <ul>
                  <li>
                    Ensure <code>local.properties</code> exists in{' '}
                    <code>packages/google/</code> directory
                  </li>
                  <li>
                    Verify it contains <code>iapkit.api.key=your_key</code>
                  </li>
                  <li>
                    Clean and rebuild:{' '}
                    <code>./gradlew clean :Example:assembleDebug</code>
                  </li>
                </ul>

                <h3>Products Not Loading</h3>
                <p>
                  See{' '}
                  <a href="/docs/android-setup#common-issues">
                    Android Setup - Common Issues
                  </a>
                </p>
              </section>

              <section>
                <h2 id="android-subscription" className="anchor-heading">
                  Subscription Flow
                  <a href="#android-subscription" className="anchor-link">
                    #
                  </a>
                </h2>
                <div className="screenshot-card">
                  <img
                    src="/examples/3. [Android] Subscription Flow.png"
                    alt="Android Subscription Flow Screen"
                  />
                  <div className="screenshot-card-content">
                    <h4>Subscription Flow</h4>
                    <p>
                      Subscribe to auto-renewable subscriptions via Google Play.
                      View available subscription tiers and initiate new
                      subscriptions with selected verification options.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2
                  id="android-subscription-upgrade"
                  className="anchor-heading"
                >
                  Subscription Upgrade
                  <a
                    href="#android-subscription-upgrade"
                    className="anchor-link"
                  >
                    #
                  </a>
                </h2>
                <div className="screenshot-card">
                  <img
                    src="/examples/4. [Android] Subscription Flow Upgrade.png"
                    alt="Android Subscription Flow Upgrade Screen"
                  />
                  <div className="screenshot-card-content">
                    <h4>Upgrade/Downgrade</h4>
                    <p>
                      Upgrade or downgrade existing subscriptions with proration
                      mode selection. Choose how the remaining balance should be
                      applied to the new subscription tier.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 id="android-purchases" className="anchor-heading">
                  My Purchases
                  <a href="#android-purchases" className="anchor-link">
                    #
                  </a>
                </h2>
                <div className="screenshot-card">
                  <img
                    src="/examples/5. [Android] Available Purchases.png"
                    alt="Android Available Purchases Screen"
                  />
                  <div className="screenshot-card-content">
                    <h4>Available Purchases</h4>
                    <p>
                      View purchased products and active subscriptions from
                      Google Play. Restore purchases to sync entitlements across
                      devices or after app reinstallation.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 id="android-offer-code" className="anchor-heading">
                  Redeem Offer Code
                  <a href="#android-offer-code" className="anchor-link">
                    #
                  </a>
                </h2>
                <div className="screenshot-card">
                  <img
                    src="/examples/6. [Android] Redeem Offer Code.png"
                    alt="Android Redeem Offer Code Screen"
                  />
                  <div className="screenshot-card-content">
                    <h4>Offer Code Redemption</h4>
                    <p>
                      Open the Google Play redemption flow where users can enter
                      promo codes. The app launches the Play Store's native code
                      redemption interface.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 id="android-source" className="anchor-heading">
                  Source Code
                  <a href="#android-source" className="anchor-link">
                    #
                  </a>
                </h2>
                <p>
                  <a
                    href="https://github.com/hyodotdev/openiap/tree/main/packages/google/Example"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link"
                  >
                    View Android Example on GitHub (Kotlin)
                  </a>
                </p>
              </section>
            </>
          ),
        }}
      </PlatformTabs>
    </div>
  );
}

export default Example;
