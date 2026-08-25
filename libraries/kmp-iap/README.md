# kmp-iap

<div align="center">
  <img src="https://raw.githubusercontent.com/hyodotdev/openiap/main/packages/docs/public/logos/kmp-iap.webp" width="200" alt="kmp-iap logo" />
  
  <a href="https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap"><img src="https://img.shields.io/maven-central/v/io.github.hyochan/kmp-iap.svg?style=flat-square" alt="Maven Central" /></a>
  <a href="https://github.com/hyodotdev/openiap/actions/workflows/ci-kmp-iap.yml?query=branch%3Amain"><img src="https://github.com/hyodotdev/openiap/actions/workflows/ci-kmp-iap.yml/badge.svg?branch=main" alt="KMP CI" /></a>
  <a href="https://openiap.dev"><img src="https://img.shields.io/badge/OpenIAP-Compliant-green?style=flat-square" alt="OpenIAP Compliant" /></a>
  <img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License" />
  
  A comprehensive Kotlin Multiplatform library for in-app purchases on Android and iOS platforms that conforms to the <a href="https://openiap.dev">OpenIAP specification</a>
  
  <a href="https://openiap.dev"><img src="https://raw.githubusercontent.com/hyodotdev/openiap/main/logo.webp" alt="OpenIAP" height="40" /></a>
</div>

## 📚 Documentation

Visit the documentation site for installation guides, API reference, and examples:

### **[openiap.dev/docs/setup/kmp](https://openiap.dev/docs/setup/kmp)**

## Using with AI Assistants

kmp-iap provides AI-friendly documentation for Cursor, GitHub Copilot, Claude, and ChatGPT.

**[📖 AI Assistants Guide →](https://openiap.dev/docs/guides/ai-assistants)**

Quick links:
- [llms.txt](https://openiap.dev/llms.txt) - Quick reference (~300 lines)
- [llms-full.txt](https://openiap.dev/llms-full.txt) - Full API reference (~1000 lines)

## 📦 Installation

```kotlin
dependencies {
    implementation("io.github.hyochan:kmp-iap:<version>")
}
```

Use the latest version from
[Maven Central](https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap).

## 🚀 Quick Start

### Option 1: Using Global Instance (Simple)

```kotlin
import io.github.hyochan.kmpiap.kmpIapInstance
import io.github.hyochan.kmpiap.*

// Use the global singleton instance
kmpIapInstance.initConnection()

// Get products with the DSL API
val products = kmpIapInstance.fetchProducts {
    skus = listOf("product_id")
    type = ProductQueryType.InApp
}

// Request purchase - DSL API with platform-specific options
val purchase = kmpIapInstance.requestPurchase {
    apple {
        sku = "product_id"
        quantity = 1
    }
    google {
        skus = listOf("product_id")
    }
}

// Or just for one platform
val iosPurchase = kmpIapInstance.requestPurchase {
    apple {
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

// Get products with the DSL API
val products = kmpIAP.fetchProducts {
    skus = listOf("product_id")
    type = ProductQueryType.InApp
}

// Request purchase - DSL API with platform-specific options
val purchase = kmpIAP.requestPurchase {
    apple {
        sku = "product_id"
        quantity = 1
    }
    google {
        skus = listOf("product_id")
    }
}

// Or just for one platform
val androidPurchase = kmpIAP.requestPurchase {
    google {
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

<a href="https://openiap.dev"><img src="https://raw.githubusercontent.com/hyodotdev/openiap/main/logo.webp" alt="OpenIAP" height="50" /></a>

kmp-iap conforms to the **[OpenIAP specification](https://openiap.dev)** — an open, vendor-neutral interoperability standard for in-app purchases. OpenIAP provides:

- **Shared specification** — Common types, error codes, and purchase flows across all platforms
- **Generated type-safe bindings** — Swift, Kotlin, Dart, and GDScript from a single GraphQL schema
- **Platform implementations** — [openiap-apple](https://github.com/hyodotdev/openiap/tree/main/packages/apple) (StoreKit 2) and [openiap-google](https://github.com/hyodotdev/openiap/tree/main/packages/google) (Play Billing 9.1.0)
- **Verification profiles** — Standardized receipt validation and purchase verification patterns

Other libraries built on OpenIAP: [react-native-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/react-native-iap) · [expo-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap) · [flutter_inapp_purchase](https://github.com/hyodotdev/openiap/tree/main/libraries/flutter_inapp_purchase) · [godot-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/godot-iap)

**[Learn more about the OpenIAP standard →](https://openiap.dev/docs/foundation/about)**

## Community

Have a question or need help? Ask in [kmp-iap Q&A Discussions](https://github.com/hyodotdev/openiap/discussions/categories/kmp-iap).

For bug reports, please [open an issue](https://github.com/hyodotdev/openiap/issues).

<!-- sponsors:start -->
<!-- Generated by scripts/sync-sponsors.mjs from packages/docs/sponsor-registry.json. -->
## Sponsors

<p align="center">
  <a href="https://meta.com">
    <img src="https://openiap.dev/meta.svg" alt="Meta" height="80" align="middle">
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://developer.amazon.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://openiap.dev/sponsors/amazon-dark.webp">
      <img src="https://openiap.dev/sponsors/amazon.webp" alt="Amazon Developer" height="44" align="middle">
    </picture>
  </a>
</p>

Thank you to [Meta](https://meta.com) and [Amazon Developer](https://developer.amazon.com/) for supporting OpenIAP. [View sponsorship options](https://openiap.dev/sponsors).

### OpenCollective

We also recognize sponsors and backers through OpenCollective. The original react-native-iap collective now supports the broader OpenIAP ecosystem and is managed separately from the main sponsor program.

**Sponsors:** <a href="https://opencollective.com/openiap#sponsors"><img src="https://opencollective.com/openiap/sponsors.svg?width=890&cache=20260706" alt="OpenCollective sponsors" /></a>

**Backers:** <a href="https://opencollective.com/openiap#backers"><img src="https://opencollective.com/openiap/backers.svg?width=890&cache=20260706" alt="OpenCollective backers" /></a>

[Become a sponsor](https://opencollective.com/openiap#sponsor) | [Become a backer](https://opencollective.com/openiap#backer)

### Past supporters

Supported the project before the OpenIAP sponsor program.

<p align="center">
  <a href="https://namiml.com">
    <img src="https://openiap.dev/sponsors/nami.webp" alt="Nami" height="32" align="middle">
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://www.courier.com/?utm_source=react-native-iap&utm_campaign=osssponsors">
    <img src="https://openiap.dev/sponsors/courier.webp" alt="Courier" height="32" align="middle">
  </a>
</p>

[openiap-sponsors]: https://openiap.dev/sponsors
[openiap-github-sponsors]: https://github.com/sponsors/hyodotdev
[openiap-opencollective]: https://opencollective.com/openiap
[openiap-paypal]: https://www.paypal.me/dooboolab
[openiap-company-contact]: mailto:hyo@hyo.dev
<!-- sponsors:end -->

## 📄 License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.
