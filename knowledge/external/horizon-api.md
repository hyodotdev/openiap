# Meta Horizon IAP API Reference

> External reference for Meta Horizon Store in-app purchase APIs.
> Source: https://developers.meta.com/horizon/documentation/

## Overview

Meta Horizon provides IAP functionality for Quest VR applications. There are two main integration paths:

1. **Platform SDK IAP** - Native Horizon IAP APIs
2. **Billing Compatibility SDK** - Google Play Billing Library compatible wrapper

## Billing Compatibility SDK

For apps already using Google Play Billing Library, the Horizon Billing Compatibility SDK provides a minimal migration path.

### Compatibility

- Compatible with **Google Play Billing Library 7.0**
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
```
POST https://graph.oculus.com/$APP_ID/verify_entitlement
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `access_token` | string | `OC|App_ID|App_Secret` format |
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
```
POST https://graph.oculus.com/$APP_ID/refund_iap_entitlement
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `access_token` | string | `OC|App_ID|App_Secret` format |
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

## Documentation Links

- [Platform SDK IAP Package](https://developers.meta.com/horizon/documentation/android-apps/ps-platform-sdk-iap)
- [S2S APIs](https://developers.meta.com/horizon/documentation/unity/ps-iap-s2s/)
- [Billing Compatibility SDK](https://developers.meta.com/horizon/documentation/spatial-sdk/horizon-billing-compatibility-sdk/)
- [Entitlement Check](https://developers.meta.com/horizon/documentation/android-apps/ps-entitlement-check/)
- [Subscriptions](https://developers.meta.com/horizon/resources/subscriptions/)
- [Setting up Add-ons](https://developers.meta.com/horizon/resources/add-ons-setup/)
