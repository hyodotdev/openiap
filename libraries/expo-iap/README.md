# Expo IAP

<div align="center">
  <img src="https://openiap.dev/frameworks/expo.svg" alt="Expo IAP Logo" width="150" />
  
  [![Version](http://img.shields.io/npm/v/expo-iap.svg?style=flat-square)](https://npmjs.org/package/expo-iap) [![Download](http://img.shields.io/npm/dm/expo-iap.svg?style=flat-square)](https://npmjs.org/package/expo-iap) [![OpenIAP](https://img.shields.io/badge/OpenIAP-Compliant-green?style=flat-square)](https://openiap.dev) [![CI](https://github.com/hyodotdev/openiap/actions/workflows/ci.yml/badge.svg)](https://github.com/hyodotdev/openiap/actions/workflows/ci.yml) [![codecov](https://codecov.io/gh/hyodotdev/openiap/graph/badge.svg?token=47VMTY5NyM)](https://codecov.io/gh/hyodotdev/openiap) [![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fhyochan%2Fexpo-iap.svg?type=shield&issueType=license)](https://app.fossa.com/projects/git%2Bgithub.com%2Fhyochan%2Fexpo-iap?ref=badge_shield&issueType=license)
  
Expo IAP is a powerful in-app purchase solution for Expo and React Native applications that conforms to the Open IAP specification. It provides a unified API for handling in-app purchases across iOS and Android platforms with comprehensive error handling and modern TypeScript support.

If you're shipping an app with expo-iap, we’d love to hear about it—please share your product and feedback in [expo-iap Q&A Discussions](https://github.com/hyodotdev/openiap/discussions/categories/expo-iap). Community stories help us keep improving the ecosystem.

<a href="https://openiap.dev"><img src="https://raw.githubusercontent.com/hyodotdev/openiap/main/logo.png" alt="Open IAP" height="40" /></a>

</div>

## 🎨 Promotion

<div align="center">
  <a href="https://hyodotdev.github.io/kstyled">
    <img src="https://hyodotdev.github.io/kstyled/img/logo.png" alt="kstyled Logo" width="120" />
  </a>

**Compile-time CSS-in-JS for React Native**

✨ Experience the next generation of styling with **[kstyled](https://hyodotdev.github.io/kstyled)** - a blazing-fast, fully type-safe CSS-in-JS solution with zero runtime overhead.

🚀 **[Explore kstyled →](https://hyodotdev.github.io/kstyled)**

</div>

## 📚 Documentation

**[📖 Visit our comprehensive documentation site →](https://openiap.dev/docs/setup/expo)**

## Using with AI Assistants

expo-iap provides AI-friendly documentation for Cursor, GitHub Copilot, Claude, and ChatGPT.

**[📖 AI Assistants Guide →](https://openiap.dev/docs/guides/ai-assistants)**

Quick links:

- [llms.txt](https://openiap.dev/llms.txt) - Quick reference
- [llms-full.txt](https://openiap.dev/llms-full.txt) - Full API reference
- [Onside Integration](https://openiap.dev/docs/features/alternative-marketplace/onside) - Using Onside marketplace payments on iOS

## Notice

The `expo-iap` module has been migrated from [react-native-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/react-native-iap). While we initially considered fully merging everything into `react-native-iap`, we ultimately decided to maintain the two libraries in parallel, each tailored to its own ecosystem.

- **`react-native-iap`** → a **Nitro Modules–based** implementation for React Native.
- **`expo-iap`** → an **Expo Module** with tighter integration and smoother compatibility in the Expo ecosystem.

Both libraries will continue to be maintained in parallel going forward.

📖 See the [OpenIAP discussions](https://github.com/hyodotdev/openiap/discussions) for roadmap and project status updates.

## Installation

```bash
npx expo install expo-iap
```

For platform-specific configuration (Android Kotlin version, iOS deployment target, etc.), see the [Installation Guide](https://openiap.dev/docs/setup/expo#installation).

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details on:

- Development setup
- Running the example app
- Testing guidelines
- Code style and conventions
- Submitting pull requests

For detailed usage examples and error handling, see the [documentation](https://openiap.dev/docs/setup/expo).

> Sharing your thoughts—any feedback would be greatly appreciated!

## Powered by OpenIAP

<a href="https://openiap.dev"><img src="https://raw.githubusercontent.com/hyodotdev/openiap/main/logo.png" alt="OpenIAP" height="50" /></a>

Expo IAP conforms to the **[OpenIAP specification](https://openiap.dev)** — an open, vendor-neutral interoperability standard for in-app purchases. OpenIAP provides:

- **Shared specification** — Common types, error codes, and purchase flows across all platforms
- **Generated type-safe bindings** — Swift, Kotlin, Dart, and GDScript from a single GraphQL schema
- **Platform implementations** — [openiap-apple](https://github.com/hyodotdev/openiap/tree/main/packages/apple) (StoreKit 2) and [openiap-google](https://github.com/hyodotdev/openiap/tree/main/packages/google) (Play Billing 8.x)
- **Verification profiles** — Standardized receipt validation and purchase verification patterns

Other libraries built on OpenIAP: [react-native-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/react-native-iap) · [flutter_inapp_purchase](https://github.com/hyodotdev/openiap/tree/main/libraries/flutter_inapp_purchase) · [kmp-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap) · [godot-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/godot-iap)

**[Learn more about the OpenIAP standard →](https://openiap.dev/docs/foundation/about)**

## Community

Have a question or need help? Ask in [expo-iap Q&A Discussions](https://github.com/hyodotdev/openiap/discussions/categories/expo-iap).

For bug reports, please [open an issue](https://github.com/hyodotdev/openiap/issues).

## Our Sponsors

💼 **[View Our Sponsors](https://openiap.dev/sponsors)**

### <p style="color: rgb(255, 182, 193);">Angel</p>

<a href="https://meta.com">
    <div style="display: inline-flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.75rem 1rem; border-radius: 12px; background: rgba(212, 165, 116, 0.12);">
      <img alt="Meta" src="https://openiap.dev/meta.svg" style="width: 120px;" />
      <span style="font-size: 0.85rem; font-weight: 600; color: rgb(107, 78, 61); text-align: center; width: 100%;">Meta</span>
    </div>
</a>

## Past Supporters

<div style="display: flex; align-items:center; gap: 10px;">
  <a href="https://namiml.com" style="opacity: 50%">
    <img src="https://openiap.dev/sponsors/nami.webp" alt="Nami ML" width="140"/>
  </a>
  <a href="https://www.courier.com/?utm_source=react-native-iap&utm_campaign=osssponsors" style="opacity: 50%;">
    <img width="80" alt="courier_dot_com" src="https://openiap.dev/sponsors/courier.webp" />
  </a>
</div>
