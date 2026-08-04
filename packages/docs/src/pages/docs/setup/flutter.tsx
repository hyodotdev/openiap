import { Link } from 'react-router-dom';
import Callout from '../../../components/Callout';
import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';
import { ANDROID_SDK, FLUTTER_PACKAGE } from '../../../lib/versioning';

function FlutterSetup() {
  return (
    <div className="doc-page">
      <SEO
        title="Flutter Setup"
        description="Install and configure flutter_inapp_purchase for in-app purchases in Flutter apps."
        path="/docs/setup/flutter"
        keywords="flutter_inapp_purchase, Flutter IAP, in-app purchase, pub.dev"
      />
      <h1>Flutter Setup</h1>
      <p>
        <code>flutter_inapp_purchase</code> provides in-app purchase support for
        Flutter apps on iOS, Android, and macOS.
      </p>

      <Callout kind="important" title="Before you start">
        Complete the store configuration before integrating with your framework:{' '}
        <a href="/docs/ios-setup">iOS Setup</a> |{' '}
        <a href="/docs/android-setup">Android Setup</a>
      </Callout>

      <section>
        <h2 id="prerequisites" className="anchor-heading">
          Prerequisites
          <a href="#prerequisites" className="anchor-link">
            #
          </a>
        </h2>
        <ul>
          <li>
            Flutter with <strong>iOS 15.0+</strong> /{' '}
            <strong>macOS 14.0+</strong> / Android{' '}
            <code>minSdkVersion {ANDROID_SDK.minSdk}</code>+ (see the platform
            sections below)
          </li>
          <li>
            An active Apple Developer account and/or Google Play Developer
            account
          </li>
          <li>
            Products configured in the store consoles — see{' '}
            <a href="/docs/ios-setup">iOS Setup</a> and{' '}
            <a href="/docs/android-setup">Android Setup</a>
          </li>
          <li>
            A real device for purchase testing — simulators and emulators cannot
            complete purchases
          </li>
        </ul>
      </section>

      <section>
        <h2 id="installation" className="anchor-heading">
          Installation
          <a href="#installation" className="anchor-link">
            #
          </a>
        </h2>
        <CodeBlock language="bash">
          {`flutter pub add flutter_inapp_purchase`}
        </CodeBlock>
        <p>
          Or add it manually to your <code>pubspec.yaml</code>:
        </p>
        <CodeBlock language="yaml">
          {`dependencies:
  ${FLUTTER_PACKAGE.dependencyLine}`}
        </CodeBlock>

        <h3 id="ios-macos-dependency-manager" className="anchor-heading">
          iOS/macOS Native Dependency Manager
          <a href="#ios-macos-dependency-manager" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          The Dart install command above is the only package install step for
          most apps. On Flutter 3.44 and newer, Swift Package Manager is enabled
          by default, and the Flutter CLI resolves the native OpenIAP dependency
          automatically when you run or build the app.
        </p>
        <p>
          Projects that disable Swift Package Manager, or projects using an
          older Flutter toolchain, continue to use CocoaPods. In that case, run
          CocoaPods after <code>flutter pub get</code>:
        </p>
        <CodeBlock language="bash">
          {`(cd ios && pod install)

# If your app also has a macOS target:
(cd macos && pod install)`}
        </CodeBlock>
        <p>
          Do not add OpenIAP manually to your app&apos;s{' '}
          <code>Package.swift</code> or <code>Podfile</code>; the Flutter plugin
          declares the native dependency.
        </p>

        <h3 id="ios-config" className="anchor-heading">
          iOS Configuration
          <a href="#ios-config" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>
            Requires <strong>iOS 15.0+</strong>
          </li>
          <li>
            Enable In-App Purchase capability in Xcode: Target &gt;{' '}
            <strong>Signing &amp; Capabilities</strong> &gt;{' '}
            <strong>+ Capability</strong> &gt; <strong>In-App Purchase</strong>
          </li>
          <li>
            When linking with the iOS 27 SDK, regenerate or migrate an older
            Runner so its <code>UIApplicationSceneManifest</code> selects{' '}
            <code>FlutterSceneDelegate</code>. See the{' '}
            <Link to="/docs/ios-setup#xcode-27-scene-lifecycle">
              Xcode 27 UIScene checklist
            </Link>
            .
          </li>
        </ul>
        <p>
          Declaring <code>itms-apps</code> in <code>ios/Runner/Info.plist</code>{' '}
          is only needed when your own code checks App Store links before
          opening them (for example <code>canLaunchUrl</code> from url_launcher)
          — the plugin itself does not require it:
        </p>
        <CodeBlock language="xml">
          {`<key>LSApplicationQueriesSchemes</key>
<array>
    <string>itms-apps</string>
</array>`}
        </CodeBlock>

        <h3 id="macos-config" className="anchor-heading">
          macOS Configuration
          <a href="#macos-config" className="anchor-link">
            #
          </a>
        </h3>
        <ul>
          <li>
            Requires <strong>macOS 14.0+</strong>
          </li>
          <li>
            Enable In-App Purchase capability in Xcode: Target &gt;{' '}
            <strong>Signing &amp; Capabilities</strong> &gt;{' '}
            <strong>+ Capability</strong> &gt; <strong>In-App Purchase</strong>
          </li>
        </ul>

        <h3 id="android-config" className="anchor-heading">
          Android Configuration
          <a href="#android-config" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          Update your <code>android/app/build.gradle</code>:
        </p>
        <CodeBlock language="groovy">
          {`android {
    compileSdkVersion ${ANDROID_SDK.compileSdk}

    defaultConfig {
        minSdkVersion ${ANDROID_SDK.minSdk}  // Required minimum
        targetSdkVersion ${ANDROID_SDK.targetSdk}

        // Required for v7.1.14+: Select Google Play platform
        missingDimensionStrategy 'platform', 'play'
    }
}`}
        </CodeBlock>
        <p>
          For Kotlin DSL (<code>build.gradle.kts</code>):
        </p>
        <CodeBlock language="kotlin">
          {`android {
    compileSdk = ${ANDROID_SDK.compileSdk}

    defaultConfig {
        minSdk = ${ANDROID_SDK.minSdk}  // Required minimum
        targetSdk = ${ANDROID_SDK.targetSdk}

        // Required for v7.1.14+: Select Google Play platform
        missingDimensionStrategy("platform", "play")
    }
}`}
        </CodeBlock>

        <Callout kind="note">
          The <code>missingDimensionStrategy</code> line is required since
          v7.1.14 because the Android library ships product flavors for
          alternative stores — Meta Horizon OS (Quest headsets) and Amazon Fire
          OS. Apps shipping to Google Play always select the <code>play</code>{' '}
          flavor shown above. Targeting Meta Quest or Amazon devices instead?
          See <a href="/docs/setup/store/horizon">Horizon Store Setup</a> or{' '}
          <a href="/docs/setup/store/amazon">Amazon Store Setup</a> for the
          flavor to select there.
        </Callout>

        <h4>ProGuard Rules (if using ProGuard)</h4>
        <p>
          Add to your <code>android/app/proguard-rules.pro</code>:
        </p>
        <CodeBlock language="text">
          {`# In-App Purchase
-keep class dev.hyo.** { *; }
-keep class com.android.vending.billing.**
-keepattributes *Annotation*`}
        </CodeBlock>
      </section>

      <section>
        <h2 id="usage" className="anchor-heading">
          Usage
          <a href="#usage" className="anchor-link">
            #
          </a>
        </h2>
        <p>
          The typical flow is{' '}
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
          . The snippets below cover each step; the{' '}
          <a href="/docs/features/purchase">Purchase Guide</a> shows the full
          flow with receipt validation.
        </p>

        <h3 id="basic-setup" className="anchor-heading">
          Basic Setup
          <a href="#basic-setup" className="anchor-link">
            #
          </a>
        </h3>
        <CodeBlock language="dart">
          {`import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

class StoreScreen extends StatefulWidget {
  const StoreScreen({super.key});

  @override
  State<StoreScreen> createState() => _StoreScreenState();
}

class _StoreScreenState extends State<StoreScreen> {
  final iap = FlutterInappPurchase.instance;

  StreamSubscription<Purchase>? purchaseSub;
  StreamSubscription<PurchaseError>? errorSub;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    // Initialize connection
    await iap.initConnection();

    // Setup listeners
    purchaseSub = iap.purchaseUpdatedListener.listen((purchase) async {
      // Verify the purchase (server-side), then finish it
      await iap.finishTransaction(
        purchase: purchase,
        isConsumable: false, // true for consumables
      );
    });

    errorSub = iap.purchaseErrorListener.listen((error) {
      if (error.code == ErrorCode.UserCancelled) return;
      print('\${error.code}: \${error.message}');
    });
  }

  @override
  void dispose() {
    purchaseSub?.cancel();
    errorSub?.cancel();
    unawaited(iap.endConnection());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink(); // Your store UI
  }
}`}
        </CodeBlock>
        <p>
          Each call here has a full reference — see{' '}
          <a href="/docs/apis/init-connection">
            <code>initConnection</code>
          </a>
          ,{' '}
          <a href="/docs/events/purchase-updated-listener">
            <code>purchaseUpdatedListener</code>
          </a>
          ,{' '}
          <a href="/docs/events/purchase-error-listener">
            <code>purchaseErrorListener</code>
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
          <a href="/docs/errors">Error Codes</a> for the <code>ErrorCode</code>{' '}
          values.
        </p>

        <Callout kind="warning" title="Critical">
          Always call <code>finishTransaction</code> after verifying a purchase.
          On Android, unfinished purchases are automatically refunded after 3
          days.
        </Callout>

        <h3 id="fetch-products" className="anchor-heading">
          Fetching Products
          <a href="#fetch-products" className="anchor-link">
            #
          </a>
        </h3>
        <p>Use explicit type parameters for proper type inference:</p>
        <CodeBlock language="dart">
          {`// In-app products
final products = await iap.fetchProducts<Product>(
  skus: ['premium', 'coins_100'],
  type: ProductQueryType.InApp,
);

// Subscriptions
final subscriptions = await iap.fetchProducts<ProductSubscription>(
  skus: ['monthly_pro', 'yearly_pro'],
  type: ProductQueryType.Subs,
);

for (final product in products) {
  print('\${product.title}: \${product.displayPrice}');
}`}
        </CodeBlock>
        <p>
          See{' '}
          <a href="/docs/apis/fetch-products">
            <code>fetchProducts</code>
          </a>{' '}
          for parameters and per-store behavior.
        </p>

        <h3 id="purchase" className="anchor-heading">
          Making a Purchase
          <a href="#purchase" className="anchor-link">
            #
          </a>
        </h3>
        <p>
          <a href="/docs/apis/request-purchase">
            <code>requestPurchase</code>
          </a>{' '}
          does not return the purchase. Results arrive on the{' '}
          <a href="/docs/events/purchase-updated-listener">
            <code>purchaseUpdatedListener</code>
          </a>{' '}
          stream you set up in <a href="#basic-setup">Basic Setup</a> (unlike
          the callback-style hooks in the React Native SDKs), so make sure both
          listeners are active before you call it.
        </p>

        <CodeBlock language="dart">
          {`// Request purchase (results come through purchaseUpdatedListener)
await iap.requestPurchase(
  RequestPurchaseProps.inApp((
    apple: RequestPurchaseIosProps(sku: 'premium'),
    google: RequestPurchaseAndroidProps(skus: ['premium']),
  )),
);

// Or with subscription offers
await iap.requestPurchase(
  RequestPurchaseProps.subs((
    apple: RequestSubscriptionIosProps(sku: 'monthly_pro'),
    google: RequestSubscriptionAndroidProps(
      skus: ['monthly_pro'],
      subscriptionOffers: [offer],
    ),
  )),
);`}
        </CodeBlock>

        <h3 id="restore" className="anchor-heading">
          Restoring Purchases
          <a href="#restore" className="anchor-link">
            #
          </a>
        </h3>
        <CodeBlock language="dart">
          {`// Get available purchases (active items)
final purchases = await iap.getAvailablePurchases();

// Include expired subscriptions (iOS)
final allPurchases = await iap.getAvailablePurchases(
  onlyIncludeActiveItemsIOS: false,
);`}
        </CodeBlock>
        <p>
          See{' '}
          <a href="/docs/apis/get-available-purchases">
            <code>getAvailablePurchases</code>
          </a>{' '}
          for parameters and per-store behavior.
        </p>
      </section>

      <section>
        <h2 id="troubleshooting" className="anchor-heading">
          Troubleshooting
          <a href="#troubleshooting" className="anchor-link">
            #
          </a>
        </h2>

        <h3>Build failed: Could not determine dependencies (v7.1.14+)</h3>
        <p>
          If Gradle fails with an error about ambiguous variants (
          <code>horizonReleaseRuntimeElements</code> /{' '}
          <code>playReleaseRuntimeElements</code>), add{' '}
          <code>missingDimensionStrategy</code> to your{' '}
          <code>build.gradle</code>. See the{' '}
          <a href="#android-config">Android Configuration</a> section above.
        </p>

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

        <h3>Billing unavailable (Android)</h3>
        <ul>
          <li>Test on a real device, not an emulator</li>
          <li>Ensure Google Play Store is installed and updated</li>
          <li>
            App must be signed with the same certificate uploaded to Play
            Console
          </li>
        </ul>

        <h3>Pending purchases</h3>
        <ul>
          <li>Normal for payment methods requiring additional verification</li>
          <li>Store pending purchases and check again later</li>
          <li>
            Implement proper handling for <code>PurchaseState.Pending</code>
          </li>
        </ul>

        <h3>Purchase JSON missing dataAndroid (Flutter 10)</h3>
        <p>
          The public Purchase field is <code>dataAndroid</code>. Flutter 10 does
          not accept the former custom-channel alias. Native adapters,
          MethodChannel fixtures, and mocks must emit <code>dataAndroid</code>.
          See{' '}
          <Link to="/docs/updates/deprecations#flutter-original-json-android">
            Deprecations &amp; 3.0 Migration
          </Link>
          .
        </p>
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
            stores such as Meta Horizon OS (Quest headsets) and Amazon Fire OS,
            plus which OpenIAP SDKs support each store (Amazon&apos;s Vega OS,
            for example, is available only in the React Native and Expo SDKs)
          </li>
          <li>
            <a
              href="https://pub.dev/packages/flutter_inapp_purchase"
              target="_blank"
              rel="noopener noreferrer"
            >
              pub.dev: flutter_inapp_purchase
            </a>
            {' | '}
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/libraries/flutter_inapp_purchase"
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

export default FlutterSetup;
