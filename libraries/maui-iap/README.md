# maui-iap

OpenIAP for **.NET MAUI** — unified in-app purchases on iOS, Android, and macCatalyst from a single C# API.

> **Status:** Scaffold. The generated `Types.cs` (from `packages/gql`) ships, the
> public `IOpenIap` listener contract is defined, and platform stubs are in
> place. Native bindings to `packages/google` (AAR) and `packages/apple`
> (xcframework) are not yet wired — see [`CLAUDE.md`](./CLAUDE.md) for the
> wiring plan.

## Status matrix

| Layer                                                | iOS | Android | macCatalyst |
|------------------------------------------------------|:---:|:-------:|:-----------:|
| Generated types (`Types.cs`)                         | ✅  | ✅      | ✅          |
| `IOpenIap` listener contract                         | ✅  | ✅      | ✅          |
| Platform factory (`OpenIapPlatform.Create()`)        | ✅  | ✅      | ✅          |
| Native binding (StoreKit 2 / Play Billing 8)         | 🚧  | 🚧      | 🚧          |
| Example MAUI app                                     | 🚧  | 🚧      | 🚧          |
| NuGet release                                        | 🚧  | 🚧      | 🚧          |

## Install

> Requires .NET 8 SDK and the MAUI workload (`dotnet workload install maui`).

```xml
<PackageReference Include="Hyo.OpenIap.Maui" Version="0.1.0" />
```

> NuGet release is pending. For now, reference the project directly:
> ```xml
> <ProjectReference Include="../../../openiap/libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj" />
> ```

## Usage

```csharp
using Hyo.OpenIap;
using Hyo.OpenIap.Maui;

OpenIap.Instance.PurchaseUpdated.Subscribe(purchase =>
{
    // Validate on your server, then finish the transaction.
});

OpenIap.Instance.PurchaseError.Subscribe(error =>
{
    Console.WriteLine($"{error.Code}: {error.Message}");
});

// Once the platform binding lands, the resolver methods on the same
// instance become callable:
//   var products = await ((QueryResolver)OpenIap.Instance).FetchProductsAsync(
//       new ProductRequest { Skus = ["premium"], Type = ProductQueryType.InApp });
```

## What's generated vs. hand-written

- **Generated:** [`src/OpenIap.Maui/Types.cs`](src/OpenIap.Maui/Types.cs) is a
  verbatim copy of [`packages/gql/src/generated/Types.cs`](../../packages/gql/src/generated/Types.cs).
  Don't edit by hand — regenerate via:
  ```bash
  cd packages/gql && bun run generate
  cd ../.. && bash scripts/sync-versions.sh
  ```
- **Hand-written:** [`OpenIap.cs`](src/OpenIap.Maui/OpenIap.cs),
  [`UnsupportedOpenIap.cs`](src/OpenIap.Maui/UnsupportedOpenIap.cs), and the
  per-platform files under [`Platforms/`](src/OpenIap.Maui/Platforms).

## Links

- OpenIAP spec: https://www.openiap.dev
- Monorepo: https://github.com/hyodotdev/openiap
- Companion libraries:
  [react-native-iap](../react-native-iap),
  [expo-iap](../expo-iap),
  [flutter_inapp_purchase](../flutter_inapp_purchase),
  [godot-iap](../godot-iap),
  [kmp-iap](../kmp-iap)

## License

MIT — © hyodotdev
