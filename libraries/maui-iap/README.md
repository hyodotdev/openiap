# maui-iap

OpenIAP for **.NET MAUI** - unified in-app purchases on iOS, Android, and
macCatalyst from a single C# API.

## Status matrix

| Layer                                      |          iOS          |        Android        |      macCatalyst      |
| ------------------------------------------ | :-------------------: | :-------------------: | :-------------------: |
| Generated types (`Types.cs`)               |          yes          |          yes          |          yes          |
| `Iap.Instance` facade and listener streams |          yes          |          yes          |          yes          |
| StoreKit 2 / Play Billing native bindings  |          yes          |          yes          |          yes          |
| Example MAUI app                           |          yes          |          yes          |          yes          |
| NuGet package shape                        | single public package | single public package | single public package |

## Install

Requires .NET 9 SDK and the MAUI workload:

```bash
dotnet workload install maui
dotnet add package Hyo.OpenIap.Maui --version 1.0.0
```

Or add the package directly:

```xml
<PackageReference Include="Hyo.OpenIap.Maui" Version="1.0.0" />
```

`Hyo.OpenIap.Maui` is the only package apps reference. The Android binding,
iOS binding, Google Play Billing AARs, and StoreKit xcframework resources are
flattened into the main NuGet package.

## Usage

```csharp
using Hyo.OpenIap;
using Hyo.OpenIap.Maui;

var iap = Iap.Instance;
var query = (QueryResolver)iap;
var mutate = (MutationResolver)iap;

IDisposable purchaseSub = iap.PurchaseUpdated.Subscribe(async purchase =>
{
    bool verified = await VerifyOnServerAsync(purchase);
    if (!verified) return;

    await mutate.FinishTransactionAsync(
        purchase: new PurchaseInput(purchase),
        isConsumable: true);
});

IDisposable errorSub = iap.PurchaseError.Subscribe(error =>
{
    Console.WriteLine($"{error.Code}: {error.Message}");
});

await mutate.InitConnectionAsync();

var result = await query.FetchProductsAsync(new ProductRequest
{
    Skus = new[] { "premium", "coins_100" },
    Type = ProductQueryType.InApp,
});

await mutate.RequestPurchaseAsync(new RequestPurchaseProps
{
    Type = ProductQueryType.InApp,
    RequestPurchase = new RequestPurchasePropsByPlatforms
    {
        Apple = new RequestPurchaseIosProps { Sku = "coins_100", Quantity = 1 },
        Google = new RequestPurchaseAndroidProps { Skus = new[] { "coins_100" } },
    },
});
```

Always validate purchases on your server before granting entitlement, then call
`FinishTransactionAsync`. On Android, unfinished purchases are refunded
automatically after 3 days.

## Example app

```bash
cd /path/to/openiap

# Android source runs need the native Google AAR plus the MAUI-owned module AAR.
(cd packages/google && ./gradlew :openiap:assemblePlayRelease)
(cd libraries/maui-iap/android && ../../../packages/google/gradlew :openiap:assembleRelease)

cd libraries/maui-iap/example/OpenIap.Maui.Example
adb uninstall dev.hyo.martie || true
dotnet build -t:Run -f net9.0-android

dotnet build -t:Run -f net9.0-ios
dotnet build -t:Run -f net9.0-maccatalyst
```

VS Code launch configurations are in `libraries/maui-iap/.vscode/launch.json`.
The Android launcher builds both AARs before compiling the example app.

## What's generated vs. hand-written

- **Generated:** [`src/OpenIap.Maui/Types.cs`](src/OpenIap.Maui/Types.cs) is
  synced from
  [`packages/gql/src/generated/Types.cs`](../../packages/gql/src/generated/Types.cs).
  Do not edit it by hand.
- **Hand-written:** [`OpenIap.cs`](src/OpenIap.Maui/OpenIap.cs),
  [`ObservableExtensions.cs`](src/OpenIap.Maui/ObservableExtensions.cs), native
  resolver files under [`Platforms/`](src/OpenIap.Maui/Platforms), and the
  binding projects.

Regenerate types with:

```bash
cd packages/gql && bun run generate
cd ../.. && bash scripts/sync-versions.sh
```

## Links

- OpenIAP docs: https://www.openiap.dev
- Monorepo: https://github.com/hyodotdev/openiap
- Setup guide: https://www.openiap.dev/docs/setup/maui

## License

MIT - (c) hyodotdev
