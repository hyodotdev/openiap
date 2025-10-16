# GraphQL Naming Conventions

This repo standardizes schema and identifier naming to improve clarity across platforms.

## Files

- `src/type.graphql`: common cross‑platform SDL only.
- `src/type-ios.graphql`: iOS‑specific SDL only.
- `src/type-android.graphql`: Android‑specific SDL only.

## Platform Suffix Rules

- iOS‑specific identifiers include `IOS` when it appears as the final suffix.
  - Example: `buyProductIOS`, `SubscriptionPeriodIOS`, `ReceiptValidationResultIOS`.
- If the iOS marker appears mid‑identifier (i.e., more words follow), use `Ios`.
  - Example: `ProductIosType`, `RequestPurchaseIosProps`.
- Android‑specific identifiers use `Android` (PascalCase) and typically as a suffix.
  - Example: `ProductAndroid`, `PurchaseAndroid`, `RequestSubscriptionAndroidProps`.

## Type and Field Casing

- Types, interfaces, inputs, unions: PascalCase.
- Fields and arguments: camelCase.
- iOS/Android fields should follow the same suffix rules as types
  (e.g., `displayNameIOS`, `offerTokenAndroid`).
- Enum values in SDL are written in PascalCase. Generated client libraries map
  these to kebab-case strings (e.g., `PurchaseUpdated` → `purchase-updated`) so
  the serialized values remain consistent across TypeScript, Swift, Kotlin, and
  Dart outputs.

## Enums

- Enum names: PascalCase (e.g., `ProductType`).
- Enum values: PascalCase to keep them visually distinct from type names.
  - Examples: `Consumable`, `FreeTrial`, `PayAsYouGo`, `Ios`, `Android`.
- Runtime values (generated code) use kebab-case. Consumers should compare
  against the emitted kebab-case strings rather than the SDL identifiers.

## Defaults

- Prefer explicit defaults for input fields and arguments using `=` in SDL.
  - Example: `type: ProductQueryType = inApp`.
- Document defaults in the field description if behavior matters.

## Unions

- Cross‑platform unions combine platform types (e.g., `Product = ProductAndroid | ProductIOS`).
- When a wrapper object should behave like a union in generated code (e.g.,
  `FetchProductsResult`, `RequestPurchaseResult`), precede the type definition
  with a `# => Union` comment in the SDL:

  ```graphql
  # => Union
  type RequestPurchaseResult {
    purchase: Purchase
    purchases: [Purchase!]
  }
  ```

  The codegen scripts detect this marker and flatten the wrapper into the
  appropriate union type in TypeScript/Dart/Swift/Kotlin outputs while keeping
  the SDL schema intact.

- Only `*Args` wrapper inputs (and `VoidResult`) are collapsed to inline
  scalars in generated clients. Structural wrappers (e.g.,
  `PricingPhasesAndroid`) stay as interfaces/structs even if they contain a
  single field.

## SDL Organization Guidance

- Common interfaces and shared inputs remain in `type.graphql`.
- Platform-specific types/inputs/enums live in their respective files and include
  platform suffixes per the above rules.
- List all enum declarations at the top of each SDL file, before type, interface,
  or input definitions.

## Examples

- iOS types: `ProductIOS`, `ProductSubscriptionIOS`, `SubscriptionInfoIOS`, `RenewalInfoIOS`.
- iOS inputs: `RequestPurchaseIosProps`, `DiscountOfferInputIOS`.
- Android types: `ProductAndroid`, `ProductSubscriptionAndroid`.
- Enums: `ProductTypeIOS { Consumable, NonConsumable }`,
  `PaymentModeIOS { FreeTrial, PayAsYouGo }`.
- When multiple platform types share a base interface, keep the common prefix
  aligned across the variants. Example: the `ProductCommon` interface is
  implemented by `ProductAndroid`, `ProductIOS`, `ProductSubscriptionAndroid`,
  and `ProductSubscriptionIOS` so they are easy to discover together.

## Notes

- Enum values are API‑visible; changing them is a breaking change.
- Keep platform suffixes consistent to avoid ambiguity in codegen and resolvers.
- Resolver fields (Query/Mutation) model asynchronous behavior. The docs refer
  to these as `Future`. Use a `# Future` inline comment in the SDL to make that
  intent explicit for documentation tooling, even though the generated
  TypeScript types currently expose their raw GraphQL types.
  - When feeding new APIs into the openiap.dev docs, always add this `# Future`
    comment so the codegen post-processing rewrites the generated types to
    return `Promise<…>` and the documentation stays accurate.
