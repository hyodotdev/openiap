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
        <h2 id="prerequisites" className="anchor-heading">
          Prerequisites
          <a href="#prerequisites" className="anchor-link">
            #
          </a>
        </h2>
        <table>
          <thead>
            <tr>
              <th>Requirement</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Expo SDK</strong>
              </td>
              <td>53+ (React Native 0.79+)</td>
            </tr>
            <tr>
              <td>
                <strong>iOS</strong>
              </td>
              <td>iOS 15+ (StoreKit 2)</td>
            </tr>
            <tr>
              <td>
                <strong>Android</strong>
              </td>
              <td>API level 21+</td>
            </tr>
            <tr>
              <td>
                <strong>Node.js</strong>
              </td>
              <td>16 or later</td>
            </tr>
          </tbody>
        </table>

        <div
          style={{
            padding: '1rem',
            background: 'rgba(220, 104, 67, 0.1)',
            borderLeft: '4px solid var(--accent-color)',
            borderRadius: '0.5rem',
            margin: '1rem 0',
          }}
        >
          <strong>Development build required:</strong> In-app purchases require
          native modules that are <strong>not available in Expo Go</strong>. You
          must use a{' '}
          <a
            href="https://docs.expo.dev/development/create-development-builds/"
            target="_blank"
            rel="noopener noreferrer"
          >
            custom development client
          </a>
          . Testing also requires a <strong>physical device</strong> —
          simulators and emulators have limited IAP support.
        </div>
      </section>

      <section>
        <h2 id="installation" className="anchor-heading">
          Installation
          <a href="#installation" className="anchor-link">
            #
          </a>
        </h2>
        <CodeBlock language="bash">{`npx expo install expo-iap`}</CodeBlock>

        <h3 id="android-kotlin" className="anchor-heading">
          Android Kotlin Version
          <a href="#android-kotlin" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          expo-iap uses Google Play Billing Library v8.2, which requires{' '}
          <strong>Kotlin 2.0+</strong>.
        </p>
        <ul>
          <li>
            <strong>Expo SDK 54+:</strong> No configuration needed — Kotlin 2.0+
            is included by default.
          </li>
          <li>
            <strong>Expo SDK 53:</strong> Kotlin 2.0+ is included natively, but
            if you encounter build issues, explicitly set the Kotlin version:
          </li>
        </ul>
        <CodeBlock language="json">
          {`{
  "expo": {
    "plugins": [
      "expo-iap",
      [
        "expo-build-properties",
        {
          "android": {
            "kotlinVersion": "2.2.0"
          }
        }
      ]
    ]
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
          <strong>Expo SDK 52 or earlier:</strong> Expo SDK 52 uses Kotlin
          1.9.x, which is <strong>incompatible</strong> with Billing Library v8.
          You must either upgrade to SDK 53+ (recommended) or use a custom
          config plugin to downgrade the billing library. See the{' '}
          <a href="#sdk52-workaround">SDK 52 workaround</a> below.
        </div>

        <h3 id="prebuild" className="anchor-heading">
          Prebuild &amp; Development Build
          <a href="#prebuild" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          After installing, generate native projects and create a development
          build:
        </p>
        <CodeBlock language="bash">
          {`# Generate native iOS and Android directories
npx expo prebuild --clean

# Option A: Build with EAS
npm install -g eas-cli  # if not installed
eas build --platform ios --profile development
eas build --platform android --profile development

# Option B: Run locally
npx expo run:ios --device
npx expo run:android`}
        </CodeBlock>

        <h3 id="ios-config" className="anchor-heading">
          iOS Configuration
          <a href="#ios-config" className="anchor-link">
            #
          </a>
        </h3>
        <p>Set the deployment target to iOS 15.0+ in your app config:</p>
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
          Enable In-App Purchase capability in Xcode: Target &gt;{' '}
          <strong>Signing &amp; Capabilities</strong> &gt;{' '}
          <strong>+ Capability</strong> &gt; <strong>In-App Purchase</strong>{' '}
          (after running <code>npx expo prebuild</code>).
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

        <h3 id="rn-cli" className="anchor-heading">
          React Native CLI Projects
          <a href="#rn-cli" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          If using React Native CLI (not Expo), install{' '}
          <code>expo-modules-core</code> first:
        </p>
        <CodeBlock language="bash">
          {`npx install-expo-modules@latest
cd ios && pod install`}
        </CodeBlock>
      </section>

      <section>
        <h2 id="config-plugin" className="anchor-heading">
          Config Plugin Options
          <a href="#config-plugin" className="anchor-link">
            #
          </a>
        </h2>
        <p>The expo-iap config plugin supports these options:</p>
        <CodeBlock language="json">
          {`{
  "expo": {
    "plugins": [
      [
        "expo-iap",
        {
          "iapkitApiKey": "your_api_key",
          "modules": {
            "onside": true,
            "horizon": true
          },
          "google": {
            "horizonAppId": "YOUR_HORIZON_APP_ID"
          }
        }
      ]
    ]
  }
}`}
        </CodeBlock>
        <table>
          <thead>
            <tr>
              <th>Option</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>iapkitApiKey</code>
              </td>
              <td>string</td>
              <td>IAPKit API key for server-side receipt verification</td>
            </tr>
            <tr>
              <td>
                <code>modules.onside</code>
              </td>
              <td>boolean</td>
              <td>
                Enable Onside alternative marketplace for iOS (see{' '}
                <a href="/docs/features/alternative-marketplace/onside">
                  Onside Integration
                </a>
                )
              </td>
            </tr>
            <tr>
              <td>
                <code>modules.horizon</code>
              </td>
              <td>boolean</td>
              <td>
                Enable Horizon module for Meta Quest (see{' '}
                <a href="/docs/horizon-setup">Horizon OS Setup</a>)
              </td>
            </tr>
            <tr>
              <td>
                <code>google.horizonAppId</code>
              </td>
              <td>string</td>
              <td>Meta Horizon App ID for Quest/VR devices</td>
            </tr>
          </tbody>
        </table>
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
          <strong>Critical:</strong> Always call <code>finishTransaction</code>{' '}
          after verifying a purchase. On Android, unfinished purchases are
          automatically refunded after 3 days.
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
          <li>Supports Expo managed workflow (no manual native code needed)</li>
          <li>Uses Expo modules architecture instead of Nitro Modules</li>
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
          Errors are automatically normalized to the <code>ErrorCode</code>{' '}
          enum. Use the provided helper functions:
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
        <h2 id="tvos" className="anchor-heading">
          tvOS Support
          <a href="#tvos" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          expo-iap supports Apple TV (tvOS) through{' '}
          <a
            href="https://github.com/react-native-tvos/react-native-tvos"
            target="_blank"
            rel="noopener noreferrer"
          >
            react-native-tvos
          </a>
          . Requires <strong>tvOS 16.0+</strong>.
        </p>

        <h3>Configuration</h3>
        <p>
          Replace <code>react-native</code> with <code>react-native-tvos</code>{' '}
          in your <code>package.json</code>:
        </p>
        <CodeBlock language="json">
          {`{
  "dependencies": {
    "react-native": "npm:react-native-tvos@0.81.5-1",
    "@react-native-tvos/config-tv": "^0.1.4",
    "expo-iap": "latest"
  }
}`}
        </CodeBlock>
        <p>
          Then configure your <code>app.config.ts</code> conditionally using the{' '}
          <code>EXPO_TV</code> environment variable:
        </p>
        <CodeBlock language="typescript">
          {`import type { ConfigContext, ExpoConfig } from '@expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const isTV = process.env.EXPO_TV === '1';

  return {
    ...config,
    name: 'my-app',
    slug: 'my-app',
    plugins: [
      ...(isTV
        ? [['@react-native-tvos/config-tv', { isTV: true }] as [string, any]]
        : []),
      ['expo-iap', {}],
      [
        'expo-build-properties',
        {
          ios: {
            deploymentTarget: isTV ? '16.0' : '15.1',
          },
        },
      ],
    ],
  };
};`}
        </CodeBlock>
        <p>Build for tvOS:</p>
        <CodeBlock language="bash">
          {`# Prebuild for tvOS
EXPO_TV=1 npx expo prebuild --platform ios --clean

# Run on simulator
EXPO_TV=1 npx expo run:ios --device "Apple TV 4K (3rd generation)"`}
        </CodeBlock>

        <div
          style={{
            padding: '1rem',
            background: 'rgba(164, 116, 101, 0.1)',
            borderLeft: '4px solid var(--primary-color)',
            borderRadius: '0.5rem',
            margin: '1rem 0',
          }}
        >
          <strong>Note:</strong> <code>presentCodeRedemptionSheetIOS</code> is{' '}
          <strong>not supported</strong> on tvOS. Direct users to redeem codes
          on their iPhone or through Apple TV settings instead.
        </div>
      </section>

      <section>
        <h2 id="sdk52-workaround" className="anchor-heading">
          Expo SDK 52 Workaround
          <a href="#sdk52-workaround" className="anchor-link">
            #
          </a>
        </h2>

        <div
          style={{
            padding: '1rem',
            background: 'rgba(220, 104, 67, 0.1)',
            borderLeft: '4px solid var(--accent-color)',
            borderRadius: '0.5rem',
            margin: '1rem 0',
          }}
        >
          <strong>Warning:</strong> Expo SDK 52 (React Native 0.76.x) uses
          Kotlin 1.9.x, which is incompatible with Google Play Billing Library
          v8 (requires Kotlin 2.0+). Upgrading to <strong>SDK 53+</strong> is
          the recommended solution.
        </div>

        <p>
          If you cannot upgrade, create a custom config plugin to force an older
          billing library:
        </p>
        <CodeBlock language="javascript">
          {`// plugins/withBillingLibraryDowngrade.js
const { withGradleProperties } = require('@expo/config-plugins');

module.exports = function withBillingLibraryDowngrade(config) {
  return withGradleProperties(config, (config) => {
    config.modResults.push({
      type: 'property',
      key: 'billingClientVersion',
      value: '6.2.1',
    });
    return config;
  });
};`}
        </CodeBlock>
        <CodeBlock language="json">
          {`{
  "expo": {
    "plugins": [
      "./plugins/withBillingLibraryDowngrade",
      "expo-iap"
    ]
  }
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

        <h3>Build issues</h3>
        <ul>
          <li>
            Clear and reinstall:{' '}
            <code>rm -rf node_modules &amp;&amp; npm install</code>
          </li>
          <li>
            For iOS, clean pods:{' '}
            <code>
              cd ios &amp;&amp; rm -rf Pods Podfile.lock &amp;&amp; pod install
            </code>
          </li>
          <li>
            For Expo projects: <code>npx expo prebuild --clean</code>
          </li>
          <li>
            Reset Metro cache: <code>npx react-native start --reset-cache</code>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default ExpoSetup;
