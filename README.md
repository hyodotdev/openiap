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

## Packages

This monorepo contains all OpenIAP packages:

- **[docs](packages/docs)** - Documentation site at [openiap.dev](https://openiap.dev)
- **[gql](packages/gql)** - GraphQL schema and type generation [![GQL Release](https://img.shields.io/github/v/tag/hyodotdev/openiap?filter=gql-*&label=version&logo=graphql&color=purple)](https://github.com/hyodotdev/openiap/releases?q=gql&expanded=true)
- **[google](packages/google)** - Android library [![Maven Central (Play)](https://img.shields.io/maven-central/v/io.github.hyochan.openiap/openiap-google?label=Play%20Store)](https://central.sonatype.com/artifact/io.github.hyochan.openiap/openiap-google) [![Maven Central (Horizon)](https://img.shields.io/maven-central/v/io.github.hyochan.openiap/openiap-google-horizon?label=Meta%20Horizon)](https://central.sonatype.com/artifact/io.github.hyochan.openiap/openiap-google-horizon) [![CI](https://github.com/hyodotdev/openiap/actions/workflows/ci.yml/badge.svg)](https://github.com/hyodotdev/openiap/actions/workflows/ci.yml)
- **[apple](packages/apple)** - iOS/macOS library [![Swift Package](https://img.shields.io/github/v/tag/hyodotdev/openiap?filter=1.*&label=version&logo=swift&color=orange)](https://github.com/hyodotdev/openiap/releases?q=Apple&expanded=true) [![CocoaPods](https://img.shields.io/cocoapods/v/openiap?color=E35A5F&logo=cocoapods)](https://cocoapods.org/pods/openiap) [![CI](https://github.com/hyodotdev/openiap/actions/workflows/ci.yml/badge.svg)](https://github.com/hyodotdev/openiap/actions/workflows/ci.yml)

## Libraries

Framework SDK implementations built on top of OpenIAP. These libraries are managed in this monorepo — see [discussion #86](https://github.com/hyodotdev/openiap/discussions/86) for the rationale and migration context.

| Library | Platform | Package | Downloads |
|---------|----------|---------|-----------|
| [expo-iap](libraries/expo-iap) | Expo | [![npm](https://img.shields.io/npm/v/expo-iap?logo=npm&color=CB3837)](https://www.npmjs.com/package/expo-iap) | [![npm downloads](https://img.shields.io/npm/dm/expo-iap?label=npm&color=CB3837)](https://www.npmjs.com/package/expo-iap) |
| [react-native-iap](libraries/react-native-iap) | React Native | [![npm](https://img.shields.io/npm/v/react-native-iap?logo=npm&color=CB3837)](https://www.npmjs.com/package/react-native-iap) | [![npm downloads](https://img.shields.io/npm/dm/react-native-iap?label=npm&color=CB3837)](https://www.npmjs.com/package/react-native-iap) |
| [flutter_inapp_purchase](libraries/flutter_inapp_purchase) | Flutter | [![pub.dev](https://img.shields.io/pub/v/flutter_inapp_purchase?logo=dart&color=0175C2)](https://pub.dev/packages/flutter_inapp_purchase) | [![pub.dev likes](https://img.shields.io/pub/likes/flutter_inapp_purchase?label=likes&color=0175C2)](https://pub.dev/packages/flutter_inapp_purchase) |
| [kmp-iap](libraries/kmp-iap) | Kotlin Multiplatform | [![Maven Central](https://img.shields.io/maven-central/v/io.github.hyochan/kmp-iap?logo=kotlin&color=7F52FF)](https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap) | — |
| [godot-iap](libraries/godot-iap) | Godot 4.x | [![Godot Asset Library](https://img.shields.io/badge/asset_library-godot--iap-478CBF?logo=godotengine)](https://godotengine.org/asset-library/asset/4627) | — |

## Documentation

Visit [openiap.dev](https://openiap.dev) for complete documentation and API reference.

## Community

Have a question or need help? Ask in the relevant [GitHub Discussions](https://github.com/hyodotdev/openiap/discussions) category:

| Library | Discussion |
|---------|------------|
| openiap-apple | [Q&A](https://github.com/hyodotdev/openiap/discussions/categories/openiap-apple) |
| openiap-google | [Q&A](https://github.com/hyodotdev/openiap/discussions/categories/openiap-google) |
| expo-iap | [Q&A](https://github.com/hyodotdev/openiap/discussions/categories/expo-iap) |
| react-native-iap | [Q&A](https://github.com/hyodotdev/openiap/discussions/categories/react-native-iap) |
| flutter_inapp_purchase | [Q&A](https://github.com/hyodotdev/openiap/discussions/categories/flutter_inapp_purchase) |
| kmp-iap | [Q&A](https://github.com/hyodotdev/openiap/discussions/categories/kmp-iap) |
| godot-iap | [Q&A](https://github.com/hyodotdev/openiap/discussions/categories/godot-iap) |

For bug reports, please [open an issue](https://github.com/hyodotdev/openiap/issues).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, workflows, and contribution guidelines.

## Sponsors

<p align="center">
  <a href="https://meta.com">
    <img src="packages/docs/public/meta.svg" alt="Meta" height="140">
  </a>
</p>

Thank you to our sponsors for supporting the OpenIAP initiative. [Become a sponsor](https://openiap.dev/sponsors)
