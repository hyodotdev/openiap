import { Link } from 'react-router-dom'
import AnchorLink from '../../components/AnchorLink'
import CodeBlock from '../../components/CodeBlock'
import { useScrollToHash } from '../../hooks/useScrollToHash'

function APIs() {
  useScrollToHash()
  
  return (
    <div className="doc-page">
      <h1>APIs</h1>
      
      <section>
        <AnchorLink id="product-management" level="h2">Product Management</AnchorLink>
        
        <AnchorLink id="requestproducts" level="h3">requestProducts</AnchorLink>
        <p>Retrieve products or subscriptions from the store.</p>
        <CodeBlock language="graphql">{`requestProducts(params: ProductRequest!): Future<[Product]>

type ProductRequest {
  skus: [String]!
  type: ProductType! # "inapp" | "subs"
}`}</CodeBlock>
        <p className="type-link">See: <Link to="/docs/types#product">Product</Link></p>
        <p>Returns a future that completes with an array of products or subscriptions matching the provided SKUs. Use <code>type: "inapp"</code> for regular products and <code>type: "subs"</code> for subscriptions.</p>

        <AnchorLink id="getavailablepurchases" level="h3">getAvailablePurchases</AnchorLink>
        <p>Get all available purchases for the current user.</p>
        <CodeBlock language="graphql">{`getAvailablePurchases(options: PurchaseOptions?): Future<[Purchase]>

type PurchaseOptions {
  alsoPublishToEventListener: Boolean?
  onlyIncludeActiveItems: Boolean?
}`}</CodeBlock>
        <p className="type-link">See: <Link to="/docs/types#purchase">Purchase</Link></p>
        <p>Returns a future that completes with all non-consumed purchases. On iOS, this includes purchase history. On Android with Google Play Billing v8+, only active purchases are returned.</p>

        <AnchorLink id="getpurchasehistories" level="h3">getPurchaseHistories</AnchorLink>
        <p>Get purchase history (iOS only).</p>
        <CodeBlock language="graphql">{`getPurchaseHistories(options: PurchaseOptions?): Future<[ProductPurchase]>

type PurchaseOptions {
  alsoPublishToEventListener: Boolean?
  onlyIncludeActiveItems: Boolean?
}`}</CodeBlock>
        <p className="type-link">See: <Link to="/docs/types#product-purchase">ProductPurchase</Link></p>
        <p><strong>Note:</strong> On Android with Google Play Billing v8+, this returns an empty array as purchase history is no longer available. Use <code>getAvailablePurchases</code> instead to get active purchases.</p>
      </section>

      <section>
        <AnchorLink id="purchase-operations" level="h2">Purchase Operations</AnchorLink>
        
        <AnchorLink id="requestpurchase" level="h3">requestPurchase</AnchorLink>
        <p>Request a purchase (one-time or subscription).</p>
        <CodeBlock language="graphql">{`requestPurchase(request: UnifiedPurchaseRequest!): Future<Purchase>`}</CodeBlock>
        <p className="type-link">See: <Link to="/docs/types#unified-purchase-request">UnifiedPurchaseRequest</Link>, <Link to="/docs/types#purchase">Purchase</Link></p>
        <p>Initiates a purchase flow for any product type and returns a future that completes when the purchase succeeds.</p>

        <AnchorLink id="finishtransaction" level="h3">finishTransaction</AnchorLink>
        <p>Complete a purchase transaction. Must be called after successful verification.</p>
        <CodeBlock language="graphql">{`finishTransaction(purchase: Purchase!, isConsumable: Boolean?): Future<Void>`}</CodeBlock>
        <p className="type-link">See: <Link to="/docs/types#purchase">Purchase</Link></p>
        <p>This is a unified API that internally handles platform-specific requirements:</p>
        <ul>
          <li><strong>iOS</strong>: Calls <code>finishTransactionIOS()</code> to remove the transaction from the payment queue</li>
          <li><strong>Android Consumables</strong>: Calls <code>consumePurchaseAndroid()</code> to mark the product as consumed</li>
          <li><strong>Android Non-consumables/Subscriptions</strong>: Calls <code>acknowledgePurchaseAndroid()</code> to acknowledge the purchase</li>
        </ul>
        <p><strong>Important</strong>: Always call this after validating the receipt to avoid losing track of purchases.</p>
      </section>

      <section>
        <AnchorLink id="validation" level="h2">Validation</AnchorLink>
        
        <AnchorLink id="validatereceipt" level="h3">validateReceipt</AnchorLink>
        <p>Validate a receipt with your server or platform servers.</p>
        <CodeBlock language="graphql">{`validateReceipt(options: ValidationOptions!): Future<ValidationResult>`}</CodeBlock>
        <p className="type-link">See: <Link to="/docs/types#validation-options">ValidationOptions</Link>, <Link to="/docs/types#validation-result">ValidationResult</Link></p>
        <p>Validates purchase receipts with the appropriate validation service.</p>

      </section>

      <section>
        <AnchorLink id="platform-specific-apis" level="h2">Platform-Specific APIs</AnchorLink>
        
        <AnchorLink id="ios-apis" level="h3">iOS APIs</AnchorLink>
        
        <AnchorLink id="finishtransactionios" level="h4">finishTransactionIOS</AnchorLink>
        <p>iOS-specific transaction completion.</p>
        <CodeBlock language="graphql">{`finishTransactionIOS(transactionId: String!): Future<Void>`}</CodeBlock>
        <p>Directly marks a transaction as finished in the StoreKit payment queue. Usually called internally by <code>finishTransaction()</code>.</p>

        <AnchorLink id="cleartransactionios" level="h4">clearTransactionIOS</AnchorLink>
        <p>Clear pending transactions.</p>
        <CodeBlock language="graphql">{`clearTransactionIOS(): Future<Void>`}</CodeBlock>
        <p>Removes all pending transactions from the iOS payment queue.</p>

        <AnchorLink id="clearproductsios" level="h4">clearProductsIOS</AnchorLink>
        <p>Clear the products cache.</p>
        <CodeBlock language="graphql">{`clearProductsIOS(): Future<Void>`}</CodeBlock>
        <p>Clears cached product information, forcing a refresh on next fetch.</p>

        <AnchorLink id="getstorefrontios" level="h4">getStorefrontIOS</AnchorLink>
        <p>Get the current App Store storefront country code.</p>
        <CodeBlock language="graphql">{`getStorefrontIOS(): Future<String>`}</CodeBlock>
        <p>Returns the storefront country code (e.g., "US", "GB", "JP").</p>
        
        <AnchorLink id="android-apis" level="h3">Android APIs</AnchorLink>
        
        <AnchorLink id="acknowledgepurchaseandroid" level="h4">acknowledgePurchaseAndroid</AnchorLink>
        <p>Acknowledge a non-consumable purchase or subscription.</p>
        <CodeBlock language="graphql">{`acknowledgePurchaseAndroid(purchaseToken: String!): Future<Void>`}</CodeBlock>
        <p>Acknowledges the purchase to Google Play. Required within 3 days or the purchase will be refunded. Usually called internally by <code>finishTransaction()</code>.</p>

        <AnchorLink id="consumepurchaseandroid" level="h4">consumePurchaseAndroid</AnchorLink>
        <p>Consume a purchase (for consumable products only).</p>
        <CodeBlock language="graphql">{`consumePurchaseAndroid(purchaseToken: String!): Future<Void>`}</CodeBlock>
        <p>Marks a consumable product as consumed, allowing repurchase. Automatically acknowledges the purchase. Usually called internally by <code>finishTransaction()</code> for consumables.</p>
      </section>

      <section>
        <AnchorLink id="connection-management" level="h2">Connection Management</AnchorLink>
        
        <AnchorLink id="initconnection" level="h3">initConnection</AnchorLink>
        <p>Initialize connection to the store service.</p>
        <CodeBlock language="graphql">{`initConnection(): Future<Boolean>`}</CodeBlock>
        <p>Establishes connection with the platform's billing service. Returns true if successful.</p>

        <AnchorLink id="endconnection" level="h3">endConnection</AnchorLink>
        <p>End connection to the store service.</p>
        <CodeBlock language="graphql">{`endConnection(): Future<Boolean>`}</CodeBlock>
        <p>Closes the connection and cleans up resources. Returns true if successful.</p>
      </section>

      <section>
        <AnchorLink id="subscription-management" level="h2">Subscription Management</AnchorLink>
        
        <AnchorLink id="deeplinktosubscriptions" level="h3">deepLinkToSubscriptions</AnchorLink>
        <p>Open native subscription management interface.</p>
        <CodeBlock language="graphql">{`deepLinkToSubscriptions(options: DeepLinkOptions): Future<Void>

type DeepLinkOptions {
  skuAndroid: String?        # Required on Android
  packageNameAndroid: String? # Required on Android
}`}</CodeBlock>
        <p>Opens the platform's native subscription management interface where users can view and manage their subscriptions.</p>
      </section>

    </div>
  )
}

export default APIs