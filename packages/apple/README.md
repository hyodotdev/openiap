# OpenIAP Apple

<div align="center">
  <img src="./logo.webp" alt="OpenIAP Apple Logo" width="120" height="120">

  <p><strong>Swift implementation of the <a href="https://openiap.dev">OpenIAP</a> specification for iOS, macOS, tvOS, and watchOS.</strong></p>
</div>

<br />

<div align="center">
  <a href="https://github.com/hyodotdev/openiap/tree/main/packages/apple">
    <img src="https://img.shields.io/github/v/tag/hyodotdev/openiap?filter=[0-9]*&label=Swift%20Package&logo=swift&color=orange" alt="Swift Package" />
  </a>
  <a href="https://cocoapods.org/pods/openiap">
    <img src="https://img.shields.io/cocoapods/v/openiap?color=E35A5F&label=CocoaPods&logo=cocoapods" alt="CocoaPods" />
  </a>
  <a href="https://github.com/hyodotdev/openiap/actions/workflows/ci.yml">
    <img src="https://github.com/hyodotdev/openiap/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
</div>

## Documentation

Visit [**openiap.dev**](https://openiap.dev) for complete documentation, API reference, guides, and examples.

## Features

- StoreKit 2 support (iOS 15+)
- Cross-platform (iOS, macOS, tvOS, watchOS)
- Thread-safe with MainActor isolation
- Automatic transaction verification
- Event-driven purchase observation

## Requirements

| Platform | Minimum Version |
| -------- | --------------- |
| iOS      | 15.0+           |
| macOS    | 14.0+           |
| tvOS     | 15.0+           |
| watchOS  | 8.0+            |
| Swift    | 5.9+            |

## Installation

### Swift Package Manager

Add to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/hyodotdev/openiap.git", from: "$version")
]
```

### CocoaPods

Add to your `Podfile`:

```ruby
pod 'openiap', '~> $version'
```

> Check [`openiap-versions.json`](../../openiap-versions.json) for the current version.

## Quick Start

```swift
import OpenIAP

let module = OpenIapModule.shared

// Initialize connection
_ = try await module.initConnection()

// Fetch products
let products = try await module.fetchProducts(
    ProductRequest(skus: ["premium", "coins"], type: .all)
)

// End connection when done
_ = try await module.endConnection()
```

For detailed usage, see the [documentation](https://openiap.dev).

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Support

- [Documentation](https://openiap.dev)
- [GitHub Issues](https://github.com/hyodotdev/openiap/issues)
- [Discussions](https://github.com/hyodotdev/openiap/discussions)
