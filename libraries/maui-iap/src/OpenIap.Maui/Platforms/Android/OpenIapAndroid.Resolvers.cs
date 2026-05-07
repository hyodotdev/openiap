// Resolver-method implementations for OpenIapAndroid. Split from the
// listener / wiring code in OpenIapAndroid.cs purely for file size.

#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using Hyo.OpenIap;
using OpenIapMauiModule = global::Dev.Hyo.Openiap.Maui.OpenIapMauiModule;

namespace Hyo.OpenIap.Maui.Platforms.Android;

internal sealed partial class OpenIapAndroid
{
    // ====================================================================
    // MutationResolver
    // ====================================================================

    public Task<bool> InitConnectionAsync(InitConnectionConfig? config = null)
    {
        RefreshCurrentActivity();
        var json = config is null ? null : JsonSerializer.Serialize(config, JsonOptions.Default);
        return InvokeBool(cb => _module.InitConnection(json, cb));
    }

    public Task<bool> EndConnectionAsync()
        => InvokeBool(cb => _module.EndConnection(cb));

    // NOTE: Every async wrapper uses `await Invoke(...)` rather than
    // ContinueWith(.., OnlyOnRanToCompletion) because the latter swallows
    // antecedent exceptions and produces a *canceled* continuation task —
    // callers then surface the misleading "A task was canceled." message
    // instead of the real BillingClient / Kotlin error from the module.
    public async Task<RequestPurchaseResult?> RequestPurchaseAsync(RequestPurchaseProps @params)
    {
        RefreshCurrentActivity();
        var json = JsonSerializer.Serialize(@params, JsonOptions.Default);
        var result = await Invoke(cb => _module.RequestPurchase(json, cb));
        return DecodeRequestPurchaseResult(result);
    }

    public async Task<string> FinishTransactionAsync(PurchaseInput purchase, bool? isConsumable = null)
    {
        // PurchaseInput wraps Purchase; serialize the inner record so the wire
        // shape stays a flat Purchase JSON object (matches what the module expects).
        var json = JsonSerializer.Serialize(purchase.Value, JsonOptions.Default);
        var consumable = isConsumable.HasValue ? Java.Lang.Boolean.ValueOf(isConsumable.Value) : null;
        var result = await Invoke(cb => _module.FinishTransaction(json, consumable, cb));
        return DecodeStringValue(result);
    }

    public async Task<string> RestorePurchasesAsync()
    {
        var result = await Invoke(cb => _module.RestorePurchases(cb));
        return DecodeStringValue(result);
    }

    public async Task<string> DeepLinkToSubscriptionsAsync(DeepLinkOptions? options = null)
    {
        var json = options is null ? null : JsonSerializer.Serialize(options, JsonOptions.Default);
        var result = await Invoke(cb => _module.DeepLinkToSubscriptions(json, cb));
        return DecodeStringValue(result);
    }

    public async Task<VerifyPurchaseResult> ValidateReceiptAsync(VerifyPurchaseProps options)
    {
        var json = JsonSerializer.Serialize(options, JsonOptions.Default);
        var result = await Invoke(cb => _module.ValidateReceipt(json, cb));
        return DecodeVerifyPurchaseResult(result);
    }

    public async Task<VerifyPurchaseResult> VerifyPurchaseAsync(VerifyPurchaseProps options)
    {
        var json = JsonSerializer.Serialize(options, JsonOptions.Default);
        var result = await Invoke(cb => _module.VerifyPurchase(json, cb));
        return DecodeVerifyPurchaseResult(result);
    }

    public async Task<VerifyPurchaseWithProviderResult> VerifyPurchaseWithProviderAsync(VerifyPurchaseWithProviderProps options)
    {
        var json = JsonSerializer.Serialize(options, JsonOptions.Default);
        var result = await Invoke(cb => _module.VerifyPurchaseWithProvider(json, cb));
        return JsonSerializer.Deserialize<VerifyPurchaseWithProviderResult>(result, JsonOptions.Default)
            ?? throw OpenIapErrorMapper.Wrap(ErrorCode.Unknown, "Empty verifyPurchaseWithProvider result");
    }

    // ---- Android-only mutations -----------------------------------------

    public Task<bool> AcknowledgePurchaseAndroidAsync(string purchaseToken)
        => InvokeBool(cb => _module.AcknowledgePurchaseAndroid(purchaseToken, cb));

    public Task<bool> ConsumePurchaseAndroidAsync(string purchaseToken)
        => InvokeBool(cb => _module.ConsumePurchaseAndroid(purchaseToken, cb));

    public Task<bool> CheckAlternativeBillingAvailabilityAndroidAsync()
        => InvokeBool(cb => _module.CheckAlternativeBillingAvailabilityAndroid(cb));

    public async Task<string?> CreateAlternativeBillingTokenAndroidAsync()
    {
        var result = await Invoke(cb => _module.CreateAlternativeBillingTokenAndroid(cb));
        return DecodeNullableString(result);
    }

    public Task<bool> ShowAlternativeBillingDialogAndroidAsync()
    {
        RefreshCurrentActivity();
        return InvokeBool(cb => _module.ShowAlternativeBillingDialogAndroid(cb));
    }

    public async Task<BillingProgramAvailabilityResultAndroid> IsBillingProgramAvailableAndroidAsync(BillingProgramAndroid program)
    {
        var json = JsonSerializer.Serialize(program, JsonOptions.Default);
        var result = await Invoke(cb => _module.IsBillingProgramAvailableAndroid(json, cb));
        return JsonSerializer.Deserialize<BillingProgramAvailabilityResultAndroid>(result, JsonOptions.Default)
            ?? throw OpenIapErrorMapper.Wrap(ErrorCode.Unknown, "Empty isBillingProgramAvailable result");
    }

    public async Task<BillingProgramReportingDetailsAndroid> CreateBillingProgramReportingDetailsAndroidAsync(BillingProgramAndroid program)
    {
        var json = JsonSerializer.Serialize(program, JsonOptions.Default);
        var result = await Invoke(cb => _module.CreateBillingProgramReportingDetailsAndroid(json, cb));
        return JsonSerializer.Deserialize<BillingProgramReportingDetailsAndroid>(result, JsonOptions.Default)
            ?? throw OpenIapErrorMapper.Wrap(ErrorCode.Unknown, "Empty createBillingProgramReportingDetails result");
    }

    public Task<bool> LaunchExternalLinkAndroidAsync(LaunchExternalLinkParamsAndroid @params)
    {
        RefreshCurrentActivity();
        var json = JsonSerializer.Serialize(@params, JsonOptions.Default);
        return InvokeBool(cb => _module.LaunchExternalLinkAndroid(json, cb));
    }

    // ---- iOS-only mutations (return defaults / throw not-supported) -----

    public Task<string?> BeginRefundRequestIOSAsync(string sku) => NotSupportedIOS<string?>("beginRefundRequestIOS");
    public Task<bool> ClearTransactionIOSAsync() => NotSupportedIOS<bool>("clearTransactionIOS");
    public Task<bool> PresentCodeRedemptionSheetIOSAsync() => NotSupportedIOS<bool>("presentCodeRedemptionSheetIOS");
    public Task<ExternalPurchaseLinkResultIOS> PresentExternalPurchaseLinkIOSAsync(string url) => NotSupportedIOS<ExternalPurchaseLinkResultIOS>("presentExternalPurchaseLinkIOS");
    public Task<ExternalPurchaseNoticeResultIOS> PresentExternalPurchaseNoticeSheetIOSAsync() => NotSupportedIOS<ExternalPurchaseNoticeResultIOS>("presentExternalPurchaseNoticeSheetIOS");
    public Task<bool> RequestPurchaseOnPromotedProductIOSAsync() => NotSupportedIOS<bool>("requestPurchaseOnPromotedProductIOS");
    public Task<ExternalPurchaseCustomLinkNoticeResultIOS> ShowExternalPurchaseCustomLinkNoticeIOSAsync(ExternalPurchaseCustomLinkNoticeTypeIOS noticeType) => NotSupportedIOS<ExternalPurchaseCustomLinkNoticeResultIOS>("showExternalPurchaseCustomLinkNoticeIOS");
    public Task<IReadOnlyList<PurchaseIOS>> ShowManageSubscriptionsIOSAsync() => NotSupportedIOS<IReadOnlyList<PurchaseIOS>>("showManageSubscriptionsIOS");
    public Task<bool> SyncIOSAsync() => NotSupportedIOS<bool>("syncIOS");

    // ====================================================================
    // QueryResolver
    // ====================================================================

    public async Task<FetchProductsResult> FetchProductsAsync(ProductRequest @params)
    {
        var json = JsonSerializer.Serialize(@params, JsonOptions.Default);
        var result = await Invoke(cb => _module.FetchProducts(json, cb));
        return DecodeFetchProductsResult(result);
    }

    public async Task<IReadOnlyList<Purchase>> GetAvailablePurchasesAsync(PurchaseOptions? options = null)
    {
        var json = options is null ? null : JsonSerializer.Serialize(options, JsonOptions.Default);
        var result = await Invoke(cb => _module.GetAvailablePurchases(json, cb));
        return DecodeItems<Purchase>(result);
    }

    public async Task<IReadOnlyList<ActiveSubscription>> GetActiveSubscriptionsAsync(IReadOnlyList<string>? subscriptionIds = null)
    {
        var json = subscriptionIds is null ? null : JsonSerializer.Serialize(subscriptionIds, JsonOptions.Default);
        var result = await Invoke(cb => _module.GetActiveSubscriptions(json, cb));
        return DecodeItems<ActiveSubscription>(result);
    }

    public Task<bool> HasActiveSubscriptionsAsync(IReadOnlyList<string>? subscriptionIds = null)
    {
        var json = subscriptionIds is null ? null : JsonSerializer.Serialize(subscriptionIds, JsonOptions.Default);
        return InvokeBool(cb => _module.HasActiveSubscriptions(json, cb));
    }

    public async Task<string> GetStorefrontAsync()
    {
        var result = await Invoke(cb => _module.GetStorefront(cb));
        return DecodeStringValue(result);
    }

    // ---- iOS-only queries (defaults / throw not-supported) --------------

    public Task<bool> CanPresentExternalPurchaseNoticeIOSAsync() => Task.FromResult(false);
    public Task<PurchaseIOS?> CurrentEntitlementIOSAsync(string sku) => Task.FromResult<PurchaseIOS?>(null);
    public Task<IReadOnlyList<PurchaseIOS>> GetAllTransactionsIOSAsync() => Task.FromResult<IReadOnlyList<PurchaseIOS>>(Array.Empty<PurchaseIOS>());
    public Task<AppTransaction?> GetAppTransactionIOSAsync() => Task.FromResult<AppTransaction?>(null);
    public Task<ExternalPurchaseCustomLinkTokenResultIOS> GetExternalPurchaseCustomLinkTokenIOSAsync(ExternalPurchaseCustomLinkTokenTypeIOS tokenType) => NotSupportedIOS<ExternalPurchaseCustomLinkTokenResultIOS>("getExternalPurchaseCustomLinkTokenIOS");
    public Task<IReadOnlyList<PurchaseIOS>> GetPendingTransactionsIOSAsync() => Task.FromResult<IReadOnlyList<PurchaseIOS>>(Array.Empty<PurchaseIOS>());
    public Task<ProductIOS?> GetPromotedProductIOSAsync() => Task.FromResult<ProductIOS?>(null);
    public Task<string?> GetReceiptDataIOSAsync() => Task.FromResult<string?>(null);
    public Task<string> GetStorefrontIOSAsync() => GetStorefrontAsync();
    public Task<string?> GetTransactionJwsIOSAsync(string sku) => Task.FromResult<string?>(null);
    public Task<bool> IsEligibleForExternalPurchaseCustomLinkIOSAsync() => Task.FromResult(false);
    public Task<bool> IsEligibleForIntroOfferIOSAsync(string groupId) => Task.FromResult(false);
    public Task<bool> IsTransactionVerifiedIOSAsync(string sku) => Task.FromResult(false);
    public Task<PurchaseIOS?> LatestTransactionIOSAsync(string sku) => Task.FromResult<PurchaseIOS?>(null);
    public Task<IReadOnlyList<SubscriptionStatusIOS>> SubscriptionStatusIOSAsync(string sku) => Task.FromResult<IReadOnlyList<SubscriptionStatusIOS>>(Array.Empty<SubscriptionStatusIOS>());
    public Task<VerifyPurchaseResultIOS> ValidateReceiptIOSAsync(VerifyPurchaseProps options) => NotSupportedIOS<VerifyPurchaseResultIOS>("validateReceiptIOS");

    // ====================================================================
    // Decode helpers
    // ====================================================================

    private static Task<T> NotSupportedIOS<T>(string api)
        => Task.FromException<T>(OpenIapErrorMapper.Wrap(ErrorCode.FeatureNotSupported, $"{api} is iOS-only"));

    private async Task<bool> InvokeBool(Action<OpenIapMauiModule.IResultCallback> dispatch)
    {
        var json = await Invoke(dispatch);
        return DecodeBoolValue(json);
    }

    private static bool DecodeBoolValue(string json)
    {
        if (string.IsNullOrEmpty(json)) return false;
        var env = JsonSerializer.Deserialize<ValueEnvelope<bool>>(json, JsonOptions.Default);
        return env?.Value ?? false;
    }

    private static string DecodeStringValue(string json)
    {
        if (string.IsNullOrEmpty(json)) return string.Empty;
        var env = JsonSerializer.Deserialize<ValueEnvelope<string>>(json, JsonOptions.Default);
        return env?.Value ?? string.Empty;
    }

    private static string? DecodeNullableString(string json)
    {
        if (string.IsNullOrEmpty(json)) return null;
        var env = JsonSerializer.Deserialize<ValueEnvelope<string?>>(json, JsonOptions.Default);
        return env?.Value;
    }

    private static List<T> DecodeItems<T>(string json)
    {
        if (string.IsNullOrEmpty(json)) return new List<T>();
        var env = JsonSerializer.Deserialize<ItemsEnvelope<T>>(json, JsonOptions.Default);
        return env?.Items ?? new List<T>();
    }

    private static FetchProductsResult DecodeFetchProductsResult(string json)
    {
        var env = JsonSerializer.Deserialize<FetchProductsEnvelope>(json, JsonOptions.Default)
            ?? throw OpenIapErrorMapper.Wrap(ErrorCode.Unknown, "Empty fetchProducts result");
        return env.Kind switch
        {
            "products" => new FetchProductsResultProducts(DecodeArrayAs<Product>(env.Items)),
            "subscriptions" => new FetchProductsResultSubscriptions(DecodeArrayAs<ProductSubscription>(env.Items)),
            "all" => new FetchProductsResultAll(DecodeArrayAs<ProductOrSubscription>(env.Items)),
            _ => throw OpenIapErrorMapper.Wrap(ErrorCode.Unknown, $"Unknown fetchProducts kind: {env.Kind}"),
        };
    }

    private static RequestPurchaseResult? DecodeRequestPurchaseResult(string json)
    {
        if (string.IsNullOrEmpty(json)) return null;
        var env = JsonSerializer.Deserialize<RequestPurchaseEnvelope>(json, JsonOptions.Default);
        if (env is null) return null;
        return env.Kind switch
        {
            "purchase" => new RequestPurchaseResultPurchase(env.Value?.Deserialize<Purchase>(JsonOptions.Default)),
            "purchases" => new RequestPurchaseResultPurchases(DecodeArrayAs<Purchase>(env.Items)),
            "none" => null,
            _ => null,
        };
    }

    private static VerifyPurchaseResult DecodeVerifyPurchaseResult(string json)
    {
        var result = JsonSerializer.Deserialize<VerifyPurchaseResult>(json, JsonOptions.Default);
        return result ?? throw OpenIapErrorMapper.Wrap(ErrorCode.Unknown, "Empty verifyPurchase result");
    }

    private static IReadOnlyList<T>? DecodeArrayAs<T>(JsonArray? array)
    {
        if (array is null) return null;
        var list = new List<T>(array.Count);
        foreach (var item in array)
        {
            if (item is null) continue;
            var typed = item.Deserialize<T>(JsonOptions.Default);
            if (typed is not null) list.Add(typed);
        }
        return list;
    }
}
