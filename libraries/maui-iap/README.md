# maui-iap

OpenIAP for **.NET MAUI** - unified in-app purchases on iOS, Android, and
macCatalyst from a single C# API.

## Status matrix

| Layer                                                |          iOS          |        Android        |      macCatalyst      |
| ---------------------------------------------------- | :-------------------: | :-------------------: | :-------------------: |
| Generated types (`Types.cs`)                         |          yes          |          yes          |          yes          |
| `OpenIapClient.Instance` facade and listener streams |          yes          |          yes          |          yes          |
| StoreKit 2 / Play Billing native bindings            |          yes          |          yes          |          yes          |
| Example MAUI app                                     |          yes          |          yes          |          yes          |
| NuGet package shape                                  | single public package | single public package | single public package |

## Install

OpenIap.Maui 2.x requires the supported .NET 10 SDK and MAUI workload:

```bash
dotnet workload install maui
dotnet add package OpenIap.Maui
```

For manual `.csproj` edits, copy the current PackageReference from the
[OpenIap.Maui NuGet package page](https://www.nuget.org/packages/OpenIap.Maui).

`OpenIap.Maui` is the only NuGet package apps reference. The Android and iOS
binding outputs are flattened into the main NuGet package, while Google
Billing, Play Services, Gson, AndroidX, and Kotlin Android libraries remain
normal NuGet dependencies so apps can deduplicate them with their own package
graph.

Stable NuGet releases rebuild the embedded Apple XCFramework with the current
App Store-accepted toolchain (Xcode 26.6 / SDK 26.5) and verify every packaged
Mach-O slice before publishing. Xcode 27 remains a source-compatibility CI lane
until Apple accepts it for App Store submissions, so its guarded StoreKit 27
paths are not included in stable release artifacts yet.

## Usage

```csharp
using OpenIap;
using OpenIap.Maui;

var iap = OpenIapClient.Instance;
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

OpenIap.Maui 2.x exposes `OpenIapClient`; the deprecated `Iap` compatibility
facade was removed. Replace `Iap` calls before upgrading from 1.x.

## IAPKit API and webhooks

MAUI exposes the same kit helper surface as `expo-iap` and
`react-native-iap`, with C# naming conventions:

```csharp
using OpenIap;
using OpenIap.Maui;

var kit = OpenIapClient.KitApi(new KitApiOptions
{
    ApiKey = "openiap-kit_pk_<your-publishable-key>",
    BaseUrl = "https://kit.openiap.dev",
});

var status = await kit.StatusAsync("user-123");
var entitlements = await kit.EntitlementsAsync("user-123");
string? cursor = null;
do
{
    var page = await kit.ProductsAsync(new KitProductsOptions
    {
        Platform = KitProductPlatform.IOS, // required with IncludeClientPayload
        IncludeClientPayload = true,
        Limit = 25,                        // default 25, maximum 50
        Cursor = cursor,
    });
    foreach (var product in page.Products)
    {
        // Consume product.ClientPayload when present.
    }
    cursor = page.HasMore == true ? page.NextCursor : null;
} while (cursor is not null);
var payload = await kit.ClientPayloadAsync(
    "premium.monthly",
    KitProductPlatform.IOS);
await kit.BindUserAsync(purchaseToken: "token", userId: "user-123");
```

Publishable keys are intentionally app-readable. Never embed an
`openiap-kit_sk_` secret key in a shipped app; reserve it for trusted backends,
CI, and MCP administration.

Client payloads are public app-readable metadata. Keep secrets and server-only
rules out of them; catalog responses omit payload bodies unless explicitly
requested. Payload-inclusive catalog reads require a platform and return
bounded cursor pages (`HasMore` / `NextCursor`). `Limit` and `Cursor` are
ignored by the legacy non-payload catalog path. If catalog churn returns
`INVALID_CURSOR`, restart without `Cursor`.

IAPKit accepts store-to-server lifecycle webhooks but does not expose an
outbound event stream to MAUI or other mobile SDKs. Apps should use purchase
verification, scoped entitlement reads, and bounded lifecycle refreshes.

## Example app

```bash
cd /path/to/openiap

# Android source runs need the native Google AAR plus the MAUI-owned module AAR.
(cd packages/google && ./gradlew :openiap:assemblePlayRelease)
(cd libraries/maui-iap/android && ../../../packages/google/gradlew :openiap:assembleRelease)

cd libraries/maui-iap/example/OpenIap.Maui.Example
adb uninstall dev.hyo.martie || true
dotnet build -t:Run -f net10.0-android

dotnet build -t:Run -f net10.0-ios
dotnet build -t:Run -f net10.0-maccatalyst
```

VS Code launch configurations are in `libraries/maui-iap/.vscode/launch.json`.
The Android launcher builds both AARs before compiling the example app.

### Android store variants

Source builds can select Amazon Appstore or Meta Horizon instead of Google
Play. Build the matching native facade immediately before the .NET build:

```bash
cd libraries/maui-iap/android
../../../packages/google/gradlew :openiap:assembleRelease -PopenIapAndroidStore=amazon
cd ..
dotnet build example/OpenIap.Maui.Example/OpenIap.Maui.Example.csproj \
  -f net10.0-android \
  -p:OpenIapAndroidStore=amazon
```

Use `horizon` for Meta Horizon and `play` for Google Play. MAUI keeps each
store's intermediate and output directories separate, preventing a prior
store build from leaking its AAR or manifest into the next variant.

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
```

## Links

- OpenIAP docs: https://openiap.dev
- Monorepo: https://github.com/hyodotdev/openiap
- Setup guide: https://openiap.dev/docs/setup/maui

<!-- sponsors:start -->
<!-- Generated by scripts/sync-sponsors.mjs from packages/docs/sponsors.json. -->
## Sponsors

<p align="center">
  <a href="https://meta.com">
    <img src="https://openiap.dev/meta.svg" alt="Meta" height="80" align="middle">
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://developer.amazon.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://openiap.dev/sponsors/amazon-dark.webp">
      <img src="https://openiap.dev/sponsors/amazon.webp" alt="Amazon Developer" height="44" align="middle">
    </picture>
  </a>
</p>

Thank you to [Meta](https://meta.com) and [Amazon Developer](https://developer.amazon.com/) for supporting OpenIAP. [View sponsorship options](https://openiap.dev/sponsors).

### OpenCollective

We also recognize sponsors and backers through OpenCollective. The original react-native-iap collective now supports the broader OpenIAP ecosystem and is managed separately from the main sponsor program.

**Sponsors:** <a href="https://opencollective.com/openiap#sponsors"><img src="https://opencollective.com/openiap/sponsors.svg?width=890&cache=20260706" alt="OpenCollective sponsors" /></a>

**Backers:** <a href="https://opencollective.com/openiap#backers"><img src="https://opencollective.com/openiap/backers.svg?width=890&cache=20260706" alt="OpenCollective backers" /></a>

[Become a sponsor](https://opencollective.com/openiap#sponsor) | [Become a backer](https://opencollective.com/openiap#backer)

### Past react-native-iap supporters

These companies supported react-native-iap before the OpenIAP-wide sponsor program. This acknowledgement does not imply current sponsorship.

<p align="center">
  <a href="https://namiml.com">
    <img src="https://openiap.dev/sponsors/nami.webp" alt="Nami" height="32" align="middle">
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://www.courier.com/?utm_source=react-native-iap&utm_campaign=osssponsors">
    <img src="https://openiap.dev/sponsors/courier.webp" alt="Courier" height="32" align="middle">
  </a>
</p>

[openiap-sponsors]: https://openiap.dev/sponsors
[openiap-github-sponsors]: https://github.com/sponsors/hyodotdev
[openiap-opencollective]: https://opencollective.com/openiap
[openiap-paypal]: https://www.paypal.me/dooboolab
[openiap-company-contact]: mailto:hyo@hyo.dev
<!-- sponsors:end -->

## License

MIT - (c) hyodotdev
