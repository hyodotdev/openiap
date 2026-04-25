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

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`deepLinkToSubscriptions(options: DeepLinkOptions): Promise<void>

interface DeepLinkOptions {
  skuAndroid?: string;
  packageNameAndroid?: string;
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func deepLinkToSubscriptions() async throws`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun deepLinkToSubscriptions(options: DeepLinkOptions)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun deepLinkToSubscriptions(options: DeepLinkOptions)`}</CodeBlock>
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
            <CodeBlock language="typescript">{`import { deepLinkToSubscriptions } from 'expo-iap';

await deepLinkToSubscriptions({
  skuAndroid: 'com.app.premium',
  packageNameAndroid: 'com.yourcompany.app',
});`}</CodeBlock>
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
