import { Link } from 'react-router-dom';
import Callout from '../../../components/Callout';
import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';
import { ANDROID_SDK, GOOGLE_PLAY_BILLING } from '../../../lib/versioning';

function ReactNativeSetup() {
  return (
    <div className="doc-page">
      <SEO
        title="React Native Setup"
        description="Install and configure react-native-iap for in-app purchases in React Native apps with StoreKit 2 and Google Play Billing."
        path="/docs/setup/react-native"
        keywords="react-native-iap, React Native IAP, in-app purchase, StoreKit 2, Google Play Billing, useIAP"
      />
      <h1>React Native Setup</h1>
      <p>
        <code>react-native-iap</code> provides in-app purchase support for React
        Native apps using Nitro Modules, a high-performance native bridging
        layer for React Native. It supports StoreKit 2 on iOS and Google Play
        Billing {GOOGLE_PLAY_BILLING.version}+ on Android by default, with
        optional build flavors for{' '}
        <a href="/docs/setup/store/horizon">Horizon OS</a> (Meta Quest) and{' '}
        <a href="/docs/setup/store/amazon">Fire OS</a> (Amazon Appstore).
      </p>

      <p>
        react-native-iap v15+ is for <strong>bare React Native CLI</strong>{' '}
        projects only and requires <strong>React Native 0.79+</strong> (Nitro
        Modules), <strong>iOS 15.0+</strong> (StoreKit 2), and{' '}
        <strong>Android minSdkVersion {ANDROID_SDK.minSdk}+</strong> with{' '}
        <strong>compileSdkVersion {ANDROID_SDK.compileSdk}+</strong>. Expo
        support ended in v15.0.0 — use <a href="/docs/setup/expo">expo-iap</a>{' '}
        instead; it provides the same API on Expo Modules.
      </p>

      <Callout kind="important" title="Before you start">
        Complete the store configuration before integrating with your framework:{' '}
        <a href="/docs/ios-setup">iOS Setup</a> |{' '}
        <a href="/docs/android-setup">Android Setup</a>
      </Callout>

      <section>
        <h2 id="installation" className="anchor-heading">
          Installation
          <a href="#installation" className="anchor-link">
            #
          </a>
        </h2>

        <p>
          react-native-iap requires <code>react-native-nitro-modules</code> as a
          peer dependency — install both together.
        </p>

        <CodeBlock language="bash">
          {`# Using yarn (recommended)
yarn add react-native-iap react-native-nitro-modules

# Using npm
npm install react-native-iap react-native-nitro-modules`}
        </CodeBlock>

        <h3 id="nitro-modules" className="anchor-heading">
          Nitro Modules (v15+)
          <a href="#nitro-modules" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          react-native-iap v15+ is built on{' '}
          <a
            href="https://github.com/mrousavy/nitro"
            target="_blank"
            rel="noopener noreferrer"
          >
            Nitro Modules
          </a>{' '}
          for high-performance native bridging. Key points:
        </p>
        <ul>
          <li>
            Requires <strong>React Native 0.79+</strong> — Nitro relies on the
            new native module architecture
          </li>
          <li>
            Native modules are <strong>automatically linked</strong> during your
            app's build process
          </li>
        </ul>
        <p>
          If you hit Swift 6 C++ interop errors in Nitro, see{' '}
          <a href="#troubleshooting">Troubleshooting</a> for the Swift 5
          language mode workaround.
        </p>

        <h3 id="ios-setup" className="anchor-heading">
          iOS
          <a href="#ios-setup" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>
            Install CocoaPods:
            <CodeBlock language="bash">
              {`cd ios && bundle exec pod install`}
            </CodeBlock>
          </li>
          <li>
            Enable In-App Purchase capability in Xcode: Target &gt;{' '}
            <strong>Signing &amp; Capabilities</strong> &gt;{' '}
            <strong>+ Capability</strong> &gt; <strong>In-App Purchase</strong>
          </li>
          <li>
            When linking with the iOS 27 SDK, migrate older React Native host
            templates from an AppDelegate-owned <code>UIWindow</code> to a{' '}
            <code>UIWindowSceneDelegate</code>. See the{' '}
            <Link to="/docs/ios-setup#xcode-27-scene-lifecycle">
              Xcode 27 UIScene checklist
            </Link>
            .
          </li>
        </ul>

        <h3 id="android-setup" className="anchor-heading">
          Android
          <a href="#android-setup" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>No additional native configuration needed</li>
          <li>
            Uses Google Play Billing {GOOGLE_PLAY_BILLING.version}+ with
            automatic service reconnection
          </li>
          <li>
            Store-specific Android targets —{' '}
            <a href="/docs/setup/store/horizon">Horizon OS</a> (Meta Quest) and{' '}
            <a href="/docs/setup/store/amazon">Fire OS</a> (Amazon Appstore) —
            ship as separate build flavors. Complete the setup on this page
            first, then follow <a href="/docs/setup/store">Store Setup</a> for
            target-specific Gradle, manifest, and runtime details. Vega OS is
            not an Android flavor — see <a href="#vega-os">Vega OS</a> below.
          </li>
        </ul>

        <h3 id="vega-os" className="anchor-heading">
          Vega OS
          <a href="#vega-os" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Vega OS is Amazon's newer, non-Android operating system; its apps run
          on the Kepler runtime. react-native-iap supports it through a separate
          React Native for Vega target — it is not an Android build flavor, and
          unlike expo-iap there is no config plugin to enable it. Keep the
          Amazon Kepler packages in that Vega-only target so regular iOS and
          Android builds are unaffected, and follow{' '}
          <a href="/docs/setup/store/amazon">Amazon Store Setup</a> for package,
          manifest, and supported-version details.
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
          Under the hood, the typical flow is{' '}
          <a href="/docs/apis/init-connection">
            <code>initConnection</code>
          </a>{' '}
          → set up{' '}
          <a href="/docs/events/purchase-updated-listener">
            <code>purchaseUpdatedListener</code>
          </a>{' '}
          and{' '}
          <a href="/docs/events/purchase-error-listener">
            <code>purchaseErrorListener</code>
          </a>{' '}
          →{' '}
          <a href="/docs/apis/fetch-products">
            <code>fetchProducts</code>
          </a>{' '}
          →{' '}
          <a href="/docs/apis/request-purchase">
            <code>requestPurchase</code>
          </a>{' '}
          →{' '}
          <a href="/docs/apis/finish-transaction">
            <code>finishTransaction</code>
          </a>
          , with{' '}
          <a href="/docs/apis/end-connection">
            <code>endConnection</code>
          </a>{' '}
          on teardown. The <code>useIAP</code> hook manages the connection and
          listener steps for you. See the{' '}
          <a href="/docs/features/purchase">Purchase Guide</a> for the complete
          flow.
        </p>

        <h3 id="useIAP-hook" className="anchor-heading">
          useIAP Hook (Recommended)
          <a href="#useIAP-hook" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          The <code>useIAP</code> hook is the recommended way to use
          react-native-iap. It manages connection lifecycle, state, and error
          normalization automatically.
        </p>
        <CodeBlock language="typescript">
          {`import React, { useEffect } from 'react';
import { Alert, Button, FlatList } from 'react-native';
import { useIAP, ErrorCode, finishTransaction } from 'react-native-iap';

function Store() {
  const {
    connected,
    products,
    fetchProducts,
    requestPurchase,
  } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      // 1. Validate receipt with your backend or IAPKit
      // 2. Grant entitlement
      // 3. CRITICAL: Finish the transaction
      //    (Android auto-refunds after 3 days if not called!)
      await finishTransaction({ purchase, isConsumable: false }); // true for consumables
    },
    onPurchaseError: (error) => {
      if (error.code === ErrorCode.UserCancelled) return;
      Alert.alert('Purchase Failed', error.message);
    },
  });

  useEffect(() => {
    if (!connected) return;
    void fetchProducts({ skus: ['premium', 'coins_100'] }).catch((error) => {
      console.warn('Product fetch failed:', error);
    });
  }, [connected, fetchProducts]);

  return (
    <FlatList
      data={products}
      keyExtractor={(product) => product.id}
      renderItem={({ item }) => (
        <Button
          title={\`\${item.title} - \${item.displayPrice}\`}
          disabled={!connected}
          onPress={() =>
            requestPurchase({
              request: {
                apple: { sku: item.id },
                google: { skus: [item.id] },
              },
              type: 'in-app',
            })
          }
        />
      )}
    />
  );
}`}
        </CodeBlock>

        <p>
          Each call here has a full reference — see{' '}
          <a href="/docs/apis/fetch-products">
            <code>fetchProducts</code>
          </a>
          ,{' '}
          <a href="/docs/apis/request-purchase">
            <code>requestPurchase</code>
          </a>
          , and{' '}
          <a href="/docs/apis/finish-transaction">
            <code>finishTransaction</code>
          </a>{' '}
          for parameters and per-store behavior, and{' '}
          <a href="/docs/errors">
            <code>ErrorCode</code>
          </a>{' '}
          for the full error reference.
        </p>

        <Callout kind="warning" title="Critical">
          Always call <code>finishTransaction</code> after verifying a purchase.
          On Android, unfinished purchases are automatically refunded after 3
          days.
        </Callout>

        <p>
          Most <code>useIAP</code> methods return{' '}
          <code>Promise&lt;void&gt;</code> and update internal state — use the{' '}
          <code>onPurchaseSuccess</code> callback to receive purchase results,
          not the return value of <code>requestPurchase</code>.
        </p>

        <h3 id="hook-state" className="anchor-heading">
          Hook State
          <a href="#hook-state" className="anchor-link">
            #
          </a>
        </h3>
        <p>After calling methods, consume state from the hook:</p>
        <ul>
          <li>
            <code>products</code> (<a href="/docs/types/product">Product</a>[])
            — Populated after{' '}
            <Link to="/docs/apis/fetch-products">
              <code>fetchProducts()</code>
            </Link>
          </li>
          <li>
            <code>subscriptions</code> (
            <a href="/docs/types/subscription-product">ProductSubscription</a>
            []) — Populated after fetching with type <code>'subs'</code>
          </li>
          <li>
            <code>availablePurchases</code> (
            <a href="/docs/types/purchase">Purchase</a>[]) — Populated after{' '}
            <Link to="/docs/apis/get-available-purchases">
              <code>getAvailablePurchases()</code>
            </Link>
          </li>
          <li>
            <code>activeSubscriptions</code> (
            <a href="/docs/types/active-subscription">ActiveSubscription</a>[])
            — Populated after{' '}
            <Link to="/docs/apis/get-active-subscriptions">
              <code>getActiveSubscriptions()</code>
            </Link>
            .
          </li>
        </ul>

        <h3 id="root-api" className="anchor-heading">
          Root API (Advanced)
          <a href="#root-api" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          For advanced use cases without React state management, you can use the
          root API directly with event listeners:
        </p>
        <CodeBlock language="typescript">
          {`import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  ErrorCode,
} from 'react-native-iap';

// Initialize
await initConnection();

// Listen for events BEFORE requesting purchases
const purchaseSub = purchaseUpdatedListener(async (purchase) => {
  // Validate on server, then finish transaction
  // CRITICAL: Android auto-refunds after 3 days if not called!
  await finishTransaction({ purchase, isConsumable: false }); // true for consumables
});

const errorSub = purchaseErrorListener((error) => {
  if (error.code === ErrorCode.UserCancelled) return;
  console.error(error.message);
});

// Fetch and purchase
const products = await fetchProducts({ skus: ['premium'] });
await requestPurchase({
  request: {
    apple: { sku: 'premium' },
    google: { skus: ['premium'] },
  },
  type: 'in-app',
});

// Cleanup on unmount
purchaseSub.remove();
errorSub.remove();
await endConnection();`}
        </CodeBlock>
        <p>
          Each call here has a full reference — see{' '}
          <a href="/docs/apis/init-connection">
            <code>initConnection</code>
          </a>
          ,{' '}
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
          , and{' '}
          <a href="/docs/apis/end-connection">
            <code>endConnection</code>
          </a>{' '}
          for parameters and per-store behavior, and{' '}
          <a href="/docs/events/purchase-updated-listener">
            <code>purchaseUpdatedListener</code>
          </a>{' '}
          and{' '}
          <a href="/docs/events/purchase-error-listener">
            <code>purchaseErrorListener</code>
          </a>{' '}
          for the purchase events.
        </p>
      </section>

      <section>
        <h2 id="error-handling" className="anchor-heading">
          Error Handling
          <a href="#error-handling" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          Errors are automatically normalized to the{' '}
          <Link to="/docs/errors">
            <code>ErrorCode</code>
          </Link>{' '}
          enum. Use the provided helper functions:
        </p>
        <CodeBlock language="typescript">
          {`import {
  ErrorCode,
  isUserCancelledError,
  getUserFriendlyErrorMessage,
} from 'react-native-iap';

// In useIAP onPurchaseError callback:
if (isUserCancelledError(error)) return;

const message = getUserFriendlyErrorMessage(error);
Alert.alert('Error', message);

// Or use switch for specific handling:
switch (error.code) {
  case ErrorCode.NetworkError:
    showRetryDialog();
    break;
  case ErrorCode.ItemUnavailable:
    showUnavailableMessage();
    break;
}`}
        </CodeBlock>
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
        <h3>Build errors</h3>
        <ul>
          <li>
            iOS: Run <code>cd ios &amp;&amp; bundle exec pod install</code>
          </li>
          <li>
            Android: Ensure{' '}
            <code>compileSdkVersion {ANDROID_SDK.compileSdk}+</code> in{' '}
            <code>android/build.gradle</code>
          </li>
          <li>
            Metro bundler issues: <code>yarn start --reset-cache</code>
          </li>
        </ul>

        <h3>
          Folly coroutine error (<code>'folly/coro/Coroutine.h' not found</code>
          )
        </h3>
        <p>
          If your iOS build fails with{' '}
          <code>'folly/coro/Coroutine.h' file not found</code> from{' '}
          <code>RCT-Folly/folly/Expected.h</code>, add these defines to your{' '}
          <code>Podfile</code> post_install block:
        </p>
        <CodeBlock language="text">
          {`post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_NO_CONFIG=1'
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_CFG_NO_COROUTINES=1'
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_HAS_COROUTINES=0'
    end
  end
end`}
        </CodeBlock>

        <h3>Swift 6 C++ interop errors (Nitro)</h3>
        <p>
          If you see errors in <code>AnyMap.swift</code> related to{' '}
          <code>cppPart.pointee</code>, switch the <code>NitroModules</code> pod
          to the Swift 5 language mode (<code>SWIFT_VERSION = '5.0'</code>) as a
          temporary workaround:
        </p>
        <CodeBlock language="text">
          {`# ios/Podfile - add inside post_install block
post_install do |installer|
  installer.pods_project.targets.each do |target|
    if target.name == 'NitroModules'
      target.build_configurations.each do |config|
        config.build_settings['SWIFT_VERSION'] = '5.0'
      end
    end
  end
end`}
        </CodeBlock>

        <Callout kind="tip" title="Recommended path">
          Upgrade to RN 0.79+, update <code>react-native-nitro-modules</code>{' '}
          and <code>nitro-codegen</code> to latest, then{' '}
          <code>pod install</code> and do a clean build. If issues persist,
          share a minimal repro (<code>package.json</code> +{' '}
          <code>Podfile</code>) on{' '}
          <a
            href="https://github.com/hyodotdev/openiap/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub Issues
          </a>
          .
        </Callout>
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
            <a href="/docs/setup/store">Store Setup</a> — targeting alternative
            stores such as <a href="/docs/setup/store/horizon">Horizon OS</a>{' '}
            (Meta Quest headsets) and{' '}
            <a href="/docs/setup/store/amazon">Fire OS / Vega OS</a> (Amazon
            Appstore)
          </li>
          <li>
            <a
              href="https://www.npmjs.com/package/react-native-iap"
              target="_blank"
              rel="noopener noreferrer"
            >
              npm: react-native-iap
            </a>
            {' | '}
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/libraries/react-native-iap"
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

export default ReactNativeSetup;
