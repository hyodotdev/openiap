import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function SubscriptionAPIs() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Subscription APIs"
        description="OpenIAP subscription management APIs - getActiveSubscriptions, hasActiveSubscriptions, and deepLinkToSubscriptions."
        path="/docs/apis/subscription"
        keywords="getActiveSubscriptions, hasActiveSubscriptions, subscription management, auto-renewable"
      />
      <h1>Subscription APIs</h1>
      <p>
        APIs for managing auto-renewable subscriptions, checking status, and
        opening subscription management.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <a href="#get-active-subscriptions"><code>getActiveSubscriptions</code></a>: Get all active subscriptions
            with renewal info
          </li>
          <li>
            <a href="#has-active-subscriptions"><code>hasActiveSubscriptions</code></a>: Quick check if user has any
            active subscription
          </li>
          <li>
            <a href="#deep-link-to-subscriptions"><code>deepLinkToSubscriptions</code></a>: Open native subscription
            management
          </li>
        </ul>
      </TLDRBox>

      <section>
        <AnchorLink id="get-active-subscriptions" level="h2">
          getActiveSubscriptions
        </AnchorLink>
        <p>
          Get all active subscriptions with detailed renewal status information.
        </p>

        <h4>Signature</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`getActiveSubscriptions(subscriptionIds?: string[]): Promise<ActiveSubscription[]>`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`func getActiveSubscriptions(subscriptionIds: [String]? = nil) async throws -> [ActiveSubscription]`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`suspend fun getActiveSubscriptions(subscriptionIds: List<String>? = null): List<ActiveSubscription>`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`Future<List<ActiveSubscription>> getActiveSubscriptions({List<String>? subscriptionIds});`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func get_active_subscriptions(subscription_ids: Array[String] = []) -> Array[ActiveSubscription]`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <h4>Example</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { getActiveSubscriptions } from 'expo-iap';

// Get all active subscriptions
const subscriptions = await getActiveSubscriptions();

// Or filter by specific IDs
const premiumSubs = await getActiveSubscriptions(['premium_monthly', 'premium_yearly']);

for (const sub of subscriptions) {
  console.log(\`Product: \${sub.productId}\`);
  console.log(\`Expires: \${sub.expirationDate}\`);

  // iOS: Check renewal status
  if (sub.renewalInfoIOS?.willAutoRenew === false) {
    console.log('Subscription cancelled, will not renew');
  }

  // iOS: Check for pending upgrade
  if (sub.renewalInfoIOS?.pendingUpgradeProductId) {
    console.log(\`Upgrading to \${sub.renewalInfoIOS.pendingUpgradeProductId}\`);
  }
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`let subscriptions = try await OpenIapModule.shared.getActiveSubscriptions()

for sub in subscriptions {
    if sub.renewalInfoIOS?.willAutoRenew == false {
        print("Subscription cancelled")
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`val subscriptions = openIapStore.getActiveSubscriptions()

for (sub in subscriptions) {
    if (sub.autoRenewingAndroid == false) {
        println("Subscription cancelled")
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`final subscriptions = await FlutterInappPurchase.instance.getActiveSubscriptions();`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Get all active subscriptions
var subscriptions = await iap.get_active_subscriptions()

# Or filter by specific IDs
var premium_subs = await iap.get_active_subscriptions(["premium_monthly", "premium_yearly"])

for sub in subscriptions:
    print("Product: %s" % sub.product_id)
    print("Expires: %s" % sub.expiration_date_ios)

    # Check renewal status (Android)
    if not sub.auto_renewing_android:
        print("Subscription cancelled, will not renew")`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <div className="alert-card alert-card--success">
          <p>
            <strong>iOS Renewal Info:</strong> Each subscription includes{' '}
            <code>renewalInfoIOS</code> with:
          </p>
          <ul>
            <li>
              <code>willAutoRenew</code> - Whether subscription will auto-renew
            </li>
            <li>
              <code>pendingUpgradeProductId</code> - Product ID of pending
              upgrade
            </li>
            <li>
              <code>renewalDate</code> - Next renewal date
            </li>
            <li>
              <code>expirationReason</code> - Why subscription expired
            </li>
          </ul>
        </div>

        <p className="type-link">
          See:{' '}
          <Link to="/docs/types#active-subscription">ActiveSubscription</Link>
        </p>
      </section>

      <section>
        <AnchorLink id="has-active-subscriptions" level="h2">
          hasActiveSubscriptions
        </AnchorLink>
        <p>Quick check if the user has any active subscriptions.</p>

        <h4>Signature</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`hasActiveSubscriptions(subscriptionIds?: string[]): Promise<boolean>`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`func hasActiveSubscriptions(subscriptionIds: [String]? = nil) async throws -> Bool`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`suspend fun hasActiveSubscriptions(subscriptionIds: List<String>? = null): Boolean`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`Future<bool> hasActiveSubscriptions({List<String>? subscriptionIds});`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func has_active_subscriptions(subscription_ids: Array[String] = []) -> bool`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <h4>Example</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { hasActiveSubscriptions } from 'expo-iap';

// Check any subscription
const isPremium = await hasActiveSubscriptions();

// Check specific subscriptions
const hasProPlan = await hasActiveSubscriptions(['pro_monthly', 'pro_yearly']);

if (isPremium) {
  // Show premium features
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`let isPremium = try await OpenIapModule.shared.hasActiveSubscriptions()`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`val isPremium = openIapStore.hasActiveSubscriptions()`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`final isPremium = await FlutterInappPurchase.instance.hasActiveSubscriptions();`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Check any subscription
var is_premium = await iap.has_active_subscriptions()

# Check specific subscriptions
var has_pro_plan = await iap.has_active_subscriptions(["pro_monthly", "pro_yearly"])

if is_premium:
    # Show premium features
    pass`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="deep-link-to-subscriptions" level="h2">
          deepLinkToSubscriptions
        </AnchorLink>
        <p>
          Open the native subscription management interface where users can view
          and manage their subscriptions.
        </p>

        <h4>Signature</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`deepLinkToSubscriptions(options: DeepLinkOptions): Promise<void>

interface DeepLinkOptions {
  skuAndroid?: string;         // Required on Android
  packageNameAndroid?: string; // Required on Android
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`func deepLinkToSubscriptions() async throws`}</CodeBlock>
            ),
            kotlin: (
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

        <h4>Example</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { deepLinkToSubscriptions } from 'expo-iap';
import { Platform } from 'react-native';

const openSubscriptionManagement = async () => {
  await deepLinkToSubscriptions({
    // Android requires these
    skuAndroid: 'com.app.premium',
    packageNameAndroid: 'com.yourcompany.app',
  });
};`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Opens Settings app subscription management
try await OpenIapModule.shared.deepLinkToSubscriptions()`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`openIapStore.deepLinkToSubscriptions(
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
              <CodeBlock language="gdscript">{`# Open subscription management (Android)
var options = DeepLinkOptions.new()
options.sku_android = "com.app.premium"
options.package_name_android = "com.yourcompany.app"
await iap.deep_link_to_subscriptions(options)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <p>
          <strong>Platform behavior:</strong>
        </p>
        <ul>
          <li>
            <strong>iOS:</strong> Opens the Settings app subscription
            management. Also see{' '}
            <Link to="/docs/apis/ios#show-manage-subscriptions-ios">
              showManageSubscriptionsIOS
            </Link>{' '}
            for an in-app UI.
          </li>
          <li>
            <strong>Android:</strong> Opens Google Play subscription management
            for the specified SKU.
          </li>
        </ul>
      </section>
    </div>
  );
}

export default SubscriptionAPIs;
