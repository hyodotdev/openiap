# godot-iap

<div align="center">
  <img src="https://github.com/user-attachments/assets/cc7f363a-43a9-470c-bde7-2f63985a9f46"" width="200" alt="godot-iap logo" />

[![CI](https://img.shields.io/github/actions/workflow/status/hyodotdev/openiap/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/hyodotdev/openiap/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/hyodotdev/openiap?style=flat-square)](https://github.com/hyodotdev/openiap/releases)
[![Godot 4.3+](https://img.shields.io/badge/Godot-4.3+-blue?style=flat-square&logo=godot-engine)](https://godotengine.org)
[![OpenIAP](https://img.shields.io/badge/OpenIAP-Compliant-green?style=flat-square)](https://openiap.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

A comprehensive in-app purchase plugin for Godot 4.x that conforms to the <a href="https://openiap.dev">Open IAP specification</a>

<a href="https://openiap.dev"><img src="https://github.com/hyodotdev/openiap/blob/main/logo.png?raw=true" alt="Open IAP" height="40" /></a>

</div>

## About

This is an In-App Purchase plugin for Godot Engine, built following the [OpenIAP specification](https://openiap.dev). This project has been inspired by [expo-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap), [flutter_inapp_purchase](https://github.com/hyodotdev/openiap/tree/main/libraries/flutter_inapp_purchase), [kmp-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap), and [react-native-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/react-native-iap).

We are trying to share the same experience of in-app purchase in Godot Engine as in other cross-platform frameworks. Native code is powered by [openiap-apple](https://github.com/hyodotdev/openiap/tree/main/packages/apple) and [openiap-google](https://github.com/hyodotdev/openiap/tree/main/packages/google) modules.

We will keep working on it as time goes by just like we did in other IAP libraries.

## Documentation

Visit the [documentation site](https://hyochan.github.io/godot-iap) for [installation guides](https://hyochan.github.io/godot-iap/getting-started/installation), [API reference](https://hyochan.github.io/godot-iap/api), and [examples](https://hyochan.github.io/godot-iap/examples/purchase-flow).

## Installation

1. Download `godot-iap-{version}.zip` from [GitHub Releases](https://github.com/hyodotdev/openiap/releases)
2. Extract and copy `addons/godot-iap/` to your project's `addons/` folder
3. Enable the plugin in **Project → Project Settings → Plugins**

See the [Installation Guide](https://hyochan.github.io/godot-iap/getting-started/installation) for more details.

## Using with AI Assistants

godot-iap provides AI-friendly documentation for Cursor, GitHub Copilot, Claude, and ChatGPT.

**[AI Assistants Guide](https://hyochan.github.io/godot-iap/guides/ai-assistants)**

Quick links:
- [llms.txt](https://hyochan.github.io/godot-iap/llms.txt) - Quick reference
- [llms-full.txt](https://hyochan.github.io/godot-iap/llms-full.txt) - Full API reference

## Quick Start

See the [Quick Start Guide](https://hyochan.github.io/godot-iap/#quick-start) for complete code examples and setup instructions.

## Powered by OpenIAP

<a href="https://openiap.dev"><img src="https://github.com/hyodotdev/openiap/blob/main/logo.png" alt="OpenIAP" height="50" /></a>

godot-iap conforms to the **[OpenIAP specification](https://openiap.dev)** — an open, vendor-neutral interoperability standard for in-app purchases. OpenIAP provides:

- **Shared specification** — Common types, error codes, and purchase flows across all platforms
- **Generated type-safe bindings** — Swift, Kotlin, Dart, and GDScript from a single GraphQL schema
- **Platform implementations** — [openiap-apple](https://github.com/hyodotdev/openiap/tree/main/packages/apple) (StoreKit 2) and [openiap-google](https://github.com/hyodotdev/openiap/tree/main/packages/google) (Play Billing 8.x)
- **Verification profiles** — Standardized receipt validation and purchase verification patterns

Other libraries built on OpenIAP: [react-native-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/react-native-iap) · [expo-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap) · [flutter_inapp_purchase](https://github.com/hyodotdev/openiap/tree/main/libraries/flutter_inapp_purchase) · [kmp-iap](https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap)

**[Learn more about the OpenIAP standard →](https://openiap.dev/docs/foundation/about)**

## License

MIT License - see [LICENSE](LICENSE) file for details.
