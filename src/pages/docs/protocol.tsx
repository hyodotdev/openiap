function Protocol() {
  return (
    <div className="doc-page">
      <h1>OpenIAP Specification</h1>

      <section>
        <h2>Overview</h2>
        <p>
          OpenIAP is an open specification that standardizes in-app purchase
          implementations across diverse platforms and frameworks. As new
          platforms emerge (StoreKit 2, Android Billing v8, Vision Pro, Horizon
          OS) and frameworks multiply (React Native, Flutter, KMP), the need for
          a unified specification becomes critical to prevent API fragmentation
          and reduce developer complexity.
        </p>
      </section>

      <section>
        <h2>Core API Structure</h2>
        <pre className="code-block">{`interface OpenIAPSpec {
  // Connection management
  initConnection(): Promise<boolean>
  endConnection(): Promise<boolean>
  
  // Product management
  fetchProducts(params: {
    skus: string[]
    type?: 'in-app' | 'subs'
  }): Promise<Product[] | SubscriptionProduct[]>
  
  // Purchase operations
  requestPurchase(
    props:
      | {
          params: RequestPurchasePropsByPlatforms
          type: 'in-app'
        }
      | {
          params: RequestSubscriptionPropsByPlatforms
          type: 'subs'
        }
  ): Promise<Purchase | Purchase[] | void>
  
  // Transaction management
  finishTransaction(params: {
    purchase: Purchase
    isConsumable?: boolean  // true for consumables, false/omit for non-consumables and subscriptions
  }): Promise<PurchaseResult | boolean>
  
  // Purchase history
  getAvailablePurchases(params?: {
    alsoPublishToEventListenerIOS?: boolean
    onlyIncludeActiveItemsIOS?: boolean
  }): Promise<Purchase[]>
  
  // Receipt validation (server-side recommended)
  validateReceipt(
    sku: string,
    options?: ReceiptValidationProps
  ): Promise<ReceiptValidationResult>
}`}</pre>
      </section>

      <section>
        <h2>Basic Usage</h2>
        <pre className="code-block">{`import * as IAP from '@openiap/core'

// Initialize connection
await IAP.initConnection()

// Get products
const products = await IAP.fetchProducts({
  skus: ['premium', 'pro'],
  type: 'in-app'
})

// Get subscriptions
const subscriptions = await IAP.fetchProducts({
  skus: ['monthly', 'yearly'],
  type: 'subs'
})

// Make a purchase
const purchase = await IAP.requestPurchase({
  params: {
    ios: { sku: 'premium' },
    android: { skus: ['premium'] }
  },
  type: 'in-app'
})

// Finish transaction (example with consumable)
await IAP.finishTransaction({
  purchase,
  isConsumable: true  // Set to true only for consumable products
})`}</pre>
      </section>

      <section>
        <h2>Event Listeners</h2>
        <pre className="code-block">{`import { IapEvent, purchaseUpdatedListener, purchaseErrorListener } from '@openiap/core'

// Listen for purchase updates
const updateSubscription = purchaseUpdatedListener((purchase) => {
  console.log('Purchase updated:', purchase)
  // Handle the purchase
})

// Listen for purchase errors
const errorSubscription = purchaseErrorListener((error) => {
  console.error('Purchase error:', error)
  // Handle the error
})

// iOS-only: Listen for promoted products
const promotedSubscription = promotedProductListenerIOS((product) => {
  console.log('Promoted product:', product)
  // Handle promoted product from App Store
})

// Clean up listeners
updateSubscription.remove()
errorSubscription.remove()
promotedSubscription.remove()`}</pre>
      </section>

      <section>
        <h2>Platform-Specific Features</h2>

        <h3>iOS Features</h3>
        <pre className="code-block">{`// Get storefront info
const storefront = await IAP.getStorefrontIOS() // 'US', 'GB', etc.

// iOS purchase with offer
await IAP.requestPurchase({
  params: {
    ios: {
      sku: 'premium',
      withOffer: {
        identifier: 'offer_id',
        keyIdentifier: 'key_id',
        nonce: 'nonce_value',
        signature: 'signature',
        timestamp: Date.now()
      }
    }
  }
})`}</pre>

        <h3>Android Features</h3>
        <pre className="code-block">{`// Android subscription with offers
await IAP.requestPurchase({
  params: {
    android: {
      skus: ['monthly_sub'],
      subscriptionOffers: [{
        sku: 'monthly_sub',
        offerToken: 'offer_token'
      }],
      replacementModeAndroid: 1, // IMMEDIATE_WITH_TIME_PRORATION
      purchaseTokenAndroid: 'existing_token' // for upgrades
    }
  },
  type: 'subs'
})`}</pre>
      </section>

      <section>
        <h2>Error Handling</h2>
        <pre className="code-block">{`try {
  const purchase = await IAP.requestPurchase({
    params: { ios: { sku: 'premium' }, android: { skus: ['premium'] } }
  })
  
  // Verify receipt on your server
  const isValid = await verifyOnServer(purchase)
  
  if (isValid) {
    // Finish the transaction (non-consumable example)
    await IAP.finishTransaction({ purchase, isConsumable: false })
  }
} catch (error) {
  if (error.code === 'E_USER_CANCELLED') {
    // User cancelled - not really an error
    console.log('Purchase cancelled by user')
  } else {
    // Real error
    console.error('Purchase failed:', error)
  }
}`}</pre>
      </section>
    </div>
  );
}

export default Protocol;
