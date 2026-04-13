import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';

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
        Flutter apps on iOS and Android.
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
        <CodeBlock language="bash">
          {`flutter pub add flutter_inapp_purchase`}
        </CodeBlock>
        <p>
          Or add it manually to your <code>pubspec.yaml</code>:
        </p>
        <CodeBlock language="yaml">
          {`dependencies:
  flutter_inapp_purchase: ^9.0.0`}
        </CodeBlock>

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
        </ul>
        <p>
          Add the following to your <code>ios/Runner/Info.plist</code> (iOS
          14+):
        </p>
        <CodeBlock language="xml">
          {`<key>LSApplicationQueriesSchemes</key>
<array>
    <string>itms-apps</string>
</array>`}
        </CodeBlock>

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
    compileSdkVersion 34

    defaultConfig {
        minSdkVersion 21  // Required minimum
        targetSdkVersion 34

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
    compileSdk = 34

    defaultConfig {
        minSdk = 21  // Required minimum
        targetSdk = 34

        // Required for v7.1.14+: Select Google Play platform
        missingDimensionStrategy("platform", "play")
    }
}`}
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
          <strong>Note:</strong> The <code>missingDimensionStrategy</code>{' '}
          configuration is required since v7.1.14 due to product flavor support
          for Meta Horizon OS. For Meta Quest support, see the{' '}
          <a href="/docs/horizon-setup">Horizon OS Setup Guide</a>.
        </div>

        <h4>ProGuard Rules (if using ProGuard)</h4>
        <p>
          Add to your <code>android/app/proguard-rules.pro</code>:
        </p>
        <CodeBlock language="text">
          {`# In-App Purchase
-keep class com.amazon.** {*;}
-keep class dev.hyo.** { *; }
-keep class com.android.vending.billing.**
-dontwarn com.amazon.**
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

        <h3 id="basic-setup" className="anchor-heading">
          Basic Setup
          <a href="#basic-setup" className="anchor-link">
            #
          </a>
        </h3>
        <CodeBlock language="dart">
          {`import 'dart:async';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final iap = FlutterInappPurchase.instance;

late StreamSubscription purchaseSub;
late StreamSubscription errorSub;

// Initialize connection
await iap.initConnection();

// Setup listeners
purchaseSub = iap.purchaseUpdatedStream.listen((purchase) async {
  // Validate receipt, then:
  // CRITICAL: Android auto-refunds after 3 days if not called!
  await iap.finishTransaction(purchase, isConsumable: true);
});

errorSub = iap.purchaseErrorStream.listen((error) {
  if (error.code == ErrorCode.userCancelled) return;
  print('\${error.code}: \${error.message}');
});

// Cleanup in dispose()
@override
void dispose() {
  purchaseSub.cancel();
  errorSub.cancel();
  iap.endConnection();
  super.dispose();
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

        <h3 id="purchase" className="anchor-heading">
          Making a Purchase
          <a href="#purchase" className="anchor-link">
            #
          </a>
        </h3>
        <CodeBlock language="dart">
          {`// Request purchase (results come through purchaseUpdatedStream)
await iap.requestPurchase(sku: 'premium');

// Or with subscription offers
await iap.requestPurchaseWithBuilder(
  sku: 'monthly_pro',
  subscriptionOffers: [offer],
);`}
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
          <strong>Important:</strong> Flutter uses <strong>Streams</strong> for
          purchase events, not callbacks. Always set up{' '}
          <code>purchaseUpdatedStream</code> and{' '}
          <code>purchaseErrorStream</code> listeners before calling{' '}
          <code>requestPurchase</code>.
        </div>

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
  PurchaseOptions(
    onlyIncludeActiveItemsIOS: false,
  ),
);`}
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
            <a href="/docs/horizon-setup">Horizon OS Setup</a> — Meta Quest
            in-app purchase configuration
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
      </section>
    </div>
  );
}

export default FlutterSetup;
