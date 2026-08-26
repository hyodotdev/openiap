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
