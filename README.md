# OpenIAP

<p align="center">
  <img src="packages/docs/public/logo.webp" alt="OpenIAP Logo" width="160" height="160">
</p>

<p align="center">
  <strong>The standardized protocol for implementing in-app purchases across all platforms</strong>
</p>

---

OpenIAP is a unified specification for in-app purchases across platforms, frameworks, and emerging technologies.

## Overview

The OpenIAP specification standardizes IAP implementations to reduce fragmentation and enable consistent behavior across all platforms. This is especially critical in the AI coding era where standardized APIs enable better code generation.

## Specifications

The contracts every package and library implements live under `specs/openiap/`. They are publishable, implementation-independent, and never deployed as services:

- **[client](specs/openiap/client)** - OpenIAP client API and multiplatform type generation, published as `@hyodotdev/openiap` [![Spec Release](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fhyodotdev%2Fopeniap%2Fmain%2Fopeniap-versions.json&query=%24.spec&label=version&logo=graphql&color=purple&prefix=v)](https://github.com/hyodotdev/openiap/blob/main/openiap-versions.json)
- **[Commerce Protocol](specs/openiap/commerce-protocol)** - Vendor-neutral server operations, events, bindings, and conformance, published as `openiap-commerce-protocol`

## Packages

This monorepo contains all OpenIAP packages:

- **[docs](packages/docs)** - Documentation site at [openiap.dev](https://openiap.dev)
- **[google](packages/google)** - Android library [![Maven Central (Play)](https://img.shields.io/maven-central/v/io.github.hyochan.openiap/openiap-google?label=Play%20Store)](https://central.sonatype.com/artifact/io.github.hyochan.openiap/openiap-google) [![Maven Central (Horizon)](https://img.shields.io/maven-central/v/io.github.hyochan.openiap/openiap-google-horizon?label=Meta%20Horizon)](https://central.sonatype.com/artifact/io.github.hyochan.openiap/openiap-google-horizon) [![CI](https://github.com/hyodotdev/openiap/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/hyodotdev/openiap/actions/workflows/ci.yml?query=branch%3Amain)
- **[apple](packages/apple)** - iOS/macOS library [![Swift Package](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fhyodotdev%2Fopeniap%2Fmain%2Fopeniap-versions.json&query=%24.apple&label=version&logo=swift&color=orange&prefix=v)](https://github.com/hyodotdev/openiap/releases?q=Apple&expanded=true) [![CocoaPods](https://img.shields.io/cocoapods/v/openiap?color=E35A5F&logo=cocoapods)](https://cocoapods.org/pods/openiap) [![CI](https://github.com/hyodotdev/openiap/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/hyodotdev/openiap/actions/workflows/ci.yml?query=branch%3Amain)
- **[kit](packages/kit)** - Open-source purchase validation and entitlement infrastructure for the OpenIAP ecosystem, with a hosted service and dashboard at [kit.openiap.dev](https://kit.openiap.dev). Free for every developer under hosted fair-use safeguards. [![Kit CI](https://github.com/hyodotdev/openiap/actions/workflows/deploy-kit.yml/badge.svg?branch=main)](https://github.com/hyodotdev/openiap/actions/workflows/deploy-kit.yml?query=branch%3Amain)
- **[mcp-server](packages/mcp-server)** - IAPKit MCP server, hosted at [kit.openiap.dev/mcp](https://kit.openiap.dev/mcp) for AI coding agents

## Libraries

Framework SDK implementations built on top of OpenIAP. These libraries are managed in this monorepo — see [discussion #86](https://github.com/hyodotdev/openiap/discussions/86) for the rationale and migration context.

| Library                                                    | Platform             | Package                                                                                                        | Downloads                                                    |
| ---------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [expo-iap](libraries/expo-iap)                             | Expo                 | [![expo stable][expo-stable-badge]][expo-npm]                                                                  | [![npm downloads][expo-downloads-badge]][expo-npm]           |
| [react-native-iap](libraries/react-native-iap)             | React Native         | [![rn stable][rn-stable-badge]][rn-npm]                                                                        | [![npm downloads][rn-downloads-badge]][rn-npm]               |
| [flutter_inapp_purchase](libraries/flutter_inapp_purchase) | Flutter              | [![flutter stable][flutter-stable-badge]][flutter-pub]                                                         | [![pub.dev downloads][flutter-downloads-badge]][flutter-pub] |
| [kmp-iap](libraries/kmp-iap)                               | Kotlin Multiplatform | [![kmp stable][kmp-stable-badge]][kmp-maven]                                                                   | —                                                            |
| [maui-iap](libraries/maui-iap)                             | .NET MAUI            | [![maui stable][maui-stable-badge]][maui-nuget]                                                                | [![NuGet downloads][maui-downloads-badge]][maui-nuget]       |
| [godot-iap](libraries/godot-iap)                           | Godot 4.x            | [![godot stable][godot-stable-badge]][godot-releases] [![Godot Asset Library][godot-asset-badge]][godot-asset] | —                                                            |

[expo-stable-badge]: https://img.shields.io/npm/v/expo-iap/latest?label=stable&logo=npm&color=CB3837
[expo-downloads-badge]: https://img.shields.io/npm/dm/expo-iap?label=npm&color=CB3837
[expo-npm]: https://www.npmjs.com/package/expo-iap
[rn-stable-badge]: https://img.shields.io/npm/v/react-native-iap/latest?label=stable&logo=npm&color=CB3837
[rn-downloads-badge]: https://img.shields.io/npm/dm/react-native-iap?label=npm&color=CB3837
[rn-npm]: https://www.npmjs.com/package/react-native-iap
[flutter-stable-badge]: https://img.shields.io/pub/v/flutter_inapp_purchase?label=stable&logo=dart&color=0175C2
[flutter-downloads-badge]: https://img.shields.io/pub/dm/flutter_inapp_purchase?label=downloads&logo=dart&color=0175C2
[flutter-pub]: https://pub.dev/packages/flutter_inapp_purchase
[kmp-stable-badge]: https://img.shields.io/badge/dynamic/xml?label=stable&query=/metadata/versioning/versions/version%5Bnot(contains(.,%22-%22))%5D%5Blast()%5D&url=https%3A%2F%2Frepo1.maven.org%2Fmaven2%2Fio%2Fgithub%2Fhyochan%2Fkmp-iap%2Fmaven-metadata.xml&prefix=v&logo=kotlin&color=7F52FF
[kmp-maven]: https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap
[maui-stable-badge]: https://img.shields.io/nuget/v/OpenIap.Maui?label=stable&logo=nuget&color=004880
[maui-downloads-badge]: https://img.shields.io/nuget/dt/OpenIap.Maui?label=downloads&logo=nuget&color=004880
[maui-nuget]: https://www.nuget.org/packages/OpenIap.Maui
[godot-stable-badge]: https://img.shields.io/github/v/release/hyodotdev/openiap?filter=godot-iap-*&display_name=tag&label=stable&logo=godot-engine&color=478CBF
[godot-releases]: https://github.com/hyodotdev/openiap/releases?q=godot-iap&expanded=true
[godot-asset-badge]: https://img.shields.io/badge/asset_library-godot--iap-478CBF?logo=godotengine
[godot-asset]: https://godotengine.org/asset-library/asset/4627

## Documentation

Visit [openiap.dev](https://openiap.dev) for complete documentation and API reference.

## Community

Have a question or need help? Ask in the relevant [GitHub Discussions](https://github.com/hyodotdev/openiap/discussions) category:

| Library                | Discussion                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| openiap-apple          | [Q&A](https://github.com/hyodotdev/openiap/discussions/categories/openiap-apple)          |
| openiap-google         | [Q&A](https://github.com/hyodotdev/openiap/discussions/categories/openiap-google)         |
| IAPKit                 | [Q&A](https://github.com/hyodotdev/openiap/discussions/categories/iapkit)                 |
| expo-iap               | [Q&A](https://github.com/hyodotdev/openiap/discussions/categories/expo-iap)               |
| react-native-iap       | [Q&A](https://github.com/hyodotdev/openiap/discussions/categories/react-native-iap)       |
| flutter_inapp_purchase | [Q&A](https://github.com/hyodotdev/openiap/discussions/categories/flutter_inapp_purchase) |
| kmp-iap                | [Q&A](https://github.com/hyodotdev/openiap/discussions/categories/kmp-iap)                |
| maui-iap               | [Q&A](https://github.com/hyodotdev/openiap/discussions/categories/maui-iap)               |
| godot-iap              | [Q&A](https://github.com/hyodotdev/openiap/discussions/categories/godot-iap)              |

For bug reports, please [open an issue](https://github.com/hyodotdev/openiap/issues).

<!-- sponsors:start -->
<!-- Generated by scripts/sync-sponsors.mjs from packages/docs/sponsor-registry.json. -->

## Sponsors

<p align="center">
  <a href="https://meta.com">
    <img src="packages/docs/public/meta.svg" alt="Meta" height="80" align="middle">
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://developer.amazon.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="packages/docs/public/sponsors/amazon-dark.webp">
      <img src="packages/docs/public/sponsors/amazon.webp" alt="Amazon Developer" height="44" align="middle">
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

## Contributing

<a href="https://github.com/hyodotdev/openiap/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=hyodotdev/openiap" alt="OpenIAP contributors" />
</a>

OpenIAP began with the original [react-native-iap](https://github.com/hyochan/react-native-iap) community and carries that work forward across the broader ecosystem:

<a href="https://github.com/hyochan/react-native-iap/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=hyochan/react-native-iap" alt="react-native-iap contributors" />
</a>

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, workflows, and contribution guidelines.
