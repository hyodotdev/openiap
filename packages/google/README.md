# OpenIAP Android

<div align="center">
  <img src="./logo.webp" alt="OpenIAP Google Logo" width="120" height="120">
  
  <p><strong>Android implementation of the <a href="https://www.openiap.dev/">OpenIAP</a> specification using Google Play Billing.</strong></p>
</div>

<br />

[![Maven Central](https://img.shields.io/maven-central/v/io.github.hyochan.openiap/openiap-google)](https://central.sonatype.com/artifact/io.github.hyochan.openiap/openiap-google)
[![API](https://img.shields.io/badge/API-21%2B-brightgreen.svg?style=flat)](https://android-arsenal.com/api?level=21)
[![Google Release](https://github.com/hyodotdev/openiap/actions/workflows/release-google.yml/badge.svg)](https://github.com/hyodotdev/openiap/actions/workflows/release-google.yml)
[![CI](https://github.com/hyodotdev/openiap/actions/workflows/ci.yml/badge.svg)](https://github.com/hyodotdev/openiap/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Modern Android Kotlin library for in-app purchases using Google Play Billing Library v8.

## 🌐 Learn More

Visit [**openiap.dev**](https://openiap.dev) for complete documentation, guides, and the full OpenIAP specification.

## 🎯 Overview

OpenIAP GMS is a modern, type-safe Kotlin library that simplifies Google Play in-app billing integration. It provides a clean, coroutine-based API that handles all the complexity of Google Play Billing while offering robust error handling and real-time purchase tracking.

## ✨ Features

- 🔐 **Google Play Billing v8** - Latest billing library with enhanced security
- ⚡ **Kotlin Coroutines** - Modern async/await API
- 🎯 **Type Safe** - Full Kotlin type safety with sealed classes
- 🔄 **Real-time Events** - Purchase update and error listeners
- 🧵 **Thread Safe** - Concurrent operations with proper synchronization
- 📱 **Easy Integration** - Simple singleton pattern with context management
- 🛡️ **Robust Error Handling** - Comprehensive error types with detailed messages
- 🚀 **Production Ready** - Used in production apps

## 📋 Requirements

- **Minimum SDK**: 21 (Android 5.0)
- **Compile SDK**: 34+
- **Google Play Billing**: v8.0.0
- **Kotlin**: 1.9.20+

## 📦 Installation

Add to your module's `build.gradle.kts`:

```kotlin
dependencies {
    implementation("io.github.hyochan.openiap:openiap-google:1.2.12")
}
```

Or `build.gradle`:

```groovy
dependencies {
    implementation 'io.github.hyochan.openiap:openiap-google:1.2.12'
}
```

## 🚀 Quick Start

### 1. Initialize in Application

```kotlin
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        OpenIAP.initialize(this)
    }
}
```

### 2. Basic Usage

```kotlin
class MainActivity : AppCompatActivity() {
    private lateinit var openIAP: OpenIAP

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        openIAP = OpenIAP.getInstance()

        // Set up listeners
        openIAP.addPurchaseUpdateListener { purchase ->
            handlePurchaseUpdate(purchase)
        }

        openIAP.addPurchaseErrorListener { error ->
            handlePurchaseError(error)
        }

        // Initialize connection
        lifecycleScope.launch {
            try {
                val connected = openIAP.initConnection()
                if (connected) {
                    loadProducts()
                }
            } catch (e: OpenIapError) {
                // Handle connection error
            }
        }
    }

    private suspend fun loadProducts() {
        try {
            val products = openIAP.fetchProducts(listOf("premium_upgrade", "remove_ads"))
            // Display products in UI
        } catch (e: OpenIapError) {
            // Handle error
        }
    }

    private suspend fun purchaseProduct(productId: String) {
        try {
            openIAP.requestPurchase(
                activity = this,
                sku = productId
            )
        } catch (e: OpenIapError) {
            // Handle purchase error
        }
    }

    private fun handlePurchaseUpdate(purchase: OpenIapPurchase) {
        when (purchase.purchaseState) {
            PurchaseState.Purchased -> {
                // Acknowledge or consume the purchase
                lifecycleScope.launch {
                    try {
                        purchase.purchaseToken?.let { token ->
                            openIAP.acknowledgePurchase(token)
                            // Or for consumables: openIAP.consumePurchase(token)
                        }
                    } catch (e: OpenIapError) {
                        // Handle error
                    }
                }
            }
            PurchaseState.Pending -> {
                // Purchase is pending (e.g., awaiting payment)
            }
            // Handle other states...
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        openIAP.clearListeners()
        openIAP.endConnection()
    }
}
```

## 📚 API Reference

### Core Methods

#### Connection Management

```kotlin
suspend fun initConnection(): Boolean
fun endConnection()
fun isReady(): Boolean
```

#### Product Management

```kotlin
suspend fun fetchProducts(skus: List<String>): List<OpenIapProduct>
suspend fun fetchProducts(type: String, skus: List<String>): List<OpenIapProduct>
fun getCachedProduct(sku: String): ProductDetails?
fun getAllCachedProducts(): Map<String, ProductDetails>
```

#### Purchase Operations

```kotlin
suspend fun requestPurchase(
    activity: Activity,
    sku: String,
    offerToken: String? = null,
    obfuscatedAccountId: String? = null,
    obfuscatedProfileId: String? = null
)

suspend fun requestPurchase(params: Map<String, Any?>, activity: Activity)
suspend fun finishTransaction(purchase: OpenIapPurchase, isConsumable: Boolean? = null)
suspend fun getAvailablePurchases(): List<OpenIapPurchase>
suspend fun getAvailablePurchases(options: Map<String, Any?>?): List<OpenIapPurchase> // options ignored on Android
suspend fun getAvailableItemsByType(type: String): List<OpenIapPurchase>
suspend fun acknowledgePurchase(purchaseToken: String): Boolean
suspend fun consumePurchase(purchaseToken: String): Boolean
```

> Note: Use `"in-app"` for in-app product types. The legacy alias `"inapp"` remains available for compatibility but will be removed in version 1.2.0.

#### Store Information

```kotlin
suspend fun getStorefront(): String
```

### Subscription Management

```kotlin
suspend fun getActiveSubscriptions(subscriptionIds: List<String>? = null): List<OpenIapActiveSubscription>
suspend fun hasActiveSubscriptions(subscriptionIds: List<String>? = null): Boolean
fun deepLinkToSubscriptions(): Boolean
```

### Event Listeners

```kotlin
fun addPurchaseUpdateListener(listener: OpenIapPurchaseUpdateListener)
fun removePurchaseUpdateListener(listener: OpenIapPurchaseUpdateListener)
fun addPurchaseErrorListener(listener: OpenIapPurchaseErrorListener)
fun removePurchaseErrorListener(listener: OpenIapPurchaseErrorListener)

// Convenience methods
fun addListener(listener: OpenIapListener)
fun removeListener(listener: OpenIapListener)
fun clearListeners()
```

### Data Models

#### OpenIapProduct

```kotlin
data class OpenIapProduct(
    val id: String,
    val title: String,
    val description: String,
    val price: Double?,
    val displayPrice: String,
    val currency: String,
    val type: ProductType,
    val platform: String = "android",
    val displayName: String?,
    val debugDescription: String?,
    val nameAndroid: String?,
    val oneTimePurchaseOfferDetails: OneTimePurchaseOfferDetails?,
    val subscriptionOfferDetails: List<SubscriptionOfferDetails>?
)
```

#### OpenIapPurchase

```kotlin
data class OpenIapPurchase(
    val id: String,                  // transactionId
    val productId: String,
    val ids: List<String>?,          // alias of productIds
    val transactionDate: Double,
    val transactionReceipt: String,
    val purchaseToken: String?,
    val platform: String = "android",
    val quantity: Int = 1,
    val transactionId: String?,
    val purchaseTime: Long,
    val purchaseState: PurchaseState,
    val isAutoRenewing: Boolean,
    // ... Android-specific fields
    val isAcknowledgedAndroid: Boolean?,
    val autoRenewingAndroid: Boolean?,
    // ... many more fields
)
```

#### Error Handling

```kotlin
sealed class OpenIapError : Exception {
    object UserCancelled : OpenIapError()
    object ItemAlreadyOwned : OpenIapError()
    object ItemNotOwned : OpenIapError()
    data class ProductNotFound(val productId: String) : OpenIapError()
    data class PurchaseFailed(override val message: String) : OpenIapError()
    // ... many more error types
}
```

## 🔄 Purchase Flow

1. **Initialize**: Call `initConnection()`
2. **Fetch Products**: Use `fetchProducts()` to load available items
3. **Request Purchase**: Call `requestPurchase()` with the product SKU
4. **Handle Events**: Listen for purchase updates via listeners
5. **Process Purchase**: Acknowledge non-consumables or consume consumables
6. **Server Verification**: Always verify purchases on your backend

## 🛡️ Security Best Practices

- **Server-Side Verification**: Always verify purchases on your backend server
- **Acknowledge Promptly**: Acknowledge non-consumable purchases within 3 days
- **Consume Consumables**: Consume consumable purchases after granting content
- **Handle All States**: Implement proper handling for all purchase states
- **Error Handling**: Implement comprehensive error handling

## 🧪 Testing

The library includes a comprehensive sample app demonstrating all features:

```bash
git clone https://github.com/hyodotdev/openiap.git
cd openiap/packages/google
./gradlew :Example:installDebug
```

### Test Products

For development, use Google Play's test SKUs:

- `android.test.purchased` - Always succeeds
- `android.test.canceled` - Always cancels
- `android.test.item_unavailable` - Always fails

For production testing, configure products in Google Play Console and use internal testing.

## 📱 Sample App

The included sample app (`Example/` directory) demonstrates:

- ✅ Connection management with retry logic
- ✅ Product listing and purchase flow
- ✅ Real-time purchase event handling
- ✅ Purchase history and management
- ✅ Error handling and user feedback
- ✅ Android-specific billing features

## 🔧 Advanced Usage

### Custom Error Handling

```kotlin
try {
    openIAP.requestPurchase(this, "premium_upgrade")
} catch (e: OpenIapError) {
    when (e) {
        OpenIapError.UserCancelled -> {
            // User cancelled, no action needed
        }
        OpenIapError.ItemAlreadyOwned -> {
            // Item already purchased
            showMessage("You already own this item!")
        }
        is OpenIapError.ProductNotFound -> {
            // Product not available
            showError("Product ${e.productId} not found")
        }
        // Handle other error types...
        else -> {
            showError("Purchase failed: ${e.message}")
        }
    }
}
```

### Subscription Offers

```kotlin
// Get subscription offers
val product = openIAP.getCachedProduct("monthly_subscription")
val offers = product?.subscriptionOfferDetails

// Purchase with specific offer
val offerToken = offers?.firstOrNull()?.offerToken
openIAP.requestPurchase(
    activity = this,
    sku = "monthly_subscription",
    offerToken = offerToken
)
```

## ⚠️ Important Notes

- This library requires Google Play Billing Library v8
- Test with real Google Play Console products for production
- Always verify purchases server-side for security
- Handle all purchase states properly
- Clean up listeners and connections in `onDestroy()`

## 🔧 Troubleshooting

### Common Issues

1. **Product not found**

   - Ensure products are configured in Google Play Console
   - App must be uploaded to Google Play Console (even as draft)
   - Wait up to 24 hours for products to become available

2. **Billing unavailable**

   - Verify Google Play Services are installed and updated
   - Check that app is signed with release key for testing
   - Ensure billing permissions are in AndroidManifest.xml

3. **Purchase not triggering**
   - Use real device with Google Play Store
   - Avoid emulators without Google Play Services
   - Check that test account has payment method

### Debug Mode

Enable verbose logging to see detailed billing operations:

```kotlin
// In development builds
if (BuildConfig.DEBUG) {
    Log.d("OpenIAP", "Debug mode enabled")
}
```

## 📄 License

```txt
MIT License

Copyright (c) 2025 hyo.dev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/hyodotdev/openiap/issues)
- **Discussions**: [OpenIAP Discussions](https://github.com/hyodotdev/openiap/discussions)

---

<div align="center">
  <strong>Built with ❤️ for the OpenIAP community</strong>
  
</div>
