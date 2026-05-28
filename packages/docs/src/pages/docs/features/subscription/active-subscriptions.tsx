import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import PlatformTabs from '../../../../components/PlatformTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function ActiveSubscriptions() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Active Subscriptions"
        description="Check active subscription state across Apple, Google Play, Meta Horizon, and Amazon Fire OS using OpenIAP."
        path="/docs/features/subscription/active-subscriptions"
        keywords="active subscriptions, subscription group, currentPlanId, productId, Fire OS subscription"
      />

      <h1>Active Subscriptions</h1>
      <p>
        Active subscription checks answer the runtime question: which paid plan
        should this user receive right now? OpenIAP keeps that workflow
        consistent across Apple, Google Play, Meta Horizon, and Amazon Fire OS
        by returning <code>ActiveSubscription</code> objects keyed by store
        product identity instead of requiring app code to branch on each store's
        subscription-group model.
      </p>

      <section>
        <AnchorLink id="recommended-flow" level="h2">
          Recommended Flow
        </AnchorLink>
        <ol>
          <li>
            Configure subscription products in each store with stable product
            IDs/SKUs for every plan you need to grant.
          </li>
          <li>
            Fetch the product catalog with <code>fetchProducts</code> before
            purchase so the SDK knows the store product type and available
            offers.
          </li>
          <li>
            Call <code>requestPurchase</code> with the selected subscription SKU
            or offer.
          </li>
          <li>
            On app launch, after purchase updates, and after restore, call{' '}
            <code>getActiveSubscriptions</code> or{' '}
            <code>hasActiveSubscriptions</code> with the subscription IDs your
            feature accepts.
          </li>
          <li>
            For server-backed access, verify with IAPKit or your store server
            API and treat the server result as authoritative.
          </li>
        </ol>

        <p>
          Do not build entitlement logic around a universal subscription group
          field. Stores expose group information differently. The stable
          cross-store fields are <code>productId</code>,{' '}
          <code>currentPlanId</code> when available, and the store purchase
          token/transaction ID for verification.
        </p>
      </section>

      <section>
        <AnchorLink id="api-usage" level="h2">
          API Usage
        </AnchorLink>
        <p>
          The same app code works for the native packages and framework SDKs.
          Pass the product IDs/SKUs that unlock the feature; OpenIAP filters the
          active store entitlements and returns the matching subscriptions.
        </p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { getActiveSubscriptions, hasActiveSubscriptions } from 'expo-iap';

// React Native apps can import the same APIs from 'react-native-iap'.
const premiumIds = [
  'dev.hyo.martie.premium',
  'dev.hyo.martie.premium_year',
];

const active = await getActiveSubscriptions(premiumIds);
const canUsePremium = active.some((sub) => sub.isActive);

for (const sub of active) {
  console.log(sub.productId);      // Store product/SKU
  console.log(sub.currentPlanId);  // Base plan or current product ID when available
  console.log(sub.purchaseToken);  // Verify on your server/IAPKit
}

const hasPremium = await hasActiveSubscriptions(premiumIds);`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIAP

let premiumIds = [
    "dev.hyo.martie.premium",
    "dev.hyo.martie.premium_year"
]

let active = try await OpenIapModule.shared.getActiveSubscriptions(premiumIds)
let canUsePremium = active.contains { $0.isActive }

for subscription in active {
    print(subscription.productId)      // Store product ID
    print(subscription.currentPlanId)  // iOS product ID
    print(subscription.transactionId)  // Verify on your server/IAPKit
}

let hasPremium = try await OpenIapModule.shared.hasActiveSubscriptions(premiumIds)`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`val premiumIds = listOf(
    "dev.hyo.martie.premium",
    "dev.hyo.martie.premium_year"
)

val active = openIapStore.getActiveSubscriptions(premiumIds)
val canUsePremium = active.any { it.isActive }

active.forEach { subscription ->
    println(subscription.productId)      // Store product/SKU
    println(subscription.currentPlanId)  // Base plan or current product ID
    println(subscription.purchaseToken)  // Verify on your server/IAPKit
}

val hasPremium = openIapStore.hasActiveSubscriptions(premiumIds)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`final premiumIds = [
  'dev.hyo.martie.premium',
  'dev.hyo.martie.premium_year',
];

final active = await FlutterInappPurchase.instance
    .getActiveSubscriptions(subscriptionIds: premiumIds);
final canUsePremium = active.any((sub) => sub.isActive);

final hasPremium = await FlutterInappPurchase.instance
    .hasActiveSubscriptions(subscriptionIds: premiumIds);`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`var premiumIds = new List<string>
{
    "dev.hyo.martie.premium",
    "dev.hyo.martie.premium_year"
};

var active = await ((QueryResolver)Iap.Instance)
    .GetActiveSubscriptionsAsync(premiumIds);
var canUsePremium = active.Any(sub => sub.IsActive);

var hasPremium = await ((QueryResolver)Iap.Instance)
    .HasActiveSubscriptionsAsync(premiumIds);`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="store-behavior" level="h2">
          Store Behavior
        </AnchorLink>

        <PlatformTabs>
          {{
            ios: (
              <>
                <h3>Apple App Store</h3>
                <p>
                  Apple has a real subscription group in App Store Connect, and
                  StoreKit transactions expose <code>subscriptionGroupID</code>.
                  OpenIAP keeps that platform detail on iOS purchase objects as{' '}
                  <code>subscriptionGroupIdIOS</code>.
                </p>
                <p>
                  For active entitlement checks, use <code>productId</code> and{' '}
                  <code>currentPlanId</code>. On iOS, <code>currentPlanId</code>{' '}
                  is the current StoreKit product ID, so multiple subscription
                  groups can return multiple active entries without being merged
                  together.
                </p>
                <ul>
                  <li>
                    Upgrade/downgrade rules still depend on Apple subscription
                    group ordering.
                  </li>
                  <li>
                    <code>renewalInfoIOS.autoRenewPreference</code> shows the
                    product that will renew next.
                  </li>
                  <li>
                    <code>getActiveSubscriptions</code> reads current StoreKit
                    entitlements and filters by product ID.
                  </li>
                </ul>
              </>
            ),
            android: (
              <>
                <h3>Google Play</h3>
                <p>
                  Google Play models subscriptions as subscription products with
                  base plans and offers. OpenIAP returns the active subscription
                  product in <code>productId</code> and the base plan in{' '}
                  <code>currentPlanId</code> / <code>basePlanIdAndroid</code>{' '}
                  when the billing response provides it.
                </p>
                <p>
                  If your app has multiple subscription products or multiple
                  plan families, pass all product IDs that unlock the feature to{' '}
                  <code>getActiveSubscriptions</code>. The SDK does not collapse
                  different products into one group.
                </p>
                <ul>
                  <li>
                    Use <code>purchaseToken</code> for Play Developer API
                    verification.
                  </li>
                  <li>
                    Use <code>subscriptionOffers</code> from{' '}
                    <code>fetchProducts</code> when starting a subscription.
                  </li>
                  <li>
                    For complete lifecycle state, sync RTDN and Play Developer
                    API data on your server or IAPKit.
                  </li>
                </ul>
              </>
            ),
            horizon: (
              <>
                <h3>Meta Horizon OS</h3>
                <p>
                  Horizon uses a Google Billing-compatible API surface, so the
                  app code stays close to the Google Play path. OpenIAP returns
                  active subscriptions by <code>productId</code>,{' '}
                  <code>currentPlanId</code>, and <code>purchaseToken</code>.
                </p>
                <p>
                  There is no cross-store group ID to rely on here. Treat the
                  Horizon product IDs in your catalog as the entitlement keys
                  and verify purchases with your backend or IAPKit when access
                  must be authoritative.
                </p>
              </>
            ),
            amazon: (
              <>
                <h3>Amazon Fire OS</h3>
                <p>
                  Amazon Appstore receipts do not expose an Apple-style group
                  ID. OpenIAP normalizes Fire OS subscriptions to the same
                  Android shape: <code>productId</code> and{' '}
                  <code>currentPlanId</code> are the subscription SKU, and{' '}
                  <code>purchaseToken</code> is the Amazon receipt ID.
                </p>
                <p>
                  During a purchase, the Amazon adapter correlates the
                  requestId-backed purchase response with the requested SKU, so
                  example and framework code do not need ad-hoc receipt alias
                  handling. Restore and cold-start entitlement checks should
                  still use the store receipt data and server/IAPKit
                  verification instead of app-local SKU alias storage.
                </p>
                <ul>
                  <li>
                    Keep Amazon product IDs, App Tester data, and IAPKit product
                    mappings aligned.
                  </li>
                  <li>
                    Call <code>fetchProducts</code> before purchasing so the
                    adapter can cache product type information.
                  </li>
                  <li>
                    Call <code>getActiveSubscriptions</code> with the same SKU
                    list you use for Google Play or Horizon.
                  </li>
                </ul>
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="entitlement-design" level="h2">
          Entitlement Design
        </AnchorLink>
        <p>
          For app UI, map your feature to an accepted set of product IDs. For
          backend authorization, send <code>purchaseToken</code> /{' '}
          <code>transactionId</code> to your server and verify with the relevant
          store API or{' '}
          <Link to="/docs/kit-backend">
            <code>IAPKit</code>
          </Link>
          . The client-side active subscription list is useful for immediate UI
          state, but the server should own durable entitlement decisions.
        </p>

        <CodeBlock language="typescript">{`const premiumProductIds = new Set([
  'dev.hyo.martie.premium',
  'dev.hyo.martie.premium_year',
]);

function grantsPremium(subscription: ActiveSubscription) {
  return subscription.isActive && premiumProductIds.has(subscription.productId);
}`}</CodeBlock>
      </section>
    </div>
  );
}

export default ActiveSubscriptions;
