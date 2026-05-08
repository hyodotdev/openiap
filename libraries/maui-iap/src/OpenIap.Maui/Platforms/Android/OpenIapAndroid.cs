// Android resolver — delegates every QueryResolver / MutationResolver call to
// the OpenIapMauiModule Java/Kotlin facade owned by `libraries/maui-iap`
// (which itself wraps `OpenIapModule`). All inputs are JSON-encoded via the same
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
using OpenIap;
// The AAR binding emits `Dev.Hyo.Openiap.Maui.OpenIapMauiModule` from the
// Java package dev.hyo.openiap.maui — alias for ergonomics.
using OpenIapMauiModule = global::Dev.Hyo.Openiap.Maui.OpenIapMauiModule;

namespace OpenIap.Maui.Platforms.Android;

internal sealed partial class OpenIapAndroid : IOpenIap, QueryResolver, MutationResolver
{
    private readonly OpenIapMauiModule _module;
    private readonly Subject<Purchase> _purchaseUpdated = new();
    private readonly Subject<PurchaseError> _purchaseError = new();
    private readonly Subject<string> _promotedProductIOS = new();
    private readonly Subject<Purchase> _subscriptionBillingIssue = new();
    private readonly Subject<UserChoiceBillingDetails> _userChoiceBillingAndroid = new();
    private readonly Subject<DeveloperProvidedBillingDetailsAndroid> _developerProvidedBillingAndroid = new();

    public OpenIapAndroid()
    {
        // Application.Context is the process-scoped singleton context owned by
        // the Android framework — its lifetime IS the process lifetime, so
        // capturing it here cannot leak (unlike capturing an Activity context,
        // which is the actual context-leak antipattern). This is the
        // recommended Android pattern for app-scoped singletons that need a
        // Context but no Activity-bound APIs.
        var ctx = global::Android.App.Application.Context
            ?? throw new InvalidOperationException("Android.App.Application.Context is null; OpenIapAndroid requires an initialised app context.");
        _module = new OpenIapMauiModule(ctx);
        WireListeners();
    }

    /// <summary>
    /// Host MAUI apps may forward Activity lifecycle events here. The Android
    /// implementation also refreshes MAUI's current Activity before operations
    /// that require it, so the common case works without app-level wiring.
    /// </summary>
    public void SetActivity(global::Android.App.Activity? activity) => _module.SetActivity(activity);

    private void RefreshCurrentActivity()
    {
        var activity = global::Microsoft.Maui.ApplicationModel.Platform.CurrentActivity;
        if (activity is not null)
        {
            SetActivity(activity);
        }
    }

    public IObservable<Purchase> PurchaseUpdated => _purchaseUpdated;
    public IObservable<PurchaseError> PurchaseError => _purchaseError;
    public IObservable<string> PromotedProductIOS => _promotedProductIOS;
    public IObservable<Purchase> SubscriptionBillingIssue => _subscriptionBillingIssue;
    public IObservable<UserChoiceBillingDetails> UserChoiceBillingAndroid => _userChoiceBillingAndroid;
    public IObservable<DeveloperProvidedBillingDetailsAndroid> DeveloperProvidedBillingAndroid => _developerProvidedBillingAndroid;

    private void WireListeners()
    {
        _module.AddPurchaseUpdatedListener(new EventBridge(json =>
        {
            try
            {
                var purchase = JsonSerializer.Deserialize<Purchase>(json, JsonOptions.Default);
                if (purchase is not null) _purchaseUpdated.OnNext(purchase);
            }
            catch (JsonException) { /* malformed payload — ignore */ }
        }));

        _module.AddPurchaseErrorListener(new EventBridge(json =>
        {
            _purchaseError.OnNext(OpenIapErrorMapper.FromJson(json));
        }));

        _module.AddSubscriptionBillingIssueListener(new EventBridge(json =>
        {
            try
            {
                var purchase = JsonSerializer.Deserialize<Purchase>(json, JsonOptions.Default);
                if (purchase is not null) _subscriptionBillingIssue.OnNext(purchase);
            }
            catch (JsonException) { }
        }));

        _module.AddUserChoiceBillingAndroidListener(new EventBridge(json =>
        {
            try
            {
                var details = JsonSerializer.Deserialize<UserChoiceBillingDetails>(json, JsonOptions.Default);
                if (details is not null) _userChoiceBillingAndroid.OnNext(details);
            }
            catch (JsonException) { }
        }));

        _module.AddDeveloperProvidedBillingAndroidListener(new EventBridge(json =>
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
    // Generic module → Task adapter
    // -------------------------------------------------------------------

    private Task<string> Invoke(Action<OpenIapMauiModule.IResultCallback> dispatch)
    {
        var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        var cb = new ResultBridge((json, errorJson) =>
        {
            if (!string.IsNullOrEmpty(errorJson))
            {
                var mapped = OpenIapErrorMapper.FromJson(errorJson);
                Console.WriteLine($"[OpenIapAndroid] module callback error: {mapped.Code}: {mapped.Message}");
                tcs.TrySetException(new OpenIapException(mapped));
            }
            else
            {
                tcs.TrySetResult(json ?? "");
            }
        });
        try { dispatch(cb); }
        catch (Exception e)
        {
            Console.WriteLine($"[OpenIapAndroid] module dispatch threw: {e.GetType().Name}: {e.Message}");
            tcs.TrySetException(MapThrowable(e));
        }
        return tcs.Task;
    }

    private static OpenIapException MapThrowable(Exception e)
    {
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

    private sealed class ResultBridge : Java.Lang.Object, OpenIapMauiModule.IResultCallback
    {
        private readonly Action<string?, string?> _on;
        public ResultBridge(Action<string?, string?> on) { _on = on; }
        public void OnResult(string? json, string? errorJson) => _on(json, errorJson);
    }

    private sealed class EventBridge : Java.Lang.Object, OpenIapMauiModule.IEventCallback
    {
        private readonly Action<string> _on;
        public EventBridge(Action<string> on) { _on = on; }
        public void OnEvent(string json) => _on(json);
    }
}
