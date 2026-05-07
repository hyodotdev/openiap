// iOS resolver — bridges typed C# input/output records to the
// `OpenIapModule` Objective-C facade exposed by `OpenIAP.xcframework`. The
// ObjC bridge accepts/returns NSDictionary; we deserialize via System.Text.Json
// using the [JsonPolymorphic] discriminator already in the generated records.

#nullable enable

using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Runtime.Versioning;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using Foundation;
using Hyo.OpenIap;
using Hyo.OpenIap.Maui.Bindings.iOS;

namespace Hyo.OpenIap.Maui.Platforms.iOS;

// Class is constructed only under #if IOS / MACCATALYST and the project's
// SupportedOSPlatformVersion is 15.0 — declare that floor explicitly so the
// CA1416 analyzer doesn't flag iOS 13/15-baseline binding calls.
//
// Methods that call iOS 16+ / 17.4+ / 18.1+ binding APIs each guard with
// OperatingSystem.IsIOSVersionAtLeast(...) at entry (e.g. PresentExternalPurchaseLinkIOSAsync,
// GetAppTransactionIOSAsync). The CA1416 analyzer cannot see through the
// `cb => _module.Foo(cb)` lambda-callback shape, so the guard is correct at
// runtime but the analyzer still warns — narrow the suppression to this class.
[SupportedOSPlatform("ios15.0")]
[SupportedOSPlatform("maccatalyst15.0")]
[SuppressMessage(
    "Interoperability",
    "CA1416",
    Justification = "Each iOS-16+/17.4+/18.1+ entry method has an explicit OperatingSystem.IsIOSVersionAtLeast guard; CA1416 cannot follow the binding's lambda-callback pattern through to those guards.")]
internal class OpenIapIOS : IOpenIap, QueryResolver, MutationResolver, IDisposable
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
    private readonly Action<NSDictionary> _purchaseUpdatedCallback;
    private readonly Action<NSDictionary> _purchaseErrorCallback;
    private readonly Action<NSString?> _promotedProductCallback;
    private readonly Action<NSDictionary> _billingIssueCallback;
    private readonly object _listenerLock = new();
    private bool _disposed;

    public OpenIapIOS()
    {
        _purchaseUpdatedCallback = dict =>
        {
            try
            {
                var node = NSObjectJsonBridge.DictToObject(dict);
                if (node is null) return;
                var p = node.Deserialize<Purchase>(JsonOptions.Default);
                if (p is not null) _purchaseUpdated.OnNext(p);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[OpenIapIOS] purchaseUpdated listener failed: {ex.Message}");
            }
        };

        _purchaseErrorCallback = dict =>
        {
            try
            {
                var node = NSObjectJsonBridge.DictToObject(dict);
                var err = OpenIapErrorMapper.FromJson(node?.ToJsonString() ?? string.Empty);
                _purchaseError.OnNext(err);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[OpenIapIOS] purchaseError listener failed: {ex.Message}");
            }
        };

        _promotedProductCallback = sku =>
        {
            try
            {
                if (sku is not null) _promotedProductIOS.OnNext((string)sku);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[OpenIapIOS] promotedProduct listener failed: {ex.Message}");
            }
        };

        _billingIssueCallback = dict =>
        {
            try
            {
                var node = NSObjectJsonBridge.DictToObject(dict);
                if (node is null) return;
                var p = node.Deserialize<Purchase>(JsonOptions.Default);
                if (p is not null) _subscriptionBillingIssue.OnNext(p);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[OpenIapIOS] billingIssue listener failed: {ex.Message}");
            }
        };

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
        lock (_listenerLock)
        {
            if (_disposed) throw new ObjectDisposedException(nameof(OpenIapIOS));
            if (_purchaseUpdatedToken is not null) return;

            // Each listener body is wrapped in catch (Exception) so a managed
            // exception thrown from a Swift block trampoline (libdispatch worker)
            // can never escape into mono's native unwind path — that path has no
            // managed handler and aborts the process with SIGABRT.
            _purchaseUpdatedToken = _module.AddPurchaseUpdatedListener(_purchaseUpdatedCallback);
            _purchaseErrorToken = _module.AddPurchaseErrorListener(_purchaseErrorCallback);
            _promotedProductToken = _module.AddPromotedProductListener(_promotedProductCallback);
            _billingIssueToken = _module.AddSubscriptionBillingIssueListener(_billingIssueCallback);
        }
    }

    public void Dispose()
    {
        NSObject? purchaseUpdatedToken;
        NSObject? purchaseErrorToken;
        NSObject? promotedProductToken;
        NSObject? billingIssueToken;

        lock (_listenerLock)
        {
            if (_disposed) return;
            _disposed = true;

            purchaseUpdatedToken = _purchaseUpdatedToken;
            purchaseErrorToken = _purchaseErrorToken;
            promotedProductToken = _promotedProductToken;
            billingIssueToken = _billingIssueToken;

            _purchaseUpdatedToken = null;
            _purchaseErrorToken = null;
            _promotedProductToken = null;
            _billingIssueToken = null;
        }

        RemoveListener(purchaseUpdatedToken, nameof(_purchaseUpdatedToken));
        RemoveListener(purchaseErrorToken, nameof(_purchaseErrorToken));
        RemoveListener(promotedProductToken, nameof(_promotedProductToken));
        RemoveListener(billingIssueToken, nameof(_billingIssueToken));
        GC.SuppressFinalize(this);
    }

    private void RemoveListener(NSObject? token, string name)
    {
        if (token is null) return;
        try
        {
            _module.RemoveListener(token);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[OpenIapIOS] failed to remove {name}: {ex.Message}");
        }
        finally
        {
            token.Dispose();
        }
    }

    // ====================================================================
    // MutationResolver
    // ====================================================================

    public Task<bool> InitConnectionAsync(InitConnectionConfig? config = null)
    {
        // The ObjC bridge has no config arg; iOS doesn't use the Android-only
        // billing-program/alternative-billing fields anyway.
        var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        Console.WriteLine("[OpenIapIOS] InitConnectionAsync dispatch");
        _module.InitConnection((ok, err) =>
        {
            Console.WriteLine($"[OpenIapIOS] InitConnectionAsync callback: ok={ok}, err={err?.LocalizedDescription ?? "nil"}");
            Complete(tcs, ok, err);
        });
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
                    try
                    {
                        if (err is not null) { tcs.TrySetException(MapNSError(err)); return; }
                        var node = result is NSDictionary d ? NSObjectJsonBridge.DictToObject(d) : null;
                        if (node is null) { tcs.TrySetResult(null); return; }
                        var purchase = node.Deserialize<Purchase>(JsonOptions.Default);
                        tcs.TrySetResult(purchase is null ? null : new RequestPurchaseResultPurchase(purchase));
                    }
                    catch (Exception ex) { tcs.TrySetException(ex); }
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
                    try
                    {
                        if (err is not null) { tcs.TrySetException(MapNSError(err)); return; }
                        var node = result is NSDictionary d ? NSObjectJsonBridge.DictToObject(d) : null;
                        if (node is null) { tcs.TrySetResult(null); return; }
                        var purchase = node.Deserialize<Purchase>(JsonOptions.Default);
                        tcs.TrySetResult(purchase is null ? null : new RequestPurchaseResultPurchase(purchase));
                    }
                    catch (Exception ex) { tcs.TrySetException(ex); }
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

        Console.WriteLine($"[OpenIapIOS] FinishTransactionAsync dispatch: id={p.Id}, productId={p.ProductId}, consumable={isConsumable ?? false}");
        _module.FinishTransaction(
            p.Id,
            p.ProductId,
            isConsumable ?? false,
            err =>
            {
                try
                {
                    Console.WriteLine($"[OpenIapIOS] FinishTransactionAsync callback: id={p.Id}, err={err?.LocalizedDescription ?? "nil"}");
                    if (err is not null) tcs.TrySetException(MapNSError(err));
                    else tcs.TrySetResult(p.Id);
                }
                catch (Exception ex) { tcs.TrySetException(ex); }
            });
        return tcs.Task;
    }

    public Task<string> RestorePurchasesAsync()
    {
        var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        _module.RestorePurchases(err =>
        {
            try
            {
                if (err is not null) tcs.TrySetException(MapNSError(err));
                else tcs.TrySetResult(string.Empty);
            }
            catch (Exception ex) { tcs.TrySetException(ex); }
        });
        return tcs.Task;
    }

    public Task<string> DeepLinkToSubscriptionsAsync(DeepLinkOptions? options = null)
    {
        var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        _module.DeepLinkToSubscriptions(err =>
        {
            try
            {
                if (err is not null) tcs.TrySetException(MapNSError(err));
                else tcs.TrySetResult(string.Empty);
            }
            catch (Exception ex) { tcs.TrySetException(ex); }
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
            try
            {
                if (err is not null) { tcs.TrySetException(MapNSError(err)); return; }
                var node = NSObjectJsonBridge.DictToObject(dict);
                var typed = node?.Deserialize<VerifyPurchaseResultIOS>(JsonOptions.Default);
                if (typed is not null) tcs.TrySetResult(typed);
                else tcs.TrySetException(OpenIapErrorMapper.Wrap(ErrorCode.Unknown, "verifyPurchase returned no payload"));
            }
            catch (Exception ex) { tcs.TrySetException(ex); }
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
            try
            {
                if (err is not null) { tcs.TrySetException(MapNSError(err)); return; }
                var node = NSObjectJsonBridge.DictToObject(dict);
                var typed = node?.Deserialize<RequestVerifyPurchaseWithIapkitResult>(JsonOptions.Default);
                tcs.TrySetResult(new VerifyPurchaseWithProviderResult
                {
                    Provider = providerEnum,
                    Iapkit = typed,
                });
            }
            catch (Exception ex) { tcs.TrySetException(ex); }
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
        Console.WriteLine($"[OpenIapIOS] FetchProductsAsync dispatch: skus={@params.Skus.Count}, type={@params.Type?.ToJson() ?? "null"}");
        _module.FetchProducts(@params.Skus.ToArray(), @params.Type?.ToJson(), (arr, err) =>
        {
            try
            {
                Console.WriteLine($"[OpenIapIOS] FetchProductsAsync callback: arr.count={arr?.Count ?? 0}, err={err?.LocalizedDescription ?? "nil"}");
                if (err is not null) { tcs.TrySetException(MapNSError(err)); return; }
                var array = NSObjectJsonBridge.ArrayToArray(arr);
                if (array is not null)
                {
                    for (int i = 0; i < array.Count; i++)
                    {
                        var item = array[i];
                        var id = item is JsonObject obj ? obj["id"]?.ToString() : "?";
                        var typename = item is JsonObject t ? t["__typename"]?.ToString() : "?";
                        Console.WriteLine($"[OpenIapIOS]   item[{i}]: id={id} __typename={typename}");
                    }
                }
                // The Swift bridge tags every encoded dict with `__typename` (the
                // leaf type name) so polymorphic deserialization picks the right
                // concrete record at any abstract ancestor in the union chain.
                FetchProductsResult result = @params.Type switch
                {
                    ProductQueryType.Subs => new FetchProductsResultSubscriptions(DeserializeArray<ProductSubscription>(array)),
                    ProductQueryType.InApp => new FetchProductsResultProducts(DeserializeArray<Product>(array)),
                    _ => new FetchProductsResultAll(DeserializeArray<ProductOrSubscription>(array)),
                };
                int count = result switch
                {
                    FetchProductsResultProducts r => r.Value?.Count ?? 0,
                    FetchProductsResultSubscriptions s => s.Value?.Count ?? 0,
                    FetchProductsResultAll a => a.Value?.Count ?? 0,
                    _ => -1,
                };
                Console.WriteLine($"[OpenIapIOS] FetchProductsAsync deserialized → {result.GetType().Name} ({count} items)");
                tcs.TrySetResult(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[OpenIapIOS] FetchProductsAsync callback threw: {ex}");
                tcs.TrySetException(ex);
            }
        });
        return tcs.Task;
    }

    public Task<IReadOnlyList<Purchase>> GetAvailablePurchasesAsync(PurchaseOptions? options = null)
        => InvokeArray<Purchase>(cb => _module.GetAvailablePurchasesWithOptions(ToPurchaseOptionsDictionary(options), cb));

    public async Task<IReadOnlyList<ActiveSubscription>> GetActiveSubscriptionsAsync(IReadOnlyList<string>? subscriptionIds = null)
    {
        var result = await InvokeArray<ActiveSubscription>(cb => _module.GetActiveSubscriptions(cb));
        if (subscriptionIds is null || subscriptionIds.Count == 0) return result;
        var filter = new HashSet<string>(subscriptionIds);
        return result.Where(a => filter.Contains(a.ProductId)).ToList();
    }

    public Task<bool> HasActiveSubscriptionsAsync(IReadOnlyList<string>? subscriptionIds = null)
        => InvokeBool(cb => _module.HasActiveSubscriptions(cb));

    public async Task<string> GetStorefrontAsync()
    {
        var storefront = await InvokeNullableString(cb => _module.GetStorefrontIOS(cb));
        return storefront ?? string.Empty;
    }

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

    public async Task<VerifyPurchaseResultIOS> ValidateReceiptIOSAsync(VerifyPurchaseProps options)
        => (VerifyPurchaseResultIOS)await VerifyPurchaseAsync(options);

    // ====================================================================
    // Helpers
    // ====================================================================

    private static Task<T> NotSupportedAndroid<T>(string api)
        => Task.FromException<T>(OpenIapErrorMapper.Wrap(ErrorCode.FeatureNotSupported, $"{api} is Android-only"));

    private static Task<T> NotSupportedIOSVersion<T>(string api, string requiredVersion)
        => Task.FromException<T>(OpenIapErrorMapper.Wrap(ErrorCode.FeatureNotSupported, $"{api} requires {requiredVersion}"));

    private static void Complete(TaskCompletionSource<bool> tcs, bool ok, NSError? err)
    {
        try
        {
            if (err is not null) tcs.TrySetException(MapNSError(err));
            else tcs.TrySetResult(ok);
        }
        catch (Exception ex) { tcs.TrySetException(ex); }
    }

    private static OpenIapException MapNSError(NSError err)
    {
        var message = GetNSErrorString(err, "message")
            ?? err.LocalizedDescription
            ?? err.Domain
            ?? "iOS error";
        var code = GetNSErrorString(err, "code");
        var productId = GetNSErrorString(err, "productId");
        var debugMessage = GetNSErrorString(err, "debugMessage");

        if (!string.IsNullOrWhiteSpace(code))
            return OpenIapErrorMapper.Wrap(code, message, productId, debugMessage);

        return err.Domain == "OpenIAP"
            ? OpenIapErrorMapper.Wrap(message, message, productId, debugMessage)
            : OpenIapErrorMapper.Wrap(ErrorCode.Unknown, message, productId, debugMessage);
    }

    private static string? GetNSErrorString(NSError err, string key)
    {
        using var nsKey = new NSString(key);
        return err.UserInfo?.ObjectForKey(nsKey)?.ToString();
    }

    private static string? ProductTypeWireString(ProductQueryType type)
        => type == ProductQueryType.Subs ? "subs" : type == ProductQueryType.InApp ? "in-app" : null;

    private static NSDictionary ToPurchaseOptionsDictionary(PurchaseOptions? options)
    {
        var alsoPublish = options?.AlsoPublishToEventListenerIOS ?? false;
        var includeSuspended = options?.IncludeSuspendedAndroid ?? false;
        var onlyActive = options?.OnlyIncludeActiveItemsIOS ?? true;

        return NSDictionary.FromObjectsAndKeys(
            new NSObject[]
            {
                NSNumber.FromBoolean(alsoPublish),
                NSNumber.FromBoolean(includeSuspended),
                NSNumber.FromBoolean(onlyActive),
            },
            new NSObject[]
            {
                new NSString("alsoPublishToEventListenerIOS"),
                new NSString("includeSuspendedAndroid"),
                new NSString("onlyIncludeActiveItemsIOS"),
            });
    }

    // Every Invoke* helper wraps its callback body in catch (Exception) so a
    // managed exception thrown on the libdispatch worker that runs the Swift
    // block trampoline cannot escape into mono's native unwind path.
    private Task<bool> InvokeBool(Action<Action<bool, NSError?>> dispatch)
    {
        var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        dispatch((ok, err) =>
        {
            try
            {
                if (err is not null) tcs.TrySetException(MapNSError(err));
                else tcs.TrySetResult(ok);
            }
            catch (Exception ex) { tcs.TrySetException(ex); }
        });
        return tcs.Task;
    }

    private Task<string?> InvokeNullableString(Action<Action<string?, NSError?>> dispatch)
    {
        var tcs = new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously);
        dispatch((s, err) =>
        {
            try
            {
                if (err is not null) tcs.TrySetException(MapNSError(err));
                else tcs.TrySetResult(s);
            }
            catch (Exception ex) { tcs.TrySetException(ex); }
        });
        return tcs.Task;
    }

    private Task<IReadOnlyList<T>> InvokeArray<T>(Action<Action<NSArray?, NSError?>> dispatch)
    {
        var tcs = new TaskCompletionSource<IReadOnlyList<T>>(TaskCreationOptions.RunContinuationsAsynchronously);
        Console.WriteLine($"[OpenIapIOS] InvokeArray<{typeof(T).Name}> dispatch");
        dispatch((arr, err) =>
        {
            try
            {
                Console.WriteLine($"[OpenIapIOS] InvokeArray<{typeof(T).Name}> callback: arr.count={arr?.Count ?? 0}, err={err?.LocalizedDescription ?? "nil"}");
                if (err is not null) { tcs.TrySetException(MapNSError(err)); return; }
                var node = NSObjectJsonBridge.ArrayToArray(arr);
                var list = DeserializeArray<T>(node) ?? new List<T>();
                Console.WriteLine($"[OpenIapIOS] InvokeArray<{typeof(T).Name}> deserialized {list.Count} items");
                tcs.TrySetResult(list);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[OpenIapIOS] InvokeArray<{typeof(T).Name}> threw: {ex}");
                tcs.TrySetException(ex);
            }
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
            try
            {
                if (err is not null) { tcs.TrySetException(MapNSError(err)); return; }
                if (obj is not NSDictionary dict)
                {
                    if (required) tcs.TrySetException(OpenIapErrorMapper.Wrap(ErrorCode.Unknown, $"Expected NSDictionary for {typeof(T).Name}"));
                    else tcs.TrySetResult(null);
                    return;
                }
                var node = NSObjectJsonBridge.DictToObject(dict);
                var typed = node?.Deserialize<T>(JsonOptions.Default);
                tcs.TrySetResult(typed);
            }
            catch (Exception ex) { tcs.TrySetException(ex); }
        });
        return tcs.Task;
    }

    private static List<T>? DeserializeArray<T>(JsonArray? array)
    {
        if (array is null) return null;
        var list = new List<T>(array.Count);
        int idx = 0;
        foreach (var node in array)
        {
            if (node is null) { idx++; continue; }
            try
            {
                var typed = node.Deserialize<T>(JsonOptions.Default);
                if (typed is not null) list.Add(typed);
                else Console.WriteLine($"[OpenIapIOS] DeserializeArray<{typeof(T).Name}>[{idx}] returned null");
            }
            // STJ raises JsonException for missing/unknown discriminators and
            // NotSupportedException when an abstract type can't be constructed.
            // Either way the safe action is to drop the malformed item.
            catch (Exception ex)
            {
                Console.WriteLine($"[OpenIapIOS] DeserializeArray<{typeof(T).Name}>[{idx}] failed: {ex.GetType().Name}: {ex.Message}");
            }
            idx++;
        }
        return list;
    }
}
