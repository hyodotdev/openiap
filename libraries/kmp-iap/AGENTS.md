# KMP IAP Agent Guidelines

This document outlines the coding conventions and guidelines for the kmp-iap project. Contributors and users can reference this for maintaining consistency.

## Naming Conventions

### Acronym Usage

1. **IAP (In-App Purchase)**:
   - When final suffix: Use `IAP` (e.g., `KmpIAP`)
   - When followed by other words: Use `Iap` (e.g., `kmpIapInstance`, `IapManager`)

2. **ID (Identifier)**:
   - Always use `Id` instead of `ID` (e.g., `productId`, `transactionId`, `orderId`)
   - This applies to all platforms for consistency
   - Examples: `productId`, `transactionId`, `orderIdAndroid`, `originalTransactionIdIOS`

3. **Platform-specific**:
   - iOS: Use `IOS` as a suffix (e.g., `PurchaseIOS`, `ProductIOS`, `TransactionStateIOS`)
   - Android: Use `Android` as a suffix (e.g., `PurchaseAndroid`, `SubscriptionOfferAndroid`, `AndroidPurchaseState`)
   - **Important**: The platform identifier should always be a suffix, not a prefix
     - ✅ Correct: `TransactionStateIOS`, `DiscountPaymentModeIOS`
     - ❌ Incorrect: `IosTransactionState`, `IosDiscountPaymentMode`

4. **Field names with platform suffix**:
   - When the platform acronym appears at the end of a field name, use uppercase
   - Examples: `quantityIOS`, `appBundleIdIOS`, `environmentIOS`

### Examples

```kotlin
// Class and enum names
class KmpIAP()                    // ✅ Correct - IAP is final
class PurchaseIOS                 // ✅ Correct - iOS platform specific
enum class ProductTypeIOS         // ✅ Correct - Platform suffix
enum class PaymentModeIOS         // ✅ Correct - Platform suffix

// Variable and field names
val kmpIAP = KmpIAP()             // ✅ Correct - Constructor pattern
val kmpIapInstance: KmpIAP        // ✅ Correct - Global instance variable (not a separate class)
val quantityIOS: Int              // ✅ Correct - Field with iOS suffix
val environmentIOS: String        // ✅ Correct - Field with iOS suffix
```

## Generated Types

- `library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap/Types.kt` is generated from `specs/client`; never edit it manually.
- In this monorepo, run `cd specs/client && bun run generate` from the repository root so the manifest-backed sync updates every SDK together.
- In a standalone KMP checkout, `./scripts/generate-types.sh` validates and atomically installs the platform-ready KMP target from the raw `openiap-client-protocol-${clientProtocol}` tag pinned by `openiap-versions.json`. Do not use that download path for unshipped monorepo schema work.

## API Design Patterns

### Instance Creation

The library supports two patterns for maximum flexibility:

1. **Global Instance** (for convenience)

   ```kotlin
   import io.github.hyochan.kmpiap.kmpIapInstance

   kmpIapInstance.initConnection()
   ```

2. **Constructor Pattern** (for testing and DI)

   ```kotlin
   import io.github.hyochan.kmpiap.KmpIAP

   val kmpIAP = KmpIAP()
   kmpIAP.initConnection()
   ```

## Code Style Guidelines

### General Principles

- Follow [Kotlin Coding Conventions](https://kotlinlang.org/docs/coding-conventions.html)
- Use instance-based patterns over static/singleton patterns in examples
- Provide clear comments for receipt validation and server-side processing

### Purchase Flow Pattern

`createPurchaseFlow` (a port of `specs/client/src/purchase-flow.ts`) confirms
each delivery with the app's backend, finishes it once access is settled, and
recovers unfinished purchases. Apps do not hand-build that pipeline; the
example app uses one flow for the whole app.

```kotlin
val flow = kmpIapInstance.createPurchaseFlow(
    scope = appScope, // outlives the screens
    confirmWithBackend = { purchase, isConsumable -> backend.confirm(purchase) },
    isConsumable = { it in consumableIds },
)
flow.outcomes.collect { show(describePurchaseFlowStatus(it.status)) }
```

`library/src/androidUnitTest/resources/purchase-flow.vectors.json` is a synced
copy of the spec's shared cases; `PurchaseFlowVectorsTest` must pass every one.

## Build & Testing

### Compose Multiplatform Compatibility

- Kotlin `2.4.20` is the compiler line for SwiftPM import, Gradle `9.3.0`, and AGP
  `8.13.2`; keep the library and example version catalogs aligned.
- Keep `android.experimental.lint.version=9.4.1` in both Gradle roots so Lint
  can read Kotlin 2.4 metadata while AGP remains on 8.13.2.
- Keep the R8 `9.1.56` overrides in both settings files while AGP remains on
  8.13.2; Kotlin 2.4 metadata requires that R8 version or newer.
- Keep Compose Multiplatform at `1.10.3` while the library and example support
  `iosX64`. Compose `1.11.x` does not resolve the required iOS x64 variants.
- Before raising this cap, run the partially-resolved-dependencies checker plus
  all Android store examples and the iOS arm64, simulator arm64, and x64 builds.
- Do not remove a supported target solely to make a dependency upgrade pass.

### Commands

```bash
# Build library
./gradlew :library:build

# Run tests
./gradlew :library:test

# Verify iOS source, Xcode integration, and Maven consumption without CocoaPods
bash scripts/verify-swiftpm-build.sh

# Check code quality (if configured)
./gradlew :library:detekt

# Run example app - Android
./gradlew :example:composeApp:assembleDebug

# Run example app - iOS (requires Mac)
cd example/iosApp
xed .
```

### Pre-Commit Checklist

1. Run build to ensure compilation succeeds
2. Run tests to verify functionality
3. Run code quality checks
4. Only commit if all checks pass

## API Guidelines

### Method Naming

- Use `request` prefix for event-dependent functions (e.g., `requestPurchase`, `requestSubscription`)
- Follow OpenIAP terminology: <https://openiap.dev/docs/apis#terminology>
- Avoid generic prefixes like `get`, `find`

### OpenIAP Specification

All implementations must follow the OpenIAP specification:

- **APIs**: <https://openiap.dev/docs/apis>
- **Types**: <https://openiap.dev/docs/types>
- **Events**: <https://openiap.dev/docs/events>
- **Errors**: <https://openiap.dev/docs/errors>

#### Feature Development Process

For new feature proposals:

1. Before implementing, discuss at: <https://github.com/hyodotdev/openiap/discussions>
2. Get community feedback and consensus
3. Ensure alignment with OpenIAP standards
4. Implement following the agreed specification

## Contributing

1. Follow the naming conventions and guidelines above
2. Run all tests before committing
3. Update documentation for API changes
4. Comment complex logic, especially platform-specific code
