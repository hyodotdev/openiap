# GraphQL Naming Conventions

This repo standardizes schema and identifier naming to improve clarity across platforms.

## Files

- `src/type.graphql`: common cross‑platform SDL only.
- `src/type-ios.graphql`: iOS‑specific SDL only.
- `src/type-android.graphql`: Android‑specific SDL only.

## Platform Suffix Rules

- iOS‑specific identifiers include `IOS` when it appears as the final suffix.
- Example: `buyProductIOS`, `SubscriptionPeriodIOS`, `VerifyPurchaseResultIOS`.
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

---

## Code Generation Architecture

The GQL package uses an **IR-based (Intermediate Representation)** code generation system.

### Generation Flow

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
         ↓
    [4] Sync (scripts/sync-to-platforms.mjs)
         ↓
    Platform Packages (packages/apple, packages/google)
```

### Directory Structure

```text
codegen/
├── index.ts              # Main entry point
├── core/
│   ├── types.ts          # IR type definitions
│   ├── parser.ts         # GraphQL schema parser
│   ├── transformer.ts    # AST → IR transformer
│   └── utils.ts          # Case conversion, keyword escaping
└── plugins/
    ├── base-plugin.ts    # Abstract base class
    ├── swift.ts          # Swift plugin
    ├── kotlin.ts         # Kotlin plugin
    ├── dart.ts           # Dart plugin
    └── gdscript.ts       # GDScript plugin
```

### IR Types

| IR Type | Description |
|---------|-------------|
| `IREnum` | Enum with values, raw values (kebab-case), legacy aliases |
| `IRInterface` | Protocol/Interface with typed fields |
| `IRObject` | Struct/Class with fields, implements, union membership |
| `IRInput` | Input type with required field tracking |
| `IRUnion` | Union with members, nested union support |
| `IROperation` | Query/Mutation/Subscription definitions |

### Language Plugin Features

| Plugin | Key Features |
|--------|--------------|
| **Swift** | Codable protocol, ErrorCode custom initializer, platform defaults |
| **Kotlin** | sealed interface, fromJson/toJson, nullable patterns |
| **Dart** | sealed class, factory constructors, extends/implements |
| **GDScript** | _init() pattern, from_json/to_json, Variant type |

### Scripts

```bash
# Generate all platform types
bun run generate

# Generate specific platform
bun run generate:swift
bun run generate:kotlin
bun run generate:dart
bun run generate:gdscript
```

### Adding a New Language

1. Create `codegen/plugins/<language>.ts` extending `CodegenPlugin`
2. Implement abstract methods:
   - `mapScalar(name)` - Map GraphQL scalars to language types
   - `mapType(type)` - Map IR types to language type strings
   - `generateEnum()`, `generateObject()`, `generateUnion()`, etc.
3. Register in `codegen/index.ts`
4. Add script to `package.json`
