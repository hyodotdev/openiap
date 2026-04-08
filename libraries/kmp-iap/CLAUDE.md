# CLAUDE.md - Project Conventions and Guidelines

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

   - iOS: Use `IOS` as a suffix (e.g., `PurchaseIOS`, `SubscriptionOfferIOS`, `TransactionStateIOS`)
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

```kotlin
// 1. Listen for purchase updates
kmpIapInstance.purchaseUpdatedListener.collect { purchase ->
    // 2. Validate receipt with your backend
    val isValid = validateReceiptOnServer(purchase)

    if (isValid) {
        // 3. Grant entitlement
        grantEntitlement(purchase.productId)

        // 4. Finish transaction
        kmpIapInstance.finishTransaction(
            purchase = purchase,
            isConsumable = true // Set based on product type
        )
    }
}
```

## Build & Testing

### Commands

```bash
# Build library
./gradlew :library:build

# Run tests
./gradlew :library:test

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
- Follow OpenIAP terminology: <https://www.openiap.dev/docs/apis#terminology>
- Avoid generic prefixes like `get`, `find`

### OpenIAP Specification

All implementations must follow the OpenIAP specification:

- **APIs**: <https://www.openiap.dev/docs/apis>
- **Types**: <https://www.openiap.dev/docs/types>
- **Events**: <https://www.openiap.dev/docs/events>
- **Errors**: <https://www.openiap.dev/docs/errors>

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
