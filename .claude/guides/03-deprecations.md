# Deprecated APIs and Migration

## Current Deprecations

### validateReceipt → verifyPurchase

**Deprecated in**: openiap v1.2.6

| Old API              | New API          | Notes                   |
| -------------------- | ---------------- | ----------------------- |
| `validateReceipt`    | `verifyPurchase` | Cross-platform          |
| `validateReceiptIOS` | `verifyPurchase` | iOS-specific deprecated |

**Migration**:

```typescript
// Before
const result = await validateReceipt({ sku: "product_id" });

// After
const result = await verifyPurchase({ sku: "product_id" });
```

```swift
// Before
let result = try await store.validateReceipt(sku: "product_id")

// After
let result = try await store.verifyPurchase(sku: "product_id")
```

```kotlin
// Before
val result = store.validateReceipt(props)

// After
val result = store.verifyPurchase(props)
```

### Other Deprecated APIs

| Old                        | New                                   | Package |
| -------------------------- | ------------------------------------- | ------- |
| `buy-promoted-product-ios` | `requestPurchaseOnPromotedProductIOS` | All     |
| `requestProducts`          | `fetchProducts`                       | All     |
| `get-storefront-ios`       | `getStorefront`                       | All     |

## Deprecation Guidelines

When deprecating APIs:

1. **Keep the old function** - Don't remove, mark as deprecated
2. **Delegate to new API** - Old function should call new one internally
3. **Add deprecation annotation**:

   ```swift
   @available(*, deprecated, message: "Use verifyPurchase")
   public func validateReceipt(_ props: ReceiptValidationProps) async throws -> ReceiptValidationResult {
       try await verifyPurchase(props)
   }
   ```

   ```kotlin
   @Deprecated("Use verifyPurchase")
   override val validateReceipt: MutationValidateReceiptHandler = { props ->
       verifyPurchase(props)
   }
   ```

4. **Update documentation** - Add migration guide in `docs/updates/notes.tsx`
5. **Update CLAUDE.md** - Add to deprecated functions list
