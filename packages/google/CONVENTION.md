# Project Conventions

## Naming Conventions

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

## Regeneration Checklist

- Run `./scripts/generate-types.sh` whenever GraphQL schema definitions change.
- After regenerating, run the relevant Gradle targets (e.g. `./gradlew :openiap:compileDebugKotlin`) to ensure the generated output compiles together with existing handwritten code.
