import AnchorLink from '../../../components/AnchorLink';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function Testing() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Testing & Sandbox"
        description="How to test in-app purchases on iOS and Android using sandbox accounts, StoreKit testing, license testers, and more."
        path="/docs/guides/testing"
        keywords="IAP testing, sandbox, StoreKit testing, license tester, Google Play test, in-app purchase testing, test purchases"
      />
      <h1>Testing & Sandbox</h1>
      <p>
        In-app purchases require specific setup for testing on each platform.
        This guide covers sandbox environments, common pitfalls, and
        framework-specific notes to help you test effectively.
      </p>

      <section>
        <AnchorLink id="ios-testing" level="h2">
          iOS Testing
        </AnchorLink>

        <AnchorLink id="sandbox-apple-account" level="h3">
          Sandbox Apple Account
        </AnchorLink>
        <p>
          Apple provides sandbox accounts for testing purchases without real
          charges. To configure a sandbox account on your device:
        </p>
        <ol>
          <li>
            Create sandbox testers in{' '}
            <a
              href="https://appstoreconnect.apple.com/access/users/sandbox"
              target="_blank"
              rel="noopener noreferrer"
            >
              App Store Connect &rarr; Users and Access &rarr; Sandbox Testers
            </a>
          </li>
          <li>
            On your device, go to <strong>Settings &rarr; App Store &rarr; Sandbox Account</strong>{' '}
            (iOS 14+) and sign in with the sandbox Apple ID
          </li>
          <li>Run your app — purchases will use the sandbox environment</li>
        </ol>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Reference:{' '}
          <a
            href="https://developer.apple.com/documentation/storekit/in-app_purchase/testing_in-app_purchases_with_sandbox"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple: Testing in-app purchases with sandbox
          </a>
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
          <strong>Warning:</strong> Never use your personal Apple ID as a
          sandbox account. Always create dedicated sandbox tester accounts in
          App Store Connect.
        </div>

        <AnchorLink id="storekit-testing-xcode" level="h3">
          StoreKit Testing in Xcode
        </AnchorLink>
        <p>
          Xcode provides local StoreKit testing that works without a network
          connection or sandbox account. This is the fastest way to iterate on
          your purchase logic:
        </p>
        <ol>
          <li>
            Create a StoreKit Configuration file in Xcode (File &rarr; New &rarr;
            File &rarr; StoreKit Configuration File)
          </li>
          <li>Define your products and subscriptions in the configuration</li>
          <li>
            Edit your scheme (Product &rarr; Scheme &rarr; Edit Scheme) and set
            the StoreKit Configuration under the Options tab
          </li>
          <li>
            Run the app in the simulator or on device — purchases use the local
            configuration
          </li>
        </ol>
        <p>
          Local StoreKit testing also lets you simulate scenarios like
          subscription renewal, refunds, ask-to-buy, and interrupted purchases
          via the StoreKit Transaction Manager in Xcode.
        </p>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Reference:{' '}
          <a
            href="https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple: Setting up StoreKit testing in Xcode
          </a>
        </p>

        <AnchorLink id="testflight-testing" level="h3">
          TestFlight Testing
        </AnchorLink>
        <p>
          TestFlight builds use the sandbox environment automatically. Testers
          do not need a separate sandbox account — purchases made in TestFlight
          are not charged. This is the closest test environment to production.
        </p>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Reference:{' '}
          <a
            href="https://developer.apple.com/testflight/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple: TestFlight
          </a>
        </p>

        <AnchorLink id="clear-sandbox-purchases-ios" level="h3">
          Clearing Sandbox Purchase History
        </AnchorLink>
        <p>
          To reset sandbox purchase history on iOS:
        </p>
        <ol>
          <li>
            Go to <strong>Settings &rarr; App Store &rarr; Sandbox Account</strong>
          </li>
          <li>Tap your sandbox account</li>
          <li>
            Select <strong>Manage</strong> and clear purchase history for
            specific apps
          </li>
        </ol>
        <p>
          Alternatively, create a new sandbox tester account in App Store
          Connect for a completely fresh state.
        </p>
      </section>

      <section>
        <AnchorLink id="android-testing" level="h2">
          Android Testing
        </AnchorLink>

        <AnchorLink id="license-testers" level="h3">
          License Testers
        </AnchorLink>
        <p>
          License testers can make test purchases without being charged. To set
          them up:
        </p>
        <ol>
          <li>
            Open{' '}
            <a
              href="https://play.google.com/console"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Play Console
            </a>{' '}
            &rarr; Settings &rarr; License testing
          </li>
          <li>
            Add the Gmail addresses of your testers
          </li>
          <li>
            Set the license response to <strong>RESPOND_NORMALLY</strong>
          </li>
        </ol>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Reference:{' '}
          <a
            href="https://developer.android.com/google/play/billing/test"
            target="_blank"
            rel="noopener noreferrer"
          >
            Android: Test your Google Play Billing integration
          </a>
        </p>

        <AnchorLink id="internal-testing-track" level="h3">
          Internal Testing Track
        </AnchorLink>
        <p>
          Upload your APK or AAB to an internal testing track in{' '}
          <a
            href="https://play.google.com/console"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Play Console
          </a>
          . This gives you a test link that testers can use to install
          the app. The app must be installed from the Play Store (not sideloaded)
          for billing to work properly.
        </p>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Reference:{' '}
          <a
            href="https://support.google.com/googleplay/android-developer/answer/9845334"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google: Set up internal testing
          </a>
        </p>

        <AnchorLink id="test-card-numbers" level="h3">
          Test Card Numbers
        </AnchorLink>
        <p>
          When testing with license tester accounts, Google Play provides
          special test instruments:
        </p>
        <ul>
          <li>
            <strong>Test card, always approves</strong> — Purchase completes
            successfully
          </li>
          <li>
            <strong>Test card, always declines</strong> — Purchase is rejected
          </li>
          <li>
            <strong>Test card, slow</strong> — Simulates a slow network
            response
          </li>
        </ul>
        <p>
          These appear automatically in the payment sheet when a license tester
          initiates a purchase.
        </p>

        <AnchorLink id="clear-test-purchases-android" level="h3">
          Clearing Test Purchases
        </AnchorLink>
        <p>
          To clear test purchases on Android:
        </p>
        <ul>
          <li>
            Consumable products are automatically consumed when purchased by
            license testers (after 3 minutes if not consumed by the app)
          </li>
          <li>
            For subscriptions, cancel them in the Google Play app or wait for
            the short test renewal period to expire
          </li>
          <li>
            You can also refund or revoke purchases in the{' '}
            <strong>Google Play Console &rarr; Order management</strong>
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="common-issues" level="h2">
          Common Issues
        </AnchorLink>

        <AnchorLink id="products-not-found" level="h3">
          Products Not Found
        </AnchorLink>
        <p>
          If <code>fetchProducts</code> returns an empty list, check the
          following:
        </p>
        <ul>
          <li>
            <strong>Agreements:</strong> Ensure all paid app agreements are
            signed in App Store Connect / Google Play Console
          </li>
          <li>
            <strong>Banking & Tax:</strong> Complete your banking and tax
            information in the respective console
          </li>
          <li>
            <strong>Bundle ID:</strong> The app's bundle identifier must
            exactly match what is configured in the store
          </li>
          <li>
            <strong>Product IDs:</strong> Verify product identifiers match
            exactly (case-sensitive)
          </li>
          <li>
            <strong>Product Status:</strong> Products must be in "Ready to
            Submit" or "Approved" state (iOS) or "Active" state (Android)
          </li>
          <li>
            <strong>Wait time:</strong> New products can take several hours to
            propagate — up to 24 hours in some cases
          </li>
        </ul>

        <AnchorLink id="purchase-not-completing" level="h3">
          Purchase Not Completing
        </AnchorLink>
        <p>
          If a purchase starts but never completes or stays in a pending state:
        </p>
        <ul>
          <li>
            Ensure you are calling <code>finishTransaction</code> after
            processing the purchase. Unfinished transactions block future
            purchases.
          </li>
          <li>
            Check that your purchase listener is properly set up before
            initiating the purchase
          </li>
          <li>
            On Android, verify the app is signed correctly and installed from
            the Play Store test track
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
          <strong>Warning:</strong> Failing to call <code>finishTransaction</code>{' '}
          is the most common cause of purchase issues. Always finish
          transactions after delivering content, even if verification fails.
        </div>

        <AnchorLink id="connection-failed" level="h3">
          Connection Failed
        </AnchorLink>
        <p>
          If you receive connection errors when trying to fetch products or
          make purchases:
        </p>
        <ul>
          <li>
            Ensure <code>initConnection</code> is called before any other IAP
            operations
          </li>
          <li>
            On Android, the Google Play Billing client may fail to connect if
            the Play Store app is outdated or the device does not have Google
            Play Services
          </li>
          <li>
            On iOS, verify the device has network access and is signed in with
            a valid (sandbox or production) Apple ID
          </li>
          <li>
            Always call <code>endConnection</code> when the app is closing or
            the IAP context is being torn down
          </li>
        </ul>

        <AnchorLink id="sandbox-vs-production" level="h3">
          Sandbox vs Production Differences
        </AnchorLink>
        <ul>
          <li>
            <strong>iOS:</strong> Sandbox subscriptions renew at an accelerated
            rate (e.g., monthly subscription renews every 5 minutes). Production
            subscriptions renew at their normal interval.
          </li>
          <li>
            <strong>Android:</strong> Test subscriptions have a shortened
            renewal period (default 5 minutes). The billing flow UI shows "Test
            card" options for license testers.
          </li>
          <li>
            Receipt/purchase token formats may differ between sandbox and
            production — do not hard-code assumptions about their structure
          </li>
        </ul>

        <h4>iOS Sandbox Subscription Renewal Rates</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '1rem 0' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Production</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Sandbox</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['1 week', '3 minutes'],
              ['1 month', '5 minutes'],
              ['2 months', '10 minutes'],
              ['3 months', '15 minutes'],
              ['6 months', '30 minutes'],
              ['1 year', '1 hour'],
            ].map(([prod, sandbox]) => (
              <tr key={prod} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.5rem' }}>{prod}</td>
                <td style={{ padding: '0.5rem' }}>{sandbox}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          References:{' '}
          <a
            href="https://developer.apple.com/documentation/storekit/in-app_purchase/testing_in-app_purchases_with_sandbox"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple: Sandbox testing
          </a>
          {' | '}
          <a
            href="https://developer.android.com/google/play/billing/test#subs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Android: Test subscriptions
          </a>
        </p>
      </section>

      <section>
        <AnchorLink id="framework-specific-notes" level="h2">
          Framework-Specific Testing Notes
        </AnchorLink>

        <AnchorLink id="react-native-expo-testing" level="h3">
          React Native / Expo
        </AnchorLink>
        <ul>
          <li>
            IAP must be tested on a <strong>real device</strong>. The iOS
            simulator has limited StoreKit functionality and Android emulators
            require a Google Play Store image.
          </li>
          <li>
            For React Native CLI:{' '}
            <code>cd libraries/react-native-iap/example && yarn ios</code> (or{' '}
            <code>yarn android</code>)
          </li>
          <li>
            For Expo: use a development build (
            <code>npx expo run:ios</code>) — Expo Go does not support native
            modules like IAP
          </li>
        </ul>

        <AnchorLink id="flutter-testing" level="h3">
          Flutter
        </AnchorLink>
        <ul>
          <li>
            Run <code>flutter run</code> on a connected real device for the
            best testing experience
          </li>
          <li>
            The iOS simulator supports basic StoreKit testing with a local
            configuration file, but real-device testing is recommended
          </li>
          <li>
            On Android, ensure the device or emulator has the Play Store
            installed
          </li>
        </ul>

        <AnchorLink id="godot-testing" level="h3">
          Godot
        </AnchorLink>
        <ul>
          <li>
            In-app purchases <strong>cannot be tested in the Godot editor</strong>.
            You must export the project to a real device.
          </li>
          <li>
            For Android: export an APK, sign it, and upload to an internal
            testing track
          </li>
          <li>
            For iOS: export via Xcode and run on a physical device with a
            sandbox account
          </li>
        </ul>

        <AnchorLink id="kmp-testing" level="h3">
          Kotlin Multiplatform
        </AnchorLink>
        <ul>
          <li>
            <strong>Android:</strong> Use an emulator with a Google Play Store
            image (e.g., "Google APIs" system image) or a real device. Build
            with Gradle: <code>./gradlew :composeApp:assembleDebug</code>
          </li>
          <li>
            <strong>iOS:</strong> Open the <code>iosApp/</code> directory in
            Xcode and run on a physical device. The simulator supports local
            StoreKit testing only.
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="references" level="h2">
          References
        </AnchorLink>
        <h4>Apple</h4>
        <ul>
          <li>
            <a
              href="https://developer.apple.com/in-app-purchase/"
              target="_blank"
              rel="noopener noreferrer"
            >
              In-App Purchase Overview
            </a>
          </li>
          <li>
            <a
              href="https://developer.apple.com/documentation/storekit/in-app_purchase/testing_in-app_purchases_with_sandbox"
              target="_blank"
              rel="noopener noreferrer"
            >
              Testing with Sandbox
            </a>
          </li>
          <li>
            <a
              href="https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode"
              target="_blank"
              rel="noopener noreferrer"
            >
              StoreKit Testing in Xcode
            </a>
          </li>
          <li>
            <a
              href="https://developer.apple.com/documentation/storekit"
              target="_blank"
              rel="noopener noreferrer"
            >
              StoreKit 2 Documentation
            </a>
          </li>
          <li>
            <a
              href="https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-a-subscription-group"
              target="_blank"
              rel="noopener noreferrer"
            >
              Setting Up Subscription Groups
            </a>
          </li>
        </ul>

        <h4>Google</h4>
        <ul>
          <li>
            <a
              href="https://developer.android.com/google/play/billing"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Play Billing Overview
            </a>
          </li>
          <li>
            <a
              href="https://developer.android.com/google/play/billing/test"
              target="_blank"
              rel="noopener noreferrer"
            >
              Test Your Billing Integration
            </a>
          </li>
          <li>
            <a
              href="https://support.google.com/googleplay/android-developer/answer/9845334"
              target="_blank"
              rel="noopener noreferrer"
            >
              Set Up Internal Testing
            </a>
          </li>
          <li>
            <a
              href="https://developer.android.com/google/play/billing/integrate"
              target="_blank"
              rel="noopener noreferrer"
            >
              Integrate the Google Play Billing Library
            </a>
          </li>
          <li>
            <a
              href="https://developer.android.com/google/play/billing/subs"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Play Subscriptions
            </a>
          </li>
        </ul>

        <h4>OpenIAP</h4>
        <ul>
          <li>
            <a href="/docs/ios-setup">iOS Store Configuration</a>
          </li>
          <li>
            <a href="/docs/android-setup">Android Store Configuration</a>
          </li>
          <li>
            <a href="/docs/errors">Error Codes Reference</a>
          </li>
          <li>
            <a href="/docs/features/purchase">Purchase Flow Guide</a>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default Testing;
