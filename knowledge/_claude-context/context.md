# OpenIAP Project Context

> **Auto-generated for Claude Code**
> Last updated: 2026-01-18T10:09:40.659Z
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

### Required Pre-Work

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

---

## Google Package (packages/google)

### Required Pre-Work

Before writing or editing anything, **ALWAYS** review:
- [`packages/google/CONVENTION.md`](../../packages/google/CONVENTION.md)

### Project Layout

- `openiap/`: Android library sources
- `Example/`: Sample application consuming the library
- `scripts/`: Automation (code generation, tooling)

### Critical Rules

1. **DO NOT edit generated files**: `openiap/src/main/Types.kt` is auto-generated
2. Put reusable Kotlin helpers in `openiap/src/main/java/dev/hyo/openiap/utils/`
3. Run `./scripts/generate-types.sh` to regenerate types
4. Compile to verify: `./gradlew :openiap:compileDebugKotlin`

### Updating openiap-gql Version

1. Edit `openiap-versions.json` and update the `gql` field
2. Run `./scripts/generate-types.sh` to download and regenerate Types.kt
3. Compile to verify: `./gradlew :openiap:compileDebugKotlin`

---

## GQL Package (packages/gql)

### Required Pre-Work

Before writing or editing anything, **ALWAYS** review:
- [`packages/gql/CONVENTION.md`](../../packages/gql/CONVENTION.md)

### Scripts

| Script | Description |
|--------|-------------|
| `generate:ts` | Generate TypeScript types |
| `generate:swift` | Generate Swift types |
| `generate:kotlin` | Generate Kotlin types |
| `generate:dart` | Generate Dart types |
| `generate` | Generate all types |
| `sync` | Sync generated types to platform packages |

### Generating Types

```bash
cd packages/gql
bun run generate
```

This generates:
- TypeScript types: `src/generated/types.ts`
- Swift types: `dist/swift/Types.swift`
- Kotlin types: `dist/kotlin/Types.kt`
- Dart types: `dist/dart/types.dart`

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

<!-- Source: internal/06-git-deployment.md -->

# Git Conventions & Deployment

> **Priority: MANDATORY**
> Follow these conventions for all commits and deployments.

## Git Commit Message Format

### With Tag Prefix

Everything after the tag MUST be lowercase:

```
feat: add user authentication system
fix: resolve purchase validation error
docs: update API reference
refactor: simplify product fetching logic
test: add subscription validation tests
chore: update dependencies
```

### Without Tag Prefix

First letter MUST be uppercase:

```
Add user authentication system
Fix purchase validation error
Update API reference
```

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

> Reference documentation for Google Play Billing Library 7.x
> Adapt all patterns to match OpenIAP internal conventions.

## Overview

Google Play Billing Library enables in-app purchases and subscriptions on Android devices.

## Core Classes

### BillingClient

The main interface for communicating with Google Play Billing.

```kotlin
val billingClient = BillingClient.newBuilder(context)
    .setListener(purchasesUpdatedListener)
    .enablePendingPurchases()
    .build()
```

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

## Best Practices

1. **Always acknowledge purchases** within 3 days or they will be refunded
2. **Verify purchases server-side** using Google Play Developer API
3. **Handle pending purchases** for payment methods that require additional steps
4. **Reconnect on disconnect** - billing service can disconnect anytime
5. **Cache product details** to avoid repeated queries


---

<!-- Source: external/react-native-iap-api.md -->

# react-native-iap API Reference

> Reference documentation for react-native-iap
> Adapt all patterns to match OpenIAP internal conventions.

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
    getProducts,
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
  getProducts,
  getSubscriptions,
} from 'react-native-iap';

// Initialize
const connected = await initConnection();

// Fetch products
const products = await getProducts({ skus: ['com.app.product1'] });
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
    getProducts,
    getSubscriptions,
  } = useIAP();

  useEffect(() => {
    if (connected) {
      getProducts({ skus: productIds });
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

