// Android resolver — delegates every QueryResolver / MutationResolver call to
// the OpenIapMauiShim Java/Kotlin facade in `packages/google` (which itself
// wraps `OpenIapModule`). All inputs are JSON-encoded via the same
// JsonOptions used elsewhere; outputs are JSON-decoded to typed records.
//
// iOS-only methods (suffix `IOS`) throw OpenIapException with
// FeatureNotSupported — they never reach this class through normal use, but
// the C# interface contract requires them to be implemented.

#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Hyo.OpenIap;
// The AAR binding emits `Dev.Hyo.Openiap.Maui.OpenIapMauiShim` from the
// Java package dev.hyo.openiap.maui — alias for ergonomics.
using OpenIapMauiShim = global::Dev.Hyo.Openiap.Maui.OpenIapMauiShim;

namespace Hyo.OpenIap.Maui.Platforms.Android;

internal sealed partial class OpenIapAndroid : IOpenIap, QueryResolver, MutationResolver
{
    private readonly OpenIapMauiShim _shim;
    private readonly Subject<Purchase> _purchaseUpdated = new();
    private readonly Subject<PurchaseError> _purchaseError = new();
    private readonly Subject<string> _promotedProductIOS = new();
    private readonly Subject<Purchase> _subscriptionBillingIssue = new();
    private readonly Subject<UserChoiceBillingDetails> _userChoiceBillingAndroid = new();
    private readonly Subject<DeveloperProvidedBillingDetailsAndroid> _developerProvidedBillingAndroid = new();

    public OpenIapAndroid()
    {
        var ctx = global::Android.App.Application.Context
            ?? throw new InvalidOperationException("Android.App.Application.Context is null; OpenIapAndroid requires an initialised app context.");
        _shim = new OpenIapMauiShim(ctx);
        WireListeners();
    }

    /// <summary>
    /// Host MAUI app should forward Activity lifecycle events here; the
    /// Activity is required for purchase flow + external link launches.
    /// </summary>
    public void SetActivity(global::Android.App.Activity? activity) => _shim.SetActivity(activity);

    public IObservable<Purchase> PurchaseUpdated => _purchaseUpdated;
    public IObservable<PurchaseError> PurchaseError => _purchaseError;
    public IObservable<string> PromotedProductIOS => _promotedProductIOS;
    public IObservable<Purchase> SubscriptionBillingIssue => _subscriptionBillingIssue;
    public IObservable<UserChoiceBillingDetails> UserChoiceBillingAndroid => _userChoiceBillingAndroid;
    public IObservable<DeveloperProvidedBillingDetailsAndroid> DeveloperProvidedBillingAndroid => _developerProvidedBillingAndroid;

    private void WireListeners()
    {
        _shim.AddPurchaseUpdatedListener(new EventBridge(json =>
        {
            try
            {
                var purchase = JsonSerializer.Deserialize<Purchase>(json, JsonOptions.Default);
                if (purchase is not null) _purchaseUpdated.OnNext(purchase);
            }
            catch (JsonException) { /* malformed payload — ignore */ }
        }));

        _shim.AddPurchaseErrorListener(new EventBridge(json =>
        {
            _purchaseError.OnNext(OpenIapErrorMapper.FromJson(json));
        }));

        _shim.AddSubscriptionBillingIssueListener(new EventBridge(json =>
        {
            try
            {
                var purchase = JsonSerializer.Deserialize<Purchase>(json, JsonOptions.Default);
                if (purchase is not null) _subscriptionBillingIssue.OnNext(purchase);
            }
            catch (JsonException) { }
        }));

        _shim.AddUserChoiceBillingAndroidListener(new EventBridge(json =>
        {
            try
            {
                var details = JsonSerializer.Deserialize<UserChoiceBillingDetails>(json, JsonOptions.Default);
                if (details is not null) _userChoiceBillingAndroid.OnNext(details);
            }
            catch (JsonException) { }
        }));

        _shim.AddDeveloperProvidedBillingAndroidListener(new EventBridge(json =>
        {
            try
            {
                var details = JsonSerializer.Deserialize<DeveloperProvidedBillingDetailsAndroid>(json, JsonOptions.Default);
                if (details is not null) _developerProvidedBillingAndroid.OnNext(details);
            }
            catch (JsonException) { }
        }));
    }

    // -------------------------------------------------------------------
    // Generic shim → Task adapter
    // -------------------------------------------------------------------

    private Task<string> Invoke(Action<OpenIapMauiShim.IResultCallback> dispatch)
    {
        var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        var cb = new ResultBridge((json, error) =>
        {
            if (error is not null)
            {
                tcs.TrySetException(MapThrowable(error));
            }
            else
            {
                tcs.TrySetResult(json ?? "");
            }
        });
        try { dispatch(cb); }
        catch (Exception e) { tcs.TrySetException(MapThrowable(e)); }
        return tcs.Task;
    }

    private static OpenIapException MapThrowable(Exception e)
    {
        // OpenIapMauiShim re-throws OpenIapError subclasses directly; their
        // localized message is the original `code: message` string in many
        // cases. The first-pass mapping just stuffs everything into a
        // generic Unknown error and lets DebugMessage carry the raw text;
        // fine-grained code parsing is best-effort below.
        var raw = e.Message ?? e.GetType().Name;
        var code = raw.Contains("not-prepared", StringComparison.OrdinalIgnoreCase)
            ? ErrorCode.NotPrepared
            : raw.Contains("user-cancelled", StringComparison.OrdinalIgnoreCase)
                ? ErrorCode.UserCancelled
                : ErrorCode.Unknown;
        return OpenIapErrorMapper.Wrap(code, raw);
    }

    // -------------------------------------------------------------------
    // Listener / callback bridges (Java SAM interfaces -> C# delegates)
    // -------------------------------------------------------------------

    private sealed class ResultBridge : Java.Lang.Object, OpenIapMauiShim.IResultCallback
    {
        private readonly Action<string?, Java.Lang.Throwable?> _on;
        public ResultBridge(Action<string?, Java.Lang.Throwable?> on) { _on = on; }
        public void OnResult(string? json, Java.Lang.Throwable? error) => _on(json, error);
    }

    private sealed class EventBridge : Java.Lang.Object, OpenIapMauiShim.IEventCallback
    {
        private readonly Action<string> _on;
        public EventBridge(Action<string> on) { _on = on; }
        public void OnEvent(string json) => _on(json);
    }
}
