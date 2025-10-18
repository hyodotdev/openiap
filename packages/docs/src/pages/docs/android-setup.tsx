function AndroidSetup() {
  return (
    <div className="doc-page">
      <h1>Android Setup Guide</h1>
      <p>
        Setting up in-app purchases for Android requires configuration in Google
        Play Console and your Android project.
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
        <strong>📱 Building for Meta Quest?</strong> Also see the{' '}
        <a href="/docs/horizon-setup" className="external-link">
          Horizon OS Setup Guide
        </a>{' '}
        for Quest-specific configuration using the same Android SDK.
      </div>

      <section>
        <h2 id="prerequisites" className="anchor-heading">
          Prerequisites
          <a href="#prerequisites" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          Before you can implement and test in-app purchases on Android, you
          must complete these essential steps:
        </p>

        <h3 id="developer-account" className="anchor-heading">
          1. Google Play Developer Account
          <a href="#developer-account" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>
            Register for a Google Play Developer account ($25 one-time fee)
          </li>
          <li>Complete identity verification</li>
          <li>Accept all developer agreements</li>
          <li>Set up payment profile in Google Play Console</li>
        </ul>

        <h3 id="merchant-account" className="anchor-heading">
          2. Merchant Account Setup
          <a href="#merchant-account" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>Navigate to Setup → Payments profile</li>
          <li>Link a Google Payments Merchant account</li>
          <li>Complete tax information</li>
          <li>Verify banking details</li>
          <li>
            <strong>Important:</strong> Products won't work without a verified
            merchant account
          </li>
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
          <strong>⚠️ Important:</strong> The merchant account must be fully
          verified before products become available. This verification can take
          24-48 hours after submitting your information.
        </div>
      </section>

      <section>
        <h2 id="play-console" className="anchor-heading">
          Google Play Console Configuration
          <a href="#play-console" className="anchor-link">
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
          <li>Sign in to Google Play Console</li>
          <li>Click "Create app"</li>
          <li>
            Fill in app details (name, default language, app/game category)
          </li>
          <li>Select free or paid app</li>
          <li>Accept the Developer Program Policies</li>
        </ul>

        <h3 id="upload-app" className="anchor-heading">
          2. Upload Your App
          <a href="#upload-app" className="anchor-link">
            #
          </a>
        </h3>
        <p>You must upload at least one APK/AAB to create in-app products:</p>
        <ul>
          <li>Go to Release → Testing → Internal testing</li>
          <li>Create a new release</li>
          <li>Upload your signed APK or App Bundle</li>
          <li>Save and review the release</li>
          <li>Roll out to internal testing</li>
        </ul>

        <h3 id="create-products" className="anchor-heading">
          3. Create In-App Products
          <a href="#create-products" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>Navigate to Monetization → In-app products</li>
          <li>Click "Create product"</li>
          <li>
            Choose your product type:
            <ul>
              <li>
                <strong>Managed Products:</strong> One-time purchases or
                consumables
              </li>
              <li>
                <strong>Subscriptions:</strong> Recurring subscriptions
                (requires separate setup)
              </li>
            </ul>
          </li>
        </ul>

        <h3 id="configure-products" className="anchor-heading">
          4. Configure Product Details
          <a href="#configure-products" className="anchor-link">
            #
          </a>
        </h3>
        <p>For each product, provide:</p>
        <ul>
          <li>
            <strong>Product ID:</strong> Unique identifier (e.g.,
            premium_upgrade, coins_100)
          </li>
          <li>
            <strong>Name:</strong> Display name for users
          </li>
          <li>
            <strong>Description:</strong> Product description
          </li>
          <li>
            <strong>Price:</strong> Set price for each country/region
          </li>
          <li>
            Set product status to <strong>Active</strong>
          </li>
        </ul>

        <h3 id="configure-subscriptions" className="anchor-heading">
          5. Configure Subscriptions (if applicable)
          <a href="#configure-subscriptions" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>Navigate to Monetization → Subscriptions</li>
          <li>Create subscription with base plans and offers</li>
          <li>Configure billing period (weekly, monthly, yearly, etc.)</li>
          <li>Set up free trials or introductory pricing if desired</li>
          <li>Add subscription benefits for user display</li>
        </ul>
      </section>

      <section>
        <h2 id="project-configuration" className="anchor-heading">
          Android Project Configuration
          <a href="#project-configuration" className="anchor-link">
            #
          </a>
        </h2>

        <h3 id="add-billing-permission" className="anchor-heading">
          1. Add Billing Permission
          <a href="#add-billing-permission" className="anchor-link">
            #
          </a>
        </h3>
        <p>In your AndroidManifest.xml:</p>
        <pre className="code-block">{`<uses-permission android:name="com.android.vending.BILLING" />
<uses-permission android:name="android.permission.INTERNET" />`}</pre>

        <h3 id="update-build-gradle" className="anchor-heading">
          2. Update build.gradle
          <a href="#update-build-gradle" className="anchor-link">
            #
          </a>
        </h3>
        <p>Ensure you have the necessary dependencies:</p>
        <pre className="code-block">{`dependencies {
    implementation 'com.android.billingclient:billing:6.0.0'
    // Your other dependencies
}`}</pre>

        <h3 id="configure-proguard" className="anchor-heading">
          3. Configure ProGuard (if using)
          <a href="#configure-proguard" className="anchor-link">
            #
          </a>
        </h3>
        <p>Add to your proguard-rules.pro:</p>
        <pre className="code-block">{`-keep class com.android.billingclient.** { *; }
-keep class com.android.vending.billing.** { *; }`}</pre>
      </section>

      <section>
        <h2 id="testing-setup" className="anchor-heading">
          Testing Setup
          <a href="#testing-setup" className="anchor-link">
            #
          </a>
        </h2>

        <h3 id="license-testing" className="anchor-heading">
          1. Set Up License Testing
          <a href="#license-testing" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>In Google Play Console, go to Setup → License testing</li>
          <li>Add tester email addresses (Gmail accounts)</li>
          <li>Set license response to LICENSED</li>
          <li>Save changes</li>
        </ul>

        <h3 id="create-test-track" className="anchor-heading">
          2. Create Test Track
          <a href="#create-test-track" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>Use Internal testing track for fastest updates</li>
          <li>Add testers by email or Google Groups</li>
          <li>Share opt-in link with testers</li>
          <li>Testers must accept the invitation</li>
        </ul>

        <h3 id="testing-best-practices" className="anchor-heading">
          3. Testing Best Practices
          <a href="#testing-best-practices" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>
            Use the same Google account on the test device as added to license
            testing
          </li>
          <li>Ensure the app is downloaded from Play Store (via test track)</li>
          <li>Test purchases will show "(Test)" in the purchase dialog</li>
          <li>Test cards are automatically used - no real charges occur</li>
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
          <strong>💡 Tip:</strong> For faster testing during development, use
          Android Debug Bridge (ADB) to clear Google Play Store cache:{' '}
          <code>adb shell pm clear com.android.vending</code>
        </div>
      </section>

      <section>
        <h2 id="integration" className="anchor-heading">
          Integration with OpenIAP Libraries
          <a href="#integration" className="anchor-link">
            #
          </a>
        </h2>

        <p>
          To implement in-app purchases on Android, use one of the OpenIAP
          specification libraries:
        </p>

        <ul>
          <li>
            <a
              href="https://github.com/dooboolab-community/react-native-iap"
              target="_blank"
              rel="noopener noreferrer"
            >
              react-native-iap
            </a>{' '}
            - For React Native & Expo projects (Nitro Modules)
          </li>
          <li>
            <a
              href="https://github.com/hyochan/expo-iap"
              target="_blank"
              rel="noopener noreferrer"
            >
              expo-iap
            </a>{' '}
            - For React Native & Expo projects (Expo Modules)
          </li>
          <li>
            <a
              href="https://github.com/hyochan/flutter_inapp_purchase"
              target="_blank"
              rel="noopener noreferrer"
            >
              flutter_inapp_purchase
            </a>{' '}
            - For Flutter projects
          </li>
          <li>
            <a
              href="https://github.com/hyochan/kmp-iap"
              target="_blank"
              rel="noopener noreferrer"
            >
              kmp-iap
            </a>{' '}
            - For Kotlin Multiplatform projects
          </li>
        </ul>

        <p>
          These libraries implement the OpenIAP specification and handle
          Android-specific requirements.
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
          <strong>💡 Note:</strong> Refer to the specific library documentation
          for implementation details. Each library follows the OpenIAP
          specification while handling platform-specific requirements.
        </div>
      </section>

      <section>
        <h2 id="android-requirements" className="anchor-heading">
          Android-Specific Requirements
          <a href="#android-requirements" className="anchor-link">
            #
          </a>
        </h2>

        <h3 id="purchase-acknowledgment" className="anchor-heading">
          Purchase Acknowledgment
          <a href="#purchase-acknowledgment" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Android requires acknowledging purchases within 3 days. Unacknowledged
          purchases are automatically refunded by Google Play.
        </p>

        <h3 id="consumable-products" className="anchor-heading">
          Consumable Products
          <a href="#consumable-products" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Consumable products must be consumed before they can be purchased
          again. This prevents duplicate purchases of items like coins or lives.
        </p>

        <h3 id="purchase-verification" className="anchor-heading">
          Purchase Verification
          <a href="#purchase-verification" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Always verify purchases server-side using the Google Play Developer
          API to prevent fraud and ensure purchase validity.
        </p>

        <h3 id="subscription-management" className="anchor-heading">
          Subscription Management
          <a href="#subscription-management" className="anchor-link">
            #
          </a>
        </h3>
        <p>Subscriptions require special handling including:</p>
        <ul>
          <li>Grace periods for payment failures</li>
          <li>Upgrade/downgrade proration</li>
          <li>Subscription status verification</li>
          <li>Renewal notifications</li>
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
          <strong>⚠️ Important:</strong> OpenIAP libraries handle these
          Android-specific requirements automatically. Consult the library
          documentation for your chosen framework to ensure proper
          implementation.
        </div>
      </section>

      <section>
        <h2 id="common-issues" className="anchor-heading">
          Common Issues
          <a href="#common-issues" className="anchor-link">
            #
          </a>
        </h2>

        <h3 id="products-not-loading" className="anchor-heading">
          Products Not Loading
          <a href="#products-not-loading" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          <strong>Problem:</strong> getProducts() returns empty array
        </p>
        <p>
          <strong>Solutions:</strong>
        </p>

        <h4 id="check-prerequisites" className="anchor-heading">
          Check Prerequisites:
          <a href="#check-prerequisites" className="anchor-link">
            #
          </a>
        </h4>
        <ul>
          <li>Verify merchant account is set up and verified</li>
          <li>Ensure app is uploaded to at least internal testing track</li>
          <li>Confirm products are set to "Active" status</li>
          <li>Wait 2-24 hours after creating products for propagation</li>
        </ul>

        <h4 id="verify-configuration" className="anchor-heading">
          Verify Configuration:
          <a href="#verify-configuration" className="anchor-link">
            #
          </a>
        </h4>
        <ul>
          <li>Product IDs match exactly (case-sensitive)</li>
          <li>App package name matches Play Console</li>
          <li>Version code in app ≥ version in Play Console</li>
          <li>App is signed with the same certificate</li>
        </ul>

        <h3 id="purchase-flow-issues" className="anchor-heading">
          Purchase Flow Issues
          <a href="#purchase-flow-issues" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          <strong>Problem:</strong> "This item is not available" error
        </p>
        <p>
          <strong>Solution:</strong>
        </p>
        <ul>
          <li>Test on real device (not emulator)</li>
          <li>Download app from Play Store test track</li>
          <li>Use test account added to license testing</li>
          <li>Clear Play Store cache and data</li>
        </ul>

        <h3 id="subscription-issues" className="anchor-heading">
          Subscription Issues
          <a href="#subscription-issues" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          <strong>Problem:</strong> Subscriptions not appearing
        </p>
        <p>
          <strong>Solution:</strong>
        </p>
        <ul>
          <li>Query subscriptions separately with type: 'subs'</li>
          <li>Ensure subscription is fully configured with base plans</li>
          <li>Check if country/region pricing is set</li>
          <li>Verify subscription benefits are added</li>
        </ul>
      </section>

      <section>
        <h2 id="production-checklist" className="anchor-heading">
          Production Checklist
          <a href="#production-checklist" className="anchor-link">
            #
          </a>
        </h2>
        <ul>
          <li>✅ Server-side receipt validation implemented</li>
          <li>✅ Purchase acknowledgment within 3 days</li>
          <li>✅ Proper error handling for all purchase states</li>
          <li>✅ Restore purchases functionality</li>
          <li>✅ Network error retry logic</li>
          <li>✅ Obfuscated user/profile IDs for fraud prevention</li>
          <li>✅ Analytics tracking for purchase events</li>
          <li>✅ Clear purchase flow UI/UX</li>
          <li>✅ Refund handling process</li>
          <li>✅ Subscription management UI (if applicable)</li>
        </ul>
      </section>

      <section>
        <h2 id="best-practices" className="anchor-heading">
          Best Practices
          <a href="#best-practices" className="anchor-link">
            #
          </a>
        </h2>
        <ul>
          <li>
            Always validate purchases server-side using Google Play Developer
            API
          </li>
          <li>Implement exponential backoff for network retries</li>
          <li>Cache product information locally for offline display</li>
          <li>Show clear pricing and subscription terms</li>
          <li>Handle grace periods for subscription billing issues</li>
          <li>Implement proper subscription upgrade/downgrade flows</li>
          <li>Test thoroughly with different Google accounts</li>
          <li>Monitor purchase metrics in Play Console</li>
        </ul>
      </section>
    </div>
  );
}

export default AndroidSetup;
