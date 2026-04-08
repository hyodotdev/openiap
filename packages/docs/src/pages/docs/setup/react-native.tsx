import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';

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
        Native apps using Nitro Modules. It supports StoreKit 2 on iOS and
        Google Play Billing 8.0+ on Android.
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
        Use this if you're using React Native CLI or bare workflow. If you're
        using Expo, we recommend{' '}
        <a href="/docs/setup/expo">expo-iap</a> instead.
      </div>

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
        <CodeBlock language="typescript">
          {`# Using yarn (recommended - project uses Yarn 3)
yarn add react-native-iap

# Using npm
npm install react-native-iap`}
        </CodeBlock>

        <h3 id="ios-setup" className="anchor-heading">
          iOS
          <a href="#ios-setup" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>
            Requires <strong>iOS 15.0+</strong>
          </li>
          <li>
            Install CocoaPods:
            <CodeBlock language="typescript">
              {`cd ios && bundle exec pod install`}
            </CodeBlock>
          </li>
          <li>
            Enable In-App Purchase capability in Xcode under{' '}
            <strong>Signing &amp; Capabilities</strong>
          </li>
        </ul>

        <h3 id="android-setup" className="anchor-heading">
          Android
          <a href="#android-setup" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>
            Requires <strong>compileSdkVersion 34+</strong>
          </li>
          <li>No additional native configuration needed</li>
          <li>Uses Google Play Billing 8.0+ with automatic service reconnection</li>
        </ul>
      </section>

      <section>
        <h2 id="usage" className="anchor-heading">
          Usage
          <a href="#usage" className="anchor-link">
            #
          </a>
        </h2>

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
import { Alert, FlatList, Button } from 'react-native';
import { useIAP, ErrorCode, finishTransaction } from 'react-native-iap';

function Store() {
  const {
    products,
    fetchProducts,
    requestPurchase,
  } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      // 1. Validate receipt on your server
      // 2. Grant entitlement
      // 3. CRITICAL: Finish the transaction
      //    (Android auto-refunds after 3 days if not called!)
      await finishTransaction(purchase, false); // true for consumables
    },
    onPurchaseError: (error) => {
      if (error.code === ErrorCode.UserCancelled) return;
      Alert.alert('Purchase Failed', error.message);
    },
  });

  useEffect(() => {
    fetchProducts({ skus: ['premium', 'coins_100'] });
  }, []);

  return (
    <FlatList
      data={products}
      renderItem={({ item }) => (
        <Button
          title={\`\${item.title} - \${item.localizedPrice}\`}
          onPress={() =>
            requestPurchase({
              request: {
                apple: { sku: item.productId },
                google: { skus: [item.productId] },
              },
              type: 'inapp',
            })
          }
        />
      )}
    />
  );
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
          <strong>Important:</strong> Most <code>useIAP</code> methods return{' '}
          <code>Promise&lt;void&gt;</code> and update internal state. Use{' '}
          <code>onPurchaseSuccess</code> callback to receive purchase results,
          not the return value of <code>requestPurchase</code>.
        </div>

        <h3 id="hook-state" className="anchor-heading">
          Hook State
          <a href="#hook-state" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          After calling methods, consume state from the hook:
        </p>
        <ul>
          <li>
            <code>products</code> — Populated after <code>fetchProducts()</code>
          </li>
          <li>
            <code>subscriptions</code> — Populated after fetching with type{' '}
            <code>'subs'</code>
          </li>
          <li>
            <code>availablePurchases</code> — Populated after{' '}
            <code>getAvailablePurchases()</code>
          </li>
          <li>
            <code>activeSubscriptions</code> — Populated after{' '}
            <code>getActiveSubscriptions()</code>. Also returns the value directly.
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
  await finishTransaction(purchase, false); // true for consumables
});

const errorSub = purchaseErrorListener((error) => {
  if (error.code === ErrorCode.UserCancelled) return;
  console.error(error.message);
});

// Fetch and purchase
const products = await fetchProducts({ skus: ['premium'] });
await requestPurchase({ request: { apple: { sku: 'premium' } } });

// Cleanup on unmount
purchaseSub.remove();
errorSub.remove();
await endConnection();`}
        </CodeBlock>
      </section>

      <section>
        <h2 id="error-handling" className="anchor-heading">
          Error Handling
          <a href="#error-handling" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          Errors are automatically normalized to the <code>ErrorCode</code> enum.
          Use the provided helper functions:
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
        <h3>Build errors</h3>
        <ul>
          <li>
            iOS: Run <code>cd ios &amp;&amp; bundle exec pod install</code>
          </li>
          <li>
            Android: Ensure <code>compileSdkVersion 34+</code> in{' '}
            <code>android/build.gradle</code>
          </li>
          <li>
            Metro bundler issues: <code>yarn start --reset-cache</code>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default ReactNativeSetup;
