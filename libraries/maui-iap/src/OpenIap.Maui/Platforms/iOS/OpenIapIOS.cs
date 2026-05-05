// iOS resolver — bridges typed C# input/output records to the
// `OpenIapModule` Objective-C facade exposed by `OpenIAP.xcframework`. The
// ObjC bridge accepts/returns NSDictionary; we deserialize via System.Text.Json
// using the [JsonPolymorphic] discriminator already in the generated records.

#nullable enable

// CA1416 fires on every call to a binding method marked iOS 16+ / 17.4+ / 18.1+
// because the analyzer can't see through `cb => _module.Foo(cb)` lambdas to
// the OperatingSystem.IsIOSVersionAtLeast(...) guards we add at the resolver
// entry. Each call below is guarded — disable the analyzer for this file.
#pragma warning disable CA1416

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using Foundation;
using Hyo.OpenIap;
using Hyo.OpenIap.Maui.Bindings.iOS;

namespace Hyo.OpenIap.Maui.Platforms.iOS;

internal class OpenIapIOS : IOpenIap, QueryResolver, MutationResolver
{
    private readonly OpenIapModule _module = OpenIapModule.SharedInstance();

    private readonly Subject<Purchase> _purchaseUpdated = new();
    private readonly Subject<PurchaseError> _purchaseError = new();
    private readonly Subject<string> _promotedProductIOS = new();
    private readonly Subject<Purchase> _subscriptionBillingIssue = new();

    private NSObject? _purchaseUpdatedToken;
    private NSObject? _purchaseErrorToken;
    private NSObject? _promotedProductToken;
    private NSObject? _billingIssueToken;

    public OpenIapIOS()
    {
        WireListeners();
    }

    public IObservable<Purchase> PurchaseUpdated => _purchaseUpdated;
    public IObservable<PurchaseError> PurchaseError => _purchaseError;
    public IObservable<string> PromotedProductIOS => _promotedProductIOS;
    public IObservable<Purchase> SubscriptionBillingIssue => _subscriptionBillingIssue;
    public IObservable<UserChoiceBillingDetails> UserChoiceBillingAndroid => EmptyObservable<UserChoiceBillingDetails>.Instance;
    public IObservable<DeveloperProvidedBillingDetailsAndroid> DeveloperProvidedBillingAndroid => EmptyObservable<DeveloperProvidedBillingDetailsAndroid>.Instance;

    private void WireListeners()
    {
        _purchaseUpdatedToken = _module.AddPurchaseUpdatedListener(dict =>
        {
            var node = NSObjectJsonBridge.DictToObject(dict);
            if (node is null) return;
            try
            {
                var p = node.Deserialize<Purchase>(JsonOptions.Default);
                if (p is not null) _purchaseUpdated.OnNext(p);
            }
            catch (JsonException) { }
        });

        _purchaseErrorToken = _module.AddPurchaseErrorListener(dict =>
        {
            var node = NSObjectJsonBridge.DictToObject(dict);
            var err = OpenIapErrorMapper.FromJson(node?.ToJsonString() ?? string.Empty);
            _purchaseError.OnNext(err);
        });

        _promotedProductToken = _module.AddPromotedProductListener(sku =>
        {
            if (sku is not null) _promotedProductIOS.OnNext((string)sku);
        });

        _billingIssueToken = _module.AddSubscriptionBillingIssueListener(dict =>
        {
            var node = NSObjectJsonBridge.DictToObject(dict);
            if (node is null) return;
            try
            {
                var p = node.Deserialize<Purchase>(JsonOptions.Default);
                if (p is not null) _subscriptionBillingIssue.OnNext(p);
            }
            catch (JsonException) { }
        });
    }

    // ====================================================================
    // MutationResolver
    // ====================================================================

    public Task<bool> InitConnectionAsync(InitConnectionConfig? config = null)
    {
        // The ObjC bridge has no config arg; iOS doesn't use the Android-only
        // billing-program/alternative-billing fields anyway.
        var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        _module.InitConnection((ok, err) => Complete(tcs, ok, err));
        return tcs.Task;
    }

    public Task<bool> EndConnectionAsync()
    {
        var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        _module.EndConnection((ok, err) => Complete(tcs, ok, err));
        return tcs.Task;
    }

    public Task<RequestPurchaseResult?> RequestPurchaseAsync(RequestPurchaseProps @params)
    {
        var tcs = new TaskCompletionSource<RequestPurchaseResult?>(TaskCreationOptions.RunContinuationsAsynchronously);

        // Purchase request → fetch sku/quantity from the iOS sub-prop.
        if (@params.RequestPurchase is { } purchaseEnv)
        {
            var iosProps = purchaseEnv.Apple ?? purchaseEnv.IOS;
            if (iosProps is null)
            {
                tcs.TrySetException(OpenIapErrorMapper.Wrap(ErrorCode.DeveloperError, "iOS purchase request requires `apple` props"));
                return tcs.Task;
            }
            _module.RequestPurchase(
                iosProps.Sku,
                iosProps.Quantity ?? 1,
                ProductTypeWireString(@params.Type),
                (result, err) =>
                {
                    if (err is not null) { tcs.TrySetException(MapNSError(err)); return; }
                    var node = result is NSDictionary d ? NSObjectJsonBridge.DictToObject(d) : null;
                    if (node is null) { tcs.TrySetResult(null); return; }
                    var purchase = node.Deserialize<Purchase>(JsonOptions.Default);
                    tcs.TrySetResult(purchase is null ? null : new RequestPurchaseResultPurchase(purchase));
                });
            return tcs.Task;
        }

        if (@params.RequestSubscription is { } subEnv)
        {
            var iosProps = subEnv.Apple ?? subEnv.IOS;
            if (iosProps is null)
            {
                tcs.TrySetException(OpenIapErrorMapper.Wrap(ErrorCode.DeveloperError, "iOS subscription request requires `apple` props"));
                return tcs.Task;
            }

            NSDictionary? legacyOffer = iosProps.WithOffer is null
                ? null
                : NSDictionary.FromObjectsAndKeys(
                    new NSObject[]
                    {
                        new NSString(iosProps.WithOffer.Identifier),
                        new NSString(iosProps.WithOffer.KeyIdentifier),
                        new NSString(iosProps.WithOffer.Nonce),
                        new NSString(iosProps.WithOffer.Signature),
                        NSNumber.FromDouble(iosProps.WithOffer.Timestamp),
                    },
                    new NSObject[]
                    {
                        new NSString("identifier"),
                        new NSString("keyIdentifier"),
                        new NSString("nonce"),
                        new NSString("signature"),
                        new NSString("timestamp"),
                    });

            NSDictionary? jws = iosProps.PromotionalOfferJws is null
                ? null
                : NSDictionary.FromObjectsAndKeys(
                    new NSObject[]
                    {
                        new NSString(iosProps.PromotionalOfferJws.OfferId),
                        new NSString(iosProps.PromotionalOfferJws.Jws),
                    },
                    new NSObject[]
                    {
                        new NSString("offerId"),
                        new NSString("jws"),
                    });

            NSNumber? introEligibility = iosProps.IntroductoryOfferEligibility is { } b
                ? NSNumber.FromBoolean(b)
                : null;
            string? winBackId = iosProps.WinBackOffer?.OfferId;

            _module.RequestSubscriptionExtended(
                iosProps.Sku,
                legacyOffer!,
                introEligibility!,
                jws!,
                winBackId!,
                (result, err) =>
                {
                    if (err is not null) { tcs.TrySetException(MapNSError(err)); return; }
                    var node = result is NSDictionary d ? NSObjectJsonBridge.DictToObject(d) : null;
                    if (node is null) { tcs.TrySetResult(null); return; }
                    var purchase = node.Deserialize<Purchase>(JsonOptions.Default);
                    tcs.TrySetResult(purchase is null ? null : new RequestPurchaseResultPurchase(purchase));
                });
            return tcs.Task;
        }

        tcs.TrySetException(OpenIapErrorMapper.Wrap(ErrorCode.DeveloperError, "RequestPurchaseProps must set requestPurchase or requestSubscription"));
        return tcs.Task;
    }

    public Task<string> FinishTransactionAsync(PurchaseInput purchase, bool? isConsumable = null)
    {
        var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        // PurchaseInput wraps a Purchase union; iOS only supports the iOS variant.
        if (purchase.Value is not PurchaseIOS p)
        {
            tcs.TrySetException(OpenIapErrorMapper.Wrap(ErrorCode.DeveloperError, "finishTransaction on iOS requires a PurchaseIOS"));
            return tcs.Task;
        }

        _module.FinishTransaction(
            p.Id,
            p.ProductId,
            isConsumable ?? false,
            err =>
            {
                if (err is not null) tcs.TrySetException(MapNSError(err));
                else tcs.TrySetResult(p.Id);
            });
        return tcs.Task;
    }

    public Task<string> RestorePurchasesAsync()
    {
        var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        _module.RestorePurchases(err =>
        {
            if (err is not null) tcs.TrySetException(MapNSError(err));
            else tcs.TrySetResult(string.Empty);
        });
        return tcs.Task;
    }

    public Task<string> DeepLinkToSubscriptionsAsync(DeepLinkOptions? options = null)
    {
        var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        _module.DeepLinkToSubscriptions(err =>
        {
            if (err is not null) tcs.TrySetException(MapNSError(err));
            else tcs.TrySetResult(string.Empty);
        });
        return tcs.Task;
    }

    public Task<VerifyPurchaseResult> ValidateReceiptAsync(VerifyPurchaseProps options) => VerifyPurchaseAsync(options);

    public Task<VerifyPurchaseResult> VerifyPurchaseAsync(VerifyPurchaseProps options)
    {
        var sku = options.Apple?.Sku
            ?? throw OpenIapErrorMapper.Wrap(ErrorCode.DeveloperError, "verifyPurchase on iOS requires options.apple.sku");
        var tcs = new TaskCompletionSource<VerifyPurchaseResult>(TaskCreationOptions.RunContinuationsAsynchronously);
        _module.VerifyPurchase(sku, (dict, err) =>
        {
            if (err is not null) { tcs.TrySetException(MapNSError(err)); return; }
            var node = NSObjectJsonBridge.DictToObject(dict);
            try
            {
                var typed = node?.Deserialize<VerifyPurchaseResultIOS>(JsonOptions.Default);
                if (typed is not null) tcs.TrySetResult(typed);
                else tcs.TrySetException(OpenIapErrorMapper.Wrap(ErrorCode.Unknown, "verifyPurchase returned no payload"));
            }
            catch (JsonException jx) { tcs.TrySetException(jx); }
        });
        return tcs.Task;
    }

    public Task<VerifyPurchaseWithProviderResult> VerifyPurchaseWithProviderAsync(VerifyPurchaseWithProviderProps options)
    {
        var providerEnum = options.Provider;
        var apiKey = options.Iapkit?.ApiKey;
        var jws = options.Iapkit?.Apple?.Jws;
        var tcs = new TaskCompletionSource<VerifyPurchaseWithProviderResult>(TaskCreationOptions.RunContinuationsAsynchronously);
        _module.VerifyPurchaseWithProvider(providerEnum.ToJson(), apiKey, jws, (dict, err) =>
        {
            if (err is not null) { tcs.TrySetException(MapNSError(err)); return; }
            var node = NSObjectJsonBridge.DictToObject(dict);
            try
            {
                var typed = node?.Deserialize<RequestVerifyPurchaseWithIapkitResult>(JsonOptions.Default);
                tcs.TrySetResult(new VerifyPurchaseWithProviderResult
                {
                    Provider = providerEnum,
                    Iapkit = typed,
                });
            }
            catch (JsonException jx) { tcs.TrySetException(jx); }
        });
        return tcs.Task;
    }

    // ---- iOS-only mutations --------------------------------------------

    public Task<string?> BeginRefundRequestIOSAsync(string sku) => InvokeNullableString(cb => _module.BeginRefundRequestIOS(sku, cb));
    public Task<bool> ClearTransactionIOSAsync() => InvokeBool(cb => _module.ClearTransactionIOS(cb));
    public Task<bool> PresentCodeRedemptionSheetIOSAsync() => InvokeBool(cb => _module.PresentCodeRedemptionSheetIOS(cb));

    public Task<ExternalPurchaseLinkResultIOS> PresentExternalPurchaseLinkIOSAsync(string url)
    {
        if (!OperatingSystem.IsIOSVersionAtLeast(16, 0) && !OperatingSystem.IsMacCatalystVersionAtLeast(16, 0))
            return NotSupportedIOSVersion<ExternalPurchaseLinkResultIOS>("presentExternalPurchaseLinkIOS", "iOS 16+");
        return InvokeDict<ExternalPurchaseLinkResultIOS>(cb => _module.PresentExternalPurchaseLinkIOS(url, cb), required: true)!;
    }

    public Task<ExternalPurchaseNoticeResultIOS> PresentExternalPurchaseNoticeSheetIOSAsync()
    {
        if (!OperatingSystem.IsIOSVersionAtLeast(17, 4) && !OperatingSystem.IsMacCatalystVersionAtLeast(17, 4))
            return NotSupportedIOSVersion<ExternalPurchaseNoticeResultIOS>("presentExternalPurchaseNoticeSheetIOS", "iOS 17.4+");
        return InvokeDict<ExternalPurchaseNoticeResultIOS>(cb => _module.PresentExternalPurchaseNoticeSheetIOS(cb), required: true)!;
    }

    public Task<bool> RequestPurchaseOnPromotedProductIOSAsync() => InvokeBool(cb => _module.RequestPurchaseOnPromotedProductIOS(cb));

    public Task<ExternalPurchaseCustomLinkNoticeResultIOS> ShowExternalPurchaseCustomLinkNoticeIOSAsync(ExternalPurchaseCustomLinkNoticeTypeIOS noticeType)
    {
        if (!OperatingSystem.IsIOSVersionAtLeast(18, 1) && !OperatingSystem.IsMacCatalystVersionAtLeast(18, 1))
            return NotSupportedIOSVersion<ExternalPurchaseCustomLinkNoticeResultIOS>("showExternalPurchaseCustomLinkNoticeIOS", "iOS 18.1+");
        return InvokeDict<ExternalPurchaseCustomLinkNoticeResultIOS>(cb => _module.ShowExternalPurchaseCustomLinkNoticeIOS(noticeType.ToJson(), cb), required: true)!;
    }

    public Task<IReadOnlyList<PurchaseIOS>> ShowManageSubscriptionsIOSAsync() => InvokeArray<PurchaseIOS>(cb => _module.ShowManageSubscriptionsIOS(cb));

    public Task<bool> SyncIOSAsync() => InvokeBool(cb => _module.SyncIOS(cb));

    // ---- Android-only mutations (return defaults / throw on iOS) -------

    public Task<bool> AcknowledgePurchaseAndroidAsync(string purchaseToken) => NotSupportedAndroid<bool>("acknowledgePurchaseAndroid");
    public Task<bool> ConsumePurchaseAndroidAsync(string purchaseToken) => NotSupportedAndroid<bool>("consumePurchaseAndroid");
    public Task<bool> CheckAlternativeBillingAvailabilityAndroidAsync() => Task.FromResult(false);
    public Task<string?> CreateAlternativeBillingTokenAndroidAsync() => Task.FromResult<string?>(null);
    public Task<bool> ShowAlternativeBillingDialogAndroidAsync() => Task.FromResult(false);
    public Task<BillingProgramAvailabilityResultAndroid> IsBillingProgramAvailableAndroidAsync(BillingProgramAndroid program) => NotSupportedAndroid<BillingProgramAvailabilityResultAndroid>("isBillingProgramAvailableAndroid");
    public Task<BillingProgramReportingDetailsAndroid> CreateBillingProgramReportingDetailsAndroidAsync(BillingProgramAndroid program) => NotSupportedAndroid<BillingProgramReportingDetailsAndroid>("createBillingProgramReportingDetailsAndroid");
    public Task<bool> LaunchExternalLinkAndroidAsync(LaunchExternalLinkParamsAndroid @params) => Task.FromResult(false);

    // ====================================================================
    // QueryResolver
    // ====================================================================

    public Task<FetchProductsResult> FetchProductsAsync(ProductRequest @params)
    {
        var tcs = new TaskCompletionSource<FetchProductsResult>(TaskCreationOptions.RunContinuationsAsynchronously);
        _module.FetchProducts(@params.Skus.ToArray(), @params.Type?.ToJson(), (arr, err) =>
        {
            if (err is not null) { tcs.TrySetException(MapNSError(err)); return; }
            var array = NSObjectJsonBridge.ArrayToArray(NSArray.FromNSObjects(arr ?? Array.Empty<NSObject>()));
            try
            {
                // The bridge always returns a [Product] list — for `subs` query, ProductSubscriptionIOS;
                // for `inApp`, ProductIOS; for `all`, a mix. Use the request's type to pick the result variant.
                FetchProductsResult result = @params.Type switch
                {
                    ProductQueryType.Subs => new FetchProductsResultSubscriptions(DeserializeArray<ProductSubscription>(array)),
                    ProductQueryType.InApp => new FetchProductsResultProducts(DeserializeArray<Product>(array)),
                    _ => new FetchProductsResultAll(DeserializeArray<ProductOrSubscription>(array)),
                };
                tcs.TrySetResult(result);
            }
            catch (JsonException jx) { tcs.TrySetException(jx); }
        });
        return tcs.Task;
    }

    public Task<IReadOnlyList<Purchase>> GetAvailablePurchasesAsync(PurchaseOptions? options = null)
        => InvokeArray<Purchase>(cb => _module.GetAvailablePurchases(cb));

    public Task<IReadOnlyList<ActiveSubscription>> GetActiveSubscriptionsAsync(IReadOnlyList<string>? subscriptionIds = null)
        => InvokeArray<ActiveSubscription>(cb => _module.GetActiveSubscriptions(cb))
            .ContinueWith(t =>
            {
                if (subscriptionIds is null || subscriptionIds.Count == 0) return t.Result;
                var filter = new HashSet<string>(subscriptionIds);
                return (IReadOnlyList<ActiveSubscription>)t.Result.Where(a => filter.Contains(a.ProductId)).ToList();
            }, TaskContinuationOptions.OnlyOnRanToCompletion);

    public Task<bool> HasActiveSubscriptionsAsync(IReadOnlyList<string>? subscriptionIds = null)
        => InvokeBool(cb => _module.HasActiveSubscriptions(cb));

    public Task<string> GetStorefrontAsync()
        => InvokeNullableString(cb => _module.GetStorefrontIOS(cb))
            .ContinueWith(t => t.Result ?? string.Empty, TaskContinuationOptions.OnlyOnRanToCompletion);

    public Task<bool> CanPresentExternalPurchaseNoticeIOSAsync()
    {
        if (!OperatingSystem.IsIOSVersionAtLeast(17, 4) && !OperatingSystem.IsMacCatalystVersionAtLeast(17, 4))
            return Task.FromResult(false);
        return InvokeBool(cb => _module.CanPresentExternalPurchaseNoticeIOS(cb));
    }

    public Task<PurchaseIOS?> CurrentEntitlementIOSAsync(string sku) => InvokeDict<PurchaseIOS>(cb => _module.CurrentEntitlementIOS(sku, cb));
    public Task<IReadOnlyList<PurchaseIOS>> GetAllTransactionsIOSAsync() => InvokeArray<PurchaseIOS>(cb => _module.GetAllTransactionsIOS(cb));

    public Task<AppTransaction?> GetAppTransactionIOSAsync()
    {
        if (!OperatingSystem.IsIOSVersionAtLeast(16, 0) && !OperatingSystem.IsMacCatalystVersionAtLeast(16, 0))
            return Task.FromResult<AppTransaction?>(null);
        return InvokeDict<AppTransaction>(cb => _module.GetAppTransactionIOS(cb));
    }

    public Task<ExternalPurchaseCustomLinkTokenResultIOS> GetExternalPurchaseCustomLinkTokenIOSAsync(ExternalPurchaseCustomLinkTokenTypeIOS tokenType)
    {
        if (!OperatingSystem.IsIOSVersionAtLeast(18, 1) && !OperatingSystem.IsMacCatalystVersionAtLeast(18, 1))
            return NotSupportedIOSVersion<ExternalPurchaseCustomLinkTokenResultIOS>("getExternalPurchaseCustomLinkTokenIOS", "iOS 18.1+");
        return InvokeDict<ExternalPurchaseCustomLinkTokenResultIOS>(cb => _module.GetExternalPurchaseCustomLinkTokenIOS(tokenType.ToJson(), cb), required: true)!;
    }

    public Task<IReadOnlyList<PurchaseIOS>> GetPendingTransactionsIOSAsync() => InvokeArray<PurchaseIOS>(cb => _module.GetPendingTransactionsIOS(cb));
    public Task<ProductIOS?> GetPromotedProductIOSAsync() => InvokeDict<ProductIOS>(cb => _module.GetPromotedProductIOS(cb));
    public Task<string?> GetReceiptDataIOSAsync() => InvokeNullableString(cb => _module.GetReceiptDataIOS(cb));
    public Task<string> GetStorefrontIOSAsync() => GetStorefrontAsync();
    public Task<string?> GetTransactionJwsIOSAsync(string sku) => InvokeNullableString(cb => _module.GetTransactionJwsIOS(sku, cb));

    public Task<bool> IsEligibleForExternalPurchaseCustomLinkIOSAsync()
    {
        if (!OperatingSystem.IsIOSVersionAtLeast(18, 1) && !OperatingSystem.IsMacCatalystVersionAtLeast(18, 1))
            return Task.FromResult(false);
        return InvokeBool(cb => _module.IsEligibleForExternalPurchaseCustomLinkIOS(cb));
    }
    public Task<bool> IsEligibleForIntroOfferIOSAsync(string groupId) => InvokeBool(cb => _module.IsEligibleForIntroOfferIOS(groupId, cb));
    public Task<bool> IsTransactionVerifiedIOSAsync(string sku) => InvokeBool(cb => _module.IsTransactionVerifiedIOS(sku, cb));
    public Task<PurchaseIOS?> LatestTransactionIOSAsync(string sku) => InvokeDict<PurchaseIOS>(cb => _module.LatestTransactionIOS(sku, cb));
    public Task<IReadOnlyList<SubscriptionStatusIOS>> SubscriptionStatusIOSAsync(string sku) => InvokeArray<SubscriptionStatusIOS>(cb => _module.SubscriptionStatusIOS(sku, cb));

    public Task<VerifyPurchaseResultIOS> ValidateReceiptIOSAsync(VerifyPurchaseProps options)
        => VerifyPurchaseAsync(options).ContinueWith(t => (VerifyPurchaseResultIOS)t.Result, TaskContinuationOptions.OnlyOnRanToCompletion);

    // ====================================================================
    // Helpers
    // ====================================================================

    private static Task<T> NotSupportedAndroid<T>(string api)
        => Task.FromException<T>(OpenIapErrorMapper.Wrap(ErrorCode.FeatureNotSupported, $"{api} is Android-only"));

    private static Task<T> NotSupportedIOSVersion<T>(string api, string requiredVersion)
        => Task.FromException<T>(OpenIapErrorMapper.Wrap(ErrorCode.FeatureNotSupported, $"{api} requires {requiredVersion}"));

    private static void Complete(TaskCompletionSource<bool> tcs, bool ok, NSError? err)
    {
        if (err is not null) tcs.TrySetException(MapNSError(err));
        else tcs.TrySetResult(ok);
    }

    private static OpenIapException MapNSError(NSError err)
    {
        var code = err.Domain == "OpenIAP" ? err.LocalizedDescription : err.LocalizedDescription;
        return OpenIapErrorMapper.Wrap(ErrorCode.Unknown, code ?? err.Domain ?? "iOS error");
    }

    private static string? ProductTypeWireString(ProductQueryType type)
        => type == ProductQueryType.Subs ? "subs" : type == ProductQueryType.InApp ? "in-app" : null;

    private Task<bool> InvokeBool(Action<Action<bool, NSError?>> dispatch)
    {
        var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        dispatch((ok, err) =>
        {
            if (err is not null) tcs.TrySetException(MapNSError(err));
            else tcs.TrySetResult(ok);
        });
        return tcs.Task;
    }

    private Task<string?> InvokeNullableString(Action<Action<string?, NSError?>> dispatch)
    {
        var tcs = new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously);
        dispatch((s, err) =>
        {
            if (err is not null) tcs.TrySetException(MapNSError(err));
            else tcs.TrySetResult(s);
        });
        return tcs.Task;
    }

    private Task<IReadOnlyList<T>> InvokeArray<T>(Action<Action<NSArray?, NSError?>> dispatch)
    {
        var tcs = new TaskCompletionSource<IReadOnlyList<T>>(TaskCreationOptions.RunContinuationsAsynchronously);
        dispatch((arr, err) =>
        {
            if (err is not null) { tcs.TrySetException(MapNSError(err)); return; }
            var node = NSObjectJsonBridge.ArrayToArray(arr);
            tcs.TrySetResult(DeserializeArray<T>(node) ?? new List<T>());
        });
        return tcs.Task;
    }

    // Dispatch an Action&lt;NSObject?, NSError?&gt; style completion that returns
    // either an NSDictionary (typed result) or null. Returns a Task&lt;T?&gt;.
    // When `required` is true, a missing payload yields an OpenIapException
    // (used by APIs whose contract guarantees a non-null result).
    private Task<T?> InvokeDict<T>(Action<Action<NSObject?, NSError?>> dispatch, bool required = false) where T : class
    {
        var tcs = new TaskCompletionSource<T?>(TaskCreationOptions.RunContinuationsAsynchronously);
        dispatch((obj, err) =>
        {
            if (err is not null) { tcs.TrySetException(MapNSError(err)); return; }
            if (obj is not NSDictionary dict)
            {
                if (required) tcs.TrySetException(OpenIapErrorMapper.Wrap(ErrorCode.Unknown, $"Expected NSDictionary for {typeof(T).Name}"));
                else tcs.TrySetResult(null);
                return;
            }
            var node = NSObjectJsonBridge.DictToObject(dict);
            try
            {
                var typed = node?.Deserialize<T>(JsonOptions.Default);
                tcs.TrySetResult(typed);
            }
            catch (JsonException jx) { tcs.TrySetException(jx); }
        });
        return tcs.Task;
    }

    private static List<T>? DeserializeArray<T>(JsonArray? array)
    {
        if (array is null) return null;
        var list = new List<T>(array.Count);
        foreach (var node in array)
        {
            if (node is null) continue;
            try
            {
                var typed = node.Deserialize<T>(JsonOptions.Default);
                if (typed is not null) list.Add(typed);
            }
            catch (JsonException) { /* skip malformed item */ }
        }
        return list;
    }
}
