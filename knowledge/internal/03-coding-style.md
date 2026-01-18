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
