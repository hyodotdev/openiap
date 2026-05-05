# maui-iap Conventions

C# / .NET MAUI specifics on top of the monorepo-wide rules in
[`knowledge/internal/`](../../knowledge/internal/).

## Language / tooling

- **C# 12** with `<Nullable>enable</Nullable>` and
  `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` (configured in
  the .csproj).
- **.NET 8** target with platform-specific TFMs:
  `net9.0;net9.0-android;net9.0-ios;net9.0-maccatalyst`.
- The shared `net9.0` TFM compiles without the MAUI workload — keep it
  green for fast PR-time validation.

## Namespaces

| Namespace              | Owns                                                |
|------------------------|-----------------------------------------------------|
| `Hyo.OpenIap`          | Generated types, enums, resolver interfaces.        |
| `Hyo.OpenIap.Maui`     | `IOpenIap` contract, static `OpenIap` facade.       |
| `Hyo.OpenIap.Maui.Platforms.Android` | Android bridge implementation.        |
| `Hyo.OpenIap.Maui.Platforms.iOS`     | iOS bridge implementation.            |
| `Hyo.OpenIap.Maui.Platforms.MacCatalyst` | macCatalyst bridge implementation. |

The `Hyo.OpenIap` namespace is shared with the generated `Types.cs` so
consumers can `using Hyo.OpenIap;` and pull in `Product`, `Purchase`,
`PurchaseError`, etc., without any MAUI dependency.

## Naming

Inherits the monorepo rules in
[`knowledge/internal/01-naming-conventions.md`](../../knowledge/internal/01-naming-conventions.md):

- **iOS-only**: suffix `IOS` (e.g. `RestorePurchasesIOSAsync`,
  `PromotedProductIOS`).
- **Android-only**: suffix `Android` (e.g.
  `AcknowledgePurchaseAndroidAsync`).
- **Cross-platform**: no suffix.
- **Async methods**: append `Async` per .NET convention. The codegen
  plugin already does this — every `QueryResolver` / `MutationResolver`
  method ends in `Async`.
- **Properties**: PascalCase. The codegen plugin maps GraphQL field
  names (camelCase) to PascalCase properties and adds `[JsonPropertyName]`
  to preserve wire format.
- **`Id` not `ID`** (matches every other library in the monorepo).

## Records vs. classes

- All schema-derived types are `public sealed record` (immutable, value
  equality, `with`-expression friendly).
- Unions are `public abstract record` with `[JsonPolymorphic]` keyed on
  `__typename`.
- Result-union wrappers (`# => Union` marker) are sealed wrapper records;
  no `[JsonPolymorphic]` because the GraphQL JSON has no discriminator
  for them.
- Empty / marker types (e.g. `VoidResult`) are `readonly record struct`
  for zero-allocation passing.

## JSON serialization

- System.Text.Json only — no Newtonsoft dependency.
- Per-enum `JsonConverter` classes are emitted alongside each enum so
  the wire format (kebab-case raw values like `"user-cancelled"`) round-
  trips correctly.
- `[JsonPropertyName]` lives on every property — the JSON wire stays
  camelCase even though C# properties are PascalCase.

## Things to avoid

- **Don't add C#-only fields to schema-derived types.** Edit the GraphQL
  schema in `packages/gql` and regenerate. Hand-edits to `Types.cs` are
  reverted on next sync.
- **Don't create a NuGet package without the wiring complete.** The
  scaffold's empty observables and missing native bindings are not a
  shippable contract — see
  [`CLAUDE.md`](./CLAUDE.md) for the wiring plan.
- **Don't widen public types to interfaces.** All schema records are
  `sealed`. If polymorphism is needed, the union (abstract base record)
  is the extension point.
