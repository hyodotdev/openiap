import { Link } from 'react-router-dom';
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
        <strong>iOS:</strong> Opens{' '}
        <code>https://apps.apple.com/account/subscriptions</code> (universal
        link) so the user can manage subscriptions in the App Store.{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/manage-subscriptions-in-your-app"
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
        See:{' '}
        <Link to="/docs/apis/ios/show-manage-subscriptions-ios">
          showManageSubscriptionsIOS
        </Link>
      </p>
    </div>
  );
}

export default DeepLinkToSubscriptions;
