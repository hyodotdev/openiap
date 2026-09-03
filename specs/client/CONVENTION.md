# OpenIAP Client Specification Conventions

`specs/client` is the authored source of truth for the OpenIAP client API and
multiplatform type system. Its publishable npm package is
`@hyodotdev/openiap`; the private repository root is not that package.

This directory is a specification and code-generation toolchain, not a hosted
service. It may publish generated types and portable client source artifacts,
including the `kit-api` helper copied into JavaScript SDKs, but it must not own
deployment configuration, production credentials, runtime data, or migrations.
Hosted and store implementations belong under `packages/` or `libraries/`.

The independent server-side Commerce Protocol is its sibling at
`specs/commerce-protocol`. Never add its schema layers to this
directory's `schema-files.mjs` or merge the two generation pipelines.

## Files

- `schema-files.mjs` is the ordered production schema inventory SSOT. Generator
  code must import it directly. Do not add parallel schema lists or external
  generator manifests.
- `schema-source-utils.mjs` owns source identity normalization and block-string
  line detection shared by every SDL metadata extractor.
- `schema-markers.mjs` is the only parser for `# Future` and `# => Union`.
- `schema-deprecations.mjs` is the only extractor and validator for canonical
  deprecation metadata.
- `custom-input-contracts.ts` is the typed shape/default SSOT for every input
  that a generator projects or aliases specially. Plugins must not maintain
  parallel field lists.
- `generated-sync-manifest.mjs` is the only generated source/target path map
  used by platform sync and commit-time drift checks.
- `src/type.graphql`: common cross‑platform SDL only.
- `src/type-ios.graphql`: iOS‑specific SDL only.
- `src/type-android.graphql`: Android‑specific SDL only.

## Platform Suffix Rules

- iOS‑specific identifiers include `IOS` when it appears as the final suffix.
- Example: `requestPurchaseIOS`, `SubscriptionPeriodIOS`, `VerifyPurchaseResultIOS`.
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
  the serialized values remain consistent across TypeScript, Swift, Kotlin,
  Dart, GDScript, and C# outputs.

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

## Field and Operation Descriptions

- A description is copied verbatim into every generated language, so it is the
  most duplicated prose in the repo. Keep it to the contract: one line on what
  the API does, the single point a caller gets wrong without it, the
  availability line, and the `See:` link.
- Do not restate the docs page's per-platform behavior matrix here. Link to it.
  Full rule and examples:
  [`knowledge/internal/03-coding-style.md`](../../../knowledge/internal/03-coding-style.md#doc-comments-are-not-the-docs-site).
- Existing operation descriptions in `api.graphql` run two lines at the median.
  A description several times that length is a signal that it belongs on the
  docs page instead.

## API Availability Comments

- Lead with the OpenIAP release that exposes the API, then state the upstream
  platform requirement as compatibility context.
- Android example: `Available in OpenIAP Spec 2.1.0 / openiap-google 2.3.0
(requires Play Billing 9.1.0+).`
- Do not document a new OpenIAP field only as `Play Billing 9.1.0+`; consumers
  need the spec and platform-package versions to know which SDK release contains
  it.

## Unions

- Cross‑platform unions combine platform types (e.g., `Product = ProductAndroid | ProductIOS`).
- `ProductOrSubscription` intentionally composes the generated `Product` and
  `ProductSubscription` union wrappers. This nested-union form is an OpenIAP
  code-generation DSL extension, not a portable executable GraphQL service
  schema. Use `bun run generate`; do not feed these SDL files directly to
  general-purpose client generators.
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

  A marked wrapper must be a non-root object with at least one field, and every
  field must be nullable so exactly one result branch can be represented.
  Query, Mutation, Subscription, empty wrappers, and wrappers with required
  fields are rejected. The shared transformer then flattens the wrapper into
  the appropriate union type in TypeScript/Dart/Swift/Kotlin outputs while
  keeping the SDL schema intact.

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
- Use standard `@deprecated(reason: "...")` only on fields, arguments, input
  fields, and enum values. Named types use the project-scoped
  `@openiapDeprecated(reason: "...")` directive declared in `schema.graphql`.
  Descriptions must not duplicate either directive as an `@deprecated` tag.
  When an object implements a deprecated interface field, the interface owns
  the canonical reason, but every concrete field must repeat that exact
  directive because GraphQL introspection does not inherit field metadata.
  The IR transformer rejects an omitted or conflicting concrete projection
  and emits only one generated deprecation tag per concrete field.
- Resolver fields (Query/Mutation) model asynchronous behavior. The docs refer
  to these as `Future`. Use a `# Future` inline comment in the SDL to make that
  intent explicit for documentation tooling and generated Promise signatures.
  - When feeding new APIs into the openiap.dev docs, always add this `# Future`
    comment so the codegen post-processing rewrites the generated types to
    return `Promise<…>` and the documentation stays accurate.

---

## Code Generation Architecture

The client specification uses a guarded TypeScript lane and an IR-based
native/framework lane over the same schema inventory and contract metadata.

### Generation Flow

```text
GraphQL Schema (src/*.graphql)
         ↓
    Inventory + metadata + custom-input contracts
         ↓
    ┌────────────────────────────┬─────────────────────────────┐
    │ TypeScript                 │ Native/framework languages  │
    │ graphql-codegen            │ strict parser → IR          │
    │ + guarded post-processor   │ → Swift/Kotlin/Dart/         │
    │                            │   GDScript/C# plugins        │
    └────────────────────────────┴─────────────────────────────┘
                          ↓
              Generated Files (src/generated/*)
                          ↓
      generated-sync-manifest.mjs → sync-to-platforms.mjs
                          ↓
 Apple, Google, RN, Expo, Flutter, Godot, KMP, and MAUI copies
```

### Directory Structure

```text
codegen/
├── index.ts              # Main entry point
├── core/
│   ├── types.ts          # IR type definitions
│   ├── parser.ts         # GraphQL schema parser
│   ├── transformer.ts    # AST → IR transformer
│   ├── generated-header.ts # Shared generated-file banner
│   └── utils.ts          # Case conversion, keyword escaping
└── plugins/
    ├── base-plugin.ts    # Abstract base class
    ├── swift.ts          # Swift plugin
    ├── kotlin.ts         # Kotlin plugin
    ├── dart.ts           # Dart plugin
    ├── gdscript.ts       # GDScript plugin
    └── csharp.ts         # C# plugin
```

### IR Types

| IR Type       | Description                                               |
| ------------- | --------------------------------------------------------- |
| `IREnum`      | Enum with values, raw values (kebab-case), legacy aliases |
| `IRInterface` | Protocol/Interface with typed fields                      |
| `IRObject`    | Struct/Class with fields, implements, union membership    |
| `IRInput`     | Input type with required field tracking                   |
| `IRUnion`     | Union with members, nested union support                  |
| `IROperation` | Query/Mutation/Subscription definitions                   |

### Language Plugin Features

| Plugin       | Key Features                                                      |
| ------------ | ----------------------------------------------------------------- |
| **Swift**    | Codable protocol, ErrorCode custom initializer, platform defaults |
| **Kotlin**   | sealed interface, fromJson/toJson, nullable patterns              |
| **Dart**     | sealed class, factory constructors, extends/implements            |
| **GDScript** | \_init() pattern, from_json/to_json, Variant type                 |
| **C#**       | records, JsonConverter, [JsonPolymorphic] unions                  |

### Scripts

```bash
# Generate all platform types
bun run generate

# Diagnostic single-plugin generation (always finish with `bun run generate`
# before committing so every manifest target is synchronized)
bun run generate:swift
bun run generate:kotlin
bun run generate:dart
bun run generate:gdscript
bun run generate:csharp
```

### Adding a New Language

1. Create `codegen/plugins/<language>.ts` extending `CodegenPlugin`
2. Implement abstract methods:
   - `mapScalar(name)` - Map GraphQL scalars to language types
   - `mapType(type)` - Map IR types to language type strings
   - `generateEnum()`, `generateObject()`, `generateUnion()`, etc.
3. Register in `codegen/index.ts`
4. Add script to `package.json`
