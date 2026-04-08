import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';

function ExpoSetup() {
  return (
    <div className="doc-page">
      <SEO
        title="Expo Setup"
        description="Install and configure expo-iap for in-app purchases in Expo apps."
        path="/docs/setup/expo"
        keywords="expo-iap, Expo IAP, in-app purchase, Expo managed workflow"
      />
      <h1>Expo Setup</h1>
      <p>
        <code>expo-iap</code> provides in-app purchase support for Expo apps.
        Works with both managed and bare workflows.
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
        Use this if you're using Expo managed workflow. If you're using bare
        React Native, use{' '}
        <a href="/docs/setup/react-native">react-native-iap</a> instead.
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
          {`npx expo install expo-iap`}
        </CodeBlock>

        <h3 id="ios-config" className="anchor-heading">
          iOS Configuration
          <a href="#ios-config" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Set the deployment target to iOS 15.0+ in your app config:
        </p>
        <CodeBlock language="typescript">
          {`// app.json
{
  "expo": {
    "ios": {
      "deploymentTarget": "15.0"
    }
  }
}

// or app.config.ts
export default {
  expo: {
    ios: {
      deploymentTarget: '15.0',
    },
  },
};`}
        </CodeBlock>
        <p>
          Enable In-App Purchase capability in Xcode under{' '}
          <strong>Signing &amp; Capabilities</strong> after running{' '}
          <code>npx expo prebuild</code>.
        </p>

        <h3 id="android-config" className="anchor-heading">
          Android Configuration
          <a href="#android-config" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>
            Requires <strong>compileSdkVersion 34+</strong>
          </li>
          <li>No additional configuration needed for Expo managed workflow</li>
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
          expo-iap provides the same <code>useIAP</code> hook as
          react-native-iap. It manages connection, state, and errors
          automatically.
        </p>
        <CodeBlock language="typescript">
          {`import React, { useEffect } from 'react';
import { Alert, View, Button } from 'react-native';
import { useIAP, ErrorCode, finishTransaction } from 'expo-iap';

function Store() {
  const {
    connected,
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
    fetchProducts({ skus: ['premium'] });
  }, []);

  return (
    <View>
      {products.map((product) => (
        <Button
          key={product.productId}
          title={\`\${product.title} - \${product.localizedPrice}\`}
          onPress={() =>
            requestPurchase({
              request: {
                apple: { sku: product.productId },
                google: { skus: [product.productId] },
              },
              type: 'inapp',
            })
          }
        />
      ))}
    </View>
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
          <strong>Critical:</strong> Always call <code>finishTransaction</code> after verifying a purchase. On Android, unfinished purchases are automatically refunded after 3 days.
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
          <strong>Important:</strong> The <code>useIAP</code> hook API is
          identical to react-native-iap. Methods return{' '}
          <code>Promise&lt;void&gt;</code> and update internal state. Use{' '}
          <code>onPurchaseSuccess</code> for purchase results.
        </div>
      </section>

      <section>
        <h2 id="differences" className="anchor-heading">
          Differences from react-native-iap
          <a href="#differences" className="anchor-link">
            #
          </a>
        </h2>
        <ul>
          <li>
            Uses <code>npx expo install</code> instead of{' '}
            <code>npm install</code>
          </li>
          <li>
            Supports Expo managed workflow (no manual native code needed)
          </li>
          <li>
            Uses Expo modules architecture instead of Nitro Modules
          </li>
          <li>Same API surface and hook behavior as react-native-iap</li>
        </ul>
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
} from 'expo-iap';

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
              href="https://www.npmjs.com/package/expo-iap"
              target="_blank"
              rel="noopener noreferrer"
            >
              npm: expo-iap
            </a>
            {' | '}
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap"
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

export default ExpoSetup;
