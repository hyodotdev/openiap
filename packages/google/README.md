# OpenIAP Android

<div align="center">
  <img src="./logo.webp" alt="OpenIAP Google Logo" width="120" height="120">

  <p><strong>Android implementation of the <a href="https://www.openiap.dev/">OpenIAP</a> specification using Google Play Billing.</strong></p>
</div>

<br />

[![Maven Central](https://img.shields.io/maven-central/v/io.github.hyochan.openiap/openiap-google)](https://central.sonatype.com/artifact/io.github.hyochan.openiap/openiap-google)
[![API](https://img.shields.io/badge/API-21%2B-brightgreen.svg?style=flat)](https://android-arsenal.com/api?level=21)
[![Google Release](https://github.com/hyodotdev/openiap/actions/workflows/release-google.yml/badge.svg)](https://github.com/hyodotdev/openiap/actions/workflows/release-google.yml)
[![CI](https://github.com/hyodotdev/openiap/actions/workflows/ci.yml/badge.svg)](https://github.com/hyodotdev/openiap/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Modern Android Kotlin library for in-app purchases using Google Play Billing Library v8.

## Documentation

Visit [**openiap.dev**](https://openiap.dev) for complete documentation, API reference, guides, and examples.

## Features

- Google Play Billing v8
- Kotlin Coroutines
- Type-safe API with sealed classes
- Real-time purchase events
- Thread-safe operations
- Comprehensive error handling

## Requirements

- **Minimum SDK**: 21 (Android 5.0)
- **Compile SDK**: 34+
- **Google Play Billing**: v8.0.0
- **Kotlin**: 1.9.20+

## Installation

Add to your module's `build.gradle.kts`:

```kotlin
dependencies {
    implementation("io.github.hyochan.openiap:openiap-google:$version")
}
```

> Check [`openiap-versions.json`](../../openiap-versions.json) for the current version.

## Quick Start

```kotlin
import dev.hyo.openiap.store.OpenIapStore

class MainActivity : AppCompatActivity() {
    private lateinit var iapStore: OpenIapStore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        iapStore = OpenIapStore(this)

        lifecycleScope.launch {
            // Initialize connection
            iapStore.initConnection()

            // Fetch products
            val products = iapStore.fetchProducts(
                ProductRequest(skus = listOf("premium_upgrade"))
            )
        }
    }
}
```

For detailed usage, see the [documentation](https://openiap.dev).

## Sample App

Run the included sample app:

```bash
cd packages/google
./gradlew :Example:installDebug
```

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Support

- [Documentation](https://openiap.dev)
- [GitHub Issues](https://github.com/hyodotdev/openiap/issues)
- [Discussions](https://github.com/hyodotdev/openiap/discussions)
