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
- **`OfferCodePage`** ← `app/offer-code.tsx` — iOS-only `presentCodeRedemptionSheetIOS` with Android hint copy.
- **`AlternativeBillingPage`** ← `app/alternative-billing.tsx` — Android `checkAlternativeBillingAvailabilityAndroid` / `isBillingProgramAvailableAndroid`, iOS external purchase link + custom-link eligibility.
- **`WebhookStreamPage`** ← `app/webhook-stream.tsx` — live IAPKit SSE consumer with optional bearer token, terminal-style log.

Shared layer:

- [`Constants.cs`](OpenIap.Maui.Example/Constants.cs) mirrors `src/utils/constants.ts` (same SKU sets).
- [`Utils/ErrorUtils.cs`](OpenIap.Maui.Example/Utils/ErrorUtils.cs) mirrors `errorUtils.ts`.
- [`Utils/BuildPurchaseRows.cs`](OpenIap.Maui.Example/Utils/BuildPurchaseRows.cs) mirrors `buildPurchaseRows.ts` — exhaustive walk of `PurchaseIOS` / `PurchaseAndroid` fields.
- [`Components/Loading.xaml`](OpenIap.Maui.Example/Components/Loading.xaml), [`PurchaseSummaryRow.xaml`](OpenIap.Maui.Example/Components/PurchaseSummaryRow.xaml), [`PurchaseDetailsView.xaml`](OpenIap.Maui.Example/Components/PurchaseDetailsView.xaml) mirror the React components.

## Run

```bash
# Once: install the MAUI workload (.NET 9 or newer; macOS needs sudo)
sudo dotnet workload install maui

# If you upgrade Xcode and see "requires Xcode <X> … current version is <Y>",
# refresh the iOS workload to the version that matches your Xcode:
sudo dotnet workload update

cd libraries/maui-iap/example/OpenIap.Maui.Example

# iOS Simulator
dotnet build -t:Run -f net9.0-ios

# Android (real device or emulator)
adb uninstall dev.hyo.martie || true
dotnet build -t:Run -f net9.0-android

# macCatalyst
dotnet build -t:Run -f net9.0-maccatalyst
```

VS Code launch configurations are pre-wired in
[`libraries/maui-iap/.vscode/launch.json`](../.vscode/launch.json) — the
top-level workspace launcher in
[`.vscode/launch.json`](../../../.vscode/launch.json) also exposes
**🟣 MAUI IAP: iOS** and **🟣 MAUI IAP: Android** entries that run from
this example project.

## Status

This is a scaffold. Pages compile against the generated `Hyo.OpenIap`
contract from `packages/gql`, but the underlying platform bridges in
[`libraries/maui-iap/src/OpenIap.Maui/Platforms/`](../src/OpenIap.Maui/Platforms)
are not yet wired to the native packages — once the Xamarin.Android
binding (against `packages/google`) and the Xamarin.iOS binding (against
`packages/apple`) land, every flow becomes immediately functional.
