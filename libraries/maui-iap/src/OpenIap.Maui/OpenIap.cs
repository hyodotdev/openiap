// ============================================================================
// OpenIAP — public API surface for .NET MAUI
// ============================================================================
//
// The static `OpenIapClient` class is the recommended entry point. It
// delegates to a platform implementation that is selected at compile time (see
// the Platforms/ folder). Mirrors the API surface of:
//   - react-native-iap / expo-iap (TypeScript)
//   - flutter_inapp_purchase (Dart)
//   - kmp-iap (Kotlin)
//   - godot-iap (GDScript)
// All concrete behaviour comes from the OpenIAP native packages
// (`packages/apple` and `packages/google`) — this library is a thin .NET
// projection of that contract, generated from the GraphQL schema in
// `specs/client`.
//
// Every `IOpenIap` implementation, including the unsupported-platform
// fallback, also implements the generated QueryResolver and MutationResolver.

#nullable enable

using System;
using OpenIap;

namespace OpenIap.Maui;

/// <summary>
/// The unified OpenIAP listener contract. Subscription-style events
/// (purchase updates, errors, promoted products) are surfaced as
/// <see cref="IObservable{T}"/> streams instead of GraphQL subscription
/// fields. The full operation surface comes from the generated
/// <c>QueryResolver</c> and <c>MutationResolver</c> interfaces in
/// <c>OpenIap.Types.cs</c> — concrete platform implementations should
/// implement those too.
/// </summary>
public interface IOpenIap
{
    /// <summary>
    /// Stream of successful purchase updates. Mirrors
    /// <c>SubscriptionResolver.purchaseUpdated</c> from the GraphQL schema.
    /// </summary>
    IObservable<Purchase> PurchaseUpdated { get; }

    /// <summary>
    /// Stream of successful purchase updates with listener options. On iOS,
    /// set <see cref="PurchaseUpdatedListenerOptions.DedupeTransactionIOS"/>
    /// to false to also emit StoreKit replay events for transaction IDs already
    /// delivered during the current connection session. Android ignores this flag.
    /// </summary>
    IObservable<Purchase> PurchaseUpdatedWithOptions(PurchaseUpdatedListenerOptions? options = null);

    /// <summary>
    /// Stream of purchase failures. Mirrors
    /// <c>SubscriptionResolver.purchaseError</c>.
    /// </summary>
    IObservable<PurchaseError> PurchaseError { get; }

    /// <summary>
    /// Stream of promoted products surfaced by the App Store (iOS only).
    /// Empty stream on Android / unsupported platforms.
    /// </summary>
    IObservable<string> PromotedProductIOS { get; }

    /// <summary>
    /// Stream of active subscriptions that entered a billing-issue state
    /// (payment failed, card expired). iOS 18+ via StoreKit Message;
    /// Android Play Billing 8.1+ via Purchase.isSuspended. Horizon flavor
    /// never emits.
    /// </summary>
    IObservable<Purchase> SubscriptionBillingIssue { get; }

    /// <summary>
    /// Stream of user-choice-billing selections (Android Play Billing 7.0+).
    /// Empty stream on iOS.
    /// </summary>
    IObservable<UserChoiceBillingDetails> UserChoiceBillingAndroid { get; }

    /// <summary>
    /// Stream of developer-provided-billing selections (Android Play Billing 8.3+).
    /// Empty stream on iOS.
    /// </summary>
    IObservable<DeveloperProvidedBillingDetailsAndroid> DeveloperProvidedBillingAndroid { get; }
}

/// <summary>
/// Static convenience facade. Cast <see cref="Instance"/> to a generated
/// resolver to call an operation, for example
/// <c>await ((QueryResolver)OpenIapClient.Instance).FetchProductsAsync(request)</c>.
/// </summary>
public static class OpenIapClient
{
    // One store client per process: Meta Horizon ends the app when a second billing client
    // queries purchases. Creation and replacement share this lock so neither can overlap.
    private static readonly object InstanceLock = new();
    private static IOpenIap? _instance;

    /// <summary>
    /// The platform implementation, created on first use. A failed creation is
    /// not cached, so the next read tries again.
    /// </summary>
    public static IOpenIap Instance
    {
        get
        {
            lock (InstanceLock) return _instance ??= OpenIapPlatform.Create();
        }
    }

    /// <summary>
    /// Replace the instance with a test or DI fake. The replaced instance is
    /// disposed, and on Android its store connection ends asynchronously, so
    /// never pass an instance that opens a store connection of its own.
    /// </summary>
    public static void OverrideInstance(IOpenIap instance)
    {
        ArgumentNullException.ThrowIfNull(instance);
        lock (InstanceLock)
        {
            var previous = _instance;
            _instance = instance;
            if (!ReferenceEquals(previous, instance) && previous is IDisposable disposable)
            {
                disposable.Dispose();
            }
        }
    }

    /// <summary>
    /// Create a client for OpenIAP kit's HTTP API. Mirrors the JavaScript
    /// <c>kitApi(...)</c> helper.
    /// </summary>
    public static KitApiClient KitApi(KitApiOptions options) => new(options);

}

/// <summary>
/// Platform factory. The actual implementation is provided by the
/// per-platform <c>OpenIapPlatform.&lt;platform&gt;.cs</c> file. The
/// non-platform target falls through to <see cref="UnsupportedOpenIap"/>
/// so that purely shared MAUI code can be authored against the type
/// without pulling in StoreKit / Billing references.
/// </summary>
internal static class OpenIapPlatform
{
    public static IOpenIap Create()
    {
#if ANDROID
        return new Platforms.Android.OpenIapAndroid();
#elif IOS
        return new Platforms.iOS.OpenIapIOS();
#elif MACCATALYST
        return new Platforms.MacCatalyst.OpenIapMacCatalyst();
#else
        return new UnsupportedOpenIap();
#endif
    }
}
