// ============================================================================
// OpenIAP — public API surface for .NET MAUI
// ============================================================================
//
// The static `OpenIapClient` class is the recommended entry point. It
// delegates to a platform implementation that is selected at compile time (see
// the Platforms/ folder). The older `Iap` facade remains as a compatibility
// shim, but the longer name avoids collisions with app namespaces such as
// `OpenIap.Maui.Iap`. Mirrors the API surface of:
//   - react-native-iap / expo-iap (TypeScript)
//   - flutter_inapp_purchase (Dart)
//   - kmp-iap (Kotlin)
//   - godot-iap (GDScript)
// All concrete behaviour comes from the OpenIAP native packages
// (`packages/apple` and `packages/google`) — this library is a thin .NET
// projection of that contract, generated from the GraphQL schema in
// `packages/gql`.
//
// QueryResolver / MutationResolver / SubscriptionResolver in the generated
// Types.cs declare the full operation surface. Concrete `IOpenIap`
// implementations should also implement the resolver interfaces from
// `OpenIap` so the entire OpenIAP API is callable through one object.

#nullable enable

using System;
using System.ComponentModel;
using System.Threading.Tasks;
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
/// Static convenience facade. Resolves the platform implementation lazily so
/// host apps can write <c>await OpenIapClient.Instance.FetchProductsAsync(...)</c>
/// once the platform impl also implements <c>QueryResolver</c>.
/// </summary>
public static class OpenIapClient
{
    private static IOpenIap? _instance;

    /// <summary>
    /// Returns the platform-resolved <see cref="IOpenIap"/> instance. The
    /// resolver is set by the platform-specific partial in
    /// <c>Platforms/&lt;Platform&gt;/OpenIapPlatform.cs</c>.
    /// </summary>
    public static IOpenIap Instance
    {
        get
        {
            _instance ??= OpenIapPlatform.Create();
            return _instance;
        }
    }

    /// <summary>
    /// Override the resolved instance — primarily for tests / DI containers
    /// that want to inject a fake.
    /// </summary>
    public static void OverrideInstance(IOpenIap instance)
    {
        var next = instance ?? throw new ArgumentNullException(nameof(instance));
        var previous = _instance;
        if (!ReferenceEquals(previous, next) && previous is IDisposable disposable)
        {
            disposable.Dispose();
        }
        _instance = next;
    }

    /// <summary>
    /// Create a client for OpenIAP kit's HTTP API. Mirrors the JavaScript
    /// <c>kitApi(...)</c> helper.
    /// </summary>
    public static KitApiClient KitApi(KitApiOptions options) => new(options);

}

/// <summary>
/// Backward-compatible alias for <see cref="OpenIapClient"/>. This facade will
/// be removed in OpenIap.Maui 2.0.0. New code should use
/// <see cref="OpenIapClient"/> to avoid namespace/type name collisions in
/// projects whose namespaces start with <c>OpenIap.Maui.Iap</c>.
/// </summary>
[Obsolete("Use OpenIapClient instead. The Iap facade will be removed in OpenIap.Maui 2.0.0.")]
[EditorBrowsable(EditorBrowsableState.Never)]
public static class Iap
{
    /// <inheritdoc cref="OpenIapClient.Instance"/>
    public static IOpenIap Instance => OpenIapClient.Instance;

    /// <inheritdoc cref="OpenIapClient.OverrideInstance(IOpenIap)"/>
    public static void OverrideInstance(IOpenIap instance)
        => OpenIapClient.OverrideInstance(instance);

    /// <inheritdoc cref="OpenIapClient.KitApi(KitApiOptions)"/>
    public static KitApiClient KitApi(KitApiOptions options)
        => OpenIapClient.KitApi(options);

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
