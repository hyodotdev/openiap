# OpenIAP Style Guide For Gemini

This file summarizes the repository rules that automated reviewers should apply
when reviewing OpenIAP pull requests. The detailed source of truth remains
`knowledge/internal/` and package-specific `CONVENTION.md` files.

## Android Naming In `packages/google`

`packages/google` is an Android-only native package. Hand-written native
functions in this package should not add a redundant `Android` suffix:

```kotlin
// Correct hand-written implementation names
fun acknowledgePurchase()
fun consumePurchase()
fun checkAlternativeBillingAvailability()
fun isBillingProgramAvailable()
```

Do not rename generated GraphQL operation names or generated handler fields to
remove `Android`. Those identifiers must match the GraphQL schema and generated
`Types.kt` contract exactly.

```kotlin
// Correct generated handler wiring
MutationHandlers(
    checkAlternativeBillingAvailabilityAndroid = {
        checkAlternativeBillingAvailability()
    },
    isBillingProgramAvailableAndroid = { program ->
        isBillingProgramAvailable(program)
    }
)
```

In other words, the `...Android` handler key is the generated API surface from
`packages/gql/src/api-android.graphql`; the implementation function it delegates
to remains suffix-free inside `packages/google`.

## Generated Files

Do not hand-edit generated files such as:

- `packages/google/openiap/src/main/java/dev/hyo/openiap/Types.kt`
- `packages/apple/Sources/Models/Types.swift`
- `libraries/*/src/types.ts`
- `libraries/flutter_inapp_purchase/lib/types.dart`
- `libraries/kmp-iap/library/src/commonMain/**/Types.kt`
- `libraries/maui-iap/src/OpenIap.Maui/Types.cs`

When reviewing generated handler wiring, require the hand-written module to
implement the generated contract rather than renaming generated fields.
