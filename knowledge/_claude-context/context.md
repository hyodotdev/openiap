# OpenIAP Project Context

> **Auto-generated for Claude Code**
> Last updated: 2026-04-15T16:14:04.565Z
>
> Usage: `claude --context knowledge/_claude-context/context.md`

---

# 🚨 INTERNAL RULES (MANDATORY)

These rules define OpenIAP's development philosophy.
**You MUST follow these rules EXACTLY. No exceptions.**

---

<!-- Source: internal/01-naming-conventions.md -->

# OpenIAP Naming Conventions

> **Priority: MANDATORY**
> These rules MUST be followed without exception.

## Platform-Specific Function Naming

### iOS Functions (packages/apple)

All iOS-specific functions MUST end with `IOS` suffix:

```swift
// CORRECT
func clearTransactionIOS()
func getStorefrontIOS()
func syncIOS()
func presentCodeRedemptionSheetIOS()
func showManageSubscriptionsIOS()
func isEligibleForIntroOfferIOS()
func subscriptionStatusIOS()
func currentEntitlementIOS()
func latestTransactionIOS()
func beginRefundRequestIOS()
func getReceiptDataIOS()
func getAppTransactionIOS()
func getTransactionJwsIOS()
func getPendingTransactionsIOS()
func getPromotedProductIOS()
func requestPurchaseOnPromotedProductIOS()

// INCORRECT - Missing IOS suffix
func clearTransaction()
func presentCodeRedemptionSheet()
func sync()
```

### Android Functions (packages/google)

In the `packages/google` directory (Android-only package), **DO NOT** add `Android` suffix:

```kotlin
// CORRECT - No Android suffix in Android package
fun acknowledgePurchase()
fun consumePurchase()
fun getPackageName()
fun buildModule(context: Context)
fun isFeatureSupported(feature: FeatureType)

// INCORRECT - Unnecessary Android suffix
fun acknowledgePurchaseAndroid()
fun consumePurchaseAndroid()
fun buildModuleAndroid()
```

**Exception**: Only use `Android` suffix for types that are part of a cross-platform API (e.g., `ProductAndroid`, `PurchaseAndroid` that contrast with iOS types).

## Platform-Specific Field Naming (CRITICAL)

> **This is the most commonly violated rule. Pay extra attention.**

### GraphQL Input Types (API Fields)

Fields inside platform-specific input types do NOT need platform suffix (the type name already indicates the platform):

```graphql
# CORRECT - Fields inside AndroidProps don't need Android suffix
input RequestPurchaseAndroidProps {
  skus: [String!]!                      # Cross-platform, no suffix
  offerToken: String                    # No suffix - already in Android type
  isOfferPersonalized: Boolean          # No suffix - already in Android type
  obfuscatedAccountId: String           # No suffix - already in Android type
  obfuscatedProfileId: String           # No suffix - already in Android type
  developerBillingOption: DeveloperBillingOptionParamsAndroid  # Type has suffix (cross-platform type)
}

# INCORRECT - Redundant Android suffix inside Android-specific type
input RequestPurchaseAndroidProps {
  offerTokenAndroid: String           # ❌ Redundant - type already indicates Android
  isOfferPersonalizedAndroid: Boolean # ❌ Redundant - type already indicates Android
}
```

### Why This Matters

1. **Parent type context**: `RequestPurchaseAndroidProps` already indicates Android
2. **Cleaner API**: `google: { offerToken: "..." }` is cleaner than `google: { offerTokenAndroid: "..." }`
3. **Type names still use suffix**: Cross-platform types like `DeveloperBillingOptionParamsAndroid` keep the suffix

### Field Suffix Rules

| Field Location | Suffix Required? | Example |
|----------------|------------------|---------|
| Inside Android-only input type | NO | `offerToken` in `RequestPurchaseAndroidProps` |
| Inside iOS-only input type | NO | `appAccountToken` in `RequestPurchaseIOSProps` |
| Cross-platform type | YES for platform-specific | `nameAndroid` in `ProductAndroid` |
| Cross-platform type reference | YES | `developerBillingOption: DeveloperBillingOptionParamsAndroid` |
| Internal implementation | NO (not API) | `val offerToken` in Kotlin data class |

### Type vs Field Suffix

- **Type names**: Cross-platform types ALWAYS use platform suffix (`DeveloperBillingOptionParamsAndroid`)
- **Fields in platform-specific inputs**: NO suffix needed (parent type indicates platform)
- **Fields in cross-platform types**: Use suffix for platform-specific fields

```kotlin
// Cross-platform SDK usage
requestPurchase {
  google {
    skus = listOf("product_id")
    offerToken = "discount_offer_token"      // ✓ Clean - no redundant suffix
    isOfferPersonalized = false
  }
}
```

### Cross-Platform Functions

Functions available on BOTH platforms have **NO** platform suffix:

```typescript
// CORRECT - Cross-platform, no suffix
fetchProducts()
requestPurchase()
getAvailablePurchases()
finishTransaction()
verifyPurchase()
initConnection()
endConnection()
getActiveSubscriptions()
hasActiveSubscriptions()
deepLinkToSubscriptions()
getStorefront()
```

## Action Prefix Rules

| Prefix | When to Use | Examples |
|--------|-------------|----------|
| `get` | Synchronous data retrieval | `getStorefrontIOS`, `getPackageName` |
| `fetch` | Async data retrieval from server | `fetchProducts` |
| `request` | User-initiated async operations | `requestPurchase` |
| `clear` | Remove/reset data | `clearTransactionIOS`, `clearProductsIOS` |
| `is/has` | Boolean checks | `isEligibleForIntroOfferIOS`, `hasActiveSubscriptions` |
| `show/present` | Display UI | `showManageSubscriptionsIOS`, `presentCodeRedemptionSheetIOS` |
| `begin` | Start a multi-step process | `beginRefundRequestIOS` |
| `finish/end` | Complete a process | `finishTransaction`, `endConnection` |
| `init` | Initialize resources | `initConnection` |
| `verify` | Validate data | `verifyPurchase` |
| `acknowledge` | Confirm receipt (Android) | `acknowledgePurchase` |
| `consume` | Mark as consumed (Android) | `consumePurchase` |

## Swift Acronym Rules

- **Acronyms should be ALL CAPS only when they appear as a suffix**
- **When acronyms appear at the beginning or middle, use Pascal case**

```swift
// CORRECT
OpenIAP       // Package name: Open at beginning, IAP as suffix
IapManager    // IAP at beginning
IapPurchase   // IAP at beginning
ProductIAP    // IAP as suffix

// INCORRECT
OpenIap       // Should be OpenIAP - IAP is suffix
IAPManager    // Should be IapManager - IAP at beginning
```

## File Naming

### TypeScript/JavaScript
- Use `kebab-case` for file names: `purchase-validator.ts`
- Use `PascalCase` for class/type files: `PurchaseValidator.ts` (when single class)

### Swift
- Use `PascalCase`: `OpenIapModule.swift`, `ProductManager.swift`

### Kotlin
- Use `PascalCase`: `OpenIapModule.kt`, `BillingManager.kt`

## URL Anchors and Search IDs

### URL Anchors

Use kebab-case for all URL anchors:

```
Function: fetchProducts     -> Anchor: #fetch-products
Function: getAppTransactionIOS -> Anchor: #get-app-transaction-ios
```

### Search Modal IDs

Use kebab-case for search modal IDs:

```typescript
// CORRECT
{ id: 'request-products' }
{ id: 'fetch-products' }

// INCORRECT
{ id: 'requestproducts' }
{ id: 'fetchProducts' }
```

## Variable Naming

```typescript
// CORRECT - camelCase for variables
const productId: string;
const isSubscription: boolean;
const purchaseToken: string;

// INCORRECT
const product_id: string;     // No snake_case
const IsSubscription: boolean; // No PascalCase for variables
```

## Deprecated Functions

When renaming functions, document the migration path:

| Deprecated | Use Instead |
|------------|-------------|
| `buy-promoted-product-ios` | `requestPurchaseOnPromotedProductIOS` |
| `requestProducts` | `fetchProducts` |
| `get-storefront-ios` | `getStorefront` |
| `validateReceipt` | `verifyPurchase` |
| `validateReceiptIOS` | `verifyPurchase` |


---

<!-- Source: internal/02-architecture.md -->

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
├── libraries/         # Framework SDK implementations
│   ├── react-native-iap/  # React Native (npm, Yarn 3, Nitro Modules)
│   ├── expo-iap/          # Expo (npm, Bun, Expo Modules)
│   ├── flutter_inapp_purchase/  # Flutter (pub.dev, Dart)
│   ├── godot-iap/         # Godot 4.x (GitHub Release, GDScript)
│   └── kmp-iap/           # Kotlin Multiplatform (Maven Central)
├── knowledge/         # Shared knowledge base (SSOT)
│   ├── internal/      # Project philosophy (HIGHEST PRIORITY)
│   ├── external/      # External API reference
│   └── _claude-context/  # Compiled context for Claude Code
├── scripts/
│   └── agent/         # RAG Agent scripts
└── .github/workflows/ # CI/CD workflows
```

Libraries reference local `packages/apple` and `packages/google` source directly (not published CocoaPods/Maven artifacts), enabling immediate development without waiting for native releases.

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


---

<!-- Source: internal/03-coding-style.md -->

# OpenIAP Coding Style

> **Priority: MANDATORY**
> All code must follow these style guidelines.

## General Principles

### 1. Explicit Over Implicit

Always be explicit about types and intentions:

```typescript
// ✅ CORRECT - Explicit return type
function calculateTotal(items: CartItem[]): number {
    return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ INCORRECT - Implicit return type
function calculateTotal(items: CartItem[]) {
    return items.reduce((sum, item) => sum + item.price, 0);
}
```

### 2. Prefer Pure Functions

Functions should not have side effects when possible:

```typescript
// ✅ CORRECT - Pure function
function formatPrice(price: number, currency: string): string {
    return `${currency}${price.toFixed(2)}`;
}

// ❌ INCORRECT - Side effect (modifying external state)
let formattedPrice = '';
function formatPrice(price: number, currency: string): void {
    formattedPrice = `${currency}${price.toFixed(2)}`;
}
```

### 3. Single Responsibility

Each function/class should do ONE thing:

```typescript
// ✅ CORRECT - Single responsibility
async function fetchProduct(id: string): Promise<Product> { ... }
function validateProduct(product: Product): boolean { ... }
function formatProduct(product: Product): FormattedProduct { ... }

// ❌ INCORRECT - Multiple responsibilities
async function fetchAndValidateAndFormatProduct(id: string): Promise<FormattedProduct> { ... }
```

## TypeScript Rules

### Always Use Explicit Return Types

```typescript
// ✅ CORRECT
interface User {
    id: string;
    name: string;
}

function getUser(id: string): User | null {
    // ...
}

async function fetchUsers(): Promise<User[]> {
    // ...
}

// ❌ INCORRECT
function getUser(id: string) {
    // ...
}
```

### Use `const` by Default

```typescript
// ✅ CORRECT
const userId = '123';
const config = { timeout: 5000 };

// ❌ INCORRECT (unless reassignment is needed)
let userId = '123';
var config = { timeout: 5000 };
```

### Prefer Interface Over Type for Objects

```typescript
// ✅ CORRECT - Interface for object shapes
interface ProductConfig {
    id: string;
    name: string;
    price: number;
}

// ✅ CORRECT - Type for unions, primitives, tuples
type ProductType = 'subscription' | 'consumable' | 'non-consumable';
type Coordinates = [number, number];

// ❌ INCORRECT - Type for simple object shapes
type ProductConfig = {
    id: string;
    name: string;
};
```

## Swift Rules

### Use `guard` for Early Exit

```swift
// ✅ CORRECT
func processTransaction(_ transaction: Transaction?) throws -> Receipt {
    guard let transaction = transaction else {
        throw OpenIapError.invalidTransaction
    }
    guard transaction.isValid else {
        throw OpenIapError.transactionNotValid
    }
    return transaction.receipt
}

// ❌ INCORRECT - Nested if statements
func processTransaction(_ transaction: Transaction?) throws -> Receipt {
    if let transaction = transaction {
        if transaction.isValid {
            return transaction.receipt
        } else {
            throw OpenIapError.transactionNotValid
        }
    } else {
        throw OpenIapError.invalidTransaction
    }
}
```

### Prefer Struct Over Class

```swift
// ✅ CORRECT - Struct for data models
public struct ProductIOS: Sendable {
    public let id: String
    public let displayName: String
    public let price: Decimal
}

// Class only when needed (inheritance, reference semantics)
public final class OpenIapModule { ... }
```

## Kotlin Rules

### Use Data Classes for Models

```kotlin
// ✅ CORRECT
data class ProductAndroid(
    val id: String,
    val title: String,
    val price: String,
    val priceAmountMicros: Long
)

// ❌ INCORRECT - Regular class for data
class ProductAndroid {
    var id: String = ""
    var title: String = ""
}
```

### Use `when` Instead of `if-else` Chains

```kotlin
// ✅ CORRECT
fun handlePurchaseState(state: PurchaseState): String = when (state) {
    PurchaseState.PENDING -> "Processing..."
    PurchaseState.PURCHASED -> "Success!"
    PurchaseState.UNSPECIFIED -> "Unknown"
}

// ❌ INCORRECT
fun handlePurchaseState(state: PurchaseState): String {
    if (state == PurchaseState.PENDING) return "Processing..."
    else if (state == PurchaseState.PURCHASED) return "Success!"
    else return "Unknown"
}
```

## Error Messages

### Be Specific and Actionable

```typescript
// ✅ CORRECT
throw new Error(`Product not found: ${productId}. Ensure the product exists in App Store Connect.`);

// ❌ INCORRECT
throw new Error('Error occurred');
throw new Error('Product not found');
```

## Comments

### Document "Why", Not "What"

```typescript
// ✅ CORRECT - Explains why
// StoreKit 2 requires finishing transactions within 24 hours to avoid re-delivery
await transaction.finish();

// ❌ INCORRECT - States the obvious
// Finish the transaction
await transaction.finish();
```

### Use JSDoc for Public APIs

```typescript
/**
 * Fetches products from the App Store.
 *
 * @param productIds - Array of product identifiers to fetch
 * @returns Array of products matching the given IDs
 * @throws {ProductNotFoundError} If no products match the given IDs
 *
 * @example
 * const products = await fetchProducts(['com.app.premium', 'com.app.pro']);
 */
async function fetchProducts(productIds: string[]): Promise<Product[]> {
    // ...
}
```


---

<!-- Source: internal/04-platform-packages.md -->

# Platform Package Guidelines

> **Priority: MANDATORY**
> Each platform package has specific rules and workflows.

## Apple Package (packages/apple)

### Required Pre-Work (Apple)

Before writing or editing anything, **ALWAYS** review:
- [`packages/apple/CONVENTION.md`](../../packages/apple/CONVENTION.md)

### Type Generation

The `Types.swift` file in `Sources/Models/` is **auto-generated** from the OpenIAP GraphQL schema.

```bash
# Generate types using version from openiap-versions.json
./scripts/generate-types.sh

# Or override with environment variable
OPENIAP_GQL_VERSION=1.0.9 ./scripts/generate-types.sh
```

### Version Management

Version is managed in `openiap-versions.json`:

```json
{
  "apple": "1.2.5",
  "gql": "1.0.10"
}
```

**To update GQL types:**
1. Edit `openiap-versions.json` - change `"gql"` version
2. Run `./scripts/generate-types.sh`
3. Run `swift test` to verify compatibility

**To bump Apple package version:**

```bash
./scripts/bump-version.sh [major|minor|patch|x.x.x]
```

### Testing

```bash
swift test   # Run tests
swift build  # Build package
```

### Objective-C Bridge (CRITICAL for kmp-iap)

**IMPORTANT**: When updating iOS functions in `OpenIapModule.swift`, you **MUST** also update `OpenIapModule+ObjC.swift`.

The Objective-C bridge (`OpenIapModule+ObjC.swift`) exposes Swift async functions to Objective-C/Kotlin for:
- **kmp-iap** (Kotlin Multiplatform via cinterop)
- Any other platform that requires Objective-C interoperability

#### When to Update ObjC Bridge

Update `OpenIapModule+ObjC.swift` when:
- [ ] Adding new public functions to `OpenIapModule.swift`
- [ ] Changing function signatures (parameters, return types)
- [ ] Adding new input options or parameters
- [ ] Changing existing function behavior

#### Bridge Pattern

Every Swift async function needs an Objective-C completion handler wrapper:

```swift
// In OpenIapModule.swift (Swift async)
public func newFeatureIOS(param: String) async throws -> ResultType {
    // implementation
}

// In OpenIapModule+ObjC.swift (ObjC bridge - MUST ADD)
@objc func newFeatureIOSWithParam(
    _ param: String,
    completion: @escaping (Any?, Error?) -> Void
) {
    Task {
        do {
            let result = try await newFeatureIOS(param: param)
            let dictionary = OpenIapSerialization.encode(result)
            completion(dictionary, nil)
        } catch {
            completion(nil, error)
        }
    }
}
```

#### Files to Update Together

| Swift Function Changed | ObjC Bridge Required |
|------------------------|----------------------|
| `OpenIapModule.swift` | `OpenIapModule+ObjC.swift` |

**Verification**: After updating, run:
```bash
swift build  # Verifies ObjC bridge compiles
```

---

## Google Package (packages/google)

### Required Pre-Work (Google)

Before writing or editing anything, **ALWAYS** review:
- [`packages/google/CONVENTION.md`](../../packages/google/CONVENTION.md)

### Project Layout

```text
openiap/
├── src/
│   ├── main/           # Shared code (both flavors)
│   ├── play/           # Play Store specific code
│   └── horizon/        # Meta Horizon specific code
├── Example/            # Sample application
└── scripts/            # Automation
```

### Build Flavors

The Google package supports **two build flavors**:

| Flavor | Store | API | Description |
|--------|-------|-----|-------------|
| `play` (default) | Google Play Store | Google Play Billing Library | Standard Android billing |
| `horizon` | Meta Quest Store | Meta Horizon API | VR/Quest billing |

**Flavor-specific source directories:**
- `src/main/` - Shared code for both flavors
- `src/play/` - Play Store specific implementations
- `src/horizon/` - Meta Horizon specific implementations

### Critical Rules

1. **DO NOT edit generated files**: `openiap/src/main/Types.kt` is auto-generated
2. Put reusable Kotlin helpers in `openiap/src/main/java/dev/hyo/openiap/utils/`
3. Run `./scripts/generate-types.sh` to regenerate types
4. **Test BOTH flavors** when making changes to shared code

### Build Commands

```bash
# Play flavor (default)
./gradlew :openiap:compilePlayDebugKotlin
./gradlew :openiap:assemblePlayDebug

# Horizon flavor
./gradlew :openiap:compileHorizonDebugKotlin
./gradlew :openiap:assembleHorizonDebug

# Run tests (both flavors)
./gradlew :openiap:test
```

### Version Compatibility

| Flavor | Billing Library | Version |
|--------|-----------------|---------|
| Play | Google Play Billing | 8.3.0 |
| Horizon | horizon-billing-compatibility | 1.1.1 (GPB 7.0 compatible) |

**CRITICAL**: Horizon SDK implements **Billing 7.0 API**, not 8.x. When writing shared code in `src/main/`:

**Safe APIs (exist in both 7.0 and 8.x):**
- `queryProductDetailsAsync()`, `launchBillingFlow()`
- `acknowledgePurchase()`, `consumeAsync()`, `queryPurchasesAsync()`

**DO NOT use in shared code (8.x only):**
- `enableAutoServiceReconnection()`
- Product-level status codes
- One-time products with multiple offers

### Horizon-Specific APIs

Meta Horizon has different APIs from Google Play:

| OpenIAP API | Play Implementation | Horizon Implementation |
|-------------|---------------------|------------------------|
| `verifyPurchase` | Play Developer API | Meta S2S `verify_entitlement` |
| `getAvailableItems` | N/A | Horizon catalog API |
| `IapStore` | `IapStore.Play` | `IapStore.Horizon` |

**Horizon-specific types in GraphQL:**
- `VerifyPurchaseHorizonOptions` - Horizon verification parameters
- `VerifyPurchaseResultHorizon` - Horizon verification result

### Updating openiap-gql Version

1. Edit `openiap-versions.json` and update the `gql` field
2. Run `./scripts/generate-types.sh` to download and regenerate Types.kt
3. Compile BOTH flavors to verify:
   ```bash
   ./gradlew :openiap:compilePlayDebugKotlin
   ./gradlew :openiap:compileHorizonDebugKotlin
   ```

---

## Cross-Library Verification for Shared-Package Changes (MANDATORY)

> **When:** any change to `packages/google` or `packages/apple` that modifies
> a **public** API surface (class/struct shape, enum cases, function
> signatures, exception/error types). Adding a new field, removing a
> singleton, renaming a method, or adding an enum entry all qualify.

The compiled `packages/google` artifact is consumed as a **native
dependency** by every framework library. A change that compiles inside
`packages/google` alone can still break downstream libraries whose
Kotlin (or Swift) code references the affected symbol.

Before committing any change that touches the following surfaces:

- `packages/google/openiap/src/main/java/dev/hyo/openiap/OpenIapError.kt`
- `packages/gql/src/error.graphql` (ErrorCode enum additions — ripples
  through every generated `Types.*`)
- `packages/apple/Sources/Models/OpenIapError.swift`
- `packages/apple/Sources/OpenIapModule.swift` (public function
  signatures)

you **must** run the downstream compile for every framework library:

```bash
# Android (Google) downstream compile — required for every PR that
# touches packages/google public API
cd libraries/flutter_inapp_purchase && flutter analyze && flutter test
cd libraries/react-native-iap/example/android && ./gradlew :react-native-iap:compileDebugKotlin
cd libraries/expo-iap/example/android && ./gradlew :expo-iap:compileDebugKotlin
cd libraries/kmp-iap && ./gradlew :library:build -x test

# iOS (Apple) downstream compile — framework libraries consume
# openiap-apple through CocoaPods / SPM, so swift build on the source
# package is the minimum; add library-side Xcode builds when the
# change is non-additive.
cd packages/apple && swift build && swift test --filter OpenIapTests
```

### Mechanical grep guard

Right after changing `OpenIapError.kt`, run this grep to catch stale
singleton references that will fail in downstream compiles:

```bash
grep -rnE "OpenIap(API)?Error\.(DeveloperError|PurchaseFailed|UserCancelled|ServiceUnavailable|BillingUnavailable|ItemUnavailable|BillingError|ItemAlreadyOwned|ItemNotOwned|ServiceDisconnected|FeatureNotSupported|ServiceTimeout|UnknownError)\b" libraries/ packages/google/ \
  | grep -vE "\.(CODE|MESSAGE|Companion|rawValue)" \
  | grep -vE "is Open" \
  | grep -vE "\("
```

Any hit is a call site that uses a now-data-class name without `()` and
will fail to compile — add the parentheses (or the concrete
`debugMessage` argument) before pushing.

### Cross-library SemVer coordination

Breaking a shared-package API (e.g. `object → data class` on
`OpenIapError`) forces a **major** bump on that package (2.0.0) and
cascades into downstream libraries:

| Change in shared package                  | Google/Apple bump                              | Downstream bump                                              |
| ----------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Add optional field to a type              | minor                                          | minor                                                        |
| Add a new enum case                       | major (Swift/Kotlin exhaustive switches break) | minor                                                        |
| `object` → `data class` / renamed method  | major                                          | minor (downstream pins to new major; own API unchanged)      |

Release order MUST be: shared packages first (so downstream libraries
can depend on the new version), then framework libraries in any order.

---

## GQL Package (packages/gql)

### Required Pre-Work

Before writing or editing anything, **ALWAYS** review:
- [`packages/gql/CONVENTION.md`](../../packages/gql/CONVENTION.md)

### Code Generation Architecture

The GQL package uses an **IR-based (Intermediate Representation) code generation system**:

```text
GraphQL Schema (src/*.graphql)
         ↓
    [1] Parser (codegen/core/parser.ts)
         ↓
    [2] Transformer → IR (codegen/core/transformer.ts)
         ↓
    [3] Language Plugins (codegen/plugins/*.ts)
         ↓
    Generated Files (src/generated/*)
```

#### Directory Structure

```text
packages/gql/codegen/
├── index.ts              # Main entry point
├── core/
│   ├── types.ts          # IR type definitions
│   ├── parser.ts         # GraphQL schema parser
│   ├── transformer.ts    # AST → IR transformer
│   └── utils.ts          # Common utilities (case conversion, keywords)
├── plugins/
│   ├── base-plugin.ts    # Abstract base class
│   ├── swift.ts          # Swift plugin (Codable, ErrorCode handling)
│   ├── kotlin.ts         # Kotlin plugin (sealed interface, fromJson/toJson)
│   ├── dart.ts           # Dart plugin (sealed class, factory constructors)
│   └── gdscript.ts       # GDScript plugin (Godot engine)
└── templates/            # Handlebars templates (optional)
```

#### IR (Intermediate Representation)

The IR is a language-agnostic representation of the GraphQL schema:

| IR Type | Description |
|---------|-------------|
| `IREnum` | Enum with values, raw values, legacy aliases |
| `IRInterface` | Protocol/Interface with fields |
| `IRObject` | Struct/Class with fields, implements, unions |
| `IRInput` | Input type with fields, required field tracking |
| `IRUnion` | Union with members, nested union handling |
| `IROperation` | Query/Mutation/Subscription with fields |

#### Language Plugins

Each plugin handles language-specific requirements:

| Plugin | Features |
|--------|----------|
| **Swift** | Codable protocol, ErrorCode custom initializer, platform defaults |
| **Kotlin** | sealed interface, fromJson/toJson with nullable patterns |
| **Dart** | extends/implements, factory constructors, sealed class |
| **GDScript** | _init(), from_json/to_json, Variant type |

### Scripts

| Script | Description |
|--------|-------------|
| `generate:ts` | Generate TypeScript types (graphql-codegen) |
| `generate:swift` | Generate Swift types (IR-based plugin) |
| `generate:kotlin` | Generate Kotlin types (IR-based plugin) |
| `generate:dart` | Generate Dart types (IR-based plugin) |
| `generate:gdscript` | Generate GDScript types (IR-based plugin) |
| `generate` | Generate all types + sync to platforms |
| `sync` | Sync generated types to platform packages |

### Generating Types

```bash
cd packages/gql

# Generate all platform types
bun run generate

# Generate specific platform
bun run generate:swift
bun run generate:kotlin
bun run generate:dart
bun run generate:gdscript
```

### Generated Files

| File | Platform | Description |
|------|----------|-------------|
| `src/generated/types.ts` | TypeScript | Type definitions |
| `src/generated/Types.swift` | iOS/macOS | Codable structs & enums |
| `src/generated/Types.kt` | Android | Data classes & sealed interfaces |
| `src/generated/types.dart` | Flutter | Classes & sealed classes |
| `src/generated/types.gd` | Godot | GDScript classes |

### Adding a New Language

1. Create `codegen/plugins/<language>.ts` extending `CodegenPlugin`
2. Implement abstract methods:
   - `mapScalar()` - Map GraphQL scalars to language types
   - `mapType()` - Map IR types to language type strings
   - `generateEnum()`, `generateObject()`, etc.
3. Register in `codegen/index.ts`
4. Add script to `package.json`

### Schema Markers

Special comments in GraphQL SDL trigger codegen behavior:

| Marker | Effect |
|--------|--------|
| `# => Union` | Generates result union wrapper (e.g., `FetchProductsResult`) |
| `# Future` | Wraps return type in Promise/async |

Example:
```graphql
# => Union
type RequestPurchaseResult {
  purchase: Purchase
  purchases: [Purchase!]
}
```

---

## Docs Package (packages/docs)

### Pre-commit Checklist

Before committing any changes:

1. Run `npx prettier --write` to format all files
2. **ALWAYS run `npm run lint`** to check for linting issues
3. **ALWAYS run `bun run tsc` or `npm run typecheck`** to check for TypeScript errors
4. Run `npm run build` to ensure no build errors

### ESLint Critical Rule

**ANY function that returns a Promise must be wrapped with `void` operator** when used where a void return is expected:

```typescript
// CORRECT
<button onClick={() => void handleClick()}>Click</button>
<button onClick={() => void navigate("/path")}>Navigate</button>
<button onClick={() => void deleteThing({ id })}>Delete</button>

// INCORRECT - ESLint will flag these
<button onClick={handleClick}>Click</button>
<button onClick={() => navigate("/path")}>Go</button>
```


---

<!-- Source: internal/05-docs-patterns.md -->

# Documentation Site Patterns

> **Priority: MANDATORY**
> Follow these patterns when working on packages/docs.

## Modal Pattern with Preact Signals

### Global Modal Management

**IMPORTANT**: Modals should be defined once at the app root level and managed via global state using Preact Signals.

#### 1. Signal Definition (`src/lib/signals.ts`)

```typescript
import { signal } from '@preact/signals-react';

// Modal state signal
export const authModalSignal = signal({
  isOpen: false,
});

// Helper functions
export const openAuthModal = () => {
  authModalSignal.value = { isOpen: true };
};

export const closeAuthModal = () => {
  authModalSignal.value = { isOpen: false };
};
```

#### 2. Root Level Setup (`src/App.tsx`)

```typescript
import { AuthModal } from "./components/AuthModal";
import { authModalSignal, closeAuthModal } from "./lib/signals";

export default function App() {
  return (
    <>
      {/* Single modal instance at root */}
      <AuthModal
        isOpen={authModalSignal.value.isOpen}
        onClose={closeAuthModal}
      />
      {/* Rest of your app */}
    </>
  );
}
```

#### 3. Usage in Pages/Components

```typescript
import { openAuthModal } from '../lib/signals';

// In component
<button onClick={openAuthModal}>
  Sign In
</button>
```

---

## Feature Page Hierarchy (Sub-sections)

When a feature has sub-pages (e.g., Subscription > Upgrade/Downgrade, Alternative Marketplace > Onside), use a **directory structure** instead of hash anchors or flat file naming.

### Directory Structure

```
src/pages/docs/features/
├── subscription/
│   ├── index.tsx              # Main subscription page
│   └── upgrade-downgrade.tsx  # Sub-page
├── alternative-marketplace/
│   ├── index.tsx              # Main overview page
│   └── onside.tsx             # Sub-page
├── purchase.tsx               # No sub-pages → flat file
└── discount.tsx               # No sub-pages → flat file
```

### Route Registration (`docs/index.tsx`)

```tsx
// Imports
import SubscriptionFeature from './features/subscription/index';
import SubscriptionUpgradeDowngrade from './features/subscription/upgrade-downgrade';

// Routes
<Route path="features/subscription" element={<SubscriptionFeature />} />
<Route path="features/subscription/upgrade-downgrade" element={<SubscriptionUpgradeDowngrade />} />
```

### Sidebar Navigation

Use `MenuDropdown` for collapsible parent-child navigation:

```tsx
<MenuDropdown
  title="Subscription"
  titleTo="/docs/features/subscription"
  items={[
    { to: '/docs/features/subscription/upgrade-downgrade', label: 'Upgrade/Downgrade' },
  ]}
  onItemClick={closeSidebar}
/>
```

### Rules

- **Never use hash anchors (`#section`)** for sub-section navigation in the sidebar — always use separate routes/pages
- Parent page (`index.tsx`) should contain the overview; sub-pages contain detailed content
- Import paths from sub-directories use `../../../../components/` (one level deeper)
- Update all internal `<Link to="...">` references when moving files

---

## React Component Organization

### Component Structure

#### Shared Components (`src/components/`)

- Place reusable components that are used across multiple pages/features
- If a component is only used in one place, it should be co-located with its parent

#### Scoped Component Pattern

When a component has sub-components that are only used within it:

```
// For a component with internal sub-components
src/components/AuthModal/
  ├── index.tsx        // Main AuthModal component
  └── Modal.tsx        // Modal used only within AuthModal

// If Modal is used elsewhere too
src/components/
  ├── AuthModal.tsx    // Main component
  └── Modal.tsx        // Shared modal component
```

---

## Component Layout Rules

**CRITICAL**: All components must respect parent boundaries. Children must NEVER overflow outside parent containers.

### Overflow Prevention

- ALL components must fit within parent boundaries
- Use `overflow-hidden` on parent containers when necessary
- Apply `break-words` for text content that might be long
- Use `whitespace-nowrap` for navigation items to prevent wrapping

### Clean Code Practices

- Delete unused components, functions, and imports immediately
- Don't keep commented-out code
- Remove unused variables and parameters

---

## Release Notes Pattern

### Location

Release notes are located at `packages/docs/src/pages/docs/updates/releases.tsx`.

### Adding New Release Notes

1. Add new entry at the **top** of the `allNotes` array
2. Follow the existing pattern with `id`, `date`, and `element`
3. Use semantic IDs like `gql-1-3-16-apple-1-3-14`

```tsx
const allNotes: Note[] = [
  // GQL 1.3.16 / Apple 1.3.14 - Jan 26, 2026
  {
    id: 'gql-1-3-16-apple-1-3-14',
    date: new Date('2026-01-26'),
    element: (
      <div key="gql-1-3-16-apple-1-3-14" style={noteCardStyle}>
        <AnchorLink id="gql-1-3-16-apple-1-3-14" level="h4">
          📅 openiap-gql v1.3.16 / openiap-apple v1.3.14 - Feature Description
        </AnchorLink>
        {/* Content here */}
      </div>
    ),
  },
  // ... older notes
];
```

### Required Elements

- **AnchorLink**: For deep linking to specific release
- **Version info**: Package names and versions in title
- **Date**: In format `new Date('YYYY-MM-DD')`
- **References**: Links to Apple/Google documentation when applicable
- **Issue links**: Reference GitHub issues when fixing bugs


---

<!-- Source: internal/06-git-deployment.md -->

# Git Conventions & Deployment

> **Priority: MANDATORY**
> Follow these conventions for all commits and deployments.

## Git Commit Message Format

### Rules

- **50 characters max** for the subject line (tag + scope + message combined)
- Everything after the tag MUST be lowercase
- No trailing period
- Use imperative mood ("add" not "added")

### With Tag and Scope

When a commit targets a specific package or library, include the scope:

```text
feat(rn): add offer redemption
fix(expo): resolve purchase crash
fix(flutter): correct discount mapping
feat(kmp): add subscription flow
chore(godot): bump openiap dep
fix(apple): handle StoreKit edge case
fix(google): update billing client
```

### Without Scope

For cross-cutting or monorepo-wide changes:

```text
feat: add RC promote to releases
fix: update repo URLs in package.json
chore: update CI workflow names
```

### Without Tag Prefix

First letter MUST be uppercase:

```text
Add user authentication system
Fix purchase validation error
```

### Scope Reference

| Scope | Package/Library |
|-------|----------------|
| `apple` | `packages/apple` |
| `google` | `packages/google` |
| `gql` | `packages/gql` |
| `docs` | `packages/docs` |
| `rn` | `libraries/react-native-iap` |
| `expo` | `libraries/expo-iap` |
| `flutter` | `libraries/flutter_inapp_purchase` |
| `kmp` | `libraries/kmp-iap` |
| `godot` | `libraries/godot-iap` |

### Common Tags

| Tag | Usage |
|-----|-------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation changes |
| `style:` | Code style changes (formatting) |
| `refactor:` | Code refactoring |
| `test:` | Adding or updating tests |
| `chore:` | Maintenance tasks |

---

## Deployment

### Deploying Apple Package (iOS/macOS)

**Via GitHub Actions UI:**

1. Go to Actions -> "Apple Release"
2. Click "Run workflow"
3. Enter version (e.g., `1.2.24`)
4. Click "Run workflow"

**What happens:**
1. Updates `openiap-versions.json`
2. Commits version change to main
3. Creates Git tag `apple-v1.2.24`
4. Builds and tests Swift package
5. Validates and publishes to CocoaPods
6. Creates GitHub Release

**Result:**
- CocoaPods: `pod 'openiap', '~> 1.2.24'`
- Swift Package Manager: `.package(url: "https://github.com/hyodotdev/openiap.git", from: "1.2.24")`

### Deploying Google Package (Android)

**Via GitHub Actions UI:**

1. Go to Actions -> "Google Release"
2. Click "Run workflow"
3. Enter version (e.g., `1.2.14`)
4. Click "Run workflow"

**What happens:**
1. Updates `openiap-versions.json`
2. Commits version change to main
3. Creates Git tag `google-v1.2.14`
4. Builds and tests Android library
5. Publishes to Maven Central
6. Creates GitHub Release with artifacts (AAR, JAR)

**Result:**
- Maven Central: `implementation("io.github.hyochan.openiap:openiap-google:1.2.14")`

### Deploying Documentation

```bash
# From monorepo root
npm run deploy 1.2.0
```

This will:
1. Build and deploy documentation to Vercel
2. Trigger GitHub Actions workflow to:
   - Regenerate types for all platforms
   - Create release artifacts (TypeScript, Dart, Kotlin, Swift)
   - Create Git tag `v1.2.0`
   - Create GitHub Release with artifacts

---

## Important Notes

- **Deprecated repositories**: `openiap-apple` and `openiap-google` are no longer used
- **Monorepo only**: All releases are now managed from this monorepo
- **Separate versioning**: Apple and Google packages have independent versions
- **Swift Package Manager**: Automatically works via Git tags, no separate deployment step

---

## Version File Management

### openiap-versions.json

**CRITICAL: NEVER manually edit `openiap-versions.json`**

This file is automatically managed by CI/CD workflows during releases:
- Apple releases update `apple` version
- Google releases update `google` version
- GQL releases update `gql` and `docs` versions

Manual edits will cause version conflicts and deployment issues. Always use the GitHub Actions workflows to update versions.


---

# 📚 EXTERNAL API REFERENCE

Use this documentation for API details, but **ALWAYS adapt patterns to match Internal Rules above**.

---

<!-- Source: external/expo-iap-api.md -->

# expo-iap API Reference

> Reference documentation for expo-iap (Expo In-App Purchase module)
> Adapt all patterns to match OpenIAP internal conventions.

## Overview

expo-iap is the Expo-compatible version of react-native-iap, providing in-app purchase functionality for both iOS and Android in Expo projects.

## Installation

```bash
npx expo install expo-iap
```

## Connection Management

### initConnection

Initialize connection to the app store.

```typescript
import { initConnection } from 'expo-iap';

await initConnection();
```

### endConnection

Close connection to the app store.

```typescript
import { endConnection } from 'expo-iap';

await endConnection();
```

## Product Operations

### fetchProducts

Fetch product information from the store.

```typescript
import { fetchProducts } from 'expo-iap';

const products = await fetchProducts(['com.app.product1', 'com.app.sub_monthly']);
```

**Returns:** `Promise<Product[]>`

### Product Type

```typescript
interface Product {
  productId: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  localizedPrice: string;
  type: ProductType; // 'iap' | 'sub'

  // iOS only
  subscriptionPeriodNumberIOS?: string;
  subscriptionPeriodUnitIOS?: string;
  introductoryPrice?: string;
  introductoryPricePaymentModeIOS?: string;
  introductoryPriceNumberOfPeriodsIOS?: string;
  introductoryPriceSubscriptionPeriodIOS?: string;

  // Android only
  subscriptionOfferDetailsAndroid?: SubscriptionOffer[];
  oneTimePurchaseOfferDetailsAndroid?: OneTimePurchaseOffer;
}
```

## Purchase Operations

### requestPurchase

Initiate a purchase.

```typescript
import { requestPurchase } from 'expo-iap';

// For consumables/non-consumables
await requestPurchase({ sku: 'com.app.product1' });

// For subscriptions (Android)
await requestPurchase({
  sku: 'com.app.sub_monthly',
  subscriptionOffers: [{ sku: 'com.app.sub_monthly', offerToken: 'token' }]
});
```

### finishTransaction

Complete a transaction after processing.

```typescript
import { finishTransaction } from 'expo-iap';

await finishTransaction({ purchase, isConsumable: true });
```

### getAvailablePurchases

Get user's existing purchases (restore purchases).

```typescript
import { getAvailablePurchases } from 'expo-iap';

const purchases = await getAvailablePurchases();
```

## Purchase Type

```typescript
interface Purchase {
  productId: string;
  transactionId?: string;
  transactionDate: number;
  transactionReceipt: string;
  purchaseToken?: string; // Android

  // iOS only
  originalTransactionDateIOS?: number;
  originalTransactionIdentifierIOS?: string;

  // Android only
  purchaseStateAndroid?: number;
  isAcknowledgedAndroid?: boolean;
  packageNameAndroid?: string;
  obfuscatedAccountIdAndroid?: string;
  obfuscatedProfileIdAndroid?: string;
}
```

## iOS-Specific Functions

### clearTransactionIOS

Clear finished transactions from the queue.

```typescript
import { clearTransactionIOS } from 'expo-iap';

await clearTransactionIOS();
```

### getReceiptDataIOS

Get the receipt data for validation.

```typescript
import { getReceiptDataIOS } from 'expo-iap';

const receipt = await getReceiptDataIOS();
```

### syncIOS

Sync transactions with the App Store.

```typescript
import { syncIOS } from 'expo-iap';

await syncIOS();
```

### presentCodeRedemptionSheetIOS

Show the offer code redemption sheet.

```typescript
import { presentCodeRedemptionSheetIOS } from 'expo-iap';

await presentCodeRedemptionSheetIOS();
```

### showManageSubscriptionsIOS

Open subscription management in App Store.

```typescript
import { showManageSubscriptionsIOS } from 'expo-iap';

await showManageSubscriptionsIOS();
```

### isEligibleForIntroOfferIOS

Check intro offer eligibility.

```typescript
import { isEligibleForIntroOfferIOS } from 'expo-iap';

const eligible = await isEligibleForIntroOfferIOS('com.app.sub_monthly');
```

### beginRefundRequestIOS

Start a refund request.

```typescript
import { beginRefundRequestIOS } from 'expo-iap';

const result = await beginRefundRequestIOS('transaction_id');
```

## Android-Specific Functions

### acknowledgePurchaseAndroid

Acknowledge a purchase (required within 3 days).

```typescript
import { acknowledgePurchaseAndroid } from 'expo-iap';

await acknowledgePurchaseAndroid({ token: purchase.purchaseToken });
```

### consumePurchaseAndroid

Consume a consumable purchase.

```typescript
import { consumePurchaseAndroid } from 'expo-iap';

await consumePurchaseAndroid({ token: purchase.purchaseToken });
```

### getPackageNameAndroid

Get the app's package name.

```typescript
import { getPackageNameAndroid } from 'expo-iap';

const packageName = await getPackageNameAndroid();
```

## Cross-Platform Functions

### getActiveSubscriptions

Get active subscriptions.

```typescript
import { getActiveSubscriptions } from 'expo-iap';

const subscriptions = await getActiveSubscriptions(['com.app.sub_monthly']);
```

### hasActiveSubscriptions

Check if user has active subscriptions.

```typescript
import { hasActiveSubscriptions } from 'expo-iap';

const hasActive = await hasActiveSubscriptions(['com.app.sub_monthly']);
```

### deepLinkToSubscriptions

Open subscription management on both platforms.

```typescript
import { deepLinkToSubscriptions } from 'expo-iap';

await deepLinkToSubscriptions({ sku: 'com.app.sub_monthly' });
```

### getStorefront

Get storefront information.

```typescript
import { getStorefront } from 'expo-iap';

const storefront = await getStorefront();
// { countryCode: 'US', ... }
```

## Event Listeners

### purchaseUpdatedListener

Listen for purchase updates.

```typescript
import { purchaseUpdatedListener } from 'expo-iap';

const subscription = purchaseUpdatedListener((purchase) => {
  console.log('Purchase updated:', purchase);
  // Process and finish transaction
});

// Cleanup
subscription.remove();
```

### purchaseErrorListener

Listen for purchase errors.

```typescript
import { purchaseErrorListener } from 'expo-iap';

const subscription = purchaseErrorListener((error) => {
  console.error('Purchase error:', error);
});

// Cleanup
subscription.remove();
```

## Error Codes

| Code | Description |
|------|-------------|
| `E_UNKNOWN` | Unknown error |
| `E_USER_CANCELLED` | User cancelled |
| `E_ITEM_UNAVAILABLE` | Item not available |
| `E_NETWORK_ERROR` | Network error |
| `E_SERVICE_ERROR` | Store service error |
| `E_ALREADY_OWNED` | Item already owned |
| `E_NOT_PREPARED` | Not initialized |
| `E_NOT_ENDED` | Connection not ended |
| `E_DEVELOPER_ERROR` | Developer error |

## Usage Pattern

```typescript
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
} from 'expo-iap';

// Setup
await initConnection();

const purchaseListener = purchaseUpdatedListener(async (purchase) => {
  // Verify purchase server-side
  // Then finish transaction
  await finishTransaction({ purchase, isConsumable: false });
});

const errorListener = purchaseErrorListener((error) => {
  console.error(error);
});

// Fetch products
const products = await fetchProducts(['com.app.premium']);

// Make purchase
await requestPurchase({ sku: 'com.app.premium' });

// Cleanup
purchaseListener.remove();
errorListener.remove();
await endConnection();
```


---

<!-- Source: external/google-billing-api.md -->

# Google Play Billing Library API Reference

> Reference documentation for Google Play Billing Library 8.x
> Adapt all patterns to match OpenIAP internal conventions.

## Overview

Google Play Billing Library enables in-app purchases and subscriptions on Android devices.

## Version History

| Version | Release Date | Key Features |
|---------|--------------|--------------|
| 8.0 | 2025-06-30 | Auto-reconnect, product-level status codes, one-time products with multiple offers, sub-response codes |
| 8.1 | 2025-11-06 | Suspended subscriptions (`isSuspended`), `includeSuspended` parameter, pre-order details, product-level subscription replacement, `KEEP_EXISTING` mode |
| 8.2 | 2025-12-09 | Billing Programs API (external content links, external offers), deprecates old External Offers API |
| 8.2.1 | 2025-12-15 | Bug fix for `isBillingProgramAvailableAsync()` and `createBillingProgramReportingDetailsAsync()` |
| 8.3 | 2025-12-23 | External Payments program (Japan only), developer billing options |

**Current Version**: 8.3.0 (as of January 2026)

## Core Classes

### BillingClient

The main interface for communicating with Google Play Billing.

```kotlin
val billingClient = BillingClient.newBuilder(context)
    .setListener(purchasesUpdatedListener)
    .enablePendingPurchases()
    // New in 8.0: Auto-reconnect on service disconnect
    .enableAutoServiceReconnection()
    .build()
```

### Auto Service Reconnection (8.0+)

```kotlin
// Enables automatic reconnection when service disconnects
BillingClient.newBuilder(context)
    .enableAutoServiceReconnection()
    .build()
```

When enabled, the library automatically re-establishes the connection if an API call is made while disconnected. This reduces `SERVICE_DISCONNECTED` errors.

> **OpenIAP Note**: Auto-reconnection is **always enabled** internally since OpenIAP uses Billing Library 8.3.0+. No configuration needed.

### Connection Management

```kotlin
billingClient.startConnection(object : BillingClientStateListener {
    override fun onBillingSetupFinished(billingResult: BillingResult) {
        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
            // Ready to query purchases
        }
    }

    override fun onBillingServiceDisconnected() {
        // Reconnect on next request
    }
})
```

## Product Details

### QueryProductDetailsParams

```kotlin
val productList = listOf(
    QueryProductDetailsParams.Product.newBuilder()
        .setProductId("product_id")
        .setProductType(BillingClient.ProductType.SUBS) // or INAPP
        .build()
)

val params = QueryProductDetailsParams.newBuilder()
    .setProductList(productList)
    .build()

billingClient.queryProductDetailsAsync(params) { billingResult, productDetailsList ->
    // Handle product details
}
```

### ProductDetails Properties

| Property | Type | Description |
|----------|------|-------------|
| `productId` | String | Unique product identifier |
| `productType` | String | "subs" or "inapp" |
| `title` | String | Localized product title |
| `name` | String | Product name |
| `description` | String | Localized description |
| `oneTimePurchaseOfferDetails` | Object | For INAPP products |
| `subscriptionOfferDetails` | List | For subscription products |

### Subscription Offer Details

```kotlin
data class SubscriptionOfferDetails(
    val basePlanId: String,
    val offerId: String?,
    val offerToken: String,
    val pricingPhases: PricingPhases,
    val offerTags: List<String>
)
```

### Pricing Phases

```kotlin
data class PricingPhase(
    val formattedPrice: String,
    val priceAmountMicros: Long,
    val priceCurrencyCode: String,
    val billingPeriod: String,  // ISO 8601 (P1W, P1M, P1Y)
    val billingCycleCount: Int,
    val recurrenceMode: Int     // FINITE or INFINITE
)
```

## Purchase Flow

### Launch Purchase Flow

```kotlin
val productDetailsParams = BillingFlowParams.ProductDetailsParams.newBuilder()
    .setProductDetails(productDetails)
    .setOfferToken(offerToken) // For subscriptions
    .build()

val billingFlowParams = BillingFlowParams.newBuilder()
    .setProductDetailsParamsList(listOf(productDetailsParams))
    .build()

val billingResult = billingClient.launchBillingFlow(activity, billingFlowParams)
```

### PurchasesUpdatedListener

```kotlin
val purchasesUpdatedListener = PurchasesUpdatedListener { billingResult, purchases ->
    when (billingResult.responseCode) {
        BillingClient.BillingResponseCode.OK -> {
            purchases?.forEach { purchase ->
                handlePurchase(purchase)
            }
        }
        BillingClient.BillingResponseCode.USER_CANCELED -> {
            // User cancelled
        }
        else -> {
            // Handle error
        }
    }
}
```

## Purchase Verification & Acknowledgement

### Verify Purchase

```kotlin
val purchase: Purchase

// Check purchase state
if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
    // Verify signature server-side
    // Then acknowledge or consume
}
```

### Acknowledge Purchase (Subscriptions/Non-consumables)

```kotlin
if (!purchase.isAcknowledged) {
    val acknowledgePurchaseParams = AcknowledgePurchaseParams.newBuilder()
        .setPurchaseToken(purchase.purchaseToken)
        .build()

    billingClient.acknowledgePurchase(acknowledgePurchaseParams) { billingResult ->
        // Handle result
    }
}
```

### Consume Purchase (Consumables)

```kotlin
val consumeParams = ConsumeParams.newBuilder()
    .setPurchaseToken(purchase.purchaseToken)
    .build()

billingClient.consumeAsync(consumeParams) { billingResult, purchaseToken ->
    // Handle result
}
```

## Query Existing Purchases

```kotlin
// Query subscriptions
billingClient.queryPurchasesAsync(
    QueryPurchasesParams.newBuilder()
        .setProductType(BillingClient.ProductType.SUBS)
        .build()
) { billingResult, purchasesList ->
    // Handle existing subscriptions
}

// Query in-app products
billingClient.queryPurchasesAsync(
    QueryPurchasesParams.newBuilder()
        .setProductType(BillingClient.ProductType.INAPP)
        .build()
) { billingResult, purchasesList ->
    // Handle existing purchases
}
```

## Purchase Properties

| Property | Type | Description |
|----------|------|-------------|
| `orderId` | String | Unique order identifier |
| `purchaseToken` | String | Token for verification |
| `purchaseState` | Int | PENDING, PURCHASED, UNSPECIFIED |
| `purchaseTime` | Long | Timestamp in milliseconds |
| `products` | List<String> | Product IDs in purchase |
| `isAcknowledged` | Boolean | Whether acknowledged |
| `isAutoRenewing` | Boolean | Auto-renewal status |
| `quantity` | Int | Quantity purchased |

## Response Codes

| Code | Constant | Description |
|------|----------|-------------|
| 0 | OK | Success |
| 1 | USER_CANCELED | User cancelled |
| 2 | SERVICE_UNAVAILABLE | Network error |
| 3 | BILLING_UNAVAILABLE | Billing not available |
| 4 | ITEM_UNAVAILABLE | Item not available |
| 5 | DEVELOPER_ERROR | Invalid arguments |
| 6 | ERROR | Fatal error |
| 7 | ITEM_ALREADY_OWNED | Already owned |
| 8 | ITEM_NOT_OWNED | Not owned |

## Feature Support

```kotlin
// Check if feature is supported
val result = billingClient.isFeatureSupported(BillingClient.FeatureType.SUBSCRIPTIONS)
if (result.responseCode == BillingClient.BillingResponseCode.OK) {
    // Subscriptions are supported
}
```

### Feature Types

- `SUBSCRIPTIONS` - Subscription support
- `SUBSCRIPTIONS_UPDATE` - Subscription upgrades/downgrades
- `PRICE_CHANGE_CONFIRMATION` - Price change confirmation
- `PRODUCT_DETAILS` - Product details API

## Product-Level Status Codes (8.0+)

In Billing Library 8.0+, `queryProductDetailsAsync()` returns products that couldn't be fetched with a status code explaining why.

```kotlin
billingClient.queryProductDetailsAsync(params) { billingResult, productDetailsList ->
    productDetailsList.forEach { productDetails ->
        when (productDetails.productStatus) {
            ProductDetails.ProductStatus.OK -> {
                // Product fetched successfully
            }
            ProductDetails.ProductStatus.NOT_FOUND -> {
                // SKU doesn't exist in Play Console
            }
            ProductDetails.ProductStatus.NO_OFFERS_AVAILABLE -> {
                // User not eligible for any offers
            }
        }
    }
}
```

| Status | Description |
|--------|-------------|
| `OK` | Product fetched successfully |
| `NOT_FOUND` | SKU doesn't exist in Play Console |
| `NO_OFFERS_AVAILABLE` | User not eligible for any offers |

## Suspended Subscriptions (8.1+)

```kotlin
val purchase: Purchase

// Check if subscription is suspended due to billing issue
if (purchase.isSuspended) {
    // User's payment method failed
    // Do NOT grant entitlements
    // Direct user to subscription center to fix payment
}
```

### Query Suspended Subscriptions (8.1+)

```kotlin
// Include suspended subscriptions in query results
val params = QueryPurchasesParams.newBuilder()
    .setProductType(BillingClient.ProductType.SUBS)
    .setIncludeSuspended(true)  // New in 8.1
    .build()

billingClient.queryPurchasesAsync(params) { billingResult, purchases ->
    purchases.forEach { purchase ->
        if (purchase.isSuspended) {
            // Handle suspended subscription
        }
    }
}
```

> **OpenIAP Note**: Use `includeSuspendedAndroid: true` in `PurchaseOptions` when calling `getAvailablePurchases()`. The `isSuspendedAndroid` field on purchases indicates suspension status.

## Sub-Response Codes (8.0+)

`BillingResult` includes a sub-response code for more granular error information:

```kotlin
val result = billingClient.launchBillingFlow(activity, params)
when (result.subResponseCode) {
    BillingResult.SUB_RESPONSE_CODE_INSUFFICIENT_FUNDS -> {
        // User's payment method has insufficient funds
    }
    BillingResult.SUB_RESPONSE_CODE_USER_INELIGIBLE -> {
        // User doesn't meet offer eligibility requirements
    }
}
```

| Sub-Response Code | Description |
|-------------------|-------------|
| `PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS` | User's payment method has insufficient funds |
| `USER_INELIGIBLE` | User doesn't meet subscription offer eligibility |
| `NO_APPLICABLE_SUB_RESPONSE_CODE` | No specific sub-code applies |

## Subscription Product Replacement (8.1+)

Product-level replacement parameters for subscription upgrades/downgrades:

```kotlin
val replacementParams = SubscriptionProductReplacementParams.newBuilder()
    .setOldProductId("old_subscription_id")
    .setReplacementMode(ReplacementMode.WITH_TIME_PRORATION)
    .build()

val productDetailsParams = BillingFlowParams.ProductDetailsParams.newBuilder()
    .setProductDetails(newProductDetails)
    .setOfferToken(offerToken)
    .setSubscriptionProductReplacementParams(replacementParams)  // New in 8.1
    .build()
```

### Replacement Modes

| Mode | Description |
|------|-------------|
| `WITH_TIME_PRORATION` | Immediate, expiration time prorated |
| `CHARGE_PRORATED_PRICE` | Immediate, same billing cycle |
| `CHARGE_FULL_PRICE` | Immediate, full price charged |
| `WITHOUT_PRORATION` | Takes effect on old plan expiration |
| `DEFERRED` | Deferred, no charge |
| `KEEP_EXISTING` | Keep existing payment schedule (8.1+) |

## External Payments Program (8.3+)

Billing Library 8.3 (December 2025) added support for the External Payments program (Japan-only, as of launch). Developers enrolled in the program can offer alternative payment methods alongside Google Play billing.

### Enable Developer Billing Option

```kotlin
// During BillingClient setup
val billingClient = BillingClient.newBuilder(context)
    .setListener(purchasesUpdatedListener)
    .enablePendingPurchases()
    .enableAutoServiceReconnection()
    .enableDeveloperBillingOption(
        DeveloperBillingOptionParams.newBuilder()
            .setDeveloperProvidedBillingListener(developerBillingListener)
            .build()
    )
    .build()
```

### DeveloperProvidedBillingListener

```kotlin
val developerBillingListener = DeveloperProvidedBillingListener {
    userInitiatedBillingDetails ->
    // User chose the developer-provided billing flow.
    // Launch your external payment UI here.
}
```

### Launch Purchase with External Payments Option

```kotlin
val params = BillingFlowParams.newBuilder()
    .setProductDetailsParamsList(listOf(productDetailsParams))
    .setBillingOption(BillingOption.EXTERNAL_PAYMENTS)  // 8.3+
    .build()

billingClient.launchBillingFlow(activity, params)
```

### Key Types (8.3+)

| Type | Purpose |
|------|---------|
| `DeveloperBillingOptionParams` | Configures developer-billing support on `BillingClient` |
| `DeveloperProvidedBillingListener` | Callback when user picks developer-provided billing |
| `DeveloperProvidedBillingDetails` | Billing details to report back for reconciliation |
| `BillingOption.EXTERNAL_PAYMENTS` | Purchase-flow flag requesting external payments |

> **OpenIAP Note**: Exposed through the Android-specific `AlternativeBilling*` surface in OpenIAP. Enrolment with Google Play's External Payments program is required; availability is currently restricted to Japan. The Horizon flavor does NOT implement this.

## Best Practices

1. **Always acknowledge purchases** within 3 days or they will be refunded
2. **Verify purchases server-side** using Google Play Developer API
3. **Handle pending purchases** for payment methods that require additional steps
4. **Auto-reconnect is enabled by default** in OpenIAP (8.0+)
5. **Check product status codes** (8.0+) to understand why products weren't fetched
6. **Check isSuspended** (8.1+) before granting entitlements
7. **Cache product details** to avoid repeated queries


---

<!-- Source: external/horizon-api.md -->

# Meta Horizon IAP API Reference

> External reference for Meta Horizon Store in-app purchase APIs.
> Source: [Meta Horizon Documentation](https://developers.meta.com/horizon/documentation/)

## Overview

Meta Horizon provides IAP functionality for Quest VR applications. There are two main integration paths:

1. **Platform SDK IAP** - Native Horizon IAP APIs
2. **Billing Compatibility SDK** - Google Play Billing Library-compatible wrapper

## Version Compatibility Matrix

| Library | Version | Compatible With |
|---------|---------|-----------------|
| horizon-billing-compatibility | **1.1.1** (latest) | Google Play Billing **7.0** API |
| Google Play Billing (Play flavor) | **8.3.0** (latest) | N/A |
| react-native-iap | v14+ | Billing 7.0+, RN 0.79+, Kotlin 2.0+ |
| expo-iap | latest | Billing 7.0+, Kotlin 2.0+ |

**CRITICAL**: Horizon Billing Compatibility SDK implements Google Play Billing **7.0** API surface, NOT 8.x.

When writing shared code for both Play and Horizon flavors:
- Use only APIs that exist in **both** Billing 7.0 and 8.x
- Horizon SDK does NOT support Billing 8.x features like auto-reconnect, product status codes, or `includeSuspended`
- OpenIAP handles this automatically with flavor-specific implementations

### APIs Available in Both (Safe to use in shared code)

- `BillingClient.Builder`, `BillingClient.newBuilder()`
- `queryProductDetailsAsync()` - Core product query
- `launchBillingFlow()` - Purchase flow
- `acknowledgePurchase()` - Acknowledge (no-op in Horizon)
- `consumeAsync()` - Consume purchase
- `queryPurchasesAsync()` - Query purchases

### APIs Only in Billing 8.x (DO NOT use in shared code)

- `enableAutoServiceReconnection()` - Auto-reconnect feature (8.0+)
- Product-level status codes in `queryProductDetailsAsync()` response (8.0+)
- One-time products with multiple offers (8.0+)
- Sub-response codes in `BillingResult` (8.0+)
- `isSuspended` on Purchase (8.1+)
- `includeSuspended` parameter in `QueryPurchasesParams` (8.1+)
- `SubscriptionProductReplacementParams` (8.1+)
- Billing Programs API (`isBillingProgramAvailableAsync`, etc.) (8.2+)
- External Payments / Developer Billing Options (8.3+)

## Billing Compatibility SDK

For apps already using Google Play Billing Library, the Horizon Billing Compatibility SDK provides a minimal migration path.

### Compatibility

- Compatible with **Google Play Billing Library 7.0** API
- Supports: consumable, durable, and subscription IAP
- Kotlin 2+ required

### Migration Steps

Replace imports from:
```kotlin
import com.android.billingclient.api.*
```

To:
```kotlin
import com.meta.horizon.billingclient.api.*
```

### Key Differences from Google Play Billing

| Feature | Google Play | Horizon |
|---------|-------------|---------|
| `acknowledgePurchase()` | Required within 3 days | No-op (not required) |
| Non-acknowledgement | Auto-refund after 3 days | No auto-refund |
| `enablePendingPurchases()` | Enables pending purchases | No-op (for compatibility) |
| `onBillingServiceDisconnected()` | Called on disconnect | Never invoked |

### Important Notes

- Keep SKUs on Meta Horizon Developer Center same as Google Play Console product IDs
- Only call `consumeAsync()` on consumable items
- `acknowledgePurchase()` is no-op - no acknowledgement requirements

## Server-to-Server (S2S) APIs

### Authentication

Access token format: `OC|App_ID|App_Secret`

### Verify Entitlement

Verify that a user owns an item (app or add-on).

**Endpoint:**

```http
POST https://graph.oculus.com/$APP_ID/verify_entitlement
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `access_token` | string | `OC\|App_ID\|App_Secret` format |
| `user_id` | string | The user ID to verify |
| `sku` | string | (Optional) SKU for add-on verification |

**Example - Verify App Ownership:**
```bash
curl -d "access_token=OC|$APP_ID|$APP_SECRET" \
     -d "user_id=$USER_ID" \
     https://graph.oculus.com/$APP_ID/verify_entitlement
```

**Example - Verify Add-on/IAP:**
```bash
curl -d "access_token=OC|$APP_ID|$APP_SECRET" \
     -d "user_id=$USER_ID" \
     -d "sku=$SKU" \
     https://graph.oculus.com/$APP_ID/verify_entitlement
```

**Response:**
```json
{
  "success": true
}
```

### Refund IAP Entitlement

Refund a DURABLE or CONSUMABLE entitlement (not yet consumed).

**Endpoint:**

```http
POST https://graph.oculus.com/$APP_ID/refund_iap_entitlement
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `access_token` | string | `OC\|App_ID\|App_Secret` format |
| `user_id` | string | The user ID |
| `sku` | string | SKU of item to refund |

**Note:** Can only refund items not yet consumed via `consumeAsync()`.

## Platform SDK IAP (Native)

### Product Types

| Type | Description |
|------|-------------|
| `CONSUMABLE` | Can be purchased multiple times (e.g., coins) |
| `DURABLE` | One-time purchase, permanent ownership |
| `SUBSCRIPTION` | Recurring billing |

### Key APIs

#### Get Products

Retrieve product information and pricing.

#### Launch Purchase Flow

Initiate purchase for an item.

#### Query Purchase History

Get user's purchase history.

#### Consume Purchase

Mark consumable item as used (required for re-purchase).

## OpenIAP Type Mapping

| OpenIAP Type | Description |
|--------------|-------------|
| `IapStore.Horizon` | Store identifier for Horizon |
| `VerifyPurchaseHorizonOptions` | Horizon verification parameters |
| `VerifyPurchaseResultHorizon` | Horizon verification result |

### VerifyPurchaseHorizonOptions

```typescript
interface VerifyPurchaseHorizonOptions {
  userId: string;      // Horizon user ID
  sku: string;         // Product SKU
  accessToken: string; // Format: "OC|APP_ID|APP_SECRET"
}
```

> **OpenIAP Note**: The GraphQL schema takes a single `accessToken` formatted as `OC|APP_ID|APP_SECRET` rather than separate `appId` / `appSecret` fields. Build the token server-side and pass it as one string.

### VerifyPurchaseResultHorizon

```typescript
interface VerifyPurchaseResultHorizon {
  success: boolean;    // Verification result
}
```

## Entitlement Check

Apps must perform entitlement check within 10 seconds of launch for VRC.Quest.Security.1 compliance.

## React Native / Expo Support

Meta Quest supports React Native and Expo applications.

### Requirements

| Library | Minimum Version | Notes |
|---------|-----------------|-------|
| react-native-iap | v14+ | Billing 7.0+, Kotlin 2.0+, RN 0.79+ |
| expo-iap | latest | Uses expo-horizon-core plugin |
| React Native | 0.79+ | Required for Nitro modules |
| Kotlin | 2.0+ | Required for both billing SDKs |

### Expo Integration

Use `expo-horizon-core` plugin for Quest support:

```bash
npx expo install expo-horizon-core
```

The plugin:
- Removes unsupported dependencies/permissions
- Configures Android product flavors
- Specifies Meta Horizon App ID
- Provides Quest-specific JS utilities

### Known Limitations on Quest

- No GPS sensor (limited location accuracy)
- No geocoding support
- No device heading
- No background location
- Some Expo libraries need forks (expo-location, expo-notifications)

## Documentation Links

- [Platform SDK IAP Package](https://developers.meta.com/horizon/documentation/android-apps/ps-platform-sdk-iap)
- [S2S APIs](https://developers.meta.com/horizon/documentation/unity/ps-iap-s2s/)
- [Billing Compatibility SDK](https://developers.meta.com/horizon/documentation/spatial-sdk/horizon-billing-compatibility-sdk/)
- [Entitlement Check](https://developers.meta.com/horizon/documentation/android-apps/ps-entitlement-check/)
- [React Native on Quest](https://developers.meta.com/horizon/documentation/android-apps/react-native-apps)
- [Expo Quest Setup](https://blog.swmansion.com/how-to-add-meta-quest-support-to-your-expo-app-68c52778b1fe)
- [Subscriptions](https://developers.meta.com/horizon/resources/subscriptions/)
- [Setting up Add-ons](https://developers.meta.com/horizon/resources/add-ons-setup/)


---

<!-- Source: external/react-native-iap-api.md -->

# react-native-iap API Reference (Legacy)

> **WARNING**: This file contains outdated API names from older versions.
> For the current API spec, refer to the official [OpenIAP documentation](https://openiap.dev/docs/apis).
>
> Key renames from legacy to current:
>
> - `getProducts` → `fetchProducts`
> - `getSubscriptions` → `fetchProducts({ type: 'subs' })`
> - `getPurchaseHistory` → `getAvailablePurchases`
> - `requestSubscription` → `requestPurchase({ type: 'subs' })`
> - `completePurchase` → `finishTransaction`

## Overview

react-native-iap is a React Native library for in-app purchases on iOS and Android. expo-iap is built on top of this library.

## Installation

```bash
npm install react-native-iap
# or
yarn add react-native-iap
```

## Hook-Based API (Recommended)

### useIAP Hook

```typescript
import { useIAP } from 'react-native-iap';

function PurchaseScreen() {
  const {
    connected,
    products,
    subscriptions,
    purchaseHistory,
    availablePurchases,
    currentPurchase,
    currentPurchaseError,
    initConnectionError,
    finishTransaction,
    fetchProducts,
    getSubscriptions,
    getAvailablePurchases,
    getPurchaseHistory,
    requestPurchase,
    requestSubscription,
  } = useIAP();

  useEffect(() => {
    if (currentPurchase) {
      // Process purchase
      finishTransaction({ purchase: currentPurchase });
    }
  }, [currentPurchase]);

  return (/* ... */);
}
```

### withIAPContext HOC

Wrap your app with IAP context provider.

```typescript
import { withIAPContext } from 'react-native-iap';

function App() {
  return <PurchaseScreen />;
}

export default withIAPContext(App);
```

## Imperative API

### Connection Management

```typescript
import {
  initConnection,
  endConnection,
  fetchProducts,
  getSubscriptions,
} from 'react-native-iap';

// Initialize
const connected = await initConnection();

// Fetch products
const products = await fetchProducts({ skus: ['com.app.product1'] });
const subs = await getSubscriptions({ skus: ['com.app.sub_monthly'] });

// Cleanup
await endConnection();
```

### Product Types

```typescript
interface Product {
  productId: string;
  price: string;
  currency: string;
  localizedPrice: string;
  title: string;
  description: string;
  type: 'inapp' | 'subs';

  // iOS
  introductoryPrice?: string;
  introductoryPriceAsAmountIOS?: string;
  introductoryPricePaymentModeIOS?: string;
  introductoryPriceNumberOfPeriodsIOS?: string;
  introductoryPriceSubscriptionPeriodIOS?: string;
  subscriptionPeriodNumberIOS?: string;
  subscriptionPeriodUnitIOS?: string;
  discounts?: Discount[];

  // Android
  subscriptionOfferDetails?: SubscriptionOffer[];
  oneTimePurchaseOfferDetails?: OneTimePurchaseOffer;
}

interface SubscriptionOffer {
  basePlanId: string;
  offerId?: string;
  offerToken: string;
  offerTags: string[];
  pricingPhases: PricingPhase[];
}

interface PricingPhase {
  formattedPrice: string;
  priceCurrencyCode: string;
  priceAmountMicros: string;
  billingPeriod: string;
  billingCycleCount: number;
  recurrenceMode: number;
}
```

### Purchase Operations

```typescript
import {
  requestPurchase,
  requestSubscription,
  finishTransaction,
  getAvailablePurchases,
  getPurchaseHistory,
} from 'react-native-iap';

// Purchase consumable/non-consumable
await requestPurchase({ sku: 'com.app.product1' });

// Purchase subscription (Android with offer token)
await requestSubscription({
  sku: 'com.app.sub_monthly',
  subscriptionOffers: [{ sku: 'com.app.sub_monthly', offerToken: 'token' }],
});

// Finish transaction
await finishTransaction({ purchase, isConsumable: true });

// Get available purchases (restore)
const available = await getAvailablePurchases();

// Get purchase history
const history = await getPurchaseHistory();
```

### Purchase Type

```typescript
interface Purchase {
  productId: string;
  transactionId?: string;
  transactionDate: number;
  transactionReceipt: string;
  purchaseToken?: string;
  quantityIOS?: number;
  originalTransactionDateIOS?: number;
  originalTransactionIdentifierIOS?: string;
  verificationResultIOS?: string;
  appAccountToken?: string;

  // Android
  purchaseStateAndroid?: PurchaseStateAndroid;
  isAcknowledgedAndroid?: boolean;
  packageNameAndroid?: string;
  developerPayloadAndroid?: string;
  obfuscatedAccountIdAndroid?: string;
  obfuscatedProfileIdAndroid?: string;
  autoRenewingAndroid?: boolean;
}
```

## Event Listeners

```typescript
import {
  purchaseUpdatedListener,
  purchaseErrorListener,
} from 'react-native-iap';

// Purchase updates
const purchaseUpdateSubscription = purchaseUpdatedListener(
  async (purchase: Purchase) => {
    const receipt = purchase.transactionReceipt;
    if (receipt) {
      // Verify with server
      await finishTransaction({ purchase });
    }
  }
);

// Purchase errors
const purchaseErrorSubscription = purchaseErrorListener(
  (error: PurchaseError) => {
    console.warn('purchaseErrorListener', error);
  }
);

// Cleanup
purchaseUpdateSubscription.remove();
purchaseErrorSubscription.remove();
```

## iOS-Specific Functions

```typescript
import {
  clearTransactionIOS,
  clearProductsIOS,
  getReceiptIOS,
  getPendingPurchasesIOS,
  getPromotedProductIOS,
  buyPromotedProductIOS,
  presentCodeRedemptionSheetIOS,
  validateReceiptIos,
} from 'react-native-iap';

// Clear finished transactions
await clearTransactionIOS();

// Clear cached products
await clearProductsIOS();

// Get receipt for validation
const receipt = await getReceiptIOS();

// Get pending purchases
const pending = await getPendingPurchasesIOS();

// Handle promoted products
const promotedProduct = await getPromotedProductIOS();
if (promotedProduct) {
  await buyPromotedProductIOS();
}

// Show offer code redemption
await presentCodeRedemptionSheetIOS();
```

## Android-Specific Functions

```typescript
import {
  acknowledgePurchaseAndroid,
  consumePurchaseAndroid,
  flushFailedPurchasesCachedAsPendingAndroid,
  getPackageNameAndroid,
  isFeatureSupported,
  getBillingConfigAndroid,
} from 'react-native-iap';

// Acknowledge purchase (non-consumables, subscriptions)
await acknowledgePurchaseAndroid({ token: purchase.purchaseToken });

// Consume purchase (consumables)
await consumePurchaseAndroid({ token: purchase.purchaseToken });

// Clear failed pending purchases
await flushFailedPurchasesCachedAsPendingAndroid();

// Get package name
const packageName = getPackageNameAndroid();

// Check feature support
const supported = await isFeatureSupported('subscriptions');

// Get billing config
const config = await getBillingConfigAndroid();
```

## Subscription Status (iOS)

```typescript
import {
  getSubscriptionStatusIOS,
  getSubscriptionStatusesIOS,
} from 'react-native-iap';

// Get status for single product
const status = await getSubscriptionStatusIOS('com.app.sub_monthly');

// Get status for multiple products
const statuses = await getSubscriptionStatusesIOS();
```

## Error Handling

```typescript
import { IapIosSk2, ErrorCode } from 'react-native-iap';

try {
  await requestPurchase({ sku: 'com.app.product1' });
} catch (err) {
  if (err.code === ErrorCode.E_USER_CANCELLED) {
    // User cancelled
  } else if (err.code === ErrorCode.E_ITEM_UNAVAILABLE) {
    // Item not available
  } else if (err.code === ErrorCode.E_ALREADY_OWNED) {
    // Already owned
  } else {
    // Other error
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `E_UNKNOWN` | Unknown error |
| `E_USER_CANCELLED` | User cancelled |
| `E_ITEM_UNAVAILABLE` | Item not available |
| `E_NETWORK_ERROR` | Network error |
| `E_SERVICE_ERROR` | Store service error |
| `E_ALREADY_OWNED` | Item already owned |
| `E_REMOTE_ERROR` | Remote error |
| `E_NOT_PREPARED` | Not initialized |
| `E_NOT_ENDED` | Not ended |
| `E_DEVELOPER_ERROR` | Developer error |
| `E_BILLING_RESPONSE_JSON_PARSE_ERROR` | JSON parse error |
| `E_DEFERRED_PAYMENT` | Deferred payment |

## Complete Usage Example

```typescript
import React, { useEffect } from 'react';
import {
  withIAPContext,
  useIAP,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  ProductPurchase,
} from 'react-native-iap';

const productIds = ['com.app.product1'];
const subscriptionIds = ['com.app.sub_monthly'];

function Store() {
  const {
    connected,
    products,
    subscriptions,
    fetchProducts,
    getSubscriptions,
  } = useIAP();

  useEffect(() => {
    if (connected) {
      fetchProducts({ skus: productIds });
      getSubscriptions({ skus: subscriptionIds });
    }
  }, [connected]);

  useEffect(() => {
    const purchaseSub = purchaseUpdatedListener(
      async (purchase: ProductPurchase) => {
        await finishTransaction({ purchase, isConsumable: false });
      }
    );

    const errorSub = purchaseErrorListener((error) => {
      console.error('Purchase error:', error);
    });

    return () => {
      purchaseSub.remove();
      errorSub.remove();
    };
  }, []);

  const handlePurchase = async (sku: string) => {
    try {
      await requestPurchase({ sku });
    } catch (err) {
      console.error(err);
    }
  };

  return (/* Render products and subscriptions */);
}

export default withIAPContext(Store);
```

## Platform Differences

| Feature | iOS | Android |
|---------|-----|---------|
| Subscription offers | Introductory price, Discounts | Offer tokens, Pricing phases |
| Acknowledge | Automatic | Required within 3 days |
| Consume | finishTransaction | consumePurchaseAndroid |
| Receipt | getReceiptIOS | transactionReceipt in Purchase |
| Promoted products | Supported | Not supported |
| Offer codes | Supported | Promo codes via Play Store |


---

<!-- Source: external/storekit2-api.md -->

# StoreKit 2 API Reference

This document provides external API reference for Apple's StoreKit 2 framework.

## iOS 18+ Features

| Feature | iOS Version | Description |
|---------|-------------|-------------|
| Win-back offers | iOS 18.0 | Re-engage churned subscribers |
| `eligibleWinBackOfferIDs` | iOS 18.0 | Query win-back offer eligibility before purchase |
| Consumable transaction history | iOS 18.0 | Opt-in via `SK2ConsumableTransactionHistory` Info.plist key |
| StoreKit `Message` API | iOS 18.0 | Listener for billing issues, win-back, price increase, generic |
| UI context for purchases | iOS 18.2 | Required for proper payment sheet display |
| External purchase notice | iOS 17.4 | `ExternalPurchase.presentNoticeSheet()` |
| `appTransactionID` | iOS 18.4 | Globally unique app transaction identifier (back-deployed to iOS 15) |
| `originalPlatform` | iOS 18.4 | Original purchase platform (back-deployed to iOS 15) |
| `Transaction.offerPeriod` | iOS 18.4 | Offer period information on Transaction |
| `Transaction.advancedCommerceInfo` | iOS 18.4 | Advanced Commerce API data on Transaction |
| `Transaction.appTransactionID` | iOS 18.4 | Per-Apple-Account identifier on Transaction |
| Expanded offer codes | iOS 18.4 | Offer codes for consumables/non-consumables |
| JWS promotional offers | WWDC 2025 | New `promotionalOffer` purchase option with JWS format |
| `introductoryOfferEligibility` | WWDC 2025 | Set eligibility via purchase option |
| `SubscriptionStatus` by Transaction ID | WWDC 2025 | `status(for: transactionID:)` |

### WWDC 2025 Updates

- **SubscriptionStatus by Transaction ID**: `SubscriptionInfo.Status.status(for: transactionID:)` accepts any transaction ID, not just SKU.
- **JWS-based promotional offers**: New `promotionalOffer` purchase option with compact JWS string.
- **Introductory offer eligibility**: Override eligibility check with `introductoryOfferEligibility` purchase option.
- Both new purchase options are back-deployed to iOS 15.

## appAccountToken

A UUID that associates a purchase with a user account in your system. This property allows you to correlate App Store transactions with users in your backend.

### Important: UUID Format Requirement

**The `appAccountToken` must be a valid UUID format.** If you provide a non-UUID string (e.g., `"user-123"` or `"my-account-id"`), Apple's StoreKit will silently return `null` for this field in the transaction response.

#### Valid UUID Examples

```swift
// Valid UUIDs - these will be returned correctly
"550e8400-e29b-41d4-a716-446655440000"
"6ba7b810-9dad-11d1-80b4-00c04fd430c8"
UUID().uuidString  // Generate new UUID
```

#### Invalid Examples (Will Return null)

```swift
// Invalid - NOT UUID format, Apple returns null silently
"user-123"
"my-account-token"
"abc123"
```

### Usage in Purchase Options

```swift
let appAccountToken = UUID()
let result = try await product.purchase(options: [
    .appAccountToken(appAccountToken)
])
```

### Retrieving from Transaction

```swift
let transaction: Transaction
if let token = transaction.appAccountToken {
    // Token will only be present if a valid UUID was provided during purchase
    print("App Account Token: \(token)")
}
```

### Best Practices

1. **Generate UUIDs per user**: Create and store a UUID for each user in your system
2. **Use consistent tokens**: Use the same UUID for all purchases from the same user
3. **Server-side mapping**: Map the UUID to your internal user ID on your server
4. **Don't use user IDs directly**: Convert your user IDs to UUIDs rather than using them directly

### References

- [Apple Developer Documentation: appAccountToken](https://developer.apple.com/documentation/storekit/transaction/appaccounttoken)
- [GitHub Issue: expo-iap #128](https://github.com/hyochan/expo-iap/issues/128)

## Product

A type that describes an in-app purchase product.

### Properties

```swift
let id: String                    // The product identifier
let type: Product.ProductType     // The type of product
let displayName: String           // Localized display name
let description: String           // Localized description
let displayPrice: String          // Localized price string
let price: Decimal               // Price as decimal
let subscription: Product.SubscriptionInfo?  // Subscription details
```

### Methods

#### products(for:)

```swift
static func products(for identifiers: [String]) async throws -> [Product]
```

Fetches products from the App Store.

#### purchase(options:)

```swift
func purchase(options: Set<Product.PurchaseOption> = []) async throws -> Product.PurchaseResult
```

Initiates a purchase for this product.

## Transaction

Represents a completed purchase transaction.

### Properties

```swift
let id: UInt64                   // Unique transaction ID
let originalID: UInt64           // Original transaction ID
let productID: String            // Product identifier
let purchaseDate: Date           // When the purchase occurred
let expirationDate: Date?        // Subscription expiration date
let revocationDate: Date?        // When the transaction was revoked
let isUpgraded: Bool             // Whether this subscription was upgraded
let environment: AppStore.Environment  // sandbox or production
```

### Methods

#### currentEntitlements

```swift
static var currentEntitlements: Transaction.Entitlements
```

A sequence of the customer's current entitlements.

#### latest(for:)

```swift
static func latest(for productID: String) async -> VerificationResult<Transaction>?
```

Gets the latest transaction for a product.

#### finish()

```swift
func finish() async
```

Marks the transaction as finished.

## AppStore

Provides access to App Store functionality.

### Methods

#### sync()

```swift
static func sync() async throws
```

Syncs transactions with the App Store.

#### showManageSubscriptions(in:)

```swift
static func showManageSubscriptions(in scene: UIWindowScene) async throws
```

Shows the subscription management UI.

#### beginRefundRequest(for:in:)

```swift
static func beginRefundRequest(for transactionID: UInt64, in scene: UIWindowScene) async throws -> Transaction.RefundRequestStatus
```

Begins a refund request for a transaction.

## Win-Back Offers (iOS 18+)

Win-back offers are a new offer type to re-engage churned subscribers.

### Automatic Presentation

StoreKit Message automatically presents win-back offers when a user is eligible:

```swift
// Message reason for win-back offers
StoreKit.Message.Reason.winBackOffer
```

### Manual Application

Apply a win-back offer during purchase:

```swift
let product: Product
let winBackOffer: Product.SubscriptionOffer

let result = try await product.purchase(options: [
    .winBackOffer(winBackOffer)
])
```

### Checking Eligibility

Discover eligible win-back offers before purchase via `Product.SubscriptionInfo.eligibleWinBackOfferIDs` (iOS 18+):

```swift
let status = try await product.subscription?.status.first
guard let renewalInfo = try status?.renewalInfo.payloadValue else { return }

// iOS 18+: offer IDs the current Apple Account is eligible for
let eligibleIDs = renewalInfo.eligibleWinBackOfferIDs
let eligibleOffers = (product.subscription?.promotionalOffers ?? []).filter {
    $0.type == .winBack && eligibleIDs.contains($0.id ?? "")
}
```

### RenewalInfo

Win-back offer information is available in renewal info:

```swift
let renewalInfo: Product.SubscriptionInfo.RenewalInfo

// Check if win-back offer is applied to next renewal
if renewalInfo.renewalOfferType == .winBack {
    // Win-back offer will be applied
}
```

## UI Context for Purchases (iOS 18.2+)

Beginning in iOS 18.2, purchase methods require a UI context to properly display payment sheets:

```swift
// iOS/iPadOS/tvOS/visionOS: UIViewController
let result = try await product.purchase(confirmIn: viewController)

// macOS: NSWindow
let result = try await product.purchase(confirmIn: window)

// watchOS: No UI context required
```

> **OpenIAP Note**: UI context is handled automatically in OpenIAP using the active window scene.

## AppTransaction Updates (iOS 18.4+)

```swift
let appTransaction = try await AppTransaction.shared

// New in iOS 18.4 (back-deployed to iOS 15)
let appTransactionID = appTransaction.appTransactionID  // Globally unique per Apple Account
let originalPlatform = appTransaction.originalPlatform   // Original purchase platform
```

### appTransactionID

- Globally unique identifier for each Apple Account that downloads your app
- Remains consistent across redownloads, refunds, repurchases, and storefront changes
- Works with Family Sharing (each family member gets unique ID)
- Back-deployed to iOS 15

## Transaction Updates (iOS 18.4+)

iOS 18.4 added three new read-only properties to `Transaction` (not just `AppTransaction`):

```swift
let transaction: Transaction

// iOS 18.4+ — all back-deployed to iOS 15
let txAppTransactionID = transaction.appTransactionID        // Apple Account identifier
let offerPeriod = transaction.offerPeriod                    // Offer.Period?
let advancedCommerce = transaction.advancedCommerceInfo      // AdvancedCommerceInfo?
```

| Property | Type | Notes |
|----------|------|-------|
| `appTransactionID` | String | Mirrors AppTransaction's identifier |
| `offerPeriod` | Offer.Period? | Phase of the promotional/intro offer |
| `advancedCommerceInfo` | AdvancedCommerceInfo? | Present for Advanced Commerce SKUs only |

## Advanced Commerce API (iOS 18.4+)

For apps with large product catalogs:

```swift
// Check if product has advanced commerce info
if let advancedInfo = product.advancedCommerceInfo {
    // Handle large catalog monetization
}
```

## StoreKit Message API (iOS 18+)

Listen for App Store–generated messages (billing issues, win-back offers, price increases, generic).

```swift
// Somewhere near app launch
Task {
    for await message in Message.messages {
        switch message.reason {
        case .billingIssue:
            // Show UI when user is ready; display from message.display(in:)
            break
        case .winBackOffer:
            break
        case .priceIncrease:
            break
        case .generic:
            break
        @unknown default:
            break
        }
    }
}
```

| Reason | Trigger |
|--------|---------|
| `.billingIssue` | User has an unresolved billing problem on a subscription |
| `.priceIncrease` | Price change that requires user consent |
| `.winBackOffer` | User is eligible for a win-back offer |
| `.generic` | All other system-initiated messages |

> **OpenIAP Note**: To be surfaced by the cross-platform event layer — see `event.graphql` additions for message events.

## SubscriptionStatus by Transaction ID (WWDC 2025)

```swift
// WWDC 2025: look up status using any transactionID, not just a SKU
let status = try await Product.SubscriptionInfo.Status.status(for: transactionID)
```

## Consumable Transaction History (iOS 18+)

By default, `Transaction.all` omits finished consumables. Opt in by adding this key to **Info.plist**:

```xml
<key>SK2ConsumableTransactionHistory</key>
<true/>
```

With the key set, finished consumable transactions are included in `Transaction.all` and `Transaction.currentEntitlements`.

## External Purchase Support (iOS 18.2+)

### Present External Purchase Notice

```swift
// Check if external purchase notice can be presented
if await ExternalPurchase.canPresent {
    let result = try await ExternalPurchase.presentNoticeSheet()
    switch result {
    case .continue:
        // User wants to continue to external purchase
    case .dismissed:
        // User dismissed the notice
    }
}
```

### Present External Purchase Link

```swift
let result = try await ExternalPurchase.open(url: externalURL)
```

> **OpenIAP Note**: `presentExternalPurchaseNoticeSheetIOS` and `presentExternalPurchaseLinkIOS` are available in the iOS package.


---

# 📁 PROJECT STRUCTURE

```
openiap/
├── packages/
│   ├── apple/        # iOS/macOS StoreKit 2 (Swift)
│   │   └── Sources/
│   │       ├── Models/      # Official types
│   │       ├── Helpers/     # Internal helpers
│   │       └── OpenIapModule.swift
│   ├── google/       # Android Play Billing (Kotlin)
│   │   └── openiap/src/main/
│   │       ├── java/dev/hyo/openiap/
│   │       └── Types.kt     # AUTO-GENERATED
│   ├── gql/          # GraphQL schema & type generation
│   └── docs/         # Documentation site
├── knowledge/        # Shared knowledge base
│   ├── internal/     # Project philosophy
│   └── external/     # External API reference
└── scripts/agent/    # RAG agent scripts
```

## Key Reminders

- **packages/apple**: iOS functions MUST end with `IOS` suffix
- **packages/google**: DO NOT add `Android` suffix (it's Android-only package)
- **packages/gql**: Types.kt and Types.swift are AUTO-GENERATED, never edit directly
- **Cross-platform functions**: NO platform suffix

