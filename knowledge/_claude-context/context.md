# OpenIAP Project Context

> **Auto-generated for Claude Code**
> Last updated: 2026-08-08T02:27:07.223Z
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

**Exception**: Generated GraphQL operation names and generated handler fields keep
the schema name exactly, including `Android` when the operation is Android-only.
For example, `MutationHandlers.isBillingProgramAvailableAndroid` must
be wired in `packages/google` because it is generated from
`packages/gql/src/api-android.graphql`; the hand-written implementation it
delegates to should still be suffix-free, such as
`isBillingProgramAvailable()`.

Only use `Android` suffix for types that are part of a cross-platform API (e.g.,
`ProductAndroid`, `PurchaseAndroid` that contrast with iOS types), or for
generated GraphQL operation/handler identifiers that must match the schema.

## Platform-Specific Field Naming (CRITICAL)

> **This is the most commonly violated rule. Pay extra attention.**

### GraphQL Input Types (API Fields)

Fields inside platform-specific input types do NOT need platform suffix (the type name already indicates the platform):

```graphql
# CORRECT - Fields inside AndroidProps don't need Android suffix
input RequestPurchaseAndroidProps {
  skus: [String!]! # Cross-platform, no suffix
  offerToken: String # No suffix - already in Android type
  isOfferPersonalized: Boolean # No suffix - already in Android type
  obfuscatedAccountId: String # No suffix - already in Android type
  obfuscatedProfileId: String # No suffix - already in Android type
  developerBillingOption: DeveloperBillingOptionParamsAndroid # Type has suffix (cross-platform type)
}

# INCORRECT - Redundant Android suffix inside Android-specific type
input RequestPurchaseAndroidProps {
  offerTokenAndroid: String # ❌ Redundant - type already indicates Android
  isOfferPersonalizedAndroid: Boolean # ❌ Redundant - type already indicates Android
}
```

### Why This Matters

1. **Parent type context**: `RequestPurchaseAndroidProps` already indicates Android
2. **Cleaner API**: `google: { offerToken: "..." }` is cleaner than `google: { offerTokenAndroid: "..." }`
3. **Type names still use suffix**: Cross-platform types like `DeveloperBillingOptionParamsAndroid` keep the suffix

### Field Suffix Rules

| Field Location                 | Suffix Required?          | Example                                                       |
| ------------------------------ | ------------------------- | ------------------------------------------------------------- |
| Inside Android-only input type | NO                        | `offerToken` in `RequestPurchaseAndroidProps`                 |
| Inside iOS-only input type     | NO                        | `appAccountToken` in `RequestPurchaseIosProps`                |
| Cross-platform type            | YES for platform-specific | `nameAndroid` in `ProductAndroid`                             |
| Cross-platform type reference  | YES                       | `developerBillingOption: DeveloperBillingOptionParamsAndroid` |
| Internal implementation        | NO (not API)              | `val offerToken` in Kotlin data class                         |

### Store-Specific Fields (Amazon / Horizon)

A platform type such as `PurchaseAndroid` can carry data that only one *store*
provides (Google Play, Amazon Appstore, Horizon). Rules:

- The `store: IapStore` discriminator identifies the store; store-exclusive
  fields are nullable and null on every other store.
- When a field only exists for one store, suffix it with the store name:
  `userIdAmazon`, `userMarketplaceAmazon` in `PurchaseAndroid`. Do NOT stack
  suffixes (`amazonUserIdAndroid` is wrong).
- Fields sourced from Play Billing keep the plain `Android` suffix for
  backward compatibility (`signatureAndroid`, `isSuspendedAndroid`), even
  though other stores return null for them.
- When several store fields travel together as one concept, prefer a dedicated
  store-named type with clean inner fields
  (`RequestVerifyPurchaseWithIapkitAmazonProps.userId`).
- Where react-native-iap defined a legacy name for the same datum, keep that
  exact name (`userIdAmazon`) so migration stays mechanical.

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
fetchProducts();
requestPurchase();
getAvailablePurchases();
finishTransaction();
verifyPurchase();
initConnection();
endConnection();
getActiveSubscriptions();
hasActiveSubscriptions();
deepLinkToSubscriptions();
getStorefront();
```

## Action Prefix Rules

| Prefix         | When to Use                      | Examples                                                      |
| -------------- | -------------------------------- | ------------------------------------------------------------- |
| `get`          | Synchronous data retrieval       | `getReceiptDataIOS`, `getPackageName`                         |
| `fetch`        | Async data retrieval from server | `fetchProducts`                                               |
| `request`      | User-initiated async operations  | `requestPurchase`                                             |
| `clear`        | Remove/reset data                | `clearTransactionIOS`, `clearProductsIOS`                     |
| `is/has`       | Boolean checks                   | `isEligibleForIntroOfferIOS`, `hasActiveSubscriptions`        |
| `show/present` | Display UI                       | `showManageSubscriptionsIOS`, `presentCodeRedemptionSheetIOS` |
| `begin`        | Start a multi-step process       | `beginRefundRequestIOS`                                       |
| `finish/end`   | Complete a process               | `finishTransaction`, `endConnection`                          |
| `init`         | Initialize resources             | `initConnection`                                              |
| `verify`       | Validate data                    | `verifyPurchase`                                              |
| `acknowledge`  | Confirm receipt (Android)        | `acknowledgePurchase`                                         |
| `consume`      | Mark as consumed (Android)       | `consumePurchase`                                             |

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
{
  id: "request-products";
}
{
  id: "fetch-products";
}

// INCORRECT
{
  id: "requestproducts";
}
{
  id: "fetchProducts";
}
```

## Variable Naming

```typescript
// CORRECT - camelCase for variables
const productId: string;
const isSubscription: boolean;
const purchaseToken: string;

// INCORRECT
const product_id: string; // No snake_case
const IsSubscription: boolean; // No PascalCase for variables
```


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
│   ├── apple/         # iOS/macOS library (Swift)
│   ├── kit/           # Hosted receipt-validation SaaS (Fly.io app)
│   └── mcp-server/    # IAPKit MCP server (hosted at kit.openiap.dev/mcp)
├── plugins/
│   └── openiap/       # Codex + Claude Code plugin (skills + MCP config)
├── libraries/         # Framework SDK implementations
│   ├── react-native-iap/  # React Native (npm, Yarn 3, Nitro Modules)
│   ├── expo-iap/          # Expo (npm, Bun, Expo Modules)
│   ├── flutter_inapp_purchase/  # Flutter (pub.dev, Dart)
│   ├── godot-iap/         # Godot 4.x (GitHub Release, GDScript)
│   ├── kmp-iap/           # Kotlin Multiplatform (Maven Central)
│   └── maui-iap/          # .NET MAUI / C# (NuGet)
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
- Generates types for: TypeScript, Swift, Kotlin, Dart, GDScript, C#
- **RULE:** `Types.swift` / `Types.kt` are AUTO-GENERATED. Never edit directly.

```bash
# Regenerate all types
cd packages/gql && bun run generate
```

Generated files:

- TypeScript: `src/generated/types.ts`
- Swift: `src/generated/Types.swift`
- Kotlin: `src/generated/Types.kt`
- Dart: `src/generated/types.dart`
- GDScript: `src/generated/types.gd`
- C#: `src/generated/Types.cs`

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

**Purpose:** Android billing implementations for Google Play, Meta Horizon, and
Amazon Appstore. Vega OS is a separate JavaScript/Kepler runtime adapter, not an
Android Gradle flavor.

Directory structure:

```
openiap/src/
├── main/java/dev/hyo/openiap/       # Shared contracts and store facade
│   ├── OpenIapProtocol.kt
│   ├── Types.kt                     # AUTO-GENERATED - DO NOT EDIT
│   ├── helpers/
│   ├── listener/
│   └── store/
├── play/java/dev/hyo/openiap/       # Google Play Billing implementation
├── horizon/java/dev/hyo/openiap/    # Meta Horizon implementation
└── amazon/java/dev/hyo/openiap/     # Amazon Appstore implementation
```

### packages/docs

**Purpose:** Documentation site for openiap.dev.

- Built with React + Vite
- Deployed to Vercel
- Contains API reference and guides

## Dependency Flow

### IAPKit webhook boundary

The only allowed webhook direction is from a store into IAPKit:

```text
Apple ASN v2 / Google RTDN ──► IAPKit state
```

IAPKit must not expose a server-to-mobile webhook stream, SSE endpoint,
WebSocket, push relay, or long-poll lifecycle feed. Mobile packages and
framework libraries use bounded request/response verification and scoped reads.
If an app needs immediate push delivery, its authenticated backend owns that
policy and transport.

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
public final class OpenIapModule: NSObject, OpenIapModuleProtocol {
    public static let shared = OpenIapModule()

    private override init() {
        super.init()
    }

    public func fetchProducts(
        _ params: ProductRequest
    ) async throws -> FetchProductsResult
}
```

### Android Module (Kotlin)

```kotlin
// OpenIapModule.kt
class OpenIapModule(
    private val context: Context
) : OpenIapProtocol {
    override val fetchProducts: QueryFetchProductsHandler = { params ->
        when (params.type ?: ProductQueryType.InApp) {
            ProductQueryType.InApp -> FetchProductsResultProducts(emptyList())
            ProductQueryType.Subs -> FetchProductsResultSubscriptions(emptyList())
            ProductQueryType.All -> FetchProductsResultAll(emptyList())
        }
    }
}
```

## Error Handling Pattern

### Swift

```swift
public func fetchProducts(
    _ params: ProductRequest
) async throws -> FetchProductsResult {
    guard !params.skus.isEmpty else {
        let error = makePurchaseError(code: .emptySkuList)
        emitPurchaseError(error)
        throw error
    }
    // ...
}
```

### Kotlin

```kotlin
if (!billingClient.isReady) throw OpenIapError.NotPrepared
if (params.skus.isEmpty()) throw OpenIapError.EmptySkuList

// Preserve the native diagnostic for wrapper SDKs.
throw OpenIapError.PurchaseFailed(debugMessage = billingResult.debugMessage)
```

## Async Pattern

### Swift (async/await)

```swift
// CORRECT - Use async/await
public func fetchProducts(_ params: ProductRequest) async throws -> FetchProductsResult

// INCORRECT - Don't use completion handlers
public func fetchProducts(
    _ params: ProductRequest,
    completion: @escaping (Result<FetchProductsResult, Error>) -> Void
)
```

### Kotlin (Coroutines)

```kotlin
// CORRECT - Use suspend functions
suspend fun fetchProducts(params: ProductRequest): FetchProductsResult

// INCORRECT - Don't use callbacks
fun fetchProducts(
    params: ProductRequest,
    callback: (Result<FetchProductsResult>) -> Unit
)
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

### Keep Single-Use Helpers Local

Private helper functions used by only one function should be declared inside
that function so their scope matches their real ownership. Keep helpers at file
scope only when they are exported, reused by multiple call sites, or need a
stable top-level identity for tests, recursion, or platform registration.

```typescript
// ✅ CORRECT - helper is owned by getResolved()
function getResolved(): ResolvedModule {
    function getExpectedModuleName(): NativeModuleName {
        return isVegaOS() ? 'ExpoIapVega' : 'ExpoIap';
    }

    const expectedName = getExpectedModuleName();
    return resolve(expectedName);
}

// ❌ INCORRECT - helper has only one call site but lives at file scope
function getExpectedModuleName(): NativeModuleName {
    return isVegaOS() ? 'ExpoIapVega' : 'ExpoIap';
}

function getResolved(): ResolvedModule {
    const expectedName = getExpectedModuleName();
    return resolve(expectedName);
}
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
 * @param request - Product identifiers and product type to fetch
 * @returns Products matching the requested query type
 * @throws {ProductNotFoundError} If no products match the given IDs
 *
 * @example
 * const products = await fetchProducts({
 *   skus: ['com.app.premium', 'com.app.pro'],
 *   type: 'in-app',
 * });
 */
async function fetchProducts(
    request: ProductRequest
): Promise<FetchProductsResult> {
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
# From the monorepo root: regenerate all languages and sync manifest targets
cd packages/gql && bun run generate
```

### Version Management

Version is managed in `openiap-versions.json`:

```json
{
  "spec": "2.4.2",
  "google": "2.5.0",
  "apple": "2.4.2"
}
```

**To update GQL types:**

1. Edit the canonical schema under `packages/gql/src/`.
2. Run `cd packages/gql && bun run generate`.
3. Run `cd packages/apple && swift test` to verify compatibility.

`"spec"` must always equal the lower semantic version of `"google"` and
`"apple"`. Do not bump or edit it directly in feature work or for type
regeneration. Native version writers derive the floor atomically when Google or
Apple changes; sync only verifies and propagates that value. Release-state,
docs, and parity audits reject drift.

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

| Swift Function Changed | ObjC Bridge Required       |
| ---------------------- | -------------------------- |
| `OpenIapModule.swift`  | `OpenIapModule+ObjC.swift` |

**Verification**: After updating, run:

```bash
swift build  # Verifies ObjC bridge compiles
```

---

## SDK Parity Checklist (CRITICAL — prevents "declared but not implemented")

### API version annotations

For newly exposed platform features, public schema and API documentation must
name the OpenIAP versions first and the upstream SDK requirement second. Use the
format `OpenIAP Spec <version> / openiap-google <version> (requires Play Billing
<version>+)`. Upstream-only labels such as `Billing 9.1.0+` do not tell OpenIAP
consumers which library release contains the API.

When the GraphQL schema in [`packages/gql`](../../packages/gql) adds or changes an API, the regenerated `types.*` files **declare** the handler but do not **implement** it. Every wrapper library must wire the new API end-to-end or users will see silent nulls, phantom interfaces (GitHub issue #104), or `UnsupportedOperationException` at runtime.

The mechanical guardrail for this checklist is:

```bash
bun run audit:parity
```

This mirrors CI's **Audit SDK Parity** job and is intentionally run by the
pre-commit hook on every commit. Do not bypass it for docs/version-only changes:
the audit also checks generated docs version metadata and the Godot Android
GDAP dependency pin against `openiap-versions.json`, so release-version drift can
break CI even when no SDK source code changed.

This audit treats `libraries/expo-iap/example` as the non-Godot example SSOT
and fails when:

- a new non-Godot library appears under `libraries/` without explicit parity
  coverage or exclusion
- an Expo example route or product ID is not represented by the other SDK
  examples and native Apple/Google examples
- a GraphQL Query/Mutation/Subscription operation is added or removed without
  updating the operation parity registry
- an Android-relevant registry operation is not wired in every
  `packages/google` flavor handler bundle (play / horizon / amazon
  `OpenIapModule.kt`) — the generated resolver interfaces stay green on their
  own because new bundle fields default to `null`
- generated types or shared TS runtime helpers drift from `packages/gql`
- framework/package version metadata or Godot Android GDAP dependencies drift
  from the package/version SSOTs

Run it after type generation, after version syncs, and before opening a PR for
SDK/API/example/docs-version changes. If it fails for a newly introduced
operation or feature, update the missing SDK bridge/example/test coverage first,
then update the parity registry in
[`scripts/audit-non-godot-parity.mjs`](../../scripts/audit-non-godot-parity.mjs).
If it fails for Godot GDAP dependency drift, run
`./libraries/godot-iap/scripts/write-gdap.sh` and commit the regenerated
`libraries/godot-iap/addons/godot-iap/android/GodotIap.gdap`.

### Generated payload preservation

Generated payload types are additive contracts. Handwritten native and framework
bridges must preserve every canonical field rather than reconstructing
`Purchase`, `ActiveSubscription`, `RenewalInfoIOS`, or verification results from
local allowlists. Prefer the generated `toJson` / `fromJson` or canonical
serializer, recursively normalize platform dictionaries and `NSNull`, and add
only documented transport-specific fields around that generated payload.

Map canonical fields from their same-named native source before applying a
compatibility fallback. In particular, an orderless Google Play purchase keeps
`transactionId` null instead of copying `purchaseToken`, while alternative-store
deferred plan changes remain active purchases and expose
`pendingPurchaseUpdateAndroid` plus the current plan. Listener diagnostics must
never include raw purchase payloads, receipts, or tokens.

`bun run audit:parity` compares generated payload fields with the handwritten
bridges and exercises source-first mappings and round trips. When a generated
payload field or bridge changes, update the real platform mapping and a focused
regression fixture before extending the audit expectation.

### The bug pattern

A symptom like "interface exists in `types.dart` / `types.ts` / `Types.kt` but calling it does nothing / throws" means one or more of these layers is missing:

```text
GraphQL schema ─► generated types ─► public API ─► native bridge ─► core module impl
    (SSOT)        (auto-generated)  (hand-written) (hand-written)   (shared Swift/Kotlin)
                        ▲                 ▲              ▲
                        │                 │              │
                   must match       must be exported   must dispatch
```

### Per-library completion checklist

For every new/changed handler in the generated types, verify **all five** of these per target library before considering the change shippable:

| Library                    | 1. Type declared                                                    | 2. Public API exposed                                                                                                                                                                                                                              | 3. Platform bridge                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 4. Wired into handlers bundle                                                                                          | 5. Test coverage                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **react-native-iap**       | `src/types.ts` (generated)                                          | `src/index.ts` export (Nitro or composed TS)                                                                                                                                                                                                       | `ios/HybridRnIap.swift` (iOS), `android/.../HybridRnIap.kt` (Android)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Not required (flat exports)                                                                                            | Mock stub in all 4 `mockIap` objects in `__tests__/` (per memory)                                                                                                                                                                                                                                                                                                                                  |
| **expo-iap**               | `src/types.ts` (generated)                                          | `src/modules/ios.ts` / `android.ts` export, re-exported from `src/index.ts`                                                                                                                                                                        | `ios/ExpoIapModule.swift` `AsyncFunction`, `android/.../ExpoIapModule.kt`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Not required (flat exports)                                                                                            | `src/modules/__tests__/*.test.ts`                                                                                                                                                                                                                                                                                                                                                                  |
| **flutter_inapp_purchase** | `lib/types.dart` (generated)                                        | getter on `FlutterInappPurchase` in `lib/flutter_inapp_purchase.dart`                                                                                                                                                                              | `case "<name>":` in `ios/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterInappPurchasePlugin.swift` and `macos/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterInappPurchasePlugin.swift`, Android plugin `onMethodCall`                                                                                                                                                                                                                                                                                                                                                   | `queryHandlers` / `mutationHandlers` / `subscriptionHandlers` bundles near the bottom of `flutter_inapp_purchase.dart` | Mock + test in `test/ios_methods_test.dart` (and the `errors_unit_test.dart` error-mapping test)                                                                                                                                                                                                                                                                                                   |
| **kmp-iap**                | `library/src/commonMain/.../openiap/Types.kt` (generated interface) | exposed via `KmpInAppPurchase` / `kmpIapInstance`                                                                                                                                                                                                  | `library/src/iosMain/.../InAppPurchaseIOS.kt` — must call `openIapModule.<name>WithCompletion { ... }`, **never** `throw UnsupportedOperationException`                                                                                                                                                                                                                                                                                                                                                                                                                                              | Not required (interface dispatch)                                                                                      | `library/src/commonTest/` if testable cross-platform                                                                                                                                                                                                                                                                                                                                               |
| **godot-iap**              | `addons/godot-iap/types.gd` (generated)                             | public `snake_case` function in `addons/godot-iap/godot_iap.gd`                                                                                                                                                                                    | `ios-gdextension/Sources/GodotIap/GodotIap.swift` (iOS), `android/src/main/java/.../GodotIap.java` (Android)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Not required                                                                                                           | `make test` covers generated types, API surface, native-extension loading, envelope parsing, and public GDScript behavior; physical devices remain required for store purchases                                                                                                                                                                                                                     |
| **maui-iap**               | `src/OpenIap.Maui/Types.cs` (generated)                             | `OpenIap.QueryResolver` / `MutationResolver` interfaces in `Types.cs`; `IOpenIap` adds the native purchase-listener contract; static facade is `OpenIap.Maui.OpenIapClient`; app-facing IAPKit helpers are exposed via `OpenIapClient.KitApi(...)` | Android: `OpenIapMauiModule.kt` in `libraries/maui-iap/android/openiap/` (JSON-shaped Java facade over `packages/google`), bound by `OpenIap.Maui.Bindings.Android.csproj`, consumed by `Platforms/Android/OpenIapAndroid.cs`. Google Billing / Play Services / Gson / AndroidX / Kotlin dependencies must stay NuGet `PackageReference`s, not fat-bundled AARs. iOS / macCatalyst: existing `OpenIapModule+ObjC.swift` bridge in `packages/apple`, bound by hand-written `OpenIap.Maui.Bindings.iOS/ApiDefinition.cs`, consumed by `Platforms/iOS/OpenIapIOS.cs` (+ subclass `OpenIapMacCatalyst`). | Not required (interface dispatch)                                                                                      | OpenIap.Maui 2.x targets supported .NET 10 only. The example app `libraries/maui-iap/example/OpenIap.Maui.Example` builds for net10.0-android / net10.0-ios / net10.0-maccatalyst; package CI builds net10 shared, Android, iOS, and macCatalyst TFMs; xUnit covers generated serialization, error mapping, and the `KitApiClient` HTTP contract (manual device testing remains for purchase flow) |

### Platform suffix rule (who needs what)

The suffix on the handler name tells you which native bridges are required:

- **`…IOS` suffix** → iOS bridge only. Non-iOS platforms should return the type's zero value (`false`, `null`, empty list) or throw a documented `PlatformException` for void ops. **Do not** wire into Android bridges.
- **`…Android` suffix** → Android bridge only. Same rule in reverse.
- **No suffix** → both iOS and Android bridges required.

Wiring an iOS-suffixed method into an Android bridge is a bug — the earlier audit agents produced false positives like this.

### Common failure modes observed in the codebase

1. **Phantom interface** (GitHub issue #104, Flutter `beginRefundRequestIOS` pre-2026-04): generated type exists, nothing else does. Users see an uncallable interface.
2. **`UnsupportedOperationException` stub** (KMP pattern): method declared, iOS impl deliberately throws with "not implemented in OpenIAP". Usually a stale stub — the ObjC bridge method may already exist. Always `grep OpenIapModule+ObjC.swift` for `<name>With*` before assuming the bridge is missing.
3. **Channel-name drift** (Flutter `getAppTransactionIOS` pre-2026-04): Dart calls `_channel.invokeMethod('getAppTransaction')` but the Swift plugin only handles `"getAppTransactionIOS"` (or vice versa). Mocked tests passed because the test intercepted the wrong name too.
4. **Handler bundle omission** (Flutter): Dart getter exists, Swift bridge exists, but the new handler is not listed in `queryHandlers` / `mutationHandlers`. Consumers using the generated handler bundle (e.g., for cross-platform dispatch) silently miss the API.

### Audit command for a new handler

After regenerating types, run for each library:

```bash
# Replace <name> with the new handler name (camelCase, e.g., beginRefundRequestIOS)
NAME=<name>

echo "=== Type declared? ==="
rg -n "$NAME" \
  libraries/*/lib/types.dart \
  libraries/*/src/types.ts \
  libraries/kmp-iap/library/src/commonMain/kotlin \
  libraries/*/addons/godot-iap/types.gd

echo "=== Public API exposed? ==="
rg -n "^export (const|async function|function) $NAME\b|get $NAME\b|func $NAME\b|snake_case equivalent" libraries/

echo "=== Native bridge? ==="
rg -n "\"$NAME\"|\.$NAME\b" libraries/*/ios libraries/*/android libraries/*/ios-gdextension

echo "=== Wired into handlers bundle? (Flutter only) ==="
rg -n "$NAME:" libraries/flutter_inapp_purchase/lib/flutter_inapp_purchase.dart

echo "=== Throws stub? ==="
rg -n "UnsupportedOperationException.*$NAME" libraries/
```

Any empty result for a layer that _should_ have the handler (per the suffix rule) is a gap that must be filled before merging.

---

## Google Package (packages/google)

### Required Pre-Work (Google)

Before writing or editing anything, **ALWAYS** review:

- [`packages/google/CONVENTION.md`](../../packages/google/CONVENTION.md)

### Project Layout

```text
openiap/
├── src/
│   ├── main/           # Store-agnostic code shared by every flavor
│   ├── play/           # Play Store specific code
│   ├── horizon/        # Meta Horizon specific code
│   └── amazon/         # Amazon Appstore / Fire OS specific code
├── Example/            # Sample application
└── scripts/            # Automation
```

### Build Flavors

The Google package supports **three build flavors**:

| Flavor           | Store             | API                                | Description              |
| ---------------- | ----------------- | ---------------------------------- | ------------------------ |
| `play` (default) | Google Play Store | Google Play Billing Library        | Standard Android billing |
| `horizon`        | Meta Quest Store  | Meta Horizon Billing Compatibility | VR/Quest billing         |
| `amazon`         | Amazon Appstore   | Amazon Appstore SDK                | Fire OS billing          |

**Flavor-specific source directories:**

- `src/main/` - Store-agnostic code shared by every flavor
- `src/play/` - Play Store specific implementations
- `src/horizon/` - Meta Horizon specific implementations
- `src/amazon/` - Amazon Appstore specific implementations

### Critical Rules

1. **DO NOT edit generated files**: `openiap/src/main/java/dev/hyo/openiap/Types.kt` is auto-generated
2. Put reusable Kotlin helpers in `openiap/src/main/java/dev/hyo/openiap/utils/`
3. Run `cd packages/gql && bun run generate` from the monorepo root
4. **Test ALL THREE flavors** when making changes to shared code
5. **Never persist local receipt-to-SKU aliases as entitlement identity**:
   store-specific adapters may cache data for performance or correlate an
   in-flight request by request ID, but they must not permanently rewrite
   `productId`, `currentPlanId`, or entitlement state from app-local alias
   storage. Subscription and entitlement state must come from the store response,
   restore/query APIs, or Kit/server verification so client state cannot drift
   from server truth.

### Build Commands

```bash
# Play flavor (default)
./gradlew :openiap:compilePlayDebugKotlin
./gradlew :openiap:assemblePlayDebug

# Horizon flavor
./gradlew :openiap:compileHorizonDebugKotlin
./gradlew :openiap:assembleHorizonDebug

# Amazon / Fire OS flavor
./gradlew :openiap:compileAmazonDebugKotlin
./gradlew :openiap:assembleAmazonDebug

# Run tests (all flavors)
./gradlew :openiap:test
```

### Version Compatibility

| Flavor  | Billing Library               | Version                    |
| ------- | ----------------------------- | -------------------------- |
| Play    | Google Play Billing           | 9.1.0                      |
| Horizon | horizon-billing-compatibility | 2.0.0 (GPB 7.0 compatible) |
| Amazon  | Amazon Appstore SDK           | 3.0.9                      |

**CRITICAL**: `src/main/` is also compiled by the Amazon flavor, whose SDK is
not Google Billing-compatible. Keep native store SDK types and calls out of
`src/main/`; put them in the matching flavor source set.

Horizon implements the **Billing 7.0 API**, not 8.x/9.x. Code intentionally
shared only between the Play and Horizon implementations must stay within the
following compatibility boundary:

**Safe APIs (exist in both 7.0 and 9.x):**

- `queryProductDetailsAsync()`, `launchBillingFlow()`
- `acknowledgePurchase()`, `consumeAsync()`, `queryPurchasesAsync()`

**DO NOT use in shared code (8.x/9.x only):**

- `enableAutoServiceReconnection()`
- Product-level status codes
- One-time products with multiple offers
- Suspended-subscription queries and product-level replacement parameters
- Billing Programs APIs, including External Payments and Billing Choice

Keep those APIs in `src/play/`. Billing Choice information, dialogs, choice
screen types, and developer-provided billing fields require Play Billing 9.1.0.

### Horizon-Specific APIs

Meta Horizon has different APIs from Google Play:

| OpenIAP API         | Play Implementation | Horizon Implementation        |
| ------------------- | ------------------- | ----------------------------- |
| `verifyPurchase`    | Play Developer API  | Meta S2S `verify_entitlement` |
| `getAvailableItems` | N/A                 | Horizon catalog API           |
| `IapStore`          | `IapStore.Play`     | `IapStore.Horizon`            |

**Horizon-specific types in GraphQL:**

- `VerifyPurchaseHorizonOptions` - Horizon verification parameters
- `VerifyPurchaseResultHorizon` - Horizon verification result

### Amazon-Specific APIs

Amazon Appstore SDK is not Google Billing-compatible. The `amazon` source set
maps OpenIAP product queries, purchases, restore calls, and fulfillment to
`PurchasingService` / `PurchasingListener`.

- Call `PurchasingService.enablePendingPurchases()` before starting a purchase
  so pending Amazon Kids approvals can be delivered.
- Finish fulfilled transactions with
  `PurchasingService.notifyFulfillment(receiptId, FULFILLED)`.
- Appstore SDK 3.0.9 adds `EXISTING_PURCHASE` and `NOT_ELIGIBLE` fulfillment
  results and opt-in add-on subscriptions for selected partners. Do not expose
  those as generally available OpenIAP features without an end-to-end contract.

### Updating openiap-gql Types and Derived Version

1. Update the canonical schema without directly changing the `spec` version.
   Native version writers keep `spec` equal to the lower semantic version of
   `google` and `apple`; sync fails instead of silently repairing drift.
2. Run `cd packages/gql && bun run generate` from the monorepo root.
3. Compile ALL THREE flavors to verify:
   ```bash
   ./gradlew :openiap:compilePlayDebugKotlin
   ./gradlew :openiap:compileHorizonDebugKotlin
   ./gradlew :openiap:compileAmazonDebugKotlin
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

| Change in shared package                 | Google/Apple bump                              | Downstream bump                                         |
| ---------------------------------------- | ---------------------------------------------- | ------------------------------------------------------- |
| Add optional field to a type             | minor                                          | minor                                                   |
| Add a new enum case                      | major (Swift/Kotlin exhaustive switches break) | minor                                                   |
| `object` → `data class` / renamed method | major                                          | minor (downstream pins to new major; own API unchanged) |

Release order MUST be: shared packages first (so downstream libraries
can depend on the new version), then framework libraries in any order.

---

## GQL Package (packages/gql)

### Required Pre-Work

Before writing or editing anything, **ALWAYS** review:

- [`packages/gql/CONVENTION.md`](../../packages/gql/CONVENTION.md)

### Code Generation Architecture

The GQL package uses two guarded generation lanes over one schema inventory:

```text
GraphQL Schema (src/*.graphql)
         ├──► graphql-codegen + guarded TypeScript AST post-processing
         │                         └──► src/generated/types.ts
         └──► Parser → Transformer → IR → Language Plugins
                                      └──► Swift/Kotlin/Dart/GDScript/C#
                                                     ↓
                                          generated-sync-manifest.mjs
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
│   ├── gdscript.ts       # GDScript plugin (Godot engine)
│   └── csharp.ts         # C# plugin (.NET MAUI)
```

#### IR (Intermediate Representation)

The IR is a language-agnostic representation of the GraphQL schema:

| IR Type       | Description                                     |
| ------------- | ----------------------------------------------- |
| `IREnum`      | Enum with values, raw values, legacy aliases    |
| `IRInterface` | Protocol/Interface with fields                  |
| `IRObject`    | Struct/Class with fields, implements, unions    |
| `IRInput`     | Input type with fields, required field tracking |
| `IRUnion`     | Union with members, nested union handling       |
| `IROperation` | Query/Mutation/Subscription with fields         |

#### Language Plugins

Each plugin handles language-specific requirements:

| Plugin       | Features                                                          |
| ------------ | ----------------------------------------------------------------- |
| **Swift**    | Codable protocol, ErrorCode custom initializer, platform defaults |
| **Kotlin**   | sealed interface, fromJson/toJson with nullable patterns          |
| **Dart**     | extends/implements, factory constructors, sealed class            |
| **GDScript** | \_init(), from_json/to_json, Variant type                         |
| **C#**       | records, JsonConverter, [JsonPolymorphic] unions                  |

### Scripts

| Script              | Description                                   |
| ------------------- | --------------------------------------------- |
| `generate:ts`       | Generate TypeScript types (graphql-codegen)   |
| `generate:swift`    | Generate Swift types (IR-based plugin)        |
| `generate:kotlin`   | Generate Kotlin types (IR-based plugin)       |
| `generate:dart`     | Generate Dart types (IR-based plugin)         |
| `generate:gdscript` | Generate GDScript types (IR-based plugin)     |
| `generate:csharp`   | Generate C# / MAUI types (IR-based plugin)    |
| `generate`          | Generate every type and sync manifest targets |
| `sync`              | Replay manifest-owned synchronized copies     |

### Generating Types

```bash
cd packages/gql

# Generate all platform types
bun run generate

# Diagnostic single-plugin generation (always finish with `bun run generate`
# before committing so every manifest target is synchronized)
bun run generate:swift
bun run generate:kotlin
bun run generate:dart
bun run generate:gdscript
bun run generate:csharp
```

### Generated Files

| File                        | Platform   | Description                      |
| --------------------------- | ---------- | -------------------------------- |
| `src/generated/types.ts`    | TypeScript | Type definitions                 |
| `src/generated/Types.swift` | iOS/macOS  | Codable structs & enums          |
| `src/generated/Types.kt`    | Android    | Data classes & sealed interfaces |
| `src/generated/types.dart`  | Flutter    | Classes & sealed classes         |
| `src/generated/types.gd`    | Godot      | GDScript classes                 |
| `src/generated/Types.cs`    | .NET MAUI  | C# records & JSON converters     |

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

| Marker       | Effect                                                       |
| ------------ | ------------------------------------------------------------ |
| `# => Union` | Generates result union wrapper (e.g., `FetchProductsResult`) |
| `# Future`   | Wraps return type in Promise/async                           |

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
import { signal } from "@preact/signals-react";

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
    {
      to: "/docs/features/subscription/upgrade-downgrade",
      label: "Upgrade/Downgrade",
    },
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

## Framework Library Listing SSOT

Framework implementation listings must be derived from
`packages/docs/src/lib/images.ts`:

- `LIBRARIES` is the canonical order and membership for framework libraries
  (Expo, React Native, Flutter, KMP, MAUI, Godot).
- Pages that show framework lists, setup links, sponsor links, or home-page
  icons must map over `LIBRARIES` instead of hand-writing their own arrays.
- When adding, removing, renaming, or reordering a framework, update
  `LIBRARIES` first and let pages derive labels, images, setup paths,
  install commands, and documentation links from that metadata.
- If a page needs new per-framework copy, add a typed field to `LibraryInfo`
  instead of creating another local list with duplicated order.

---

## Release Notes Pattern

### Location

Release notes are located at `packages/docs/src/pages/docs/updates/releases.tsx`.

### Package-specific grouping for shared releases

The docs release page is the canonical release-note SSOT, including when many
packages ship together. To satisfy the package-specific changelog requirement
from issue #206 without duplicating release history across package-local files:

- Audit the full requested commit range inclusively and include the current PR
  diff before drafting the note.
- Group user-visible changes by affected platform package or framework library:
  Google, Apple, IAPKit, React Native, Expo, Flutter, Godot, KMP, and MAUI.
- Omit packages with no user-visible change and keep each remaining group to the
  smallest set of useful upgrade notes.
- Do not replace package-specific behavior with a generic "framework parity"
  bullet when wrappers have different setup, runtime, or compatibility details.
- Exclude version-only commits, generated-file churn, and CI mechanics unless
  they change how users install, build, or validate the release.
- Keep package-local changelogs as pointers to this page and GitHub Releases,
  except where a package registry requires generated inline history.

### Adding New Release Notes

1. Add new entry at the **top** of the `allNotes` array
2. Follow the existing pattern with `id`, `date`, and `element`
3. Use semantic IDs like `gql-1-3-16-apple-1-3-14`
4. Verify every package version against its source of truth before writing it
   (see "Release package version verification" below)

```tsx
const allNotes: Note[] = [
  // GQL 1.3.16 / Apple 1.3.14 - Jan 26, 2026
  {
    id: "gql-1-3-16-apple-1-3-14",
    date: new Date("2026-01-26"),
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

### Release Package Version Verification

Release note package lists must never be guessed from memory or inferred from a
previous block. Verify each version from the package's real source of truth:

| Package                | Source of Truth                                                                  |
| ---------------------- | -------------------------------------------------------------------------------- |
| openiap-apple          | `openiap-versions.json` field `apple`, or GitHub release tag `{version}`         |
| openiap-google         | `openiap-versions.json` field `google`, or GitHub release tag `google-{version}` |
| react-native-iap       | `libraries/react-native-iap/package.json`                                        |
| expo-iap               | `libraries/expo-iap/package.json`                                                |
| flutter_inapp_purchase | `libraries/flutter_inapp_purchase/pubspec.yaml`                                  |
| godot-iap              | `libraries/godot-iap/addons/godot-iap/plugin.cfg`                                |
| kmp-iap                | `libraries/kmp-iap/gradle.properties` field `libraryVersion`                     |
| maui-iap               | `libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj` field `PackageVersion` |

Before adding or editing a `Package Releases` list:

1. `git fetch origin main --tags` (or `git fetch --no-tags origin main` if
   local stale tags would fail).
2. Read the current package metadata from `origin/main`, not from memory.
3. For planned patch releases, add exactly one patch version to each affected
   framework package and label the block `Planned Package Releases`.
4. If the user explicitly asks to write the note as already released, says to
   "assume it will be deployed/published", or asks to follow the existing linked
   release-note style, do **not** use `Planned Package Releases` or
   `(planned)`. Write the block as `Package Releases`, add the expected GitHub
   Release tag link (for example `godot-iap-2.2.8`), and use shipped wording
   such as "Publishes" / "Ships" instead of "Prepares".
5. For links to releases that should already exist in GitHub, confirm each tag
   exists with `gh release view <tag> --repo hyodotdev/openiap` before adding an
   `<a href>`. This existence check is skipped only when step 4 applies because
   the user explicitly requested an assumed post-release note.
6. If a release workflow is still running and the user has not requested an
   already-released note, keep the entry as plain text with planned wording. Add
   links only after the GitHub Release exists.
7. Run `bun run audit:docs`; the audit fails when a published
   `Package Releases` block contains a package/version item without a GitHub
   Release link.

Do not create a stable release-note block for RC or npm `next` publications on
the `next` branch. Preserve the change evidence, then write one concise,
package-grouped entry after stable promotion on `main`.

Do not use `openiap-versions.json` to derive React Native, Expo, Flutter,
Godot, KMP, or MAUI versions; that manifest tracks only `spec`, `google`, and
`apple`.


---

<!-- Source: internal/06-git-deployment.md -->

# Git Conventions & Deployment

> **Priority: MANDATORY**
> Follow these conventions for all commits and deployments.

## Public GitHub Communication Language

OpenIAP is a public open-source project. All repository-authored public GitHub
communication **must be written in English**, regardless of the language used
in a private maintainer conversation.

This rule covers:

- issue and pull request titles, bodies, and comments
- inline review replies and review summaries
- GitHub Discussions and maintainer-authored label or milestone descriptions
- commit messages, changelogs, release notes, and GitHub Release text

Code identifiers, command-only bot triggers, logs, and directly quoted reporter
text may remain in their original form when accuracy requires it. Any
surrounding explanation or response must still be English.

Before any GitHub write through the CLI, API, browser, or automation, inspect
the complete title/body payload and confirm that all repository-authored prose
is English. When non-English repository-authored text is found in the active
work scope, edit the existing artifact in place when possible instead of adding
a duplicate translation.

## Git Commit Message Format

### Rules

- **50 characters max** for the subject line (tag + scope + message combined)
- Everything after the tag MUST be lowercase
- No trailing period
- Use imperative mood ("add" not "added")

## Pull Request Preview Recordings

Every PR that introduces a new feature, visible behavior change, UI change,
documentation page, example flow, or developer workflow must include a preview
recording before it is handed off for review.

Requirements:

- Record the actual changed surface after the implementation is complete. Use
  the Codex Chrome Extension for web/docs/dashboard previews whenever a browser
  can render the change.
- Compress the final video to **under 10 MB** so GitHub accepts it reliably.
  Prefer H.264 MP4 with a modest resolution / frame rate when the raw capture is
  too large.
- Upload the compressed recording to the GitHub PR as a PR body attachment or a
  clearly labeled attached `Preview` comment.
- Do not commit one-off PR preview recordings. Only commit preview media when
  the media itself is a product documentation or example asset that should ship
  with the repository. If PR attachment upload is blocked by local browser or
  extension permissions, commit a compressed asset under `.github/pr-previews/`
  and link the GitHub-hosted raw/blob URL from the preview comment.
- Link or embed the uploaded preview in the PR body or a clearly labeled
  `Preview` PR comment.
- If the change has no visual or interactive surface, include a short note in
  the PR explaining why a recording was not applicable and show the most useful
  terminal/API proof instead.
- Do not upload secrets, private customer data, unreleased credentials, or local
  browser profile details in previews. Redact or use test fixtures.

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

| Scope     | Package/Library                    |
| --------- | ---------------------------------- |
| `apple`   | `packages/apple`                   |
| `google`  | `packages/google`                  |
| `spec`    | `packages/gql`                     |
| `docs`    | `packages/docs`                    |
| `rn`      | `libraries/react-native-iap`       |
| `expo`    | `libraries/expo-iap`               |
| `flutter` | `libraries/flutter_inapp_purchase` |
| `kmp`     | `libraries/kmp-iap`                |
| `godot`   | `libraries/godot-iap`              |

### Common Tags

| Tag         | Usage                           |
| ----------- | ------------------------------- |
| `feat:`     | New feature                     |
| `fix:`      | Bug fix                         |
| `docs:`     | Documentation changes           |
| `style:`    | Code style changes (formatting) |
| `refactor:` | Code refactoring                |
| `test:`     | Adding or updating tests        |
| `chore:`    | Maintenance tasks               |

---

## Deployment

### Stable And Prerelease Branches

`main` is the stable release branch. Its package metadata must never contain a
SemVer prerelease suffix. Stable package releases, production docs deployment,
and the Docs GitHub Release run from `main` only.

`next` is an on-demand prerelease integration branch for compatibility work
that needs external validation, such as a new store runtime. It is not a
permanent development branch and may be absent between prerelease trains.

- Create `next` from the latest `main` only when a maintainer requests a
  prerelease train.
- Before reusing `next`, inspect its divergence, open PRs, and active workflows.
  If it belongs to an older completed train, do not merge, rebase, reset, or
  delete it automatically; obtain explicit maintainer approval before replacing
  it from current `main`.
- Run first RC releases from `next` with `prerelease=true`; run later RC bumps
  with `version=rc-bump` where supported.
- Release workflows commit prerelease metadata back to `next`, never `main`.
- Do not merge prerelease version-only commits into `main`. Promote reviewed
  source changes through a clean PR based on `main`, then run the stable
  workflow from `main` using the intended bump type relative to its stable
  metadata.
- Do not force-reset or delete `next` without explicit maintainer approval.
- RC/next releases do not get entries in the stable docs release history.

The executable policy is `scripts/release-branch-policy.mjs`. CI runs it for
`main` and `next`, and every package release workflow runs it before builds:

```bash
bun run audit:release-state
node --test scripts/release-branch-policy.test.mjs
```

Framework-library release workflows also require `origin/<release-branch>` to
still equal the workflow dispatch SHA after validation. If the branch advanced,
the workflow must stop instead of rebasing unverified commits into the release;
rerun the complete review, CI, and E2E gates on the new head, then dispatch the
release again.

The version commit and immutable provenance tag must be pushed atomically before
publishing a framework package to its external registry. A `current` retry may
reuse that tag to finish an interrupted publication, but if the registry already
contains the version while its provenance tag is absent, stop instead of tagging
the current branch tip as an unverified substitute.

When `current` must create a missing tag for a version that is not yet published,
the workflow creates an empty provenance-recovery commit and atomically pushes
that real branch update with a tag targeting the verified dispatch SHA. A no-op
branch refspec is not a compare-and-swap guard because Git omits up-to-date refs
from the push transaction.

For npm trusted publishing, the release workflow's branch-ref phase creates and
pushes the immutable tag, then dispatches the same trusted-publisher workflow on
that tag ref. Only the tag-ref publish job receives `id-token: write`. It must
require the exact package/version tag and require the checked-out commit to equal
the tag-ref event's `GITHUB_SHA` before running `npm publish --provenance`.
Checking out or detaching to a tag inside a branch-dispatched retry is not enough:
npm's provenance statement reads the immutable workflow event SHA, so changing
only the local checkout can make package `gitHead` and attested source disagree.
Serialize tag-ref publishers per package so concurrent versions cannot move the
same npm dist-tag backward. The publisher must also prove that the tag is
reachable from `main` for stable versions or `next` for prereleases and that it
was dispatched by a successful branch-ref run of the same release workflow. The
branch run uploads an immutable, run-attempt-scoped authorization artifact that
names the exact repository, workflow, source branch/SHA, release tag, and tag
SHA; the tag publisher must download it from the supplied source run and match
every field before publishing. A merely successful historical run is not valid
authorization for another tag.
Before accepting an already-published version, and again after a new publish,
run npm's signature audit to authenticate the Sigstore bundle and bind it to the
published tarball, then inspect only that audit's returned verified bundle when
matching registry `gitHead`, artifact SHA-512, and the decoded SLSA statement's
repository, workflow ref, and resolved Git commit against the immutable release
tag. A tag whose stored
workflow predates the tag-ref publisher cannot be repaired safely through
`current`; stop with an explicit instruction to release a new reviewed version.

### Deploying Apple Package (iOS/macOS)

**Via GitHub Actions UI:**

1. Go to Actions -> "Apple Release"
2. Click "Run workflow"
3. Select `main` for stable or `next` for prerelease
4. Select the version bump type and prerelease flag
5. Click "Run workflow"

**What happens:**

1. Updates `openiap-versions.json`
2. Regenerates release-derived files via `scripts/sync-release-generated.sh`
   (docs `version-metadata.json`, `llms.txt`, `llms-full.txt`, agent
   `context.md`) so they land in the same version-bump commit
3. Commits the version change to the guarded release branch
4. Creates Git tag `<apple-version>` (bare semver)
5. Builds and tests Swift package
6. Validates and publishes to CocoaPods
7. Creates GitHub Release

**Result:**

- CocoaPods: `pod 'openiap', '~> <apple-version>'`
- Swift Package Manager: `.package(url: "https://github.com/hyodotdev/openiap.git", from: "<apple-version>")`

### Deploying Google Package (Android)

**Via GitHub Actions UI:**

1. Go to Actions -> "Google Release"
2. Click "Run workflow"
3. Select `main` for stable or `next` for prerelease
4. Select the version bump type and prerelease flag
5. Click "Run workflow"

**What happens:**

1. Updates `openiap-versions.json`
2. Regenerates release-derived files via `scripts/sync-release-generated.sh`
   (docs `version-metadata.json`, `llms.txt`, `llms-full.txt`, agent
   `context.md`) so they land in the same version-bump commit
3. Commits the version change to the guarded release branch
4. Creates Git tag `google-<google-version>`
5. Builds and tests Android library
6. Publishes to Maven Central
7. Creates GitHub Release with artifacts (AAR, JAR)

**Result:**

- Maven Central: `implementation("io.github.hyochan.openiap:openiap-google:<google-version>")`

### Deploying Documentation

**Merging to `main` does not publish documentation.** No workflow deploys the
production docs on merge; `deploy-kit.yml` auto-deploys IAPKit instead.
Production docs go out only when a human runs the local deploy below.

This matters most for a PR that changes both `packages/kit/` and
`packages/docs/`: the kit server auto-deploys from `main` while the docs half
stays on the previously deployed build. Server behavior can therefore go live
while the documentation describing it is still unpublished. After merging such a
PR, deploy the docs and verify both surfaces.

Production documentation is stable-only and must deploy from a clean `main`
checkout that exactly matches `origin/main`. The script rejects prerelease spec
versions, other branches, and stale or unpublished local snapshots.

```bash
# From monorepo root
npm run deploy
```

This will:

1. Sync version metadata
2. Typecheck and build the docs site
3. Deploy production documentation to Vercel

`npm run deploy` uses the current native-derived `spec` value from
`openiap-versions.json`. It rejects any explicit argument that differs from the
native floor; docs deployment is not a version-bump path.

**Routine docs deployments stop here.** Do not follow them with a Docs GitHub
Release: the spec version has not moved, so the immutable `docs-{spec}` tag
cannot represent a new release. Run the stable Docs workflow only when the spec
version itself advanced:

```bash
gh workflow run release.yml --ref main -f version=current
```

If a Docs GitHub Release is requested while `spec` is unchanged, stop and
explain that the immutable tag scheme cannot represent it. Deploying the docs
site is still valid and does not require a new GitHub Release.

Verifying a docs deployment: `llms-full.txt` carries a `Generated:` timestamp
that must match the committed file, and the deployed entry bundle should contain
any newly added page copy. A stale timestamp under a cache-busting query string
means the deploy has not landed, not that a CDN is caching.

---

## Release Tag Conventions

Each package uses a different tag format for GitHub Releases:

| Package      | Tag Format                   | Example                   |
| ------------ | ---------------------------- | ------------------------- |
| Apple        | `{version}` (no prefix)      | `2.1.0`                   |
| Google       | `google-{version}`           | `google-2.1.0`            |
| React Native | `react-native-iap-{version}` | `react-native-iap-15.2.0` |
| Expo         | `expo-iap-{version}`         | `expo-iap-4.1.0`          |
| Flutter      | `flutter-iap-{version}`      | `flutter-iap-9.2.0`       |
| KMP          | `kmp-iap-{version}`          | `kmp-iap-2.2.0`           |
| Godot        | `godot-iap-{version}`        | `godot-iap-2.2.0`         |
| MAUI         | `maui-iap-{version}`         | `maui-iap-1.2.1`          |
| Docs         | `docs-{version}`             | `docs-1.2.0`              |

> **Apple is the exception** — it tags with the bare semver version because
> CocoaPods and Swift Package Manager resolve directly from the Git tag.

Flutter's pub.dev trusted publisher is also event-sensitive: only
`publish-flutter.yml` runs started by pushing a matching
`flutter-iap-{version}` tag are eligible for OIDC publication. A manually
dispatched workflow on that tag is still ineligible. The release workflow must
wait for the tag-push run, and retries must rerun that original run without
deleting or recreating the immutable tag. Before requesting OIDC, the publisher
must prove that the tag commit is reachable from `main` for a stable version or
`next` for a prerelease and verify the exact tag/SHA against the run-scoped
authorization artifact uploaded by the guarded release workflow. An unpublished
tag that predates this lane, or whose authorization artifact expired, must not
rerun legacy publishing code; create a new reviewed release version instead.

The `publish-flutter.yml` job must use the `pub.dev` GitHub Environment. That
environment must have a required-reviewer or equivalent deployment-protection
rule in GitHub, and the pub.dev package Admin configuration must require the
same environment name. The workflow field alone does not create an external
trust boundary. Verify both settings before releasing; do not publish Flutter
while either side is unprotected.

### Release Docs Version Guard

When documenting release package versions in
`packages/docs/src/pages/docs/updates/releases.tsx`, do not infer versions from
adjacent release notes or assume every package moved in lockstep.

Use these checks before writing a release list:

| Package      | Metadata / Tag Check                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| Apple        | `jq -r '.apple' openiap-versions.json`; tag `{version}`                                                           |
| Google       | `jq -r '.google' openiap-versions.json`; tag `google-{version}`                                                   |
| React Native | `jq -r '.version' libraries/react-native-iap/package.json`; tag `react-native-iap-{version}`                      |
| Expo         | `jq -r '.version' libraries/expo-iap/package.json`; tag `expo-iap-{version}`                                      |
| Flutter      | `awk '/^version:/{print $2}' libraries/flutter_inapp_purchase/pubspec.yaml`; tag `flutter-iap-{version}`          |
| Godot        | `sed -n 's/^version="\\(.*\\)"/\\1/p' libraries/godot-iap/addons/godot-iap/plugin.cfg`; tag `godot-iap-{version}` |
| KMP          | `sed -n 's/^libraryVersion=//p' libraries/kmp-iap/gradle.properties`; tag `kmp-iap-{version}`                     |
| MAUI         | read `<PackageVersion>` from `libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj`; tag `maui-iap-{version}`  |

If the release is not published yet, use planned wording and plain text. If the
release is published, verify the tag exists with `gh release view <tag>` before
linking it. This prevents stale Package Releases tables such as documenting
`maui-iap 1.0.1` when the actual release tag is `maui-iap-1.0.3`.

Do not add RC or npm `next` releases to the stable release history. Collect
their user-facing changes and write one package-grouped entry when the release
train is promoted on `main`.

---

## Important Notes

- **Deprecated repositories**: `openiap-apple` and `openiap-google` are no longer used
- **Monorepo only**: All releases are now managed from this monorepo
- **Separate versioning**: Apple and Google packages have independent versions
- **Swift Package Manager**: Automatically works via Git tags, no separate deployment step

---

## Version File Management

### openiap-versions.json

**CRITICAL: NEVER manually edit the `google` or `apple` fields in
`openiap-versions.json`.**

Version ownership is split:

- Apple releases update `apple` version
- Google releases update `google` version
- The shared `spec` is always the lower semantic version of `google` and
  `apple`
- Native version writers update their native key and derive `spec` atomically;
  sync then verifies the invariant and refreshes `packages/gql/package.json`,
  `packages/docs/package.json`, and other derived copies
- Production docs deployment consumes the derived current `spec`; it must not
  accept an independently selected spec version

Release workflows write stable values on `main` and prerelease values on
`next`. Manual edits are not a substitute for selecting the correct workflow
branch.

The manifest is only for the shared spec and native platform packages:
`spec`, `google`, and `apple`. Framework library package versions
(`react-native-iap`, `expo-iap`, `flutter_inapp_purchase`, `godot-iap`,
`kmp-iap`, `maui-iap`) must stay in each library's own package metadata and
release workflow, not as extra keys in `openiap-versions.json`.

Manual Google, Apple, or spec edits will cause version conflicts and deployment
issues. Use the native GitHub Actions workflows and repository sync automation.

**Why this matters:** If a feature PR sets `apple: "2.1.1"` manually, and then CI auto-bumps on release, CI sees "current is 2.1.1" and bumps to 2.1.2 — skipping 2.1.1 entirely. The published tag becomes 2.1.2 with no 2.1.1 ever existing.

**Rule:** Feature PRs must never touch `spec`, `google`, or `apple`. Stable
version changes happen via:

1. Release workflows (Apple Release, Google Release)
2. Native version automation that derives `spec = min(google, apple)`, followed
   by sync propagation
3. Deploy script (`npm run deploy`) using the already-derived spec
4. CI auto-bump after merge where configured


---

<!-- Source: internal/07-docs-consistency.md -->

# Docs Consistency Rules — Single Source of Truth (SSOT)

This document captures the consistency rules for OpenIAP documentation, code
comments, and generated types. PR #107 (and earlier rounds) repeatedly
surfaced the same class of drift — the docs claimed one field/default/type,
but the SDK code actually used another. These rules + the companion audit
script (`scripts/audit-docs.ts`) catch those before review.

## Sources of truth

When two places disagree, the upstream wins:

```
GraphQL schema  →  generated Types  →  hand-written wrapper SDK  →  docs page
(packages/gql      (libraries/*/src       (Swift / Kotlin /          (packages/docs/
 /src/*.graphql)   /types.{ts,kt,...})    Dart / TS / GDScript)        src/pages/...)
```

- `packages/gql/schema-files.mjs` — ordered inventory of every production SDL
  input. Every repository-owned generator imports it directly. Do not add
  another hard-coded schema list or an unverified external generator manifest.
- `packages/gql/schema-source-utils.mjs` — shared source identity normalization
  and block-string line detection. Metadata extractors must not duplicate this
  lexical bookkeeping.
- `packages/gql/src/*.graphql` — schema descriptions ARE the canonical doc
  string. Edits propagate via `bun run generate` to every generated
  `types.ts`, `Types.kt`, `Types.swift`, `types.dart`, `types.gd`, and
  `Types.cs`.
- `packages/gql/schema-markers.mjs` — the only parser for the SDL comment
  contracts `# Future` and `# => Union`. Generators and the schema linter must
  consume it rather than maintaining independent line-state machines. A union
  wrapper must be a non-root object with at least one field and all fields
  nullable; operation roots, empty wrappers, and required fields fail
  generation instead of silently degrading to an object.
- `packages/gql/schema-deprecations.mjs` — the only extractor and validator for
  canonical deprecation ownership. Standard GraphQL declarations use
  `@deprecated(reason: ...)`; named types use the project-scoped
  `@openiapDeprecated(reason: ...)` directive declared in `schema.graphql`.
  Do not duplicate an
  `@deprecated` tag inside the description or encode deprecation only as
  description prose. The schema linter rejects missing, duplicate, empty, and
  conflicting ownership. The generator appends the directive reason wherever
  the target exposes a corresponding declaration; TypeScript receives an
  explicit injection for project-scoped type-level directives.
  TypeScript string-union members have no per-member declaration and therefore
  cannot carry GraphQL enum-value docs; `ErrorCode` remains a real enum, so its
  member deprecations are required. Custom aliases such as
  `PurchaseInput = Purchase` rely on the aliased declaration's canonical docs
  instead of duplicating them. GDScript does not emit GraphQL interfaces, so
  implementation declarations carry the applicable field guidance. GDScript
  also expresses `# => Union` result wrappers only through operation return
  metadata rather than declarations, so wrapper-variant docs have no generated
  declaration target there; every language that emits a wrapper or variant
  declaration must preserve the canonical reason.
- `packages/gql/custom-input-contracts.ts` — typed
  field/type/nullability/default contracts for inputs that custom generators
  alias or project. The shared IR transformer validates these before any
  language plugin runs.
- `packages/gql/generated-sync-manifest.mjs` — generated source/target mapping
  shared by canonical platform sync and the pre-commit drift guard.
- `libraries/*/src/types.ts` (or equivalent) — generated; never hand-edit.
  When a docs page mentions a field name, that field MUST exist in the
  generated TS type. The audit script enforces this.
- Wrapper SDK source (e.g. `libraries/expo-iap/src/index.ts`) — JSDoc
  parameter names MUST match the actual function-signature parameter
  names. ESLint rule `tsdoc/syntax` + the audit script catch drift.
- Doc pages — the surface visible to users. Must reflect what each upstream
  layer actually exposes.

## Rules

### R1 — JSDoc / KDoc / Dartdoc / Swift `@param` names match the signature

If the function declares `(args) =>`, the JSDoc tag is `@param args …`.
If it declares `(request) =>`, the tag is `@param request …`. Don't carry
over the schema field name (`props`, `params`) when the wrapper destructured
or renamed.

```ts
// ✅ wrapper destructures from `args`
/** @param args Purchase request. … */
export const requestPurchase = async (args) => { … };

// ❌ JSDoc says `props`; signature says `args`
/** @param props … */
export const requestPurchase = async (args) => { … };
```

### R2 — Defaults match across SDKs

If `fetchProducts.type` defaults to `'in-app'` in Flutter / expo-iap /
react-native-iap / godot-iap, then the Apple wrapper must also default to
`.inApp` — and the Apple doc comment must say `.inApp`. The schema
description is the canonical statement.

When changing a default, update:

1. The GraphQL schema description.
2. Re-run `bun run generate`.
3. Every wrapper SDK's `?? <default>` expression and JSDoc / KDoc / etc.
4. Every API doc page (`packages/docs/src/pages/docs/apis/<symbol>.tsx`).

### R3 — Doc pages reference real fields only

When a Type doc page lists fields in a `<table>` or `<ul>`, every field name
MUST exist in the canonical generated
`packages/gql/src/generated/types.ts` shape, which is synchronized into Expo
and React Native. The audit parses that TypeScript SSOT with the compiler AST
and flags fields that do not appear in the declaration.

Example failure modes already encountered:

- `BillingProgramAvailabilityResultAndroid` doc listed
  `responseCode` + `debugMessage` — neither field exists; the type has
  `billingProgram` + `isAvailable`.
- `LaunchExternalLinkParamsAndroid` doc listed `program` + `url` — neither
  exists; the type has `billingProgram` + `launchMode` + `linkType` +
  `linkUri`.
- `ExternalPurchaseCustomLinkNoticeResultIOS` doc listed `result` +
  `noticeType` — neither exists; the type has `continued` + `error`.

### R4 — Enum values listed in docs must exist

When a doc page mentions enum values (e.g.
`'continue' | 'cancelled'`, `.acquisition`, `.services`), they must
appear in the generated enum definition. Compare documentation against the
generated target-language member names and wire values, not a manually copied
list. GraphQL enum identifiers are PascalCase, but serialized string values can
be lowercase or kebab-case.

`ExternalPurchaseCustomLinkNoticeTypeIOS` is the canonical recent miss —
the union is `'browser'` only, but the doc claimed
`'continue' | 'cancelled' | …`.

The audit script enforces exact generated values for the canonical offer
snippets covered by R12. Other enum examples still require review against the
generated types until a focused, fault-tested rule is added; do not describe a
broader automated guarantee than the script actually provides.

### R5 — `<Link to="/docs/...">` targets must resolve

Anchor links should point to existing pages and section anchors. Common
recent failures:

- "Use verifyPurchase" link pointed to `/docs/apis/get-active-subscriptions`
  (totally unrelated).
- `getExternalPurchaseCustomLinkTokenIOS` Returns linked to the
  `external-purchase-link` page without an anchor — but that page
  documents only `ExternalPurchaseNoticeResultIOS`, so users land in the
  wrong section. Add a precise `#external-purchase-custom-link-token-result-ios`
  anchor on the type page AND link to it.

The audit script crawls every internal `<Link to="/docs/...">` and asserts the
target page file exists. Anchor semantics still require review against the
target page.

### R6 — Native version constraints are honest

`enableBillingProgramAndroid: 'external-payments'` is gated to Play Billing
8.3.0+ (Japan only). `EXTERNAL_CONTENT_LINK` / `EXTERNAL_OFFER` were introduced
in 8.2.0, but their production integration must require 8.2.1+ because Google
fixed the availability and reporting-details APIs in that release. External
Offer examples must generate fresh reporting details for each redirect session
immediately before `launchExternalLink`; they must not teach the deprecated external-offer or
alternative-only dialog/token flow. A page that mixes these up misleads readers
about what works on which SDK.

When you write `<X> 8.2.0+`, you should be able to point to the matching
release-notes line. Don't paraphrase — quote the version requirement
exactly as Google / Apple states it.

### R7 — Code-example snippets follow the real wrapper contract

Code examples in doc pages should at minimum parse / type-check against
the wrapper they target. The audit script does not compile every documentation
language. Its R11 rules reject a focused set of recurring phantom API shapes;
all other imports, calls, and field accesses still require a real example build
or a targeted fault-tested audit rule.

When in doubt, run the example in a real example app before publishing.

### R8 — Platform-only callouts use the right wrapper

iOS-suffixed APIs (`syncIOS`, `getReceiptDataIOS`, …) and Android-suffixed
APIs (`acknowledgePurchaseAndroid`, …) are exposed via every framework
wrapper (expo-iap, rn-iap, kmp-iap, flutter, godot-iap). The TS / Dart /
KMP / GDScript example tabs MUST show how to call the function from each
wrapper, with a `Platform.OS === 'ios'` (or `Platform.isIOS` / etc.)
guard so readers don't accidentally call iOS-only methods on Android.

The native Swift / Kotlin tab keeps the platform-native call. The
wrapper tabs use the suffixed name (`syncIOS()`, etc.) — except in
`packages/google` Kotlin (the Android-only native), where convention
strips the `Android` suffix from method names.

### R9 — Published package release lists use links

When a release-note block is labeled `Package Releases`, every package/version
item in that list must link to the corresponding GitHub Release. Use
`Planned Package Releases` only while the release workflow is still running or
the GitHub Release does not exist yet.

`bun run audit:docs` fails bare package/version entries under published
`Package Releases` blocks so link regressions are caught before publishing.

RC and npm `next` releases are managed on the on-demand `next` branch and do
not get release-history entries. Add one grouped entry only when the train is
promoted to a stable release on `main`.

### R10 — Docs version metadata stays synced with package metadata

`packages/docs/src/lib/versioning.ts` must not import package metadata from
outside `packages/docs`. Vercel uploads the docs package root, so imports such
as `../../../../libraries/expo-iap/package.json?raw` pass locally but fail in
Vercel builds.

The root `openiap-versions.json` is also a version contract, not three
independent counters. `spec` must equal the semantic-version minimum of
`google` and `apple`. Native version writers derive that floor atomically;
`scripts/sync-versions.sh` refuses an inconsistent manifest instead of
silently normalizing it.

Framework package versions and Android SDK constants used by docs must flow
through `packages/docs/src/generated/version-metadata.json`, which is generated
by `scripts/sync-versions.sh` from the real SSOT files:

- Expo / React Native: each library `package.json`
- Flutter: `libraries/flutter_inapp_purchase/pubspec.yaml`
- Godot: `libraries/godot-iap/addons/godot-iap/plugin.cfg`
- KMP: `libraries/kmp-iap/gradle.properties` and `gradle/libs.versions.toml`
- MAUI: `libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj`
- Google Android SDK / Play Billing: `packages/google/openiap/build.gradle.kts`

`bun run audit:docs` fails if the spec/native floor invariant is broken, this
generated metadata drifts from the SSOT files, or `versioning.ts` reintroduces
raw imports outside `packages/docs`.

### R11 — Active code examples reject recurring phantom API shapes

Fenced `CodeBlock` examples under active documentation must not reintroduce
known cross-language mistakes such as Kotlin syntax in C#, obsolete Flutter
listener names, legacy purchase request shapes, top-level Godot SKUs, or
obsolete Kotlin/KMP named arguments. Historical release notes are excluded
because they describe APIs as shipped at that time.

Keep R11 focused. Every new pattern needs a failing fixture and a valid nearby
shape so formatting, comments, or unrelated prose cannot trigger it.

### R12 — Canonical offer docs derive enum contracts from generated types

`DiscountOffer` is the canonical Android one-time product offer shape backed by
`ProductDetails.OneTimePurchaseOfferDetails`. Subscription discounts belong to
`SubscriptionOffer`, which maps to StoreKit `Product.SubscriptionOffer` and
Google Play `ProductDetails.SubscriptionOfferDetails`.

The canonical DiscountOffer page contains TypeScript, Swift, Kotlin, and Dart
`DiscountOfferType` snippets. The audit must parse the corresponding generated
files and compare each snippet with those generated members and wire values. Do
not hard-code a second expected enum list in the audit or its fixtures.

Search data must contain exactly one canonical entry for each page:

- `DiscountOffer` → `/docs/types/discount-offer`
- `SubscriptionOffer` → `/docs/types/subscription-offer`

Every R12 parser edge case needs a fault test. Required fixture transforms must
fail when their search pattern no longer matches; a no-op replacement can make
an invalid parser look green.

### R13 — Major removals leave one canonical contract

The coordinated major train removes the OpenIAP-owned compatibility surface
from OpenIAP 3.0, `react-native-iap` 16.0.0, `expo-iap` 5.0.0,
`flutter_inapp_purchase` 10.0.0, `godot-iap` 3.0.0, `kmp-iap` 3.0.0, and
`OpenIap.Maui` 2.0.0.

- The GraphQL schema and generated Swift, Kotlin, TypeScript, Dart, GDScript,
  and C# declarations contain no member from the completed removal catalog.
- Handwritten native and framework source exposes no deprecated wrapper,
  overload, event alias, custom-wire key, or compatibility enum scheduled for
  those versions.
- Raw JavaScript objects, Expo config, Flutter MethodChannel payloads, and
  Godot dictionaries use only canonical keys. Removed aliases are rejected or
  ignored; they do not regain precedence when canonical input is absent.
- Active docs, examples, navigation, and search data teach only the canonical
  APIs. Historical release notes, migration catalogs, archives, and URL
  redirects may name removed surfaces when they clearly describe history or
  route readers to the replacement.
- The public migration catalog remains
  `/docs/updates/deprecations`. It records the removed-to-replacement mapping
  and the exact package major boundary.
- A future deprecation must be introduced through the canonical GraphQL
  deprecation directives or an explicit package-local notice, name one future
  major boundary, include a canonical replacement, and update the migration
  catalog and executable audit before release. Patch and minor releases must
  not remove it early.

This policy covers OpenIAP-owned public aliases and compatibility wire keys. It
does not remove upstream StoreKit, Play Billing, Amazon, or Horizon response
compatibility; internal React Native, Expo, KMP, or Godot native-response
normalization; historical URL redirects; error-code input normalization;
unsupported-OS fallbacks; or staged IAPKit data migrations. In particular, the
KMP iOS product-response normalizer may fill an empty canonical placeholder
from a populated upstream native response label because that transport recovery
is not user-authored legacy input.

## Pre-commit checklist

Run before every `git push` on docs / SDK changes:

```bash
# 1. Format + lint the docs site
cd packages/docs
bunx prettier --check "src/**/*.{ts,tsx,css}"
bun run lint

# 2. Cross-library typecheck for SDKs you touched
cd libraries/expo-iap && bun run lint:tsc
cd libraries/react-native-iap && yarn typecheck
cd libraries/flutter_inapp_purchase && dart analyze lib
cd packages/apple && swift build
cd packages/google && ./gradlew :openiap:compilePlayDebugKotlin

# 3. SSOT audit + parser fault fixtures (from the repository root)
cd <repo-root>
bun test scripts/audit-docs.test.ts
bun run audit:docs
```

The pre-commit hook runs the docs typecheck, audit fixtures, audit, and docs
format check when docs, the audit scripts, or the generated GQL contracts they
consume change. GitHub's `Test Docs` job runs the same audit fixtures and audit.
Do not bypass these gates.

## Audit script

`scripts/audit-docs.ts` is the executable companion to this guide. It
parses every `/docs/apis/*.tsx` and `/docs/types/*.tsx` page, extracts:

- `<Link to="/docs/...">` targets
- `<code>fieldName</code>` mentions inside Returns / Parameters tables
- published release entries and docs-local version metadata
- focused recurring phantom shapes from active fenced code examples
- canonical offer semantics, generated enum snippets, and search entries

Field mentions are cross-referenced against generated TypeScript shapes.
Canonical offer snippets are compared with the generated TypeScript, Swift,
Kotlin, and Dart outputs. Failures print a punch-list with the file, line, and
offending contract.

Run with:

```bash
cd <repo-root>
bun test scripts/audit-docs.test.ts
bun run audit:docs
```

Exit code 1 means at least one drift; 0 means clean.


---

<!-- Source: internal/08-gv-cloud-workspaces.md -->

# GV Cloud Workspace Policy

> **Priority: MANDATORY**
> Follow this policy when using TabTabTab `gv` cloud environments with OpenIAP.

`gv` can be useful for OpenIAP as a safe remote maintenance runner, not as a
release, signing, or production-credential environment. Treat every GV
workspace as an external cloud workspace with GitHub access and no local secret
trust by default.

## Safe role for OpenIAP

Use GV for secret-free OSS maintenance work:

- Documentation edits, release notes, docs typecheck, and docs consistency
  audits.
- `packages/gql` tests and schema/codegen review work that does not require
  private credentials.
- `packages/kit` typecheck and unit tests that run without production env vars.
- PR review response work on isolated branches/worktrees.
- Long-running lint/test/build smoke checks that should survive local laptop
  sleep or high local resource use.

Do not treat GV as the source of truth for full OpenIAP release validation.
Native Apple signing, Play/App Store production credentials, package publishing,
and deployment stay in the existing local or CI release systems.

## Required boundaries

Always keep these boundaries unless the repository owner explicitly changes this
policy:

- Onboard the repo with env capture disabled:

  ```bash
  gv repo add . --skip-env
  ```

- First test of any new GV version or environment should be:

  ```bash
  gv repo add . --dry-run --skip-env
  ```

- GitHub App access must be limited to the selected `hyodotdev/openiap`
  repository. Do not grant all-repository access.
- Do not enable OpenAI/Codex auth mirroring for OpenIAP by default.
- Do not enable local profile, CLI, shell, editor, or credential mirroring by
  default.
- Do not add production, payment, signing, release, or deployment secrets to GV.
- If credentials are ever needed for a GV experiment, use sandbox/test-only
  credentials with explicit owner approval.

## Forbidden commands and actions

Never run or recommend these for OpenIAP GV work:

```bash
gv repo add . --yes
gv repo env list --reveal
gv env info --reveal
gv env info --qr
```

Also do not upload, reveal, or sync:

- `.env`, `.env.local`, `.env.*`
- App Store Connect `.p8` keys
- Google service-account JSON files
- signing keys, provisioning profiles, certificates, keystores, and JKS files
- npm, NuGet, Maven Central, CocoaPods, Fly, Convex, App Store, Google Play, or
  payment provider credentials

One-time GV login URLs and workspace URLs should be treated as sensitive access
links. Do not paste them into issues, PRs, public docs, or long-lived logs.

## Known GV baseline for this repo

Validated on 2026-05-08 with a GV `agent-sandbox` environment:

- Repo onboarding with `--skip-env` completed.
- `gv repo env list --repo openiap --json` returned an empty env var list.
- OpenAI auth status was disabled.
- GitHub access was enabled only after selected-repository approval.
- Cloud clone was clean on `main` from
  `https://github.com/hyodotdev/openiap.git`.
- The default environment had `node`, `npm`, `corepack`, `python3`, `git`, and
  `docker`.
- The default environment did not have `bun`, `yarn`, `java`, `swift`,
  `flutter`, or `dotnet`.
- No `.devcontainer/devcontainer.json` existed in the repo at validation time.

Because Bun is not available in the default GV environment, the safe current
pattern is to run Bun checks inside Docker containers with the workspace mounted
read-only.

## Day-to-day usage

Use GV by opening an agent or editor attached to the cloud environment, then
give the task prompt there. The prompt is not a shell command.

```bash
gv env use agent-sandbox

# Open a cloud-attached agent/editor.
gv open opencode --env agent-sandbox
gv open codex --env agent-sandbox
```

Use `gv ssh` for direct terminal checks in the cloud workspace:

```bash
gv ssh --env agent-sandbox
cd ~/workspace/openiap
git status --short --branch
```

For investigation-only work, make the boundary explicit:

```text
Investigate issue 104 and the GQL -> SDK sync flow.
List the affected packages and propose a fix plan.
Do not change code, commit, push, create PRs, read env files, or run deploy,
release, signing, publish, or credential-related commands.
```

For maintenance work that may edit code, require an isolated branch and scoped
verification:

```text
Create a branch named codex/<task>.
Make the smallest safe change for the requested docs/GQL/kit issue.
Do not touch env, signing, release, deploy, or publish files.
Run only the relevant secret-free checks, then summarize the diff and results.
```

## Safe verification pattern

Prefer an ephemeral Docker container with a read-only repo mount and an internal
copy:

```bash
gv ssh --env agent-sandbox -- \
  'set -eu
  OPENIAP_PATH="${OPENIAP_PATH:-$HOME/workspace/openiap}"
  test -d "$OPENIAP_PATH"
  docker run --rm \
    -v "$OPENIAP_PATH:/src:ro" \
    -w /work \
    oven/bun:1.3.13 \
    bash -lc "cp -a /src/. /work && bun install --frozen-lockfile && bun run audit:docs"'
```

Why this pattern:

- `:ro` prevents the container from writing to the GV checkout.
- `/work` is a temporary container copy, so `node_modules`, build output, and
  generated files disappear when the container exits.
- It avoids syncing local env files or local uncommitted changes.

After any GV run, verify both workspace cleanliness and env state:

```bash
gv ssh --env agent-sandbox -- \
  'cd ~/workspace/openiap && git status --short --branch'

gv repo env list --repo openiap --json
```

## Verified safe smoke checks

These checks have run successfully inside the Docker `/work` copy in the
GV read-only pattern, not directly in the default GV host shell. Bun is not
available in the default GV environment unless a future setup script installs
it.

```bash
# GQL tests
cd packages/gql && bun run test

# Docs typecheck
cd packages/docs && bun run typecheck

# Kit typecheck and tests
cd packages/kit && bun run typecheck && bun run test

# Docs consistency audit
bun run audit:docs
```

Use these as the first GV regression suite for docs, GQL, and IAPKit
maintenance work.

## Out of scope for GV until explicitly proven

Do not use GV as the default runner for:

- `packages/apple` SwiftPM/Xcode signing or release workflows.
- iOS/macOS Godot, Expo, React Native, KMP, Flutter, or MAUI device builds.
- Android/KMP release publishing that needs Maven Central signing credentials.
- Flutter pub.dev, npm, NuGet, CocoaPods trunk, GitHub release, or deployment
  publishing.
- Fly/Convex production deploys.
- Any flow that requires production IAP, payment, App Store Connect, Google
  Play, or signing credentials.

Linux-friendly Android/KMP checks may become reasonable after the repository has
a minimal GV/devcontainer setup with Java installed, but production credentials
still remain out of scope.

## Branch and PR workflow

Use GV for isolated work, not direct `main` edits:

1. Start from the clean cloud clone.
2. Create a branch such as `codex/docs-gv-audit` or `codex/kit-gv-smoke`.
3. Run only secret-free checks.
4. Review `git diff` and `git status`.
5. Push only intentional source changes.
6. Open a PR for normal CI review.

Do not push release, signing, or deployment changes from GV without explicit
owner approval.

## Future improvement

If GV becomes part of regular maintenance, add a minimal devcontainer or setup
script for the Linux-friendly subset:

- Bun pinned to the root `packageManager`.
- Node/Corepack.
- Java for Gradle checks.
- Optional Android command-line tooling if needed.

Do not add Swift, Xcode, Flutter, .NET, signing tools, or production secret
setup to the first GV devcontainer. Keep the first iteration small and focused
on docs, GQL, kit, and non-release Android/KMP smoke checks.


---

<!-- Source: internal/sandbox-subscription-billing-issue.md -->

---
title: Sandbox E2E — subscriptionBillingIssue
audience: contributors, release QA
---

# Sandbox E2E: `subscriptionBillingIssue`

The `subscriptionBillingIssue` event requires live store signals that cannot be produced from a unit-test JVM. This document captures the exact sandbox procedure for both platforms so any reviewer can reproduce.

All code paths verified by local compile + Horizon Robolectric unit test:

```bash
cd packages/google
./gradlew :openiap:compilePlayDebugKotlin
./gradlew :openiap:compileHorizonDebugKotlin
./gradlew :openiap:testHorizonDebugUnitTest   # Robolectric no-op assertion

cd ../apple
swift build && swift test                     # 87 tests

cd ../../libraries/kmp-iap
./gradlew :library:compileDebugKotlinAndroid

cd ../react-native-iap && yarn typecheck
cd ../expo-iap && bun run tsc --noEmit
cd ../flutter_inapp_purchase && flutter analyze
```

---

## iOS (StoreKit 2 sandbox)

**Prereqs**

- Physical iOS/iPadOS device running **16.4 or later** (`Message.Reason.billingIssue` is available on iOS/iPadOS and Mac Catalyst 16.4+, and visionOS 1.0+; the iOS Simulator does not deliver StoreKit Messages).
- A sandbox Apple ID enrolled in App Store Connect → Users and Access → Sandbox Testers.
- An auto-renewable subscription product configured on App Store Connect, and the Example project's `subscriptionIds` list pointing at it (`dev.hyo.martie.premium` by default).

**Step-by-step**

1. Sign the device out of its production Apple ID. Sign the sandbox tester into **Settings → App Store → Sandbox Account**.
2. Open the Example app:
   - `packages/apple/Example/OpenIapExample.xcodeproj` — run the `OpenIapExample` scheme.
3. In-app: navigate to the **Subscription Flow** screen and subscribe to `dev.hyo.martie.premium`.
4. Force a billing issue on the **device** (requires iOS 16+ / iPadOS 16+):
   - Go to **Settings → Developer → Sandbox Account → Manage → Account Settings**.
   - Disable the **Allow Purchases & Renewals** setting.
   - This causes all in-app purchases to fail and auto-renewable subscriptions to stop renewing.
   - The setting applies to all devices the sandbox account signs in to.
   - Reference: <https://developer.apple.com/documentation/storekit/testing-failing-subscription-renewals-and-in-app-purchases#Configure-the-sandbox-environment-to-simulate-billing-issues>.
5. Wait for the next renewal cycle (Renewal Rate = 5 minutes → wait ~5 min). The renewal fails, and StoreKit delivers `Message.Reason.billingIssue` when the app is in the foreground.
6. To simulate the user fixing the issue, re-enable **Allow Purchases & Renewals**.
7. Expected UI: the orange "Subscription needs attention" banner appears at the top of the Subscription Flow screen. Tapping **Fix payment method** opens `SKPaymentQueue` / `showManageSubscriptions`.

**What success looks like**

- Console logs:

  ```text
  🔔 [MessageListener] billingIssue received
  Emitting subscriptionBillingIssue: dev.hyo.martie.premium
  ```

- Banner visible on `SubscriptionFlowScreen`.
- `Product.SubscriptionInfo.status(for:)` shows the affected subscription in
  `.inBillingRetryPeriod` or `.inGracePeriod`. A retrying subscription without
  grace-period access is not expected in `Transaction.currentEntitlements`.

**If nothing fires**

- iOS < 16.4 — silent no-op by design (confirm with `#available` trace in logs).
- tvOS / watchOS / native macOS (non-Catalyst) build — silent no-op by design (the listener supports iOS/iPadOS, Mac Catalyst, and visionOS).
- App not foregrounded when the message is posted — StoreKit delivers on next `Message.messages` await; bring the app to foreground.

---

## Android (Play Billing 8.1+ sandbox)

**Prereqs**

- Physical Android device (or emulator with Play Store) running the Play flavor of the Example app:
  `packages/google/Example` → run with product flavor **play**.
- A Play Console sandbox tester account on the device.
- A subscription product configured in the Play Console, matching `subscriptionSkus` in `SubscriptionFlowScreen.kt`.

**Step-by-step**

1. Install the Example APK (`./gradlew :Example:installPlayDebug`).
2. Sign in with the sandbox tester account in the Play Store app.
3. Subscribe to a test subscription in the Example app.
4. Force a suspension:
   - In the **Google Play Store → Payment methods**, remove all payment methods for the sandbox account, OR
   - Use Play Console → **Subscriptions → Test suspensions** (requires appropriate Play Console role). Reference: <https://developer.android.com/google/play/billing/subscriptions#suspended>.
5. Wait for Play's renewal cycle. When Play suspends the subscription, the next `getAvailablePurchases` or `onPurchasesUpdated` will include the purchase with `isSuspended == true`.
6. Return to the Example app. The banner fires once per session per affected purchase (deduped by `purchaseToken`).

**What success looks like**

- `logcat` shows:

  ```text
  D OpenIapModule: onPurchasesUpdated isSuspended=true ...
  D Example: subscriptionBillingIssue fired for sku=...
  ```

- Banner visible on `SubscriptionFlowScreen`.
- Tapping **Fix payment method** launches `deepLinkToSubscriptions` which routes to Play's subscription center.

**Horizon flavor (do NOT attempt)**

- The Horizon flavor's `addSubscriptionBillingIssueListener` registration is a
  documented no-op, while the generated `subscriptionBillingIssue` resolver
  fails immediately with `FeatureNotSupported` instead of waiting forever.
  `SubscriptionBillingIssueHorizonNoOpTest` verifies listener registration,
  and `SubscriptionHandlersBillingIssueHorizonTest` verifies the fail-fast
  resolver with Robolectric in CI. There is no sandbox path on Horizon because
  the Billing Compatibility SDK 2.0.0 targets Play Billing 7.0, which does not
  expose `Purchase.isSuspended`.

---

## Cross-library smoke (optional)

Use `libraries-versions.jsonc` to point example apps at the local monorepo sources (already `"local"` by default), then verify each downstream library surfaces the event:

| Library | Check |
|---------|-------|
| react-native-iap | `useIAP({ onSubscriptionBillingIssue: p => console.log(p) })` fires the callback. `subscriptionBillingIssueListener()` also fires independently. |
| expo-iap | `subscriptionBillingIssueListener((p) => console.log(p))` fires via expo event emitter. |
| flutter_inapp_purchase | `iap.subscriptionBillingIssueListener.listen(...)` emits the Purchase. |
| godot-iap | `godot_iap.subscription_billing_issue.connect(...)` emits the Dictionary payload. |
| kmp-iap | `kmpIapInstance.subscriptionBillingIssueListener.collect {...}` emits in the Flow. |

---

## Automated coverage matrix

| Layer | Mechanism | Status |
|-------|-----------|--------|
| Horizon listener no-op / resolver fail-fast guarantee | Robolectric tests (`SubscriptionBillingIssueHorizonNoOpTest`, `SubscriptionHandlersBillingIssueHorizonTest`) | Runs on CI |
| Play-flavor compile of listener surface | `compilePlayDebugKotlin` | Runs on CI |
| Apple Swift test fakes implement protocol | `swift test` | Runs on CI |
| Downstream types synced | Gen check by each library's typecheck task | Runs on CI |
| Live sandbox behavior (iOS 16.4+ message + Play suspended) | Manual, this document | Release QA |


---

# 📚 EXTERNAL API REFERENCE

Use this documentation for API details, but **ALWAYS adapt patterns to match Internal Rules above**.

---

<!-- Source: external/amazon-iap-api.md -->

# Amazon Appstore SDK IAP Reference

> Reference for the Fire OS `amazon` flavor in `packages/google`.
> Source: [Amazon Appstore SDK release notes](https://developer.amazon.com/docs/appstore-sdk/release-notes.html)

## Version Compatibility

| Component | Version | Notes |
| --- | --- | --- |
| Amazon Appstore SDK | **3.0.9** | Current official release (May 20, 2026) |
| OpenIAP Android flavor | `amazon` | Uses the native Appstore SDK, not Google Billing Compatibility |

Appstore SDK 3.0.9 adds `EXISTING_PURCHASE` and `NOT_ELIGIBLE`
fulfillment results and add-on subscription support. Add-on subscriptions are
available only to selected partners and require activation in Amazon Developer
Console.

## OpenIAP Mapping

| OpenIAP API | Amazon Appstore SDK |
| --- | --- |
| `initConnection()` | Register `PurchasingListener`, then request user data |
| `fetchProducts()` | `PurchasingService.getProductData()` |
| `requestPurchase()` | `PurchasingService.purchase()` |
| `getAvailablePurchases()` / restore | `PurchasingService.getPurchaseUpdates()` |
| `finishTransaction()` | `PurchasingService.notifyFulfillment(..., FULFILLED)` |

The Amazon flavor is isolated under
`packages/google/openiap/src/amazon/`. Google Play Billing APIs such as Billing
Programs, Billing Choice, suspended subscriptions, and in-app messages are not
available on this flavor.

## Pending Purchases

Amazon Kids can leave consumable or entitlement purchases waiting for parent
approval. Call `PurchasingService.enablePendingPurchases()` before initiating a
purchase; otherwise the app doesn't receive `PurchaseResponse.RequestStatus.PENDING`.
Do not grant an entitlement for a pending response. Poll purchase updates or use
Amazon Real-Time Notifications to learn when the parent approves it.

Pending purchases do not apply to subscriptions.

Reference: [Implement Pending Purchases](https://developer.amazon.com/docs/in-app-purchasing/implement-pending-purchases.html)

## Fulfillment

Always report the result after deciding whether the customer can access the
content:

| Result | Use |
| --- | --- |
| `FULFILLED` | The purchase was granted successfully |
| `EXISTING_PURCHASE` | The customer already has the relevant account/subscription |
| `NOT_ELIGIBLE` | The customer can't use the purchased service |
| `UNAVAILABLE` | The content couldn't be delivered |

Amazon immediately cancels and refunds the purchase when fulfillment is
reported as `EXISTING_PURCHASE`, `NOT_ELIGIBLE`, or `UNAVAILABLE`; callers must
not use these results as informational statuses.

OpenIAP currently maps successful `finishTransaction()` calls to `FULFILLED`.
The other 3.0.9 results need a deliberate cross-platform API contract before
they can be selected by callers.

Reference: [Implement Appstore SDK IAP](https://developer.amazon.com/docs/in-app-purchasing/iap-implement-iap.html)

## Add-On Subscriptions

Add-on subscriptions use the existing `getProductData`, `purchase`, purchase
updates, and fulfillment calls, but require Appstore SDK 3.0.9+, partner
activation, compatible base-subscription configuration, and server verification
of the RVS `baseReceipts` relationship. Treat them as unavailable unless Amazon
has enabled the feature for the app. In-app add-on purchases are currently
supported only on Fire TV; Fire tablets and Amazon's retail website do not offer
this purchase flow.

An add-on purchase requires an active base subscription. Amazon reports
`PurchaseResponse.RequestStatus.INACTIVE_BASE_SUBSCRIPTION` when that condition
is not met; OpenIAP surfaces it as `item-unavailable` and does not grant the
add-on.

Reference: [Set Up Add-On Subscriptions](https://developer.amazon.com/docs/in-app-purchasing/set-up-add-on-subscriptions.html)


---

<!-- Source: external/google-billing-api.md -->

# Google Play Billing Library API Reference

> Reference documentation for Google Play Billing Library 9.x
> Adapt all patterns to match OpenIAP internal conventions.

## Overview

Google Play Billing Library enables in-app purchases and subscriptions on Android devices.

## Version History

| Version | Release Date | Key Features                                                                                                                                           |
| ------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 8.0     | 2025-06-30   | Auto-reconnect, product-level status codes, one-time products with multiple offers, sub-response codes                                                 |
| 8.1     | 2025-11-06   | Suspended subscriptions (`isSuspended`), `includeSuspended` parameter, pre-order details, product-level subscription replacement, `KEEP_EXISTING` mode |
| 8.2     | 2025-12-09   | Billing Programs API (external content links, external offers), deprecates old External Offers API                                                     |
| 8.2.1   | 2025-12-15   | Bug fix for `isBillingProgramAvailableAsync()` and `createBillingProgramReportingDetailsAsync()`                                                       |
| 8.3     | 2025-12-23   | External Payments program (Japan only), developer billing options                                                                                      |
| 9.0     | 2026-05-19   | Removes older deprecated APIs, reclassifies blocked Play Store activity errors, adds richer sub-response handling, target SDK 35                       |
| 9.1     | 2026-06-18   | Billing Choice APIs: `getBillingChoiceInfoAsync()`, `showBillingProgramInformationDialog()`, choice-screen details                                     |

**Current Version**: 9.1.0 (as of July 2026)

> **OpenIAP audit note**: `packages/google` is pinned to Play Billing 9.1.0.
> Billing Choice APIs are implemented only in the Play flavor; Horizon and
> Amazon variants keep unsupported/default behavior for APIs that do not exist
> in their store SDKs.

### External Offer integration rule (8.2.1+)

Although the Billing Programs APIs were introduced in 8.2.0, Google requires
8.2.1 or later for External Offer integrations because 8.2.1 fixes the
availability and reporting-details APIs. The in-app sequence is:

1. Enable only `BillingProgram.EXTERNAL_OFFER` while building the client.
2. Check `isBillingProgramAvailableAsync`.
3. Call `createBillingProgramReportingDetailsAsync` immediately before each
   redirect session. Do not cache or reuse its external transaction token for a
   later redirect. Google permits the same token to report multiple purchases
   made during that one external-offer session.
4. Call `launchExternalLink` and proceed only when it succeeds.
5. If payment completes, report the transaction and token from the backend.

Do not also enable the deprecated `enableExternalOffer` or
`enableAlternativeBillingOnly` modes. Those legacy flows use different APIs
and must remain available only through explicit legacy configuration.

Official references: [External Offer in-app integration](https://developer.android.com/google/play/billing/external/integration),
[Play Billing release notes](https://developer.android.com/google/play/billing/release-notes).

## Core Classes

### BillingClient

The main interface for communicating with Google Play Billing.

```kotlin
val billingClient = BillingClient.newBuilder(context)
    .setListener(purchasesUpdatedListener)
    .enablePendingPurchases(
        PendingPurchasesParams.newBuilder()
            .enableOneTimeProducts()
            .build()
    )
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

> **OpenIAP Note**: Auto-reconnection is enabled internally when the Play
> Billing version exposes the API. No OpenIAP app-level configuration is needed.

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

billingClient.queryProductDetailsAsync(params) { billingResult, queryResult ->
    if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
        queryResult.productDetailsList.forEach { productDetails ->
            // Handle fetched product details
        }
        queryResult.unfetchedProductList.forEach { unfetchedProduct ->
            // Inspect unfetchedProduct.statusCode for per-product failures
        }
    }
}
```

### ProductDetails Properties

| Property                          | Type   | Description                                           |
| --------------------------------- | ------ | ----------------------------------------------------- |
| `productId`                       | String | Unique product identifier                             |
| `productType`                     | String | "subs" or "inapp"                                     |
| `title`                           | String | Localized product title                               |
| `name`                            | String | Product name                                          |
| `description`                     | String | Localized description                                 |
| `oneTimePurchaseOfferDetailsList` | List   | All INAPP purchase options and discount offers (8.0+) |
| `oneTimePurchaseOfferDetails`     | Object | Legacy single-offer compatibility accessor            |
| `subscriptionOfferDetails`        | List   | For subscription products                             |

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

| Property         | Type         | Description                     |
| ---------------- | ------------ | ------------------------------- |
| `orderId`        | String       | Unique order identifier         |
| `purchaseToken`  | String       | Token for verification          |
| `purchaseState`  | Int          | PENDING, PURCHASED, UNSPECIFIED |
| `purchaseTime`   | Long         | Timestamp in milliseconds       |
| `products`       | List<String> | Product IDs in purchase         |
| `isAcknowledged` | Boolean      | Whether acknowledged            |
| `isAutoRenewing` | Boolean      | Auto-renewal status             |
| `quantity`       | Int          | Quantity purchased              |

## Response Codes

| Code | Constant            | Description                              |
| ---- | ------------------- | ---------------------------------------- |
| 0    | OK                  | Success                                  |
| 1    | USER_CANCELED       | User cancelled                           |
| 2    | SERVICE_UNAVAILABLE | Billing service is currently unavailable |
| 3    | BILLING_UNAVAILABLE | Billing not available                    |
| 4    | ITEM_UNAVAILABLE    | Item not available                       |
| 5    | DEVELOPER_ERROR     | Invalid arguments                        |
| 6    | ERROR               | Fatal error                              |
| 7    | ITEM_ALREADY_OWNED  | Already owned                            |
| 8    | ITEM_NOT_OWNED      | Not owned                                |
| 12   | NETWORK_ERROR       | Network connection problem               |

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
billingClient.queryProductDetailsAsync(params) { billingResult, queryResult ->
    if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
        return@queryProductDetailsAsync
    }

    queryResult.productDetailsList.forEach { productDetails ->
        // Product fetched successfully
    }

    queryResult.unfetchedProductList.forEach { unfetchedProduct ->
        when (unfetchedProduct.statusCode) {
            UnfetchedProduct.StatusCode.PRODUCT_NOT_FOUND -> {
                // SKU doesn't exist in Play Console
            }
            UnfetchedProduct.StatusCode.NO_ELIGIBLE_OFFER -> {
                // User not eligible for any offers
            }
            UnfetchedProduct.StatusCode.INVALID_PRODUCT_ID_FORMAT,
            UnfetchedProduct.StatusCode.UNKNOWN -> {
                // Invalid request or an unspecified per-product failure
            }
        }
    }
}
```

| Status                      | Description                       |
| --------------------------- | --------------------------------- |
| `PRODUCT_NOT_FOUND`         | SKU doesn't exist in Play Console |
| `NO_ELIGIBLE_OFFER`         | User not eligible for any offers  |
| `INVALID_PRODUCT_ID_FORMAT` | Product ID format is invalid      |
| `UNKNOWN`                   | Unspecified per-product failure   |

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
override fun onPurchasesUpdated(result: BillingResult, purchases: List<Purchase>?) {
  when (result.onPurchasesUpdatedSubResponseCode) {
    BillingClient.OnPurchasesUpdatedSubResponseCode.PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS -> {
        // User's payment method has insufficient funds
    }
    BillingClient.OnPurchasesUpdatedSubResponseCode.USER_INELIGIBLE -> {
        // User doesn't meet offer eligibility requirements
    }
  }
}
```

| Sub-Response Code                            | Description                                      |
| -------------------------------------------- | ------------------------------------------------ |
| `PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS` | User's payment method has insufficient funds     |
| `USER_INELIGIBLE`                            | User doesn't meet subscription offer eligibility |
| `NO_APPLICABLE_SUB_RESPONSE_CODE`            | No specific sub-code applies                     |

PBL 9 makes sub-response-code handling part of the migration checklist. It also
changes blocked Play Store app cases from generic `ERROR` to
`BILLING_UNAVAILABLE`, with a debug message explaining that Play Store is
blocked.

> **OpenIAP Note**: Purchase failures delivered by
> `purchaseErrorListener` preserve this value as
> `PurchaseError.subResponseCodeAndroid` when Play supplies it. Available in
> OpenIAP Spec 2.3.0 / openiap-google 2.3.1 (requires Play Billing 8.0+).

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

| Mode                    | Description                           |
| ----------------------- | ------------------------------------- |
| `WITH_TIME_PRORATION`   | Immediate, expiration time prorated   |
| `CHARGE_PRORATED_PRICE` | Immediate, same billing cycle         |
| `CHARGE_FULL_PRICE`     | Immediate, full price charged         |
| `WITHOUT_PRORATION`     | Takes effect on old plan expiration   |
| `DEFERRED`              | Deferred, no charge                   |
| `KEEP_EXISTING`         | Keep existing payment schedule (8.1+) |

## User Choice Billing Details (9.1+ fields)

`UserChoiceBillingListener` receives `UserChoiceDetails` when the user selects
developer billing from Google's user-choice screen. Read product identifiers
from `UserChoiceDetails.Product.getId()`; `Product.toString()` is diagnostic
text and is not the product ID contract.

```kotlin
val listener = UserChoiceBillingListener { details ->
    val externalTransactionToken = details.externalTransactionToken
    val originalExternalTransactionId = details.originalExternalTransactionId
    val products = details.products.map { product ->
        Triple(product.id, product.type, product.offerToken)
    }
}
```

OpenIAP keeps the compatibility `products` ID list and also exposes
`productDetailsAndroid` with each product's ID, type, and optional offer token.
For a developer-billed subscription replacement, forward
`originalExternalTransactionId` together with the external transaction token
to the backend reporting flow. These two fields are available in OpenIAP Spec
2.3.0 / openiap-google 2.3.1 (requires Play Billing 9.1+).

## External Payments Program (8.3+)

Billing Library 8.3 (December 2025) added support for the External Payments program (Japan-only, as of launch). Developers enrolled in the program can offer alternative payment methods alongside Google Play billing.

### Enable Developer Billing Option

```kotlin
// During BillingClient setup
val billingClient = BillingClient.newBuilder(context)
    .setListener(purchasesUpdatedListener)
    .enablePendingPurchases(
        PendingPurchasesParams.newBuilder()
            .enableOneTimeProducts()
            .build()
    )
    .enableAutoServiceReconnection()
    .enableBillingProgram(
        EnableBillingProgramParams.newBuilder()
            .setBillingProgram(BillingClient.BillingProgram.EXTERNAL_PAYMENTS)
            .setDeveloperProvidedBillingListener(developerBillingListener)
            .build()
    )
    .build()
```

### DeveloperProvidedBillingListener

```kotlin
val developerBillingListener = DeveloperProvidedBillingListener { details ->
    // All nullable fields depend on the selected program and flow.
    val token: String? = details.externalTransactionToken
    val linkUri: String? = details.linkUri
    val originalTransactionId: String? = details.originalExternalTransactionId
    val products: List<DeveloperProvidedBillingDetails.Product> = details.products
}
```

### Launch Purchase with External Payments Option

```kotlin
val params = BillingFlowParams.newBuilder()
    .setProductDetailsParamsList(listOf(productDetailsParams))
    .enableDeveloperBillingOption(
        DeveloperBillingOptionParams.newBuilder()
            .setBillingProgram(BillingClient.BillingProgram.EXTERNAL_PAYMENTS)
            .setLinkUri(Uri.parse("https://example.com/checkout"))
            .setLaunchMode(
                DeveloperBillingOptionParams.LaunchMode.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP
            )
            .build()
    )
    .build()

billingClient.launchBillingFlow(activity, params)
```

### Key Types (8.3+)

| Type                                             | Purpose                                                       |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `DeveloperBillingOptionParams`                   | Configures developer billing on `BillingFlowParams`           |
| `DeveloperProvidedBillingListener`               | Callback when user picks developer-provided billing           |
| `DeveloperProvidedBillingDetails`                | Nullable token/link/original-ID fields plus selected products |
| `BillingClient.BillingProgram.EXTERNAL_PAYMENTS` | External Payments program constant                            |

> **OpenIAP Note**: Exposed through `enableBillingProgramAndroid`,
> `developerBillingOption`, and the developer-provided billing listener.
> Enrolment with Google Play's External Payments program is required;
> availability is currently restricted to Japan. Horizon and Amazon do not
> implement this Google Play program.

## Billing Choice (9.1+)

Billing Library 9.1 adds APIs for markets and programs where either Google Play
or the app renders a billing choice screen.

### Integration Scenarios

| Scenario | Choice renderer | Developer payment | BillingClient setup                                                  | Required flow                                                                                                         |
| -------- | --------------- | ----------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1A       | Google          | In app            | `EnableBillingProgramParams` with `DeveloperProvidedBillingListener` | Pass a minimal `DeveloperBillingOptionParams`; Play returns the token through the listener                            |
| 1B       | Developer       | In app            | `EnableBillingProgramParams` without the listener                    | Fetch choice info, create an `IN_APP` token, show the information dialog, then render the choice UI                   |
| 2A       | Google          | External link     | `EnableBillingProgramParams` with `DeveloperProvidedBillingListener` | Create an `EXTERNAL_LINK` token and pass it with the URI through `DeveloperBillingOptionParams`                       |
| 2B       | Developer       | External link     | `EnableBillingProgramParams` without the listener                    | Fetch choice info, create an `EXTERNAL_LINK` token, render the choice UI, then pass the token to `launchExternalLink` |

The setup must match `choiceScreenType` from Play Console. Registering the
listener in a developer-rendered integration is not equivalent to omitting it.

| API / Type                                                           | Purpose                                                                      |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `BillingClient.getBillingChoiceInfoAsync()`                          | Fetches billing choices available to the current user                        |
| `BillingChoiceInfo`                                                  | Contains choice-screen data, including image URLs and loyalty details        |
| `GetBillingChoiceInfoParams`                                         | Configures the billing-choice info request                                   |
| `BillingClient.showBillingProgramInformationDialog()`                | Shows an information dialog for a billing program                            |
| `BillingProgramInformationDialogParams`                              | Configures the information dialog                                            |
| `LaunchExternalLinkParams.setExternalTransactionToken()`             | Supplies the pre-generated token for a developer-rendered external-link flow |
| `BillingProgramAvailabilityDetails.BillingChoiceAvailabilityDetails` | Returns choice-screen type and external-link availability                    |
| `DeveloperBillingOptionParams`                                       | Selects in-app or external-link developer billing during purchase            |
| `BillingProgramReportingDetailsParams.DeveloperBillingType`          | Distinguishes `IN_APP` and `EXTERNAL_LINK` reporting                         |

### Developer Billing Purchase Options

Only `billingProgram` is required for an in-app Billing Choice flow:

```kotlin
val inAppChoice = DeveloperBillingOptionParams.newBuilder()
    .setBillingProgram(BillingClient.BillingProgram.BILLING_CHOICE)
    .build()
```

For a Google-rendered external-link flow, also set the URI, launch mode, and the
pre-generated `EXTERNAL_LINK` transaction token:

```kotlin
val externalLinkChoice = DeveloperBillingOptionParams.newBuilder()
    .setBillingProgram(BillingClient.BillingProgram.BILLING_CHOICE)
    .setLinkUri(Uri.parse("https://example.com/checkout"))
    .setLaunchMode(DeveloperBillingOptionParams.LaunchMode.CALLER_WILL_LAUNCH_LINK)
    .setExternalTransactionToken(preGeneratedToken)
    .build()
```

### Developer-Rendered Choice Information

```kotlin
val params = GetBillingChoiceInfoParams.newBuilder()
    .setBillingProgram(BillingClient.BillingProgram.BILLING_CHOICE)
    .setPlayBillingChoiceImageLayout(
        GetBillingChoiceInfoParams.ImageLayout.RECTANGULAR_FOUR_BY_ONE
    )
    .setUserLocale(Locale.forLanguageTag("en-US"))
    .build()

billingClient.getBillingChoiceInfoAsync(params) { result, info ->
    if (result.responseCode == BillingClient.BillingResponseCode.OK) {
        val imageUrl = info.playBillingChoiceImageUrl
        val loyaltyText = info.playBillingLoyaltyInfo
    }
}
```

Supported image layouts are `RECTANGULAR_FOUR_BY_ONE`,
`RECTANGULAR_THREE_BY_ONE`, and `RECTANGULAR_TWO_BY_TWO`.

### Availability Details

For `BILLING_CHOICE`, `BillingProgramAvailabilityDetails` can include:

| Field                     | Meaning                                                   |
| ------------------------- | --------------------------------------------------------- |
| `choiceScreenType`        | `UNSPECIFIED`, `DEVELOPER_RENDERED`, or `GOOGLE_RENDERED` |
| `isExternalLinkAvailable` | Whether the user is eligible for an external-link option  |

### Information Dialog

For developer-rendered in-app choice (scenario 1B), call
`showBillingProgramInformationDialog()` before showing the app's choice UI. It
is a UI-thread API and returns through its listener; it does not return a
synchronous `BillingResult`:

```kotlin
val params = BillingProgramInformationDialogParams.newBuilder()
    .setBillingProgram(BillingClient.BillingProgram.BILLING_CHOICE)
    .setExternalTransactionToken(externalTransactionToken)
    .build()

billingClient.showBillingProgramInformationDialog(activity, params) { result ->
    // Continue according to result.responseCode.
}
```

### Developer-Billed Subscription Replacement

Use the original external transaction ID instead of an old Play purchase token
when replacing a subscription bought through developer billing:

```kotlin
val updateParams = BillingFlowParams.SubscriptionUpdateParams.newBuilder()
    .setOriginalExternalTransactionId(originalExternalTransactionId)
    .build()
```

> **OpenIAP Note**: OpenIAP exposes these through `BILLING_CHOICE`,
> `getBillingChoiceInfoAndroid`, `showBillingProgramInformationDialogAndroid`,
> `launchExternalLinkAndroid`, `developerBillingOption`,
> `originalExternalTransactionId`, and the expanded developer-provided billing
> callback. Set `InitConnectionConfig.billingChoiceScreenTypeAndroid` to
> `GOOGLE_RENDERED` (default) or `DEVELOPER_RENDERED` so OpenIAP includes or
> omits the listener correctly. Play-only APIs return unsupported/default
> behavior on Horizon and Amazon.

## In-App Billing Messages (4.1+)

`showInAppMessages()` must run on the UI thread. It returns a synchronous
`BillingResult` for submission errors and reports the user interaction through
`InAppMessageResponseListener`.

## PBL 9 Migration Guardrails

- Replace removed APIs: `SkuDetails`, `SkuDetailsParams`, `SkuDetailsResponseListener`, `BillingClient.SkuType`, `querySkuDetailsAsync()`, no-argument `enablePendingPurchases()`, and string `queryPurchasesAsync()`.
- Use `ProductDetails`, `QueryProductDetailsParams`, `BillingClient.ProductType`, parameterized `enablePendingPurchases(PendingPurchasesParams)`, and `queryPurchasesAsync(QueryPurchasesParams, ...)`.
- Handle `DeveloperProvidedBillingDetails.getExternalTransactionToken()`,
  `getLinkUri()`, and `getOriginalExternalTransactionId()` as nullable.
- Preserve every `DeveloperProvidedBillingDetails.Product` (`id`, `type`, and
  nullable `offerToken`) from the callback.
- Keep Horizon shared code on the Billing 7.0-compatible API subset; put PBL 8/9 code in Play-only sources or behind reflection.

## Best Practices

1. **Always acknowledge purchases** within 3 days or they will be refunded
2. **Verify purchases server-side** using Google Play Developer API
3. **Handle pending purchases** for payment methods that require additional steps
4. **Auto-reconnect is enabled by default** in OpenIAP when available (8.0+)
5. **Check product status codes** (8.0+) to understand why products weren't fetched
6. **Check isSuspended** (8.1+) before granting entitlements
7. **Distinguish in-app and external-link Billing Choice** when configuring and reporting developer billing
8. **Query fresh ProductDetails before purchase**; stale objects can make `launchBillingFlow()` fail


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
| horizon-billing-compatibility | **2.0.0** (latest) | Google Play Billing **7.0** API |
| Google Play Billing (upstream latest) | **9.1.0** | N/A |
| Google Play Billing (OpenIAP Play flavor) | **9.1.0** | N/A |
| react-native-iap | v14+ | Billing 7.0+, RN 0.79+, Kotlin 2.0+ |
| expo-iap | latest | Billing 7.0+, Kotlin 2.0+ |

**CRITICAL**: Horizon Billing Compatibility SDK implements Google Play Billing **7.0** API surface, NOT 8.x or 9.x.

When writing shared code for both Play and Horizon flavors:
- Use only APIs that exist in **both** Billing 7.0 and the Play-flavor Billing version
- Horizon SDK does NOT support Billing 8.x/9.x features like auto-reconnect, product status codes, `includeSuspended`, or Billing Choice
- OpenIAP handles this automatically with flavor-specific implementations

### Latest Horizon Billing Release

Meta released Horizon Billing Compatibility Library **2.0.0** on 2026-01-06.
The release notes call out a fix for querying subscription purchases with a
single billing plan and dependencies on Horizon Platform SDK Kotlin
`iap-kotlin` 0.2.0 and `core-kotlin` 0.2.0.

OpenIAP uses `horizon-billing-compatibility` 2.0.0 and its transitive Horizon
Platform Kotlin SDK modules. The Horizon flavor is compiled and tested
separately, including subscription-purchase restore coverage. Play Billing
9.1.0 features remain Play-flavor-only because Horizon compatibility still
targets the Billing 7.0 API surface.

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

### APIs Only in Billing 9.x (DO NOT use in shared code)

- Billing Choice information APIs (`getBillingChoiceInfoAsync`, `BillingChoiceInfo`, `ChoiceScreenType`)
- Billing-program information dialog APIs (`showBillingProgramInformationDialog`)
- PBL 9 migration assumptions around APIs removed from the Billing 7.0 surface

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

- Horizon Billing Compatibility 2.x reads the app id from Android manifest
  meta-data key `com.meta.horizon.platform.HORIZON_APP_ID`. The older
  `com.meta.horizon.platform.ovr.OCULUS_APP_ID` key is deprecated; OpenIAP also
  accepts it and other historical keys only for migration compatibility.
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

<!-- Source: external/storekit2-api.md -->

# StoreKit 2 API Reference

This document provides external API reference for Apple's StoreKit 2 framework.

## Recent StoreKit Features

| Feature                                                        | iOS Version                        | Description                                                                                         |
| -------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| Win-back offers                                                | iOS 18.0                           | Re-engage churned subscribers                                                                       |
| `Product.SubscriptionInfo.RenewalInfo.eligibleWinBackOfferIDs` | iOS 18.0                           | Query win-back offer eligibility before purchase                                                    |
| Consumable transaction history                                 | iOS 18.0                           | Opt-in via `SKIncludeConsumableInAppPurchaseHistory` Info.plist key                                 |
| StoreKit `Message.billingIssue`                                | iOS / Mac Catalyst 16.4, visionOS 1.0 | Listener for subscription billing issues (`Message` is unavailable on macOS, tvOS, and watchOS)   |
| UI context for purchases                                       | iOS 18.2                           | Required for proper payment sheet display                                                           |
| External purchase notice                                       | iOS 17.4                           | `ExternalPurchase.presentNoticeSheet()`                                                             |
| `appTransactionID`                                             | iOS 18.4                           | Globally unique app transaction identifier (back-deployed to iOS 15)                                |
| `originalPlatform`                                             | iOS 18.4                           | Original purchase platform (back-deployed to iOS 15)                                                |
| `Transaction.offerPeriod`                                      | iOS 18.4                           | Offer period information on Transaction                                                             |
| `Transaction.advancedCommerceInfo`                             | iOS 18.4                           | Advanced Commerce API data on Transaction                                                           |
| `Transaction.appTransactionID`                                 | iOS 18.4                           | Per-Apple-Account identifier on Transaction                                                         |
| Expanded offer codes                                           | iOS 18.4                           | Offer codes for consumables/non-consumables                                                         |
| JWS promotional offers                                         | WWDC 2025                          | New `promotionalOffer` purchase option with JWS format                                              |
| `introductoryOfferEligibility`                                 | WWDC 2025                          | Set eligibility via purchase option                                                                 |
| `SubscriptionStatus` by Transaction ID                         | WWDC 2025                          | `status(for: transactionID:)`                                                                       |
| Monthly subscriptions with a 12-month commitment               | iOS 26.4+ runtime / Xcode 26.5 SDK | Monthly billing option for annual auto-renewable subscriptions                                      |
| Subscription Bundles and Suites                               | Apple 27 / Xcode 27 beta SDK       | Read-only product, bundled-subscription, transaction, and renewal metadata                           |
| Bundle ownership and revocation metadata                      | Xcode 27 beta SDK                   | Back-deployed assigned ownership, bundle-upgrade reason, assignment revocation, and unbundling data  |
| `AppTransaction.storeType`, `revocationDate`                  | Xcode 27 beta SDK                   | App-acquisition channel and back-deployed revocation timestamp                                       |
| `AppTransaction.all`                                          | Apple 27 / Xcode 27 beta SDK       | Async sequence of app-acquisition records; not exported as an OpenIAP 3 operation                    |
| `AppStore.Platform.managed`                                   | Xcode 27 beta SDK                   | Back-deployed managed-distribution acquisition platform                                              |
| Advanced Commerce item partners                               | Apple 27 / Xcode 27 beta SDK       | Partner identifiers and names in each item-details JSON payload                                      |
| Group purchases and volume purchasing                          | Announced at WWDC 2026             | Group Purchases are planned for later in 2026; Xcode 27 beta 4 has no public StoreKit group API      |
| Retention Messaging                                            | WWDC 2026                          | Cancellation-flow messaging and offers, including real-time server decisioning                      |
| Retention offer type                                           | WWDC 2026                          | Signed transaction / renewal info can report offer type `5` for retention offers                    |
| Offer codes for all IAP types                                  | 2026                               | Offer codes expand beyond auto-renewable subscriptions; IAP promo-code creation ends March 26, 2026 |

### StoreKit Message presentation

Iterating `Message.messages` transfers presentation control to the app. A
listener that only inspects `Message.Reason.billingIssue` must not silently
discard other reasons such as price-increase consent or win-back offers. Display
each message with `message.display(in:)` unless the app intentionally implements
and documents a custom delay or suppression policy. OpenIAP preserves StoreKit's
default presentation while additionally emitting its cross-platform billing
issue event.

### WWDC 2025 Updates

- **SubscriptionStatus by Transaction ID**: `SubscriptionInfo.Status.status(for: transactionID:)` accepts any transaction ID, not just SKU.
- **JWS-based promotional offers**: New `promotionalOffer` purchase option with compact JWS string.
- **Introductory offer eligibility**: Override eligibility check with `introductoryOfferEligibility` purchase option.
- Both new purchase options are back-deployed to iOS 15.

### WWDC 2026 Updates

- **Monthly subscriptions with a 12-month commitment**: The Xcode 26.5 SDK adds a monthly billing plan for one-year auto-renewable subscriptions. Customers can subscribe on iOS, iPadOS, macOS, tvOS, and visionOS 26.4+.
- **Subscription Bundles and Suites**: The Xcode 27 beta SDK exposes read-only product types, component-subscription metadata, bundle transaction identifiers, and renewal unbundling state. OpenIAP maps these fields without inventing enrollment, seat, or management operations.
- **Bundle ownership and revocation metadata**: StoreKit can report assigned ownership, a bundle-upgrade revocation reason, assignment revocation type, and an unbundled expiration reason. OpenIAP preserves these values without adding assignment-management operations.
- **App acquisition and Advanced Commerce metadata**: `AppTransaction.storeType` reports the acquisition channel, `revocationDate` reports a revoked app acquisition, `AppStore.Platform.managed` identifies managed distribution, and Advanced Commerce item details expose partner identifiers and names.
- **App-acquisition history**: StoreKit exposes `AppTransaction.all` as an async sequence. OpenIAP 3 does not export it because app-acquisition history is a different contract from the in-app transaction history returned by `getAllTransactionsIOS`.
- **Presentation and refund errors**: The Xcode 27 SDK adds `StoreKitError.invalidPresentationContext` and `RefundRequestError.ineligible`. OpenIAP keeps these inside its canonical `PurchaseError` boundary instead of expanding the cross-platform error enum with Apple-only cases.
- **Group purchases and volume purchasing**: Apple announced multi-seat subscriptions and an Apple-managed invitation flow. Group Purchases are scheduled for later in 2026 and Xcode 27 beta 4 does not expose a public StoreKit group-purchase contract. Volume purchasing is managed through Apple Business Manager and Apple School Manager.
- **Volume pricing**: App Store Connect can configure up to five seat-count price bands for larger subscription purchases.
- **Retention Messaging**: App Store Connect can show cancellation-flow retention messages and offers. Real-time Retention Messaging adds a server-to-server decision point and supports a switch-plan view for monthly subscriptions with a 12-month commitment.
- **Offer-code expansion**: Offer codes now support consumables, non-consumables, non-renewing subscriptions, and broader auto-renewable subscription scenarios. Starting March 26, 2026, App Store Connect no longer creates new promo codes for In-App Purchases.

### Verified Offer-Code Redemption (WWDC 2026)

The new UIKit/AppKit redemption API accepts `RedeemOption` values and returns
the redeemed transaction as a `VerificationResult<Transaction>`:

```swift
let result = try await AppStore.presentOfferCodeRedeemSheet(
    from: viewController,
    options: []
)
```

SwiftUI exposes the same result through
`offerCodeRedemption(options:isPresented:onCompletion:)`. These APIs require the
Xcode 27 beta SDK and are currently beta. Xcode 26.x SDKs expose only the
legacy redemption sheet API.

OpenIAP 3 changes `presentCodeRedemptionSheetIOS` to return `PurchaseIOS?`.
Xcode 27 builds call the new API, require a verified result, and return the
mapped transaction. Xcode 26 builds retain the legacy sheet; iOS and Mac
Catalyst 14–26 therefore return `nil` after presentation and rely on the
transaction listener or explicit purchase reconciliation. Xcode 27 beta 4
declares `RedeemOption`, but its public symbol graph exposes no constructible
option values, so OpenIAP currently passes an empty set.

### Subscription Bundles and Suites (Xcode 27 beta)

StoreKit 27 introduces two subscription product kinds:

- `subscriptionBundle`: independently purchasable subscriptions sold together.
- `subscriptionSuite`: subscriptions available only as one suite.

OpenIAP treats both as cross-platform `subs` products and preserves the detailed
Apple value through `ProductTypeIOS.subscriptionBundle` or
`ProductTypeIOS.subscriptionSuite`. `ProductSubscriptionIOS` also exposes
`bundledSubscriptionsIOS`, including each component's identity, display
metadata, price, Family Sharing state, and subscription-group metadata.

Existing transaction and renewal APIs return the Apple bundle linkage without
adding a new purchase operation:

- `PurchaseIOS.bundleOriginalTransactionIdIOS`,
  `bundleProductIdIOS`, `bundleSubscriptionGroupIdIOS`,
  `bundleTransactionIdIOS`, and `previousOriginalTransactionIdIOS`.
- `RenewalInfoIOS.bundleOriginalTransactionId`, `bundleProductId`,
  `bundleSubscriptionGroupId`, and `willUnbundle`.
- `PurchaseIOS.ownershipTypeIOS` can report `assigned`,
  `revocationReasonIOS` can report `upgraded_to_bundle`, and
  `revocationTypeIOS` preserves StoreKit's raw revocation type, including
  assignment revocation.
- `RenewalInfoIOS.expirationReason` preserves StoreKit's raw integer string,
  including the Xcode 27 SDK's back-deployed `unbundled` case.
- `AppTransaction.storeType` and `revocationDate`; `originalPlatform` can
  report the back-deployed `managed` acquisition platform.
- Advanced Commerce item-details JSON includes `partners` on Apple 27.

These fields are compiled only with the Xcode 27 SDK. StoreKit back-deploys the
transaction and renewal bundle metadata where Apple declares it available, but
the new product kinds and bundled-product catalog require Apple 27 runtimes.
Test the catalog and transaction mappings with an Xcode 27 StoreKit
configuration before using beta metadata in production logic.

StoreKit 27 also exposes `AppTransaction.all`. OpenIAP 3 intentionally keeps
`getAppTransactionIOS` as the current verified app-acquisition record and
`getAllTransactionsIOS` as in-app transaction history; it does not conflate
either API with Apple's new app-acquisition history sequence.

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
if transaction.appAccountToken != nil {
    // Token will only be present if a valid UUID was provided during purchase
    print("App Account Token available")
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

Discover eligible win-back offers before purchase via
`Product.SubscriptionInfo.RenewalInfo.eligibleWinBackOfferIDs` (iOS 18+):

```swift
let status = try await product.subscription?.status.first
guard let renewalInfo = try status?.renewalInfo.payloadValue else { return }

// iOS 18+: offer IDs the current Apple Account is eligible for
let eligibleIDs = renewalInfo.eligibleWinBackOfferIDs
let eligibleOffers = (product.subscription?.winBackOffers ?? []).filter {
    eligibleIDs.contains($0.id ?? "")
}
```

> **OpenIAP gap**: callers can apply a known win-back offer identifier, but the
> public product/renewal types do not yet expose `winBackOffers` or
> `eligibleWinBackOfferIDs` for discovery.

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

// Public in the Xcode 27 SDK and back-deployed to these existing runtimes
let revocationDate = appTransaction.revocationDate        // App-acquisition revocation
let storeType = appTransaction.storeType                  // Acquisition store channel
```

### appTransactionID

- Globally unique identifier for each Apple Account that downloads your app
- Remains consistent across redownloads, refunds, repurchases, and storefront changes
- Works with Family Sharing (each family member gets unique ID)
- Back-deployed to iOS 15

The Xcode 27 SDK also adds the back-deployed `managed` platform case, which
OpenIAP returns through `originalPlatform`, and exposes `revocationDate` for
revoked app-acquisition records. `storeType` identifies consumer, education,
enterprise, or a future StoreKit acquisition channel.

## Transaction Updates (iOS 18.4+)

iOS 18.4 added three new read-only properties to `Transaction` (not just `AppTransaction`):

```swift
let transaction: Transaction

// iOS 18.4+ — all back-deployed to iOS 15
let txAppTransactionID = transaction.appTransactionID        // Apple Account identifier
let offerPeriod = transaction.offerPeriod                    // Offer.Period?
let advancedCommerce = transaction.advancedCommerceInfo      // AdvancedCommerceInfo?
```

| Property               | Type                  | Notes                                   |
| ---------------------- | --------------------- | --------------------------------------- |
| `appTransactionID`     | String                | Mirrors AppTransaction's identifier     |
| `offerPeriod`          | Offer.Period?         | Phase of the promotional/intro offer    |
| `advancedCommerceInfo` | AdvancedCommerceInfo? | Present for Advanced Commerce SKUs only |

## Advanced Commerce API (iOS 18.4+)

For apps with large product catalogs:

```swift
// Check if product has advanced commerce info
if let advancedInfo = product.advancedCommerceInfo {
    // Handle large catalog monetization
}
```

## Monthly Subscriptions With 12-Month Commitment (iOS 26.4+)

This billing plan lets customers pay monthly while committing to an annual
auto-renewable subscription. Apps need to compile with the Xcode 26.5 SDK to
merchandise the plan, and customers can purchase on Apple platforms running
26.4 or later.

```swift
let result = try await product.purchase(options: [
    .billingPlanType(.monthly)
])
```

> **OpenIAP Note**: The schema represents this with
> `SubscriptionBillingPlanTypeIOS` and `RequestSubscriptionIosProps.billingPlanType`.

## Group Purchases and Volume Purchasing (WWDC 2026)

Apple announced multi-seat auto-renewable subscriptions for groups or
organizations, with an Apple-managed invitation flow. Volume purchasing is
handled by Apple Business Manager and Apple School Manager.

Group Purchases are planned for later in 2026. The Xcode 27 beta 4 StoreKit
module and its public symbol graph expose no group-purchase request option,
seat-count field, transaction property, or group-management identifier.
OpenIAP must not invent a schema contract before Apple publishes one. Add the
feature only after a public SDK symbol can be compiled, exercised with StoreKit
Testing, and mapped consistently across every OpenIAP language target.

## Retention Messaging (WWDC 2026)

Retention Messaging lets App Store Connect present messages and optional offers
when a subscriber is about to cancel. Real-time Retention Messaging can call a
server endpoint so the developer can choose the message, offer, or switch-plan
view at cancellation time.

Signed transaction and renewal information can include a retention offer as
offer type `5`.

## StoreKit Message API (iOS 16.0+; billing issue on iOS 16.4+; win-back on iOS 18+)

Listen for App Store–generated messages (billing issues, win-back offers, price increases, generic).

```swift
// Somewhere near app launch. This all-cases sample targets iOS 18+.
Task {
    for await message in Message.messages {
        switch message.reason {
        case .billingIssue:
            // Show UI when user is ready; display from message.display(in:)
            break
        case .winBackOffer:
            break
        case .priceIncreaseConsent:
            break
        case .generic:
            break
        @unknown default:
            break
        }
    }
}
```

| Reason                  | Availability | Trigger                                                  |
| ----------------------- | ------------ | -------------------------------------------------------- |
| `.billingIssue`         | iOS 16.4+    | User has an unresolved billing problem on a subscription |
| `.priceIncreaseConsent` | iOS 16.0+    | Price change that requires user consent                  |
| `.winBackOffer`         | iOS 18.0+    | User is eligible for a win-back offer                    |
| `.generic`              | iOS 16.0+    | All other system-initiated messages                      |

> **OpenIAP Note**: OpenIAP displays every StoreKit message and additionally
> surfaces `.billingIssue` through `subscriptionBillingIssue`; other reasons
> are not separate OpenIAP events.

## SubscriptionStatus by Transaction ID (WWDC 2025)

```swift
// WWDC 2025: look up status using any transactionID, not just a SKU
let status = try await Product.SubscriptionInfo.Status.status(for: transactionID)
```

## Consumable Transaction History (iOS 18+)

By default, `Transaction.all` omits finished consumables. Opt in by adding this key to **Info.plist**:

```xml
<key>SKIncludeConsumableInAppPurchaseHistory</key>
<true/>
```

With the key set, finished consumable transactions are included in
`Transaction.all`, `Transaction.latest(for:)`, and `Product.latestTransaction`.

## External Purchase Support (iOS 17.4+)

`ExternalPurchase.presentNoticeSheet()` / `ExternalPurchaseLink.open(url:)`
ship on iOS 17.4+. The follow-on custom-link APIs
(`ExternalPurchaseCustomLink.isEligible`, `showNotice(type:)`,
`token(for:)`) are iOS 18.1+.

### Present External Purchase Notice

```swift
// Check if external purchase notice can be presented
if await ExternalPurchase.canPresent {
    let result = try await ExternalPurchase.presentNoticeSheet()
    switch result {
    case .continuedWithExternalPurchaseToken(let token):
        // Send the token to your backend reporting flow
        preserveForBackend(token)
    case .cancelled:
        break
    }
}
```

### Present External Purchase Link

```swift
try await ExternalPurchaseLink.open(url: externalURL)
```

> **OpenIAP Note**: `presentExternalPurchaseNoticeSheetIOS` is available on
> iOS 17.4+ and macOS 14.4+. The current
> `presentExternalPurchaseLinkIOS` implementation uses `UIApplication` and is
> not supported on macOS.


---

<!-- Source: external/webhook-mapping.md -->

# IAPKit Internal Webhook Mapping (ASN v2 ↔ RTDN)

This document is the source of truth for how kit normalizes Apple App Store Server
Notifications v2 (ASN v2) and Google Play Real-Time Developer Notifications (RTDN)
for its internal subscription state machine and persisted event records. These
types are not part of the OpenIAP native or framework SDK contract.

Kit's inbound receivers and internal state machine MUST follow this table. When
adding an internal lifecycle type or store source, update this document and the
corresponding normalization tests in the same PR.

## Subscription lifecycle

| IAPKit internal event type   | Apple ASN v2 `notificationType` (`subtype`)         | Google RTDN `subscriptionNotification.notificationType`                                                                                               |
| ---------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SubscriptionStarted`        | `SUBSCRIBED` (`INITIAL_BUY`, `RESUBSCRIBE`)         | `SUBSCRIPTION_PURCHASED` (4)                                                                                                                          |
| `SubscriptionRenewed`        | `DID_RENEW`                                         | `SUBSCRIPTION_RENEWED` (2)                                                                                                                            |
| `SubscriptionExpired`        | `EXPIRED`                                           | `SUBSCRIPTION_EXPIRED` (13)                                                                                                                           |
| `SubscriptionInGracePeriod`  | `DID_FAIL_TO_RENEW` (`GRACE_PERIOD`)                | `SUBSCRIPTION_IN_GRACE_PERIOD` (6)                                                                                                                    |
| `SubscriptionInBillingRetry` | `DID_FAIL_TO_RENEW` (no subtype)                    | `SUBSCRIPTION_ON_HOLD` (5)                                                                                                                            |
| `SubscriptionRecovered`      | `DID_RENEW` (after a prior failure)                 | `SUBSCRIPTION_RECOVERED` (1)                                                                                                                          |
| `SubscriptionCanceled`       | `DID_CHANGE_RENEWAL_STATUS` (`AUTO_RENEW_DISABLED`) | `SUBSCRIPTION_CANCELED` (3)                                                                                                                           |
| `SubscriptionUncanceled`     | `DID_CHANGE_RENEWAL_STATUS` (`AUTO_RENEW_ENABLED`)  | `SUBSCRIPTION_RESTARTED` (7) — fired when auto-renew is re-enabled while the period is still active                                                   |
| `SubscriptionRevoked`        | `REVOKE`                                            | `SUBSCRIPTION_REVOKED` (12)                                                                                                                           |
| `SubscriptionPriceChange`    | `PRICE_INCREASE`                                    | `SUBSCRIPTION_PRICE_CHANGE_CONFIRMED` (8), `SUBSCRIPTION_PRICE_CHANGE_UPDATED` (19)                                                                   |
| `SubscriptionProductChanged` | `DID_CHANGE_RENEWAL_PREF`                           | `SUBSCRIPTION_DEFERRED` (9)                                                                                                                           |
| `SubscriptionPaused`         | (no equivalent — iOS has no pause)                  | `SUBSCRIPTION_PAUSED` (10), `SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED` (11) — schedule update, not actual resume                                           |
| `SubscriptionResumed`        | (no equivalent)                                     | `SUBSCRIPTION_RECOVERED` (1) when fired after a `SUBSCRIPTION_PAUSED` — kit chooses Resumed vs Recovered based on the prior `subscriptions` row state |

PR #123 review caught the earlier draft where codes 1 and 4 were swapped
(`SUBSCRIPTION_RECOVERED` is code 1, `SUBSCRIPTION_PURCHASED` is code 4)
and where `SUBSCRIPTION_RESTARTED` (7) was incorrectly mapped to
`SubscriptionRecovered` instead of `SubscriptionUncanceled`. The mapping
above reflects the corrected RTDN reference.

## One-time / common

| IAPKit internal event type   | Apple ASN v2          | Google RTDN                                                                                                    |
| ---------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `PurchaseRefunded`           | `REFUND`              | `oneTimeProductNotification.notificationType = ONE_TIME_PRODUCT_CANCELED` (2), or `voidedPurchaseNotification` |
| `PurchaseConsumptionRequest` | `CONSUMPTION_REQUEST` | (no equivalent — Play handles consumption client-side)                                                         |
| `TestNotification`           | `TEST`                | `testNotification` field present on the RTDN message                                                           |

## Field mapping

| Internal event field | Apple ASN v2 source                                                                                                                                       | Google RTDN source                                                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                 | `notificationUUID`                                                                                                                                        | Pub/Sub `messageId`                                                                                                                                                                      |
| `occurredAt`         | `signedDate`                                                                                                                                              | `eventTimeMillis`                                                                                                                                                                        |
| `environment`        | `data.environment` (`Production` \| `Sandbox` \| `Xcode`)                                                                                                 | `testNotification` present → `Sandbox`, else `Production`                                                                                                                                |
| `purchaseToken`      | `data.signedTransactionInfo.originalTransactionId`                                                                                                        | `subscriptionNotification.purchaseToken` or `oneTimeProductNotification.purchaseToken`                                                                                                   |
| `productId`          | `data.signedTransactionInfo.productId`                                                                                                                    | `subscriptionNotification.subscriptionId` or `oneTimeProductNotification.sku`                                                                                                            |
| `expiresAt`          | `data.signedRenewalInfo.expirationDate` (decoded JWS)                                                                                                     | resolved by calling `purchases.subscriptionsv2.get` (ASN/RTDN do not embed it directly)                                                                                                  |
| `renewsAt`           | `data.signedRenewalInfo.renewalDate`                                                                                                                      | resolved by calling `purchases.subscriptionsv2.get`                                                                                                                                      |
| `cancellationReason` | `data.signedTransactionInfo.revocationReason` + ASN `subtype`                                                                                             | `purchases.subscriptionsv2.get` → `canceledStateContext.userInitiatedCancellation` / `systemInitiatedCancellation`                                                                       |
| `currency`           | `data.signedTransactionInfo.currency`                                                                                                                     | from `purchases.subscriptionsv2.get` linked product price                                                                                                                                |
| `priceAmountMicros`  | `data.signedTransactionInfo.price` × 1000 (Apple's `price` field is in **milliunits** = 1/1000 of a currency unit; multiply by 1000 to convert to micros) | `purchases.subscriptionsv2.get` → `lineItems[*].autoRenewingPlan.recurringPrice` — `units * 1_000_000 + Math.round(nanos / 1000)` (Money type combines whole units + nanos = 10⁻⁹ units) |
| `rawSignedPayload`   | The complete `signedPayload` JWS string from the ASN body                                                                                                 | The base64-decoded Pub/Sub message `data` (JSON)                                                                                                                                         |

## Validation requirements

Both stores require signature verification before any event is accepted:

- **Apple ASN v2**: verify the JWS certificate chain against IAPKit's embedded
  Apple public root certificates. Online OCSP/CRL checks are disabled so
  transient network failures do not create webhook retry storms. The receiver
  rejects an invalid signature with HTTP 400 as a permanent payload failure.
- **Google RTDN**: validate the Pub/Sub push request against the configured
  service account audience (OIDC token verification). Reject missing or invalid
  tokens with HTTP 401.

Idempotency:

- Use `(projectId, source, sourceNotificationId)` as the dedup key, where
  `sourceNotificationId` is `notificationUUID` for ASN v2 or `messageId` for
  RTDN. Convex idempotency table records the first-seen event and silently
  acknowledges duplicates with HTTP 200.

Retention:

- Events are retained for the bounded IAPKit operational window and pruned by a
  Convex cron job. They are not exposed as a public replay stream.

Meta Horizon has no inbound webhook. Its bounded polling reconciler may record
synthetic lifecycle events under the `MetaHorizonReconciler` source for the same
private state machine and retention policy.


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
│   ├── google/       # Android store implementations (Kotlin)
│   │   └── openiap/src/
│   │       ├── main/java/dev/hyo/openiap/     # Shared code + generated Types.kt
│   │       ├── play/java/dev/hyo/openiap/     # Google Play Billing
│   │       ├── horizon/java/dev/hyo/openiap/  # Meta Horizon Billing
│   │       └── amazon/java/dev/hyo/openiap/   # Amazon Appstore
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
