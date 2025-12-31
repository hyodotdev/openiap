import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function PurchaseAPIs() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Purchase APIs"
        description="OpenIAP purchase APIs - requestPurchase, finishTransaction, restorePurchases, and getStorefront for managing in-app purchases."
        path="/docs/apis/purchase"
        keywords="requestPurchase, finishTransaction, restorePurchases, purchase flow"
      />
      <h1>Purchase APIs</h1>
      <p>
        APIs for requesting purchases, completing transactions, and restoring
        previous purchases.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <a href="#request-purchase"><code>requestPurchase</code></a>: Initiate purchase (event-based, not
            promise-based)
          </li>
          <li>
            <a href="#finish-transaction"><code>finishTransaction</code></a>: Complete transaction after
            verification
          </li>
          <li>
            <a href="#restore-purchases"><code>restorePurchases</code></a>: Restore user's previous purchases
          </li>
          <li>
            <a href="#get-storefront"><code>getStorefront</code></a>: Get user's country/region
          </li>
        </ul>
      </TLDRBox>

      <div className="alert-card alert-card--warning">
        <p>
          <strong>Important:</strong> <code>requestPurchase</code> is
          event-based, not promise-based. Set up{' '}
          <code>purchaseUpdatedListener</code> before calling it. See{' '}
          <Link to="/docs/events">Events</Link> for details.
        </p>
      </div>

      <section>
        <AnchorLink id="request-purchase" level="h2">
          requestPurchase
        </AnchorLink>
        <p>
          Initiate a purchase flow. The result is delivered through{' '}
          <code>purchaseUpdatedListener</code>, not the return value.
        </p>

        <h4>Signature</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`requestPurchase(props: RequestPurchaseProps): Promise<Purchase | void>

type RequestPurchaseProps =
  | { request: RequestPurchasePropsByPlatforms; type: 'inapp' }
  | { request: RequestSubscriptionPropsByPlatforms; type: 'subs' }`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`func requestPurchase(_ props: RequestPurchaseProps) async throws -> Purchase?`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`suspend fun requestPurchase(props: RequestPurchaseProps): List<Purchase>`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`Future<Purchase?> requestPurchase(RequestPurchaseProps props);`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func request_purchase(props: RequestPurchaseProps) -> Purchase`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <h4>Example</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { requestPurchase } from 'expo-iap';

// Purchase a one-time product
await requestPurchase({
  request: {
    apple: { sku: 'com.app.premium' },
    google: { skus: ['com.app.premium'] },
  },
  type: 'inapp',
});

// Purchase a subscription
await requestPurchase({
  request: {
    apple: { sku: 'com.app.monthly' },
    google: {
      skus: ['com.app.monthly'],
      subscriptionOffers: [{
        sku: 'com.app.monthly',
        offerToken: 'offer-token-from-product',
      }],
    },
  },
  type: 'subs',
});`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`try await OpenIapModule.shared.requestPurchase(
    RequestPurchaseProps(
        request: RequestPurchasePropsByPlatforms(
            apple: RequestPurchaseIosProps(sku: "com.app.premium")
        ),
        type: .inapp
    )
)`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`openIapStore.requestPurchase(
    RequestPurchaseProps(
        request = RequestPurchasePropsByPlatforms(
            google = RequestPurchaseAndroidProps(skus = listOf("com.app.premium"))
        ),
        type = ProductQueryType.InApp
    )
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`await FlutterInappPurchase.instance.requestPurchase('com.app.premium');`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Purchase a one-time product
var props = RequestPurchaseProps.new()
props.request = RequestPurchasePropsByPlatforms.new()
props.request.apple = RequestPurchaseIosProps.new()
props.request.apple.sku = "com.app.premium"
props.request.google = RequestPurchaseAndroidProps.new()
props.request.google.skus = ["com.app.premium"]
props.type = ProductQueryType.IN_APP

await iap.request_purchase(props)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <p className="type-link">
          See:{' '}
          <Link to="/docs/types#request-purchase-props">
            RequestPurchaseProps
          </Link>
        </p>
      </section>

      <section>
        <AnchorLink id="finish-transaction" level="h2">
          finishTransaction
        </AnchorLink>
        <p>
          Complete a purchase transaction. <strong>Must be called</strong> after
          verifying the purchase to remove it from the queue.
        </p>

        <h4>Signature</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`finishTransaction(purchase: Purchase, isConsumable?: boolean): Promise<void>`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`func finishTransaction(_ purchase: Purchase) async throws`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`suspend fun finishTransaction(purchase: Purchase, isConsumable: Boolean = false)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`Future<void> finishTransaction(Purchase purchase, {bool isConsumable = false});`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func finish_transaction(purchase: Purchase, is_consumable: bool = false) -> void`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <h4>isConsumable Parameter</h4>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>isConsumable</th>
              <th>Behavior</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Consumable</td>
              <td>
                <code>true</code>
              </td>
              <td>Product can be purchased again (coins, gems)</td>
            </tr>
            <tr>
              <td>Non-consumable</td>
              <td>
                <code>false</code>
              </td>
              <td>One-time purchase (premium unlock)</td>
            </tr>
            <tr>
              <td>Subscription</td>
              <td>
                <code>false</code>
              </td>
              <td>Managed by the store</td>
            </tr>
          </tbody>
        </table>

        <h4>Example</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { finishTransaction, purchaseUpdatedListener } from 'expo-iap';

purchaseUpdatedListener(async (purchase) => {
  // 1. Verify on your server
  const verified = await verifyOnServer(purchase);
  if (!verified) return;

  // 2. Grant entitlement to user
  await grantProduct(purchase.productId);

  // 3. Finish the transaction
  const isConsumable = purchase.productId.includes('coins');
  await finishTransaction(purchase, isConsumable);
});`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`try await OpenIapModule.shared.finishTransaction(purchase, isConsumable: false)`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`openIapStore.finishTransaction(purchase, isConsumable = false)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`await FlutterInappPurchase.instance.finishTransaction(purchase);`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Handle purchase update
func _on_purchase_updated(purchase: Purchase):
    # 1. Verify on your server
    var verified = await verify_on_server(purchase)
    if not verified:
        return

    # 2. Grant entitlement to user
    await grant_product(purchase.product_id)

    # 3. Finish the transaction
    var is_consumable = "coins" in purchase.product_id
    await iap.finish_transaction(purchase, is_consumable)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <div className="alert-card alert-card--warning">
          <p>
            <strong>Critical:</strong> Android purchases must be acknowledged
            within 3 days or they will be automatically refunded. iOS
            transactions will replay on every app launch if not finished.
          </p>
        </div>
      </section>

      <section>
        <AnchorLink id="restore-purchases" level="h2">
          restorePurchases
        </AnchorLink>
        <p>
          Restore completed transactions. Use this to implement a "Restore
          Purchases" button for users who reinstall the app.
        </p>

        <h4>Signature</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`restorePurchases(): Promise<void>`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`func restorePurchases() async throws`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`suspend fun restorePurchases()`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`Future<void> restorePurchases();`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func restore_purchases() -> void`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <h4>Example</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { restorePurchases, getAvailablePurchases } from 'expo-iap';

const handleRestore = async () => {
  await restorePurchases();
  const purchases = await getAvailablePurchases();

  for (const purchase of purchases) {
    // Re-grant entitlements
    await grantProduct(purchase.productId);
  }
};`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`try await OpenIapModule.shared.restorePurchases()`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`openIapStore.restorePurchases()`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`await FlutterInappPurchase.instance.restorePurchases();`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func _on_restore_pressed():
    await iap.restore_purchases()
    var purchases = await iap.get_available_purchases()

    for purchase in purchases:
        # Re-grant entitlements
        await grant_product(purchase.product_id)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="get-storefront" level="h2">
          getStorefront
        </AnchorLink>
        <p>Get the storefront country code for the active user.</p>

        <h4>Signature</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`getStorefront(): Promise<string>`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`func getStorefront() async throws -> String`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`suspend fun getStorefront(): String`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`Future<String> getStorefront();`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func get_storefront() -> String`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <h4>Example</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { getStorefront } from 'expo-iap';

const countryCode = await getStorefront();
console.log(countryCode); // "US", "JP", "GB", etc.`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`let countryCode = try await OpenIapModule.shared.getStorefront()`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`val countryCode = openIapStore.getStorefront()`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`final countryCode = await FlutterInappPurchase.instance.getStorefront();`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`var country_code = await iap.get_storefront()
print(country_code)  # "US", "JP", "GB", etc.`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <p>
          Returns the ISO 3166-1 alpha-2 country code. Returns an empty string
          when the storefront cannot be determined.
        </p>
      </section>
    </div>
  );
}

export default PurchaseAPIs;
