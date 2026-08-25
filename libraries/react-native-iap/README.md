# React Native IAP

<div align="center">
  <img src="https://openiap.dev/frameworks/react-native.webp" alt="React Native IAP Logo" width="150" />

[![Version](http://img.shields.io/npm/v/react-native-iap.svg?style=flat-square)](https://npmjs.org/package/react-native-iap) [![Download](http://img.shields.io/npm/dm/react-native-iap.svg?style=flat-square)](https://npmjs.org/package/react-native-iap) [![OpenIAP](https://img.shields.io/badge/OpenIAP-Compliant-green?style=flat-square)](https://openiap.dev) [![CI - Test](https://github.com/hyodotdev/openiap/actions/workflows/ci-react-native-iap.yml/badge.svg?branch=main)](https://github.com/hyodotdev/openiap/actions/workflows/ci-react-native-iap.yml?query=branch%3Amain) [![codecov](https://codecov.io/gh/hyodotdev/openiap/branch/main/graph/badge.svg?component=react-native-iap)](https://app.codecov.io/gh/hyodotdev/openiap/tree/main/libraries/react-native-iap) [![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fhyochan%2Freact-native-iap.svg?type=shield&issueType=license)](https://app.fossa.com/projects/git%2Bgithub.com%2Fhyochan%2Freact-native-iap?ref=badge_shield&issueType=license)

**React Native IAP** is a high-performance in-app purchase library using Nitro Modules that **conforms to the [OpenIAP specification](https://openiap.dev)**. It provides a unified API for handling in-app purchases across iOS and Android platforms with comprehensive error handling and modern TypeScript support.

<a href="https://openiap.dev"><img src="https://raw.githubusercontent.com/hyodotdev/openiap/main/logo.webp" alt="OpenIAP" height="40" /></a>
</div>

## 📚 Documentation

**[📖 Visit our comprehensive documentation site →](https://openiap.dev/docs/setup/react-native)**

## ⚠️ Notice

**Starting from version 14.0.0**, this library uses [Nitro Modules](https://github.com/mrousavy/nitro) for high-performance native bridge implementation. You must install `react-native-nitro-modules` alongside `react-native-iap`.

### Compatibility (Nitro 14.x)

- `react-native-iap@14.x` (Nitro) requires **React Native 0.79+**.
- Stuck on **RN 0.75.x or lower**? Use the last pre‑Nitro version: `npm i react-native-iap@13.1.0`.
- Seeing Swift 6 C++ interop errors in Nitro (e.g., `AnyMap.swift` with `cppPart.pointee.*`)? Temporarily pin Swift to **5.10** for the `NitroModules` pod (see Installation docs) or upgrade RN and Nitro deps.
- Recommended: upgrade to RN 0.79+, update `react-native-nitro-modules`/`nitro-codegen`, then `pod install` and clean build.

More details and the Podfile snippet are in the docs: https://openiap.dev/docs/setup/react-native#ios

## ✨ Features

- 🔄 **Cross-platform Support**: Works seamlessly on both iOS and Android
- ⚡ **Nitro Modules**: High-performance native bridge with minimal overhead
- 🎯 **TypeScript First**: Full TypeScript support with comprehensive type definitions
- 🛡️ **Centralized Error Handling**: Unified error management with platform-specific error code mapping
- 🎣 **React Hooks**: Modern React hooks API with `useIAP`
- 📱 **React Native Focused**: Use `expo-iap` for Expo projects
- 🔍 **Receipt Validation**: Built-in receipt validation for both platforms
- 💎 **Products & Subscriptions**: Support for both one-time purchases and subscriptions
- 🚀 **Performance Optimized**: Efficient caching and minimal re-renders

## 🚀 Quick Start

```bash
npm install react-native-iap react-native-nitro-modules
# or
yarn add react-native-iap react-native-nitro-modules
```

**[📖 See the complete installation guide and quick start tutorial →](https://openiap.dev/docs/setup/react-native#installation)**

## 🏗️ Architecture

React Native IAP is built with a modern architecture that emphasizes:

- **Nitro Modules**: High-performance native bridge with C++ core and platform-specific implementations
- **Type Safety**: Comprehensive TypeScript definitions for all APIs
- **Error Resilience**: Centralized error handling with meaningful error codes
- **Platform Abstraction**: Unified API that handles platform differences internally
- **Performance**: Optimized for minimal bundle size and runtime performance

## 📱 Platform Support

| Platform          | Support | Notes                            |
| ----------------- | ------- | -------------------------------- |
| iOS               | ✅      | StoreKit 2 (requires iOS 15+)    |
| Android           | ✅      | Google Play Billing v9.1.0       |
| Expo Go           | ❌      | Use `expo-iap` for Expo projects |
| Expo Dev Client   | ❌      | Use `expo-iap` for Expo projects |
| Bare React Native | ✅      | Full support                     |

## 📦 Installation & Configuration

### Prerequisites

Before installing React Native IAP, make sure you have:

- React Native 0.79 or later
- Node.js 18 or later (and any higher minimum required by your React Native version)
- iOS 15+ for iOS apps (StoreKit 2 requirement)
- Android API level 23+ for the library (and any higher minimum required by React Native)
- Kotlin 2.1.20 or later for Android builds

### Post Installation

#### Android Configuration

**Kotlin compatibility:** React Native IAP uses the Kotlin and Android Gradle Plugin versions supplied by the host React Native project. Published OpenIAP Android artifacts are validated against Kotlin `2.1.20`, while the standalone source-build fallback is Kotlin `2.2.0`. React Native 0.79 projects that still use Kotlin 2.0.21 must upgrade their Android Kotlin plugin; newer React Native releases should keep their supplied compiler version.

#### iOS Configuration

1. **Install pods**:

   ```bash
   cd ios && pod install
   ```

2. **Add StoreKit capability** to your iOS app in Xcode:
   - Open your project in Xcode
   - Select your app target
   - Go to "Signing & Capabilities"
   - Click "+ Capability" and add "In-App Purchase"

#### Expo Projects

Use [`expo-iap`](https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap) for Expo apps. This package targets bare React Native/Nitro projects.

### Store Configuration

React Native IAP is **OpenIAP compliant**. For detailed store configuration:

- **[iOS Setup →](https://openiap.dev/docs/ios-setup)** - App Store Connect configuration
- **[Android Setup →](https://openiap.dev/docs/android-setup)** - Google Play Console configuration

## 🤖 Using with AI Assistants

React Native IAP provides AI-friendly documentation for Cursor, GitHub Copilot, Claude, and ChatGPT.

**[📖 AI Assistants Guide →](https://openiap.dev/docs/guides/ai-assistants)**

Quick links:

- [llms.txt](https://openiap.dev/llms.txt) - Quick reference
- [llms-full.txt](https://openiap.dev/llms-full.txt) - Full API reference

## 🎯 What's Next?

**[📖 Visit our comprehensive documentation site →](https://openiap.dev/docs/setup/react-native)**

### Key Resources

- **[Installation & Quick Start](https://openiap.dev/docs/setup/react-native#installation)** - Get started in minutes
- **[API Reference](https://openiap.dev/docs/apis)** - Complete useIAP hook documentation
- **[Examples](https://openiap.dev/docs/example)** - Production-ready implementations
- **[Error Handling](https://openiap.dev/docs/errors)** - OpenIAP compliant error codes
- **[Troubleshooting](https://openiap.dev/docs/features/debugging)** - Common issues and solutions

## Powered by OpenIAP

<a href="https://openiap.dev"><img src="https://raw.githubusercontent.com/hyodotdev/openiap/main/logo.webp" alt="OpenIAP" height="50" /></a>

React Native IAP conforms to the **[OpenIAP specification](https://openiap.dev)** — an open, vendor-neutral interoperability standard for in-app purchases. OpenIAP provides:

- **Shared specification** — Common types, error codes, and purchase flows across all platforms
- **Generated type-safe bindings** — Swift, Kotlin, TypeScript, Dart, C#, and GDScript from a single GraphQL schema
- **Platform implementations** — [openiap-apple](https://github.com/hyodotdev/openiap/tree/main/packages/apple) (StoreKit 2) and [openiap-google](https://github.com/hyodotdev/openiap/tree/main/packages/google) (Play Billing 9.1.0)
- **Verification profiles** — Standardized receipt validation and purchase verification patterns

Other libraries built on OpenIAP: [expo-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap) · [flutter_inapp_purchase](https://github.com/hyodotdev/openiap/tree/main/libraries/flutter_inapp_purchase) · [kmp-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap) · [maui-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/maui-iap) · [godot-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/godot-iap)

**[Learn more about the OpenIAP standard →](https://openiap.dev/docs/foundation/about)**

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

## Community

Have a question or need help? Ask in [react-native-iap Q&A Discussions](https://github.com/hyodotdev/openiap/discussions/categories/react-native-iap).

For bug reports, please [open an issue](https://github.com/hyodotdev/openiap/issues).

## Contributing

<a href="https://github.com/hyochan/react-native-iap/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=hyochan/react-native-iap" alt="react-native-iap contributors" />
</a>

Thank you to everyone who contributed to [hyochan/react-native-iap](https://github.com/hyochan/react-native-iap), the community where OpenIAP began.

See our [Contributing Guide](./CONTRIBUTING.md) for development setup and guidelines.
