# Coding Conventions for kmp-iap

## Naming Conventions

### IAP Suffix Rule
When "IAP" (In-App Purchase) appears in names, it should follow these rules:
- **As suffix**: Use all caps - `KmpIAP`, `SomeClassIAP`
- **As prefix or middle**: Use Pascal case - `IapPlatform`, `IapHelper`, `IapEventManager`
- **NOT**: `IapPlatform` (incorrect), should be `IapPlatform`

### Examples
✅ Correct:
- `KmpIAP` - IAP as suffix
- `IapPlatform` - IAP as prefix  
- `IapHelper` - IAP as prefix
- `IapEventManager` - IAP as prefix

❌ Incorrect:
- `IapPlatform` - Should be `IapPlatform`
- `KmpIap` - Should be `KmpIAP`

## API Design Patterns

### Singleton Pattern
The main API uses a singleton pattern for simplicity:
```kotlin
// Good - Singleton pattern
KmpIAP.initConnection()
KmpIAP.fetchProducts(...)

// Avoid - Instance creation
val iapHelper = UseIap(scope, options)
```

### Event Listeners
Use Flow-based listeners with clear naming:
```kotlin
// Good - Clear listener naming
KmpIAP.purchaseUpdatedListener  // For successful purchases
KmpIAP.purchaseErrorListener    // For errors

// Avoid - Ambiguous naming
KmpIAP.purchaseFlow
KmpIAP.errorFlow
```

### Async Operations
Avoid arbitrary delays; use proper async/await patterns:
```kotlin
// Good - Proper async chaining
val connectionResult = KmpIAP.initConnection()
if (connectionResult) {
    val products = KmpIAP.fetchProducts(...)
}

// Avoid - Arbitrary delays
KmpIAP.initConnection()
delay(500)  // Don't do this
val products = KmpIAP.fetchProducts(...)
```

## Error Handling

### Error Code Naming
Error codes use snake_case with E_ prefix:
```kotlin
ErrorCode.E_USER_CANCELLED
ErrorCode.E_NETWORK_ERROR
ErrorCode.E_ITEM_UNAVAILABLE
```

### Error Messages
Provide clear, actionable error messages:
```kotlin
// Good
"Failed to connect to store. Please check your internet connection."

// Avoid
"Error occurred"
```

## Type Safety

### Request Objects
Use typed request objects instead of multiple parameters:
```kotlin
// Good
KmpIAP.fetchProducts(
    ProductRequest(
        skus = listOf("product_id"),
        type = ProductType.INAPP
    )
)

// Avoid
KmpIAP.fetchProducts(listOf("product_id"), "inapp")
```

### Platform-Specific Code
Use sealed classes or enums for platform checks:
```kotlin
when (getCurrentPlatform()) {
    IapPlatform.IOS -> { /* iOS specific */ }
    IapPlatform.ANDROID -> { /* Android specific */ }
}
```

## Documentation

### KDoc Comments
All public APIs should have KDoc comments:
```kotlin
/**
 * Initializes connection to the platform's billing service.
 * 
 * @return true if connection was successful, false otherwise
 * @throws PurchaseError if initialization fails
 */
suspend fun initConnection(): Boolean
```

### Code Examples
Include practical examples in documentation:
```kotlin
// Initialize connection
KmpIAP.initConnection()

// Load products
val products = KmpIAP.fetchProducts(
    ProductRequest(
        skus = listOf("product_id"),
        type = ProductType.INAPP
    )
)
```

## Testing

### Test Product IDs
Use meaningful test product IDs:
```kotlin
// Good - Clear naming
"dev.hyo.martie.10bulbs"
"dev.hyo.martie.premium_monthly"

// Avoid - Ambiguous names
"product1"
"test"
```

### Auto-Consume for Testing
Mark test-only code clearly:
```kotlin
// TEST ONLY: Auto-consume for testing
if (BuildConfig.DEBUG) {
    KmpIAP.finishTransaction(purchase, isConsumable = true)
}
```

## Project Structure

### Package Organization
```
io.github.hyochan.kmpiap/
├── types/          # Data classes and types
├── utils/          # Utility functions and error codes
├── android/        # Android-specific implementation
├── ios/            # iOS-specific implementation
└── common/         # Common interfaces and logic
```

### File Naming
- Use PascalCase for class files: `KmpIAP.kt`, `IapPlatform.kt`
- Use lowercase for utility files: `utils.kt`, `extensions.kt`

## Version Management

### Semantic Versioning
Follow semantic versioning (MAJOR.MINOR.PATCH):
- MAJOR: Breaking API changes
- MINOR: New features, backward compatible
- PATCH: Bug fixes, backward compatible

Example: `1.0.0-beta.3`