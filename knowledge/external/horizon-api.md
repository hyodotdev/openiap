# Meta Horizon IAP API Reference

> External reference for Meta Horizon Store in-app purchase APIs.
> Source: [Meta Horizon Documentation](https://developers.meta.com/horizon/documentation/)

## Overview

Meta Horizon provides IAP functionality for Quest VR applications. There are two main integration paths:

1. **Platform SDK IAP** - Native Horizon IAP APIs
2. **Billing Compatibility SDK** - Google Play Billing Library compatible wrapper

## Version Compatibility Matrix

| Library | Version | Compatible With |
|---------|---------|-----------------|
| horizon-billing-compatibility | 1.1.1 | Google Play Billing **7.0** API |
| Google Play Billing (Play flavor) | 8.3.0 | N/A |
| react-native-iap | v14+ | Billing 7.0+ |
| expo-iap | latest | Billing 7.0+ |

**IMPORTANT**: Horizon Billing Compatibility SDK implements Google Play Billing **7.0** API surface, NOT 8.x. When writing shared code for both Play and Horizon flavors, use only APIs that exist in both Billing 7.0 and 8.x.

### APIs Available in Both (Safe to use in shared code)

- `BillingClient.Builder`, `BillingClient.newBuilder()`
- `queryProductDetailsAsync()` - Core product query
- `launchBillingFlow()` - Purchase flow
- `acknowledgePurchase()` - Acknowledge (no-op in Horizon)
- `consumeAsync()` - Consume purchase
- `queryPurchasesAsync()` - Query purchases

### APIs Only in Billing 8.x (DO NOT use in shared code)

- `enableAutoServiceReconnection()` - Auto reconnect feature
- Product-level status codes in `queryProductDetailsAsync()` response
- One-time products with multiple offers

## Billing Compatibility SDK

For apps already using Google Play Billing Library, the Horizon Billing Compatibility SDK provides a minimal migration path.

### Compatibility

- Compatible with **Google Play Billing Library 7.0** API
- Supports: consumable, durable, and subscription IAP
- Kotlin 2+ required

### Migration Steps

Replace imports from:
```kotlin
import com.android.billingclient.api.*
```

To:
```kotlin
import com.meta.horizon.billingclient.api.*
```

### Key Differences from Google Play Billing

| Feature | Google Play | Horizon |
|---------|-------------|---------|
| `acknowledgePurchase()` | Required within 3 days | No-op (not required) |
| Non-acknowledgement | Auto-refund after 3 days | No auto-refund |
| `enablePendingPurchases()` | Enables pending purchases | No-op (for compatibility) |
| `onBillingServiceDisconnected()` | Called on disconnect | Never invoked |

### Important Notes

- Keep SKUs on Meta Horizon Developer Center same as Google Play Console product IDs
- Only call `consumeAsync()` on consumable items
- `acknowledgePurchase()` is no-op - no acknowledgement requirements

## Server-to-Server (S2S) APIs

### Authentication

Access token format: `OC|App_ID|App_Secret`

### Verify Entitlement

Verify that a user owns an item (app or add-on).

**Endpoint:**

```http
POST https://graph.oculus.com/$APP_ID/verify_entitlement
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `access_token` | string | `OC\|App_ID\|App_Secret` format |
| `user_id` | string | The user ID to verify |
| `sku` | string | (Optional) SKU for add-on verification |

**Example - Verify App Ownership:**
```bash
curl -d "access_token=OC|$APP_ID|$APP_SECRET" \
     -d "user_id=$USER_ID" \
     https://graph.oculus.com/$APP_ID/verify_entitlement
```

**Example - Verify Add-on/IAP:**
```bash
curl -d "access_token=OC|$APP_ID|$APP_SECRET" \
     -d "user_id=$USER_ID" \
     -d "sku=$SKU" \
     https://graph.oculus.com/$APP_ID/verify_entitlement
```

**Response:**
```json
{
  "success": true
}
```

### Refund IAP Entitlement

Refund a DURABLE or CONSUMABLE entitlement (not yet consumed).

**Endpoint:**

```http
POST https://graph.oculus.com/$APP_ID/refund_iap_entitlement
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `access_token` | string | `OC\|App_ID\|App_Secret` format |
| `user_id` | string | The user ID |
| `sku` | string | SKU of item to refund |

**Note:** Can only refund items not yet consumed via `consumeAsync()`.

## Platform SDK IAP (Native)

### Product Types

| Type | Description |
|------|-------------|
| `CONSUMABLE` | Can be purchased multiple times (e.g., coins) |
| `DURABLE` | One-time purchase, permanent ownership |
| `SUBSCRIPTION` | Recurring billing |

### Key APIs

#### Get Products

Retrieve product information and pricing.

#### Launch Purchase Flow

Initiate purchase for an item.

#### Query Purchase History

Get user's purchase history.

#### Consume Purchase

Mark consumable item as used (required for re-purchase).

## OpenIAP Type Mapping

| OpenIAP Type | Description |
|--------------|-------------|
| `IapStore.Horizon` | Store identifier for Horizon |
| `VerifyPurchaseHorizonOptions` | Horizon verification parameters |
| `VerifyPurchaseResultHorizon` | Horizon verification result |

### VerifyPurchaseHorizonOptions

```typescript
interface VerifyPurchaseHorizonOptions {
  userId: string;      // Horizon user ID
  sku: string;         // Product SKU
  appId: string;       // Horizon App ID
  appSecret: string;   // Horizon App Secret
}
```

### VerifyPurchaseResultHorizon

```typescript
interface VerifyPurchaseResultHorizon {
  success: boolean;    // Verification result
}
```

## Entitlement Check

Apps must perform entitlement check within 10 seconds of launch for VRC.Quest.Security.1 compliance.

## React Native / Expo Support

Meta Quest supports React Native and Expo applications.

### Requirements

| Library | Minimum Version | Notes |
|---------|-----------------|-------|
| react-native-iap | v14+ | Billing 7.0+, Kotlin 2.0+, RN 0.79+ |
| expo-iap | latest | Uses expo-horizon-core plugin |
| React Native | 0.79+ | Required for Nitro modules |
| Kotlin | 2.0+ | Required for both billing SDKs |

### Expo Integration

Use `expo-horizon-core` plugin for Quest support:

```bash
npx expo install expo-horizon-core
```

The plugin:
- Removes unsupported dependencies/permissions
- Configures Android product flavors
- Specifies Meta Horizon App ID
- Provides Quest-specific JS utilities

### Known Limitations on Quest

- No GPS sensor (limited location accuracy)
- No geocoding support
- No device heading
- No background location
- Some Expo libraries need forks (expo-location, expo-notifications)

## Documentation Links

- [Platform SDK IAP Package](https://developers.meta.com/horizon/documentation/android-apps/ps-platform-sdk-iap)
- [S2S APIs](https://developers.meta.com/horizon/documentation/unity/ps-iap-s2s/)
- [Billing Compatibility SDK](https://developers.meta.com/horizon/documentation/spatial-sdk/horizon-billing-compatibility-sdk/)
- [Entitlement Check](https://developers.meta.com/horizon/documentation/android-apps/ps-entitlement-check/)
- [React Native on Quest](https://developers.meta.com/horizon/documentation/android-apps/react-native-apps)
- [Expo Quest Setup](https://blog.swmansion.com/how-to-add-meta-quest-support-to-your-expo-app-68c52778b1fe)
- [Subscriptions](https://developers.meta.com/horizon/resources/subscriptions/)
- [Setting up Add-ons](https://developers.meta.com/horizon/resources/add-ons-setup/)
