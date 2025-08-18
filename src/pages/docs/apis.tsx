import { Link } from 'react-router-dom';
import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function APIs() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <h1>APIs</h1>

      <section>
        <AnchorLink id="terminology" level="h2">
          Terminology
        </AnchorLink>

        <AnchorLink id="request-apis" level="h3">
          Request APIs
        </AnchorLink>
        <blockquote className="terminology-note">
          <p>
            <strong>⚠️ Important:</strong> APIs starting with{' '}
            <code>request</code> are event-based operations, not promise-based.
          </p>
          <p>
            While these APIs return values for various purposes, you should{' '}
            <strong>
              not rely on their return values for actual purchase results
            </strong>
            . Instead, listen for events through{' '}
            <code>purchaseUpdatedListener</code> or{' '}
            <code>purchaseErrorListener</code>.
          </p>
          <p>
            This is because Apple's purchase system is fundamentally
            event-based, not promise-based. For more details, see this{' '}
            <a
              href="https://github.com/hyochan/react-native-iap/issues/307#issuecomment-449208083"
              target="_blank"
              rel="noopener noreferrer"
            >
              issue comment
            </a>
            .
          </p>
          <p>
            The <code>request</code> prefix indicates that these are event
            requests - use the appropriate listeners to handle the actual
            results.
          </p>
        </blockquote>
      </section>

      <section>
        <AnchorLink id="product-management" level="h2">
          Product Management
        </AnchorLink>

        <AnchorLink id="requestproducts" level="h3">
          requestProducts
        </AnchorLink>
        <p>Retrieve products or subscriptions from the store.</p>
        <CodeBlock language="graphql">{`"""
Returns: [Product!]!
"""
requestProducts(params: ProductRequest!): Future

type ProductRequest {
  skus: [String]!
  type: ProductType! "Values: inapp | subs"
}`}</CodeBlock>
        <p className="type-link">
          See: <Link to="/docs/types#product">Product</Link>
        </p>
        <p>
          Returns a future that completes with an array of products or
          subscriptions matching the provided SKUs. Use{' '}
          <code>type: "inapp"</code> for regular products and{' '}
          <code>type: "subs"</code> for subscriptions.
        </p>

        <AnchorLink id="getavailablepurchases" level="h3">
          getAvailablePurchases
        </AnchorLink>
        <p>Get all available purchases for the current user.</p>
        <CodeBlock language="graphql">{`"""
Returns: [Purchase!]!
"""
getAvailablePurchases(options: PurchaseOptions?): Future

type PurchaseOptions {
  alsoPublishToEventListener: Boolean?
  onlyIncludeActiveItems: Boolean?
}`}</CodeBlock>
        <p className="type-link">
          See: <Link to="/docs/types#purchase">Purchase</Link>
        </p>
        <p>
          Returns a future that completes with all non-consumed purchases. On
          iOS, this includes purchase history. On Android with Google Play
          Billing v8+, only active purchases are returned.
        </p>

        <AnchorLink id="getpurchasehistories" level="h3">
          getPurchaseHistories
        </AnchorLink>
        <p>Get purchase history (iOS only).</p>
        <CodeBlock language="graphql">{`"""
Returns: [ProductPurchase!]!
"""
getPurchaseHistories(options: PurchaseOptions?): Future

type PurchaseOptions {
  alsoPublishToEventListener: Boolean?
  onlyIncludeActiveItems: Boolean?
}`}</CodeBlock>
        <p className="type-link">
          See: <Link to="/docs/types#product-purchase">ProductPurchase</Link>
        </p>
        <p>
          <strong>Note:</strong> On Android with Google Play Billing v8+, this
          returns an empty array as purchase history is no longer available. Use{' '}
          <code>getAvailablePurchases</code> instead to get active purchases.
        </p>
      </section>

      <section>
        <AnchorLink id="purchase-operations" level="h2">
          Purchase Operations
        </AnchorLink>

        <AnchorLink id="requestpurchase" level="h3">
          requestPurchase
        </AnchorLink>
        <p>Request a purchase (one-time or subscription).</p>
        <CodeBlock language="graphql">{`"""
Returns: Purchase!
"""
requestPurchase(request: RequestPurchaseProps | RequestSubscriptionProps): Future`}</CodeBlock>
        <p className="type-link">
          See:{' '}
          <Link to="/docs/types#request-purchase-props">
            RequestPurchaseProps
          </Link>
          ,{' '}
          <Link to="/docs/types#request-subscription-props-by-platforms">
            RequestSubscriptionPropsByPlatforms
          </Link>
          , <Link to="/docs/types#purchase">Purchase</Link>
        </p>
        <p>
          Initiates a purchase flow for any product type and returns a future
          that completes when the purchase succeeds.
        </p>

        <AnchorLink id="finishtransaction" level="h3">
          finishTransaction
        </AnchorLink>
        <p>
          Complete a purchase transaction. Must be called after successful
          verification.
        </p>
        <CodeBlock language="graphql">{`"""
Returns: Void
"""
finishTransaction(purchase: Purchase!, isConsumable: Boolean?): Future`}</CodeBlock>
        <p className="type-link">
          See: <Link to="/docs/types#purchase">Purchase</Link>
        </p>
        <p>
          This is a unified API that internally handles platform-specific
          requirements:
        </p>
        <ul>
          <li>
            <strong>iOS</strong>: Calls <code>finishTransactionIOS()</code> to
            remove the transaction from the payment queue
          </li>
          <li>
            <strong>Android Consumables</strong>: Calls{' '}
            <code>consumePurchaseAndroid()</code> to mark the product as
            consumed
          </li>
          <li>
            <strong>Android Non-consumables/Subscriptions</strong>: Calls{' '}
            <code>acknowledgePurchaseAndroid()</code> to acknowledge the
            purchase
          </li>
        </ul>
        <p>
          <strong>Important</strong>: Always call this after validating the
          receipt to avoid losing track of purchases.
        </p>
      </section>

      <section>
        <AnchorLink id="validation" level="h2">
          Validation
        </AnchorLink>

        <AnchorLink id="validatereceipt" level="h3">
          validateReceipt
        </AnchorLink>
        <p>Validate a receipt with your server or platform servers.</p>
        <CodeBlock language="graphql">{`"""
Returns: ValidationResult!
"""
validateReceipt(options: ValidationOptions!): Future`}</CodeBlock>
        <p className="type-link">
          See:{' '}
          <Link to="/docs/types#validation-options">ValidationOptions</Link>,{' '}
          <Link to="/docs/types#validation-result">ValidationResult</Link>
        </p>
        <p>
          Validates purchase receipts with the appropriate validation service.
        </p>

        <AnchorLink id="purchase-identifier-usage" level="h3">
          Purchase Identifier Usage
        </AnchorLink>
        <p>
          After validating receipts, use the appropriate identifiers for content
          delivery and purchase tracking:
        </p>

        <h4>iOS Identifiers</h4>
        <table className="identifier-table">
          <thead>
            <tr>
              <th>Product Type</th>
              <th>Primary Identifier</th>
              <th>Usage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Consumable</strong>
              </td>
              <td>
                <code>transactionId</code>
              </td>
              <td>Track each purchase individually for content delivery</td>
            </tr>
            <tr>
              <td>
                <strong>Non-consumable</strong>
              </td>
              <td>
                <code>transactionId</code>
              </td>
              <td>
                Single purchase tracking (equals{' '}
                <code>originalTransactionIdentifierIOS</code>)
              </td>
            </tr>
            <tr>
              <td>
                <strong>Subscription</strong>
              </td>
              <td>
                <code>originalTransactionIdentifierIos</code>
              </td>
              <td>Track subscription ownership across renewals</td>
            </tr>
          </tbody>
        </table>

        <h4>Android Identifiers</h4>
        <table className="identifier-table">
          <thead>
            <tr>
              <th>Product Type</th>
              <th>Primary Identifier</th>
              <th>Usage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Consumable</strong>
              </td>
              <td>
                <code>purchaseToken</code>
              </td>
              <td>Track each purchase for content delivery</td>
            </tr>
            <tr>
              <td>
                <strong>Non-consumable</strong>
              </td>
              <td>
                <code>purchaseToken</code>
              </td>
              <td>Track ownership status</td>
            </tr>
            <tr>
              <td>
                <strong>Subscription</strong>
              </td>
              <td>
                <code>purchaseToken</code>
              </td>
              <td>
                Track current subscription status (each renewal has same token
                on Android)
              </td>
            </tr>
          </tbody>
        </table>

        <h4>Key Points</h4>
        <ul>
          <li>
            <strong>Idempotency</strong>: Use <code>transactionId</code> (iOS)
            or <code>purchaseToken</code> (Android) to prevent duplicate content
            delivery
          </li>
          <li>
            <strong>iOS Subscriptions</strong>: Each renewal creates a new{' '}
            <code>transactionId</code>, but{' '}
            <code>originalTransactionIdentifier</code> remains constant
          </li>
          <li>
            <strong>Android Subscriptions</strong>: The{' '}
            <code>purchaseToken</code> remains the same across normal renewals
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="platform-specific-apis" level="h2">
          Platform-Specific APIs
        </AnchorLink>

        <AnchorLink id="ios-apis" level="h3">
          iOS APIs
        </AnchorLink>

        <AnchorLink id="finishtransactionios" level="h4">
          finishTransactionIOS
        </AnchorLink>
        <p>iOS-specific transaction completion.</p>
        <CodeBlock language="graphql">{`"""
Returns: Void
"""
finishTransactionIOS(transactionId: String!): Future`}</CodeBlock>
        <p>
          Directly marks a transaction as finished in the StoreKit payment
          queue. Usually called internally by <code>finishTransaction()</code>.
        </p>

        <AnchorLink id="cleartransactionios" level="h4">
          clearTransactionIOS
        </AnchorLink>
        <p>Clear pending transactions.</p>
        <CodeBlock language="graphql">{`"""
Returns: Void
"""
clearTransactionIOS(): Future`}</CodeBlock>
        <p>Removes all pending transactions from the iOS payment queue.</p>

        <AnchorLink id="clearproductsios" level="h4">
          clearProductsIOS
        </AnchorLink>
        <p>Clear the products cache.</p>
        <CodeBlock language="graphql">{`"""
Returns: Void
"""
clearProductsIOS(): Future`}</CodeBlock>
        <p>
          Clears cached product information, forcing a refresh on next fetch.
        </p>

        <AnchorLink id="getstorefrontios" level="h4">
          getStorefrontIOS
        </AnchorLink>
        <p>Get the current App Store storefront country code.</p>
        <CodeBlock language="graphql">{`"""
Returns: String!
"""
getStorefrontIOS(): Future`}</CodeBlock>
        <p>Returns the storefront country code (e.g., "US", "GB", "JP").</p>

        <AnchorLink id="android-apis" level="h3">
          Android APIs
        </AnchorLink>

        <AnchorLink id="acknowledgepurchaseandroid" level="h4">
          acknowledgePurchaseAndroid
        </AnchorLink>
        <p>Acknowledge a non-consumable purchase or subscription.</p>
        <CodeBlock language="graphql">{`"""
Returns: Void
"""
acknowledgePurchaseAndroid(purchaseToken: String!): Future`}</CodeBlock>
        <p>
          Acknowledges the purchase to Google Play. Required within 3 days or
          the purchase will be refunded. Usually called internally by{' '}
          <code>finishTransaction()</code>.
        </p>

        <AnchorLink id="consumepurchaseandroid" level="h4">
          consumePurchaseAndroid
        </AnchorLink>
        <p>Consume a purchase (for consumable products only).</p>
        <CodeBlock language="graphql">{`"""
Returns: Void
"""
consumePurchaseAndroid(purchaseToken: String!): Future`}</CodeBlock>
        <p>
          Marks a consumable product as consumed, allowing repurchase.
          Automatically acknowledges the purchase. Usually called internally by{' '}
          <code>finishTransaction()</code> for consumables.
        </p>
      </section>

      <section>
        <AnchorLink id="connection-management" level="h2">
          Connection Management
        </AnchorLink>

        <AnchorLink id="initconnection" level="h3">
          initConnection
        </AnchorLink>
        <p>Initialize connection to the store service.</p>
        <CodeBlock language="graphql">{`"""
Returns: Boolean!
"""
initConnection(): Future`}</CodeBlock>
        <p>
          Establishes connection with the platform's billing service. Returns
          true if successful.
        </p>

        <AnchorLink id="endconnection" level="h3">
          endConnection
        </AnchorLink>
        <p>End connection to the store service.</p>
        <CodeBlock language="graphql">{`"""
Returns: Boolean!
"""
endConnection(): Future`}</CodeBlock>
        <p>
          Closes the connection and cleans up resources. Returns true if
          successful.
        </p>
      </section>

      <section>
        <AnchorLink id="subscription-management" level="h2">
          Subscription Management
        </AnchorLink>

        <AnchorLink id="getactivesubscriptions" level="h3">
          getActiveSubscriptions
        </AnchorLink>
        <p>Get all active subscriptions with detailed information.</p>
        <CodeBlock language="graphql">{`"""
Returns: [ActiveSubscription!]!
"""
getActiveSubscriptions(subscriptionIds: [String]?): Future

type ActiveSubscription {
  productId: String!
  isActive: Boolean!
  expirationDateIOS: Date?        # iOS only
  autoRenewingAndroid: Boolean?   # Android only
  environmentIOS: String?          # iOS only: "Sandbox" | "Production"
  willExpireSoon: Boolean?         # True if expiring within 7 days
  daysUntilExpirationIOS: Number?  # iOS only
}`}</CodeBlock>
        <p className="type-link">
          See:{' '}
          <Link to="/docs/types#active-subscription">ActiveSubscription</Link>
        </p>
        <p>
          Returns a future that completes with an array of active subscriptions.
          If <code>subscriptionIds</code> is not provided, returns all active
          subscriptions. Platform-specific fields are populated based on the
          current platform.
        </p>

        <AnchorLink id="hasactivesubscriptions" level="h3">
          hasActiveSubscriptions
        </AnchorLink>
        <p>Check if the user has any active subscriptions.</p>
        <CodeBlock language="graphql">{`"""
Returns: Boolean!
"""
hasActiveSubscriptions(subscriptionIds: [String]?): Future`}</CodeBlock>
        <p>
          Returns a future that completes with <code>true</code> if the user has
          at least one active subscription, <code>false</code> otherwise. If{' '}
          <code>subscriptionIds</code> is provided, only checks for those
          specific subscriptions.
        </p>

        <AnchorLink id="deeplinktosubscriptions" level="h3">
          deepLinkToSubscriptions
        </AnchorLink>
        <p>Open native subscription management interface.</p>
        <CodeBlock language="graphql">{`"""
Returns: Void
"""
deepLinkToSubscriptions(options: DeepLinkOptions): Future

type DeepLinkOptions {
  "Required on Android"
  skuAndroid: String?
  "Required on Android"
  packageNameAndroid: String?
}`}</CodeBlock>
        <p>
          Opens the platform's native subscription management interface where
          users can view and manage their subscriptions.
        </p>
      </section>
    </div>
  );
}

export default APIs;
