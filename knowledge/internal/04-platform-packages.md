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

## SDK Parity Checklist (CRITICAL — prevents "declared but not implemented")

When the GraphQL schema in [`packages/gql`](../../packages/gql) adds or changes an API, the regenerated `types.*` files **declare** the handler but do not **implement** it. Every wrapper library must wire the new API end-to-end or users will see silent nulls, phantom interfaces (GitHub issue #104), or `UnsupportedOperationException` at runtime.

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

| Library | 1. Type declared | 2. Public API exposed | 3. Platform bridge | 4. Wired into handlers bundle | 5. Test coverage |
|---------|------------------|-----------------------|--------------------|-------------------------------|------------------|
| **react-native-iap** | `src/types.ts` (generated) | `src/index.ts` export (Nitro or composed TS) | `ios/HybridRnIap.swift` (iOS), `android/.../HybridRnIap.kt` (Android) | Not required (flat exports) | Mock stub in all 4 `mockIap` objects in `__tests__/` (per memory) |
| **expo-iap** | `src/types.ts` (generated) | `src/modules/ios.ts` / `android.ts` export, re-exported from `src/index.ts` | `ios/ExpoIapModule.swift` `AsyncFunction`, `android/.../ExpoIapModule.kt` | Not required (flat exports) | `src/modules/__tests__/*.test.ts` |
| **flutter_inapp_purchase** | `lib/types.dart` (generated) | getter on `FlutterInappPurchase` in `lib/flutter_inapp_purchase.dart` | `case "<name>":` in `ios/Classes/FlutterInappPurchasePlugin.swift`, Android plugin `onMethodCall` | `queryHandlers` / `mutationHandlers` / `subscriptionHandlers` bundles near the bottom of `flutter_inapp_purchase.dart` | Mock + test in `test/ios_methods_test.dart` (and the `errors_unit_test.dart` error-mapping test) |
| **kmp-iap** | `library/src/commonMain/.../openiap/Types.kt` (generated interface) | exposed via `KmpInAppPurchase` / `kmpIapInstance` | `library/src/iosMain/.../InAppPurchaseIOS.kt` — must call `openIapModule.<name>WithCompletion { ... }`, **never** `throw UnsupportedOperationException` | Not required (interface dispatch) | `library/src/commonTest/` if testable cross-platform |
| **godot-iap** | `addons/godot-iap/types.gd` (generated) | public `snake_case` function in `addons/godot-iap/godot_iap.gd` | `ios-gdextension/Sources/GodotIap/GodotIap.swift` (iOS), `android/src/main/java/.../GodotIap.java` (Android) | Not required | Manual testing — no automated test suite yet |
| **maui-iap** | `src/OpenIap.Maui/Types.cs` (generated) | `Hyo.OpenIap.QueryResolver` / `MutationResolver` interfaces in `Types.cs`; `IOpenIap` adds the listener-stream contract; static facade is `Hyo.OpenIap.Maui.Iap` | Android: `OpenIapMauiShim.kt` in `packages/google/openiap/src/main/java/dev/hyo/openiap/maui/` (JSON-shaped Java facade), bound by `OpenIap.Maui.Bindings.Android.csproj`, consumed by `Platforms/Android/OpenIapAndroid.cs`. iOS / macCatalyst: existing `OpenIapModule+ObjC.swift` bridge in `packages/apple`, bound by hand-written `OpenIap.Maui.Bindings.iOS/ApiDefinition.cs`, consumed by `Platforms/iOS/OpenIapIOS.cs` (+ subclass `OpenIapMacCatalyst`). | Not required (interface dispatch) | Example app `libraries/maui-iap/example/OpenIap.Maui.Example` builds for net9.0-android / net9.0-ios / net9.0-maccatalyst (manual device testing for purchase flow); no xUnit tests yet |

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

Any empty result for a layer that *should* have the handler (per the suffix rule) is a gap that must be filled before merging.

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
