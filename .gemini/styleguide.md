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
`specs/client/src/api-android.graphql`; the implementation function it delegates
to remains suffix-free inside `packages/google`.

## Generated Files

Flag any hand edit to a generated file. The list is in the root `AGENTS.md`
("Auto-Generated Files"); every sync target in
`specs/client/generated-sync-manifest.mjs` is generated.

When reviewing generated handler wiring, require the hand-written module to
implement the generated contract rather than renaming generated fields.

## Image Assets In `packages/docs` And `packages/kit`

Do not add PNG image assets or PNG image references in `packages/docs` or
`packages/kit`. Convert new or updated bitmap images to WebP before committing,
and update every site path that points at the image, including React `src`
attributes, HTML meta tags, manifests, README snippets, and screenshot/OG image
generation scripts. This applies to docs screenshots, announcement art, favicons,
logos, guide images, and embedded bitmap data inside SVG files.
