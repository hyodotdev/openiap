# Project Conventions

## Naming Conventions

### Android-Specific Functions

**IMPORTANT**: Since this is an Android-only package, **DO NOT add `Android` suffix** to function names, even for Android-specific APIs.

**✅ Correct**:
```kotlin
fun acknowledgePurchase()
fun consumePurchase()
fun getPackageName()
fun buildModule(context: Context)
fun isHorizonEnvironment(context: Context)
```

**❌ Incorrect**:
```kotlin
fun acknowledgePurchaseAndroid()  // Don't add Android suffix
fun consumePurchaseAndroid()      // Don't add Android suffix
fun buildModuleAndroid()          // Don't add Android suffix
```

**Exception**: Only add `Android` suffix when the function is part of a cross-platform API that has platform-specific variants (e.g., `ProductAndroid`, `PurchaseAndroid` types that contrast with iOS types).

### Enum Values
- Enum values in this codebase must use **kebab-case** (e.g., `non-consumable`, `in-app`, `user-cancelled`)
- This matches the convention used in the auto-generated Types.kt from GraphQL schemas
- Do not use snake_case (e.g., `non_consumable`) or camelCase for enum raw values

## Generated GraphQL/Kotlin Models

- `openiap/src/main/Types.kt` is auto-generated. Regenerate it with `./scripts/generate-types.sh` after changing any GraphQL schema files.
- Never edit `Types.kt` manually. Regeneration guarantees consistency across platforms and avoids merge conflicts.
- When additional parsing or conversion helpers are needed for GraphQL payloads, place them in a utility file (for example `openiap/src/main/java/dev/hyo/openiap/utils/JsonUtils.kt`). Keep all custom helpers outside of generated sources and have the hand-written code call into them.

## Helper Utilities

- Shared helper extensions such as safe `Map<String, *>` lookups must live in utility sources (`utils/*.kt`) so they can be reused without modifying generated files.
- Utility files should include succinct KDoc explaining their intent and reference the convention above when interacting with generated code.

## Android Module API Handlers

- The Android `OpenIapModule` exposes every GraphQL operation through the typealias handlers defined in `Types.kt` (e.g. `MutationInitConnectionHandler`, `QueryGetAvailablePurchasesHandler`, etc.).
- These handlers are declared as properties (for example `val initConnection = ...`) inside `OpenIapModule`; they encapsulate all coroutine work (`withContext`, `suspendCancellableCoroutine`, etc.) and return the types required by the GraphQL schema (e.g. `RequestPurchaseResult`).
- `OpenIapStore` and other consumers must call the module through these handler properties rather than direct suspend functions, unpacking any wrapper results (such as `RequestPurchaseResultPurchases`) as needed.
- Keep helper wiring inside `OpenIapModule`—avoid reintroducing extension builders like `createQueryHandlers`; the module itself owns `queryHandlers`, `mutationHandlers`, and `subscriptionHandlers` values so wiring stays localized and in sync with the typealiases.

## Build Flavors (Play vs Horizon)

This package supports **two build flavors**:

| Flavor | Store | Source Directory |
|--------|-------|------------------|
| `play` (default) | Google Play Store | `src/play/` |
| `horizon` | Meta Quest Store | `src/horizon/` |

### Source Directory Structure

```text
openiap/src/
├── main/      # Shared code (used by both flavors)
├── play/      # Play Store specific implementations
└── horizon/   # Meta Horizon specific implementations
```

### When to Use Each Directory

- **`src/main/`**: Code that works for BOTH Play and Horizon
- **`src/play/`**: Play Store specific code (Google Play Billing API)
- **`src/horizon/`**: Horizon specific code (Meta S2S API)

### Critical: Test Both Flavors

When modifying shared code in `src/main/`, **ALWAYS test both flavors**:

```bash
# Play flavor
./gradlew :openiap:compilePlayDebugKotlin

# Horizon flavor
./gradlew :openiap:compileHorizonDebugKotlin
```

### Horizon-Specific APIs

Some APIs exist only in Horizon flavor:

- `getAvailableItems` - Fetch catalog items (Horizon only)
- `VerifyPurchaseHorizonOptions` - Horizon verification parameters
- `VerifyPurchaseResultHorizon` - Horizon verification result

## Regeneration Checklist

- Run `./scripts/generate-types.sh` whenever GraphQL schema definitions change.
- After regenerating, run the relevant Gradle targets for **BOTH flavors**:
  ```bash
  ./gradlew :openiap:compilePlayDebugKotlin
  ./gradlew :openiap:compileHorizonDebugKotlin
  ```
