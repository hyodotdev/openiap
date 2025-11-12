import { Link } from 'react-router-dom';
import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import PlatformTabs from '../../components/PlatformTabs';
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
        <AnchorLink id="connection-management" level="h2">
          Connection Management
        </AnchorLink>

        <AnchorLink id="init-connection" level="h3">
          initConnection
        </AnchorLink>
        <p>Initialize connection to the store service.</p>
        <CodeBlock language="graphql">{`"""
Returns: Boolean!
"""
initConnection(config: InitConnectionConfig?): Future`}</CodeBlock>
        <p>
          Establishes connection with the platform's billing service. Returns
          true if successful. Optionally accepts configuration for alternative
          billing on Android.
        </p>
        <p className="type-link">
          See:{' '}
          <Link to="/docs/types#init-connection-config">
            InitConnectionConfig
          </Link>
        </p>
        <CodeBlock language="typescript">{`// Standard connection
await initConnection();

// Android with user choice billing
await initConnection({
  alternativeBillingModeAndroid: 'USER_CHOICE'
});

// Android with alternative billing only
await initConnection({
  alternativeBillingModeAndroid: 'ALTERNATIVE_ONLY'
});`}</CodeBlock>

        <AnchorLink id="end-connection" level="h3">
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
        <AnchorLink id="product-management" level="h2">
          Product Management
        </AnchorLink>

        <AnchorLink id="fetch-products" level="h3">
          fetchProducts
        </AnchorLink>
        <p>Retrieve products or subscriptions from the store.</p>
        <CodeBlock language="graphql">{`"""
Returns: [Product!]! | [SubscriptionProduct!]!
"""
fetchProducts(params: ProductRequest!): Future

type ProductRequest {
  skus: [String]!
  type?: ProductType  "Values: 'in-app' | 'subs' | 'all'. Defaults to 'in-app'"
}`}</CodeBlock>
        <p className="type-link">
          See: <Link to="/docs/types#product">Product</Link>,{' '}
          <Link to="/docs/types#subscription-product">SubscriptionProduct</Link>
        </p>
        <p>
          Returns a future that completes with an array of products or
          subscriptions matching the provided SKUs. Use{' '}
          <code>type: "in-app"</code> for regular products only,{' '}
          <code>type: "subs"</code> for subscriptions only,{' '}
          <code>type: "all"</code> for both products and subscriptions, or omit
          the type parameter to fall back to the default <code>'in-app'</code>
          behavior.
        </p>

        <AnchorLink id="get-available-purchases" level="h3">
          getAvailablePurchases
        </AnchorLink>
        <p>Get all available purchases for the current user.</p>
        <CodeBlock language="graphql">{`"""
Returns: [Purchase!]!
"""
getAvailablePurchases(options: PurchaseOptions?): Future

type PurchaseOptions {
  alsoPublishToEventListenerIOS: Boolean?  # iOS only
  onlyIncludeActiveItemsIOS: Boolean?      # iOS only
}`}</CodeBlock>
        <p className="type-link">
          See: <Link to="/docs/types#purchase">Purchase</Link>
        </p>
        <p>
          Returns all purchases that haven't been properly finished/consumed:
        </p>
        <ul>
          <li>
            <strong>Consumables:</strong> Products not yet consumed (not yet
            called <code>finishTransaction</code> with isConsumable=true)
          </li>
          <li>
            <strong>Non-consumables:</strong> Products not yet finished (not yet
            called <code>finishTransaction</code>)
          </li>
          <li>
            <strong>Subscriptions:</strong> Currently active subscriptions
          </li>
        </ul>
        <p>
          <strong>Platform differences:</strong> On iOS, this includes purchase
          history. On Android with Google Play Billing v8+, only active
          purchases are returned.
        </p>
      </section>

      <section>
        <AnchorLink id="purchase-operations" level="h2">
          Purchase Operations
        </AnchorLink>

        <AnchorLink id="request-purchase" level="h3">
          requestPurchase
        </AnchorLink>
        <p>Request a purchase for products or subscriptions.</p>
        <CodeBlock language="graphql">{`"""
Returns: Purchase | Purchase[] | void
"""
requestPurchase(props: RequestPurchaseProps): Future

type RequestPurchaseProps =
  | {
      params: RequestPurchasePropsByPlatforms
      type: 'in-app'
    }
  | {
      params: RequestSubscriptionPropsByPlatforms
      type: 'subs'
    }`}</CodeBlock>
        <p className="type-link">
          See:{' '}
          <Link to="/docs/types#request-purchase-props">
            RequestPurchaseProps
          </Link>
          ,{' '}
          <Link to="/docs/types#request-purchase-props-by-platforms">
            RequestPurchasePropsByPlatforms
          </Link>
          ,{' '}
          <Link to="/docs/types#request-subscription-props-by-platforms">
            RequestSubscriptionPropsByPlatforms
          </Link>
          , <Link to="/docs/types#purchase">Purchase</Link>
        </p>
        <p>
          Initiates a purchase flow for any product type. Returns a Purchase
          object (iOS) or array (Android).
        </p>
        <blockquote className="info-note">
          <p>
            <strong>Note:</strong> Use the union shape to keep platforms in
            sync—<code>type: 'in-app'</code> pairs with
            <code>RequestPurchasePropsByPlatforms</code>, and
            <code>type: 'subs'</code> pairs with
            <code>RequestSubscriptionPropsByPlatforms</code>. This ensures both
            Google Play Billing and StoreKit receive the correct payloads.
          </p>
        </blockquote>

        <AnchorLink id="ios-external-purchase-links" level="h4">
          iOS External Purchase Links
        </AnchorLink>
        <p>
          Starting from openiap-gql 1.0.10, iOS supports external purchase links
          via the <code>externalPurchaseUrlOnIOS</code> parameter in{' '}
          <code>requestPurchase</code>.
        </p>
        <CodeBlock language="typescript">{`await requestPurchase({
  params: {
    ios: {
      sku: 'premium',
      externalPurchaseUrlOnIOS: 'https://your-payment-site.com/checkout'
    }
  },
  type: 'in-app'
});`}</CodeBlock>
        <blockquote className="info-note">
          <p>
            <strong>Important:</strong> External purchase links redirect users
            to an external website. No StoreKit transaction is created, and{' '}
            <code>purchaseUpdatedListener</code> will <strong>not</strong> be
            triggered. You are responsible for:
          </p>
          <ul>
            <li>
              Implementing deep links or universal links to return users to your
              app after purchase
            </li>
            <li>Verifying purchase completion on your server</li>
            <li>
              Granting entitlements to users (either directly or via StoreKit
              offer codes)
            </li>
          </ul>
          <p>
            The external link flow only opens the URL—it does not create
            StoreKit transactions or trigger purchase events.
          </p>
        </blockquote>

        <AnchorLink id="handling-resubscription" level="h4">
          Handling Resubscription (Cancelled Subscriptions)
        </AnchorLink>
        <p>
          When a user cancels their subscription, it remains active until the
          expiration date. During this period, the user can resubscribe.
          Starting from openiap-apple 1.2.34, the library automatically allows
          resubscription for cancelled subscriptions.
        </p>
        <CodeBlock language="typescript">{`// Check if subscription is cancelled but still active
const subscriptions = await getActiveSubscriptions(['premium_monthly']);
const subscription = subscriptions[0];

if (subscription?.renewalInfoIOS?.willAutoRenew === false) {
  // Subscription is cancelled - user can resubscribe
  console.log('Subscription cancelled, showing resubscribe button');

  try {
    // This will now succeed even though subscription is still active
    await requestPurchase({
      params: { ios: { sku: 'premium_monthly' } },
      type: 'subs'
    });
  } catch (error) {
    if (error.code === 'already-owned') {
      // Only thrown if subscription is active AND will auto-renew
      console.log('Subscription is already active and will renew');
    }
  }
} else if (subscription) {
  // Subscription is active and will auto-renew
  console.log('Subscription is active');
}`}</CodeBlock>
        <blockquote className="info-note">
          <p>
            <strong>Behavior:</strong> The <code>already-owned</code> error is
            only thrown when a subscription is <strong>both</strong> active and
            will auto-renew. If a user has cancelled their subscription (
            <code>willAutoRenew = false</code>), they can resubscribe
            immediately without waiting for expiration.
          </p>
        </blockquote>

        <AnchorLink id="android-alternative-billing" level="h4">
          Android Alternative Billing
        </AnchorLink>
        <p>
          For Android alternative billing, see the{' '}
          <Link to="/docs/apis#check-alternative-billing-availability-android">
            Android Alternative Billing APIs
          </Link>{' '}
          section in Platform-Specific APIs. Android alternative billing
          requires a three-step flow and configuration during{' '}
          <Link to="/docs/apis#init-connection">
            <code>initConnection</code>
          </Link>
          .
        </p>

        <AnchorLink id="finish-transaction" level="h3">
          finishTransaction
        </AnchorLink>
        <p>
          Complete a purchase transaction. Must be called after successful
          receipt validation for ALL purchase types to properly finish the
          transaction and remove it from the queue.
        </p>
        <CodeBlock language="graphql">{`"""
Returns: Void
"""
finishTransaction(purchase: Purchase!, isConsumable: Boolean?): Future`}</CodeBlock>
        <p className="type-link">
          See: <Link to="/docs/types#purchase">Purchase</Link>
        </p>

        <h4>The isConsumable Flag</h4>
        <p>
          The <code>isConsumable</code> flag determines how the transaction is
          completed:
        </p>
        <ul>
          <li>
            <strong>Consumables (isConsumable=true)</strong>: Products that can
            be purchased multiple times (e.g., "20 credits", "100 coins").
            Setting this flag allows repurchase on Android.
          </li>
          <li>
            <strong>Non-consumables (isConsumable=false or omitted)</strong>:
            One-time purchases that provide permanent benefits (e.g., "remove
            ads", "premium features"). Cannot be purchased again.
          </li>
          <li>
            <strong>Subscriptions (isConsumable=false or omitted)</strong>:
            Auto-renewable subscriptions are managed by the platform. Never set
            isConsumable=true for subscriptions as it's logically incorrect and
            may cause issues on Android.
          </li>
        </ul>

        <p>
          <strong>Platform behavior:</strong>
        </p>
        <ul>
          <li>
            <strong>iOS</strong>: The flag doesn't affect behavior as StoreKit
            handles this automatically.
          </li>
          <li>
            <strong>Android</strong>:
            <ul>
              <li>
                When <code>isConsumable=true</code>: Calls{' '}
                <code>consumePurchaseAndroid()</code>
              </li>
              <li>
                When <code>isConsumable=false</code>: Calls{' '}
                <code>acknowledgePurchaseAndroid()</code>
              </li>
            </ul>
          </li>
        </ul>
        <p>
          <strong>Important</strong>: Always call this after validating the
          receipt to avoid losing track of purchases. Android purchases must be
          acknowledged within 3 days or they will be automatically refunded.
        </p>

        <h4>Typical Purchase Flow</h4>
        <ol>
          <li>
            User initiates purchase with <code>requestPurchase</code>
          </li>
          <li>
            Listen for purchase updates via <code>purchaseUpdatedListener</code>
          </li>
          <li>
            Validate the receipt with <code>validateReceipt</code> (for ALL
            types)
          </li>
          <li>Grant entitlements to the user</li>
          <li>
            Call <code>finishTransaction</code> with appropriate{' '}
            <code>isConsumable</code> flag
          </li>
        </ol>

        <AnchorLink id="restore-purchases" level="h3">
          restorePurchases
        </AnchorLink>
        <p>Restore completed transactions (cross-platform behavior).</p>
        <CodeBlock language="graphql">{`"""
Returns: Void
"""
restorePurchases(): Future`}</CodeBlock>
        <p>
          iOS: performs a lightweight sync with <code>syncIOS()</code> to
          refresh transactions (sync errors are ignored), then calls{' '}
          <code>getAvailablePurchases()</code> to surface restored items.
        </p>
        <p>
          Android: directly calls <code>getAvailablePurchases()</code> (Google
          Play restoration happens via query).
        </p>
        <blockquote className="info-note">
          <p>
            Implementation note: this function leverages existing APIs (
            <code>syncIOS</code> and <code>getAvailablePurchases</code>) and is
            implemented in each framework library rather than as a separate
            native method.
          </p>
        </blockquote>

        <AnchorLink id="get-storefront" level="h3">
          getStorefront
        </AnchorLink>
        <p>Get storefront metadata for the active user.</p>
        <CodeBlock language="graphql">{`"""
Returns: String!
"""
getStorefront(): Future`}</CodeBlock>
        <p>
          Resolves with the ISO 3166-1 alpha-2 country code for the active
          storefront. Returns an empty string when the storefront cannot be
          determined.
        </p>
        <blockquote className="info-note">
          <p>
            iOS uses the active StoreKit storefront. Android queries Google Play
            Billing for the billing config and returns the same country code
            string, falling back to an empty value when the call fails.
          </p>
        </blockquote>
      </section>
      <section>
        <AnchorLink id="subscription-management" level="h2">
          Subscription Management
        </AnchorLink>

        <AnchorLink id="get-active-subscriptions" level="h3">
          getActiveSubscriptions
        </AnchorLink>
        <p>
          Get all active subscriptions with detailed information including
          renewal status.
        </p>
        <CodeBlock language="graphql">{`"""
Returns: [ActiveSubscription!]!
"""
getActiveSubscriptions(subscriptionIds: [String]?): Future`}</CodeBlock>
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

        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#ecfdf5',
            borderLeft: '4px solid #10b981',
            borderRadius: '0.25rem',
          }}
        >
          <strong>✨ New in iOS:</strong> Each subscription now includes{' '}
          <code>renewalInfoIOS</code> with renewal status information:
          <ul style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            <li>
              <code>willAutoRenew</code> — Whether subscription will auto-renew
            </li>
            <li>
              <code>pendingUpgradeProductId</code> — Product ID of pending
              upgrade/downgrade
            </li>
            <li>
              <code>renewalDate</code> — Next renewal date
            </li>
            <li>
              <code>expirationReason</code> — Why subscription expired (if
              cancelled)
            </li>
          </ul>
        </div>

        <CodeBlock language="typescript">{`// Example: Detect subscription upgrades
const subscriptions = await getActiveSubscriptions();
for (const sub of subscriptions) {
  if (sub.renewalInfoIOS?.pendingUpgradeProductId) {
    console.log(\`Upgrading from \${sub.productId} to \${sub.renewalInfoIOS.pendingUpgradeProductId}\`);
  }

  if (sub.renewalInfoIOS?.willAutoRenew === false) {
    console.log(\`Subscription \${sub.productId} will not renew\`);
  }
}`}</CodeBlock>

        <AnchorLink id="has-active-subscriptions" level="h3">
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

        <AnchorLink id="deep-link-to-subscriptions" level="h3">
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
      <section>
        <AnchorLink id="validation" level="h2">
          Validation
        </AnchorLink>

        <AnchorLink id="validate-receipt" level="h3">
          validateReceipt
        </AnchorLink>
        <p>
          Validate a receipt with your server or platform servers.
          <strong>
            All purchase types (consumables, non-consumables, and subscriptions)
            should be validated before granting entitlements.
          </strong>
        </p>
        <CodeBlock language="graphql">{`"""
Returns: ReceiptValidationResult!
"""
validateReceipt(options: ReceiptValidationProps!): Future`}</CodeBlock>
        <p className="type-link">
          See:{' '}
          <Link to="/docs/types#receipt-validation-types">
            ReceiptValidationProps
          </Link>
          ,{' '}
          <Link to="/docs/types#receipt-validation-result">
            ReceiptValidationResult
          </Link>
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
                <code>originalTransactionIdentifierIOS</code>
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

        <PlatformTabs>
          {{
            ios: (
              <>
                <h3>iOS APIs</h3>

                <AnchorLink id="clear-transaction-ios" level="h4">
                  clearTransactionIOS
                </AnchorLink>
                <p>Clear pending transactions.</p>
                <CodeBlock language="graphql">{`"""
Clear pending transactions from the StoreKit payment queue
"""
# Future
clearTransactionIOS: Boolean!`}</CodeBlock>
                <p>
                  Removes all pending transactions from the iOS payment queue.
                </p>

                <AnchorLink id="get-storefront-ios" level="h4">
                  getStorefrontIOS
                </AnchorLink>
                <p>
                  <strong>Deprecated.</strong> Use{' '}
                  <Link to="/docs/apis#get-storefront">
                    <code>getStorefront()</code>
                  </Link>{' '}
                  for cross-platform storefront data.
                </p>
                <CodeBlock language="graphql">{`"""
@deprecated(reason: "Use getStorefront")
Returns: String!
"""
# Future
getStorefrontIOS: String!`}</CodeBlock>
                <p>
                  Returns the storefront country code (e.g., "US", "GB", "JP")
                  for the active App Store account.
                </p>
                <blockquote className="info-note">
                  <p>
                    This legacy helper will proxy to{' '}
                    <code>getStorefront()</code> where possible and will be
                    removed in a future release.
                  </p>
                </blockquote>

                <AnchorLink id="get-promoted-product-ios" level="h4">
                  getPromotedProductIOS
                </AnchorLink>
                <p>Get the currently promoted product (iOS 11+).</p>
                <CodeBlock language="graphql">{`"""
Get the currently promoted product (iOS 11+)
"""
# Future
getPromotedProductIOS: ProductIOS`}</CodeBlock>
                <p>
                  Returns the product that was promoted in the App Store, if
                  any. Requires iOS 11 or later.
                </p>

                <AnchorLink
                  id="request-purchase-on-promoted-product-ios"
                  level="h4"
                >
                  requestPurchaseOnPromotedProductIOS
                </AnchorLink>
                <p>Purchase a promoted product (iOS 11+).</p>
                <CodeBlock language="graphql">{`"""
Purchase the promoted product surfaced by the App Store
"""
# Future
requestPurchaseOnPromotedProductIOS: Boolean!`}</CodeBlock>
                <p>
                  Initiates a purchase for the promoted product. The product
                  must have been previously promoted via the App Store.
                </p>

                <AnchorLink id="get-pending-transactions-ios" level="h4">
                  getPendingTransactionsIOS
                </AnchorLink>
                <p>Retrieve all pending transactions in the StoreKit queue.</p>
                <CodeBlock language="graphql">{`"""
Retrieve all pending transactions in the StoreKit queue
"""
# Future
getPendingTransactionsIOS: [PurchaseIOS!]!`}</CodeBlock>
                <p>
                  Returns all transactions that are pending completion in the
                  StoreKit payment queue as <code>PurchaseIOS</code> objects.
                </p>

                <AnchorLink id="is-eligible-for-intro-offer-ios" level="h4">
                  isEligibleForIntroOfferIOS
                </AnchorLink>
                <p>
                  Check introductory offer eligibility for a subscription group.
                </p>
                <CodeBlock language="graphql">{`"""
Check introductory offer eligibility for a subscription group
"""
# Future
isEligibleForIntroOfferIOS(groupID: String!): Boolean!`}</CodeBlock>
                <p>
                  Returns true if the user is eligible for an introductory price
                  within the specified subscription group, false otherwise.
                  Requires iOS 12.2+.
                </p>

                <AnchorLink id="subscription-status-ios" level="h4">
                  subscriptionStatusIOS
                </AnchorLink>
                <p>Get subscription status (iOS 15+).</p>
                <CodeBlock language="graphql">{`"""
Get StoreKit 2 subscription status details (iOS 15+)
"""
# Future
subscriptionStatusIOS(sku: String!): [SubscriptionStatusIOS!]!`}</CodeBlock>
                <p>
                  Returns detailed subscription status information using
                  StoreKit 2. Requires iOS 15+.
                </p>

                <AnchorLink id="current-entitlement-ios" level="h4">
                  currentEntitlementIOS
                </AnchorLink>
                <p>Get current StoreKit 2 entitlements (iOS 15+).</p>
                <CodeBlock language="graphql">{`"""
Get current StoreKit 2 entitlements (iOS 15+)
"""
# Future
currentEntitlementIOS(sku: String!): PurchaseIOS`}</CodeBlock>
                <p>
                  Returns the active StoreKit 2 entitlement for the provided
                  product identifier. Requires iOS 15+.
                </p>

                <AnchorLink id="latest-transaction-ios" level="h4">
                  latestTransactionIOS
                </AnchorLink>
                <p>Get latest transaction for a product (iOS 15+).</p>
                <CodeBlock language="graphql">{`"""
Get the latest transaction for a product using StoreKit 2
"""
# Future
latestTransactionIOS(sku: String!): PurchaseIOS`}</CodeBlock>
                <p>
                  Returns the most recent transaction for a specific product
                  using StoreKit 2. Requires iOS 15+.
                </p>

                <AnchorLink id="show-manage-subscriptions-ios" level="h4">
                  showManageSubscriptionsIOS
                </AnchorLink>
                <p>
                  Show subscription management UI and detect status changes (iOS
                  15+).
                </p>
                <CodeBlock language="graphql">{`"""
Open subscription management UI and return changed purchases (iOS 15+)
"""
# Future
showManageSubscriptionsIOS: [PurchaseIOS!]!`}</CodeBlock>
                <p>
                  Opens the native subscription management interface and returns
                  an array of purchases for subscriptions whose auto-renewal
                  status changed. Each returned purchase includes transaction
                  details and renewal information. Returns an empty array if no
                  changes were made. Requires iOS 15+.
                </p>

                <AnchorLink id="begin-refund-request-ios" level="h4">
                  beginRefundRequestIOS
                </AnchorLink>
                <p>Initiate refund request (iOS 15+).</p>
                <CodeBlock language="graphql">{`"""
Initiate a refund request for a product (iOS 15+)
"""
# Future
beginRefundRequestIOS(sku: String!): String`}</CodeBlock>
                <p>
                  Presents the refund request sheet for a specific product and
                  returns a string token when submission succeeds. Requires iOS
                  15+.
                </p>

                <AnchorLink id="is-transaction-verified-ios" level="h4">
                  isTransactionVerifiedIOS
                </AnchorLink>
                <p>Verify a StoreKit 2 transaction signature.</p>
                <CodeBlock language="graphql">{`"""
Verify a StoreKit 2 transaction signature
"""
# Future
isTransactionVerifiedIOS(sku: String!): Boolean!`}</CodeBlock>
                <p>
                  Verifies the transaction signature using StoreKit 2. Returns
                  true if valid, false otherwise. Requires iOS 15+.
                </p>

                <AnchorLink id="get-transaction-jws-ios" level="h4">
                  getTransactionJwsIOS
                </AnchorLink>
                <p>Get the transaction JWS (StoreKit 2).</p>
                <CodeBlock language="graphql">{`"""
Get the transaction JWS (StoreKit 2)
"""
# Future
getTransactionJwsIOS(sku: String!): String`}</CodeBlock>
                <p>
                  Returns the JSON Web Signature for a product's transaction.
                  Use this token for server-side validation. Requires iOS 15+.
                </p>

                <AnchorLink id="get-receipt-data-ios" level="h4">
                  getReceiptDataIOS
                </AnchorLink>
                <p>Get base64-encoded receipt data for validation.</p>
                <CodeBlock language="graphql">{`"""
Get base64-encoded receipt data for validation
"""
# Future
getReceiptDataIOS: String`}</CodeBlock>
                <p>
                  Returns the base64-encoded receipt data for server validation.
                  When no receipt exists, returns <code>null</code>.
                </p>

                <AnchorLink id="sync-ios" level="h4">
                  syncIOS
                </AnchorLink>
                <p>Force a StoreKit sync for transactions (iOS 15+).</p>
                <CodeBlock language="graphql">{`"""
Force a StoreKit sync for transactions (iOS 15+)
"""
# Future
syncIOS: Boolean!`}</CodeBlock>
                <p>
                  Forces a sync with StoreKit to ensure all transactions are up
                  to date. Requires iOS 15+.
                </p>

                <AnchorLink id="present-code-redemption-sheet-ios" level="h4">
                  presentCodeRedemptionSheetIOS
                </AnchorLink>
                <p>Present the App Store code redemption sheet.</p>
                <CodeBlock language="graphql">{`"""
Present the App Store code redemption sheet
"""
# Future
presentCodeRedemptionSheetIOS: Boolean!`}</CodeBlock>
                <p>Presents the sheet for redeeming App Store promo codes.</p>

                <AnchorLink id="get-app-transaction-ios" level="h4">
                  getAppTransactionIOS
                </AnchorLink>
                <p>Fetch the current app transaction (iOS 16+).</p>
                <CodeBlock language="graphql">{`"""
Fetch the current app transaction (iOS 16+)
"""
# Future
getAppTransactionIOS: AppTransaction`}</CodeBlock>
                <CodeBlock language="graphql">{`type AppTransaction {
  bundleId: String!
  appVersion: String!
  originalAppVersion: String!
  originalPurchaseDate: Date!
  deviceVerification: String!
  deviceVerificationNonce: String!
  environment: String!  # "Sandbox" | "Production"
  signedDate: Date!
  appId: Number!
  appVersionId: Number!
  preorderDate: Date?
  # iOS 18.4+ properties
  appTransactionId: String?  # Requires iOS 18.4+
  originalPlatform: String?  # Requires iOS 18.4+
}`}</CodeBlock>
                <p>
                  Returns information about the app's original purchase or
                  download. This includes details about when the app was first
                  installed, the version, and verification data. Requires iOS
                  16+. Additional properties are available on iOS 18.4+ when
                  built with Xcode 16.4+.
                </p>

                <AnchorLink id="validate-receipt-ios" level="h4">
                  validateReceiptIOS
                </AnchorLink>
                <p>Validate a receipt for a specific product.</p>
                <CodeBlock language="graphql">{`"""
Validate a receipt for a specific product
"""
# Future
validateReceiptIOS(sku: String!): ReceiptValidationResultIOS!`}</CodeBlock>
                <p>
                  Validates a receipt payload against the App Store using the
                  provided validation options. Returns the parsed validation
                  result for the product. Requires server credentials matching
                  the configured environment.
                </p>
              </>
            ),
            android: (
              <>
                <h3>Android APIs</h3>

                <AnchorLink id="acknowledge-purchase-android" level="h4">
                  acknowledgePurchaseAndroid
                </AnchorLink>
                <p>Acknowledge a non-consumable purchase or subscription.</p>
                <CodeBlock language="graphql">{`"""
Acknowledge a non-consumable purchase or subscription
"""
# Future
acknowledgePurchaseAndroid(purchaseToken: String!): Boolean!`}</CodeBlock>
                <p>
                  Acknowledges the purchase to Google Play. Required within 3
                  days or the purchase will be refunded. Returns
                  <code>true</code> when the acknowledgment succeeds.
                </p>
                <p>
                  <strong>Note:</strong> This is called automatically by{' '}
                  <Link to="/docs/apis#finish-transaction">
                    <code>finishTransaction()</code>
                  </Link>{' '}
                  when <code>isConsumable</code> is <code>false</code>.
                </p>

                <AnchorLink id="consume-purchase-android" level="h4">
                  consumePurchaseAndroid
                </AnchorLink>
                <p>Consume a purchase (for consumable products only).</p>
                <CodeBlock language="graphql">{`"""
Consume a purchase token so it can be repurchased
"""
# Future
consumePurchaseAndroid(purchaseToken: String!): Boolean!`}</CodeBlock>
                <p>
                  Marks a consumable product as consumed, allowing repurchase.
                  Automatically acknowledges the purchase. Returns
                  <code>true</code> when the consume request is accepted.
                </p>
                <p>
                  <strong>Note:</strong> This is called automatically by{' '}
                  <Link to="/docs/apis#finish-transaction">
                    <code>finishTransaction()</code>
                  </Link>{' '}
                  when <code>isConsumable</code> is <code>true</code>.
                </p>

                <h3>Android Alternative Billing APIs</h3>
                <p>
                  Three-step flow for implementing alternative billing on
                  Android. These APIs work with Google Play Billing Library
                  6.2+.
                </p>

                <AnchorLink
                  id="check-alternative-billing-availability-android"
                  level="h4"
                >
                  checkAlternativeBillingAvailabilityAndroid
                </AnchorLink>
                <p>
                  Check if alternative billing is available for this
                  user/device. This is <strong>Step 1</strong> of the
                  alternative billing flow.
                </p>
                <CodeBlock language="graphql">{`"""
Check if alternative billing is available for this user/device
Step 1 of alternative billing flow

Returns true if available, false otherwise
Throws OpenIapError.NotPrepared if billing client not ready
"""
# Future
checkAlternativeBillingAvailabilityAndroid: Boolean!`}</CodeBlock>
                <p>
                  Returns <code>true</code> if alternative billing is available,{' '}
                  <code>false</code> otherwise. Throws{' '}
                  <code>OpenIapError.NotPrepared</code> if the billing client is
                  not ready.
                </p>

                <AnchorLink
                  id="show-alternative-billing-dialog-android"
                  level="h4"
                >
                  showAlternativeBillingDialogAndroid
                </AnchorLink>
                <p>
                  Show alternative billing information dialog to the user. This
                  is <strong>Step 2</strong> of the alternative billing flow and
                  must be called <strong>before</strong> processing payment in
                  your payment system.
                </p>
                <CodeBlock language="graphql">{`"""
Show alternative billing information dialog to user
Step 2 of alternative billing flow
Must be called BEFORE processing payment in your payment system

Returns true if user accepted, false if user canceled
Throws OpenIapError.NotPrepared if billing client not ready
"""
# Future
showAlternativeBillingDialogAndroid: Boolean!`}</CodeBlock>
                <p>
                  Returns <code>true</code> if the user accepted,{' '}
                  <code>false</code> if the user canceled. Throws{' '}
                  <code>OpenIapError.NotPrepared</code> if the billing client is
                  not ready.
                </p>

                <AnchorLink
                  id="create-alternative-billing-token-android"
                  level="h4"
                >
                  createAlternativeBillingTokenAndroid
                </AnchorLink>
                <p>
                  Create external transaction token for Google Play reporting.
                  This is <strong>Step 3</strong> of the alternative billing
                  flow and must be called <strong>after</strong> successful
                  payment in your payment system.
                </p>
                <CodeBlock language="graphql">{`"""
Create external transaction token for Google Play reporting
Step 3 of alternative billing flow
Must be called AFTER successful payment in your payment system
Token must be reported to Google Play backend within 24 hours

Returns token string, or null if creation failed
Throws OpenIapError.NotPrepared if billing client not ready
"""
# Future
createAlternativeBillingTokenAndroid: String`}</CodeBlock>
                <p>
                  Returns a token string that must be reported to Google Play
                  backend within 24 hours, or <code>null</code> if creation
                  failed. Throws <code>OpenIapError.NotPrepared</code> if the
                  billing client is not ready.
                </p>

                <h4>Alternative Billing Flow Example</h4>
                <CodeBlock language="typescript">{`// Step 1: Check availability
const isAvailable = await checkAlternativeBillingAvailabilityAndroid();
if (!isAvailable) {
  // Fall back to standard billing
  return;
}

// Step 2: Show dialog to user
const userAccepted = await showAlternativeBillingDialogAndroid();
if (!userAccepted) {
  // User canceled
  return;
}

// Process payment in your payment system
const paymentSuccess = await processPaymentInYourSystem();

if (paymentSuccess) {
  // Step 3: Create token and report to Google Play
  const token = await createAlternativeBillingTokenAndroid();

  if (token) {
    // Report token to Google Play backend within 24 hours
    await reportTokenToGooglePlay(token);
  }
}`}</CodeBlock>
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="debugging-logging" level="h2">
          Debugging & Logging
        </AnchorLink>
        <p>
          Enable verbose logging to see internal operations, warnings, and debug
          information. This is especially useful during development to diagnose
          issues and understand library behavior.
        </p>

        <AnchorLink id="enable-logging" level="h3">
          Enable Logging
        </AnchorLink>
        <p>
          Logging is <strong>disabled by default</strong> in production. Enable
          it only during development to see detailed logs.
        </p>

        <PlatformTabs>
          {{
            ios: (
              <CodeBlock language="swift">{`// Enable logging for debug builds only
#if DEBUG
OpenIapLog.enable(true)
#endif

// Or enable unconditionally
OpenIapLog.enable(true)

// Disable logging
OpenIapLog.enable(false)`}</CodeBlock>
            ),
            android: (
              <CodeBlock language="kotlin">{`// Enable logging for debug builds only
if (BuildConfig.DEBUG) {
    OpenIapLog.enable(true)
}

// Or enable unconditionally
OpenIapLog.enable(true)

// Disable logging
OpenIapLog.enable(false)`}</CodeBlock>
            ),
          }}
        </PlatformTabs>

        <AnchorLink id="common-warnings" level="h3">
          Common Warnings
        </AnchorLink>
        <p>
          When logging is enabled, you may see warnings about specific
          scenarios:
        </p>

        <h4>Multiple Subscription Offers</h4>
        <blockquote className="info-note">
          <p>
            <strong>Warning:</strong>{' '}
            <code>
              Multiple offers (3) found for premium_subscription, using first
              basePlanId (may be inaccurate)
            </code>
          </p>
        </blockquote>
        <p>
          This warning appears when a subscription product has multiple offers
          (e.g., monthly, annual, promotional). Due to Google Play Billing
          Library limitations, the <code>Purchase</code> object doesn't expose
          which specific offer was purchased. The library uses the first offer's{' '}
          <code>basePlanId</code> as a best-effort approach.
        </p>

        <p>
          <strong>Impact:</strong> The <code>currentPlanId</code> field in{' '}
          <code>PurchaseAndroid</code> and <code>basePlanIdAndroid</code> in{' '}
          <code>ActiveSubscription</code> may be inaccurate if users purchase
          different offers.
        </p>

        <p>
          <strong>Solutions:</strong>
        </p>
        <ul>
          <li>
            <strong>Backend Validation</strong> (Recommended): Use Google Play
            Developer API's{' '}
            <code>purchases.subscriptionsv2:get</code> endpoint with the{' '}
            <code>purchaseToken</code> to get accurate{' '}
            <code>basePlanId</code> and <code>offerId</code>
          </li>
          <li>
            <strong>Single Offer</strong>: Design your subscription products
            with a single offer per product (most common approach)
          </li>
          <li>
            <strong>Offer Tags</strong>: Use offer tags in Google Play Console
            to help identify offers, though this doesn't solve the client-side
            tracking issue
          </li>
        </ul>

        <CodeBlock language="kotlin">{`// Example: Backend validation to get accurate basePlanId
// GET https://androidpublisher.googleapis.com/androidpublisher/v3/
//     applications/{packageName}/purchases/subscriptionsv2/tokens/{token}
//
// Response includes:
// {
//   "lineItems": [{
//     "offerDetails": {
//       "basePlanId": "premium-annual",  // Accurate!
//       "offerId": "intro-offer"
//     }
//   }]
// }`}</CodeBlock>

        <blockquote className="info-note">
          <p>
            <strong>Note:</strong> This limitation only affects products with
            multiple offers. If your subscription has a single offer (the most
            common case), the <code>basePlanId</code> will always be accurate.
          </p>
        </blockquote>
      </section>
    </div>
  );
}

export default APIs;
