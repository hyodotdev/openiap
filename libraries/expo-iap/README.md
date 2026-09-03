# Expo IAP

<div align="center">
  <img src="https://openiap.dev/frameworks/expo.svg" alt="Expo IAP Logo" width="150" />
  
  [![Version](http://img.shields.io/npm/v/expo-iap.svg?style=flat-square)](https://npmjs.org/package/expo-iap) [![Download](http://img.shields.io/npm/dm/expo-iap.svg?style=flat-square)](https://npmjs.org/package/expo-iap) [![OpenIAP](https://img.shields.io/badge/OpenIAP-Compliant-green?style=flat-square)](https://openiap.dev) [![CI](https://github.com/hyodotdev/openiap/actions/workflows/ci-expo-iap.yml/badge.svg?branch=main)](https://github.com/hyodotdev/openiap/actions/workflows/ci-expo-iap.yml?query=branch%3Amain) [![codecov](https://codecov.io/gh/hyodotdev/openiap/branch/main/graph/badge.svg?component=expo-iap)](https://app.codecov.io/gh/hyodotdev/openiap/tree/main/libraries/expo-iap) [![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fhyochan%2Fexpo-iap.svg?type=shield&issueType=license)](https://app.fossa.com/projects/git%2Bgithub.com%2Fhyochan%2Fexpo-iap?ref=badge_shield&issueType=license)
  
Expo IAP is a powerful in-app purchase solution for Expo and React Native applications that conforms to the OpenIAP specification. It provides a unified API for handling in-app purchases across iOS and Android platforms with comprehensive error handling and modern TypeScript support.

If you're shipping an app with expo-iap, we’d love to hear about it—please share your product and feedback in [expo-iap Q&A Discussions](https://github.com/hyodotdev/openiap/discussions/categories/expo-iap). Community stories help us keep improving the ecosystem.

<a href="https://openiap.dev"><img src="https://raw.githubusercontent.com/hyodotdev/openiap/main/logo.webp" alt="OpenIAP" height="40" /></a>

</div>

## 📚 Documentation

**[📖 Visit our comprehensive documentation site →](https://openiap.dev/docs/setup/expo)**

## Using with AI Assistants

expo-iap provides AI-friendly documentation for Cursor, GitHub Copilot, Claude, and ChatGPT.

**[📖 AI Assistants Guide →](https://openiap.dev/docs/guides/ai-assistants)**

Quick links:

- [llms.txt](https://openiap.dev/llms.txt) - Quick reference
- [llms-full.txt](https://openiap.dev/llms-full.txt) - Full API reference
- [Onside Integration](https://openiap.dev/docs/setup/store/onside) - Using Onside marketplace payments on iOS

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

<a href="https://openiap.dev"><img src="https://raw.githubusercontent.com/hyodotdev/openiap/main/logo.webp" alt="OpenIAP" height="50" /></a>

Expo IAP conforms to the **[OpenIAP specification](https://openiap.dev)** — an open, vendor-neutral interoperability standard for in-app purchases. OpenIAP provides:

- **Shared specification** — Common types, error codes, and purchase flows across all platforms
- **Generated type-safe bindings** — Swift, Kotlin, Dart, and GDScript from a single GraphQL schema
- **Platform implementations** — [openiap-apple](https://github.com/hyodotdev/openiap/tree/main/packages/apple) (StoreKit 2) and [openiap-google](https://github.com/hyodotdev/openiap/tree/main/packages/google) (Play Billing 9.1.0)
- **Verification profiles** — Standardized receipt validation and purchase verification patterns

Other libraries built on OpenIAP: [react-native-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/react-native-iap) · [flutter_inapp_purchase](https://github.com/hyodotdev/openiap/tree/main/libraries/flutter_inapp_purchase) · [kmp-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap) · [godot-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/godot-iap)

**[Learn more about the OpenIAP standard →](https://openiap.dev/docs/foundation/about)**

## Community

Have a question or need help? Ask in [expo-iap Q&A Discussions](https://github.com/hyodotdev/openiap/discussions/categories/expo-iap).

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
