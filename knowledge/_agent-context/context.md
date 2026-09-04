# OpenIAP Project Context

> **Auto-generated shared context for AI assistants**
> Last updated: 2026-09-04T13:33:15.491Z
>
> Canonical file: `knowledge/_agent-context/context.md`

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
`specs/client/src/api-android.graphql`; the hand-written implementation it
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
│   ├── conformance/   # Behavioral conformance spec, runner, and reports
│   ├── docs/          # Documentation (React/Vite/Vercel)
│   ├── google/        # Android library (Kotlin)
│   ├── apple/         # iOS/macOS library (Swift)
│   ├── kit/           # Purchase validation + entitlement infrastructure (Fly.io app)
│   └── mcp-server/    # IAPKit MCP server (hosted at kit.openiap.dev/mcp)
├── specs/             # Publishable specifications; never deployed services
│   └── openiap/
│       ├── client/             # Client GraphQL contract + multiplatform code generation
│       └── commerce-protocol/  # Vendor-neutral server-side commerce contract
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
│   ├── _agent-context/   # Compiled context shared by AI assistants
│   └── _claude-context/  # Compatibility link to _agent-context
├── scripts/
│   └── agent/         # RAG Agent scripts
└── .github/workflows/ # CI/CD workflows
```

Libraries reference local `packages/apple` and `packages/google` source directly (not published CocoaPods/Maven artifacts), enabling immediate development without waiting for native releases.

## Directory Ownership Guardrail

Keep each project surface under its canonical owner:

| Content                                          | Canonical location      |
| ------------------------------------------------ | ----------------------- |
| Deployable packages and native implementations   | `packages/<name>/`      |
| Framework SDKs                                   | `libraries/<name>/`     |
| Agent integrations distributed to users          | `plugins/<name>/`       |
| Behavioral conformance spec, runner, and reports | `packages/conformance/` |
| Specifications, generators, and conformance data | `specs/<name>/` |
| Repository knowledge                             | `knowledge/`            |
| Repository-wide automation                       | `scripts/`              |
| Shared editor settings                           | `.vscode/`              |

- Never create a root directory that duplicates a child of `packages/`,
  `libraries/`, or `plugins/`. For example, use `packages/docs/` and
  `specs/client/`, never root `docs/` or `gql/`.
- Before adding a top-level directory, search for an existing owner and extend
  it. Add a new root only when no canonical owner fits, and document that owner
  in this section in the same change.
- Keep shared editor settings in root `.vscode/`. Package-specific settings are
  allowed only when they apply exclusively to that package's toolchain.
- Run `bun run audit:layout` after directory changes. Pre-commit and CI enforce
  the same audit; do not weaken it to permit a duplicate owner.

### Specification Distribution Boundary

`specs/` owns contracts and the tools and fixtures that derive portable
artifacts from them. A specification may publish an npm package so consumers
can install its types, schemas, or conformance runner. Publishing that artifact
is distribution, not a service deployment.

Nothing under `specs/` is a hosted runtime. Keep Docker, Fly.io, Vercel, and
other service deployment configuration with the implementation under
`packages/` or `libraries/`. A specification must not read production secrets,
own production data, or run a production migration. `bun run audit:layout`
rejects legacy schema ownership under `packages/gql` and service deployment
manifests under `specs/`.

## Directory Responsibilities

### specs/client

**Purpose:** Authored OpenIAP client API contract and multiplatform type
generation. The publishable package name is `@hyodotdev/openiap`.

- Contains the GraphQL SDL defining the client API and its types
- Generates types for: TypeScript, Swift, Kotlin, Dart, GDScript, C#
- **RULE:** `Types.swift` / `Types.kt` are AUTO-GENERATED. Never edit directly.

```bash
# Regenerate all types
cd specs/client && bun run generate
```

Generated files:

- TypeScript: `src/generated/types.ts`
- Swift: `src/generated/Types.swift`
- Kotlin: `src/generated/Types.kt`
- Dart: `src/generated/types.dart`
- GDScript: `src/generated/types.gd`
- C#: `src/generated/Types.cs`

### specs/commerce-protocol

**Purpose:** OpenIAP Commerce Protocol — the vendor-neutral server-side
commerce contract: portable operations (verify, status, entitlements, bind,
erase, capabilities) over REST and GraphQL bindings, plus the normalized event
and webhook contract.

```text
schema/*.graphql                # authored contract layers — edit these
        ↓ assemble-schema.mjs
generated/commerce-protocol.graphql # generated single-file assembly
        ↓ build-json-schemas.mjs / build-bundle.mjs / build-operations.mjs
generated/schemas/*             # JSON Schema validators + offline bundle
generated/bindings/*            # HTTP manifest, executable GraphQL projection
generated/openapi/*             # OpenAPI 3.1 document
generated/vectors/*             # lifecycle + operation conformance vectors
conformance/                    # portable runner + IAPKit-free mock provider
```

The authored source is the `schema/` layers; `commerce-protocol.graphql` is
their generated assembly and is never hand-edited. The SDL uses custom
directives for JSON-only constraints and defines `Query` and `Mutation`
operation roots for the portable server surface, but no `Subscription` root —
the operation surface is bounded request/response, and the compiler rejects a
stream. The client SDK API and server-side commerce contract are siblings under
the OpenIAP specification owner, but they keep independent schema inventories
and generation targets. Never edit files under `generated/` directly.

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

The supported directions are server-to-server only:

```text
Apple ASN v2 / Google RTDN ──► IAPKit state ──► developer backend HTTPS endpoint
```

Outbound commerce delivery runs asynchronously in the bounded Convex worker,
not on the Fly request path. A project owner registers each destination and
chooses its event filter; IAPKit signs normalized payloads and applies bounded
retries and circuit breaking.

IAPKit must not expose a server-to-mobile webhook stream, SSE endpoint,
WebSocket, push relay, or long-poll lifecycle feed. Mobile packages and
framework libraries use bounded request/response verification and scoped reads.
If an app needs immediate push delivery, its authenticated backend owns that
policy and transport.

```
┌──────────────┐
│   specs/     │
│openiap/client│ ──── Generates Types ────┐
└──────────────┘                           │
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

### 0. KISS and SSOT Are Release Requirements

Prefer the simplest correct design that satisfies verified requirements. KISS
does not justify skipping error handling, lifecycle safety, tests, or public
contracts; it requires meeting them with the fewest independent concepts.

- Give each stateful resource one clear owner and one terminal cleanup path.
  Pass or reference that owner instead of creating fallback stores, scopes,
  caches, or managers at multiple layers.
- Keep each fact in one canonical source. Generate or link mirrors and adapters;
  never maintain equivalent rules, versions, schemas, or lifecycle decisions in
  parallel files.
- Reuse an existing abstraction when it already owns the invariant. Add a new
  helper only for real reuse, a necessary platform boundary, or isolated testing;
  keep single-use helpers local.
- Do not add speculative configuration, indirection, background work, or state.
  Every new layer must name the invariant it protects, its owner, its cleanup,
  and the test that proves it is needed.
- When fixing a bug, first look for state or code that can be deleted or
  consolidated. Prefer one understandable path over several defensive fallback
  paths.

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

### Keep Them Short — Especially AI-Generated Ones

A comment costs reading time on every future visit. Long ones get skimmed, then
skipped, then trusted while stale. **Default to one line; two or three only when
the reasoning genuinely needs them.**

This rule exists because AI-authored comments consistently over-explain. When an
agent writes code here, it must apply the checklist below before committing.

Delete a comment when it:

- restates the code (`// increment counter`)
- narrates the change or its history (`// previously this used X, now it uses Y`,
  `// refactored to fix the bug where...`) — that belongs in the commit message
  or PR description
- explains a language feature or a well-known API
- repeats what the function/variable name, type signature, or nearby test
  already says
- editorializes (`// this is the important part`, `// note that`)
- restates a doc block that sits three lines above it

Keep a comment when it records something the code cannot show:

- a non-obvious constraint (`// Play Billing requires ack within 3 days`)
- a store/platform quirk that looks like a mistake without it
- why an obvious-looking alternative was rejected
- a normative rule and where it comes from

```kotlin
// ✅ CORRECT — one line, states the constraint
// A pending purchase is unpaid; it must never count as an entitlement.
isActive = purchaseState == PurchaseState.Purchased

// ❌ INCORRECT — narrates history and over-explains
// Previously this was hardcoded to `true`, which meant that pending
// purchases were incorrectly reported as active entitlements. This was
// discovered during the conformance audit and has now been fixed so that
// the value gates on the Purchased state, matching the Play flavor.
isActive = purchaseState == PurchaseState.Purchased
```

Section banners (`// --- Runner ---`) are fine when a file has genuinely
distinct parts; do not add them to short files.

### Doc Comments Are Not the Docs Site

A public API's doc comment states the **contract**; `packages/docs` states the
**behavior matrix**. Where the two overlap, the doc comment loses — a schema
description is copied verbatim into every generated language and every SDK
wrapper, so one per-platform paragraph becomes the same paragraph in a dozen
files that then drift apart independently.

Keep in the doc comment:

- one line saying what the API does
- the single contract point a caller gets wrong without it
- required availability / deprecation metadata
- the `See:` link

Move to the docs page: per-platform behavior, OS and SDK version matrices,
store-flavor differences, and worked examples.

```graphql
# ✅ CORRECT — the contract, then the link out
"""
Open the platform's offer/promo code redemption flow.
Resolves the redeemed purchase only when the store reports it synchronously;
every other path resolves null, so reconcile through the purchase listeners.
Throws when a redemption flow exists but cannot be opened.
Available in OpenIAP Spec 3.3.0 / openiap-apple 3.3.0 / openiap-google 3.4.0.
See: https://openiap.dev/docs/apis/open-redeem-offer-code
"""

# ❌ INCORRECT — reprints the docs page's platform matrix, and ships that
# paragraph into every generated type file
"""
Open the platform's offer/promo code redemption flow so the user can enter a
code. On Apple platforms this presents the App Store offer code redemption
sheet and resolves the verified purchase when StoreKit reports it
synchronously (Xcode 27+ building for iOS 27+, Mac Catalyst 27+, or visionOS
27+); older sheet APIs resolve null after presentation. On Google Play builds
this launches the Play Store redeem page and resolves null; the billing client
does not need to be initialized. Meta Horizon and Amazon Appstore have no
equivalent redemption surface and resolve null without launching anything...
"""
```

Two checks before committing a public API doc comment: it reads at a glance,
and it does not repeat a sentence that already lives on the API's docs page.
The same limit applies to the wrapper doc comment in each SDK — write the
contract once, not the matrix six times.

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
cd specs/client && bun run generate
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

1. Edit the canonical schema under `specs/client/src/`.
2. Run `cd specs/client && bun run generate`.
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

When the GraphQL schema in [`specs/client`](../../specs/client) adds or changes an API, the regenerated `types.*` files **declare** the handler but do not **implement** it. Every wrapper library must wire the new API end-to-end or users will see silent nulls, phantom interfaces (GitHub issue #104), or `UnsupportedOperationException` at runtime.

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
- generated types or shared TS runtime helpers drift from `specs/client`
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
3. Run `cd specs/client && bun run generate` from the monorepo root
4. **Test ALL THREE flavors** when making changes to shared code
5. **Never persist local receipt-to-SKU aliases as entitlement identity**:
   store-specific adapters may cache data for performance or correlate an
   in-flight request by request ID, but they must not permanently rewrite
   `productId`, `currentPlanId`, or entitlement state from app-local alias
   storage. Subscription and entitlement state must come from the store response,
   restore/query APIs, or Kit/server verification so client state cannot drift
   from server truth.
6. **Keep published AARs readable by the Kotlin 2.1.20 consumer baseline**:
   changing the producer compiler can raise Kotlin metadata and stdlib versions
   even when every repository example still builds with the same newer compiler.
   Run `bash scripts/verify-kotlin-2.1-consumer.sh` from `packages/google`; it
   locally publishes and compiles the Play, Horizon, and Amazon artifacts from
   independent Kotlin 2.1.20 Android consumers. CI and the Google release workflow
   run the same guard before Maven Central publication.

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

### Updating `@hyodotdev/openiap` Types and the Derived Version

1. Update the canonical schema without directly changing the `spec` version.
   Native version writers keep `spec` equal to the lower semantic version of
   `google` and `apple`; sync fails instead of silently repairing drift.
2. Run `cd specs/client && bun run generate` from the monorepo root.
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
- `specs/client/src/error.graphql` (ErrorCode enum additions — ripples
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

## OpenIAP Client Specification (`specs/client`)

### Required Pre-Work

Before writing or editing anything, **ALWAYS** review:

- [`specs/client/CONVENTION.md`](../../specs/client/CONVENTION.md)

### Code Generation Architecture

The `@hyodotdev/openiap` package uses two guarded generation lanes over one
authored schema inventory:

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
specs/client/codegen/
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
cd specs/client

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

## Reader-First Writing Standard

Apply this standard to every user-facing page, guide, API reference, migration
note, example explanation, announcement, and release note:

- Lead with the outcome, then identify who is affected and any required action.
- Use direct, active sentences and scannable headings or bullets. Keep one idea
  per sentence where practical.
- State each fact once. Link to deeper reference material instead of repeating
  the same explanation across sections or pages.
- Omit filler, internal implementation narration, generated-file inventories,
  test-process narration, and details that do not change user behavior.
- Keep necessary compatibility, migration, security, data-safety, and
  platform-specific caveats. Concision must not hide a requirement or risk.
- Prefer concrete behavior and commands over adjectives such as "robust",
  "comprehensive", "seamless", or "modernized."

Before finishing, read the rendered page as a user. Remove any sentence that
does not clarify what changed, how to use it, who is affected, or what action is
required.

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

## Separate Content Data From Rendering

> **Priority: MANDATORY**

Repeated page content — table rows, link lists, card grids, comparison
matrices — is **data**. Declare it as a typed module-level constant and render
it with `.map()`. Do not hand-write repeated JSX blocks that differ only in
their text.

```tsx
interface Standard {
  concern: string;
  standard: ReactNode;
}

const STANDARDS: Standard[] = [
  { concern: "Document format", standard: <a href="...">CycloneDX 1.6</a> },
  { concern: "Component identity", standard: <a href="...">purl</a> },
];

// …then render it
<DataTable
  rows={STANDARDS}
  rowKey={(row) => row.concern}
  columns={[
    { header: "Concern", cell: (row) => row.concern },
    { header: "Standard", cell: (row) => row.standard },
  ]}
/>;
```

Why this is mandatory rather than stylistic:

- Editing a fact means editing one object, not hunting through `<tr>` markup.
- A reviewer can read the content of a page without stepping through JSX.
- Adding a row cannot accidentally break table structure.
- Content becomes greppable and, when needed, exportable to another surface.

Rules:

- Use `src/components/DataTable.tsx` for tabular content rather than
  hand-writing `<table>`; pass `columns` and `rows`.
- Name the constant in `SCREAMING_SNAKE_CASE`, type it with an `interface`, and
  place it above the component.
- `rowKey` must be a stable field, never the array index.
- Prose paragraphs stay inline as JSX. This rule is about **repeated
  structures**, not about extracting every sentence into a variable.
- A one-off two-row table is not worth a constant; use judgement, and extract
  once the structure repeats or grows.

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

### Release Note Writing Limits

Apply the project-wide Reader-First Writing Standard above. Release notes are a
changelog for package users, not an implementation audit or a narrative of how
a release was produced.

- Lead with the user-visible outcome. Do not restate the title or begin with
  filler such as "Publishes the coordinated release train."
- Keep the opening summary to at most two sentences and roughly 50 words.
- Keep each bullet to one sentence and normally 30 words or fewer. Use up to 45
  only when a compatibility range or migration command cannot be split safely.
- State each fact once. Do not repeat one fix in the summary, native section,
  every wrapper bullet, and integration notes.
- Describe behavior, compatibility, and required user action. Omit commit
  mechanics, generated-file inventories, test matrices, release automation,
  internal architecture, and dependency lists that do not change consumer
  requirements.
- A package whose only change is selecting a native dependency, regenerating
  types, or republishing shared behavior belongs only in `Package Releases`.
  One bullet may group packages that have the same behavior and caveats.
- Use `Integration notes` only for required migration, configuration, or
  compatibility action. Omit no-op reassurance and unchanged-platform lists.
- Link a PR or issue once where it supplies useful context.
- Prefer concrete verbs such as "fixes", "adds", "rejects", "requires",
  "removes", and "preserves". Avoid vague verbs unless the sentence immediately
  names the observable result.
- Preserve historical IDs, dates, versions, links, compatibility boundaries,
  migration commands, and shipped behavior when shortening an existing note.
  Leave a statement unchanged when its source evidence is incomplete.

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
3. Use semantic IDs like `spec-3-4-0-apple-3-4-0`
4. Verify every package version against its source of truth before writing it
   (see "Release package version verification" below)

```tsx
const allNotes: Note[] = [
  // Client spec 3.4.0 / Apple 3.4.0 - Jan 26, 2026
  {
    id: "spec-3-4-0-apple-3-4-0",
    date: new Date("2026-01-26"),
    element: (
      <div key="spec-3-4-0-apple-3-4-0" style={noteCardStyle}>
        <AnchorLink id="spec-3-4-0-apple-3-4-0" level="h4">
          📅 @hyodotdev/openiap v3.4.0 / openiap-apple v3.4.0 - Feature
          Description
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

## Public GitHub Communication Style

Write like a maintainer explaining the change to a colleague, not like a report.
This applies to pull request titles and bodies, review comments and replies,
issue comments, and release text. It is a release requirement, not a preference:
a description nobody reads is a description that does not review the change.

**Lead with the point.** First sentence says what changed and why it matters.
No preamble, no restating the title, no "This PR introduces...".

**Short sentences, ordinary words.** Say "broken" not "exhibits a defect",
"fixed" not "remediated", "we can't prove X" not "X is not substantiable".
If a sentence needs a second read, split it.

**Length is a budget.** A PR body is under 60 lines. A review reply is one to
three sentences. Detail that does not change what the reader does next belongs
in the commit message or the code comment, not here.

**Group, do not enumerate.** Nine findings of the same shape are one paragraph
naming the shape, not nine table rows. Reach for a table only when the reader
will compare columns.

**Say what a reviewer needs.** What broke, what it cost, what changed, how it
was verified. Skip the investigation narrative, the options considered, and the
chronology of how you got there.

**Reply to review comments like a person.** State the outcome first — fixed,
already handled, or disagreed — then the reason in a sentence. No restating the
reviewer's comment back to them, no thanking-and-summarising preamble. Write
commit hashes bare, never in backticks: GitHub only auto-links plain text.

Bad, and typical of AI-authored prose:

```text
Thank you for the thorough review! You raise an excellent point regarding the
validation logic. Upon careful investigation of the code path in question, I
was able to determine that the guard clause does indeed fail to account for the
scenario you describe, and I have accordingly implemented a fix which...
```

Good:

```text
Fixed in abc1234. The guard only matched the bare tag, so an element with an
attribute fell through to the "declares none" branch. Now it matches through
attributes and throws when the element is present but unreadable.
```

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
- Never commit one-off PR preview recordings, including under
  `.github/pr-previews/`. Create them in a temporary or ignored local path,
  upload them as GitHub attachments, verify the attachment, then delete the
  local files. Only commit media that is itself a product documentation or
  example asset intended to ship with the repository.
- If browser or extension permissions block an attachment, stop and ask the
  maintainer to enable file uploads. Do not force-add the recording as a Git
  fallback.
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
| `spec`    | `specs/client`                     |
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

### CI-Only Package Publishing

External registry publication for npm and Flutter packages is CI-only. Never
run `npm publish`, `flutter pub publish`, or an equivalent package-publishing
command from a local terminal.

- Enter a stable or prerelease package release only through its guarded
  `workflow_dispatch` source workflow on the allowed release branch.
- React Native and Expo source workflows create an immutable release tag; the
  tag-ref child publisher performs the npm registry write with OIDC.
- The Flutter source workflow is dispatched, but the actual pub.dev registry
  write runs only from the immutable tag-push `publish-flutter.yml` workflow.
  pub.dev rejects OIDC publishing from a `workflow_dispatch` event even when
  that run checks out a tag.
- Local registry-facing commands in a release workflow are limited to read-only
  verification; local build and test commands remain allowed.

Exact-version `npm deprecate` and retraction through the signed-in pub.dev Admin
UI are authenticated lifecycle-maintenance exceptions, not package publishing.
Use them only after the replacement version is publicly verified. Do not add a
token- or OTP-backed CI mutation path for either operation.

The version commit and immutable provenance tag must be pushed atomically before
publishing a framework package to its external registry. A `current` retry may
reuse that tag to finish an interrupted publication, but if the registry already
contains the version while its provenance tag is absent, stop instead of tagging
the current branch tip as an unverified substitute.

Before any `current` retry checks out an existing release tag, run
`scripts/assert-release-tag.mjs`. The guard must prove that the local tag matches
the immutable origin tag, its package metadata declares the expected version,
and its peeled commit is reachable from the validated `main` or `next` release
branch. Do this before executing build scripts or loading package content from
the tag; a matching tag name alone is not reviewed-branch provenance.

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
every field before publishing. Resolve the authorization's recorded attempt with
GitHub's attempt-specific run endpoint; a later rerun of the same source run ID
must not invalidate an earlier valid artifact by substituting the run's latest
attempt metadata. A merely successful historical run is not valid authorization
for another tag.
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

On a fresh checkout, first run `cd packages/docs && vercel link` and select the
existing OpenIAP project. Deployment stops when that local project link is
missing or invalid. It validates the immutable project and organization IDs,
rejects conflicting `VERCEL_PROJECT_ID` or `VERCEL_ORG_ID` overrides, and
reports success only after Vercel returns a ready production deployment.

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

GitHub Deployment Environments are optional pub.dev hardening, not a publishing
prerequisite. This repository currently relies on its guarded tag-push CI lane
without a required environment. Add an `environment` to the publisher only
when a maintainer intentionally enables the matching requirement in the
pub.dev package Admin settings; never make an unconfigured environment a
release blocker.

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
  sync then verifies the invariant and refreshes `specs/client/package.json`,
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
(specs/client      (libraries/*/src       (Swift / Kotlin /          (packages/docs/
 /src/*.graphql)   /types.{ts,kt,...})    Dart / TS / GDScript)        src/pages/...)
```

- `specs/client/schema-files.mjs` — ordered inventory of every production SDL
  input. Every repository-owned generator imports it directly. Do not add
  another hard-coded schema list or an unverified external generator manifest.
- `specs/client/schema-source-utils.mjs` — shared source identity normalization
  and block-string line detection. Metadata extractors must not duplicate this
  lexical bookkeeping.
- `specs/client/src/*.graphql` — schema descriptions ARE the canonical doc
  string. Edits propagate via `bun run generate` to every generated
  `types.ts`, `Types.kt`, `Types.swift`, `types.dart`, `types.gd`, and
  `Types.cs`.
- `specs/client/schema-markers.mjs` — the only parser for the SDL comment
  contracts `# Future` and `# => Union`. Generators and the schema linter must
  consume it rather than maintaining independent line-state machines. A union
  wrapper must be a non-root object with at least one field and all fields
  nullable; operation roots, empty wrappers, and required fields fail
  generation instead of silently degrading to an object.
- `specs/client/schema-deprecations.mjs` — the only extractor and validator for
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
- `specs/client/custom-input-contracts.ts` — typed
  field/type/nullability/default contracts for inputs that custom generators
  alias or project. The shared IR transformer validates these before any
  language plugin runs.
- `specs/client/generated-sync-manifest.mjs` — generated source/target mapping
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
`specs/client/src/generated/types.ts` shape, which is synchronized into Expo
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
listener names, legacy purchase request shapes, top-level Godot SKUs, obsolete
Kotlin/KMP named arguments, unchecked connection or teardown results, or
asynchronous listener callbacks whose returned promise, future, or task is not
observed.
Historical release notes are excluded because they describe APIs as shipped at
that time.

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
  `/docs/updates/migration` (published at `/docs/updates/deprecations` until
  2026-08; that path still redirects). It is organized as one section per
  coordinated major train, and each train records the removed-to-replacement
  mapping and the exact package major boundary.
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

### R14 — Verification result docs expose the shared validity contract

Every store-specific `VerifyPurchaseResult` documentation table must list all
required fields from the generated TypeScript `VerifyPurchaseResultCommon`
interface. The audit derives this field set from the generated type instead of
maintaining a second list. While Horizon's `success` compatibility property
exists, its table must also mark that property as a deprecated alias for
`isValid`.

### R15 — Subscription query failures stay observable

React Native and Expo subscription-query helpers reject when the store query
fails. The React Native hook calls `onError` before rethrowing; it must not map
the failure to `false`. Godot's compatibility boolean helper is the only
documented false fallback. Active docs must preserve this distinction so
callers keep the required rejection handling.

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
- shared purchase-verification fields and the Horizon compatibility alias
- subscription-query rejection semantics and the Godot compatibility fallback

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

<!-- Source: internal/08-fact-graph.md -->

# Fact Graph — Declared-Fact Consistency

One cross-cutting scalar (a tool version, a runner image) gets declared in
many files. When someone bumps most of them, the leftover breaks — usually in
the one lane nobody runs until a release. This system makes that class of
drift fail CI instead.

Real incidents this system would have caught (all shipped 2026-08-20):

- `release-godot.yml` still on `macos-15` after six other release lanes moved
  to `macos-26` — surfaced as a 9-minute runner wait during a live release.
- `Example/project.godot` declaring Godot 4.5 features while the Makefile and
  every CI lane pinned 4.7.1 — the editor rewrote the file on every open.

## Model

`scripts/facts.mjs` is the registry. Each **fact** declares:

- `values` — named roles for the values that may legitimately coexist
  (`{ current: "4.7.1", minimum: "4.3" }`). One role means uniformity.
- `scanners` — regexes with one capture group, run over file sets.

`scripts/audit-facts.mjs` enforces two rules:

1. Every occurrence a scanner finds must be one of the declared values.
2. Every declared value must still occur somewhere.

Rule 2 is what makes bumps atomic: change the registry and every stale
occurrence fails; change a file and the unregistered value fails. There is
deliberately **no per-site list** — an unlisted site cannot drift silently
because the scanner sees it anyway.

`DERIVED` relations express one declaration computed from another
(`project.godot` features = major.minor of `godot.version.current`) instead of
duplicating the value.

## Querying impact

`bun run graph:impact <fact-key>` answers "what does bumping this touch?"
before you start: every declaring file with line numbers, declarations derived
from the fact, and the CI jobs that run when those files change (via the same
path-filter model `audit-ci-path-filters` proves against CI). Read-only —
`--list` names the registered facts.

## Authority direction

The registry is authoritative; files follow it. When the audit fails, the fix
is to finish the bump — never to edit the registry to match a stray file
unless the stray file is the intended new value.

## Boundaries (do not absorb these)

| Domain                              | Owner                                         |
| ----------------------------------- | --------------------------------------------- |
| Generated type files source→targets | `specs/client/generated-sync-manifest.mjs`    |
| Package/spec version floor          | `openiap-versions.json` + release-state audit |
| API surface parity across languages | `scripts/audit-non-godot-parity.mjs`          |
| Change→job routing                  | `scripts/audit-ci-path-filters.mjs`           |

The fact graph holds scalar declarations only, and it is deliberately
**additive**: it changes no existing guard. Where a parity-audit needle pins
the same scalar today, both guards run — they cannot contradict each other,
since both compare against the same files, but a bump touches both until the
consolidation phase below. Removing the single CI step disables the whole
system; nothing else depends on it.

## Authoring rules

- Anchor patterns to structural keys (`java-version:`), never bare numbers.
- A deliberately divergent value (Node 20 for builds, 24 for npm publish) is
  either two roles in one fact or out of scope — never an unexplained skip.
- **Every new fact ships with a planted-violation test** in
  `scripts/audit-facts.test.mjs`: edit a real file in memory, assert the audit
  reports it. A guard that has never seen its bug fire is unverified
  (the release-sync guard shipped broken exactly this way).

## Limits

Agreement is not correctness: `supported_platforms` was consistent across all
four copies and every copy was wrong, because Godot never read the key. The
fact graph catches drift between declarations; it cannot tell whether the
declaration means anything. Semantic validity stays with tests and e2e.

Coverage is bounded by the scanners: a declaration in a file no scanner
reads, or in a shape no pattern captures, is invisible. "An unlisted site
cannot drift silently" holds within scanned files only — when a fact grows a
new home (a shell script embedding a version, a new manifest), extend the
scanner in the same change.

## Roadmap

1. **Done** — toolchain facts (Xcode, macOS image, JDK, Bun, Godot) plus the
   Example-project derivation.
2. Consolidate: move parity-audit needles that assert scalar pins into the
   registry, shrinking `audit-non-godot-parity.mjs` toward behavior-only
   assertions. Opt-in, after the registry has caught real drift in practice.
3. Derive CI path-filter expectations from a package→path→job edge list
   instead of asserting them post hoc.


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
// Include suspended subscriptions when the connected Play Store supports it.
val paramsBuilder = QueryPurchasesParams.newBuilder()
    .setProductType(BillingClient.ProductType.SUBS)
if (billingClient.isFeatureSupported(
        BillingClient.FeatureType.INCLUDE_SUSPENDED_SUBSCRIPTIONS
    ).responseCode == BillingClient.BillingResponseCode.OK
) {
    paramsBuilder.includeSuspendedSubscriptions(true) // New in 8.1
}
val params = paramsBuilder.build()

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

## Grace period vs account hold: what `expiryTime` reports

Play answers both states through the one `lineItems[].expiryTime` field, so a
receiver needs no second date the way Apple does.

| State | `subscriptionState` | `expiryTime` | Entitlement |
| --- | --- | --- | --- |
| Grace period | `SUBSCRIPTION_STATE_IN_GRACE_PERIOD` | **future** — Play extends it until grace ends | retained |
| Account hold | `SUBSCRIPTION_STATE_ON_HOLD` | **past** | blocked |

Google states it directly: *"Google Play dynamically extends the `expiryTime`
value until the grace period has expired because entitlement should last until
the user cancels or the grace period has lasted for its maximum length."*

This is why `normalizeGoogleRtdn` takes `expiryTimeMillis` verbatim while
`normalizeAppleAsn` must prefer `gracePeriodExpiresDate`: Apple keeps the failed
period's `expiresDate` on the transaction and reports the grace deadline
separately, so taking the transaction value during grace revokes access at the
instant grace begins.

Reference: [Subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions)


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

- The Billing Compatibility SDK initializes Horizon platform state from an
  Android `Activity`. OpenIAP therefore requires a current foreground Activity
  for Horizon `initConnection`; it returns `MissingCurrentActivity` instead of
  falling back to an application context.
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

| Feature                                                        | iOS Version                           | Description                                                                                         |
| -------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Win-back offers                                                | iOS 18.0                              | Re-engage churned subscribers                                                                       |
| `Product.SubscriptionInfo.RenewalInfo.eligibleWinBackOfferIDs` | iOS 18.0                              | Query win-back offer eligibility before purchase                                                    |
| Consumable transaction history                                 | iOS 18.0                              | Opt-in via `SKIncludeConsumableInAppPurchaseHistory` Info.plist key                                 |
| StoreKit `Message.billingIssue`                                | iOS / Mac Catalyst 16.4, visionOS 1.0 | Listener for subscription billing issues (`Message` is unavailable on macOS, tvOS, and watchOS)     |
| UI context for purchases                                       | iOS 18.2                              | Required for proper payment sheet display                                                           |
| External purchase notice                                       | iOS 17.4                              | `ExternalPurchase.presentNoticeSheet()`                                                             |
| `appTransactionID`                                             | iOS 18.4                              | Globally unique app transaction identifier (back-deployed to iOS 15)                                |
| `originalPlatform`                                             | iOS 18.4                              | Original purchase platform (back-deployed to iOS 15)                                                |
| `Transaction.offerPeriod`                                      | iOS 18.4                              | Offer period information on Transaction                                                             |
| `Transaction.advancedCommerceInfo`                             | iOS 18.4                              | Advanced Commerce API data on Transaction                                                           |
| `Transaction.appTransactionID`                                 | iOS 18.4                              | Per-Apple-Account identifier on Transaction                                                         |
| Expanded offer codes                                           | iOS 18.4                              | Offer codes for consumables/non-consumables                                                         |
| JWS promotional offers                                         | WWDC 2025                             | New `promotionalOffer` purchase option with JWS format                                              |
| `introductoryOfferEligibility`                                 | WWDC 2025                             | Set eligibility via purchase option                                                                 |
| `SubscriptionStatus` by Transaction ID                         | WWDC 2025                             | `status(for: transactionID:)`                                                                       |
| Monthly subscriptions with a 12-month commitment               | iOS 26.4+ runtime / Xcode 26.5 SDK    | Monthly billing option for annual auto-renewable subscriptions                                      |
| Subscription Bundles and Suites                                | Apple 27 / Xcode 27 beta SDK          | Read-only product, bundled-subscription, transaction, and renewal metadata                          |
| Bundle ownership and revocation metadata                       | Xcode 27 beta SDK                     | Back-deployed assigned ownership, bundle-upgrade reason, assignment revocation, and unbundling data |
| `AppTransaction.storeType`, `revocationDate`                   | Xcode 27 beta SDK                     | App-acquisition channel and back-deployed revocation timestamp                                      |
| `AppTransaction.all`                                           | Apple 27 / Xcode 27 beta SDK          | Async sequence of app-acquisition records; not exported as an OpenIAP 3 operation                   |
| `AppStore.Platform.managed`                                    | Xcode 27 beta SDK                     | Back-deployed managed-distribution acquisition platform                                             |
| Advanced Commerce item partners                                | Apple 27 / Xcode 27 beta SDK          | Partner identifiers and names in each item-details JSON payload                                     |
| Group purchases and volume purchasing                          | Announced at WWDC 2026                | Group Purchases are planned for later in 2026; Xcode 27 beta 4 has no public StoreKit group API     |
| Retention Messaging                                            | WWDC 2026                             | Cancellation-flow messaging and offers, including real-time server decisioning                      |
| Retention offer type                                           | WWDC 2026                             | Signed transaction / renewal info can report offer type `5` for retention offers                    |
| Offer codes for all IAP types                                  | 2026                                  | Offer codes expand beyond auto-renewable subscriptions; IAP promo-code creation ends March 26, 2026 |

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
Xcode 27 beta SDK and are currently beta. Xcode 26.x SDKs expose the StoreKit 2
scene-based `AppStore.presentOfferCodeRedeemSheet(in:)` API, which presents the
sheet but does not return the redeemed transaction.

OpenIAP exposes this flow through the cross-platform `openRedeemOfferCode`
(Spec 3.3.0+); `presentCodeRedemptionSheetIOS`, which OpenIAP 3 changed to
return `PurchaseIOS?`, is a deprecated alias scheduled for removal in
OpenIAP 4.0. Xcode 27 builds call the new API, require a verified result, and
return the mapped transaction on Apple 27+ runtimes. Older result paths use the StoreKit 2
scene API on iOS 16+ and visionOS 1+ and return `nil` after presentation; iOS 15
retains the StoreKit 1 fallback. In Mac Catalyst apps, the scene API throws
`StoreKitError.unknown`, while the Catalyst 15 StoreKit 1 call has no effect and
returns `nil`. Nil results from an actually presented sheet rely on the
transaction listener or explicit purchase reconciliation. Xcode 27 beta 4
declares `RedeemOption`,
but its public symbol graph exposes no constructible option values, so OpenIAP
currently passes an empty set.

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

## AppTransaction Identity Updates (Xcode 16.4+; back-deployed)

```swift
let appTransaction = try await AppTransaction.shared

// Introduced in iOS 18.4 (back-deployed to the AppTransaction baseline)
let appTransactionID = appTransaction.appTransactionID  // Globally unique per Apple Account
let originalPlatform = appTransaction.originalPlatform   // Typed value on iOS 18.4+
```

OpenIAP uses `originalPlatformStringRepresentation` on older runtimes. The typed
`originalPlatform` property starts at iOS 18.4, macOS 15.4, tvOS 18.4, watchOS
11.4, and visionOS 2.4.

## AppTransaction Acquisition Updates (Xcode 27 SDK)

```swift
let appTransaction = try await AppTransaction.shared

// Public in the Xcode 27 SDK and back-deployed to these existing runtimes
let revocationDate = appTransaction.revocationDate        // App-acquisition revocation
// Runtime-gated to Apple 27+
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

For Advanced Commerce transactions, OpenIAP maps
`AdvancedCommerceInfoIOS.period` as an optional `SubscriptionPeriodValueIOS`
containing the subscription period `unit` and integer `value`.

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

| IAPKit internal event type              | Apple ASN v2 `notificationType` (`subtype`)                                                                                   | Google RTDN `subscriptionNotification.notificationType`                                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SubscriptionStarted`                   | `SUBSCRIBED` (`INITIAL_BUY`, `RESUBSCRIBE`), `REFUND_REVERSED` — a reversed refund re-grants, so it surfaces as a fresh start | `SUBSCRIPTION_PURCHASED` (4)                                                                                                                          |
| `SubscriptionRenewed`                   | `DID_RENEW`                                                                                                                   | `SUBSCRIPTION_RENEWED` (2)                                                                                                                            |
| `SubscriptionExpired`                   | `EXPIRED`                                                                                                                     | `SUBSCRIPTION_EXPIRED` (13)                                                                                                                           |
| `SubscriptionInGracePeriod`             | `DID_FAIL_TO_RENEW` (`GRACE_PERIOD`)                                                                                          | `SUBSCRIPTION_IN_GRACE_PERIOD` (6)                                                                                                                    |
| `SubscriptionInBillingRetry`            | `DID_FAIL_TO_RENEW` (no subtype), `GRACE_PERIOD_EXPIRED` — grace ended without a renewal, billing retry continues             | `SUBSCRIPTION_ON_HOLD` (5)                                                                                                                            |
| `SubscriptionRecovered`                 | `DID_RENEW` (after a prior failure)                                                                                           | `SUBSCRIPTION_RECOVERED` (1)                                                                                                                          |
| `SubscriptionCanceled`                  | `DID_CHANGE_RENEWAL_STATUS` (`AUTO_RENEW_DISABLED`)                                                                           | `SUBSCRIPTION_CANCELED` (3), `SUBSCRIPTION_CANCELLATION_SCHEDULED` (18) — access continues until the current period or installment commitment ends    |
| `SubscriptionUncanceled`                | `DID_CHANGE_RENEWAL_STATUS` (`AUTO_RENEW_ENABLED`)                                                                            | `SUBSCRIPTION_RESTARTED` (7) — fired when auto-renew is re-enabled while the period is still active                                                   |
| `SubscriptionRevoked`                   | `REVOKE`                                                                                                                      | `SUBSCRIPTION_REVOKED` (12)                                                                                                                           |
| `SubscriptionPriceChange`               | `PRICE_INCREASE`                                                                                                              | `SUBSCRIPTION_PRICE_CHANGE_CONFIRMED` (8), `SUBSCRIPTION_PRICE_CHANGE_UPDATED` (19)                                                                   |
| `SubscriptionProductChanged`            | `DID_CHANGE_RENEWAL_PREF`                                                                                                     | `SUBSCRIPTION_ITEMS_CHANGED` (17)                                                                                                                     |
| `SubscriptionDeferred`                  | (no equivalent)                                                                                                               | `SUBSCRIPTION_DEFERRED` (9) — extends recurrence time without changing products                                                                       |
| `SubscriptionPaused`                    | (no equivalent — iOS has no pause)                                                                                            | `SUBSCRIPTION_PAUSED` (10)                                                                                                                            |
| `SubscriptionPauseScheduleChanged`      | (no equivalent)                                                                                                               | `SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED` (11) — schedule metadata only; it does not revoke current entitlement                                           |
| `SubscriptionPendingPurchaseCanceled`   | (no equivalent)                                                                                                               | `SUBSCRIPTION_PENDING_PURCHASE_CANCELED` (20) — audit-only; no completed purchase or entitlement exists                                               |
| `SubscriptionPriceStepUpConsentChanged` | (no equivalent)                                                                                                               | `SUBSCRIPTION_PRICE_STEP_UP_CONSENT_UPDATED` (22) — audit-only consent metadata; it does not itself change entitlement or catalog price               |
| `SubscriptionResumed`                   | (no equivalent)                                                                                                               | `SUBSCRIPTION_RECOVERED` (1) when fired after a `SUBSCRIPTION_PAUSED` — kit chooses Resumed vs Recovered based on the prior `subscriptions` row state |

PR #123 review caught the earlier draft where codes 1 and 4 were swapped
(`SUBSCRIPTION_RECOVERED` is code 1, `SUBSCRIPTION_PURCHASED` is code 4)
and where `SUBSCRIPTION_RESTARTED` (7) was incorrectly mapped to
`SubscriptionRecovered` instead of `SubscriptionUncanceled`. The mapping
above reflects the corrected RTDN reference.

## One-time / common

| IAPKit internal event type   | Apple ASN v2                                                                           | Google RTDN                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `SubscriptionStarted`        | `REFUND_REVERSED` — Apple sends it for every product kind; a reversed refund re-grants | `oneTimeProductNotification.notificationType = ONE_TIME_PRODUCT_PURCHASED` (1) — re-used for one-time activation |
| `PurchaseRefunded`           | `REFUND`                                                                               | `oneTimeProductNotification.notificationType = ONE_TIME_PRODUCT_CANCELED` (2), or `voidedPurchaseNotification`   |
| `PurchaseConsumptionRequest` | `CONSUMPTION_REQUEST`                                                                  | (no equivalent — Play handles consumption client-side)                                                           |
| `TestNotification`           | `TEST`                                                                                 | `testNotification` field present on the RTDN message                                                             |

## Field mapping

| Internal event field    | Apple ASN v2 source                                                                                                                                                                                                                                                                                                                                                                                             | Google RTDN source                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                    | `notificationUUID`                                                                                                                                                                                                                                                                                                                                                                                              | Pub/Sub `messageId`                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `occurredAt`            | `signedDate`                                                                                                                                                                                                                                                                                                                                                                                                    | `eventTimeMillis`                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `environment`           | `data.environment` (`Production` \| `Sandbox` \| `Xcode`)                                                                                                                                                                                                                                                                                                                                                       | `testNotification` present → `Sandbox`, else `Production`                                                                                                                                                                                                                                                                                                                                                                                                              |
| `purchaseToken`         | `data.signedTransactionInfo.originalTransactionId`, falling back to `transactionId`                                                                                                                                                                                                                                                                                                                             | `subscriptionNotification.purchaseToken` or `oneTimeProductNotification.purchaseToken`                                                                                                                                                                                                                                                                                                                                                                                 |
| `transactionId`         | `data.signedTransactionInfo.transactionId`                                                                                                                                                                                                                                                                                                                                                                      | `voidedPurchaseNotification.orderId` when present; a Play purchase token is never labeled as a transaction id                                                                                                                                                                                                                                                                                                                                                          |
| `originalTransactionId` | `data.signedTransactionInfo.originalTransactionId`                                                                                                                                                                                                                                                                                                                                                              | not present in RTDN                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `productId`             | immediate `UPGRADE`: transaction product; scheduled renewal preference: `autoRenewProductId`; otherwise transaction product                                                                                                                                                                                                                                                                                     | one line item, the existing canonical product's line, or the exact active successor whose `itemReplacement.productId` names that product for a product change or linked purchase; `DEFERRED`/`KEEP_EXISTING` changes remain canonical; a unique future-active renewal item is the fallback; unresolved changes omit it; an unlinked ambiguous purchase retries until device verification establishes the canonical product; legacy `subscriptionId` remains a fallback |
| `expiresAt`             | the later of `data.signedTransactionInfo.expiresDate` and `data.signedRenewalInfo.gracePeriodExpiresDate` — Apple keeps the failed period's end on the transaction and repeats it on every notification during grace, so taking it alone revokes access the moment grace begins; a grace notification that carries no `gracePeriodExpiresDate` omits `expiresAt` instead of reusing the elapsed paid-period end | resolved by calling `purchases.subscriptionsv2.get` (RTDN does not embed it directly)                                                                                                                                                                                                                                                                                                                                                                                  |
| `renewsAt`              | `data.signedRenewalInfo.renewalDate`                                                                                                                                                                                                                                                                                                                                                                            | resolved by calling `purchases.subscriptionsv2.get`                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `willRenew`             | `data.signedRenewalInfo.autoRenewStatus` (`1` → true, `0` → false), with lifecycle type/subtype fallback                                                                                                                                                                                                                                                                                                        | selected line item has `autoRenewingPlan` → true only when `autoRenewEnabled` is true; `prepaidPlan` → false                                                                                                                                                                                                                                                                                                                                                           |
| `cancellationReason`    | ASN `notificationType` + `subtype` + `data.signedRenewalInfo.expirationIntent`; `REFUND` → `Refunded`, while ambiguous Family Sharing `REVOKE` omits the reason                                                                                                                                                                                                                                                 | `PurchaseRefunded` / `SubscriptionRevoked` events are always `Refunded` (a Play revocation refunds the user); otherwise `purchases.subscriptionsv2.get` → `canceledStateContext.userInitiatedCancellation` / `systemInitiatedCancellation`                                                                                                                                                                                                                             |
| `currency`              | current transaction currency; renewal-info currency for price/product changes (immediate `UPGRADE`s keep the transaction's own values)                                                                                                                                                                                                                                                                          | selected line item's current recurring currency, or `priceChangeDetails.newPrice.currencyCode` for price changes                                                                                                                                                                                                                                                                                                                                                       |
| `priceAmountMicros`     | current transaction price × 1000; renewal price × 1000 for price/product changes (Apple values are milliunits; immediate `UPGRADE`s keep the transaction's own price)                                                                                                                                                                                                                                           | selected line item's current recurring price, or `priceChangeDetails.newPrice` for price changes; `units * 1_000_000 + Math.round(nanos / 1000)`; a prepaid plan with no store money falls back to the kit catalog price with `catalog` provenance                                                                                                                                                                                                                     |
| `rawSignedPayload`      | The complete `signedPayload` JWS string from the ASN body                                                                                                                                                                                                                                                                                                                                                       | The base64-decoded Pub/Sub message `data` (JSON)                                                                                                                                                                                                                                                                                                                                                                                                                       |

Apple `DID_CHANGE_RENEWAL_PREF/UPGRADE` takes effect immediately. Downgrades and
scheduled crossgrades describe the next billing period, so the canonical
subscription keeps its current product until renewal.

## Validation requirements

Both stores require signature verification before any event is accepted:

- **Apple ASN v2**: verify the JWS certificate chain against IAPKit's embedded
  Apple public root certificates. Online OCSP/CRL checks are disabled so
  transient network failures do not create webhook retry storms. The receiver
  rejects an invalid signature with HTTP 400 as a permanent payload failure.
- **Google RTDN**: validate the Pub/Sub push request against the configured
  project lifecycle URL (OIDC token verification), then require the verified
  email to equal the current project's uploaded Google service-account JSON
  `client_email`. The public Convex action derives that URL from trusted runtime
  configuration and repeats both checks so direct calls cannot bypass the Fly
  receiver. Reject missing, invalid, or cross-project tokens with HTTP 401.
  A modern unlinked multi-item initial purchase without a canonical product is
  rejected before deduplication so Pub/Sub can retry after device receipt
  verification creates the canonical subscription row. A linked purchase may
  instead use one immediate `itemReplacement` successor of its canonical
  predecessor.

Idempotency:

- Use `(projectId, source, sourceNotificationId)` as the dedup key, where
  `sourceNotificationId` is `notificationUUID` for ASN v2 or `messageId` for
  RTDN. Convex idempotency table records the first-seen event and silently
  acknowledges duplicates with HTTP 200.

Retention:

- Events are retained for the bounded IAPKit operational window and pruned by a
  Convex cron job. They are not exposed as a public replay stream.

Meta Horizon has no inbound webhook or background lifecycle lane in IAPKit.
`POST /v1/purchase/verify` performs a synchronous entitlement check only. The
`MetaHorizonReconciler` source remains schema-compatible for legacy retained
rows, but those synthetic events are excluded from current revenue rollups.

Amazon RVS also has no inbound webhook receiver in IAPKit. A bounded purchase
reconciler schedules active Amazon receipt rows for revisits on a 48-hour due
cadence, but backlog, retries, and lease recovery mean it does not guarantee
that every row is checked within 72 hours. It updates state only from
authoritative RVS outcomes and preserves the last confirmed state across
transient or malformed responses.


---

# OPENIAP COMMERCE PROTOCOL

The following normative specification defines the vendor-neutral server-side
commerce contract. IAPKit product and operational documentation is maintained
separately at https://kit.openiap.dev/docs.

---

# OpenIAP Commerce Protocol Specification 1.0

A vendor-neutral contract for the **server side** of in-app purchases: one
normalized commerce vocabulary, one portable operation surface with REST and
GraphQL bindings, one event envelope, one webhook contract.

A consumer that implements this specification can process subscription starts,
renewals, subscription refunds, and entitlement changes from Apple, Google,
Meta Horizon, and Amazon **without parsing a single store-native payload** and
without knowing which backend produced the event. A developer backend written
against the operation surface can verify purchases, read entitlements, bind
purchases to its own users, and erase them — and later replace the provider
behind those calls without rewriting the integration.

## Why this exists

OpenIAP normalizes the client-side purchase API across stores. The server side
has the same fragmentation and no equivalent answer. Each store expresses
validation, renewal, cancellation, expiration, refund, revocation, entitlement,
and server notifications differently, so every backend, analytics pipeline, and
integration re-learns four protocols and re-derives the same semantics — usually
with subtly different answers.

This specification defines that shared server-side layer.

## What this is not

- **Not a product.** It specifies a contract, not a paywall builder,
  experimentation platform, CRM, or analytics engine. Those consume this; they
  are not built inside it.
- **Not tied to one implementation.** IAPKit is the open-source reference
  implementation, not the standard. Any backend may implement this
  specification, in any language, without importing IAPKit.
- **Not a client API.** Client-side purchase flow is OpenIAP's domain. Where a
  concept exists on both sides, this document says so explicitly.

Naming, since the two are easy to confuse: **OpenIAP Commerce Protocol** is
this standard. **IAPKit** is its open-source reference implementation and a
hosted service built on it. Package and artifact names follow the protocol;
IAPKit is not normative.

## No central dependency

This specification is a contract between two parties. It does not place a third
one in the middle.

An emitter MUST be able to produce conformant events, and a consumer to verify
and process them, with **no network request to infrastructure operated by the
OpenIAP project**, at build or run time. Specifically:

- No OpenIAP account, registration, or issued identifier. Every identifier here
  is assigned by the emitter.
- No OpenIAP-issued credential. The webhook secret is exchanged directly
  between emitter and consumer; see §9.4.2.
- No commerce data reaches the OpenIAP project under any rule in this document.
- Validation runs offline: the bundle schema resolves no external reference.
- Conformance is demonstrated against this package's fixtures and vectors, not
  by routing production traffic anywhere.

## Conformance language

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are used as defined in RFC 2119.

Four roles are addressed:

| Role         | Who                                       | Obligation                                                                 |
| ------------ | ----------------------------------------- | -------------------------------------------------------------------------- |
| **Provider** | A backend that serves protocol operations | Serve the declared profiles over at least one binding and pass conformance |
| **Caller**   | Anything that invokes an operation        | Honour the auth roles, error model, and forward-compatibility rules        |
| **Emitter**  | A backend that produces commerce events   | Produce documents valid against the schemas and honour the transport rules |
| **Consumer** | Anything that receives them               | Honour the verification, idempotency, and forward-compatibility rules      |

A provider is usually also an emitter, and a caller usually also a consumer;
the roles stay separate because each pair carries different obligations.

## Machine-readable artifacts

This document and the GraphQL contract together define the protocol. The
contract is authored as the layers in `schema/`, assembled into the single file
`commerce-protocol.graphql`; it is authoritative for wire structure, the
operation surface, member presence and nullability, and per-member definitions.
This document is authoritative for domain behavior, cross-field rules,
transport, and compatibility. The generated JSON Schema bundle is the
executable projection validators consume.

| Artifact                                                 | Purpose                                                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `schema/`                                                | The authored GraphQL contract layers — edit these                                            |
| `generated/commerce-protocol.graphql`                    | Generated single-file assembly of `schema/`; exported at `./commerce-protocol.graphql`       |
| `generated/`                                             | Compiler output. Ignore this directory when reviewing the authored contract                  |
| `generated/schemas/commerce-protocol.bundle.schema.json` | Self-contained validator; prefer it in validator integrations                                |
| `generated/schemas/*.schema.json`                        | Generated modular JSON Schema artifacts                                                      |
| `examples/`                                              | Canonical documents that MUST validate                                                       |
| `examples/store-event-mapping.json`                      | How each store's own notification vocabulary maps onto these event types                     |
| `vectors/signatures.json`                                | Signature vectors every implementation MUST reproduce                                        |
| `generated/vectors/lifecycle.json`                       | Generated entitlement, first-binding, and event-emission vectors implementations reproduce   |
| `generated/bindings/http-binding.json`                   | Generated HTTP manifest: method, path, auth role, statuses, and schema pointer per operation |
| `generated/bindings/operations.graphql`                  | Generated executable GraphQL projection the GraphQL binding serves                           |
| `generated/bindings/graphql-operations.json`             | Generated canonical full-selection GraphQL documents                                         |
| `generated/openapi/commerce-protocol.openapi.json`       | Generated OpenAPI 3.1 document for the REST binding                                          |
| `generated/vectors/operations.json`                      | Generated operation conformance vectors                                                      |
| `conformance/`                                           | The portable conformance runner and its independent mock provider                            |

---

## 1. Scope and architecture

### 1.1 Architecture

The protocol fixes two boundaries around a backend, and the backend behind them
is replaceable.

```text
Apple / Google / Meta / Amazon        the stores
        │
        │  store-native notifications and APIs
        ▼
┌─────────────────────────────────────────────┐
│  A backend that implements this spec        │   ← IAPKit, another provider,
│                                             │     or the adopter's
│  verify → normalize → lifecycle → entitle   │     own, in any language
└─────────────────────────────────────────────┘
   ▲    │
   │    │  OpenIAP Commerce Protocol events (§9)   → any consumer:
   │    ▼                                            analytics, subscriber
   │  data pipeline / CRM / analytics                experience, data pipeline
   │
   │  operations (§4): verify, status, entitlements,
   │  bind, erase, capabilities — over REST (§6) or GraphQL (§7)
   ▼
developer backend / app
```

Two things are specified, both replaceable behind a provider swap:

- **The operation surface (§4–§8).** A caller verifies purchases, reads
  entitlements, binds purchases to its own users, and erases them, over either
  transport binding, against whichever backend implements the protocol.
- **The event on the outbound arrow (§9)**, and — for the store notifications
  named in §9.2 — the normalized meaning an emitter assigns before sending it.

How the backend receives and verifies store facts, which other store APIs it
calls, what it stores, and how it scales remain implementation. A caller written
against these two surfaces does not change when the backend behind them does.

## 2. Core domain model

### 2.1 Conventions

**Timestamps** are integer milliseconds since the Unix epoch, UTC. The single
exception is the transport signature timestamp, which is in **seconds** — see
§9.4.2. That inconsistency is inherited from the deployed 1.0 wire format and is
recorded rather than silently corrected.

**Money** is `{ currency, amountMicros, provenance }`. `amountMicros` is an
integer in millionths of one currency unit, so `1.99 USD` is `1990000`.
Currency is an uppercase ISO 4217 code. `amountMicros` is always a non-negative
magnitude; the event type supplies direction. On a refund event it still says
what the purchase cost, not how much the store returned (§14).

> An absent amount means **unknown**. It never means zero. A consumer that
> treats a missing amount as `0` will under-report revenue.

`provenance` says where the number came from, and the three values are not
interchangeable:

| Value      | Meaning                                                                                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `store`    | The store asserted this amount in a signed notification or an authoritative API response. Only this value is safe to treat as financially authoritative.                                                   |
| `catalog`  | Resolved from the emitter's own product catalog because the store asserted nothing. It is the list price, not necessarily what the customer paid — promotions, regional pricing, and taxes can all differ. |
| `inferred` | Derived by the emitter from other fields. Usable for estimates, never for reconciliation.                                                                                                                  |

An emitter MUST NOT present a `catalog` or `inferred` amount as `store`. A
consumer doing revenue reconciliation SHOULD accept only `store`.

**Identifiers** are opaque strings. A consumer MUST NOT parse structure out of
one.

**Enumerations** are closed unless this document says otherwise. Four value
spaces are deliberately open — `environment` here, `store` below,
`cancellationReason` on the subscription snapshot, and `eventType`, which §12
grows in a MINOR version — and a consumer MUST tolerate a value it does not
recognise in any of them, and MUST NOT act on one it does not know.

**Store, not platform.** This specification keys on `store`, never on device
platform. One device platform can host several stores — an Android build can
ship against Google Play, Amazon Appstore, or Meta Horizon — so platform does
not identify the authority for a purchase.

The store value space is **open**. This version names `apple`, `google`,
`horizon`, and `amazon`, but the contract MUST NOT be read as closing the set:
an implementation observing commerce on another platform is free to emit it, and
a consumer MUST accept and preserve an unrecognised store opaquely rather than
reject the event. Which stores a given backend integrates is its own business —
the point is that no release of this document stands between an adopter and a
platform they need.

### 2.2 The four things that are not the same

Conflating these is the most common server-side commerce bug. They are distinct,
and each answers a different question.

| Concept          | Question it answers                          | Nature                               |
| ---------------- | -------------------------------------------- | ------------------------------------ |
| **Transaction**  | What economic event did the store record?    | An immutable fact                    |
| **Subscription** | What is the current arrangement?             | Mutable state                        |
| **Event**        | What changed, and when?                      | An immutable fact about a transition |
| **Entitlement**  | What may this customer access **right now**? | A derived predicate                  |

A subscription has one **state** at a time. A **transition** between states
produces an **event**. **Entitlement** is computed from state and time, and is
neither of the other two.

#### Subscription state

`Active`, `InGracePeriod`, `InBillingRetry`, `Paused`, `Expired`, `Revoked`,
`Refunded`, `Unknown`.

`Unknown` means the emitter could not classify the subscription — typically
because it was bootstrapped from a receipt rather than from a lifecycle
notification. It does not mean the state machine is uncertain.

`cancellationReason` is an optional, advisory token. This version names
`UserCanceled`, `BillingError`, `PriceIncreaseDeclined`, `ProductUnavailable`,
`Refunded`, and `Other`, but the value space is open. A consumer MUST tolerate
an unrecognised token and MUST NOT use this field as a billing or reporting fact:
unlike `price`, it carries no provenance.

### 2.3 Entitlement

Entitlement is carried as `subscription.active`, and where a `subscription`
member is present that is the field to read — never a re-derivation from
`state`. A store that keeps no canonical subscription record sends no snapshot;
there the `entitlement.*` event type itself carries the decision (§9.5).

**Entitlement is not derivable from `state` alone**, and this is where naive
implementations go wrong:

> A customer who cancels keeps access until the end of the period they already
> paid for. `subscription.canceled` means _auto-renew was turned off_. It does
> **not** mean access was revoked.

The normative predicate is:

| State                            | Entitled?                                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Active`                         | Yes, while `now < expiresAt`                                                                                            |
| `InGracePeriod`                  | Yes, while `now < expiresAt` — where `expiresAt` is the end of the grace window, not of the period that failed to renew |
| `InBillingRetry`                 | No — the store is retrying billing and access is suspended                                                              |
| `Paused`                         | No                                                                                                                      |
| `Expired`, `Revoked`, `Refunded` | No                                                                                                                      |
| `Unknown`                        | No                                                                                                                      |

When `expiresAt` is present, `now == expiresAt` is **not** entitled: the
boundary is exclusive. When it is **absent**, no deadline is known and the state
alone decides — an `Active` or `InGracePeriod` subscription with no `expiresAt`
is entitled.

An emitter MUST set `subscription.active` to the result of this predicate as
evaluated at `processedAt` — the moment it derived the event, not the moment the
store's fact occurred. The two differ only when a notification is processed
after the entitlement boundary has passed, and there the later answer is the
safe one: a grace window that has since closed must not be reported as still
granting access. A consumer MUST NOT recompute entitlement from `state` and
ignore `active`.

`active` is therefore a snapshot at `processedAt`, not a promise about the later
delivery instant. When applying `active: true`, a consumer MUST NOT grant access
beyond a present `expiresAt`; it either schedules that deadline or re-reads an
authoritative status before then. A delivery received at or after `expiresAt`
MUST NOT open the gate. An absent `expiresAt` carries no deadline, so a consumer
that requires freshness beyond the event stream needs an emitter-specific
status source.

> **Do not confuse this with purchase-validation verdicts.** A synchronous
> receipt-validation result answers "is this receipt currently valid?" and has
> its own vocabulary in which a cancelled purchase is invalid. That is a
> different axis from subscription lifecycle state, where a cancelled
> subscription is still entitled until it expires. The same English word means
> opposite things on the two surfaces; they MUST NOT be merged.

### 2.4 Identity

`projectId` identifies the emitter-side **scope** — whatever boundary the
emitter organises commerce by. For a multi-tenant backend that is a tenant; for
a single company's own backend it may be one constant. It is not issued by any
registry, and an implementation MUST NOT be required to obtain one from a third
party. The member name is inherited from the deployed 1.0 wire format;
`applicationId` is an optional finer scope within it. Both are opaque.

`userId` is the app user the purchase is bound to, expressed in the identity
space **shared by the emitter and its consumer**. There is no global user
directory and no central identity resolution: the value only has to mean the
same thing to those two parties. It is absent when no binding exists, and this
specification defines no account-merge semantics — a purchase can be observed
before any user is known.

An `entitlement.*` event is an actionable access decision, so it MUST carry both
`userId` and `productId`. An emitter that has not bound a purchase to a user may
emit a lifecycle event, but MUST defer the entitlement decision until the
binding exists.

At first binding, the emitter MUST coalesce all unbound gate changes into the
gate's **current** value, evaluated at the binding event's `processedAt`. The
unbound baseline is not entitled: emit one `entitlement.granted` if the current
predicate is true, and emit no entitlement event if it is false. An emitter MUST
NOT replay an historical grant or revoke whose result is no longer current. A
grant uses the occurrence value §9.3 assigns to the latest transition or
observation that established the current gate. An emitter that retains no
attributable occurrence MAY defer the grant to its next store observation
rather than invent source facts; until that observation arrives the consumer
has no entitlement event, so an emitter SHOULD retain enough of the
originating occurrence to grant at binding. `processedAt` records when the
bound event was derived. `generated/vectors/lifecycle.json` pins the coalescing
cases, including a grant that expired before binding.

`transactionId` and `originalTransactionId` carry store-side transaction
identity **where the store exposes it**. Neither is universally available:
Google Play does not put one in a subscription notification — an emitter that
wants it must read the store's subscription API — and Meta
Horizon exposes no transaction identity at all. A consumer MUST NOT require
them.

## 3. Profiles

The protocol is a small core plus named profiles, so a provider can be honest
about what it serves and a caller can branch on declarations instead of
guessing.

**Core** is not a profile; every provider carries it: the domain model (§2),
the portable error model (§8), the capability descriptor and its
`providerCapabilities` operation (§10), and the versioning rules (§12).

| Profile            | Operations                           | Obligations                                                                                  |
| ------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| `verification`     | `verifyPurchase`                     | Verify store evidence under §4.1 without touching any account                                |
| `entitlements`     | `subscriptionStatus`, `entitlements` | Serve tokenless, fail-close server reads under §4.2 and §4.3                                 |
| `events`           | none                                 | Emit and deliver normalized events under §9 — taxonomy, envelope, signature, and retry rules |
| `accountLifecycle` | `bindPurchase`, `eraseUser`          | Bind purchases to caller-owned identities and erase them under §4.4 and §4.5                 |

Profile membership is declared in the SDL and generated into the HTTP
manifest; the four names above are this version's, and the space is open —
a consumer MUST ignore a profile name it does not recognise.

A provider implements a profile **completely or not at all**. It MUST declare
in its capability descriptor (§10) every profile it serves and MUST NOT
declare one it serves partially or does not pass conformance for (§11).
Profiles version independently as MAJOR.MINOR; a caller pins on the major.

---

## 4. Operations

Six operations make up the 1.0 surface. `commerce-protocol.graphql` is
authoritative for their input and result structure; this section is
authoritative for their behavior. Rules that apply to every operation:

- **One input, one result.** An operation takes at most one `input` document
  and returns one result document or one protocol error (§8).
- **Omission means unknown.** A provider that cannot determine an optional
  result member MUST omit it, never send a placeholder — the same rule §12
  states for events. Operation types never combine nullable with omittable,
  so the two bindings cannot disagree about what an absent member means.
- **Idempotency.** Every 1.0 operation is idempotent: repeating a call with
  the same input yields the same outcome, apart from members the operation
  documents as progressing (an erasure job's `status`). A caller MAY retry on
  timeout without a dedicated idempotency key.
- **Fail-close.** A provider that cannot answer completely — a partial read,
  an overflowing record set, an unclassifiable state — MUST fail the
  operation rather than answer from what it has.
- **Provider time.** Entitlement gates are evaluated at the provider's own
  read time. A caller-supplied timestamp is never an input to an access
  decision.
- **Unknown input members.** The REST binding ignores an input member it does
  not recognise, which is what makes a MINOR input addition safe (§6). The
  GraphQL binding rejects one at validation instead (§7); GraphQL callers
  regenerate against the published schema.

### 4.1 verifyPurchase

Verifies store evidence and returns a verdict. The evidence union is
discriminated on the open `store` space: for each store this version names,
the matching evidence member is required, and a provider MUST reject a store
it does not integrate with `UNSUPPORTED_STORE` rather than failing schema
validation — a future store is a MINOR addition, not a break.

`isValid` is the acceptance gate and the only one: `state` is advisory detail
in an open token space, and a caller MUST NOT re-derive acceptance from it.
Store rejection of the evidence is a **successful** operation whose result
says `isValid: false`; `VERIFICATION_FAILED` is reserved for the provider
failing to obtain a verdict at all. A verification verdict is the
purchase-validation axis §2.3 warns about — it is not subscription lifecycle
state.

Verification is account-free. It binds no user, reads no account, and is
callable with the verification role (§5), so a shipped app can hold the
credential that calls it. A provider MUST NOT let this operation, or any
input to it, select or mutate account state.

### 4.2 subscriptionStatus

A developer backend reads one user's subscription standing: an `active` gate
for the user as a whole, plus the most relevant record — the current
entitling subscription when one exists, otherwise the provider's most recent
record as context, and no record member at all when the provider has none.

The snapshot is **tokenless by construction**: no purchase token, store
transaction identity, signed receipt, or provider-internal record identifier
appears in it. Server role only — a verification credential MUST be refused,
because with it a shipped app could walk arbitrary user identities.

### 4.3 entitlements

The access decision for one user: every product whose gate is open at the
provider's read time, with the entitling records. Unknown, expired, and
ambiguous records contribute nothing. The same tokenless and server-role
rules as §4.2 apply.

### 4.4 bindPurchase

Connects verified store evidence to the caller's own opaque user identity —
the identity space of §2.4. Server role only: token possession is
deliberately not proof of ownership, so binding is a decision the caller's
authenticated backend makes, never a shipped app.

Binding is idempotent and never moves an existing binding. `bound: false`
covers every non-binding outcome — unknown evidence, evidence bound to a
different user, a store the provider cannot bind — without distinguishing
them, so the operation cannot probe whether someone else's purchase exists.
How a provider recovers a purchase bound to the wrong user is management
plane, outside this contract.

### 4.5 eraseUser

Removes a user identity from the provider's subscription records and from its
protocol event identity. Server role only. The operation acknowledges with
`accepted` and, where the provider processes erasure as a job, a `jobId` and
an open-space `status`; re-requesting the same user is idempotent and reports
the current job.

Erasure is bounded by physics: a provider erases **its own** records and
event store. It CANNOT unsend events, so copies already delivered to the
caller's systems are the caller's own responsibility to erase — a provider
MUST NOT claim otherwise.

### 4.6 providerCapabilities

Returns the capability descriptor (§10). No credential, no commerce data,
and no central registry: the answer is self-describing and a conformance
runner reads it the same way a caller does.

---

## 5. Authentication and trust

The protocol standardizes **roles and rules**, not credential formats. How a
provider issues, names, or rotates credentials is its own business; no
prefix, length, or issuer is part of this contract.

| Role             | Holder                             | May call                                             |
| ---------------- | ---------------------------------- | ---------------------------------------------------- |
| **verification** | May ship inside an application     | `verifyPurchase`, `providerCapabilities`             |
| **server**       | The caller's authenticated backend | Everything the verification role may, plus §4.2–§4.5 |
| _operator_       | Whoever administers the provider   | Management plane — outside the portable contract     |

Both bindings MUST enforce:

- Credentials travel in the `Authorization` header. A provider MUST NOT
  accept a secret in a URL path or query string, where proxies and logs
  retain it.
- Auth failures fail close: no credential is `UNAUTHORIZED`, a credential of
  the wrong role is `FORBIDDEN`, and neither response reveals whether the
  target of the call exists.
- For an operation that requires the **server** role, authorization precedes
  input validation: a caller without a valid server credential MUST receive
  `UNAUTHORIZED` or `FORBIDDEN`, never a verdict about its input — an
  input-validation answer would let an unauthenticated caller map the
  privileged surface (which stores bind, which members exist, which bounds
  apply). Transport-shape failures — an unparseable or oversized body, or a
  GraphQL document that fails parsing or validation — MAY still precede
  authorization: they say nothing operation-specific. Variable coercion
  against the operation input IS input validation, not transport shape — a
  GraphQL engine coerces variables before any resolver runs, so a provider
  that authorizes only inside resolvers violates this rule and MUST
  authorize the operation before executing the document. Verification-role
  operations are exempt
  because their input schema is the published client contract an application
  already ships with.
- The verification role and the server role are distinct credentials. A
  provider MUST NOT let a verification credential reach an account read or
  mutation, which is what blocks arbitrary-`userId` lookups from shipped
  apps.
- A provider MAY rate-limit any operation. It signals with `RATE_LIMITED`
  and SHOULD send `Retry-After` seconds on the REST binding.
- 1.0 defines no pagination: no operation returns an unbounded collection,
  and §4's fail-close rule covers a record set a provider cannot bound. A
  future paginated operation defines its cursor semantics when it is added.

---

## 6. REST binding

The REST binding serves every operation under the versioned `/commerce/v1`
namespace, described end to end by two generated artifacts: the HTTP manifest
(`generated/bindings/http-binding.json`) and the OpenAPI 3.1 document. Both
are compiled from the SDL — neither is authored, so neither can drift from
the contract.

Per operation the manifest fixes: HTTP method (`GET` for queries, `POST` for
mutations), path, auth role, success status, idempotency, the error codes it
may return, and JSON Schema pointers for its input and result inside the
offline bundle.

- A `GET` operation carries its input as query parameters; every such input
  member is a scalar by construction (the compiler rejects anything else).
  Opaque identifiers are not secrets (§5 keeps credentials out of URLs), but
  a deployment that must keep user identifiers out of intermediary logs
  should note that they ride the query string here.
- A `POST` operation carries its input as a JSON body with
  `Content-Type: application/json`.
- Success is exactly the operation's `successStatus`. Every failure returns
  the status §8 assigns to its code, with a `ProtocolErrorResponse` body.
- An unrecognised input member is ignored (§4), and a caller MUST ignore
  unrecognised result members — the same open-object rule the event envelope
  follows.

### 6.1 Default paths

| Operation              | Method | Path                                |
| ---------------------- | ------ | ----------------------------------- |
| `providerCapabilities` | GET    | `/commerce/v1/capabilities`         |
| `subscriptionStatus`   | GET    | `/commerce/v1/subscriptions/status` |
| `entitlements`         | GET    | `/commerce/v1/entitlements`         |
| `verifyPurchase`       | POST   | `/commerce/v1/purchases/verify`     |
| `bindPurchase`         | POST   | `/commerce/v1/purchases/bind`       |
| `eraseUser`            | POST   | `/commerce/v1/users/erase`          |

A provider serves these paths relative to a base URL it documents. The path
segment `v1` is the protocol major version, so a future major can be served
beside this one.

---

## 7. GraphQL binding

The GraphQL binding serves the same six operations at one HTTP endpoint —
IAPKit serves `/commerce/v1/graphql`, and a provider documents its own — as
an executable schema that MUST define everything the generated projection
(`generated/bindings/operations.graphql`) defines, exactly as it defines it;
a newer compatible MINOR may extend it additively (§12), never alter it.
Introspection, where enabled, MUST agree with the schema served; the
projection contains no secret, so there is no reason to hide it, and a
provider MAY still gate introspection behind a credential.

- Requests are `POST` with the standard `{query, operationName, variables}`
  JSON body, the operation input passed as the `input` variable. The same
  credentials travel in the same `Authorization` header, and the same role
  rules apply (§5).
- **No Subscription root, ever.** The operation surface is bounded
  request/response; a GraphQL subscription is a stream a shipped app could
  hold open, which the webhook direction rule (§9.4) forbids. The compiler
  rejects a `Subscription` type in the SDL.
- An operation failure is an HTTP `200` whose `errors[*].extensions.code`
  carries the §8 code — any error that carries a protocol code MUST be
  delivered at `200`. This includes a refusal decided before execution,
  such as an authorization or rate-limit rejection; a pre-execution refusal
  omits the `data` member.
- A request-level failure — the document or variables themselves could not
  be processed: unparseable document, validation failure, variable coercion
  — MAY carry no protocol code or MAY carry the generic `INVALID_REQUEST`,
  never a more specific code. The two categories are exclusive per envelope:
  one `errors` array is either all coded or all codeless — a codeless entry
  riding beside coded ones would be invisible to every code check. It omits the `data` member entirely, and only
  the codeless form MAY be delivered as HTTP `400` instead of `200`. A
  caller treats either form as `INVALID_REQUEST`; only where the request
  died differs.
- GraphQL cannot express omitted-versus-null on a selected member: a member
  the provider omitted comes back as `null`. Operation types therefore never
  make `null` meaningful (the compiler rejects a nullable omittable member),
  and a caller normalizes `null` to absent. On input, an explicit `null` for
  an omittable member means absent.
- A provider MAY bound query depth, size, or aliasing, but MUST accept the
  canonical documents (`generated/bindings/graphql-operations.json`) — they
  are the deepest selections the contract can produce.
- Business logic MUST NOT live in resolvers. Resolvers adapt transport;
  §11's parity requirement exists to make a divergent resolver visible.

---

## 8. Portable errors

One open code space serves both bindings; the wire wrapper differs, the
meaning MUST NOT. REST wraps a failure as
`{ "error": { "code", "message" } }` with the mapped status; GraphQL carries
the code in `errors[*].extensions.code` (§7). A message is human-readable
and MUST NOT contain credentials, store evidence, signed payloads, stack
traces, or implementation source paths.

| Code                  | HTTP | Meaning                                                                      |
| --------------------- | ---- | ---------------------------------------------------------------------------- |
| `INVALID_REQUEST`     | 400  | The input is malformed or fails the operation schema                         |
| `UNAUTHORIZED`        | 401  | No usable credential was presented                                           |
| `FORBIDDEN`           | 403  | The credential's role may not call this operation                            |
| `NOT_FOUND`           | 404  | The addressed resource does not exist                                        |
| `PURCHASE_NOT_FOUND`  | 404  | The evidenced purchase is unknown, where an operation distinguishes that     |
| `CONFLICT`            | 409  | The request contradicts current state                                        |
| `UNSUPPORTED_STORE`   | 422  | The provider does not integrate the named store                              |
| `RATE_LIMITED`        | 429  | Too many requests; retry after the signalled delay                           |
| `INTERNAL_ERROR`      | 500  | The provider failed internally                                               |
| `UNSUPPORTED_PROFILE` | 501  | The operation belongs to a profile this provider does not serve              |
| `VERIFICATION_FAILED` | 502  | The provider could not obtain a verdict — never the store rejecting evidence |

The space is open: a MINOR version can add a code, so a caller MUST treat an
unrecognised code as a failure of the operation rather than a protocol
violation. The generated manifest carries this same table as
`errorStatus`; the test suite keeps the two in exact agreement.

---

## 9. Event delivery

The asynchronous half of the protocol: what an emitter says happened, and
how it reaches a consumer. Everything in this section is the Event
Delivery profile (§3); its rules bind any implementation that declares
`events`, whether or not it serves the operation surface.

### 9.1 Event taxonomy

Two families of event type, listed in full below and named as examples in the
generated event schema. The value space remains open so a MINOR version can add
a type. The known taxonomy is deliberately small: it covers exactly the
transitions at least one store can actually report, and nothing speculative.

### Subscription lifecycle

| Event                                | Meaning                                                                                                                                                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `subscription.started`               | The emitter began a new subscription record, including a resubscription for which it has no earlier store history                                                                                                                                                        |
| `subscription.renewed`               | A billing period completed and another began                                                                                                                                                                                                                             |
| `subscription.recovered`             | An existing subscription record is live again — billing succeeded after a failure, a customer resubscribed, or a refund was reversed. A consumer measuring dunning recovery specifically MUST NOT count this event alone; §9.2 says which store notification produced it |
| `subscription.entered_grace_period`  | Billing failed; access retained while the store retries                                                                                                                                                                                                                  |
| `subscription.entered_billing_retry` | Billing failed; access suspended while the store retries                                                                                                                                                                                                                 |
| `subscription.expired`               | The subscription ended                                                                                                                                                                                                                                                   |
| `subscription.canceled`              | Auto-renew was turned off; access continues until the period ends                                                                                                                                                                                                        |
| `subscription.uncanceled`            | Auto-renew was turned back on before the period ended                                                                                                                                                                                                                    |
| `subscription.revoked`               | The store withdrew the purchase                                                                                                                                                                                                                                          |
| `subscription.refunded`              | The purchase was refunded                                                                                                                                                                                                                                                |
| `subscription.product_changed`       | The subscription moved to a different product                                                                                                                                                                                                                            |
| `subscription.price_changed`         | The renewal price changed                                                                                                                                                                                                                                                |
| `subscription.deferred`              | The next billing date was pushed out without a product change                                                                                                                                                                                                            |
| `subscription.paused`                | The subscription was paused                                                                                                                                                                                                                                              |
| `subscription.resumed`               | A paused subscription resumed                                                                                                                                                                                                                                            |

### Entitlement delta

| Event                 | Meaning                 |
| --------------------- | ----------------------- |
| `entitlement.granted` | Access became available |
| `entitlement.revoked` | Access was withdrawn    |

An emitter MUST emit an entitlement event **only when the gate actually flips** —
that is, when the entitlement predicate's result differs from its result before
the transition. Emitting one alongside every lifecycle event would make the
signal useless for access control.

An entitlement event carries `userId` and `productId` (§2.4). If it includes a
subscription snapshot, `entitlement.granted` requires `active: true` and
`entitlement.revoked` requires `active: false`.

When a subscription snapshot is present, its state MUST agree with lifecycle
events that name a state: `started`, `renewed`, `recovered`, and `resumed` use
`Active`; `entered_grace_period` uses `InGracePeriod`;
`entered_billing_retry` uses `InBillingRetry`; and `expired`, `revoked`,
`refunded`, and `paused` use their corresponding states. The GraphQL contract
enforces these pairs. Events such as cancellation and product or price changes
do not name a state and therefore retain the state that actually followed the
store transition.

A transition that changes nothing — a redelivered notification, a no-op update —
MUST emit no event at all. Otherwise consumers count retries as activity.

### 9.2 Where the events come from

`examples/store-event-mapping.json` gives the normalization table: each store's
own notification type, and the event it becomes. An implementer follows it
instead of reverse-engineering an existing backend.

Four properties of that table are worth stating here, because they are easy to
get wrong:

- **A notification can map to nothing.** An audit-only or informational
  notification — a delivery test, a pause-schedule metadata update, a consent
  change — is received, acknowledged, and emits no event. That is a mapping, not
  a gap, and each such row carries its reason.
- **One notification type usually means more than one thing.** Three kinds of
  qualifier separate them, and a row carries whichever applies:
  - a **subtype** the store sends — Apple marks a recovery from billing failure
    with `BILLING_RECOVERY` on the same `DID_RENEW` it uses for an ordinary
    renewal;
  - the subscription's **prior state** — Google sends `SUBSCRIPTION_RECOVERED`
    for both a recovery and a resume from pause and marks nothing, so only the
    state before the event separates them (`whenPreviousState`);
  - whether the emitter has **any store history** for the purchase
    (`whenNoPriorStoreEvent`). This one is easy to miss and changes the answer
    often: a notification about a purchase the emitter has never heard from the
    store before begins the story, while the identical notification about a
    purchase it has been tracking continues one. Note the axis is store history,
    not record existence — a purchase learned from a client receipt but never
    from the store still begins the story.

  An implementation MUST prefer a qualified row over the unconditional one. A
  row never carries both `whenNoPriorStoreEvent` and `whenPreviousState`; the
  first says there is no history to have a state in, the second says what that
  state was.

  Selection is deterministic. A row's wire key is `storeNotificationCode` when
  present, otherwise `storeNotification`; first retain rows whose key equals the
  received notification value. Then prefer an exact `storeSubtype`. If no exact
  subtype row exists, use the row whose subtype is absent or null. Within that
  pair, prefer a matching history or prior-state condition over the
  unconditional row. If no row matches, acknowledge the notification and emit
  nothing; an emitter MUST NOT guess a lifecycle event.

- **The store's own wire value is `storeNotificationCode` where it differs from
  the name.** Google Play transmits a number; `SUBSCRIPTION_RENEWED` is a
  documentation label that never appears on the wire. Apple transmits the name.
- **Entitlement events are never mapped.** They are derived from the gate
  flipping, so no store notification produces one directly.

### 9.3 The event envelope

Full structure in `commerce-protocol.graphql`; its generated validator is
`generated/schemas/commerce-event.schema.json`. Required members:
`eventId`, `eventType`, `eventVersion`, `occurredAt`, `processedAt`, `store`,
`environment`, `projectId`. An entitlement event additionally requires `userId`
and `productId` (§2.4).

`occurredAt` is the best authoritative time for the commerce fact. For a store
notification or API response that supplies the transition time, it is that
store-asserted time. If a poll reveals only that a value changed since the last
observation, it is the time the emitter observed the new value; an emitter MUST
NOT invent or interpolate a more precise instant. That fallback is an
observation boundary, not a claim about the exact store transition.

`processedAt` is when the emitter derived the event. It can differ from
`occurredAt` by hours after an outage. Consumers use `occurredAt` for the
portable business ordering described in §9.4.4, while recognising that a
poll-derived value orders observations rather than reconstructing an unknown
instant inside the polling interval.

**`price` is context, not a charge record, and events are not summable.** Stores
repeat the subscription's amount on notification after notification: one Apple
subscription that renews, is cancelled, then lapses produces three events all
carrying the same figure. Within a single notification the amount also rides
exactly one event — the lifecycle event where there is one, otherwise the
entitlement event — so it is never duplicated by the entitlement delta. But
across notifications it recurs by design.

A consumer computing revenue therefore MUST NOT add up every event that has a
`price`. `subscription.started`, `subscription.renewed`, and
`subscription.recovered` can represent positive revenue, but a consumer SHOULD
book them only when `provenance` is `store`. `subscription.refunded` says a
reversal occurred, but 1.0 carries no returned amount, so a consumer MUST NOT
debit `price.amountMicros` as though it were the refund amount. It must reconcile
the amount through store-authoritative data. Every other event carries `price`
only as context. `subscription.revoked` is not a reversal: it withdraws access,
and whether money moved with it is a fact the stores do not always report.

`eventId` is the deduplication key, and the only one. A `transactionId` cannot
serve as a second: Play subscription notifications carry none at all, and where a
store does issue one it repeats it across the charge, the refund that reverses
it, and the re-charge that reverses the refund — which a reversal of an
already-recovered charge collapses onto one event type as well. §9.1 already
requires an emitter not to re-emit an unchanged fact, so a second key defends
against a violation of that rule rather than against anything this contract
permits.

`sourceStoreEventId` carries the **store's own** notification identifier — an
App Store `notificationUUID`, a Play RTDN `messageId` — so support can
cross-reference against the store console. It is not the emitter's own row
identifier, and an emitter MUST NOT place internal record identifiers in it.

`extensions` is the escape hatch for store-specific detail with no canonical
equivalent. It is flat, string-valued, and bounded at 24 entries, 64-character
keys, and 512-character values. Its content is provider-influenced: a consumer
MUST treat every value as untrusted input.

An emitter MUST NOT place credentials, raw store payloads, signed receipts, or
personal data beyond the identifiers above into any member.

### 9.4 Webhook contract

Direction is **store → backend → consumer**, server-to-server in both hops.

This specification defines **no** backend-to-client stream. There is no SSE
endpoint, WebSocket, push relay, or long-poll feed for shipped applications: a
project-wide event feed and its signing secret must never reach a distributed
app. An application that needs device push gets it from its own authenticated
backend, downstream of this contract.

#### 9.4.1 Request

`POST` to an HTTPS URL the consumer gave the emitter directly. The body is one
event document encoded as UTF-8, with `Content-Type: application/json`.
`Content-Encoding` MUST be absent or `identity`; transport compression would
make “raw body bytes” ambiguous across HTTP stacks.

| Header                | Value                                                  |
| --------------------- | ------------------------------------------------------ |
| `openiap-signature`   | `v1=<hex>`, or several comma-separated during rotation |
| `openiap-timestamp`   | Unix **seconds** at signing                            |
| `openiap-event-id`    | The event's `eventId`                                  |
| `openiap-delivery-id` | Identifies this delivery attempt chain                 |

The headers are conveniences. **The signed body is the authority**: a consumer
MUST take `eventId` from the parsed body, not from the header, because only the
body is covered by the signature. A request MUST carry exactly one
`openiap-timestamp`, encoded as a non-negative base-10 integer with no sign.

#### 9.4.2 Signature

```text
signed_payload = ascii(openiap-timestamp) || 0x2e || raw_body_bytes
signature = "v1=" + lowercase_hex(HMAC_SHA256(secret_bytes, signed_payload))
```

`ascii(openiap-timestamp)` is the exact base-10 header value, `0x2e` is `.`, and
`raw_body_bytes` are the **exact bytes received**. A consumer MUST NOT parse and
re-serialize the JSON before verifying: whitespace, escaping, key order, and
UTF-8 bytes are part of the signature.

The shared secret is an opaque string. Its exact UTF-8 bytes — including any
prefix — are the HMAC key; an implementation MUST NOT strip a prefix or decode a
hex-looking suffix. An emitter generating a secret MUST use a cryptographically
secure random source with at least 32 random bytes before encoding it.

A consumer MUST:

1. Reject when `|now - timestamp| > 300` seconds. The timestamp is inside the
   signed material, so a captured body cannot be replayed under a fresh header.
2. Split `openiap-signature` on `,` and trim each value. Compare every presented
   `v1=` signature against every currently valid secret, and accept if **any
   pair** matches. Comparing the header as a whole fails during rotation.
3. Compare in constant time.

During secret rotation an emitter signs with both keys and sends both values, so
a consumer that has rolled only one side still validates. An emitter SHOULD keep
the previous secret valid for at least 24 hours.

> This scheme carries no key identifier, so a consumer holding two signatures
> cannot tell which key produced which. Algorithm agility therefore requires a
> new signature prefix; `v1=` is the version marker.

`vectors/signatures.json` contains reproducible cases and rejection cases. An
implementation MUST reproduce every `expected` value and MUST reject every entry
in `rejections`. Its deterministic fixture secrets are test inputs, not examples
of production secret generation.

#### 9.4.3 Response semantics

| Consumer returns            | Emitter behaviour                |
| --------------------------- | -------------------------------- |
| `2xx`                       | Delivered                        |
| `408`, `429`, `5xx`         | Retry                            |
| `3xx`                       | Permanent failure; do not follow |
| Other `4xx`                 | Permanent failure; do not retry  |
| Timeout or connection error | Retry                            |

A consumer SHOULD acknowledge **before** doing slow downstream work. Holding the
connection open for processing invites duplicate deliveries.

Every retry is a new HTTP attempt. The emitter MUST keep the body and `eventId`
unchanged, choose a fresh current `openiap-timestamp`, and recompute the
signature. Replaying the original signed request after five minutes is not a
retry: a conforming consumer rejects it as stale. `openiap-delivery-id` stays
stable across the attempt chain.

#### 9.4.4 Delivery guarantees

**Duplicate-capable. Unordered. No exactly-once guarantee.**

An event may reach a consumer more than once. Eventual acceptance is not
guaranteed: a permanent response or exhausted retry budget ends in failure or a
dead-letter record, so a consumer may accept zero copies.

An emitter MUST retry with exponential backoff and MUST eventually stop and
dead-letter rather than retry forever.

A consumer MUST be idempotent on `eventId`, which is stable for the lifetime of
an event. An emitter MUST NOT reuse an `eventId` and MUST NOT change the
`eventId` of an event it has already delivered.

This specification provides **no ordering guarantee**. Retries, backoff, and
independent per-destination queues all reorder events. A consumer that needs the
business timeline uses `occurredAt`, not `processedAt`, and MUST tolerate an
older event arriving after a newer one. When it can correlate a stable purchase,
a stateful consumer MUST NOT let an older snapshot overwrite newer state. That
rule does not discard the whole event: independent idempotent effects, such as
recording a charge occurrence, may still be new work.

Identifying "the same purchase" is the consumer's problem, and the envelope does
not solve it for every store. `originalTransactionId` serves where the store
issues one. Where it does not, the consumer keys on a binding it established
itself — but neither `userId` nor `productId` is safe alone: `userId` is absent
until a purchase is bound (§2.4), and `productId` changes by design on
`subscription.product_changed`. A consumer that cannot establish a stable key
cannot derive current state from this stream. If it needs current state and the
provider declares the entitlements profile, it uses `subscriptionStatus` or
`entitlements` (§4.2–§4.3). Otherwise it falls back to an emitter-specific
authoritative status source.

Events derived from one notification share an `occurredAt`. This
specification sets no tiebreaker among them, so a consumer MUST NOT read equal
timestamps as a contradiction.

#### 9.4.5 Destination safety

An emitter MUST refuse to deliver to a destination that is not public HTTPS.
Specifically it MUST reject: non-`https` schemes; credentials embedded in the
URL; and any address that is not globally routable unicast. The last category
includes unspecified, loopback, private, shared/CGNAT, link-local,
documentation, benchmarking, multicast, reserved, and IPv6 unique-local ranges,
including IPv4-mapped IPv6 spellings such as `::ffff:127.0.0.1`, which URL
parsers normalize into a form that defeats textual checks.

An emitter MUST NOT follow redirects and MUST validate **every** address a
hostname resolves to. It MUST also connect only to a validated public address,
either by pinning that address for the connection or by verifying the connected
peer before sending any request bytes. A second DNS answer must not be able to
substitute a private target.

This is a guard, not a substitute for network egress policy: DNS can still
resolve a public name to an address the operator did not intend.

### 9.5 Example consumer flow

One subscription, four events, and the mistake they are designed to prevent.
The quoted payloads are abridged from files in `examples/`, which the test suite
validates in full.

#### The customer renews

Apple sends `DID_RENEW` with no subtype. §9.2 therefore selects the
unconditional row and the event is a renewal, not a recovery — Apple marks a
recovery with `BILLING_RECOVERY`. It emits `examples/subscription-renewed.json`:

```json
{
  "eventType": "subscription.renewed",
  "subscription": {
    "state": "Active",
    "expiresAt": 1758979200000,
    "active": true
  },
  "price": { "currency": "USD", "amountMicros": 9990000, "provenance": "store" }
}
```

The consumer verifies the signature, checks `eventId` against its
deduplication store, and books 9.99 USD of revenue — safely, because
`provenance` is `store`, meaning Apple asserted the amount rather than the
backend inferring it.

The entitlement gate did not move: the customer was entitled before and is
entitled after. **No entitlement event is emitted.** A consumer that regranted
access on every lifecycle event would be doing pointless work here.

#### The customer cancels

`examples/subscription-canceled.json`:

```json
{
  "eventType": "subscription.canceled",
  "subscription": {
    "state": "Active",
    "expiresAt": 1758979200000,
    "willRenew": false,
    "active": true
  }
}
```

**This is the trap.** The event is called `canceled`, and access must not be
revoked. The customer paid through `expiresAt`, so `state` is still `Active`,
`active` is still `true`, and only `willRenew` has flipped. Again no entitlement
event, because the gate did not move.

A consumer that switched on `eventType` and revoked here would cut off a paying
customer weeks early. A consumer that reads `subscription.active` cannot make
that mistake. That is why §2.3 makes `active` the field to read and the
predicate normative.

#### The subscription lapses

At `expiresAt` the store reports expiry. Now the gate does move, so the backend
emits two events — the lifecycle fact, then the entitlement delta:

```text
subscription.expired      state: Expired, active: false
entitlement.revoked       examples/entitlement-revoked.json
```

The consumer revokes access on `entitlement.revoked`. It could equally act on
`subscription.expired`, but the entitlement event is the one that carries the
same meaning for every store — including a store that produces no subscription
lifecycle at all (§10).

> On such a store the event arrives with **no `subscription` member**, because
> there is no canonical record to snapshot. `eventType` alone then carries the
> access decision, which is why the reference consumer below handles both.

#### What the consumer had to know

Nothing about Apple. The same events arrive in the same shape from Google and
from any other backend implementing this specification. The receiving endpoint
verifies and validates the event, atomically places a new `eventId` in a durable
inbox, and acknowledges quickly (§9.4.3). A retry with the same ID is a no-op. A
worker then applies effects idempotently on that same ID:

```js
async function receive(headers, rawBody, secret) {
  if (!verifySignature(headers, rawBody, secret)) return 401; // §9.4.2

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return 400;
  }

  if (typeof event.eventVersion !== "string") return 400;
  // A redelivery of an unsupported major will not become readable.
  if (event.eventVersion.split(".")[0] !== "1") return 200;
  if (!validateCommerceEventV1(event)) return 400;

  // The allowlist is generated from the contract. Never use a prefix test:
  // MINOR versions add types that a pinned consumer must ignore safely.
  if (!isKnownEventTypeV1(event.eventType)) return 200;

  await inbox.enqueueOnce(event.eventId, event); // atomic and durable
  return 202;
}

async function process(event) {
  // §9.4.4: stale snapshots cannot overwrite newer state, but other effects may
  // still be new work.
  const mayApplyState = !(await isOlderThanAppliedState(event));

  if (mayApplyState && event.userId && event.subscription) {
    await applyAccessSnapshotOnce(event.eventId, event.userId, {
      productId: event.subscription.productId,
      active: event.subscription.active,
      expiresAt: event.subscription.expiresAt,
    }); // never grants at or beyond expiresAt
  } else if (
    mayApplyState &&
    ["entitlement.granted", "entitlement.revoked"].includes(event.eventType)
  ) {
    await setAccessOnce(
      event.eventId,
      event.userId,
      event.productId,
      event.eventType === "entitlement.granted",
    );
  }

  const CHARGE_EVENTS = new Set([
    "subscription.started",
    "subscription.renewed",
    "subscription.recovered",
  ]);
  if (
    CHARGE_EVENTS.has(event.eventType) &&
    event.price?.provenance === "store"
  ) {
    await recordRevenueOnce(event.eventId, event.price);
  }

  // §14 carries no refund amount; record the occurrence, not a guessed debit.
  if (event.eventType === "subscription.refunded") {
    await recordRefundOnce(event.eventId, event.transactionId);
  }

  await inbox.complete(event.eventId);
}
```

---

## 10. Provider capabilities

Stores are not equivalent, and this specification never invents lifecycle
semantics to make them look uniform. An emitter SHOULD publish a capability
declaration (generated validator:
`generated/schemas/provider-capabilities.schema.json`) so a consumer can branch
on what is actually observable.

An implementation SHOULD publish its descriptor somewhere a consumer can fetch
it, and SHOULD document where. This version deliberately fixes no location: a
backend may serve it, ship it beside its API documentation, or hand it over out
of band. Nothing in the contract depends on retrieving it; a consumer that
cannot fetch it asks its emitter. The document states `specVersion` — the
version of _this specification_ it was
written against, which is a different quantity from an event body's
`eventVersion` even though both read `1.0` today — the event types it can emit,
and its per-store capabilities — enough for a consumer, an operator, or a
tool to determine compatibility without reading prose or guessing. It carries no
commerce data, so it is safe to expose.

Each capability carries **two** booleans, deliberately separate:

- `provider` — what the store's own API offers.
- `implementation` — what this backend actually consumes.

They differ in practice. Amazon publishes Real-Time Notifications that a given
backend may not have integrated; that is an implementation gap, not a store
limitation, and collapsing the two into one boolean hides which one it is. A
`notes` string is **required** whenever either is false or the two disagree.

`examples/provider-capabilities.json` is the reference implementation's own
descriptor. Read its `implementation` axis as one backend's answer, not as the
specification's; its `notes` say what each store's surface does and does not
report.

A store whose descriptor declares `serverNotifications.implementation: false`
produces **no** notification-derived lifecycle events from that emitter. The
`provider` axis explains whether the gap belongs to the store or the
implementation. A consumer MUST NOT infer absence of a subscription from
absence of events. When no descriptor is available, every capability is unknown
and the consumer must use an emitter-specific status source if it needs an
answer; a missing optional descriptor never upgrades silence into evidence.

Such a store is not necessarily silent, though. Where an authoritative endpoint
can be re-asked on a schedule, an emitter can still observe the entitlement
answer changing and emit `entitlement.granted` / `entitlement.revoked` from it —
the mapping table records this per store as `derivableByPolling`. It never
yields subscription lifecycle: polling reveals that access changed, never which
transition caused it. This version specifies no cadence, so an emitter that does
it MUST still declare its capabilities honestly rather than claim parity with a
store that pushes notifications.

For such an event, `occurredAt` MUST be the time the emitter observed the new
authoritative answer and `processedAt` is when it derived the event. The actual
gate change may have happened at any time since the preceding observation, so
the emitter MUST NOT backdate it to a guessed transition time (§9.3).

### 10.1 Profiles and bindings

Two optional members extend the descriptor for providers that serve the
operation surface. `profiles` maps each served profile name to its version;
`bindings` does the same for `rest` and `graphql`. Declaring a binding means
every declared profile operation is reachable over it, and declaring either
is a conformance claim (§11): a provider MUST NOT declare a profile or
binding it serves partially. Both maps are open — a consumer ignores a key
it does not recognise — and both are absent on a descriptor from an
events-only emitter that predates the operation surface, which is exactly
how a consumer tells the two kinds of backend apart.

---

## 11. Conformance

### 11.1 Levels

Binding support is declared per provider (§10), and conformance is judged
per binding:

- **REST-conformant** — every declared profile's operations pass the vectors
  over the REST binding.
- **GraphQL-conformant** — the same over the GraphQL binding.
- **Dual-binding** — both, plus cross-binding parity: every deterministic
  vector's normalized outcome agrees across the two bindings.

A provider claims **full provider portability** only when it implements the
shared operation profiles it declares, at least one portable binding, and
the Event Delivery profile, and passes conformance for all of them.
**Dual-binding reference implementation** describes an implementation that
passes both bindings; IAPKit is the open-source one.

### 11.2 The portable runner

`conformance/` ships a runner any provider can point at its own backend:

```js
import Ajv from "ajv/dist/2020.js";
import {
  createRestAdapter,
  createGraphqlAdapter,
  runConformance,
} from "openiap-commerce-protocol/conformance";

const report = await runConformance({
  adapters: [
    createRestAdapter({ baseUrl, fetch, credentials }),
    createGraphqlAdapter({ url: graphqlUrl, fetch, credentials }),
  ],
  Ajv,
  // The same role-to-credential map the adapters use — required, so the
  // runner can reject an error message that echoes a credential.
  credentials,
  eventsAdapter, // required when the descriptor declares the events profile
});
```

It is offline and decentralized by construction: it talks only through the
`fetch` it is given, judges only against the generated schemas, manifest,
and vectors, and imports no implementation — the package's own suite proves
it by certifying a minimal mock provider that shares no code with IAPKit.
The caller supplies the Ajv 2020 class because the published runtime keeps
zero dependencies. `credentials` maps the two §5 roles to whatever secrets
the provider under test issued for the run. A provider whose descriptor
declares the `events` profile also passes an `eventsAdapter` — the runner
drives §9 signing, verification, the delivery envelope, response semantics,
the §2.3 entitlement gate, and the emission rules through it, and rejects a
signing-only adapter.

### 11.3 What the vectors prove — and what they cannot

The operation vectors (`generated/vectors/operations.json`) exercise auth
negatives, invalid and unknown-member inputs, unsupported stores, mismatched
evidence, idempotent repeats, tokenless responses, error-code and
HTTP-status agreement, capability honesty, and REST/GraphQL parity. Their
purchase evidence is fake but well-formed, so a provider without store
credentials still verifies its transport contract; a verdict for that
evidence is accepted as either a schema-valid result or
`VERIFICATION_FAILED`.

They therefore certify the **contract**, not the **stores**: passing says
nothing about whether real Apple or Google receipts validate correctly.
Beyond the operation vectors, the runner also checks the capability
descriptor's version agreement against the manifest and — on the GraphQL
binding — probes that the endpoint is a real executor (a malformed document,
an undefined field, and a mistyped variable must each be rejected, without
echoing the submitted value; introspection, where enabled, must agree
STRUCTURALLY with the generated signature — kinds, field and argument types
with their nullability, input members, closed enum value sets, and closed
object member sets. A compatible MINOR may add types, nullable arguments, and
members to open objects; it cannot extend a closed object). Event Delivery conformance is likewise separate — §9's
signature, delivery-envelope, response-semantics, and lifecycle vectors
cover it, driven through the provider's events adapter — and a signing-only
provider does not pass it. The events vectors do not reach everything §9
requires of a production emitter: the §9.3 event-document schema, §9.4.4
backoff and dead-lettering, §9.4.5 destination safety, and §9.2 store
mapping are certified by an implementation's own tests, not by this
adapter surface. And a provider can pass while serving fixture data;
conformance is a floor, not an audit.

---

## 12. Versioning

The protocol version is `MAJOR.MINOR`, with each component written as a
non-negative decimal integer without a leading zero unless the component is
exactly `0`. It is independent of the npm package version used to distribute
these files. An emitter MUST set `eventVersion` to the protocol version that
defines the emitted body; a capability descriptor and mapping table use the same
value as `specVersion`. **Consumers pin on the major.**

| Change                                                                                            | Version impact |
| ------------------------------------------------------------------------------------------------- | -------------- |
| New optional member on an open object                                                             | MINOR          |
| New event type                                                                                    | MINOR          |
| New value in an open value space (`store`, `environment`, `cancellationReason`, `eventType`)      | MINOR          |
| New operation, new profile, or new optional operation input member                                | MINOR          |
| New protocol error code, or a new evidence member for a new store                                 | MINOR          |
| Member removed, renamed, or given new meaning                                                     | MAJOR          |
| Member type, nullability, or requiredness changed                                                 | MAJOR          |
| Member added to or removed from a closed enumeration                                              | MAJOR          |
| Member added to a closed object (`Support`, `Mapping`, a tokenless result, or the error envelope) | MAJOR          |
| Operation removed, or its path, method, auth role, or success status changed                      | MAJOR          |
| New required operation input member                                                               | MAJOR          |

A consumer MUST ignore members it does not recognise on an open object, and MUST
ignore event types it does not recognise rather than failing. This is what makes
MINOR additions safe, and the event envelope permits unknown members for exactly
this reason.

Some object types are deliberately closed instead, and reject members they do
not declare. A **capability value** (`Support`) is closed because a fourth key
beside `provider`, `implementation`, and `notes` would change what that
capability means while validating silently. A **mapping row** is closed because
an unrecognised qualifier would leave a reader selecting the row on fewer
conditions than its author intended. The **tokenless server-read results**
(`SubscriptionStatusSnapshot`, `SubscriptionStatusResult`, `EntitlementsResult`)
are closed because "no purchase token, store transaction identity, signed
receipt, or provider-internal record identifier appears here" (§4.2) has to be
enforced by the schema itself: an open object would let a provider smuggle a
raw receipt or an internal row id past every validator. The **REST error
envelope** (`ProtocolError`, `ProtocolErrorResponse`) is closed for the same
reason: a failure response is the easiest place to smuggle a member past the
tokenless rules, because callers rarely inspect one. Adding a member to any
of these is a MAJOR change.

Note the surrounding containers stay open: a _new_ capability axis, or a new
member on a store's mapping entry, is a MINOR addition that older consumers
ignore.

An emitter that cannot determine an **optional event member** MUST omit it rather
than send a placeholder. Zero, false, and empty values MAY be sent when they are
the known value; they MUST NOT stand in for unknown. An emitter MUST know every
required member before emitting the event. The declared `Unknown` subscription
state is the one explicit sentinel and is not an empty placeholder. These rules
do not apply to capabilities: an unimplemented capability is declared with
`implementation: false` and a `notes` explanation (§10), which is a statement.

Profiles and bindings version independently of the protocol, on the same
MAJOR.MINOR rule; a capability descriptor declares the versions it serves
(§10), and a caller pins each on its major. The REST path's `v1` segment is
the protocol major, so a provider can serve two majors side by side during a
migration.

---

## 13. Provider switching

An adopter may replace the backend behind this contract — a self-hosted
deployment for a managed one, a managed one for their own — and their downstream
integrations SHOULD survive it. What follows is what actually carries across, and
what does not.

**Carries across.** Event types, envelope shape, the entitlement predicate,
signature scheme, and per-store semantics are all defined here, not by a backend.
`sourceStoreEventId` carries the store's own notification identifier, so it
denotes the same real-world fact no matter which implementation observed it. A
consumer written against this specification does not change.

**Does not carry across.** `eventId` and `projectId` are emitter-assigned. A new
implementation issues identifiers from its own space, so a consumer's
`eventId` deduplication history has no overlap with the events the new backend
sends. During a cutover in which both backends observe the same store
notification, a consumer deduplicating only on `eventId` will process that fact
twice.

`sourceStoreEventId` is not a repair for this. Several events legitimately share
one — the lifecycle event and its entitlement delta, and any later event derived
from the same notification — so no key built on it separates a duplicate from a
sibling. A cutover needs a plan that spans both backends, not a consumer-side
key.

An emitter SHOULD populate `userId` with the adopter's own user identifier
rather than one it mints, so that the binding survives the emitter.

Everything else an adopter must do to move — exporting subscription rows,
re-registering store credentials, redirecting store notifications — is
implementation-specific operational work. It is deliberately outside this
specification, which governs the observable contract rather than any backend's
storage or tooling.

---

## 14. Out of scope

- **One-time purchase events.** The taxonomy covers subscriptions and
  entitlements only. Refund and revocation of non-subscription purchases have no
  event type yet. An `entitlement.*` delta may still report access to a durable
  product; what is absent is the one-time purchase's economic-event taxonomy.
- **Refund amounts and partial refunds.** `subscription.refunded` reports that a
  refund occurred, not how much was returned.
- **Trial and introductory-offer state.** Offers are catalog metadata here, not
  a property of a live subscription.
- **Storefront and country.**
- **Quantity.** Every event describes a single unit.
- **Key identifiers in signatures.** See §9.4.2.
- **A complete transition state machine.** §9.1 and the GraphQL invariant pin the
  event/snapshot pairs whose meaning would otherwise contradict itself, but do
  not prescribe every possible prior state or store transition. The emission
  vectors use a cross-product only to isolate the entitlement-delta rule; a row
  in that matrix is not by itself a valid wire event.
- **Emitter-side delivery policy beyond retries.** An emitter may drop a
  destination that keeps failing, filter by event type, or prune after a
  retention window. All three change what a consumer receives, and a consumer
  needing guarantees about them must get those from its emitter, not here.
- **Catalog, webhook-destination, and analytics operations.** Managing
  products, registering event destinations, and revenue reporting stay
  provider surface; §4 covers the data plane a switchover must preserve.
- **Credential provisioning and provider dashboards.** How a provider issues
  §5 credentials, uploads store credentials, or renders a console is
  management plane.
- **Historical data migration automation.** §13 states what carries across a
  provider switch; moving the historical rows is operational work this
  contract does not script.
- **Store-credential certification.** Conformance never talks to a store
  (§11.3), so nothing here certifies that a provider's Apple or Google
  integration is correctly configured.


---

# Key Reminders

- **packages/apple**: iOS functions MUST end with `IOS` suffix
- **packages/google**: DO NOT add `Android` suffix (it's Android-only package)
- **specs/client**: Types.kt and Types.swift are AUTO-GENERATED, never edit directly
- **Cross-platform functions**: NO platform suffix
