# KMP-IAP Example Application

This is a Kotlin Multiplatform example project demonstrating the usage of the KMP-IAP library for in-app purchases across Android, iOS, Desktop, and Web.

## Project Structure

* `/src` contains the shared Kotlin code:
  * `commonMain` - Common code shared across all platforms
  * `androidMain` - Android-specific implementations
  * `iosMain` - iOS-specific implementations
  * `jvmMain` - Desktop (JVM) specific implementations

* `/iosApp` - iOS application entry point using SwiftUI

## Running the Example

### Android
```bash
./gradlew :example:installDebug
```

### iOS
Open `/iosApp/iosApp.xcodeproj` in Xcode and run the project.

### Desktop
```bash
./gradlew :example:run
```

### Web
```bash
./gradlew :example:wasmJsBrowserDevelopmentRun
```

## Features Demonstrated

* **In-App Purchase Flow**: Complete purchase flow for consumable products with receipt validation comments
* **Subscription Flow**: Subscription management with automatic UI updates upon purchase
* **Available Purchases**: View and restore previous purchases with consume/acknowledge functionality
* **Offer Code Redemption**: Platform-specific promo code redemption (iOS sheet, Android Play Store)
* **Instance-based API**: Demonstrates the new `KmpIAP()` class-based approach that works in commonMain

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
