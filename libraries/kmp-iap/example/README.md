# KMP-IAP Example Application

This Kotlin Multiplatform example demonstrates KMP-IAP on its supported mobile targets: Android and iOS.

## Project Structure

- `/composeApp/src` contains the shared Kotlin code:
  - `commonMain` - Common code shared by Android and iOS
  - `androidMain` - Android-specific implementations
  - `iosMain` - iOS-specific implementations

- `/iosApp` - iOS application entry point using SwiftUI

## Running the Example

### Android

```bash
./gradlew :example:composeApp:installPlayDebug
```

### iOS

Open `/iosApp/iosApp.xcodeproj` in Xcode and run the project.

## Purchase verification

Copy `.env.example` to `.env` and fill in:

| Key                  | Purpose                                                |
| -------------------- | ------------------------------------------------------ |
| `IAPKIT_API_KEY`     | `openiap-kit_pk_` publishable key, never an `sk_` key. |
| `IAPKIT_BASE_URL`    | Origin of a local IAPKit server; empty uses the host.  |
| `AMAZON_RVS_SANDBOX` | `true` for Amazon App Tester receipts.                 |

`IAPKIT_BASE_URL` is an origin, not the verify path. For **Local (IAPKit)** the
key and the local server must target the same Convex deployment. An Android
device on USB reaches the host through
`adb -s "$ANDROID_SERIAL" reverse --no-rebind tcp:3100 tcp:3100` and
`http://127.0.0.1:3100`; a physical iPhone needs the Mac's LAN address. Debug
builds permit cleartext to loopback only. On iOS the same three keys come from
`iosApp/Configuration/Secrets.xcconfig` (copy `Secrets.xcconfig.example`),
which Info.plist reads; a scheme environment variable overrides them.

The purchase and subscription screens list verification in this order:

1. **None (Skip)** — skip verification.
2. **Local (Device)** — verify on device (iOS only).
3. **Local (IAPKit)** — IAPKit routed to `IAPKIT_BASE_URL`.
4. **IAPKit (Server)** — hosted IAPKit; the local URL is deliberately omitted.

With both values configured, the example defaults to **Local (IAPKit)**. With
only the key, it defaults to **IAPKit (Server)**; without a key, it defaults to
**None (Skip)**.

## Features Demonstrated

- **In-App Purchase Flow**: Complete purchase flow for consumable products with receipt validation comments
- **Subscription Flow**: Subscription management with automatic UI updates upon purchase
- **Available Purchases**: View and restore previous purchases with consume/acknowledge functionality
- **Offer Code Redemption**: Platform-specific promo code redemption (iOS sheet, Android Play Store)
- **Instance-based API**: Demonstrates the new `KmpIAP()` class-based approach that works in commonMain

## Key Implementation Details

### Creating KmpIAP Instance

```kotlin
// In Composable functions
val kmpIAP = remember { KmpIAP() }

// Initialize connection
LaunchedEffect(Unit) {
    kmpIAP.initConnection()
}
```

### Purchase Flow with Receipt Validation

```kotlin
// Listen for purchase updates
kmpIAP.purchaseUpdatedListener.collect { purchase ->
    // IMPORTANT: Server-side receipt validation
    // val isValid = validateReceiptOnServer(purchase.purchaseToken)

    // Finish transaction after validation
    kmpIAP.finishTransaction(
        purchase = purchase,
        isConsumable = true // true for consumables, false for subscriptions
    )
}
```

Learn more about [Kotlin Multiplatform](https://www.jetbrains.com/help/kotlin-multiplatform-dev/get-started.html).
