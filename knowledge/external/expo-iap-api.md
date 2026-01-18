# expo-iap API Reference

> Reference documentation for expo-iap (Expo In-App Purchase module)
> Adapt all patterns to match OpenIAP internal conventions.

## Overview

expo-iap is the Expo-compatible version of react-native-iap, providing in-app purchase functionality for both iOS and Android in Expo projects.

## Installation

```bash
npx expo install expo-iap
```

## Connection Management

### initConnection

Initialize connection to the app store.

```typescript
import { initConnection } from 'expo-iap';

await initConnection();
```

### endConnection

Close connection to the app store.

```typescript
import { endConnection } from 'expo-iap';

await endConnection();
```

## Product Operations

### fetchProducts

Fetch product information from the store.

```typescript
import { fetchProducts } from 'expo-iap';

const products = await fetchProducts(['com.app.product1', 'com.app.sub_monthly']);
```

**Returns:** `Promise<Product[]>`

### Product Type

```typescript
interface Product {
  productId: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  localizedPrice: string;
  type: ProductType; // 'iap' | 'sub'

  // iOS only
  subscriptionPeriodNumberIOS?: string;
  subscriptionPeriodUnitIOS?: string;
  introductoryPrice?: string;
  introductoryPricePaymentModeIOS?: string;
  introductoryPriceNumberOfPeriodsIOS?: string;
  introductoryPriceSubscriptionPeriodIOS?: string;

  // Android only
  subscriptionOfferDetailsAndroid?: SubscriptionOffer[];
  oneTimePurchaseOfferDetailsAndroid?: OneTimePurchaseOffer;
}
```

## Purchase Operations

### requestPurchase

Initiate a purchase.

```typescript
import { requestPurchase } from 'expo-iap';

// For consumables/non-consumables
await requestPurchase({ sku: 'com.app.product1' });

// For subscriptions (Android)
await requestPurchase({
  sku: 'com.app.sub_monthly',
  subscriptionOffers: [{ sku: 'com.app.sub_monthly', offerToken: 'token' }]
});
```

### finishTransaction

Complete a transaction after processing.

```typescript
import { finishTransaction } from 'expo-iap';

await finishTransaction({ purchase, isConsumable: true });
```

### getAvailablePurchases

Get user's existing purchases (restore purchases).

```typescript
import { getAvailablePurchases } from 'expo-iap';

const purchases = await getAvailablePurchases();
```

## Purchase Type

```typescript
interface Purchase {
  productId: string;
  transactionId?: string;
  transactionDate: number;
  transactionReceipt: string;
  purchaseToken?: string; // Android

  // iOS only
  originalTransactionDateIOS?: number;
  originalTransactionIdentifierIOS?: string;

  // Android only
  purchaseStateAndroid?: number;
  isAcknowledgedAndroid?: boolean;
  packageNameAndroid?: string;
  obfuscatedAccountIdAndroid?: string;
  obfuscatedProfileIdAndroid?: string;
}
```

## iOS-Specific Functions

### clearTransactionIOS

Clear finished transactions from the queue.

```typescript
import { clearTransactionIOS } from 'expo-iap';

await clearTransactionIOS();
```

### getReceiptDataIOS

Get the receipt data for validation.

```typescript
import { getReceiptDataIOS } from 'expo-iap';

const receipt = await getReceiptDataIOS();
```

### syncIOS

Sync transactions with the App Store.

```typescript
import { syncIOS } from 'expo-iap';

await syncIOS();
```

### presentCodeRedemptionSheetIOS

Show the offer code redemption sheet.

```typescript
import { presentCodeRedemptionSheetIOS } from 'expo-iap';

await presentCodeRedemptionSheetIOS();
```

### showManageSubscriptionsIOS

Open subscription management in App Store.

```typescript
import { showManageSubscriptionsIOS } from 'expo-iap';

await showManageSubscriptionsIOS();
```

### isEligibleForIntroOfferIOS

Check intro offer eligibility.

```typescript
import { isEligibleForIntroOfferIOS } from 'expo-iap';

const eligible = await isEligibleForIntroOfferIOS('com.app.sub_monthly');
```

### beginRefundRequestIOS

Start a refund request.

```typescript
import { beginRefundRequestIOS } from 'expo-iap';

const result = await beginRefundRequestIOS('transaction_id');
```

## Android-Specific Functions

### acknowledgePurchaseAndroid

Acknowledge a purchase (required within 3 days).

```typescript
import { acknowledgePurchaseAndroid } from 'expo-iap';

await acknowledgePurchaseAndroid({ token: purchase.purchaseToken });
```

### consumePurchaseAndroid

Consume a consumable purchase.

```typescript
import { consumePurchaseAndroid } from 'expo-iap';

await consumePurchaseAndroid({ token: purchase.purchaseToken });
```

### getPackageNameAndroid

Get the app's package name.

```typescript
import { getPackageNameAndroid } from 'expo-iap';

const packageName = await getPackageNameAndroid();
```

## Cross-Platform Functions

### getActiveSubscriptions

Get active subscriptions.

```typescript
import { getActiveSubscriptions } from 'expo-iap';

const subscriptions = await getActiveSubscriptions(['com.app.sub_monthly']);
```

### hasActiveSubscriptions

Check if user has active subscriptions.

```typescript
import { hasActiveSubscriptions } from 'expo-iap';

const hasActive = await hasActiveSubscriptions(['com.app.sub_monthly']);
```

### deepLinkToSubscriptions

Open subscription management on both platforms.

```typescript
import { deepLinkToSubscriptions } from 'expo-iap';

await deepLinkToSubscriptions({ sku: 'com.app.sub_monthly' });
```

### getStorefront

Get storefront information.

```typescript
import { getStorefront } from 'expo-iap';

const storefront = await getStorefront();
// { countryCode: 'US', ... }
```

## Event Listeners

### purchaseUpdatedListener

Listen for purchase updates.

```typescript
import { purchaseUpdatedListener } from 'expo-iap';

const subscription = purchaseUpdatedListener((purchase) => {
  console.log('Purchase updated:', purchase);
  // Process and finish transaction
});

// Cleanup
subscription.remove();
```

### purchaseErrorListener

Listen for purchase errors.

```typescript
import { purchaseErrorListener } from 'expo-iap';

const subscription = purchaseErrorListener((error) => {
  console.error('Purchase error:', error);
});

// Cleanup
subscription.remove();
```

## Error Codes

| Code | Description |
|------|-------------|
| `E_UNKNOWN` | Unknown error |
| `E_USER_CANCELLED` | User cancelled |
| `E_ITEM_UNAVAILABLE` | Item not available |
| `E_NETWORK_ERROR` | Network error |
| `E_SERVICE_ERROR` | Store service error |
| `E_ALREADY_OWNED` | Item already owned |
| `E_NOT_PREPARED` | Not initialized |
| `E_NOT_ENDED` | Connection not ended |
| `E_DEVELOPER_ERROR` | Developer error |

## Usage Pattern

```typescript
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
} from 'expo-iap';

// Setup
await initConnection();

const purchaseListener = purchaseUpdatedListener(async (purchase) => {
  // Verify purchase server-side
  // Then finish transaction
  await finishTransaction({ purchase, isConsumable: false });
});

const errorListener = purchaseErrorListener((error) => {
  console.error(error);
});

// Fetch products
const products = await fetchProducts(['com.app.premium']);

// Make purchase
await requestPurchase({ sku: 'com.app.premium' });

// Cleanup
purchaseListener.remove();
errorListener.remove();
await endConnection();
```
