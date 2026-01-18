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
