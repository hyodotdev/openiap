# react-native-iap API Reference

> Reference documentation for react-native-iap
> Adapt all patterns to match OpenIAP internal conventions.

## Overview

react-native-iap is a React Native library for in-app purchases on iOS and Android. expo-iap is built on top of this library.

## Installation

```bash
npm install react-native-iap
# or
yarn add react-native-iap
```

## Hook-Based API (Recommended)

### useIAP Hook

```typescript
import { useIAP } from 'react-native-iap';

function PurchaseScreen() {
  const {
    connected,
    products,
    subscriptions,
    purchaseHistory,
    availablePurchases,
    currentPurchase,
    currentPurchaseError,
    initConnectionError,
    finishTransaction,
    getProducts,
    getSubscriptions,
    getAvailablePurchases,
    getPurchaseHistory,
    requestPurchase,
    requestSubscription,
  } = useIAP();

  useEffect(() => {
    if (currentPurchase) {
      // Process purchase
      finishTransaction({ purchase: currentPurchase });
    }
  }, [currentPurchase]);

  return (/* ... */);
}
```

### withIAPContext HOC

Wrap your app with IAP context provider.

```typescript
import { withIAPContext } from 'react-native-iap';

function App() {
  return <PurchaseScreen />;
}

export default withIAPContext(App);
```

## Imperative API

### Connection Management

```typescript
import {
  initConnection,
  endConnection,
  getProducts,
  getSubscriptions,
} from 'react-native-iap';

// Initialize
const connected = await initConnection();

// Fetch products
const products = await getProducts({ skus: ['com.app.product1'] });
const subs = await getSubscriptions({ skus: ['com.app.sub_monthly'] });

// Cleanup
await endConnection();
```

### Product Types

```typescript
interface Product {
  productId: string;
  price: string;
  currency: string;
  localizedPrice: string;
  title: string;
  description: string;
  type: 'inapp' | 'subs';

  // iOS
  introductoryPrice?: string;
  introductoryPriceAsAmountIOS?: string;
  introductoryPricePaymentModeIOS?: string;
  introductoryPriceNumberOfPeriodsIOS?: string;
  introductoryPriceSubscriptionPeriodIOS?: string;
  subscriptionPeriodNumberIOS?: string;
  subscriptionPeriodUnitIOS?: string;
  discounts?: Discount[];

  // Android
  subscriptionOfferDetails?: SubscriptionOffer[];
  oneTimePurchaseOfferDetails?: OneTimePurchaseOffer;
}

interface SubscriptionOffer {
  basePlanId: string;
  offerId?: string;
  offerToken: string;
  offerTags: string[];
  pricingPhases: PricingPhase[];
}

interface PricingPhase {
  formattedPrice: string;
  priceCurrencyCode: string;
  priceAmountMicros: string;
  billingPeriod: string;
  billingCycleCount: number;
  recurrenceMode: number;
}
```

### Purchase Operations

```typescript
import {
  requestPurchase,
  requestSubscription,
  finishTransaction,
  getAvailablePurchases,
  getPurchaseHistory,
} from 'react-native-iap';

// Purchase consumable/non-consumable
await requestPurchase({ sku: 'com.app.product1' });

// Purchase subscription (Android with offer token)
await requestSubscription({
  sku: 'com.app.sub_monthly',
  subscriptionOffers: [{ sku: 'com.app.sub_monthly', offerToken: 'token' }],
});

// Finish transaction
await finishTransaction({ purchase, isConsumable: true });

// Get available purchases (restore)
const available = await getAvailablePurchases();

// Get purchase history
const history = await getPurchaseHistory();
```

### Purchase Type

```typescript
interface Purchase {
  productId: string;
  transactionId?: string;
  transactionDate: number;
  transactionReceipt: string;
  purchaseToken?: string;
  quantityIOS?: number;
  originalTransactionDateIOS?: number;
  originalTransactionIdentifierIOS?: string;
  verificationResultIOS?: string;
  appAccountToken?: string;

  // Android
  purchaseStateAndroid?: PurchaseStateAndroid;
  isAcknowledgedAndroid?: boolean;
  packageNameAndroid?: string;
  developerPayloadAndroid?: string;
  obfuscatedAccountIdAndroid?: string;
  obfuscatedProfileIdAndroid?: string;
  autoRenewingAndroid?: boolean;
}
```

## Event Listeners

```typescript
import {
  purchaseUpdatedListener,
  purchaseErrorListener,
} from 'react-native-iap';

// Purchase updates
const purchaseUpdateSubscription = purchaseUpdatedListener(
  async (purchase: Purchase) => {
    const receipt = purchase.transactionReceipt;
    if (receipt) {
      // Verify with server
      await finishTransaction({ purchase });
    }
  }
);

// Purchase errors
const purchaseErrorSubscription = purchaseErrorListener(
  (error: PurchaseError) => {
    console.warn('purchaseErrorListener', error);
  }
);

// Cleanup
purchaseUpdateSubscription.remove();
purchaseErrorSubscription.remove();
```

## iOS-Specific Functions

```typescript
import {
  clearTransactionIOS,
  clearProductsIOS,
  getReceiptIOS,
  getPendingPurchasesIOS,
  getPromotedProductIOS,
  buyPromotedProductIOS,
  presentCodeRedemptionSheetIOS,
  validateReceiptIos,
} from 'react-native-iap';

// Clear finished transactions
await clearTransactionIOS();

// Clear cached products
await clearProductsIOS();

// Get receipt for validation
const receipt = await getReceiptIOS();

// Get pending purchases
const pending = await getPendingPurchasesIOS();

// Handle promoted products
const promotedProduct = await getPromotedProductIOS();
if (promotedProduct) {
  await buyPromotedProductIOS();
}

// Show offer code redemption
await presentCodeRedemptionSheetIOS();
```

## Android-Specific Functions

```typescript
import {
  acknowledgePurchaseAndroid,
  consumePurchaseAndroid,
  flushFailedPurchasesCachedAsPendingAndroid,
  getPackageNameAndroid,
  isFeatureSupported,
  getBillingConfigAndroid,
} from 'react-native-iap';

// Acknowledge purchase (non-consumables, subscriptions)
await acknowledgePurchaseAndroid({ token: purchase.purchaseToken });

// Consume purchase (consumables)
await consumePurchaseAndroid({ token: purchase.purchaseToken });

// Clear failed pending purchases
await flushFailedPurchasesCachedAsPendingAndroid();

// Get package name
const packageName = getPackageNameAndroid();

// Check feature support
const supported = await isFeatureSupported('subscriptions');

// Get billing config
const config = await getBillingConfigAndroid();
```

## Subscription Status (iOS)

```typescript
import {
  getSubscriptionStatusIOS,
  getSubscriptionStatusesIOS,
} from 'react-native-iap';

// Get status for single product
const status = await getSubscriptionStatusIOS('com.app.sub_monthly');

// Get status for multiple products
const statuses = await getSubscriptionStatusesIOS();
```

## Error Handling

```typescript
import { IapIosSk2, ErrorCode } from 'react-native-iap';

try {
  await requestPurchase({ sku: 'com.app.product1' });
} catch (err) {
  if (err.code === ErrorCode.E_USER_CANCELLED) {
    // User cancelled
  } else if (err.code === ErrorCode.E_ITEM_UNAVAILABLE) {
    // Item not available
  } else if (err.code === ErrorCode.E_ALREADY_OWNED) {
    // Already owned
  } else {
    // Other error
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `E_UNKNOWN` | Unknown error |
| `E_USER_CANCELLED` | User cancelled |
| `E_ITEM_UNAVAILABLE` | Item not available |
| `E_NETWORK_ERROR` | Network error |
| `E_SERVICE_ERROR` | Store service error |
| `E_ALREADY_OWNED` | Item already owned |
| `E_REMOTE_ERROR` | Remote error |
| `E_NOT_PREPARED` | Not initialized |
| `E_NOT_ENDED` | Not ended |
| `E_DEVELOPER_ERROR` | Developer error |
| `E_BILLING_RESPONSE_JSON_PARSE_ERROR` | JSON parse error |
| `E_DEFERRED_PAYMENT` | Deferred payment |

## Complete Usage Example

```typescript
import React, { useEffect } from 'react';
import {
  withIAPContext,
  useIAP,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  ProductPurchase,
} from 'react-native-iap';

const productIds = ['com.app.product1'];
const subscriptionIds = ['com.app.sub_monthly'];

function Store() {
  const {
    connected,
    products,
    subscriptions,
    getProducts,
    getSubscriptions,
  } = useIAP();

  useEffect(() => {
    if (connected) {
      getProducts({ skus: productIds });
      getSubscriptions({ skus: subscriptionIds });
    }
  }, [connected]);

  useEffect(() => {
    const purchaseSub = purchaseUpdatedListener(
      async (purchase: ProductPurchase) => {
        await finishTransaction({ purchase, isConsumable: false });
      }
    );

    const errorSub = purchaseErrorListener((error) => {
      console.error('Purchase error:', error);
    });

    return () => {
      purchaseSub.remove();
      errorSub.remove();
    };
  }, []);

  const handlePurchase = async (sku: string) => {
    try {
      await requestPurchase({ sku });
    } catch (err) {
      console.error(err);
    }
  };

  return (/* Render products and subscriptions */);
}

export default withIAPContext(Store);
```

## Platform Differences

| Feature | iOS | Android |
|---------|-----|---------|
| Subscription offers | Introductory price, Discounts | Offer tokens, Pricing phases |
| Acknowledge | Automatic | Required within 3 days |
| Consume | finishTransaction | consumePurchaseAndroid |
| Receipt | getReceiptIOS | transactionReceipt in Purchase |
| Promoted products | Supported | Not supported |
| Offer codes | Supported | Promo codes via Play Store |
