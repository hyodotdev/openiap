# flutter_inapp_purchase

<div align="center">
  <img src="https://openiap.dev/frameworks/flutter.svg" width="200" alt="flutter_inapp_purchase logo" />
  
  [![Pub Version](https://img.shields.io/pub/v/flutter_inapp_purchase.svg?style=flat-square)](https://pub.dartlang.org/packages/flutter_inapp_purchase) [![Flutter CI](https://github.com/hyodotdev/openiap/actions/workflows/ci-flutter-inapp-purchase.yml/badge.svg?branch=main)](https://github.com/hyodotdev/openiap/actions/workflows/ci-flutter-inapp-purchase.yml?query=branch%3Amain) [![OpenIAP](https://img.shields.io/badge/OpenIAP-Compliant-green?style=flat-square)](https://openiap.dev) [![Coverage Status](https://codecov.io/gh/hyodotdev/openiap/branch/main/graph/badge.svg?component=flutter-inapp-purchase)](https://app.codecov.io/gh/hyodotdev/openiap/tree/main/libraries/flutter_inapp_purchase) ![License](https://img.shields.io/badge/license-MIT-blue.svg)
  
  A comprehensive Flutter plugin for implementing in-app purchases that conforms to the [OpenIAP specification](https://openiap.dev)

<a href="https://openiap.dev"><img src="https://raw.githubusercontent.com/hyodotdev/openiap/main/logo.webp" alt="OpenIAP" height="40" /></a>

</div>

## 📚 Documentation

**[📖 Visit our comprehensive documentation site →](https://openiap.dev/docs/setup/flutter)**

## 📦 Installation

```bash
flutter pub add flutter_inapp_purchase
```

For manual `pubspec.yaml` edits, copy the current dependency from the
[flutter_inapp_purchase pub.dev package page](https://pub.dev/packages/flutter_inapp_purchase).

### iOS/macOS Native Dependency Resolution

No manual `Package.swift` or `Podfile` entry is required. On Flutter 3.44 and
newer, Swift Package Manager is enabled by default and the Flutter CLI resolves
the native OpenIAP dependency automatically when you run or build the app.

Projects that disable Swift Package Manager, or projects using an older Flutter
toolchain, continue to use CocoaPods. Run `pod install` after `flutter pub get`
for each Apple target you use:

```bash
(cd ios && pod install)

# If your app also has a macOS target:
(cd macos && pod install)
```

Apple platform targets require iOS 15.0+ or macOS 14.0+.

### Disable IAP on Android

Apps that use this package only on Apple platforms can exclude every Android
store SDK. Add this to the app's `android/gradle.properties`:

```properties
openiapPlatform=none
```

Then run `flutter clean` before the next Android build.

The Android plugin remains registered, but it compiles a no-op implementation:
`initConnection()` returns `false`, and store operations report
`ErrorCode.IapNotAvailable`. The build contains no OpenIAP Google, Play Billing,
Horizon, or Amazon IAP SDK dependency, and no billing manifest entry supplied by
those SDKs. Omitting the property keeps Google Play as the default. Do not
combine the property with `horizonEnabled` or `fireOsEnabled`.

## 🔧 Quick Start

### Basic Usage

```dart
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Create instance
final iap = FlutterInappPurchase();

// Initialize connection
await iap.initConnection();

// Fetch products with explicit type
final products = await iap.fetchProducts<Product>(
  skus: ['product_id'],
  type: ProductQueryType.InApp,
);

// Request purchase (builder DSL)
await iap.requestPurchaseWithBuilder(
  build: (builder) {
    builder
      ..type = ProductQueryType.InApp
      ..android.skus = ['product_id']
      ..ios.sku = 'product_id';
  },
);
```

## Using with AI Assistants

flutter_inapp_purchase provides AI-friendly documentation for Cursor, GitHub Copilot, Claude, and ChatGPT.

**[AI Assistants Guide](https://openiap.dev/docs/guides/ai-assistants)**

Quick links:

- [llms.txt](https://openiap.dev/llms.txt) - Quick reference
- [llms-full.txt](https://openiap.dev/llms-full.txt) - Full API reference

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

### Singleton Usage

For global state management or when you need a shared instance:

```dart
// Use singleton instance
final iap = FlutterInappPurchase.instance;
await iap.initConnection();

// The instance is shared across your app
final sameIap = FlutterInappPurchase.instance; // Same instance
```

## Powered by OpenIAP

<a href="https://openiap.dev"><img src="https://raw.githubusercontent.com/hyodotdev/openiap/main/logo.webp" alt="OpenIAP" height="50" /></a>

flutter_inapp_purchase conforms to the **[OpenIAP specification](https://openiap.dev)** — an open, vendor-neutral interoperability standard for in-app purchases. OpenIAP provides:

- **Shared specification** — Common types, error codes, and purchase flows across all platforms
- **Generated type-safe bindings** — Swift, Kotlin, Dart, and GDScript from a single GraphQL schema
- **Platform implementations** — [openiap-apple](https://github.com/hyodotdev/openiap/tree/main/packages/apple) (StoreKit 2) and [openiap-google](https://github.com/hyodotdev/openiap/tree/main/packages/google) (Play Billing 9.1.0)
- **Verification profiles** — Standardized receipt validation and purchase verification patterns

Other libraries built on OpenIAP: [react-native-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/react-native-iap) · [expo-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap) · [kmp-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap) · [godot-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/godot-iap)

**[Learn more about the OpenIAP standard →](https://openiap.dev/docs/foundation/about)**

## Community

Have a question or need help? Ask in [flutter_inapp_purchase Q&A Discussions](https://github.com/hyodotdev/openiap/discussions/categories/flutter_inapp_purchase).

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

MIT License - see [LICENSE](LICENSE) file for details.
