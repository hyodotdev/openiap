# OpenIAP Architecture Principles

> **Priority: MANDATORY**
> Follow these architectural principles in all code.

## Monorepo Structure

```
openiap/
├── packages/
│   ├── docs/          # Documentation (React/Vite/Vercel)
│   ├── gql/           # GraphQL schema & type generation
│   ├── google/        # Android library (Kotlin)
│   └── apple/         # iOS/macOS library (Swift)
├── knowledge/         # Shared knowledge base (SSOT)
│   ├── internal/      # Project philosophy (HIGHEST PRIORITY)
│   ├── external/      # External API reference
│   └── _claude-context/  # Compiled context for Claude Code
├── scripts/
│   └── agent/         # RAG Agent scripts
└── .github/workflows/ # CI/CD workflows
```

## Package Responsibilities

### packages/gql

**Purpose:** Single source of truth for type definitions.

- Contains GraphQL schema defining all OpenIAP types
- Generates types for: TypeScript, Swift, Kotlin, Dart
- **RULE:** `Types.swift` / `Types.kt` are AUTO-GENERATED. Never edit directly.

```bash
# Regenerate all types
cd packages/gql && bun run generate
```

Generated files:
- TypeScript: `src/generated/types.ts`
- Swift: `dist/swift/Types.swift`
- Kotlin: `dist/kotlin/Types.kt`
- Dart: `dist/dart/types.dart`

### packages/apple

**Purpose:** iOS/macOS StoreKit 2 implementation.

Directory structure:
```
Sources/
├── Models/           # Official OpenIAP types (matches openiap.dev/docs/types)
│   ├── Product.swift
│   ├── Purchase.swift
│   ├── ActiveSubscription.swift
│   └── Types.swift   # AUTO-GENERATED - DO NOT EDIT
├── Helpers/          # Internal implementation (NOT public API)
│   ├── ProductManager.swift
│   └── IapStatus.swift
├── OpenIapModule.swift    # Core implementation
├── OpenIapStore.swift     # SwiftUI-friendly store
└── OpenIapProtocol.swift  # API interface definitions
```

### packages/google

**Purpose:** Android Google Play Billing implementation.

Directory structure:
```
openiap/src/main/
├── java/dev/hyo/openiap/
│   ├── OpenIapModule.kt
│   ├── Models.kt
│   └── utils/           # Internal helpers
└── Types.kt             # AUTO-GENERATED - DO NOT EDIT
```

### packages/docs

**Purpose:** Documentation site for openiap.dev.

- Built with React + Vite
- Deployed to Vercel
- Contains API reference and guides

## Dependency Flow

```
┌─────────────┐
│  packages/  │
│    gql      │ ──── Generates Types ────┐
└─────────────┘                          │
                                         ▼
                          ┌──────────────────────────┐
                          │                          │
                    ┌─────┴─────┐            ┌───────┴──────┐
                    │ packages/ │            │  packages/   │
                    │   apple   │            │    google    │
                    └───────────┘            └──────────────┘
```

## Module Pattern

### iOS Module (Swift)

```swift
// OpenIapModule.swift
public final class OpenIapModule: OpenIapProtocol {
    public static let shared = OpenIapModule()

    private init() {}

    // All public methods here
    public func fetchProducts(_ productIds: [String]) async throws -> [ProductIOS]
}
```

### Android Module (Kotlin)

```kotlin
// OpenIapModule.kt
class OpenIapModule private constructor(
    private val context: Context
) {
    companion object {
        @Volatile
        private var instance: OpenIapModule? = null

        fun getInstance(context: Context): OpenIapModule {
            return instance ?: synchronized(this) {
                instance ?: OpenIapModule(context).also { instance = it }
            }
        }
    }
}
```

## Error Handling Pattern

### Swift

```swift
public enum OpenIapError: Error {
    case notInitialized
    case productNotFound(String)
    case purchaseFailed(String)
    case verificationFailed
}

// Usage
public func fetchProducts(_ ids: [String]) async throws -> [ProductIOS] {
    guard isInitialized else {
        throw OpenIapError.notInitialized
    }
    // ...
}
```

### Kotlin

```kotlin
sealed class OpenIapError : Exception() {
    object NotInitialized : OpenIapError()
    data class ProductNotFound(val productId: String) : OpenIapError()
    data class PurchaseFailed(val message: String) : OpenIapError()
}
```

## Async Pattern

### Swift (async/await)

```swift
// CORRECT - Use async/await
public func fetchProducts(_ ids: [String]) async throws -> [ProductIOS]

// INCORRECT - Don't use completion handlers
public func fetchProducts(_ ids: [String], completion: @escaping (Result<[ProductIOS], Error>) -> Void)
```

### Kotlin (Coroutines)

```kotlin
// CORRECT - Use suspend functions
suspend fun fetchProducts(productIds: List<String>): List<ProductAndroid>

// INCORRECT - Don't use callbacks
fun fetchProducts(productIds: List<String>, callback: (List<ProductAndroid>) -> Unit)
```

## GraphQL Promise/Future Convention

**CRITICAL**: All async/Promise-returning operations in the GraphQL schema MUST include `# Future` comment above the field definition.

The `# Future` comment tells the type generator to wrap the return type appropriately:
- TypeScript: `Promise<T>`
- Swift: `async`
- Kotlin: `suspend`

```graphql
"""
Check if a billing program is available for the current user
Returns availability result with isAvailable flag
"""
# Future
isBillingProgramAvailableAndroid(program: BillingProgramAndroid!): BillingProgramAvailabilityResultAndroid!
```

**Rule**: If the operation makes network calls, accesses native APIs, or returns data asynchronously, it MUST have `# Future` comment.
