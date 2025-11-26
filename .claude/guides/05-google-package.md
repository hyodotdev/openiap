# Google Package Guide

Location: `packages/google/`

## Overview

Android in-app purchase library supporting:

- Google Play Billing (play variant)
- Horizon Store (horizon variant)

## Directory Structure

```text
packages/google/
├── openiap/
│   └── src/
│       ├── main/java/dev/hyo/openiap/
│       │   ├── Types.kt           # AUTO-GENERATED - DO NOT EDIT
│       │   ├── OpenIapProtocol.kt # API interface
│       │   ├── OpenIapStore.kt    # Main store class
│       │   ├── listener/          # Event listeners
│       │   └── utils/             # Helper utilities
│       ├── play/java/dev/hyo/openiap/
│       │   └── OpenIapModule.kt   # Play Store implementation
│       └── horizon/java/dev/hyo/openiap/
│           └── OpenIapModule.kt   # Horizon implementation
├── Example/                       # Sample app
├── scripts/
│   └── generate-types.sh
└── openiap-versions.json
```

## Build Variants

| Variant   | Purpose            | Billing Library  |
| --------- | ------------------ | ---------------- |
| `play`    | Google Play Store  | Play Billing 8.x |
| `horizon` | Meta Horizon Store | Horizon SDK      |

## Type Generation

Types.kt is auto-generated. **Never edit directly!**

```bash
./scripts/generate-types.sh
```

## Building

```bash
# Compile library
./gradlew :openiap:compilePlayDebugKotlin
./gradlew :openiap:compileHorizonDebugKotlin

# Run tests
./gradlew :openiap:testPlayDebugUnitTest
./gradlew :openiap:testHorizonDebugUnitTest

# Build Example app
./gradlew :Example:assemblePlayDebug
```

## Naming Convention

Inside this Android-only package, **do not** add `Android` suffix:

```kotlin
// Correct
fun acknowledgePurchase()
fun consumePurchase()

// Wrong
fun acknowledgePurchaseAndroid()
```

## Deployment

Via GitHub Actions "Google Release" workflow → Maven Central
