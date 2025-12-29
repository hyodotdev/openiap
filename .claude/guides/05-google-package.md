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

## Horizon No-Op Functions

Google Play-specific features are **no-ops** on Horizon. These functions:

- Log a warning with `Log.w()` (visible in Logcat at app level)
- Return safe default values instead of throwing exceptions

| Function | Behavior on Horizon |
|----------|---------------------|
| `setUserChoiceBillingListener` | No-op, logs warning |
| `setDeveloperProvidedBillingListener` | No-op, logs warning |
| `addUserChoiceBillingListener` | No-op, logs warning |
| `removeUserChoiceBillingListener` | No-op, logs warning |
| `addDeveloperProvidedBillingListener` | No-op, logs warning |
| `removeDeveloperProvidedBillingListener` | No-op, logs warning |
| `isBillingProgramAvailable` | Returns `isAvailable: false` |
| `createBillingProgramReportingDetails` | Returns empty token |
| `launchExternalLink` | Returns `false` |

### Guidelines for No-Op Implementations

When implementing no-ops for unsupported features:

1. **Use `Log.w()`** (not `OpenIapLog.d()`) so warnings appear in application logs
2. **Never throw exceptions** - return safe defaults instead
3. **Include "(no-op)" suffix** in log message for clarity
4. **Format**: `Log.w(TAG, "functionName is not supported on Meta Horizon (no-op)")`

```kotlin
// Correct - visible in Logcat
override fun someUnsupportedFunction() {
    Log.w(TAG, "someUnsupportedFunction is not supported on Meta Horizon (no-op)")
}

// Wrong - only visible when OpenIapLog is enabled
override fun someUnsupportedFunction() {
    OpenIapLog.d("someUnsupportedFunction is a no-op", TAG)
}
```

## Deployment

Via GitHub Actions "Google Release" workflow → Maven Central
