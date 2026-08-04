import { Link } from 'react-router-dom';
import Callout from '../../../components/Callout';
import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';
import {
  ANDROID_SDK,
  EXPO_PACKAGE,
  GOOGLE_PLAY_BILLING,
} from '../../../lib/versioning';

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
        <code>expo-iap</code> provides in-app purchase support for Expo apps —
        both the managed workflow and bare apps that prefer the Expo Modules
        stack. For bare React Native we recommend{' '}
        <Link to="/docs/setup/react-native">react-native-iap</Link> (same API);
        see <a href="#rn-cli">React Native CLI Projects</a> for using expo-iap
        in bare apps.
      </p>

      <Callout kind="important" title="Before you start">
        Complete the store configuration before integrating with your framework:{' '}
        <Link to="/docs/ios-setup">iOS Setup</Link> |{' '}
        <Link to="/docs/android-setup">Android Setup</Link>
      </Callout>

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

        <Callout kind="important" title="Development build required">
          In-app purchases require native modules that are{' '}
          <strong>not available in Expo Go</strong>. You must use a{' '}
          <a
            href="https://docs.expo.dev/development/create-development-builds/"
            target="_blank"
            rel="noopener noreferrer"
          >
            custom development client
          </a>
          . Testing also requires a <strong>physical device</strong> —
          simulators and emulators have limited IAP support.
        </Callout>
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
          expo-iap uses OpenIAP Android artifacts backed by Google Play Billing
          Library v{GOOGLE_PLAY_BILLING.version}. Use{' '}
          <strong>Kotlin 2.2+</strong> for Android builds.
        </p>
        <ul>
          <li>
            <strong>Expo SDK 54+:</strong> the default toolchain is often
            sufficient, but the OpenIAP artifacts require Kotlin 2.2+ — if the
            Android build fails on Kotlin metadata, set{' '}
            <code>kotlinVersion</code> explicitly with expo-build-properties as
            shown below.
          </li>
          <li>
            <strong>Expo SDK 53:</strong> Set the Kotlin version explicitly with
            expo-build-properties:
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

        <Callout kind="warning" title="Expo SDK 52 or earlier">
          Expo SDK 52 uses Kotlin 1.9.x, which is <strong>incompatible</strong>{' '}
          with Billing Library v8. You must either upgrade to SDK 53+
          (recommended) or use a custom config plugin to downgrade the billing
          library. See the <a href="#sdk52-workaround">SDK 52 workaround</a>{' '}
          below.
        </Callout>

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
        <Callout kind="important" title="Building with Xcode 27?">
          The generated iOS project must use the UIScene lifecycle. Follow the{' '}
          <Link to="/docs/ios-setup#xcode-27-scene-lifecycle">
            Xcode 27 UIScene checklist
          </Link>{' '}
          to migrate: your <code>Info.plist</code> needs a scene configuration,
          and <code>AppDelegate.swift</code> must no longer create{' '}
          <code>UIWindow(frame: UIScreen.main.bounds)</code>. Newer Expo
          templates (based on <code>ExpoAppSceneDelegate</code>) generate this
          correctly.
        </Callout>

        <h3 id="android-config" className="anchor-heading">
          Android Configuration
          <a href="#android-config" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>
            Requires <strong>minSdkVersion {ANDROID_SDK.minSdk}+</strong> and{' '}
            <strong>compileSdkVersion {ANDROID_SDK.compileSdk}+</strong>
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
        <p>
          The expo-iap config plugin does two things: it wires your IAPKit
          publishable key into the app for hosted{' '}
          <Link to="/docs/kit-backend">purchase verification</Link>, and it
          enables optional store modules —{' '}
          <Link to="/docs/setup/store/onside">Onside</Link> (an iOS alternative
          marketplace), <Link to="/docs/setup/store/horizon">Horizon OS</Link>{' '}
          (Meta Quest), and <Link to="/docs/setup/store/amazon">Amazon</Link>{' '}
          (Fire OS devices and the Vega OS runtime). All modules are off by
          default; enable only the stores you ship to.
        </p>
        <CodeBlock language="json">
          {`{
  "expo": {
    "plugins": [
      [
        "expo-iap",
        {
          "iapkitApiKey": "openiap-kit_pk_<your-publishable-key>",
          "modules": {
            "onside": true,
            "horizon": true,
            "amazon": {
              "fireOS": false,
              "vegaOS": false
            }
          },
          "android": {
            "horizon": {
              "appId": "YOUR_HORIZON_APP_ID"
            }
          }
        }
      ]
    ]
  }
}`}
        </CodeBlock>
        <p>
          Use this page for the Expo plugin shape. Store-specific values —
          required developer-console fields, supported targets, and artifact
          rules — live in each store&apos;s setup page linked above.
        </p>
        <p>
          Module enable flags live under <code>modules</code>; platform-specific
          values live under <code>android</code> or <code>ios</code>. For
          Amazon, <code>modules.amazon.fireOS</code> and{' '}
          <code>modules.amazon.vegaOS</code> toggle each target; the separate{' '}
          <code>android.amazon.vegaOS</code> block is only needed when your Vega
          OS build requires different values (app id, artifacts) than your
          regular Android config — see{' '}
          <Link to="/docs/setup/store/amazon">Amazon Store Setup</Link>.
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
          <Link to="/docs/apis/init-connection">
            <code>initConnection</code>
          </Link>{' '}
          → set up{' '}
          <Link to="/docs/events/purchase-updated-listener">
            <code>purchaseUpdatedListener</code>
          </Link>{' '}
          and{' '}
          <Link to="/docs/events/purchase-error-listener">
            <code>purchaseErrorListener</code>
          </Link>{' '}
          →{' '}
          <Link to="/docs/apis/fetch-products">
            <code>fetchProducts</code>
          </Link>{' '}
          →{' '}
          <Link to="/docs/apis/request-purchase">
            <code>requestPurchase</code>
          </Link>{' '}
          →{' '}
          <Link to="/docs/apis/finish-transaction">
            <code>finishTransaction</code>
          </Link>
          , with{' '}
          <Link to="/docs/apis/end-connection">
            <code>endConnection</code>
          </Link>{' '}
          on teardown. The <code>useIAP</code> hook manages the connection and
          listener steps for you. See the{' '}
          <Link to="/docs/features/purchase">Purchase Guide</Link> for the
          complete flow.
        </p>

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
import { Alert, Button, FlatList } from 'react-native';
import { useIAP, ErrorCode, finishTransaction } from 'expo-iap';

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
    fetchProducts({ skus: ['premium'] });
  }, []);

  return (
    <FlatList
      data={products}
      keyExtractor={(product) => product.id}
      renderItem={({ item }) => (
        <Button
          title={\`\${item.title} - \${item.localizedPrice}\`}
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
          <Link to="/docs/apis/fetch-products">
            <code>fetchProducts</code>
          </Link>
          ,{' '}
          <Link to="/docs/apis/request-purchase">
            <code>requestPurchase</code>
          </Link>
          , and{' '}
          <Link to="/docs/apis/finish-transaction">
            <code>finishTransaction</code>
          </Link>{' '}
          for parameters and per-store behavior, and{' '}
          <Link to="/docs/errors">
            <code>ErrorCode</code>
          </Link>{' '}
          for the full error reference.
        </p>

        <Callout kind="warning" title="Critical">
          Always call <code>finishTransaction</code> after verifying a purchase.
          On Android, unfinished purchases are automatically refunded after 3
          days.
        </Callout>

        <p>
          The <code>useIAP</code> hook API is identical to react-native-iap:
          methods return <code>Promise&lt;void&gt;</code> and update internal
          state — use <code>onPurchaseSuccess</code> for purchase results.
        </p>
      </section>

      <section>
        <h2 id="differences" className="anchor-heading">
          Differences from react-native-iap
          <a href="#differences" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          expo-iap and react-native-iap share the same OpenIAP API; they differ
          only in tooling:
        </p>
        <ul>
          <li>
            Uses <code>npx expo install</code> instead of{' '}
            <code>npm install</code>
          </li>
          <li>Supports Expo managed workflow (no manual native code needed)</li>
          <li>
            Built on the Expo Modules architecture instead of{' '}
            <Link to="/docs/setup/react-native#nitro-modules">
              Nitro Modules
            </Link>
            , the C++/JSI binding layer react-native-iap uses
          </li>
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

        <h3 id="tvos-configuration" className="anchor-heading">
          Configuration
          <a href="#tvos-configuration" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Replace <code>react-native</code> with <code>react-native-tvos</code>{' '}
          in your <code>package.json</code>:
        </p>
        <CodeBlock language="json">
          {`{
  "dependencies": {
    "react-native": "npm:react-native-tvos@0.81.5-1",
    "@react-native-tvos/config-tv": "^0.1.4",
    ${EXPO_PACKAGE.dependencyLine}
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

        <Callout kind="note">
          <code>presentCodeRedemptionSheetIOS</code> is{' '}
          <strong>not supported</strong> on tvOS. Direct users to redeem codes
          on their iPhone or through Apple TV settings instead.
        </Callout>
      </section>

      <section>
        <h2 id="sdk52-workaround" className="anchor-heading">
          Expo SDK 52 Workaround
          <a href="#sdk52-workaround" className="anchor-link">
            #
          </a>
        </h2>

        <Callout kind="warning">
          Expo SDK 52 (React Native 0.76.x) uses Kotlin 1.9.x, which is
          incompatible with the current OpenIAP Android artifacts — upgrading to{' '}
          <strong>SDK 53+</strong> is the recommended fix (see{' '}
          <a href="#android-kotlin">Android Kotlin Version</a>).
        </Callout>

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

        <h3 id="products-not-found" className="anchor-heading">
          Products not found
          <a href="#products-not-found" className="anchor-link">
            #
          </a>
        </h3>
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

        <h3 id="build-issues" className="anchor-heading">
          Build issues
          <a href="#build-issues" className="anchor-link">
            #
          </a>
        </h3>
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

      <section>
        <h2 id="next-steps" className="anchor-heading">
          Next Steps
          <a href="#next-steps" className="anchor-link">
            #
          </a>
        </h2>
        <ul>
          <li>
            <Link to="/docs/features/purchase">Purchase Guide</Link> — Complete
            purchase flow with validation and receipt verification
          </li>
          <li>
            <Link to="/docs/features/subscription">Subscription Guide</Link> —
            Subscription offers, renewal, and management
          </li>
          <li>
            <Link to="/docs/errors">Error Codes</Link> — Full error reference
            and handling strategies
          </li>
          <li>
            <Link to="/docs/apis">API Reference</Link> — All available APIs with
            multi-language examples
          </li>
          <li>
            <Link to="/docs/setup/store">Store Setup</Link> — support boundaries
            for Onside, Horizon OS (Meta Quest), and Amazon (Fire OS / Vega OS)
            targets
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
    </div>
  );
}

export default ExpoSetup;
