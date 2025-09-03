function IOSSetup() {
  return (
    <div className="doc-page">
      <h1>iOS Setup Guide</h1>
      <p>
        Setting up in-app purchases for iOS requires configuration in both Xcode
        and App Store Connect.
      </p>

      <section>
        <h2 id="prerequisites" className="anchor-heading">
          Prerequisites
          <a href="#prerequisites" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          Before you can successfully implement and test in-app purchases, you
          must complete these essential steps in App Store Connect:
        </p>

        <h3 id="sign-agreements" className="anchor-heading">
          1. Sign All Agreements
          <a href="#sign-agreements" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>Sign in to App Store Connect</li>
          <li>Navigate to Business section</li>
          <li>
            <strong>Sign ALL pending agreements - This is crucial!</strong>
          </li>
          <li>
            If agreements are not signed, products won't appear in your app
          </li>
        </ul>

        <h3 id="banking-legal-tax" className="anchor-heading">
          2. Complete Banking, Legal, and Tax Information
          <a href="#banking-legal-tax" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>Go to Business → Banking</li>
          <li>Fill out ALL required banking information</li>
          <li>Complete ALL legal and tax forms</li>
          <li>Wait for Apple's approval - This can take several days</li>
          <li>
            Products will not be available until Apple approves all information
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
          <strong>⚠️ Important:</strong> These prerequisites are often
          overlooked but are absolutely essential. Without completing these
          steps, your products will not be found, even if everything else is
          configured correctly.
        </div>
      </section>

      <section>
        <h2 id="app-store-connect" className="anchor-heading">
          App Store Connect Configuration
          <a href="#app-store-connect" className="anchor-link">
            #
          </a>
        </h2>

        <h3 id="create-app-record" className="anchor-heading">
          1. Create Your App Record
          <a href="#create-app-record" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>Sign in to App Store Connect</li>
          <li>Navigate to "My Apps"</li>
          <li>Create a new app or select your existing app</li>
          <li>Fill in the required app information</li>
        </ul>

        <h3 id="create-products" className="anchor-heading">
          2. Create In-App Purchase Products
          <a href="#create-products" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>In your app's page, go to Features → In-App Purchases</li>
          <li>Click the + button to create a new product</li>
          <li>
            Choose your product type:
            <ul>
              <li>
                <strong>Consumable:</strong> Can be purchased multiple times
                (coins, lives, etc.)
              </li>
              <li>
                <strong>Non-Consumable:</strong> One-time purchase (premium
                features)
              </li>
              <li>
                <strong>Auto-Renewable Subscription:</strong> Recurring
                subscription
              </li>
              <li>
                <strong>Non-Renewable Subscription:</strong> Time-limited
                subscription
              </li>
            </ul>
          </li>
        </ul>

        <h3 id="configure-products" className="anchor-heading">
          3. Configure Product Details
          <a href="#configure-products" className="anchor-link">
            #
          </a>
        </h3>
        <p>For each product, provide:</p>
        <ul>
          <li>
            <strong>Product ID:</strong> Unique identifier (e.g.,
            com.yourapp.premium)
          </li>
          <li>
            <strong>Reference Name:</strong> Internal name for your team
          </li>
          <li>
            <strong>Pricing:</strong> Select price tier or custom pricing
          </li>
          <li>
            <strong>Display Name:</strong> Name shown to users
          </li>
          <li>
            <strong>Description:</strong> Product description for users
          </li>
        </ul>

        <h3 id="submit-review" className="anchor-heading">
          4. Submit for Review
          <a href="#submit-review" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>Add product screenshot (1024x1024px)</li>
          <li>Submit for review (first-time products need approval)</li>
        </ul>
      </section>

      <section>
        <h2 id="xcode-configuration" className="anchor-heading">
          Xcode Configuration
          <a href="#xcode-configuration" className="anchor-link">
            #
          </a>
        </h2>

        <div
          style={{
            padding: '1rem',
            background: 'rgba(164, 116, 101, 0.1)',
            borderLeft: '4px solid var(--primary-color)',
            borderRadius: '0.5rem',
            margin: '1rem 0',
          }}
        >
          <strong>💡 Xcode Version Requirement:</strong> Use Xcode 16.4 or later
          to avoid known issues with in-app purchases. Earlier versions may
          cause problems like duplicate purchase events.
        </div>

        <h3 id="enable-iap-capability" className="anchor-heading">
          1. Enable In-App Purchase Capability
          <a href="#enable-iap-capability" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>Open your project in Xcode</li>
          <li>Select your app target</li>
          <li>Go to Signing & Capabilities</li>
          <li>Click + Capability</li>
          <li>Add In-App Purchase</li>
        </ul>

        <h3 id="configure-bundle-id" className="anchor-heading">
          2. Configure Bundle Identifier
          <a href="#configure-bundle-id" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Ensure your bundle identifier in Xcode matches the one in App Store
          Connect:
        </p>
        <ul>
          <li>Select your target</li>
          <li>Go to General tab</li>
          <li>Verify Bundle Identifier matches App Store Connect</li>
        </ul>

        <h3 id="code-signing" className="anchor-heading">
          3. Code Signing
          <a href="#code-signing" className="anchor-link">
            #
          </a>
        </h3>
        <p>Make sure you have proper code signing set up:</p>
        <ul>
          <li>Go to Signing & Capabilities</li>
          <li>Select your development team</li>
          <li>Choose appropriate provisioning profile</li>
        </ul>
      </section>

      <section>
        <h2 id="testing-setup" className="anchor-heading">
          Testing Setup
          <a href="#testing-setup" className="anchor-link">
            #
          </a>
        </h2>

        <h3 id="create-sandbox-user" className="anchor-heading">
          1. Create Sandbox Test User
          <a href="#create-sandbox-user" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>In App Store Connect, go to Users and Access</li>
          <li>Click Sandbox Testers</li>
          <li>Create a new sandbox test user with a unique email</li>
          <li>
            <strong>Important:</strong> Use a different email than your
            developer account
          </li>
        </ul>

        <h3 id="configure-test-env" className="anchor-heading">
          2. Configure Test Environment
          <a href="#configure-test-env" className="anchor-link">
            #
          </a>
        </h3>
        <p>On your iOS device:</p>
        <ul>
          <li>
            <strong>Important:</strong> You don't need to sign into the App
            Store app with your sandbox account
          </li>
          <li>
            Instead, use the dedicated sandbox login:
            <ul>
              <li>
                Go to Settings → Developer (Developer mode must be enabled)
              </li>
              <li>Tap Sandbox Apple Account</li>
              <li>Sign in with your sandbox test user credentials</li>
            </ul>
          </li>
          <li>Install your app via Xcode or TestFlight</li>
          <li>
            When making a purchase, it will automatically use the sandbox
            account
          </li>
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
          <strong>💡 Note:</strong> This is the recommended approach starting
          from iOS 15+. The old method of signing into the App Store app with
          sandbox credentials is no longer necessary and can cause confusion.
        </div>
      </section>

      <section>
        <h2 id="integration" className="anchor-heading">
          Integration with Open IAP Libraries
          <a href="#integration" className="anchor-link">
            #
          </a>
        </h2>

        <p>
          To implement in-app purchases on iOS, use one of the Open IAP
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
          These libraries implement the Open IAP specification and handle
          iOS-specific requirements.
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
          for implementation details. Each library follows the Open IAP
          specification while handling platform-specific requirements.
        </div>
      </section>

      <section>
        <h2 id="ios-requirements" className="anchor-heading">
          iOS-Specific Requirements
          <a href="#ios-requirements" className="anchor-link">
            #
          </a>
        </h2>

        <h3 id="receipt-validation" className="anchor-heading">
          Receipt Validation
          <a href="#receipt-validation" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          iOS requires receipt validation to verify purchases. StoreKit 2 (iOS
          15+) provides JWS (JSON Web Signature) for enhanced security, while
          older versions use base64-encoded receipts.
        </p>

        <h3 id="transaction-finishing" className="anchor-heading">
          Transaction Finishing
          <a href="#transaction-finishing" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          All transactions must be explicitly finished using{' '}
          <code>finishTransaction()</code> to remove them from the payment
          queue. Unfinished transactions will be re-delivered on app launch.
        </p>

        <h3 id="restore-purchases" className="anchor-heading">
          Restore Purchases
          <a href="#restore-purchases" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          iOS requires apps to provide a "Restore Purchases" button for users to
          recover their non-consumable purchases and active subscriptions on new
          devices.
        </p>

        <h3 id="subscription-management" className="anchor-heading">
          Subscription Management
          <a href="#subscription-management" className="anchor-link">
            #
          </a>
        </h3>
        <p>iOS subscriptions require special handling including:</p>
        <ul>
          <li>Introductory offers and promotional offers</li>
          <li>Grace periods for billing issues</li>
          <li>Subscription groups for upgrade/downgrade</li>
          <li>Family Sharing support (iOS 14+)</li>
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
          <strong>⚠️ Important:</strong> Open IAP libraries handle these
          iOS-specific requirements automatically. Consult the library
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

        <h3 id="products-not-found" className="anchor-heading">
          Product IDs Not Found
          <a href="#products-not-found" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          <strong>Problem:</strong> Products return empty or undefined
        </p>
        <p>
          <strong>Solutions:</strong>
        </p>

        <h4 id="check-prerequisites" className="anchor-heading">
          Check Prerequisites (Most common cause):
          <a href="#check-prerequisites" className="anchor-link">
            #
          </a>
        </h4>
        <ul>
          <li>
            Verify ALL agreements are signed in App Store Connect → Business
          </li>
          <li>
            Ensure ALL banking, legal, and tax information is completed AND
            approved by Apple
          </li>
          <li>These are the most commonly overlooked requirements</li>
        </ul>

        <h4 id="verify-product-config" className="anchor-heading">
          Verify Product Configuration:
          <a href="#verify-product-config" className="anchor-link">
            #
          </a>
        </h4>
        <ul>
          <li>Product IDs match exactly between code and App Store Connect</li>
          <li>Products are in "Ready to Submit" or "Approved" state</li>
          <li>Bundle identifier matches</li>
        </ul>

        <h4 id="use-proper-sandbox" className="anchor-heading">
          Use Proper Sandbox Testing:
          <a href="#use-proper-sandbox" className="anchor-link">
            #
          </a>
        </h4>
        <ul>
          <li>Sign in via Settings → Developer → Sandbox Apple Account</li>
          <li>NOT through the App Store app</li>
        </ul>

        <h3 id="sandbox-issues" className="anchor-heading">
          Sandbox Testing Issues
          <a href="#sandbox-issues" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          <strong>Problem:</strong> "Cannot connect to iTunes Store" error
        </p>
        <p>
          <strong>Solution:</strong>
        </p>
        <ul>
          <li>Use a dedicated sandbox test user</li>
          <li>Sign out of regular App Store account</li>
          <li>Verify internet connection</li>
          <li>Try on a real device (simulator may have issues)</li>
        </ul>

        <h3 id="validation-failures" className="anchor-heading">
          Receipt Validation Failures
          <a href="#validation-failures" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          <strong>Problem:</strong> Receipt validation returns invalid
        </p>
        <p>
          <strong>Solution:</strong>
        </p>
        <ul>
          <li>Check if app is properly signed</li>
          <li>Verify receipt data is not corrupted</li>
          <li>Ensure proper error handling for network issues</li>
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
          <li>Always validate receipts server-side for production apps</li>
          <li>Handle all error cases gracefully</li>
          <li>Test thoroughly with sandbox users</li>
          <li>Cache purchase state to handle app restarts</li>
          <li>Provide restore functionality for non-consumable products</li>
        </ul>
      </section>
    </div>
  );
}

export default IOSSetup;
