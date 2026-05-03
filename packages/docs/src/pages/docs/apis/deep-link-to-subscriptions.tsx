import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function DeepLinkToSubscriptions() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="deepLinkToSubscriptions"
        description="Open the native subscription management interface where users can view and manage their subscriptions."
        path="/docs/apis/deep-link-to-subscriptions"
        keywords="deepLinkToSubscriptions, manage subscriptions, settings deeplink"
      />
      <h1>deepLinkToSubscriptions</h1>
      <p>
        Open the native subscription management interface where users can view
        and manage their subscriptions.
      </p>
      <p>
        <strong>iOS:</strong> Calls{' '}
        <code>AppStore.showManageSubscriptions(in:)</code> with the active{' '}
        <code>UIWindowScene</code>; throws if no window scene is available. Not
        supported on tvOS / watchOS / macOS in the current implementation.{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/appstore/showmanagesubscriptions(in:)"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple docs
        </a>
        . <strong>Android:</strong> Opens the Play Store subscription management
        deep link{' '}
        <code>
          https://play.google.com/store/account/subscriptions?package=&lt;pkg&gt;&amp;sku=&lt;sku&gt;
        </code>
        .{' '}
        <a
          href="https://developer.android.com/google/play/billing/subscriptions#deep-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google docs
        </a>
        .
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`deepLinkToSubscriptions(options?: DeepLinkOptions): Promise<void>

interface DeepLinkOptions {
  skuAndroid?: string;
  packageNameAndroid?: string;
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func deepLinkToSubscriptions() async throws`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun deepLinkToSubscriptions(options: DeepLinkOptions? = null)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun deepLinkToSubscriptions(options: DeepLinkOptions? = null)`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<void> deepLinkToSubscriptions({String? skuAndroid, String? packageNameAndroid});`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func deep_link_to_subscriptions(options: DeepLinkOptions) -> void`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <p>
        Pass an optional{' '}
        <Link to="/docs/types#common">
          <code>DeepLinkOptions</code>
        </Link>
        :
      </p>
      <ul className="api-params">
        <li>
          <code>skuAndroid</code>{' '}
          <em>
            (optional, <code>string</code>)
          </em>{' '}
          — <strong>Android.</strong> Subscription SKU to deep-link to. Without
          it the user lands on the generic Play subscriptions page.
        </li>
        <li>
          <code>packageNameAndroid</code>{' '}
          <em>
            (optional, <code>string</code>)
          </em>{' '}
          — <strong>Android.</strong> Defaults to the host app's package;
          override only when proxying for another app.
        </li>
      </ul>
      <p>
        iOS ignores all fields — the wrapper calls{' '}
        <code>AppStore.showManageSubscriptions(in:)</code> with the active{' '}
        <code>UIWindowScene</code>.
      </p>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;void&gt;</code> — Resolves when the system surface is
        presented (or the deep link is opened on Android).
      </p>

      <AnchorLink id="throws" level="h2">
        Throws
      </AnchorLink>
      <p>
        <strong>iOS:</strong> When no <code>UIWindowScene</code> is available.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap
import { deepLinkToSubscriptions } from 'expo-iap';
// Same API in react-native-iap:
// import { deepLinkToSubscriptions } from 'react-native-iap';

await deepLinkToSubscriptions({
  skuAndroid: 'com.app.premium',
  packageNameAndroid: 'com.yourcompany.app',
});

// --- Or alongside the useIAP() hook (also exported from react-native-iap) ---
// deepLinkToSubscriptions is a module-level helper; useIAP doesn't expose it
// on the hook return, so call the module function from inside your
// component (the hook still owns the connection lifecycle).
import { useIAP } from 'expo-iap';

function ManageSubscriptionsButton() {
  useIAP();

  return (
    <Button
      title="Manage subscriptions"
      onPress={() =>
        deepLinkToSubscriptions({
          skuAndroid: 'com.app.premium',
          packageNameAndroid: 'com.yourcompany.app',
        })
      }
    />
  );
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`try await OpenIapModule.shared.deepLinkToSubscriptions()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`openIapStore.deepLinkToSubscriptions(
    DeepLinkOptions(
        skuAndroid = "com.app.premium",
        packageNameAndroid = "com.yourcompany.app"
    )
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`kmpIAP.deepLinkToSubscriptions(
    DeepLinkOptions(
        skuAndroid = "com.app.premium",
        packageNameAndroid = "com.yourcompany.app"
    )
)`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`await FlutterInappPurchase.instance.deepLinkToSubscriptions(
  skuAndroid: 'com.app.premium',
  packageNameAndroid: 'com.yourcompany.app',
);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`var options = DeepLinkOptions.new()
options.sku_android = "com.app.premium"
options.package_name_android = "com.yourcompany.app"
await iap.deep_link_to_subscriptions(options)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p className="type-link">
        Live example:{' '}
        <a
          href="https://github.com/hyodotdev/openiap/blob/main/libraries/expo-iap/example/app/subscription-flow.tsx"
          target="_blank"
          rel="noopener noreferrer"
        >
          expo-iap
        </a>{' '}
        ·{' '}
        <a
          href="https://github.com/hyodotdev/openiap/blob/main/libraries/react-native-iap/example/screens/SubscriptionFlow.tsx"
          target="_blank"
          rel="noopener noreferrer"
        >
          react-native-iap
        </a>{' '}
        ·{' '}
        <a
          href="https://github.com/hyodotdev/openiap/blob/main/libraries/flutter_inapp_purchase/example/lib/src/screens/subscription_flow_screen.dart"
          target="_blank"
          rel="noopener noreferrer"
        >
          flutter_inapp_purchase
        </a>{' '}
        ·{' '}
        <a
          href="https://github.com/hyodotdev/openiap/blob/main/libraries/kmp-iap/example/composeApp/src/commonMain/kotlin/dev/hyo/martie/screens/SubscriptionFlowScreen.kt"
          target="_blank"
          rel="noopener noreferrer"
        >
          kmp-iap
        </a>
      </p>

      <p className="type-link">
        See:{' '}
        <Link to="/docs/apis/ios/show-manage-subscriptions-ios">
          showManageSubscriptionsIOS
        </Link>
      </p>
    </div>
  );
}

export default DeepLinkToSubscriptions;
