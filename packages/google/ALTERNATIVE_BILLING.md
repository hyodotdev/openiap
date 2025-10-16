# Alternative Billing Implementation Guide

This document explains how to implement Alternative Billing Only mode in your Android app using OpenIAP.

## Overview

Alternative Billing Only allows you to use your own payment system instead of Google Play billing, while still distributing your app through Google Play Store.

## Requirements

- ✅ Google Play Console enrollment in Alternative Billing program
- ✅ Google approval (can take several weeks)
- ✅ Billing Library 6.2+ (this library uses 8.0.0)
- ✅ Country/region eligibility
- ✅ Backend server for reporting transactions to Google Play

## Quick Start

### 1. Initialize OpenIapStore with Alternative Billing Mode

```kotlin
val iapStore = OpenIapStore(
    context = applicationContext,
    alternativeBillingMode = AlternativeBillingMode.ALTERNATIVE_ONLY
)
```

### 2. Implementation (Step-by-Step Only)

⚠️ **CRITICAL**: You **MUST** use the step-by-step approach below.

**DO NOT use `requestPurchase()` for production** - it creates the token BEFORE payment, which means:
- User hasn't paid yet
- Reporting to Google would be fraud
- Your app will be banned

The step-by-step approach is the **ONLY correct way**:

#### Using OpenIapStore (Recommended)

```kotlin
val iapStore = OpenIapStore(context, AlternativeBillingMode.ALTERNATIVE_ONLY)

// Step 1: Check availability
val isAvailable = iapStore.checkAlternativeBillingAvailability()
if (!isAvailable) {
    // Handle unavailable case
    return
}

// Step 2: Show information dialog
val dialogAccepted = iapStore.showAlternativeBillingInformationDialog(activity)
if (!dialogAccepted) {
    // User canceled
    return
}

// Step 3: Process payment in YOUR payment system
// ⚠️ Note: onPurchaseUpdated will NOT be called - handle success/failure here
val paymentResult = YourPaymentSystem.processPayment(
    productId = productId,
    amount = product.price,
    userId = currentUserId,
    onSuccess = { transactionId ->
        // Step 4: Create token AFTER successful payment
        lifecycleScope.launch {
            val token = iapStore.createAlternativeBillingReportingToken()
            if (token != null) {
                // Step 5: Send token to your backend
                YourBackendApi.reportTransaction(
                    externalTransactionToken = token,
                    productId = productId,
                    userId = currentUserId,
                    transactionId = transactionId
                )

                // Update your UI - purchase complete!
                showSuccessMessage("Purchase successful")
            } else {
                showErrorMessage("Failed to create reporting token")
            }
        }
    },
    onFailure = { error ->
        // Handle payment failure in your UI
        showErrorMessage("Payment failed: ${error.message}")
    }
)
```

#### Using OpenIapModule Directly (Advanced)

If you're not using OpenIapStore wrapper, you can call OpenIapModule methods directly:

```kotlin
val openIapModule = OpenIapModule(
    context = context,
    alternativeBillingMode = AlternativeBillingMode.ALTERNATIVE_ONLY
)

// Initialize connection first
val connected = openIapModule.initConnection()
if (!connected) {
    // Handle connection failure
    return
}

// Step 1: Check availability
val isAvailable = openIapModule.checkAlternativeBillingAvailability()
if (!isAvailable) {
    // Handle unavailable case
    return
}

// Step 2: Show information dialog
openIapModule.setActivity(activity)
val dialogAccepted = openIapModule.showAlternativeBillingInformationDialog(activity)
if (!dialogAccepted) {
    // User canceled
    return
}

// Step 3: Process payment in YOUR payment system
// ⚠️ Note: onPurchaseUpdated will NOT be called - handle success/failure here
val paymentResult = YourPaymentSystem.processPayment(
    productId = productId,
    amount = product.price,
    userId = currentUserId,
    onSuccess = { transactionId ->
        // Step 4: Create token AFTER successful payment
        lifecycleScope.launch {
            val token = openIapModule.createAlternativeBillingReportingToken()
            if (token != null) {
                // Step 5: Send token to your backend
                YourBackendApi.reportTransaction(
                    externalTransactionToken = token,
                    productId = productId,
                    userId = currentUserId,
                    transactionId = transactionId
                )

                // Update your UI - purchase complete!
                showSuccessMessage("Purchase successful")
            } else {
                showErrorMessage("Failed to create reporting token")
            }
        }
    },
    onFailure = { error ->
        // Handle payment failure in your UI
        showErrorMessage("Payment failed: ${error.message}")
    }
)
```

### Why This Order Matters

```kotlin
// ❌ WRONG (what requestPurchase does - DO NOT USE)
1. Check availability ✓
2. Show dialog ✓
3. Create token ✓  ← Token created WITHOUT payment!
4. [No payment]    ← User never paid anything
5. Report to Google ← This is FRAUD - claiming user paid when they didn't

// ✅ CORRECT (step-by-step - MUST USE)
1. checkAvailability()
2. showDialog()
3. YOUR_PAYMENT.charge($9.99)  ← User ACTUALLY pays here
4. createToken()               ← Token created AFTER successful payment
5. backend.reportToGoogle()    ← Report REAL transaction to Google
```

The token is **proof of payment**. Creating it before payment is like writing a receipt before the customer pays - it's fraud.

## Backend Implementation

### Important: No `onPurchaseUpdated` Callback

⚠️ **Alternative Billing does NOT trigger `onPurchaseUpdated` or `onPurchaseError` callbacks.**

Why? Because you're **not using Google Play billing system** - you're using your own payment system (Stripe, PayPal, Toss, etc.). The callbacks only fire for Google Play transactions.

```kotlin
// ❌ This will NOT work with Alternative Billing
iapStore.addPurchaseUpdateListener { purchase ->
    // This is NEVER called in Alternative Billing mode
}

// ✅ Instead, handle payment completion in YOUR payment system
YourPaymentSystem.processPayment(
    onSuccess = { transactionId ->
        // Your payment succeeded - NOW create token
        val token = iapStore.createAlternativeBillingReportingToken()
        sendToBackend(token, transactionId)
    },
    onFailure = { error ->
        // Handle payment failure in your UI
    }
)
```

### Backend Reporting API

Your backend must report the transaction to Google Play Developer API within **24 hours**:

```http
POST https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/externalTransactions

Authorization: Bearer {oauth_token}
Content-Type: application/json

{
  "externalTransactionToken": "token_from_step_4",
  "productId": "your_product_id",
  "externalTransactionId": "your_transaction_id",
  "transactionTime": "2025-10-02T12:00:00Z",
  "currentTaxAmount": {
    "currencyCode": "USD",
    "amountMicros": "1000000"  // $1.00
  },
  "currentPreTaxAmount": {
    "currencyCode": "USD",
    "amountMicros": "9000000"  // $9.00
  }
}
```

## API Reference

### OpenIapStore Methods

Available in both `OpenIapStore` and `OpenIapModule`:

#### `suspend fun checkAlternativeBillingAvailability(): Boolean`
- **Purpose**: Check if alternative billing is available for current user/device
- **Returns**: `true` if available, `false` otherwise
- **When to call**: Before starting purchase flow (Step 1)
- **Throws**: `OpenIapError.NotPrepared` if billing client not ready

#### `suspend fun showAlternativeBillingInformationDialog(activity: Activity): Boolean`
- **Purpose**: Show required information dialog to user
- **Parameters**: `activity` - Current activity context
- **Returns**: `true` if user accepted, `false` if canceled
- **When to call**: BEFORE processing payment (Step 2)
- **Note**: Google requires this dialog to be shown every purchase
- **Throws**: `OpenIapError.NotPrepared` if billing client not ready

#### `suspend fun createAlternativeBillingReportingToken(): String?`
- **Purpose**: Create external transaction token for reporting to Google
- **Returns**: Token string or `null` if failed
- **When to call**: AFTER successful payment in your system (Step 4)
- **Note**: Token must be reported to Google within 24 hours
- **Throws**: `OpenIapError.NotPrepared` if billing client not ready

### OpenIapModule Only Methods

If using `OpenIapModule` directly, you also need:

#### `suspend fun initConnection(): Boolean`
- **Purpose**: Initialize billing client connection
- **Returns**: `true` if connection successful
- **When to call**: Before any billing operations
- **Note**: OpenIapStore handles this automatically

#### `fun setActivity(activity: Activity?)`
- **Purpose**: Set current activity for billing flows
- **Parameters**: `activity` - Current activity or null
- **When to call**: Before showing dialogs or launching billing flows
- **Note**: OpenIapStore handles this automatically

## Example App

See [AlternativeBillingScreen.kt](Example/src/main/java/dev/hyo/martie/screens/AlternativeBillingScreen.kt) for a complete example.

⚠️ **Important**: The example app skips Step 3 (actual payment) because it's a demo. You **MUST** implement Step 3 with your real payment system (Stripe, PayPal, Toss, etc.) before calling `createAlternativeBillingReportingToken()`.

## Testing

1. **Enroll in Play Console**:
   - Go to Play Console → Your App → Monetization setup
   - Enable "Alternative billing"
   - Select eligible countries

2. **Add Test Accounts**:
   - Go to Settings → License testing
   - Add test account emails

3. **Test Flow**:
   - Build signed APK/Bundle
   - Upload to Internal Testing track
   - Install on device with test account
   - Check logs for initialization status

4. **Expected Logs**:
```
✓ Alternative billing only enabled successfully
✓ Alternative billing is available
✓ Dialog shown to user
✓ External transaction token created: eyJhbG...
```

## Common Issues

### "Alternative billing not available"
- **Cause**: App not enrolled, user not in eligible country, or console setup incomplete
- **Fix**: Check Play Console enrollment status and test account country

### "enableAlternativeBillingOnly() method not found"
- **Cause**: Billing Library version < 6.2
- **Fix**: Update to Billing Library 6.2+ (this library uses 8.0.0)

### "Google Play dialog appears instead of alternative billing"
- **Cause**: `enableAlternativeBillingOnly()` not called on BillingClient
- **Fix**: Check initialization logs for "✓ Alternative billing only enabled successfully"

### "`onPurchaseUpdated` is not called after payment"
- **Cause**: This is EXPECTED behavior - Alternative Billing bypasses Google Play callbacks
- **Fix**: Handle payment completion in your payment system's callback (Step 3), not in `onPurchaseUpdated`

## Resources

- [Official Google Documentation](https://developer.android.com/google/play/billing/alternative)
- [Alternative Billing Reporting API](https://developer.android.com/google/play/billing/alternative/reporting)
- [Play Console Help](https://support.google.com/googleplay/android-developer/answer/12419624)
