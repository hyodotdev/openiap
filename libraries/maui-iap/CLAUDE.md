# maui-iap — Agent Guidelines

`maui-iap` (`OpenIap.Maui` on NuGet, `OpenIap.Maui` namespace) is the
.NET MAUI projection of OpenIAP. It
imports the generated [`Types.cs`](src/OpenIap.Maui/Types.cs) from
[`packages/gql`](../../packages/gql), exposes a thin listener contract
(`IOpenIap`), and delegates the actual purchase work to the OpenIAP
native packages — `packages/apple` on iOS / macCatalyst, `packages/google`
on Android. It also exposes the same IAPKit HTTP/webhook helper surface as the
TypeScript SDKs through `OpenIapClient.KitApi(...)`,
`OpenIapClient.ConnectWebhookStream(...)`, and
`OpenIapClient.ParseWebhookEventData(...)`. The legacy `Iap` facade remains as
a compatibility shim, but new code should use `OpenIapClient` to avoid
namespace/type collisions with app namespaces such as `OpenIap.Maui.Iap`.

## Required pre-work

Before editing anything in this library:

1. Read the **monorepo-wide** rules in
   [`knowledge/internal/`](../../knowledge/internal/) — especially
   [`02-architecture.md`](../../knowledge/internal/02-architecture.md) and
   the **SDK Parity Checklist** in
   [`04-platform-packages.md`](../../knowledge/internal/04-platform-packages.md#sdk-parity-checklist-critical--prevents-declared-but-not-implemented).
2. Read [`CONVENTION.md`](./CONVENTION.md) for C# / MAUI-specific naming
   and style rules.
3. Run `dotnet build src/OpenIap.Maui/OpenIap.Maui.csproj -p:TargetFrameworks=net9.0`
   and `dotnet build src/OpenIap.Maui/OpenIap.Maui.csproj -p:TargetFrameworks=net10.0`
   (the shared TFMs compile without the MAUI workload) before pushing.

## Project layout

```text
libraries/maui-iap/
├── README.md                       — public-facing intro, install
├── CLAUDE.md                       — this file
├── CONVENTION.md                   — C# / MAUI conventions
├── openiap-versions.json           — symlink for native spec/apple/google versions
└── src/
    └── OpenIap.Maui/
        ├── OpenIap.Maui.csproj     — multi-target (net9.0/net10.0 + ios/android/maccatalyst)
        ├── OpenIap.cs              — IOpenIap contract + static facades
        ├── UnsupportedOpenIap.cs   — fallback for non-platform builds
        ├── Types.cs                — AUTO-GENERATED, do not edit
        └── Platforms/
            ├── Android/OpenIapAndroid.cs       — Android bridge stub
            ├── iOS/OpenIapIOS.cs               — iOS bridge stub
            └── MacCatalyst/OpenIapMacCatalyst.cs — macCatalyst bridge stub
```

## Auto-generated files (DO NOT EDIT)

- [`src/OpenIap.Maui/Types.cs`](src/OpenIap.Maui/Types.cs) — synced from
  `packages/gql/src/generated/Types.cs` by
  [`scripts/sync-versions.sh`](../../scripts/sync-versions.sh) and the gql
  package's `bun run sync` step. Regenerate with:
  ```bash
  cd packages/gql && bun run generate
  cd ../.. && bash scripts/sync-versions.sh
  ```

## Naming conventions (C#)

Inherits the monorepo rules in
[`knowledge/internal/01-naming-conventions.md`](../../knowledge/internal/01-naming-conventions.md):

- iOS-only members end with `IOS` (e.g. `GetStorefrontIOSAsync`,
  `PromotedProductIOS`).
- Android-only members end with `Android`.
- Cross-platform members carry no platform suffix.
- The C# casing layer maps GraphQL `camelCase` field names to PascalCase
  properties via `[JsonPropertyName]`. Don't rename properties by hand —
  regenerate via the codegen plugin
  ([`packages/gql/codegen/plugins/csharp.ts`](../../packages/gql/codegen/plugins/csharp.ts)).

## Native bindings — architecture

Two sibling binding csprojs feed the resolver implementations in
`Platforms/`:

```text
src/
├── OpenIap.Maui/                    — public API + IOpenIap + resolvers
├── OpenIap.Maui.Bindings.Android/   — Xamarin.Android binding (AAR)
└── OpenIap.Maui.Bindings.iOS/       — .NET-for-iOS binding (xcframework)
```

Both bindings target a **JSON-shaped facade**, not the raw module surface.
Android owns that facade inside `libraries/maui-iap`; iOS uses the same
pattern kmp-iap uses through
[`OpenIapModule+ObjC.swift`](../../packages/apple/Sources/OpenIapModule+ObjC.swift).

### Android — `OpenIapMauiModule.kt`

[`android/openiap/src/main/java/dev/hyo/openiap/maui/OpenIapMauiModule.kt`](android/openiap/src/main/java/dev/hyo/openiap/maui/OpenIapMauiModule.kt)
wraps `OpenIapModule` from `packages/google` and exposes ~25 Java-friendly
methods:

- Inputs: JSON strings (parsed via `Type.fromJson(Map)` companion methods).
- Outputs: JSON strings via `OpenIapMauiModule.ResultCallback`.
- Listeners: `OpenIapMauiModule.EventCallback` registered with a long token; the C# side stores tokens, not listener instances.

This keeps the Xamarin.Android binding free of Kotlin-specific surface
(`suspend`, `Function1`, `*$default`, transitive `kotlinx.coroutines`).

### iOS — `OpenIapModule+ObjC.swift`

The existing Objective-C bridge in `packages/apple` already provides the
JSON-shaped facade (NSDictionary in/out). The iOS binding's
[`ApiDefinition.cs`](src/OpenIap.Maui.Bindings.iOS/ApiDefinition.cs)
mirrors that header 1:1; the resolver in
[`Platforms/iOS/OpenIapIOS.cs`](src/OpenIap.Maui/Platforms/iOS/OpenIapIOS.cs)
converts NSDictionary → JsonNode → typed `OpenIap` records via
`System.Text.Json`.

`OpenIapMacCatalyst` subclasses `OpenIapIOS` — Mac Catalyst uses the same
StoreKit 2 surface and the xcframework's macCatalyst slice has identical
ObjC entry points.

### Build artifacts

Native artifacts must be present **before** `dotnet build` on the
binding csprojs:

| Artifact                   | Built by                                                                                                      | Path                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `openiap-play-release.aar` | `./gradlew :openiap:assemblePlayRelease` (in `packages/google`)                                               | `packages/google/openiap/build/outputs/aar/`            |
| `openiap-release.aar`      | `../../../packages/google/gradlew :openiap:assembleRelease` (in `libraries/maui-iap/android`)                 | `libraries/maui-iap/android/openiap/build/outputs/aar/` |
| `OpenIAP.xcframework`      | `bash packages/apple/scripts/build-xcframework.sh` (uses xcodegen + the wrapper at `packages/apple/wrapper/`) | `packages/apple/.build/xcframework/`                    |

CI runs both before invoking the .NET binding builds — see
[`.github/workflows/ci-maui-iap.yml`](../../.github/workflows/ci-maui-iap.yml)
and [`release-maui.yml`](../../.github/workflows/release-maui.yml).

### NuGet packing

`OpenIap.Maui.csproj` produces the single public NuGet package:
`OpenIap.Maui`. The binding projects are private implementation details,
so the main package flattens their outputs instead of declaring unpublished
`OpenIap.Maui.Bindings.*` package dependencies.

The package includes:

- binding DLLs in `lib/<tfm>/`
- Android AARs in `lib/net9.0-android35.0/` and
  `lib/net10.0-android36.0/`, limited to OpenIAP-owned artifacts: the
  MAUI-owned module AAR and the unbound `openiap-play-release.aar` runtime
  dependency
- Android Google Billing, Play Services, Gson, AndroidX, and Kotlin runtime
  libraries as normal NuGet `PackageReference` dependencies, not embedded AAR
  copies
- iOS / macCatalyst `OpenIap.Maui.Bindings.iOS.resources.zip` sidecars
  next to the iOS binding DLLs

The iOS binding sets `<NoBindingEmbedding>true</NoBindingEmbedding>` so
`.NET-for-iOS` creates the official sidecar binding resource package with a
`manifest` file. NuGet consumers do not need to add their own
`<NativeReference>` when they reference `OpenIap.Maui`.

For local development via `<ProjectReference>`, the example app at
[`example/OpenIap.Maui.Example/`](example/OpenIap.Maui.Example/) re-declares
the `<NativeReference>` to the xcframework — `<NativeReference>` items
don't propagate transitively through `<ProjectReference>`.

### Release workflow

The MAUI release workflow reads `PackageVersion` from `OpenIap.Maui.csproj`.
Use the `current` workflow input when a PR has already committed the intended
package version. Use `patch`, `minor`, or `major` only when the workflow should
calculate and commit the next version on `main`.

## SDK parity checklist (C# specifics)

When the GraphQL schema in `packages/gql` adds or changes an API, follow
the **SDK Parity Checklist** in
[`knowledge/internal/04-platform-packages.md`](../../knowledge/internal/04-platform-packages.md#sdk-parity-checklist-critical--prevents-declared-but-not-implemented).
For maui-iap specifically:

| Layer                 | Where                                                                |
| --------------------- | -------------------------------------------------------------------- |
| 1. Type declared      | `src/OpenIap.Maui/Types.cs` (generated)                              |
| 2. Public API exposed | `OpenIap.QueryResolver` / `OpenIap.MutationResolver` (in `Types.cs`) |
| 3. Platform bridge    | `Platforms/Android/OpenIapAndroid.cs`, `Platforms/iOS/OpenIapIOS.cs` |
| 4. Handlers wired     | Concrete platform classes implement the resolver interfaces          |
| 5. Test coverage      | TBD — example app + unit tests pending                               |

## Build & test

```bash
# Cross-platform shared compile (no MAUI workload required)
dotnet build src/OpenIap.Maui/OpenIap.Maui.csproj -p:TargetFrameworks=net9.0
dotnet build src/OpenIap.Maui/OpenIap.Maui.csproj -p:TargetFrameworks=net10.0

# Full multi-target build (requires MAUI workload)
dotnet workload install maui
dotnet build src/OpenIap.Maui/OpenIap.Maui.csproj
```

## Pre-commit checklist

1. Regenerate types if `packages/gql/src/*.graphql` changed:
   `cd packages/gql && bun run generate`
2. Run `bash scripts/sync-versions.sh` from repo root.
3. Run the shared compile checks:
   `dotnet build src/OpenIap.Maui/OpenIap.Maui.csproj -p:TargetFrameworks=net9.0`
   and `dotnet build src/OpenIap.Maui/OpenIap.Maui.csproj -p:TargetFrameworks=net10.0`.
4. Verify `Types.cs` matches `packages/gql/src/generated/Types.cs`
   byte-for-byte (the sync should keep them in lockstep).

## Contributing

1. Open a discussion at
   <https://github.com/hyodotdev/openiap/discussions> for any new feature
   that requires a schema change.
2. Schema changes land in `packages/gql` first; the C# plugin in
   `packages/gql/codegen/plugins/csharp.ts` and downstream `Types.cs`
   files update automatically.
3. Native binding work touches the Platforms/ files only — Types.cs and
   the IOpenIap contract are derived, not authored.
