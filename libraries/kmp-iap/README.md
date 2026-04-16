# kmp-iap

<div align="center">
  <img src="https://raw.githubusercontent.com/hyodotdev/openiap/main/libraries/kmp-iap/docs/static/img/logo.png" width="200" alt="kmp-iap logo" />
  
  <a href="https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap"><img src="https://img.shields.io/maven-central/v/io.github.hyochan/kmp-iap.svg?style=flat-square" alt="Maven Central" /></a>
  <a href="https://github.com/hyodotdev/openiap/actions/workflows/gradle.yml"><img src="https://github.com/hyodotdev/openiap/actions/workflows/gradle.yml/badge.svg" alt="Java CI with Gradle" /></a>
  <a href="https://openiap.dev"><img src="https://img.shields.io/badge/OpenIAP-Compliant-green?style=flat-square" alt="OpenIAP Compliant" /></a>
  <a href="https://codecov.io/gh/hyodotdev/openiap"><img src="https://codecov.io/gh/hyodotdev/openiap/branch/main/graph/badge.svg?token=YOUR_TOKEN" alt="Coverage Status" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
  
  A comprehensive Kotlin Multiplatform library for in-app purchases on Android and iOS platforms that conforms to the <a href="https://openiap.dev">Open IAP specification</a>
  
  <a href="https://openiap.dev"><img src="https://raw.githubusercontent.com/hyodotdev/openiap/main/logo.png" alt="Open IAP" height="40" /></a>
</div>

## 📚 Documentation

Visit the documentation site for installation guides, API reference, and examples:

### **[hyochan.github.io/kmp-iap](https://hyochan.github.io/kmp-iap)**

## Using with AI Assistants

kmp-iap provides AI-friendly documentation for Cursor, GitHub Copilot, Claude, and ChatGPT.

**[📖 AI Assistants Guide →](https://hyochan.github.io/kmp-iap/docs/guides/ai-assistants)**

Quick links:
- [llms.txt](https://hyochan.github.io/kmp-iap/llms.txt) - Quick reference (~300 lines)
- [llms-full.txt](https://hyochan.github.io/kmp-iap/llms-full.txt) - Full API reference (~1000 lines)

## 📦 Installation

```kotlin
dependencies {
    implementation("io.github.hyochan:kmp-iap:2.2.1")
}
```

## 🚀 Quick Start

### Option 1: Using Global Instance (Simple)

```kotlin
import io.github.hyochan.kmpiap.kmpIapInstance
import io.github.hyochan.kmpiap.*

// Use the global singleton instance
kmpIapInstance.initConnection()

// Get products - DSL API in v1.0.0-rc.2
val products = kmpIapInstance.fetchProducts {
    skus = listOf("product_id")
    type = ProductQueryType.InApp
}

// Request purchase - DSL API with platform-specific options
val purchase = kmpIapInstance.requestPurchase {
    ios {
        sku = "product_id"
        quantity = 1
    }
    android {
        skus = listOf("product_id")
    }
}

// Or just for one platform
val iosPurchase = kmpIapInstance.requestPurchase {
    ios {
        sku = "product_id"
    }
}

// Finish transaction (after server-side validation)
kmpIapInstance.finishTransaction(
    purchase = purchase.toPurchaseInput(),
    isConsumable = true // true for consumables, false for subscriptions
)
```

### Option 2: Create Your Own Instance (Recommended for Testing)

```kotlin
import io.github.hyochan.kmpiap.KmpIAP
import io.github.hyochan.kmpiap.*

// Create your own instance
val kmpIAP = KmpIAP()

// Initialize connection
kmpIAP.initConnection()

// Get products - DSL API in v1.0.0-rc.2
val products = kmpIAP.fetchProducts {
    skus = listOf("product_id")
    type = ProductQueryType.InApp
}

// Request purchase - DSL API with platform-specific options
val purchase = kmpIAP.requestPurchase {
    ios {
        sku = "product_id"
        quantity = 1
    }
    android {
        skus = listOf("product_id")
    }
}

// Or just for one platform
val androidPurchase = kmpIAP.requestPurchase {
    android {
        skus = listOf("product_id")
    }
}

// Finish transaction (after server-side validation)
kmpIAP.finishTransaction(
    purchase = purchase.toPurchaseInput(),
    isConsumable = true // true for consumables, false for subscriptions
)
```

## Powered by OpenIAP

<a href="https://openiap.dev"><img src="https://raw.githubusercontent.com/hyodotdev/openiap/main/logo.png" alt="OpenIAP" height="50" /></a>

kmp-iap conforms to the **[OpenIAP specification](https://openiap.dev)** — an open, vendor-neutral interoperability standard for in-app purchases. OpenIAP provides:

- **Shared specification** — Common types, error codes, and purchase flows across all platforms
- **Generated type-safe bindings** — Swift, Kotlin, Dart, and GDScript from a single GraphQL schema
- **Platform implementations** — [openiap-apple](https://github.com/hyodotdev/openiap/tree/main/packages/apple) (StoreKit 2) and [openiap-google](https://github.com/hyodotdev/openiap/tree/main/packages/google) (Play Billing 8.x)
- **Verification profiles** — Standardized receipt validation and purchase verification patterns

Other libraries built on OpenIAP: [react-native-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/react-native-iap) · [expo-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap) · [flutter_inapp_purchase](https://github.com/hyodotdev/openiap/tree/main/libraries/flutter_inapp_purchase) · [godot-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/godot-iap)

**[Learn more about the OpenIAP standard →](https://openiap.dev/docs/foundation/about)**

## Community

Have a question or need help? Ask in [kmp-iap Q&A Discussions](https://github.com/hyodotdev/openiap/discussions/categories/kmp-iap).

For bug reports, please [open an issue](https://github.com/hyodotdev/openiap/issues).

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.
