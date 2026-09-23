# OpenIap.Maui.Example

A .NET MAUI sample app that mirrors
[`libraries/expo-iap/example`](../../expo-iap/example) — same SKUs, same
seven flows, same UX patterns.

## Pages

- **`HomePage`** ← `app/index.tsx` — menu + storefront probe in the header.
- **`AllProductsPage`** ← `app/all-products.tsx` — `fetchProducts(type: All)`, sealed-union match, type/platform-narrowed details modal.
- **`PurchaseFlowPage`** ← `app/purchase-flow.tsx` — `requestPurchase`, `PurchaseUpdated` listener, verification picker (none / local / IAPKit), available-purchases panel, copy-result button, iOS App Transaction probe, two modal sheets (product / purchase details).
- **`SubscriptionFlowPage`** ← `app/subscription-flow.tsx` — subscriptions list, `getActiveSubscriptions`, `deepLinkToSubscriptions`, details modal.
- **`AvailablePurchasesPage`** ← `app/available-purchases.tsx` — `getAvailablePurchases` (deduplicated), `getActiveSubscriptions`, manage deep link.
- **`OfferCodePage`** ← `app/offer-code.tsx` — unified `openRedeemOfferCode` (StoreKit sheet on iOS, Play redeem page on Android) with platform hint copy.
- **`AlternativeBillingPage`** ← `app/alternative-billing.tsx` — Android `isBillingProgramAvailableAndroid`, iOS external purchase link + custom-link eligibility.

Shared layer:

- [`Constants.cs`](OpenIap.Maui.Example/Constants.cs) mirrors `src/utils/constants.ts` (same SKU sets).
- [`Utils/ErrorUtils.cs`](OpenIap.Maui.Example/Utils/ErrorUtils.cs) mirrors `errorUtils.ts`.
- [`Utils/BuildPurchaseRows.cs`](OpenIap.Maui.Example/Utils/BuildPurchaseRows.cs) mirrors `buildPurchaseRows.ts` — exhaustive walk of `PurchaseIOS` / `PurchaseAndroid` fields.
- [`Components/Loading.xaml`](OpenIap.Maui.Example/Components/Loading.xaml), [`PurchaseSummaryRow.xaml`](OpenIap.Maui.Example/Components/PurchaseSummaryRow.xaml), [`PurchaseDetailsView.xaml`](OpenIap.Maui.Example/Components/PurchaseDetailsView.xaml) mirror the React components.

## Run

```bash
# Once: install the .NET 10 MAUI workload (macOS needs sudo)
sudo dotnet workload install maui

# If you upgrade Xcode and see "requires Xcode <X> … current version is <Y>",
# refresh the iOS workload to the version that matches your Xcode:
sudo dotnet workload update

# The stable iOS workload trails new Xcode releases, so an update alone may
# still pin an older Xcode. Build past the guard when only the check is stale:
dotnet build -f net10.0-ios -p:ValidateXcodeVersion=false

cd libraries/maui-iap/example/OpenIap.Maui.Example

# iOS Simulator
dotnet build -t:Run -f net10.0-ios

# Android (real device or emulator). Build the Google AARs first: see
# "Example app" in ../README.md. A Debug build links the device's store.
adb uninstall dev.hyo.martie || true
dotnet build -t:Run -f net10.0-android

# macCatalyst
dotnet build -t:Run -f net10.0-maccatalyst
```

VS Code launch configurations are pre-wired in
[`libraries/maui-iap/.vscode/launch.json`](../.vscode/launch.json) — the
top-level workspace launcher in
[`.vscode/launch.json`](../../../.vscode/launch.json) also exposes
**🟣 MAUI IAP: iOS** and **🟣 MAUI IAP: Android** entries that run from
this example project.

## Purchase verification

A device has no environment variables, so IAPKit settings are baked in at build
time. Copy `iapkit.props.example` to `iapkit.props` (untracked) and fill in:

| Property           | Purpose                                                |
| ------------------ | ------------------------------------------------------ |
| `IapkitApiKey`     | `openiap-kit_pk_` publishable key, never an `sk_` key. |
| `IapkitBaseUrl`    | Origin of a local IAPKit server; empty uses the host.  |
| `AmazonRvsSandbox` | `true` for Amazon App Tester receipts.                 |

Each is also settable as an MSBuild property, for example
`dotnet build -p:IapkitBaseUrl=http://127.0.0.1:3100`. `IapkitBaseUrl` is an
origin, not the verify path. For **Local (IAPKit)** the key and the local server
must target the same Convex deployment. An Android device on USB reaches the
host through `adb -s "$ANDROID_SERIAL" reverse --no-rebind tcp:3100 tcp:3100`
and `http://127.0.0.1:3100`; a physical iPhone needs the Mac's LAN address.
Unlike the other examples this one permits loopback cleartext in every build
type, because .NET for Android has no per-configuration manifest merge; the
network security config still allows nothing beyond loopback.

The verification button cycles in this order:

1. **None (Skip)** — skip verification.
2. **Local (Device)** — verify on device.
3. **Local (IAPKit)** — IAPKit routed to `IapkitBaseUrl`.
4. **IAPKit (Server)** — hosted IAPKit; the local URL is deliberately omitted.

With both values configured, the example defaults to **Local (IAPKit)**. With
only the key, it defaults to **IAPKit (Server)**; without a key, it defaults to
**None (Skip)**.

An Android debug build installed with plain `adb install` aborts at launch with
`No assemblies found ... Assuming this is part of Fast Deployment`. Either
deploy with `dotnet build -t:Run`, or build the APK with
`-p:EmbedAssembliesIntoApk=true` first.

## Status

The pages compile against the generated `OpenIap` contract from `specs/client`.
The Android and Apple platform bridges under
[`libraries/maui-iap/src/OpenIap.Maui/Platforms/`](../src/OpenIap.Maui/Platforms)
are wired to `packages/google` and `packages/apple`; use physical store test
devices for purchase verification.
